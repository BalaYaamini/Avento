const supabase = require('../config/supabaseClient');

// Get all tasks for an event
exports.getEventTasks = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('id, faculty_id, student_organizer_id, proposed_by, created_by')
      .eq('id', eventId)
      .maybeSingle();

    if (eventErr || !event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    const isAdmin = req.user.roles?.includes('admin') || req.user.role === 'admin';
    const isFaculty = String(userId) === String(event.faculty_id);
    const isOrganizer = String(userId) === String(event.student_organizer_id) ||
                        String(userId) === String(event.proposed_by) ||
                        String(userId) === String(event.created_by);

    let isMember = false;
    if (!isAdmin && !isFaculty && !isOrganizer) {
      const { data: org } = await supabase
        .from('event_organizers')
        .select('id')
        .eq('event_id', eventId)
        .eq('student_id', userId)
        .maybeSingle();
      if (org) isMember = true;

      if (!isMember) {
        const { data: mem } = await supabase
          .from('event_members')
          .select('id')
          .eq('event_id', eventId)
          .eq('user_id', userId)
          .maybeSingle();
        if (mem) isMember = true;
      }
    }

    if (!isAdmin && !isFaculty && !isOrganizer && !isMember) {
      return res.status(403).json({ message: 'Access denied. You do not have permission to view tasks for this event.' });
    }

    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const { data: profiles } = await supabase.from('profiles').select('id, name, email');
    
    const tasksWithProfiles = (tasks || []).map(task => {
      const assigned = profiles?.find(p => p.id === task.assigned_to);
      const created = profiles?.find(p => p.id === task.created_by);
      return {
        ...task,
        assigned_user: assigned || null,
        created_user: created || null
      };
    });

    res.status(200).json(tasksWithProfiles);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create a new task
exports.createTask = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { title, description, category, assigned_to, priority, deadline } = req.body;
    const userId = req.user.id;

    // Fetch event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, faculty_id, student_organizer_id, proposed_by, created_by, date')
      .eq('id', eventId)
      .maybeSingle();

    if (eventError || !event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    // Permission Enforcement:
    // Admin -> ALLOWED
    // Faculty Coordinator -> ALLOWED (must be faculty role AND associated with this event)
    // Student Coordinator -> DENIED
    const isAdmin = req.user.roles?.includes('admin') || req.user.role === 'admin';
    const isFacultyRole = req.user.roles?.includes('faculty') || req.user.roles?.includes('faculty_organizer') || req.user.role === 'faculty' || req.user.role === 'faculty_organizer';

    let isEventFaculty = String(userId) === String(event.faculty_id);
    if (!isEventFaculty && isFacultyRole) {
      if (String(userId) === String(event.proposed_by) || String(userId) === String(event.created_by) || String(userId) === String(event.student_organizer_id)) {
        isEventFaculty = true;
      } else {
        const { data: orgRec } = await supabase
          .from('event_organizers')
          .select('id')
          .eq('event_id', eventId)
          .eq('student_id', userId)
          .maybeSingle();
        if (orgRec) isEventFaculty = true;
        else {
          const { data: memRec } = await supabase
            .from('event_members')
            .select('id')
            .eq('event_id', eventId)
            .eq('user_id', userId)
            .maybeSingle();
          if (memRec) isEventFaculty = true;
        }
      }
    }

    const isAuthorizedFacultyCoordinator = isFacultyRole && (isEventFaculty || !event.faculty_id);

    if (!isAdmin && !isAuthorizedFacultyCoordinator) {
      return res.status(403).json({ message: 'Access denied. Student Coordinators are not allowed to create or assign tasks. Only Admins and Faculty Coordinators can create tasks.' });
    }

    if (deadline) {
      const d = new Date(deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const eDate = new Date(event.date);
      eDate.setHours(23, 59, 59, 999);
      if (d < today || d > eDate) {
        return res.status(400).json({ message: 'Invalid task due date. Must be between today and the event date.' });
      }
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .insert([{
        event_id: eventId,
        title,
        description,
        category,
        assigned_to: assigned_to || null,
        priority: priority || 'Medium',
        status: 'To Do',
        deadline: deadline || null,
        created_by: userId
      }])
      .select('*')
      .single();

    if (error) throw error;

    const { data: profiles } = await supabase.from('profiles').select('id, name, email');
    const assigned = profiles?.find(p => p.id === task.assigned_to);
    const created = profiles?.find(p => p.id === task.created_by);
    
    const taskWithProfile = {
      ...task,
      assigned_user: assigned || null,
      created_user: created || null
    };

    res.status(201).json({ message: 'Task created successfully', task: taskWithProfile });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update task (status, assignment, details)
exports.updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, description, category, assigned_to, priority, status, deadline } = req.body;
    const userId = req.user.id;

    // Get task details first
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('*, events(id, faculty_id, student_organizer_id, date, proposed_by, created_by)')
      .eq('id', taskId)
      .maybeSingle();

    if (taskError || !task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    const eventId = task.event_id;
    const event = task.events;

    if (deadline !== undefined && deadline !== null && deadline !== '') {
      const d = new Date(deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const eDate = new Date(event.date);
      eDate.setHours(23, 59, 59, 999);
      if (d < today || d > eDate) {
        return res.status(400).json({ message: 'Invalid task due date. Must be between today and the event date.' });
      }
    }

    const isAdmin = req.user.roles?.includes('admin') || req.user.role === 'admin';
    const isFacultyRole = req.user.roles?.includes('faculty') || req.user.roles?.includes('faculty_organizer') || req.user.role === 'faculty' || req.user.role === 'faculty_organizer';

    let isEventFaculty = String(userId) === String(event.faculty_id);
    if (!isEventFaculty && isFacultyRole) {
      if (String(userId) === String(event.proposed_by) || String(userId) === String(event.created_by) || String(userId) === String(event.student_organizer_id)) {
        isEventFaculty = true;
      } else {
        const { data: orgRec } = await supabase
          .from('event_organizers')
          .select('id')
          .eq('event_id', eventId)
          .eq('student_id', userId)
          .maybeSingle();
        if (orgRec) isEventFaculty = true;
        else {
          const { data: memRec } = await supabase
            .from('event_members')
            .select('id')
            .eq('event_id', eventId)
            .eq('user_id', userId)
            .maybeSingle();
          if (memRec) isEventFaculty = true;
        }
      }
    }

    const isAuthorizedFacultyCoordinator = isFacultyRole && (isEventFaculty || !event.faculty_id);

    // If NOT Admin and NOT Faculty Coordinator (e.g. Student Coordinator):
    // They are allowed to update task status, but NOT reassign or edit task creation parameters
    if (!isAdmin && !isAuthorizedFacultyCoordinator) {
      // Check if trying to change assigned_to
      if (assigned_to !== undefined && assigned_to !== task.assigned_to) {
        return res.status(403).json({ message: 'Student Coordinators are not allowed to reassign tasks.' });
      }

      // Update status only
      const { data: updatedTask, error } = await supabase
        .from('tasks')
        .update({
          status: status !== undefined ? status : task.status,
          updated_at: new Date()
        })
        .eq('id', taskId)
        .select('*')
        .single();

      if (error) throw error;
      
      const { data: profiles } = await supabase.from('profiles').select('id, name, email');
      const assigned = profiles?.find(p => p.id === updatedTask.assigned_to);
      const created = profiles?.find(p => p.id === updatedTask.created_by);
      
      const taskWithProfile = {
        ...updatedTask,
        assigned_user: assigned || null,
        created_user: created || null
      };
      
      return res.status(200).json({ message: 'Task status updated', task: taskWithProfile });
    }

    // Admin & Faculty Coordinator: Full update allowed
    const { data: updatedTask, error } = await supabase
      .from('tasks')
      .update({
        title: title !== undefined ? title : task.title,
        description: description !== undefined ? description : task.description,
        category: category !== undefined ? category : task.category,
        assigned_to: assigned_to !== undefined ? assigned_to : task.assigned_to,
        priority: priority !== undefined ? priority : task.priority,
        status: status !== undefined ? status : task.status,
        deadline: deadline !== undefined ? deadline : task.deadline,
        updated_at: new Date()
      })
      .eq('id', taskId)
      .select('*')
      .single();

    if (error) throw error;

    const { data: profiles } = await supabase.from('profiles').select('id, name, email');
    const assigned = profiles?.find(p => p.id === updatedTask.assigned_to);
    const created = profiles?.find(p => p.id === updatedTask.created_by);
    
    const taskWithProfile = {
      ...updatedTask,
      assigned_user: assigned || null,
      created_user: created || null
    };

    res.status(200).json({ message: 'Task updated successfully', task: taskWithProfile });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete task
exports.deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('event_id, events(id, faculty_id, student_organizer_id, proposed_by, created_by)')
      .eq('id', taskId)
      .maybeSingle();

    if (taskError || !task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    const eventId = task.event_id;
    const event = task.events;

    const isAdmin = req.user.roles?.includes('admin') || req.user.role === 'admin';
    const isFacultyRole = req.user.roles?.includes('faculty') || req.user.roles?.includes('faculty_organizer') || req.user.role === 'faculty' || req.user.role === 'faculty_organizer';

    let isEventFaculty = String(userId) === String(event.faculty_id);
    if (!isEventFaculty && isFacultyRole) {
      if (String(userId) === String(event.proposed_by) || String(userId) === String(event.created_by) || String(userId) === String(event.student_organizer_id)) {
        isEventFaculty = true;
      } else {
        const { data: orgRec } = await supabase
          .from('event_organizers')
          .select('id')
          .eq('event_id', eventId)
          .eq('student_id', userId)
          .maybeSingle();
        if (orgRec) isEventFaculty = true;
        else {
          const { data: memRec } = await supabase
            .from('event_members')
            .select('id')
            .eq('event_id', eventId)
            .eq('user_id', userId)
            .maybeSingle();
          if (memRec) isEventFaculty = true;
        }
      }
    }

    const isAuthorizedFacultyCoordinator = isFacultyRole && (isEventFaculty || !event.faculty_id);

    if (!isAdmin && !isAuthorizedFacultyCoordinator) {
      return res.status(403).json({ message: 'Access denied. Only Admins and Faculty Coordinators can delete tasks.' });
    }

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) throw error;

    res.status(200).json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get comments for a task
exports.getTaskComments = async (req, res) => {
  try {
    const { taskId } = req.params;

    const { data: comments, error } = await supabase
      .from('task_comments')
      .select(`
        id, task_id, message, created_at,
        profiles!user_id(id, role, raw_user_meta_data, email)
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.status(200).json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Add comment to a task
exports.addTaskComment = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { message } = req.body;
    const userId = req.user.id;

    if (!message) {
      return res.status(400).json({ message: 'Comment message is required.' });
    }

    const { data: comment, error } = await supabase
      .from('task_comments')
      .insert([{
        task_id: taskId,
        user_id: userId,
        message
      }])
      .select(`
        id, task_id, message, created_at,
        profiles!user_id(id, role, raw_user_meta_data, email)
      `)
      .single();

    if (error) throw error;

    res.status(201).json({ message: 'Comment added', comment });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
