// server/controllers/eventController.js
const supabase = require('../config/supabaseClient');
const User = require('../models/User');
const { notifyUser } = require('../services/notificationService');

const cleanEventRemarks = (evt) => {
  if (!evt) return evt;
  if (evt.approval_remarks) {
    evt.approval_remarks = evt.approval_remarks.replace(/\n?\[Approved By: [a-f0-9-]+\]/gi, '');
  }
  if (evt.registered_count !== undefined) evt.registeredCount = evt.registered_count;
  if (evt.attendance_count !== undefined) evt.attendanceCount = evt.attendance_count;
  if (evt.image_url !== undefined) evt.imageUrl = evt.image_url;
  return evt;
};

/** GET /events */
const getEvents = async (req, res) => {
  try {
    const { search, status, category } = req.query;
    let query = supabase.from('events').select('*').order('date', { ascending: true });

    if (search) query = query.ilike('title', `%${search}%`);
    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);

    const { data: events, error } = await query;
    if (error) throw error;

    const mappedEvents = await Promise.all((events || []).map(async (evt) => {
      const { data: orgs } = await supabase
        .from('event_organizers')
        .select('student_id')
        .eq('event_id', evt.id);
      evt.organizerIds = (orgs || []).map(o => o.student_id);
      evt.organizersCount = evt.organizerIds.length;

      const { data: reqs } = await supabase
        .from('organizer_requests')
        .select('student_id, status, category')
        .eq('event_id', evt.id);
      evt.organizerRequests = (reqs || []).map(r => ({ studentId: r.student_id, status: r.status, category: r.category }));

      // Fetch proposer's name
      if (evt.proposed_by) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', evt.proposed_by)
          .maybeSingle();
        evt.proposerName = profile?.name || 'Unknown Proposer';
      } else {
        evt.proposerName = 'Administrator';
      }

      if (evt.registration_type === 'team') {
        const { count, error: teamCountErr } = await supabase
          .from('event_teams')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', evt.id);
        
        if (!teamCountErr) {
          evt.teamCount = count || 0;
        } else {
          evt.teamCount = 0;
        }
      }

      return cleanEventRemarks(evt);
    }));

    res.json(mappedEvents);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching events.', error: err.message });
  }
};

/** GET /events/organizer/my-events  ← MUST be before /:id */
const getMyEvents = async (req, res) => {
  try {
    let events = [];

    if (req.user.roles.includes('admin')) {
      const { data, error } = await supabase.from('events').select('*').order('date', { ascending: true });
      if (error) throw error;
      events = data || [];
    } else if (req.user.roles.includes('faculty') || req.user.roles.includes('faculty_organizer')) {
      const { data, error } = await supabase.from('events').select('*').eq('faculty_id', req.user.id).order('date', { ascending: true });
      if (error) throw error;
      events = data || [];
    } else if (req.user.roles.includes('student_organizer') || req.user.roles.includes('student')) {
      // 1. Fetch events proposed by the user
      const { data: proposedData, error: propErr } = await supabase
        .from('events')
        .select('*')
        .eq('proposed_by', req.user.id);
      if (propErr) throw propErr;

      // 2. Fetch events where user is an organizer
      const { data: orgs } = await supabase
        .from('event_organizers')
        .select('event_id')
        .eq('student_id', req.user.id);
        
      const eventIds = (orgs || []).map(o => o.event_id);
      let organizingData = [];
      
      if (eventIds.length > 0) {
        const { data: orgData, error: orgErr } = await supabase
          .from('events')
          .select('*')
          .in('id', eventIds);
        if (orgErr) throw orgErr;
        organizingData = orgData || [];
      }

      // Merge and deduplicate based on event id
      const allEvents = [...(proposedData || []), ...organizingData];
      const uniqueEventsMap = new Map();
      allEvents.forEach(e => uniqueEventsMap.set(e.id, e));
      events = Array.from(uniqueEventsMap.values());
      
      // Sort by date ascending
      events.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else {
      return res.status(403).json({ message: 'Access denied.' });
    }

    // For each event, fetch team members from event_members
    const eventsWithMembers = await Promise.all((events || []).map(async (evt) => {
      const { data: members } = await supabase
        .from('event_members')
        .select('*')
        .eq('event_id', evt.id);
      const { data: orgs } = await supabase
        .from('event_organizers')
        .select('student_id')
        .eq('event_id', evt.id);
      const uniqueOrganizerIds = new Set([
        ...(orgs || []).map(o => o.student_id),
        ...(members || []).map(m => m.user_id)
      ].filter(Boolean));
      evt.organizerIds = Array.from(uniqueOrganizerIds);
      evt.organizersCount = evt.organizerIds.length;

      const { data: reqs } = await supabase
        .from('organizer_requests')
        .select('student_id, status, category')
        .eq('event_id', evt.id);
      evt.organizerRequests = (reqs || []).map(r => ({ studentId: r.student_id, status: r.status, category: r.category }));

      return cleanEventRemarks({ ...evt, teamMembers: members || [] });
    }));

    res.json(eventsWithMembers);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching your events.', error: err.message });
  }
};

/** GET /events/:id */
const getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: event, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    // Faculty Coordinators can only view proposals assigned to them
    const isProposal = event.status !== 'published' && event.status !== 'active' && event.status !== 'completed' && event.status !== 'cancelled';
    if (isProposal && req.user && (req.user.roles.includes('faculty') || req.user.roles.includes('faculty_organizer')) && !req.user.roles.includes('admin')) {
      if (!event.faculty_id || event.faculty_id !== req.user.id) {
        return res.status(403).json({ message: 'Access denied. This proposal is not assigned to you.' });
      }
    }

    // Fetch team members
    const { data: members } = await supabase
      .from('event_members')
      .select('*')
      .eq('event_id', id);

    const { data: orgs } = await supabase
      .from('event_organizers')
      .select('student_id')
      .eq('event_id', id);
      
    // Combine unique organizer IDs from event_members and event_organizers
    const uniqueOrganizerIds = new Set([
      ...(orgs || []).map(o => o.student_id),
      ...(members || []).map(m => m.user_id)
    ].filter(Boolean));
    
    event.organizerIds = Array.from(uniqueOrganizerIds);
    event.organizersCount = event.organizerIds.length;

    const { data: reqs } = await supabase
      .from('organizer_requests')
      .select('student_id, status, category')
      .eq('event_id', id);
    event.organizerRequests = (reqs || []).map(r => ({ studentId: r.student_id, status: r.status, category: r.category }));

    // Fetch proposer's name
    if (event.proposed_by) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', event.proposed_by)
        .maybeSingle();
      event.proposerName = profile?.name || 'Unknown Proposer';
    } else {
      event.proposerName = 'Administrator';
    }

    if (event.registration_type === 'team') {
      const { count, error: teamCountErr } = await supabase
        .from('event_teams')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', id);
      
      if (!teamCountErr) {
        event.teamCount = count || 0;
      } else {
        event.teamCount = 0;
      }
    }

    res.json(cleanEventRemarks({ ...event, teamMembers: members || [] }));
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching event details.', error: err.message });
  }
};

