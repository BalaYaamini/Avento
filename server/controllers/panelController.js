const supabase = require('../config/supabaseClient');
const { checkCoreOrganizerAccess } = require('./eventController');
const { notifyUser } = require('../services/notificationService');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUUID = (str) => typeof str === 'string' && UUID_REGEX.test(str.trim());

const ACTIVE_REG_STATUSES = '("cancelled","rejected","expired")';

/**
 * Load the event and verify the requester is an organizer/admin.
 * Returns { event } or sends an error response and returns null.
 */
const authorizeEvent = async (req, res, eventId) => {
  if (!isUUID(eventId)) {
    res.status(400).json({ message: 'Invalid event ID' });
    return null;
  }

  const { data: event, error: eventErr } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (eventErr || !event) {
    res.status(404).json({ message: 'Event not found' });
    return null;
  }

  const isOrganizer = req.user.roles?.includes('admin') || await checkCoreOrganizerAccess(eventId, event, req.user);
  if (!isOrganizer) {
    res.status(403).json({ message: 'Access denied: Core Organizer privileges required' });
    return null;
  }

  return event;
};

/**
 * GET /api/panels/event/:eventId/overview
 * Organizers / Admins: panels with members and assigned students, plus the
 * unassigned participant roster. All counts are computed live (no stored
 * counters), so the numbers can never drift.
 */
