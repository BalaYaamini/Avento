const supabase = require('../config/supabaseClient');
const { checkCoreOrganizerAccess } = require('./eventController');
const { sendEmailNotification } = require('../services/notificationService');
const User = require('../models/User');

// Helper to send allocation notification emails to all registered team members
async function sendAllocationEmailToTeam({ eventId, teamId, problemStatement, description = '', venueRoom }) {
  try {
    const { data: event } = await supabase.from('events').select('title').eq('id', eventId).maybeSingle();
    const eventTitle = event ? event.title : 'Event';

    const { data: team } = await supabase.from('event_teams').select('name').eq('id', teamId).maybeSingle();
    const teamName = team ? team.name : 'Your Team';

    let psDescription = description;
    if (!psDescription) {
      const { data: ps } = await supabase
        .from('event_problem_statements')
        .select('description')
        .eq('event_id', eventId)
        .eq('title', problemStatement)
        .maybeSingle();
      if (ps) psDescription = ps.description || '';
    }

    const { data: regs } = await supabase
      .from('event_registrations')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('team_id', teamId)
      .eq('status', 'registered');

    if (!regs || regs.length === 0) return;

    const userIds = regs.map(r => r.user_id).filter(Boolean);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, name')
      .in('id', userIds);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    for (const userId of userIds) {
      const profile = profileMap.get(userId);
      let email = profile ? profile.email : null;
      let name = profile ? profile.name : 'Participant';

      if (!email) {
        try {
          const mongoUser = await User.findById(userId).select('email name');
          if (mongoUser) {
            email = mongoUser.email;
            name = mongoUser.name || name;
          }
        } catch (e) {
          // ignore
        }
      }

      if (email) {
        const subject = `Problem Statement & Venue Allocation — ${eventTitle}`;
        const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f8fafc;color:#1e293b;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="margin:0;font-size:24px;letter-spacing:1px;color:#7c3aed;">AVENTO</h1>
      <p style="margin:4px 0 0;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;">Allocation Confirmation</p>
    </div>
    
    <h2 style="margin:0 0 12px;font-size:18px;color:#0f172a;">Problem Statement & Venue Allocated</h2>
    <p style="font-size:14px;color:#475569;line-height:1.6;margin-bottom:20px;">
      Hello ${name},<br>
      Your team's problem statement and venue allocation for <strong>${eventTitle}</strong> has been confirmed.
    </p>

    <div style="background-color:#f1f5f9;border-left:4px solid #7c3aed;padding:18px;border-radius:10px;margin-bottom:24px;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr><td style="padding:4px 0;font-size:13px;color:#64748b;width:35%;"><strong>Team:</strong></td><td style="padding:4px 0;font-size:14px;font-weight:700;color:#0f172a;">${teamName}</td></tr>
        <tr><td style="padding:4px 0;font-size:13px;color:#64748b;"><strong>Problem Statement:</strong></td><td style="padding:4px 0;font-size:14px;font-weight:700;color:#0f172a;">${problemStatement}</td></tr>
        ${psDescription ? `<tr><td style="padding:4px 0;font-size:13px;color:#64748b;vertical-align:top;"><strong>Description:</strong></td><td style="padding:4px 0;font-size:13px;color:#334155;line-height:1.5;">${psDescription}</td></tr>` : ''}
        <tr><td style="padding:4px 0;font-size:13px;color:#64748b;"><strong>Venue / Room:</strong></td><td style="padding:4px 0;font-size:14px;font-weight:700;color:#7c3aed;">${venueRoom}</td></tr>
      </table>
    </div>

    <p style="font-size:13px;color:#64748b;line-height:1.5;margin:0 0 20px;">
      Please proceed to your allocated venue at the designated event time.
    </p>
    <hr style="border:0;border-top:1px solid #e2e8f0;margin:20px 0;">
    <p style="font-size:11px;color:#94a3b8;text-align:center;margin:0;">
      Avento Event Platform • Automated Notification
    </p>
  </div>
</body>
</html>`;

        await sendEmailNotification({
          recipientEmail: email,
          subject,
          htmlBody
        });
      }
    }
  } catch (emailErr) {
    console.error('[EMAIL ALLOCATION] Error sending allocation emails:', emailErr.message);
  }
}

// Helper to fetch problem statements with fallback if event_problem_statements table is missing
async function fetchProblemStatementsForEvent(eventId) {
  let problemStatements = [];

  const { data: psData, error: psErr } = await supabase
    .from('event_problem_statements')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  // Calculate live allocated count from team_allocations for each problem statement
  const { data: allocs } = await supabase
    .from('team_allocations')
    .select('problem_statement, problem_statement_id')
    .eq('event_id', eventId);

  const allocCountsByPsId = new Map();
  const allocCountsByTitle = new Map();

  (allocs || []).forEach(a => {
    if (a.problem_statement_id) {
      const psId = String(a.problem_statement_id).trim();
      allocCountsByPsId.set(psId, (allocCountsByPsId.get(psId) || 0) + 1);
    }
    if (a.problem_statement) {
      const normTitle = String(a.problem_statement).trim().toLowerCase();
      allocCountsByTitle.set(normTitle, (allocCountsByTitle.get(normTitle) || 0) + 1);
    }
  });

  if (!psErr && psData && psData.length > 0) {
    problemStatements = psData.map(ps => {
      const psId = String(ps.id || '').trim();
      const normTitle = String(ps.title || '').trim().toLowerCase();

      const countById = allocCountsByPsId.get(psId) || 0;
      const countByTitle = allocCountsByTitle.get(normTitle) || 0;
      const liveCount = Math.max(countById, countByTitle);

      return {
        ...ps,
        allocated_count: liveCount
      };
    });
  } else {
    // Fallback: read from events table certificate_fields_config column
    const { data: event } = await supabase.from('events').select('certificate_fields_config').eq('id', eventId).maybeSingle();
    if (event && event.certificate_fields_config) {
      try {
        const parsed = JSON.parse(event.certificate_fields_config);
        if (Array.isArray(parsed) && parsed.length > 0) {
          problemStatements = parsed.map((p, i) => {
            const normTitle = String(p.title || p.name || '').trim().toLowerCase();
            const countByTitle = allocCountsByTitle.get(normTitle) || 0;
            return {
              id: p.id || `ps_${i + 1}`,
              event_id: eventId,
              title: p.title || p.name || `Problem Statement ${i + 1}`,
              description: p.description || '',
              venue_room: p.venueRoom || p.venue_room || '',
              max_capacity: Number(p.maxCapacity || p.max_capacity || 1),
              allocated_count: countByTitle
            };
          });
        }
      } catch (e) {
        // Ignore parse error
      }
    }
  }

  return { problemStatements };
}

/**
 * GET /api/allocations/event/:eventId/problem-statements
 * Fetch configured problem statements and slot capacity stats for an event (Organizers)
 */
exports.getProblemStatements = async (req, res) => {
  try {
    const { eventId } = req.params;

    const { data: event } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle();
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    const isOrganizer = req.user.roles.includes('admin') || await checkCoreOrganizerAccess(eventId, event, req.user);
    if (!isOrganizer) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    // Fetch confirmed teams count
    const { data: teams, error: teamErr } = await supabase
      .from('event_teams')
      .select('id')
      .eq('event_id', eventId)
      .in('status', ['registered', 'confirmed']);
    if (teamErr) throw teamErr;

    const totalTeams = teams ? teams.length : 0;

    // Fetch configured problem statements (with table missing fallback)
    const { problemStatements } = await fetchProblemStatementsForEvent(eventId);

    const totalCapacity = problemStatements.reduce((sum, item) => sum + Number(item.max_capacity || 0), 0);
    const totalAllocated = problemStatements.reduce((sum, item) => sum + Number(item.allocated_count || 0), 0);

    res.json({
      problemStatements,
      totalTeams,
      totalCapacity,
      totalAllocated,
      isCapacityValid: totalCapacity === totalTeams
    });
  } catch (err) {
    console.error('getProblemStatements error:', err.message);
    res.status(500).json({ message: 'Failed to fetch problem statements.', error: err.message });
  }
};

/**
 * POST /api/allocations/event/:eventId/problem-statements
 * Save / Configure Problem Statements for an event (Organizers)
 * Enforces total capacity == total eligible team count.
 */
exports.saveProblemStatements = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { problemStatements } = req.body;

    if (!Array.isArray(problemStatements) || problemStatements.length === 0) {
      return res.status(400).json({ message: 'Please configure at least one problem statement.' });
    }

    const { data: event } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle();
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    const isOrganizer = req.user.roles.includes('admin') || await checkCoreOrganizerAccess(eventId, event, req.user);
    if (!isOrganizer) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    // Fetch total confirmed teams count for slot capacity validation
    const { data: teams } = await supabase
      .from('event_teams')
      .select('id')
      .eq('event_id', eventId)
      .in('status', ['registered', 'confirmed']);
    const totalTeams = teams ? teams.length : 0;

    let totalConfiguredCapacity = 0;
    const recordsToUpsert = [];

    for (let i = 0; i < problemStatements.length; i++) {
      const ps = problemStatements[i];
      const title = String(ps.title || ps.name || '').trim();
      const venueRoom = String(ps.venueRoom || ps.venue_room || '').trim();
      const description = String(ps.description || '').trim();
      const maxCapacity = parseInt(ps.maxCapacity || ps.max_capacity, 10);

      if (!title) {
        return res.status(400).json({ message: `Problem statement title at position ${i + 1} cannot be empty.` });
      }

      if (isNaN(maxCapacity) || maxCapacity <= 0) {
        return res.status(400).json({ message: `Max capacity for '${title}' must be a positive number.` });
      }

      totalConfiguredCapacity += maxCapacity;

      const record = {
        event_id: eventId,
        title,
        description,
        venue_room: venueRoom,
        max_capacity: maxCapacity,
        updated_at: new Date().toISOString()
      };

      if (ps.id && typeof ps.id === 'string' && ps.id.length > 10) {
        record.id = ps.id;
      }

      recordsToUpsert.push(record);
    }

    // TOTAL CAPACITY VALIDATION
    if (totalConfiguredCapacity !== totalTeams) {
      return res.status(400).json({
        message: `Total problem statement capacity (${totalConfiguredCapacity}) must match the total team count (${totalTeams}) for this event. Please adjust slot capacities before saving.`
      });
    }

    // Delete existing problem statements that are no longer in the list (if updating)
    const existingIdsToKeep = recordsToUpsert.filter(r => r.id).map(r => r.id);
    if (existingIdsToKeep.length > 0) {
      await supabase
        .from('event_problem_statements')
        .delete()
        .eq('event_id', eventId)
        .not('id', 'in', `(${existingIdsToKeep.join(',')})`);
    }

    // Primary: Upsert into event_problem_statements table
    const { data: savedData, error: upsertErr } = await supabase
      .from('event_problem_statements')
      .upsert(recordsToUpsert)
      .select('*');

    if (upsertErr) {
      // Fallback if table missing in Supabase schema cache
      if (upsertErr.code === 'PGRST205' || upsertErr.message?.includes('schema cache')) {
        console.warn('event_problem_statements table missing in schema cache, using events table fallback...');
        const fallbackJSON = JSON.stringify(recordsToUpsert.map((r, i) => ({
          id: r.id || `ps_${i + 1}`,
          title: r.title,
          description: r.description,
          venueRoom: r.venue_room,
          maxCapacity: r.max_capacity
        })));

        const { error: eventErr } = await supabase
          .from('events')
          .update({ certificate_fields_config: fallbackJSON })
          .eq('id', eventId);

        if (eventErr) throw eventErr;

        return res.json({
          message: `Successfully configured ${recordsToUpsert.length} problem statement(s) with total capacity of ${totalConfiguredCapacity} slots.`,
          problemStatements: recordsToUpsert,
          totalTeams,
          totalCapacity: totalConfiguredCapacity
        });
      }

      console.error('Supabase upsert event_problem_statements error:', upsertErr.message);
      throw upsertErr;
    }

    res.json({
      message: `Successfully configured ${savedData.length} problem statement(s) with total capacity of ${totalConfiguredCapacity} slots.`,
      problemStatements: savedData,
      totalTeams,
      totalCapacity: totalConfiguredCapacity
    });
  } catch (err) {
    console.error('saveProblemStatements error:', err.message);
    res.status(500).json({ message: err.message || 'Failed to save problem statements.', error: err.message });
  }
};

/**
 * POST /api/allocations/event/:eventId/select-problem-statement
 * Team Leader selects an available problem statement
 */
exports.selectProblemStatement = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { problemStatementId } = req.body;
    const userId = req.user.id;

    if (!problemStatementId) {
      return res.status(400).json({ message: 'Please select a valid problem statement.' });
    }

    // Step 1: Find student's team registration
    const { data: registration } = await supabase
      .from('event_registrations')
      .select('team_id, status, attendance_status')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!registration || !registration.team_id || registration.status !== 'registered') {
      return res.status(403).json({ message: 'No active team registration found for this event.' });
    }

    // Step 2: Attendance check-in validation
    if (registration.attendance_status !== 'Present') {
      return res.status(403).json({ message: 'Your attendance/QR check-in must be scanned before selecting a problem statement.' });
    }

    // Step 3: Fetch team and verify Team Leader authorization
    const { data: team } = await supabase
      .from('event_teams')
      .select('id, name, leader_id, status')
      .eq('id', registration.team_id)
      .maybeSingle();

    if (!team) {
      return res.status(404).json({ message: 'Team not found.' });
    }

    const isLeader = (String(team.leader_id) === String(userId));
    if (!isLeader) {
      return res.status(403).json({ message: 'Only the team leader can perform the problem statement selection.' });
    }

    // Step 4: Check if team has ALREADY selected a problem statement
    const { data: existingAlloc } = await supabase
      .from('team_allocations')
      .select('id, problem_statement, venue_room')
      .eq('event_id', eventId)
      .eq('team_id', team.id)
      .maybeSingle();

    if (existingAlloc && existingAlloc.problem_statement) {
      return res.status(400).json({
        message: 'Your team has already selected a problem statement. Selection is locked.',
        allocation: {
          teamName: team.name,
          problemStatement: existingAlloc.problem_statement,
          venueRoom: existingAlloc.venue_room
        }
      });
    }

    // Step 5: ATOMIC ALLOCATION & CAPACITY RESERVATION
    const { problemStatements } = await fetchProblemStatementsForEvent(eventId);
    const targetPS = problemStatements.find(p => String(p.id) === String(problemStatementId) || String(p.title) === String(problemStatementId));

    if (!targetPS) {
      return res.status(404).json({ message: 'Problem statement not found.' });
    }

    const venue = targetPS.venue_room || 'To be assigned';

    // Attempt atomic RPC allocation if targetPS.id is valid UUID
    if (targetPS.id && typeof targetPS.id === 'string' && targetPS.id.length > 20) {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('allocate_problem_statement_atomic', {
        p_event_id: eventId,
        p_team_id: team.id,
        p_problem_statement_id: targetPS.id,
        p_venue_room: venue
      });

      if (!rpcErr && rpcRes) {
        if (!rpcRes.success) {
          return res.status(400).json({ message: rpcRes.message || 'This problem statement has reached full capacity. Please select another.' });
        }

        const allocatedTitle = rpcRes.problem_statement || targetPS.title;
        const allocatedVenue = rpcRes.venue_room || venue;

        // Trigger allocation email asynchronously to all team members AFTER successful DB save
        sendAllocationEmailToTeam({
          eventId,
          teamId: team.id,
          problemStatement: allocatedTitle,
          description: targetPS.description || '',
          venueRoom: allocatedVenue
        }).catch(e => console.error('Failed to trigger allocation email:', e.message));

        return res.json({
          success: true,
          message: rpcRes.message || 'Problem statement successfully allocated to your team!',
          allocation: {
            teamName: team.name,
            problemStatement: allocatedTitle,
            venueRoom: allocatedVenue
          }
        });
      }

      // If RPC exists but threw a database error, DO NOT silently fall back to non-atomic path
      const isRpcMissing = rpcErr && (rpcErr.code === 'PGRST202' || rpcErr.code === '42883' || /function/i.test(rpcErr.message || ''));
      if (rpcErr && !isRpcMissing) {
        throw rpcErr;
      }
    }

    // Fallback if targetPS is non-UUID or RPC missing
    if (Number(targetPS.allocated_count) >= Number(targetPS.max_capacity)) {
      return res.status(400).json({ message: 'This problem statement has reached full capacity. Please select another.' });
    }

    // Insert into team_allocations
    const { error: allocErr } = await supabase
      .from('team_allocations')
      .upsert({
        event_id: eventId,
        team_id: team.id,
        problem_statement_id: targetPS.id && targetPS.id.length > 20 ? targetPS.id : null,
        problem_statement: targetPS.title,
        venue_room: venue,
        updated_at: new Date().toISOString()
      }, { onConflict: 'event_id,team_id' });

    if (allocErr) throw allocErr;

    // Update allocated_count in event_problem_statements if table exists
    const newCount = Number(targetPS.allocated_count) + 1;
    await supabase
      .from('event_problem_statements')
      .update({ allocated_count: newCount, updated_at: new Date().toISOString() })
      .eq('id', targetPS.id);

    // Trigger allocation email asynchronously to all team members AFTER successful DB save
    sendAllocationEmailToTeam({
      eventId,
      teamId: team.id,
      problemStatement: targetPS.title,
      description: targetPS.description || '',
      venueRoom: venue
    }).catch(e => console.error('Failed to trigger allocation email:', e.message));

    res.json({
      success: true,
      message: 'Problem statement successfully allocated to your team!',
      allocation: {
        teamName: team.name,
        problemStatement: targetPS.title,
        venueRoom: venue
      }
    });
  } catch (err) {
    console.error('selectProblemStatement error:', err.message);
    res.status(500).json({ message: err.message || 'Failed to select problem statement.', error: err.message });
  }
};

/**
 * GET /api/allocations/event/:eventId
 * Fetch all team allocations & problem statements for an event (Organizers)
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

    // Fetch confirmed teams
    const { data: teams, error: teamErr } = await supabase
      .from('event_teams')
      .select('id, name, leader_id, status')
      .eq('event_id', eventId)
      .in('status', ['registered', 'confirmed']);
    if (teamErr) throw teamErr;

    // Fetch existing allocations
    let allocations = [];
    const { data: allocData } = await supabase
      .from('team_allocations')
      .select('*')
      .eq('event_id', eventId);
    if (allocData) allocations = allocData;

    // Fetch configured problem statements
    const { problemStatements } = await fetchProblemStatementsForEvent(eventId);

    const allocMap = new Map(allocations.map(a => [a.team_id, a]));

    const teamList = (teams || []).map(t => {
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

    res.json({
      allocations: teamList,
      problemStatements
    });
  } catch (err) {
    console.error('getEventAllocations error:', err.message);
    res.status(500).json({ message: 'Failed to fetch team allocations.', error: err.message });
  }
};

/**
 * GET /api/allocations/event/:eventId/template
 * Download allocation template data for confirmed teams (Organizers)
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
 * Save / Upsert Team Allocations (Organizers only - Excel / Manual edit)
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

    const { data: validTeams } = await supabase
      .from('event_teams')
      .select('id, name, status')
      .eq('event_id', eventId)
      .in('status', ['registered', 'confirmed']);
    const validTeamMap = new Map((validTeams || []).map(t => [t.id, t.name]));

    // Fetch problem statements for this event to resolve problem_statement_id
    const { data: psListForEvent } = await supabase
      .from('event_problem_statements')
      .select('id, title')
      .eq('event_id', eventId);

    const psMapByTitle = new Map((psListForEvent || []).map(p => [String(p.title || '').trim().toLowerCase(), p.id]));
    const psMapById = new Map((psListForEvent || []).map(p => [String(p.id), p.id]));

    const seenTeams = new Set();
    const recordsToUpsert = [];

    for (let i = 0; i < allocations.length; i++) {
      const item = allocations[i];
      const teamId = String(item.teamId || item['Team ID'] || '').trim();
      const teamName = String(item.teamName || item['Team Name'] || 'Row ' + (i + 1)).trim();
      const venueRoom = String(item.venueRoom || item['Venue / Room'] || '').trim();
      const problemStatement = String(item.problemStatement || item['Problem Statement'] || '').trim();

      if (!teamId || !validTeamMap.has(teamId)) {
        return res.status(400).json({ message: `Team not found or is not a confirmed team for this event: ${teamName} (${teamId || 'No ID'})` });
      }

      if (!venueRoom) {
        return res.status(400).json({ message: `Venue / Room must not be empty for team: ${teamName}` });
      }

      if (!problemStatement) {
        return res.status(400).json({ message: `Problem Statement must not be empty for team: ${teamName}` });
      }

      if (seenTeams.has(teamId)) {
        return res.status(400).json({ message: `Duplicate allocation found for team: ${teamName}` });
      }
      seenTeams.add(teamId);

      const matchedPsId = psMapByTitle.get(problemStatement.toLowerCase()) || psMapById.get(problemStatement) || null;

      recordsToUpsert.push({
        event_id: eventId,
        team_id: teamId,
        venue_room: venueRoom,
        problem_statement: problemStatement,
        problem_statement_id: matchedPsId,
        updated_at: new Date().toISOString()
      });
    }

    const { error: upsertErr } = await supabase
      .from('team_allocations')
      .upsert(recordsToUpsert, { onConflict: 'event_id,team_id' });

    if (upsertErr) {
      console.error('Supabase upsert team_allocations error:', upsertErr.message);
      throw upsertErr;
    }

    // Sync stored allocated_count in event_problem_statements table
    try {
      const { data: currentPS } = await supabase
        .from('event_problem_statements')
        .select('id, title')
        .eq('event_id', eventId);

      if (currentPS && currentPS.length > 0) {
        const { data: allAllocs } = await supabase
          .from('team_allocations')
          .select('problem_statement_id, problem_statement')
          .eq('event_id', eventId);

        for (const ps of currentPS) {
          const normTitle = String(ps.title || '').trim().toLowerCase();
          const liveCount = (allAllocs || []).filter(a =>
            String(a.problem_statement_id || '').trim() === String(ps.id).trim() ||
            String(a.problem_statement || '').trim().toLowerCase() === normTitle
          ).length;

          await supabase
            .from('event_problem_statements')
            .update({ allocated_count: liveCount, updated_at: new Date().toISOString() })
            .eq('id', ps.id);
        }
      }
    } catch (syncErr) {
      console.warn('Non-fatal error syncing allocated_count after saveTeamAllocations:', syncErr.message);
    }

    // Trigger allocation emails asynchronously to all team members AFTER successful DB save
    for (const record of recordsToUpsert) {
      sendAllocationEmailToTeam({
        eventId,
        teamId: record.team_id,
        problemStatement: record.problem_statement,
        venueRoom: record.venue_room
      }).catch(e => console.error('Failed to trigger allocation email after saveTeamAllocations:', e.message));
    }

    res.json({ message: `Successfully saved allocations for ${recordsToUpsert.length} team(s).` });
  } catch (err) {
    console.error('saveTeamAllocations error:', err.message);
    res.status(500).json({ message: err.message || 'Failed to save team allocations.', error: err.message });
  }
};

/**
 * GET /api/allocations/event/:eventId/my-allocation
 * Fetch team allocation & available problem statement selection for logged-in student (Participant View)
 */
exports.getMyTeamAllocation = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    // Check 1: Find student's team registration
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
        isLeader: false,
        message: 'No active team registration found.'
      });
    }

    // Check 2: Check if student's team is CONFIRMED & verify leader status
    const { data: team } = await supabase
      .from('event_teams')
      .select('id, name, leader_id, status')
      .eq('id', registration.team_id)
      .maybeSingle();

    const isTeamConfirmed = team && (team.status === 'registered' || team.status === 'confirmed');
    const isLeader = team ? (String(team.leader_id) === String(userId)) : false;
    const isCheckedIn = registration.attendance_status === 'Present';

    if (!isTeamConfirmed) {
      return res.json({
        allocation: null,
        teamConfirmed: false,
        checkedIn: isCheckedIn,
        isLeader,
        message: 'Team registration is not confirmed yet.'
      });
    }

    // Fetch team allocation if ALREADY selected/assigned by Team Leader
    const { data: alloc } = await supabase
      .from('team_allocations')
      .select('venue_room, problem_statement, problem_statement_id, updated_at')
      .eq('event_id', eventId)
      .eq('team_id', registration.team_id)
      .maybeSingle();

    if (alloc && alloc.problem_statement) {
      let problemDescription = '';
      try {
        let psInfo = null;

        if (alloc.problem_statement_id && typeof alloc.problem_statement_id === 'string' && alloc.problem_statement_id.length > 20) {
          const { data: infoById } = await supabase
            .from('event_problem_statements')
            .select('description')
            .eq('event_id', eventId)
            .eq('id', alloc.problem_statement_id)
            .maybeSingle();
          psInfo = infoById;
        }

        if (!psInfo && alloc.problem_statement) {
          const { data: infoByTitle } = await supabase
            .from('event_problem_statements')
            .select('description')
            .eq('event_id', eventId)
            .eq('title', alloc.problem_statement)
            .maybeSingle();
          psInfo = infoByTitle;
        }

        if (psInfo) {
          problemDescription = psInfo.description || '';
        }
      } catch (psErr) {
        console.warn('Non-fatal error getting problem statement description:', psErr.message);
      }

      return res.json({
        allocation: {
          teamName: team ? team.name : 'Your Team',
          venueRoom: alloc.venue_room,
          problemStatement: alloc.problem_statement,
          description: problemDescription,
          updatedAt: alloc.updated_at,
          statusText: 'Allocation Assigned'
        },
        teamConfirmed: true,
        checkedIn: isCheckedIn,
        isLeader,
        availableProblemStatements: []
      });
    }

    // Check 3: Attendance check-in status (only required when team is unallocated and leader needs selection choices)
    if (!isCheckedIn) {
      return res.json({
        allocation: null,
        teamConfirmed: true,
        checkedIn: false,
        isLeader,
        message: 'Problem statement selection and venue allocation will be available after check-in.'
      });
    }

    // Fetch configured problem statements for selection if unallocated
    const { problemStatements } = await fetchProblemStatementsForEvent(eventId);

    const availableProblemStatements = (problemStatements || []).map(ps => {
      const maxCap = Number(ps.max_capacity || 0);
      const allocCount = Number(ps.allocated_count || 0);
      const remainingSlots = Math.max(0, maxCap - allocCount);
      const isFull = remainingSlots <= 0;

      let availabilityState = 'healthy';
      if (isFull) {
        availabilityState = 'full';
      } else if (remainingSlots === 1) {
        availabilityState = 'critical';
      } else if (remainingSlots <= Math.ceil(maxCap * 0.4)) {
        availabilityState = 'moderate';
      }

      return {
        id: ps.id,
        title: ps.title,
        description: ps.description || '',
        venueRoom: '', // CHANGE 1: DO NOT EXPOSE VENUE BEFORE SELECTION AT API LEVEL
        maxCapacity: maxCap,
        allocatedCount: allocCount,
        remainingSlots,
        isFull,
        availabilityState
      };
    });

    res.json({
      allocation: null,
      teamConfirmed: true,
      checkedIn: true,
      isLeader,
      availableProblemStatements,
      message: isLeader 
        ? 'Please select a problem statement for your team.' 
        : 'Waiting for your team leader to make a selection.'
    });
  } catch (err) {
    console.error('getMyTeamAllocation error:', err.message);
    res.status(500).json({ message: 'Failed to fetch team allocation.', error: err.message });
  }
};
