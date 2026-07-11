const supabase = require('../config/supabaseClient');
const { notifyUser } = require('../services/notificationService');

// Register a user for an event
exports.registerForEvent = async (req, res) => {
  try {
    const { eventId } = req.body;
    const userId = req.user.id;

    if (!eventId) {
      return res.status(400).json({ message: 'Event ID is required.' });
    }

    // Fetch event
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle();
    if (eventErr || !event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    // Validate event status
    if (event.status !== 'published') {
      return res.status(400).json({ message: 'Registration is closed because the event is not active/published.' });
    }

    if (event.registration_type === 'team') {
      return res.status(400).json({ message: 'This event requires team registration.' });
    }

    // Block Student Organizer from registering for the event they organize (proposer, assigned organizer, or recruited organizer)
    const { data: recruitedOrg } = await supabase
      .from('event_organizers')
      .select('*')
      .eq('event_id', eventId)
      .eq('student_id', userId)
      .maybeSingle();

    const isOrganizer = (event.organizer_id && String(event.organizer_id) === String(userId)) ||
                        (event.student_organizer_id && String(event.student_organizer_id) === String(userId)) ||
                        (event.proposed_by && String(event.proposed_by) === String(userId)) ||
                        !!recruitedOrg;
    if (isOrganizer) {
      return res.status(403).json({
        message: 'You are an organizer for this event and cannot register as a participant.'
      });
    }

    if (event.registered_count >= event.capacity) {
      return res.status(400).json({ message: 'Event capacity has been reached.' });
    }

    const { data: existingRegistration, error: existErr } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('user_id', userId)
      .eq('event_id', eventId)
      .maybeSingle();

    if (existingRegistration) {
      return res.status(400).json({ message: 'You are already registered for this event.' });
    }

    const newReg = {
      user_id: userId,
      event_id: eventId,
      status: 'registered',
      created_at: new Date().toISOString()
    };

    const { data: registration, error: regErr } = await supabase
      .from('event_registrations')
      .insert(newReg)
      .select()
      .single();

    if (regErr) throw regErr;

    // Update event registered count
    await supabase.rpc('increment_registered_count', { row_id: eventId });
    // Alternative if rpc not available:
    await supabase.from('events').update({ registered_count: event.registered_count + 1 }).eq('id', eventId);

    // Notify user
    try {
      const dateStr = new Date(event.date).toLocaleDateString();
      await notifyUser({
        recipientId: userId,
        title: 'Registration Successful',
        message: `You have successfully registered for "${event.title}".`,
        type: 'success',
        eventId: event.id,
        emailSubject: `Registration Confirmed – ${event.title}`,
        emailData: {
          eventName: event.title,
          date: dateStr,
          time: event.time || 'TBA',
          venue: event.venue || 'TBA',
          registrationId: registration?.id || 'N/A',
          status: 'Confirmed',
          organizer: event.organizer_name || 'AVENTO Admin',
          instructions: "Please keep this email for your records and present your Registration ID at the venue if required."
        }
      });
    } catch (notifErr) {
      console.error('Non-fatal error sending registration notification:', notifErr.message);
    }

    res.status(201).json({
      message: 'Successfully registered for event.',
      registration
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error during registration.', error: err.message });
  }
};

exports.getMyRegistrations = async (req, res) => {
  try {
    const userId = req.user.id;
    // We should fetch events alongside registrations
    const { data: registrations, error } = await supabase
      .from('event_registrations')
      .select(`
        *,
        eventId:events (*),
        teamId:event_teams (*)
      `)
      .eq('user_id', userId);

    if (error) throw error;

    // Fetch team members for team registrations
    const enrichedRegistrations = await Promise.all(registrations.map(async (reg) => {
      if (reg.team_id && reg.teamId) {
        // Fetch all registrations for this team
        const { data: teamRegs } = await supabase
          .from('event_registrations')
          .select('user_id')
          .eq('team_id', reg.team_id);
        
        const memberIds = teamRegs ? teamRegs.map(tr => tr.user_id) : [];

        // Fetch profiles of team members
        const { data: membersProfiles } = await supabase
          .from('profiles')
          .select('id, name, fullName:name, email, roll_number, department')
          .in('id', memberIds);

        return {
          ...reg,
          teamDetails: {
            leader_id: reg.teamId.leader_id,
            members: membersProfiles || []
          }
        };
      }
      return reg;
    }));

    res.json(enrichedRegistrations);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching registrations.', error: err.message });
  }
};

/**
 * Unified cancellation logic for both single and team registrations.
 */
const executeCancellationLogic = async (registration, reqUserId, reqUserRoles, res) => {
  try {
    const isAdminOrOrganizer = reqUserRoles.includes('admin') || reqUserRoles.includes('organizer') || reqUserRoles.includes('faculty_organizer') || reqUserRoles.includes('faculty');

    // Fetch event details for count decrements and notifications
    const { data: eventDetails } = await supabase.from('events').select('title, venue, registered_count').eq('id', registration.event_id).maybeSingle();
    const eventTitle = eventDetails ? eventDetails.title : 'the event';

    if (registration.team_id) {
      // ----------------------------------------------------
      // TEAM REGISTRATION CANCELLATION
      // ----------------------------------------------------
      const { data: team } = await supabase.from('event_teams').select('*').eq('id', registration.team_id).maybeSingle();
      if (!team) return res.status(404).json({ message: 'Team not found for this registration.' });

      if (!isAdminOrOrganizer && String(team.leader_id) !== reqUserId) {
        return res.status(403).json({ message: 'Only the Team Leader can cancel a team registration.' });
      }

      // Fetch all team members' registrations
      const { data: teamRegs } = await supabase.from('event_registrations').select('user_id').eq('team_id', team.id);
      const allTeamUserIds = teamRegs ? teamRegs.map(r => r.user_id) : [];

      // Atomic Deletion
      const { error: delRegErr } = await supabase.from('event_registrations').delete().eq('team_id', team.id);
      if (delRegErr) throw delRegErr;

      const { error: delTeamErr } = await supabase.from('event_teams').delete().eq('id', team.id);
      if (delTeamErr) throw delTeamErr;

      if (eventDetails && teamRegs) {
        await supabase.from('events').update({
          registered_count: Math.max(0, eventDetails.registered_count - teamRegs.length)
        }).eq('id', registration.event_id);
      }

      // Prepare team members table for email
      let teamMembers = [];
      let teamLeaderName = 'Unknown';
      if (allTeamUserIds.length > 0) {
        const { data: memberProfiles } = await supabase.from('profiles').select('id, name, email').in('id', allTeamUserIds);
        if (memberProfiles) {
          for (const p of memberProfiles) {
            const role = p.id === team.leader_id ? 'Team Lead' : 'Member';
            if (role === 'Team Lead') teamLeaderName = p.name;
            teamMembers.push({ name: p.name, email: p.email, role });
          }
          teamMembers.sort((a, b) => (a.role === 'Team Lead' ? -1 : b.role === 'Team Lead' ? 1 : 0));
        }
      }

      // Send emails to entire team
      for (const uid of allTeamUserIds) {
        try {
          await notifyUser({
            recipientId: uid,
            title: 'Team Registration Cancelled',
            message: `The team registration for "${team.name}" in the event "${eventTitle}" has been cancelled.`,
            type: 'info',
            eventId: registration.event_id,
            emailSubject: `Team Registration Cancelled – ${eventTitle}`,
            emailData: {
              eventName: eventTitle,
              date: new Date().toLocaleDateString(),
              venue: eventDetails ? (eventDetails.venue || 'TBA') : 'TBA',
              status: 'Cancelled',
              teamName: team.name,
              teamLeader: teamLeaderName,
              teamMembers: teamMembers,
              refundNotes: "This team registration is no longer active. If a payment was made, it will be refunded according to the event's cancellation policy."
            }
          });
        } catch (notifErr) {
          console.error('Non-fatal error sending team cancellation notification:', notifErr.message);
        }
      }
      return res.json({ message: 'Team registration cancelled successfully.' });

    } else {
      // ----------------------------------------------------
      // SINGLE REGISTRATION CANCELLATION
      // ----------------------------------------------------
      if (!isAdminOrOrganizer && String(registration.user_id) !== reqUserId) {
        return res.status(403).json({ message: 'Not authorized to cancel this registration.' });
      }

      const { error: delErr } = await supabase.from('event_registrations').delete().eq('id', registration.id);
      if (delErr) throw delErr;

      if (eventDetails) {
        await supabase.from('events').update({
          registered_count: Math.max(0, eventDetails.registered_count - 1)
        }).eq('id', registration.event_id);
      }

      try {
        await notifyUser({
          recipientId: registration.user_id,
          title: 'Registration Cancelled',
          message: `Your registration for "${eventTitle}" has been cancelled.`,
          type: 'info',
          eventId: registration.event_id,
          emailSubject: `Registration Cancelled – ${eventTitle}`,
          emailData: {
            eventName: eventTitle,
            date: new Date().toLocaleDateString(),
            venue: eventDetails ? (eventDetails.venue || 'TBA') : 'TBA',
            status: 'Cancelled',
            refundNotes: "If a payment was made, it will be refunded according to the event's cancellation policy."
          }
        });
      } catch (notifErr) {
        console.error('Non-fatal error sending cancellation notification:', notifErr.message);
      }
      return res.json({ message: 'Registration cancelled successfully.' });
    }
  } catch (err) {
    console.error('executeCancellationLogic error:', err.message);
    res.status(500).json({ message: 'Server error cancelling registration.', error: err.message });
  }
};

exports.cancelRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log("Current User:", userId);
    console.log("Param (id/eventId):", id);

    let registration = null;
    let fetchErr = null;

    // Check if parameter is a valid UUID format
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

    if (isUuid) {
      // First try to locate by registration ID
      const { data: reg, error: err } = await supabase
        .from('event_registrations')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (reg) {
        registration = reg;
      } else {
        fetchErr = err;
      }
    }

    // Fallback: If not found by registration ID, locate by userId and eventId
    if (!registration) {
      const { data: reg, error: err } = await supabase
        .from('event_registrations')
        .select('*')
        .eq('user_id', userId)
        .eq('event_id', id)
        .maybeSingle();

      if (reg) {
        registration = reg;
        fetchErr = null;
      } else if (!fetchErr) {
        fetchErr = err;
      }
    }

    console.log("Registration Found:", registration);

    if (fetchErr || !registration) {
      return res.status(404).json({
        message: 'Registration record not found.',
        debug: {
          userId,
          paramId: id,
          isUuid,
          fetchError: fetchErr ? fetchErr.message : null,
          registrationFound: !!registration
        }
      });
    }

    return await executeCancellationLogic(registration, req.user.id, req.user.roles, res);
  } catch (err) {
    res.status(500).json({ message: 'Server error cancelling registration.', error: err.message });
  }
};

exports.cancelRegistrationByEventId = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    if (!eventId) {
      return res.status(400).json({ message: 'Event ID is required.' });
    }

    // Check if the user is registered for the event
    const { data: registration, error: fetchErr } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('user_id', userId)
      .eq('event_id', eventId)
      .maybeSingle();

    console.log("Current User:", userId);
    console.log("Event ID:", eventId);
    console.log("Registration Found:", registration);

    if (fetchErr || !registration) {
      return res.status(400).json({
        message: 'You are not registered for this event.',
        debug: {
          userId,
          eventId,
          fetchError: fetchErr ? fetchErr.message : null,
          registrationFound: !!registration
        }
      });
    }

    return await executeCancellationLogic(registration, req.user.id, req.user.roles, res);
  } catch (err) {
    res.status(500).json({ message: 'Server error cancelling registration.', error: err.message });
  }
};

