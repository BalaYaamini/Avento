const supabase = require('../config/supabaseClient');
const { checkCoreOrganizerAccess } = require('./eventController');
const { sendNotification, sendEmailNotification } = require('../services/notificationService');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUUID = (str) => typeof str === 'string' && UUID_REGEX.test(str.trim());

/**
 * GET /api/events/:eventId/slots
 * Public / Authenticated: Get all active slots with live capacity counts
 */
const getEventSlots = async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!isUUID(eventId)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }

    const { data: slots, error } = await supabase
      .from('event_slots')
      .select('*')
      .eq('event_id', eventId)
      .order('slot_date', { ascending: true, nullsFirst: false })
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching event slots:', error);
      return res.status(500).json({ message: 'Failed to fetch slots', error: error.message });
    }

    const processedSlots = (slots || []).map(slot => {
      const maxCap = Number(slot.max_capacity) || 0;
      const allocated = Number(slot.allocated_count) || 0;
      const slotsRemaining = Math.max(0, maxCap - allocated);
      const isFull = allocated >= maxCap || slot.status === 'full';
      const fillPercentage = maxCap > 0 ? Math.min(100, Math.round((allocated / maxCap) * 100)) : 0;

      return {
        ...slot,
        slots_remaining: slotsRemaining,
        is_full: isFull,
        fill_percentage: fillPercentage
      };
    });

    return res.status(200).json({ slots: processedSlots });
  } catch (err) {
    console.error('Error in getEventSlots:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * GET /api/events/:eventId/slots/overview
 * Organizers / Admins: Get slots breakdown with participant rosters & stats
 */
const getSlotsOverview = async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!isUUID(eventId)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }

    // Verify event
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventErr || !event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const isOrganizer = req.user.roles?.includes('admin') || await checkCoreOrganizerAccess(eventId, event, req.user);
    if (!isOrganizer) {
      return res.status(403).json({ message: 'Access denied: Core Organizer privileges required' });
    }

    // Fetch slots
    const { data: slots, error: slotsErr } = await supabase
      .from('event_slots')
      .select('*')
      .eq('event_id', eventId)
      .order('slot_date', { ascending: true, nullsFirst: false })
      .order('start_time', { ascending: true });

    if (slotsErr) {
      return res.status(500).json({ message: 'Failed to fetch slots', error: slotsErr.message });
    }

    // Fetch all registrations with profile and team info
    let regList = [];

    // Stage 1: PostgREST join with profiles & event_teams
    try {
      const { data: joinedRegs, error: joinErr } = await supabase
        .from('event_registrations')
        .select(`
          id,
          user_id,
          team_id,
          slot_id,
          status,
          attendance_status,
          attendance_marked_at,
          created_at,
          profiles:profiles!event_registrations_user_id_fkey (
            id,
            name,
            email,
            roll_number,
            phone_number,
            department,
            college_name
          ),
          event_teams:team_id (
            id,
            name,
            team_code,
            leader_id,
            status,
            slot_id
          )
        `)
        .eq('event_id', eventId)
        .not('status', 'in', '("cancelled","rejected","expired")');

      if (!joinErr && Array.isArray(joinedRegs) && joinedRegs.length > 0) {
        regList = joinedRegs;
      }
    } catch (e) {
      console.warn('getSlotsOverview stage 1 join warning:', e.message);
    }

    // Stage 2 fallback if Stage 1 returned empty or errored
    if (!regList || regList.length === 0) {
      try {
        const { data: rawRegs } = await supabase
          .from('event_registrations')
          .select('*')
          .eq('event_id', eventId)
          .not('status', 'in', '("cancelled","rejected","expired")');

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

          regList = rawRegs.map(r => {
            const matchedProfile = profMap.get(String(r.user_id)) || (r.user_email ? profMap.get(String(r.user_email).toLowerCase()) : null);
            const team = teamMap.get(r.team_id) || null;
            return {
              id: r.id,
              user_id: r.user_id,
              team_id: r.team_id,
              slot_id: r.slot_id,
              status: r.status,
              attendance_status: r.attendance_status,
              attendance_marked_at: r.attendance_marked_at,
              created_at: r.created_at,
              profiles: matchedProfile || {
                id: r.user_id,
                name: r.user_name || r.name || (r.user_email ? r.user_email.split('@')[0] : 'Student'),
                email: r.user_email || r.email || '',
                roll_number: r.roll_number || r.rollNo || '',
                department: r.department || 'General'
              },
              userId: matchedProfile || {
                id: r.user_id,
                name: r.user_name || r.name || (r.user_email ? r.user_email.split('@')[0] : 'Student'),
                email: r.user_email || r.email || '',
                roll_number: r.roll_number || r.rollNo || '',
                department: r.department || 'General'
              },
              event_teams: team,
              teamId: team
            };
          });
        }
      } catch (e) {
        console.warn('getSlotsOverview stage 2 warning:', e.message);
      }
    }

    // Normalize regList so both profiles/userId and event_teams/teamId exist
    regList = (regList || []).map(r => {
      const prof = r.profiles || r.userId || {};
      const team = r.event_teams || r.teamId || null;
      return {
        ...r,
        profiles: prof,
        userId: prof,
        event_teams: team,
        teamId: team
      };
    });

    // Group registrations by slot_id
    const registrationsBySlot = {};
    const unassignedRegistrations = [];

    (slots || []).forEach(s => {
      registrationsBySlot[s.id] = [];
    });

    regList.forEach(reg => {
      const slotId = reg.slot_id || reg.event_teams?.slot_id || reg.teamId?.slot_id;
      if (slotId && registrationsBySlot[slotId]) {
        registrationsBySlot[slotId].push(reg);
      } else {
        unassignedRegistrations.push(reg);
      }
    });

    // Calculate metrics
    let totalCapacity = 0;
    let totalAllocated = 0;

    const enrichedSlots = (slots || []).map(slot => {
      const maxCap = Number(slot.max_capacity) || 0;
      const slotRegs = registrationsBySlot[slot.id] || [];
      const allocated = slotRegs.length || Number(slot.allocated_count) || 0;
      const attendedCount = slotRegs.filter(r => r.attendance_status === 'present' || r.status === 'attended').length;
      const slotsRemaining = Math.max(0, maxCap - allocated);
      const isFull = allocated >= maxCap || slot.status === 'full';
      const fillPercentage = maxCap > 0 ? Math.min(100, Math.round((allocated / maxCap) * 100)) : 0;

      totalCapacity += maxCap;
      totalAllocated += allocated;

      return {
        ...slot,
        allocated_count: allocated,
        attended_count: attendedCount,
        slots_remaining: slotsRemaining,
        is_full: isFull,
        fill_percentage: fillPercentage,
        participants_count: slotRegs.length
      };
    });

    const summary = {
      total_slots: (slots || []).length,
      total_capacity: totalCapacity,
      total_allocated: totalAllocated,
      unassigned_count: unassignedRegistrations.length,
      total_registered: regList.length,
      available_capacity: Math.max(0, totalCapacity - totalAllocated),
      overall_occupancy_rate: totalCapacity > 0 ? Math.min(100, Math.round((totalAllocated / totalCapacity) * 100)) : 0
    };

    return res.status(200).json({
      event: {
        id: event.id,
        title: event.title,
        registration_type: event.registration_type,
        has_slots: event.has_slots,
        capacity: event.capacity
      },
      slots: enrichedSlots,
      registrationsBySlot,
      unassignedRegistrations,
      summary
    });
  } catch (err) {
    console.error('Error in getSlotsOverview:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * POST /api/events/:eventId/slots
 * Organizers / Admins: Create a single time slot
 */
const createSlot = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { slot_name, slot_date, start_time, end_time, venue_room, max_capacity } = req.body;

    if (!isUUID(eventId)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }

    if (!slot_name || !start_time || !end_time) {
      return res.status(400).json({ message: 'Slot name, start time, and end time are required.' });
    }

    const capacity = parseInt(max_capacity, 10);
    if (isNaN(capacity) || capacity <= 0) {
      return res.status(400).json({ message: 'Max capacity must be a positive integer.' });
    }

    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventErr || !event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const isOrganizer = req.user.roles?.includes('admin') || await checkCoreOrganizerAccess(eventId, event, req.user);
    if (!isOrganizer) {
      return res.status(403).json({ message: 'Access denied: Core Organizer privileges required' });
    }

    const newSlot = {
      event_id: eventId,
      slot_name: slot_name.trim(),
      slot_date: slot_date ? slot_date : null,
      start_time: start_time.trim(),
      end_time: end_time.trim(),
      venue_room: (venue_room || '').trim(),
      max_capacity: capacity,
      allocated_count: 0,
      status: 'active'
    };

    const { data: inserted, error: insertErr } = await supabase
      .from('event_slots')
      .insert(newSlot)
      .select()
      .single();

    if (insertErr) {
      console.error('Error creating slot:', insertErr);
      return res.status(500).json({ message: 'Failed to create slot', error: insertErr.message });
    }

    // Ensure events.has_slots is true
    await supabase
      .from('events')
      .update({ has_slots: true })
      .eq('id', eventId);

    return res.status(201).json({
      message: 'Time slot created successfully',
      slot: inserted
    });
  } catch (err) {
    console.error('Error in createSlot:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * POST /api/events/:eventId/slots/bulk
 * Organizers / Admins: Bulk create multiple time slots
 */
const bulkCreateSlots = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { slots } = req.body;

    if (!isUUID(eventId)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }

    if (!Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({ message: 'An array of slot objects is required.' });
    }

    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventErr || !event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const isOrganizer = req.user.roles?.includes('admin') || await checkCoreOrganizerAccess(eventId, event, req.user);
    if (!isOrganizer) {
      return res.status(403).json({ message: 'Access denied: Core Organizer privileges required' });
    }

    const formattedSlots = slots.map(s => ({
      event_id: eventId,
      slot_name: (s.slot_name || s.name || `Slot ${s.start_time}`).trim(),
      slot_date: s.slot_date ? s.slot_date : null,
      start_time: (s.start_time || '').trim(),
      end_time: (s.end_time || '').trim(),
      venue_room: (s.venue_room || s.room || '').trim(),
      max_capacity: Math.max(1, parseInt(s.max_capacity || s.capacity, 10) || 10),
      allocated_count: 0,
      status: 'active'
    })).filter(s => s.slot_name && s.start_time && s.end_time);

    if (formattedSlots.length === 0) {
      return res.status(400).json({ message: 'No valid slots provided. Each slot needs slot_name, start_time, and end_time.' });
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('event_slots')
      .insert(formattedSlots)
      .select();

    if (insertErr) {
      console.error('Error bulk creating slots:', insertErr);
      return res.status(500).json({ message: 'Failed to bulk create slots', error: insertErr.message });
    }

    // Set has_slots to true
    await supabase
      .from('events')
      .update({ has_slots: true })
      .eq('id', eventId);

    return res.status(201).json({
      message: `${inserted.length} time slot(s) created successfully`,
      slots: inserted
    });
  } catch (err) {
    console.error('Error in bulkCreateSlots:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * PUT /api/events/:eventId/slots/:slotId
 * Organizers / Admins: Update slot details or capacity
 */
const updateSlot = async (req, res) => {
  try {
    const { eventId, slotId } = req.params;
    const { slot_name, slot_date, start_time, end_time, venue_room, max_capacity, status } = req.body;

    if (!isUUID(eventId) || !isUUID(slotId)) {
      return res.status(400).json({ message: 'Invalid event or slot ID' });
    }

    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventErr || !event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const isOrganizer = req.user.roles?.includes('admin') || await checkCoreOrganizerAccess(eventId, event, req.user);
    if (!isOrganizer) {
      return res.status(403).json({ message: 'Access denied: Core Organizer privileges required' });
    }

    const { data: existingSlot, error: slotFetchErr } = await supabase
      .from('event_slots')
      .select('*')
      .eq('id', slotId)
      .eq('event_id', eventId)
      .single();

    if (slotFetchErr || !existingSlot) {
      return res.status(404).json({ message: 'Slot not found for this event' });
    }

    const updates = {};
    if (slot_name !== undefined) updates.slot_name = slot_name.trim();
    if (slot_date !== undefined) updates.slot_date = slot_date || null;
    if (start_time !== undefined) updates.start_time = start_time.trim();
    if (end_time !== undefined) updates.end_time = end_time.trim();
    if (venue_room !== undefined) updates.venue_room = venue_room.trim();
    if (status !== undefined) updates.status = status;

    if (max_capacity !== undefined) {
      const cap = parseInt(max_capacity, 10);
      if (isNaN(cap) || cap <= 0) {
        return res.status(400).json({ message: 'Max capacity must be a positive integer.' });
      }
      updates.max_capacity = cap;
      if (existingSlot.allocated_count >= cap) {
        updates.status = 'full';
      } else if (existingSlot.status === 'full' && existingSlot.allocated_count < cap) {
        updates.status = 'active';
      }
    }

    updates.updated_at = new Date().toISOString();

    const { data: updatedSlot, error: updateErr } = await supabase
      .from('event_slots')
      .update(updates)
      .eq('id', slotId)
      .select()
      .single();

    if (updateErr) {
      console.error('Error updating slot:', updateErr);
      return res.status(500).json({ message: 'Failed to update slot', error: updateErr.message });
    }

    return res.status(200).json({
      message: 'Time slot updated successfully',
      slot: updatedSlot
    });
  } catch (err) {
    console.error('Error in updateSlot:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * DELETE /api/events/:eventId/slots/:slotId
 * Organizers / Admins: Delete a slot
 */
const deleteSlot = async (req, res) => {
  try {
    const { eventId, slotId } = req.params;
    const force = req.query.force === 'true' || req.body.force === true;

    if (!isUUID(eventId) || !isUUID(slotId)) {
      return res.status(400).json({ message: 'Invalid event or slot ID' });
    }

    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventErr || !event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const isOrganizer = req.user.roles?.includes('admin') || await checkCoreOrganizerAccess(eventId, event, req.user);
    if (!isOrganizer) {
      return res.status(403).json({ message: 'Access denied: Core Organizer privileges required' });
    }

    // Check if any participants are registered for this slot
    const { count: regCount } = await supabase
      .from('event_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('slot_id', slotId);

    const { count: teamCount } = await supabase
      .from('event_teams')
      .select('id', { count: 'exact', head: true })
      .eq('slot_id', slotId);

    const activeCount = (regCount || 0) + (teamCount || 0);

    if (activeCount > 0 && !force) {
      return res.status(409).json({
        message: `Cannot delete this slot because ${activeCount} registration(s) are assigned to it. Reassign participants or confirm force deletion.`,
        activeCount
      });
    }

    // Unlink any remaining references if forced
    if (activeCount > 0 && force) {
      await supabase.from('event_registrations').update({ slot_id: null }).eq('slot_id', slotId);
      await supabase.from('event_teams').update({ slot_id: null }).eq('slot_id', slotId);
    }

    const { error: deleteErr } = await supabase
      .from('event_slots')
      .delete()
      .eq('id', slotId)
      .eq('event_id', eventId);

    if (deleteErr) {
      return res.status(500).json({ message: 'Failed to delete slot', error: deleteErr.message });
    }

    // Check if any slots remain for this event
    const { count: remainingSlots } = await supabase
      .from('event_slots')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId);

    if (!remainingSlots || remainingSlots === 0) {
      await supabase.from('events').update({ has_slots: false }).eq('id', eventId);
    }

    return res.status(200).json({
      message: 'Time slot deleted successfully',
      remainingSlots: remainingSlots || 0
    });
  } catch (err) {
    console.error('Error in deleteSlot:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * DELETE /api/events/:eventId/slots/all
 * Organizer / Admin: Delete every time slot for an event at once
 */
const deleteAllSlots = async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!isUUID(eventId)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }

    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventErr || !event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const isOrganizer = req.user.roles?.includes('admin') || await checkCoreOrganizerAccess(eventId, event, req.user);
    if (!isOrganizer) {
      return res.status(403).json({ message: 'Access denied: Core Organizer privileges required' });
    }

    // Unlink any registrations/teams from their slots (participants become unassigned)
    await supabase.from('event_registrations').update({ slot_id: null }).eq('event_id', eventId);
    await supabase.from('event_teams').update({ slot_id: null }).eq('event_id', eventId);

    const { error: deleteErr } = await supabase
      .from('event_slots')
      .delete()
      .eq('event_id', eventId);

    if (deleteErr) {
      return res.status(500).json({ message: 'Failed to delete slots', error: deleteErr.message });
    }

    return res.status(200).json({ message: 'All time slots deleted successfully.' });
  } catch (err) {
    console.error('Error in deleteAllSlots:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * PUT /api/events/:eventId/slots/reassign
 * Reassign a student or team to a different slot
 */
const reassignParticipantSlot = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { registrationId, teamId, targetSlotId } = req.body;

    if (!isUUID(eventId) || !isUUID(targetSlotId)) {
      return res.status(400).json({ message: 'Invalid event or target slot ID' });
    }

    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventErr || !event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const isOrganizer = req.user.roles?.includes('admin') || await checkCoreOrganizerAccess(eventId, event, req.user);
    if (!isOrganizer) {
      return res.status(403).json({ message: 'Access denied: Core Organizer privileges required' });
    }

    // Check target slot
    const { data: targetSlot, error: targetSlotErr } = await supabase
      .from('event_slots')
      .select('*')
      .eq('id', targetSlotId)
      .eq('event_id', eventId)
      .single();

    if (targetSlotErr || !targetSlot) {
      return res.status(404).json({ message: 'Target time slot not found' });
    }

    if (targetSlot.allocated_count >= targetSlot.max_capacity && targetSlot.status === 'full') {
      return res.status(400).json({ message: 'Target slot is currently full.' });
    }

    let previousSlotId = null;
    let recipientUserId = null;
    let participantName = '';

    if (teamId && isUUID(teamId)) {
      // Reassign Team
      const { data: team, error: teamErr } = await supabase
        .from('event_teams')
        .select('*, leader_id, profiles:leader_id(name, email)')
        .eq('id', teamId)
        .eq('event_id', eventId)
        .single();

      if (teamErr || !team) {
        return res.status(404).json({ message: 'Team not found' });
      }

      previousSlotId = team.slot_id;
      recipientUserId = team.leader_id;
      participantName = team.name || 'Team';

      // Update team and all team member registrations
      await supabase.from('event_teams').update({ slot_id: targetSlotId }).eq('id', teamId);
      await supabase.from('event_registrations').update({ slot_id: targetSlotId }).eq('team_id', teamId);

    } else if (registrationId && isUUID(registrationId)) {
      // Reassign Individual Registration
      const { data: reg, error: regErr } = await supabase
        .from('event_registrations')
        .select('*, profiles:user_id(name, email)')
        .eq('id', registrationId)
        .eq('event_id', eventId)
        .single();

      if (regErr || !reg) {
        return res.status(404).json({ message: 'Registration not found' });
      }

      previousSlotId = reg.slot_id;
      recipientUserId = reg.user_id;
      participantName = reg.profiles?.name || 'Participant';

      await supabase.from('event_registrations').update({ slot_id: targetSlotId }).eq('id', registrationId);
    } else {
      return res.status(400).json({ message: 'Must provide either registrationId or teamId.' });
    }

    // Atomically release previous slot if existed
    if (previousSlotId && isUUID(previousSlotId) && previousSlotId !== targetSlotId) {
      await supabase.rpc('release_event_slot_atomic', { p_slot_id: previousSlotId });
    }

    // Atomically allocate new slot
    if (previousSlotId !== targetSlotId) {
      await supabase.rpc('allocate_event_slot_atomic', { p_slot_id: targetSlotId });
    }

    // Notify participant
    if (recipientUserId) {
      const slotTimeStr = `${targetSlot.slot_name} (${targetSlot.start_time} - ${targetSlot.end_time})`;
      const notifMsg = `Your time slot for "${event.title}" has been reassigned by the organizers to: ${slotTimeStr}${targetSlot.venue_room ? ` at ${targetSlot.venue_room}` : ''}.`;

      await sendNotification({
        recipientId: recipientUserId,
        title: 'Event Slot Reassigned',
        message: notifMsg,
        type: 'event_update',
        eventId: eventId
      }).catch(e => console.warn('Could not send notification:', e.message));
    }

    return res.status(200).json({
      message: `Successfully reassigned ${participantName} to ${targetSlot.slot_name}`,
      targetSlot
    });
  } catch (err) {
    console.error('Error in reassignParticipantSlot:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * PUT /api/registrations/:regId/change-slot
 * Student Self-Service: Switch to an open slot before deadline
 */
const rescheduleStudentSlot = async (req, res) => {
  try {
    const { regId } = req.params;
    const { targetSlotId } = req.body;

    if (!isUUID(regId) || !isUUID(targetSlotId)) {
      return res.status(400).json({ message: 'Invalid registration ID or slot ID' });
    }

    const { data: reg, error: regErr } = await supabase
      .from('event_registrations')
      .select('*, events:event_id(*), event_teams:team_id(*)')
      .eq('id', regId)
      .single();

    if (regErr || !reg) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    const event = reg.events;
    if (!event) {
      return res.status(404).json({ message: 'Associated event not found' });
    }

    // Verify ownership
    const isOwner = reg.user_id === req.user.id;
    const isTeamLeader = reg.event_teams && reg.event_teams.leader_id === req.user.id;

    if (!isOwner && !isTeamLeader && !req.user.roles?.includes('admin')) {
      return res.status(403).json({ message: 'Unauthorized: Only the registered student or team leader can reschedule.' });
    }

    // Check deadline
    if (event.registration_deadline && new Date() > new Date(event.registration_deadline)) {
      return res.status(400).json({ message: 'Slot rescheduling is closed because the registration deadline has passed.' });
    }

    if (event.status === 'completed' || event.status === 'cancelled') {
      return res.status(400).json({ message: 'Cannot reschedule for a completed or cancelled event.' });
    }

    // Check target slot
    const { data: targetSlot, error: targetSlotErr } = await supabase
      .from('event_slots')
      .select('*')
      .eq('id', targetSlotId)
      .eq('event_id', event.id)
      .single();

    if (targetSlotErr || !targetSlot) {
      return res.status(404).json({ message: 'Target slot not found' });
    }

    if (targetSlot.status === 'inactive') {
      return res.status(400).json({ message: 'Selected time slot is currently inactive.' });
    }

    if (targetSlot.allocated_count >= targetSlot.max_capacity) {
      return res.status(400).json({ message: 'Selected time slot is fully booked. Please select another slot.' });
    }

    const previousSlotId = reg.slot_id || reg.event_teams?.slot_id;
    if (previousSlotId === targetSlotId) {
      return res.status(400).json({ message: 'You are already registered for this time slot.' });
    }

    // Atomic allocation of target slot
    const { data: allocRes, error: allocErr } = await supabase.rpc('allocate_event_slot_atomic', {
      p_slot_id: targetSlotId
    });

    if (allocErr || !allocRes?.success) {
      return res.status(409).json({ message: allocRes?.message || 'Failed to book slot. It may have just filled up.' });
    }

    // Atomic release of old slot
    if (previousSlotId && isUUID(previousSlotId)) {
      await supabase.rpc('release_event_slot_atomic', { p_slot_id: previousSlotId });
    }

    // Update registration and team if applicable
    if (reg.team_id) {
      const teamUpd = await supabase.from('event_teams').update({ slot_id: targetSlotId }).eq('id', reg.team_id);
      const regUpd = await supabase.from('event_registrations').update({ slot_id: targetSlotId }).eq('team_id', reg.team_id);
      if (teamUpd.error || regUpd.error) {
        console.error('Reschedule update failed:', teamUpd.error || regUpd.error);
        return res.status(500).json({ message: 'Failed to update your slot assignment. Please try again.' });
      }
    } else {
      const regUpd = await supabase.from('event_registrations').update({ slot_id: targetSlotId }).eq('id', regId);
      if (regUpd.error) {
        console.error('Reschedule update failed:', regUpd.error);
        return res.status(500).json({ message: 'Failed to update your slot assignment. Please try again.' });
      }
    }

    return res.status(200).json({
      message: `Successfully rescheduled to ${targetSlot.slot_name} (${targetSlot.start_time} - ${targetSlot.end_time})`,
      slot: targetSlot
    });
  } catch (err) {
    console.error('Error in rescheduleStudentSlot:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

module.exports = {
  getEventSlots,
  getSlotsOverview,
  createSlot,
  bulkCreateSlots,
  updateSlot,
  deleteSlot,
  deleteAllSlots,
  reassignParticipantSlot,
  rescheduleStudentSlot
};
