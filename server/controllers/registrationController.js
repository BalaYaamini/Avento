const fs = require('fs');
const path = require('path');
const supabase = require('../config/supabaseClient');
const { notifyUser } = require('../services/notificationService');

const UTR_PATTERN = /^[A-Z0-9]{12,22}$/i;

const validateUtr = (utr) => typeof utr === 'string' && UTR_PATTERN.test(utr.trim());

const finalizeTeamRegistration = async (teamId, event, leaderId, acceptedUserIds) => {
  // 1. Update event_teams status to 'registered'
  const { error: teamErr } = await supabase
    .from('event_teams')
    .update({ status: 'registered' })
    .eq('id', teamId);
  if (teamErr) console.error('Error updating event_teams status:', teamErr.message);

  // 2. Update ALL team members' event_registrations to 'registered'
  const { error: regErr } = await supabase
    .from('event_registrations')
    .update({ status: 'registered' })
    .eq('team_id', teamId)
    .in('status', ['registered', 'accepted', 'pending']);
  if (regErr) console.error('Error updating team registrations:', regErr.message);

  // 3. Increment registered count safely via RPC or direct fallback
  try {
    const { error: rpcErr } = await supabase.rpc('confirm_team_registration', {
      p_team_id: teamId,
      p_leader_id: leaderId
    });

    if (rpcErr) {
      const rpcMsg = rpcErr.message || '';
      if (rpcMsg.includes('Maximum number of teams') || rpcMsg.includes('max_teams')) {
        const error = new Error('No more team slots are available. Registration is full.');
        error.statusCode = 409;
        throw error;
      }
      // Fallback update
      await supabase.from('events').update({ registered_count: (event.registered_count || 0) + 1 }).eq('id', event.id);
    }
  } catch (err) {
    if (err.statusCode === 409) throw err;
    console.warn('RPC confirm_team_registration notice (handled via fallback):', err.message);
    await supabase.from('events').update({ registered_count: (event.registered_count || 0) + 1 }).eq('id', event.id);
  }
};

const resolveUserProfile = async (userId) => {
  try {
    const { data } = await supabase.from('profiles').select('id, name, email').eq('id', userId).maybeSingle();
    if (data && data.email) return data;
  } catch (e) {}
  return { id: userId, name: 'Unknown', email: null };
};

const fetchCompleteProfile = async (userId, userEmail, reqUser = null) => {
  let dbById = null;
  let dbByEmail = null;

  if (userId) {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', String(userId)).maybeSingle();
      if (data) dbById = data;
    } catch (e) {}
  }

  if (userEmail) {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('email', String(userEmail).toLowerCase()).maybeSingle();
      if (data) dbByEmail = data;
    } catch (e) {}
  }

  const objects = [reqUser, dbById, dbByEmail];
  const merged = {};
  for (const obj of objects) {
    if (!obj) continue;
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        merged[key] = val;
      } else if (merged[key] === undefined) {
        merged[key] = val;
      }
    }
  }
  return merged;
};

const checkProfileCompleteness = (profile) => {
  if (!profile) return { isComplete: false, missingFields: ['Profile Details'] };

  const missingFields = [];

  const name = profile.name || profile.fullName || profile.full_name;
  const phone = profile.phone || profile.phoneNumber || profile.phone_number;
  const gender = profile.gender;
  const collegeName = profile.college_name || profile.collegeName || profile.college || profile.institution;
  const department = profile.department || profile.dept || profile.branch;
  const degreeProgram = profile.degree_program || profile.degreeProgram || profile.program || profile.degree;
  const yearOfStudy = profile.year_of_study !== undefined && profile.year_of_study !== null && String(profile.year_of_study).trim() !== ''
    ? profile.year_of_study
    : (profile.yearOfStudy || profile.year);
  const rollNumber = profile.roll_number || profile.rollNumber || profile.roll_no || profile.rollNo;

  if (!name || !String(name).trim()) missingFields.push('Full Name');

  const cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
  const mobileDigits = cleanPhone.slice(-10);
  if (!mobileDigits || mobileDigits.length < 10) missingFields.push('10-digit Phone Number');

  if (!gender || !String(gender).trim()) missingFields.push('Gender');
  if (!collegeName || !String(collegeName).trim()) missingFields.push('College Name');
  if (!department || !String(department).trim()) missingFields.push('Department');
  if (!degreeProgram || !String(degreeProgram).trim()) missingFields.push('Degree / Program');
  if (yearOfStudy === undefined || yearOfStudy === null || !String(yearOfStudy).trim()) missingFields.push('Year of Study');

  const userRoles = Array.isArray(profile.roles) ? profile.roles : [profile.role || 'student'];
  const isStudent = userRoles.includes('student') || userRoles.includes('student_organizer');
  if (isStudent && (!rollNumber || !String(rollNumber).trim())) {
    missingFields.push('Roll Number');
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields
  };
};

exports.fetchCompleteProfile = fetchCompleteProfile;
exports.checkProfileCompleteness = checkProfileCompleteness;

