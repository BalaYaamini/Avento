const supabase = require('../config/supabaseClient');
const { sendEmailNotification, sendInAppNotification, emailBrandHeader } = require('../services/notificationService');
const { buildScoreReportPdf } = require('../services/scoreReportPdf');
const { buildScoreAnalysisPdf } = require('../services/scoreAnalysisPdf');

const ACTIVE_REG_FILTER = '("cancelled","rejected","expired")';

const eventAccess = async (eventId, user) => {
  const { data: event } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle();
  if (!event) return { event: null, allowed: false };
  const userRoles = Array.isArray(user?.roles) ? user.roles : [user?.role].filter(Boolean);
  if (userRoles.includes('admin') || user?.is_admin === true) return { event, allowed: true };
  const userIdStr = String(user?.id || '');
  const direct = [
    event.organizer_id,
    event.student_organizer_id,
    event.proposed_by,
    event.faculty_id,
    event.created_by
  ].some(id => id && String(id) === userIdStr);
  if (direct) return { event, allowed: true };
  const { data: org } = await supabase.from('event_organizers').select('id').eq('event_id', eventId).eq('student_id', user?.id).maybeSingle();
  const { data: member } = await supabase.from('event_members').select('id').eq('event_id', eventId).eq('user_id', user?.id).maybeSingle();
  return { event, allowed: !!org || !!member };
};

// ---- Panel-aware student scoring helpers (v52) ----

// Panels of this user for this event + the student registration ids they may score
const getPanelScoreAccess = async (eventId, userId) => {
  const panels = [];
  const registrationIds = new Set();
  if (!userId) return { panels, registrationIds };
  try {
    const { data: memberRows } = await supabase.from('panel_members').select('panel_id').eq('user_id', userId);
    const panelIds = [...new Set((memberRows || []).map(m => m.panel_id))];
    if (panelIds.length === 0) return { panels, registrationIds };

    const { data: myPanels } = await supabase
      .from('event_panels')
      .select('id, name')
      .in('id', panelIds)
      .eq('event_id', eventId);
    if (!myPanels || myPanels.length === 0) return { panels, registrationIds };
    panels.push(...myPanels);

    const { data: assigns } = await supabase
      .from('panel_assignments')
      .select('registration_id')
      .in('panel_id', myPanels.map(p => p.id));
    (assigns || []).forEach(a => registrationIds.add(a.registration_id));
  } catch (e) {
    console.warn('getPanelScoreAccess warning:', e.message);
  }
  return { panels, registrationIds };
};

// Profiles lookup in chunks of 200. A single .in('id', [hundreds of UUIDs])
// overflows the HTTP header limit (~16KB URL) and silently returns nothing,
// which turns every student into "Unknown Student" on large events.
const fetchProfilesByIds = async (userIds) => {
  const uniqueIds = [...new Set((userIds || []).map(id => String(id)).filter(Boolean))];
  const out = [];
  for (let i = 0; i < uniqueIds.length; i += 200) {
    const chunk = uniqueIds.slice(i, i + 200);
    const { data: rows, error } = await supabase
      .from('profiles')
      .select('id, name, email, roll_number, department')
      .in('id', chunk);
    if (error) {
      console.warn('[Scoring] Profile lookup chunk failed:', error.message);
      continue;
    }
    out.push(...(rows || []));
  }
  return out;
};

// Active students of the event with profile + panel info (same shape as the panel roster)
const fetchEventStudents = async (eventId) => {
  const { data: regs } = await supabase
    .from('event_registrations')
    .select('*')
    .eq('event_id', eventId)
    .not('status', 'in', ACTIVE_REG_FILTER);
  const { data: assigns } = await supabase
    .from('panel_assignments')
    .select('panel_id, registration_id')
    .eq('event_id', eventId);
  const { data: allPanels } = await supabase.from('event_panels').select('id, name').eq('event_id', eventId);

  const userIds = [...new Set((regs || []).map(r => r.user_id).filter(Boolean))];
  const profiles = await fetchProfilesByIds(userIds);

  const profileMap = new Map(profiles.map(p => [String(p.id), p]));
  const panelMap = new Map((allPanels || []).map(p => [p.id, p.name]));
  const panelByReg = new Map((assigns || []).map(a => [a.registration_id, a.panel_id]));

  // Resolve slot dates for each registration (own slot_id, or team's slot_id)
  const teamIds = [...new Set((regs || []).map(r => r.team_id).filter(Boolean))];
  const teamSlotMap = new Map();
  if (teamIds.length > 0) {
    const { data: teams } = await supabase.from('event_teams').select('id, slot_id').in('id', teamIds);
    (teams || []).forEach(t => teamSlotMap.set(t.id, t.slot_id || null));
  }
  const slotIds = [...new Set((regs || []).map(r => r.slot_id || (r.team_id ? teamSlotMap.get(r.team_id) : null)).filter(Boolean))];
  const slotMap = new Map();
  if (slotIds.length > 0) {
    const { data: slots } = await supabase.from('event_slots').select('id, slot_name, slot_date, start_time, end_time').in('id', slotIds);
    (slots || []).forEach(s => slotMap.set(s.id, s));
  }

  return (regs || []).map(r => {
    const prof = profileMap.get(String(r.user_id)) || {};
    const panelId = panelByReg.get(r.id) || null;
    const resolvedSlotId = r.slot_id || (r.team_id ? teamSlotMap.get(r.team_id) : null) || null;
    const slot = resolvedSlotId ? slotMap.get(resolvedSlotId) : null;
    return {
      registration_id: r.id,
      user_id: r.user_id,
      name: prof.name || 'Unknown Student',
      email: prof.email || '',
      roll_number: prof.roll_number || '',
      department: prof.department || '',
      panel_id: panelId,
      panel_name: panelId ? (panelMap.get(panelId) || '') : '',
      registered_at: r.created_at || null,
      slot_id: resolvedSlotId,
      slot_date: slot?.slot_date || null,
      slot_name: slot?.slot_name || null,
      report_email_sent_at: r.report_email_sent_at || null,
      report_email_sent_to: r.report_email_sent_to || ''
    };
  });
};

