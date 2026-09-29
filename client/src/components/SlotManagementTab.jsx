import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Modal from './Modal';

const SlotManagementTab = ({ eventId, event, user, hasFullAccess }) => {
  const [slots, setSlots] = useState([]);
  const [registrationsBySlot, setRegistrationsBySlot] = useState({});
  const [unassignedRegistrations, setUnassignedRegistrations] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filter & Search State
  const [selectedSlotFilter, setSelectedSlotFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState('all');

  // Add / Edit Slot Modal State
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [slotFormData, setSlotFormData] = useState({
    slot_name: '',
    slot_date: '',
    start_time: '',
    end_time: '',
    venue_room: '',
    max_capacity: 20
  });
  const [slotFormSubmitting, setSlotFormSubmitting] = useState(false);
  const [slotFormError, setSlotFormError] = useState('');

  // Quick Slot Generator Modal State
  const [isQuickGenOpen, setIsQuickGenOpen] = useState(false);
  const [quickGenData, setQuickGenData] = useState({
    slot_date: '',
    start_hour: 9,
    end_hour: 17,
    duration_minutes: 60,
    break_minutes: 0,
    venue_room: '',
    capacity_per_slot: 20,
    name_prefix: 'Batch'
  });

  // Reassign Modal State
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [reassignTarget, setReassignTarget] = useState(null); // { registration, team, currentSlotId }
  const [targetSlotId, setTargetSlotId] = useState('');
  const [reassignSubmitting, setReassignSubmitting] = useState(false);
  const [reassignError, setReassignError] = useState('');

  // Delete Confirmation State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchSlotOverview = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await axios.get(`/api/slots/event/${eventId}/overview`);
      setSlots(res.data.slots || []);
      setRegistrationsBySlot(res.data.registrationsBySlot || {});
      setUnassignedRegistrations(res.data.unassignedRegistrations || []);
      setSummary(res.data.summary || null);
    } catch (err) {
      console.error('Error fetching slot overview:', err);
      setError(err.response?.data?.message || 'Failed to load time slots overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId) {
      fetchSlotOverview();
    }
  }, [eventId]);

  const handleOpenAddSlot = () => {
    setEditingSlot(null);
    const defaultDate = event?.date ? new Date(event.date).toISOString().split('T')[0] : '';
    setSlotFormData({
      slot_name: `Batch ${slots.length + 1}`,
      slot_date: defaultDate,
      start_time: '09:30',
      end_time: '11:00',
      venue_room: event?.venue || '',
      max_capacity: 20
    });
    setSlotFormError('');
    setIsSlotModalOpen(true);
  };

  const handleOpenEditSlot = (slot) => {
    setEditingSlot(slot);
    setSlotFormData({
      slot_name: slot.slot_name || '',
      slot_date: slot.slot_date ? new Date(slot.slot_date).toISOString().split('T')[0] : '',
      start_time: (slot.start_time || '').substring(0, 5),
      end_time: (slot.end_time || '').substring(0, 5),
      venue_room: slot.venue_room || '',
      max_capacity: slot.max_capacity || 20,
      status: slot.status || 'active'
    });
    setSlotFormError('');
    setIsSlotModalOpen(true);
  };

  const handleSaveSlot = async (e) => {
    e.preventDefault();
    setSlotFormSubmitting(true);
    setSlotFormError('');

    try {
      const payload = {
        slot_name: slotFormData.slot_name.trim(),
        slot_date: slotFormData.slot_date || null,
        start_time: slotFormData.start_time.trim(),
        end_time: slotFormData.end_time.trim(),
        venue_room: slotFormData.venue_room.trim(),
        max_capacity: parseInt(slotFormData.max_capacity, 10)
      };

      if (editingSlot) {
        payload.status = slotFormData.status || editingSlot.status;
        await axios.put(`/api/slots/event/${eventId}/slot/${editingSlot.id}`, payload);
        setSuccessMessage(`Slot "${payload.slot_name}" updated successfully.`);
      } else {
        await axios.post(`/api/slots/event/${eventId}`, payload);
        setSuccessMessage(`Slot "${payload.slot_name}" created successfully.`);
      }

      setIsSlotModalOpen(false);
      fetchSlotOverview();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      console.error('Error saving slot:', err);
      setSlotFormError(err.response?.data?.message || 'Failed to save slot.');
    } finally {
      setSlotFormSubmitting(false);
    }
  };

  const handleQuickGenerate = async (e) => {
    e.preventDefault();
    setSlotFormSubmitting(true);
    setSlotFormError('');

    try {
      const generated = [];
      const startMin = quickGenData.start_hour * 60;
      const endMin = quickGenData.end_hour * 60;
      const duration = parseInt(quickGenData.duration_minutes, 10) || 60;
      const breakTime = parseInt(quickGenData.break_minutes, 10) || 0;

      let currentMin = startMin;
      let count = 1;

      while (currentMin + duration <= endMin) {
        const slotStartH = Math.floor(currentMin / 60);
        const slotStartM = currentMin % 60;
        const slotEndH = Math.floor((currentMin + duration) / 60);
        const slotEndM = (currentMin + duration) % 60;

        const formatTime = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

        generated.push({
          slot_name: `${quickGenData.name_prefix} ${count}`,
          slot_date: quickGenData.slot_date || null,
          start_time: formatTime(slotStartH, slotStartM),
          end_time: formatTime(slotEndH, slotEndM),
          venue_room: quickGenData.venue_room,
          max_capacity: parseInt(quickGenData.capacity_per_slot, 10) || 20
        });

        currentMin += duration + breakTime;
        count++;
      }

      if (generated.length === 0) {
        setSlotFormError('No slots generated with the selected time window.');
        setSlotFormSubmitting(false);
        return;
      }

      await axios.post(`/api/slots/event/${eventId}/bulk`, { slots: generated });
      setSuccessMessage(`Generated ${generated.length} time slots successfully.`);
      setIsQuickGenOpen(false);
      fetchSlotOverview();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      console.error('Error quick generating slots:', err);
      setSlotFormError(err.response?.data?.message || 'Failed to generate slots.');
    } finally {
      setSlotFormSubmitting(false);
    }
  };

  const handleDeleteSlot = async () => {
    if (!slotToDelete) return;
    setDeleteSubmitting(true);
    try {
      await axios.delete(`/api/slots/event/${eventId}/slot/${slotToDelete.id}?force=true`);
      setSuccessMessage(`Slot "${slotToDelete.slot_name}" deleted.`);
      setIsDeleteModalOpen(false);
      setSlotToDelete(null);
      fetchSlotOverview();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete slot.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleOpenReassign = (reg) => {
    setReassignTarget(reg);
    const currentId = reg.slot_id || reg.event_teams?.slot_id || '';
    setTargetSlotId('');
    setReassignError('');
    setIsReassignModalOpen(true);
  };

  const handleConfirmReassign = async (e) => {
    e.preventDefault();
    if (!targetSlotId) {
      setReassignError('Please select a target slot.');
      return;
    }

    setReassignSubmitting(true);
    setReassignError('');

    try {
      const payload = {
        targetSlotId
      };

      if (reassignTarget.team_id) {
        payload.teamId = reassignTarget.team_id;
      } else {
        payload.registrationId = reassignTarget.id;
      }

      await axios.put(`/api/slots/event/${eventId}/reassign`, payload);
      setSuccessMessage('Participant successfully reassigned to new slot.');
      setIsReassignModalOpen(false);
      setReassignTarget(null);
      fetchSlotOverview();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      console.error('Error reassigning participant:', err);
      setReassignError(err.response?.data?.message || 'Failed to reassign slot.');
    } finally {
      setReassignSubmitting(false);
    }
  };

  // Export Slot Attendees to CSV
  const handleExportCSV = () => {
    let rows = [
      ['Slot Name', 'Date', 'Timing', 'Venue / Room', 'Student Name', 'Email', 'Roll Number', 'Department', 'Team Name', 'Attendance Status']
    ];

    slots.forEach(slot => {
      const regs = registrationsBySlot[slot.id] || [];
      const timing = `${(slot.start_time || '').substring(0, 5)} - ${(slot.end_time || '').substring(0, 5)}`;
      const dateStr = slot.slot_date ? new Date(slot.slot_date).toLocaleDateString() : 'N/A';

      if (regs.length === 0) {
        rows.push([slot.slot_name, dateStr, timing, slot.venue_room || 'N/A', '(No registrations yet)', '', '', '', '', '']);
      } else {
        regs.forEach(r => {
          const profile = r.profiles || r.userId || {};
          const team = r.event_teams || r.teamId || {};
          rows.push([
            slot.slot_name,
            dateStr,
            timing,
            slot.venue_room || 'N/A',
            profile.name || profile.fullName || 'Unknown',
            profile.email || '',
            profile.roll_number || '',
            profile.department || '',
            team.name || (event?.registration_type === 'team' ? 'Team' : 'Individual'),
            r.attendance_status || r.status || 'Registered'
          ]);
        });
      }
    });

    if (unassignedRegistrations.length > 0) {
      unassignedRegistrations.forEach(r => {
        const profile = r.profiles || r.userId || {};
        const team = r.event_teams || r.teamId || {};
        rows.push([
          'Unassigned (No Slot)',
          'N/A',
          'N/A',
          'N/A',
          profile.name || profile.fullName || 'Unknown',
          profile.email || '',
          profile.roll_number || '',
          profile.department || '',
          team.name || 'Individual',
          r.attendance_status || r.status || 'Registered'
        ]);
      });
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${(event?.title || 'event').replace(/\s+/g, '_')}_Slots_Roster.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered registrations list
  const filteredRegistrations = useMemo(() => {
    let list = [];
    if (selectedSlotFilter === 'all') {
      Object.values(registrationsBySlot).forEach(regs => {
        list.push(...regs);
      });
      list.push(...unassignedRegistrations);
    } else if (selectedSlotFilter === 'unassigned') {
      list = [...unassignedRegistrations];
    } else {
      list = [...(registrationsBySlot[selectedSlotFilter] || [])];
    }

    if (attendanceFilter !== 'all') {
      list = list.filter(r => {
        if (attendanceFilter === 'attended') return r.attendance_status === 'present' || r.status === 'attended';
        if (attendanceFilter === 'absent') return r.attendance_status !== 'present' && r.status !== 'attended';
        return true;
      });
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(r => {
        const p = r.profiles || r.userId || {};
        const t = r.event_teams || r.teamId || {};
        return (
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.fullName && p.fullName.toLowerCase().includes(q)) ||
          (p.email && p.email.toLowerCase().includes(q)) ||
          (p.roll_number && p.roll_number.toLowerCase().includes(q)) ||
          (t.name && t.name.toLowerCase().includes(q)) ||
          (p.department && p.department.toLowerCase().includes(q))
        );
      });
    }

    return list;
  }, [registrationsBySlot, unassignedRegistrations, selectedSlotFilter, attendanceFilter, searchTerm]);

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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="flex-1 font-semibold">{error}</span>
        </div>
      )}

      {/* Header and Quick Stats */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm relative overflow-hidden bg-white/70 dark:bg-slate-900/60 backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-fuchsia-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Slot-Wise Registration & Schedule
                </h2>
                {event?.has_slots && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Slots Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
                Manage batch schedules, monitor slot capacities, and oversee participant assignments in real-time.
              </p>
            </div>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex items-center gap-2.5 flex-wrap self-stretch sm:self-auto justify-start sm:justify-end">
            <button
              type="button"
              onClick={handleExportCSV}
              className="h-10 px-4 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 border border-slate-200/60 dark:border-slate-700/60 transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
            >
              <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Export CSV</span>
            </button>

            {hasFullAccess && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const defaultDate = event?.date ? new Date(event.date).toISOString().split('T')[0] : '';
                    setQuickGenData(prev => ({ ...prev, slot_date: defaultDate, venue_room: event?.venue || '' }));
                    setIsQuickGenOpen(true);
                  }}
                  className="h-10 px-4 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 hover:bg-indigo-100/90 dark:hover:bg-indigo-900/50 transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
                >
                  <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Auto-Gen Batches</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenAddSlot}
                  className="h-10 px-4.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-700 hover:to-indigo-700 shadow-md shadow-fuchsia-500/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add New Slot</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Metrics Grid */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-6 pt-6 border-t border-slate-200/60 dark:border-slate-800/60">
            {/* Metric 1 */}
            <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                  Total Slots
                </span>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {summary.total_slots}
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-slate-200/60 dark:bg-slate-700/50 flex items-center justify-center text-slate-500 dark:text-slate-400">
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>

            {/* Metric 2 */}
            <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                  Total Capacity
                </span>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {summary.total_capacity} <span className="text-xs font-semibold text-slate-400">seats</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-indigo-100/60 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>

            {/* Metric 3 */}
            <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                  Total Booked
                </span>
                <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1 flex items-baseline gap-1.5">
                  <span>{summary.total_allocated}</span>
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                    ({summary.overall_occupancy_rate}%)
                  </span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-purple-100/60 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            {/* Metric 4 */}
            <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                  Available Slots
                </span>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {summary.available_capacity} <span className="text-xs font-semibold text-slate-400">free</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-100/60 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Slots Grid Cards */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Configured Time Slots
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {slots.length}
            </span>
          </div>
          <span className="text-[11px] font-medium text-slate-400">
            Click on any slot to filter the participant roster below
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 animate-pulse bg-white/40 dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mx-auto mb-3" />
            <span className="text-xs font-medium">Loading time slots and enrollment roster...</span>
          </div>
        ) : slots.length === 0 ? (
          <div className="glass-panel p-10 text-center rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/40">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 mx-auto flex items-center justify-center mb-3.5 shadow-sm">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h4 className="text-base font-extrabold text-slate-800 dark:text-white">No Time Slots Created Yet</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
              Add individual time slots or use the auto-generator to divide your event into batches.
            </p>
            {hasFullAccess && (
              <button
                type="button"
                onClick={handleOpenAddSlot}
                className="h-9 px-4.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95 inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Create First Time Slot</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {slots.map(slot => {
              const isSelected = selectedSlotFilter === slot.id;
              const isFull = slot.is_full;
              const slotRegs = registrationsBySlot[slot.id] || [];

              return (
                <div
                  key={slot.id}
                  onClick={() => setSelectedSlotFilter(isSelected ? 'all' : slot.id)}
                  className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer relative flex flex-col justify-between ${
                    isSelected
                      ? 'bg-gradient-to-br from-indigo-50/90 via-white to-fuchsia-50/70 dark:from-indigo-950/40 dark:via-slate-900/80 dark:to-fuchsia-950/30 border-indigo-500 shadow-lg shadow-indigo-500/10 ring-2 ring-indigo-500/20'
                      : 'glass-panel bg-white/70 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm hover:shadow-md'
                  }`}
                >
                  <div>
                    {/* Slot Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                            {slot.slot_name}
                          </span>
                          {isFull ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
                              Full
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                              {slot.slots_remaining} Left
                            </span>
                          )}
                        </div>

                        {/* Time Row */}
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1.5 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>
                            {slot.start_time?.substring(0, 5)} – {slot.end_time?.substring(0, 5)}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      {hasFullAccess && (
                        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleOpenEditSlot(slot)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition"
                            title="Edit Slot"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSlotToDelete(slot);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                            title="Delete Slot"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Slot Details Chips */}
                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-600 dark:text-slate-400 mt-3">
                      {slot.venue_room && (
                        <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800/90 px-2.5 py-1 rounded-lg font-medium border border-slate-200/50 dark:border-slate-700/50">
                          <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          </svg>
                          <span className="truncate max-w-[120px]">{slot.venue_room}</span>
                        </span>
                      )}

                      {slot.slot_date && (
                        <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800/90 px-2.5 py-1 rounded-lg font-medium border border-slate-200/50 dark:border-slate-700/50">
                          <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>{new Date(slot.slot_date).toLocaleDateString()}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Capacity Bar */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                    <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                      <span className="text-slate-500 dark:text-slate-400 text-[11px]">Enrollment</span>
                      <span className="text-slate-800 dark:text-white text-[11px]">
                        {slotRegs.length} / {slot.max_capacity} ({slot.fill_percentage}%)
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isFull
                            ? 'bg-rose-500'
                            : slot.fill_percentage >= 80
                            ? 'bg-amber-500'
                            : 'bg-gradient-to-r from-indigo-500 to-fuchsia-500'
                        }`}
                        style={{ width: `${Math.min(100, slot.fill_percentage)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Participants Table / Roster by Slot */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Slot Participant Roster
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
                {filteredRegistrations.length} Enrolled
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Filtered list of confirmed students and assigned teams
            </p>
          </div>

          {/* Unified Filters Toolbar */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
            {/* Slot Filter Dropdown */}
            <div className="relative min-w-[160px] sm:min-w-[200px] flex-1 sm:flex-none">
              <select
                value={selectedSlotFilter}
                onChange={(e) => setSelectedSlotFilter(e.target.value)}
                className="w-full h-10 pl-3 pr-8 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer shadow-sm appearance-none"
              >
                <option value="all">All Time Slots ({summary?.total_allocated || 0})</option>
                {slots.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.slot_name} ({s.start_time?.substring(0, 5)} - {s.end_time?.substring(0, 5)}) — {(registrationsBySlot[s.id] || []).length} registered
                  </option>
                ))}
                {unassignedRegistrations.length > 0 && (
                  <option value="unassigned">⚠️ Unassigned ({unassignedRegistrations.length})</option>
                )}
              </select>
              <svg className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Attendance Filter */}
            <div className="relative min-w-[130px] sm:min-w-[150px] flex-1 sm:flex-none">
              <select
                value={attendanceFilter}
                onChange={(e) => setAttendanceFilter(e.target.value)}
                className="w-full h-10 pl-3 pr-8 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer shadow-sm appearance-none"
              >
                <option value="all">All Attendance</option>
                <option value="attended">Attended / Present</option>
                <option value="absent">Not Yet Checked In</option>
              </select>
              <svg className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[180px] sm:w-64 flex-1 sm:flex-none">
              <input
                type="text"
                placeholder="Search name, roll no, team..."
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
                <th className="py-3.5 px-4">Assigned Slot</th>
                <th className="py-3.5 px-4">Status</th>
                {hasFullAccess && <th className="py-3.5 px-4.5 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {filteredRegistrations.length === 0 ? (
                <tr>
                  <td colSpan={hasFullAccess ? 6 : 5} className="py-12 text-center text-slate-400">
                    <div className="max-w-xs mx-auto space-y-1">
                      <p className="font-semibold text-slate-600 dark:text-slate-300">No matching participants found</p>
                      <p className="text-[11px] text-slate-400">Try adjusting your slot or attendance filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRegistrations.map((reg) => {
                  const profile = reg.profiles || reg.userId || {};
                  const team = reg.event_teams || reg.teamId || {};
                  const currentSlot = slots.find(s => s.id === (reg.slot_id || reg.slot?.id || team.slot_id || team.slot?.id));
                  const isPresent = reg.attendance_status === 'present' || reg.status === 'attended';

                  return (
                    <tr key={reg.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4.5 align-middle">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {profile.name || profile.fullName || 'Unknown Student'}
                        </div>
                        <div className="text-[11px] text-slate-400">{profile.email}</div>
                      </td>

                      <td className="py-3 px-4 align-middle">
                        <div className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                          {profile.roll_number || '—'}
                        </div>
                        <div className="text-[11px] text-slate-400">{profile.department || '—'}</div>
                      </td>

                      <td className="py-3 px-4 align-middle">
                        {team.name ? (
                          <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-lg border border-indigo-200/50 dark:border-indigo-800/50">
                            {team.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Individual</span>
                        )}
                      </td>

                      <td className="py-3 px-4 align-middle">
                        {currentSlot ? (
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {currentSlot.slot_name}
                            </span>
                            <div className="text-[11px] text-slate-400">
                              {currentSlot.start_time?.substring(0, 5)} - {currentSlot.end_time?.substring(0, 5)}
                              {currentSlot.venue_room && ` • ${currentSlot.venue_room}`}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold text-[11px] bg-amber-50 dark:bg-amber-950/30 px-2.5 py-0.5 rounded-lg border border-amber-200/50 dark:border-amber-800/50">
                            No Slot Assigned
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 align-middle">
                        {isPresent ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Checked In
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200/60 dark:border-slate-700/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            Registered
                          </span>
                        )}
                      </td>

                      {hasFullAccess && (
                        <td className="py-3 px-4.5 text-right align-middle">
                          <button
                            type="button"
                            onClick={() => handleOpenReassign(reg)}
                            className="h-8 px-3 rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition cursor-pointer border border-indigo-200/60 dark:border-indigo-800/60 shadow-sm"
                          >
                            Reassign Slot
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Slot Modal */}
      <Modal
        isOpen={isSlotModalOpen}
        onClose={() => setIsSlotModalOpen(false)}
        title={editingSlot ? 'Edit Time Slot' : 'Create New Time Slot'}
      >
        <form onSubmit={handleSaveSlot} className="space-y-4">
          {slotFormError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-bold">
              {slotFormError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Slot / Batch Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Morning Batch 1, Slot A, Round 1"
              value={slotFormData.slot_name}
              onChange={(e) => setSlotFormData({ ...slotFormData, slot_name: e.target.value })}
              className="w-full h-10 px-3.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Date (Optional)
              </label>
              <input
                type="date"
                value={slotFormData.slot_date}
                onChange={(e) => setSlotFormData({ ...slotFormData, slot_date: e.target.value })}
                className="w-full h-10 px-3.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Room / Venue (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Lab 2, Hall B"
                value={slotFormData.venue_room}
                onChange={(e) => setSlotFormData({ ...slotFormData, venue_room: e.target.value })}
                className="w-full h-10 px-3.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Start Time *
              </label>
              <input
                type="time"
                required
                value={slotFormData.start_time}
                onChange={(e) => setSlotFormData({ ...slotFormData, start_time: e.target.value })}
                className="w-full h-10 px-3 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                End Time *
              </label>
              <input
                type="time"
                required
                value={slotFormData.end_time}
                onChange={(e) => setSlotFormData({ ...slotFormData, end_time: e.target.value })}
                className="w-full h-10 px-3 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Capacity *
              </label>
              <input
                type="number"
                min="1"
                required
                value={slotFormData.max_capacity}
                onChange={(e) => setSlotFormData({ ...slotFormData, max_capacity: e.target.value })}
                className="w-full h-10 px-3 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsSlotModalOpen(false)}
              className="h-10 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={slotFormSubmitting}
              className="h-10 px-5 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50 shadow-sm shadow-indigo-500/20"
            >
              {slotFormSubmitting ? 'Saving...' : editingSlot ? 'Save Changes' : 'Create Slot'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Generator Modal */}
      <Modal
        isOpen={isQuickGenOpen}
        onClose={() => setIsQuickGenOpen(false)}
        title="Auto-Generate Time Slots / Batches"
      >
        <form onSubmit={handleQuickGenerate} className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Quickly generate evenly spaced time slots throughout the day for your event.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Prefix
              </label>
              <input
                type="text"
                value={quickGenData.name_prefix}
                onChange={(e) => setQuickGenData({ ...quickGenData, name_prefix: e.target.value })}
                placeholder="e.g. Batch, Slot"
                className="w-full h-10 px-3.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Date
              </label>
              <input
                type="date"
                value={quickGenData.slot_date}
                onChange={(e) => setQuickGenData({ ...quickGenData, slot_date: e.target.value })}
                className="w-full h-10 px-3.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Start Hour (24h)
              </label>
              <input
                type="number"
                min="0"
                max="23"
                value={quickGenData.start_hour}
                onChange={(e) => setQuickGenData({ ...quickGenData, start_hour: parseInt(e.target.value, 10) })}
                className="w-full h-10 px-3.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                End Hour (24h)
              </label>
              <input
                type="number"
                min="1"
                max="24"
                value={quickGenData.end_hour}
                onChange={(e) => setQuickGenData({ ...quickGenData, end_hour: parseInt(e.target.value, 10) })}
                className="w-full h-10 px-3.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Duration (Minutes)
              </label>
              <input
                type="number"
                min="15"
                step="15"
                value={quickGenData.duration_minutes}
                onChange={(e) => setQuickGenData({ ...quickGenData, duration_minutes: parseInt(e.target.value, 10) })}
                className="w-full h-10 px-3.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Capacity Per Slot
              </label>
              <input
                type="number"
                min="1"
                value={quickGenData.capacity_per_slot}
                onChange={(e) => setQuickGenData({ ...quickGenData, capacity_per_slot: parseInt(e.target.value, 10) })}
                className="w-full h-10 px-3.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsQuickGenOpen(false)}
              className="h-10 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={slotFormSubmitting}
              className="h-10 px-5 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50 shadow-sm shadow-indigo-500/20"
            >
              {slotFormSubmitting ? 'Generating...' : 'Generate Slots'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reassign Slot Modal */}
      <Modal
        isOpen={isReassignModalOpen}
        onClose={() => setIsReassignModalOpen(false)}
        title="Reassign Participant Slot"
      >
        <form onSubmit={handleConfirmReassign} className="space-y-4">
          {reassignError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-bold">
              {reassignError}
            </div>
          )}

          {reassignTarget && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs">
              <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider block">Participant:</span>
              <div className="font-extrabold text-sm text-slate-900 dark:text-white mt-0.5">
                {reassignTarget.profiles?.name || 'Student'}
                {reassignTarget.event_teams?.name && (
                  <span className="ml-2 font-bold text-indigo-500">
                    (Team: {reassignTarget.event_teams.name})
                  </span>
                )}
              </div>
              <div className="text-slate-500 mt-0.5">{reassignTarget.profiles?.email}</div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Select Target Slot *
            </label>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {slots.map(s => {
                const isSelected = targetSlotId === s.id;
                const isFull = s.is_full;

                return (
                  <div
                    key={s.id}
                    onClick={() => setTargetSlotId(s.id)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-100 font-bold ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold">{s.slot_name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isFull ? 'bg-rose-500/10 text-rose-600' : 'bg-emerald-500/10 text-emerald-600'
                      }`}>
                        {s.slots_remaining} / {s.max_capacity} Left
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {s.start_time?.substring(0, 5)} - {s.end_time?.substring(0, 5)}
                      {s.venue_room && ` • ${s.venue_room}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsReassignModalOpen(false)}
              className="h-10 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={reassignSubmitting || !targetSlotId}
              className="h-10 px-5 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50 shadow-sm shadow-indigo-500/20"
            >
              {reassignSubmitting ? 'Reassigning...' : 'Confirm Reassign'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Time Slot"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Are you sure you want to delete <strong className="text-slate-900 dark:text-white">"{slotToDelete?.slot_name}"</strong>?
            Any enrolled participants will be marked as unassigned.
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
              onClick={handleDeleteSlot}
              disabled={deleteSubmitting}
              className="h-10 px-5 rounded-xl text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer disabled:opacity-50 shadow-sm shadow-rose-500/20"
            >
              {deleteSubmitting ? 'Deleting...' : 'Delete Slot'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SlotManagementTab;