exports.getEventRegistrations = async (req, res) => {
  try {
    const { eventId } = req.params;

    // Verify ownership
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('organizer_id, student_organizer_id, proposed_by, faculty_id')
      .eq('id', eventId)
      .single();

    if (eventErr || !event) return res.status(404).json({ message: 'Event not found.' });

    const isOwner = req.user.roles.includes('admin') || 
                    event.organizer_id === req.user.id || 
                    event.student_organizer_id === req.user.id || 
                    event.proposed_by === req.user.id ||
                    event.faculty_id === req.user.id;
    
    if (!isOwner) return res.status(403).json({ message: 'Access denied.' });

    const { data: registrations, error } = await supabase
      .from('event_registrations')
      .select(`
        *,
        userId:profiles (*),
        teamId:event_teams (*)
      `)
      .eq('event_id', eventId);

    if (error) throw error;
    res.json(registrations);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching event registrations.', error: err.message });
  }
};

exports.getAllRegistrations = async (req, res) => {
  try {
    const { data: registrations, error } = await supabase
      .from('event_registrations')
      .select(`
        *,
        eventId:events (*),
        userId:profiles (*),
        teamId:event_teams (*)
      `);

    if (error) throw error;
    res.json(registrations);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching all registrations.', error: err.message });
  }
};