// Totals + competition ranking across all scored students. Rows without a
// score (comment-only entries) are not ranked, and when activeRegIds is given
// (a Set of active registration ids) scores of cancelled/rejected/expired
// registrations are excluded so ranks and "Rank X of Y" stay correct.
const computeStudentTotals = (studentScores, activeRegIds = null) => {
  const totals = new Map();
  (studentScores || []).forEach(s => {
    if (!s.registration_id) return;
    if (s.score == null || s.score === '') return;
    if (activeRegIds && !activeRegIds.has(s.registration_id)) return;
    totals.set(s.registration_id, (totals.get(s.registration_id) || 0) + Number(s.score || 0));
  });
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const rankMap = new Map();
  let currentRank = 0;
  ranked.forEach(([regId, total], idx) => {
    if (idx === 0 || total < ranked[idx - 1][1]) currentRank = idx + 1;
    rankMap.set(regId, currentRank);
  });
  return { totals, rankMap };
};

const buildMyScorecard = (students, studentScores, myRegistrationId) => {
  if (!myRegistrationId) return null;
  const { totals, rankMap } = computeStudentTotals(studentScores, new Set((students || []).map(s => s.registration_id)));
  const me = students.find(s => s.registration_id === myRegistrationId) || null;
  return {
    registration_id: myRegistrationId,
    student: me,
    scores: (studentScores || []).filter(s => s.registration_id === myRegistrationId),
    total: totals.get(myRegistrationId) || 0,
    rank: rankMap.get(myRegistrationId) || null,
    total_participants: totals.size
  };
};

const fetchStudentComments = async (eventId) => {
  const { data } = await supabase
    .from('student_score_comments')
    .select('registration_id, comment, evaluator_id, updated_at')
    .eq('event_id', eventId);
  return data || [];
};

const getMyRegistrationId = async (eventId, userId) => {
  if (!userId) return null;
  const { data: reg } = await supabase
    .from('event_registrations')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .not('status', 'in', ACTIVE_REG_FILTER)
    .maybeSingle();
  return reg ? reg.id : null;
};

const getScoring = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { event, allowed } = await eventAccess(eventId, req.user);
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    const panelAccess = await getPanelScoreAccess(eventId, req.user?.id);
    const isPanelMember = panelAccess.registrationIds.size > 0;

    if (!event.scoring_enabled) {
      return res.json({
        enabled: false,
        visible: false,
        canEdit: allowed,
        isPanelMember,
        myPanels: panelAccess.panels,
        myStudentIds: [...panelAccess.registrationIds],
        rounds: [],
        teams: [],
        scores: [],
        students: [],
        studentScores: [],
        studentComments: [],
        myScorecard: null
      });
    }

    // Panel members may read criteria + their students even when the public
    // scoreboard is hidden; plain participants only get their own scorecard.
    const canReadFull = allowed || isPanelMember || event.scoreboard_visible;
    if (!canReadFull) {
      const students = await fetchEventStudents(eventId);
      const { data: studentScores } = await supabase
        .from('scoring_scores')
        .select('*')
        .eq('event_id', eventId)
        .not('registration_id', 'is', null);
      const myRegistrationId = await getMyRegistrationId(eventId, req.user?.id);
      return res.json({
        enabled: true,
        visible: false,
        canEdit: false,
        isPanelMember: false,
        myPanels: [],
        myStudentIds: [],
        rounds: [],
        teams: [],
        scores: [],
        students: [],
        studentScores: [],
        studentComments: [],
        myScorecard: buildMyScorecard(students, studentScores || [], myRegistrationId)
      });
    }

    const { data: rounds, error: roundsErr } = await supabase
      .from('scoring_rounds')
      .select('*, subrounds:scoring_subrounds(*)')
      .eq('event_id', eventId)
      .order('display_order');
    if (roundsErr) throw roundsErr;

    const { data: teams, error: teamsErr } = await supabase
      .from('event_teams')
      .select('id, name, status')
      .eq('event_id', eventId)
      .eq('status', 'registered')
      .order('name');
    if (teamsErr) throw teamsErr;

    const { data: scores, error: scoresErr } = await supabase
      .from('scoring_scores')
      .select('*')
      .eq('event_id', eventId);
    if (scoresErr) throw scoresErr;

    const students = await fetchEventStudents(eventId);
    const studentScores = (scores || []).filter(s => s.registration_id);

    // Scope: organizers and the public scoreboard see everyone; a panel member
    // with a hidden scoreboard only sees their own panels' students.
    const scoped = allowed || event.scoreboard_visible;
    const scopedStudents = scoped
      ? students
      : students.filter(s => panelAccess.registrationIds.has(s.registration_id));
    const scopedStudentScores = scoped
      ? studentScores
      : studentScores.filter(s => panelAccess.registrationIds.has(s.registration_id));
    const studentComments = await fetchStudentComments(eventId);
    const scopedStudentComments = scoped
      ? studentComments
      : studentComments.filter(c => panelAccess.registrationIds.has(c.registration_id));

    const myRegistrationId = await getMyRegistrationId(eventId, req.user?.id);

    res.json({
      enabled: true,
      visible: !!event.scoreboard_visible,
      canEdit: allowed,
      isPanelMember,
      myPanels: panelAccess.panels,
      myStudentIds: [...panelAccess.registrationIds],
      rounds: (rounds || []).map(round => ({
        ...round,
        subrounds: (round.subrounds || []).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      })),
      teams: teams || [],
      scores: scores || [],
      students: scopedStudents,
      studentScores: scopedStudentScores,
      studentComments: scopedStudentComments,
      myScorecard: buildMyScorecard(students, studentScores, myRegistrationId)
    });
  } catch (err) {
    console.error('getScoring error:', err);
    res.status(500).json({ message: 'Server error fetching scoring data.', error: err.message });
  }
};

