const supabase = require('../config/supabaseClient');

// Get all tasks for an event
exports.getEventTasks = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    console.log("Supabase client:", supabase);

    // Optional: add authorization check to ensure user is part of the event workspace
    // The workspace frontend handles primary visibility, but RLS/backend should be secure.

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
    const userId = req.user.id; // from auth middleware

    // Ensure only faculty/event head can create tasks
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('faculty_id, student_organizer_id, date')
      .eq('id', eventId)
      .single();

    if (eventError) throw eventError;

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

    if (req.user.role !== 'admin' && userId !== event.faculty_id && userId !== event.student_organizer_id) {
      return res.status(403).json({ message: 'Only the Faculty Coordinator or Event Head can create tasks.' });
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
      .select('*, events(faculty_id, student_organizer_id, date)')
      .eq('id', taskId)
      .single();

    if (taskError) throw taskError;

    if (deadline !== undefined && deadline !== null) {
      const d = new Date(deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const eDate = new Date(task.events.date);
      eDate.setHours(23, 59, 59, 999);
      if (d < today || d > eDate) {
        return res.status(400).json({ message: 'Invalid task due date. Must be between today and the event date.' });
      }
    }

    const isFaculty = userId === task.events.faculty_id;
    const isEventHead = userId === task.events.student_organizer_id;
    const isAdmin = req.user.role === 'admin';
    const isAssignedUser = userId === task.assigned_to;

    // Organizers can only update status if they are assigned
    if (!isAdmin && !isFaculty && !isEventHead) {
      if (!isAssignedUser) {
        return res.status(403).json({ message: 'You are not authorized to update this task.' });
      }
      
      // If it's an assigned organizer, they can ONLY update the status
      const { data: updatedTask, error } = await supabase
        .from('tasks')
        .update({ status, updated_at: new Date() })
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

    // Faculty/Head/Admin can update all fields
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
      .select('events(faculty_id, student_organizer_id)')
      .eq('id', taskId)
      .single();

    if (taskError) throw taskError;

    const isFaculty = userId === task.events.faculty_id;
    const isEventHead = userId === task.events.student_organizer_id;
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin && !isFaculty && !isEventHead) {
      return res.status(403).json({ message: 'Only the Faculty Coordinator or Event Head can delete tasks.' });
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
