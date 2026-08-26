const supabase = require('../config/supabaseClient');
const { checkCoreOrganizerAccess } = require('./eventController');
const { sendEmailNotification } = require('../services/notificationService');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUUID = (str) => typeof str === 'string' && UUID_REGEX.test(str.trim());

/**
 * Helper: Generate System Problem Statement PDF Document Buffer using pdf-lib
 */
async function generateProblemStatementsPdfBuffer(eventTitle, problemStatements) {
  const pdfDoc = await PDFDocument.create();

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);

  const purplePrimary = rgb(0.486, 0.227, 0.929); // #7c3aed
  const darkSlate = rgb(0.06, 0.09, 0.16); // #0f172a
  const textSecondary = rgb(0.28, 0.33, 0.41); // #475569
  const borderGray = rgb(0.88, 0.91, 0.94); // #e2e8f0
  const boxBg = rgb(0.97, 0.98, 0.99); // #f8fafc

  const drawHeader = (pg) => {
    pg.drawText('AVENTO', {
      x: margin,
      y: pageHeight - 35,
      size: 18,
      font: fontBold,
      color: purplePrimary,
    });

    pg.drawText('PROBLEM STATEMENTS SPECIFICATION', {
      x: margin + 95,
      y: pageHeight - 33,
      size: 9,
      font: fontBold,
      color: textSecondary,
    });

    pg.drawText(String(eventTitle || 'Event Problem Statements').toUpperCase(), {
      x: margin,
      y: pageHeight - 55,
      size: 13,
      font: fontBold,
      color: darkSlate,
    });

    pg.drawLine({
      start: { x: margin, y: pageHeight - 65 },
      end: { x: pageWidth - margin, y: pageHeight - 65 },
      thickness: 1.5,
      color: purplePrimary,
    });
  };

  function wrapText(text, maxWidth, fontSize, usedFont) {
    if (!text) return [];
    const words = String(text).replace(/\r\n/g, '\n').split(/\s+/);
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = usedFont.widthOfTextAtSize(testLine, fontSize);
      if (width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  drawHeader(page);
  let y = pageHeight - 85;

  for (let i = 0; i < problemStatements.length; i++) {
    const ps = problemStatements[i];
    // DO NOT use ps.id (DB UUID) as user-facing code!
    const code = (ps.code && String(ps.code).trim()) ? String(ps.code).trim() : `PS${String(i + 1).padStart(2, '0')}`;
    const title = String(ps.title || ps.name || 'Problem Statement').trim();
    const description = String(ps.description || 'No description provided.').trim();

    const descLines = wrapText(description, contentWidth - 28, 9.5, font);
    const blockHeight = Math.max(55, 38 + (descLines.length * 13) + 10);

    if (y - blockHeight < 50) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      drawHeader(page);
      y = pageHeight - 85;
    }

    page.drawRectangle({
      x: margin,
      y: y - blockHeight,
      width: contentWidth,
      height: blockHeight,
      color: boxBg,
      borderColor: borderGray,
      borderWidth: 1,
    });

    page.drawRectangle({
      x: margin,
      y: y - blockHeight,
      width: 4,
      height: blockHeight,
      color: purplePrimary,
    });

    let currentY = y - 20;

    const headerStr = `${code} — ${title}`;
    const headerLines = wrapText(headerStr, contentWidth - 30, 11, fontBold);

    page.drawText(headerLines[0] || headerStr, {
      x: margin + 14,
      y: currentY,
      size: 11,
      font: fontBold,
      color: darkSlate,
    });

    currentY -= 16;

    page.drawText('Description:', {
      x: margin + 14,
      y: currentY,
      size: 9,
      font: fontBold,
      color: textSecondary,
    });

    currentY -= 13;

    for (const line of descLines) {
      page.drawText(line, {
        x: margin + 14,
        y: currentY,
        size: 9.5,
        font: font,
        color: darkSlate,
      });
      currentY -= 13;
    }

    y -= (blockHeight + 15);
  }

  const totalPages = pdfDoc.getPageCount();
  const pages = pdfDoc.getPages();
  for (let i = 0; i < totalPages; i++) {
    const p = pages[i];
    p.drawText(`Page ${i + 1} of ${totalPages} • AVENTO Event Management Platform`, {
      x: margin,
      y: 20,
      size: 8,
      font: font,
      color: textSecondary,
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

// Helper to send allocation notification emails to all registered team members
async function sendAllocationEmailToTeam({ eventId, teamId, userId, problemStatement, description = '', venueRoom }) {
  try {
    const { data: event } = await supabase.from('events').select('title').eq('id', eventId).maybeSingle();
    const eventTitle = event ? event.title : 'Event';

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

    let userIds = [];
    let displayOwnerName = 'Your Team';

    if (teamId) {
      const { data: team } = await supabase.from('event_teams').select('name').eq('id', teamId).maybeSingle();
      if (team) displayOwnerName = team.name;

      const { data: regs } = await supabase
        .from('event_registrations')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('team_id', teamId)
        .eq('status', 'registered');

      if (regs && regs.length > 0) {
        userIds = regs.map(r => r.user_id).filter(Boolean);
      }
    } else if (userId) {
      displayOwnerName = 'Individual Allocation';
      userIds = [userId];
    }

    if (userIds.length === 0) return;

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, name')
      .in('id', userIds);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    for (const uId of userIds) {
      const profile = profileMap.get(uId);
      let email = profile ? profile.email : null;
      let name = profile ? profile.name : 'Participant';

      if (!email) {
        // User not in profiles — try Supabase Auth user metadata
        try {
          const { data: authUser } = await supabase.auth.admin.getUserById(uId);
          if (authUser?.user?.email) {
            email = authUser.user.email;
            name = authUser.user.user_metadata?.full_name || name;
          }
        } catch (e) {
          // ignore
        }
      }

      const displayVenue = (venueRoom && venueRoom.trim()) ? venueRoom.trim() : 'Yet to assign';

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
      Your problem statement and venue allocation for <strong>${eventTitle}</strong> has been confirmed.
    </p>

    <div style="background-color:#f1f5f9;border-left:4px solid #7c3aed;padding:18px;border-radius:10px;margin-bottom:24px;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr><td style="padding:4px 0;font-size:13px;color:#64748b;width:35%;"><strong>Allocation:</strong></td><td style="padding:4px 0;font-size:14px;font-weight:700;color:#0f172a;">${displayOwnerName}</td></tr>
        <tr><td style="padding:4px 0;font-size:13px;color:#64748b;"><strong>Problem Statement:</strong></td><td style="padding:4px 0;font-size:14px;font-weight:700;color:#0f172a;">${problemStatement}</td></tr>
        ${psDescription ? `<tr><td style="padding:4px 0;font-size:13px;color:#64748b;vertical-align:top;"><strong>Description:</strong></td><td style="padding:4px 0;font-size:13px;color:#334155;line-height:1.5;">${psDescription}</td></tr>` : ''}
        <tr><td style="padding:4px 0;font-size:13px;color:#64748b;"><strong>Venue / Room:</strong></td><td style="padding:4px 0;font-size:14px;font-weight:700;color:#7c3aed;">${displayVenue}</td></tr>
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

      if (ps.allocated_count !== liveCount) {
        supabase
          .from('event_problem_statements')
          .update({ allocated_count: liveCount, updated_at: new Date().toISOString() })
          .eq('id', ps.id)
          .then(() => {})
          .catch(() => {});
      }

      const rawCap = ps.max_capacity ?? ps.maxCapacity;
      const validCap = (rawCap !== undefined && rawCap !== null && !isNaN(Number(rawCap)) && Number(rawCap) > 0) ? Number(rawCap) : 5;

      return {
        ...ps,
        max_capacity: validCap,
        maxCapacity: validCap,
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
            const cap = (p.max_capacity ?? p.maxCapacity) ? Number(p.max_capacity ?? p.maxCapacity) : 5;
            return {
              id: p.id || `ps_${i + 1}`,
              event_id: eventId,
              code: p.code || `PS${String(i + 1).padStart(2, '0')}`,
              title: p.title || p.name || `Problem Statement ${i + 1}`,
              description: p.description || '',
              max_capacity: cap,
              maxCapacity: cap,
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

    const totalCapacity = problemStatements.reduce((sum, item) => sum + Number(item.allocated_count || 0), 0);

    res.json({
      problemStatements,
      totalTeams,
      totalAllocated: totalCapacity,
      pdfUrl: event.problem_statement_pdf_url || null
    });
  } catch (err) {
    console.error('getProblemStatements error:', err.message);
    res.status(500).json({ message: 'Failed to fetch problem statements.', error: err.message });
  }
};

/**
 * POST /api/allocations/event/:eventId/problem-statements
 * Save / Configure Problem Statements for an event (Organizers)
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

    // Fetch total confirmed teams count for informational response
    const { data: teams } = await supabase
      .from('event_teams')
      .select('id')
      .eq('event_id', eventId)
      .in('status', ['registered', 'confirmed']);
    const totalTeams = teams ? teams.length : 0;

    // Fetch existing problem statements to check for active allocations on removal
    const { data: existingPSList } = await supabase
      .from('event_problem_statements')
      .select('id, title, allocated_count')
      .eq('event_id', eventId);
    const existingPSMap = new Map((existingPSList || []).map(p => [String(p.id), p]));

    const existingRecordsToUpdate = [];
    const newRecordsToInsert = [];

    for (let i = 0; i < problemStatements.length; i++) {
      const ps = problemStatements[i];
      const code = (ps.code && String(ps.code).trim()) ? String(ps.code).trim() : `PS${String(i + 1).padStart(2, '0')}`;
      const title = String(ps.title || ps.name || '').trim();
      const description = String(ps.description || '').trim();
      const maxCapacity = Math.max(1, parseInt(ps.maxCapacity || ps.max_capacity || ps.slots) || 5);

      if (!title) {
        return res.status(400).json({ message: `Problem statement title at position ${i + 1} cannot be empty.` });
      }

      if (ps.id && isUUID(ps.id)) {
        // Existing record: include id property to update existing row
        existingRecordsToUpdate.push({
          id: String(ps.id).trim(),
          event_id: eventId,
          code,
          title,
          description,
          max_capacity: maxCapacity,
          updated_at: new Date().toISOString()
        });
      } else {
        // NEW record: OMIT id property completely so PostgreSQL DEFAULT gen_random_uuid() triggers
        newRecordsToInsert.push({
          event_id: eventId,
          code,
          title,
          description,
          max_capacity: maxCapacity,
          updated_at: new Date().toISOString()
        });
      }
    }

    // Verify that any existing problem statement being removed does NOT have active allocations
    const existingIdsToKeepSet = new Set(existingRecordsToUpdate.map(r => r.id));
    for (const existingPS of (existingPSList || [])) {
      if (!existingIdsToKeepSet.has(String(existingPS.id))) {
        const currentAllocated = Number(existingPS.allocated_count || 0);
        if (currentAllocated > 0) {
          return res.status(400).json({
            message: `Cannot remove problem statement '${existingPS.title}' because ${currentAllocated} team(s)/participant(s) are currently allocated to it. Please reassign or clear those allocations first.`
          });
        }
      }
    }

    // Delete existing problem statements that are no longer kept in the list
    const existingIdsToKeep = existingRecordsToUpdate.map(r => r.id);
    if (existingIdsToKeep.length > 0) {
      await supabase
        .from('event_problem_statements')
        .delete()
        .eq('event_id', eventId)
        .not('id', 'in', `(${existingIdsToKeep.join(',')})`);
    } else if (existingPSList && existingPSList.length > 0) {
      await supabase
        .from('event_problem_statements')
        .delete()
        .eq('event_id', eventId);
    }

    const savedData = [];

    // Helper for schema cache fallback if table missing
    const handleFallback = async () => {
      console.warn('event_problem_statements table missing in schema cache, using events table fallback...');
      const allRecords = [...existingRecordsToUpdate, ...newRecordsToInsert];
      const fallbackJSON = JSON.stringify(allRecords.map((r, i) => ({
        id: r.id || `ps_${i + 1}`,
        code: r.code || `PS${String(i + 1).padStart(2, '0')}`,
        title: r.title,
        description: r.description,
        max_capacity: r.max_capacity,
        maxCapacity: r.max_capacity
      })));

      const { error: eventErr } = await supabase
        .from('events')
        .update({ certificate_fields_config: fallbackJSON })
        .eq('id', eventId);

      if (eventErr) throw eventErr;

      return res.json({
        message: `Successfully configured ${allRecords.length} problem statement(s).`,
        problemStatements: allRecords,
        totalTeams
      });
    };

    // 1. Update existing records with real UUIDs
    if (existingRecordsToUpdate.length > 0) {
      const { data: updatedData, error: updateErr } = await supabase
        .from('event_problem_statements')
        .upsert(existingRecordsToUpdate)
        .select('*');

      if (updateErr) {
        if (updateErr.code === 'PGRST205' || updateErr.message?.includes('schema cache')) {
          return await handleFallback();
        }
        console.error('Supabase update event_problem_statements error:', updateErr.message);
        throw updateErr;
      }
      if (updatedData) savedData.push(...updatedData);
    }

    // 2. Insert NEW records WITHOUT id property (triggers id DEFAULT gen_random_uuid())
    if (newRecordsToInsert.length > 0) {
      const { data: insertedData, error: insertErr } = await supabase
        .from('event_problem_statements')
        .insert(newRecordsToInsert)
        .select('*');

      if (insertErr) {
        if (insertErr.code === 'PGRST205' || insertErr.message?.includes('schema cache')) {
          return await handleFallback();
        }
        console.error('Supabase insert event_problem_statements error:', insertErr.message);
        throw insertErr;
      }
      if (insertedData) savedData.push(...insertedData);
    }

    res.json({
      message: `Successfully configured ${savedData.length} problem statement(s).`,
      problemStatements: savedData,
      totalTeams
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

    // Step 1: Find student's registration
    const { data: registration } = await supabase
      .from('event_registrations')
      .select('team_id, status, attendance_status')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!registration || registration.status !== 'registered') {
      return res.status(403).json({ message: 'No active registration found for this event.' });
    }

    // Step 2: Attendance check-in validation (BACKEND ENFORCED)
    if (registration.attendance_status !== 'Present') {
      return res.status(403).json({ message: 'Your attendance/QR check-in must be scanned before selecting a problem statement.' });
    }

    const isTeamReg = !!registration.team_id;
    let team = null;
    let existingAlloc = null;

    if (isTeamReg) {
      // Step 3: Fetch team and verify Team Leader authorization for team registration
      const { data: fetchedTeam } = await supabase
        .from('event_teams')
        .select('id, name, leader_id, status')
        .eq('id', registration.team_id)
        .maybeSingle();

      if (!fetchedTeam) {
        return res.status(404).json({ message: 'Team not found.' });
      }

      const isLeader = (String(fetchedTeam.leader_id) === String(userId));
      if (!isLeader) {
        return res.status(403).json({ message: 'Only the team leader can perform the problem statement selection.' });
      }
      team = fetchedTeam;

      // Step 4: Check if team has ALREADY selected a problem statement
      const { data: teamExistingAlloc } = await supabase
        .from('team_allocations')
        .select('id, problem_statement, problem_statement_id, venue_room')
        .eq('event_id', eventId)
        .eq('team_id', team.id)
        .maybeSingle();
      existingAlloc = teamExistingAlloc;
    } else {
      // Individual registration check
      const { data: individualExistingAlloc } = await supabase
        .from('team_allocations')
        .select('id, problem_statement, problem_statement_id, venue_room')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .maybeSingle();
      existingAlloc = individualExistingAlloc;
    }

    // Step 5: ATOMIC ALLOCATION & CAPACITY RESERVATION
    const { problemStatements } = await fetchProblemStatementsForEvent(eventId);
    const targetPS = problemStatements.find(p => String(p.id) === String(problemStatementId) || String(p.title) === String(problemStatementId));

    if (!targetPS) {
      return res.status(404).json({ message: 'Problem statement not found.' });
    }

    // Treat a repeated confirmation as successful without creating another row.
    if (existingAlloc && existingAlloc.problem_statement === targetPS.title) {
      return res.json({
        success: true,
        alreadySelected: true,
        message: 'Problem statement already selected.',
        allocation: {
          teamName: isTeamReg ? team.name : 'Individual Participant',
          problemStatement: targetPS.title,
          venueRoom: existingAlloc.venue_room && existingAlloc.venue_room.trim() ? existingAlloc.venue_room.trim() : 'Yet to assign'
        }
      });
    }

    // Explicit Slot Capacity Check
    const maxCapacity = Math.max(1, parseInt(targetPS.max_capacity || targetPS.maxCapacity) || 5);
    const currentAllocated = Number(targetPS.allocated_count || 0);
    if (currentAllocated >= maxCapacity) {
      return res.status(400).json({ message: 'This problem statement has reached full capacity. Please select another.' });
    }

    // Preserve existing team preassigned venue if present; otherwise default to ''
    let venue = '';
    let teamVenueQuery = supabase.from('team_allocations').select('venue_room').eq('event_id', eventId);
    if (isTeamReg) {
      teamVenueQuery = teamVenueQuery.eq('team_id', team.id);
    } else {
      teamVenueQuery = teamVenueQuery.eq('user_id', userId);
    }
    const { data: teamVenueRow } = await teamVenueQuery.maybeSingle();
    if (teamVenueRow && teamVenueRow.venue_room && teamVenueRow.venue_room.trim() !== '') {
      venue = teamVenueRow.venue_room.trim();
    }

    // Attempt atomic RPC allocation if targetPS.id is valid UUID
    if (targetPS.id && isUUID(targetPS.id)) {
      const rpcParams = {
        p_event_id: eventId,
        p_team_id: isTeamReg ? team.id : null,
        p_user_id: isTeamReg ? null : userId,
        p_problem_statement_id: targetPS.id,
        p_venue_room: venue
      };

      const { data: rpcRes, error: rpcErr } = await supabase.rpc('allocate_problem_statement_atomic', rpcParams);

      if (!rpcErr && rpcRes) {
        if (!rpcRes.success) {
          if (!existingAlloc || !/already selected/i.test(rpcRes.message || '')) {
            return res.status(400).json({ message: rpcRes.message || 'This problem statement has reached full capacity. Please select another.' });
          }
          console.warn('RPC found an existing allocation; updating it through the fallback path.');
        } else {
          const allocatedTitle = rpcRes.problem_statement || targetPS.title;
          const allocatedVenue = rpcRes.venue_room || venue;

          sendAllocationEmailToTeam({
            eventId,
            teamId: isTeamReg ? team.id : null,
            userId: isTeamReg ? null : userId,
            problemStatement: allocatedTitle,
            description: targetPS.description || '',
            venueRoom: allocatedVenue
          }).catch(e => console.error('Failed to trigger allocation email:', e.message));

          return res.json({
            success: true,
            message: rpcRes.message || 'Problem statement successfully allocated!',
            allocation: {
              teamName: isTeamReg ? team.name : 'Individual Participant',
              problemStatement: allocatedTitle,
              venueRoom: allocatedVenue && allocatedVenue.trim() ? allocatedVenue.trim() : 'Yet to assign'
            }
          });
        }
      }

      if (rpcErr) {
        // Production databases can have an older/mismatched RPC definition.
        // The validated fallback below still enforces the same owner and
        // capacity checks, so do not make confirmation depend on the RPC.
        console.warn('Atomic problem-statement RPC unavailable; using validated upsert fallback:', rpcErr.message);
      }
    }

    // Fallback if targetPS is non-UUID or RPC missing
    const upsertObj = {
      event_id: eventId,
      problem_statement_id: targetPS.id && isUUID(targetPS.id) ? targetPS.id : null,
      problem_statement: targetPS.title,
      venue_room: venue,
      updated_at: new Date().toISOString()
    };
    if (isTeamReg) {
      upsertObj.team_id = team.id;
    } else {
      upsertObj.user_id = userId;
    }

    const onConflictStr = isTeamReg ? 'event_id,team_id' : 'event_id,user_id';
    let { error: allocErr } = await supabase
      .from('team_allocations')
      .upsert(upsertObj, { onConflict: onConflictStr });

    if (allocErr) {
      // Some production schemas do not have the expected unique constraint.
      // Resolve the owner row explicitly, then update or insert without relying
      // on a particular conflict-target definition.
      let existingQuery = supabase
        .from('team_allocations')
        .select('id')
        .eq('event_id', eventId);
      existingQuery = isTeamReg
        ? existingQuery.eq('team_id', team.id)
        : existingQuery.eq('user_id', userId);

      const { data: existingRow, error: existingErr } = await existingQuery.maybeSingle();
      if (existingErr) throw allocErr;

      if (existingRow?.id) {
        const { error: updateAllocErr } = await supabase
          .from('team_allocations')
          .update(upsertObj)
          .eq('id', existingRow.id);
        if (updateAllocErr) throw updateAllocErr;
      } else {
        const { error: insertAllocErr } = await supabase
          .from('team_allocations')
          .insert(upsertObj);
        if (insertAllocErr) throw insertAllocErr;
      }
      allocErr = null;
    }

    const newCount = Number(targetPS.allocated_count) + 1;
    await supabase
      .from('event_problem_statements')
      .update({ allocated_count: newCount, updated_at: new Date().toISOString() })
      .eq('id', targetPS.id);

    sendAllocationEmailToTeam({
      eventId,
      teamId: isTeamReg ? team.id : null,
      userId: isTeamReg ? null : userId,
      problemStatement: targetPS.title,
      description: targetPS.description || '',
      venueRoom: venue
    }).catch(e => console.error('Failed to trigger allocation email:', e.message));

    res.json({
      success: true,
      message: 'Problem statement successfully allocated!',
      allocation: {
        teamName: isTeamReg ? team.name : 'Individual Participant',
        problemStatement: targetPS.title,
        venueRoom: venue && venue.trim() ? venue.trim() : 'Yet to assign'
      }
    });
  } catch (err) {
    console.error('selectProblemStatement error:', err.message);
    res.status(500).json({ message: err.message || 'Failed to select problem statement.', error: err.message });
  }
};

/**
 * GET /api/allocations/event/:eventId
 * Fetch all team & individual allocations & problem statements for an event (Organizers)
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
      return res.status(403).json({ message: 'Access denied. Only event organizers can view allocations.' });
    }

    // Fetch confirmed teams
    const { data: teams, error: teamErr } = await supabase
      .from('event_teams')
      .select('id, name, leader_id, status')
      .eq('event_id', eventId)
      .in('status', ['registered', 'confirmed']);
    if (teamErr) throw teamErr;

    // Fetch confirmed individual registrations (where team_id is null)
    const { data: indivRegs } = await supabase
      .from('event_registrations')
      .select('id, user_id, status')
      .eq('event_id', eventId)
      .is('team_id', null)
      .eq('status', 'registered');

    // Fetch profiles for individual registrants
    const indivUserIds = (indivRegs || []).map(r => r.user_id).filter(Boolean);
    let indivProfileMap = new Map();
    if (indivUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email, roll_number')
        .in('id', indivUserIds);
      if (profiles) {
        indivProfileMap = new Map(profiles.map(p => [p.id, p]));
      }
    }

    // Fetch existing allocations
    let allocations = [];
    const { data: allocData } = await supabase
      .from('team_allocations')
      .select('*')
      .eq('event_id', eventId);
    if (allocData) allocations = allocData;

    const teamAllocMap = new Map(allocations.filter(a => a.team_id).map(a => [String(a.team_id).trim(), a]));
    const userAllocMap = new Map(allocations.filter(a => a.user_id).map(a => [String(a.user_id).trim(), a]));

    // Fetch configured problem statements
    const { problemStatements } = await fetchProblemStatementsForEvent(eventId);

    const psCodeMapByPsId = new Map();
    const psCodeMapByTitle = new Map();

    (problemStatements || []).forEach(p => {
      if (p.id) psCodeMapByPsId.set(String(p.id).trim(), p.code);
      if (p.title) psCodeMapByTitle.set(String(p.title).trim().toLowerCase(), p.code);
    });

    const getPsCodeForAlloc = (alloc) => {
      if (!alloc) return '';
      if (alloc.problem_statement_id && psCodeMapByPsId.has(String(alloc.problem_statement_id).trim())) {
        return psCodeMapByPsId.get(String(alloc.problem_statement_id).trim());
      }
      if (alloc.problem_statement && psCodeMapByTitle.has(String(alloc.problem_statement).trim().toLowerCase())) {
        return psCodeMapByTitle.get(String(alloc.problem_statement).trim().toLowerCase());
      }
      return '';
    };

    const teamList = (teams || []).map(t => {
      const alloc = teamAllocMap.get(String(t.id).trim());
      return {
        teamId: t.id,
        teamName: t.name || 'Unnamed Team',
        isIndividual: false,
        venueRoom: alloc && alloc.venue_room ? alloc.venue_room : '',
        problemStatement: alloc && alloc.problem_statement ? alloc.problem_statement : '',
        problemStatementCode: getPsCodeForAlloc(alloc),
        isAllocated: !!alloc,
        updatedAt: alloc ? alloc.updated_at : null
      };
    });

    const indivList = (indivRegs || []).map(r => {
      const alloc = userAllocMap.get(String(r.user_id).trim());
      const profile = indivProfileMap.get(r.user_id);
      const name = profile ? profile.name : 'Individual Participant';
      return {
        teamId: `user_${r.user_id}`,
        userId: r.user_id,
        teamName: `${name} (Individual)`,
        isIndividual: true,
        venueRoom: alloc && alloc.venue_room ? alloc.venue_room : '',
        problemStatement: alloc && alloc.problem_statement ? alloc.problem_statement : '',
        problemStatementCode: getPsCodeForAlloc(alloc),
        isAllocated: !!alloc,
        updatedAt: alloc ? alloc.updated_at : null
      };
    });

    const combinedList = [...teamList, ...indivList];

    res.json({
      allocations: combinedList,
      problemStatements
    });
  } catch (err) {
    console.error('getEventAllocations error:', err.message);
    res.status(500).json({ message: 'Failed to fetch team allocations.', error: err.message });
  }
};

/**
 * GET /api/allocations/event/:eventId/template
 * Download allocation template data for confirmed teams & individual participants (Organizers)
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

    const { data: indivRegs } = await supabase
      .from('event_registrations')
      .select('id, user_id, status')
      .eq('event_id', eventId)
      .is('team_id', null)
      .eq('status', 'registered');

    const indivUserIds = (indivRegs || []).map(r => r.user_id).filter(Boolean);
    let indivProfileMap = new Map();
    if (indivUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', indivUserIds);
      if (profiles) {
        indivProfileMap = new Map(profiles.map(p => [p.id, p]));
      }
    }

    let allocations = [];
    const { data: allocData } = await supabase.from('team_allocations').select('*').eq('event_id', eventId);
    if (allocData) allocations = allocData;

    const teamAllocMap = new Map(allocations.filter(a => a.team_id).map(a => [String(a.team_id).trim(), a]));
    const userAllocMap = new Map(allocations.filter(a => a.user_id).map(a => [String(a.user_id).trim(), a]));

    const teamRows = (teams || []).map(t => {
      const alloc = teamAllocMap.get(String(t.id).trim());
      return {
        'Team ID': t.id,
        'Team Name': t.name || 'Unnamed Team',
        'Venue / Room': alloc ? alloc.venue_room : '',
        'Problem Statement': alloc ? alloc.problem_statement : ''
      };
    });

    const indivRows = (indivRegs || []).map(r => {
      const alloc = userAllocMap.get(String(r.user_id).trim());
      const profile = indivProfileMap.get(r.user_id);
      const name = profile ? profile.name : 'Individual Participant';
      return {
        'Team ID': `user_${r.user_id}`,
        'Team Name': `${name} (Individual)`,
        'Venue / Room': alloc ? alloc.venue_room : '',
        'Problem Statement': alloc ? alloc.problem_statement : ''
      };
    });

    res.json([...teamRows, ...indivRows]);
  } catch (err) {
    console.error('getAllocationTemplateData error:', err.message);
    res.status(500).json({ message: 'Failed to generate template data.', error: err.message });
  }
};

/**
 * GET /api/allocations/event/:eventId
 * Fetch all team & individual allocations & problem statements for an event (Organizers)
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
      return res.status(403).json({ message: 'Access denied. Only event organizers can view allocations.' });
    }

    // Fetch confirmed teams
    const { data: teams, error: teamErr } = await supabase
      .from('event_teams')
      .select('id, name, leader_id, status')
      .eq('event_id', eventId)
      .in('status', ['registered', 'confirmed']);
    if (teamErr) throw teamErr;

    // Fetch confirmed individual registrations (where team_id is null)
    const { data: indivRegs } = await supabase
      .from('event_registrations')
      .select('id, user_id, status')
      .eq('event_id', eventId)
      .is('team_id', null)
      .eq('status', 'registered');

    // Fetch profiles for individual registrants
    const indivUserIds = (indivRegs || []).map(r => r.user_id).filter(Boolean);
    let indivProfileMap = new Map();
    if (indivUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email, roll_number')
        .in('id', indivUserIds);
      if (profiles) {
        indivProfileMap = new Map(profiles.map(p => [p.id, p]));
      }
    }

    // Fetch existing allocations
    let allocations = [];
    const { data: allocData } = await supabase
      .from('team_allocations')
      .select('*')
      .eq('event_id', eventId);
    if (allocData) allocations = allocData;

    const teamAllocMap = new Map(allocations.filter(a => a.team_id).map(a => [String(a.team_id).trim(), a]));
    const userAllocMap = new Map(allocations.filter(a => a.user_id).map(a => [String(a.user_id).trim(), a]));

    // Fetch configured problem statements
    const { problemStatements } = await fetchProblemStatementsForEvent(eventId);

    const psCodeMapByPsId = new Map();
    const psCodeMapByTitle = new Map();

    (problemStatements || []).forEach(p => {
      if (p.id) psCodeMapByPsId.set(String(p.id).trim(), p.code);
      if (p.title) psCodeMapByTitle.set(String(p.title).trim().toLowerCase(), p.code);
    });

    const getPsCodeForAlloc = (alloc) => {
      if (!alloc) return '';
      if (alloc.problem_statement_id && psCodeMapByPsId.has(String(alloc.problem_statement_id).trim())) {
        return psCodeMapByPsId.get(String(alloc.problem_statement_id).trim());
      }
      if (alloc.problem_statement && psCodeMapByTitle.has(String(alloc.problem_statement).trim().toLowerCase())) {
        return psCodeMapByTitle.get(String(alloc.problem_statement).trim().toLowerCase());
      }
      return '';
    };

    const teamList = (teams || []).map(t => {
      const alloc = teamAllocMap.get(String(t.id).trim());
      return {
        teamId: t.id,
        teamName: t.name || 'Unnamed Team',
        isIndividual: false,
        venueRoom: alloc && alloc.venue_room ? alloc.venue_room : '',
        problemStatement: alloc && alloc.problem_statement ? alloc.problem_statement : '',
        problemStatementCode: getPsCodeForAlloc(alloc),
        isAllocated: !!alloc,
        updatedAt: alloc ? alloc.updated_at : null
      };
    });

    const indivList = (indivRegs || []).map(r => {
      const alloc = userAllocMap.get(String(r.user_id).trim());
      const profile = indivProfileMap.get(r.user_id);
      const name = profile ? profile.name : 'Individual Participant';
      return {
        teamId: `user_${r.user_id}`,
        userId: r.user_id,
        teamName: `${name} (Individual)`,
        isIndividual: true,
        venueRoom: alloc && alloc.venue_room ? alloc.venue_room : '',
        problemStatement: alloc && alloc.problem_statement ? alloc.problem_statement : '',
        problemStatementCode: getPsCodeForAlloc(alloc),
        isAllocated: !!alloc,
        updatedAt: alloc ? alloc.updated_at : null
      };
    });

    const combinedList = [...teamList, ...indivList];

    res.json({
      allocations: combinedList,
      problemStatements
    });
  } catch (err) {
    console.error('getEventAllocations error:', err.message);
    res.status(500).json({ message: 'Failed to fetch team allocations.', error: err.message });
  }
};

/**
 * GET /api/allocations/event/:eventId/template
 * Download allocation template data for confirmed teams & individual participants (Organizers)
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

    const { data: indivRegs } = await supabase
      .from('event_registrations')
      .select('id, user_id, status')
      .eq('event_id', eventId)
      .is('team_id', null)
      .eq('status', 'registered');

    const indivUserIds = (indivRegs || []).map(r => r.user_id).filter(Boolean);
    let indivProfileMap = new Map();
    if (indivUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', indivUserIds);
      if (profiles) {
        indivProfileMap = new Map(profiles.map(p => [p.id, p]));
      }
    }

    let allocations = [];
    const { data: allocData } = await supabase.from('team_allocations').select('*').eq('event_id', eventId);
    if (allocData) allocations = allocData;

    const teamAllocMap = new Map(allocations.filter(a => a.team_id).map(a => [String(a.team_id).trim(), a]));
    const userAllocMap = new Map(allocations.filter(a => a.user_id).map(a => [String(a.user_id).trim(), a]));

    const teamRows = (teams || []).map(t => {
      const alloc = teamAllocMap.get(String(t.id).trim());
      return {
        'Team ID': t.id,
        'Team Name': t.name || 'Unnamed Team',
        'Venue / Room': alloc ? alloc.venue_room : '',
        'Problem Statement': alloc ? alloc.problem_statement : ''
      };
    });

    const indivRows = (indivRegs || []).map(r => {
      const alloc = userAllocMap.get(String(r.user_id).trim());
      const profile = indivProfileMap.get(r.user_id);
      const name = profile ? profile.name : 'Individual Participant';
      return {
        'Team ID': `user_${r.user_id}`,
        'Team Name': `${name} (Individual)`,
        'Venue / Room': alloc ? alloc.venue_room : '',
        'Problem Statement': alloc ? alloc.problem_statement : ''
      };
    });

    res.json([...teamRows, ...indivRows]);
  } catch (err) {
    console.error('getAllocationTemplateData error:', err.message);
    res.status(500).json({ message: 'Failed to generate template data.', error: err.message });
  }
};

/**
 * POST /api/allocations/event/:eventId
 * Save / Upsert Allocations (Organizers only - Excel / Manual edit)
 * ZERO emails when Venue changes! Email sent ONLY when Problem Statement is newly assigned/changed.
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

    const { data: validIndivs } = await supabase
      .from('event_registrations')
      .select('user_id')
      .eq('event_id', eventId)
      .is('team_id', null)
      .eq('status', 'registered');
    const validIndivSet = new Set((validIndivs || []).map(r => r.user_id));

    // Fetch problem statements for this event with live allocated counts & capacities
    const { problemStatements: psListForEvent } = await fetchProblemStatementsForEvent(eventId);
    const psMapByTitle = new Map((psListForEvent || []).map(p => [String(p.title || '').trim().toLowerCase(), p]));
    const psMapById = new Map((psListForEvent || []).map(p => [String(p.id), p]));

    // Fetch existing team allocations to preserve independent Venue or Problem Statement values
    const { data: existingAllocs } = await supabase
      .from('team_allocations')
      .select('*')
      .eq('event_id', eventId);

    const existingTeamAllocMap = new Map((existingAllocs || []).filter(a => a.team_id).map(a => [a.team_id, a]));
    const existingUserAllocMap = new Map((existingAllocs || []).filter(a => a.user_id).map(a => [a.user_id, a]));

    // Track live capacity usage changes per problem statement during batch processing
    const psSimulatedCounts = new Map((psListForEvent || []).map(p => [String(p.id), Number(p.allocated_count || 0)]));

    const seenEntries = new Set();
    const recordsToUpsert = [];
    const recordsToNotify = [];

    for (let i = 0; i < allocations.length; i++) {
      const item = allocations[i];
      let rawId = String(item.teamId || item['Team ID'] || '').trim();
      const teamName = String(item.teamName || item['Team Name'] || 'Row ' + (i + 1)).trim();
      const inputVenueRoom = item.venueRoom !== undefined && item.venueRoom !== null
        ? String(item.venueRoom || item['Venue / Room'] || '').trim()
        : String(item['Venue / Room'] || item.venueRoom || '').trim();
      const inputProblemStatement = item.problemStatement !== undefined && item.problemStatement !== null
        ? String(item.problemStatement || item['Problem Statement'] || '').trim()
        : String(item['Problem Statement'] || item.problemStatement || '').trim();

      let targetTeamId = null;
      let targetUserId = null;

      if (rawId.startsWith('user_')) {
        targetUserId = rawId.replace('user_', '');
      } else if (item.userId) {
        targetUserId = item.userId;
      } else if (validTeamMap.has(rawId)) {
        targetTeamId = rawId;
      } else if (validIndivSet.has(rawId)) {
        targetUserId = rawId;
      }

      if (!targetTeamId && !targetUserId) {
        return res.status(400).json({ message: `Participant or Team not found: ${teamName} (${rawId || 'No ID'})` });
      }

      const existingRecord = targetTeamId ? existingTeamAllocMap.get(targetTeamId) : existingUserAllocMap.get(targetUserId);
      const oldProblemStatement = existingRecord ? String(existingRecord.problem_statement || '').trim() : '';

      // VENUE AND PROBLEM STATEMENT ARE COMPLETELY INDEPENDENT
      const finalVenueRoom = (inputVenueRoom !== '')
        ? inputVenueRoom
        : (existingRecord ? (existingRecord.venue_room || '') : '');

      // PROBLEM STATEMENT IS OPTIONAL
      let targetPS = null;
      let finalProblemStatement = '';
      let matchedPsId = null;

      if (inputProblemStatement) {
        const normInputPS = inputProblemStatement.toLowerCase();
        targetPS = psMapByTitle.get(normInputPS) || psMapById.get(inputProblemStatement) || null;

        if (!targetPS) {
          return res.status(400).json({ message: `Problem statement '${inputProblemStatement}' not found for team: ${teamName}` });
        }

        finalProblemStatement = targetPS.title;
        matchedPsId = targetPS.id;
      } else if (existingRecord && existingRecord.problem_statement) {
        // Blank input cell means "Do not modify existing Problem Statement"
        finalProblemStatement = existingRecord.problem_statement;
        matchedPsId = existingRecord.problem_statement_id || (psMapByTitle.get(finalProblemStatement.toLowerCase())?.id || null);
        targetPS = matchedPsId ? psMapById.get(String(matchedPsId)) : psMapByTitle.get(finalProblemStatement.toLowerCase());
      }

      const newProblemStatement = String(finalProblemStatement || '').trim();
      const isPsNewlyAssignedOrChanged = newProblemStatement !== '' && newProblemStatement.toLowerCase() !== oldProblemStatement.toLowerCase();

      // Check capacity if problem statement is being newly assigned or changed
      const oldPsId = existingRecord && existingRecord.problem_statement_id
        ? String(existingRecord.problem_statement_id)
        : (existingRecord && existingRecord.problem_statement ? psMapByTitle.get(existingRecord.problem_statement.toLowerCase())?.id : null);

      const newPsId = matchedPsId ? String(matchedPsId) : null;

      if (newPsId && newPsId !== String(oldPsId)) {
        const currentCount = psSimulatedCounts.get(newPsId) || 0;

        if (oldPsId && psSimulatedCounts.has(String(oldPsId))) {
          psSimulatedCounts.set(String(oldPsId), Math.max(0, psSimulatedCounts.get(String(oldPsId)) - 1));
        }

        psSimulatedCounts.set(newPsId, currentCount + 1);
      }

      const key = targetTeamId ? `team_${targetTeamId}` : `user_${targetUserId}`;
      if (seenEntries.has(key)) {
        return res.status(400).json({ message: `Duplicate allocation row found for: ${teamName}` });
      }
      seenEntries.add(key);

      const record = {
        event_id: eventId,
        venue_room: finalVenueRoom,
        problem_statement: finalProblemStatement,
        problem_statement_id: matchedPsId,
        updated_at: new Date().toISOString()
      };
      if (targetTeamId) record.team_id = targetTeamId;
      if (targetUserId) record.user_id = targetUserId;

      recordsToUpsert.push(record);
      
      // STRICT EMAIL RULE: Send notification ONLY if Problem Statement is newly assigned or changed!
      if (isPsNewlyAssignedOrChanged) {
        recordsToNotify.push(record);
      }
    }

    const teamRecords = recordsToUpsert.filter(r => r.team_id);
    const indivRecords = recordsToUpsert.filter(r => r.user_id);

    if (teamRecords.length > 0) {
      const { error: err1 } = await supabase.from('team_allocations').upsert(teamRecords, { onConflict: 'event_id,team_id' });
      if (err1) throw err1;
    }
    if (indivRecords.length > 0) {
      const { error: err2 } = await supabase.from('team_allocations').upsert(indivRecords, { onConflict: 'event_id,user_id' });
      if (err2) throw err2;
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

    // Trigger allocation emails ONLY for teams with a newly assigned or changed Problem Statement
    for (const record of recordsToNotify) {
      sendAllocationEmailToTeam({
        eventId,
        teamId: record.team_id || null,
        userId: record.user_id || null,
        problemStatement: record.problem_statement,
        venueRoom: record.venue_room
      }).catch(e => console.error('Failed to trigger allocation email after saveTeamAllocations:', e.message));
    }

    res.json({ message: `Successfully saved allocations for ${recordsToUpsert.length} entry(ies).` });
  } catch (err) {
    console.error('saveTeamAllocations error:', err.message);
    res.status(500).json({ message: err.message || 'Failed to save team allocations.', error: err.message });
  }
};

/**
 * GET /api/allocations/event/:eventId/my-allocation
 * Fetch team/individual allocation & available problem statement selection for logged-in student (Participant View)
 */
exports.getMyTeamAllocation = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    // Check 1: Find student's registration
    const { data: registration } = await supabase
      .from('event_registrations')
      .select('team_id, status, attendance_status')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!registration || registration.status !== 'registered') {
      return res.json({
        allocation: null,
        teamConfirmed: false,
        checkedIn: false,
        isLeader: false,
        message: 'No active registration found for this event.'
      });
    }

    const isTeamReg = !!registration.team_id;
    let team = null;
    let isTeamConfirmed = false;
    let isLeader = false;
    let isCheckedIn = (registration.attendance_status === 'Present');
    let teamName = 'Individual Participant';

    if (isTeamReg) {
      // Check team & leader status for team registration
      const { data: fetchedTeam } = await supabase
        .from('event_teams')
        .select('id, name, leader_id, status')
        .eq('id', registration.team_id)
        .maybeSingle();

      team = fetchedTeam;
      isTeamConfirmed = team && (team.status === 'registered' || team.status === 'confirmed');
      isLeader = team ? (String(team.leader_id) === String(userId)) : false;
      if (team) teamName = team.name || 'Your Team';

      if (!isTeamConfirmed) {
        return res.json({
          allocation: null,
          teamConfirmed: false,
          checkedIn: isCheckedIn,
          isLeader,
          isIndividual: false,
          message: 'Team registration is not confirmed yet.'
        });
      }
    } else {
      // Individual registration: automatically confirmed & registrant is owner/leader
      isTeamConfirmed = true;
      isLeader = true;
    }

    // Fetch allocation if ALREADY selected/assigned
    let allocQuery = supabase
      .from('team_allocations')
      .select('venue_room, problem_statement, problem_statement_id, updated_at')
      .eq('event_id', eventId);

    if (isTeamReg) {
      allocQuery = allocQuery.eq('team_id', registration.team_id);
    } else {
      allocQuery = allocQuery.eq('user_id', userId);
    }

    const { data: alloc } = await allocQuery.maybeSingle();

    const venueDisplay = (alloc && alloc.venue_room && alloc.venue_room.trim()) ? alloc.venue_room.trim() : 'Yet to assign';

    if (alloc && alloc.problem_statement && alloc.problem_statement.trim() !== '') {
      let problemDescription = '';
      let allocCode = '';
      try {
        let psInfo = null;

        if (alloc.problem_statement_id && typeof alloc.problem_statement_id === 'string' && alloc.problem_statement_id.length > 20) {
          const { data: infoById } = await supabase
            .from('event_problem_statements')
            .select('code, description')
            .eq('event_id', eventId)
            .eq('id', alloc.problem_statement_id)
            .maybeSingle();
          psInfo = infoById;
        }

        if (!psInfo && alloc.problem_statement) {
          const { data: infoByTitle } = await supabase
            .from('event_problem_statements')
            .select('code, description')
            .eq('event_id', eventId)
            .eq('title', alloc.problem_statement)
            .maybeSingle();
          psInfo = infoByTitle;
        }

        if (psInfo) {
          allocCode = psInfo.code || '';
          problemDescription = psInfo.description || '';
        }
      } catch (psErr) {
        console.warn('Non-fatal error getting problem statement description:', psErr.message);
      }

      return res.json({
        allocation: {
          teamName: teamName,
          venueRoom: venueDisplay,
          code: allocCode,
          problemStatement: alloc.problem_statement,
          description: problemDescription,
          updatedAt: alloc.updated_at,
          statusText: 'Allocation Assigned'
        },
        teamConfirmed: true,
        checkedIn: isCheckedIn,
        isLeader,
        isIndividual: !isTeamReg,
        venueRoom: venueDisplay,
        availableProblemStatements: []
      });
    }

    // Unallocated state for Problem Statement
    if (!isCheckedIn) {
      return res.json({
        allocation: null,
        teamConfirmed: true,
        checkedIn: false,
        isLeader,
        isIndividual: !isTeamReg,
        venueRoom: venueDisplay,
        message: 'Problem statement selection will be available after attendance check-in.'
      });
    }

    // Fetch configured problem statements for selection if unallocated
    const { problemStatements } = await fetchProblemStatementsForEvent(eventId);

    const availableProblemStatements = (problemStatements || []).map((ps, i) => {
      const allocCount = Number(ps.allocated_count || 0);
      const rawCap = ps.max_capacity ?? ps.maxCapacity;
      const maxCap = (rawCap !== undefined && rawCap !== null && !isNaN(Number(rawCap)) && Number(rawCap) > 0) ? Number(rawCap) : 5;
      const slotsRem = Math.max(0, maxCap - allocCount);

      return {
        id: ps.id,
        code: ps.code || `PS${String(i + 1).padStart(2, '0')}`,
        title: ps.title,
        description: ps.description || '',
        maxCapacity: maxCap,
        max_capacity: maxCap,
        allocatedCount: allocCount,
        allocated_count: allocCount,
        slotsRemaining: slotsRem
      };
    });

    res.json({
      allocation: null,
      teamConfirmed: true,
      checkedIn: true,
      isLeader,
      isIndividual: !isTeamReg,
      venueRoom: venueDisplay,
      availableProblemStatements,
      message: isTeamReg 
        ? (isLeader ? 'Please select a problem statement for your team.' : 'Waiting for your team leader to make a selection.')
        : 'Please select a problem statement.'
    });
  } catch (err) {
    console.error('getMyTeamAllocation error:', err.message);
    res.status(500).json({ message: 'Failed to fetch team allocation.', error: err.message });
  }
};

/**
 * DELETE /api/allocations/event/:eventId/target/:targetId
 * Remove / Clear allocation for a team or individual participant (Organizers)
 */
exports.deleteAllocation = async (req, res) => {
  try {
    const { eventId, targetId } = req.params;

    const { data: event } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle();
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    const isOrganizer = req.user.roles.includes('admin') || await checkCoreOrganizerAccess(eventId, event, req.user);
    if (!isOrganizer) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    let deleteQuery = supabase
      .from('team_allocations')
      .delete()
      .eq('event_id', eventId);

    if (targetId.startsWith('user_')) {
      const uId = targetId.replace('user_', '');
      deleteQuery = deleteQuery.eq('user_id', uId);
    } else {
      const { data: team } = await supabase.from('event_teams').select('id').eq('id', targetId).maybeSingle();
      if (team) {
        deleteQuery = deleteQuery.eq('team_id', targetId);
      } else {
        deleteQuery = deleteQuery.eq('user_id', targetId);
      }
    }

    const { error: delErr } = await deleteQuery;
    if (delErr) throw delErr;

    // Sync live allocated_count in event_problem_statements
    const { problemStatements } = await fetchProblemStatementsForEvent(eventId);

    res.json({
      message: 'Allocation successfully removed and slot released.',
      problemStatements
    });
  } catch (err) {
    console.error('deleteAllocation error:', err.message);
    res.status(500).json({ message: 'Failed to remove allocation.', error: err.message });
  }
};

/**
 * POST /api/allocations/event/:eventId/problem-statement-pdf
 * Organizer uploads official Problem Statement PDF document for an event
 */
exports.uploadProblemStatementPdf = async (req, res) => {
  try {
    const { eventId } = req.params;

    const { data: event } = await supabase.from('events').select('id, title, faculty_id, proposed_by, student_organizer_id, organizer_id, created_by').eq('id', eventId).maybeSingle();
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    const isOrganizer = req.user.roles.includes('admin') || await checkCoreOrganizerAccess(eventId, event, req.user);
    if (!isOrganizer) {
      return res.status(403).json({ message: 'Access denied. Only event organizers can upload Problem Statement PDFs.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Please select a valid PDF file to upload.' });
    }

    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname || `Problem_Statements_${eventId}.pdf`;
    const storagePath = `problem_statements/${eventId}_${Date.now()}.pdf`;

    // Upload file to Supabase storage bucket 'documents'.
    let { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(storagePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadErr && /bucket.*not found|not found.*bucket/i.test(uploadErr.message || '')) {
      const { error: bucketErr } = await supabase.storage.createBucket('documents', { public: true });
      if (!bucketErr || /already exists/i.test(bucketErr.message || '')) {
        ({ error: uploadErr } = await supabase.storage.from('documents').upload(storagePath, fileBuffer, {
          contentType: 'application/pdf',
          upsert: true
        }));
      }
    }

    let pdfUrlWithName;
    if (uploadErr) {
      console.error('Supabase storage upload error; using MongoDB fallback:', uploadErr.message);
      if (fileBuffer.length > 10 * 1024 * 1024) {
        throw new Error(`Storage upload failed (${uploadErr.message}). Fallback supports PDFs up to 10 MB.`);
      }
      pdfUrlWithName = `data:application/pdf;base64,${fileBuffer.toString('base64')}`;
    } else {
      const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(storagePath);
      const pdfUrl = publicUrlData ? publicUrlData.publicUrl : null;
      if (!pdfUrl) throw new Error('Failed to retrieve public URL for uploaded PDF.');
      pdfUrlWithName = `${pdfUrl}?filename=${encodeURIComponent(fileName)}`;
    }

    // Update events table
    const { error: updateErr } = await supabase
      .from('events')
      .update({
        problem_statement_pdf_url: pdfUrlWithName,
        updated_at: new Date().toISOString()
      })
      .eq('id', eventId);

    if (updateErr) {
      console.warn('Saving PDF reference in problem_statement_documents table:', updateErr.message);
      await supabase
        .from('problem_statement_documents')
        .upsert({
          event_id: String(eventId),
          pdf_url: pdfUrlWithName,
          file_name: fileName,
          updated_at: new Date().toISOString()
        }, { onConflict: 'event_id' });
    }

    res.json({
      message: 'Problem Statement PDF uploaded successfully!',
      pdfUrl: pdfUrlWithName,
      fileName
    });
  } catch (err) {
    console.error('uploadProblemStatementPdf error:', err.message);
    res.status(500).json({ message: 'Failed to upload Problem Statement PDF.', error: err.message });
  }
};

/**
 * GET /api/allocations/event/:eventId/problem-statement-pdf
 * Download exact Admin-uploaded Problem Statement PDF document for an event
 * Attendance-gated for participants: requires attendance_status === 'Present'!
 */
exports.getProblemStatementPdf = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    let { data: event, error: eventFetchErr } = await supabase
      .from('events')
      .select('id, title, faculty_id, proposed_by, student_organizer_id, organizer_id, created_by, problem_statement_pdf_url')
      .eq('id', eventId)
      .maybeSingle();

    if (eventFetchErr && /problem_statement_pdf_url|column/i.test(eventFetchErr.message || '')) {
      const fallbackEvent = await supabase.from('events').select('id, title').eq('id', eventId).maybeSingle();
      event = fallbackEvent.data;
      eventFetchErr = fallbackEvent.error;
    }

    if (!event) return res.status(404).json({ message: 'Event not found.' });

    const isOrganizer = req.user.roles.includes('admin') || await checkCoreOrganizerAccess(eventId, event, req.user);

    if (!isOrganizer) {
      // BACKEND ATTENDANCE CHECK: Participant MUST be marked 'Present'
      const { data: registration } = await supabase
        .from('event_registrations')
        .select('status, attendance_status')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!registration || registration.status !== 'registered') {
        return res.status(403).json({ message: 'No active registration found for this event.' });
      }

      if (registration.attendance_status !== 'Present') {
        return res.status(403).json({
          message: 'Attendance check-in is required before accessing the problem statement document.',
          attendanceRequired: true
        });
      }
    }

    let storedPdfUrl = event.problem_statement_pdf_url;
    if (!storedPdfUrl) {
      const { data: fallbackDoc } = await supabase
        .from('problem_statement_documents')
        .select('pdf_url')
        .eq('event_id', String(eventId))
        .maybeSingle();
      storedPdfUrl = fallbackDoc?.pdf_url || null;
    }

    if (!storedPdfUrl || storedPdfUrl.trim() === '') {
      return res.status(404).json({
        message: 'No Problem Statement PDF has been uploaded for this event by the organizer yet.'
      });
    }

    const pdfUrl = storedPdfUrl.trim();

    // Extract filename from URL query param or fallback to event title
    let downloadFilename = `${(event.title || 'Problem_Statement').replace(/[^a-zA-Z0-9_\- ]/g, '_').replace(/\s+/g, '_')}.pdf`;
    try {
      const urlObj = new URL(pdfUrl);
      const fnParam = urlObj.searchParams.get('filename');
      if (fnParam) downloadFilename = fnParam;
    } catch (e) {}

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${downloadFilename}"`);
    if (pdfUrl.startsWith('data:application/pdf;base64,')) {
      const pdfBuffer = Buffer.from(pdfUrl.slice('data:application/pdf;base64,'.length), 'base64');
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.send(pdfBuffer);
    }

    const axios = require('axios');
    const pdfResponse = await axios.get(pdfUrl.split('?')[0], { responseType: 'arraybuffer' });
    res.setHeader('Content-Length', pdfResponse.data.length);
    res.send(Buffer.from(pdfResponse.data));
  } catch (err) {
    console.error('getProblemStatementPdf error:', err.message);
    res.status(500).json({ message: 'Failed to download Problem Statement PDF.', error: err.message });
  }
};