const updateConfig = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { event, allowed } = await eventAccess(eventId, req.user);
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    if (!allowed) return res.status(403).json({ message: 'Only an admin or event organizer can edit scoring.' });
    const { enabled, visible, rounds = [] } = req.body;
    const { error: eventErr } = await supabase.from('events').update({ scoring_enabled: !!enabled, scoreboard_visible: !!visible && !!enabled }).eq('id', eventId);
    if (eventErr) throw eventErr;

    const { data: existingRounds } = await supabase.from('scoring_rounds').select('id').eq('event_id', eventId);
    const roundIds = [];
    for (const [roundIndex, round] of rounds.entries()) {
      const payload = { event_id: eventId, name: String(round.name || '').trim() || `Round ${roundIndex + 1}`, display_order: roundIndex };
      let saved;
      if (round.id) {
        const result = await supabase.from('scoring_rounds').update(payload).eq('id', round.id).eq('event_id', eventId).select().single();
        if (result.error) throw result.error;
        saved = result.data;
      } else {
        const result = await supabase.from('scoring_rounds').insert(payload).select().single();
        if (result.error) throw result.error;
        saved = result.data;
      }
      roundIds.push(saved.id);
      const retainedSubroundIds = [];
      for (const [subIndex, sub] of (round.subrounds || []).entries()) {
        const subPayload = { round_id: saved.id, name: String(sub.name || '').trim() || `Criteria ${subIndex + 1}`, max_score: Number(sub.max_score) >= 0 ? Number(sub.max_score) : 100, display_order: subIndex };
        const result = sub.id
          ? await supabase.from('scoring_subrounds').update(subPayload).eq('id', sub.id).eq('round_id', saved.id).select().single()
          : await supabase.from('scoring_subrounds').insert(subPayload).select().single();
        if (result.error) throw result.error;
        retainedSubroundIds.push(result.data.id);
      }
      const { data: existingSubrounds, error: existingSubroundsErr } = await supabase
        .from('scoring_subrounds').select('id').eq('round_id', saved.id);
      if (existingSubroundsErr) throw existingSubroundsErr;
      const removedSubroundIds = (existingSubrounds || []).map(subround => subround.id)
        .filter(id => !retainedSubroundIds.includes(id));
      if (removedSubroundIds.length) {
        const { error: removeSubroundsErr } = await supabase
          .from('scoring_subrounds').delete().in('id', removedSubroundIds).eq('round_id', saved.id);
        if (removeSubroundsErr) throw removeSubroundsErr;
      }
    }
    const removeRounds = (existingRounds || []).map(r => r.id).filter(id => !roundIds.includes(id));
    if (removeRounds.length) await supabase.from('scoring_rounds').delete().in('id', removeRounds).eq('event_id', eventId);
    res.json({ message: 'Scoring configuration saved.' });
  } catch (err) {
    console.error('updateConfig error:', err.message, err);
    res.status(500).json({ message: 'Server error saving scoring configuration.', error: err.message });
  }
};

const updateScore = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { teamId, subroundId, score } = req.body;
    const { event, allowed } = await eventAccess(eventId, req.user);
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    if (!allowed) return res.status(403).json({ message: 'Participants cannot edit scores.' });
    const numericScore = Number(score);
    if (!teamId || !subroundId || !Number.isFinite(numericScore) || numericScore < 0) return res.status(400).json({ message: 'A valid team, subround, and score are required.' });
    const { data: subround } = await supabase.from('scoring_subrounds').select('max_score, scoring_rounds!inner(event_id)').eq('id', subroundId).maybeSingle();
    if (!subround || String(subround.scoring_rounds.event_id) !== String(eventId)) return res.status(400).json({ message: 'Invalid scoring subround.' });
    if (numericScore > Number(subround.max_score)) return res.status(400).json({ message: `Score cannot exceed ${subround.max_score}.` });
    const { data, error } = await supabase.from('scoring_scores').upsert({ event_id: eventId, team_id: teamId, subround_id: subroundId, score: numericScore, evaluator_id: req.user.id, updated_at: new Date().toISOString() }, { onConflict: 'team_id,subround_id' }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Server error saving score.', error: err.message });
  }
};