/** POST /events — Create event or submit proposal */
const createEvent = async (req, res) => {
  try {
    const {
      title, description, category, venue, date, capacity, imageUrl, assignedFacultyId,
      registrationType, maxTeams, minTeamSize, maxTeamSize, allowCrossDepartment, teamLeaderRegistrationRequired,
      registrationDeadline
    } = req.body;

    if (!title || !description || !category || !venue || !date) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }
    
    if (registrationType !== 'team' && !capacity) {
      return res.status(400).json({ message: 'Capacity is required for individual events.' });
    }
    
    if (registrationType === 'team' && !maxTeams) {
      return res.status(400).json({ message: 'Number of teams allowed is required for team events.' });
    }

    if (date) {
      const selectedDate = new Date(date);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      if (selectedDate < tomorrow) {
        return res.status(400).json({ message: 'Event date must be at least one day in the future.' });
      }
    }
    
    if (registrationDeadline) {
      const deadlineDate = new Date(registrationDeadline);
      const eventDate = new Date(date);
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const maxDeadline = new Date(eventDate);
      maxDeadline.setDate(maxDeadline.getDate() - 1);
      maxDeadline.setHours(23, 59, 59, 999);

      if (deadlineDate < tomorrow) {
        return res.status(400).json({ message: 'Registration Closing Date must be at least tomorrow.' });
      }
      if (deadlineDate > maxDeadline) {
        return res.status(400).json({ message: 'Registration Closing Date must be at least one day before the Event Date.' });
      }
    }

    const isStudent = (req.user.roles.includes('student') || req.user.roles.includes('student_organizer')) &&
                      !req.user.roles.includes('admin') &&
                      !req.user.roles.includes('faculty');

    if (!isStudent) {
      return res.status(403).json({ message: 'Access denied. Only students are authorized to create event proposals.' });
    }

    // Students and student organizers MUST select a faculty coordinator
    if (!assignedFacultyId) {
      return res.status(400).json({ message: 'Please select a Faculty Coordinator for your event proposal.' });
    }

    // Verify assigned faculty exists and has faculty role
    if (assignedFacultyId) {
      const { data: faculty, error: facErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', assignedFacultyId)
        .maybeSingle();
      if (facErr || !faculty || faculty.role !== 'faculty') {
        return res.status(400).json({ message: 'Invalid Faculty Coordinator selected.' });
      }
    }

    // Prevent duplicate proposals for same event name + date by same student
    const { data: existingDups, error: dupErr } = await supabase
      .from('events')
      .select('id')
      .eq('proposed_by', req.user.id)
      .eq('date', date)
      .ilike('title', title);
    
    if (dupErr) throw dupErr;
    if (existingDups && existingDups.length > 0) {
      return res.status(400).json({ message: 'An event proposal with the same name and date has already been submitted by you.' });
    }

    let status = 'pending_approval';
    let proposedBy = req.user.id;
    let facultyId = assignedFacultyId;
    let organizerId = null;

    const newEvent = {
      title,
      description,
      category,
      venue,
      date,
      capacity: registrationType === 'team' ? null : Number(capacity),
      registered_count: 0,
      attendance_count: 0,
      image_url: imageUrl || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800',
      created_by: req.user.id,
      status,
      created_at: new Date().toISOString(),
      registration_type: registrationType || 'individual',
      max_teams: registrationType === 'team' ? (maxTeams ? Number(maxTeams) : 1) : null,
      min_team_size: minTeamSize ? Number(minTeamSize) : 1,
      max_team_size: maxTeamSize ? Number(maxTeamSize) : 1,
      allow_cross_department: allowCrossDepartment !== undefined ? allowCrossDepartment : true,
      team_leader_registration_required: teamLeaderRegistrationRequired !== undefined ? teamLeaderRegistrationRequired : true,
      registration_deadline: registrationDeadline || null,
      join_team_enabled: false,
    };

    if (proposedBy) newEvent.proposed_by = proposedBy;
    if (facultyId) newEvent.faculty_id = facultyId;
    if (organizerId) newEvent.organizer_id = organizerId;

    const { data: event, error } = await supabase.from('events').insert(newEvent).select().single();
    if (error) throw error;

    // Log timeline event for new proposal
    await supabase.from('proposal_timeline').insert({
      proposal_id: event.id,
      user_id: req.user.id,
      action: 'Proposal Submitted',
      details: 'Initial proposal submitted for review.'
    });

    // Make the creator the primary student organizer and auto-add to event_members
    const { error: memberErr } = await supabase.from('event_members').insert({
      event_id: event.id,
      user_id: req.user.id,
      role: 'organizer'
    });

    if (facultyId) {
      // Automatically add the Faculty Coordinator to the proposal team as a Core Organizer
      await supabase.from('event_members').insert({
        event_id: event.id,
        user_id: facultyId,
        role: 'Faculty Coordinator'
      });

      // Notify assigned faculty
      try {
        let organizerName = 'Student';
        let coordinatorName = 'Faculty Coordinator';
        const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', [proposedBy, facultyId].filter(Boolean));
        if (profiles) {
          const orgProfile = profiles.find(p => p.id === proposedBy);
          const facProfile = profiles.find(p => p.id === facultyId);
          if (orgProfile) organizerName = orgProfile.name;
          if (facProfile) coordinatorName = facProfile.name;
        }

        await notifyUser({
          recipientId: facultyId,
          title: 'New Event Proposal Submitted',
          message: `A new event proposal "${event.title}" has been submitted for your approval.`,
          type: 'info',
          eventId: event.id,
          emailSubject: 'New Event Approval Request',
          emailData: {
            eventName: event.title,
            organizer: organizerName,
            facultyCoordinatorName: coordinatorName,
            category: event.category || 'N/A',
            proposedDate: new Date(event.date).toLocaleDateString(),
            venue: event.venue || 'TBA',
            submissionTime: new Date().toLocaleString(),
            status: 'Pending Review'
          }
        });
      } catch (notifErr) {
        console.error('Non-fatal error sending new proposal notification:', notifErr.message);
      }
    }

    res.status(201).json(event);
  } catch (err) {
    console.error('createEvent error:', err.message);
    res.status(500).json({ message: 'Server error creating event.', error: err.message });
  }
};

/** PUT /events/:id */
const editEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, description, category, venue, date, capacity, imageUrl, status, assignedFacultyId,
      registrationType, maxTeams, minTeamSize, maxTeamSize, allowCrossDepartment, teamLeaderRegistrationRequired,
      registrationDeadline
    } = req.body;

    const { data: event, error: fetchErr } = await supabase
      .from('events').select('*').eq('id', id).single();
    if (fetchErr || !event) return res.status(404).json({ message: 'Event not found.' });

    const isStudent = req.user.roles.includes('student') &&
                      !req.user.roles.includes('admin') &&
                      !req.user.roles.includes('faculty');

    // Faculty members must NOT be able to modify proposal content
    if ((req.user.roles.includes('faculty') || req.user.roles.includes('faculty_organizer')) && !req.user.roles.includes('admin')) {
      return res.status(403).json({ message: 'Faculty members are not authorized to modify proposal content.' });
    }

    if (date !== undefined) {
      const selectedDate = new Date(date);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      if (selectedDate < tomorrow) {
        return res.status(400).json({ message: 'Event date must be at least one day in the future.' });
      }
    }

    if (!req.user.roles.includes('admin')) {
      const isOwner =
        event.organizer_id === req.user.id ||
        event.student_organizer_id === req.user.id ||
        event.proposed_by === req.user.id;
      if (!isOwner) {
        return res.status(403).json({ message: 'Access denied. You can only edit your own events.' });
      }
    }

    // Students must be allowed to edit their proposals only if status is submitted or rejected
    if (isStudent) {
      if (event.status !== 'submitted' && event.status !== 'rejected') {
        return res.status(400).json({ message: 'You can only edit proposals that are submitted or rejected.' });
      }
    }

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (venue !== undefined) updates.venue = venue;
    if (date !== undefined) updates.date = date;
    if (capacity !== undefined && registrationType !== 'team') updates.capacity = Number(capacity);
    if (registrationType === 'team') updates.capacity = null;
    if (imageUrl !== undefined) updates.image_url = imageUrl;
    if (registrationType !== undefined) updates.registration_type = registrationType;
    if (maxTeams !== undefined) updates.max_teams = Number(maxTeams);
    if (minTeamSize !== undefined) updates.min_team_size = Number(minTeamSize);
    if (maxTeamSize !== undefined) updates.max_team_size = Number(maxTeamSize);
    if (allowCrossDepartment !== undefined) updates.allow_cross_department = allowCrossDepartment;
    if (teamLeaderRegistrationRequired !== undefined) updates.team_leader_registration_required = teamLeaderRegistrationRequired;
    if (registrationDeadline !== undefined) {
      if (registrationDeadline) {
        const deadlineDate = new Date(registrationDeadline);
        const eventDate = new Date(date || event.date);
        
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const maxDeadline = new Date(eventDate);
        maxDeadline.setDate(maxDeadline.getDate() - 1);
        maxDeadline.setHours(23, 59, 59, 999);

        if (deadlineDate < tomorrow) {
          return res.status(400).json({ message: 'Registration Closing Date must be at least tomorrow.' });
        }
        if (deadlineDate > maxDeadline) {
          return res.status(400).json({ message: 'Registration Closing Date must be at least one day before the Event Date.' });
        }
      }
      updates.registration_deadline = registrationDeadline || null;
    }

    if (assignedFacultyId !== undefined) {
      // Verify assigned faculty exists and has faculty role
      const { data: faculty, error: facErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', assignedFacultyId)
        .maybeSingle();
      if (facErr || !faculty || faculty.role !== 'faculty') {
        return res.status(400).json({ message: 'Invalid Faculty Coordinator selected.' });
      }
      updates.faculty_id = assignedFacultyId;
    }

    // Prevent duplicate proposals for same event name + date by same student (excluding current event)
    if (isStudent) {
      const checkTitle = title !== undefined ? title : event.title;
      const checkDate = date !== undefined ? date : event.date;
      
      const { data: existingDups, error: dupErr } = await supabase
        .from('events')
        .select('id')
        .eq('proposed_by', req.user.id)
        .eq('date', checkDate)
        .ilike('title', checkTitle)
        .neq('id', id);

      if (dupErr) throw dupErr;
      if (existingDups && existingDups.length > 0) {
        return res.status(400).json({ message: 'An event proposal with the same name and date has already been submitted by you.' });
      }

      // If a student edits ANY field, reset status to pending_approval and clear remarks
      updates.status = 'pending_approval';
      updates.approval_remarks = null;
    } else if (req.user.roles.includes('admin') && status !== undefined) {
      if (status === 'published') {
        if (event.status !== 'approved') {
          return res.status(400).json({ message: 'Event must be approved by the assigned Faculty Coordinator before publishing.' });
        }
        const expectedTag = `[Approved By: ${event.faculty_id}]`;
        if (!event.approval_remarks || !event.approval_remarks.includes(expectedTag)) {
          return res.status(400).json({ message: 'This event has not been approved by the assigned Faculty Coordinator.' });
        }
      }
      updates.status = status;
    }

    const { data: updatedEvent, error: updateErr } = await supabase
      .from('events').update(updates).eq('id', id).select().single();
    if (updateErr) throw updateErr;

    res.json(updatedEvent);
  } catch (err) {
    res.status(500).json({ message: 'Server error updating event.', error: err.message });
  }
};

