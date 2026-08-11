const supabase = require('../config/supabaseClient');
const { checkCoreOrganizerAccess } = require('./eventController');

/**
 * GET /api/allocations/event/:eventId
 * Fetch all team allocations for an event (Organizers only)
 */
exports.getEventAllocations = async (req, res) => {
  try {
    const { eventId } = req.params;

    const { data: event, error: evErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle();

    if (evErr || !event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    const isOrganizer = req.user.roles.includes('admin') || await checkCoreOrganizerAccess(eventId, event, req.user);
    if (!isOrganizer) {
      return res.status(403).json({ message: 'Access denied. Only event organizers can view team allocations.' });
    }

    // Fetch confirmed teams for this event
    const { data: teams, error: teamErr } = await supabase
      .from('event_teams')
      .select('id, name, leader_id, status')
      .eq('event_id', eventId)
      .in('status', ['registered', 'confirmed']);

    if (teamErr) throw teamErr;

    // Fetch existing allocations
    let allocations = [];
    const { data: allocData, error: allocErr } = await supabase
      .from('team_allocations')
      .select('*')
      .eq('event_id', eventId);

    if (!allocErr) {
      allocations = allocData || [];
    } else {
      console.warn('team_allocations query warning (table may need migration):', allocErr.message);
    }

    const allocMap = new Map(allocations.map(a => [a.team_id, a]));

    const result = (teams || []).map(t => {
      const alloc = allocMap.get(t.id);
      return {
        teamId: t.id,
        teamName: t.name || 'Unnamed Team',
        venueRoom: alloc ? alloc.venue_room : '',
        problemStatement: alloc ? alloc.problem_statement : '',
        isAllocated: !!alloc,
        updatedAt: alloc ? alloc.updated_at : null
      };
    });

    res.json(result);
  } catch (err) {
    console.error('getEventAllocations error:', err.message);
    res.status(500).json({ message: 'Failed to fetch team allocations.', error: err.message });
  }
};

/**
 * GET /api/allocations/event/:eventId/template
 * Download allocation template data for confirmed teams (Organizers only)
 */
exports.getAllocationTemplateData = async (req, res) => {
  try {
    const { eventId } = req.params;

    const { data: event } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle();
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    const isOrganizer = req.user.roles.includes('admin') || await checkCoreOrganizerAccess(eventId, event, req.user);
    if (!isOrganizer) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const { data: teams } = await supabase
      .from('event_teams')
      .select('id, name, status')
      .eq('event_id', eventId)
      .in('status', ['registered', 'confirmed']);

    let allocations = [];
    const { data: allocData } = await supabase.from('team_allocations').select('*').eq('event_id', eventId);
    if (allocData) allocations = allocData;

    const allocMap = new Map(allocations.map(a => [a.team_id, a]));

    const templateRows = (teams || []).map(t => {
      const alloc = allocMap.get(t.id);
      return {
        'Team ID': t.id,
        'Team Name': t.name || 'Unnamed Team',
        'Venue / Room': alloc ? alloc.venue_room : '',
        'Problem Statement': alloc ? alloc.problem_statement : ''
      };
    });

    res.json(templateRows);
  } catch (err) {
    console.error('getAllocationTemplateData error:', err.message);
    res.status(500).json({ message: 'Failed to generate template data.', error: err.message });
  }
};

/**
 * POST /api/allocations/event/:eventId
 * Save / Upsert Team Allocations (Organizers only)
 */
exports.saveTeamAllocations = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { allocations } = req.body;

    if (!Array.isArray(allocations) || allocations.length === 0) {
      return res.status(400).json({ message: 'No allocation data provided.' });
    }

    const { data: event } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle();
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    const isOrganizer = req.user.roles.includes('admin') || await checkCoreOrganizerAccess(eventId, event, req.user);
    if (!isOrganizer) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    // Fetch valid CONFIRMED team IDs for this event ONLY to strictly enforce event scoping
    const { data: validTeams } = await supabase
      .from('event_teams')
      .select('id, name, status')
      .eq('event_id', eventId)
      .in('status', ['registered', 'confirmed']);
    const validTeamMap = new Map((validTeams || []).map(t => [t.id, t.name]));

    const seenTeams = new Set();
    const recordsToUpsert = [];

    for (let i = 0; i < allocations.length; i++) {
      const item = allocations[i];
      const teamId = String(item.teamId || item['Team ID'] || '').trim();
      const teamName = String(item.teamName || item['Team Name'] || 'Row ' + (i + 1)).trim();
      const venueRoom = String(item.venueRoom || item['Venue / Room'] || '').trim();
      const problemStatement = String(item.problemStatement || item['Problem Statement'] || '').trim();

      // Team Validation: Must exist in current event and be confirmed
      if (!teamId || !validTeamMap.has(teamId)) {
        return res.status(400).json({ message: `Team not found or is not a confirmed team for this event: ${teamName} (${teamId || 'No ID'})` });
      }

      // Venue / Room Validation
      if (!venueRoom) {
        return res.status(400).json({ message: `Venue / Room must not be empty for team: ${teamName}` });
      }

      // Problem Statement Validation
      if (!problemStatement) {
        return res.status(400).json({ message: `Problem Statement must not be empty for team: ${teamName}` });
      }

      // Duplicate Teams Validation
      if (seenTeams.has(teamId)) {
        return res.status(400).json({ message: `Duplicate allocation found for team: ${teamName}` });
      }
      seenTeams.add(teamId);

      recordsToUpsert.push({
        event_id: eventId,
        team_id: teamId,
        venue_room: venueRoom,
        problem_statement: problemStatement,
        updated_at: new Date().toISOString()
      });
    }

    // Upsert into team_allocations table
    const { error: upsertErr } = await supabase
      .from('team_allocations')
      .upsert(recordsToUpsert, { onConflict: 'event_id,team_id' });

    if (upsertErr) {
      console.error('Supabase upsert team_allocations error:', upsertErr.message);
      throw upsertErr;
    }

    res.json({ message: `Successfully saved allocations for ${recordsToUpsert.length} team(s).` });
  } catch (err) {
    console.error('saveTeamAllocations error:', err.message);
    res.status(500).json({ message: err.message || 'Failed to save team allocations.', error: err.message });
  }
};