const bulkUpdateScores = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { scores = [] } = req.body;
    const { event, allowed } = await eventAccess(eventId, req.user);
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    if (!allowed) return res.status(403).json({ message: 'Participants cannot edit scores.' });
    if (!Array.isArray(scores) || scores.length === 0) return res.status(400).json({ message: 'Scores array is required.' });

    const subroundIds = [...new Set(scores.map(s => s.subroundId))];
    const { data: subrounds } = await supabase.from('scoring_subrounds').select('id, max_score, scoring_rounds!inner(event_id)').in('id', subroundIds);
    const validSubrounds = {};
    (subrounds || []).forEach(s => {
      if (String(s.scoring_rounds.event_id) === String(eventId)) validSubrounds[s.id] = Number(s.max_score);
    });

    const rows = [];
    const errors = [];
    scores.forEach(({ teamId, subroundId, score }) => {
      // Blank score = no change (prevents Tab-through/empty blur from writing 0)
      const scoreStr = score == null ? '' : String(score).trim();
      if (scoreStr === '') return;
      const numericScore = Number(scoreStr);
      if (!teamId || !subroundId || !Number.isFinite(numericScore) || numericScore < 0) { errors.push({ teamId, subroundId, error: 'Invalid score' }); return; }
      if (!(subroundId in validSubrounds)) { errors.push({ teamId, subroundId, error: 'Invalid subround' }); return; }
      if (numericScore > validSubrounds[subroundId]) { errors.push({ teamId, subroundId, error: `Score exceeds max ${validSubrounds[subroundId]}` }); return; }
      rows.push({ event_id: eventId, team_id: teamId, subround_id: subroundId, score: numericScore, evaluator_id: req.user.id, updated_at: new Date().toISOString() });
    });

    if (rows.length > 0) {
      const { error } = await supabase.from('scoring_scores').upsert(rows, { onConflict: 'team_id,subround_id' });
      if (error) throw error;
    }

    const { data: updatedScores } = await supabase.from('scoring_scores').select('*').eq('event_id', eventId);
    res.json({ saved: rows.length, errors, scores: updatedScores || [] });
  } catch (err) {
    res.status(500).json({ message: 'Server error bulk saving scores.', error: err.message });
  }
};

// ---- Student score writes (panel members score their own panels' students;
//      organizers/admins may score anyone) ----

const updateStudentScore = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { registrationId, subroundId, score, comment } = req.body;
    const { event, allowed } = await eventAccess(eventId, req.user);
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    const commentProvided = comment !== undefined && comment !== null;
    const scoreStr = score == null ? '' : String(score).trim();
    const hasExplicitScore = scoreStr !== '';

    if (!registrationId || !subroundId || (!hasExplicitScore && !commentProvided)) {
      return res.status(400).json({ message: 'A valid student, subround, and score are required.' });
    }

    if (!allowed) {
      const panelAccess = await getPanelScoreAccess(eventId, req.user?.id);
      if (!panelAccess.registrationIds.has(registrationId)) {
        return res.status(403).json({ message: 'You can only score students assigned to your panel.' });
      }
    }

    const { data: reg } = await supabase
      .from('event_registrations')
      .select('id')
      .eq('id', registrationId)
      .eq('event_id', eventId)
      .not('status', 'in', ACTIVE_REG_FILTER)
      .maybeSingle();
    if (!reg) return res.status(400).json({ message: 'Invalid student registration.' });

    const { data: subround } = await supabase
      .from('scoring_subrounds')
      .select('max_score, scoring_rounds!inner(event_id)')
      .eq('id', subroundId)
      .maybeSingle();
    if (!subround || String(subround.scoring_rounds.event_id) !== String(eventId)) {
      return res.status(400).json({ message: 'Invalid scoring subround.' });
    }

    const { data: existing } = await supabase
      .from('scoring_scores')
      .select('score, comment')
      .eq('event_id', eventId)
      .eq('registration_id', registrationId)
      .eq('subround_id', subroundId)
      .maybeSingle();

    let numericScore;
    if (hasExplicitScore) {
      numericScore = Number(scoreStr);
      if (!Number.isFinite(numericScore) || numericScore < 0) {
        return res.status(400).json({ message: 'A valid student, subround, and score are required.' });
      }
      if (numericScore > Number(subround.max_score)) {
        return res.status(400).json({ message: `Score cannot exceed ${subround.max_score}.` });
      }
    } else {
      const existingScore = existing?.score;
      numericScore = existingScore == null || existingScore === '' ? null : Number(existingScore);
      if (!Number.isFinite(numericScore)) numericScore = null;
    }

    const { data, error } = await supabase.from('scoring_scores').upsert({
      event_id: eventId,
      registration_id: registrationId,
      subround_id: subroundId,
      score: numericScore,
      comment: commentProvided ? String(comment).slice(0, 2000) : (existing?.comment ?? ''),
      evaluator_id: req.user.id,
      updated_at: new Date().toISOString()
    }, { onConflict: 'registration_id,subround_id' }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('updateStudentScore error:', err);
    res.status(500).json({ message: 'Server error saving score.', error: err.message });
  }
};

