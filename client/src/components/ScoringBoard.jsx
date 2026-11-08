import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import ImportScoresModal from './ImportScoresModal';

const rankStyles = [
  'border-amber-300 bg-gradient-to-br from-amber-100 to-yellow-50',
  'border-slate-300 bg-gradient-to-br from-slate-100 to-white',
  'border-orange-200 bg-gradient-to-br from-orange-100 to-amber-50'
];

const clampScoreInput = (value, maxValue) => {
  const raw = String(value ?? '').trim();
  if (raw === '') return '';
  const n = Number(raw);
  if (!Number.isFinite(n)) return '';
  const max = Number(maxValue);
  const upper = Number.isFinite(max) && max >= 0 ? max : n;
  return String(Math.min(Math.max(n, 0), upper));
};

const commitScoreInput = (event, subround, save) => {
  const clamped = clampScoreInput(event.target.value, subround.max_score);
  if (clamped !== event.target.value) {
    event.target.value = clamped;
    alert(`Score must be between 0 and ${subround.max_score}. Value adjusted to ${clamped === '' ? 'blank' : clamped}.`);
  }
  save(clamped);
};

const formatSaveErrors = (errors) => {
  const list = (Array.isArray(errors) ? errors : []).map(e => e.error || 'Invalid score');
  const unique = [...new Set(list)];
  return `${list.length} score(s) could not be saved: ${unique.slice(0, 3).join('; ')}${unique.length > 3 ? ' ...' : ''}`;
};