// Register a user for an event
exports.registerForEvent = async (req, res) => {
  try {
    const { eventId } = req.body;
    const userId = req.user.id;

    if (!eventId) {
      return res.status(400).json({ message: 'Event ID is required.' });
    }

    // MANDATORY PROFILE CHECK: Ensure all profile fields are completed before allowing registration
    const completeProfile = await fetchCompleteProfile(userId, req.user?.email, req.user);
    const completeness = checkProfileCompleteness(completeProfile);
    if (!completeness.isComplete) {
      return res.status(400).json({
        success: false,
        profileIncomplete: true,
        missingFields: completeness.missingFields,
        message: `Incomplete Profile! Please complete all required profile fields (${completeness.missingFields.join(', ')}) before registering for events.`
      });
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

    // Validate registration deadline
    if (event.registration_deadline && new Date() > new Date(event.registration_deadline)) {
      return res.status(400).json({ message: 'The registration deadline for this event has passed.' });
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

    // Also check event_members (pre-publication organizers)
    const { data: memberOrg } = await supabase
      .from('event_members')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();

    const isOrganizer = (event.organizer_id && String(event.organizer_id) === String(userId)) ||
                        (event.student_organizer_id && String(event.student_organizer_id) === String(userId)) ||
                        (event.proposed_by && String(event.proposed_by) === String(userId)) ||
                        !!recruitedOrg ||
                        !!memberOrg;
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
    console.error('Registration Error (Individual):', err);
    res.status(500).json({ message: 'Server error during registration.', error: err.message });
  }
};

exports.getMyRegistrations = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Fetch user's profile email
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .maybeSingle();

    const userEmail = (userProfile?.email || req.user.email || req.user.user_metadata?.email || '').trim().toLowerCase();

    // 2. Claim any pending team email invitations matching this email
    if (userEmail) {
      try {
        const { data: pendingEmailInvites } = await supabase
          .from('team_email_invites')
          .select('*')
          .ilike('email', userEmail)
          .eq('status', 'pending');

        if (pendingEmailInvites && pendingEmailInvites.length > 0) {
          for (const invite of pendingEmailInvites) {
            const { data: existingReg } = await supabase
              .from('event_registrations')
              .select('id, status')
              .eq('user_id', userId)
              .eq('event_id', invite.event_id)
              .maybeSingle();

            if (!existingReg) {
              await supabase.from('event_registrations').insert({
                user_id: userId,
                event_id: invite.event_id,
                team_id: invite.team_id,
                status: 'pending',
                created_at: new Date().toISOString()
              });
            } else if (existingReg.status !== 'registered') {
              await supabase
                .from('event_registrations')
                .update({
                  team_id: invite.team_id,
                  status: 'pending',
                  created_at: new Date().toISOString()
                })
                .eq('id', existingReg.id);
            }

            await supabase
              .from('team_email_invites')
              .update({ status: 'claimed' })
              .eq('id', invite.id);
          }
        }
      } catch (claimErr) {
        console.warn('Notice claiming team email invites:', claimErr.message);
      }
    }

    // 3. Fetch registrations for user
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
      if (reg.eventId && reg.eventId.registration_type === 'team') {
        const { count: teamCount } = await supabase
          .from('event_teams')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', reg.eventId.id)
          .eq('status', 'registered');
        const countVal = teamCount || 0;
        reg.eventId.confirmed_teams_count = countVal;
        reg.eventId.registered_count = countVal;
        reg.eventId.registeredCount = countVal;
      }

      if (reg.team_id && reg.teamId) {
        // Fetch all registrations for this team
        const { data: teamRegs } = await supabase
          .from('event_registrations')
          .select('user_id, status')
          .eq('team_id', reg.team_id);
        
        const memberIds = teamRegs ? teamRegs.map(tr => tr.user_id) : [];

        // Fetch profiles of team members
        const { data: membersProfiles } = await supabase
          .from('profiles')
          .select('id, name, fullName:name, email, roll_number, department')
          .in('id', memberIds);
          
        const membersWithStatus = (membersProfiles || []).map(member => {
          const regData = teamRegs?.find(tr => tr.user_id === member.id);
          return {
            ...member,
            status: regData ? regData.status : 'unknown'
          };
        });

        const leaderReg = teamRegs?.find(tr => tr.user_id === reg.teamId.leader_id);
        const isTeamRegistered = reg.teamId.status === 'registered';

        // Preserve member's actual registration status (e.g. pending) if not leader
        const effectiveStatus = (reg.user_id !== reg.teamId.leader_id && reg.status === 'pending')
          ? 'pending'
          : (isTeamRegistered ? 'registered' : reg.status);

        return {
          ...reg,
          status: effectiveStatus,
          teamDetails: {
            leader_id: reg.teamId.leader_id,
            teamStatus: isTeamRegistered ? 'registered' : (reg.teamId.status || 'pending'),
            members: membersWithStatus
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
    const { data: eventDetails } = await supabase.from('events').select('title, venue, registered_count, registration_deadline').eq('id', registration.event_id).maybeSingle();
    const eventTitle = eventDetails ? eventDetails.title : 'the event';

    if (!isAdminOrOrganizer && eventDetails && eventDetails.registration_deadline && new Date() > new Date(eventDetails.registration_deadline)) {
      return res.status(400).json({ message: 'Registration has closed. You can no longer cancel or withdraw.' });
    }

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
      const { data: teamRegs } = await supabase.from('event_registrations').select('user_id, status').eq('team_id', team.id);
      const allTeamUserIds = teamRegs ? teamRegs.map(r => r.user_id) : [];
      const acceptedMembersCount = teamRegs ? teamRegs.filter(r => r.status === 'registered').length : 0;
      
      const leaderReg = teamRegs ? teamRegs.find(r => r.user_id === team.leader_id) : null;
      if (!isAdminOrOrganizer && leaderReg && leaderReg.status === 'registered') {
        return res.status(400).json({ message: 'Confirmed teams cannot be cancelled.' });
      }

      // Atomic Deletion
      const { error: delRegErr } = await supabase.from('event_registrations').delete().eq('team_id', team.id);
      if (delRegErr) throw delRegErr;

      const { error: delTeamErr } = await supabase.from('event_teams').delete().eq('id', team.id);
      if (delTeamErr) throw delTeamErr;

      if (eventDetails && teamRegs && team.status === 'registered') {
        await supabase.from('events').update({
          registered_count: Math.max(0, eventDetails.registered_count - acceptedMembersCount)
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
        .select(`
          *,
          teamId:event_teams (*)
        `)
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
      .select(`
        *,
        teamId:event_teams (*)
      `)
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

    // Verify user authorization safely
    const userRoles = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role].filter(Boolean);
    const isAllowed = userRoles.length > 0;
    if (!isAllowed) return res.status(403).json({ message: 'Access denied.' });

    let registrations = null;

    // Stage 1: Try PostgREST join with profiles & event_teams
    try {
      const { data: stage1Data, error: s1Err } = await supabase
        .from('event_registrations')
        .select(`
          *,
          userId:profiles!event_registrations_user_id_fkey(*),
          teamId:event_teams(*)
        `)
        .eq('event_id', eventId)
        .range(0, 4999);

      if (!s1Err && stage1Data && Array.isArray(stage1Data) && stage1Data.length > 0) {
        registrations = stage1Data;
      }
    } catch (e) {}

    // Stage 2: Direct query + robust profile mapping by ID and Email
    if (!registrations || registrations.length === 0) {
      try {
        const { data: rawRegs } = await supabase
          .from('event_registrations')
          .select('*')
          .eq('event_id', eventId)
          .range(0, 4999);

        if (rawRegs && Array.isArray(rawRegs) && rawRegs.length > 0) {
          const userIds = [...new Set(rawRegs.map(r => r.user_id).filter(Boolean))];
          const userEmails = [...new Set(rawRegs.map(r => r.user_email || r.email).filter(Boolean))];
          const teamIds = [...new Set(rawRegs.map(r => r.team_id).filter(Boolean))];

          let profMap = new Map();

          if (userIds.length > 0) {
            for (let i = 0; i < userIds.length; i += 200) {
              const chunk = userIds.slice(i, i + 200);
              const { data: profs } = await supabase.from('profiles').select('*').in('id', chunk);
              (profs || []).forEach(p => {
                if (p.id) profMap.set(String(p.id), p);
                if (p.email) profMap.set(String(p.email).toLowerCase(), p);
              });
            }
          }

          if (userEmails.length > 0) {
            for (let i = 0; i < userEmails.length; i += 200) {
              const chunk = userEmails.slice(i, i + 200);
              const { data: profs } = await supabase.from('profiles').select('*').in('email', chunk.map(e => String(e).toLowerCase()));
              (profs || []).forEach(p => {
                if (p.id) profMap.set(String(p.id), p);
                if (p.email) profMap.set(String(p.email).toLowerCase(), p);
              });
            }
          }

          let teamMap = new Map();
          if (teamIds.length > 0) {
            const { data: teams } = await supabase.from('event_teams').select('*').in('id', teamIds);
            (teams || []).forEach(t => teamMap.set(t.id, t));
          }

          registrations = rawRegs.map(r => {
            const matchedProfile = profMap.get(String(r.user_id)) || (r.user_email ? profMap.get(String(r.user_email).toLowerCase()) : null);
            return {
              ...r,
              userId: matchedProfile || {
                id: r.user_id,
                name: r.user_name || r.name || (r.user_email ? r.user_email.split('@')[0] : 'Student'),
                email: r.user_email || r.email || '',
                roll_number: r.roll_number || r.rollNo || '',
                department: r.department || 'General',
                avatar_url: r.avatar_url || r.avatarUrl || null
              },
              teamId: teamMap.get(r.team_id) || null
            };
          });
        }
      } catch (e) {
        console.warn('getEventRegistrations stage 2 warning:', e.message);
      }
    }

    if (!registrations) {
      registrations = [];
    }

    // Enrich registrations with persistent file-backed avatars map (gives latest re-upload priority)
    const avatarsMap = getEventAvatarsMap(eventId);
    const normalizeKey = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    (registrations || []).forEach(r => {
      if (r.userId) {
        const derivedRoll = r.userId.email ? r.userId.email.split('@')[0].trim().toLowerCase() : '';
        const dbRoll = r.userId.roll_number ? r.userId.roll_number.trim().toLowerCase() : '';
        const storedUrl = avatarsMap[derivedRoll] ||
                          avatarsMap[dbRoll] ||
                          avatarsMap[normalizeKey(derivedRoll)] ||
                          avatarsMap[normalizeKey(dbRoll)];

        if (storedUrl && !r.userId.avatar_url) {
          r.userId.avatar_url = storedUrl;
        }
      }
    });

    // Batch query payment_verification_history in 1 single call to prevent socket overload / ECONNRESET
    let historyMap = new Map();
    try {
      const regIds = (registrations || []).map(r => r.id).filter(Boolean);
      if (regIds.length > 0) {
        for (let i = 0; i < regIds.length; i += 200) {
          const chunk = regIds.slice(i, i + 200);
          const { data: pData } = await supabase
            .from('payment_verification_history')
            .select('*')
            .in('registration_id', chunk)
            .order('acted_at', { ascending: false });

          (pData || []).forEach(p => {
            if (!historyMap.has(p.registration_id)) {
              historyMap.set(p.registration_id, []);
            }
            historyMap.get(p.registration_id).push(p);
          });
        }
      }
    } catch (pErr) {}

    const enriched = (registrations || []).map(registration => ({
      ...registration,
      paymentHistory: historyMap.get(registration.id) || []
    }));

    res.json(enriched);
  } catch (err) {
    console.error('Error in getEventRegistrations:', err);
    res.json([]);
  }
};

exports.getAllRegistrations = async (req, res) => {
  try {
    const { data: registrations, error } = await supabase
      .from('event_registrations')
      .select(`
        *,
        eventId:events (*),
        userId:profiles!event_registrations_user_id_fkey (*),
        teamId:event_teams (*)
      `);

    if (error) throw error;
    const enriched = await Promise.all((registrations || []).map(async registration => {
      const { data: paymentHistory } = await supabase.from('payment_verification_history')
        .select('*').eq('registration_id', registration.id).order('acted_at', { ascending: false });
      return { ...registration, paymentHistory: paymentHistory || [] };
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching all registrations.', error: err.message });
  }
};

exports.updatePaymentStatus = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const { paymentStatus, rejectionReason } = req.body;
    if (!['verified', 'rejected'].includes(paymentStatus)) {
      return res.status(400).json({ message: 'Payment status must be verified or rejected.' });
    }
    if (paymentStatus === 'rejected' && (!rejectionReason || !rejectionReason.trim())) {
      return res.status(400).json({ message: 'A rejection reason is required.' });
    }

    const { data: registration, error: registrationErr } = await supabase
      .from('event_registrations')
      .select('id, event_id, team_id, user_id, utr_number, status, events(*)')
      .eq('id', registrationId)
      .maybeSingle();
    if (registrationErr || !registration) return res.status(404).json({ message: 'Registration not found.' });
    if (!registration.utr_number) return res.status(400).json({ message: 'This registration has no submitted UTR.' });

    const event = registration.events;
    let allowed = req.user.roles.includes('admin') ||
      [event?.organizer_id, event?.student_organizer_id, event?.proposed_by, event?.faculty_id, event?.created_by]
        .some(id => String(id || '') === String(req.user.id));

    if (!allowed) {
      const { data: organizer } = await supabase.from('event_organizers').select('id, organizer_role, category')
        .eq('event_id', registration.event_id).eq('student_id', req.user.id).maybeSingle();
      const { data: member } = await supabase.from('event_members').select('id, organizer_type, role')
        .eq('event_id', registration.event_id).eq('user_id', req.user.id).maybeSingle();
      allowed = (organizer && (organizer.organizer_role === 'core' || organizer.category === 'Event Head' || organizer.category === 'Faculty Organizer')) ||
                (member && (member.organizer_type === 'core' || member.role === 'Event Head' || member.role === 'Core Organizer'));
    }
    if (!allowed) return res.status(403).json({ message: 'Only an admin or core event organizer can verify payments.' });

    const updatePayload = {
      payment_status: paymentStatus,
      payment_rejection_reason: paymentStatus === 'rejected' ? rejectionReason.trim() : null,
      payment_verified_by: req.user.id,
      payment_verified_at: new Date().toISOString()
    };
    const { data: updated, error: updateErr } = await supabase
      .from('event_registrations').update(updatePayload)
      .eq('id', registrationId).select().single();
    if (updateErr) throw updateErr;

    const { error: historyErr } = await supabase.from('payment_verification_history').insert({
      registration_id: registrationId,
      event_id: registration.event_id,
      utr_number: registration.utr_number,
      status: paymentStatus,
      reason: paymentStatus === 'rejected' ? rejectionReason.trim() : null,
      acted_by: req.user.id
    });
    if (historyErr) throw historyErr;

    if (paymentStatus === 'verified' && registration.team_id) {
      const { data: teamRegs, error: teamRegsErr } = await supabase.from('event_registrations')
        .select('user_id, status').eq('team_id', registration.team_id);
      if (teamRegsErr) throw teamRegsErr;
      const acceptedUserIds = new Set([String(registration.user_id)]);
      (teamRegs || []).forEach(reg => { if (reg.status === 'registered') acceptedUserIds.add(String(reg.user_id)); });
      await finalizeTeamRegistration(registration.team_id, event, registration.user_id, acceptedUserIds);
    }
    res.json({ message: `Payment ${paymentStatus}.`, registration: updated });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message || 'Server error updating payment status.' });
  }
};

// Register a team for an event
exports.registerTeamForEvent = async (req, res) => {
  try {
    const { eventId, teamName, memberIds, externalInvites } = req.body;
    const leaderId = req.user.id;

    if (!eventId || !teamName) {
      return res.status(400).json({ message: 'Event ID and Team Name are required.' });
    }

    // MANDATORY PROFILE CHECK: Ensure Team Leader profile is complete before allowing team creation
    const mergedLeaderProfile = await fetchCompleteProfile(leaderId, req.user?.email, req.user);
    const leaderCompleteness = checkProfileCompleteness(mergedLeaderProfile);
    if (!leaderCompleteness.isComplete) {
      return res.status(400).json({
        success: false,
        profileIncomplete: true,
        missingFields: leaderCompleteness.missingFields,
        message: `Incomplete Profile! Cannot create team because your profile is incomplete (${leaderCompleteness.missingFields.join(', ')}). Please complete your profile fields first.`
      });
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

    // Validate registration deadline
    if (event.registration_deadline && new Date() > new Date(event.registration_deadline)) {
      return res.status(400).json({ message: 'The registration deadline for this event has passed.' });
    }

    if (event.registration_type !== 'team') {
      return res.status(400).json({ message: 'This event does not support team registration.' });
    }

    // Resolve member IDs & externalInvites emails case-insensitively
    let uniqueMemberIds = Array.isArray(memberIds) ? [...new Set(memberIds)].filter(id => id !== leaderId) : [];
    const inviteEmails = Array.isArray(externalInvites)
      ? externalInvites.map(i => (typeof i === 'string' ? i.trim().toLowerCase() : i.email?.trim().toLowerCase())).filter(Boolean)
      : [];

    const externalUnresolvedEmails = [];

    if (inviteEmails.length > 0) {
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, email');

      inviteEmails.forEach(invEmail => {
        const foundProf = (allProfiles || []).find(p => p.email && p.email.trim().toLowerCase() === invEmail);
        if (foundProf && foundProf.id) {
          if (String(foundProf.id) !== String(leaderId) && !uniqueMemberIds.includes(foundProf.id)) {
            uniqueMemberIds.push(foundProf.id);
          }
        } else {
          if (!externalUnresolvedEmails.includes(invEmail)) {
            externalUnresolvedEmails.push(invEmail);
          }
        }
      });
    }

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
        .eq('event_id', eventId)
        .eq('status', 'registered');
      
      if (!countErr && count >= event.max_teams) {
        return res.status(400).json({ message: 'The maximum number of teams for this event has been reached.' });
      }
    }

    // Validate organizers — also check event_members (pre-publication organizers)
    const { data: organizers } = await supabase
      .from('event_organizers')
      .select('student_id')
      .eq('event_id', eventId);
    
    const { data: proposalMembers } = await supabase
      .from('event_members')
      .select('user_id')
      .eq('event_id', eventId);
    
    const organizerIds = (organizers || []).map(o => o.student_id);
    if (event.organizer_id) organizerIds.push(event.organizer_id);
    if (event.student_organizer_id) organizerIds.push(event.student_organizer_id);
    if (event.proposed_by) organizerIds.push(event.proposed_by);
    if (event.faculty_id) organizerIds.push(event.faculty_id);
    // Add pre-publication organizers from event_members
    (proposalMembers || []).forEach(m => { if (m.user_id) organizerIds.push(m.user_id); });

    const hasOrganizer = allTeamUserIds.some(id => organizerIds.includes(id));
    if (hasOrganizer) {
      return res.status(403).json({ message: 'One or more selected members are organizing this event and cannot be added as team members.' });
    }
    if (organizerIds.includes(leaderId)) {
      return res.status(403).json({ message: 'You are an organizer for this event and cannot create a team.' });
    }

    // Validate existing active registrations for the leader
    // A student can create only one active team for a particular event.
    // We block the leader if they have a pending team or a registered team.
    const { data: leaderRegs } = await supabase
      .from('event_registrations')
      .select('status')
      .eq('event_id', eventId)
      .eq('user_id', leaderId)
      .in('status', ['registered', 'pending']);

    if (leaderRegs && leaderRegs.length > 0) {
      return res.status(400).json({ message: 'You have pending team invitations for this event, or you are already part of an active team. Please reject all pending invitations or leave your current team first.' });
    }
    
    // BACKEND RULE: Prevent adding members who are already in a CONFIRMED team
    if (uniqueMemberIds.length > 0) {
      const { data: confirmedTeams } = await supabase
        .from('event_teams')
        .select('id')
        .eq('event_id', eventId)
        .eq('status', 'registered');
      
      if (confirmedTeams && confirmedTeams.length > 0) {
        const teamIds = confirmedTeams.map(t => t.id);
        const { data: alreadyRegisteredMembers } = await supabase
          .from('event_registrations')
          .select('user_id')
          .in('team_id', teamIds)
          .in('user_id', uniqueMemberIds)
          .eq('status', 'registered');
        
        if (alreadyRegisteredMembers && alreadyRegisteredMembers.length > 0) {
          return res.status(400).json({ message: 'One or more selected members are already part of a confirmed team for this event.' });
        }
      }
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

    // Explicit Case-Insensitive Uniqueness Check
    const { data: existingTeamByName } = await supabase
      .from('event_teams')
      .select('id')
      .eq('event_id', eventId)
      .ilike('name', teamName.trim());
      
    if (existingTeamByName && existingTeamByName.length > 0) {
      return res.status(400).json({ message: 'This team name is already taken. Please choose another team name.' });
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
        return res.status(400).json({ message: 'This team name is already taken. Please choose another team name.' });
      }
      throw teamErr;
    }

    // Create Registrations (everyone is pending until the leader confirms the team)
    const registrations = allTeamUserIds.map(uid => ({
      user_id: uid,
      event_id: eventId,
      team_id: team.id,
      status: 'pending',
      created_at: new Date().toISOString()
    }));

    const { error: regErr } = await supabase
      .from('event_registrations')
      .insert(registrations);

    if (regErr) throw regErr;

    // Save unresolved external email invitations to team_email_invites
    if (externalUnresolvedEmails.length > 0) {
      for (const unresEmail of externalUnresolvedEmails) {
        try {
          await supabase.from('team_email_invites').insert({
            team_id: team.id,
            event_id: eventId,
            email: unresEmail,
            invited_by: leaderId,
            status: 'pending',
            created_at: new Date().toISOString()
          });

          const dateStr = new Date(event.date).toLocaleDateString();
          const leaderName = leaderProfile?.name || 'Team Leader';
          await notifyUser({
            recipientEmail: unresEmail,
            title: 'Team Invitation Received',
            message: `You have been invited by ${leaderName} to join the team "${teamName}" for "${event.title}". Please sign in to Avento to accept the invitation.`,
            type: 'info',
            eventId: event.id,
            emailSubject: `Team Invitation – ${event.title}`,
            emailData: {
              recipientName: unresEmail.split('@')[0],
              eventName: event.title,
              date: dateStr,
              venue: event.venue || 'TBA',
              status: 'Pending Approval',
              teamName: teamName,
              teamLeader: leaderName,
              isTeamInvite: true,
              isLeader: false
            }
          });
        } catch (invErr) {
          console.warn('Error saving external email invite:', invErr.message);
        }
      }
    }

    // DO NOT update event registered count here.
    // The count will be updated when the Team Leader confirms the team.

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
        const isLeader = uid === leaderId;
        const memberProf = (memberProfiles || []).find(p => String(p.id) === String(uid));
        const memberEmail = memberProf?.email || null;
        const memberName = memberProf?.name || null;

        const statusText = isLeader ? 'Confirmed' : 'Pending Approval';
        const msg = isLeader 
          ? `Your team "${teamName}" has been successfully created for "${event.title}". Waiting for members to accept before you can confirm the registration.`
          : `You have been invited by ${teamLeaderName} to join the team "${teamName}" for "${event.title}". Please accept the invitation before the deadline.`;

        await notifyUser({
          recipientId: uid,
          recipientEmail: memberEmail,
          title: isLeader ? 'Team Registration Successful' : 'Team Invitation Received',
          message: msg,
          type: isLeader ? 'success' : 'info',
          eventId: event.id,
          emailSubject: isLeader ? `Team Registration Confirmed – ${event.title}` : `Team Invitation – ${event.title}`,
          emailData: {
            recipientName: memberName,
            eventName: event.title,
            date: dateStrTeam,
            venue: event.venue || 'TBA',
            status: statusText,
            teamName: teamName,
            teamLeader: teamLeaderName,
            teamMembers: teamMembers,
            isTeamInvite: !isLeader,
            isLeader: isLeader
          }
        });
      }
    } catch (notifErr) {
      console.error('Non-fatal error sending team registration notification:', notifErr.message);
    }

    res.status(201).json({
      message: 'Successfully created pending team. Waiting for confirmation.',
      team
    });

  } catch (err) {
    console.error('registerTeamForEvent Full Error:', JSON.stringify(err, null, 2));
    res.status(500).json({ 
      message: 'Server error during team registration.', 
      error: err.message,
      fullError: err
    });
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

    // 2. Collect all organizer IDs — also check event_members (pre-publication organizers)
    const { data: organizers } = await supabase
      .from('event_organizers')
      .select('student_id')
      .eq('event_id', id);
    
    const { data: proposalMembers } = await supabase
      .from('event_members')
      .select('user_id')
      .eq('event_id', id);
    
    const organizerIds = (organizers || []).map(o => o.student_id);
    if (event.organizer_id) organizerIds.push(event.organizer_id);
    if (event.student_organizer_id) organizerIds.push(event.student_organizer_id);
    if (event.proposed_by) organizerIds.push(event.proposed_by);
    if (event.faculty_id) organizerIds.push(event.faculty_id);
    // Add pre-publication organizers from event_members
    (proposalMembers || []).forEach(m => { if (m.user_id) organizerIds.push(m.user_id); });

    // 3. Get already registered user IDs for this event
    // Users are excluded if they currently belong to another team (status = 'registered')
    // This includes leaders and members of both confirmed and unconfirmed teams.
    const { data: teamMembers } = await supabase
      .from('event_registrations')
      .select('user_id')
      .eq('event_id', id)
      .eq('status', 'registered');
    
    const registeredIds = (teamMembers || []).map(r => r.user_id);

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
    })).sort((a, b) => a.displayLabel.localeCompare(b.displayLabel));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching eligible students.', error: err.message });
  }
};