const bulkUpdateStudentScores = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { scores = [] } = req.body;
    const { event, allowed } = await eventAccess(eventId, req.user);
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    if (!Array.isArray(scores) || scores.length === 0) return res.status(400).json({ message: 'Scores array is required.' });

    const panelAccess = allowed ? null : await getPanelScoreAccess(eventId, req.user?.id);

    const subroundIds = [...new Set(scores.map(s => s.subroundId))];
    const { data: subrounds } = await supabase
      .from('scoring_subrounds')
      .select('id, max_score, scoring_rounds!inner(event_id)')
      .in('id', subroundIds);
    const validSubrounds = {};
    (subrounds || []).forEach(s => {
      if (String(s.scoring_rounds.event_id) === String(eventId)) validSubrounds[s.id] = Number(s.max_score);
    });

    const regIds = [...new Set(scores.map(s => s.registrationId).filter(Boolean))];
    const { data: regs } = await supabase
      .from('event_registrations')
      .select('id')
      .eq('event_id', eventId)
      .in('id', regIds)
      .not('status', 'in', ACTIVE_REG_FILTER);
    const validRegs = new Set((regs || []).map(r => r.id));

    const { data: existingRows } = await supabase
      .from('scoring_scores')
      .select('registration_id, subround_id, score, comment')
      .eq('event_id', eventId)
      .in('registration_id', regIds);
    const existingMap = new Map((existingRows || []).map(r => [`${r.registration_id}:${r.subround_id}`, r]));

    const rows = [];
    const errors = [];
    scores.forEach(({ registrationId, subroundId, score, comment }) => {
      const commentProvided = comment !== undefined && comment !== null;
      const scoreStr = score == null ? '' : String(score).trim();
      const existing = existingMap.get(`${registrationId}:${subroundId}`) || {};

      let numericScore;
      if (scoreStr !== '') {
        numericScore = Number(scoreStr);
      } else if (commentProvided) {
        // Comment-only save: keep any existing score, otherwise store NULL so
        // "not yet scored" stays distinguishable from a real 0 (needs patch v62).
        const existingScore = existing.score;
        numericScore = existingScore == null || existingScore === '' ? null : Number(existingScore);
        if (!Number.isFinite(numericScore)) numericScore = null;
      } else {
        // Blank score with no comment = no change (prevents phantom 0 rows)
        return;
      }

      if (!registrationId || !subroundId || (numericScore != null && (!Number.isFinite(numericScore) || numericScore < 0))) {
        errors.push({ registrationId, subroundId, error: 'Invalid score' });
        return;
      }
      if (!validRegs.has(registrationId)) { errors.push({ registrationId, subroundId, error: 'Invalid student' }); return; }
      if (panelAccess && !panelAccess.registrationIds.has(registrationId)) {
        errors.push({ registrationId, subroundId, error: 'Student is not on your panel' });
        return;
      }
      if (!(subroundId in validSubrounds)) { errors.push({ registrationId, subroundId, error: 'Invalid subround' }); return; }
      if (numericScore != null && numericScore > validSubrounds[subroundId]) {
        errors.push({ registrationId, subroundId, error: `Score exceeds max ${validSubrounds[subroundId]}` });
        return;
      }
      rows.push({
        event_id: eventId,
        registration_id: registrationId,
        subround_id: subroundId,
        score: numericScore,
        comment: commentProvided ? String(comment).slice(0, 2000) : (existing.comment ?? ''),
        evaluator_id: req.user.id,
        updated_at: new Date().toISOString()
      });
    });

    if (rows.length > 0) {
      const { error } = await supabase.from('scoring_scores').upsert(rows, { onConflict: 'registration_id,subround_id' });
      if (error) throw error;
    }

    const { data: updatedScores } = await supabase
      .from('scoring_scores')
      .select('*')
      .eq('event_id', eventId)
      .not('registration_id', 'is', null);
    res.json({ saved: rows.length, errors, scores: updatedScores || [] });
  } catch (err) {
    console.error('bulkUpdateStudentScores error:', err);
    res.status(500).json({ message: 'Server error bulk saving scores.', error: err.message });
  }
};

// ---- Per-student scorecard (v53) ----
// Editors: full access organizers may score/comment on anyone; panel members
// only on the students allocated to their panel. Everyone else (incl. the
// student themselves) gets read-only access.

const getStudentScoreCard = async (req, res) => {
  try {
    const { eventId, registrationId } = req.params;
    const { event, allowed } = await eventAccess(eventId, req.user);
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    const students = await fetchEventStudents(eventId);
    const student = students.find(s => s.registration_id === registrationId);
    if (!student) return res.status(404).json({ message: 'Student not found for this event.' });

    const isSelf = String(student.user_id) === String(req.user?.id);
    const panelAccess = await getPanelScoreAccess(eventId, req.user?.id);
    const isMyStudent = panelAccess.registrationIds.has(registrationId);
    if (!allowed && !isSelf && !isMyStudent) {
      return res.status(403).json({ message: 'You are not allowed to view this scorecard.' });
    }

    const { data: rounds, error: roundsErr } = await supabase
      .from('scoring_rounds')
      .select('*, subrounds:scoring_subrounds(*)')
      .eq('event_id', eventId)
      .order('display_order');
    if (roundsErr) throw roundsErr;

    const { subroundMeta } = await buildSubroundMeta(eventId);
    const { data: allStudentScores } = await supabase
      .from('scoring_scores')
      .select('*')
      .eq('event_id', eventId)
      .not('registration_id', 'is', null);
    const studentScores = (allStudentScores || []).filter(s => subroundMeta.has(s.subround_id));
    const { totals, rankMap } = computeStudentTotals(studentScores, new Set(students.map(s => s.registration_id)));

    const { data: commentRow } = await supabase
      .from('student_score_comments')
      .select('comment')
      .eq('event_id', eventId)
      .eq('registration_id', registrationId)
      .maybeSingle();

    res.json({
      enabled: !!event.scoring_enabled,
      visible: !!event.scoreboard_visible,
      canEdit: allowed || (isMyStudent && !isSelf),
      isSelf,
      student,
      rounds: (rounds || []).map(round => ({
        ...round,
        subrounds: (round.subrounds || []).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      })),
      scores: studentScores.filter(s => s.registration_id === registrationId),
      comment: commentRow?.comment || '',
      total: totals.get(registrationId) || 0,
      rank: rankMap.get(registrationId) || null,
      total_participants: totals.size
    });
  } catch (err) {
    console.error('getStudentScoreCard error:', err);
    res.status(500).json({ message: 'Server error fetching student scorecard.', error: err.message });
  }
};

const updateStudentComment = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { registrationId, comment } = req.body;
    const { event, allowed } = await eventAccess(eventId, req.user);
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    if (!registrationId) return res.status(400).json({ message: 'A student registration is required.' });

    if (!allowed) {
      const panelAccess = await getPanelScoreAccess(eventId, req.user?.id);
      if (!panelAccess.registrationIds.has(registrationId)) {
        return res.status(403).json({ message: 'You can only comment on students assigned to your panel.' });
      }
    }

    const { data: reg } = await supabase
      .from('event_registrations')
      .select('id')
      .eq('id', registrationId)
      .eq('event_id', eventId)
      .not('status', 'in', ACTIVE_REG_FILTER)
      .maybeSingle();
    if (!reg) return res.status(400).json({ message: 'Invalid student registration.' });

    const text = String(comment == null ? '' : comment).slice(0, 5000);
    const { data, error } = await supabase.from('student_score_comments').upsert({
      event_id: eventId,
      registration_id: registrationId,
      comment: text,
      evaluator_id: req.user.id,
      updated_at: new Date().toISOString()
    }, { onConflict: 'event_id,registration_id' }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('updateStudentComment error:', err);
    res.status(500).json({ message: 'Server error saving comment.', error: err.message });
  }
};

