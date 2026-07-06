const supabase = require('../config/supabaseClient');
const { notifyUser } = require('../services/notificationService');

// Get all notifications for the logged-in user
exports.getUserNotifications = async (req, res) => {
  try {
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Map to camelCase for the frontend
    const mapped = (notifications || []).map(notif => ({
      id: notif.id,
      recipientId: notif.recipient_id,
      title: notif.title,
      message: notif.message,
      type: notif.type,
      eventId: notif.event_id,
      isRead: notif.is_read,
      createdAt: notif.created_at
    }));

    res.json(mapped);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ message: 'Failed to retrieve notifications.', error: err.message });
  }
};

// Mark a specific notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: notification, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('recipient_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found.' });
    }
    res.json({
      id: notification.id,
      recipientId: notification.recipient_id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      eventId: notification.event_id,
      isRead: notification.is_read,
      createdAt: notification.created_at
    });
  } catch (err) {
    console.error('Error marking notification read:', err);
    res.status(500).json({ message: 'Failed to update notification.', error: err.message });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', req.user.id)
      .eq('is_read', false);

    if (error) throw error;
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    console.error('Error marking all notifications read:', err);
    res.status(500).json({ message: 'Failed to update notifications.', error: err.message });
  }
};

// Optionally, create a notification (admin/faculty use)
exports.createNotification = async (req, res) => {
  try {
    const { userId, title, message, type, eventId } = req.body;
    if (!userId || !title || !message) {
      return res.status(400).json({ message: 'userId, title and message are required.' });
    }
    
    await notifyUser({
      recipientId: userId,
      title,
      message,
      type: type || 'info',
      eventId
    });
    
    res.status(201).json({ message: 'Notification created successfully.' });
  } catch (err) {
    console.error('Error creating notification:', err);
    res.status(500).json({ message: 'Failed to create notification.', error: err.message });
  }
};

// Organizer route for event announcements
exports.sendEventAnnouncement = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { title, message } = req.body;
    
    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required.' });
    }

    const { data: event, error: eventErr } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle();
    if (eventErr || !event) return res.status(404).json({ message: 'Event not found.' });

    // Verify access
    if (!req.user.roles.includes('admin')) {
      const isOwner = event.organizer_id === req.user.id || 
                      event.student_organizer_id === req.user.id || 
                      event.proposed_by === req.user.id ||
                      event.faculty_id === req.user.id;
      if (!isOwner) return res.status(403).json({ message: 'Access denied.' });
    }

    const { data: registrations, error: regErr } = await supabase.from('event_registrations').select('user_id').eq('event_id', eventId);
    if (regErr) throw regErr;

    const userIds = registrations.map(reg => reg.user_id);

    // Send notification to all registered users
    for (const uid of userIds) {
      await notifyUser({
        recipientId: uid,
        title: `Update for ${event.title}: ${title}`,
        message,
        type: 'info',
        eventId: event.id
      });
    }

    res.json({ message: `Announcement sent to ${userIds.length} participants.` });
  } catch (err) {
    console.error('Error sending announcement:', err);
    res.status(500).json({ message: 'Failed to send announcement.', error: err.message });
  }
};
