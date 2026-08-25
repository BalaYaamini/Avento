const supabase = require('../config/supabaseClient');

const mapAnnouncement = (item, isRead = undefined) => ({
  id: item.id,
  title: item.title,
  message: item.message,
  imageUrl: item.image_url || '',
  audience: item.audience,
  status: item.status,
  eventId: item.event_id || '',
  eventName: item.event_name || '',
  authorName: item.author_name,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
  ...(isRead !== undefined ? { isRead } : {})
});

exports.listPublished = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: announcements, error: annErr } = await supabase
      .from('announcements')
      .select('*')
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (annErr) throw annErr;

    const { data: readRecords, error: readErr } = await supabase
      .from('announcement_reads')
      .select('announcement_id')
      .eq('user_id', userId);

    if (readErr) throw readErr;

    const readSet = new Set((readRecords || []).map(r => r.announcement_id));
    res.json((announcements || []).map(a => mapAnnouncement(a, readSet.has(a.id))));
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve announcements.', error: err.message });
  }
};

exports.listAll = async (req, res) => {
  try {
    const { data: announcements, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json((announcements || []).map(a => mapAnnouncement(a)));
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve announcements.', error: err.message });
  }
};

exports.getUnreadSummary = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: announcements, error: annErr } = await supabase
      .from('announcements')
      .select('*')
      .eq('status', 'published')
      .neq('event_id', '');

    if (annErr) throw annErr;

    const { data: readRecords, error: readErr } = await supabase
      .from('announcement_reads')
      .select('announcement_id')
      .eq('user_id', userId);

    if (readErr) throw readErr;

    const readSet = new Set((readRecords || []).map(r => r.announcement_id));
    const summary = {};

    for (const a of (announcements || [])) {
      if (!readSet.has(a.id)) {
        const eid = a.event_id;
        if (!summary[eid]) summary[eid] = { eventId: eid, eventName: a.event_name, count: 0 };
        summary[eid].count += 1;
      }
    }

    const totalUnread = Object.values(summary).reduce((s, g) => s + g.count, 0);
    res.json({ totalUnread, byEvent: Object.values(summary) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get unread summary.', error: err.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { error } = await supabase
      .from('announcement_reads')
      .upsert({ user_id: userId, announcement_id: id }, { onConflict: 'user_id,announcement_id' });

    if (error) throw error;
    res.json({ message: 'Marked as read.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark as read.', error: err.message });
  }
};

exports.markEventRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { eventId } = req.params;

    const { data: announcements, error: annErr } = await supabase
      .from('announcements')
      .select('id')
      .eq('status', 'published')
      .eq('event_id', eventId);

    if (annErr) throw annErr;

    if (announcements && announcements.length > 0) {
      const rows = announcements.map(a => ({ user_id: userId, announcement_id: a.id }));
      const { error: insertErr } = await supabase
        .from('announcement_reads')
        .upsert(rows, { onConflict: 'user_id,announcement_id' });

      if (insertErr) throw insertErr;
    }

    res.json({ message: 'All announcements for this event marked as read.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark event announcements as read.', error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { title, message, imageUrl = '', audience = 'all', status = 'published', eventId = '', eventName = '' } = req.body;
    if (!title?.trim() || !message?.trim()) {
      return res.status(400).json({ message: 'Title and message are required.' });
    }

    const { data: announcement, error } = await supabase
      .from('announcements')
      .insert({
        title,
        message,
        image_url: imageUrl,
        audience,
        status,
        event_id: eventId,
        event_name: eventName,
        author_id: req.user.id,
        author_name: req.user.fullName || 'Administrator'
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(mapAnnouncement(announcement));
  } catch (err) {
    res.status(400).json({ message: 'Failed to create announcement.', error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { title, message, imageUrl, audience, status, eventId, eventName } = req.body;

    const { data: announcement, error } = await supabase
      .from('announcements')
      .update({
        title,
        message,
        image_url: imageUrl,
        audience,
        status,
        event_id: eventId,
        event_name: eventName,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!announcement) return res.status(404).json({ message: 'Announcement not found.' });
    res.json(mapAnnouncement(announcement));
  } catch (err) {
    res.status(400).json({ message: 'Failed to update announcement.', error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    // Delete read records first (cascade should handle this, but be explicit)
    await supabase.from('announcement_reads').delete().eq('announcement_id', req.params.id);

    const { error } = await supabase.from('announcements').delete().eq('id', req.params.id);
    if (error) throw error;

    res.json({ message: 'Announcement deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete announcement.', error: err.message });
  }
};