/** PATCH /events/:id/status — Faculty approval workflow */
const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, approvalRemarks } = req.body;

    const { data: event, error } = await supabase
      .from('events').select('*').eq('id', id).single();
    if (error || !event) return res.status(404).json({ message: 'Event not found.' });

    const isFaculty = req.user.roles.includes('faculty') || req.user.roles.includes('faculty_organizer');
    const isAdmin = req.user.roles.includes('admin');

    if (status === 'approved' || status === 'rejected') {
      // Must be faculty only (specifically, the assigned faculty)
      if (!isFaculty) {
        return res.status(403).json({ message: 'Access denied. Only the assigned Faculty Coordinator can approve or reject proposals.' });
      }
      if (!event.faculty_id || event.faculty_id !== req.user.id) {
        return res.status(403).json({ message: 'This proposal is not assigned to you.' });
      }

      if (status === 'approved') {
        const approvalRemarksStr = approvalRemarks || '';
        const signature = `[Approved By: ${req.user.id}]`;
        const finalRemarks = approvalRemarksStr ? `${approvalRemarksStr}\n${signature}` : signature;

        const approvalUpdates = {
          status: 'approved',
          approval_remarks: finalRemarks,
          organizer_id: event.proposed_by || null,
          student_organizer_id: event.proposed_by || null,
          approved_at: new Date().toISOString(),
        };
        const { error: appErr } = await supabase.from('events').update(approvalUpdates).eq('id', id);
        if (appErr) throw appErr;

        if (event.proposed_by) {
          try {
            let coordinatorName = 'Faculty Coordinator';
            const { data: fc } = await supabase.from('profiles').select('name').eq('id', req.user.id).single();
            if (fc) coordinatorName = fc.name;

            await notifyUser({
              recipientId: event.proposed_by,
              title: 'Event Approved',
              message: `Your event "${event.title}" has been approved successfully.`,
              type: 'success',
              eventId: event.id,
              emailSubject: 'Your Event Has Been Approved',
              emailData: {
                eventName: event.title,
                facultyCoordinatorName: coordinatorName,
                date: new Date(event.date).toLocaleDateString(),
                venue: event.venue || 'TBA',
                status: 'Approved',
                nextSteps: "Your event is now approved. You can proceed to publish it and manage registrations via your organizer dashboard."
              }
            });
          } catch (notifErr) {
            console.error('Non-fatal error sending event approval notification:', notifErr.message);
          }
        }

        // Insert proposer into event_organizers on approval if not already present
        if (event.proposed_by) {
          const { data: existingHead } = await supabase
            .from('event_organizers')
            .select('*')
            .eq('event_id', id)
            .eq('student_id', event.proposed_by)
            .maybeSingle();

          if (!existingHead) {
            const { error: insertErr } = await supabase
              .from('event_organizers')
              .insert({
                event_id: id,
                student_id: event.proposed_by,
                category: 'Event Head',
                joined_at: new Date().toISOString()
              });
            if (insertErr) throw insertErr;
          }

          // Update proposer's role to 'organizer' in both Supabase and MongoDB if they are currently 'student'
          const { data: proposer } = await supabase.from('profiles').select('role').eq('id', event.proposed_by).maybeSingle();
          if (proposer && proposer.role === 'student') {
            await supabase.from('profiles').update({ role: 'organizer' }).eq('id', event.proposed_by);
            await User.findByIdAndUpdate(event.proposed_by, { role: 'organizer' });
          }
        }
      } else {
        // rejected
        const { error: rejErr } = await supabase.from('events').update({
          status: 'rejected',
          approval_remarks: approvalRemarks || '',
        }).eq('id', id);
        if (rejErr) throw rejErr;

        if (event.proposed_by) {
          try {
            await notifyUser({
              recipientId: event.proposed_by,
              title: 'Event Rejected',
              message: `Your event "${event.title}" has been rejected. Remarks: ${approvalRemarks || 'None'}`,
              type: 'error',
              eventId: event.id,
              emailSubject: 'Event Proposal Update',
              emailData: {
                eventName: event.title,
                status: 'Rejected'
              }
            });
          } catch (notifErr) {
            console.error('Non-fatal error sending event rejection notification:', notifErr.message);
          }
        }
      }

    } else if (status === 'published') {
      // Must be admin only + status must be approved
      if (!isAdmin) {
        return res.status(403).json({ message: 'Access denied. Only administrators are authorized to publish events.' });
      }
      if (event.status !== 'approved') {
        return res.status(400).json({ message: 'Event must be approved by the assigned Faculty Coordinator before publishing.' });
      }

      // Verify strict approval signature
      const expectedTag = `[Approved By: ${event.faculty_id}]`;
      if (!event.approval_remarks || !event.approval_remarks.includes(expectedTag)) {
        return res.status(400).json({ message: 'This event has not been approved by the assigned Faculty Coordinator.' });
      }

      const { error: pubErr } = await supabase.from('events').update({ status: 'published' }).eq('id', id);
      if (pubErr) throw pubErr;

    } else if (status === 'completed') {
      // Allow Admin, Faculty Coordinator, and Event Head
      const isEventHead = req.user.id === event.student_organizer_id || req.user.id === event.proposed_by || req.user.id === event.organizer_id;
      if (!isAdmin && (!isFaculty || event.faculty_id !== req.user.id) && !isEventHead) {
        return res.status(403).json({ message: 'Access denied. Only Admins, assigned Faculty Coordinators, or Event Heads can mark an event as completed.' });
      }

      const { error: compErr } = await supabase.from('events').update({ status: 'completed' }).eq('id', id);
      if (compErr) throw compErr;

    } else {
      // Any other status changes (like cancelling events)
      if (!isAdmin) {
        return res.status(403).json({ message: 'Access denied.' });
      }
      const { error: otherErr } = await supabase.from('events').update({ status }).eq('id', id);
      if (otherErr) throw otherErr;
    }

    const { data: updated, error: finalErr } = await supabase
      .from('events').select('*').eq('id', id).single();
    if (finalErr) throw finalErr;

    // Clean internal tags from the response object
    if (updated.approval_remarks) {
      updated.approval_remarks = updated.approval_remarks.replace(/\n?\[Approved By: [a-f0-9-]+\]/gi, '');
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error updating status.', error: err.message });
  }
};