const escHtml = (value) => String(value == null ? '' : value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const formatScoreValue = (value) => {
  if (value == null || value === '') return '-';
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
};

const safeFileName = (value) => String(value == null ? '' : value)
  .replace(/[^a-zA-Z0-9_-]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 40) || 'report';

const buildSubroundMeta = async (eventId) => {
  const { data: rounds } = await supabase
    .from('scoring_rounds')
    .select('*, subrounds:scoring_subrounds(*)')
    .eq('event_id', eventId)
    .order('display_order');
  const subroundMeta = new Map();
  const orderedSubs = [];
  (rounds || []).forEach(r =>
    [...(r.subrounds || [])]
      .sort((a, b) => (Number(a.display_order) || 0) - (Number(b.display_order) || 0))
      .forEach(sr => {
        const entry = { roundId: r.id, roundName: r.name, name: sr.name, max: Number(sr.max_score) };
        subroundMeta.set(sr.id, entry);
        orderedSubs.push({ id: sr.id, ...entry });
      })
  );
  return { subroundMeta, orderedSubs };
};

// One row per criterion (same granularity as the scorecard panel) so reports
// show exactly the marks that were entered. A criterion with no score yet
// yields score: null so renderers show '-' instead of a misleading "0 / max".
const buildScoreRows = (orderedSubs, ownScores) => {
  const bySub = new Map((ownScores || []).map(s => [s.subround_id, s]));
  return orderedSubs.map(sub => {
    const row = bySub.get(sub.id);
    const hasScore = Boolean(row && row.score != null && row.score !== '');
    let score = hasScore ? Number(row.score) : 0;
    if (!Number.isFinite(score)) score = 0;
    let max = Number(sub.max);
    if (!Number.isFinite(max) || max < 0) max = 0;
    return {
      roundName: sub.roundName,
      criterionName: sub.name,
      score: hasScore ? score : null,
      max
    };
  });
};

// Per-criterion comments (patch v54) shown alongside the overall comment.
const buildCriterionComments = (subroundMeta, ownScores) =>
  (ownScores || [])
    .filter(s => String(s.comment || '').trim())
    .map(s => ({
      name: (subroundMeta.get(s.subround_id) || {}).name || 'Criterion',
      comment: String(s.comment).trim()
    }));

const createReportPdfAttachment = async ({ event, student, rows, total, rank, totalParticipants, comment, criterionComments }) => {
  const pdfBytes = await buildScoreReportPdf({ event, student, rows, total, rank, totalParticipants, comment, criterionComments });
  return {
    name: `Avento_Score_Report_${safeFileName(event.title)}_${safeFileName(student.name)}.pdf`,
    content: Buffer.from(pdfBytes).toString('base64'),
    contentType: 'application/pdf'
  };
};

// ---- Score reports (HTML email + in-app notification) ----

const buildScoreReportHtml = ({ event, student, rows, total, rank, totalParticipants, comment, criterionComments }) => {
  const displayTotal = rows.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
  const displayMax = rows.reduce((sum, r) => sum + (Number(r.max) || 0), 0);
  const rowsHtml = rows.map(r => `
    <tr>
      <td style="padding:13px 14px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:14px;font-weight:600;">${escHtml(r.criterionName || r.roundName)}${r.criterionName ? `<div style="margin-top:2px;font-size:11px;font-weight:500;color:#94a3b8;">${escHtml(r.roundName)}</div>` : ''}</td>
      <td style="padding:13px 14px;border-bottom:1px solid #f1f5f9;color:#1e293b;font-size:15px;font-weight:700;text-align:center;">${formatScoreValue(r.score)}</td>
      <td style="padding:13px 14px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px;text-align:center;">${formatScoreValue(r.max)}</td>
    </tr>`).join('');

  const commentText = String(comment == null ? '' : comment).trim();
  const critComments = (Array.isArray(criterionComments) ? criterionComments : [])
    .filter(cc => cc && String(cc.comment || '').trim());
  const critHtml = critComments.map(cc => `
              <div style="margin-top:10px;">
                <div style="font-size:11px;font-weight:700;color:#0891b2;text-transform:uppercase;letter-spacing:0.5px;">${escHtml(cc.name)}</div>
                <div style="color:#334155;font-size:13px;line-height:1.7;white-space:pre-wrap;">${escHtml(cc.comment)}</div>
              </div>`).join('');
  const commentHtml = (commentText || critHtml) ? `
        <tr><td style="padding:18px 40px 0;">
          <table width="100%" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
            <tr><td style="padding:16px 18px;">
              <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Evaluator Comments</div>
              ${commentText ? `<div style="color:#334155;font-size:14px;line-height:1.7;white-space:pre-wrap;">${escHtml(commentText)}</div>` : ''}
              ${critHtml}
            </td></tr>
          </table>
        </td></tr>` : '';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:sans-serif;background-color:#fdfbf7;">
  <table width="100%" style="background-color:#fdfbf7;padding:40px 20px;">
    <tr><td align="center">
      <table style="max-width:640px;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
        <tr><td style="padding:36px 40px 12px;text-align:center;">
          ${emailBrandHeader('Evaluation Score Report')}
        </td></tr>
        <tr><td style="padding:0 40px;"><hr style="border:0;border-top:1px solid #f1f5f9;"></td></tr>
        <tr><td style="padding:28px 40px 8px;">
          <h2 style="margin:0 0 6px;font-size:22px;color:#1e293b;">${escHtml(event.title)}</h2>
          <p style="margin:0;color:#64748b;font-size:14px;line-height:1.7;">
            <strong style="color:#334155;">${escHtml(student.name)}</strong><br>
            ${student.roll_number ? `Roll No: ${escHtml(student.roll_number)}${student.department ? ` &middot; ${escHtml(student.department)}` : ''}<br>` : ''}
          </p>
        </td></tr>
        <tr><td style="padding:18px 40px;">
          <table width="100%" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;border-collapse:collapse;">
            <tr style="background-color:#f8fafc;">
              <th style="padding:12px 14px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Round / Criterion</th>
              <th style="padding:12px 14px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Score</th>
              <th style="padding:12px 14px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Max</th>
            </tr>
            ${rowsHtml}
          </table>
        </td></tr>
        <tr><td style="padding:8px 40px 0;">
          <table width="100%" style="background:linear-gradient(135deg,#06b6d4,#0891b2);border-radius:14px;">
            <tr>
              <td style="padding:18px 22px;color:#ffffff;font-size:15px;font-weight:700;">Total Score</td>
              <td style="padding:18px 22px;color:#ffffff;font-size:22px;font-weight:800;text-align:right;">${formatScoreValue(displayTotal)} <span style="font-size:13px;font-weight:600;opacity:0.9;">/ ${formatScoreValue(displayMax)}</span>${rank ? ` <span style="font-size:13px;font-weight:600;opacity:0.9;">(Rank ${rank} of ${totalParticipants})</span>` : ''}</td>
            </tr>
          </table>
        </td></tr>
        ${commentHtml}
        <tr><td style="padding:18px 40px 30px;">
          <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center;">
            AVENTO - Smart Campus Event Management &middot; Report generated ${new Date().toLocaleString()}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

const sendStudentScoreReports = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { registrationIds } = req.body || {};
    const { event, allowed } = await eventAccess(eventId, req.user);
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    const students = await fetchEventStudents(eventId);
    const { data: allStudentScores } = await supabase
      .from('scoring_scores')
      .select('*')
      .eq('event_id', eventId)
      .not('registration_id', 'is', null);
    const { subroundMeta, orderedSubs } = await buildSubroundMeta(eventId);
    const studentScores = (allStudentScores || []).filter(s => subroundMeta.has(s.subround_id));
    const activeRegIds = new Set(students.map(s => s.registration_id));
    const { totals, rankMap } = computeStudentTotals(studentScores, activeRegIds);
    const commentRows = await fetchStudentComments(eventId);
    const commentMap = new Map(commentRows.map(c => [c.registration_id, c.comment]));

    // Targets: an explicit subset, or every student with at least one score
    const scoredRegIds = new Set(studentScores.filter(s => s.score != null && s.score !== '').map(s => s.registration_id));
    let targets;
    if (Array.isArray(registrationIds) && registrationIds.length > 0) {
      const wanted = new Set(registrationIds);
      targets = students.filter(s => wanted.has(s.registration_id));
    } else {
      targets = students.filter(s => scoredRegIds.has(s.registration_id));
    }
    if (targets.length === 0) {
      return res.status(400).json({ message: 'No scored students to report.' });
    }

    const panelAccess = allowed ? null : await getPanelScoreAccess(eventId, req.user?.id);
    if (!allowed && panelAccess.registrationIds.size === 0) {
      return res.status(403).json({ message: 'Only organizers or panel members can send score reports.' });
    }

    const sent = [];
    const failed = [];
    const skipped = [];
    let mockUsed = false;
    for (const student of targets) {
      if (panelAccess && !panelAccess.registrationIds.has(student.registration_id)) {
        skipped.push({ registrationId: student.registration_id, name: student.name, reason: 'Student is not on your panel' });
        continue;
      }
      const own = studentScores.filter(s => s.registration_id === student.registration_id);
      if (!own.some(s => s.score != null && s.score !== '')) {
        skipped.push({ registrationId: student.registration_id, name: student.name, reason: 'No scores entered yet' });
        continue;
      }

      const rows = buildScoreRows(orderedSubs, own);
      const criterionComments = buildCriterionComments(subroundMeta, own);
      const total = totals.get(student.registration_id) || 0;
      const rank = rankMap.get(student.registration_id) || null;
      const comment = commentMap.get(student.registration_id) || '';

      let emailOk = false;
      let emailError = student.email ? null : 'No email address on profile (in-app notification sent)';
      if (student.email) {
        let attachments;
        try {
          attachments = [await createReportPdfAttachment({ event, student, rows, total, rank, totalParticipants: totals.size, comment, criterionComments })];
        } catch (pdfErr) {
          console.warn('Score report PDF generation failed (sending email without attachment):', pdfErr.message);
        }
        // sendEmailNotification reports failure via { ok: false } - only a
        // confirmed delivery may be tracked as sent.
        let result;
        try {
          result = await sendEmailNotification({
            recipientEmail: student.email,
            subject: `Score Report - ${event.title}`,
            htmlBody: buildScoreReportHtml({ event, student, rows, total, rank, totalParticipants: totals.size, comment, criterionComments }),
            attachments
          });
        } catch (mailErr) {
          result = { ok: false, error: mailErr.message };
        }
        if (result && result.ok) {
          emailOk = true;
          if (result.channel === 'mock') mockUsed = true;
          // Record that the report email was sent (non-fatal if tracking columns are absent).
          try {
            const { error: trackErr } = await supabase
              .from('event_registrations')
              .update({ report_email_sent_at: new Date().toISOString(), report_email_sent_to: student.email })
              .eq('id', student.registration_id);
            if (trackErr) console.warn('Score report email tracking not recorded:', trackErr.message);
          } catch (trackErr) {
            console.warn('Score report email tracking not recorded:', trackErr.message);
          }
        } else {
          emailError = (result && result.error) || 'Email delivery failed';
        }
      }

      try {
        await sendInAppNotification({
          recipientId: student.user_id,
          title: `Score report for ${event.title}`,
          message: `Your evaluation report is ready. Total: ${formatScoreValue(total)}${rank ? ` | Rank: ${rank} of ${totals.size}` : ''}. Open the event to view your full scorecard.`,
          type: 'info',
          eventId
        });
      } catch (inAppErr) {
        console.warn(`Score report in-app notification failed for registration ${student.registration_id}:`, inAppErr.message);
      }

      if (emailOk) {
        sent.push({ registrationId: student.registration_id, name: student.name });
      } else {
        failed.push({ registrationId: student.registration_id, name: student.name, reason: emailError || 'Email delivery failed' });
      }
    }

    const parts = [`Sent ${sent.length} score report(s)`];
    if (failed.length) parts.push(`${failed.length} failed`);
    if (skipped.length) parts.push(`${skipped.length} skipped`);
    let message = `${parts.join(', ')}.${mockUsed ? ' [mock mode - no actual emails were delivered]' : ''}`;
    if (failed.length) {
      const reason = String(failed[0].reason || '').replace(/\s*\n\s*/g, ' ').slice(0, 300);
      message += ` Email error: ${reason}`;
    }
    res.json({
      message,
      sent,
      failed,
      skipped
    });
  } catch (err) {
    console.error('sendStudentScoreReports error:', err);
    res.status(500).json({ message: 'Server error sending score reports.', error: err.message });
  }
};