const getPanelsOverview = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await authorizeEvent(req, res, eventId);
    if (!event) return;

    const [{ data: panels, error: panelsErr }, { data: assignments, error: assignErr }] = await Promise.all([
      supabase.from('event_panels').select('*').eq('event_id', eventId).order('created_at', { ascending: true }),
      supabase.from('panel_assignments').select('*').eq('event_id', eventId)
    ]);

    if (panelsErr || assignErr) {
      return res.status(500).json({ message: 'Failed to load panels', error: (panelsErr || assignErr).message });
    }

    const panelIds = (panels || []).map(p => p.id);
    let panelMemberRows = [];
    if (panelIds.length > 0) {
      const { data: memberRows, error: memberErr } = await supabase
        .from('panel_members')
        .select('*')
        .in('panel_id', panelIds);

      if (memberErr) {
        return res.status(500).json({ message: 'Failed to load panel members', error: memberErr.message });
      }
      panelMemberRows = memberRows || [];
    }

    // Registrations roster (same active-status filter as the slot roster)
    const { data: regs, error: regsErr } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('event_id', eventId)
      .not('status', 'in', ACTIVE_REG_STATUSES);

    if (regsErr) {
      return res.status(500).json({ message: 'Failed to load registrations', error: regsErr.message });
    }

    // Manual joins (profile / team / slot lookups) — resilient to schema drift
    const userIds = [...new Set([
      ...(regs || []).map(r => r.user_id).filter(Boolean),
      ...panelMemberRows.map(m => m.user_id).filter(Boolean)
    ])];
    const teamIds = [...new Set((regs || []).map(r => r.team_id).filter(Boolean))];

    let profiles = [];
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, name, email, roll_number, department, role')
        .in('id', userIds);
      profiles = profs || [];
    }

    let teams = [];
    if (teamIds.length > 0) {
      const { data: teamRows } = await supabase.from('event_teams').select('id, name').in('id', teamIds);
      teams = teamRows || [];
    }

    const { data: slots } = await supabase
      .from('event_slots')
      .select('id, slot_name, slot_date, start_time, end_time')
      .eq('event_id', eventId);

    const profileMap = new Map(profiles.map(p => [p.id, p]));
    const teamMap = new Map(teams.map(t => [t.id, t]));
    const slotMap = new Map((slots || []).map(s => [s.id, s]));

    const studentOf = (reg) => {
      const prof = profileMap.get(reg.user_id) || {};
      const team = reg.team_id ? teamMap.get(reg.team_id) : null;
      const slot = reg.slot_id ? slotMap.get(reg.slot_id) : null;
      return {
        registration_id: reg.id,
        user_id: reg.user_id,
        name: prof.name || 'Unknown Student',
        email: prof.email || '',
        roll_number: prof.roll_number || '',
        department: prof.department || '',
        team_name: team ? team.name : '',
        slot_id: reg.slot_id || null,
        slot_name: slot ? slot.slot_name : '',
        slot_date: slot ? slot.slot_date : null,
        slot_time: slot ? `${(slot.start_time || '').substring(0, 5)} - ${(slot.end_time || '').substring(0, 5)}` : '',
        status: reg.status
      };
    };

    const assignmentsByPanel = new Map();
    (assignments || []).forEach(a => {
      if (!assignmentsByPanel.has(a.panel_id)) assignmentsByPanel.set(a.panel_id, []);
      assignmentsByPanel.get(a.panel_id).push(a);
    });

    const membersByPanel = new Map();
    panelMemberRows.forEach(m => {
      if (!membersByPanel.has(m.panel_id)) membersByPanel.set(m.panel_id, []);
      membersByPanel.get(m.panel_id).push(m);
    });

    const regMap = new Map((regs || []).map(r => [r.id, r]));
    const assignedRegIds = new Set((assignments || []).map(a => a.registration_id));

    const enrichedPanels = (panels || []).map(panel => {
      const panelAssignments = (assignmentsByPanel.get(panel.id) || [])
        .map(a => {
          const reg = regMap.get(a.registration_id);
          if (!reg) return null;
          return {
            id: a.id,
            registration_id: a.registration_id,
            assigned_at: a.assigned_at,
            student: studentOf(reg)
          };
        })
        .filter(Boolean)
        .sort((a, b) => (a.student.roll_number || '').localeCompare(b.student.roll_number || ''));

      const members = (membersByPanel.get(panel.id) || []).map(m => {
        const prof = profileMap.get(m.user_id) || {};
        return {
          id: m.id,
          user_id: m.user_id,
          name: prof.name || 'Unknown',
          email: prof.email || '',
          role: prof.role || '',
          department: prof.department || ''
        };
      });

      const assignedCount = panelAssignments.length;
      const maxCapacity = panel.max_capacity == null ? null : Number(panel.max_capacity);

      return {
        ...panel,
        members,
        assignments: panelAssignments,
        assigned_count: assignedCount,
        seats_left: maxCapacity == null ? null : Math.max(0, maxCapacity - assignedCount),
        is_full: maxCapacity != null && assignedCount >= maxCapacity
      };
    });

    const unassignedRegistrations = (regs || [])
      .filter(r => !assignedRegIds.has(r.id))
      .map(studentOf)
      .sort((a, b) => (a.roll_number || '').localeCompare(b.roll_number || ''));

    const summary = {
      total_panels: enrichedPanels.length,
      active_panels: enrichedPanels.filter(p => p.status === 'active').length,
      total_assigned: assignedRegIds.size,
      total_unassigned: unassignedRegistrations.length,
      total_registered: (regs || []).length,
      total_panel_members: panelMemberRows.length
    };

    return res.status(200).json({
      event: {
        id: event.id,
        title: event.title,
        registration_type: event.registration_type,
        status: event.status
      },
      panels: enrichedPanels,
      unassignedRegistrations,
      summary
    });
  } catch (err) {
    console.error('Error in getPanelsOverview:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * GET /api/panels/event/:eventId/members
 * Candidate panel members (judges / interviewers): faculty profiles, admins and
 * the event's organizers.
 */
const getPanelMemberCandidates = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await authorizeEvent(req, res, eventId);
    if (!event) return;

    const [{ data: facProfs }, { data: orgs }, { data: members }] = await Promise.all([
      supabase.from('profiles')
        .select('id, name, email, role, department')
        .in('role', ['faculty', 'faculty_organizer', 'admin']),
      supabase.from('event_organizers').select('student_id').eq('event_id', eventId),
      supabase.from('event_members').select('user_id').eq('event_id', eventId)
    ]);

    const extraIds = new Set([
      ...(orgs || []).map(o => o.student_id).filter(Boolean),
      ...(members || []).map(m => m.user_id).filter(Boolean),
      event.faculty_id, event.organizer_id, event.student_organizer_id
    ].filter(Boolean));

    let extraProfs = [];
    const missing = [...extraIds].filter(id => !(facProfs || []).some(p => p.id === id));
    if (missing.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, name, email, role, department')
        .in('id', missing);
      extraProfs = profs || [];
    }

    const seen = new Set();
    const candidates = [...(facProfs || []), ...extraProfs]
      .filter(p => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    return res.status(200).json({ members: candidates });
  } catch (err) {
    console.error('Error in getPanelMemberCandidates:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * POST /api/panels/event/:eventId
 * Create a panel (name, venue, optional capacity, panel members).
 */
const createPanel = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await authorizeEvent(req, res, eventId);
    if (!event) return;

    const { name, venue_room, max_capacity, member_user_ids } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Panel name is required.' });
    }

    let capacity = null;
    if (max_capacity !== undefined && max_capacity !== null && String(max_capacity).trim() !== '') {
      capacity = parseInt(max_capacity, 10);
      if (isNaN(capacity) || capacity <= 0) {
        return res.status(400).json({ message: 'Max capacity must be a positive integer.' });
      }
    }

    const memberIds = [...new Set((Array.isArray(member_user_ids) ? member_user_ids : []).filter(id => isUUID(id)))];

    const { data: panel, error: insertErr } = await supabase
      .from('event_panels')
      .insert({
        event_id: eventId,
        name: String(name).trim(),
        venue_room: (venue_room || '').trim(),
        max_capacity: capacity,
        status: 'active'
      })
      .select()
      .single();

    if (insertErr) {
      if (insertErr.code === '23505') {
        return res.status(400).json({ message: 'A panel with this name already exists for this event.' });
      }
      console.error('Error creating panel:', insertErr);
      return res.status(500).json({ message: 'Failed to create panel', error: insertErr.message });
    }

    if (memberIds.length > 0) {
      const { error: memberErr } = await supabase
        .from('panel_members')
        .insert(memberIds.map(userId => ({ panel_id: panel.id, user_id: userId })));

      if (memberErr) {
        console.warn('Could not attach panel members:', memberErr.message);
      }
    }

    return res.status(201).json({ message: 'Panel created successfully.', panel });
  } catch (err) {
    console.error('Error in createPanel:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * PUT /api/panels/event/:eventId/panel/:panelId
 * Update a panel's details and (optionally) replace its members.
 */
const updatePanel = async (req, res) => {
  try {
    const { eventId, panelId } = req.params;
    const event = await authorizeEvent(req, res, eventId);
    if (!event) return;

    if (!isUUID(panelId)) {
      return res.status(400).json({ message: 'Invalid panel ID' });
    }

    const { data: panel, error: panelErr } = await supabase
      .from('event_panels')
      .select('*')
      .eq('id', panelId)
      .eq('event_id', eventId)
      .single();

    if (panelErr || !panel) {
      return res.status(404).json({ message: 'Panel not found' });
    }

    const { name, venue_room, max_capacity, status, member_user_ids } = req.body;

    const updates = {};
    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ message: 'Panel name cannot be empty.' });
      }
      updates.name = String(name).trim();
    }
    if (venue_room !== undefined) updates.venue_room = (venue_room || '').trim();
    if (max_capacity !== undefined) {
      if (max_capacity === null || String(max_capacity).trim() === '') {
        updates.max_capacity = null;
      } else {
        const capacity = parseInt(max_capacity, 10);
        if (isNaN(capacity) || capacity <= 0) {
          return res.status(400).json({ message: 'Max capacity must be a positive integer.' });
        }
        updates.max_capacity = capacity;
      }
    }
    if (status !== undefined) {
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ message: 'Invalid panel status.' });
      }
      updates.status = status;
    }

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      const { error: updErr } = await supabase
        .from('event_panels')
        .update(updates)
        .eq('id', panelId);

      if (updErr) {
        if (updErr.code === '23505') {
          return res.status(400).json({ message: 'A panel with this name already exists for this event.' });
        }
        console.error('Error updating panel:', updErr);
        return res.status(500).json({ message: 'Failed to update panel', error: updErr.message });
      }
    }

    if (Array.isArray(member_user_ids)) {
      const memberIds = [...new Set(member_user_ids.filter(id => isUUID(id)))];

      const { error: delErr } = await supabase
        .from('panel_members')
        .delete()
        .eq('panel_id', panelId);

      if (delErr) {
        return res.status(500).json({ message: 'Failed to update panel members', error: delErr.message });
      }

      if (memberIds.length > 0) {
        const { error: insErr } = await supabase
          .from('panel_members')
          .insert(memberIds.map(userId => ({ panel_id: panelId, user_id: userId })));

        if (insErr) {
          return res.status(500).json({ message: 'Failed to update panel members', error: insErr.message });
        }
      }
    }

    return res.status(200).json({ message: 'Panel updated successfully.' });
  } catch (err) {
    console.error('Error in updatePanel:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * DELETE /api/panels/event/:eventId/panel/:panelId?force=true
 * Delete a panel. Assigned students become unassigned (assignment rows are
 * removed with the panel). Refuses when students are assigned unless forced.
 */
const deletePanel = async (req, res) => {
  try {
    const { eventId, panelId } = req.params;
    const event = await authorizeEvent(req, res, eventId);
    if (!event) return;

    if (!isUUID(panelId)) {
      return res.status(400).json({ message: 'Invalid panel ID' });
    }

    const { data: panel, error: panelErr } = await supabase
      .from('event_panels')
      .select('*')
      .eq('id', panelId)
      .eq('event_id', eventId)
      .single();

    if (panelErr || !panel) {
      return res.status(404).json({ message: 'Panel not found' });
    }

    const { data: assignments } = await supabase
      .from('panel_assignments')
      .select('id')
      .eq('panel_id', panelId);

    const assignedCount = (assignments || []).length;
    const force = String(req.query.force || '').toLowerCase() === 'true';

    if (assignedCount > 0 && !force) {
      return res.status(400).json({
        message: `Cannot delete this panel because ${assignedCount} student(s) are assigned to it. Unassign them or confirm force deletion.`
      });
    }

    const { error: deleteErr } = await supabase
      .from('event_panels')
      .delete()
      .eq('id', panelId);

    if (deleteErr) {
      return res.status(500).json({ message: 'Failed to delete panel', error: deleteErr.message });
    }

    return res.status(200).json({ message: `Panel "${panel.name}" deleted successfully.` });
  } catch (err) {
    console.error('Error in deletePanel:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * POST /api/panels/event/:eventId/assign
 * Batch assign / move / unassign students.
 * Body: { assignments: [{ registrationId, panelId }] } — panelId null = unassign.
 *
 * A student can sit on exactly one panel per event (UNIQUE(event_id,
 * registration_id)), so assigning to a different panel moves the student.
 */
const assignStudents = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await authorizeEvent(req, res, eventId);
    if (!event) return;

    const { assignments } = req.body;
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ message: 'An array of assignments is required.' });
    }

    for (const a of assignments) {
      if (!a || !isUUID(a.registrationId)) {
        return res.status(400).json({ message: 'Every assignment needs a valid registrationId.' });
      }
      if (a.panelId !== null && a.panelId !== undefined && !isUUID(a.panelId)) {
        return res.status(400).json({ message: 'Every assignment needs a valid panelId (or null to unassign).' });
      }
    }

    // Validate registrations belong to this event and are active
    const regIds = [...new Set(assignments.map(a => a.registrationId))];
    const { data: regs, error: regsErr } = await supabase
      .from('event_registrations')
      .select('id, user_id')
      .eq('event_id', eventId)
      .in('id', regIds)
      .not('status', 'in', ACTIVE_REG_STATUSES);

    if (regsErr) {
      return res.status(500).json({ message: 'Failed to validate registrations', error: regsErr.message });
    }

    const validRegIds = new Set((regs || []).map(r => r.id));
    const missing = regIds.filter(id => !validRegIds.has(id));
    if (missing.length > 0) {
      return res.status(400).json({ message: 'One or more students are not registered for this event.' });
    }

    // Validate target panels belong to this event
    const targetPanelIds = [...new Set(assignments.map(a => a.panelId).filter(id => id && isUUID(id)))];
    let panels = [];
    if (targetPanelIds.length > 0) {
      const { data: panelRows, error: panelsErr } = await supabase
        .from('event_panels')
        .select('*')
        .eq('event_id', eventId)
        .in('id', targetPanelIds);

      if (panelsErr) {
        return res.status(500).json({ message: 'Failed to validate panels', error: panelsErr.message });
      }
      panels = panelRows || [];

      const validPanelIds = new Set(panels.map(p => p.id));
      const missingPanels = targetPanelIds.filter(id => !validPanelIds.has(id));
      if (missingPanels.length > 0) {
        return res.status(400).json({ message: 'One or more target panels do not belong to this event.' });
      }
    }

    // Live occupancy of the target panels. Every registration in this batch gets
    // its final panel from this batch (move, reassign or unassign), so their
    // existing rows must not count against the targets' capacity.
    const batchRegIds = new Set(assignments.map(a => a.registrationId));
    const { data: existingAssignments } = await supabase
      .from('panel_assignments')
      .select('id, panel_id, registration_id')
      .eq('event_id', eventId)
      .in('panel_id', targetPanelIds.length > 0 ? targetPanelIds : ['00000000-0000-0000-0000-000000000000']);

    const occupancy = new Map();
    (existingAssignments || []).forEach(a => {
      if (batchRegIds.has(a.registration_id)) return;
      occupancy.set(a.panel_id, (occupancy.get(a.panel_id) || 0) + 1);
    });

    // Capacity check per target panel
    const incoming = new Map();
    for (const a of assignments) {
      if (!a.panelId) continue;
      incoming.set(a.panelId, (incoming.get(a.panelId) || 0) + 1);
    }

    for (const panel of panels) {
      const maxCapacity = panel.max_capacity == null ? null : Number(panel.max_capacity);
      if (maxCapacity == null) continue;
      const projected = (occupancy.get(panel.id) || 0) + (incoming.get(panel.id) || 0);
      if (projected > maxCapacity) {
        return res.status(400).json({
          message: `Panel "${panel.name}" only has ${Math.max(0, maxCapacity - (occupancy.get(panel.id) || 0))} seat(s) left.`
        });
      }
    }

    // Apply: unassigns first, then upserts (moves + new assignments)
    const unassigns = assignments.filter(a => !a.panelId);
    const upserts = assignments.filter(a => a.panelId);

    if (unassigns.length > 0) {
      for (const a of unassigns) {
        const { error: delErr } = await supabase
          .from('panel_assignments')
          .delete()
          .eq('event_id', eventId)
          .eq('registration_id', a.registrationId);

        if (delErr) {
          return res.status(500).json({ message: 'Failed to unassign a student', error: delErr.message });
        }
      }
    }

    if (upserts.length > 0) {
      const { error: upErr } = await supabase
        .from('panel_assignments')
        .upsert(
          upserts.map(a => ({
            panel_id: a.panelId,
            event_id: eventId,
            registration_id: a.registrationId,
            assigned_by: req.user.id || null,
            assigned_at: new Date().toISOString()
          })),
          { onConflict: 'event_id,registration_id' }
        );

      if (upErr) {
        // The DB trigger (v51) rejects concurrent bookings / double-booked
        // panels and shared panel members - surface its reason as a 409.
        if (/panel scheduling conflict/i.test(upErr.message || '')) {
          return res.status(409).json({ message: upErr.message });
        }
        return res.status(500).json({ message: 'Failed to assign students to panels', error: upErr.message });
      }
    }

    return res.status(200).json({
      message: `Updated ${assignments.length} panel assignment(s) successfully.`,
      assigned: upserts.length,
      unassigned: unassigns.length
    });
  } catch (err) {
    console.error('Error in assignStudents:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * POST /api/panels/event/:eventId/auto-distribute
 * Schedule-aware auto-assign: place unassigned students (or a provided subset)
 * across the event's active panels WITHOUT ever double-booking a panel or a
 * shared panel member at the same interview time.
 *
 * Scheduling rules:
 *   - A panel hosts at most one student per interview window (slot date+time).
 *   - Panels sharing a panel member never run interviews at overlapping times.
 *   - Multi-day schedules are respected: identical times on different dates do
 *     not conflict; back-to-back slots are fine.
 *   - Existing assignments (manual or earlier allocations) are preserved.
 *   - Fairness: each student goes to the least-loaded eligible panel.
 *   - A student with no free panel is left unassigned (never force-fitted into
 *     a conflict) and the admin is notified.
 * Body: { registrationIds?: string[] }
 */
const autoDistribute = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await authorizeEvent(req, res, eventId);
    if (!event) return;

    const { registrationIds } = req.body || {};

    // All panels (any status) so shared members / busy windows are known even
    // for inactive panels; only active panels receive new placements.
    const { data: allPanels, error: panelsErr } = await supabase
      .from('event_panels')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (panelsErr) {
      return res.status(500).json({ message: 'Failed to load panels', error: panelsErr.message });
    }

    const activePanels = (allPanels || []).filter(p => p.status === 'active');
    if (activePanels.length === 0) {
      return res.status(400).json({ message: 'Create at least one active panel before auto-distributing.' });
    }

    const allPanelIds = (allPanels || []).map(p => p.id);
    const [membersRes, existingRes, regsRes, slotsRes] = await Promise.all([
      allPanelIds.length > 0
        ? supabase.from('panel_members').select('panel_id, user_id').in('panel_id', allPanelIds)
        : Promise.resolve({ data: [] }),
      supabase.from('panel_assignments').select('panel_id, registration_id').eq('event_id', eventId),
      supabase.from('event_registrations')
        .select('*')
        .eq('event_id', eventId)
        .not('status', 'in', ACTIVE_REG_STATUSES),
      supabase.from('event_slots')
        .select('id, slot_name, slot_date, start_time, end_time')
        .eq('event_id', eventId)
    ]);

    if (regsRes.error) {
      return res.status(500).json({ message: 'Failed to load registrations', error: regsRes.error.message });
    }

    const memberRows = membersRes.data || [];
    const existingAssignments = existingRes.data || [];
    const regs = regsRes.data || [];
    const slots = slotsRes.data || [];

    const regMap = new Map(regs.map(r => [r.id, r]));
    const slotMap = new Map(slots.map(s => [s.id, s]));

    const userIds = [...new Set(regs.map(r => r.user_id).filter(Boolean))];
    let profiles = [];
    if (userIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, name, roll_number').in('id', userIds);
      profiles = profs || [];
    }
    const profileMap = new Map(profiles.map(p => [p.id, p]));
    const studentName = (regId) => {
      const reg = regMap.get(regId);
      const prof = reg ? profileMap.get(reg.user_id) : null;
      return (prof && prof.name) || 'A student';
    };

    // Interview window of a student: date + time range of their registered slot
    const windowOf = (registrationId) => {
      const reg = regMap.get(registrationId);
      const slot = reg && reg.slot_id ? slotMap.get(reg.slot_id) : null;
      if (!slot || !slot.start_time || !slot.end_time) return null;
      return {
        date: slot.slot_date || null,
        start: String(slot.start_time).substring(0, 8),
        end: String(slot.end_time).substring(0, 8),
        label: `${slot.slot_name}${slot.slot_date ? ` on ${slot.slot_date}` : ''} (${String(slot.start_time).substring(0, 5)}-${String(slot.end_time).substring(0, 5)})`
      };
    };

    const windowsOverlap = (a, b) => {
      if (!a || !b) return false;
      const sameDay = !a.date || !b.date || a.date === b.date;
      return sameDay && a.start < b.end && b.start < a.end;
    };

    // Which students to place: provided subset (validated) or all unassigned
    let candidates = [];
    if (Array.isArray(registrationIds) && registrationIds.length > 0) {
      const ids = [...new Set(registrationIds.filter(id => isUUID(id)))];
      const validIds = new Set(regs.map(r => r.id));
      const missing = ids.filter(id => !validIds.has(id));
      if (missing.length > 0) {
        return res.status(400).json({ message: 'One or more students are not registered for this event.' });
      }
      candidates = ids;
    } else {
      const assignedIds = new Set(existingAssignments.map(a => a.registration_id));
      candidates = regs.map(r => r.id).filter(id => !assignedIds.has(id));
    }

    if (candidates.length === 0) {
      return res.status(200).json({ message: 'No unassigned students to distribute.', assigned: 0, skipped: [], placements: [] });
    }

    // Busy interview windows per panel and per panel member. Existing rows of
    // this batch are excluded (they are re-placed below).
    const panelMembers = new Map();
    memberRows.forEach(m => {
      if (!panelMembers.has(m.panel_id)) panelMembers.set(m.panel_id, new Set());
      panelMembers.get(m.panel_id).add(m.user_id);
    });

    const batchSet = new Set(candidates);
    const busyByPanel = new Map();
    const busyByMember = new Map();
    const occupancy = new Map();

    existingAssignments.forEach(a => {
      if (batchSet.has(a.registration_id)) return;
      occupancy.set(a.panel_id, (occupancy.get(a.panel_id) || 0) + 1);
      const w = windowOf(a.registration_id);
      if (!w) return;
      if (!busyByPanel.has(a.panel_id)) busyByPanel.set(a.panel_id, []);
      busyByPanel.get(a.panel_id).push(w);
      (panelMembers.get(a.panel_id) || []).forEach(uid => {
        if (!busyByMember.has(uid)) busyByMember.set(uid, []);
        busyByMember.get(uid).push(w);
      });
    });

    // Place chronologically so tight schedules get first pick of free panels
    const sortedCandidates = [...candidates].sort((a, b) => {
      const wa = windowOf(a);
      const wb = windowOf(b);
      if (wa && wb) {
        const da = wa.date || '';
        const db = wb.date || '';
        if (da !== db) return da < db ? -1 : 1;
        if (wa.start !== wb.start) return wa.start < wb.start ? -1 : 1;
      } else if (wa) {
        return -1;
      } else if (wb) {
        return 1;
      }
      return studentName(a).localeCompare(studentName(b));
    });

    const placements = [];
    const skipped = [];

    for (const regId of sortedCandidates) {
      const w = windowOf(regId);

      const eligible = activePanels.filter(p => {
        const maxCapacity = p.max_capacity == null ? null : Number(p.max_capacity);
        const used = occupancy.get(p.id) || 0;
        if (maxCapacity != null && used >= maxCapacity) return false;
        if (!w) return true;
        if ((busyByPanel.get(p.id) || []).some(x => windowsOverlap(w, x))) return false;
        for (const uid of (panelMembers.get(p.id) || [])) {
          if ((busyByMember.get(uid) || []).some(x => windowsOverlap(w, x))) return false;
        }
        return true;
      });

      if (eligible.length === 0) {
        skipped.push({
          registrationId: regId,
          name: studentName(regId),
          reason: w ? `No panel is free at ${w.label}` : 'All panels are at capacity'
        });
        continue;
      }

      // Fairness: least-loaded eligible panel
      let best = eligible[0];
      for (const p of eligible) {
        if ((occupancy.get(p.id) || 0) < (occupancy.get(best.id) || 0)) best = p;
      }

      placements.push({ registrationId: regId, panelId: best.id, panelName: best.name });
      occupancy.set(best.id, (occupancy.get(best.id) || 0) + 1);
      if (w) {
        if (!busyByPanel.has(best.id)) busyByPanel.set(best.id, []);
        busyByPanel.get(best.id).push(w);
        for (const uid of (panelMembers.get(best.id) || [])) {
          if (!busyByMember.has(uid)) busyByMember.set(uid, []);
          busyByMember.get(uid).push(w);
        }
      }
    }

    // Apply one row at a time so a DB-trigger rejection (concurrent booking
    // race) only leaves that single student unassigned instead of failing all.
    const applied = [];
    for (const p of placements) {
      const { error: upErr } = await supabase
        .from('panel_assignments')
        .upsert(
          [{
            panel_id: p.panelId,
            event_id: eventId,
            registration_id: p.registrationId,
            assigned_by: req.user.id || null,
            assigned_at: new Date().toISOString()
          }],
          { onConflict: 'event_id,registration_id' }
        );

      if (upErr) {
        if (/panel scheduling conflict/i.test(upErr.message || '')) {
          skipped.push({
            registrationId: p.registrationId,
            name: studentName(p.registrationId),
            reason: upErr.message
          });
          continue;
        }
        return res.status(500).json({ message: 'Failed to distribute students', error: upErr.message });
      }
      applied.push(p);
    }

    // No conflict-free panel: leave unassigned and notify the admin
    if (skipped.length > 0 && req.user && req.user.id) {
      const detail = skipped.slice(0, 5).map(s => `${s.name} (${s.reason})`).join('; ');
      const more = skipped.length > 5 ? ` and ${skipped.length - 5} more` : '';
      try {
        await notifyUser({
          recipientId: req.user.id,
          title: 'Panel auto-assign: students left unassigned',
          message: `${skipped.length} student(s) could not be placed on any panel without a scheduling conflict and were left unassigned: ${detail}${more}. Please assign them manually or adjust panel membership/capacity.`,
          type: 'event_update',
          eventId
        });
      } catch (e) {
        console.warn('Could not send auto-assign notification:', e.message);
      }
    }

    return res.status(200).json({
      message: applied.length > 0
        ? `Auto-assigned ${applied.length} student(s) with no time conflicts across ${activePanels.length} panel(s).${skipped.length > 0 ? ` ${skipped.length} student(s) left unassigned.` : ''}`
        : (skipped.length > 0
          ? `No conflict-free placement available. ${skipped.length} student(s) left unassigned.`
          : 'No unassigned students to distribute.'),
      assigned: applied.length,
      skipped,
      placements: applied
    });
  } catch (err) {
    console.error('Error in autoDistribute:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * DELETE /api/panels/event/:eventId/assignments
 * Unassign every student from their panels for this event.
 * Panels and panel members are kept - only assignments are cleared.
 */
const unassignAllStudents = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await authorizeEvent(req, res, eventId);
    if (!event) return;

    const { data: existing, error: countErr } = await supabase
      .from('panel_assignments')
      .select('id')
      .eq('event_id', eventId);

    if (countErr) {
      return res.status(500).json({ message: 'Failed to load assignments', error: countErr.message });
    }

    const count = (existing || []).length;
    if (count === 0) {
      return res.status(200).json({ message: 'No panel assignments to clear.', unassigned: 0 });
    }

    const { error: delErr } = await supabase
      .from('panel_assignments')
      .delete()
      .eq('event_id', eventId);

    if (delErr) {
      return res.status(500).json({ message: 'Failed to unassign students', error: delErr.message });
    }

    return res.status(200).json({
      message: `Unassigned ${count} student(s) from their panels.`,
      unassigned: count
    });
  } catch (err) {
    console.error('Error in unassignAllStudents:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * GET /api/panels/event/:eventId/my-membership
 * Any authenticated user: whether the requester is a panel member of this
 * event (and which panels). Used for workspace module gating.
 */
const getMyPanelMembership = async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!isUUID(eventId)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }

    const { data: memberRows } = await supabase
      .from('panel_members')
      .select('panel_id')
      .eq('user_id', req.user.id || '');

    const panelIds = [...new Set((memberRows || []).map(m => m.panel_id))];
    let panels = [];
    if (panelIds.length > 0) {
      const { data: myPanels } = await supabase
        .from('event_panels')
        .select('id, name')
        .in('id', panelIds)
        .eq('event_id', eventId);
      panels = myPanels || [];
    }

    return res.status(200).json({ isPanelMember: panels.length > 0, panels });
  } catch (err) {
    console.error('Error in getMyPanelMembership:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

module.exports = {
  getPanelsOverview,
  getPanelMemberCandidates,
  createPanel,
  updatePanel,
  deletePanel,
  assignStudents,
  autoDistribute,
  unassignAllStudents,
  getMyPanelMembership
};