// Register a team for an event
exports.registerTeamForEvent = async (req, res) => {
  try {
    const { eventId, teamName, memberIds } = req.body;
    const leaderId = req.user.id;

    if (!eventId || !teamName || !memberIds || !Array.isArray(memberIds)) {
      return res.status(400).json({ message: 'Event ID, Team Name, and array of member IDs are required.' });
    }

    // Fetch event
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle();

    if (eventErr || !event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    if (event.status !== 'published') {
      return res.status(400).json({ message: 'Registration is closed because the event is not active/published.' });
    }

    if (event.registration_type !== 'team') {
      return res.status(400).json({ message: 'This event does not support team registration.' });
    }

    // Determine effective team size (members + leader)
    const uniqueMemberIds = [...new Set(memberIds)].filter(id => id !== leaderId);
    let allTeamUserIds = [...uniqueMemberIds];
    if (event.team_leader_registration_required !== false) {
      allTeamUserIds.push(leaderId);
    }

    const teamSize = allTeamUserIds.length;

    if (teamSize < event.min_team_size || teamSize > event.max_team_size) {
      return res.status(400).json({ message: `Team size must be between ${event.min_team_size} and ${event.max_team_size} members.` });
    }

    if (event.max_teams) {
      const { count, error: countErr } = await supabase
        .from('event_teams')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId);
      
      if (!countErr && count >= event.max_teams) {
        return res.status(400).json({ message: 'The maximum number of teams for this event has been reached.' });
      }
    }

    // Validate organizers
    const { data: organizers } = await supabase
      .from('event_organizers')
      .select('student_id')
      .eq('event_id', eventId);
    
    const organizerIds = (organizers || []).map(o => o.student_id);
    if (event.organizer_id) organizerIds.push(event.organizer_id);
    if (event.student_organizer_id) organizerIds.push(event.student_organizer_id);
    if (event.proposed_by) organizerIds.push(event.proposed_by);

    const hasOrganizer = allTeamUserIds.some(id => organizerIds.includes(id));
    if (hasOrganizer) {
      return res.status(403).json({ message: 'You are already part of the organizing team for this event.' });
    }

    // Validate existing registrations
    const { data: existingRegs } = await supabase
      .from('event_registrations')
      .select('user_id')
      .eq('event_id', eventId)
      .in('user_id', allTeamUserIds);

    if (existingRegs && existingRegs.length > 0) {
      // Rule 1: Student can belong to only one team per event
      return res.status(400).json({ message: 'You are already a member of another team for this event.' });
    }

    // Validate Cross Department
    if (!event.allow_cross_department) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, department')
        .in('id', allTeamUserIds);
      
      const departments = [...new Set(profiles.map(p => p.department))];
      if (departments.length > 1) {
        return res.status(400).json({ message: 'Cross-department teams are not allowed for this event.' });
      }
    }

    // Create Team
    const { data: team, error: teamErr } = await supabase
      .from('event_teams')
      .insert({
        event_id: eventId,
        name: teamName,
        leader_id: leaderId
      })
      .select()
      .single();

    if (teamErr) {
      if (teamErr.code === '23505') {
        return res.status(400).json({ message: 'A team with this name already exists for this event.' });
      }
      throw teamErr;
    }

    // Create Registrations
    const registrations = allTeamUserIds.map(uid => ({
      user_id: uid,
      event_id: eventId,
      team_id: team.id,
      status: 'registered',
      created_at: new Date().toISOString()
    }));

    const { error: regErr } = await supabase
      .from('event_registrations')
      .insert(registrations);

    if (regErr) throw regErr;

    // Update event registered count
    await supabase.from('events').update({ registered_count: event.registered_count + teamSize }).eq('id', eventId);

    // Notify all team members
    try {
      const dateStrTeam = new Date(event.date).toLocaleDateString();
      
      // Fetch profiles to build the team members table
      const { data: memberProfiles } = await supabase.from('profiles').select('id, name, email').in('id', allTeamUserIds);
      const teamMembers = [];
      let teamLeaderName = 'Unknown';
      if (memberProfiles) {
        for (const p of memberProfiles) {
          const role = p.id === leaderId ? 'Team Lead' : 'Member';
          if (role === 'Team Lead') teamLeaderName = p.name;
          teamMembers.push({
            name: p.name,
            email: p.email,
            role: role
          });
        }
      }
      
      // Sort so Team Lead is always first
      teamMembers.sort((a, b) => (a.role === 'Team Lead' ? -1 : b.role === 'Team Lead' ? 1 : 0));

      for (const uid of allTeamUserIds) {
        await notifyUser({
          recipientId: uid,
          title: 'Team Registration Successful',
          message: `Your team "${teamName}" has been successfully registered for "${event.title}". The following members are registered for this event.`,
          type: 'success',
          eventId: event.id,
          emailSubject: `Team Registration Confirmed – ${event.title}`,
          emailData: {
            eventName: event.title,
            date: dateStrTeam,
            venue: event.venue || 'TBA',
            status: 'Confirmed',
            teamName: teamName,
            teamLeader: teamLeaderName,
            teamMembers: teamMembers
          }
        });
      }
    } catch (notifErr) {
      console.error('Non-fatal error sending team registration notification:', notifErr.message);
    }

    res.status(201).json({
      message: 'Successfully registered team for event.',
      team
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error during team registration.', error: err.message });
  }
};

// Get eligible students for team registration (excludes organizers and already registered)
exports.getEligibleStudents = async (req, res) => {
  try {
    const { id } = req.params; // event id
    const userId = req.user.id; // current user (leader)

    // 1. Get Event to find organizers
    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (!event) return res.status(404).json({ message: 'Event not found.' });

    // 2. Collect all organizer IDs
    const { data: organizers } = await supabase
      .from('event_organizers')
      .select('student_id')
      .eq('event_id', id);
    
    const organizerIds = (organizers || []).map(o => o.student_id);
    if (event.organizer_id) organizerIds.push(event.organizer_id);
    if (event.student_organizer_id) organizerIds.push(event.student_organizer_id);
    if (event.proposed_by) organizerIds.push(event.proposed_by);

    // 3. Get already registered user IDs for this event
    const { data: registrations } = await supabase
      .from('event_registrations')
      .select('user_id')
      .eq('event_id', id);
    
    const registeredIds = (registrations || []).map(r => r.user_id);

    // 4. Combine IDs to exclude
    const excludedIds = [...new Set([...organizerIds, ...registeredIds, userId])];

    // 5. Fetch all students
    const { data: students, error: studentsErr } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['student', 'student_organizer']);

    if (studentsErr) throw studentsErr;

    // Filter out excluded IDs
    const eligible = (students || []).filter(s => !excludedIds.includes(s.id));

    // Map to expected format for the frontend
    const result = eligible.map(s => ({
      id: s.id,
      fullName: s.name || s.fullName,
      email: s.email,
      rollNumber: s.roll_number || '',
      department: s.department || '',
      displayLabel: s.roll_number ? `${s.name || s.fullName} (${s.roll_number})` : (s.name || s.fullName)
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching eligible students.', error: err.message });
  }
};
