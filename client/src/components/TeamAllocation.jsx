import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

const DEFAULT_ALLOC_CONFIG = {
  problemStatement: { enabled: true, method: 'leader' },
  venue: { enabled: true, method: 'bulk' }
};

const normalizeConfig = (raw) => {
  const cfg = (raw && typeof raw === 'object') ? raw : {};
  const ps = (cfg.problemStatement && typeof cfg.problemStatement === 'object') ? cfg.problemStatement : {};
  const venue = (cfg.venue && typeof cfg.venue === 'object') ? cfg.venue : {};
  return {
    problemStatement: {
      enabled: ps.enabled === undefined ? DEFAULT_ALLOC_CONFIG.problemStatement.enabled : !!ps.enabled,
      method: ps.method === 'bulk' ? 'bulk' : 'leader'
    },
    venue: {
      enabled: venue.enabled === undefined ? DEFAULT_ALLOC_CONFIG.venue.enabled : !!venue.enabled,
      method: venue.method === 'individual' ? 'individual' : 'bulk'
    }
  };
};

const ToggleSwitch = ({ checked, onChange, labelOn = 'Enabled', labelOff = 'Disabled' }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
    className={`relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-extrabold uppercase tracking-wider transition-all ${
      checked
        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
        : 'bg-slate-500/10 border-slate-500/20 text-text-secondary'
    }`}
  >
    <span
      className={`inline-block w-8 h-4 rounded-full relative transition-all ${
        checked ? 'bg-emerald-500' : 'bg-slate-400/60'
      }`}
    >
      <span
        className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${
          checked ? 'left-[18px]' : 'left-0.5'
        }`}
      />
    </span>
    <span>{checked ? labelOn : labelOff}</span>
  </button>
);

const MethodChip = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider border transition-all ${
      active
        ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm'
        : 'bg-white/60 dark:bg-slate-900/60 text-text-secondary border-pastel-lavender/25 hover:border-cyan-500/40 hover:text-cyan-600'
    }`}
  >
    {children}
  </button>
);

