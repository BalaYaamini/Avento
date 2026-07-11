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
      evt.organizerIds = (orgs || []).map(o => o.student_id);
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
    if (isProposal && (req.user.roles.includes('faculty') || req.user.roles.includes('faculty_organizer')) && !req.user.roles.includes('admin')) {
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
    event.organizerIds = (orgs || []).map(o => o.student_id);
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
      registrationType, maxTeams, minTeamSize, maxTeamSize, allowCrossDepartment, teamLeaderRegistrationRequired
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
    };

    if (proposedBy) newEvent.proposed_by = proposedBy;
    if (facultyId) newEvent.faculty_id = facultyId;
    if (organizerId) newEvent.organizer_id = organizerId;

    const { data: event, error } = await supabase.from('events').insert(newEvent).select().single();
    if (error) throw error;

    if (facultyId) {
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
      registrationType, maxTeams, minTeamSize, maxTeamSize, allowCrossDepartment, teamLeaderRegistrationRequired
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

    // Students must be allowed to edit their proposals only if status is pending_approval or rejected
    if (isStudent) {
      if (event.status !== 'pending_approval' && event.status !== 'rejected') {
        return res.status(400).json({ message: 'You can only edit proposals that are pending approval or rejected.' });
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
      updates.approval_remarks = '';
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
      name: name,
      roll_number: rollNumber || null,
      email: email || null,
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
    const { data: organizers, error } = await supabase
      .from('event_organizers')
      .select('*')
      .eq('event_id', id);
    if (error) throw error;

    // For each organizer, fetch profile details
    const organizersWithProfiles = await Promise.all((organizers || []).map(async (org) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, email, department')
        .eq('id', org.student_id)
        .maybeSingle();
      return {
        id: org.id,
        userId: org.student_id,
        category: org.category,
        joinedAt: org.joined_at,
        name: profile?.name || 'Unknown Student',
        email: profile?.email || '',
        department: profile?.department || ''
      };
    }));

    res.json(organizersWithProfiles);
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
    if (event.status === 'published' || event.status === 'completed' || event.status === 'cancelled') {
      return res.status(400).json({ message: 'Published or inactive events cannot be withdrawn.' });
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
};
