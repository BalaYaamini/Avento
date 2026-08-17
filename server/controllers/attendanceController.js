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
    const { registrationId, eventId } = req.body;
    if (!registrationId) return res.status(400).json({ message: 'Registration ID is required.' });
    if (!eventId) return res.status(400).json({ message: 'Event ID is required.' });

    const { data: registration, error: regErr } = await supabase
      .from('event_registrations')
      .select('*, eventId:events(*)')
      .eq('id', registrationId)
      .maybeSingle();

    if (regErr || !registration) return res.status(404).json({ message: 'Invalid Registration ID.' });
    
    // Phase 2 Validation: Check if QR belongs to the currently selected event
    if (registration.event_id !== eventId) {
      return res.status(400).json({ message: 'This QR code belongs to a different event.' });
    }

    // Verify ownership
    const { data: event } = await supabase.from('events').select('*').eq('id', registration.event_id).single();
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    // Rule 3: Backend Validation - Check if event has ended
    if (new Date(event.date) < new Date()) {
      return res.status(403).json({ success: false, message: 'Attendance is closed because this event has already ended.' });
    }

    const isOwner = await checkIsEventOrganizer(event, req.user);
    if (!isOwner) return res.status(403).json({ message: 'Access denied.' });

    if (registration.attendance_status === 'Present') {
      return res.status(400).json({ message: 'Attendance already marked.' });
    }

    // Mark as attended
    const { data: updatedReg, error: updateErr } = await supabase
      .from('event_registrations')
      .update({ attendance_status: 'Present' })
      .eq('id', registration.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Fetch student info
    const { data: studentProfile } = await supabase
      .from('profiles')
      .select('name, roll_number')
      .eq('id', registration.user_id)
      .single();

    res.json({ 
      success: true,
      message: 'Attendance marked successfully', 
      student: {
        name: studentProfile?.name || 'Unknown',
        rollNumber: studentProfile?.roll_number || 'N/A',
        event: event.title,
        attendance_status: 'Present'
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.', error: err.message });
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
