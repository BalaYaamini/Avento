const supabase = require('../config/supabaseClient');
const { notifyUser, sendEmailNotification } = require('../services/notificationService');
const crypto = require('crypto');

const UTR_PATTERN = /^[A-Z0-9]{12,22}$/i;

const validateUtr = (utr) => typeof utr === 'string' && UTR_PATTERN.test(utr.trim());

const finalizeTeamRegistration = async (teamId, event, leaderId, acceptedUserIds) => {
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
    if (rpcMsg.includes('Minimum team size not reached yet') && acceptedUserIds.size < (event.min_team_size || 1)) {
      throw new Error(rpcMsg);
    }
    // Fallback: RPC missing or other error — manually set team status
    await supabase.from('event_teams').update({ status: 'registered' }).eq('id', teamId);
    await supabase.from('events').update({ registered_count: (event.registered_count || 0) + 1 }).eq('id', event.id);
  }

  const { error: regErr } = await supabase.from('event_registrations')
    .update({ status: 'registered' }).eq('team_id', teamId).eq('user_id', leaderId);
  if (regErr) throw regErr;
};

const resolveUserProfile = async (userId) => {
  try {
    const { data } = await supabase.from('profiles').select('id, name, email').eq('id', userId).maybeSingle();
    if (data && data.email) return data;
  } catch (e) {}
  return { id: userId, name: 'Unknown', email: null };
};

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

        return {
          ...reg,
          teamDetails: {
            leader_id: reg.teamId.leader_id,
            teamStatus: leaderReg ? leaderReg.status : 'pending',
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
        userId:profiles!event_registrations_user_id_fkey(id, name, fullName:name, email, department, roll_number),
        teamId:event_teams (*)
      `)
      .eq('event_id', eventId);

    if (error) throw error;
    const enriched = await Promise.all((registrations || []).map(async registration => {
      const { data: paymentHistory } = await supabase.from('payment_verification_history')
        .select('*').eq('registration_id', registration.id).order('acted_at', { ascending: false });
      return { ...registration, paymentHistory: paymentHistory || [] };
    }));
    res.json(enriched);
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

    // Validate registration deadline
    if (event.registration_deadline && new Date() > new Date(event.registration_deadline)) {
      return res.status(400).json({ message: 'The registration deadline for this event has passed.' });
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
        const statusText = isLeader ? 'Confirmed' : 'Pending Approval';
        const msg = isLeader 
          ? `Your team "${teamName}" has been successfully created for "${event.title}". Waiting for members to accept before you can confirm the registration.`
          : `You have been invited by ${teamLeaderName} to join the team "${teamName}" for "${event.title}". Please accept the invitation before the deadline.`;

        await notifyUser({
          recipientId: uid,
          title: isLeader ? 'Team Registration Successful' : 'Team Invitation Received',
          message: msg,
          type: isLeader ? 'success' : 'info',
          eventId: event.id,
          emailSubject: isLeader ? `Team Registration Confirmed – ${event.title}` : `Team Invitation – ${event.title}`,
          emailData: {
            eventName: event.title,
            date: dateStrTeam,
            venue: event.venue || 'TBA',
            status: statusText,
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

    if (!leaderContactNumber || !/^[6-9]\d{9}$/.test(leaderContactNumber)) {
      return res.status(400).json({ message: 'A valid 10-digit Indian mobile number is required for the Team Leader.' });
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

    if (event.capacity) {
      const { count: currentRegsCount, error: capErr } = await supabase
        .from('event_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .eq('status', 'registered');

      if (!capErr && currentRegsCount >= event.capacity) {
        return res.status(409).json({ message: 'No more team slots are available. Registration is full.' });
      }
    }

    // 5. Update leader registration to registered
    const { error: regErr } = await supabase
      .from('event_registrations')
      .update({ status: 'registered' })
      .eq('team_id', teamId)
      .eq('user_id', leaderId);

    if (regErr) {
      return res.status(400).json({ message: regErr.message || 'Failed to update team registration status.' });
    }

    // Save the leader contact number
    const { error: contactErr } = await supabase
      .from('event_teams')
      .update({ leader_contact_number: leaderContactNumber })
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

    // Fetch confirmed registrations for these teams with user profiles
    const { data: registrations, error: regErr } = await supabase
      .from('event_registrations')
      .select(`
        id, team_id, user_id, attendance_status, created_at,
        profiles!event_registrations_user_id_fkey(id, name, email, department, roll_number)
      `)
      .in('team_id', teamIds)
      .eq('status', 'registered');

    if (regErr) throw regErr;

    // Group by team
    const result = teams.map(team => {
      const teamRegs = registrations.filter(r => r.team_id === team.id);
      const members = teamRegs.map(r => ({
        userId: r.user_id,
        name: r.profiles?.name || 'Unknown',
        email: r.profiles?.email || 'N/A',
        department: r.profiles?.department || 'N/A',
        rollNumber: r.profiles?.roll_number || 'N/A',
        attendanceStatus: r.attendance_status
      }));

      return {
        id: team.id,
        name: team.name,
        leaderId: team.leader_id,
        leaderContactNumber: team.leader_contact_number || 'N/A',
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

// ─── INVITE EXTERNAL MEMBER BY EMAIL ──────────────────────────────────────
exports.inviteExternalMember = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { email, name } = req.body;
    const userId = req.user.id;

    if (!email || !name) {
      return res.status(400).json({ message: 'Email and name are required.' });
    }

    const emailLower = email.toLowerCase().trim();

    const { data: team, error: teamErr } = await supabase
      .from('event_teams')
      .select('*, events(*)')
      .eq('id', teamId)
      .single();

    if (teamErr || !team) return res.status(404).json({ message: 'Team not found.' });
    if (team.leader_id !== userId) return res.status(403).json({ message: 'Only the Team Leader can invite members.' });
    if (team.status === 'registered') return res.status(400).json({ message: 'Cannot edit a confirmed team.' });

    const event = team.events;

    const { data: currentRegs } = await supabase
      .from('event_registrations')
      .select('user_id')
      .eq('team_id', teamId)
      .in('status', ['registered', 'pending']);

    if ((currentRegs || []).length >= event.max_team_size) {
      return res.status(400).json({ message: `Cannot exceed maximum team size of ${event.max_team_size} members.` });
    }

    const { data: existingInvite } = await supabase
      .from('team_email_invites')
      .select('id, status')
      .eq('event_id', event.id)
      .eq('team_id', teamId)
      .eq('email', emailLower)
      .maybeSingle();

    if (existingInvite && existingInvite.status === 'pending') {
      return res.status(400).json({ message: 'This email already has a pending invitation.' });
    }

    const inviteToken = crypto.randomBytes(32).toString('hex');

    const { error: inviteErr } = await supabase
      .from('team_email_invites')
      .upsert({
        event_id: event.id,
        team_id: teamId,
        invited_by: userId,
        email: emailLower,
        name: name.trim(),
        status: 'pending',
        invite_token: inviteToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }, { onConflict: 'event_id, team_id, email' });

    if (inviteErr) throw inviteErr;

    const inviteUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/accept-invite/${inviteToken}`;

    const inviteHtml = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:40px 20px;background:#fdfbf7;font-family:Arial,sans-serif;color:#1e293b;">
  <div style="max-width:560px;margin:auto;background:#fff;border-radius:20px;padding:40px;box-shadow:0 4px 20px rgba(0,0,0,.06);">
    <h1 style="margin:0;color:#1e293b;font-size:28px;">AVENTO</h1>
    <p style="color:#64748b;font-size:14px;margin:5px 0 0;">Event Management Platform</p>
    <hr style="border:0;border-top:1px solid #f1f5f9;margin:25px 0;">
    <h2 style="margin:0 0 10px;font-size:22px;color:#1e293b;">You're Invited to Join a Team!</h2>
    <p style="font-size:16px;color:#475569;line-height:1.6;">Hello ${name},</p>
    <p style="font-size:16px;color:#475569;line-height:1.6;">
      <strong>${team.name}</strong> has invited you to join their team for <strong>${event.title}</strong>.
    </p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 8px;font-size:14px;color:#64748b;"><strong>Event:</strong> ${event.title}</p>
      <p style="margin:0 0 8px;font-size:14px;color:#64748b;"><strong>Team:</strong> ${team.name}</p>
      ${event.date ? `<p style="margin:0 0 8px;font-size:14px;color:#64748b;"><strong>Date:</strong> ${new Date(event.date).toLocaleDateString()}</p>` : ''}
      ${event.venue ? `<p style="margin:0;font-size:14px;color:#64748b;"><strong>Venue:</strong> ${event.venue}</p>` : ''}
    </div>
    <p style="font-size:15px;color:#475569;line-height:1.6;">
      ${`Click the button below to sign up on Avento (if you haven't already) and accept this team invitation.`}
    </p>
    <div style="text-align:center;margin:30px 0;">
      <a href="${inviteUrl}" style="display:inline-block;padding:14px 32px;border-radius:12px;background:linear-gradient(135deg,#c084fc,#a78bfa);color:#fff;text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 4px 15px rgba(167,139,250,0.4);">Accept Invitation</a>
    </div>
    <p style="font-size:12px;color:#94a3b8;">This invitation expires in 7 days. If you did not expect this, you can safely ignore this email.</p>
    <hr style="border:0;border-top:1px solid #f1f5f9;margin:25px 0;">
    <p style="font-size:11px;color:#cbd5e1;text-align:center;">AVENTO - Smart Campus Event Management</p>
  </div>
</body>
</html>`;

    await sendEmailNotification({
      recipientEmail: emailLower,
      subject: `Team Invitation – ${event.title}`,
      htmlBody: inviteHtml
    });

    res.status(201).json({ message: `Invitation sent to ${emailLower}` });
  } catch (err) {
    console.error('Error inviting external member:', err);
    res.status(500).json({ message: 'Server error sending invitation.', error: err.message });
  }
};

// ─── GET TEAM EMAIL INVITES ───────────────────────────────────────────────
exports.getTeamInvites = async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    const { data: team } = await supabase.from('event_teams').select('leader_id').eq('id', teamId).single();
    if (!team || team.leader_id !== userId) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const { data: invites, error } = await supabase
      .from('team_email_invites')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(invites || []);
  } catch (err) {
    console.error('Error fetching team invites:', err);
    res.status(500).json({ message: 'Server error fetching invites.', error: err.message });
  }
};

// ─── REVOKE TEAM EMAIL INVITE ─────────────────────────────────────────────
exports.revokeTeamInvite = async (req, res) => {
  try {
    const { teamId, inviteId } = req.params;
    const userId = req.user.id;

    const { data: team } = await supabase.from('event_teams').select('leader_id').eq('id', teamId).single();
    if (!team || team.leader_id !== userId) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const { error } = await supabase
      .from('team_email_invites')
      .update({ status: 'cancelled' })
      .eq('id', inviteId)
      .eq('team_id', teamId);

    if (error) throw error;
    res.json({ message: 'Invitation revoked.' });
  } catch (err) {
    console.error('Error revoking invite:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// ─── ACCEPT INVITE BY TOKEN (for new + existing users) ────────────────────
exports.acceptInviteByToken = async (req, res) => {
  try {
    const { token } = req.params;
    const userId = req.user?.id;

    const { data: invite, error: inviteErr } = await supabase
      .from('team_email_invites')
      .select('*, events(id, title, date, venue, registration_deadline, registration_type), event_teams(id, name, leader_id, status)')
      .eq('invite_token', token)
      .maybeSingle();

    if (inviteErr || !invite) {
      return res.status(404).json({ message: 'Invalid or expired invitation.' });
    }

    if (invite.status !== 'pending') {
      return res.status(400).json({ message: `This invitation has already been ${invite.status}.` });
    }

    if (new Date(invite.expires_at) < new Date()) {
      await supabase.from('team_email_invites').update({ status: 'expired' }).eq('id', invite.id);
      return res.status(400).json({ message: 'This invitation has expired.' });
    }

    const event = invite.events;
    const team = invite.event_teams;

    if (event.registration_deadline && new Date() > new Date(event.registration_deadline)) {
      return res.status(400).json({ message: 'Registration deadline has passed.' });
    }

    if (team.status === 'registered') {
      return res.status(400).json({ message: 'This team is already confirmed.' });
    }

    if (!userId) {
      return res.status(200).json({
        requiresAuth: true,
        invite: {
          email: invite.email,
          name: invite.name,
          eventTitle: event.title,
          teamName: team.name,
          eventDate: event.date,
          eventVenue: event.venue
        }
      });
    }

    const { data: profile } = await supabase.from('profiles').select('id, email').eq('id', userId).maybeSingle();
    if (!profile || profile.email.toLowerCase() !== invite.email.toLowerCase()) {
      return res.status(403).json({ message: 'This invitation was sent to a different email address.' });
    }

    const { data: existingReg } = await supabase
      .from('event_registrations')
      .select('id, status, team_id')
      .eq('event_id', event.id)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingReg && existingReg.status === 'registered') {
      return res.status(400).json({ message: 'You already have an active registration for this event.' });
    }

    if (existingReg && existingReg.status === 'pending' && existingReg.team_id === team.id) {
      await supabase.from('team_email_invites').update({ status: 'accepted' }).eq('id', invite.id);
      return res.json({
        message: `You have joined team "${team.name}" for "${event.title}".`,
        teamName: team.name,
        eventTitle: event.title
      });
    }

    if (existingReg && existingReg.status === 'pending' && existingReg.team_id !== team.id) {
      return res.status(400).json({ message: 'You are already pending for another team in this event. Leave that team first.' });
    }

    const { error: regErr } = await supabase
      .from('event_registrations')
      .insert({
        user_id: userId,
        event_id: event.id,
        team_id: team.id,
        status: 'pending',
        created_at: new Date().toISOString()
      });

    if (regErr) {
      if (regErr.code === '23505') {
        await supabase.from('team_email_invites').update({ status: 'accepted' }).eq('id', invite.id);
        return res.json({
          message: `You have joined team "${team.name}" for "${event.title}".`,
          teamName: team.name,
          eventTitle: event.title
        });
      }
      throw regErr;
    }

    await supabase.from('team_email_invites').update({ status: 'accepted' }).eq('id', invite.id);

    res.json({
      message: `You have joined team "${team.name}" for "${event.title}".`,
      teamName: team.name,
      eventTitle: event.title
    });
  } catch (err) {
    console.error('Error accepting invite:', err);
    res.status(500).json({ message: 'Server error accepting invitation.', error: err.message });
  }
};

// ─── GET INVITE BY TOKEN (public, no auth required) ───────────────────────
exports.getInviteByToken = async (req, res) => {
  try {
    const { token } = req.params;

    const { data: invite, error } = await supabase
      .from('team_email_invites')
      .select('email, name, status, expires_at, events(title, date, venue), event_teams(name)')
      .eq('invite_token', token)
      .maybeSingle();

    if (error || !invite) {
      return res.status(404).json({ message: 'Invalid invitation.' });
    }

    res.json({
      email: invite.email,
      name: invite.name,
      status: invite.status,
      expiresAt: invite.expires_at,
      eventTitle: invite.events?.title,
      eventDate: invite.events?.date,
      eventVenue: invite.events?.venue,
      teamName: invite.event_teams?.name
    });
  } catch (err) {
    console.error('Error fetching invite:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};
