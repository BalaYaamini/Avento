import React, { useState, useEffect } from 'react';
import axios from 'axios';

const OrganizingTeamTab = ({ eventId, event, user, hasFullAccess }) => {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [selectedUserForAdd, setSelectedUserForAdd] = useState(null);
  const [selectedResponsibility, setSelectedResponsibility] = useState('');

  const fetchTeam = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/events/${eventId}/proposal-team`);
      setTeam(res.data || []);
    } catch (err) {
      console.error('Failed to fetch organizing team:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, [eventId]);

  // Debounced search for users to add
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await axios.get(`/api/users/search?query=${encodeURIComponent(trimmed)}`);
        setSearchResults(res.data || []);
      } catch (err) {
        console.error('User search failed:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddMember = async () => {
    if (!selectedUserForAdd || !selectedResponsibility.trim()) {
      alert('Please select a student user and assign a responsibility.');
      return;
    }

    try {
      setAddingMember(true);
      await axios.post(`/api/events/${eventId}/proposal-team`, {
        userId: selectedUserForAdd.id,
        name: selectedUserForAdd.name || selectedUserForAdd.fullName,
        email: selectedUserForAdd.email,
        department: selectedUserForAdd.department,
        role: selectedResponsibility.trim()
      });
      setSearchQuery('');
      setSearchResults([]);
      setSelectedUserForAdd(null);
      setSelectedResponsibility('');
      fetchTeam();
      alert('Team member added successfully.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add team member.');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Are you sure you want to remove this team member?')) return;
    try {
      await axios.delete(`/api/events/${eventId}/proposal-team/${memberId}`);
      fetchTeam();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove team member.');
    }
  };

  // Identification helpers
  const facultyCoordinatorEmail = event?.faculty?.email?.toLowerCase();
  const facultyCoordinatorId = event?.faculty_id || event?.faculty?.id;
  const studentLeadEmail = event?.proposer?.email?.toLowerCase();
  const studentLeadId = event?.proposed_by || event?.student_organizer_id || event?.proposer?.id;

  const isFacultyMember = (m) => {
    const globalRole = (m.global_role || '').toLowerCase();
    const category = (m.category || '').toLowerCase();
    const role = (m.role || m.responsibility || '').toLowerCase();
    return (
      globalRole.startsWith('faculty') ||
      category === 'faculty' ||
      role.includes('faculty') ||
      (facultyCoordinatorId && m.user_id === facultyCoordinatorId) ||
      (facultyCoordinatorEmail && m.email && m.email.toLowerCase() === facultyCoordinatorEmail)
    );
  };

  const additionalFaculty = team.filter(m => {
    if (!isFacultyMember(m)) return false;
    if (facultyCoordinatorId && m.user_id === facultyCoordinatorId) return false;
    if (facultyCoordinatorEmail && m.email && m.email.toLowerCase() === facultyCoordinatorEmail) return false;
    return true;
  });

  const additionalStudents = team.filter(m => {
    if (isFacultyMember(m)) return false;
    if (studentLeadId && m.user_id === studentLeadId) return false;
    if (studentLeadEmail && m.email && m.email.toLowerCase() === studentLeadEmail) return false;
    return true;
  });

  const facultyTotalCount = (event?.faculty?.name || event?.faculty_name ? 1 : 0) + additionalFaculty.length;
  const studentTotalCount = (event?.proposer?.name || event?.student_name || event?.proposerName ? 1 : 0) + additionalStudents.length;

  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 mb-8 animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Organizing Committee & Leadership</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Faculty coordinators and student organizers managing and operating this event
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
            {facultyTotalCount} Faculty
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-fuchsia-50 dark:bg-fuchsia-950 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-100 dark:border-fuchsia-900">
            {studentTotalCount} Students
          </span>
        </div>
      </div>

      {/* Add Member Form (For authorized organizers/admins) */}
      {hasFullAccess && (
        <div className="p-5 bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <svg className="w-4 h-4 text-fuchsia-600 dark:text-fuchsia-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Member to Organizing Committee</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* User Search Input */}
            <div className="relative">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Search Student or Faculty by Name, Roll No, or Email
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type at least 2 characters to search..."
                className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-fuchsia-500 focus:outline-none"
              />

              {/* Live Search Results Dropdown */}
              {searchQuery.trim().length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 max-h-52 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 divide-y divide-slate-100 dark:divide-slate-800">
                  {isSearching ? (
                    <div className="p-3 text-xs text-slate-400 text-center">Searching registered users...</div>
                  ) : searchResults.length === 0 ? (
                    <div className="p-3 text-xs text-slate-400 text-center">No users found matching "{searchQuery}"</div>
                  ) : (
                    searchResults.map(u => (
                      <div
                        key={u.id}
                        onClick={() => {
                          setSelectedUserForAdd(u);
                          setSearchQuery(`${u.fullName || u.name} (${u.rollNumber || u.roll_number || u.email})`);
                          setSearchResults([]);
                        }}
                        className="p-3 hover:bg-fuchsia-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between gap-2 text-xs transition-colors"
                      >
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200">{u.fullName || u.name}</p>
                          <p className="text-[10px] text-slate-500">{u.rollNumber || u.roll_number} • {u.email}</p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {u.department || (u.roles?.[0] || 'Member')}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Responsibility Input */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Assigned Responsibility / Role
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={selectedResponsibility}
                  onChange={(e) => setSelectedResponsibility(e.target.value)}
                  placeholder="e.g. Technical Lead, Stage Coordinator, Hospitality"
                  className="flex-1 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-fuchsia-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddMember}
                  disabled={addingMember || !selectedUserForAdd || !selectedResponsibility.trim()}
                  className="btn-primary px-4 py-2.5 rounded-xl font-bold text-xs text-white disabled:opacity-50 transition-all shrink-0 cursor-pointer"
                >
                  {addingMember ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Two Columns: Faculty Organizers and Student Organizers */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading organizing committee members...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* COLUMN 1: Faculty Organizers */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-indigo-100 dark:border-indigo-900/40">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                  </svg>
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Faculty Organizers</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800">
                {facultyTotalCount}
              </span>
            </div>

            <div className="space-y-3">
              {/* Lead Faculty Coordinator Card */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex items-center gap-3.5 shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-0.5">
                    Lead Faculty Coordinator
                  </span>
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                    {event?.faculty?.name || event?.faculty_name || 'Assigned Faculty Coordinator'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {event?.faculty?.email || 'Faculty Coordinator'}
                  </p>
                  {event?.faculty?.department && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                      Dept: {event.faculty.department}
                    </p>
                  )}
                </div>
              </div>

              {/* Additional Faculty Members */}
              {additionalFaculty.map(member => (
                <div
                  key={member.id}
                  className="p-4 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                      {(member.name || member.user?.name || 'F')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                        {member.name || member.user?.name || 'Faculty Member'}
                      </p>
                      <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 truncate">
                        {member.role || member.responsibility || 'Faculty Committee Member'}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {member.email || member.user?.email || member.department || ''}
                      </p>
                    </div>
                  </div>

                  {hasFullAccess && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.id)}
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer shrink-0"
                      title="Remove Member"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}

              {additionalFaculty.length === 0 && (
                <div className="p-4 text-center text-slate-400 italic bg-slate-50/40 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs">
                  No additional faculty committee members.
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 2: Student Organizers */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-fuchsia-100 dark:border-fuchsia-900/40">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-fuchsia-100 dark:bg-fuchsia-900/60 text-fuchsia-600 dark:text-fuchsia-400 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Student Organizers</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-fuchsia-50 dark:bg-fuchsia-950 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-200/60 dark:border-fuchsia-800">
                {studentTotalCount}
              </span>
            </div>

            <div className="space-y-3">
              {/* Lead Student Organizer Card */}
              <div className="p-4 rounded-2xl bg-fuchsia-50/70 dark:bg-fuchsia-950/30 border border-fuchsia-100 dark:border-fuchsia-900/50 flex items-center gap-3.5 shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-fuchsia-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-600 dark:text-fuchsia-400 block mb-0.5">
                    Lead Student Organizer / Proposer
                  </span>
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                    {event?.proposer?.name || event?.student_name || event?.proposerName || 'Lead Organizer'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {event?.proposer?.email || 'Student Lead'}
                  </p>
                  {event?.proposer?.department && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                      Dept: {event.proposer.department}
                    </p>
                  )}
                </div>
              </div>

              {/* Additional Student Committee Members */}
              {additionalStudents.map(member => (
                <div
                  key={member.id}
                  className="p-4 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                      {(member.name || member.user?.name || 'S')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                        {member.name || member.user?.name || 'Team Member'}
                      </p>
                      <p className="text-[10px] font-bold text-fuchsia-600 dark:text-fuchsia-400 truncate">
                        {member.role || member.responsibility || 'Student Committee Member'}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {member.roll_number ? `${member.roll_number} • ` : ''}{member.email || member.user?.email || ''}
                      </p>
                    </div>
                  </div>

                  {hasFullAccess && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.id)}
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer shrink-0"
                      title="Remove Member"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}

              {additionalStudents.length === 0 && (
                <div className="p-4 text-center text-slate-400 italic bg-slate-50/40 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs">
                  No additional student committee members added yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizingTeamTab;
