const supabase = require('../config/supabaseClient');
const User = require('../models/User');

/** GET /scoring/:eventId/config — Get scoring config for an event */
exports.getScoringConfig = async (req, res) => {
  try {
    const { eventId } = req.params;

    const { data: config, error } = await supabase
      .from('scoring_configs')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle();

    if (error) throw error;
    res.json(config || null);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching scoring config.', error: err.message });
  }
};

/** PUT /scoring/:eventId/config — Create or update scoring config (admin/faculty only) */
exports.upsertScoringConfig = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { numLevels, levels } = req.body;

    if (!numLevels || !levels || !Array.isArray(levels)) {
      return res.status(400).json({ message: 'numLevels and levels array are required.' });
    }

    const { data: config, error } = await supabase
      .from('scoring_configs')
      .upsert({
        event_id: eventId,
        num_levels: numLevels,
        levels: levels,
        updated_at: new Date().toISOString()
      }, { onConflict: 'event_id' })
      .select()
      .single();

    if (error) throw error;
    res.json(config);
  } catch (err) {
    res.status(500).json({ message: 'Server error saving scoring config.', error: err.message });
  }
};

/** GET /scoring/:eventId/leaderboard — Get leaderboard with all team/registrant scores */
exports.getLeaderboard = async (req, res) => {
  try {
    const { eventId } = req.params;

    const { data: config } = await supabase
      .from('scoring_configs')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle();

    // Check if event is team or individual
    const { data: event } = await supabase
      .from('events')
      .select('registration_type')
      .eq('id', eventId)
      .maybeSingle();

    const isTeamEvent = event?.registration_type === 'team';

    let participants = [];

    if (isTeamEvent) {
      const { data: teams, error: teamsErr } = await supabase
        .from('event_teams')
        .select('id, name, leader_id, status')
        .eq('event_id', eventId)
        .eq('status', 'registered');
      if (teamsErr) throw teamsErr;
      participants = (teams || []).map(t => ({ id: t.id, name: t.name }));
    } else {
      // For individual events, use registrations as participants
      const { data: regs, error: regsErr } = await supabase
        .from('event_registrations')
        .select('id, user_id, status')
        .eq('event_id', eventId)
        .eq('status', 'registered');
      if (regsErr) throw regsErr;

      // Fetch profiles for names
      const userIds = (regs || []).map(r => r.user_id).filter(Boolean);
      let profiles = [];
      if (userIds.length > 0) {
        const { data: profData } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', userIds);
        profiles = profData || [];

        // For any missing profiles, get name from MongoDB
        const foundIds = new Set((profiles || []).map(p => p.id));
        const missingIds = userIds.filter(id => !foundIds.has(id));
        if (missingIds.length > 0) {
          const mongoUsers = await User.find({ _id: { $in: missingIds } }).select('name email');
          for (const u of mongoUsers) {
            const name = u.name || u.email?.split('@')[0] || 'Unknown';
            profiles.push({ id: u._id.toString(), name, email: u.email || '' });
            // Upsert into Supabase profiles so future lookups work
            await supabase.from('profiles').upsert(
              { id: u._id.toString(), name, email: u.email || '' },
              { onConflict: 'id' }
            );
          }
        }
      }
      const profileMap = {};
      profiles.forEach(p => { profileMap[p.id] = p.name || 'Unknown'; });

      participants = (regs || []).map(r => ({
        id: r.id,
        name: profileMap[r.user_id] || 'Unknown'
      }));
    }

    const { data: scores, error: scoresErr } = await supabase
      .from('event_scores')
      .select('*')
      .eq('event_id', eventId);

    if (scoresErr) throw scoresErr;

    // Fetch scorer profiles separately
    const scorerIds = [...new Set((scores || []).map(s => s.scored_by).filter(Boolean))];
    let scorerProfiles = [];
    if (scorerIds.length > 0) {
      const { data: profData } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', scorerIds);
      scorerProfiles = profData || [];

      // MongoDB fallback for missing scorer profiles
      const foundScorerIds = new Set((scorerProfiles || []).map(p => p.id));
      const missingScorerIds = scorerIds.filter(id => !foundScorerIds.has(id));
      if (missingScorerIds.length > 0) {
        const mongoUsers = await User.find({ _id: { $in: missingScorerIds } }).select('name email');
        for (const u of mongoUsers) {
          const name = u.name || u.email?.split('@')[0] || 'Unknown';
          scorerProfiles.push({ id: u._id.toString(), name });
          await supabase.from('profiles').upsert(
            { id: u._id.toString(), name, email: u.email || '' },
            { onConflict: 'id' }
          );
        }
      }
    }
    const scorerMap = {};
    scorerProfiles.forEach(p => { scorerMap[p.id] = p.name; });

    const levels = config?.levels || [];

    console.log('[SCORING] Leaderboard fetch:', {
      eventId,
      participantCount: participants.length,
      scoreCount: (scores || []).length,
      levelCount: levels.length
    });

    const leaderboard = participants.map(participant => {
      const teamScores = (scores || []).filter(s => s.team_id === participant.id);
      let weightedTotal = 0;

      const levelScores = levels.map((level, idx) => {
        const scoreEntry = teamScores.find(s => s.level === idx + 1);
        const raw = scoreEntry?.score || 0;
        const weight = level.weight || 1;
        const weighted = raw * weight;
        weightedTotal += weighted;
        return {
          level: idx + 1,
          name: level.name,
          raw,
          weight,
          weighted,
          maxScore: level.max_score,
          scoredBy: scorerMap[scoreEntry?.scored_by] || null,
          notes: scoreEntry?.notes || null,
          scoreId: scoreEntry?.id || null
        };
      });

      return {
        teamId: participant.id,
        teamName: participant.name,
        weightedTotal,
        levelScores
      };
    });

    leaderboard.sort((a, b) => b.weightedTotal - a.weightedTotal);

    leaderboard.forEach((entry, idx) => {
      entry.rank = idx + 1;
    });

    res.json({
      config,
      levels,
      leaderboard
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching leaderboard.', error: err.message });
  }
};

/** POST /scoring/:eventId/scores — Submit or update a score (admin/faculty only) */
exports.submitScore = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { teamId, level, score, notes } = req.body;
    console.log('[SCORING] Submit score:', { eventId, teamId, level, score, notes, scoredBy: req.user?.id });

    if (!teamId || level === undefined || score === undefined) {
      return res.status(400).json({ message: 'teamId, level, and score are required.' });
    }

    const { data: config } = await supabase
      .from('scoring_configs')
      .select('levels')
      .eq('event_id', eventId)
      .maybeSingle();

    const levels = config?.levels || [];
    const levelDef = levels[level - 1];
    if (levelDef && (score < 0 || score > levelDef.max_score)) {
      return res.status(400).json({ message: `Score must be between 0 and ${levelDef.max_score}.` });
    }

    const { data: existing } = await supabase
      .from('event_scores')
      .select('id')
      .eq('event_id', eventId)
      .eq('team_id', teamId)
      .eq('level', level)
      .maybeSingle();

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from('event_scores')
        .update({
          score: Number(score),
          notes: notes || null,
          scored_by: req.user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) {
        console.error('[SCORING] Update error:', error);
        throw error;
      }
      result = data;
    } else {
      const { data, error } = await supabase
        .from('event_scores')
        .insert({
          event_id: eventId,
          team_id: teamId,
          level: Number(level),
          score: Number(score),
          notes: notes || null,
          scored_by: req.user.id
        })
        .select()
        .single();
      if (error) {
        console.error('[SCORING] Insert error:', error);
        throw error;
      }
      result = data;
    }

    console.log('[SCORING] Score saved:', result);
    res.json(result);
  } catch (err) {
    console.error('[SCORING] Submit score FULL error:', err);
    res.status(500).json({ message: 'Server error submitting score.', error: err.message });
  }
};

