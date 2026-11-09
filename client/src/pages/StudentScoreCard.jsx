import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const formatSaveErrors = (errors) => {
  const list = (Array.isArray(errors) ? errors : []).map(e => e.error || 'Invalid score');
  const unique = [...new Set(list)];
  return `${list.length} score(s) could not be saved: ${unique.slice(0, 3).join('; ')}${unique.length > 3 ? ' ...' : ''}`;
};

const READINESS_BANDS = [
  {
    maxScore: 24,
    band: 'Needs Intensive Support',
    text: 'Not yet placement ready. Requires structured technical and soft-skills training, guided practice and a repeat mock interview.'
  },
  {
    maxScore: 34,
    band: 'Developing \u2013 Needs Coaching',
    text: 'Has basic technical and communication skills, but noticeable gaps remain. Needs targeted coaching in weaker areas and a repeat assessment in 3\u20134 weeks.'
  },
  {
    maxScore: 42,
    band: 'Good \u2013 Almost There',
    text: 'Demonstrates a good technical foundation and professional readiness. Improve one or two weaker areas through focused practice before company drives.'
  },
  {
    maxScore: 50,
    band: 'Outstanding \u2013 Placement Ready',
    text: 'Demonstrates strong technical ability, problem-solving, communication and professional readiness. Ready to face company interviews; focus on polishing and maintaining consistency.'
  }
];

const formatReadinessComment = (entry) => `Readiness Band: ${entry.band}\n\n${entry.text}`;

const isDefaultComment = (value) => {
  const normalized = String(value ?? '').trim();
  return normalized === '' || READINESS_BANDS.some(entry => formatReadinessComment(entry) === normalized);
};

const getReadinessComment = (total, maxTotal) => {
  const raw = Number(total) || 0;
  const scaled = Number(maxTotal) > 0 ? (raw / Number(maxTotal)) * 50 : raw;
  const clamped = Math.max(0, Math.min(50, scaled));
  const entry = READINESS_BANDS.find(band => clamped <= band.maxScore) || READINESS_BANDS[READINESS_BANDS.length - 1];
  return formatReadinessComment(entry);
};

