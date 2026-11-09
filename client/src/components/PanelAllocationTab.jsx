import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { supabase } from '../context/AuthContext';
import Modal from './Modal';

const PanelAllocationTab = ({ eventId, event, user, hasFullAccess }) => {
  // Data
  const [panels, setPanels] = useState([]);
  const [unassignedRegistrations, setUnassignedRegistrations] = useState([]);
  const [summary, setSummary] = useState(null);
  const [memberCandidates, setMemberCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filter & Search State
  const [selectedPanelFilter, setSelectedPanelFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Add / Edit Panel Modal State
  const [isPanelModalOpen, setIsPanelModalOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState(null);
  const [panelFormData, setPanelFormData] = useState({
    name: '',
    venue_room: '',
    max_capacity: '',
    member_user_ids: []
  });
  const [memberSearch, setMemberSearch] = useState('');
  const [panelFormSubmitting, setPanelFormSubmitting] = useState(false);
  const [panelFormError, setPanelFormError] = useState('');

  // Assign Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignPanelId, setAssignPanelId] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState('');

  // Auto-Distribute Modal State
  const [isAutoDistOpen, setIsAutoDistOpen] = useState(false);
  const [autoDistSubmitting, setAutoDistSubmitting] = useState(false);

  // Delete Confirmation State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [panelToDelete, setPanelToDelete] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Unassign All State
  const [isUnassignAllOpen, setIsUnassignAllOpen] = useState(false);
  const [unassignAllSubmitting, setUnassignAllSubmitting] = useState(false);

  // Bulk Import Modal State
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importPreviewValid, setImportPreviewValid] = useState(false);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [importError, setImportError] = useState('');
  const importFileRef = useRef(null);

  const fetchOverview = async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
        setError('');
      }
      const res = await axios.get(`/api/panels/event/${eventId}/overview`);
      setPanels(res.data.panels || []);
      setUnassignedRegistrations(res.data.unassignedRegistrations || []);
      setSummary(res.data.summary || null);
    } catch (err) {
      console.error('Error fetching panel overview:', err);
      if (!silent) setError(err.response?.data?.message || 'Failed to load panel allocation overview.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchMemberCandidates = async () => {
    try {
      const res = await axios.get(`/api/panels/event/${eventId}/members`);
      setMemberCandidates(res.data.members || []);
    } catch (err) {
      console.error('Error fetching panel member candidates:', err);
    }
  };

  useEffect(() => {
    if (eventId) {
      fetchOverview();
      fetchMemberCandidates();
    }
  }, [eventId]);

  // Live updates: any panel, member or assignment change refreshes the overview
  useEffect(() => {
    if (!eventId) return undefined;

    const channel = supabase
      .channel(`live-panels-${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_panels', filter: `event_id=eq.${eventId}` },
        () => fetchOverview({ silent: true })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'panel_assignments', filter: `event_id=eq.${eventId}` },
        () => fetchOverview({ silent: true })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'panel_members' },
        () => fetchOverview({ silent: true })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  // Flat student list: assigned (with panel info) + unassigned
  const allStudents = useMemo(() => {
    const assigned = panels.flatMap(p =>
      (p.assignments || []).map(a => ({
        ...a.student,
        panel_id: p.id,
        panel_name: p.name,
        panel_venue: p.venue_room || ''
      }))
    );
    const unassigned = unassignedRegistrations.map(s => ({
      ...s,
      panel_id: null,
      panel_name: '',
      panel_venue: ''
    }));
    return [...assigned, ...unassigned];
  }, [panels, unassignedRegistrations]);

  const filteredStudents = useMemo(() => {
    let list = allStudents;

    if (selectedPanelFilter === 'unassigned') {
      list = list.filter(s => !s.panel_id);
    } else if (selectedPanelFilter !== 'all') {
      list = list.filter(s => s.panel_id === selectedPanelFilter);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(s =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.roll_number && s.roll_number.toLowerCase().includes(q)) ||
        (s.department && s.department.toLowerCase().includes(q)) ||
        (s.team_name && s.team_name.toLowerCase().includes(q)) ||
        (s.slot_name && s.slot_name.toLowerCase().includes(q)) ||
        (s.panel_name && s.panel_name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [allStudents, selectedPanelFilter, searchTerm]);

  // ---------- Panel CRUD ----------

  const handleOpenAddPanel = () => {
    setEditingPanel(null);
    setPanelFormData({ name: '', venue_room: '', max_capacity: '', member_user_ids: [] });
    setMemberSearch('');
    setPanelFormError('');
    setIsPanelModalOpen(true);
  };

  const handleOpenEditPanel = (panel) => {
    setEditingPanel(panel);
    setPanelFormData({
      name: panel.name || '',
      venue_room: panel.venue_room || '',
      max_capacity: panel.max_capacity == null ? '' : panel.max_capacity,
      member_user_ids: (panel.members || []).map(m => m.user_id)
    });
    setMemberSearch('');
    setPanelFormError('');
    setIsPanelModalOpen(true);
  };

  const togglePanelMember = (userId) => {
    setPanelFormData(prev => ({
      ...prev,
      member_user_ids: prev.member_user_ids.includes(userId)
        ? prev.member_user_ids.filter(id => id !== userId)
        : [...prev.member_user_ids, userId]
    }));
  };

  const handleSavePanel = async (e) => {
    e.preventDefault();
    if (!panelFormData.name.trim()) {
      setPanelFormError('Panel name is required.');
      return;
    }

    setPanelFormSubmitting(true);
    setPanelFormError('');

    try {
      const payload = {
        name: panelFormData.name.trim(),
        venue_room: panelFormData.venue_room.trim(),
        max_capacity: panelFormData.max_capacity === '' ? null : parseInt(panelFormData.max_capacity, 10),
        member_user_ids: panelFormData.member_user_ids
      };

      if (editingPanel) {
        await axios.put(`/api/panels/event/${eventId}/panel/${editingPanel.id}`, payload);
        setSuccessMessage(`Panel "${payload.name}" updated successfully.`);
      } else {
        await axios.post(`/api/panels/event/${eventId}`, payload);
        setSuccessMessage(`Panel "${payload.name}" created successfully.`);
      }

      setIsPanelModalOpen(false);
      fetchOverview();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      console.error('Error saving panel:', err);
      setPanelFormError(err.response?.data?.message || 'Failed to save panel.');
    } finally {
      setPanelFormSubmitting(false);
    }
  };

  const handleDeletePanel = async () => {
    if (!panelToDelete) return;
    setDeleteSubmitting(true);
    try {
      await axios.delete(`/api/panels/event/${eventId}/panel/${panelToDelete.id}?force=true`);
      setSuccessMessage(`Panel "${panelToDelete.name}" deleted.`);
      setIsDeleteModalOpen(false);
      setPanelToDelete(null);
      fetchOverview();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete panel.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // ---------- Assignment ----------

  const handleOpenAssign = (student) => {
    setAssignTarget(student);
    setAssignPanelId(student.panel_id || '');
    setAssignError('');
    setIsAssignModalOpen(true);
  };

  const handleConfirmAssign = async (e) => {
    e.preventDefault();
    if (!assignTarget) return;

    setAssignSubmitting(true);
    setAssignError('');

    try {
      await axios.post(`/api/panels/event/${eventId}/assign`, {
        assignments: [{ registrationId: assignTarget.registration_id, panelId: assignPanelId || null }]
      });
      setSuccessMessage(assignPanelId
        ? `${assignTarget.name} assigned to a panel.`
        : `${assignTarget.name} unassigned from their panel.`);
      setIsAssignModalOpen(false);
      setAssignTarget(null);
      fetchOverview();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      console.error('Error assigning student:', err);
      setAssignError(err.response?.data?.message || 'Failed to update panel assignment.');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleUnassign = async (student) => {
    try {
      await axios.post(`/api/panels/event/${eventId}/assign`, {
        assignments: [{ registrationId: student.registration_id, panelId: null }]
      });
      setSuccessMessage(`${student.name} unassigned from their panel.`);
      fetchOverview();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to unassign student.');
    }
  };

  const handleAutoDistribute = async () => {
    setAutoDistSubmitting(true);
    try {
      const res = await axios.post(`/api/panels/event/${eventId}/auto-distribute`, {});
      setSuccessMessage(res.data.message || 'Students auto-distributed across panels.');
      setIsAutoDistOpen(false);
      fetchOverview();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to auto-distribute students.');
    } finally {
      setAutoDistSubmitting(false);
    }
  };

  const handleUnassignAll = async () => {
    setUnassignAllSubmitting(true);
    try {
      const res = await axios.delete(`/api/panels/event/${eventId}/assignments`);
      setSuccessMessage(res.data.message || 'All students unassigned from their panels.');
      setIsUnassignAllOpen(false);
      fetchOverview();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to unassign students.');
    } finally {
      setUnassignAllSubmitting(false);
    }
  };

  // ---------- Bulk Import (XLSX) ----------

  const handleDownloadTemplate = () => {
    const rows = allStudents.map(s => ({
      'Roll Number': s.roll_number || '',
      'Email': s.email || '',
      'Student Name': s.name || '',
      'Panel Name': ''
    }));

    if (rows.length === 0) {
      setImportError('No registered students found for this event to generate a template.');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Panel Assignments');
    const filename = `${(event?.title || 'Event').replace(/[^a-zA-Z0-9]/g, '_')}_Panel_Allocation_Template.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportError('');
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!jsonRows || jsonRows.length === 0) {
          setImportError('Uploaded file contains no rows.');
          return;
        }

        const panelByName = new Map(panels.map(p => [String(p.name || '').trim().toLowerCase(), p]));
        const studentByRoll = new Map(allStudents.map(s => [String(s.roll_number || '').trim().toLowerCase(), s]));
        const studentByEmail = new Map(allStudents.map(s => [String(s.email || '').trim().toLowerCase(), s]));
        const seenRegs = new Set();
        let allRowsValid = true;

        const preview = jsonRows.map((row, index) => {
          const rollNo = String(row['Roll Number'] || row['Roll No'] || row['roll_number'] || '').trim();
          const email = String(row['Email'] || row['email'] || '').trim();
          const panelName = String(row['Panel Name'] || row['Panel'] || row['panel_name'] || '').trim();

          let rowStatus = 'Valid';
          let errorMessage = '';

          const student = (rollNo && studentByRoll.get(rollNo.toLowerCase())) ||
            (email && studentByEmail.get(email.toLowerCase())) || null;
          const panel = panelName ? panelByName.get(panelName.toLowerCase()) : null;

          if (!student) {
            rowStatus = 'Invalid';
            errorMessage = `Student not found for this event: ${rollNo || email || 'Row ' + (index + 1)}`;
            allRowsValid = false;
          } else if (!panelName) {
            rowStatus = 'Invalid';
            errorMessage = `Panel Name is missing for: ${student.name}`;
            allRowsValid = false;
          } else if (!panel) {
            rowStatus = 'Invalid';
            errorMessage = `Panel not found: "${panelName}". Create the panel first.`;
            allRowsValid = false;
          } else if (seenRegs.has(student.registration_id)) {
            rowStatus = 'Invalid';
            errorMessage = `Duplicate row for: ${student.name}`;
            allRowsValid = false;
          } else {
            seenRegs.add(student.registration_id);
          }

          return {
            registrationId: student ? student.registration_id : null,
            studentName: student ? student.name : (rollNo || email || 'Row ' + (index + 1)),
            rollNumber: student ? student.roll_number : rollNo,
            panelId: panel ? panel.id : null,
            panelName: panel ? panel.name : panelName,
            status: rowStatus,
            error: errorMessage
          };
        });

        setImportPreview(preview);
        setImportPreviewValid(allRowsValid);
      } catch (err) {
        console.error('Import parse error:', err);
        setImportError('Error reading file. Please upload a valid .xlsx, .xls, or .csv file.');
      }
    };

    reader.readAsArrayBuffer(file);
    e.target.value = null;
  };

  const handleConfirmImport = async () => {
    if (!importPreview || importPreview.length === 0 || !importPreviewValid) return;

    setImportSubmitting(true);
    setImportError('');

    try {
      await axios.post(`/api/panels/event/${eventId}/assign`, {
        assignments: importPreview.map(r => ({ registrationId: r.registrationId, panelId: r.panelId }))
      });
      setSuccessMessage(`Imported ${importPreview.length} panel assignment(s) successfully.`);
      setIsImportOpen(false);
      setImportPreview(null);
      fetchOverview();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      console.error('Error importing assignments:', err);
      setImportError(err.response?.data?.message || 'Failed to import panel assignments.');
    } finally {
      setImportSubmitting(false);
    }
  };

  // ---------- Export CSV ----------

  const handleExportCSV = () => {
    const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateCell = (value) => {
      const raw = String(value == null ? '' : value);
      if (!raw) return '';
      const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? `="${m[3]}-${monthShort[Number(m[2]) - 1]}-${m[1]}"` : `="${raw}"`;
    };
    const rows = [
      ['Student Name', 'Email', 'Roll Number', 'Department', 'Team', 'Slot', 'Slot Date', 'Slot Time', 'Panel', 'Panel Venue', 'Panel Members', 'Registered On']
    ];

    allStudents.forEach(s => {
      const panel = panels.find(p => p.id === s.panel_id);
      rows.push([
        s.name || '',
        s.email || '',
        s.roll_number || '',
        s.department || '',
        s.team_name || '',
        s.slot_name || '',
        dateCell(s.slot_date),
        s.slot_time || '',
        s.panel_name || 'Unassigned',
        s.panel_venue || '',
        panel ? (panel.members || []).map(m => m.name).join('; ') : '',
        s.registered_at ? new Date(s.registered_at).toLocaleDateString() : ''
      ]);
    });

    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(event?.title || 'Event').replace(/[^a-zA-Z0-9]/g, '_')}_Panel_Allocations.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ---------- Render helpers ----------

  const renderPanelCard = (panel) => {
    const memberNames = (panel.members || []).map(m => m.name);

    return (
      <div
        key={panel.id}
        className={`p-5 rounded-2xl border transition-all duration-200 relative flex flex-col justify-between ${
          panel.status === 'active'
            ? 'glass-panel bg-white/70 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm hover:shadow-md'
            : 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-800/70 opacity-80'
        }`}
      >
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                  {panel.name}
                </span>
                {panel.status !== 'active' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500 border border-slate-500/20 shrink-0">
                    Inactive
                  </span>
                )}
                {panel.is_full ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
                    Full
                  </span>
                ) : panel.max_capacity != null ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                    {panel.seats_left} Left
                  </span>
                ) : null}
              </div>

              {panel.venue_room && (
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1.5 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{panel.venue_room}</span>
                </div>
              )}
            </div>

            {hasFullAccess && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpenEditPanel(panel)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition cursor-pointer"
                  title="Edit Panel"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPanelToDelete(panel);
                    setIsDeleteModalOpen(true);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                  title="Delete Panel"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Panel members */}
          <div className="mt-3">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Panel Members
            </div>
            {memberNames.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {memberNames.map(n => (
                  <span key={n} className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50">
                    {n}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 mt-1.5">No members yet</div>
            )}
          </div>
        </div>

        {/* Assigned count bar */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center justify-between text-xs font-bold mb-1.5">
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">Students Assigned</span>
            <span className="text-slate-800 dark:text-white text-[11px]">
              {panel.assigned_count}{panel.max_capacity != null ? ` / ${panel.max_capacity}` : ''}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                panel.is_full
                  ? 'bg-rose-500'
                  : 'bg-gradient-to-r from-indigo-500 to-fuchsia-500'
              }`}
              style={{
                width: `${panel.max_capacity ? Math.min(100, Math.round((panel.assigned_count / panel.max_capacity) * 100)) : Math.min(100, panel.assigned_count * 10)}%`
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Alerts */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-medium text-xs sm:text-sm flex items-center gap-3 animate-fadeIn shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="flex-1 font-semibold">{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 font-medium text-xs sm:text-sm flex items-center gap-3 shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="flex-1 font-semibold">{error}</span>
        </div>
      )}

      {/* Header and Quick Stats */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm relative overflow-hidden bg-white/70 dark:bg-slate-900/60 backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Panel Allocation
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                Create interview or judging panels, add panel members, and assign students to panels.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCSV}
              className="h-10 px-4 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition cursor-pointer shadow-sm inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>

            {hasFullAccess && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setImportPreview(null);
                    setImportError('');
                    setIsImportOpen(true);
                  }}
                  className="h-10 px-4 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition cursor-pointer border border-indigo-200/60 dark:border-indigo-800/60 shadow-sm inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Bulk Import
                </button>

                <button
                  type="button"
                  onClick={() => setIsAutoDistOpen(true)}
                  className="h-10 px-4 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition cursor-pointer border border-indigo-200/60 dark:border-indigo-800/60 shadow-sm inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                  Auto-Distribute
                </button>

                <button
                  type="button"
                  onClick={() => setIsUnassignAllOpen(true)}
                  disabled={(summary?.total_assigned || 0) === 0}
                  className="h-10 px-4 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition cursor-pointer border border-rose-200/60 dark:border-rose-800/60 shadow-sm inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM5 13a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM17 8l4 4m0-4l-4 4" />
                  </svg>
                  Unassign All
                </button>

                <button
                  type="button"
                  onClick={handleOpenAddPanel}
                  className="h-10 px-5 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-700 hover:to-fuchsia-700 transition cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95 inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Panel
                </button>
              </>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {[
            { label: 'Panels', value: summary?.total_panels || 0 },
            { label: 'Assigned', value: summary?.total_assigned || 0 },
            { label: 'Unassigned', value: summary?.total_unassigned || 0 },
            { label: 'Panel Members', value: summary?.total_panel_members || 0 }
          ].map(stat => (
            <div key={stat.label} className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{stat.label}</div>
              <div className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5">{stat.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Panels Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 animate-pulse bg-white/40 dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mx-auto mb-3" />
          <span className="text-xs font-medium">Loading panels and student assignments...</span>
        </div>
      ) : panels.length === 0 ? (
        <div className="glass-panel p-10 text-center rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/40">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 mx-auto flex items-center justify-center mb-3.5 shadow-sm">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h4 className="text-base font-extrabold text-slate-800 dark:text-white">No Panels Created Yet</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
            Create your first interview or judging panel, add its members, then assign students to it.
          </p>
          {hasFullAccess && (
            <button
              type="button"
              onClick={handleOpenAddPanel}
              className="h-9 px-4.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95 inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Create First Panel</span>
            </button>
          )}
        </div>
      ) : (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Panels
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {panels.length}
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-400">
              Click a panel filter below to see its assigned students
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
            {panels.map(renderPanelCard)}
          </div>
        </div>
      )}

      {/* Student Roster Table */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Student Panel Roster
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
                {filteredStudents.length} Students
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Every registered student, with their panel assignment
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
            {/* Panel Filter Dropdown */}
            <div className="relative min-w-[160px] sm:min-w-[200px] flex-1 sm:flex-none">
              <select
                value={selectedPanelFilter}
                onChange={(e) => setSelectedPanelFilter(e.target.value)}
                className="w-full h-10 pl-3 pr-8 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer shadow-sm appearance-none"
              >
                <option value="all">All Students ({allStudents.length})</option>
                {panels.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} - {p.assigned_count} assigned
                  </option>
                ))}
                <option value="unassigned">Unassigned ({unassignedRegistrations.length})</option>
              </select>
              <svg className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[180px] sm:w-64 flex-1 sm:flex-none">
              <input
                type="text"
                placeholder="Search name, roll no, slot, panel..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 pl-9 pr-3.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm placeholder:text-slate-400"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-800/80 text-slate-500 font-extrabold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4.5">Participant / Student</th>
                <th className="py-3.5 px-4">Roll No & Dept</th>
                <th className="py-3.5 px-4">Team</th>
                <th className="py-3.5 px-4">Slot (Date / Time)</th>
                <th className="py-3.5 px-4">Assigned Panel</th>
                <th className="py-3.5 px-4">Panel Venue</th>
                {hasFullAccess && <th className="py-3.5 px-4.5 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={hasFullAccess ? 7 : 6} className="py-12 text-center text-slate-400">
                    <div className="max-w-xs mx-auto space-y-1">
                      <p className="font-semibold text-slate-600 dark:text-slate-300">No matching students found</p>
                      <p className="text-[11px] text-slate-400">Try adjusting your panel filter or search</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.registration_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4.5 align-middle">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {student.name}
                      </div>
                      <div className="text-[11px] text-slate-400">{student.email}</div>
                    </td>

                    <td className="py-3 px-4 align-middle">
                      <div className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                        {student.roll_number || '-'}
                      </div>
                      <div className="text-[11px] text-slate-400">{student.department || '-'}</div>
                    </td>

                    <td className="py-3 px-4 align-middle">
                      {student.team_name ? (
                        <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-lg border border-indigo-200/50 dark:border-indigo-800/50">
                          {student.team_name}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Individual</span>
                      )}
                    </td>

                    <td className="py-3 px-4 align-middle">
                      {student.slot_id ? (
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {student.slot_name}
                          </span>
                          <div className="text-[11px] text-slate-400">
                            {student.slot_date ? `${new Date(student.slot_date).toLocaleDateString()} - ` : ''}{student.slot_time}
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold text-[11px] bg-amber-50 dark:bg-amber-950/30 px-2.5 py-0.5 rounded-lg border border-amber-200/50 dark:border-amber-800/50">
                          No Slot
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 align-middle">
                      {student.panel_id ? (
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {student.panel_name}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold text-[11px] bg-amber-50 dark:bg-amber-950/30 px-2.5 py-0.5 rounded-lg border border-amber-200/50 dark:border-amber-800/50">
                          No Panel Assigned
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 align-middle text-slate-600 dark:text-slate-400">
                      {student.panel_venue || '-'}
                    </td>

                    {hasFullAccess && (
                      <td className="py-3 px-4.5 text-right align-middle">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenAssign(student)}
                            className="h-8 px-3 rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition cursor-pointer border border-indigo-200/60 dark:border-indigo-800/60 shadow-sm"
                          >
                            {student.panel_id ? 'Reassign' : 'Assign'}
                          </button>
                          {student.panel_id && (
                            <button
                              type="button"
                              onClick={() => handleUnassign(student)}
                              className="h-8 px-3 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition cursor-pointer border border-rose-200/60 dark:border-rose-800/60 shadow-sm"
                            >
                              Unassign
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Panel Modal */}
      <Modal
        isOpen={isPanelModalOpen}
        onClose={() => setIsPanelModalOpen(false)}
        title={editingPanel ? 'Edit Panel' : 'Create New Panel'}
      >
        <form onSubmit={handleSavePanel} className="space-y-4">
          {panelFormError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-bold">
              {panelFormError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Panel Name *
            </label>
            <input
              type="text"
              value={panelFormData.name}
              onChange={(e) => setPanelFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Panel A, Interview Panel 1"
              className="w-full h-10 px-3.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Venue / Room
              </label>
              <input
                type="text"
                value={panelFormData.venue_room}
                onChange={(e) => setPanelFormData(prev => ({ ...prev, venue_room: e.target.value }))}
                placeholder="e.g. Block C, Room 204"
                className="w-full h-10 px-3.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Max Students (optional)
              </label>
              <input
                type="number"
                min="1"
                value={panelFormData.max_capacity}
                onChange={(e) => setPanelFormData(prev => ({ ...prev, max_capacity: e.target.value }))}
                placeholder="Unlimited"
                className="w-full h-10 px-3.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {/* Panel members picker */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Panel Members (judges / interviewers)
              </label>
              <span className="text-[10px] font-bold text-slate-400">
                {panelFormData.member_user_ids.length} selected
              </span>
            </div>
            <input
              type="text"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search members..."
              className="w-full h-9 px-3.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 mb-2"
            />
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80 p-2">
              {memberCandidates
                .filter(m => {
                  const q = memberSearch.trim().toLowerCase();
                  if (!q) return true;
                  return (m.name || '').toLowerCase().includes(q) ||
                    (m.email || '').toLowerCase().includes(q) ||
                    (m.department || '').toLowerCase().includes(q);
                })
                .map(m => {
                  const isSelected = panelFormData.member_user_ids.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition ${
                        isSelected
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePanelMember(m.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{m.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{m.email}{m.department ? ` - ${m.department}` : ''}</div>
                      </div>
                      {m.role && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                          {m.role.replace('_', ' ')}
                        </span>
                      )}
                    </label>
                  );
                })}
              {memberCandidates.length === 0 && (
                <div className="text-[11px] text-slate-400 text-center py-3">No faculty or organizers found</div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsPanelModalOpen(false)}
              className="h-10 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={panelFormSubmitting}
              className="h-10 px-5 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50 shadow-sm shadow-indigo-500/20"
            >
              {panelFormSubmitting ? 'Saving...' : (editingPanel ? 'Save Changes' : 'Create Panel')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign / Reassign Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={assignTarget?.panel_id ? 'Reassign Student to Panel' : 'Assign Student to Panel'}
      >
        <form onSubmit={handleConfirmAssign} className="space-y-4">
          {assignError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-bold">
              {assignError}
            </div>
          )}

          {assignTarget && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs">
              <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider block">Student:</span>
              <div className="font-extrabold text-sm text-slate-900 dark:text-white mt-0.5">
                {assignTarget.name}
              </div>
              <div className="text-slate-500 mt-0.5">
                {assignTarget.roll_number}{assignTarget.department ? ` - ${assignTarget.department}` : ''}{assignTarget.email ? ` - ${assignTarget.email}` : ''}
              </div>
              {assignTarget.slot_name && (
                <div className="text-slate-500 mt-0.5">
                  Slot: <span className="font-bold text-slate-700 dark:text-slate-300">
                    {assignTarget.slot_name}{assignTarget.slot_date ? ` - ${new Date(assignTarget.slot_date).toLocaleDateString()}` : ''}{assignTarget.slot_time ? ` - ${assignTarget.slot_time}` : ''}
                  </span>
                </div>
              )}
              {assignTarget.panel_name && (
                <div className="text-slate-500 mt-0.5">
                  Currently in: <span className="font-bold text-slate-700 dark:text-slate-300">{assignTarget.panel_name}</span>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Select Panel *
            </label>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {panels.map(p => {
                const isSelected = assignPanelId === p.id;

                return (
                  <div
                    key={p.id}
                    onClick={() => setAssignPanelId(p.id)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-100 font-bold ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold">{p.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        p.is_full ? 'bg-rose-500/10 text-rose-600' : 'bg-emerald-500/10 text-emerald-600'
                      }`}>
                        {p.max_capacity != null ? `${p.seats_left} / ${p.max_capacity} Left` : `${p.assigned_count} assigned`}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {p.venue_room || 'No venue'}{(p.members || []).length > 0 ? ` - ${p.members.length} member(s)` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {assignTarget?.panel_id && (
            <button
              type="button"
              onClick={() => setAssignPanelId('')}
              className={`w-full p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                !assignPanelId
                  ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 ring-2 ring-amber-500/20'
                  : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:border-amber-300 dark:hover:border-amber-700'
              }`}
            >
              No panel (unassign from current panel)
            </button>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAssignModalOpen(false)}
              className="h-10 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={assignSubmitting || (assignTarget?.panel_id ? false : !assignPanelId)}
              className="h-10 px-5 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50 shadow-sm shadow-indigo-500/20"
            >
              {assignSubmitting ? 'Saving...' : 'Confirm Assignment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Auto-Distribute Confirmation Modal */}
      <Modal
        isOpen={isAutoDistOpen}
        onClose={() => setIsAutoDistOpen(false)}
        title="Auto-Distribute Students"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            This will distribute all <strong className="text-slate-900 dark:text-white">{summary?.total_unassigned || 0} unassigned student(s)</strong> across
            the <strong className="text-slate-900 dark:text-white">{summary?.active_panels || 0} active panel(s)</strong>, following strict scheduling rules:
            no panel or shared panel member is ever double-booked at the same interview time (based on each student's slot date &amp; time),
            and each panel's max capacity is respected. Existing assignments are kept as-is.
            Students with no free panel at their time are left unassigned and you will be notified.
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAutoDistOpen(false)}
              className="h-10 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAutoDistribute}
              disabled={autoDistSubmitting}
              className="h-10 px-5 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50 shadow-sm shadow-indigo-500/20"
            >
              {autoDistSubmitting ? 'Distributing...' : 'Auto-Distribute'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Unassign All Confirmation Modal */}
      <Modal
        isOpen={isUnassignAllOpen}
        onClose={() => setIsUnassignAllOpen(false)}
        title="Unassign All Students"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Are you sure you want to unassign <strong className="text-slate-900 dark:text-white">all {summary?.total_assigned || 0} assigned student(s)</strong> from their panels?
            Panels and panel members are kept. You can re-assign students manually or with Auto-Distribute afterwards.
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsUnassignAllOpen(false)}
              className="h-10 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUnassignAll}
              disabled={unassignAllSubmitting}
              className="h-10 px-5 rounded-xl text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer disabled:opacity-50 shadow-sm shadow-rose-500/20"
            >
              {unassignAllSubmitting ? 'Unassigning...' : 'Unassign All'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Panel"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Are you sure you want to delete <strong className="text-slate-900 dark:text-white">"{panelToDelete?.name}"</strong>?
            {panelToDelete?.assigned_count > 0 && (
              <> Its <strong>{panelToDelete.assigned_count} assigned student(s)</strong> will become unassigned.</>
            )}
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              className="h-10 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeletePanel}
              disabled={deleteSubmitting}
              className="h-10 px-5 rounded-xl text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer disabled:opacity-50 shadow-sm shadow-rose-500/20"
            >
              {deleteSubmitting ? 'Deleting...' : 'Delete Panel'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk Import Modal */}
      <Modal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        title="Bulk Import Panel Assignments"
      >
        <div className="space-y-4">
          {importError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-bold">
              {importError}
            </div>
          )}

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Download the template, fill in the <strong>Panel Name</strong> for each student, and upload it back.
            Panels must already exist (create them first). Students are matched by roll number or email.
          </p>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="h-10 px-4 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition cursor-pointer border border-indigo-200/60 dark:border-indigo-800/60 shadow-sm inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" />
              </svg>
              Download Template
            </button>

            <label className="h-10 px-4 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition cursor-pointer shadow-sm inline-flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload File
              <input
                ref={importFileRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleImportFile}
                className="hidden"
              />
            </label>
          </div>

          {importPreview && (
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden">
              <div className={`px-4 py-2.5 text-[11px] font-bold ${importPreviewValid ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                {importPreviewValid
                  ? `${importPreview.length} row(s) ready to import`
                  : 'Some rows are invalid - fix the file and re-upload'}
              </div>
              <div className="max-h-56 overflow-auto">
                <table className="w-full min-w-[520px] text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-50/90 dark:bg-slate-800/80 text-slate-500 font-extrabold uppercase tracking-wider text-[9px]">
                      <th className="py-2 px-3">Student</th>
                      <th className="py-2 px-3">Roll No</th>
                      <th className="py-2 px-3">Panel</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {importPreview.map((r, i) => (
                      <tr key={i}>
                        <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">{r.studentName}</td>
                        <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-400">{r.rollNumber || '-'}</td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{r.panelName || '-'}</td>
                        <td className="py-2 px-3">
                          {r.status === 'Valid' ? (
                            <span className="font-bold text-emerald-600">Valid</span>
                          ) : (
                            <span className="font-bold text-rose-600" title={r.error}>Invalid</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsImportOpen(false)}
              className="h-10 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={importSubmitting || !importPreview || !importPreviewValid}
              className="h-10 px-5 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50 shadow-sm shadow-indigo-500/20"
            >
              {importSubmitting ? 'Importing...' : 'Confirm Import'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PanelAllocationTab;