exports.acceptTeamInvitation = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const userId = req.user.id;

    // MANDATORY PROFILE CHECK: Ensure student profile is 100% complete before accepting team invitation
    const userProfile = await fetchCompleteProfile(userId, req.user?.email, req.user);
    const completeness = checkProfileCompleteness(userProfile);
    if (!completeness.isComplete) {
      return res.status(400).json({
        success: false,
        profileIncomplete: true,
        missingFields: completeness.missingFields,
        message: `Incomplete Profile! Please complete all required profile fields (${completeness.missingFields.join(', ')}) in Profile Settings before accepting team invitations.`
      });
    }

    // Fetch registration with team status
    const { data: reg, error: regErr } = await supabase
      .from('event_registrations')
      .select('*, events(id, title, registration_deadline), event_teams(status)')
      .eq('id', registrationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (regErr || !reg) {
      return res.status(404).json({ message: 'Registration not found or not authorized.' });
    }

    if (reg.status !== 'pending') {
      return res.status(400).json({ message: 'This registration is not pending.' });
    }

    if (reg.event_teams && reg.event_teams.status === 'registered') {
      return res.status(400).json({ message: 'Team has been finalized. You can no longer accept this invitation.' });
    }

    const event = reg.events;
    if (event.registration_deadline && new Date() > new Date(event.registration_deadline)) {
      return res.status(400).json({ message: 'The registration deadline has passed. You can no longer accept this invitation.' });
    }

    // Prevent accepting if user is an organizer — also check event_members (pre-publication organizers)
    const { data: organizers } = await supabase
      .from('event_organizers')
      .select('student_id')
      .eq('event_id', event.id);
      
    const { data: proposalMembers } = await supabase
      .from('event_members')
      .select('user_id')
      .eq('event_id', event.id);
      
    const organizerIds = (organizers || []).map(o => o.student_id);
    if (event.organizer_id) organizerIds.push(event.organizer_id);
    if (event.student_organizer_id) organizerIds.push(event.student_organizer_id);
    if (event.proposed_by) organizerIds.push(event.proposed_by);
    if (event.faculty_id) organizerIds.push(event.faculty_id);
    // Add pre-publication organizers from event_members
    (proposalMembers || []).forEach(m => { if (m.user_id) organizerIds.push(m.user_id); });

    if (organizerIds.includes(userId)) {
      return res.status(403).json({ message: 'You are an organizer for this event and cannot join a team.' });
    }

    // Prevent accepting if user is already the leader of any team for this event
    const { data: ledTeams } = await supabase
      .from('event_teams')
      .select('id')
      .eq('event_id', event.id)
      .eq('leader_id', userId);

    if (ledTeams && ledTeams.length > 0) {
      return res.status(400).json({ message: 'You have created your own team for this event. You cannot accept other invitations unless you cancel your team first.' });
    }

    // Prevent accepting if user is already a confirmed member of another team for this event
    const { data: registeredTeams } = await supabase
      .from('event_registrations')
      .select('id')
      .eq('event_id', event.id)
      .eq('user_id', userId)
      .eq('status', 'registered');

    if (registeredTeams && registeredTeams.length > 0) {
      return res.status(400).json({ message: 'You are already a confirmed member of a team for this event.' });
    }

    // 1. Update the target registration to registered
    const { error: updateErr } = await supabase
      .from('event_registrations')
      .update({ status: 'registered' })
      .eq('id', registrationId);

    if (updateErr) {
      if (updateErr.code === '23505') { // Postgres unique_violation
        return res.status(400).json({ message: 'You are already a member of a team for this event. A student can only have one active team per event.' });
      }
      throw updateErr;
    }

    // 2. Notify Team Leader that a member accepted
    try {
      const { data: teamInfo } = await supabase.from('event_teams').select('name, leader_id').eq('id', reg.team_id).maybeSingle();
      if (teamInfo && teamInfo.leader_id) {
        const studentName = userProfile?.name || userProfile?.fullName || req.user?.fullName || req.user?.name || 'A teammate';
        await notifyUser({
          recipientId: teamInfo.leader_id,
          title: 'Teammate Accepted Invitation',
          message: `${studentName} has accepted your invitation to join team "${teamInfo.name}" for "${event.title}".`,
          type: 'info',
          eventId: event.id
        });
      }
    } catch (notifErr) {
      console.warn('Notice sending accept notification to leader:', notifErr.message);
    }

    res.json({ message: 'Team invitation accepted successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error accepting invitation.', error: err.message });
  }
};

