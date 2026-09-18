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

    const { data: regs, error: regErr } = await supabase
      .from('event_registrations')
      .select('event_id, team_id')
      .eq('user_id', userId);

    if (regErr) throw regErr;

    const registeredEventIds = new Set();

    (regs || []).forEach(r => {
      if (r.event_id) registeredEventIds.add(String(r.event_id));
    });

    const teamIds = [...new Set((regs || []).map(r => r.team_id).filter(Boolean))];
    if (teamIds.length > 0) {
      const { data: teams } = await supabase
        .from('event_teams')
        .select('event_id')
        .in('id', teamIds)
        .eq('status', 'registered');
      (teams || []).forEach(t => { if (t.event_id) registeredEventIds.add(String(t.event_id)); });
    }

    const { data: ledTeams } = await supabase
      .from('event_teams')
      .select('event_id')
      .eq('leader_id', userId)
      .eq('status', 'registered');
    (ledTeams || []).forEach(t => { if (t.event_id) registeredEventIds.add(String(t.event_id)); });

    const readSet = new Set((readRecords || []).map(r => r.announcement_id));
    const visible = (announcements || []).filter(a => {
      if (a.audience !== 'registered') return true;
      return registeredEventIds.has(String(a.event_id));
    });

    res.json(visible.map(a => mapAnnouncement(a, readSet.has(a.id))));
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

    const { data: regs, error: regErr } = await supabase
      .from('event_registrations')
      .select('event_id, team_id')
      .eq('user_id', userId);

    if (regErr) throw regErr;

    const registeredEventIds = new Set();
    (regs || []).forEach(r => {
      if (r.event_id) registeredEventIds.add(String(r.event_id));
    });

    const teamIds = [...new Set((regs || []).map(r => r.team_id).filter(Boolean))];
    if (teamIds.length > 0) {
      const { data: teams } = await supabase
        .from('event_teams')
        .select('event_id')
        .in('id', teamIds)
        .eq('status', 'registered');
      (teams || []).forEach(t => { if (t.event_id) registeredEventIds.add(String(t.event_id)); });
    }

    const { data: ledTeams } = await supabase
      .from('event_teams')
      .select('event_id')
      .eq('leader_id', userId)
      .eq('status', 'registered');
    (ledTeams || []).forEach(t => { if (t.event_id) registeredEventIds.add(String(t.event_id)); });

    const readSet = new Set((readRecords || []).map(r => r.announcement_id));
    const summary = {};

    for (const a of (announcements || [])) {
      if (a.audience === 'registered' && !registeredEventIds.has(String(a.event_id))) continue;

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
      .select('id, audience')
      .eq('status', 'published')
      .eq('event_id', eventId);

    if (annErr) throw annErr;

    if (!announcements || announcements.length === 0) {
      return res.json({ message: 'All announcements for this event marked as read.' });
    }

    const { data: regRow } = await supabase
      .from('event_registrations')
      .select('team_id')
      .eq('user_id', userId)
      .eq('event_id', eventId)
      .maybeSingle();

    let isRegistered = false;
    if (regRow) {
      if (regRow.team_id) {
        const { data: team } = await supabase
          .from('event_teams')
          .select('status')
          .eq('id', regRow.team_id)
          .maybeSingle();
        isRegistered = team?.status === 'registered';
      } else {
        isRegistered = true;
      }
    } else {
      const { data: ledTeam } = await supabase
        .from('event_teams')
        .select('status')
        .eq('leader_id', userId)
        .eq('event_id', eventId)
        .maybeSingle();
      isRegistered = ledTeam?.status === 'registered';
    }

    const visible = announcements.filter(a => {
      if (a.audience !== 'registered') return true;
      return isRegistered;
    });

    if (visible.length > 0) {
      const rows = visible.map(a => ({ user_id: userId, announcement_id: a.id }));
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

    if (title.trim().length > 140) {
      return res.status(400).json({ message: 'Title cannot exceed 140 characters.' });
    }

    if (message.trim().length > 5000) {
      return res.status(400).json({ message: 'Message cannot exceed 5000 characters.' });
    }

    const safeAudience = audience === 'registered' ? 'registered' : 'all';
    const safeStatus = status === 'draft' ? 'draft' : 'published';
    const authorId = req.user?.id || req.user?._id || req.user?.userId || '00000000-0000-0000-0000-000000000001';
    const authorName = req.user?.fullName || req.user?.name || 'Administrator';

    const { data: announcement, error } = await supabase
      .from('announcements')
      .insert({
        title: title.trim(),
        message: message.trim(),
        image_url: imageUrl ? String(imageUrl).trim() : '',
        audience: safeAudience,
        status: safeStatus,
        event_id: eventId ? String(eventId).trim() : '',
        event_name: eventName ? String(eventName).trim() : '',
        author_id: String(authorId),
        author_name: String(authorName)
      })
      .select()
      .single();

    if (error) {
      console.error('[Announcements Create Supabase Error]:', error);
      throw error;
    }

    res.status(201).json(mapAnnouncement(announcement));
  } catch (err) {
    console.error('[Announcements Create Error]:', err);
    res.status(400).json({
      message: err.message ? `Failed to create announcement: ${err.message}` : 'Failed to create announcement.',
      error: err.message
    });
  }
};

exports.update = async (req, res) => {
  try {
    const { title, message, imageUrl, audience, status, eventId, eventName } = req.body;

    if (!title?.trim() || !message?.trim()) {
      return res.status(400).json({ message: 'Title and message are required.' });
    }

    if (title.trim().length > 140) {
      return res.status(400).json({ message: 'Title cannot exceed 140 characters.' });
    }

    if (message.trim().length > 5000) {
      return res.status(400).json({ message: 'Message cannot exceed 5000 characters.' });
    }

    const safeAudience = audience === 'registered' ? 'registered' : 'all';
    const safeStatus = status === 'draft' ? 'draft' : 'published';

    const { data: announcement, error } = await supabase
      .from('announcements')
      .update({
        title: title.trim(),
        message: message.trim(),
        image_url: imageUrl !== undefined ? String(imageUrl || '').trim() : '',
        audience: safeAudience,
        status: safeStatus,
        event_id: eventId ? String(eventId).trim() : '',
        event_name: eventName ? String(eventName).trim() : '',
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      console.error('[Announcements Update Supabase Error]:', error);
      throw error;
    }

    if (!announcement) return res.status(404).json({ message: 'Announcement not found.' });
    res.json(mapAnnouncement(announcement));
  } catch (err) {
    console.error('[Announcements Update Error]:', err);
    res.status(400).json({
      message: err.message ? `Failed to update announcement: ${err.message}` : 'Failed to update announcement.',
      error: err.message
    });
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
    console.error('[Announcements Delete Error]:', err);
    res.status(500).json({ message: 'Failed to delete announcement.', error: err.message });
  }
};