const getStudentScoreReportPdf = async (req, res) => {
  try {
    const { eventId, registrationId } = req.params;
    const { event, allowed } = await eventAccess(eventId, req.user);
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    const students = await fetchEventStudents(eventId);
    const student = students.find(s => s.registration_id === registrationId);
    if (!student) return res.status(404).json({ message: 'Student not found for this event.' });

    if (!allowed) {
      const isSelf = String(student.user_id) === String(req.user?.id);
      const panelAccess = await getPanelScoreAccess(eventId, req.user?.id);
      if (!isSelf && !panelAccess.registrationIds.has(registrationId)) {
        return res.status(403).json({ message: 'You are not allowed to download this report.' });
      }
    }

    const { data: allStudentScores } = await supabase
      .from('scoring_scores')
      .select('*')
      .eq('event_id', eventId)
      .not('registration_id', 'is', null);
    const { subroundMeta, orderedSubs } = await buildSubroundMeta(eventId);
    const studentScores = (allStudentScores || []).filter(s => subroundMeta.has(s.subround_id));
    const activeRegIds = new Set(students.map(s => s.registration_id));
    const { totals, rankMap } = computeStudentTotals(studentScores, activeRegIds);

    const own = studentScores.filter(s => s.registration_id === student.registration_id);
    if (own.length === 0) {
      return res.status(400).json({ message: 'No scores entered for this student yet.' });
    }

    const rows = buildScoreRows(orderedSubs, own);
    const criterionComments = buildCriterionComments(subroundMeta, own);
    const total = totals.get(student.registration_id) || 0;
    const rank = rankMap.get(student.registration_id) || null;
    const { data: commentRow } = await supabase
      .from('student_score_comments')
      .select('comment')
      .eq('event_id', eventId)
      .eq('registration_id', registrationId)
      .maybeSingle();

    const pdfBytes = await buildScoreReportPdf({ event, student, rows, total, rank, totalParticipants: totals.size, comment: commentRow?.comment || '', criterionComments });
    const fileName = `Avento_Score_Report_${safeFileName(event.title)}_${safeFileName(student.name)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('getStudentScoreReportPdf error:', err);
    return res.status(500).json({ message: 'Server error generating score report.', error: err.message });
  }
};

const getScoringAnalysisPdf = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { event, allowed } = await eventAccess(eventId, req.user);
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    const panelAccess = allowed ? null : await getPanelScoreAccess(eventId, req.user?.id);
    if (!allowed && panelAccess.registrationIds.size === 0) {
      return res.status(403).json({ message: 'Only organizers or panel members can download the score analysis.' });
    }

    const students = await fetchEventStudents(eventId);
    const scopedStudents = allowed
      ? students
      : students.filter(s => panelAccess.registrationIds.has(s.registration_id));

    const { data: allStudentScores } = await supabase
      .from('scoring_scores')
      .select('*')
      .eq('event_id', eventId)
      .not('registration_id', 'is', null);
    const { subroundMeta, orderedSubs } = await buildSubroundMeta(eventId);
    const scopedIds = new Set(scopedStudents.map(s => s.registration_id));
    const scopedScores = (allStudentScores || [])
      .filter(s => subroundMeta.has(s.subround_id) && scopedIds.has(s.registration_id));

    if (scopedScores.length === 0) {
      return res.status(400).json({ message: 'No scores entered yet.' });
    }

    const pdfBytes = await buildScoreAnalysisPdf({ event, students: scopedStudents, orderedSubs, scores: scopedScores });
    const fileName = `Avento_Score_Analysis_${safeFileName(event.title)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('getScoringAnalysisPdf error:', err);
    return res.status(500).json({ message: 'Server error generating score analysis.', error: err.message });
  }
};

module.exports = { getScoring, updateConfig, updateScore, bulkUpdateScores, updateStudentScore, bulkUpdateStudentScores, getStudentScoreCard, updateStudentComment, sendStudentScoreReports, getStudentScoreReportPdf, getScoringAnalysisPdf };
