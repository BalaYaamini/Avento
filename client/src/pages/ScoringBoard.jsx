import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const ScoringBoard = () => {
  const { eventId } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin');
  const isFaculty = user?.roles?.includes('faculty') || user?.roles?.includes('faculty_organizer');
  const canEdit = isAdmin || isFaculty;

  const [config, setConfig] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [event, setEvent] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [numLevels, setNumLevels] = useState(3);
  const [levels, setLevels] = useState([]);

  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [scoreValue, setScoreValue] = useState('');
  const [scoreNotes, setScoreNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let eventData = null;
      let leaderboardData = { config: null, levels: [], leaderboard: [] };

      try {
        const eventRes = await axios.get(`/api/events/${eventId}`);
        eventData = eventRes.data;
      } catch (e) {
        console.error('Failed to fetch event:', e.response?.data || e.message);
      }

      try {
        const leaderboardRes = await axios.get(`/api/scoring/${eventId}/leaderboard`);
        leaderboardData = leaderboardRes.data;
      } catch (e) {
        console.error('Failed to fetch leaderboard:', e.response?.data || e.message);
        setError(`Leaderboard error: ${e.response?.data?.message || e.message}`);
        return;
      }

      setEvent(eventData);
      setLeaderboard(leaderboardData.leaderboard || []);
      setConfig(leaderboardData.config);
      setLevels(leaderboardData.levels || []);
      setNumLevels(leaderboardData.config?.num_levels || 3);

      const teamList = (leaderboardData.leaderboard || []).map(t => ({
        id: t.teamId,
        name: t.teamName
      }));
      setTeams(teamList);

      if (leaderboardData.config?.levels) {
        setLevels(leaderboardData.config.levels);
      } else {
        setLevels([
          { level: 1, name: 'Round 1', max_score: 100, weight: 1 },
          { level: 2, name: 'Round 2', max_score: 100, weight: 2 },
          { level: 3, name: 'Final', max_score: 100, weight: 3 }
        ]);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load scoring data.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveConfig = async () => {
    try {
      await axios.put(`/api/scoring/${eventId}/config`, { numLevels, levels });
      setShowConfigModal(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save config.');
    }
  };

  const handleAddLevel = () => {
    const newLevel = {
      level: levels.length + 1,
      name: `Round ${levels.length + 1}`,
      max_score: 100,
      weight: 1
    };
    setLevels([...levels, newLevel]);
    setNumLevels(levels.length + 1);
  };

  const handleRemoveLevel = (idx) => {
    const updated = levels.filter((_, i) => i !== idx).map((l, i) => ({ ...l, level: i + 1 }));
    setLevels(updated);
    setNumLevels(updated.length);
  };

  const handleLevelChange = (idx, field, value) => {
    const updated = [...levels];
    updated[idx] = { ...updated[idx], [field]: field === 'name' ? value : Number(value) };
    setLevels(updated);
  };

  const handleSubmitScore = async (e) => {
    e.preventDefault();
    if (!selectedTeam || !scoreValue) return;
    try {
      setSubmitting(true);
      await axios.post(`/api/scoring/${eventId}/scores`, {
        teamId: selectedTeam,
        level: Number(selectedLevel),
        score: Number(scoreValue),
        notes: scoreNotes
      });
      setScoreValue('');
      setScoreNotes('');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit score.');
    } finally {
      setSubmitting(false);
    }
  };

  const getMedalEmoji = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-pastel-lavender border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary font-quicksand font-medium">Loading scoring board...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-grow relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-80 h-80 bg-pastel-lavender/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float-slow" />
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-pastel-coral/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float-slow" style={{ animationDelay: '2s' }} />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="polaroid p-8">
            <p className="text-red-500 font-quicksand font-semibold text-lg">{error}</p>
            <button onClick={fetchData} className="mt-4 btn-primary px-6 py-2.5 font-quicksand font-bold text-sm">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow relative">
      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-pastel-lavender/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float-slow" />
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-pastel-coral/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float-slow" style={{ animationDelay: '2s' }} />
        <div className="absolute -bottom-40 left-1/3 w-80 h-80 bg-pastel-yellow/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float-slow" style={{ animationDelay: '4s' }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Header */}
        <div className="mb-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-heading font-bold text-gradient-primary tracking-tight">
                {event?.title || 'Event'}
              </h1>
              <p className="text-text-secondary text-sm mt-2 font-quicksand">
                Live leaderboard & team scoring
              </p>
            </div>
            {canEdit && (
              <button
                onClick={() => setShowConfigModal(true)}
                className="btn-secondary px-5 py-2.5 text-xs font-bold font-quicksand"
              >
                ⚙ Configure Scoring
              </button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            {
              title: 'Total Teams',
              value: leaderboard.length,
              subtitle: 'Registered & scored',
              icon: '🏆'
            },
            {
              title: 'Rounds',
              value: levels.length,
              subtitle: 'Scoring rounds',
              icon: '📊'
            },
            {
              title: 'Top Score',
              value: leaderboard[0]?.weightedTotal ?? '—',
              subtitle: leaderboard[0]?.teamName || 'No scores yet',
              icon: '🥇'
            },
            {
              title: 'Scores Entered',
              value: leaderboard.reduce((sum, t) => sum + t.levelScores.filter(s => s.raw > 0).length, 0),
              subtitle: 'Out of ' + (leaderboard.length * levels.length),
              icon: '✏️'
            }
          ].map((card, idx) => (
            <div
              key={idx}
              className="polaroid scrapbook-panel-hover p-5 flex flex-col"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">{card.icon}</span>
              </div>
              <p className="text-2xl sm:text-3xl font-heading font-bold text-text-primary">{card.value}</p>
              <p className="text-xs font-bold font-quicksand text-text-secondary mt-1 uppercase tracking-wider">{card.title}</p>
              <p className="text-[10px] text-text-secondary/70 mt-0.5 font-quicksand">{card.subtitle}</p>
            </div>
          ))}
        </div>

        {/* Leaderboard */}
        <div className="polaroid p-6 sm:p-8 mb-10">
          <h2 className="text-xl font-heading font-bold text-text-primary mb-6 flex items-center gap-2">
            <span className="text-2xl">🏆</span> Leaderboard
          </h2>

          {leaderboard.length === 0 ? (
            <div className="text-center py-12 text-text-secondary">
              <p className="text-4xl mb-3">🏅</p>
              <p className="font-quicksand font-semibold">No participants registered yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {leaderboard.map((entry) => {
                const medal = getMedalEmoji(entry.rank);
                return (
                  <div
                    key={entry.teamId}
                    className={`polaroid scrapbook-panel-hover p-5 ${
                      entry.rank === 1 ? 'border-amber-300 bg-gradient-to-r from-amber-50/50 to-white' :
                      entry.rank === 2 ? 'border-slate-300 bg-gradient-to-r from-slate-50/50 to-white' :
                      entry.rank === 3 ? 'border-orange-200 bg-gradient-to-r from-orange-50/50 to-white' :
                      ''
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      {/* Rank + Team Name */}
                      <div className="flex items-center gap-4 sm:w-1/3">
                        <span className="text-3xl font-heading font-bold min-w-[3rem] text-center">{medal}</span>
                        <div>
                          <p className="font-heading font-bold text-text-primary text-lg">{entry.teamName}</p>
                          <p className="text-xs text-text-secondary font-quicksand">
                            Total: <span className="font-bold text-text-primary">{entry.weightedTotal}</span>
                          </p>
                        </div>
                      </div>

                      {/* Level Scores (admin/faculty only) */}
                      {canEdit && (
                        <div className="flex flex-wrap gap-2 sm:w-2/3 sm:justify-end">
                          {entry.levelScores.map((ls) => (
                            <div key={ls.level} className="flex flex-col items-center bg-pastel-lavender/10 border border-pastel-lavender/20 rounded-xl px-4 py-2 min-w-[80px]">
                              <span className="text-[10px] font-bold font-quicksand text-text-secondary uppercase tracking-wider">{ls.name}</span>
                              <span className="text-lg font-heading font-bold text-text-primary">{ls.raw || '—'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Score Entry Form (admin/faculty only) */}
        {canEdit && (
          <div className="polaroid p-6 sm:p-8 mb-10">
            <h2 className="text-xl font-heading font-bold text-text-primary mb-6 flex items-center gap-2">
              <span className="text-2xl">✏️</span> Enter Score
            </h2>

            <form onSubmit={handleSubmitScore} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Team Select */}
                <div>
                  <label className="block text-xs font-bold font-quicksand text-text-secondary mb-1.5 uppercase tracking-wider">Team</label>
                  <select
                    value={selectedTeam}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-white focus:border-pastel-lavender focus:ring-2 focus:ring-pastel-lavender/20 outline-none transition font-quicksand"
                    required
                  >
                    <option value="">Select a team</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                {/* Level Select */}
                <div>
                  <label className="block text-xs font-bold font-quicksand text-text-secondary mb-1.5 uppercase tracking-wider">Level</label>
                  <select
                    value={selectedLevel}
                    onChange={(e) => setSelectedLevel(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-white focus:border-pastel-lavender focus:ring-2 focus:ring-pastel-lavender/20 outline-none transition font-quicksand"
                  >
                    {levels.map(l => (
                      <option key={l.level} value={l.level}>{l.name} (max: {l.max_score})</option>
                    ))}
                  </select>
                </div>

                {/* Score Input */}
                <div>
                  <label className="block text-xs font-bold font-quicksand text-text-secondary mb-1.5 uppercase tracking-wider">Score</label>
                  <input
                    type="number"
                    value={scoreValue}
                    onChange={(e) => setScoreValue(e.target.value)}
                    min="0"
                    max={levels[selectedLevel - 1]?.max_score || 100}
                    placeholder="0"
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-white focus:border-pastel-lavender focus:ring-2 focus:ring-pastel-lavender/20 outline-none transition font-quicksand"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold font-quicksand text-text-secondary mb-1.5 uppercase tracking-wider">Notes (optional)</label>
                <input
                  type="text"
                  value={scoreNotes}
                  onChange={(e) => setScoreNotes(e.target.value)}
                  placeholder="Optional notes about this score..."
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-white focus:border-pastel-lavender focus:ring-2 focus:ring-pastel-lavender/20 outline-none transition font-quicksand"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !selectedTeam || !scoreValue}
                className="btn-primary px-6 py-2.5 text-xs font-bold font-quicksand disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit Score'}
              </button>
            </form>
          </div>
        )}

        {/* Config Modal */}
        {showConfigModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowConfigModal(false)} />
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-heading font-bold text-text-primary">Configure Scoring</h2>
                <button onClick={() => setShowConfigModal(false)} className="text-text-secondary hover:text-text-primary text-2xl leading-none">&times;</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold font-quicksand text-text-secondary mb-1.5 uppercase tracking-wider">Number of Levels</label>
                  <input
                    type="number"
                    value={numLevels}
                    onChange={(e) => {
                      const n = Math.max(1, Math.min(10, Number(e.target.value)));
                      setNumLevels(n);
                      while (levels.length < n) {
                        setLevels(prev => [...prev, { level: prev.length + 1, name: `Round ${prev.length + 1}`, max_score: 100, weight: 1 }]);
                      }
                      if (levels.length > n) {
                        setLevels(prev => prev.slice(0, n).map((l, i) => ({ ...l, level: i + 1 })));
                      }
                    }}
                    min="1"
                    max="10"
                    className="w-24 px-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-white focus:border-pastel-lavender focus:ring-2 focus:ring-pastel-lavender/20 outline-none transition font-quicksand"
                  />
                </div>

                <div className="space-y-3">
                  {levels.map((level, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                      <span className="text-sm font-bold font-quicksand text-text-secondary min-w-[20px]">{idx + 1}</span>
                      <input
                        type="text"
                        value={level.name}
                        onChange={(e) => handleLevelChange(idx, 'name', e.target.value)}
                        placeholder="Level name"
                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-pastel-lavender focus:ring-2 focus:ring-pastel-lavender/20 outline-none transition font-quicksand"
                      />
                      <div className="flex flex-col items-center">
                        <label className="text-[9px] font-bold font-quicksand text-text-secondary uppercase">Max</label>
                        <input
                          type="number"
                          value={level.max_score}
                          onChange={(e) => handleLevelChange(idx, 'max_score', e.target.value)}
                          min="1"
                          className="w-20 px-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-pastel-lavender focus:ring-2 focus:ring-pastel-lavender/20 outline-none transition font-quicksand text-center"
                        />
                      </div>
                      <div className="flex flex-col items-center">
                        <label className="text-[9px] font-bold font-quicksand text-text-secondary uppercase">Weight</label>
                        <input
                          type="number"
                          value={level.weight}
                          onChange={(e) => handleLevelChange(idx, 'weight', e.target.value)}
                          min="1"
                          max="10"
                          className="w-20 px-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-pastel-lavender focus:ring-2 focus:ring-pastel-lavender/20 outline-none transition font-quicksand text-center"
                        />
                      </div>
                      <button
                        onClick={() => handleRemoveLevel(idx)}
                        className="text-red-400 hover:text-red-600 text-lg font-bold px-2 transition"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>

                {levels.length < 10 && (
                  <button
                    onClick={handleAddLevel}
                    className="w-full py-2.5 text-xs font-bold font-quicksand rounded-xl border-2 border-dashed border-pastel-lavender/30 text-pastel-lavender hover:bg-pastel-lavender/10 transition"
                  >
                    + Add Level
                  </button>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 px-4 py-2.5 text-xs font-bold font-quicksand rounded-xl border border-gray-200 text-text-secondary hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveConfig}
                  className="flex-1 btn-primary px-4 py-2.5 text-xs font-bold font-quicksand"
                >
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScoringBoard;
