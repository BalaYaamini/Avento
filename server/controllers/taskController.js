const supabase = require('../config/supabaseClient');

// Helper to reliably populate assigned_user and created_user for tasks
const hydrateTasksWithProfiles = async (rawTasks, eventId) => {
  const taskList = Array.isArray(rawTasks) ? rawTasks : [rawTasks].filter(Boolean);
  if (taskList.length === 0) return Array.isArray(rawTasks) ? [] : null;

  const userIds = new Set();
  taskList.forEach(t => {
    if (t.assigned_to) userIds.add(t.assigned_to);
    if (t.created_by) userIds.add(t.created_by);
  });

  let profilesMap = {};
  if (userIds.size > 0) {
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, name, email, department, role')
      .in('id', Array.from(userIds));
    profilesMap = (profilesData || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
  }

  let membersMap = {};
  if (eventId) {
    const { data: members } = await supabase
      .from('event_members')
      .select('user_id, name, email')
      .eq('event_id', eventId);
    membersMap = (members || []).reduce((acc, m) => ({ ...acc, [m.user_id]: m }), {});
  }

  const hydrated = taskList.map(task => {
    const pAssigned = task.assigned_to ? profilesMap[task.assigned_to] : null;
    const mAssigned = task.assigned_to ? membersMap[task.assigned_to] : null;
    const assignedUser = pAssigned || mAssigned || (task.assigned_to ? { id: task.assigned_to, name: 'Assigned Organizer' } : null);

    const pCreated = task.created_by ? profilesMap[task.created_by] : null;
    const mCreated = task.created_by ? membersMap[task.created_by] : null;
    const createdUser = pCreated || mCreated || (task.created_by ? { id: task.created_by, name: 'Organizer' } : null);

    return {
      ...task,
      assigned_user: assignedUser,
      created_user: createdUser
    };
  });

  return Array.isArray(rawTasks) ? hydrated : hydrated[0];
};

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

    const tasksWithProfiles = await hydrateTasksWithProfiles(tasks, eventId);

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
    const { title, description, category, assigned_to, priority, deadline, status } = req.body;
    const userId = req.user.id;

    // Fetch event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, faculty_id, student_organizer_id, proposed_by, created_by, organizer_id, date')
      .eq('id', eventId)
      .maybeSingle();

    if (eventError || !event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    // Permission Enforcement:
    // Admin -> ALLOWED
    // Faculty Coordinator -> ALLOWED (must be faculty role AND associated with this event)
    // Student Lead (Event Creator / Proposer) -> ALLOWED
    // Other Student Coordinators -> DENIED
    const isAdmin = req.user.roles?.includes('admin') || req.user.role === 'admin';
    const isFacultyRole = req.user.roles?.includes('faculty') || req.user.roles?.includes('faculty_organizer') || req.user.role === 'faculty' || req.user.role === 'faculty_organizer';

    let isEventFaculty = String(userId) === String(event.faculty_id);
    if (!isEventFaculty && isFacultyRole) {
      if (String(userId) === String(event.proposed_by) || String(userId) === String(event.created_by) || String(userId) === String(event.student_organizer_id) || String(userId) === String(event.organizer_id)) {
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

    const isStudentLead = Boolean(
      String(userId) === String(event.student_organizer_id) ||
      String(userId) === String(event.proposed_by) ||
      String(userId) === String(event.organizer_id) ||
      String(userId) === String(event.created_by)
    );

    if (!isAdmin && !isAuthorizedFacultyCoordinator && !isStudentLead) {
      return res.status(403).json({ message: 'Access denied. Student Coordinators are not allowed to create or assign tasks. Only Admins, Faculty Coordinators, and the Student Lead can create tasks.' });
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
        status: status || 'To Do',
        deadline: deadline || null,
        created_by: userId
      }])
      .select('*')
      .single();

    if (error) throw error;

    const taskWithProfile = await hydrateTasksWithProfiles(task, eventId);

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
      .select('*, events(id, faculty_id, student_organizer_id, date, proposed_by, created_by, organizer_id)')
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
      if (String(userId) === String(event.proposed_by) || String(userId) === String(event.created_by) || String(userId) === String(event.student_organizer_id) || String(userId) === String(event.organizer_id)) {
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

    const isStudentLead = Boolean(
      String(userId) === String(event.student_organizer_id) ||
      String(userId) === String(event.proposed_by) ||
      String(userId) === String(event.organizer_id) ||
      String(userId) === String(event.created_by)
    );

    // If NOT Admin, NOT Faculty Coordinator, and NOT Student Lead (e.g. other Student Organizers):
    // They are allowed to update task status, but NOT reassign or edit task creation parameters
    if (!isAdmin && !isAuthorizedFacultyCoordinator && !isStudentLead) {
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
      
      const taskWithProfile = await hydrateTasksWithProfiles(updatedTask, eventId);
      
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

    const taskWithProfile = await hydrateTasksWithProfiles(updatedTask, eventId);

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
      .select('event_id, events(id, faculty_id, student_organizer_id, proposed_by, created_by, organizer_id)')
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
      if (String(userId) === String(event.proposed_by) || String(userId) === String(event.created_by) || String(userId) === String(event.student_organizer_id) || String(userId) === String(event.organizer_id)) {
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

    const isStudentLead = Boolean(
      String(userId) === String(event.student_organizer_id) ||
      String(userId) === String(event.proposed_by) ||
      String(userId) === String(event.organizer_id) ||
      String(userId) === String(event.created_by)
    );

    if (!isAdmin && !isAuthorizedFacultyCoordinator && !isStudentLead) {
      return res.status(403).json({ message: 'Access denied. Only Admins, Faculty Coordinators, and the Student Lead can delete tasks.' });
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
      .select('id, task_id, user_id, message, created_at')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    if (!comments || comments.length === 0) {
      return res.status(200).json([]);
    }

    const userIds = Array.from(new Set(comments.map(c => c.user_id).filter(Boolean)));
    let profilesMap = {};
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, email, role, department')
        .in('id', userIds);
      profilesMap = (profilesData || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
    }

    const commentsWithProfiles = comments.map(c => ({
      ...c,
      profiles: profilesMap[c.user_id] || { id: c.user_id, name: 'User' }
    }));

    res.status(200).json(commentsWithProfiles);
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

    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Comment message is required.' });
    }

    const { data: comment, error } = await supabase
      .from('task_comments')
      .insert([{
        task_id: taskId,
        user_id: userId,
        message: message.trim()
      }])
      .select('id, task_id, user_id, message, created_at')
      .single();

    if (error) throw error;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, email, role, department')
      .eq('id', userId)
      .maybeSingle();

    const enrichedComment = {
      ...comment,
      profiles: profile || { id: userId, name: req.user.name || req.user.email || 'User' }
    };

    res.status(201).json({ message: 'Comment added', comment: enrichedComment });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