const TeamAllocation = ({ eventId, eventTitle }) => {
  const [allocations, setAllocations] = useState([]);
  const [problemStatements, setProblemStatements] = useState([]);
  const [totalTeams, setTotalTeams] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  // Allocation settings: enable/disable problem statement & venue, each with bulk or individual method
  const [allocConfig, setAllocConfig] = useState(DEFAULT_ALLOC_CONFIG);
  const [savingSettings, setSavingSettings] = useState(false);

  // Config State
  const [psList, setPsList] = useState([]);
  const [savingConfig, setSavingConfig] = useState(false);

  // Upload & Preview state
  const [previewData, setPreviewData] = useState(null);
  const [previewValid, setPreviewValid] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Inline edit state
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editForm, setEditForm] = useState({ venueRoom: '', problemStatement: '' });

  // PDF Upload State
  const [pdfInfo, setPdfInfo] = useState({ pdfUrl: null, fileName: null });
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const pdfFileInputRef = useRef(null);

  const psEnabled = allocConfig.problemStatement.enabled;
  const venueEnabled = allocConfig.venue.enabled;
  const psUsesBulk = psEnabled && allocConfig.problemStatement.method === 'bulk';
  const venueUsesBulk = venueEnabled && allocConfig.venue.method === 'bulk';
  const showBulkSection = psUsesBulk || venueUsesBulk;

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch team allocations and problem statements
      const [allocRes, psRes] = await Promise.all([
        axios.get(`/api/allocations/event/${eventId}`),
        axios.get(`/api/allocations/event/${eventId}/problem-statements`)
      ]);

      if (allocRes.data) {
        const teamList = allocRes.data.allocations || (Array.isArray(allocRes.data) ? allocRes.data : []);
        setAllocations(teamList);
        if (allocRes.data.allocationConfig) {
          setAllocConfig(normalizeConfig(allocRes.data.allocationConfig));
        }
      }

      if (psRes.data) {
        const psArr = psRes.data.problemStatements || [];
        setProblemStatements(psArr);
        setTotalTeams(psRes.data.totalTeams || 0);
        if (psRes.data.pdfUrl) {
          setPdfInfo({ pdfUrl: psRes.data.pdfUrl, fileName: 'Problem_Statement.pdf' });
        }
        if (psRes.data.allocationConfig) {
          setAllocConfig(normalizeConfig(psRes.data.allocationConfig));
        }

        // Initialize local config form
        if (psArr.length > 0) {
          setPsList(psArr.map((p, i) => ({
            id: p.id,
            code: p.code || `PS${String(i + 1).padStart(2, '0')}`,
            title: p.title || '',
            description: p.description || '',
            maxCapacity: (() => {
              const cap = p.max_capacity ?? p.maxCapacity;
              return (cap !== undefined && cap !== null && !isNaN(Number(cap)) && Number(cap) > 0) ? Number(cap) : 5;
            })(),
            allocatedCount: p.allocated_count || 0
          })));
        } else {
          // Default setup if empty
          const defaults = Array.from({ length: 5 }, (_, i) => ({
            id: `temp_${i}`,
            code: `PS${String(i + 1).padStart(2, '0')}`,
            title: `Problem Statement ${i + 1}`,
            description: '',
            maxCapacity: 5,
            allocatedCount: 0
          }));
          setPsList(defaults);
        }
      }
    } catch (err) {
      console.error('Error fetching allocation data:', err);
      setError(err.response?.data?.message || 'Failed to load allocation data.');
    } finally {
      setLoading(false);
    }
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setStatusMessage({ type: 'error', text: 'Please select a valid PDF file.' });
      return;
    }

    try {
      setUploadingPdf(true);
      setStatusMessage(null);
      const formData = new FormData();
      formData.append('pdf', file);

      const res = await axios.post(`/api/allocations/event/${eventId}/problem-statement-pdf`, formData);

      setPdfInfo({ pdfUrl: res.data.pdfUrl || null, fileName: file.name });
      setStatusMessage({
        type: 'success',
        text: res.data.message || 'Problem Statement PDF uploaded successfully!'
      });
    } catch (err) {
      console.error('PDF Upload Error:', err);
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Failed to upload Problem Statement PDF.'
      });
    } finally {
      setUploadingPdf(false);
      if (pdfFileInputRef.current) pdfFileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (eventId) {
      fetchData();
    }
  }, [eventId]);

  // Save Allocation Settings (enable/disable + method per type)
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setStatusMessage(null);
    try {
      const res = await axios.put(`/api/allocations/event/${eventId}/config`, {
        allocationConfig: allocConfig
      });
      setAllocConfig(normalizeConfig(res.data?.allocationConfig || allocConfig));
      setStatusMessage({ type: 'success', text: res.data?.message || 'Allocation settings saved.' });
    } catch (err) {
      console.error('Save allocation settings error:', err);
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save allocation settings.' });
    } finally {
      setSavingSettings(false);
    }
  };

  const updateAllocConfig = (type, patch) => {
    setAllocConfig(prev => ({
      ...prev,
      [type]: { ...prev[type], ...patch }
    }));
  };

  // Add new Problem Statement Row
  const handleAddProblemStatement = () => {
    setPsList(prev => [
      ...prev,
      {
        id: `temp_${Date.now()}`,
        code: `PS${String(prev.length + 1).padStart(2, '0')}`,
        title: `Problem Statement ${prev.length + 1}`,
        description: '',
        maxCapacity: 5,
        allocatedCount: 0
      }
    ]);
  };

  // Remove Problem Statement Row
  const handleRemoveProblemStatement = (index) => {
    if (psList.length <= 1) {
      setStatusMessage({ type: 'warning', text: 'An event must have at least 1 problem statement.' });
      return;
    }
    setPsList(prev => prev.filter((_, i) => i !== index));
  };

  // Update Problem Statement Row Field
  const handlePsChange = (index, field, value) => {
    setPsList(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Save Problem Statements Config
  const handleSaveProblemStatements = async () => {
    setStatusMessage(null);

    for (let i = 0; i < psList.length; i++) {
      const item = psList[i];
      const title = String(item.title || '').trim();

      if (!title) {
        setStatusMessage({ type: 'error', text: `Problem statement #${i + 1} title cannot be empty.` });
        return;
      }
    }

    setSavingConfig(true);
    try {
      const res = await axios.post(`/api/allocations/event/${eventId}/problem-statements`, {
        problemStatements: psList
      });

      setStatusMessage({ type: 'success', text: res.data.message || 'Problem statements configured successfully!' });
      fetchData();
    } catch (err) {
      console.error('Save problem statements error:', err);
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save problem statement configuration.' });
    } finally {
      setSavingConfig(false);
    }
  };

  // 1. Download Template
  const handleDownloadTemplate = async () => {
    try {
      setStatusMessage(null);
      const res = await axios.get(`/api/allocations/event/${eventId}/template`);
      const rows = res.data;

      if (!rows || rows.length === 0) {
        setStatusMessage({ type: 'warning', text: 'No confirmed teams found for this event to generate template.' });
        return;
      }

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Allocations');
      const filename = `${(eventTitle || 'Event').replace(/[^a-zA-Z0-9]/g, '_')}_Allocation_Template.xlsx`;
      XLSX.writeFile(wb, filename);
      setStatusMessage({ type: 'success', text: 'Allocation template downloaded successfully.' });
    } catch (err) {
      console.error('Download template error:', err);
      setStatusMessage({ type: 'error', text: 'Failed to download allocation template.' });
    }
  };

  // 2. Upload & Parse Allocation File
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setStatusMessage(null);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!jsonRows || jsonRows.length === 0) {
          setStatusMessage({ type: 'error', text: 'Uploaded file contains no rows.' });
          return;
        }

        const validTeamMap = new Map(allocations.map(a => [a.teamId, a.teamName]));
        const knownPsTitles = new Set(psList.map(p => String(p.title || '').trim().toLowerCase()));
        const seenTeams = new Set();
        let allRowsValid = true;

        const parsedPreview = jsonRows.map((row, index) => {
          const teamId = String(row['Team ID'] || row['teamId'] || row['TeamId'] || row['team_id'] || '').trim();
          const teamName = String(row['Team Name'] || row['teamName'] || row['TeamName'] || row['team_name'] || 'Row ' + (index + 1)).trim();
          const venueRoom = venueEnabled ? String(row['Venue / Room'] || row['Venue/Room'] || row['Venue'] || row['Room'] || row['venueRoom'] || '').trim() : '';
          const problemStatement = psEnabled ? String(row['Problem Statement'] || row['ProblemStatement'] || row['Problem'] || row['problemStatement'] || '').trim() : '';

          let rowStatus = 'Valid';
          let errorMessage = '';

          if (!teamId || !validTeamMap.has(teamId)) {
            rowStatus = 'Invalid';
            errorMessage = `Team not found for this event: ${teamName} (${teamId || 'No ID'})`;
            allRowsValid = false;
          } else if (venueEnabled && !venueRoom) {
            rowStatus = 'Invalid';
            errorMessage = `Venue / Room is missing for team: ${teamName}`;
            allRowsValid = false;
          } else if (psEnabled && problemStatement && !knownPsTitles.has(problemStatement.toLowerCase())) {
            rowStatus = 'Invalid';
            errorMessage = `Problem statement not found: "${problemStatement}" for team: ${teamName}`;
            allRowsValid = false;
          } else if (seenTeams.has(teamId)) {
            rowStatus = 'Invalid';
            errorMessage = `Duplicate allocation found for team: ${teamName}`;
            allRowsValid = false;
          } else {
            seenTeams.add(teamId);
          }

          return {
            teamId,
            teamName: validTeamMap.get(teamId) || teamName,
            venueRoom,
            problemStatement,
            status: rowStatus,
            error: errorMessage
          };
        });

        setPreviewData(parsedPreview);
        setPreviewValid(allRowsValid);
      } catch (err) {
        console.error('File parse error:', err);
        setStatusMessage({ type: 'error', text: 'Error reading Excel file. Please ensure it is a valid .xlsx, .xls, or .csv file.' });
      }
    };

    reader.readAsArrayBuffer(file);
    e.target.value = null;
  };

  // 3. Save Previewed Allocations
  const handleSavePreview = async () => {
    if (!previewData || previewData.length === 0 || !previewValid) return;

    setSaving(true);
    setStatusMessage(null);
    try {
      const payload = previewData.map(p => {
        const entry = { teamId: p.teamId, teamName: p.teamName };
        if (venueEnabled) entry.venueRoom = p.venueRoom;
        if (psEnabled) entry.problemStatement = p.problemStatement;
        return entry;
      });

      const res = await axios.post(`/api/allocations/event/${eventId}`, { allocations: payload });
      setStatusMessage({ type: 'success', text: res.data.message || 'Allocations saved successfully!' });
      setPreviewData(null);
      fetchData();
    } catch (err) {
      console.error('Save allocations error:', err);
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save allocations.' });
    } finally {
      setSaving(false);
    }
  };

  // 4. Inline Edit Save (Venue or Problem Statement independently)
  const handleSaveInlineEdit = async (teamId) => {
    const venueVal = venueEnabled ? editForm.venueRoom.trim() : '';
    const psVal = psEnabled ? editForm.problemStatement.trim() : '';

    if (!venueVal && !psVal) {
      setStatusMessage({ type: 'error', text: 'Please enter a value for at least one enabled allocation type.' });
      return;
    }

    try {
      const entry = { teamId };
      if (venueEnabled) entry.venueRoom = venueVal;
      if (psEnabled) entry.problemStatement = psVal;
      await axios.post(`/api/allocations/event/${eventId}`, {
        allocations: [entry]
      });
      setEditingTeamId(null);
      setStatusMessage({ type: 'success', text: 'Allocation updated successfully.' });
      fetchData();
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update allocation.' });
    }
  };

  // 5. Clear / Remove Allocation
  const handleClearAllocation = async (targetId) => {
    if (!window.confirm('Are you sure you want to remove this allocation? The slot will be released.')) return;
    try {
      setStatusMessage(null);
      const res = await axios.delete(`/api/allocations/event/${eventId}/target/${targetId}`);
      setStatusMessage({ type: 'success', text: res.data.message || 'Allocation removed successfully.' });
      fetchData();
    } catch (err) {
      console.error('Clear allocation error:', err);
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Failed to remove allocation.' });
    }
  };

  const filteredAllocations = allocations.filter(a => {
    const q = searchQuery.toLowerCase();
    if (a.teamName.toLowerCase().includes(q)) return true;
    if (venueEnabled && (a.venueRoom || '').toLowerCase().includes(q)) return true;
    if (psEnabled && (a.problemStatement || '').toLowerCase().includes(q)) return true;
    return false;
  });

  return (
    <div className="space-y-6">

      {/* PAGE HEADER */}
      <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md rounded-2xl p-6 border border-pastel-lavender/20 shadow-soft flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-xl font-bold text-text-primary">
              <span className="text-cyan-500">Allocation</span>
            </h2>
            {eventTitle && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-semibold border border-cyan-500/20">
                {eventTitle}
              </span>
            )}
          </div>
          <p className="text-text-secondary text-xs mt-1">
            Enable problem statement and/or venue allocation, then assign them in bulk or individually.
          </p>
        </div>
      </div>

      {/* Alert Status Message */}
      {statusMessage && (
        <div className={`p-4 rounded-xl border text-sm font-semibold flex items-center justify-between animate-fade-in ${
          statusMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
          statusMessage.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' :
          'bg-red-500/10 border-red-500/20 text-red-500'
        }`}>
          <div className="flex items-center gap-2">
            <span>{statusMessage.type === 'success' ? '✓' : '⚠'}</span>
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-xs font-bold opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Upload Preview Modal/Card */}
      {previewData && (
        <div className="bg-white/80 dark:bg-slate-900/80 border-2 border-cyan-500/30 rounded-2xl p-6 shadow-xl space-y-4 animate-fade-in-scale">
          <div className="flex justify-between items-center pb-3 border-b border-pastel-lavender/20">
            <div>
              <h3 className="font-heading font-bold text-lg text-text-primary flex items-center gap-2">
                <span>📋 Allocation Upload Preview</span>
                {previewValid ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/20">All Rows Valid</span>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-500 font-bold border border-red-500/20">Errors Found</span>
                )}
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">Review parsed allocations before saving to the database.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPreviewData(null)}
                className="px-4 py-2 text-xs font-bold btn-secondary rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePreview}
                disabled={!previewValid || saving}
                className="btn-primary px-5 py-2 text-xs font-bold text-white rounded-xl shadow-md disabled:opacity-40"
              >
                {saving ? 'Saving...' : 'Save Allocations'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-80 overflow-y-auto scrollbar-thin">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/40 dark:bg-slate-800/40 text-text-secondary text-[10px] font-bold uppercase tracking-wider border-b border-pastel-lavender/20">
                  <th className="px-4 py-3">Team Name</th>
                  {venueEnabled && <th className="px-4 py-3">Venue / Room</th>}
                  {psEnabled && <th className="px-4 py-3">Problem Statement</th>}
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pastel-lavender/10 text-xs">
                {previewData.map((row, idx) => (
                  <tr key={idx} className={row.status === 'Valid' ? 'hover:bg-emerald-500/5' : 'bg-red-500/5 hover:bg-red-500/10'}>
                    <td className="px-4 py-3 font-bold text-text-primary">{row.teamName}</td>
                    {venueEnabled && <td className="px-4 py-3 font-semibold text-text-primary">{row.venueRoom || '—'}</td>}
                    {psEnabled && <td className="px-4 py-3 text-text-secondary max-w-xs truncate">{row.problemStatement || '—'}</td>}
                    <td className="px-4 py-3 text-center">
                      {row.status === 'Valid' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Valid</span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-500/10 text-red-500 border border-red-500/20" title={row.error}>
                          {row.error}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* 1. ALLOCATION SETTINGS (ENABLE / DISABLE PER TYPE) */}
      {/* ================================================== */}
      <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md rounded-2xl p-6 border border-pastel-lavender/20 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-heading text-sm font-extrabold uppercase tracking-wider text-text-primary flex items-center gap-2">
              <span>⚙ Allocation Settings</span>
            </h3>
            <p className="text-text-secondary text-xs mt-1">
              Enable or disable problem statement and venue allocation. Each enabled type can be allocated in bulk or individually.
            </p>
          </div>
          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="btn-primary px-5 py-2 text-xs font-bold text-white rounded-xl shadow-md disabled:opacity-40 transition-all whitespace-nowrap"
          >
            {savingSettings ? 'Saving Settings...' : '💾 Save Settings'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* PROBLEM STATEMENT TOGGLE CARD */}
          <div className={`rounded-2xl p-5 border-2 transition-all space-y-4 ${
            psEnabled
              ? 'bg-cyan-500/10 border-cyan-500 shadow-md ring-2 ring-cyan-500/20'
              : 'bg-white/60 dark:bg-slate-900/60 border-pastel-lavender/20 opacity-75'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className={`w-9 h-9 rounded-xl border flex items-center justify-center text-lg font-bold ${
                  psEnabled
                    ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
                    : 'bg-slate-500/10 text-text-secondary border-slate-500/20'
                }`}>
                  📌
                </span>
                <div>
                  <h4 className="font-heading font-bold text-sm text-text-primary">Problem Statement</h4>
                  <p className="text-[10px] text-text-secondary">Allocate problem statements to teams</p>
                </div>
              </div>
              <ToggleSwitch
                checked={psEnabled}
                onChange={(val) => updateAllocConfig('problemStatement', { enabled: val })}
              />
            </div>

            {psEnabled && (
              <div className="space-y-2 pt-1 border-t border-cyan-500/10">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary">Allocation Method</span>
                <div className="flex flex-wrap gap-2">
                  <MethodChip
                    active={allocConfig.problemStatement.method === 'bulk'}
                    onClick={() => updateAllocConfig('problemStatement', { method: 'bulk' })}
                  >
                    📊 Bulk Excel
                  </MethodChip>
                  <MethodChip
                    active={allocConfig.problemStatement.method === 'leader'}
                    onClick={() => updateAllocConfig('problemStatement', { method: 'leader' })}
                  >
                    🎯 Individual / Team Leader
                  </MethodChip>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed pt-1">
                  {allocConfig.problemStatement.method === 'bulk'
                    ? 'Assign problem statements to all teams at once via Excel upload, or edit individually in the overview table below.'
                    : 'Configure statements & slot capacities. Team Leaders self-select after QR check-in, or allocate individually in the overview table.'}
                </p>
              </div>
            )}
          </div>

          {/* VENUE TOGGLE CARD */}
          <div className={`rounded-2xl p-5 border-2 transition-all space-y-4 ${
            venueEnabled
              ? 'bg-cyan-500/10 border-cyan-500 shadow-md ring-2 ring-cyan-500/20'
              : 'bg-white/60 dark:bg-slate-900/60 border-pastel-lavender/20 opacity-75'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className={`w-9 h-9 rounded-xl border flex items-center justify-center text-lg font-bold ${
                  venueEnabled
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : 'bg-slate-500/10 text-text-secondary border-slate-500/20'
                }`}>
                  📍
                </span>
                <div>
                  <h4 className="font-heading font-bold text-sm text-text-primary">Venue / Room</h4>
                  <p className="text-[10px] text-text-secondary">Allocate venue rooms to teams</p>
                </div>
              </div>
              <ToggleSwitch
                checked={venueEnabled}
                onChange={(val) => updateAllocConfig('venue', { enabled: val })}
              />
            </div>

            {venueEnabled && (
              <div className="space-y-2 pt-1 border-t border-emerald-500/10">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary">Allocation Method</span>
                <div className="flex flex-wrap gap-2">
                  <MethodChip
                    active={allocConfig.venue.method === 'bulk'}
                    onClick={() => updateAllocConfig('venue', { method: 'bulk' })}
                  >
                    📊 Bulk Excel
                  </MethodChip>
                  <MethodChip
                    active={allocConfig.venue.method === 'individual'}
                    onClick={() => updateAllocConfig('venue', { method: 'individual' })}
                  >
                    ✏️ Individual (per team)
                  </MethodChip>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed pt-1">
                  {allocConfig.venue.method === 'bulk'
                    ? 'Assign venue rooms to all teams at once via Excel upload.'
                    : 'Assign venue rooms one team at a time using the overview table below.'}
                </p>
              </div>
            )}
          </div>

        </div>

        {!psEnabled && !venueEnabled && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-600 dark:text-amber-400">
            ⚠ Both allocation types are disabled. Enable Problem Statement and/or Venue allocation to start assigning.
          </div>
        )}
      </div>

      {/* ================================================== */}
      {/* 2. BULK EXCEL WORKFLOW (ANY ENABLED TYPE ON BULK)  */}
      {/* ================================================== */}
      {showBulkSection && (psEnabled || venueEnabled) && (
        <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md rounded-2xl border border-pastel-lavender/20 shadow-soft p-6 space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-pastel-lavender/20 pb-3">
            <div>
              <h3 className="font-heading font-bold text-sm text-text-primary flex items-center gap-2">
                <span>📊 Bulk Excel Allocation</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Bulk</span>
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Template columns: Team ID, Team Name{venueUsesBulk ? ', Venue / Room' : ''}{psUsesBulk ? ', Problem Statement' : ''}.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step 1: Download Template */}
            <div className="bg-white/60 dark:bg-slate-900/60 p-5 rounded-xl border border-pastel-lavender/20 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
                  <span className="w-6 h-6 rounded-full bg-cyan-500 text-white flex items-center justify-center text-xs font-extrabold">1</span>
                  <span>Download Template</span>
                </div>
                <p className="text-xs text-text-secondary mt-2 leading-relaxed">
                  Download the Excel template pre-filled with all confirmed teams for this event.
                </p>
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="w-full mt-3 px-4 py-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2"
              >
                📥 Download Excel Template
              </button>
            </div>

            {/* Step 2: Upload Template */}
            <div className="bg-white/60 dark:bg-slate-900/60 p-5 rounded-xl border border-pastel-lavender/20 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
                  <span className="w-6 h-6 rounded-full bg-cyan-500 text-white flex items-center justify-center text-xs font-extrabold">2</span>
                  <span>Upload Filled Template</span>
                </div>
                <p className="text-xs text-text-secondary mt-2 leading-relaxed">
                  Upload the completed Excel file to apply allocations to all teams in bulk.
                </p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".xlsx, .xls, .csv"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full mt-3 btn-primary px-4 py-2.5 text-xs font-bold text-white rounded-xl flex items-center justify-center gap-2 shadow-md"
              >
                📤 Upload Excel Allocations
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* 3. PROBLEM STATEMENT CONFIGURATION (WHEN ENABLED) */}
      {/* ================================================== */}
      {psEnabled && (
        <div className="space-y-6 animate-fade-in">

          {/* CAPACITY SUMMARY CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Card 1: Eligible Teams */}
            <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md rounded-2xl border border-pastel-lavender/20 p-5 shadow-soft flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Eligible Teams</span>
                <div className="text-2xl font-extrabold text-text-primary mt-1">{totalTeams}</div>
                <span className="text-[11px] text-text-secondary">Confirmed registered teams</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 flex items-center justify-center text-xl font-bold">
                👥
              </div>
            </div>

            {/* Card 2: Configured Statements Summary */}
            <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md rounded-2xl border border-pastel-lavender/20 p-5 shadow-soft flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Configured Statements</span>
                <div className="text-2xl font-extrabold text-text-primary mt-1">{psList.length}</div>
                <span className="text-[11px] text-text-secondary">Problem statement options configured</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center text-xl font-bold">
                📌
              </div>
            </div>

          </div>

          {/* PROBLEM STATEMENT CONFIGURATION CARDS & FORM */}
          <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md rounded-2xl border border-pastel-lavender/20 shadow-soft p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-pastel-lavender/20">
              <div>
                <h3 className="font-heading font-bold text-base text-text-primary">Configure Problem Statements</h3>
                <p className="text-xs text-text-secondary">Add, edit, or remove problem statements for bulk upload and team leader selection.</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleAddProblemStatement}
                  className="px-3.5 py-2 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 rounded-xl text-xs font-bold hover:bg-cyan-500/20 transition-all flex items-center gap-1.5"
                >
                  ➕ Add Problem Statement
                </button>
                <button
                  onClick={handleSaveProblemStatements}
                  disabled={savingConfig}
                  className="btn-primary px-5 py-2 text-xs font-bold text-white rounded-xl shadow-md disabled:opacity-40 transition-all"
                >
                  {savingConfig ? 'Saving Configuration...' : '💾 Save Configuration'}
                </button>
                <input
                  type="file"
                  ref={pdfFileInputRef}
                  onChange={handlePdfUpload}
                  accept=".pdf,application/pdf"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => pdfFileInputRef.current?.click()}
                  disabled={uploadingPdf}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  {uploadingPdf ? 'Uploading PDF...' : '📤 Upload Problem Statement PDF'}
                </button>
                {pdfInfo.fileName && !uploadingPdf && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full flex items-center gap-1">
                    ✓ {pdfInfo.fileName}
                  </span>
                )}
              </div>
            </div>

            {/* Problem Statements Cards List */}
            <div className="space-y-4">
              {psList.map((ps, idx) => (
                <div key={ps.id || idx} className="bg-white/60 dark:bg-slate-900/60 p-4 rounded-xl border border-pastel-lavender/20 space-y-3 relative group transition-all hover:border-cyan-500/30 shadow-sm">
                  <div className="flex justify-between items-center pb-2 border-b border-pastel-lavender/10">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
                        Problem Statement #{idx + 1} ({ps.code || `PS${String(idx + 1).padStart(2, '0')}`})
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                        {ps.allocatedCount || 0} / {ps.maxCapacity || 5} Slots Allocated
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveProblemStatement(idx)}
                      className="px-2.5 py-1 text-red-500 hover:bg-red-500/10 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                      title="Remove Problem Statement"
                    >
                      <span>🗑 Remove</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">

                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">
                        PS Code
                      </label>
                      <input
                        type="text"
                        value={ps.code || `PS${String(idx + 1).padStart(2, '0')}`}
                        onChange={(e) => handlePsChange(idx, 'code', e.target.value)}
                        placeholder="e.g. PS01"
                        className="w-full bg-white dark:bg-slate-800 border border-pastel-lavender/30 rounded-xl px-3 py-2 text-xs text-text-primary font-bold focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div className="md:col-span-7">
                      <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">
                        Title / Name
                      </label>
                      <input
                        type="text"
                        value={ps.title}
                        onChange={(e) => handlePsChange(idx, 'title', e.target.value)}
                        placeholder="e.g. AI-Based Traffic Optimization"
                        className="w-full bg-white dark:bg-slate-800 border border-pastel-lavender/30 rounded-xl px-3 py-2 text-xs text-text-primary font-semibold focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">
                        Slots / Capacity
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={ps.maxCapacity ?? 5}
                        onChange={(e) => handlePsChange(idx, 'maxCapacity', Math.max(1, parseInt(e.target.value) || 1))}
                        placeholder="e.g. 5"
                        className="w-full bg-white dark:bg-slate-800 border border-pastel-lavender/30 rounded-xl px-3 py-2 text-xs text-text-primary font-bold focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div className="md:col-span-12">
                      <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">
                        Description (Guidelines & Specifications)
                      </label>
                      <textarea
                        rows="2"
                        value={ps.description || ''}
                        onChange={(e) => handlePsChange(idx, 'description', e.target.value)}
                        placeholder="Enter problem statement guidelines, detailed description, or instructions..."
                        className="w-full bg-white dark:bg-slate-800 border border-pastel-lavender/30 rounded-xl px-3 py-2 text-xs text-text-primary font-medium focus:outline-none focus:border-cyan-500 resize-none"
                      />
                    </div>

                  </div>
                </div>
              ))}
            </div>

          </div>

        </div>
      )}

      {/* ================================================== */}
      {/* 4. ALLOCATION OVERVIEW TABLE (ALWAYS VISIBLE)     */}
      {/* ================================================== */}
      <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md rounded-2xl border border-pastel-lavender/20 shadow-soft overflow-hidden space-y-0">

        {/* Table Title Bar */}
        <div className="p-5 border-b border-pastel-lavender/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="font-heading font-bold text-base text-text-primary flex items-center gap-2">
              <span>📋 Allocation Overview</span>
            </h3>
            <p className="text-xs text-text-secondary">
              {psEnabled || venueEnabled
                ? 'Monitor and manage allocations for all confirmed teams and individual participants.'
                : 'Enable an allocation type in settings to start assigning.'}
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <input
              type="text"
              placeholder="Search teams, rooms, or problem statements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-72 bg-white/60 dark:bg-slate-900/60 text-text-primary placeholder-text-secondary border border-pastel-lavender/20 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-cyan-500"
            />
            <span className="text-xs text-text-secondary font-semibold whitespace-nowrap">
              Total Teams: {allocations.length}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center space-y-3">
            <div className="animate-spin w-8 h-8 border-4 border-pastel-lavender border-t-transparent rounded-full mx-auto" />
            <p className="text-xs font-semibold text-text-secondary">Loading allocations...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-400 text-sm font-bold mb-3">{error}</p>
            <button onClick={fetchData} className="btn-primary px-4 py-2 text-xs font-bold rounded-xl text-white">Retry</button>
          </div>
        ) : filteredAllocations.length === 0 ? (
          <div className="p-12 text-center text-text-secondary space-y-2">
            <div className="text-3xl">📌</div>
            <h4 className="font-bold text-text-primary text-base">No Allocations Found</h4>
            <p className="text-xs max-w-sm mx-auto">
              {psEnabled || venueEnabled
                ? 'Teams will appear here once registered. Assign allocations in bulk via Excel or individually per team.'
                : 'Problem statement and venue allocation are currently disabled in settings.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/40 dark:bg-slate-900/40 text-text-secondary text-[10px] font-bold uppercase tracking-wider border-b border-pastel-lavender/20">
                  <th className="px-6 py-4">Team Name</th>
                  {venueEnabled && <th className="px-6 py-4">Venue / Room</th>}
                  {psEnabled && <th className="px-6 py-4">Problem Statement</th>}
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pastel-lavender/10 text-xs font-medium">
                {filteredAllocations.map((team) => (
                  <tr key={team.teamId} className="hover:bg-white/20 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-text-primary">
                      {team.teamName}
                    </td>

                    {/* EDIT ALLOCATION MODE */}
                    {editingTeamId === team.teamId ? (
                      <>
                        {venueEnabled && (
                          <td className="px-6 py-3">
                            <input
                              type="text"
                              value={editForm.venueRoom}
                              onChange={(e) => setEditForm({ ...editForm, venueRoom: e.target.value })}
                              className="w-full bg-white dark:bg-slate-900 border border-cyan-500 rounded-lg px-2.5 py-1 text-xs text-text-primary focus:outline-none"
                              placeholder="e.g. Room 101"
                            />
                          </td>
                        )}
                        {psEnabled && (
                          <td className="px-6 py-3">
                            {psList.length > 0 ? (
                              <select
                                value={editForm.problemStatement}
                                onChange={(e) => {
                                  const selectedPsTitle = e.target.value;
                                  const matchedPs = psList.find(p => p.title === selectedPsTitle);
                                  setEditForm({
                                    ...editForm,
                                    problemStatement: selectedPsTitle,
                                    venueRoom: (venueEnabled && matchedPs?.venueRoom) ? matchedPs.venueRoom : editForm.venueRoom
                                  });
                                }}
                                className="w-full bg-white dark:bg-slate-900 border border-cyan-500 rounded-lg px-2.5 py-1 text-xs text-text-primary focus:outline-none"
                              >
                                <option value="">-- Select Problem Statement --</option>
                                {psList.map((p, i) => (
                                  <option key={p.id || i} value={p.title}>{p.title}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={editForm.problemStatement}
                                onChange={(e) => setEditForm({ ...editForm, problemStatement: e.target.value })}
                                className="w-full bg-white dark:bg-slate-900 border border-cyan-500 rounded-lg px-2.5 py-1 text-xs text-text-primary focus:outline-none"
                                placeholder="e.g. AI System Design"
                              />
                            )}
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-500">Editing</span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => handleSaveInlineEdit(team.teamId)}
                            className="px-3 py-1 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 transition text-[10px]"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingTeamId(null)}
                            className="px-3 py-1 bg-slate-500/20 text-text-secondary font-bold rounded-lg hover:bg-slate-500/30 transition text-[10px]"
                          >
                            Cancel
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        {venueEnabled && (
                          <td className="px-6 py-4 font-bold text-cyan-600 dark:text-cyan-400">
                            {team.venueRoom && team.venueRoom.trim() ? `📍 ${team.venueRoom.trim()}` : <span className="text-amber-500 font-semibold">Yet to assign</span>}
                          </td>
                        )}
                        {psEnabled && (
                          <td className="px-6 py-4 text-text-primary max-w-sm truncate">
                            {team.problemStatement ? `📌 ${team.problemStatementCode ? `[${team.problemStatementCode}] ` : ''}${team.problemStatement}` : <span className="text-text-secondary italic">Not assigned</span>}
                          </td>
                        )}
                        <td className="px-6 py-4">
                          {team.isAllocated ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                              Allocation Assigned
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border bg-amber-500/10 text-amber-500 border-amber-500/20">
                              Pending Selection
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => {
                              setEditingTeamId(team.teamId);
                              setEditForm({ venueRoom: team.venueRoom || '', problemStatement: team.problemStatement || '' });
                            }}
                            className="px-3 py-1 bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 rounded-lg font-bold hover:bg-cyan-500/20 transition text-[10px]"
                          >
                            Edit
                          </button>
                          {team.isAllocated && (
                            <button
                              onClick={() => handleClearAllocation(team.teamId)}
                              className="px-3 py-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg font-bold hover:bg-red-500/20 transition text-[10px]"
                              title="Remove allocation"
                            >
                              Clear
                            </button>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default TeamAllocation;
