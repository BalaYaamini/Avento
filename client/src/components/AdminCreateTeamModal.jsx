import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from './Modal';

const AdminCreateTeamModal = ({ isOpen, onClose, events = [], preSelectedEventId = '', onSuccess }) => {
  const [selectedEventId, setSelectedEventId] = useState(preSelectedEventId || '');
  const [teamName, setTeamName] = useState('');
  const [leaderId, setLeaderId] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [eligibleStudents, setEligibleStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (preSelectedEventId) {
      setSelectedEventId(preSelectedEventId);
    } else if (events.length > 0 && !selectedEventId) {
      const teamEvt = events.find(e => e.registration_type === 'team');
      if (teamEvt) setSelectedEventId(teamEvt._id || teamEvt.id);
    }
  }, [preSelectedEventId, events]);

  useEffect(() => {
    if (!isOpen || !selectedEventId) {
      setEligibleStudents([]);
      return;
    }

    const fetchEligibleStudents = async () => {
      try {
        setLoadingStudents(true);
        setFeedback(null);
        const res = await axios.get(`/api/registrations/admin/event/${selectedEventId}/eligible-students`);
        setEligibleStudents(res.data || []);
      } catch (err) {
        console.error(err);
        setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to fetch eligible students.' });
      } finally {
        setLoadingStudents(false);
      }
    };

    fetchEligibleStudents();
    setLeaderId('');
    setSelectedMemberIds([]);
  }, [isOpen, selectedEventId]);

  const handleToggleMember = (studentId) => {
    setSelectedMemberIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEventId || !teamName.trim() || !leaderId) {
      setFeedback({ type: 'error', message: 'Please select an event, enter a team name, and select a team leader.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      await axios.post('/api/registrations/admin/team', {
        eventId: selectedEventId,
        teamName: teamName.trim(),
        leaderId,
        memberIds: selectedMemberIds
      });

      alert('Team manually created by Admin successfully!');
      setTeamName('');
      setLeaderId('');
      setSelectedMemberIds([]);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to create team.' });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedEvent = events.find(e => (e._id || e.id) === selectedEventId);
  const teamEvents = events.filter(e => e.registration_type === 'team');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manually Create Team (Admin)"
      subtitle="Create a team registration directly. Organizers for this event cannot be added."
    >
      {feedback && (
        <div className={`mb-4 p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
          feedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-red-500/10 border-red-500/20 text-red-600'
        }`}>
          <span>{feedback.type === 'success' ? '✓' : '⚠'}</span>
          <span>{feedback.message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Event Selection */}
        {!preSelectedEventId && (
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Select Event *</label>
            <select
              required
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full bg-white/60 text-slate-800 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-violet-500"
            >
              <option value="">-- Choose Team Event --</option>
              {teamEvents.map(evt => (
                <option key={evt._id || evt.id} value={evt._id || evt.id}>
                  {evt.title} ({evt.min_team_size || 1}-{evt.max_team_size || 4} members)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Team Name */}
        <div>
          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Team Name *</label>
          <input
            type="text"
            required
            placeholder="e.g. Admin Designated Team Alpha"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className="w-full bg-white/60 text-slate-800 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-violet-500"
          />
        </div>

        {/* Team Leader Select */}
        <div>
          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Select Team Leader * (Excludes Event Organizers)</label>
          {loadingStudents ? (
            <p className="text-xs text-slate-500 italic">Loading eligible non-organizer students...</p>
          ) : (
            <select
              required
              value={leaderId}
              onChange={(e) => {
                const newLeader = e.target.value;
                setLeaderId(newLeader);
                setSelectedMemberIds(prev => prev.filter(id => id !== newLeader));
              }}
              className="w-full bg-white/60 text-slate-800 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-violet-500"
            >
              <option value="">-- Choose Team Leader --</option>
              {eligibleStudents.map(student => (
                <option key={student.id} value={student.id}>
                  {student.fullName || student.name} ({student.email} - {student.department || 'N/A'})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Team Members Multi-Select */}
        {leaderId && (
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Select Additional Team Members ({selectedMemberIds.length + 1} total member{selectedMemberIds.length + 1 === 1 ? '' : 's'})
            </label>
            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50/50 space-y-1.5">
              {eligibleStudents.filter(s => String(s.id) !== String(leaderId)).map(student => {
                const isChecked = selectedMemberIds.includes(student.id);
                return (
                  <label
                    key={student.id}
                    className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                      isChecked ? 'bg-violet-50 border-violet-300 text-violet-900 font-bold' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleMember(student.id)}
                        className="rounded text-violet-600 focus:ring-violet-500"
                      />
                      <span>{student.fullName || student.name} ({student.roll_number || student.email})</span>
                    </div>
                    <span className="text-[10px] text-slate-400">{student.department || 'N/A'}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !leaderId || !teamName.trim()}
            className="px-5 py-2 text-xs font-bold rounded-xl btn-primary text-white disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Team'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AdminCreateTeamModal;