const ScoringBoard = ({ eventId, canEdit }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState({ enabled: false, visible: false, rounds: [], teams: [], scores: [], students: [], studentScores: [], studentComments: [], myScorecard: null, isPanelMember: false, myPanels: [], myStudentIds: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [myTeamId, setMyTeamId] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const pendingSaves = useRef({});
  const pendingStudentSaves = useRef({});
  const [pendingCount, setPendingCount] = useState(0);
  const [panelFilter, setPanelFilter] = useState('all');
  const [registeredFrom, setRegisteredFrom] = useState('');
  const [registeredTo, setRegisteredTo] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/events/${eventId}/scoring`);
      const resData = response.data || {};
      setData({
        enabled: Boolean(resData.enabled),
        visible: Boolean(resData.visible),
        rounds: Array.isArray(resData.rounds) ? resData.rounds : [],
        teams: Array.isArray(resData.teams) ? resData.teams : [],
        scores: Array.isArray(resData.scores) ? resData.scores : [],
        students: Array.isArray(resData.students) ? resData.students : [],
        studentScores: Array.isArray(resData.studentScores) ? resData.studentScores : [],
        studentComments: Array.isArray(resData.studentComments) ? resData.studentComments : [],
        myScorecard: resData.myScorecard || null,
        isPanelMember: Boolean(resData.isPanelMember),
        myPanels: Array.isArray(resData.myPanels) ? resData.myPanels : [],
        myStudentIds: Array.isArray(resData.myStudentIds) ? resData.myStudentIds : []
      });
    } catch (err) {
      if (err.response?.status !== 403) console.error(err);
      setData(prev => ({
        ...prev,
        rounds: prev.rounds || [],
        teams: prev.teams || [],
        scores: prev.scores || [],
        students: prev.students || [],
        studentScores: prev.studentScores || []
      }));
    } finally {
      setLoading(false);
    }
  };

  const flushPendingSaves = useCallback(async () => {
    const entries = Object.entries(pendingSaves.current);
    const studentEntries = Object.entries(pendingStudentSaves.current);
    if (entries.length === 0 && studentEntries.length === 0) return;
    pendingSaves.current = {};
    pendingStudentSaves.current = {};
    setPendingCount(0);

    if (entries.length > 0) {
      const scores = entries.map(([key, score]) => {
        const [teamId, subroundId] = key.split(':');
        return { teamId, subroundId, score };
      });
      try {
        const response = await axios.put(`/api/events/${eventId}/scoring/bulk`, { scores });
        const newScores = Array.isArray(response.data?.scores) ? response.data.scores : [];
        setData(previous => ({ ...previous, scores: newScores }));
        if ((response.data?.errors || []).length > 0) alert(formatSaveErrors(response.data.errors));
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to save scores.');
      }
    }

    if (studentEntries.length > 0) {
      const scores = studentEntries.map(([key, score]) => {
        const [registrationId, subroundId] = key.split(':');
        return { registrationId, subroundId, score };
      });
      try {
        const response = await axios.put(`/api/events/${eventId}/scoring/student-bulk`, { scores });
        const newScores = Array.isArray(response.data?.scores) ? response.data.scores : [];
        setData(previous => ({ ...previous, studentScores: newScores }));
        if ((response.data?.errors || []).length > 0) alert(formatSaveErrors(response.data.errors));
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to save student scores.');
      }
    }
  }, [eventId]);

  const saveScore = useCallback((teamId, subroundId, value) => {
    // Blank = no change; prevents Tab-through/empty blur from writing phantom 0s
    if (value === '' || value == null) return;
    const key = `${teamId}:${subroundId}`;
    pendingSaves.current[key] = value;
    setPendingCount(Object.keys(pendingSaves.current).length + Object.keys(pendingStudentSaves.current).length);
  }, []);

  const saveStudentScore = useCallback((registrationId, subroundId, value) => {
    // Blank = no change; prevents Tab-through/empty blur from writing phantom 0s
    if (value === '' || value == null) return;
    const key = `${registrationId}:${subroundId}`;
    pendingStudentSaves.current[key] = value;
    setPendingCount(Object.keys(pendingSaves.current).length + Object.keys(pendingStudentSaves.current).length);
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
    if (!canEdit && !data.isPanelMember) return;
    const interval = setInterval(() => {
      if (Object.keys(pendingSaves.current).length > 0 || Object.keys(pendingStudentSaves.current).length > 0) flushPendingSaves();
    }, 3000);
    return () => clearInterval(interval);
  }, [canEdit, data.isPanelMember, flushPendingSaves]);

  const update = (path, value) => setData(previous => {
    const next = JSON.parse(JSON.stringify(previous));
    let target = next;
    path.slice(0, -1).forEach(key => { target = target[key]; });
    target[path[path.length - 1]] = value;
    return next;
  });

  const addRound = () => update(['rounds'], [...(data.rounds || []), {
    name: `Round ${(data.rounds || []).length + 1}`,
    subrounds: [{ name: 'Criteria 1', max_score: 100 }]
  }]);

  const removeRound = index => update(['rounds'], (data.rounds || []).filter((_, roundIndex) => roundIndex !== index));

  const addSubround = roundIndex => {
    const rounds = JSON.parse(JSON.stringify(data.rounds || []));
    rounds[roundIndex].subrounds = [...(rounds[roundIndex].subrounds || []), {
      name: `Criteria ${(rounds[roundIndex].subrounds || []).length + 1}`,
      max_score: 100
    }];
    update(['rounds'], rounds);
  };

  const removeSubround = (roundIndex, subroundIndex) => update(['rounds'], (data.rounds || []).map((round, index) => (
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
        rounds: data.rounds || []
      });
      await load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save scoring.');
    } finally {
      setSaving(false);
    }
  };

  const markReportsSent = (sentList) => {
    const sentIds = new Set((sentList || []).map(s => String(s.registrationId)));
    if (sentIds.size === 0) return;
    setData(previous => ({
      ...previous,
      students: (previous.students || []).map(stu => (
        sentIds.has(String(stu.registration_id))
          ? { ...stu, report_email_sent_at: new Date().toISOString(), report_email_sent_to: stu.report_email_sent_to || stu.email || '' }
          : stu
      ))
    }));
  };

  const sendReports = async (registrationIds) => {
    try {
      // Make sure the newest edits are saved before the report totals are computed
      await flushPendingSaves();
      const res = await axios.post(`/api/events/${eventId}/scoring/reports`, registrationIds ? { registrationIds } : {});
      markReportsSent(res.data?.sent);
      alert(res.data?.message || 'Score reports sent.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send score reports.');
    }
  };

  const downloadReportPdf = async (registrationId, studentName) => {
    try {
      const res = await axios.get(`/api/events/${eventId}/scoring/report/${registrationId}/pdf`, {
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Avento_Score_Report_${String(studentName || 'student').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download score report:', err);
      alert('Failed to download the score report PDF.');
    }
  };

  const downloadAnalysis = async () => {
    try {
      const res = await axios.get(`/api/events/${eventId}/scoring/analysis/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Avento_Score_Analysis.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      let message = 'Failed to download the score analysis.';
      if (err.response?.data instanceof Blob) {
        try {
          message = JSON.parse(await err.response.data.text()).message || message;
        } catch (e) { /* keep default message */ }
      } else if (err.response?.data?.message) {
        message = err.response.data.message;
      }
      alert(message);
    }
  };

  const exportExcel = () => {
    const subMeta = (data.rounds || []).flatMap(round => (round.subrounds || []).map(sub => ({
      id: sub.id,
      label: `${round.name} - ${sub.name}`,
      max: Number(sub.max_score) || 0
    })));
    const maxTotal = subMeta.reduce((sum, sub) => sum + sub.max, 0);

    const studentEntries = filteredStudents.map(student => ({
      student,
      total: subMeta.reduce((sum, sub) => sum + Number(studentScoresMap[`${student.registration_id}:${sub.id}`] || 0), 0)
    }));
    const sorted = [...studentEntries].sort((a, b) => b.total - a.total);
    const rankMap = new Map();
    let currentRank = 0;
    sorted.forEach((entry, idx) => {
      if (idx === 0 || entry.total !== sorted[idx - 1].total) currentRank = idx + 1;
      rankMap.set(entry.student.registration_id, currentRank);
    });

    const overallCommentMap = {};
    (data.studentComments || []).forEach(c => { overallCommentMap[c.registration_id] = c.comment || ''; });

    const studentRows = studentEntries.map(({ student, total }) => {
      const row = {
        Rank: rankMap.get(student.registration_id) ?? '',
        'Roll No': student.roll_number || '',
        Name: student.name || '',
        Department: student.department || '',
        Panel: student.panel_name || ''
      };
      subMeta.forEach(sub => {
        const value = studentScoresMap[`${student.registration_id}:${sub.id}`];
        row[`${sub.label} (/${sub.max})`] = value == null || value === '' ? '' : Number(value);
      });
      row['Total'] = total;
      row['Max Score'] = maxTotal;
      row['Percentage (%)'] = maxTotal > 0 ? Math.round((total / maxTotal) * 10000) / 100 : 0;
      row['Overall Comment'] = overallCommentMap[student.registration_id] || '';
      return row;
    });

    const commentRows = filteredStudents.map(student => {
      const row = { 'Roll No': student.roll_number || '', Name: student.name || '' };
      subMeta.forEach(sub => {
        row[sub.label] = studentCommentMap[`${student.registration_id}:${sub.id}`] || '';
      });
      return row;
    });

    const teamRows = detailTeams.map(team => {
      const total = subMeta.reduce((sum, sub) => sum + Number(scoresMap[`${team.id}:${sub.id}`] || 0), 0);
      const row = { Team: team.name || '' };
      subMeta.forEach(sub => {
        const value = scoresMap[`${team.id}:${sub.id}`];
        row[`${sub.label} (/${sub.max})`] = value == null || value === '' ? '' : Number(value);
      });
      row['Total'] = total;
      row['Max Score'] = maxTotal;
      row['Percentage (%)'] = maxTotal > 0 ? Math.round((total / maxTotal) * 10000) / 100 : 0;
      return row;
    });

    const summaryRows = leaderboard.map(entry => ({
      Rank: entry.rank,
      Type: entry.kind === 'team' ? 'Team' : 'Student',
      Name: entry.name || '',
      Detail: entry.subtitle || '',
      Total: entry.total
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(studentRows), 'Student Scores');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(commentRows), 'Student Comments');
    if (teamRows.length > 0) XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(teamRows), 'Team Scores');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Summary');
    XLSX.writeFile(workbook, `Avento_Scores_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const scoresMap = useMemo(() => {
    const map = {};
    (data.scores || []).forEach(score => {
      if (score && score.team_id && score.subround_id) {
        map[`${score.team_id}:${score.subround_id}`] = score.score;
      }
    });
    return map;
  }, [data.scores]);

  const studentScoresMap = useMemo(() => {
    const map = {};
    (data.studentScores || []).forEach(score => {
      if (score && score.registration_id && score.subround_id) {
        map[`${score.registration_id}:${score.subround_id}`] = score.score;
      }
    });
    return map;
  }, [data.studentScores]);

  const studentCommentMap = useMemo(() => {
    const map = {};
    (data.studentScores || []).forEach(score => {
      if (score && score.registration_id && score.subround_id) {
        map[`${score.registration_id}:${score.subround_id}`] = score.comment || '';
      }
    });
    return map;
  }, [data.studentScores]);

  const subrounds = useMemo(() => (data.rounds || []).flatMap(round => round?.subrounds || []), [data.rounds]);

  const leaderboard = useMemo(() => {
    const teams = Array.isArray(data.teams) ? data.teams : [];
    const teamEntries = teams.map(team => ({
      ...team,
      kind: 'team',
      total: subrounds.reduce((sum, subround) => sum + Number(scoresMap[`${team.id}:${subround.id}`] || 0), 0)
    }));
    const scoredStudents = (data.students || []).filter(student =>
      (data.studentScores || []).some(score => score.registration_id === student.registration_id && score.score != null && score.score !== '')
    );
    const studentEntries = scoredStudents.map(student => ({
      id: student.registration_id,
      name: student.name,
      subtitle: student.roll_number,
      kind: 'student',
      total: subrounds.reduce((sum, subround) => sum + Number(studentScoresMap[`${student.registration_id}:${subround.id}`] || 0), 0)
    }));
    const sorted = [...teamEntries, ...studentEntries]
      .sort((a, b) => (b.total || 0) - (a.total || 0) || (a.name || '').localeCompare(b.name || ''));
    let currentRank = 0;
    return sorted.map((entry, index) => {
      if (index === 0 || entry.total !== sorted[index - 1].total) currentRank += 1;
      return { ...entry, rank: currentRank };
    });
  }, [data.teams, data.students, data.studentScores, subrounds, scoresMap, studentScoresMap]);

  const detailTeams = canEdit ? (data.teams || []) : (data.teams || []).filter(t => String(t.id) === String(myTeamId));

  // Students visible in the student scoring grid: organizers see everyone,
  // panel members only the students allocated to their panel.
  const myStudentIds = new Set(data.myStudentIds || []);
  const detailStudents = canEdit
    ? (data.students || [])
    : data.isPanelMember
      ? (data.students || []).filter(s => myStudentIds.has(s.registration_id))
      : (data.myScorecard?.student ? [data.myScorecard.student] : []);
  const canScoreStudent = (registrationId) => canEdit || (data.isPanelMember && myStudentIds.has(registrationId));

  // Panel + registration-date filters for the Student Score Details grid
  const panelOptions = [];
  const panelSeen = new Set();
  let hasUnassigned = false;
  detailStudents.forEach(student => {
    if (!student.panel_id) { hasUnassigned = true; return; }
    const key = String(student.panel_id);
    if (!panelSeen.has(key)) {
      panelSeen.add(key);
      panelOptions.push({ id: key, name: student.panel_name || `Panel ${key}` });
    }
  });
  panelOptions.sort((a, b) => a.name.localeCompare(b.name));

  const filteredStudents = detailStudents.filter(student => {
    if (panelFilter === 'none') {
      if (student.panel_id) return false;
    } else if (panelFilter !== 'all' && String(student.panel_id) !== String(panelFilter)) {
      return false;
    }
    if (registeredFrom || registeredTo) {
      const regDate = student.registered_at ? new Date(student.registered_at) : null;
      if (!regDate || Number.isNaN(regDate.getTime())) return false;
      if (registeredFrom && regDate < new Date(`${registeredFrom}T00:00:00`)) return false;
      if (registeredTo && regDate > new Date(`${registeredTo}T23:59:59.999`)) return false;
    }
    return true;
  });
  const filtersActive = panelFilter !== 'all' || registeredFrom !== '' || registeredTo !== '';
  const clearStudentFilters = () => { setPanelFilter('all'); setRegisteredFrom(''); setRegisteredTo(''); };

  const canSendReports = canEdit || data.isPanelMember;
  const myComment = (data.studentComments || []).find(c => String(c.registration_id) === String(data.myScorecard?.registration_id))?.comment || '';
  const openScorecard = (registrationId) => navigate(`/workspace/${eventId}/scoring/student/${registrationId}`);

  if (loading) {
    return (
      <div className="glass-panel rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent mb-2" />
        <p>Loading scoring module...</p>
      </div>
    );
  }

  const scorecardSection = data.myScorecard ? (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 dark:border-indigo-900/60 dark:bg-indigo-950/30">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-display text-xl font-black text-slate-800 dark:text-slate-100">My Scorecard</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {data.myScorecard.student?.name}{data.myScorecard.student?.roll_number ? ` - ${data.myScorecard.student.roll_number}` : ''}
            {data.myScorecard.student?.panel_name ? ` - ${data.myScorecard.student.panel_name}` : ''}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-indigo-700 dark:text-indigo-300">{data.myScorecard.total} pts</div>
          {data.myScorecard.rank && <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Rank #{data.myScorecard.rank} of {data.myScorecard.total_participants}</div>}
          <button
            type="button"
            onClick={() => downloadReportPdf(data.myScorecard.registration_id, data.myScorecard.student?.name)}
            className="mt-2 rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-[11px] font-bold text-indigo-600 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300"
          >
            Download PDF
          </button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-white/70 dark:bg-slate-900 text-[10px] uppercase tracking-wider text-slate-500">
              <th className="p-3">Round</th>
              <th className="p-3">Criterion</th>
              <th className="p-3 text-center">Score</th>
              <th className="p-3 text-center">Max</th>
              <th className="p-3">Comment</th>
            </tr>
          </thead>
          <tbody>
            {(data.rounds || []).flatMap(round => (round.subrounds || []).map(subround => {
              const key = `${data.myScorecard.registration_id}:${subround.id}`;
              return (
                <tr key={subround.id || key} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="p-3 text-slate-500">{round.name}</td>
                  <td className="p-3 font-bold text-slate-700 dark:text-slate-200">{subround.name}</td>
                  <td className="p-3 text-center font-black text-indigo-700 dark:text-indigo-300">{studentScoresMap[key] ?? '-'}</td>
                  <td className="p-3 text-center text-slate-400">{subround.max_score}</td>
                  <td className="p-3 text-xs text-slate-500 dark:text-slate-400"><span className="whitespace-pre-wrap">{studentCommentMap[key] || '-'}</span></td>
                </tr>
              );
            }))}
          </tbody>
        </table>
      </div>
      {myComment && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Evaluator Comments</div>
          <p className="mt-2 whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-200">{myComment}</p>
        </div>
      )}
    </section>
  ) : null;

  if (!canEdit && !data.isPanelMember && !data.visible) {
    return scorecardSection || (
      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        The live scoreboard has not been published for this event yet.
      </div>
    );
  }

  return (
    <>
    <section className="scoring-board mb-8 overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white/70 shadow-xl shadow-cyan-500/5 backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-950/90">
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-cyan-950 to-fuchsia-900 px-6 py-7 text-white sm:px-8">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-200"><span className="h-2 w-2 rounded-full bg-emerald-300" /> Live evaluation</div>
            <h2 className="font-display text-2xl font-black sm:text-3xl">Scoring Board</h2>
            <p className="mt-1 text-sm text-cyan-100/80">Round performance and current standings.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canSendReports && <button onClick={() => sendReports()} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20">Email Reports</button>}
            {canSendReports && <button onClick={exportExcel} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20">Export Excel</button>}
            {canSendReports && <button onClick={downloadAnalysis} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20">Download Analysis</button>}
            {canEdit && <>{pendingCount > 0 && <button onClick={flushPendingSaves} className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-emerald-600 animate-pulse">{pendingCount} unsaved - Click to Save</button>}<button onClick={() => setShowImportModal(true)} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20">Import Excel</button><button onClick={() => update(['visible'], !data.visible)} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20">{data.visible ? 'Hide Scoreboard' : 'Show Scoreboard'}</button><button onClick={saveConfig} disabled={saving} className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-cyan-800 shadow-lg hover:bg-cyan-50">{saving ? 'Saving...' : 'Save Changes'}</button></>}
            {!canEdit && pendingCount > 0 && <button onClick={flushPendingSaves} className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-emerald-600 animate-pulse">{pendingCount} unsaved - Click to Save</button>}
          </div>
        </div>
      </div>

      <div className="space-y-8 p-5 sm:p-8">
        {canEdit && <div className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-5 dark:border-cyan-900/60 dark:bg-cyan-950/30">
          <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="font-display text-base font-bold text-slate-800 dark:text-slate-100">Evaluation Setup</h3><p className="text-xs text-slate-500 dark:text-slate-400">Create rounds and scoring criteria for judges.</p></div><label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300"><input type="checkbox" checked={data.enabled} onChange={event => update(['enabled'], event.target.checked)} /> Enabled</label></div>
          {data.enabled && <div className="space-y-3">{(data.rounds || []).map((round, roundIndex) => <div key={round.id || roundIndex} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm"><div className="flex flex-col gap-2 sm:flex-row"><input value={round.name} onChange={event => { const rounds = JSON.parse(JSON.stringify(data.rounds)); rounds[roundIndex].name = event.target.value; update(['rounds'], rounds); }} className="min-w-0 flex-1 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm font-bold text-slate-700" /><button onClick={() => addSubround(roundIndex)} className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200">+ Criterion</button><button onClick={() => removeRound(roundIndex)} className="rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-100">Delete Round</button></div>{(round.subrounds || []).map((subround, subroundIndex) => <div key={subround.id || subroundIndex} className="mt-2 flex gap-2"><input value={subround.name} onChange={event => { const rounds = JSON.parse(JSON.stringify(data.rounds)); rounds[roundIndex].subrounds[subroundIndex].name = event.target.value; update(['rounds'], rounds); }} className="min-w-0 flex-1 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-xs text-slate-700" /><input type="number" min="0" value={subround.max_score} onChange={event => { const rounds = JSON.parse(JSON.stringify(data.rounds)); rounds[roundIndex].subrounds[subroundIndex].max_score = event.target.value; update(['rounds'], rounds); }} className="w-24 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-xs text-slate-700" placeholder="Max" /><button onClick={() => removeSubround(roundIndex, subroundIndex)} className="rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-[10px] font-bold text-red-600 dark:text-red-400 hover:bg-red-100">Delete</button></div>)}</div>)}<button onClick={addRound} className="rounded-xl bg-fuchsia-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-fuchsia-500/20 hover:bg-fuchsia-700">+ Add Evaluation Round</button></div>}
        </div>}

        {data.enabled && <>
          <div>
            <div className="mb-4 flex items-end justify-between"><div><h3 className="font-display text-xl font-black text-slate-800 dark:text-slate-100">Leaderboard</h3><p className="text-xs text-slate-500 dark:text-slate-400">Ranked by total points across all criteria.</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">Published standings</span></div>
            {leaderboard.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">No teams or students scored yet.</div> : <div className="grid gap-3 md:grid-cols-3">{leaderboard.slice(0, 3).map((entry, index) => <div key={`${entry.kind}-${entry.id}`} className={`rounded-2xl border p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${rankStyles[index] || 'border-slate-200 bg-white'}`}><div className="flex items-center justify-between"><span className="flex h-9 min-w-[2.25rem] items-center justify-center rounded-full bg-white/80 px-2 text-sm font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">#{entry.rank}</span><span className="text-2xl">{index === 0 ? 'dY?+' : index === 1 ? 'dY�^' : 'dY�%'}</span></div><h4 className="mt-5 truncate font-display text-lg font-black text-slate-800 dark:text-slate-100">{entry.name}</h4>{entry.subtitle && <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{entry.subtitle}</p>}<p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{entry.total} points</p></div>)}</div>}
            {leaderboard.length > 3 && <div className="mt-3 space-y-2">{leaderboard.slice(3).map(entry => <div key={`${entry.kind}-${entry.id}`} className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-700 dark:bg-slate-900"><span className="min-w-[2rem] text-center text-sm font-black text-slate-400">#{entry.rank}</span><span className="flex-1 text-sm font-bold text-slate-700 dark:text-slate-200">{entry.name}{entry.subtitle ? <span className="ml-2 text-[10px] font-semibold text-slate-400">{entry.subtitle}</span> : null}</span><span className="font-black text-cyan-700 dark:text-cyan-300">{entry.total}</span><span className="text-[10px] font-bold uppercase text-slate-400">points</span></div>)}</div>}
          </div>

          {(detailTeams.length > 0 || canEdit) && <div><div className="mb-4"><h3 className="font-display text-xl font-black text-slate-800 dark:text-slate-100">Team Score Details</h3><p className="text-xs text-slate-500 dark:text-slate-400">{canEdit ? 'Enter scores directly in the evaluation grid.' : 'Showing scores for your team only.'}</p></div><div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700"><table className="w-full min-w-[760px] text-left text-xs"><thead><tr className="bg-slate-50 dark:bg-slate-900 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400"><th className="sticky left-0 bg-slate-50 dark:bg-slate-900 p-4">Team</th>{(data.rounds || []).map(round => <th key={round.id || round.name} colSpan={(round.subrounds || []).length} className="border-l border-slate-200 dark:border-slate-700 p-3 text-center">{round.name}</th>)}<th className="border-l border-slate-200 dark:border-slate-700 p-4 text-center">Total</th></tr><tr className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-[10px] text-slate-400"><th className="sticky left-0 bg-white dark:bg-slate-950 p-3" />{subrounds.map(subround => <th key={subround.id || subround.name} className="p-3 text-center">{subround.name}<span className="mt-1 block text-[9px]">/{subround.max_score}</span></th>)}<th className="p-3" /></tr></thead><tbody>{detailTeams.map(team => { const total = subrounds.reduce((sum, subround) => sum + Number(scoresMap[`${team.id}:${subround.id}`] || 0), 0); return <tr key={team.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-cyan-50/30 dark:hover:bg-cyan-950/30"><td className="sticky left-0 bg-white dark:bg-slate-950 p-4 font-bold text-slate-700 dark:text-slate-200">{team.name}</td>{subrounds.map(subround => <td key={subround.id} className="p-2 text-center">{canEdit ? <input type="number" min="0" max={subround.max_score} defaultValue={scoresMap[`${team.id}:${subround.id}`] ?? ''} onBlur={event => commitScoreInput(event, subround, value => saveScore(team.id, subround.id, value))} onKeyDown={event => { if (event.key === 'Tab' || event.key === 'Enter') { commitScoreInput(event, subround, value => saveScore(team.id, subround.id, value)); if (event.key === 'Enter') { event.preventDefault(); const inputs = Array.from(event.target.closest('table').querySelectorAll('input[type=number]')); const idx = inputs.indexOf(event.target); if (idx < inputs.length - 1) inputs[idx + 1].focus(); } } }} className="w-20 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-2 py-2 text-center font-bold text-slate-700 focus:border-cyan-500 focus:outline-none" /> : <span className="font-semibold text-slate-600 dark:text-slate-300">{scoresMap[`${team.id}:${subround.id}`] || '-'}</span>}</td>)}<td className="border-l border-slate-100 dark:border-slate-800 p-4 text-center text-base font-black text-cyan-700 dark:text-cyan-400">{total}</td></tr>})}</tbody></table></div></div>}

          {detailStudents.length > 0 && <div>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="font-display text-xl font-black text-slate-800 dark:text-slate-100">Student Score Details</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{canEdit ? 'Score the students assigned to panels (panel members can score their own students).' : data.isPanelMember ? 'Score the students assigned to your panel.' : 'Showing your scores only.'}</p>
              </div>
              {canSendReports && <button onClick={() => { if (filteredStudents.length === 0) return; sendReports(filteredStudents.map(s => s.registration_id)); }} className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">Email These Reports</button>}
            </div>
            {canSendReports && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {canEdit && (
                  <div className="relative">
                    <select
                      value={panelFilter}
                      onChange={event => setPanelFilter(event.target.value)}
                      className="h-10 appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-xs font-semibold text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    >
                      <option value="all">All Panels ({detailStudents.length})</option>
                      {panelOptions.map(panel => (
                        <option key={panel.id} value={panel.id}>
                          {panel.name} ({detailStudents.filter(s => String(s.panel_id) === panel.id).length})
                        </option>
                      ))}
                      {hasUnassigned && <option value="none">Unassigned ({detailStudents.filter(s => !s.panel_id).length})</option>}
                    </select>
                    <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                )}
                <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Registered from
                  <input
                    type="date"
                    value={registeredFrom}
                    max={registeredTo || undefined}
                    onChange={event => setRegisteredFrom(event.target.value)}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  to
                  <input
                    type="date"
                    value={registeredTo}
                    min={registeredFrom || undefined}
                    onChange={event => setRegisteredTo(event.target.value)}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  />
                </label>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{filteredStudents.length} of {detailStudents.length} shown</span>
                {filtersActive && (
                  <button type="button" onClick={clearStudentFilters} className="rounded-lg px-2 py-1 text-[10px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40">Clear filters</button>
                )}
              </div>
            )}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="sticky left-0 bg-slate-50 dark:bg-slate-900 p-4">Student</th>
                    {(data.rounds || []).map(round => <th key={round.id || round.name} colSpan={(round.subrounds || []).length} className="border-l border-slate-200 dark:border-slate-700 p-3 text-center">{round.name}</th>)}
                    <th className="border-l border-slate-200 dark:border-slate-700 p-4 text-center">Total</th>
                    {canSendReports && <th className="border-l border-slate-200 dark:border-slate-700 p-4 text-center">Report</th>}
                  </tr>
                  <tr className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-[10px] text-slate-400">
                    <th className="sticky left-0 bg-white dark:bg-slate-950 p-3" />
                    {subrounds.map(subround => <th key={subround.id || subround.name} className="p-3 text-center">{subround.name}<span className="mt-1 block text-[9px]">/{subround.max_score}</span></th>)}
                    <th className="p-3" />
                    {canSendReports && <th className="p-3" />}
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan={subrounds.length + (canSendReports ? 3 : 2)} className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                        No students match the selected filters.
                      </td>
                    </tr>
                  )}
                  {filteredStudents.map(student => {
                    const total = subrounds.reduce((sum, subround) => sum + Number(studentScoresMap[`${student.registration_id}:${subround.id}`] || 0), 0);
                    const editable = canScoreStudent(student.registration_id);
                    const sentAt = student.report_email_sent_at || null;
                    const sentTo = student.report_email_sent_to || student.email || '';
                    const sentLabel = sentTo ? `Sent to ${sentTo} on ${new Date(sentAt).toLocaleString()}` : 'Report emailed';
                    return (
                      <tr key={student.registration_id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/30">
                        <td className="sticky left-0 bg-white dark:bg-slate-950 p-4">
                          {canSendReports || String(student.registration_id) === String(data.myScorecard?.registration_id) ? (
                            <button type="button" onClick={() => openScorecard(student.registration_id)} className="font-bold text-indigo-700 hover:underline dark:text-indigo-300">{student.name}</button>
                          ) : (
                            <div className="font-bold text-slate-700 dark:text-slate-200">{student.name}</div>
                          )}
                          <div className="text-[10px] text-slate-400">{student.roll_number}{student.panel_name ? ` - ${student.panel_name}` : ''}</div>
                          {student.registered_at && <div className="text-[9px] text-slate-400">Registered {new Date(student.registered_at).toLocaleDateString()}</div>}
                        </td>
                        {subrounds.map(subround => (
                          <td key={subround.id} className="p-2 text-center">
                            {editable ? (
                              <input
                                type="number"
                                min="0"
                                max={subround.max_score}
                                defaultValue={studentScoresMap[`${student.registration_id}:${subround.id}`] ?? ''}
                                onBlur={event => commitScoreInput(event, subround, value => saveStudentScore(student.registration_id, subround.id, value))}
                                onKeyDown={event => {
                                  if (event.key === 'Tab' || event.key === 'Enter') {
                                    commitScoreInput(event, subround, value => saveStudentScore(student.registration_id, subround.id, value));
                                    if (event.key === 'Enter') {
                                      event.preventDefault();
                                      const inputs = Array.from(event.target.closest('table').querySelectorAll('input[type=number]'));
                                      const idx = inputs.indexOf(event.target);
                                      if (idx < inputs.length - 1) inputs[idx + 1].focus();
                                    }
                                  }
                                }}
                                className="w-20 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-2 py-2 text-center font-bold text-slate-700 focus:border-indigo-500 focus:outline-none"
                              />
                            ) : (
                              <span className="font-semibold text-slate-600 dark:text-slate-300">{studentScoresMap[`${student.registration_id}:${subround.id}`] ?? '-'}</span>
                            )}
                          </td>
                        ))}
                        <td className="border-l border-slate-100 dark:border-slate-800 p-4 text-center text-base font-black text-indigo-700 dark:text-indigo-400">{total}</td>
                        {canSendReports && (
                          <td className="border-l border-slate-100 dark:border-slate-800 p-2 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => sendReports([student.registration_id])}
                                title={sentAt ? `${sentLabel}. Click to resend.` : `Email the score report to ${sentTo || 'this student'}`}
                                className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${sentAt ? 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300'}`}
                              >
                                {sentAt ? 'Resend' : 'Send'}
                              </button>
                              <button onClick={() => downloadReportPdf(student.registration_id, student.name)} className="rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-[10px] font-bold text-cyan-600 hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300">PDF</button>
                            </div>
                            {sentAt && (
                              <div className="mt-1 truncate text-[9px] text-emerald-600 dark:text-emerald-400" title={sentLabel}>
                                ✓ {sentTo || 'Sent'}
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>}

          {!canEdit && scorecardSection}
        </>}
      </div>
    </section>
    {showImportModal && <ImportScoresModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} eventId={eventId} rounds={data.rounds || []} teams={data.teams || []} scores={data.scores || []} onImportSuccess={() => { setShowImportModal(false); load(); }} />}
    </>
  );
};

export default ScoringBoard;