exports.rejectTeamInvitation = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const userId = req.user.id;

    const { data: reg, error: regErr } = await supabase
      .from('event_registrations')
      .select('*, events(id, title, registration_deadline), event_teams(status)')
      .eq('id', registrationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (regErr || !reg) {
      return res.status(404).json({ message: 'Registration not found or not authorized.' });
    }

    if (reg.status !== 'pending') {
      return res.status(400).json({ message: 'This registration is not pending.' });
    }

    if (reg.event_teams && reg.event_teams.status === 'registered') {
      return res.status(400).json({ message: 'Team has been finalized. You can no longer reject this invitation.' });
    }

    const event = reg.events;
    if (event.registration_deadline && new Date() > new Date(event.registration_deadline)) {
      return res.status(400).json({ message: 'The registration deadline has passed. You can no longer reject this invitation.' });
    }

    // Update the pending registration to rejected instead of deleting
    const { error: delErr } = await supabase
      .from('event_registrations')
      .update({ status: 'rejected' })
      .eq('id', registrationId);

    if (delErr) throw delErr;

    res.json({ message: 'Team invitation rejected.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error rejecting invitation.', error: err.message });
  }
};

exports.leaveTeam = async (req, res) => {
  try {
    const { teamId } = req.body;
    const userId = req.user.id;
    
    console.log('\n--- LEAVE TEAM REQUEST START ---');
    console.log(`[Leave Team] User ID from JWT: ${userId}`);
    console.log(`[Leave Team] Incoming request body:`, req.body);
    console.log(`[Leave Team] Target Team ID: ${teamId}`);

    if (!teamId) {
      console.log('[Leave Team] Validation Failed: Team ID is required.');
      return res.status(400).json({ message: 'Team ID is required.' });
    }

    // 1. Verify Team exists and check status
    console.log(`[Leave Team] DB Query: Fetching event_teams for ID: ${teamId}`);
    const { data: teamInfo, error: teamErr } = await supabase.from('event_teams').select('*').eq('id', teamId).maybeSingle();
    
    if (teamErr) {
      console.error(`[Leave Team] DB Error fetching team:`, teamErr);
      throw teamErr;
    }
    console.log(`[Leave Team] DB Response (teamInfo):`, teamInfo);

    if (!teamInfo) {
      console.log('[Leave Team] Validation Failed: Team not found.');
      return res.status(404).json({ message: 'Team not found.' });
    }

    if (teamInfo.status === 'registered') {
      console.log('[Leave Team] Validation Failed: Team is already registered.');
      return res.status(400).json({ message: 'Cannot leave a confirmed team. Only the team leader can cancel the entire registration.' });
    }

    // 2. Verify User is not the Team Leader
    if (teamInfo.leader_id === userId) {
      console.log('[Leave Team] Validation Failed: User is the Team Leader.');
      return res.status(400).json({ message: 'Team Leader cannot leave the team. Use the Cancel Team Registration option instead.' });
    }

    // 3. Verify Membership record exists and invitation status is accepted (registered)
    console.log(`[Leave Team] DB Query: Fetching event_registrations for team_id: ${teamId}, user_id: ${userId}`);
    const { data: regInfo, error: regErr } = await supabase.from('event_registrations').select('id, status').eq('team_id', teamId).eq('user_id', userId).maybeSingle();
    
    if (regErr) {
      console.error(`[Leave Team] DB Error fetching registration:`, regErr);
      throw regErr;
    }
    console.log(`[Leave Team] DB Response (regInfo):`, regInfo);

    if (!regInfo) {
      console.log('[Leave Team] Validation Failed: Membership record not found.');
      return res.status(404).json({ message: 'You are not a member of this team.' });
    }

    if (regInfo.status !== 'registered') {
      console.log(`[Leave Team] Validation Failed: Invitation status is ${regInfo.status}, not 'registered'.`);
      return res.status(400).json({ message: `Cannot leave team. Your current status is '${regInfo.status}'.` });
    }

    // 4. Update status to 'pending' (representing left team, making the invitation active again)
    console.log(`[Leave Team] DB Query: Updating status to 'pending' for registration ID: ${regInfo.id}`);
    const { error: updateErr } = await supabase
      .from('event_registrations')
      .update({ status: 'pending' })
      .eq('id', regInfo.id);

    if (updateErr) {
      console.error(`[Leave Team] DB Error during update:`, updateErr);
      if (updateErr.code === '23514') {
         // CHECK constraint violation
         console.error(`[Leave Team] ROOT CAUSE: Database CHECK CONSTRAINT violation! The 'event_registrations_status_check' constraint does not allow the status 'left'. Please run the SQL patch.`);
         return res.status(500).json({ message: 'Database constraint violation: status "left" is not permitted. Please run the SQL patch in your Supabase dashboard.', error: updateErr });
      }
      throw updateErr;
    }
    console.log(`[Leave Team] DB Response: Update successful.`);

    console.log('--- LEAVE TEAM REQUEST SUCCESS ---\n');
    res.json({ message: 'Successfully left the team.' });
  } catch (err) {
    console.error('\n--- LEAVE TEAM REQUEST FAILED ---');
    console.error('Exact Exception:', err);
    console.error('Stack Trace:', err.stack);
    console.error('---------------------------------\n');
    res.status(500).json({ message: 'Server error leaving the team.', error: err.message, stack: err.stack });
  }
};

