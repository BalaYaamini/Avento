import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

const OrganizerRegistrations = ({ eventId, event }) => {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRegistrations = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`/api/registrations/event/${eventId}`);
      setRegistrations(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load registrations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId) {
      fetchRegistrations();
    }
  }, [eventId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-10">
        <div className="animate-spin w-8 h-8 border-4 border-pastel-lavender border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 text-red-500 font-bold bg-red-50 rounded-2xl border border-red-100">
        {error}
      </div>
    );
  }

  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const isAdmin = currentUser?.roles?.includes('admin') || currentUser?.role === 'admin';

  const handleApproveRequest = async (regId) => {
    if (!window.confirm('Approve this student team request?')) return;
    try {
      await axios.post(`/api/registrations/admin/approve-request/${regId}`);
      alert('Student team request approved successfully.');
      fetchRegistrations();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to approve request.');
    }
  };

  const handleCancelTeamRegistration = async (teamId, teamName) => {
    if (!window.confirm(`Cancel registration for team "${teamName}"?`)) return;
    try {
      await axios.delete(`/api/registrations/admin/team/${teamId}`);
      alert(`Team "${teamName}" registration cancelled.`);
      fetchRegistrations();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to cancel team registration.');
    }
  };

  const handlePaymentStatus = async (registrationId, paymentStatus) => {
    const rejectionReason = paymentStatus === 'rejected'
      ? window.prompt('Enter the reason for rejecting this UTR:')
      : undefined;
    if (paymentStatus === 'rejected' && !rejectionReason?.trim()) return;
    try {
      await axios.put(`/api/registrations/${registrationId}/payment-status`, { paymentStatus, rejectionReason });
      fetchRegistrations();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update payment status.');
    }
  };

  const exportTeams = () => {
    const rows = registrations.map(reg => ({
      Event: event?.title || reg.eventId?.title || '',
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
    const teams = Object.values(registrations.reduce((result, reg) => {
      if (!reg.teamId) return result;
      const id = reg.team_id;
      const leader = reg.teamId.leader_id === reg.user_id;
      if (!result[id]) result[id] = { Event: event?.title || '', Team: reg.teamId.name, 'Team Status': reg.teamId.status, 'Contact Number': reg.teamId.leader_contact_number || 'N/A', UTR: leader ? (reg.utr_number || '') : '', 'Payment Status': leader ? (reg.payment_status || '') : '', 'Rejection Reason': leader ? (reg.payment_rejection_reason || '') : '' };
      return result;
    }, {}));
    const pending = rows.filter(row => ['submitted', 'rejected'].includes(row['Payment Status']));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Teams and UTR');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(teams), 'Teams');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(pending), 'Payment Review');
    XLSX.writeFile(workbook, `${(event?.title || 'event').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-teams-utr.xlsx`);
  };

  // If team event, group by teamId
  if (event?.registration_type === 'team') {
    const teams = {};
    const noTeamRegs = [];

    registrations.forEach(reg => {
      if (reg.team_id && reg.teamId) {
        if (!teams[reg.team_id]) {
          teams[reg.team_id] = {
            id: reg.team_id,
            name: reg.teamId.name,
            leader_id: reg.teamId.leader_id,
            status: reg.teamId.status,
            members: [],
            registrationDate: reg.registrationDate || reg.created_at || reg.createdAt || reg.teamId.created_at
          };
        }
        teams[reg.team_id].members.push(reg);
      } else {
        noTeamRegs.push(reg);
      }
    });

    const teamList = Object.values(teams);

    return (
      <div className="space-y-6">
        {event?.payment_enabled && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {(() => { const counts = registrations.reduce((acc, reg) => { const key = reg.payment_status || 'pending'; acc[key] = (acc[key] || 0) + 1; return acc; }, {}); return <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase"><span className="rounded-lg bg-amber-50 px-2 py-1 text-amber-700">Pending {counts.pending || 0}</span><span className="rounded-lg bg-blue-50 px-2 py-1 text-blue-700">Submitted {counts.submitted || 0}</span><span className="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-700">Verified {counts.verified || 0}</span><span className="rounded-lg bg-red-50 px-2 py-1 text-red-700">Rejected {counts.rejected || 0}</span></div>; })()}
            <button onClick={exportTeams} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700">
              Export Teams &amp; UTR
            </button>
          </div>
        )}
        {teamList.length === 0 && noTeamRegs.length === 0 ? (
          <div className="text-center py-10 text-slate-500 italic bg-white/50 rounded-2xl border border-slate-200/60">
            No teams or registrations found for this event.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {teamList.map(team => {
              const leaderId = team.leader_id;
              const acceptedUserIds = new Set();
              if (leaderId) acceptedUserIds.add(String(leaderId));
              (team.members || []).forEach(m => {
                if (m.status === 'registered') {
                  acceptedUserIds.add(String(m.user_id || m.userId));
                }
              });
              const acceptedCount = acceptedUserIds.size;
              const pendingMembers = (team.members || []).filter(m => m.status === 'pending' && String(m.user_id || m.userId) !== String(leaderId));
              const rejectedMembers = (team.members || []).filter(m => m.status === 'rejected');
              const expiredMembers = (team.members || []).filter(m => m.status === 'expired');

              const isFinalized = event.registration_deadline && new Date() > new Date(event.registration_deadline);
              const meetsMinRequirement = acceptedCount >= (event.min_team_size || 1);

              return (
             <div key={team.id} className="glass-panel p-6 rounded-2xl border border-slate-200/60 flex flex-col hover:shadow-md transition-shadow">
                  {(() => { const leader = team.members.find(m => String(m.user_id) === String(team.leader_id)); team.paymentStatus = leader?.payment_status || 'pending'; team.paymentRejectionReason = leader?.payment_rejection_reason || ''; return null; })()}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-slate-800">{team.name}</h3>
                      <p className="text-xs text-slate-500 mt-1">
                         Registered on {team.registrationDate && !Number.isNaN(new Date(team.registrationDate).getTime())
                           ? new Date(team.registrationDate).toLocaleDateString()
                           : 'Date unavailable'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <button
                          onClick={() => handleCancelTeamRegistration(team.id, team.name)}
                          className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-all"
                        >
                          Cancel Team
                        </button>
                      )}
                       {event.payment_enabled && team.paymentStatus === 'submitted' ? (
                         <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-blue-100 text-blue-600 border border-blue-200 uppercase tracking-wider">Payment Pending</span>
                       ) : event.payment_enabled && team.paymentStatus === 'rejected' ? (
                         <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-100 text-red-600 border border-red-200 uppercase tracking-wider">Payment Rejected</span>
                       ) : team.status === 'registered' ? (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-600 border border-emerald-200 uppercase tracking-wider">
                          Confirmed
                        </span>
                      ) : isFinalized ? (
                        meetsMinRequirement ? (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-600 border border-emerald-200 uppercase tracking-wider">
                            Confirmed
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-100 text-red-600 border border-red-200 uppercase tracking-wider">
                            Disqualified
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-600 border border-amber-200 uppercase tracking-wider">
                          In Progress
                        </span>
                      )}
                    </div>
                  </div>

                   <div className="flex gap-2 mb-4 flex-wrap">
                     {event.payment_enabled && <div className="px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-100 flex flex-col items-center flex-1"><span className="text-sm font-black text-blue-600">{team.paymentStatus}</span><span className="text-[10px] text-blue-700 font-bold uppercase">Payment</span></div>}
                    <div className="px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100 flex flex-col items-center flex-1">
                      <span className="text-lg font-black text-emerald-600">{acceptedCount}</span>
                      <span className="text-[10px] text-emerald-700 font-bold uppercase">Accepted</span>
                    </div>
                    <div className="px-3 py-1.5 bg-amber-50 rounded-lg border border-amber-100 flex flex-col items-center flex-1">
                      <span className="text-lg font-black text-amber-600">{pendingMembers.length}</span>
                      <span className="text-[10px] text-amber-700 font-bold uppercase">Pending</span>
                    </div>
                    {(rejectedMembers.length > 0 || expiredMembers.length > 0) && (
                      <div className="px-3 py-1.5 bg-red-50 rounded-lg border border-red-100 flex flex-col items-center flex-1">
                        <span className="text-lg font-black text-red-600">{rejectedMembers.length + expiredMembers.length}</span>
                        <span className="text-[10px] text-red-700 font-bold uppercase">Declined/Exp</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 mt-2">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Team Members</h4>
                    <ul className="space-y-2 max-h-48 overflow-y-auto pr-2">
                      {team.members.map(member => (
                        <li key={member.id} className="flex justify-between items-center text-sm p-2 rounded-lg bg-white/60 border border-slate-100">
                          <div>
                            <p className="font-semibold text-slate-700">
                              {member.userId?.name || member.userId?.fullName}
                              {member.user_id === team.leader_id && <span className="ml-1 text-[10px] text-fuchsia-500 font-bold">(Leader)</span>}
                            </p>
                            <p className="text-[10px] text-slate-500">{member.userId?.department}</p>
                          </div>
                           <div className="flex items-center gap-2">
                            {member.utr_number && <span className="text-[10px] font-bold text-slate-500">UTR: {member.utr_number}</span>}
                           {member.payment_status === 'submitted' && (
                              <>
                                <button onClick={() => handlePaymentStatus(member.id, 'verified')} className="text-[10px] rounded bg-emerald-600 px-2 py-0.5 font-bold text-white">Verify</button>
                                <button onClick={() => handlePaymentStatus(member.id, 'rejected')} className="text-[10px] rounded bg-red-600 px-2 py-0.5 font-bold text-white">Reject</button>
                              </>
                            )}
                            {member.payment_status === 'rejected' && member.payment_rejection_reason && <span title={member.payment_rejection_reason} className="text-[10px] text-red-600">Reason: {member.payment_rejection_reason}</span>}
                            {member.paymentHistory?.length > 0 && <span title={member.paymentHistory.map(h => `${h.status}: ${h.reason || 'No reason'}`).join('\n')} className="text-[10px] text-slate-400">History ({member.paymentHistory.length})</span>}
                            {member.payment_status && member.payment_status !== 'pending' && member.payment_status !== 'submitted' && <span className="text-[10px] font-bold uppercase text-slate-500">{member.payment_status}</span>}
                            {member.status === 'registered' && <span className="text-[10px] px-2 py-0.5 rounded text-emerald-600 bg-emerald-100 font-bold uppercase">Accepted</span>}
                            {member.status === 'pending' && (
                              <>
                                <span className="text-[10px] px-2 py-0.5 rounded text-amber-600 bg-amber-100 font-bold uppercase">Pending</span>
                                {isAdmin && (
                                  <button
                                    onClick={() => handleApproveRequest(member.id)}
                                    className="text-[10px] px-2 py-0.5 rounded bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition"
                                  >
                                    Approve
                                  </button>
                                )}
                              </>
                            )}
                            {member.status === 'rejected' && <span className="text-[10px] px-2 py-0.5 rounded text-red-600 bg-red-100 font-bold uppercase">Rejected</span>}
                            {member.status === 'expired' && <span className="text-[10px] px-2 py-0.5 rounded text-slate-600 bg-slate-200 font-bold uppercase">Expired</span>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Individual registrations view
  return (
    <div className="bg-white/50 rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm">
      {registrations.length === 0 ? (
        <div className="text-center py-10 text-slate-500 italic">
          No registrations found for this event.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="text-xs text-slate-500 uppercase bg-slate-100/50 border-b border-slate-200/60">
              <tr>
                <th className="px-6 py-4 font-bold">Name</th>
                <th className="px-6 py-4 font-bold">Department</th>
                <th className="px-6 py-4 font-bold">Roll Number</th>
                <th className="px-6 py-4 font-bold">Registration Date</th>
                <th className="px-6 py-4 font-bold">Payment</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map(reg => (
                <tr key={reg.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-800">
                    {reg.userId?.name || reg.userId?.fullName}
                  </td>
                  <td className="px-6 py-4">
                    {reg.userId?.department || 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                    {reg.userId?.roll_number || 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                     {reg.registrationDate && !Number.isNaN(new Date(reg.registrationDate).getTime())
                       ? new Date(reg.registrationDate).toLocaleString()
                       : 'Date unavailable'}
                  </td>
                  <td className="px-6 py-4 text-xs">
                    {reg.utr_number ? <><div className="font-bold">{reg.utr_number}</div><div className="uppercase text-slate-500">{reg.payment_status}</div>{reg.payment_status === 'submitted' && <div className="mt-1 flex gap-1"><button onClick={() => handlePaymentStatus(reg.id, 'verified')} className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white">Verify</button><button onClick={() => handlePaymentStatus(reg.id, 'rejected')} className="rounded bg-red-600 px-2 py-1 text-[10px] font-bold text-white">Reject</button></div>}</> : 'Not required'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default OrganizerRegistrations;
