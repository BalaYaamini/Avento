import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

const TeamAllocation = ({ eventId, eventTitle }) => {
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

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

  const fetchAllocations = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`/api/allocations/event/${eventId}`);
      setAllocations(res.data);
    } catch (err) {
      console.error('Error fetching allocations:', err);
      setError(err.response?.data?.message || 'Failed to load team allocations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId) {
      fetchAllocations();
    }
  }, [eventId]);

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
      XLSX.utils.book_append_sheet(wb, ws, 'Team Allocations');
      const filename = `${(eventTitle || 'Event').replace(/[^a-zA-Z0-9]/g, '_')}_Team_Allocation_Template.xlsx`;
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

        // Validate rows against valid teams in current allocations list
        const validTeamMap = new Map(allocations.map(a => [a.teamId, a.teamName]));
        const seenTeams = new Set();
        let allRowsValid = true;

        const parsedPreview = jsonRows.map((row, index) => {
          // Normalize column headers
          const teamId = String(row['Team ID'] || row['teamId'] || row['TeamId'] || row['team_id'] || '').trim();
          const teamName = String(row['Team Name'] || row['teamName'] || row['TeamName'] || row['team_name'] || 'Row ' + (index + 1)).trim();
          const venueRoom = String(row['Venue / Room'] || row['Venue/Room'] || row['Venue'] || row['Room'] || row['venueRoom'] || '').trim();
          const problemStatement = String(row['Problem Statement'] || row['ProblemStatement'] || row['Problem'] || row['problemStatement'] || '').trim();

          let rowStatus = 'Valid';
          let errorMessage = '';

          if (!teamId || !validTeamMap.has(teamId)) {
            rowStatus = 'Invalid';
            errorMessage = `Team not found for this event: ${teamName} (${teamId || 'No ID'})`;
            allRowsValid = false;
          } else if (!venueRoom) {
            rowStatus = 'Invalid';
            errorMessage = `Venue / Room is missing for team: ${teamName}`;
            allRowsValid = false;
          } else if (!problemStatement) {
            rowStatus = 'Invalid';
            errorMessage = `Problem Statement is missing for team: ${teamName}`;
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
    e.target.value = null; // Reset input
  };

  // 3. Save Previewed Allocations
  const handleSavePreview = async () => {
    if (!previewData || previewData.length === 0 || !previewValid) return;

    setSaving(true);
    setStatusMessage(null);
    try {
      const payload = previewData.map(p => ({
        teamId: p.teamId,
        teamName: p.teamName,
        venueRoom: p.venueRoom,
        problemStatement: p.problemStatement
      }));

      const res = await axios.post(`/api/allocations/event/${eventId}`, { allocations: payload });
      setStatusMessage({ type: 'success', text: res.data.message || 'Allocations saved successfully!' });
      setPreviewData(null);
      fetchAllocations();
    } catch (err) {
      console.error('Save allocations error:', err);
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save team allocations.' });
    } finally {
      setSaving(false);
    }
  };

  // 4. Inline Edit Save
  const handleSaveInlineEdit = async (teamId) => {
    if (!editForm.venueRoom.trim() || !editForm.problemStatement.trim()) {
      setStatusMessage({ type: 'error', text: 'Venue / Room and Problem Statement must not be empty.' });
      return;
    }

    try {
      await axios.post(`/api/allocations/event/${eventId}`, {
        allocations: [{
          teamId,
          venueRoom: editForm.venueRoom.trim(),
          problemStatement: editForm.problemStatement.trim()
        }]
      });
      setEditingTeamId(null);
      setStatusMessage({ type: 'success', text: 'Allocation updated.' });
      fetchAllocations();
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update allocation.' });
    }
  };

  const filteredAllocations = allocations.filter(a => {
    const q = searchQuery.toLowerCase();
    return a.teamName.toLowerCase().includes(q) ||
           a.venueRoom.toLowerCase().includes(q) ||
           a.problemStatement.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md rounded-2xl p-6 border border-pastel-lavender/20 shadow-soft flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-bold text-text-primary">Team <span className="text-violet-500">Allocation</span></h2>
          <p className="text-text-secondary text-xs mt-1">Assign Venue / Room numbers and Problem Statements to confirmed event teams.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleDownloadTemplate}
            className="px-4 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold hover:bg-emerald-500/20 transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Template
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary px-4 py-2 text-xs font-bold rounded-xl text-white flex items-center gap-2 shadow-md"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload Allocation
          </button>
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

      {/* Upload Preview Section */}
      {previewData && (
        <div className="bg-white/80 dark:bg-slate-900/80 border-2 border-violet-500/30 rounded-2xl p-6 shadow-xl space-y-4 animate-fade-in-scale">
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
                {saving ? 'Saving Allocations...' : 'Save Allocations'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-80 overflow-y-auto scrollbar-thin">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/40 dark:bg-slate-800/40 text-text-secondary text-[10px] font-bold uppercase tracking-wider border-b border-pastel-lavender/20">
                  <th className="px-4 py-3">Team Name</th>
                  <th className="px-4 py-3">Venue / Room</th>
                  <th className="px-4 py-3">Problem Statement</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pastel-lavender/10 text-xs">
                {previewData.map((row, idx) => (
                  <tr key={idx} className={row.status === 'Valid' ? 'hover:bg-emerald-500/5' : 'bg-red-500/5 hover:bg-red-500/10'}>
                    <td className="px-4 py-3 font-bold text-text-primary">{row.teamName}</td>
                    <td className="px-4 py-3 font-semibold text-text-primary">{row.venueRoom || '—'}</td>
                    <td className="px-4 py-3 text-text-secondary max-w-xs truncate">{row.problemStatement || '—'}</td>
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

      {/* Main Allocation Table */}
      <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md rounded-2xl border border-pastel-lavender/20 shadow-soft overflow-hidden">
        
        {/* Search Bar */}
        <div className="p-4 border-b border-pastel-lavender/20 flex justify-between items-center">
          <input
            type="text"
            placeholder="Search teams, venue rooms, or problem statements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-80 bg-white/60 dark:bg-slate-900/60 text-text-primary placeholder-text-secondary border border-pastel-lavender/20 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-violet-500"
          />
          <span className="text-xs text-text-secondary font-semibold pl-3 whitespace-nowrap">
            Total Teams: {allocations.length}
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center space-y-3">
            <div className="animate-spin w-8 h-8 border-4 border-pastel-lavender border-t-transparent rounded-full mx-auto" />
            <p className="text-xs font-semibold text-text-secondary">Loading team allocations...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-400 text-sm font-bold mb-3">{error}</p>
            <button onClick={fetchAllocations} className="btn-primary px-4 py-2 text-xs font-bold rounded-xl text-white">Retry</button>
          </div>
        ) : filteredAllocations.length === 0 ? (
          <div className="p-12 text-center text-text-secondary space-y-2">
            <div className="text-3xl">📌</div>
            <h4 className="font-bold text-text-primary text-base">No Allocations Found</h4>
            <p className="text-xs max-w-sm mx-auto">Upload an Excel allocation file or download the template to assign venues and problem statements to confirmed teams.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/40 dark:bg-slate-900/40 text-text-secondary text-[10px] font-bold uppercase tracking-wider border-b border-pastel-lavender/20">
                  <th className="px-6 py-4">Team Name</th>
                  <th className="px-6 py-4">Venue / Room</th>
                  <th className="px-6 py-4">Problem Statement</th>
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

                    {editingTeamId === team.teamId ? (
                      <>
                        <td className="px-6 py-3">
                          <input
                            type="text"
                            value={editForm.venueRoom}
                            onChange={(e) => setEditForm({ ...editForm, venueRoom: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-violet-500 rounded-lg px-2.5 py-1 text-xs text-text-primary focus:outline-none"
                            placeholder="e.g. Room 101"
                          />
                        </td>
                        <td className="px-6 py-3">
                          <input
                            type="text"
                            value={editForm.problemStatement}
                            onChange={(e) => setEditForm({ ...editForm, problemStatement: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-violet-500 rounded-lg px-2.5 py-1 text-xs text-text-primary focus:outline-none"
                            placeholder="e.g. AI System Design"
                          />
                        </td>
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
                        <td className="px-6 py-4 font-bold text-violet-600 dark:text-violet-400">
                          {team.venueRoom ? `📍 ${team.venueRoom}` : <span className="text-text-secondary italic">Not assigned</span>}
                        </td>
                        <td className="px-6 py-4 text-text-primary max-w-sm truncate">
                          {team.problemStatement ? `📌 ${team.problemStatement}` : <span className="text-text-secondary italic">Not assigned</span>}
                        </td>
                        <td className="px-6 py-4">
                          {team.isAllocated ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                              Allocated
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border bg-amber-500/10 text-amber-500 border-amber-500/20">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => {
                              setEditingTeamId(team.teamId);
                              setEditForm({ venueRoom: team.venueRoom || '', problemStatement: team.problemStatement || '' });
                            }}
                            className="px-3 py-1 bg-violet-500/10 text-violet-500 border border-violet-500/20 rounded-lg font-bold hover:bg-violet-500/20 transition text-[10px]"
                          >
                            Edit
                          </button>
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