exports.confirmTeamRegistration = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { leaderContactNumber, utrNumber } = req.body;
    const leaderId = req.user.id;

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID is required.' });
    }

    let contactNumber = leaderContactNumber;
    if (!contactNumber || !/^[6-9]\d{9}$/.test(contactNumber)) {
      // Automatically extract Leader phone number from profile
      const { data: leaderProfile } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', leaderId)
        .maybeSingle();
      
      const cleanPhone = String(leaderProfile?.phone || '').replace(/[^0-9]/g, '');
      if (cleanPhone && cleanPhone.length === 10) {
        contactNumber = cleanPhone;
      } else {
        contactNumber = req.user?.phone || '9876543210';
      }
    }

    if (utrNumber && String(utrNumber).trim() !== '' && !validateUtr(utrNumber)) {
      return res.status(400).json({ message: 'UTR must be 12-22 letters or numbers.' });
    }

    // 1. Fetch team & associated event details
    const { data: teamData, error: teamErr } = await supabase
      .from('event_teams')
      .select('event_id, events(*)')
      .eq('id', teamId)
      .eq('leader_id', leaderId)
      .single();

    if (teamErr || !teamData) {
      return res.status(404).json({ message: 'Team not found or unauthorized.' });
    }

    const event = teamData.events;
    if (!event) {
      return res.status(404).json({ message: 'Associated event not found.' });
    }

    // MANDATORY PROFILE CHECK: Ensure all members who joined the team have completed their profile details
    const { data: teamRegs } = await supabase
      .from('event_registrations')
      .select('user_id, status')
      .eq('team_id', teamId);

    const checkUserIds = [...new Set((teamRegs || []).map(r => r.user_id))];
    if (checkUserIds.length > 0) {
      const { data: memberProfiles } = await supabase.from('profiles').select('*').in('id', checkUserIds);
      const incompleteMembers = [];
      for (const uId of checkUserIds) {
        let prof = (memberProfiles || []).find(p => String(p.id) === String(uId));
        if (!prof || !prof.phone || !prof.gender || !prof.college_name) {
          const compProf = await fetchCompleteProfile(uId, prof?.email, prof);
          prof = compProf;
        }
        const comp = checkProfileCompleteness(prof);
        if (!comp.isComplete) {
          incompleteMembers.push({
            name: prof?.name || prof?.email || 'Team Member',
            missingFields: comp.missingFields
          });
        }
      }
      if (incompleteMembers.length > 0) {
        const details = incompleteMembers.map(m => `${m.name} (${m.missingFields.join(', ')})`).join('; ');
        return res.status(400).json({
          success: false,
          profileIncomplete: true,
          incompleteMembers,
          message: `Incomplete Profile! Cannot confirm team registration because the following member(s) have incomplete profiles: ${details}. All members must complete their profile fields first.`
        });
      }
    }

    if (event.payment_enabled && !validateUtr(utrNumber)) {
      return res.status(400).json({ message: 'A valid UTR is required before confirming this team.' });
    }

    // 2. STRICT CHECK: Event published status
    if (event.status !== 'published') {
      return res.status(400).json({ message: 'Registration is closed because the event is not active/published.' });
    }

    // 3. STRICT CHECK: Registration deadline
    if (event.registration_deadline && new Date() > new Date(event.registration_deadline)) {
      return res.status(400).json({ message: 'Registration has closed. The registration deadline has passed.' });
    }

    // 4. STRICT CHECK: Max Teams / Capacity Slots Available
    if (event.registration_type === 'team') {
      if (event.max_teams) {
        const { count: confirmedTeamsCount, error: countErr } = await supabase
          .from('event_teams')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', event.id)
          .eq('status', 'registered');

        if (!countErr && confirmedTeamsCount >= event.max_teams) {
          return res.status(409).json({ message: 'No more team slots are available. Registration is full.' });
        }
      }
    } else {
      if (event.capacity) {
        const { count: currentRegsCount, error: capErr } = await supabase
          .from('event_registrations')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', event.id)
          .eq('status', 'registered');

        if (!capErr && currentRegsCount >= event.capacity) {
          return res.status(409).json({ message: 'Event capacity has been reached.' });
        }
      }
    }

    // 5. Update ALL team registrations to registered
    const { error: regErr } = await supabase
      .from('event_registrations')
      .update({ status: 'registered' })
      .eq('team_id', teamId);

    if (regErr) console.warn('Warning updating team member registrations to registered:', regErr.message);

    if (regErr) {
      return res.status(400).json({ message: regErr.message || 'Failed to update team registration status.' });
    }

    // Save the leader contact number (extracted from profile)
    const { error: contactErr } = await supabase
      .from('event_teams')
      .update({ leader_contact_number: contactNumber })
      .eq('id', teamId);

    if (contactErr) {
      return res.status(400).json({ message: contactErr.message || 'Failed to save team leader contact number.' });
    }

    // Store payment against the leader registration before final confirmation.
    if (event.payment_enabled) {
      const { data: paymentRegistration, error: paymentErr } = await supabase
        .from('event_registrations')
        .update({ utr_number: utrNumber.trim().toUpperCase(), payment_status: 'submitted' })
        .eq('team_id', teamId)
        .eq('user_id', leaderId)
        .select('id')
        .single();
      if (paymentErr) {
        if (paymentErr.code === '23505' || /utr/i.test(paymentErr.message || '')) {
          return res.status(409).json({ message: 'This UTR has already been used for another team.' });
        }
        throw paymentErr;
      }
      const { error: submissionHistoryErr } = await supabase.from('payment_verification_history').insert({
        registration_id: paymentRegistration.id,
        event_id: event.id,
        utr_number: utrNumber.trim().toUpperCase(),
        status: 'submitted',
        acted_by: leaderId
      });
      if (submissionHistoryErr) throw submissionHistoryErr;
      return res.status(202).json({
        message: 'UTR submitted. Your team will be confirmed after admin, organizer, or faculty verification.',
        paymentStatus: 'submitted'
      });
    }

    // 7. Call atomic RPC for DB row locking & final confirmation
    const { data: acceptedRegs } = await supabase
      .from('event_registrations')
      .select('user_id')
      .eq('team_id', teamId)
      .eq('status', 'accepted');
    const acceptedUserIds = new Set((acceptedRegs || []).map(r => r.user_id));
    acceptedUserIds.add(leaderId);

    try {
      await finalizeTeamRegistration(teamId, event, leaderId, acceptedUserIds);
    } catch (finalizeErr) {
      return res.status(finalizeErr.statusCode || 400).json({ message: finalizeErr.message });
    }

    // Notify all confirmed team members
    try {
      const { data: confirmedRegs } = await supabase.from('event_registrations').select('user_id').eq('team_id', teamId).eq('status', 'registered');
      const eventTitle = event.title || 'the event';
      const dateStr = new Date(event.date).toLocaleDateString();
      const teamName = teamData.name || 'your team';

      if (confirmedRegs) {
        for (const r of confirmedRegs) {
          const profile = await resolveUserProfile(r.user_id);
          await notifyUser({
            recipientId: r.user_id,
            title: 'Team Registration Confirmed',
            message: `Your team "${teamName}" has been confirmed for "${eventTitle}". See you there!`,
            type: 'success',
            eventId: event.id,
            emailSubject: `Team Confirmed – ${eventTitle}`,
            emailData: { eventName: eventTitle, date: dateStr, venue: event.venue || 'TBA', teamName, status: 'Confirmed', recipientName: profile.name }
          });
        }
      }
    } catch (notifErr) {
      console.error('Non-fatal error sending team confirmation notifications:', notifErr.message);
    }

    res.json({ message: 'Team registration confirmed successfully!' });
  } catch (err) {
    console.error('Error confirming team registration:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

exports.getConfirmedTeams = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    // Check if event exists
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventErr || !event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    // Check organizer access (roleMiddleware ensures admin/faculty/student, but we need to check specific event organizer status)
    if (!req.user.roles.includes('admin')) {
      const isFaculty = event.faculty_id === req.user.id;
      const isEventHead = event.student_organizer_id === req.user.id || event.proposed_by === req.user.id;
      
      const { data: organizers } = await supabase
        .from('event_organizers')
        .select('student_id')
        .eq('event_id', eventId);
      
      const isOrganizer = (organizers || []).some(org => org.student_id === req.user.id);
      
      if (!isFaculty && !isEventHead && !isOrganizer) {
        return res.status(403).json({ message: 'Access denied. Organizer permissions required.' });
      }
    }

    // Fetch confirmed teams
    const { data: teams, error: teamsErr } = await supabase
      .from('event_teams')
      .select('*')
      .eq('event_id', eventId)
      .eq('status', 'registered');

    if (teamsErr) throw teamsErr;

    if (!teams || teams.length === 0) {
      return res.json([]);
    }

    const teamIds = teams.map(t => t.id);

    // Fetch confirmed registrations for these teams with full user profiles
    const { data: registrations, error: regErr } = await supabase
      .from('event_registrations')
      .select(`
        id, team_id, user_id, attendance_status, created_at,
        profiles!event_registrations_user_id_fkey(*)
      `)
      .in('team_id', teamIds)
      .in('status', ['registered', 'accepted', 'pending']);

    if (regErr) throw regErr;

    // Group by team
    const result = teams.map(team => {
      const teamRegs = registrations.filter(r => r.team_id === team.id);
      const members = teamRegs.map(r => ({
        registrationId: r.id,
        userId: r.user_id,
        name: r.profiles?.name || 'Unknown',
        email: r.profiles?.email || '',
        department: r.profiles?.department || '',
        rollNumber: r.profiles?.roll_number || '',
        collegeName: r.profiles?.college_name || r.profiles?.collegeName || r.profiles?.institution || '',
        degreeProgram: r.profiles?.degree_program || r.profiles?.degreeProgram || r.profiles?.program || '',
        yearOfStudy: r.profiles?.year_of_study || r.profiles?.yearOfStudy || '',
        gender: r.profiles?.gender || '',
        phone: r.profiles?.phone || '',
        avatarUrl: r.profiles?.avatar_url || r.profiles?.avatarUrl || null,
        attendanceStatus: r.attendance_status
      }));

      return {
        id: team.id,
        name: team.name,
        leaderId: team.leader_id,
        leaderContactNumber: team.leader_contact_number || '',
        members: members
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Error fetching confirmed teams:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

exports.updateTeamName = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { teamName } = req.body;
    const userId = req.user.id;

    if (!teamName || teamName.trim() === '') {
      return res.status(400).json({ message: 'Team name is required.' });
    }

    const { data: team, error: teamErr } = await supabase
      .from('event_teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (teamErr || !team) {
      return res.status(404).json({ message: 'Team not found.' });
    }

    if (team.leader_id !== userId) {
      return res.status(403).json({ message: 'Only the Team Leader can edit the team.' });
    }

    if (team.status === 'registered') {
      return res.status(400).json({ message: 'Cannot edit a confirmed team.' });
    }

    const trimmedName = teamName.trim();

    // Explicit Case-Insensitive Uniqueness Check
    const { data: existingTeamByName } = await supabase
      .from('event_teams')
      .select('id')
      .eq('event_id', team.event_id)
      .ilike('name', trimmedName)
      .neq('id', teamId);
      
    if (existingTeamByName && existingTeamByName.length > 0) {
      return res.status(400).json({ message: 'This team name is already taken. Please choose another team name.' });
    }

    const { error: updateErr } = await supabase
      .from('event_teams')
      .update({ name: teamName.trim() })
      .eq('id', teamId);

    if (updateErr) {
      if (updateErr.code === '23505') {
        return res.status(400).json({ message: 'This team name is already taken. Please choose another team name.' });
      }
      throw updateErr;
    }

    res.json({ message: 'Team name updated successfully.' });
  } catch (err) {
    console.error('Error updating team name:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

exports.addTeamMember = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { memberId } = req.body;
    const userId = req.user.id;

    if (!memberId) {
      return res.status(400).json({ message: 'Member ID is required.' });
    }

    const { data: team, error: teamErr } = await supabase
      .from('event_teams')
      .select('*, events(*)')
      .eq('id', teamId)
      .single();

    if (teamErr || !team) {
      return res.status(404).json({ message: 'Team not found.' });
    }

    if (team.leader_id !== userId) {
      return res.status(403).json({ message: 'Only the Team Leader can add members.' });
    }

    if (team.status === 'registered') {
      return res.status(400).json({ message: 'Cannot edit a confirmed team.' });
    }

    const event = team.events;

    // Check current active member count (accepted + pending)
    const { data: currentRegs, error: regsErr } = await supabase
      .from('event_registrations')
      .select('status, user_id')
      .eq('team_id', teamId)
      .in('status', ['registered', 'pending']);
    
    if (regsErr) throw regsErr;

    const currentMemberCount = (currentRegs || []).length;
    
    if (currentMemberCount >= event.max_team_size) {
      return res.status(400).json({ message: `Cannot exceed maximum team size of ${event.max_team_size} members.` });
    }

    if (currentRegs.some(r => r.user_id === memberId)) {
      return res.status(400).json({ message: 'User is already in this team (pending or accepted).' });
    }

    // Eligibility Check
    // 1. Is organizer? — also check event_members (pre-publication organizers)
    const { data: organizers } = await supabase
      .from('event_organizers')
      .select('student_id')
      .eq('event_id', event.id);
    
    const { data: proposalMembers } = await supabase
      .from('event_members')
      .select('user_id')
      .eq('event_id', event.id);
    
    const organizerIds = (organizers || []).map(o => o.student_id);
    if (event.organizer_id) organizerIds.push(event.organizer_id);
    if (event.student_organizer_id) organizerIds.push(event.student_organizer_id);
    if (event.proposed_by) organizerIds.push(event.proposed_by);
    if (event.faculty_id) organizerIds.push(event.faculty_id);
    // Add pre-publication organizers from event_members
    (proposalMembers || []).forEach(m => { if (m.user_id) organizerIds.push(m.user_id); });

    if (organizerIds.includes(memberId)) {
      return res.status(400).json({ message: 'User is an organizer and cannot join a team.' });
    }

    // 2. Is in confirmed team?
    const { data: confirmedTeams } = await supabase
      .from('event_teams')
      .select('id')
      .eq('event_id', event.id)
      .eq('status', 'registered');
    
    if (confirmedTeams && confirmedTeams.length > 0) {
      const confirmedTeamIds = confirmedTeams.map(t => t.id);
      const { data: alreadyRegisteredMembers } = await supabase
        .from('event_registrations')
        .select('user_id')
        .in('team_id', confirmedTeamIds)
        .eq('user_id', memberId)
        .eq('status', 'registered');
      
      if (alreadyRegisteredMembers && alreadyRegisteredMembers.length > 0) {
        return res.status(400).json({ message: 'User is already part of a confirmed team for this event.' });
      }
    }

    // Create invitation (pending registration)
    const newReg = {
      user_id: memberId,
      event_id: event.id,
      team_id: teamId,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const { error: insertErr } = await supabase
      .from('event_registrations')
      .insert(newReg);

    if (insertErr) {
      // Handle unique constraint violations
      if (insertErr.code === '23505') {
         return res.status(400).json({ message: 'User already has a registration record for this event.' });
      }
      throw insertErr;
    }

    // Notify user
    try {
      const dateStr = new Date(event.date).toLocaleDateString();
      await notifyUser({
        recipientId: memberId,
        title: 'New Team Invitation',
        message: `You have been invited to join team "${team.name}" for "${event.title}".`,
        type: 'info',
        eventId: event.id,
        emailSubject: `Team Invitation – ${event.title}`,
        emailHtml: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: #4f46e5;">New Team Invitation</h2>
            <p>You have been invited to join team <strong>${team.name}</strong> for the event <strong>${event.title}</strong>.</p>
            <p><strong>Date:</strong> ${dateStr}</p>
            <p>Please log in to your dashboard to accept or reject this invitation.</p>
          </div>
        `
      });
    } catch (notifErr) {
      console.error('Failed to send notification for new member:', notifErr);
    }

    res.json({ message: 'Team member added successfully.' });
  } catch (err) {
    console.error('Error adding team member:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

exports.removeTeamMember = async (req, res) => {
  try {
    const { teamId, userId: memberId } = req.params;
    const userId = req.user.id; // leader

    const { data: team, error: teamErr } = await supabase
      .from('event_teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (teamErr || !team) {
      return res.status(404).json({ message: 'Team not found.' });
    }

    if (team.leader_id !== userId) {
      return res.status(403).json({ message: 'Only the Team Leader can remove members.' });
    }

    if (team.status === 'registered') {
      return res.status(400).json({ message: 'Cannot edit a confirmed team.' });
    }

    if (memberId === userId) {
      return res.status(400).json({ message: 'Team leader cannot be removed.' });
    }

    const { data: memberReg, error: memberRegErr } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('team_id', teamId)
      .eq('user_id', memberId)
      .single();

    if (memberRegErr || !memberReg) {
      return res.status(404).json({ message: 'Member not found in this team.' });
    }
    
    if (memberReg.status === 'registered') {
      // Technically they shouldn't remove an accepted member unless it's pending, but requirement: 
      // "The leader should be able to remove/replace the rejected member and invite another eligible student."
      // If we allow removing registered members, we can do it because the team is still pending.
      // But typically, they can replace ANY member before confirmation.
    }

    const { error: delErr } = await supabase
      .from('event_registrations')
      .delete()
      .eq('id', memberReg.id);

    if (delErr) throw delErr;

    res.json({ message: 'Team member removed successfully.' });
  } catch (err) {
    console.error('Error removing team member:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// Check if a team name is available for a specific event
exports.checkTeamName = async (req, res) => {
  try {
    const { id: eventId } = req.params;
    const { name, excludeTeamId } = req.query;

    if (!name || name.trim() === '') {
      return res.json({ available: false, message: 'Team name cannot be empty.' });
    }

    const trimmedName = name.trim();

    let query = supabase
      .from('event_teams')
      .select('id')
      .eq('event_id', eventId)
      .ilike('name', trimmedName);

    if (excludeTeamId) {
      query = query.neq('id', excludeTeamId);
    }

    const { data: existingTeam, error } = await query;

    if (error) throw error;

    if (existingTeam && existingTeam.length > 0) {
      return res.json({ available: false, message: 'This team name is already taken. Please choose another team name.' });
    }

    res.json({ available: true, message: 'Team name is available.' });
  } catch (err) {
    console.error('Error checking team name:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

exports.updatePaymentStatus = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const { payment_status } = req.body;

    if (!payment_status) {
      return res.status(400).json({ message: 'payment_status is required.' });
    }

    const { data, error } = await supabase
      .from('event_registrations')
      .update({ payment_status, updated_at: new Date().toISOString() })
      .eq('id', registrationId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ message: 'Registration not found.' });

    res.json({ message: 'Payment status updated.', registration: data });
  } catch (err) {
    console.error('updatePaymentStatus error:', err.message);
    res.status(500).json({ message: 'Failed to update payment status.', error: err.message });
  }
};

/**
 * ADMIN ONLY: Manually create a team for an event.
 */
exports.adminCreateTeam = async (req, res) => {
  try {
    if (!req.user || !req.user.roles || !req.user.roles.includes('admin')) {
      return res.status(403).json({ message: 'Access denied. Administrator permissions required.' });
    }

    const { eventId, teamName, leaderId, memberIds } = req.body;

    if (!eventId || !teamName || !leaderId) {
      return res.status(400).json({ message: 'Event ID, Team Name, and Team Leader ID are required.' });
    }

    const membersList = Array.isArray(memberIds) ? memberIds : [];

    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle();

    if (eventErr || !event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    if (event.registration_type !== 'team') {
      return res.status(400).json({ message: 'This event does not support team registration.' });
    }

    // Fetch organizers for this event
    const { data: organizers } = await supabase
      .from('event_organizers')
      .select('student_id')
      .eq('event_id', eventId);

    const { data: proposalMembers } = await supabase
      .from('event_members')
      .select('user_id')
      .eq('event_id', eventId);

    const organizerIds = (organizers || []).map(o => String(o.student_id));
    if (event.organizer_id) organizerIds.push(String(event.organizer_id));
    if (event.student_organizer_id) organizerIds.push(String(event.student_organizer_id));
    if (event.proposed_by) organizerIds.push(String(event.proposed_by));
    if (event.faculty_id) organizerIds.push(String(event.faculty_id));
    if (event.created_by) organizerIds.push(String(event.created_by));
    (proposalMembers || []).forEach(m => { if (m.user_id) organizerIds.push(String(m.user_id)); });

    const allSelectedIds = [...new Set([leaderId, ...membersList])];
    const containsOrganizer = allSelectedIds.some(id => organizerIds.includes(String(id)));

    if (containsOrganizer) {
      return res.status(403).json({ message: 'One or more selected students are organizers for this event and cannot be added as team members.' });
    }

    const minSize = event.min_team_size || 1;
    const maxSize = event.max_team_size || 4;
    if (allSelectedIds.length < minSize || allSelectedIds.length > maxSize) {
      return res.status(400).json({ message: `Team size must be between ${minSize} and ${maxSize} members.` });
    }

    const { data: existingTeamByName } = await supabase
      .from('event_teams')
      .select('id')
      .eq('event_id', eventId)
      .ilike('name', teamName.trim());

    if (existingTeamByName && existingTeamByName.length > 0) {
      return res.status(400).json({ message: 'This team name is already taken. Please choose another team name.' });
    }

    const { data: team, error: teamErr } = await supabase
      .from('event_teams')
      .insert({
        event_id: eventId,
        name: teamName.trim(),
        leader_id: leaderId,
        status: 'registered'
      })
      .select()
      .single();

    if (teamErr) throw teamErr;

    const registrations = allSelectedIds.map(uid => ({
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

    await supabase.from('events').update({
      registered_count: (event.registered_count || 0) + 1
    }).eq('id', eventId);

    res.json({ message: 'Team created successfully by Admin.', team });
  } catch (err) {
    console.error('Error in adminCreateTeam:', err);
    res.status(500).json({ message: 'Server error creating team.', error: err.message });
  }
};

/**
 * ADMIN ONLY: Manually cancel a team registration.
 */
exports.adminCancelTeamRegistration = async (req, res) => {
  try {
    if (!req.user || !req.user.roles || !req.user.roles.includes('admin')) {
      return res.status(403).json({ message: 'Access denied. Administrator permissions required.' });
    }

    const { teamId } = req.params;
    if (!teamId) {
      return res.status(400).json({ message: 'Team ID is required.' });
    }

    const { data: team, error: teamErr } = await supabase
      .from('event_teams')
      .select('*')
      .eq('id', teamId)
      .maybeSingle();

    if (teamErr || !team) {
      return res.status(404).json({ message: 'Team not found.' });
    }

    const eventId = team.event_id;

    await supabase.from('event_registrations').delete().eq('team_id', teamId);
    await supabase.from('event_teams').delete().eq('id', teamId);

    if (team.status === 'registered') {
      const { data: event } = await supabase.from('events').select('registered_count').eq('id', eventId).single();
      if (event) {
        await supabase.from('events').update({
          registered_count: Math.max(0, (event.registered_count || 0) - 1)
        }).eq('id', eventId);
      }
    }

    res.json({ message: 'Team registration cancelled successfully by Admin.' });
  } catch (err) {
    console.error('Error in adminCancelTeamRegistration:', err);
    res.status(500).json({ message: 'Server error cancelling team registration.', error: err.message });
  }
};

/**
 * ADMIN ONLY: Approve a student's team request/invitation directly.
 */
exports.adminApproveTeamRequest = async (req, res) => {
  try {
    if (!req.user || !req.user.roles || !req.user.roles.includes('admin')) {
      return res.status(403).json({ message: 'Access denied. Administrator permissions required.' });
    }

    const { registrationId } = req.params;
    if (!registrationId) {
      return res.status(400).json({ message: 'Registration ID is required.' });
    }

    const { data: reg, error: regErr } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('id', registrationId)
      .maybeSingle();

    if (regErr || !reg) {
      return res.status(404).json({ message: 'Registration record not found.' });
    }

    if (reg.status === 'registered') {
      return res.status(400).json({ message: 'Student team request is already approved.' });
    }

    const { error: updateErr } = await supabase
      .from('event_registrations')
      .update({ status: 'registered' })
      .eq('id', registrationId);

    if (updateErr) throw updateErr;

    // Notify student that their team request was approved
    try {
      const eventTitle = 'your event';
      await notifyUser({
        recipientId: reg.user_id,
        title: 'Team Request Approved',
        message: `Your team request has been approved by the admin.`,
        type: 'success',
        eventId: reg.event_id,
        emailSubject: `Team Approved – ${eventTitle}`,
        emailData: { eventName: eventTitle, status: 'Approved by Admin' }
      });
    } catch (notifErr) {
      console.error('Non-fatal error sending admin approve notification:', notifErr.message);
    }

    res.json({ message: 'Student team request approved successfully by Admin.' });
  } catch (err) {
    console.error('Error in adminApproveTeamRequest:', err);
    res.status(500).json({ message: 'Server error approving team request.', error: err.message });
  }
};

/**
 * ADMIN ONLY: Fetch eligible non-organizer students for manual team creation.
 */
exports.getNonOrganizerStudentsForEvent = async (req, res) => {
  try {
    if (!req.user || !req.user.roles || !req.user.roles.includes('admin')) {
      return res.status(403).json({ message: 'Access denied. Administrator permissions required.' });
    }

    const { eventId } = req.params;

    const { data: event } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle();
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    const { data: organizers } = await supabase
      .from('event_organizers')
      .select('student_id')
      .eq('event_id', eventId);

    const { data: proposalMembers } = await supabase
      .from('event_members')
      .select('user_id')
      .eq('event_id', eventId);

    const organizerIds = new Set((organizers || []).map(o => String(o.student_id)));
    if (event.organizer_id) organizerIds.add(String(event.organizer_id));
    if (event.student_organizer_id) organizerIds.add(String(event.student_organizer_id));
    if (event.proposed_by) organizerIds.add(String(event.proposed_by));
    if (event.faculty_id) organizerIds.add(String(event.faculty_id));
    if (event.created_by) organizerIds.add(String(event.created_by));
    (proposalMembers || []).forEach(m => { if (m.user_id) organizerIds.add(String(m.user_id)); });

    let students = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data: page, error: studentErr } = await supabase
        .from('profiles')
        .select('id, name, fullName:name, email, roll_number, department, role')
        .eq('role', 'student')
        .range(from, from + pageSize - 1);
      if (studentErr) throw studentErr;
      if (!page || page.length === 0) break;
      students = students.concat(page);
      if (page.length < pageSize) break;
      from += pageSize;
    }

    const eligibleStudents = students.filter(s => !organizerIds.has(String(s.id)));

    res.json(eligibleStudents);
  } catch (err) {
    console.error('Error in getNonOrganizerStudentsForEvent:', err);
    res.status(500).json({ message: 'Server error fetching eligible students.', error: err.message });
  }
};

// External team invitation route handlers
exports.inviteExternalMember = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { email, name } = req.body;
    const userId = req.user.id;

    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email address is required.' });
    }

    const emailLower = email.trim().toLowerCase();

    // 1. Fetch team & event details
    const { data: team, error: teamErr } = await supabase
      .from('event_teams')
      .select('*, events(*)')
      .eq('id', teamId)
      .maybeSingle();

    if (teamErr || !team) {
      return res.status(404).json({ message: 'Team not found.' });
    }

    if (String(team.leader_id) !== String(userId)) {
      return res.status(403).json({ message: 'Only the Team Leader can send team invitations.' });
    }

    if (team.status === 'registered') {
      return res.status(400).json({ message: 'Cannot edit a confirmed team.' });
    }

    const event = team.events;
    if (!event) {
      return res.status(404).json({ message: 'Associated event not found.' });
    }

    // 2. Check current team member count
    const { data: currentRegs } = await supabase
      .from('event_registrations')
      .select('status, user_id')
      .eq('team_id', teamId)
      .in('status', ['registered', 'pending']);

    if ((currentRegs || []).length >= event.max_team_size) {
      return res.status(400).json({ message: `Cannot exceed maximum team size of ${event.max_team_size} members.` });
    }

    // 3. Look up if a profile exists by email
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('id, name, email')
      .ilike('email', emailLower)
      .maybeSingle();

    const targetUserId = targetProfile?.id;

    if (targetUserId) {
      // Check if already in this team
      if ((currentRegs || []).some(r => String(r.user_id) === String(targetUserId))) {
        return res.status(400).json({ message: 'User is already invited or in this team.' });
      }

      // Check if already in another confirmed team for this event
      const { data: confirmedTeams } = await supabase
        .from('event_teams')
        .select('id')
        .eq('event_id', event.id)
        .eq('status', 'registered');

      if (confirmedTeams && confirmedTeams.length > 0) {
        const confirmedTeamIds = confirmedTeams.map(t => t.id);
        const { data: alreadyInConfirmed } = await supabase
          .from('event_registrations')
          .select('user_id')
          .in('team_id', confirmedTeamIds)
          .eq('user_id', targetUserId)
          .eq('status', 'registered');

        if (alreadyInConfirmed && alreadyInConfirmed.length > 0) {
          return res.status(400).json({ message: 'This student is already part of a confirmed team for this event.' });
        }
      }

      // Create pending registration for existing student
      const newReg = {
        user_id: targetUserId,
        event_id: event.id,
        team_id: teamId,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      const { error: insertErr } = await supabase
        .from('event_registrations')
        .insert(newReg);

      if (insertErr && insertErr.code === '23505') {
        return res.status(400).json({ message: 'User already has a registration record for this event.' });
      } else if (insertErr) {
        throw insertErr;
      }

      const dateStr = new Date(event.date).toLocaleDateString();
      const leaderName = req.user?.fullName || req.user?.name || 'Team Leader';

      await notifyUser({
        recipientId: targetUserId,
        recipientEmail: emailLower,
        title: 'Team Invitation Received',
        message: `You have been invited by ${leaderName} to join the team "${team.name}" for "${event.title}". Please accept the invitation before the deadline.`,
        type: 'info',
        eventId: event.id,
        emailSubject: `Team Invitation – ${event.title}`,
        emailData: {
          recipientName: targetProfile?.name || name || emailLower.split('@')[0],
          eventName: event.title,
          date: dateStr,
          venue: event.venue || 'TBA',
          status: 'Pending Approval',
          teamName: team.name,
          teamLeader: leaderName,
          isTeamInvite: true,
          isLeader: false
        }
      });

      return res.json({ message: `Invitation sent successfully to ${emailLower}.` });
    } else {
      // For external student email without an existing profile yet
      try {
        await supabase.from('team_email_invites').insert({
          team_id: teamId,
          event_id: event.id,
          email: emailLower,
          invited_by: userId,
          status: 'pending',
          created_at: new Date().toISOString()
        });
      } catch (invErr) {
        console.warn('team_email_invites insert warning:', invErr.message);
      }

      const dateStr = new Date(event.date).toLocaleDateString();
      const leaderName = req.user?.fullName || req.user?.name || 'Team Leader';

      await notifyUser({
        recipientEmail: emailLower,
        title: 'Team Invitation Received',
        message: `You have been invited by ${leaderName} to join the team "${team.name}" for "${event.title}". Please sign in to Avento to accept the invitation.`,
        type: 'info',
        eventId: event.id,
        emailSubject: `Team Invitation – ${event.title}`,
        emailData: {
          recipientName: name || emailLower.split('@')[0],
          eventName: event.title,
          date: dateStr,
          venue: event.venue || 'TBA',
          status: 'Pending Approval',
          teamName: team.name,
          teamLeader: leaderName,
          isTeamInvite: true,
          isLeader: false
        }
      });

      return res.json({ message: `Invitation email sent to ${emailLower}. They can accept after signing in.` });
    }
  } catch (err) {
    console.error('inviteExternalMember error:', err);
    return res.status(500).json({ message: err.message || 'Server error sending team invitation.' });
  }
};

exports.getTeamInvites = async (req, res) => {
  return res.json([]);
};

exports.revokeTeamInvite = async (req, res) => {
  return res.json({ message: 'Invite revoked.' });
};

exports.getInviteByToken = async (req, res) => {
  return res.status(404).json({ message: 'Invite link not found or expired.' });
};

exports.acceptInviteByToken = async (req, res) => {
  return res.status(400).json({ message: 'Invite link invalid or expired.' });
};

// Student Photo Import Endpoints & Public Image Proxy
const axios = require('axios');

exports.proxyDriveImage = async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).send('URL parameter is required.');
    const response = await axios.get(url, { responseType: 'stream' });
    response.data.pipe(res);
  } catch (err) {
    res.status(500).send('Proxy error.');
  }
};

exports.importStudentPhotos = async (req, res) => {
  try {
    const { eventId } = req.params;
    const files = req.files || [];
    const mappedStudents = [];

    for (const file of files) {
      const originalName = file.originalname || '';
      const rollNumber = originalName.split('.')[0].trim();
      const ext = originalName.split('.').pop() || 'jpg';
      const fileName = `avatars/${rollNumber}_${Date.now()}.${ext}`;

      let photoUrl = null;
      try {
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('documents')
          .upload(fileName, file.buffer, {
            contentType: file.mimetype || 'image/jpeg',
            upsert: true
          });

        if (!uploadErr && uploadData) {
          const { data: publicUrlData } = supabase.storage
            .from('documents')
            .getPublicUrl(fileName);
          photoUrl = publicUrlData?.publicUrl;
        }
      } catch (sErr) {
        console.warn('Supabase storage upload warning:', sErr.message);
      }

      if (photoUrl) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, roll_number, email')
          .or(`roll_number.ilike.${rollNumber},email.ilike.${rollNumber}@%`);

        if (profiles && profiles.length > 0) {
          for (const p of profiles) {
            await supabase
              .from('profiles')
              .update({ avatar_url: photoUrl })
              .eq('id', p.id);
            mappedStudents.push({ rollNumber: p.roll_number || rollNumber, name: p.name, avatarUrl: photoUrl });
          }
        } else {
          mappedStudents.push({ rollNumber, name: rollNumber, avatarUrl: photoUrl });
        }

        setEventAvatar(eventId, rollNumber, photoUrl);
      }
    }
    return res.json({ success: true, message: `Processed ${mappedStudents.length} photo(s).`, mappedStudents });
  } catch (err) {
    console.error('importStudentPhotos error:', err);
    return res.status(500).json({ message: 'Error importing photos.', error: err.message });
  }
};

exports.importStudentPhotoLinks = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { mappings } = req.body;
    if (!Array.isArray(mappings)) return res.status(400).json({ message: 'Mappings array is required.' });

    const mappedStudents = [];
    for (const item of mappings) {
      if (item.rollNumber && item.photoUrl) {
        const cleanRoll = item.rollNumber.trim();
        const photoUrl = item.photoUrl.trim();

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, roll_number, email')
          .or(`roll_number.ilike.${cleanRoll},email.ilike.${cleanRoll}@%`);

        if (profiles && profiles.length > 0) {
          for (const p of profiles) {
            const { data: updated } = await supabase
              .from('profiles')
              .update({ avatar_url: photoUrl })
              .eq('id', p.id)
              .select('id, name, roll_number, avatar_url')
              .maybeSingle();

            if (updated) {
              mappedStudents.push({ rollNumber: updated.roll_number || cleanRoll, name: updated.name, avatarUrl: updated.avatar_url });
            }
          }
        } else {
          const { data: updatedDirect } = await supabase
            .from('profiles')
            .update({ avatar_url: photoUrl })
            .ilike('roll_number', cleanRoll)
            .select('id, name, roll_number, avatar_url')
            .maybeSingle();

          if (updatedDirect) {
            mappedStudents.push({ rollNumber: updatedDirect.roll_number, name: updatedDirect.name, avatarUrl: updatedDirect.avatar_url });
          }
        }

        setEventAvatar(eventId, cleanRoll, photoUrl);
      }
    }
    return res.json({ success: true, message: `Successfully mapped ${mappedStudents.length} photo link(s).`, mappedStudents });
  } catch (err) {
    console.error('importStudentPhotoLinks error:', err);
    return res.status(500).json({ message: 'Error importing photo links.', error: err.message });
  }
};
