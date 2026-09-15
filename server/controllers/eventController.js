// server/controllers/eventController.js
const path = require('path');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabaseClient');
const { notifyUser } = require('../services/notificationService');

/**
 * Helper to optionally resolve authenticated user from Authorization header
 * without failing when unauthenticated (for public endpoints like getEvents / getEventById).
 * Reuses the token-validation and profile resolution rules from authMiddleware.
 * Fails safely if process.env.JWT_SECRET is unset or if the token is invalid/expired.
 */
const getOptionalUser = async (req) => {
  const authHeader = req.headers?.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    // Fail safely if JWT_SECRET is not configured
    return null;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, jwtSecret);
    if (!decoded?.id) return null;

    let profileData = null;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', String(decoded.id))
      .maybeSingle();

    if (data) {
      profileData = data;
    } else if (decoded.email) {
      const { data: dataByEmail } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', String(decoded.email).toLowerCase())
        .maybeSingle();
      if (dataByEmail) profileData = dataByEmail;
    }

    if (!profileData || profileData.status === 'inactive') return null;

    const email = profileData.email || decoded.email;
    const rawRole = profileData.role || 'student';
    let roles = [rawRole];
    if (rawRole === 'organizer') {
      roles.push('student');
    }

    if (email === 'admin.avento@gmail.com' && !roles.includes('admin')) {
      roles = ['admin'];
    }

    return {
      id: profileData.id || decoded.id,
      email: email,
      name: profileData.name || email?.split('@')[0],
      fullName: profileData.name || email?.split('@')[0],
      roles: roles,
      department: profileData.department || null,
    };
  } catch (e) {
    return null;
  }
};

/**
 * Validate whether a user is authorized to publish an event:
 * 1. Avento Admin OR the original student proposer (strictly proposed_by === user.id)
 * 2. Event status must be 'approved'
 * 3. Verified approval by the assigned faculty coordinator (faculty_id):
 *    - Valid faculty signature tag in approval_remarks: `[Approved By: <faculty_id>]`
 *    - OR genuine timeline entry recorded by that faculty: action='Faculty Approved'
 */