/** DELETE /events/:id */
const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: event, error } = await supabase
      .from('events').select('*').eq('id', id).single();
    if (error || !event) return res.status(404).json({ message: 'Event not found.' });

    if (!req.user.roles.includes('admin')) {
      const isOwner =
        event.organizer_id === req.user.id ||
        event.student_organizer_id === req.user.id ||
        event.proposed_by === req.user.id;
      if (!isOwner) {
        return res.status(403).json({ message: 'Access denied. You can only delete your own events.' });
      }
    }

    await supabase.from('event_members').delete().eq('event_id', id);
    await supabase.from('event_registrations').delete().eq('event_id', id);
    await supabase.from('events').delete().eq('id', id);

    res.json({ message: 'Event deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error deleting event.', error: err.message });
  }
};

/** GET /events/:id/analytics */
const getEventAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: event, error } = await supabase
      .from('events').select('*').eq('id', id).single();
    if (error || !event) return res.status(404).json({ message: 'Event not found.' });

    if (!req.user.roles.includes('admin')) {
      const isOwner =
        event.organizer_id === req.user.id ||
        event.student_organizer_id === req.user.id ||
        event.faculty_id === req.user.id;
      if (!isOwner) return res.status(403).json({ message: 'Access denied.' });
    }

    const { data: registrations } = await supabase
      .from('event_registrations').select('*').eq('event_id', id);

    const regs = registrations || [];
    const attendedCount = regs.filter(r => r.status === 'attended').length;
    const total = regs.length;
    const fillRate = event.capacity > 0 ? Math.min(100, Math.round((total / event.capacity) * 100)) : 0;
    const attendanceRate = total > 0 ? Math.round((attendedCount / total) * 100) : 0;

    res.json({
      totalRegistrations: total,
      attendanceCount: attendedCount,
      capacity: event.capacity,
      fillRate,
      attendanceRate,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching analytics.', error: err.message });
  }
};

/** POST /events/:id/team-members */
const addTeamMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, name, rollNumber, email, responsibility } = req.body;
    if (!name) return res.status(400).json({ message: 'Member name is required.' });

    const { data: event, error } = await supabase
      .from('events').select('organizer_id, student_organizer_id, proposed_by').eq('id', id).single();
    if (error || !event) return res.status(404).json({ message: 'Event not found.' });

    const isOrganizer =
      event.organizer_id === req.user.id ||
      event.student_organizer_id === req.user.id;

    if (!isOrganizer && !req.user.roles.includes('admin')) {
      return res.status(403).json({ message: 'Only the event organizer can manage team members.' });
    }

    if (userId && String(userId) === String(req.user.id)) {
      return res.status(400).json({ message: 'You are already the organizer of this event.' });
    }

    const member = {
      event_id: id,
      user_id: userId || null,
      role: responsibility || 'Volunteer',
    };

    const { error: insertErr } = await supabase.from('event_members').insert(member);
    if (insertErr) throw insertErr;

    const { data: members } = await supabase
      .from('event_members').select('*').eq('event_id', id);

    res.status(201).json({ message: 'Team member added successfully.', teamMembers: members || [] });
  } catch (err) {
    res.status(500).json({ message: 'Server error adding team member.', error: err.message });
  }
};

/** DELETE /events/:id/team-members/:memberId */
const removeTeamMember = async (req, res) => {
  try {
    const { id, memberId } = req.params;

    const { data: event, error } = await supabase
      .from('events').select('organizer_id, student_organizer_id').eq('id', id).single();
    if (error || !event) return res.status(404).json({ message: 'Event not found.' });

    const isOrganizer =
      event.organizer_id === req.user.id ||
      event.student_organizer_id === req.user.id;

    if (!isOrganizer && !req.user.roles.includes('admin')) {
      return res.status(403).json({ message: 'Only the event organizer can manage team members.' });
    }

    // Organizer Protection Rule
    if (String(memberId) === String(event.student_organizer_id)) {
        return res.status(403).json({
            message: "The Event Head who submitted the proposal cannot be removed."
        });
    }

    const { error: delErr } = await supabase
      .from('event_members').delete().eq('id', memberId).eq('event_id', id);
    if (delErr) throw delErr;

    const { data: members } = await supabase
      .from('event_members').select('*').eq('event_id', id);

    res.json({ message: 'Team member removed successfully.', teamMembers: members || [] });
  } catch (err) {
    res.status(500).json({ message: 'Server error removing team member.', error: err.message });
  }
};

/** PUT /events/:id/publish */
const publishEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: event, error: fetchErr } = await supabase
      .from('events').select('*').eq('id', id).single();
    if (fetchErr || !event) return res.status(404).json({ message: 'Event not found.' });

    if (event.status !== 'approved') {
      return res.status(400).json({ message: 'Only approved events can be published.' });
    }

    // Only proposal owner can publish
    const isOwner = event.proposed_by === req.user.id;
    if (!isOwner) {
      return res.status(403).json({ message: 'Only the event proposal owner is authorized to publish this event.' });
    }

    const updates = {
      status: 'published',
      published_at: new Date().toISOString(),
      published_by: req.user.id
    };

    const { data: updated, error: updateErr } = await supabase
      .from('events').update(updates).eq('id', id).select().single();
    if (updateErr) throw updateErr;

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error publishing event.', error: err.message });
  }
};

/** GET /events/:id/organizers */
const getEventOrganizers = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Fetch from event_organizers
    const { data: organizers, error: orgErr } = await supabase
      .from('event_organizers')
      .select('*')
      .eq('event_id', id);
    if (orgErr) throw orgErr;

    // Fetch from event_members
    const { data: members, error: memErr } = await supabase
      .from('event_members')
      .select('*')
      .eq('event_id', id);
    if (memErr) throw memErr;

    // Combine unique user IDs
    const userIds = new Set([
      ...(organizers || []).map(o => o.student_id),
      ...(members || []).map(m => m.user_id)
    ].filter(Boolean));

    // Fetch profiles
    let profilesMap = {};
    if (userIds.size > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, email, department')
        .in('id', Array.from(userIds));
      profilesMap = (profilesData || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
    }

    // Map organizers
    const unifiedMap = new Map();

    (members || []).forEach(m => {
      if (!unifiedMap.has(m.user_id)) {
        unifiedMap.set(m.user_id, {
          id: `mem-${m.id}`,
          userId: m.user_id,
          category: m.role || 'Core Organizer',
          joinedAt: new Date().toISOString(), // Fallback
          name: profilesMap[m.user_id]?.name || 'Unknown',
          email: profilesMap[m.user_id]?.email || '',
          department: profilesMap[m.user_id]?.department || ''
        });
      }
    });

    (organizers || []).forEach(org => {
      if (!unifiedMap.has(org.student_id)) {
        unifiedMap.set(org.student_id, {
          id: org.id,
          userId: org.student_id,
          category: org.category,
          joinedAt: org.joined_at,
          name: profilesMap[org.student_id]?.name || 'Unknown Student',
          email: profilesMap[org.student_id]?.email || '',
          department: profilesMap[org.student_id]?.department || ''
        });
      }
    });

    res.json(Array.from(unifiedMap.values()));
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching event organizers.', error: err.message });
  }
};

