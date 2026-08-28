const supabase = require('../config/supabaseClient');

const eventAccess = async (eventId, user) => {
  const { data: event } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle();
  if (!event) return { event: null, allowed: false };
  if (user?.roles?.includes('admin')) return { event, allowed: true };
  const direct = [event.organizer_id, event.student_organizer_id, event.proposed_by, event.faculty_id, event.created_by]
    .some(id => String(id || '') === String(user?.id || ''));
  if (direct) return { event, allowed: true };
  const { data: org } = await supabase.from('event_organizers').select('id').eq('event_id', eventId).eq('student_id', user.id).maybeSingle();
  const { data: member } = await supabase.from('event_members').select('id').eq('event_id', eventId).eq('user_id', user.id).maybeSingle();
  return { event, allowed: !!org || !!member };
};

const getScoring = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { event, allowed } = await eventAccess(eventId, req.user);
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    if (!event.scoring_enabled) return res.json({ enabled: false, visible: false, rounds: [], teams: [] });
    if (!allowed && !event.scoreboard_visible) return res.status(403).json({ message: 'Scoreboard is not visible.' });

    const { data: rounds, error: roundsErr } = await supabase.from('scoring_rounds').select('*, subrounds:scoring_subrounds(*)').eq('event_id', eventId).order('display_order');
    if (roundsErr) throw roundsErr;
    const { data: teams, error: teamsErr } = await supabase.from('event_teams').select('id, name, status').eq('event_id', eventId).eq('status', 'registered').order('name');
    if (teamsErr) throw teamsErr;
    const { data: scores, error: scoresErr } = await supabase.from('scoring_scores').select('*').eq('event_id', eventId);
    if (scoresErr) throw scoresErr;
    res.json({ enabled: true, visible: !!event.scoreboard_visible, canEdit: allowed, rounds: (rounds || []).map(round => ({ ...round, subrounds: (round.subrounds || []).sort((a, b) => a.display_order - b.display_order) })), teams: teams || [], scores: scores || [] });
  } catch (err) {
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
      const numericScore = Number(score);
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

module.exports = { getScoring, updateConfig, updateScore, bulkUpdateScores };