/**
 * GET /api/allocations/event/:eventId/my-allocation
 * Fetch team allocation for the logged-in student (Participant View)
 */
exports.getMyTeamAllocation = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    // Check 1: Find student's team registration for this event
    const { data: registration } = await supabase
      .from('event_registrations')
      .select('team_id, status, attendance_status')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!registration || !registration.team_id || registration.status !== 'registered') {
      return res.json({
        allocation: null,
        teamConfirmed: false,
        checkedIn: false,
        message: 'No active team registration found.'
      });
    }

    // Check 2: Check if student's team is CONFIRMED
    const { data: team } = await supabase
      .from('event_teams')
      .select('id, name, status')
      .eq('id', registration.team_id)
      .maybeSingle();

    const isTeamConfirmed = team && (team.status === 'registered' || team.status === 'confirmed');

    if (!isTeamConfirmed) {
      return res.json({
        allocation: null,
        teamConfirmed: false,
        checkedIn: registration.attendance_status === 'Present',
        message: 'Team registration is not confirmed yet.'
      });
    }

    // Check 3: Check if student has successfully checked in via QR scan for THIS event
    const isCheckedIn = registration.attendance_status === 'Present';

    if (!isCheckedIn) {
      return res.json({
        allocation: null,
        teamConfirmed: true,
        checkedIn: false,
        message: 'Allocation will be available after check-in.'
      });
    }

    // If all 3 conditions pass, fetch team allocation details
    const { data: alloc, error: allocErr } = await supabase
      .from('team_allocations')
      .select('venue_room, problem_statement, updated_at')
      .eq('event_id', eventId)
      .eq('team_id', registration.team_id)
      .maybeSingle();

    if (allocErr || !alloc) {
      return res.json({
        allocation: null,
        teamConfirmed: true,
        checkedIn: true,
        message: 'Allocation has not been assigned by organizers yet.'
      });
    }

    res.json({
      allocation: {
        teamName: team ? team.name : 'Your Team',
        venueRoom: alloc.venue_room,
        problemStatement: alloc.problem_statement,
        updatedAt: alloc.updated_at,
        statusText: 'Allocation Assigned'
      },
      teamConfirmed: true,
      checkedIn: true
    });
  } catch (err) {
    console.error('getMyTeamAllocation error:', err.message);
    res.status(500).json({ message: 'Failed to fetch team allocation.', error: err.message });
  }
};