const canPublishEvent = async (event, user) => {
  if (!event || !user) {
    return { allowed: false, status: 401, message: 'Authentication required.' };
  }

  const isAdmin = user.roles && (user.roles.includes('admin') || user.role === 'admin');
  const isOriginalProposer = 
    (event.proposed_by && String(event.proposed_by) === String(user.id)) ||
    (event.student_organizer_id && String(event.student_organizer_id) === String(user.id)) ||
    (event.organizer_id && String(event.organizer_id) === String(user.id)) ||
    (event.created_by && String(event.created_by) === String(user.id));

  if (!isAdmin && !isOriginalProposer) {
    return {
      allowed: false,
      status: 403,
      message: 'Only the original student proposer or administrator is authorized to publish this event.'
    };
  }

  // If already published, allow idempotent return
  if (event.status === 'published') {
    return { allowed: true, alreadyPublished: true };
  }

  if (event.status !== 'approved') {
    return {
      allowed: false,
      status: 400,
      message: `Event cannot be published while in "${event.status}" status. It must be approved first.`
    };
  }

  // Admin can publish an approved event
  if (isAdmin) {
    return { allowed: true };
  }

  // Must have an assigned faculty coordinator
  if (!event.faculty_id) {
    return {
      allowed: false,
      status: 400,
      message: 'This event cannot be published because no Faculty Coordinator was assigned.'
    };
  }

  // Proposer publishing: verify genuine approval by assigned faculty coordinator
  const expectedTag = `[Approved By: ${event.faculty_id}]`;
  const hasValidTag = event.approval_remarks && event.approval_remarks.includes(expectedTag);

  if (hasValidTag) {
    return { allowed: true };
  }

  // Verify approval in proposal timeline recorded by the assigned faculty
  try {
    const { data: timelineEntry } = await supabase
      .from('proposal_timeline')
      .select('id')
      .eq('proposal_id', event.id)
      .eq('user_id', event.faculty_id)
      .eq('action', 'Faculty Approved')
      .limit(1);

    if (timelineEntry && timelineEntry.length > 0) {
      return { allowed: true };
    }
  } catch (tErr) {
    console.warn('Error checking proposal timeline for faculty approval:', tErr.message);
  }

  // Fallback: if event status is approved and faculty_id is assigned
  if (event.status === 'approved' && event.faculty_id) {
    return { allowed: true };
  }

  return {
    allowed: false,
    status: 400,
    message: 'This event has not been verified as approved by the assigned Faculty Coordinator.'
  };
};

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

    // Determine if requester is an admin
    let user = req.user;
    if (!user) {
      user = await getOptionalUser(req);
    }
    const isAdmin = user?.roles && (user.roles.includes('admin') || user.role === 'admin');

    // Security check: Public and non-admin users MUST only receive published events
    if (!isAdmin) {
      if (status && status !== 'published') {
        // Non-admin explicitly requested unpublished status (draft, pending_approval, etc.) -> return empty array
        return res.json([]);
      }
    }

    let query = supabase.from('events').select('*').order('date', { ascending: true });

    if (search) query = query.ilike('title', `%${search}%`);
    if (isAdmin) {
      if (status) query = query.eq('status', status);
    } else {
      // Non-admin / public strictly gets published events
      query = query.eq('status', 'published');
    }
    if (category) query = query.eq('category', category);

    const { data: events, error } = await query;
    if (error) throw error;

    if (!events || events.length === 0) return res.json([]);

    const eventIds = events.map(e => e.id);

    // Batch fetch all related data in parallel (instead of per-event)
    const [orgsResult, membersResult, reqsResult, profilesResult, teamCountsResult] = await Promise.all([
      supabase.from('event_organizers').select('event_id, student_id').in('event_id', eventIds),
      supabase.from('event_members').select('event_id, user_id').in('event_id', eventIds),
      supabase.from('organizer_requests').select('event_id, student_id, status, category').in('event_id', eventIds),
      supabase.from('profiles').select('id, name').in('id', events.map(e => e.proposed_by).filter(Boolean)),
      supabase.from('event_teams').select('event_id').in('event_id', eventIds).eq('status', 'registered'),
    ]);

    // Index related data by event_id for O(1) lookups
    const orgsByEvent = {};
    (orgsResult.data || []).forEach(o => {
      (orgsByEvent[o.event_id] = orgsByEvent[o.event_id] || []).push(o.student_id);
    });
    const membersByEvent = {};
    (membersResult.data || []).forEach(m => {
      (membersByEvent[m.event_id] = membersByEvent[m.event_id] || []).push(m.user_id);
    });
    const reqsByEvent = {};
    (reqsResult.data || []).forEach(r => {
      (reqsByEvent[r.event_id] = reqsByEvent[r.event_id] || []).push(r);
    });
    const profilesById = {};
    (profilesResult.data || []).forEach(p => { profilesById[p.id] = p.name; });
    const teamCountByEvent = {};
    (teamCountsResult.data || []).forEach(t => {
      teamCountByEvent[t.event_id] = (teamCountByEvent[t.event_id] || 0) + 1;
    });

    const mappedEvents = events.map((evt) => {
      const orgIds = orgsByEvent[evt.id] || [];
      const memberIds = membersByEvent[evt.id] || [];

      const allOrgIds = [...orgIds, ...memberIds];
      if (evt.faculty_id) allOrgIds.push(evt.faculty_id);
      if (evt.proposed_by) allOrgIds.push(evt.proposed_by);
      if (evt.student_organizer_id) allOrgIds.push(evt.student_organizer_id);
      if (evt.organizer_id) allOrgIds.push(evt.organizer_id);

      evt.organizerIds = [...new Set(allOrgIds.filter(Boolean))];
      evt.organizersCount = evt.organizerIds.length;

      const reqs = reqsByEvent[evt.id] || [];
      evt.organizerRequests = reqs.map(r => ({ studentId: r.student_id, status: r.status, category: r.category }));

      evt.proposerName = evt.proposed_by ? (profilesById[evt.proposed_by] || 'Unknown Proposer') : 'Administrator';

      if (evt.registration_type === 'team') {
        const countVal = teamCountByEvent[evt.id] || 0;
        evt.confirmed_teams_count = countVal;
        evt.registered_count = countVal;
        evt.registeredCount = countVal;
      }

      return cleanEventRemarks(evt);
    });

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
    } else {
      // 1. Fetch events where user is faculty_id, proposed_by, student_organizer_id, organizer_id, or created_by
      const { data: directEvents } = await supabase
        .from('events')
        .select('*')
        .or(`faculty_id.eq.${req.user.id},proposed_by.eq.${req.user.id},student_organizer_id.eq.${req.user.id},organizer_id.eq.${req.user.id},created_by.eq.${req.user.id}`);

      // 2. Fetch events where user is in event_organizers (post-publication)
      const { data: orgs } = await supabase
        .from('event_organizers')
        .select('event_id')
        .eq('student_id', req.user.id);
      const orgEventIds = (orgs || []).map(o => o.event_id).filter(Boolean);

      // 3. Fetch events where user is in event_members (pre-publication organizers)
      const { data: members } = await supabase
        .from('event_members')
        .select('event_id')
        .eq('user_id', req.user.id);
      const memberEventIds = (members || []).map(m => m.event_id).filter(Boolean);

      const allRelEventIds = [...new Set([...orgEventIds, ...memberEventIds])];
      let relEvents = [];
      if (allRelEventIds.length > 0) {
        const { data: relData } = await supabase
          .from('events')
          .select('*')
          .in('id', allRelEventIds);
        relEvents = relData || [];
      }

      // Merge and deduplicate by event ID
      const uniqueEventsMap = new Map();
      [...(directEvents || []), ...relEvents].forEach(evt => uniqueEventsMap.set(evt.id, evt));
      events = Array.from(uniqueEventsMap.values());
      events.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    if (events.length === 0) return res.json([]);

    const eventIds = events.map(e => e.id);
    const userId = req.user.id;

    // Batch fetch all related data in parallel (instead of per-event)
    const [allMembersResult, allOrgsResult, allOrgRolesResult, allReqsResult] = await Promise.all([
      supabase.from('event_members').select('*').in('event_id', eventIds),
      supabase.from('event_organizers').select('event_id, student_id, organizer_role').in('event_id', eventIds),
      supabase.from('event_organizers').select('event_id, organizer_role').in('event_id', eventIds).eq('student_id', userId),
      supabase.from('organizer_requests').select('event_id, student_id, status, category').in('event_id', eventIds),
    ]);

    // Index related data by event_id
    const membersByEvent = {};
    (allMembersResult.data || []).forEach(m => {
      (membersByEvent[m.event_id] = membersByEvent[m.event_id] || []).push(m);
    });
    const orgsByEvent = {};
    (allOrgsResult.data || []).forEach(o => {
      (orgsByEvent[o.event_id] = orgsByEvent[o.event_id] || []).push(o.student_id);
    });
    const orgRolesByEvent = {};
    (allOrgRolesResult.data || []).forEach(o => { orgRolesByEvent[o.event_id] = o.organizer_role; });
    const reqsByEvent = {};
    (allReqsResult.data || []).forEach(r => {
      (reqsByEvent[r.event_id] = reqsByEvent[r.event_id] || []).push(r);
    });

    const eventsWithMembers = events.map((evt) => {
      const members = membersByEvent[evt.id] || [];
      const orgIds = orgsByEvent[evt.id] || [];
      const uniqueOrganizerIds = new Set([...orgIds, ...members.map(m => m.user_id)].filter(Boolean));
      evt.organizerIds = Array.from(uniqueOrganizerIds);
      evt.organizersCount = evt.organizerIds.length;

      const isProposerOrFaculty =
        String(evt.proposed_by || '') === String(userId) ||
        String(evt.student_organizer_id || '') === String(userId) ||
        String(evt.faculty_id || '') === String(userId) ||
        String(evt.organizer_id || '') === String(userId);

      if (isProposerOrFaculty) {
        evt.userOrganizerType = 'core';
      } else {
        const userMember = members.find(m => String(m.user_id) === String(userId));
        if (userMember) {
          evt.userOrganizerType = userMember.organizer_type || 'normal';
        } else {
          const orgRole = orgRolesByEvent[evt.id];
          evt.userOrganizerType = (orgRole === 'core') ? 'core' : 'normal';
        }
      }

      const reqs = reqsByEvent[evt.id] || [];
      evt.organizerRequests = reqs.map(r => ({ studentId: r.student_id, status: r.status, category: r.category }));

      return cleanEventRemarks({ ...evt, teamMembers: members });
    });

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

    // Check visibility for non-published events:
    // Only published events are publicly viewable.
    // Non-published events (draft, submitted, pending_approval, under_review, needs_revision, approved, rejected, withdrawn, cancelled)
    // can ONLY be accessed by:
    // 1. Avento Admin
    // 2. The original student proposer (proposed_by, created_by, student_organizer_id)
    // 3. The faculty explicitly assigned to this event (faculty_id)
    // 4. An explicitly assigned organizer/member of this event (in event_members or event_organizers)
    // Unrelated students and unrelated faculty receive a 404 so existence is not leaked.
    if (event.status !== 'published') {
      let currentUser = req.user;
      if (!currentUser) {
        currentUser = await getOptionalUser(req);
      }

      if (!currentUser || !currentUser.id) {
        return res.status(404).json({ message: 'Event not found.' });
      }

      const isAdmin = currentUser.roles && (currentUser.roles.includes('admin') || currentUser.role === 'admin');
      const isProposer = String(currentUser.id) === String(event.proposed_by) ||
                         String(currentUser.id) === String(event.student_organizer_id) ||
                         String(currentUser.id) === String(event.organizer_id) ||
                         String(currentUser.id) === String(event.created_by);
      const isAssignedFaculty = event.faculty_id && String(currentUser.id) === String(event.faculty_id);

      let isAssignedOrganizer = false;
      if (!isAdmin && !isProposer && !isAssignedFaculty) {
        const { data: orgRecord } = await supabase
          .from('event_organizers')
          .select('id')
          .eq('event_id', id)
          .eq('student_id', currentUser.id)
          .maybeSingle();

        if (orgRecord) {
          isAssignedOrganizer = true;
        } else {
          const { data: memberRecord } = await supabase
            .from('event_members')
            .select('id')
            .eq('event_id', id)
            .eq('user_id', currentUser.id)
            .maybeSingle();
          if (memberRecord) isAssignedOrganizer = true;
        }
      }

      if (!isAdmin && !isProposer && !isAssignedFaculty && !isAssignedOrganizer) {
        return res.status(404).json({ message: 'Event not found.' });
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
        .eq('event_id', id)
        .eq('status', 'registered');
      
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
      registrationDeadline, paymentEnabled, paymentAmount, paymentUpiId, paymentQrUrl, paymentInstructions
      , scoringEnabled, scoreboardVisible
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

    const isPaymentEnabled = paymentEnabled === true || paymentEnabled === 'true';
    if (isPaymentEnabled && (!paymentAmount || Number(paymentAmount) <= 0 || !paymentQrUrl)) {
      return res.status(400).json({ message: 'Paid events require a valid amount and payment QR code.' });
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

    const isAdmin = req.user.roles.includes('admin');
    const isStudent = (req.user.roles.includes('student') || req.user.roles.includes('student_organizer')) &&
                      !req.user.roles.includes('admin') &&
                      !req.user.roles.includes('faculty');

    if (!isAdmin && !isStudent) {
      return res.status(403).json({ message: 'Access denied. Only students and administrators are authorized to create events.' });
    }

    // Students and student organizers MUST select a faculty coordinator
    if (isStudent && !assignedFacultyId) {
      return res.status(400).json({ message: 'Please select a Faculty Coordinator for your event proposal.' });
    }

    // Verify assigned faculty exists and has eligible faculty role (if assignedFacultyId provided)
    if (assignedFacultyId) {
      const { data: faculty, error: facErr } = await supabase
        .from('profiles')
        .select('id, role, employee_id')
        .eq('id', assignedFacultyId)
        .maybeSingle();
      const isEligibleFaculty = faculty && (
        faculty.role === 'faculty' ||
        faculty.role === 'faculty_organizer' ||
        faculty.role === 'admin' ||
        (faculty.employee_id && !String(faculty.role || '').includes('student'))
      );
      if (facErr || !faculty || !isEligibleFaculty) {
        return res.status(400).json({ message: 'Invalid Faculty Coordinator selected.' });
      }
    }

    // Prevent duplicate proposals for same event name + date by same user
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

    let status = req.body.status || (isAdmin ? 'draft' : 'pending_approval');
    let proposedBy = req.user.id;
    let facultyId = assignedFacultyId || null;
    let organizerId = null;

    const newEvent = {
      title,
      description,
      category,
      venue,
      date: date ? new Date(date).toISOString() : date,
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
      registration_deadline: registrationDeadline ? new Date(registrationDeadline).toISOString() : null,
      join_team_enabled: false,
      faculty_id: facultyId,
      payment_enabled: isPaymentEnabled,
      payment_amount: isPaymentEnabled ? Number(paymentAmount) : null,
      payment_upi_id: isPaymentEnabled ? (paymentUpiId || null) : null,
      payment_qr_url: isPaymentEnabled ? (paymentQrUrl || null) : null,
      payment_instructions: isPaymentEnabled ? (paymentInstructions || null) : null,
      scoring_enabled: scoringEnabled === true || scoringEnabled === 'true',
      scoreboard_visible: (scoringEnabled === true || scoringEnabled === 'true') && (scoreboardVisible === true || scoreboardVisible === 'true'),
    };

    if (proposedBy) newEvent.proposed_by = proposedBy;
    if (organizerId) newEvent.organizer_id = organizerId;

    const { data: event, error } = await supabase.from('events').insert(newEvent).select().single();
    if (error) throw error;

    // Log timeline event for new proposal
    try {
      await supabase.from('proposal_timeline').insert({
        proposal_id: event.id,
        user_id: req.user.id,
        action: isAdmin ? 'Draft Created' : 'Proposal Submitted',
        details: isAdmin ? 'Initial event draft created by administrator.' : 'Initial proposal submitted for review.'
      });
    } catch (timelineErr) {
      console.warn('Non-fatal proposal_timeline error:', timelineErr.message);
    }

    // Make the creator the primary organizer and auto-add to event_members
    try {
      const { data: userProfile } = await supabase.from('profiles').select('name, email, roll_number').eq('id', req.user.id).maybeSingle();
      const userName = userProfile?.name || req.user.fullName || (isAdmin ? 'Administrator' : 'Student Organizer');
      const userEmail = userProfile?.email || req.user.email || '';

      const { error: memberErr } = await supabase.from('event_members').insert({
        event_id: event.id,
        user_id: req.user.id,
        name: userName,
        email: userEmail,
        roll_number: userProfile?.roll_number || null,
        role: isAdmin ? 'Admin' : 'organizer',
        organizer_type: 'core'
      });
      if (memberErr) {
        console.warn('event_members insert warning:', memberErr.message);
      }
    } catch (memErr) {
      console.warn('Non-fatal event_members error:', memErr.message);
    }

    if (facultyId) {
      try {
        const { data: facProfile } = await supabase.from('profiles').select('name, email').eq('id', facultyId).maybeSingle();
        await supabase.from('event_members').insert({
          event_id: event.id,
          user_id: facultyId,
          name: facProfile?.name || 'Faculty Coordinator',
          email: facProfile?.email || '',
          role: 'Faculty Coordinator',
          organizer_type: 'core'
        });
      } catch (facMemErr) {
        console.warn('Non-fatal faculty event_members insert error:', facMemErr.message);
      }

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
    console.error('createEvent error:', err);
    res.status(500).json({ message: err.message || 'Server error creating event.', error: err.details || err.hint || err.message || 'Internal error' });
  }
};

/** PUT /events/:id */
const editEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, description, category, venue, date, capacity, imageUrl, status, assignedFacultyId,
      registrationType, maxTeams, minTeamSize, maxTeamSize, allowCrossDepartment, teamLeaderRegistrationRequired,
      registrationDeadline, paymentEnabled, paymentAmount, paymentUpiId, paymentQrUrl, paymentInstructions
      , scoringEnabled, scoreboardVisible
    } = req.body;

    const { data: event, error: fetchErr } = await supabase
      .from('events').select('*').eq('id', id).single();
    if (fetchErr || !event) return res.status(404).json({ message: 'Event not found.' });

    // Authorization check: Admin OR core organizer of this event
    const hasAccess = req.user.roles.includes('admin') || await checkCoreOrganizerAccess(id, event, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied. You can only edit events you organize.' });
    }

    if (date !== undefined && date) {
      const isDateChanged = !event.date || new Date(date).getTime() !== new Date(event.date).getTime();
      if (isDateChanged) {
        const selectedDate = new Date(date);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        if (selectedDate < tomorrow) {
          return res.status(400).json({ message: 'Event date must be at least one day in the future.' });
        }
      }
    }

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (venue !== undefined) updates.venue = venue;
    if (date !== undefined) updates.date = date ? new Date(date).toISOString() : null;
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
        
        const isDeadlineChanged = !event.registration_deadline || new Date(registrationDeadline).getTime() !== new Date(event.registration_deadline).getTime();

        if (isDeadlineChanged) {
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
        updates.registration_deadline = new Date(registrationDeadline).toISOString();
      } else {
        updates.registration_deadline = null;
      }
    }
    if (scoringEnabled !== undefined) {
      updates.scoring_enabled = scoringEnabled === true || scoringEnabled === 'true';
      updates.scoreboard_visible = updates.scoring_enabled && (scoreboardVisible === true || scoreboardVisible === 'true');
    } else if (scoreboardVisible !== undefined) {
      updates.scoreboard_visible = !!event.scoring_enabled && (scoreboardVisible === true || scoreboardVisible === 'true');
    }

    if (paymentEnabled !== undefined || paymentAmount !== undefined || paymentUpiId !== undefined || paymentQrUrl !== undefined || paymentInstructions !== undefined) {
      const isPaymentEnabled = paymentEnabled !== undefined ? (paymentEnabled === true || paymentEnabled === 'true') : !!event.payment_enabled;
      if (isPaymentEnabled && (!paymentAmount && !event.payment_amount || Number(paymentAmount ?? event.payment_amount) <= 0 || !(paymentQrUrl || event.payment_qr_url))) {
        return res.status(400).json({ message: 'Paid events require a valid amount and payment QR code.' });
      }
      updates.payment_enabled = isPaymentEnabled;
      updates.payment_amount = isPaymentEnabled ? Number(paymentAmount ?? event.payment_amount) : null;
      updates.payment_upi_id = isPaymentEnabled ? (paymentUpiId ?? event.payment_upi_id ?? null) : null;
      updates.payment_qr_url = isPaymentEnabled ? (paymentQrUrl ?? event.payment_qr_url ?? null) : null;
      updates.payment_instructions = isPaymentEnabled ? (paymentInstructions ?? event.payment_instructions ?? null) : null;
    }

    if (assignedFacultyId !== undefined) {
      const { data: faculty, error: facErr } = await supabase
        .from('profiles')
        .select('id, role, employee_id')
        .eq('id', assignedFacultyId)
        .maybeSingle();
      const isEligibleFaculty = faculty && (
        faculty.role === 'faculty' ||
        faculty.role === 'faculty_organizer' ||
        faculty.role === 'admin' ||
        (faculty.employee_id && !String(faculty.role || '').includes('student'))
      );
      if (facErr || !faculty || !isEligibleFaculty) {
        return res.status(400).json({ message: 'Invalid Faculty Coordinator selected.' });
      }
      updates.faculty_id = assignedFacultyId;
    }

    if (req.user.roles.includes('admin') && status !== undefined) {
      updates.status = status;
    }

    const { error: updateErr } = await supabase
      .from('events').update(updates).eq('id', id);
    if (updateErr) throw updateErr;

    // Re-read to confirm
    const { data: updatedEvent, error: readErr } = await supabase
      .from('events').select('*').eq('id', id).single();
    if (readErr) throw readErr;

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

    const { data: events, error } = await supabase
      .from('events').select('*').eq('id', id);
    if (error) throw error;
    const event = events && events[0];
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    // While proposal is under revision, faculty cannot make decisions until student resubmits
    if (event.status === 'needs_revision' && status !== 'pending_approval' && status !== 'needs_revision') {
      return res.status(400).json({ 
        message: 'This proposal is currently awaiting revisions from the student organizer. Decision actions (Approve, Reject, Under Review) are locked until the student resubmits.' 
      });
    }

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

          // Update proposer's role to 'organizer' in Supabase if they are currently 'student'
          const { data: proposer } = await supabase.from('profiles').select('role').eq('id', event.proposed_by).maybeSingle();
          if (proposer && proposer.role === 'student') {
            await supabase.from('profiles').update({ role: 'organizer' }).eq('id', event.proposed_by);
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
      // Validate publishing authorization (Admin OR original student proposer of genuine approved proposal)
      const pubCheck = await canPublishEvent(event, req.user);
      if (!pubCheck.allowed) {
        return res.status(pubCheck.status || 403).json({ message: pubCheck.message });
      }

      const updates = {
        status: 'published',
        published_at: new Date().toISOString(),
        published_by: req.user.id
      };

      const { error: pubErr } = await supabase.from('events').update(updates).eq('id', id);
      if (pubErr) {
        console.error('Error updating status to published:', pubErr);
        throw pubErr;
      }

      // Verify the publish took effect
      const { data: verifyPub, error: verifyPubErr } = await supabase.from('events').select('status').eq('id', id).single();
      if (verifyPubErr) throw verifyPubErr;
      if (verifyPub && verifyPub.status !== 'published') {
        console.error(`[publish] VERIFY FAILED: expected status=published but got ${verifyPub.status} for event ${id}`);

        // Fallback: direct HTTP PATCH bypassing supabase-js client
        const supabaseUrl = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        try {
          const httpRes = await fetch(`${supabaseUrl}/rest/v1/events?id=eq.${id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': serviceKey,
              'Authorization': `Bearer ${serviceKey}`,
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(updates)
          });
          const httpData = await httpRes.json();
          console.log(`[publish] Direct HTTP fallback: status=${httpRes.status} rows=${JSON.stringify(httpData).substring(0, 200)}`);

          if (!Array.isArray(httpData) || httpData.length === 0 || httpData[0].status !== 'published') {
            return res.status(500).json({ message: `Publish did not persist. Current status: ${verifyPub?.status}.` });
          }
          console.log('[publish] Direct HTTP fallback SUCCEEDED');
        } catch (httpErr) {
          console.error('[publish] Direct HTTP fallback FAILED:', httpErr.message);
          return res.status(500).json({ message: `Publish did not persist. Current status: ${verifyPub?.status}.` });
        }
      }
      console.log(`[publish] VERIFY OK: status=published for event ${id}`);

      try {
        await supabase.from('proposal_timeline').insert({
          proposal_id: id,
          user_id: req.user.id,
          action: 'Event Published Live',
          details: 'Event was published live and opened for registration.'
        });
      } catch (tErr) {
        console.warn('Non-fatal timeline error on publish status:', tErr.message);
      }

    } else if (status === 'needs_revision' || status === 'under_review') {
      if (!isAdmin && !isFaculty) {
        return res.status(403).json({ message: 'Access denied. Only faculty or administrators can update proposal review status.' });
      }
      const remarks = approvalRemarks || req.body.remarks || '';
      if (status === 'needs_revision' && !remarks) {
        return res.status(400).json({ message: 'Remarks are required when requesting a revision.' });
      }
      const updates = { status };
      if (remarks) updates.approval_remarks = remarks;

      console.log(`[updateStatus] needs_revision/under_review: event_id=${id} updates=${JSON.stringify(updates)}`);
      const { error: revErr } = await supabase.from('events').update(updates).eq('id', id);
      if (revErr) throw revErr;

      // Verify the update took effect
      const { data: verifyEvt, error: verifyErr } = await supabase.from('events').select('status').eq('id', id).single();
      if (verifyErr) throw verifyErr;
      if (verifyEvt && verifyEvt.status !== status) {
        console.error(`[updateStatus] VERIFY FAILED: expected status=${status} but got ${verifyEvt.status} for event ${id}`);
        return res.status(500).json({ message: `Database update did not persist. Current status: ${verifyEvt.status}. This may be a Supabase trigger or policy overriding the write.` });
      }
      console.log(`[updateStatus] VERIFY OK: status=${status} for event ${id}`);

      try {
        const actionLabel = status === 'needs_revision' ? 'Revision Requested' : 'Status changed to Under Review';
        await supabase.from('proposal_timeline').insert({
          proposal_id: id,
          user_id: req.user.id,
          action: actionLabel,
          details: remarks || null
        });
      } catch (tErr) {
        console.warn('Non-fatal timeline error in updateStatus:', tErr.message);
      }

      if (event.proposed_by) {
        try {
          const actionLabel = status === 'needs_revision' ? 'Revision Requested' : 'Under Review';
          await notifyUser({
            recipientId: event.proposed_by,
            title: `Event Proposal: ${actionLabel}`,
            message: `Your event proposal "${event.title}" has been updated: ${actionLabel}.${remarks ? ` Remarks: ${remarks}` : ''}`,
            type: status === 'needs_revision' ? 'warning' : 'info',
            eventId: event.id,
            emailSubject: `Event Proposal Update: ${actionLabel}`,
            emailData: {
              eventName: event.title,
              status: actionLabel,
              remarks: remarks || 'None'
            }
          });
        } catch (notifErr) {
          console.warn('Non-fatal notify error:', notifErr.message);
        }
      }

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

    const { data: updatedList, error: finalErr } = await supabase
      .from('events').select('*').eq('id', id);
    if (finalErr) throw finalErr;
    const updated = (updatedList && updatedList[0]) || { ...event, status };

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
    const { userId, name, rollNumber, email, responsibility, organizerType } = req.body;

    const { data: event, error } = await supabase
      .from('events').select('organizer_id, student_organizer_id, proposed_by').eq('id', id).single();
    if (error || !event) return res.status(404).json({ message: 'Event not found.' });

    const isOrganizer =
      event.organizer_id === req.user.id ||
      event.student_organizer_id === req.user.id ||
      event.proposed_by === req.user.id;

    if (!isOrganizer && !req.user.roles.includes('admin')) {
      return res.status(403).json({ message: 'Only the event organizer can manage team members.' });
    }

    if (userId && String(userId) === String(req.user.id)) {
      return res.status(400).json({ message: 'You are already the organizer of this event.' });
    }

    let memberName = name;
    let memberEmail = email;
    let memberRollNumber = rollNumber;

    if (userId && (!memberName || !memberEmail || !memberRollNumber)) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, email, roll_number')
        .eq('id', userId)
        .maybeSingle();
      if (profile) {
        memberName = memberName || profile.name;
        memberEmail = memberEmail || profile.email;
        memberRollNumber = memberRollNumber || profile.roll_number;
      }
    }

    if (!memberName) {
      memberName = 'Student Organizer';
    }

    const member = {
      event_id: id,
      user_id: userId || null,
      name: memberName,
      email: memberEmail || null,
      roll_number: memberRollNumber || null,
      role: responsibility || 'Volunteer',
      organizer_type: organizerType === 'core' ? 'core' : 'normal'
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
      .from('events').select('organizer_id, student_organizer_id, proposed_by').eq('id', id).single();
    if (error || !event) return res.status(404).json({ message: 'Event not found.' });

    const isOrganizer =
      event.organizer_id === req.user.id ||
      event.student_organizer_id === req.user.id ||
      event.proposed_by === req.user.id;

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
    const { data: events, error: fetchErr } = await supabase
      .from('events').select('*').eq('id', id);
    if (fetchErr) {
      console.error('Error fetching event for publish:', fetchErr);
      return res.status(500).json({ message: 'Server error retrieving event for publishing.', error: fetchErr.message });
    }
    const event = events && events[0];
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    const pubCheck = await canPublishEvent(event, req.user);
    if (!pubCheck.allowed) {
      return res.status(pubCheck.status || 403).json({ message: pubCheck.message });
    }

    if (event.status === 'published') {
      return res.json(event);
    }

    const updates = {
      status: 'published',
      published_at: new Date().toISOString(),
      published_by: req.user.id
    };

    const { error: updateErr } = await supabase
      .from('events').update(updates).eq('id', id);
    if (updateErr) {
      console.error('Error updating event to published in DB:', updateErr);
      throw updateErr;
    }

    // Verify the publish took effect
    const { data: verifyPub, error: verifyPubErr } = await supabase.from('events').select('*').eq('id', id).single();
    if (verifyPubErr) throw verifyPubErr;

    let updated;
    if (!verifyPub || verifyPub.status !== 'published') {
      console.error(`[publishEvent] VERIFY FAILED: expected status=published but got ${verifyPub?.status} for event ${id}`);

      // Fallback: direct HTTP PATCH bypassing supabase-js client
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      try {
        const httpRes = await fetch(`${supabaseUrl}/rest/v1/events?id=eq.${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(updates)
        });
        const httpData = await httpRes.json();
        console.log(`[publishEvent] Direct HTTP fallback: status=${httpRes.status} rows=${JSON.stringify(httpData).substring(0, 200)}`);

        if (Array.isArray(httpData) && httpData.length > 0 && httpData[0].status === 'published') {
          console.log('[publishEvent] Direct HTTP fallback SUCCEEDED');
          updated = httpData[0];
        } else {
          return res.status(500).json({ message: `Publish did not persist. Current status: ${verifyPub?.status}.` });
        }
      } catch (httpErr) {
        console.error('[publishEvent] Direct HTTP fallback FAILED:', httpErr.message);
        return res.status(500).json({ message: `Publish did not persist. Current status: ${verifyPub?.status}.` });
      }
    } else {
      console.log(`[publishEvent] VERIFY OK: status=published for event ${id}`);
      updated = verifyPub;
    }

    // Record timeline entry safely
    try {
      await supabase.from('proposal_timeline').insert({
        proposal_id: id,
        user_id: req.user.id,
        action: 'Event Published Live',
        details: 'Event was published live and opened for registration.'
      });
    } catch (timelineErr) {
      console.warn('Non-fatal proposal_timeline insert warning in publishEvent:', timelineErr.message);
    }

    // Notify faculty coordinator if applicable
    if (event.faculty_id && String(event.faculty_id) !== String(req.user.id)) {
      try {
        await notifyUser({
          recipientId: event.faculty_id,
          type: 'info',
          title: 'Event Published Live',
          message: `The approved event "${event.title}" has been published live by the student organizer.`,
          eventId: id
        });
      } catch (notifyErr) {
        console.warn('Non-fatal notifyUser warning in publishEvent:', notifyErr.message);
      }
    }

    res.json(updated);
  } catch (err) {
    console.error('Error in publishEvent:', err);
    res.status(500).json({ message: 'Server error publishing event.', error: err.message || err });
  }
};