/** POST /events/:id/organizers */
const recruitOrganizer = async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId, category } = req.body;

    if (!studentId || !category) {
      return res.status(400).json({ message: 'Student ID and Category are required.' });
    }

    const validCategories = [
      'Event Head',
      'Technical Team',
      'Design Team',
      'Media Team',
      'Hospitality Team',
      'Logistics Team',
      'Volunteer',
      'Other'
    ];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ message: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
    }

    // Get event
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (eventErr || !event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    // Enforce owner authorization: only proposer or student_organizer can recruit
    const isOwner = String(event.proposed_by) === String(req.user.id) ||
                    String(event.student_organizer_id) === String(req.user.id) ||
                    String(event.organizer_id) === String(req.user.id);
    
    const isAdmin = req.user.roles.includes('admin');
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Only the event owner is authorized to manage organizers.' });
    }

    // Check if student exists in Supabase profiles
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', studentId)
      .maybeSingle();

    if (profErr || !profile) {
      return res.status(404).json({ message: 'Student profile not found.' });
    }

    // Verify profile is indeed student or student_organizer
    if (profile.role !== 'student' && profile.role !== 'student_organizer') {
      return res.status(400).json({ message: 'Only students can be recruited as event organizers.' });
    }

    // Check if already recruited
    const { data: existing, error: existErr } = await supabase
      .from('event_organizers')
      .select('*')
      .eq('event_id', id)
      .eq('student_id', studentId)
      .maybeSingle();

    if (existErr) throw existErr;
    if (existing) {
      return res.status(400).json({ message: 'This student is already an organizer for this event.' });
    }

    // Rule 2: Verify student is not already participating as a team member
    const { data: existingReg, error: regErr } = await supabase
      .from('event_registrations')
      .select('id')
      .eq('event_id', id)
      .eq('user_id', studentId)
      .maybeSingle();

    if (regErr) throw regErr;
    if (existingReg) {
      return res.status(400).json({ message: 'You are already participating as a team member for this event and cannot become an organizer or volunteer.' });
    }

    // Insert into event_organizers
    const newOrg = {
      event_id: id,
      student_id: studentId,
      category: category,
      joined_at: new Date().toISOString()
    };

    const { data: inserted, error: insertErr } = await supabase
      .from('event_organizers')
      .insert(newOrg)
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Note: Global roles are not updated; roles are computed dynamically in authMiddleware.

    res.status(201).json({
      message: 'Student recruited successfully as organizer.',
      organizer: {
        id: inserted.id,
        userId: inserted.student_id,
        category: inserted.category,
        joinedAt: inserted.joined_at,
        name: profile.name || profile.fullName,
        email: profile.email,
        department: profile.department
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error recruiting organizer.', error: err.message });
  }
};

/** DELETE /events/:id/organizers/:studentId */
const removeOrganizer = async (req, res) => {
  try {
    const { id, studentId } = req.params;

    // Get event
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (eventErr || !event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    // Enforce owner authorization
    const isOwner = String(event.proposed_by) === String(req.user.id) ||
                    String(event.student_organizer_id) === String(req.user.id) ||
                    String(event.organizer_id) === String(req.user.id);
    
    const isAdmin = req.user.roles.includes('admin');
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Only the event owner is authorized to manage organizers.' });
    }

    // Organizer Protection Rule
    if (String(studentId) === String(event.student_organizer_id)) {
        return res.status(403).json({
            message: "The Event Head who submitted the proposal cannot be removed."
        });
    }

    // Check if the organizer is indeed on the event team
    const { data: org, error: orgErr } = await supabase
      .from('event_organizers')
      .select('*')
      .eq('event_id', id)
      .eq('student_id', studentId)
      .maybeSingle();

    if (orgErr || !org) {
      return res.status(404).json({ message: 'Organizer record not found for this student.' });
    }

    // Delete organizer record
    const { error: delErr } = await supabase
      .from('event_organizers')
      .delete()
      .eq('event_id', id)
      .eq('student_id', studentId);

    if (delErr) throw delErr;

    // Note: Global roles are not updated; roles are computed dynamically in authMiddleware.

    res.json({ message: 'Organizer removed successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error removing organizer.', error: err.message });
  }
};


const toggleJoinTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const { joinTeamEnabled } = req.body;

    const { data: event, error: fetchErr } = await supabase
      .from('events').select('*').eq('id', id).single();
    if (fetchErr || !event) return res.status(404).json({ message: 'Event not found.' });

    // Auth check
    const isOwner = String(event.proposed_by) === String(req.user.id) ||
                    String(event.student_organizer_id) === String(req.user.id) ||
                    String(event.organizer_id) === String(req.user.id);
    const isAdmin = req.user.roles.includes('admin');
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Only the event owner is authorized to toggle join requests.' });
    }

    const { data: updated, error: updateErr } = await supabase
      .from('events')
      .update({ join_team_enabled: joinTeamEnabled })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    res.json({ message: 'Join team setting updated successfully.', event: cleanEventRemarks(updated) });
  } catch (err) {
    res.status(500).json({ message: 'Server error updating join team setting.', error: err.message });
  }
};

const submitOrganizerRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { category } = req.body;
    const studentId = req.user.id;

    if (!category) {
      return res.status(400).json({ message: 'Category is required.' });
    }

    const validCategories = [
      'Event Head',
      'Technical Team',
      'Design Team',
      'Media Team',
      'Hospitality Team',
      'Logistics Team',
      'Volunteer',
      'Other'
    ];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ message: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
    }

    // Get event
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (eventErr || !event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    // Enforce join_team_enabled
    if (!event.join_team_enabled) {
      return res.status(400).json({ message: 'Join requests are not enabled for this event.' });
    }

    // Verify student is not already an organizer
    const isProposer = String(event.proposed_by) === String(studentId) ||
                       String(event.student_organizer_id) === String(studentId) ||
                       String(event.organizer_id) === String(studentId);
    
    const { data: existingOrg } = await supabase
      .from('event_organizers')
      .select('*')
      .eq('event_id', id)
      .eq('student_id', studentId)
      .maybeSingle();

    if (isProposer || existingOrg) {
      return res.status(400).json({ message: 'You are already on the organizing team.' });
    }

    // Rule 2: Verify student is not already participating as a team member
    const { data: existingReg, error: regErr } = await supabase
      .from('event_registrations')
      .select('id')
      .eq('event_id', id)
      .eq('user_id', studentId)
      .maybeSingle();

    if (regErr) throw regErr;
    if (existingReg) {
      return res.status(400).json({ message: 'You are already participating as a team member for this event and cannot become an organizer or volunteer.' });
    }

    // Enforce role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', studentId)
      .maybeSingle();

    if (!profile || (profile.role !== 'student' && profile.role !== 'student_organizer')) {
      return res.status(400).json({ message: 'Only students are allowed to submit join requests.' });
    }

    // Insert/update request
    const { data: existingRequest } = await supabase
      .from('organizer_requests')
      .select('*')
      .eq('event_id', id)
      .eq('student_id', studentId)
      .maybeSingle();

    let result;
    if (existingRequest) {
      if (existingRequest.status === 'pending' || existingRequest.status === 'approved') {
        return res.status(400).json({ message: 'You already have a pending or approved request for this event.' });
      }
      const { data: updatedReq, error: updateErr } = await supabase
        .from('organizer_requests')
        .update({
          category,
          status: 'pending',
          requested_at: new Date().toISOString()
        })
        .eq('id', existingRequest.id)
        .select()
        .single();
      if (updateErr) throw updateErr;
      result = updatedReq;
    } else {
      const newReq = {
        event_id: id,
        student_id: studentId,
        category,
        status: 'pending',
        requested_at: new Date().toISOString()
      };
      const { data: insertedReq, error: insertErr } = await supabase
        .from('organizer_requests')
        .insert(newReq)
        .select()
        .single();
      if (insertErr) throw insertErr;
      result = insertedReq;
    }

    res.status(201).json({ message: 'Join request submitted successfully.', request: result });
  } catch (err) {
    res.status(500).json({ message: 'Server error submitting join request.', error: err.message });
  }
};

