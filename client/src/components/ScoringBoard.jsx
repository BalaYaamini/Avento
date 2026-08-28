import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import ImportScoresModal from './ImportScoresModal';

const rankStyles = [
  'border-amber-300 bg-gradient-to-br from-amber-100 to-yellow-50',
  'border-slate-300 bg-gradient-to-br from-slate-100 to-white',
  'border-orange-200 bg-gradient-to-br from-orange-100 to-amber-50'
];

const ScoringBoard = ({ eventId, canEdit }) => {
  const { user } = useAuth();
  const [data, setData] = useState({ enabled: false, visible: false, rounds: [], teams: [], scores: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [myTeamId, setMyTeamId] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const pendingSaves = useRef({});
  const [pendingCount, setPendingCount] = useState(0);

  const load = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/events/${eventId}/scoring`);
      setData(response.data);
    } catch (err) {
      if (err.response?.status !== 403) console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const flushPendingSaves = useCallback(async () => {
    const entries = Object.entries(pendingSaves.current);
    if (entries.length === 0) return;
    pendingSaves.current = {};
    setPendingCount(0);
    const scores = entries.map(([key, score]) => {
      const [teamId, subroundId] = key.split(':');
      return { teamId, subroundId, score };
    });
    try {
      const response = await axios.put(`/api/events/${eventId}/scoring/bulk`, { scores });
      setData(previous => ({ ...previous, scores: response.data.scores }));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save scores.');
    }
  }, [eventId]);

  const saveScore = useCallback((teamId, subroundId, value) => {
    const key = `${teamId}:${subroundId}`;
    pendingSaves.current[key] = value;
    setPendingCount(Object.keys(pendingSaves.current).length);
  }, []);

  useEffect(() => { load(); }, [eventId]);

  useEffect(() => {
    if (!canEdit && user?.id && eventId) {
      axios.get('/api/registrations/my-registrations').then(res => {
        const reg = (res.data || []).find(r => String(r.event_id || r.eventId?.id) === String(eventId) && r.team_id);
        if (reg) setMyTeamId(reg.team_id);
      }).catch(() => {});
    }
  }, [canEdit, user, eventId]);

  useEffect(() => {
    if (!canEdit) return;
    const interval = setInterval(() => { if (Object.keys(pendingSaves.current).length > 0) flushPendingSaves(); }, 3000);
    return () => clearInterval(interval);
  }, [canEdit, flushPendingSaves]);

  const update = (path, value) => setData(previous => {
    const next = JSON.parse(JSON.stringify(previous));
    let target = next;
    path.slice(0, -1).forEach(key => { target = target[key]; });
    target[path[path.length - 1]] = value;
    return next;
  });

  const addRound = () => update(['rounds'], [...data.rounds, {
    name: `Round ${data.rounds.length + 1}`,
    subrounds: [{ name: 'Criteria 1', max_score: 100 }]
  }]);

  const removeRound = index => update(['rounds'], data.rounds.filter((_, roundIndex) => roundIndex !== index));

  const addSubround = roundIndex => {
    const rounds = JSON.parse(JSON.stringify(data.rounds));
    rounds[roundIndex].subrounds = [...(rounds[roundIndex].subrounds || []), {
      name: `Criteria ${(rounds[roundIndex].subrounds || []).length + 1}`,
      max_score: 100
    }];
    update(['rounds'], rounds);
  };

  const removeSubround = (roundIndex, subroundIndex) => update(['rounds'], data.rounds.map((round, index) => (
    index === roundIndex
      ? { ...round, subrounds: (round.subrounds || []).filter((_, subIndex) => subIndex !== subroundIndex) }
      : round
  )));

  const saveConfig = async () => {
    setSaving(true);
    try {
      await axios.put(`/api/events/${eventId}/scoring`, {
        enabled: data.enabled,
        visible: data.visible,
        rounds: data.rounds
      });
      await load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save scoring.');
    } finally {
      setSaving(false);
    }
  };

  const scoresMap = useMemo(() => {
    const map = {};
    data.scores.forEach(score => { map[`${score.team_id}:${score.subround_id}`] = score.score; });
    return map;
  }, [data.scores]);

  const subrounds = useMemo(() => data.rounds.flatMap(round => round.subrounds || []), [data.rounds]);

  const leaderboard = useMemo(() => {
    const sorted = data.teams
      .map(team => ({ ...team, total: subrounds.reduce((sum, subround) => sum + Number(scoresMap[`${team.id}:${subround.id}`] || 0), 0) }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    let currentRank = 0;
    return sorted.map((team, index) => {
      if (index === 0 || team.total !== sorted[index - 1].total) currentRank += 1;
      return { ...team, rank: currentRank };
    });
  }, [data.teams, subrounds, scoresMap]);

  const detailTeams = canEdit ? data.teams : data.teams.filter(t => String(t.id) === String(myTeamId));

  if (loading) return <div className="glass-panel rounded-2xl p-6 text-sm text-slate-500">Loading scoring module...</div>;
  if (!canEdit && !data.visible) return null;

  return (
    <>
    <section className="scoring-board mb-8 overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white/70 shadow-xl shadow-violet-500/5 backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-950/90">
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-violet-950 to-fuchsia-900 px-6 py-7 text-white sm:px-8">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-200"><span className="h-2 w-2 rounded-full bg-emerald-300" /> Live evaluation</div>
            <h2 className="font-display text-2xl font-black sm:text-3xl">Scoring Board</h2>
            <p className="mt-1 text-sm text-violet-100/80">Round performance and current team standings.</p>
          </div>
          {canEdit && <div className="flex flex-wrap gap-2">{pendingCount > 0 && <button onClick={flushPendingSaves} className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-emerald-600 animate-pulse">{pendingCount} unsaved — Click to Save</button>}<button onClick={() => setShowImportModal(true)} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20">Import Excel</button><button onClick={() => update(['visible'], !data.visible)} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20">{data.visible ? 'Hide Scoreboard' : 'Show Scoreboard'}</button><button onClick={saveConfig} disabled={saving} className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-violet-800 shadow-lg hover:bg-violet-50">{saving ? 'Saving...' : 'Save Changes'}</button></div>}
        </div>
      </div>

      <div className="space-y-8 p-5 sm:p-8">
        {canEdit && <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-5 dark:border-violet-900/60 dark:bg-violet-950/30">
          <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="font-display text-base font-bold text-slate-800 dark:text-slate-100">Evaluation Setup</h3><p className="text-xs text-slate-500 dark:text-slate-400">Create rounds and scoring criteria for judges.</p></div><label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300"><input type="checkbox" checked={data.enabled} onChange={event => update(['enabled'], event.target.checked)} /> Enabled</label></div>
          {data.enabled && <div className="space-y-3">{data.rounds.map((round, roundIndex) => <div key={round.id || roundIndex} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-col gap-2 sm:flex-row"><input value={round.name} onChange={event => { const rounds = JSON.parse(JSON.stringify(data.rounds)); rounds[roundIndex].name = event.target.value; update(['rounds'], rounds); }} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700" /><button onClick={() => addSubround(roundIndex)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200">+ Criterion</button><button onClick={() => removeRound(roundIndex)} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100">Delete Round</button></div>{(round.subrounds || []).map((subround, subroundIndex) => <div key={subround.id || subroundIndex} className="mt-2 flex gap-2"><input value={subround.name} onChange={event => { const rounds = JSON.parse(JSON.stringify(data.rounds)); rounds[roundIndex].subrounds[subroundIndex].name = event.target.value; update(['rounds'], rounds); }} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700" /><input type="number" min="0" value={subround.max_score} onChange={event => { const rounds = JSON.parse(JSON.stringify(data.rounds)); rounds[roundIndex].subrounds[subroundIndex].max_score = event.target.value; update(['rounds'], rounds); }} className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700" placeholder="Max" /><button onClick={() => removeSubround(roundIndex, subroundIndex)} className="rounded-lg bg-red-50 px-3 py-2 text-[10px] font-bold text-red-600 hover:bg-red-100">Delete</button></div>)}</div>)}<button onClick={addRound} className="rounded-xl bg-fuchsia-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-fuchsia-500/20 hover:bg-fuchsia-700">+ Add Evaluation Round</button></div>}
        </div>}

        {data.enabled && <>
          <div>
            <div className="mb-4 flex items-end justify-between"><div><h3 className="font-display text-xl font-black text-slate-800 dark:text-slate-100">Leaderboard</h3><p className="text-xs text-slate-500 dark:text-slate-400">Ranked by total points across all criteria.</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">Published standings</span></div>
            {leaderboard.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">No confirmed teams yet.</div> : <div className="grid gap-3 md:grid-cols-3">{leaderboard.slice(0, 3).map((team, index) => <div key={team.id} className={`rounded-2xl border p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${rankStyles[index] || 'border-slate-200 bg-white'}`}><div className="flex items-center justify-between"><span className="flex h-9 min-w-[2.25rem] items-center justify-center rounded-full bg-white/80 px-2 text-sm font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">#{team.rank}</span><span className="text-2xl">{index === 0 ? '🏆' : index === 1 ? '🥈' : '🥉'}</span></div><h4 className="mt-5 truncate font-display text-lg font-black text-slate-800 dark:text-slate-100">{team.name}</h4><p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{team.total} points</p></div>)}</div>}
            {leaderboard.length > 3 && <div className="mt-3 space-y-2">{leaderboard.slice(3).map(team => <div key={team.id} className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-700 dark:bg-slate-900"><span className="min-w-[2rem] text-center text-sm font-black text-slate-400">#{team.rank}</span><span className="flex-1 text-sm font-bold text-slate-700 dark:text-slate-200">{team.name}</span><span className="font-black text-violet-700 dark:text-violet-300">{team.total}</span><span className="text-[10px] font-bold uppercase text-slate-400">points</span></div>)}</div>}
          </div>

          <div><div className="mb-4"><h3 className="font-display text-xl font-black text-slate-800">Score Details</h3><p className="text-xs text-slate-500">{canEdit ? 'Enter scores directly in the evaluation grid.' : 'Showing scores for your team only.'}</p></div><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[760px] text-left text-xs"><thead><tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><th className="sticky left-0 bg-slate-50 p-4">Team</th>{data.rounds.map(round => <th key={round.id || round.name} colSpan={(round.subrounds || []).length} className="border-l border-slate-200 p-3 text-center">{round.name}</th>)}<th className="border-l border-slate-200 p-4 text-center">Total</th></tr><tr className="border-t border-slate-200 bg-white text-[10px] text-slate-400"><th className="sticky left-0 bg-white p-3" />{subrounds.map(subround => <th key={subround.id || subround.name} className="p-3 text-center">{subround.name}<span className="mt-1 block text-[9px]">/{subround.max_score}</span></th>)}<th className="p-3" /></tr></thead><tbody>{detailTeams.map(team => { const total = subrounds.reduce((sum, subround) => sum + Number(scoresMap[`${team.id}:${subround.id}`] || 0), 0); return <tr key={team.id} className="border-t border-slate-100 hover:bg-violet-50/30"><td className="sticky left-0 bg-white p-4 font-bold text-slate-700">{team.name}</td>{subrounds.map(subround => <td key={subround.id} className="p-2 text-center">{canEdit ? <input type="number" min="0" max={subround.max_score} defaultValue={scoresMap[`${team.id}:${subround.id}`] ?? ''} onBlur={event => saveScore(team.id, subround.id, event.target.value)} onKeyDown={event => { if (event.key === 'Tab' || event.key === 'Enter') { saveScore(team.id, subround.id, event.target.value); if (event.key === 'Enter') { event.preventDefault(); const inputs = Array.from(event.target.closest('table').querySelectorAll('input[type=number]')); const idx = inputs.indexOf(event.target); if (idx < inputs.length - 1) inputs[idx + 1].focus(); } } }} className="w-20 rounded-lg border border-slate-200 px-2 py-2 text-center font-bold text-slate-700 focus:border-violet-500 focus:outline-none" /> : <span className="font-semibold text-slate-600">{scoresMap[`${team.id}:${subround.id}`] || '-'}</span>}</td>)}<td className="border-l border-slate-100 p-4 text-center text-base font-black text-violet-700">{total}</td></tr>})}</tbody></table></div></div>
        </>}
      </div>
    </section>
    {showImportModal && <ImportScoresModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} eventId={eventId} rounds={data.rounds} teams={data.teams} scores={data.scores} onImportSuccess={() => { setShowImportModal(false); load(); }} />}
    </>
  );
};

export default ScoringBoard;