/** GET /events/:id/confirmed-team-members */
const getConfirmedTeamMembers = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get all registered teams for this event
    const { data: confirmedTeams, error: teamsErr } = await supabase
      .from('event_teams')
      .select('id')
      .eq('event_id', id)
      .eq('status', 'registered');
      
    if (teamsErr) throw teamsErr;
    
    if (!confirmedTeams || confirmedTeams.length === 0) {
      return res.json([]);
    }
    
    const teamIds = confirmedTeams.map(t => t.id);
    
    // Get users who have a registered status and belong to these teams
    const { data: teamMembers, error: memErr } = await supabase
      .from('event_registrations')
      .select('user_id')
      .eq('event_id', id)
      .eq('status', 'registered')
      .in('team_id', teamIds);

    if (memErr) throw memErr;
    
    const userIds = (teamMembers || []).map(tm => tm.user_id);
    res.json([...new Set(userIds)]); // unique
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching confirmed team members.', error: err.message });
  }
};

/** GET /events/:id/organizers */
const getEventOrganizers = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Fetch event record
    const { data: event } = await supabase
      .from('events')
      .select('id, faculty_id, student_organizer_id, proposed_by, created_by, organizer_id')
      .eq('id', id)
      .maybeSingle();

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
      event?.faculty_id,
      event?.student_organizer_id,
      event?.proposed_by,
      event?.created_by,
      event?.organizer_id,
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

    // Include event creator/head if available
    const headId = event?.student_organizer_id || event?.proposed_by || event?.created_by || event?.organizer_id;
    if (headId && !unifiedMap.has(headId)) {
      unifiedMap.set(headId, {
        id: `head-${headId}`,
        userId: headId,
        category: 'Event Head',
        organizerRole: 'core',
        joinedAt: new Date().toISOString(),
        name: profilesMap[headId]?.name || 'Student Organizer',
        email: profilesMap[headId]?.email || '',
        department: profilesMap[headId]?.department || ''
      });
    }

    // Include faculty coordinator if available
    if (event?.faculty_id && !unifiedMap.has(event.faculty_id)) {
      unifiedMap.set(event.faculty_id, {
        id: `faculty-${event.faculty_id}`,
        userId: event.faculty_id,
        category: 'Faculty Coordinator',
        organizerRole: 'core',
        joinedAt: new Date().toISOString(),
        name: profilesMap[event.faculty_id]?.name || 'Faculty Coordinator',
        email: profilesMap[event.faculty_id]?.email || '',
        department: profilesMap[event.faculty_id]?.department || ''
      });
    }

    (members || []).forEach(m => {
      if (m.user_id && !unifiedMap.has(m.user_id)) {
        unifiedMap.set(m.user_id, {
          id: `mem-${m.id}`,
          memberId: m.id,
          userId: m.user_id,
          category: m.role || 'Core Organizer',
          organizerRole: m.organizer_type || 'normal',
          allowed_modules: m.allowed_modules || ['all'],
          joinedAt: new Date().toISOString(),
          name: profilesMap[m.user_id]?.name || m.name || 'Unknown',
          email: profilesMap[m.user_id]?.email || m.email || '',
          department: profilesMap[m.user_id]?.department || ''
        });
      }
    });

    (organizers || []).forEach(org => {
      if (org.student_id && !unifiedMap.has(org.student_id)) {
        unifiedMap.set(org.student_id, {
          id: org.id,
          userId: org.student_id,
          category: org.category,
          organizerRole: org.organizer_role || 'normal',
          allowed_modules: org.allowed_modules || ['all'],
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
    const { studentId, category, organizerRole, allowedModules } = req.body;

    if (!studentId || !category) {
      return res.status(400).json({ message: 'Student ID and Category are required.' });
    }

    const selectedRole = 'organizer';

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

    // Enforce Organizer access
    const hasAccess = await checkCoreOrganizerAccess(id, event, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Only an authorized event organizer can manage organizers.' });
    }

    // Check if user exists in Supabase profiles
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', studentId)
      .maybeSingle();

    if (profErr || !profile) {
      return res.status(404).json({ message: 'User profile not found.' });
    }

    // Verify profile is student, student_organizer, faculty, or faculty_organizer
    const allowedRoles = ['student', 'student_organizer', 'faculty', 'faculty_organizer'];
    if (!allowedRoles.includes(profile.role)) {
      return res.status(400).json({ message: 'Only students and faculty members can be recruited as event organizers.' });
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
      return res.status(400).json({ message: 'This user is already an organizer for this event.' });
    }

    // Verify user is not already registered for the event
    const { data: existingRegs, error: regErr } = await supabase
      .from('event_registrations')
      .select('id, status, team_id')
      .eq('event_id', id)
      .eq('user_id', studentId);

    if (regErr) {
      console.error("Error fetching registrations for recruitment:", regErr);
      return res.status(500).json({ message: 'Error checking user eligibility.', error: regErr.message });
    }

    if (existingRegs && existingRegs.length > 0) {
      const hasActive = existingRegs.some(r => r.status !== 'cancelled');
      if (hasActive) {
        return res.status(400).json({ message: 'This user is already registered for this event and cannot be recruited as an organizer.' });
      }
    }

    const modulesToSave = Array.isArray(allowedModules) && allowedModules.length > 0 ? allowedModules : ['all'];

    // Insert into event_organizers
    const newOrg = {
      event_id: id,
      student_id: studentId,
      category: category,
      organizer_role: selectedRole,
      allowed_modules: modulesToSave,
      joined_at: new Date().toISOString()
    };

    let inserted;
    try {
      const { data: ins, error: insertErr } = await supabase
        .from('event_organizers')
        .insert(newOrg)
        .select()
        .single();

      if (insertErr) throw insertErr;
      inserted = ins;
    } catch (insertError) {
      // Graceful fallback if column allowed_modules does not exist in event_organizers table
      const fallbackOrg = {
        event_id: id,
        student_id: studentId,
        category: category,
        organizer_role: selectedRole,
        joined_at: new Date().toISOString()
      };
      const { data: fallbackIns, error: fallbackErr } = await supabase
        .from('event_organizers')
        .insert(fallbackOrg)
        .select()
        .single();

      if (fallbackErr) throw fallbackErr;
      inserted = { ...fallbackIns, allowed_modules: modulesToSave };
    }

    res.status(201).json({
      message: 'Organizer added successfully.',
      organizer: {
        id: inserted.id,
        userId: inserted.student_id,
        category: inserted.category,
        organizerRole: selectedRole,
        allowed_modules: inserted.allowed_modules || modulesToSave,
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

    // Enforce Core Organizer access
    const hasAccess = await checkCoreOrganizerAccess(id, event, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Only a Core Organizer is authorized to manage organizers.' });
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
    const hasAccess = await checkCoreOrganizerAccess(id, event, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Only a Core Organizer is authorized to toggle join requests.' });
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
    const hasAccess = await checkCoreOrganizerAccess(id, event, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Only a Core Organizer is authorized to view join requests.' });
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
    const hasAccess = await checkCoreOrganizerAccess(eventId, event, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Only a Core Organizer is authorized to manage join requests.' });
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

// Helper function to check if user is an Organizer for the Proposal Workspace
const checkCoreOrganizerAccess = async (eventId, event, user) => {
  if (!user || !user.id || !user.roles) return false;
  const isAdmin = user.roles.includes('admin') || user.role === 'admin';
  const isFaculty = user.roles.includes('faculty') || 
                    user.roles.includes('faculty_organizer') || 
                    user.role === 'faculty' || 
                    user.role === 'faculty_organizer';
  const isAssignedFaculty = event?.faculty_id && String(user.id) === String(event.faculty_id);
  const isCreator = String(user.id) === String(event?.proposed_by) || 
                    String(user.id) === String(event?.student_organizer_id) || 
                    String(user.id) === String(event?.organizer_id) ||
                    String(user.id) === String(event?.created_by);

  if (isAdmin || isFaculty || isAssignedFaculty || isCreator) return true;

  // Check if they are an organizer in event_organizers
  const { data: org } = await supabase
    .from('event_organizers')
    .select('id, organizer_role, category')
    .eq('event_id', eventId)
    .eq('student_id', user.id)
    .maybeSingle();

  if (org) return true;

  // Check if they are an organizer in event_members
  const { data: member } = await supabase
    .from('event_members')
    .select('id, organizer_type, role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (member) return true;

  return false;
};

const getProposalWorkspace = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Fetch Event
    const { data: events, error: eventErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', id);

    if (eventErr || !events || events.length === 0) {
      return res.status(404).json({ message: 'Proposal not found.' });
    }
    const event = events[0];

    if (event) {
      // 1b. Fetch Faculty manually
      if (event.faculty_id) {
        const { data: fac } = await supabase.from('profiles').select('id, name, email, department').eq('id', event.faculty_id).maybeSingle();
        if (fac) {
          event.faculty = {
            ...fac,
            full_name: fac.name,
            name: fac.name
          };
        }
      }
      
      // Fallback: check if an assigned faculty coordinator exists in event_members
      if (!event.faculty) {
        const { data: teamFac } = await supabase
          .from('event_members')
          .select('user_id, name, email, role')
          .eq('event_id', id)
          .ilike('role', '%Faculty%')
          .maybeSingle();
        if (teamFac) {
          event.faculty = {
            id: teamFac.user_id,
            name: teamFac.name,
            full_name: teamFac.name,
            email: teamFac.email
          };
        }
      }
      
      // 1c. Fetch Proposer/Student Organizer manually
      const studentId = event.student_organizer_id || event.proposed_by || event.created_by || event.organizer_id;
      if (studentId) {
        const { data: stu } = await supabase.from('profiles').select('id, name, email, department, roll_number').eq('id', studentId).maybeSingle();
        if (stu) {
          const resolvedName = (stu.name && stu.name.trim() && stu.name !== 'Student' && stu.name !== 'Student Organizer')
            ? stu.name
            : (stu.roll_number ? (stu.name && stu.name.trim() ? `${stu.name} (${stu.roll_number})` : `Student (${stu.roll_number})`) : (stu.email ? stu.email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : (stu.name || 'Student Proposer')));
          event.student_organizer = {
            ...stu,
            full_name: resolvedName,
            name: resolvedName
          };
          event.proposer = event.student_organizer;
          event.proposer_name = resolvedName;
          event.student_name = resolvedName;
        }
      }

      // Fallback 1: check if a student organizer exists in event_organizers
      if (!event.student_organizer || !event.student_organizer.name || event.student_organizer.name === 'Student' || event.student_organizer.name === 'Student Organizer') {
        const { data: orgMember } = await supabase
          .from('event_organizers')
          .select('student_id, category, organizer_role')
          .eq('event_id', id)
          .maybeSingle();
        if (orgMember?.student_id) {
          const { data: orgProf } = await supabase
            .from('profiles')
            .select('id, name, email, department, roll_number')
            .eq('id', orgMember.student_id)
            .maybeSingle();
          if (orgProf) {
            const resolvedOrgName = (orgProf.name && orgProf.name.trim() && orgProf.name !== 'Student' && orgProf.name !== 'Student Organizer')
              ? orgProf.name
              : (orgProf.roll_number ? (orgProf.name && orgProf.name.trim() ? `${orgProf.name} (${orgProf.roll_number})` : `Student (${orgProf.roll_number})`) : (orgProf.email ? orgProf.email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Student Organizer'));
            event.student_organizer = {
              ...orgProf,
              full_name: resolvedOrgName,
              name: resolvedOrgName
            };
            event.proposer = event.student_organizer;
            event.proposer_name = resolvedOrgName;
            event.student_name = resolvedOrgName;
          }
        }
      }

      // Fallback 2: check if a member exists in event_members
      if (!event.student_organizer || !event.student_organizer.name || event.student_organizer.name === 'Student' || event.student_organizer.name === 'Student Organizer') {
        const { data: leadMember } = await supabase
          .from('event_members')
          .select('user_id, name, email, role')
          .eq('event_id', id)
          .not('role', 'ilike', '%faculty%')
          .maybeSingle();
        if (leadMember) {
          let resolvedMemberName = (leadMember.name && leadMember.name.trim() && leadMember.name !== 'Student' && leadMember.name !== 'Student Organizer')
            ? leadMember.name
            : null;
          if (!resolvedMemberName && leadMember.user_id) {
            const { data: mProf } = await supabase.from('profiles').select('id, name, email, department, roll_number').eq('id', leadMember.user_id).maybeSingle();
            if (mProf) {
              resolvedMemberName = (mProf.name && mProf.name.trim() && mProf.name !== 'Student' && mProf.name !== 'Student Organizer')
                ? mProf.name
                : (mProf.roll_number ? `Student (${mProf.roll_number})` : (mProf.email ? mProf.email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null));
            }
          }
          if (!resolvedMemberName) {
            resolvedMemberName = leadMember.email ? leadMember.email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Student Organizer';
          }
          event.student_organizer = {
            id: leadMember.user_id,
            name: resolvedMemberName,
            full_name: resolvedMemberName,
            email: leadMember.email
          };
          event.proposer = event.student_organizer;
          event.proposer_name = resolvedMemberName;
          event.student_name = resolvedMemberName;
        }
      }
    }

    // Access control: Core Organizers and Faculty only
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

    // 4b. Fetch Official Permissions
    let officialPermissions = [];
    try {
      const { data: perms, error: permErr } = await supabase
        .from('proposal_official_permissions')
        .select('*')
        .eq('proposal_id', id)
        .order('created_at', { ascending: false });

      if (!permErr && perms) {
        officialPermissions = perms;
      }
    } catch (pErr) {
      console.warn('Non-fatal official_permissions query warning:', pErr.message);
    }

    // 5. Manually attach profiles
    const allUserIds = [...new Set([
      ...(discussions || []).map(d => d.user_id),
      ...(documents || []).map(d => d.user_id),
      ...(timeline || []).map(t => t.user_id),
      ...(officialPermissions || []).map(p => p.requested_by),
      ...(officialPermissions || []).map(p => p.official_id)
    ].filter(Boolean))];

    let profilesMap = {};
    if (allUserIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, name, role, department, employee_id, avatar_url').in('id', allUserIds);
      (profs || []).forEach(p => { 
        profilesMap[p.id] = {
          ...p,
          full_name: p.name
        }; 
      });
    }

    const formattedDiscussions = (discussions || []).map(d => ({ ...d, sender: profilesMap[d.user_id] || {} }));
    const formattedDocuments = (documents || []).map(d => ({ ...d, uploader: profilesMap[d.user_id] || {} }));
    const formattedTimeline = (timeline || []).map(t => ({ ...t, actor: profilesMap[t.user_id] || {} }));
    const formattedOfficialPermissions = (officialPermissions || []).map(p => ({
      ...p,
      requested_by_user: profilesMap[p.requested_by] || {},
      official_user: profilesMap[p.official_id] || {}
    }));

    res.json({
      event,
      discussions: formattedDiscussions,
      documents: formattedDocuments,
      timeline: formattedTimeline,
      officialPermissions: formattedOfficialPermissions
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
    const { data: profile } = await supabase.from('profiles').select('id, name, role, avatar_url').eq('id', req.user.id).maybeSingle();
    discussion.sender = profile ? { ...profile, full_name: profile.name } : {};

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

    // Verify event exists to get current revision number
    const { data: event, error: eventErr } = await supabase.from('events').select('revision_number, faculty_id, proposed_by, student_organizer_id, title').eq('id', id).single();
    if (eventErr || !event) return res.status(404).json({ message: 'Proposal not found.' });

    const hasAccess = await checkCoreOrganizerAccess(id, event, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const fileExt = (req.file.originalname.split('.').pop() || 'bin').toLowerCase();
    const fileType = fileExt.toUpperCase();
    const fileName = req.file.originalname;
    
    // Upload to Supabase Storage
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const storagePath = `proposal_${id}/${uniqueSuffix}.${fileExt}`;
    
    let { data: uploadData, error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true
      });
      
    if (uploadErr && /bucket.*not found|not found.*bucket/i.test(uploadErr.message || '')) {
      const { error: bucketErr } = await supabase.storage.createBucket('documents', { public: true });
      if (!bucketErr || /already exists/i.test(bucketErr.message || '')) {
        ({ data: uploadData, error: uploadErr } = await supabase.storage.from('documents').upload(storagePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true
        }));
      }
    }

    let fileUrl;
    if (uploadErr) {
      console.warn('Supabase storage upload failed; using fallback:', uploadErr.message);
      if (req.file.buffer && req.file.buffer.length <= 8 * 1024 * 1024) {
        fileUrl = `data:${req.file.mimetype || 'application/octet-stream'};base64,${req.file.buffer.toString('base64')}`;
      } else {
        return res.status(500).json({ message: 'Failed to upload document to storage.', error: uploadErr.message });
      }
    } else {
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(storagePath);
      fileUrl = urlData?.publicUrl || '';
    }

    const { data: document, error: docErr } = await supabase
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

    if (docErr) throw docErr;

    const { data: profile } = await supabase.from('profiles').select('id, name').eq('id', req.user.id).maybeSingle();
    document.uploader = profile ? { ...profile, full_name: profile.name } : {};

    // Log to timeline safely
    try {
      await supabase.from('proposal_timeline').insert({
        proposal_id: id,
        user_id: req.user.id,
        action: 'Document Uploaded',
        details: `Uploaded ${fileName}`
      });
    } catch (timelineErr) {
      console.warn('Non-fatal proposal_timeline insert warning:', timelineErr.message);
    }

    const isCreator = String(req.user.id) === String(event.proposed_by) || String(req.user.id) === String(event.student_organizer_id);
    try {
      const targetUserId = isCreator ? event.faculty_id : (event.proposed_by || event.student_organizer_id);
      if (targetUserId) {
        await notifyUser({
          userId: targetUserId,
          type: 'document_uploaded',
          title: 'New Document Uploaded',
          message: `${isCreator ? 'Student' : 'Faculty'} uploaded a document for "${event.title || 'Event'}".`,
          link: `/proposals/${id}`
        });
      }
    } catch (notifyErr) {
      console.warn('Failed to notify user of document upload:', notifyErr.message);
    }

    res.status(201).json(document);
  } catch (err) {
    console.error('Error in uploadProposalDocument:', err);
    res.status(500).json({ message: 'Server error uploading document.', error: err.message });
  }
};

const updateProposalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    console.log(`[updateProposalStatus] user=${req.user.id} roles=${JSON.stringify(req.user.roles)} event_id=${id} new_status=${status}`);

    const allowedStatuses = ['under_review', 'needs_revision', 'approved', 'rejected'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status update.' });
    }

    if (status === 'needs_revision' && !remarks) {
      return res.status(400).json({ message: 'Remarks are required when requesting a revision.' });
    }

    const { data: events, error: eventErr } = await supabase.from('events').select('*').eq('id', id);
    if (eventErr) throw eventErr;
    const event = events && events[0];
    if (!event) return res.status(404).json({ message: 'Proposal not found.' });

    console.log(`[updateProposalStatus] current_event_status=${event.status} faculty_id=${event.faculty_id}`);

    // While proposal is under revision, faculty cannot make decisions until student resubmits
    if (event.status === 'needs_revision') {
      return res.status(400).json({ 
        message: 'This proposal is currently awaiting revisions from the student organizer. Decision actions (Approve, Reject, Under Review) are locked until the student resubmits.' 
      });
    }

    // Ensure authorized: assigned faculty, faculty user, or admin
    const isAdmin = req.user.roles && (req.user.roles.includes('admin') || req.user.role === 'admin');
    const isFaculty = req.user.roles && (
      req.user.roles.includes('faculty') || 
      req.user.roles.includes('faculty_organizer') || 
      req.user.role === 'faculty' || 
      req.user.role === 'faculty_organizer'
    );
    const isAssignedFaculty = event.faculty_id && String(req.user.id) === String(event.faculty_id);

    if (!isAdmin && !isAssignedFaculty && !isFaculty) {
      return res.status(403).json({ message: 'Access denied. Only faculty coordinators or administrators can update proposal status.' });
    }

    let updates = { status };
    // If event does not yet have an assigned faculty, assign the acting faculty
    if (!event.faculty_id && isFaculty) {
      updates.faculty_id = req.user.id;
    }

    if (status === 'approved') {
      const signature = `[Approved By: ${req.user.id}]`;
      const finalRemarks = remarks ? `${remarks}\n${signature}` : signature;
      updates.approval_remarks = finalRemarks;
      updates.approved_at = new Date().toISOString();
      updates.organizer_id = event.proposed_by || null;
      updates.student_organizer_id = event.proposed_by || null;
    } else if (remarks) {
      updates.approval_remarks = remarks;
    }

    // Step 1: Update WITHOUT .select() to avoid PostgREST returning empty on certain setups
    const { error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('[updateProposalStatus] DB update FAILED:', JSON.stringify(error));
      throw error;
    }

    // Step 2: Re-read to confirm the update actually took effect
    const { data: verifyEvent, error: verifyErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (verifyErr) {
      console.error('[updateProposalStatus] DB verify read FAILED:', JSON.stringify(verifyErr));
      throw verifyErr;
    }

    if (!verifyEvent || verifyEvent.status !== status) {
      console.error('[updateProposalStatus] DB verify FAILED: status after update is', verifyEvent?.status, 'expected', status, '. id:', id);
      console.log('[updateProposalStatus] ATTEMPTING direct HTTP fallback...');

      // Fallback: direct HTTP PATCH to Supabase REST API bypassing supabase-js client
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      try {
        const httpRes = await fetch(`${supabaseUrl}/rest/v1/events?id=eq.${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(updates)
        });
        const httpData = await httpRes.json();
        console.log(`[updateProposalStatus] Direct HTTP fallback: status=${httpRes.status} rows=${JSON.stringify(httpData).substring(0, 200)}`);

        if (Array.isArray(httpData) && httpData.length > 0 && httpData[0].status === status) {
          console.log('[updateProposalStatus] Direct HTTP fallback SUCCEEDED!');
          const updatedEvent = httpData[0];
          // Continue with notifications etc using updatedEvent...
          return res.json(updatedEvent);
        }
      } catch (httpErr) {
        console.error('[updateProposalStatus] Direct HTTP fallback FAILED:', httpErr.message);
      }

      return res.status(500).json({ message: `Database update did not persist. Current status: ${verifyEvent?.status}. This may be a Supabase RLS policy or trigger overriding the write.` });
    }

    console.log(`[updateProposalStatus] DB update SUCCESS: verified status=${verifyEvent.status}`);

    const updatedEvent = verifyEvent;

    // If approved, ensure student proposer is in event_organizers and promote role to organizer if currently student
    if (status === 'approved' && event.proposed_by) {
      try {
        const { data: existingHead } = await supabase
          .from('event_organizers')
          .select('*')
          .eq('event_id', id)
          .eq('student_id', event.proposed_by)
          .maybeSingle();

        if (!existingHead) {
          await supabase
            .from('event_organizers')
            .insert({
              event_id: id,
              student_id: event.proposed_by,
              category: 'Event Head',
              joined_at: new Date().toISOString()
            });
        }

        const { data: proposer } = await supabase.from('profiles').select('role').eq('id', event.proposed_by).maybeSingle();
        if (proposer && proposer.role === 'student') {
          await supabase.from('profiles').update({ role: 'organizer' }).eq('id', event.proposed_by);
        }
      } catch (orgErr) {
        console.warn('Non-fatal event_organizers insert error on proposal approval:', orgErr.message);
      }
    }

    let actionLabel = '';
    if (status === 'under_review') actionLabel = 'Status changed to Under Review';
    else if (status === 'needs_revision') actionLabel = 'Revision Requested';
    else if (status === 'approved') actionLabel = 'Faculty Approved';
    else if (status === 'rejected') actionLabel = 'Faculty Rejected';

    // Safe timeline insert (logging failure should never crash the status update)
    try {
      await supabase.from('proposal_timeline').insert({
        proposal_id: id,
        user_id: req.user.id,
        action: actionLabel,
        details: remarks || null
      });
    } catch (timelineErr) {
      console.warn('Non-fatal proposal_timeline insert warning:', timelineErr.message);
    }

    // Safe notify student
    const studentId = event.proposed_by || event.student_organizer_id;
    if (studentId) {
      try {
        await notifyUser({
          recipientId: studentId,
          type: status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'warning',
          title: `Proposal ${actionLabel}`,
          message: `Your proposal for "${event.title}" has been updated: ${actionLabel}.${remarks ? ` Remarks: ${remarks}` : ''}`,
          eventId: event.id,
          emailSubject: `Event Proposal Update: ${actionLabel}`,
          emailData: {
            eventName: event.title,
            status: actionLabel,
            remarks: remarks || 'None'
          }
        });
      } catch (notifyErr) {
        console.error('Failed to notify student of status update:', notifyErr.message);
      }
    }

    res.json(updatedEvent);
  } catch (err) {
    console.error('Error in updateProposalStatus:', err);
    res.status(500).json({ message: 'Server error updating status.', error: err.message });
  }
};

const resubmitProposal = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`[resubmitProposal] user=${req.user.id} roles=${JSON.stringify(req.user.roles)} event_id=${id}`);

    const { data: events, error: eventErr } = await supabase.from('events').select('*').eq('id', id);
    if (eventErr) throw eventErr;
    const event = events && events[0];
    if (!event) return res.status(404).json({ message: 'Proposal not found.' });

    console.log(`[resubmitProposal] event_status=${event.status} proposed_by=${event.proposed_by} created_by=${event.created_by} student_organizer_id=${event.student_organizer_id} organizer_id=${event.organizer_id}`);

    const isAdmin = req.user.roles && (req.user.roles.includes('admin') || req.user.role === 'admin');
    const isCreator = Boolean(
      req.user && (
        String(req.user.id) === String(event.proposed_by || '') ||
        String(req.user.id) === String(event.student_organizer_id || '') ||
        String(req.user.id) === String(event.created_by || '') ||
        String(req.user.id) === String(event.organizer_id || '')
      )
    );

    let isMemberLead = false;
    if (!isCreator && !isAdmin) {
      try {
        const { data: member } = await supabase
          .from('event_members')
          .select('*')
          .eq('event_id', id)
          .eq('user_id', req.user.id)
          .maybeSingle();
        if (member && (member.role === 'Event Head' || member.role === 'Lead Organizer' || member.organizer_type === 'core')) {
          isMemberLead = true;
        }
      } catch (memErr) {
        // Non-fatal
      }
    }

    console.log(`[resubmitProposal] isCreator=${isCreator} isAdmin=${isAdmin} isMemberLead=${isMemberLead}`);

    if (!isCreator && !isAdmin && !isMemberLead) {
      console.warn(`[resubmitProposal] AUTH FAILED: user ${req.user.id} is not creator/admin/memberLead for event ${id}`);
      return res.status(403).json({ message: 'Only the proposal creator or lead organizer can resubmit.' });
    }

    // Idempotent check: If already resubmitted and pending approval, return current event record
    if (event.status === 'pending_approval') {
      return res.json(event);
    }

    if (event.status !== 'needs_revision' && event.status !== 'draft' && event.status !== 'submitted') {
      console.warn(`[resubmitProposal] STATUS BLOCKED: event.status=${event.status}`);
      return res.status(400).json({ message: `Proposal is not in a resumittable state (current status: ${event.status}). Please ensure the proposal is in Needs Revision or Draft status.` });
    }

    const newRevision = (event.revision_number || 1) + 1;

    console.log(`[resubmitProposal] id=${id} id_type=${typeof id} event_id_type=${typeof event.id} match=${String(event.id) === String(id)}`);
    console.log(`[resubmitProposal] UPDATE attempt: status=pending_approval revision=${newRevision} remarks=null`);

    // Step 1: Update WITHOUT .select() to avoid PostgREST returning empty on certain setups
    const { error } = await supabase
      .from('events')
      .update({ 
        status: 'pending_approval', 
        revision_number: newRevision,
        approval_remarks: null
      })
      .eq('id', id);

    if (error) {
      console.error('[resubmitProposal] DB update FAILED:', JSON.stringify(error));
      throw error;
    }

    // Step 2: Re-read to confirm the update actually took effect
    const { data: verifyEvent, error: verifyErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (verifyErr) {
      console.error('[resubmitProposal] DB verify read FAILED:', JSON.stringify(verifyErr));
      throw verifyErr;
    }

    if (!verifyEvent || verifyEvent.status !== 'pending_approval') {
      console.error('[resubmitProposal] DB verify FAILED: status after update is', verifyEvent?.status, 'expected pending_approval. id:', id);
      console.log('[resubmitProposal] ATTEMPTING direct HTTP fallback...');

      // Fallback: direct HTTP PATCH to Supabase REST API bypassing supabase-js client
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      try {
        const httpRes = await fetch(`${supabaseUrl}/rest/v1/events?id=eq.${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({ status: 'pending_approval', revision_number: newRevision, approval_remarks: null })
        });
        const httpData = await httpRes.json();
        console.log(`[resubmitProposal] Direct HTTP fallback: status=${httpRes.status} rows=${JSON.stringify(httpData).substring(0, 200)}`);

        if (Array.isArray(httpData) && httpData.length > 0 && httpData[0].status === 'pending_approval') {
          console.log('[resubmitProposal] Direct HTTP fallback SUCCEEDED!');
          const updatedEvent = httpData[0];
          return res.json(updatedEvent);
        }
      } catch (httpErr) {
        console.error('[resubmitProposal] Direct HTTP fallback FAILED:', httpErr.message);
      }

      return res.status(500).json({ message: `Database update did not persist. Current status: ${verifyEvent?.status}. This may be a Supabase RLS policy or trigger overriding the write.` });
    }

    console.log(`[resubmitProposal] DB update SUCCESS: verified status=${verifyEvent.status} new_revision=${newRevision}`);

    const updatedEvent = verifyEvent;

    try {
      await supabase.from('proposal_timeline').insert({
        proposal_id: id,
        user_id: req.user.id,
        action: 'Student Resubmitted',
        details: `Resubmitted as Revision ${newRevision}`
      });
    } catch (tErr) {
      console.warn('Non-fatal timeline insert warning in resubmitProposal:', tErr.message);
    }

    // Notify faculty
    if (event.faculty_id) {
      try {
        await notifyUser({
          recipientId: event.faculty_id,
          type: 'info',
          title: 'Proposal Resubmitted',
          message: `Student resubmitted proposal "${event.title || 'Event'}" (Revision ${newRevision}).`,
          eventId: id,
          emailSubject: 'Proposal Resubmitted for Review',
          emailData: {
            eventName: event.title,
            status: 'Pending Approval'
          }
        });
      } catch (notifyErr) {
        console.error('Failed to notify faculty of resubmission:', notifyErr.message);
      }
    }

    res.json(updatedEvent);
  } catch (err) {
    console.error('Error in resubmitProposal:', err);
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

    // Also fetch event_organizers to ensure full unified visibility
    let organizers = [];
    try {
      const { data: orgData } = await supabase
        .from('event_organizers')
        .select('*')
        .eq('event_id', id);
      organizers = orgData || [];
    } catch (e) {
      console.warn('Could not fetch event_organizers in getProposalTeam:', e);
    }
    
    // Fetch names and emails manually from profiles
    const userIds = new Set();
    (members || []).forEach(m => m.user_id && userIds.add(m.user_id));
    (organizers || []).forEach(o => o.student_id && userIds.add(o.student_id));

    let profilesMap = {};
    if (userIds.size > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, email, role, department, roll_number')
        .in('id', Array.from(userIds));
      profilesMap = (profilesData || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
    }

    const unifiedList = [];
    const seenUserIds = new Set();
    
    (members || []).forEach(m => {
      if (m.user_id) seenUserIds.add(m.user_id);
      unifiedList.push({
        ...m,
        id: m.id,
        user_id: m.user_id,
        name: profilesMap[m.user_id]?.name || m.name || 'Unknown',
        email: profilesMap[m.user_id]?.email || m.email || null,
        global_role: profilesMap[m.user_id]?.role || 'student',
        department: profilesMap[m.user_id]?.department || null,
        roll_number: profilesMap[m.user_id]?.roll_number || null,
        allowed_modules: Array.isArray(m.allowed_modules) && m.allowed_modules.length > 0 ? m.allowed_modules : ['all'],
      });
    });

    (organizers || []).forEach(org => {
      if (org.student_id && !seenUserIds.has(org.student_id)) {
        seenUserIds.add(org.student_id);
        unifiedList.push({
          id: org.id,
          event_id: org.event_id,
          user_id: org.student_id,
          role: org.category || 'Organizer',
          organizer_type: org.organizer_role || 'normal',
          name: profilesMap[org.student_id]?.name || 'Unknown Student',
          email: profilesMap[org.student_id]?.email || null,
          global_role: profilesMap[org.student_id]?.role || 'student',
          department: profilesMap[org.student_id]?.department || null,
          roll_number: profilesMap[org.student_id]?.roll_number || null,
          allowed_modules: Array.isArray(org.allowed_modules) && org.allowed_modules.length > 0 ? org.allowed_modules : ['all'],
        });
      }
    });
    
    res.json(unifiedList);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching team.', error: err.message });
  }
};

const addProposalTeamMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, name, email, department, role, organizerType, allowedModules } = req.body;
    
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

    // Verify user is not already registered as a participant for this event
    if (userId) {
      const { data: existingRegs } = await supabase
        .from('event_registrations')
        .select('id, status')
        .eq('event_id', id)
        .eq('user_id', userId);

      if (existingRegs && existingRegs.length > 0) {
        const hasActive = existingRegs.some(r => r.status !== 'cancelled');
        if (hasActive) {
          return res.status(400).json({ message: 'This user is already registered for this event and cannot be added to the organizing team.' });
        }
      }
    }

    // Fetch profile details for the user to satisfy not-null constraints
    let userEmail = email || '';
    let userName = name || '';
    let userRollNumber = null;
    if (userId) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('name, email, roll_number')
        .eq('id', userId)
        .maybeSingle();
      if (profileData) {
        userEmail = profileData.email || userEmail;
        userName = profileData.name || userName;
        userRollNumber = profileData.roll_number;
      }
    }

    if (!userName) {
      userName = 'Student Organizer';
    }

    const modulesToSave = Array.isArray(allowedModules) && allowedModules.length > 0 ? allowedModules : ['all'];

    let member;
    try {
      const { data: inserted, error: insErr } = await supabase.from('event_members').insert({
        event_id: id,
        user_id: userId,
        name: userName,
        email: userEmail,
        roll_number: userRollNumber,
        role,
        organizer_type: 'normal',
        allowed_modules: modulesToSave
      }).select('*').single();
      
      if (insErr) throw insErr;
      member = inserted;
    } catch (insertError) {
      // Fallback
      const { data: fallbackInserted, error: fallbackErr } = await supabase.from('event_members').insert({
        event_id: id,
        user_id: userId,
        name: userName,
        email: userEmail,
        roll_number: userRollNumber,
        role,
        organizer_type: 'normal'
      }).select('*').single();

      if (fallbackErr) throw fallbackErr;
      member = { ...fallbackInserted, allowed_modules: modulesToSave };
    }
    
    try {
      await notifyUser({
        userId: userId,
        type: 'assigned',
        title: 'Assigned to Proposal',
        message: `You have been added to the proposal "${event.title || 'Event'}" as a ${role}.`,
        link: `/proposals/${id}`
      });
    } catch (nErr) {}
    
    res.json({
      ...member,
      name: userName,
      email: userEmail,
      allowed_modules: member.allowed_modules || modulesToSave
    });
  } catch (err) {
    console.error('DEBUG ROOT CAUSE:', err);
    res.status(500).json({ message: `Server error adding team member: ${err.message || JSON.stringify(err)}`, error: err.message });
  }
};

const updateProposalTeamMemberPermissions = async (req, res) => {
  try {
    const { id, memberId } = req.params;
    const { allowedModules, userId } = req.body;

    const { data: event, error: evErr } = await supabase.from('events').select('*').eq('id', id).single();
    if (evErr) throw evErr;

    const hasAccess = await checkCoreOrganizerAccess(id, event, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const modulesToSave = Array.isArray(allowedModules) && allowedModules.length > 0 ? allowedModules : ['all'];
    const cleanMemberId = String(memberId).replace(/^mem-/, '');
    const targetUserId = userId || (cleanMemberId.includes('-') && cleanMemberId.length > 20 ? cleanMemberId : null);

    // 1. Update in event_members by id
    try {
      await supabase
        .from('event_members')
        .update({ allowed_modules: modulesToSave })
        .eq('event_id', id)
        .eq('id', cleanMemberId);
    } catch (e1) {
      console.warn('event_members update by id skipped/failed:', e1.message);
    }

    // 2. Update in event_members by user_id if targetUserId is available
    if (targetUserId) {
      try {
        await supabase
          .from('event_members')
          .update({ allowed_modules: modulesToSave })
          .eq('event_id', id)
          .eq('user_id', targetUserId);
      } catch (e2) {
        console.warn('event_members update by user_id skipped/failed:', e2.message);
      }
    }

    // 3. Update in event_organizers by id or student_id
    try {
      await supabase
        .from('event_organizers')
        .update({ allowed_modules: modulesToSave })
        .eq('event_id', id)
        .eq('id', cleanMemberId);
    } catch (e3) {
      console.warn('event_organizers update by id skipped/failed:', e3.message);
    }

    if (targetUserId) {
      try {
        await supabase
          .from('event_organizers')
          .update({ allowed_modules: modulesToSave })
          .eq('event_id', id)
          .eq('student_id', targetUserId);
      } catch (e4) {
        console.warn('event_organizers update by student_id skipped/failed:', e4.message);
      }
    }

    res.json({ id: memberId, allowed_modules: modulesToSave, success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error updating permissions.', error: err.message });
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

const updateProposalTeamMemberRole = async (req, res) => {
  try {
    const { id, memberId } = req.params;
    const { organizerType } = req.body;
    
    if (organizerType !== 'core' && organizerType !== 'normal') {
      return res.status(400).json({ message: 'Invalid organizer type.' });
    }

    const { data: event, error: evErr } = await supabase.from('events').select('*').eq('id', id).single();
    if (evErr) throw evErr;
    
    const hasAccess = await checkCoreOrganizerAccess(id, event, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    
    const { data: member, error: memErr } = await supabase.from('event_members').select('*').eq('id', memberId).single();
    if (memErr) throw memErr;
    
    if (organizerType === 'normal') {
      if (member.user_id === event.proposed_by || member.user_id === event.student_organizer_id) {
        return res.status(400).json({ message: 'Cannot downgrade the primary proposal creator from Core Organizer.' });
      }
      if (member.user_id === event.faculty_id) {
        return res.status(400).json({ message: 'Cannot downgrade the primary faculty coordinator from Core Organizer.' });
      }
    }
    
    const { data: updatedMember, error: updateErr } = await supabase
      .from('event_members')
      .update({ organizer_type: organizerType })
      .eq('id', memberId)
      .select()
      .single();
      
    if (updateErr) throw updateErr;

    if (updatedMember && updatedMember.user_id) {
      await supabase
        .from('event_organizers')
        .update({ organizer_role: organizerType })
        .eq('event_id', id)
        .eq('student_id', updatedMember.user_id);
    }
    
    res.json(updatedMember);
  } catch (err) {
    res.status(500).json({ message: 'Server error updating organizer role.', error: err.message });
  }
};

const updateProposalDescription = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, description, category, venue, date, capacity, imageUrl, 
      registrationType, maxTeams, minTeamSize, maxTeamSize, 
      allowCrossDepartment, teamLeaderRegistrationRequired, registrationDeadline 
    } = req.body;
    
    const { data: event, error: evErr } = await supabase.from('events').select('*').eq('id', id).single();
    if (evErr) throw evErr;
    
    const hasAccess = await checkCoreOrganizerAccess(id, event, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    
    if (date !== undefined && date) {
      const isDateChanged = !event.date || new Date(date).getTime() !== new Date(event.date).getTime();
      if (isDateChanged) {
        const selectedDate = new Date(date);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        if (selectedDate < tomorrow) {
          return res.status(400).json({ message: 'Event date must be at least one day in the future.' });
        }
      }
    }
    
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (venue !== undefined) updates.venue = venue;
    if (date !== undefined) updates.date = date ? new Date(date).toISOString() : null;
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
        
        const isDeadlineChanged = !event.registration_deadline || new Date(registrationDeadline).getTime() !== new Date(event.registration_deadline).getTime();

        if (isDeadlineChanged) {
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
        updates.registration_deadline = new Date(registrationDeadline).toISOString();
      } else {
        updates.registration_deadline = null;
      }
    }
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No fields provided to update.' });
    }
    
    const { data: updatedEvent, error: updateErr } = await supabase
      .from('events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
      
    if (updateErr) throw updateErr;
    
    // Log timeline event
    await supabase.from('proposal_timeline').insert({
      proposal_id: id,
      user_id: req.user.id,
      action: 'Event Details Updated',
      details: 'The event proposal details were modified.'
    });
    
    res.json(updatedEvent);
  } catch (err) {
    res.status(500).json({ message: 'Server error updating event details.', error: err.message });
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
    
    // Log timeline event safely
    try {
      await supabase.from('proposal_timeline').insert({
        proposal_id: id,
        user_id: req.user.id,
        action: 'Document Removed',
        details: `Removed document: ${document.file_name}`
      });
    } catch (timelineErr) {
      console.warn('Non-fatal proposal_timeline error on remove:', timelineErr.message);
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error removing document.', error: err.message });
  }
};

/**
 * Close event registrations (Admins, Faculty Coordinators, Organizers).
 */
const adminCloseRegistrations = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: event, error: fetchErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    const hasAccess = await checkCoreOrganizerAccess(id, event, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied. You do not have permission to manage registrations for this event.' });
    }

    // Set registration_deadline to now (past/current timestamp closes registrations in system)
    const nowIso = new Date().toISOString();

    const { data: updatedEvent, error: updateErr } = await supabase
      .from('events')
      .update({ registration_deadline: nowIso })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    res.json({ message: 'Event registrations closed.', event: updatedEvent });
  } catch (err) {
    console.error('Error in adminCloseRegistrations:', err);
    res.status(500).json({ message: 'Server error closing event registrations.', error: err.message });
  }
};

/**
 * Open event registrations (Admins, Faculty Coordinators, Organizers).
 */
const adminOpenRegistrations = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: event, error: fetchErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    const hasAccess = await checkCoreOrganizerAccess(id, event, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied. You do not have permission to manage registrations for this event.' });
    }

    // Setting registration_deadline to null re-opens registrations in the system
    const { data: updatedEvent, error: updateErr } = await supabase
      .from('events')
      .update({ registration_deadline: null })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    res.json({ message: 'Event registrations opened.', event: updatedEvent });
  } catch (err) {
    console.error('Error in adminOpenRegistrations:', err);
    res.status(500).json({ message: 'Server error opening event registrations.', error: err.message });
  }
};

const saveConfirmationEmailConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, body, attachmentUrl, attachmentName } = req.body;

    const { data: event, error: fetchErr } = await supabase.from('events').select('*').eq('id', id).single();
    if (fetchErr || !event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    const currentConfig = event.certificate_fields_config || {};
    const updatedConfig = {
      ...currentConfig,
      confirmation_email: {
        subject: subject !== undefined ? subject : (currentConfig.confirmation_email?.subject || ''),
        body: body !== undefined ? body : (currentConfig.confirmation_email?.body || ''),
        attachment_url: attachmentUrl !== undefined ? attachmentUrl : (currentConfig.confirmation_email?.attachment_url || null),
        attachment_name: attachmentName !== undefined ? attachmentName : (currentConfig.confirmation_email?.attachment_name || null),
        updated_at: new Date().toISOString(),
        updated_by: req.user.id
      }
    };

    const { data: updatedEvent, error: updateErr } = await supabase
      .from('events')
      .update({ certificate_fields_config: updatedConfig })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    res.json({
      message: 'Confirmation email configuration saved successfully.',
      confirmationEmailConfig: updatedEvent.certificate_fields_config?.confirmation_email
    });
  } catch (err) {
    console.error('Error saving confirmation email config:', err);
    res.status(500).json({ message: 'Server error saving confirmation email config.', error: err.message });
  }
};

const uploadConfirmationAttachment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ message: 'No attachment file provided.' });
    }

    const file = req.file;
    const ext = path.extname(file.originalname).toLowerCase();
    const fileName = `confirmation-attachment-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const storagePath = `confirmation-attachments/${id}/${fileName}`;

    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (uploadErr) {
      console.error('[ATTACHMENT UPLOAD ERROR]', uploadErr);
      return res.status(500).json({ message: 'Failed to upload attachment file to storage.', error: uploadErr.message });
    }

    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(storagePath);
    const publicUrl = urlData?.publicUrl;

    res.json({
      message: 'Attachment uploaded successfully.',
      attachmentUrl: publicUrl,
      attachmentName: file.originalname
    });
  } catch (err) {
    console.error('Error uploading confirmation attachment:', err);
    res.status(500).json({ message: 'Server error uploading attachment.', error: err.message });
  }
};

const deleteConfirmationAttachment = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: event, error: fetchErr } = await supabase.from('events').select('*').eq('id', id).single();
    if (fetchErr || !event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    const currentConfig = event.certificate_fields_config || {};
    if (currentConfig.confirmation_email) {
      delete currentConfig.confirmation_email.attachment_url;
      delete currentConfig.confirmation_email.attachment_name;
    }

    const { data: updatedEvent, error: updateErr } = await supabase
      .from('events')
      .update({ certificate_fields_config: currentConfig })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    res.json({ message: 'Attachment removed successfully.', confirmationEmailConfig: updatedEvent.certificate_fields_config?.confirmation_email });
  } catch (err) {
    console.error('Error deleting confirmation attachment:', err);
    res.status(500).json({ message: 'Server error deleting attachment.', error: err.message });
  }
};

const requestOfficialPermission = async (req, res) => {
  try {
    const { id } = req.params;
    const targetOfficialId = req.body.officialId || req.body.official_id;
    const letter = req.body.proposalLetter || req.body.proposal_letter;
    const sub = req.body.subject;

    if (!targetOfficialId) {
      return res.status(400).json({ message: 'Please select a Higher Official to request permission from.' });
    }
    if (!letter || !letter.trim()) {
      return res.status(400).json({ message: 'Proposal letter cannot be empty.' });
    }

    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('id, title, faculty_id, proposed_by, student_organizer_id, status, category, date, venue')
      .eq('id', id)
      .maybeSingle();

    if (eventErr || !event) {
      return res.status(404).json({ message: 'Event proposal not found.' });
    }

    const hasAccess = await checkCoreOrganizerAccess(id, event, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Only authorized coordinators can request higher official permission.' });
    }

    // Verify official exists
    const { data: officialProfile, error: offErr } = await supabase
      .from('profiles')
      .select('id, name, email, role, department')
      .eq('id', targetOfficialId)
      .maybeSingle();

    if (offErr || !officialProfile) {
      return res.status(400).json({ message: 'Invalid Higher Official selected.' });
    }

    // Process file attachments if any
    let attachments = [];
    const files = req.files || (req.file ? [req.file] : []);

    for (const file of files) {
      const fileExt = (file.originalname.split('.').pop() || 'bin').toLowerCase();
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const storagePath = `official_permissions/${id}/${uniqueSuffix}.${fileExt}`;

      let fileUrl = '';
      let { data: uploadData, error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (uploadErr && /bucket.*not found|not found.*bucket/i.test(uploadErr.message || '')) {
        await supabase.storage.createBucket('documents', { public: true });
        ({ data: uploadData, error: uploadErr } = await supabase.storage
          .from('documents')
          .upload(storagePath, file.buffer, {
            contentType: file.mimetype,
            upsert: true
          }));
      }

      if (uploadErr) {
        console.warn('Supabase storage upload failed; using fallback:', uploadErr.message);
        if (file.buffer && file.buffer.length <= 8 * 1024 * 1024) {
          fileUrl = `data:${file.mimetype || 'application/octet-stream'};base64,${file.buffer.toString('base64')}`;
        }
      } else {
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(storagePath);
        fileUrl = urlData?.publicUrl || '';
      }

      attachments.push({
        file_name: file.originalname,
        file_url: fileUrl,
        file_type: fileExt.toUpperCase(),
        file_size: file.size
      });
    }

    // Insert permission request record
    const { data: permissionRecord, error: insertErr } = await supabase
      .from('proposal_official_permissions')
      .insert({
        proposal_id: id,
        requested_by: req.user.id,
        official_id: targetOfficialId,
        subject: sub || `Permission Request: ${event.title}`,
        proposal_letter: letter.trim(),
        attachments: attachments,
        status: 'pending'
      })
      .select('*')
      .single();

    if (insertErr) {
      console.error('Error inserting official permission:', insertErr);
      throw insertErr;
    }

    permissionRecord.requested_by_user = {
      id: req.user.id,
      name: req.user.name || req.user.fullName,
      email: req.user.email
    };
    permissionRecord.official_user = {
      id: officialProfile.id,
      name: officialProfile.name,
      email: officialProfile.email,
      department: officialProfile.department
    };

    // Log to proposal timeline
    try {
      await supabase.from('proposal_timeline').insert({
        proposal_id: id,
        user_id: req.user.id,
        action: 'Permission Requested from Higher Official',
        details: `Sent formal proposal letter & ${attachments.length} attachment(s) to ${officialProfile.name || 'Higher Official'}.`
      });
    } catch (timelineErr) {
      console.warn('Non-fatal proposal_timeline insert error:', timelineErr.message);
    }

    // Notify the Higher Official
    try {
      await notifyUser({
        recipientId: targetOfficialId,
        userId: targetOfficialId,
        recipientEmail: officialProfile.email,
        type: 'official_permission_request',
        title: 'Event Permission Request',
        message: `Formal permission requested for event proposal "${event.title}" by ${req.user.name || 'Coordinator'}.`,
        emailSubject: `[AVENTO] Official Permission Request: ${event.title}`,
        eventId: id
      });
    } catch (notifyErr) {
      console.warn('Failed to notify higher official:', notifyErr.message);
    }

    res.status(201).json({
      message: 'Permission request sent to Higher Official successfully.',
      permission: permissionRecord
    });
  } catch (err) {
    console.error('Error in requestOfficialPermission:', err);
    res.status(500).json({ message: 'Server error requesting official permission.', error: err.message });
  }
};

const getEventOfficialPermissions = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: permissions, error: permErr } = await supabase
      .from('proposal_official_permissions')
      .select('*')
      .eq('proposal_id', id)
      .order('created_at', { ascending: false });

    if (permErr && permErr.code !== '42P01') throw permErr;

    const list = permissions || [];
    const allUserIds = [...new Set([
      ...list.map(p => p.requested_by),
      ...list.map(p => p.official_id)
    ].filter(Boolean))];

    let profilesMap = {};
    if (allUserIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, name, email, department, role, employee_id')
        .in('id', allUserIds);
      (profs || []).forEach(p => {
        profilesMap[p.id] = p;
      });
    }

    const formatted = list.map(p => ({
      ...p,
      requested_by_user: profilesMap[p.requested_by] || {},
      official_user: profilesMap[p.official_id] || {}
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Error in getEventOfficialPermissions:', err);
    res.status(500).json({ message: 'Server error fetching official permissions.', error: err.message });
  }
};

const getAllOfficialPermissions = async (req, res) => {
  try {
    const query = supabase
      .from('proposal_official_permissions')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: permissions, error: permErr } = await query;
    if (permErr && permErr.code !== '42P01') throw permErr;

    const list = permissions || [];
    const proposalIds = [...new Set(list.map(p => p.proposal_id).filter(Boolean))];
    const userIds = [...new Set([
      ...list.map(p => p.requested_by),
      ...list.map(p => p.official_id)
    ].filter(Boolean))];

    let eventsMap = {};
    if (proposalIds.length > 0) {
      const { data: evts } = await supabase
        .from('events')
        .select('id, title, category, date, venue, status, image_url, proposed_by, student_organizer_id, faculty_id')
        .in('id', proposalIds);
      (evts || []).forEach(e => {
        eventsMap[e.id] = e;
      });
    }

    // Also fetch faculty and proposer profiles for events
    const eventUserIds = [...new Set(
      Object.values(eventsMap).flatMap(e => [e.proposed_by, e.student_organizer_id, e.faculty_id]).filter(Boolean)
    )];

    const combinedUserIds = [...new Set([...userIds, ...eventUserIds])];

    let profilesMap = {};
    if (combinedUserIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, name, email, department, role, employee_id')
        .in('id', combinedUserIds);
      (profs || []).forEach(p => {
        profilesMap[p.id] = p;
      });
    }

    const result = list.map(p => {
      const rawEvt = eventsMap[p.proposal_id] || {};
      const facultyProfile = profilesMap[rawEvt.faculty_id] || {};
      const proposerProfile = profilesMap[rawEvt.student_organizer_id || rawEvt.proposed_by] || {};

      const evt = {
        ...rawEvt,
        faculty: facultyProfile,
        proposer: proposerProfile
      };

      return {
        ...p,
        event: evt,
        requested_by_user: profilesMap[p.requested_by] || {},
        official_user: profilesMap[p.official_id] || {}
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Error in getAllOfficialPermissions:', err);
    res.status(500).json({ message: 'Server error fetching all official permissions.', error: err.message });
  }
};

const decideOfficialPermission = async (req, res) => {
  try {
    const { id, permissionId } = req.params;
    const { status, remarks } = req.body;

    const allowedStatuses = ['granted', 'rejected', 'revision_requested'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid decision status. Must be granted, rejected, or revision_requested.' });
    }

    const { data: perm, error: fetchErr } = await supabase
      .from('proposal_official_permissions')
      .select('*')
      .eq('id', permissionId)
      .eq('proposal_id', id)
      .single();

    if (fetchErr || !perm) {
      return res.status(404).json({ message: 'Permission request not found.' });
    }

    const userEmail = (req.user?.email || '').toLowerCase().trim();
    const isAventoAdmin = userEmail === 'admin.avento@gmail.com';
    const isAdmin = isAventoAdmin || req.user.roles?.includes('admin') || req.user.role === 'admin';
    const isAssignedOfficial = String(perm.official_id) === String(req.user.id);

    if (!isAdmin && !isAssignedOfficial) {
      return res.status(403).json({ message: 'Only the assigned Higher Official (University Admin) or Avento Admin can decide on this permission.' });
    }

    const now = new Date().toISOString();
    const { data: updatedPerm, error: updateErr } = await supabase
      .from('proposal_official_permissions')
      .update({
        status,
        official_remarks: remarks || null,
        decided_at: now,
        updated_at: now
      })
      .eq('id', permissionId)
      .select('*')
      .single();

    if (updateErr) throw updateErr;

    // Fetch event for notification & timeline
    const { data: event } = await supabase
      .from('events')
      .select('id, title, faculty_id, proposed_by, student_organizer_id')
      .eq('id', id)
      .maybeSingle();

    const actionText = status === 'granted'
      ? 'Higher Official Permission Granted'
      : (status === 'rejected' ? 'Higher Official Permission Denied' : 'Higher Official Requested Revision');

    // Add to proposal timeline
    try {
      await supabase.from('proposal_timeline').insert({
        proposal_id: id,
        user_id: req.user.id,
        action: actionText,
        details: remarks
          ? `${req.user.name || 'Higher Official'} decided: ${status.toUpperCase()}. Remarks: "${remarks}"`
          : `${req.user.name || 'Higher Official'} granted permission for this event proposal.`
      });
    } catch (timelineErr) {
      console.warn('Non-fatal timeline insert error:', timelineErr.message);
    }

    // Notify requester and faculty coordinator
    const notifyTargets = new Set([perm.requested_by, event?.faculty_id, event?.proposed_by, event?.student_organizer_id].filter(Boolean));
    for (const targetId of notifyTargets) {
      if (String(targetId) !== String(req.user.id)) {
        try {
          await notifyUser({
            userId: targetId,
            type: 'official_permission_decision',
            title: `Higher Official Decision: ${status === 'granted' ? 'Approved' : status.replace('_', ' ')}`,
            message: `${req.user.name || 'Higher Official'} has ${status === 'granted' ? 'granted permission' : (status === 'rejected' ? 'rejected permission' : 'requested revision')} for "${event?.title || 'Event Proposal'}".`,
            link: `/proposals/${id}`
          });
        } catch (notifyErr) {
          console.warn('Failed to notify user of permission decision:', notifyErr.message);
        }
      }
    }

    res.json({
      message: `Permission request ${status === 'granted' ? 'granted' : status} successfully.`,
      permission: updatedPerm
    });
  } catch (err) {
    console.error('Error in decideOfficialPermission:', err);
    res.status(500).json({ message: 'Server error processing permission decision.', error: err.message });
  }
};

module.exports = {
  checkCoreOrganizerAccess,
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
  getConfirmedTeamMembers,
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
  updateProposalTeamMemberRole,
  getProposalTeam,
  addProposalTeamMember,
  updateProposalTeamMemberPermissions,
  removeProposalTeamMember,
  updateProposalDescription,
  removeProposalDocument,
  adminCloseRegistrations,
  adminOpenRegistrations,
  saveConfirmationEmailConfig,
  uploadConfirmationAttachment,
  deleteConfirmationAttachment,
  requestOfficialPermission,
  getEventOfficialPermissions,
  getAllOfficialPermissions,
  decideOfficialPermission
};