const getOrganizerRequests = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (eventErr || !event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    // Auth check
    const isOwner = String(event.proposed_by) === String(req.user.id) ||
                    String(event.student_organizer_id) === String(req.user.id) ||
                    String(event.organizer_id) === String(req.user.id);
    const isAdmin = req.user.roles.includes('admin');
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Only the event owner is authorized to view join requests.' });
    }

    const { data: requests, error } = await supabase
      .from('organizer_requests')
      .select('*')
      .eq('event_id', id);
    if (error) throw error;

    const requestsWithProfiles = await Promise.all((requests || []).map(async (r) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, email, department')
        .eq('id', r.student_id)
        .maybeSingle();
      return {
        id: r.id,
        eventId: r.event_id,
        studentId: r.student_id,
        category: r.category,
        status: r.status,
        requestedAt: r.requested_at,
        name: profile?.name || 'Unknown Student',
        email: profile?.email || '',
        department: profile?.department || ''
      };
    }));

    res.json(requestsWithProfiles);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching join requests.', error: err.message });
  }
};

const processJoinRequest = async (req, res) => {
  try {
    const { id: eventId, requestId } = req.params;
    const { status } = req.body;

    if (!status || (status !== 'approved' && status !== 'rejected')) {
      return res.status(400).json({ message: 'Status is required and must be either "approved" or "rejected".' });
    }

    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle();

    if (eventErr || !event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    // Auth check
    const isOwner = String(event.proposed_by) === String(req.user.id) ||
                    String(event.student_organizer_id) === String(req.user.id) ||
                    String(event.organizer_id) === String(req.user.id);
    const isAdmin = req.user.roles.includes('admin');
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Only the event owner is authorized to manage join requests.' });
    }

    const { data: request, error: reqErr } = await supabase
      .from('organizer_requests')
      .select('*')
      .eq('id', requestId)
      .eq('event_id', eventId)
      .maybeSingle();

    if (reqErr || !request) {
      return res.status(404).json({ message: 'Join request not found.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: `This request has already been ${request.status}.` });
    }

    if (status === 'approved') {
      const { data: existingOrg } = await supabase
        .from('event_organizers')
        .select('*')
        .eq('event_id', eventId)
        .eq('student_id', request.student_id)
        .maybeSingle();

      if (!existingOrg) {
        const { error: insertErr } = await supabase
          .from('event_organizers')
          .insert({
            event_id: eventId,
            student_id: request.student_id,
            category: request.category,
            joined_at: new Date().toISOString()
          });
        if (insertErr) throw insertErr;

        // Note: Global roles are not updated; roles are computed dynamically in authMiddleware.
      }
    }

    const { data: updatedRequest, error: updateErr } = await supabase
      .from('organizer_requests')
      .update({ status })
      .eq('id', requestId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    res.json({ message: `Request successfully ${status}.`, request: updatedRequest });
  } catch (err) {
    res.status(500).json({ message: 'Server error processing join request.', error: err.message });
  }
};

const withdrawEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Fetch event
    const { data: event, error: fetchErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    // Auth check: only proposal owner can withdraw
    if (String(event.proposed_by) !== String(userId)) {
      return res.status(403).json({ message: 'Only the proposal owner is authorized to withdraw this proposal.' });
    }

    // Status check
    if (event.status === 'approved' || event.status === 'published' || event.status === 'completed' || event.status === 'cancelled') {
      return res.status(400).json({ message: 'Approved, published or inactive events cannot be withdrawn.' });
    }

    // Update status to 'withdrawn'
    const { data: updatedEvent, error: updateErr } = await supabase
      .from('events')
      .update({ status: 'withdrawn' })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    res.json({ message: 'Proposal withdrawn successfully.', event: cleanEventRemarks(updatedEvent) });
  } catch (err) {
    res.status(500).json({ message: 'Server error withdrawing proposal.', error: err.message });
  }
};

const getMyOrganizerRequests = async (req, res) => {
  try {
    const studentId = req.user.id;

    const { data: requests, error } = await supabase
      .from('organizer_requests')
      .select('*')
      .eq('student_id', studentId);

    if (error) throw error;

    const requestsWithEvents = await Promise.all((requests || []).map(async (r) => {
      const { data: event } = await supabase
        .from('events')
        .select('title, category, date, venue, status')
        .eq('id', r.event_id)
        .maybeSingle();

      return {
        id: r.id,
        eventId: r.event_id,
        studentId: r.student_id,
        category: r.category,
        status: r.status,
        requestedAt: r.requested_at,
        eventTitle: event?.title || 'Unknown Event',
        eventCategory: event?.category || '',
        eventDate: event?.date || '',
        eventVenue: event?.venue || '',
        eventStatus: event?.status || ''
      };
    }));

    res.json(requestsWithEvents);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching your organizer requests.', error: err.message });
  }
};

const withdrawOrganizerRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const studentId = req.user.id;

    const { data: request, error: reqErr } = await supabase
      .from('organizer_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();

    if (reqErr || !request) {
      return res.status(404).json({ message: 'Organizer request not found.' });
    }

    // Auth check
    if (String(request.student_id) !== String(studentId)) {
      return res.status(403).json({ message: 'You are not authorized to withdraw this request.' });
    }

    // Status check
    if (request.status !== 'pending') {
      return res.status(400).json({ message: `Cannot withdraw a request that is already ${request.status}.` });
    }

    const { data: updatedRequest, error: updateErr } = await supabase
      .from('organizer_requests')
      .update({ status: 'withdrawn' })
      .eq('id', requestId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    res.json({ message: 'Organizer request withdrawn successfully.', request: updatedRequest });
  } catch (err) {
    res.status(500).json({ message: 'Server error withdrawing organizer request.', error: err.message });
  }
};

// ==========================================
// PROPOSAL WORKSPACE CONTROLLERS
// ==========================================

// Helper function to check if user is a Core Organizer for the Proposal Workspace
const checkCoreOrganizerAccess = async (eventId, event, user) => {
  if (!user || !user.id || !user.roles) return false;
  const isAdmin = user.roles.includes('admin');
  const isFaculty = user.id === event.faculty_id;
  const isCreator = user.id === event.proposed_by || user.id === event.student_organizer_id;

  if (isAdmin || isFaculty || isCreator) return true;

  // Check if they are explicitly assigned in event_members
  const { data: member } = await supabase
    .from('event_members')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();

  return !!member;
};

const getProposalWorkspace = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Fetch Event
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (!eventErr && event) {
      // 1b. Fetch Faculty manually
      if (event.faculty_id) {
        const { data: fac } = await supabase.from('profiles').select('id, full_name, name, email, department').eq('id', event.faculty_id).maybeSingle();
        event.faculty = fac;
      }
      
      // 1c. Fetch Proposer/Student Organizer manually
      const studentId = event.student_organizer_id || event.proposed_by;
      if (studentId) {
        const { data: stu } = await supabase.from('profiles').select('id, full_name, name, email, department, roll_number').eq('id', studentId).maybeSingle();
        event.student_organizer = stu;
      }
    }

    if (eventErr || !event) {
      return res.status(404).json({ message: 'Proposal not found.' });
    }

    // Access control: Core Organizers only
    const hasAccess = await checkCoreOrganizerAccess(id, event, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied to this proposal workspace.' });
    }

    // 2. Fetch Discussions
    const { data: discussions, error: discErr } = await supabase
      .from('proposal_discussions')
      .select('*')
      .eq('proposal_id', id)
      .order('created_at', { ascending: true });

    if (discErr && discErr.code !== '42P01') throw discErr;

    // 3. Fetch Documents
    const { data: documents, error: docErr } = await supabase
      .from('proposal_documents')
      .select('*')
      .eq('proposal_id', id)
      .order('created_at', { ascending: false });

    if (docErr && docErr.code !== '42P01') throw docErr;

    // 4. Fetch Timeline
    const { data: timeline, error: timeErr } = await supabase
      .from('proposal_timeline')
      .select('*')
      .eq('proposal_id', id)
      .order('created_at', { ascending: true });

    if (timeErr && timeErr.code !== '42P01') throw timeErr;

    // 5. Manually attach profiles
    const allUserIds = [...new Set([
      ...(discussions || []).map(d => d.user_id),
      ...(documents || []).map(d => d.user_id),
      ...(timeline || []).map(t => t.user_id)
    ].filter(Boolean))];

    let profilesMap = {};
    if (allUserIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name, name, role, avatar_url').in('id', allUserIds);
      (profs || []).forEach(p => { profilesMap[p.id] = p; });
    }

    const formattedDiscussions = (discussions || []).map(d => ({ ...d, sender: profilesMap[d.user_id] || {} }));
    const formattedDocuments = (documents || []).map(d => ({ ...d, uploader: profilesMap[d.user_id] || {} }));
    const formattedTimeline = (timeline || []).map(t => ({ ...t, actor: profilesMap[t.user_id] || {} }));

    res.json({
      event,
      discussions: formattedDiscussions,
      documents: formattedDocuments,
      timeline: formattedTimeline
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error fetching proposal workspace.', error: err.message });
  }
};

const postProposalDiscussion = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message) return res.status(400).json({ message: 'Message cannot be empty.' });

    // Verify access
    const { data: event, error: eventErr } = await supabase.from('events').select('faculty_id, student_organizer_id, proposed_by, title').eq('id', id).single();
    if (eventErr) return res.status(404).json({ message: 'Proposal not found.' });

    const hasAccess = await checkCoreOrganizerAccess(id, event, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const isCreator = req.user.id === event.proposed_by || req.user.id === event.student_organizer_id;

    const { data: discussion, error } = await supabase
      .from('proposal_discussions')
      .insert({
        proposal_id: id,
        user_id: req.user.id,
        message
      })
      .select('*')
      .single();

    if (error) throw error;
    
    // Attach sender profile manually
    const { data: profile } = await supabase.from('profiles').select('id, full_name, name, role, avatar_url').eq('id', req.user.id).maybeSingle();
    discussion.sender = profile || {};

    // Add notification for the other party
    try {
      const targetUserId = isCreator ? event.faculty_id : (event.proposed_by || event.student_organizer_id);
      if (targetUserId) {
        await notifyUser({
          userId: targetUserId,
          type: 'new_message',
          title: 'New Message',
          message: `New message on proposal "${event.title || 'Event'}" from ${isCreator ? 'Student' : 'Faculty'}.`,
          link: `/proposals/${id}`
        });
      }
    } catch (notifyErr) {
      console.error('Failed to send notification for discussion:', notifyErr.message);
    }
    
    res.status(201).json(discussion);
  } catch (err) {
    res.status(500).json({ message: 'Server error posting discussion.', error: err.message });
  }
};

