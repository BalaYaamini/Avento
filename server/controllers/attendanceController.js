const supabase = require('../config/supabaseClient');

const checkIsEventOrganizer = async (event, user) => {
  if (!user || !user.id) return false;
  if (user.roles && user.roles.includes('admin')) return true;
  if (String(event.organizer_id) === String(user.id) ||
      String(event.student_organizer_id) === String(user.id) ||
      String(event.proposed_by) === String(user.id) ||
      String(event.created_by) === String(user.id) ||
      String(event.faculty_id) === String(user.id)) {
    return true;
  }

  const { data: org } = await supabase
    .from('event_organizers')
    .select('id')
    .eq('event_id', event.id)
    .eq('student_id', user.id)
    .maybeSingle();

  if (org) return true;

  const { data: member } = await supabase
    .from('event_members')
    .select('id')
    .eq('event_id', event.id)
    .eq('user_id', user.id)
    .maybeSingle();

  return !!member;
};

// Verify QR token and mark attendance
exports.verifyQrToken = async (req, res) => {
  try {
    let { registrationId, eventId } = req.body;
    if (!registrationId) return res.status(400).json({ message: 'Registration ID is required.' });
    if (!eventId) return res.status(400).json({ message: 'Event ID is required.' });

    // Handle JSON payload string if scanner outputs JSON
    if (typeof registrationId === 'string' && registrationId.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(registrationId);
        if (parsed.registrationId) registrationId = parsed.registrationId;
        else if (parsed.id) registrationId = parsed.id;
      } catch (e) {}
    }

    const cleanToken = String(registrationId).trim();
    const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(cleanToken);

    let registration = null;

    if (isUUID) {
      // Lookup 1: Query by registration ID UUID
      const { data: regById } = await supabase
        .from('event_registrations')
        .select('*, eventId:events(*)')
        .eq('id', cleanToken)
        .maybeSingle();

      if (regById) {
        registration = regById;
      } else {
        // Lookup 2: Query by user_id for this event
        const { data: regByUser } = await supabase
          .from('event_registrations')
          .select('*, eventId:events(*)')
          .eq('event_id', eventId)
          .eq('user_id', cleanToken)
          .maybeSingle();
        if (regByUser) registration = regByUser;
      }
    } else {
      // Lookup 3: Non-UUID token (e.g. roll number, email, or synthetic token)
      if (cleanToken.includes('_')) {
        const parts = cleanToken.split('_');
        const candidateUserId = parts[parts.length - 1];
        if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(candidateUserId)) {
          const { data: regBySynthetic } = await supabase
            .from('event_registrations')
            .select('*, eventId:events(*)')
            .eq('event_id', eventId)
            .eq('user_id', candidateUserId)
            .maybeSingle();
          if (regBySynthetic) registration = regBySynthetic;
        }
      }

      if (!registration) {
        // Search profile by roll_number or email
        const { data: matchedProfile } = await supabase
          .from('profiles')
          .select('id')
          .or(`roll_number.ilike.${cleanToken},email.ilike.${cleanToken}`)
          .maybeSingle();

        if (matchedProfile && matchedProfile.id) {
          const { data: regByProfile } = await supabase
            .from('event_registrations')
            .select('*, eventId:events(*)')
            .eq('event_id', eventId)
            .eq('user_id', matchedProfile.id)
            .maybeSingle();
          if (regByProfile) registration = regByProfile;
        }
      }
    }

    if (!registration) {
      return res.status(404).json({ message: 'Invalid Registration ID or Participant Not Registered for this Event.' });
    }

    // Phase 2 Validation: Check if QR belongs to the currently selected event
    if (String(registration.event_id) !== String(eventId)) {
      return res.status(400).json({ message: 'This QR code belongs to a different event.' });
    }

    // Verify event details
    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', registration.event_id)
      .maybeSingle();

    if (!event) return res.status(404).json({ message: 'Event not found.' });

    // Check if event has ended
    if (new Date(event.date) < new Date()) {
      return res.status(403).json({ success: false, message: 'Attendance is closed because this event has already ended.' });
    }

    const isOwner = await checkIsEventOrganizer(event, req.user);
    if (!isOwner) return res.status(403).json({ message: 'Access denied. Organizer permissions required to mark attendance.' });

    if (registration.attendance_status === 'Present') {
      return res.status(400).json({ message: 'Attendance already marked as Present for this participant.' });
    }

    // Mark as attended
    const { data: updatedReg, error: updateErr } = await supabase
      .from('event_registrations')
      .update({ attendance_status: 'Present' })
      .eq('id', registration.id)
      .select()
      .maybeSingle();

    if (updateErr) throw updateErr;

    // Fetch student profile info
    const { data: studentProfile } = await supabase
      .from('profiles')
      .select('name, roll_number')
      .eq('id', registration.user_id)
      .maybeSingle();

    return res.json({ 
      success: true,
      message: 'Attendance marked successfully', 
      student: {
        name: studentProfile?.name || 'Participant',
        rollNumber: studentProfile?.roll_number || 'N/A',
        event: event.title,
        attendance_status: 'Present'
      }
    });
  } catch (err) {
    console.error('Attendance Scanner Exception:', err);
    return res.status(500).json({ message: 'Server error scanning QR code.', error: err.message });
  }
};

// Get attendance list for a specific event (organizer view)
exports.getEventAttendance = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    const isOwner = await checkIsEventOrganizer(event, req.user);
    if (!isOwner) return res.status(403).json({ message: 'Access denied.' });
    const { data: attendance, error } = await supabase
      .from('event_registrations')
      .select('*, userId:profiles!event_registrations_user_id_fkey(*), eventId:events(*)')
      .eq('event_id', eventId)
      .eq('attendance_status', 'Present');

    if (error) throw error;
    res.json(attendance);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};
