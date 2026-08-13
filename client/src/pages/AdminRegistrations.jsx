import { useState, useEffect } from 'react';
import axios from 'axios';
import AdminCreateTeamModal from '../components/AdminCreateTeamModal';
import * as XLSX from 'xlsx';

const AdminRegistrations = () => {
  const [registrations, setRegistrations] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Modal states
  const [selectedEventId, setSelectedEventId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [cancellingId, setCancellingId] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [regsRes, eventsRes] = await Promise.all([
        axios.get('/api/registrations/all'),
        axios.get('/api/events')
      ]);

      setRegistrations(regsRes.data);
      setEvents(eventsRes.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch registration lists.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCancelRegistration = async (regId, studentName, eventTitle) => {
    if (!window.confirm(`Are you sure you want to cancel ${studentName}'s registration for: "${eventTitle}"?`)) {
      return;
    }

    setCancellingId(regId);
    try {
      await axios.delete(`/api/registrations/${regId}`);
      setRegistrations(prev => prev.filter(reg => (reg.id || reg._id) !== regId));
      alert('Registration successfully revoked.');
    } catch (err) {
      console.error(err);
      alert('Failed to cancel registration.');
    } finally {
      setCancellingId(null);
    }
  };

  const handleCancelTeamRegistration = async (teamId, teamName) => {
    if (!window.confirm(`Are you sure you want to cancel/revoke the entire team registration for "${teamName}"?`)) {
      return;
    }

    setProcessingId(teamId);
    try {
      await axios.delete(`/api/registrations/admin/team/${teamId}`);
      setRegistrations(prev => prev.filter(reg => reg.teamId?.id !== teamId && reg.team_id !== teamId));
      alert(`Team "${teamName}" registration successfully cancelled by Admin.`);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to cancel team registration.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveRequest = async (regId, studentName) => {
    if (!window.confirm(`Approve team request for student "${studentName}"?`)) {
      return;
    }

    setProcessingId(regId);
    try {
      await axios.post(`/api/registrations/admin/approve-request/${regId}`);
      setRegistrations(prev => prev.map(reg => (reg.id || reg._id) === regId ? { ...reg, status: 'registered' } : reg));
      alert('Student team request approved successfully.');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to approve student team request.');
    } finally {
      setProcessingId(null);
    }
  };

  const handlePaymentStatus = async (registrationId, paymentStatus) => {
    const rejectionReason = paymentStatus === 'rejected'
      ? window.prompt('Enter the reason for rejecting this UTR:')
      : undefined;
    if (paymentStatus === 'rejected' && !rejectionReason?.trim()) return;
    try {
      await axios.put(`/api/registrations/${registrationId}/payment-status`, { paymentStatus, rejectionReason });
      setRegistrations(prev => prev.map(reg => (reg.id || reg._id) === registrationId ? { ...reg, payment_status: paymentStatus } : reg));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update payment status.');
    }
  };

  const exportRegistrations = () => {
    const rows = filteredRegistrations.map(reg => ({
      Event: reg.eventId?.title || '',
      Team: reg.teamId?.name || 'Individual',
      'Team Leader': reg.teamId?.leader_id === reg.user_id ? 'Yes' : 'No',
      'Contact Number': reg.teamId?.leader_contact_number || 'N/A',
      'Student Name': reg.userId?.name || reg.userId?.fullName || '',
      Email: reg.userId?.email || '',
      Department: reg.userId?.department || '',
      'Roll Number': reg.userId?.roll_number || '',
      'Registration Status': reg.status || '',
      UTR: reg.utr_number || '',
      'Payment Status': reg.payment_status || 'Not required',
      'Rejection Reason': reg.payment_rejection_reason || '',
      'Verified At': reg.payment_verified_at || '',
      'Registered On': reg.created_at || reg.registrationDate || ''
    }));
    if (!rows.length) return alert('There are no registrations to export.');
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = Object.keys(rows[0]).map(key => ({ wch: Math.max(key.length + 2, 18) }));
    const teams = Object.values(filteredRegistrations.reduce((result, reg) => {
      if (!reg.teamId) return result;
      const id = reg.team_id;
      const leader = reg.teamId.leader_id === reg.user_id;
      if (!result[id]) result[id] = { Event: reg.eventId?.title || '', Team: reg.teamId.name, 'Team Status': reg.teamId.status, 'Contact Number': reg.teamId.leader_contact_number || 'N/A', UTR: leader ? (reg.utr_number || '') : '', 'Payment Status': leader ? (reg.payment_status || '') : '', 'Rejection Reason': leader ? (reg.payment_rejection_reason || '') : '' };
      return result;
    }, {}));
    const pending = rows.filter(row => ['submitted', 'rejected'].includes(row['Payment Status']));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Teams and UTR');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(teams), 'Teams');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(pending), 'Payment Review');
    XLSX.writeFile(workbook, 'avento-teams-utr.xlsx');
  };

  // Filter registrations list dynamically
  const filteredRegistrations = registrations.filter(reg => {
    const evt = reg.eventId;
    const usr = reg.userId;
    if (!evt || !usr) return false;

    const regEventId = evt.id || evt._id;
    const matchesEvent = selectedEventId ? String(regEventId) === String(selectedEventId) : true;

    const query = searchQuery.toLowerCase();
    const studentName = (usr.name || usr.fullName || '').toLowerCase();
    const matchesSearch = searchQuery
      ? studentName.includes(query) || (usr.email || '').toLowerCase().includes(query) || (evt.title || '').toLowerCase().includes(query)
      : true;

    return matchesEvent && matchesSearch;
  });

  return (
    <div className="flex-grow py-20 text-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-10 animate-fade-in-up flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="font-display text-3xl font-black text-text-primary">Event <span className="heading-gradient">Registrations</span></h1>
            <p className="font-body text-slate-600 text-sm mt-1.5">Review student roster bookings, approve team requests, or create teams manually</p>
          </div>
          <button
            onClick={() => setIsCreateTeamOpen(true)}
            className="btn-primary px-5 py-2.5 text-xs font-bold rounded-xl text-white flex items-center gap-2 shadow-lg shadow-violet-500/15"
          >
            <span>+</span>
            <span>Create Team Manually</span>
          </button>
          {selectedEventId && events.find(evt => String(evt.id || evt._id) === String(selectedEventId))?.payment_enabled && (
            <button
              onClick={exportRegistrations}
              className="btn-secondary px-5 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2"
            >
              Export Teams &amp; UTR
            </button>
          )}
        </div>

        {selectedEventId && events.find(evt => String(evt.id || evt._id) === String(selectedEventId))?.payment_enabled && (() => {
          const eventRegs = registrations.filter(reg => String(reg.event_id || reg.eventId?.id) === String(selectedEventId));
          const counts = eventRegs.reduce((acc, reg) => { const status = reg.payment_status || 'pending'; acc[status] = (acc[status] || 0) + 1; return acc; }, {});
          return <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-xl bg-amber-50 p-3 text-center"><b>{counts.pending || 0}</b><div className="text-[10px] uppercase">Pending</div></div><div className="rounded-xl bg-blue-50 p-3 text-center"><b>{counts.submitted || 0}</b><div className="text-[10px] uppercase">Submitted</div></div><div className="rounded-xl bg-emerald-50 p-3 text-center"><b>{counts.verified || 0}</b><div className="text-[10px] uppercase">Verified</div></div><div className="rounded-xl bg-red-50 p-3 text-center"><b>{counts.rejected || 0}</b><div className="text-[10px] uppercase">Rejected</div></div></div>;
        })()}

        {/* Filters Panel */}
        <div className="animate-fade-in-up delay-100 glass-panel rounded-2xl p-5 sm:p-6 mb-10 flex flex-col md:flex-row items-center gap-5 justify-between">
          
          {/* Event Filter dropdown */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] whitespace-nowrap">Filter Event</label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="bg-white/60 text-slate-700 border border-slate-300/50 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:border-violet-500/60 transition-all duration-300 w-full md:w-64 cursor-pointer"
            >
              <option value="">All Events</option>
              {events.map(evt => (
                <option key={evt._id || evt.id} value={evt._id || evt.id}>{evt.title}</option>
              ))}
            </select>
          </div>

          {/* Student Search */}
          <div className="relative w-full md:w-80 group">
            <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-600 group-focus-within:text-violet-400 transition-colors duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search student or event..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/60 text-slate-800 placeholder-slate-600 border border-slate-300/50 rounded-xl py-2.5 pl-11 pr-4 text-sm font-medium focus:outline-none focus:border-violet-500/60 transition-all duration-300"
            />
          </div>

        </div>

        {/* Loading / Error / Roster Table */}
        {loading ? (
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="p-6 space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-14 bg-white/20 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-20 animate-fade-in-up">
            <p className="text-red-400 font-bold mb-3">{error}</p>
            <button onClick={fetchData} className="btn-primary px-6 py-2.5 text-sm font-bold rounded-xl text-white">Retry</button>
          </div>
        ) : filteredRegistrations.length === 0 ? (
          <div className="text-center py-24 glass-panel rounded-2xl animate-fade-in-scale">
            <div className="h-20 w-20 bg-white/50 rounded-2xl flex items-center justify-center mx-auto text-slate-600 mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-xl font-display font-bold text-slate-800 mb-2">No Bookings Found</h3>
            <p className="text-sm font-body text-slate-600">There are no student registrations matching your search filters.</p>
          </div>
        ) : (
          <div className="animate-fade-in-up delay-200 glass-panel rounded-2xl overflow-hidden shadow-2xl shadow-violet-500/3">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/40 border-b border-slate-200/40 text-slate-600 text-[10px] font-bold uppercase tracking-[0.1em]">
                    <th className="px-6 py-4">Student Name</th>
                    <th className="px-6 py-4">Student Email</th>
                    <th className="px-6 py-4">Team</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Registered Event</th>
                    <th className="px-6 py-4">Booking Date</th>
                    <th className="px-6 py-4">Payment / UTR</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30 text-sm font-body">
                  {filteredRegistrations.map((reg, i) => (
                    <tr 
                      key={reg.id || reg._id} 
                      className="hover:bg-white/20 transition-all duration-300 animate-fade-in-up"
                      style={{ animationDelay: `${i * 40 + 250}ms` }}
                    >
                      <td className="px-6 py-4 font-display font-bold text-slate-800">
                        {reg.userId.name || reg.userId.fullName}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-600 text-xs">
                        {reg.userId.email}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-600 text-xs">
                        {reg.teamId ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-slate-700">{reg.teamId.name}</span>
                            {reg.teamId.leader_id === (reg.userId.id || reg.userId._id) ? (
                              <span className="text-[9px] text-fuchsia-500 uppercase tracking-wider font-bold">Leader</span>
                            ) : (
                              <span className="text-[9px] text-slate-400 uppercase tracking-wider">Member</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">Individual</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium text-xs">
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-lg border ${
                          reg.status === 'registered' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                          reg.status === 'pending' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                          'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {reg.status || 'registered'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-700 line-clamp-1 text-xs">
                        {reg.eventId.title}
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-xs">
                        {new Date(reg.registrationDate || reg.createdAt || reg.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        {reg.utr_number ? <><div className="font-bold text-slate-700">{reg.utr_number}</div><div className="uppercase text-slate-500">{reg.payment_status}</div>{reg.payment_status === 'submitted' && <div className="mt-1 flex gap-1"><button onClick={() => handlePaymentStatus(reg.id || reg._id, 'verified')} className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white">Verify</button><button onClick={() => handlePaymentStatus(reg.id || reg._id, 'rejected')} className="rounded bg-red-600 px-2 py-1 text-[10px] font-bold text-white">Reject</button></div>}</> : 'Not required'}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                        {reg.status === 'pending' && (
                          <button
                            onClick={() => handleApproveRequest(reg.id || reg._id, reg.userId.name || reg.userId.fullName)}
                            disabled={processingId === (reg.id || reg._id)}
                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all duration-300 disabled:opacity-50"
                          >
                            {processingId === (reg.id || reg._id) ? 'Approving...' : 'Approve Request'}
                          </button>
                        )}
                        {reg.teamId && (
                          <button
                            onClick={() => handleCancelTeamRegistration(reg.teamId.id || reg.teamId._id || reg.team_id, reg.teamId.name)}
                            disabled={processingId === (reg.teamId.id || reg.teamId._id || reg.team_id)}
                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500/10 text-amber-600 border border-amber-500/20 hover:bg-amber-500/20 transition-all duration-300 disabled:opacity-50"
                          >
                            Cancel Team
                          </button>
                        )}
                        <button
                          onClick={() => handleCancelRegistration(reg.id || reg._id, reg.userId.name || reg.userId.fullName, reg.eventId.title)}
                          disabled={cancellingId === (reg.id || reg._id)}
                          className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-500/8 text-red-400 border border-red-500/15 hover:bg-red-500/15 transition-all duration-300 disabled:opacity-50"
                        >
                          {cancellingId === (reg.id || reg._id) ? 'Revoking...' : 'Revoke Booking'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <AdminCreateTeamModal
          isOpen={isCreateTeamOpen}
          onClose={() => setIsCreateTeamOpen(false)}
          events={events}
          selectedEventId={selectedEventId}
          onSuccess={fetchData}
        />

      </div>
    </div>
  );
};

export default AdminRegistrations;