const uploadProposalDocument = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ message: 'No document uploaded.' });
    }

    const fileExt = req.file.originalname.split('.').pop();
    const fileType = fileExt.toUpperCase();
    const fileName = req.file.originalname;
    
    // Upload to Supabase Storage
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const storagePath = `proposal_${id}/${uniqueSuffix}.${fileExt}`;
    
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });
      
    if (uploadErr) {
      console.error('Supabase upload error:', uploadErr);
      return res.status(500).json({ message: 'Failed to upload document to storage.', error: uploadErr.message });
    }

    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(storagePath);
    const fileUrl = urlData.publicUrl;

    // Verify event exists to get current revision number
    const { data: event, error: eventErr } = await supabase.from('events').select('revision_number, faculty_id, proposed_by, student_organizer_id, title').eq('id', id).single();
    if (eventErr) throw eventErr;

    const hasAccess = await checkCoreOrganizerAccess(id, event, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const { data: document, error } = await supabase
      .from('proposal_documents')
      .insert({
        proposal_id: id,
        user_id: req.user.id,
        file_name: fileName,
        file_url: fileUrl,
        file_type: fileType,
        version: event.revision_number || 1
      })
      .select('*')
      .single();

    if (error) throw error;

    const { data: profile } = await supabase.from('profiles').select('id, full_name, name').eq('id', req.user.id).maybeSingle();
    document.uploader = profile || {};

    if (error) throw error;

    // Log to timeline
    await supabase.from('proposal_timeline').insert({
      proposal_id: id,
      user_id: req.user.id,
      action: 'Document Uploaded',
      details: `Uploaded ${fileName}`
    });

    if (isCreator && event.faculty_id) {
      try {
        await notifyUser({
          userId: event.faculty_id,
          type: 'document_uploaded',
          title: 'New Document Uploaded',
          message: `Student uploaded a document for "${event.title || 'Event'}".`,
          link: `/proposals/${id}`
        });
      } catch (notifyErr) {
        console.error('Failed to notify faculty of document upload:', notifyErr.message);
      }
    }

    res.status(201).json(document);
  } catch (err) {
    res.status(500).json({ message: 'Server error uploading document.', error: err.message });
  }
};

const updateProposalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    const allowedStatuses = ['under_review', 'needs_revision', 'approved', 'rejected'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status update.' });
    }

    if (status === 'needs_revision' && !remarks) {
      return res.status(400).json({ message: 'Remarks are required when requesting a revision.' });
    }

    const { data: event, error: eventErr } = await supabase.from('events').select('*').eq('id', id).single();
    if (eventErr || !event) return res.status(404).json({ message: 'Proposal not found.' });

    // Ensure only assigned faculty or admin
    if (!req.user.roles.includes('admin') && req.user.id !== event.faculty_id) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    let updates = { status };
    if (remarks) updates.approval_remarks = remarks;

    const { data: updatedEvent, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    let actionLabel = '';
    if (status === 'under_review') actionLabel = 'Status changed to Under Review';
    else if (status === 'needs_revision') actionLabel = 'Revision Requested';
    else if (status === 'approved') actionLabel = 'Faculty Approved';
    else if (status === 'rejected') actionLabel = 'Faculty Rejected';

    await supabase.from('proposal_timeline').insert({
      proposal_id: id,
      user_id: req.user.id,
      action: actionLabel,
      details: remarks || null
    });

    // Notify student
    const studentId = event.proposed_by || event.student_organizer_id;
    if (studentId) {
      try {
        await notifyUser({
          userId: studentId,
          type: 'status_update',
          title: `Proposal ${actionLabel}`,
          message: `Your proposal for "${event.title}" has been updated: ${actionLabel}`,
          link: `/proposals/${id}`
        });
      } catch (notifyErr) {
        console.error('Failed to notify student of status update:', notifyErr.message);
      }
    }

    res.json(updatedEvent);
  } catch (err) {
    res.status(500).json({ message: 'Server error updating status.', error: err.message });
  }
};

const resubmitProposal = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: event, error: eventErr } = await supabase.from('events').select('*').eq('id', id).single();
    if (eventErr || !event) return res.status(404).json({ message: 'Proposal not found.' });

    if (req.user.id !== event.proposed_by && req.user.id !== event.student_organizer_id) {
      return res.status(403).json({ message: 'Only the proposal creator can resubmit.' });
    }

    if (event.status !== 'needs_revision') {
      return res.status(400).json({ message: 'Proposal is not in Needs Revision state.' });
    }

    const newRevision = (event.revision_number || 1) + 1;

    const { data: updatedEvent, error } = await supabase
      .from('events')
      .update({ 
        status: 'pending_approval', 
        revision_number: newRevision 
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('proposal_timeline').insert({
      proposal_id: id,
      user_id: req.user.id,
      action: 'Student Resubmitted',
      details: `Resubmitted as Revision ${newRevision}`
    });

    // Notify faculty
    if (event.faculty_id) {
      try {
        await notifyUser({
          userId: event.faculty_id,
          type: 'resubmitted',
          title: 'Proposal Resubmitted',
          message: `Student resubmitted proposal "${event.title || 'Event'}" (Revision ${newRevision}).`,
          link: `/proposals/${id}`
        });
      } catch (notifyErr) {
        console.error('Failed to notify faculty of resubmission:', notifyErr.message);
      }
    }

    res.json(updatedEvent);
  } catch (err) {
    res.status(500).json({ message: 'Server error resubmitting proposal.', error: err.message });
  }
};

