import React, { useState, useEffect } from 'react';
import axios from 'axios';

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
            registrationDate: reg.registrationDate
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
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-slate-800">{team.name}</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Registered on {new Date(team.registrationDate).toLocaleDateString()}
                      </p>
                    </div>
                    {team.status === 'registered' ? (
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

                  <div className="flex gap-2 mb-4 flex-wrap">
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
                          <div>
                            {member.status === 'registered' && <span className="text-[10px] px-2 py-0.5 rounded text-emerald-600 bg-emerald-100 font-bold uppercase">Accepted</span>}
                            {member.status === 'pending' && <span className="text-[10px] px-2 py-0.5 rounded text-amber-600 bg-amber-100 font-bold uppercase">Pending</span>}
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
                    {new Date(reg.registrationDate).toLocaleString()}
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
