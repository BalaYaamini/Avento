const supabase = require('../config/supabaseClient');

// Verify QR token and mark attendance
exports.verifyQrToken = async (req, res) => {
  try {
    const { qrToken } = req.body;
    if (!qrToken) return res.status(400).json({ message: 'QR token is required.' });

    const { data: registration, error: regErr } = await supabase
      .from('event_registrations')
      .select('*, eventId:events(*)')
      .eq('qr_token', qrToken)
      .maybeSingle();

    if (regErr || !registration) return res.status(404).json({ message: 'Invalid QR token.' });

    // Verify ownership
    const { data: event } = await supabase.from('events').select('*').eq('id', registration.event_id).single();
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    const isOwner = req.user.roles.includes('admin') || 
                    event.organizer_id === req.user.id || 
                    event.student_organizer_id === req.user.id || 
                    event.proposed_by === req.user.id ||
                    event.faculty_id === req.user.id;
    
    if (!isOwner) return res.status(403).json({ message: 'Access denied.' });

    // Mark as attended
    const { data: updatedReg, error: updateErr } = await supabase
      .from('event_registrations')
      .update({ status: 'attended' }) // Using 'status' based on analytics fetch
      .eq('id', registration.id)
      .single();

    if (updateErr) throw updateErr;

    res.json({ message: 'Attendance recorded.', registration: updatedReg });
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

    const isOwner = req.user.roles.includes('admin') || 
                    event.organizer_id === req.user.id || 
                    event.student_organizer_id === req.user.id || 
                    event.proposed_by === req.user.id ||
                    event.faculty_id === req.user.id;
    
    if (!isOwner) return res.status(403).json({ message: 'Access denied.' });
    const { data: attendance, error } = await supabase
      .from('event_registrations')
      .select('*, userId:profiles(*), eventId:events(*)')
      .eq('event_id', eventId)
      .eq('status', 'attended');

    if (error) throw error;
    res.json(attendance);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};