const StudentScoreCard = () => {
  const { eventId, registrationId } = useParams();
  const navigate = useNavigate();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [values, setValues] = useState({});
  const [comments, setComments] = useState({});
  const [comment, setComment] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const pendingSaves = useRef({});
  const saveTimer = useRef(null);
  const flushChainRef = useRef(Promise.resolve());

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await axios.get(`/api/events/${eventId}/scoring/student/${registrationId}`);
      const resData = res.data || {};
      setCard(resData);
      const nextValues = {};
      const nextComments = {};
      (resData.scores || []).forEach(s => {
        if (s && s.subround_id) {
          nextValues[s.subround_id] = s.score;
          nextComments[s.subround_id] = s.comment || '';
        }
      });
      setValues(nextValues);
      setComments(nextComments);
      setComment(resData.comment || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load the student scorecard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [eventId, registrationId]);

  const flushPendingSaves = useCallback(() => {
    const run = async () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      const entries = Object.entries(pendingSaves.current);
      if (entries.length === 0) return true;
      pendingSaves.current = {};
      const scores = entries.map(([key, value]) => {
        const [regId, subroundId] = key.split(':');
        return { registrationId: regId, subroundId, score: value.score, comment: value.comment };
      });
      try {
        const response = await axios.put(`/api/events/${eventId}/scoring/student-bulk`, { scores });
        const newScores = Array.isArray(response.data?.scores)
          ? response.data.scores.filter(s => s.registration_id === registrationId)
          : [];
        setCard(prev => (prev ? { ...prev, scores: newScores } : prev));
        if ((response.data?.errors || []).length > 0) {
          alert(formatSaveErrors(response.data.errors));
          return false;
        }
        return true;
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to save scores. They will be retried.');
        // Put the scores back so a failed request never drops the edit
        entries.forEach(([key, value]) => {
          if (!(key in pendingSaves.current)) pendingSaves.current[key] = value;
        });
        return false;
      }
    };
    // Chain flushes so a save triggered by typing can never interleave with
    // the save that must complete before a report is generated.
    const next = flushChainRef.current.then(run, run);
    flushChainRef.current = next.catch(() => false);
    return next;
  }, [eventId, registrationId]);

  const saveRow = useCallback((subroundId, scoreValue, commentValue) => {
    pendingSaves.current[`${registrationId}:${subroundId}`] = { score: scoreValue, comment: commentValue };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      flushPendingSaves();
    }, 500);
  }, [registrationId, flushPendingSaves]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (Object.keys(pendingSaves.current).length > 0) flushPendingSaves();
  }, [flushPendingSaves]);

  const commitScore = (subround, rawValue) => {
    const max = Number(subround.max_score);
    const upper = Number.isFinite(max) && max >= 0 ? max : 0;
    const parsed = Math.round(Number(rawValue));
    const clamped = Math.min(Math.max(Number.isFinite(parsed) ? parsed : 0, 0), upper);
    setValues(prev => ({ ...prev, [subround.id]: clamped }));
    saveRow(subround.id, clamped, comments[subround.id] ?? '');
  };

  useEffect(() => {
    if (!card?.canEdit) return;
    const interval = setInterval(() => {
      if (Object.keys(pendingSaves.current).length > 0) flushPendingSaves();
    }, 3000);
    return () => clearInterval(interval);
  }, [card?.canEdit, flushPendingSaves]);

  // Closing the tab / switching apps must not lose queued scores
  useEffect(() => {
    const flushOnHide = () => {
      const entries = Object.entries(pendingSaves.current);
      if (entries.length === 0) return;
      pendingSaves.current = {};
      const scores = entries.map(([key, value]) => {
        const [regId, subroundId] = key.split(':');
        return { registrationId: regId, subroundId, score: value.score, comment: value.comment };
      });
      const token = localStorage.getItem('token');
      const base = axios.defaults.baseURL || '';
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      fetch(`${base}/api/events/${eventId}/scoring/student-bulk`, { method: 'PUT', headers, body: JSON.stringify({ scores }), keepalive: true }).catch(() => {});
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flushOnHide(); };
    window.addEventListener('pagehide', flushOnHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flushOnHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [eventId]);

  const subrounds = useMemo(
    () => (card?.rounds || []).flatMap(round => (round.subrounds || []).map(subround => ({ ...subround, roundName: round.name }))),
    [card?.rounds]
  );

  const total = useMemo(
    () => subrounds.reduce((sum, subround) => sum + (Number(values[subround.id]) || 0), 0),
    [subrounds, values]
  );

  const maxTotal = useMemo(
    () => subrounds.reduce((sum, subround) => sum + (Number(subround.max_score) || 0), 0),
    [subrounds]
  );

  useEffect(() => {
    if (!card?.canEdit) return;
    setComment(prev => (isDefaultComment(prev) ? getReadinessComment(total, maxTotal) : prev));
  }, [card?.canEdit, total, maxTotal]);

  const saveComment = async () => {
    setSavingComment(true);
    try {
      await axios.put(`/api/events/${eventId}/scoring/student-comment`, { registrationId, comment });
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save the comment.');
    } finally {
      setSavingComment(false);
    }
  };

  const sendReport = async () => {
    try {
      // Make sure the newest edits are saved before the report totals are computed
      const saved = await flushPendingSaves();
      if (!saved) {
        alert('Some scores could not be saved. Please try again before sending the report.');
        return;
      }
      const res = await axios.post(`/api/events/${eventId}/scoring/reports`, { registrationIds: [registrationId] });
      alert(res.data?.message || 'Score report sent.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send the score report.');
    }
  };

  const downloadReportPdf = async () => {
    try {
      // Persist anything still queued so the PDF reflects the latest scores
      const saved = await flushPendingSaves();
      if (!saved) {
        alert('Some scores could not be saved. Please try again before downloading the report.');
        return;
      }
      const res = await axios.get(`/api/events/${eventId}/scoring/report/${registrationId}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Avento_Score_Report_${String(card?.student?.name || 'student').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download score report:', err);
      let message = 'Failed to download the score report PDF.';
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

  if (loading) {
    return (
      <div className="flex-grow py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="glass-panel rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent mb-2" />
            <p>Loading student scorecard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-grow py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-bold text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">{error}</div>
          <button type="button" onClick={() => navigate(-1)} className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Go Back</button>
        </div>
      </div>
    );
  }

  const student = card?.student || {};

  return (
    <div className="flex-grow py-14 text-slate-700">
      <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
        <button type="button" onClick={() => navigate(-1)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          &larr; Back
        </button>

        <section className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white/70 shadow-xl shadow-cyan-500/5 backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-950/90">
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-cyan-950 to-indigo-900 px-6 py-7 text-white sm:px-8">
            <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl" />
            <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-center">
              <div>
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-200"><span className="h-2 w-2 rounded-full bg-emerald-300" /> Student Scorecard</div>
                <h1 className="font-display text-2xl font-black sm:text-3xl">{student.name || 'Student'}</h1>
                <p className="mt-1 text-sm text-cyan-100/80">
                  {student.roll_number ? `${student.roll_number} \u00b7 ` : ''}{student.department || 'No department'}{student.panel_name ? ` \u00b7 Panel: ${student.panel_name}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-center">
                  <div className="text-2xl font-black">{total} pts</div>
                  {card?.rank && <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-100/80">Rank #{card.rank} of {card.total_participants}</div>}
                </div>
                {card?.canEdit && <button type="button" onClick={sendReport} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20">Email Report</button>}
                <button type="button" onClick={downloadReportPdf} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20">Download PDF</button>
              </div>
            </div>
          </div>

          <div className="space-y-8 p-5 sm:p-8">
            <div>
              <h2 className="font-display text-xl font-black text-slate-800 dark:text-slate-100">Score Breakdown</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{card?.canEdit ? 'Enter scores for this student. Scores save automatically as you type.' : 'Scores for this student.'}</p>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="p-4">Round</th>
                      <th className="p-4">Criterion</th>
                      <th className="p-4 text-center">Score</th>
                      <th className="p-4 text-center">Max</th>
                      <th className="p-4">Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subrounds.length === 0 ? (
                      <tr><td colSpan="5" className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">No scoring criteria configured yet.</td></tr>
                    ) : subrounds.map(subround => (
                      <tr key={subround.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/30">
                        <td className="p-4 text-slate-500 dark:text-slate-400">{subround.roundName}</td>
                        <td className="p-4 font-bold text-slate-700 dark:text-slate-200">{subround.name}</td>
                        <td className="p-2 text-center">
                          {card?.canEdit ? (
                            (() => {
                              const maxScore = Math.max(0, Number(subround.max_score) || 0);
                              const rawScore = Number(values[subround.id]);
                              const score = Math.min(Math.max(Number.isFinite(rawScore) ? Math.round(rawScore) : 0, 0), maxScore);
                              const fillPercent = maxScore > 0 ? (score / maxScore) * 100 : 0;
                              return (
                                <div className="flex items-center justify-center gap-1.5">
                                  <span className="score-slider-ends">0</span>
                                  <input
                                    type="range"
                                    min="0"
                                    max={maxScore}
                                    step="1"
                                    value={score}
                                    onChange={event => commitScore(subround, event.target.value)}
                                    aria-label={`${subround.name} score out of ${maxScore}`}
                                    style={{ '--fill': `${fillPercent}%` }}
                                    className="score-slider w-24 cursor-pointer sm:w-32"
                                  />
                                  <span className="score-slider-ends">{maxScore}</span>
                                  <span className="inline-flex h-7 min-w-[2rem] items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-1.5 text-xs font-black text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300">{score}</span>
                                </div>
                              );
                            })()
                          ) : (
                            <span className="font-semibold text-slate-600 dark:text-slate-300">{values[subround.id] ?? '-'}</span>
                          )}
                        </td>
                        <td className="p-4 text-center text-slate-400">{subround.max_score}</td>
                        <td className="p-2">
                          {card?.canEdit ? (
                            <textarea
                              rows="2"
                              value={comments[subround.id] ?? ''}
                              onChange={event => setComments(prev => ({ ...prev, [subround.id]: event.target.value }))}
                              onBlur={event => saveRow(subround.id, values[subround.id] ?? '', event.target.value)}
                              placeholder="Comment on this criterion..."
                              className="w-full min-w-[200px] resize-y rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            />
                          ) : (
                            <span className="whitespace-pre-wrap text-xs text-slate-500 dark:text-slate-400">{comments[subround.id] || '-'}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900">
                      <td className="p-4 font-bold text-slate-700 dark:text-slate-200" colSpan="2">Total</td>
                      <td className="p-4 text-center text-base font-black text-indigo-700 dark:text-indigo-400">{total}</td>
                      <td className="p-4 text-center text-slate-400">{subrounds.reduce((sum, s) => sum + (Number(s.max_score) || 0), 0)}</td>
                      <td className="p-4" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 dark:border-indigo-900/60 dark:bg-indigo-950/30">
              <h2 className="font-display text-xl font-black text-slate-800 dark:text-slate-100">Evaluator Comments</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">This comment is included in the score report the student receives.</p>
              {card?.canEdit ? (
                <>
                  <textarea
                    value={comment}
                    onChange={event => setComment(event.target.value)}
                    rows="5"
                    maxLength="5000"
                    placeholder="Write your feedback about this student's performance..."
                    className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <div className="mt-3 flex items-center gap-3">
                    <button type="button" onClick={saveComment} disabled={savingComment} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-indigo-700 disabled:opacity-60">
                      {savingComment ? 'Saving...' : 'Save Comment'}
                    </button>
                    <span className="text-[10px] text-slate-400">{comment.length}/5000</span>
                  </div>
                </>
              ) : (
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{comment || 'No comments yet.'}</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default StudentScoreCard;