const getProposalTeam = async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: event, error: evErr } = await supabase.from('events').select('*').eq('id', id).single();
    if (evErr) throw evErr;

    const hasAccess = await checkCoreOrganizerAccess(id, event, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const { data: members, error } = await supabase
      .from('event_members')
      .select('*')
      .eq('event_id', id);
    if (error) throw error;
    
    // Fetch names and emails manually from profiles
    const userIds = (members || []).map(m => m.user_id).filter(Boolean);
    let profilesMap = {};
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, email, role, department, roll_number')
        .in('id', userIds);
      profilesMap = (profilesData || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
    }
    
    const formattedMembers = (members || []).map(m => ({
      ...m,
      name: profilesMap[m.user_id]?.name || m.name || 'Unknown',
      email: profilesMap[m.user_id]?.email || m.email || null,
      global_role: profilesMap[m.user_id]?.role || 'student',
      department: profilesMap[m.user_id]?.department || null,
      roll_number: profilesMap[m.user_id]?.roll_number || null,
    }));
    
    res.json(formattedMembers);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching team.', error: err.message });
  }
};

const addProposalTeamMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, name, email, department, role } = req.body;
    
    const { data: event, error: evErr } = await supabase.from('events').select('*').eq('id', id).single();
    if (evErr) throw evErr;
    
    const hasAccess = await checkCoreOrganizerAccess(id, event, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    
    const isAdmin = req.user.roles?.includes('admin');
    const isFaculty = req.user.id === event.faculty_id;
    
    if (role === 'Faculty Coordinator' && !isAdmin && !isFaculty) {
      return res.status(403).json({ message: 'Students cannot assign Faculty Coordinators.' });
    }
    
    const { data: existing } = await supabase.from('event_members').select('id').eq('event_id', id).eq('user_id', userId).maybeSingle();
    if (existing) {
      return res.status(400).json({ message: 'User is already in the organizing team.' });
    }

    const { data: member, error: insErr } = await supabase.from('event_members').insert({
      event_id: id,
      user_id: userId,
      role
    }).select('*').single();
    
    if (insErr) throw insErr;
    
    try {
      await notifyUser({
        userId: userId,
        type: 'assigned',
        title: 'Assigned to Proposal',
        message: `You have been added to the proposal "${event.title || 'Event'}" as a ${role}.`,
        link: `/proposals/${id}`
      });
    } catch (nErr) {}
    
    // Fetch the name and email for the new member
    let userEmail = null;
    let userName = name || 'Unknown';
    if (userId) {
      const { data: profileData } = await supabase.from('profiles').select('name, email').eq('id', userId).maybeSingle();
      if (profileData) {
        userEmail = profileData.email;
        userName = profileData.name;
      }
    }
    
    res.json({
      ...member,
      name: userName,
      email: userEmail
    });
  } catch (err) {
    console.error('DEBUG ROOT CAUSE:', err);
    res.status(500).json({ message: `Server error adding team member: ${err.message || JSON.stringify(err)}`, error: err.message });
  }
};

const removeProposalTeamMember = async (req, res) => {
  try {
    const { id, memberId } = req.params;
    
    const { data: event, error: evErr } = await supabase.from('events').select('*').eq('id', id).single();
    if (evErr) throw evErr;
    
    const hasAccess = await checkCoreOrganizerAccess(id, event, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    
    const { data: member, error: memErr } = await supabase.from('event_members').select('*').eq('id', memberId).single();
    if (memErr) throw memErr;
    
    if (member.user_id === event.proposed_by || member.user_id === event.student_organizer_id) {
      return res.status(400).json({ message: 'Cannot remove the primary proposal creator.' });
    }
    
    const { error: delErr } = await supabase.from('event_members').delete().eq('id', memberId);
    if (delErr) throw delErr;
    
    // If the removed member was the primary faculty coordinator, nullify the reference in events table
    if (member.user_id === event.faculty_id) {
      const { error: updateErr } = await supabase.from('events').update({ faculty_id: null }).eq('id', id);
      if (updateErr) console.error('Error nullifying faculty_id:', updateErr.message);
    }
    
    if (member.user_id) {
      try {
        await notifyUser({
          userId: member.user_id,
          type: 'removed',
          title: 'Removed from Proposal',
          message: `You have been removed from the proposal "${event.title || 'Event'}".`,
          link: `/proposals/${id}`
        });
      } catch (nErr) {}
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error removing team member.', error: err.message });
  }
};

const updateProposalDescription = async (req, res) => {
  try {
    const { id } = req.params;
    const { description } = req.body;
    
    if (description === undefined) {
      return res.status(400).json({ message: 'Description is required.' });
    }
    
    const { data: event, error: evErr } = await supabase.from('events').select('*').eq('id', id).single();
    if (evErr) throw evErr;
    
    const hasAccess = await checkCoreOrganizerAccess(id, event, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    
    const { data: updatedEvent, error: updateErr } = await supabase
      .from('events')
      .update({ description })
      .eq('id', id)
      .select()
      .single();
      
    if (updateErr) throw updateErr;
    
    // Log timeline event
    await supabase.from('proposal_timeline').insert({
      proposal_id: id,
      user_id: req.user.id,
      action: 'Description Updated',
      details: 'The event description was modified.'
    });
    
    res.json(updatedEvent);
  } catch (err) {
    res.status(500).json({ message: 'Server error updating description.', error: err.message });
  }
};

const removeProposalDocument = async (req, res) => {
  try {
    const { id, docId } = req.params;
    
    const { data: event, error: evErr } = await supabase.from('events').select('faculty_id, proposed_by, student_organizer_id').eq('id', id).single();
    if (evErr) throw evErr;
    
    const hasAccess = await checkCoreOrganizerAccess(id, event, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    
    const { data: document, error: docErr } = await supabase.from('proposal_documents').select('*').eq('id', docId).single();
    if (docErr) throw docErr;
    
    if (document.proposal_id !== id) {
      return res.status(400).json({ message: 'Document does not belong to this proposal.' });
    }
    
    // Attempt to remove from Supabase Storage
    if (document.file_url) {
      // The file_url is a public URL like: https://[project].supabase.co/storage/v1/object/public/documents/proposal_123/12345.pdf
      // We need to extract the path: "proposal_123/12345.pdf"
      const urlParts = document.file_url.split('/documents/');
      if (urlParts.length === 2) {
        const storagePath = urlParts[1];
        const { error: storageErr } = await supabase.storage.from('documents').remove([storagePath]);
        if (storageErr) console.error('Failed to remove document from storage:', storageErr);
      }
    }
    
    // Remove from database
    const { error: delErr } = await supabase.from('proposal_documents').delete().eq('id', docId);
    if (delErr) throw delErr;
    
    // Log timeline event
    await supabase.from('proposal_timeline').insert({
      proposal_id: id,
      user_id: req.user.id,
      action: 'Document Removed',
      details: `Removed document: ${document.file_name}`
    });
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error removing document.', error: err.message });
  }
};

module.exports = {
  getEvents,
  getEventById,
  createEvent,
  editEvent,
  deleteEvent,
  updateStatus,
  getMyEvents,
  getEventAnalytics,
  addTeamMember,
  removeTeamMember,
  publishEvent,
  getEventOrganizers,
  recruitOrganizer,
  removeOrganizer,
  toggleJoinTeam,
  submitOrganizerRequest,
  getOrganizerRequests,
  processJoinRequest,
  withdrawEvent,
  getMyOrganizerRequests,
  withdrawOrganizerRequest,
  getProposalWorkspace,
  postProposalDiscussion,
  uploadProposalDocument,
  updateProposalStatus,
  resubmitProposal,
  getProposalTeam,
  addProposalTeamMember,
  removeProposalTeamMember,
  updateProposalDescription,
  removeProposalDocument,
};
