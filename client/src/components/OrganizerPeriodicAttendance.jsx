import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// Helper to convert Date object or string into Local YYYY-MM-DDTHH:mm for datetime-local input
const toLocalISOString = (dateInput) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const pad = (num) => String(num).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const cleanPeriodTitle = (name) => {
  if (!name) return '';
  return String(name).replace(/🍔/g, '').replace(/\[Food Coupon Included\]/gi, '').trim();
};

export default function OrganizerPeriodicAttendance({ eventId, onScanClick }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('progress'); // 'progress' | 'logs' | 'periods' | 'settings'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEligibility, setFilterEligibility] = useState('all'); // 'all' | 'eligible' | 'ineligible'
  const [logFilterPeriod, setLogFilterPeriod] = useState('all'); // 'all' | periodId
  
  // Custom period modal form
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [periodForm, setPeriodForm] = useState({ 
    periodName: '', 
    startTime: '', 
    endTime: '', 
    includesFoodCoupon: false, 
    foodCouponName: 'Food / Meal Coupon' 
  });
  const [editingPeriodId, setEditingPeriodId] = useState(null);
  
  // Customizable Event Start, Duration, & Interval State
  const [eventStartInput, setEventStartInput] = useState('');
  const [durationSelectMode, setDurationSelectMode] = useState('12');
  const [customDurationInput, setCustomDurationInput] = useState('');
  const [intervalSelectMode, setIntervalSelectMode] = useState('4');
  const [customIntervalInput, setCustomIntervalInput] = useState('');
  const [updatingInterval, setUpdatingInterval] = useState(false);

  // Threshold form
  const [thresholdForm, setThresholdForm] = useState({ minCheckpoints: '', minPercentage: 75 });
  const [savingThreshold, setSavingThreshold] = useState(false);
  
  // Countdown timer state
  const [secondsLeft, setSecondsLeft] = useState(0);

  const fetchPeriodicData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/attendance/event/${eventId}/periods`);
      if (res.data.success) {
        setData(res.data);
        setSecondsLeft(res.data.timeRemainingSeconds || 0);

        const ev = res.data.event || {};
        const activeHours = ev.period_interval_hours || 4;
        const standardModes = ['1', '2', '3', '4', '6', '8'];
        if (standardModes.includes(String(activeHours))) {
          setIntervalSelectMode(String(activeHours));
        } else {
          setIntervalSelectMode('custom');
          setCustomIntervalInput(String(activeHours));
        }

        // Populate event start input
        if (ev.date) {
          setEventStartInput(toLocalISOString(ev.date));
        }

        // Compute total duration in hours from start & end date if available
        if (ev.date && ev.end_date) {
          const diffMs = new Date(ev.end_date).getTime() - new Date(ev.date).getTime();
          if (diffMs > 0) {
            const hrs = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
            const standardDurations = ['12', '24', '36', '48'];
            if (standardDurations.includes(String(hrs))) {
              setDurationSelectMode(String(hrs));
            } else {
              setDurationSelectMode('custom');
              setCustomDurationInput(String(hrs));
            }
          }
        }

        setThresholdForm({
          minCheckpoints: ev.min_certificate_checkpoints ?? '',
          minPercentage: ev.min_certificate_percentage ?? 75
        });
      }
    } catch (err) {
      console.error('Failed to fetch periodic attendance:', err);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchPeriodicData();
  }, [fetchPeriodicData]);

  // Live timer countdown ticker
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          fetchPeriodicData();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft, fetchPeriodicData]);

  const formatSeconds = (secs) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${hrs > 0 ? `${hrs}h ` : ''}${mins < 10 ? '0' : ''}${mins}m ${s < 10 ? '0' : ''}${s}s`;
  };

  // Calculate live total duration hours and computed end time
  let calculatedDurationHours = 12;
  if (durationSelectMode === 'custom') {
    calculatedDurationHours = Number(customDurationInput) || 12;
  } else {
    calculatedDurationHours = Number(durationSelectMode) || 12;
  }

  let calculatedEndTimeStr = '';
  if (eventStartInput && calculatedDurationHours > 0) {
    const startMs = new Date(eventStartInput).getTime();
    if (!isNaN(startMs)) {
      const endMs = startMs + calculatedDurationHours * 60 * 60 * 1000;
      calculatedEndTimeStr = toLocalISOString(new Date(endMs));
    }
  }

  const handleFormalIntervalSubmit = async (e) => {
    e.preventDefault();
    let hrs = 4;
    if (intervalSelectMode === 'custom') {
      hrs = Number(customIntervalInput);
      if (!hrs || hrs <= 0) {
        alert('Please enter a valid custom interval number of hours (e.g. 5).');
        return;
      }
    } else {
      hrs = Number(intervalSelectMode);
    }

    if (!eventStartInput) {
      alert('Please specify the Event Start Date & Time.');
      return;
    }

    if (!calculatedDurationHours || calculatedDurationHours <= 0) {
      alert('Please specify a valid Total Event Duration in hours.');
      return;
    }

    try {
      setUpdatingInterval(true);
      const startIso = eventStartInput ? new Date(eventStartInput).toISOString() : null;
      const endIso = calculatedEndTimeStr ? new Date(calculatedEndTimeStr).toISOString() : null;

      const res = await axios.post(`/api/attendance/event/${eventId}/periods/auto-generate`, { 
        intervalHours: hrs,
        eventStart: startIso,
        eventEnd: endIso
      });
      alert(res.data.message || `Attendance checkpoints generated for ${calculatedDurationHours}-hour event duration!`);
      await fetchPeriodicData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to generate attendance checkpoints.');
    } finally {
      setUpdatingInterval(false);
    }
  };

  const handleSavePeriod = async (e) => {
    e.preventDefault();
    if (!periodForm.periodName || !periodForm.startTime || !periodForm.endTime) {
      alert('Please fill out all period fields.');
      return;
    }
    try {
      const periodPayload = {
        ...periodForm,
        startTime: new Date(periodForm.startTime).toISOString(),
        endTime: new Date(periodForm.endTime).toISOString()
      };

      if (editingPeriodId) {
        await axios.put(`/api/attendance/event/${eventId}/periods/${editingPeriodId}`, periodPayload);
      } else {
        await axios.post(`/api/attendance/event/${eventId}/periods`, periodPayload);
      }
      setShowPeriodModal(false);
      setEditingPeriodId(null);
      setPeriodForm({ periodName: '', startTime: '', endTime: '', includesFoodCoupon: false, foodCouponName: 'Food / Meal Coupon' });
      await fetchPeriodicData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving period.');
    }
  };

  const handleDeletePeriod = async (periodId) => {
    if (!window.confirm('Are you sure you want to delete this period?')) return;
    try {
      await axios.delete(`/api/attendance/event/${eventId}/periods/${periodId}`);
      await fetchPeriodicData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting period.');
    }
  };

  const handleSaveThreshold = async (e) => {
    e.preventDefault();
    try {
      setSavingThreshold(true);
      await axios.put(`/api/attendance/event/${eventId}/certificate-threshold`, thresholdForm);
      alert('Certificate eligibility settings updated!');
      await fetchPeriodicData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving settings.');
    } finally {
      setSavingThreshold(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm animate-pulse">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-4" />
        <div className="h-4 w-64 bg-slate-100 dark:bg-slate-800/60 rounded mx-auto" />
      </div>
    );
  }

  const {
    activePeriod,
    nextPeriod,
    periods = [],
    totalRegistered = 0,
    activePeriodMarkedCount = 0,
    activePeriodUnmarkedCount = 0,
    participantProgress = [],
    scanLogs = [],
    event = {}
  } = data || {};

  const currentIntervalHours = event.period_interval_hours || 4;

  const filteredParticipants = participantProgress.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.email.toLowerCase().includes(searchTerm.toLowerCase());
    if (filterEligibility === 'eligible') return matchesSearch && p.isEligible;
    if (filterEligibility === 'ineligible') return matchesSearch && !p.isEligible;
    return matchesSearch;
  });

  const filteredLogs = scanLogs.filter(log => {
    const matchesSearch = log.participantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.periodName.toLowerCase().includes(searchTerm.toLowerCase());
    if (logFilterPeriod !== 'all') return matchesSearch && log.periodId === logFilterPeriod;
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* ── Active Period Live Banner ─────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-500/20">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Live Attendance Checkpoint
              </span>
              <span className="text-xs text-slate-400 font-mono">Server Time: {new Date(data?.serverTime || Date.now()).toLocaleTimeString()}</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-white">
              {activePeriod ? cleanPeriodTitle(activePeriod.period_name) : 'No Active Checkpoint Right Now'}
            </h2>
            
            <p className="text-sm text-slate-300 mt-1 font-medium">
              {activePeriod ? (
                <>Active Period Window: <span className="font-mono text-indigo-300">{new Date(activePeriod.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(activePeriod.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></>
              ) : nextPeriod ? (
                <>Next Period (<strong className="text-indigo-300">{cleanPeriodTitle(nextPeriod.period_name)}</strong>) starts at <span className="font-mono text-indigo-300">{new Date(nextPeriod.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></>
              ) : (
                'All periodic checkpoints for this event have concluded or no periods generated yet.'
              )}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {activePeriod && (
              <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/15 text-center min-w-[140px]">
                <div className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">Time Remaining</div>
                <div className="text-xl font-black font-mono text-emerald-400 mt-0.5">{formatSeconds(secondsLeft)}</div>
              </div>
            )}

            {onScanClick && (
              <button
                onClick={onScanClick}
                className="px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm rounded-2xl shadow-lg shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 whitespace-nowrap"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Scan QR Pass Now
              </button>
            )}
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Active Marked</div>
            <div className="text-2xl font-black text-emerald-400 mt-1">{activePeriodMarkedCount} <span className="text-xs text-slate-400 font-normal">/ {totalRegistered}</span></div>
          </div>
          <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Active Pending</div>
            <div className="text-2xl font-black text-amber-400 mt-1">{activePeriodUnmarkedCount}</div>
          </div>
          <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Frequency Interval</div>
            <div className="text-2xl font-black text-indigo-300 mt-1">{currentIntervalHours} <span className="text-xs text-slate-400 font-normal">Hours/Block</span></div>
          </div>
          <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Cert. Eligible</div>
            <div className="text-2xl font-black text-cyan-300 mt-1">
              {participantProgress.filter(p => p.isEligible).length} <span className="text-xs text-slate-400 font-normal">Students</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── FORMAL EVENT DURATION & CHECKPOINT FREQUENCY CARD ─────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-200 dark:border-indigo-800">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Event Start, Total Duration & Checkpoint Settings
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Set start time and total event duration (e.g. 12h, 24h, 36h, 48h). End time is calculated automatically to partition checkpoints.
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0 self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            Configured Duration: {calculatedDurationHours} Hours
          </div>
        </div>

        <form onSubmit={handleFormalIntervalSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Event Start Time Input */}
            <div>
              <label className="block text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                Event Start Date & Time
              </label>
              <input
                type="datetime-local"
                required
                value={eventStartInput}
                onChange={e => setEventStartInput(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* 2. Customizable Total Event Duration */}
            <div>
              <label className="block text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                Total Event Duration
              </label>
              <select
                value={durationSelectMode}
                onChange={e => setDurationSelectMode(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="12">12 Hours (Half-Day / Standard)</option>
                <option value="24">24 Hours (Full 1-Day Hackathon)</option>
                <option value="36">36 Hours (1.5 Day Event)</option>
                <option value="48">48 Hours (2-Day Multi-Session)</option>
                <option value="custom">Custom Hours...</option>
              </select>

              {durationSelectMode === 'custom' && (
                <input
                  type="number"
                  min="1"
                  max="168"
                  required
                  value={customDurationInput}
                  onChange={e => setCustomDurationInput(e.target.value)}
                  placeholder="Enter total hrs e.g. 18"
                  className="w-full mt-2 px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              )}
            </div>

            {/* 3. Automatically Calculated Event End Time */}
            <div>
              <label className="block text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                Computed Event End Time
              </label>
              <input
                type="datetime-local"
                disabled
                value={calculatedEndTimeStr}
                className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 cursor-not-allowed opacity-90"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Calculated automatically from Start + Duration</span>
            </div>

            {/* 4. Checkpoint Interval Frequency */}
            <div>
              <label className="block text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                Checkpoint Interval Frequency
              </label>
              <select
                value={intervalSelectMode}
                onChange={e => setIntervalSelectMode(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="4">4 Hours per Period (Standard Default)</option>
                <option value="3">3 Hours per Period</option>
                <option value="2">2 Hours per Period</option>
                <option value="1">1 Hour per Period (Hourly Checkpoints)</option>
                <option value="6">6 Hours per Period</option>
                <option value="8">8 Hours per Period</option>
                <option value="custom">Custom Interval (Hours)...</option>
              </select>

              {intervalSelectMode === 'custom' && (
                <input
                  type="number"
                  min="1"
                  max="24"
                  required
                  value={customIntervalInput}
                  onChange={e => setCustomIntervalInput(e.target.value)}
                  placeholder="Interval hrs e.g. 5"
                  className="w-full mt-2 px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              )}
            </div>
          </div>

          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              disabled={updatingInterval}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2"
            >
              {updatingInterval ? 'Re-Generating Timeline...' : 'Apply Duration & Re-Generate Checkpoints'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Sub Navigation Tabs ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('progress')}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
              activeTab === 'progress'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Participant Checkpoint Progress ({participantProgress.length})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'logs'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Hour-by-Hour Scan Logs ({scanLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('periods')}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
              activeTab === 'periods'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Manage Time Periods ({periods.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Certificate Threshold Config
          </button>
        </div>

        <button
          onClick={fetchPeriodicData}
          className="p-2 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shrink-0"
          title="Refresh attendance data"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* ── TAB 1: Participant Progress Table ───────────────────────────── */}
      {activeTab === 'progress' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search name, roll no, email..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
              />
              <svg className="w-5 h-5 text-slate-400 absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filter:</span>
              <button
                onClick={() => setFilterEligibility('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterEligibility === 'all' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400'}`}
              >
                All ({participantProgress.length})
              </button>
              <button
                onClick={() => setFilterEligibility('eligible')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterEligibility === 'eligible' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'}`}
              >
                Eligible ({participantProgress.filter(p => p.isEligible).length})
              </button>
              <button
                onClick={() => setFilterEligibility('ineligible')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterEligibility === 'ineligible' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'text-slate-600 dark:text-slate-400'}`}
              >
                Ineligible ({participantProgress.filter(p => !p.isEligible).length})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3.5 px-4">Participant</th>
                  <th className="py-3.5 px-4">Roll Number</th>
                  <th className="py-3.5 px-4">Checkpoint Progress</th>
                  <th className="py-3.5 px-4">Individual Checkpoints</th>
                  <th className="py-3.5 px-4 text-center">Certificate Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredParticipants.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 font-medium">
                      No participants match your search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredParticipants.map(participant => (
                    <tr key={participant.registrationId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        {participant.name}
                        <div className="text-xs text-slate-400 font-normal">{participant.email}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-600 dark:text-slate-300">
                        {participant.rollNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-black text-base text-indigo-600 dark:text-indigo-400 min-w-[40px]">
                            {participant.progressStr}
                          </span>
                          <div className="w-24 bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all rounded-full ${participant.isEligible ? 'bg-emerald-500' : 'bg-amber-500'}`}
                              style={{ width: `${Math.min(100, participant.percentage)}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-500">{participant.percentage}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {periods.map((p, idx) => {
                            const isMarked = participant.records.some(r => r.attendance_period_id === p.id);
                            return (
                              <span
                                key={p.id}
                                title={`${p.period_name}: ${isMarked ? 'Marked' : 'Not Marked'}`}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                                  isMarked
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                                    : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700'
                                }`}
                              >
                                P{idx + 1} {isMarked ? '✓' : '✗'}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {participant.isEligible ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                            ✓ Eligible
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                            Needs Checkpoints
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: Hour-by-Hour Timestamped Scan Logs ────────────────────── */}
      {activeTab === 'logs' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Hour-by-Hour Attendance Activity Logs</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Complete timestamped history of all participant QR attendance check-ins.</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Filter name, roll, period..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium dark:text-white"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <select
                value={logFilterPeriod}
                onChange={e => setLogFilterPeriod(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <option value="all">All Checkpoint Periods</option>
                {periods.map(p => (
                  <option key={p.id} value={p.id}>{cleanPeriodTitle(p.period_name)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Hour-to-Hour Summary Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {periods.map((p, idx) => (
              <div
                key={p.id}
                onClick={() => setLogFilterPeriod(prev => prev === p.id ? 'all' : p.id)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  logFilterPeriod === p.id
                    ? 'bg-indigo-50 border-indigo-500 dark:bg-indigo-950/60 dark:border-indigo-500 shadow-md'
                    : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                  <span>Checkpoint #{idx + 1}</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400">{p.markedCount} Scans</span>
                </div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white line-clamp-1">{cleanPeriodTitle(p.period_name)}</h4>
                <div className="text-[11px] font-mono text-slate-400 mt-1">
                  {new Date(p.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(p.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>

          {/* Detailed Timestamps Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3.5 px-4">Exact Timestamp</th>
                  <th className="py-3.5 px-4">Participant</th>
                  <th className="py-3.5 px-4">Roll Number</th>
                  <th className="py-3.5 px-4">Attendance Period / Checkpoint</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500 font-medium">
                      No timestamped scan logs recorded yet for this selection.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        <div className="text-indigo-600 dark:text-indigo-400">
                          {new Date(log.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(log.scannedAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        {log.participantName}
                        <div className="text-xs text-slate-400 font-normal">{log.email}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-600 dark:text-slate-300">
                        {log.rollNumber}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                        <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {cleanPeriodTitle(log.periodName)}
                        </span>
                        {(log.includesFoodCoupon || /food|meal|coupon|lunch|dinner|breakfast|snack/i.test(log.periodName || '')) && (
                          <div className="mt-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <span>Food Coupon Included</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                            ✓ Verified
                          </span>
                          {(log.includesFoodCoupon || /food|meal|coupon|lunch|dinner|breakfast|snack/i.test(log.periodName || '')) && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700">
                              Food Coupon Redeemed
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: Manage Time Periods ──────────────────────────────────── */}
      {activeTab === 'periods' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Attendance Checkpoints Timeline</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Manage duration intervals or create custom checkpoints for scanning.</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  setEditingPeriodId(null);
                  setPeriodForm({ periodName: '', startTime: '', endTime: '', includesFoodCoupon: false, foodCouponName: 'Food / Meal Coupon' });
                  setShowPeriodModal(true);
                }}
                className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-500 transition-all flex items-center gap-1"
              >
                + Add Custom Period
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {periods.map((period, index) => {
              const isCurrentActive = activePeriod && activePeriod.id === period.id;
              const hasFood = !!(period.includes_food_coupon || /food|meal|coupon|lunch|dinner|breakfast|snack/i.test(period.period_name || ''));
              return (
                <div
                  key={period.id}
                  className={`p-5 rounded-2xl border transition-all relative overflow-hidden ${
                    isCurrentActive
                      ? 'bg-gradient-to-r from-indigo-50/80 to-purple-50/80 dark:from-indigo-950/40 dark:to-purple-950/40 border-indigo-400 dark:border-indigo-600 shadow-md'
                      : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80'
                  }`}
                >
                  {isCurrentActive && (
                    <span className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950 shadow-sm animate-pulse">
                      Active Now
                    </span>
                  )}

                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">Checkpoint #{index + 1}</span>
                      <h4 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                        {(period.period_name || '').replace(/(?:🍔\s*)?\[Food Coupon Included\]/gi, '').trim()}
                      </h4>
                      
                      {hasFood && (
                        <div className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <span>Food coupon included during this time period</span>
                        </div>
                      )}

                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-2 flex items-center gap-2">
                        <span>{new Date(period.start_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                        <span>→</span>
                        <span>{new Date(period.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingPeriodId(period.id);
                          setPeriodForm({
                            periodName: (period.period_name || '').replace(/(?:🍔\s*)?\[Food Coupon Included\]/gi, '').trim(),
                            startTime: toLocalISOString(period.start_time),
                            endTime: toLocalISOString(period.end_time),
                            includesFoodCoupon: hasFood,
                            foodCouponName: period.food_coupon_name || 'Food / Meal Coupon'
                          });
                          setShowPeriodModal(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 rounded-lg hover:bg-white dark:hover:bg-slate-700"
                        title="Edit period"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeletePeriod(period.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-white dark:hover:bg-slate-700"
                        title="Delete period"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-600 dark:text-slate-300">Marked Attendance:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono font-black text-sm">{period.markedCount} / {totalRegistered} Participants</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 4: Certificate Threshold Settings ───────────────────────── */}
      {activeTab === 'settings' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm max-w-xl space-y-6">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Certificate Eligibility Criteria</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Configure minimum required checkpoints or percentage for students to qualify for event certificates.</p>
          </div>

          <form onSubmit={handleSaveThreshold} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase text-slate-600 dark:text-slate-400 mb-1">
                Minimum Checkpoint Count Requirement
              </label>
              <input
                type="number"
                min="1"
                max={periods.length || 10}
                value={thresholdForm.minCheckpoints}
                onChange={e => setThresholdForm(prev => ({ ...prev, minCheckpoints: e.target.value }))}
                placeholder={`Leave empty to use percentage (Total checkpoints: ${periods.length})`}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold dark:text-white"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">e.g. Setting "3" requires students to have at least 3 checkpoints marked out of {periods.length}.</span>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-600 dark:text-slate-400 mb-1">
                Minimum Checkpoint Percentage Requirement (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={thresholdForm.minPercentage}
                onChange={e => setThresholdForm(prev => ({ ...prev, minPercentage: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold dark:text-white"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">Default: 75%. Used if minimum checkpoint count is not explicitly set above.</span>
            </div>

            <button
              type="submit"
              disabled={savingThreshold}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm rounded-xl shadow-lg shadow-indigo-600/25 transition-all"
            >
              {savingThreshold ? 'Saving Settings...' : 'Save Certificate Criteria'}
            </button>
          </form>
        </div>
      )}

      {/* ── Custom Period Modal ─────────────────────────────────────────── */}
      {showPeriodModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              {editingPeriodId ? 'Edit Attendance Checkpoint' : 'Create Custom Attendance Checkpoint'}
            </h3>

            <form onSubmit={handleSavePeriod} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Period Name</label>
                <input
                  type="text"
                  required
                  value={periodForm.periodName}
                  onChange={e => setPeriodForm(prev => ({ ...prev, periodName: e.target.value }))}
                  placeholder="e.g. Afternoon Session / Hackathon Checkpoint 2"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Start Time</label>
                <input
                  type="datetime-local"
                  required
                  value={periodForm.startTime}
                  onChange={e => setPeriodForm(prev => ({ ...prev, startTime: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">End Time</label>
                <input
                  type="datetime-local"
                  required
                  value={periodForm.endTime}
                  onChange={e => setPeriodForm(prev => ({ ...prev, endTime: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold dark:text-white"
                />
              </div>

              {/* Food Coupon Integration Option */}
              <div className="p-4 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={periodForm.includesFoodCoupon}
                    onChange={e => setPeriodForm(prev => ({ ...prev, includesFoodCoupon: e.target.checked }))}
                    className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
                  />
                  <span className="flex items-center gap-1.5">
                    <span>Include Food Coupon / Meal Pass with this Period</span>
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-6.5">
                  Scanning QR during this time period will automatically record both Attendance AND Food Coupon Redemption together in 1 single scan!
                </p>

                {periodForm.includesFoodCoupon && (
                  <div className="pl-6.5 pt-1">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">
                      Food Coupon Label / Name
                    </label>
                    <input
                      type="text"
                      value={periodForm.foodCouponName}
                      onChange={e => setPeriodForm(prev => ({ ...prev, foodCouponName: e.target.value }))}
                      placeholder="e.g. Lunch Coupon / Dinner Meal Pass"
                      className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPeriodModal(false)}
                  className="px-4 py-2.5 text-slate-600 dark:text-slate-400 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl shadow-md"
                >
                  Save Checkpoint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