/** PUT /scoring/:eventId/scores/:scoreId — Edit a score (admin/faculty only) */
exports.editScore = async (req, res) => {
  try {
    const { eventId, scoreId } = req.params;
    const { score, notes } = req.body;

    if (score === undefined) {
      return res.status(400).json({ message: 'score is required.' });
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('event_scores')
      .select('id, level')
      .eq('id', scoreId)
      .eq('event_id', eventId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return res.status(404).json({ message: 'Score entry not found.' });
    }

    const { data: config } = await supabase
      .from('scoring_configs')
      .select('levels')
      .eq('event_id', eventId)
      .maybeSingle();

    const levels = config?.levels || [];
    const levelDef = levels[existing.level - 1];
    if (levelDef && (score < 0 || score > levelDef.max_score)) {
      return res.status(400).json({ message: `Score must be between 0 and ${levelDef.max_score}.` });
    }

    const { data, error } = await supabase
      .from('event_scores')
      .update({
        score: Number(score),
        notes: notes !== undefined ? notes : undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', scoreId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Server error editing score.', error: err.message });
  }
};

/** DELETE /scoring/:eventId/scores/:scoreId — Delete a score (admin/faculty only) */
exports.deleteScore = async (req, res) => {
  try {
    const { eventId, scoreId } = req.params;

    const { error } = await supabase
      .from('event_scores')
      .delete()
      .eq('id', scoreId)
      .eq('event_id', eventId);

    if (error) throw error;
    res.json({ message: 'Score deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error deleting score.', error: err.message });
  }
};
