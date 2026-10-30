import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from './Modal';

export const WORKSPACE_MODULES = [
  { id: 'tasks', name: 'Tasks & Progress', desc: 'Task board & assignments' },
  { id: 'discussion', name: 'Review & Discussion', desc: 'Team review & discussion' },
  { id: 'team', name: 'Organizing Team', desc: 'Organizing committee roster' },
  { id: 'registrations', name: 'Registrations & Teams', desc: 'Registrations & confirmed teams' },
  { id: 'allocation', name: 'Allocation', desc: 'Problem statement & venue allocations' },
  { id: 'scoring', name: 'Scoring Board', desc: 'Scoring & leaderboard' },
  { id: 'periodic_attendance', name: 'Attendance & QR', desc: 'Periodic attendance & QR' },
  { id: 'id_cards', name: 'ID Cards', desc: 'Participant ID card generation' },
  { id: 'certificates', name: 'Certificates', desc: 'Certificate management' },
  { id: 'feedback', name: 'Feedback Analytics', desc: 'Post-event ratings & analytics' }
];

export const STANDARD_RESPONSIBILITIES = [
  'Event Lead',
  'Co-Lead',
  'Technical Lead',
  'Technical Team Member',
  'Logistics Lead',
  'Logistics Team Member',
  'Hospitality Lead',
  'Hospitality Team Member',
  'Media & Photography',
  'Design & Creative',
  'Registration & Help Desk',
  'Attendance & QR Operations',
  'Scoring & Evaluation Lead',
  'Stage Manager',
  'Sponsorship & PR',
  'Volunteer Coordinator',
  'Volunteer',
  'Faculty Coordinator'
];

const ALL_MODULE_IDS = WORKSPACE_MODULES.map(m => m.id);

const OrganizingTeamTab = ({ eventId, event, user, hasFullAccess }) => {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [selectedUserForAdd, setSelectedUserForAdd] = useState(null);
  const [selectedResponsibility, setSelectedResponsibility] = useState('');
  const [customResponsibility, setCustomResponsibility] = useState('');
  const [selectedModulesForAdd, setSelectedModulesForAdd] = useState(ALL_MODULE_IDS);

  // Permission Editing Modal State
  const [editingPermissionsMember, setEditingPermissionsMember] = useState(null);
  const [memberEditingModules, setMemberEditingModules] = useState([]);
  const [savingPermissions, setSavingPermissions] = useState(false);

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
    if (selectedUserForAdd) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await axios.get(`/api/users/search?query=${encodeURIComponent(trimmed)}&eventId=${encodeURIComponent(eventId)}`);
        const existingIds = new Set((team || []).map(m => String(m.user_id || m.userId || m.id)));
        if (event?.faculty_id) existingIds.add(String(event.faculty_id));
        if (event?.student_organizer_id) existingIds.add(String(event.student_organizer_id));
        if (event?.proposed_by) existingIds.add(String(event.proposed_by));
        
        const filtered = (res.data || []).filter(u => !existingIds.has(String(u.id)));
        setSearchResults(filtered);
      } catch (err) {
        console.error('User search failed:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedUserForAdd, eventId, team]);

  const toggleAddModule = (modId) => {
    if (selectedModulesForAdd.includes(modId)) {
      setSelectedModulesForAdd(prev => prev.filter(id => id !== modId));
    } else {
      setSelectedModulesForAdd(prev => [...prev, modId]);
    }
  };

  const handleAddMember = async () => {
    const effectiveRole = selectedResponsibility === 'Other' 
      ? customResponsibility.trim() 
      : selectedResponsibility.trim();

    if (!selectedUserForAdd || !effectiveRole) {
      alert('Please select a user and choose or enter a responsibility.');
      return;
    }

    try {
      setAddingMember(true);
      const modulesToSave = selectedModulesForAdd.length === ALL_MODULE_IDS.length ? ['all'] : selectedModulesForAdd;
      
      await axios.post(`/api/events/${eventId}/proposal-team`, {
        userId: selectedUserForAdd.id,
        name: selectedUserForAdd.name || selectedUserForAdd.fullName,
        email: selectedUserForAdd.email,
        department: selectedUserForAdd.department,
        role: effectiveRole,
        allowedModules: modulesToSave
      });
      
      setSearchQuery('');
      setSearchResults([]);
      setSelectedUserForAdd(null);
      setSelectedResponsibility('');
      setCustomResponsibility('');
      setSelectedModulesForAdd(ALL_MODULE_IDS);
      fetchTeam();
      alert('Team member added successfully with specified module access permissions.');
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

  const openPermissionsModal = (member) => {
    const rawAllowed = member.allowed_modules || ['all'];
    const initialAllowed = (Array.isArray(rawAllowed) && rawAllowed.includes('all'))
      ? ALL_MODULE_IDS 
      : (Array.isArray(rawAllowed) ? rawAllowed : ALL_MODULE_IDS);
    
    setMemberEditingModules(initialAllowed);
    setEditingPermissionsMember(member);
  };

  const toggleEditMemberModule = (modId) => {
    if (memberEditingModules.includes(modId)) {
      setMemberEditingModules(prev => prev.filter(id => id !== modId));
    } else {
      setMemberEditingModules(prev => [...prev, modId]);
    }
  };

  const handleSavePermissions = async () => {
    if (!editingPermissionsMember) return;
    try {
      setSavingPermissions(true);
      const modulesToSave = memberEditingModules.length === ALL_MODULE_IDS.length ? ['all'] : memberEditingModules;
      
      const memberId = editingPermissionsMember.id;
      const targetUserId = editingPermissionsMember.user_id || editingPermissionsMember.userId || editingPermissionsMember.student_id;

      await axios.put(`/api/events/${eventId}/proposal-team/${memberId}/permissions`, {
        allowedModules: modulesToSave,
        userId: targetUserId
      });
      
      // Update local state immediately
      setTeam(prev => prev.map(m => {
        if (m.id === memberId || (targetUserId && (m.user_id === targetUserId || m.userId === targetUserId))) {
          return { ...m, allowed_modules: modulesToSave };
        }
        return m;
      }));

      setEditingPermissionsMember(null);
      fetchTeam();
      alert('Module permissions updated successfully.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update permissions.');
    } finally {
      setSavingPermissions(false);
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

  const renderPermissionsBadge = (member) => {
    const rawAllowed = member.allowed_modules || ['all'];
    const isAll = Array.isArray(rawAllowed) && (rawAllowed.includes('all') || rawAllowed.length === ALL_MODULE_IDS.length);
    
    if (isAll) {
      return null;
    }

    const count = Array.isArray(rawAllowed) ? rawAllowed.length : 0;
    return (
      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/60 flex items-center gap-1" title={rawAllowed.join(', ')}>
        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
        {count} {count === 1 ? 'Module' : 'Modules'} Allowed
      </span>
    );
  };

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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* User Search & Selection */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Selected Member *
              </label>
              
              {selectedUserForAdd ? (
                <div className="p-3 bg-white dark:bg-slate-900 border border-fuchsia-300 dark:border-fuchsia-800/80 rounded-xl flex items-center justify-between gap-3 shadow-xs">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                      {selectedUserForAdd.fullName || selectedUserForAdd.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {selectedUserForAdd.rollNumber || selectedUserForAdd.roll_number ? `${selectedUserForAdd.rollNumber || selectedUserForAdd.roll_number} • ` : ''}
                      {selectedUserForAdd.email}
                      {selectedUserForAdd.department ? ` • ${selectedUserForAdd.department}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUserForAdd(null);
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    Change User
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, roll no, or email..."
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-fuchsia-500 focus:outline-none"
                    autoComplete="off"
                  />

                  {/* Live Search Results Dropdown */}
                  {searchQuery.trim().length >= 2 && !selectedUserForAdd && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 divide-y divide-slate-100 dark:divide-slate-800">
                      {isSearching ? (
                        <div className="p-3 text-xs text-slate-400 text-center">Searching registered users...</div>
                      ) : searchResults.length === 0 ? (
                        <div className="p-3 text-xs text-slate-400 text-center">No eligible users found matching "{searchQuery}"</div>
                      ) : (
                        searchResults.map(u => (
                          <div
                            key={u.id}
                            onClick={() => {
                              setSelectedUserForAdd(u);
                              setSearchQuery('');
                              setSearchResults([]);
                            }}
                            className="p-3 hover:bg-fuchsia-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between gap-2 text-xs transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{u.fullName || u.name}</p>
                              <p className="text-[10px] text-slate-500 truncate">
                                {u.rollNumber || u.roll_number ? `${u.rollNumber || u.roll_number} • ` : ''}
                                {u.email}
                              </p>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                              {u.department || u.role || 'Member'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Responsibility Dropdown */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Assigned Responsibility / Role *
              </label>
              <select
                value={selectedResponsibility}
                onChange={(e) => setSelectedResponsibility(e.target.value)}
                className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-fuchsia-500 focus:outline-none cursor-pointer"
              >
                <option value="">-- Select Responsibility / Role --</option>
                {STANDARD_RESPONSIBILITIES.map(resp => (
                  <option key={resp} value={resp}>{resp}</option>
                ))}
                <option value="Other">Other (Custom Role)</option>
              </select>

              {selectedResponsibility === 'Other' && (
                <input
                  type="text"
                  value={customResponsibility}
                  onChange={(e) => setCustomResponsibility(e.target.value)}
                  placeholder="Type custom role title (e.g. Stage Master, Media Head)..."
                  className="w-full mt-2 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs focus:ring-2 focus:ring-fuchsia-500 focus:outline-none"
                />
              )}
            </div>
          </div>

          {/* Module Permissions Picker */}
          <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                  Select Accessible Modules for this Member
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Only the selected workspace modules will be accessible to this organizer.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedModulesForAdd(ALL_MODULE_IDS)}
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <button
                  type="button"
                  onClick={() => setSelectedModulesForAdd(['tasks'])}
                  className="text-[10px] font-bold text-slate-500 hover:underline cursor-pointer"
                >
                  Tasks Only
                </button>
              </div>
            </div>

            {/* Module selection chips */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {WORKSPACE_MODULES.map(mod => {
                const isSelected = selectedModulesForAdd.includes(mod.id);
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => toggleAddModule(mod.id)}
                    className={`p-2 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-400/40'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-bold truncate">{mod.name}</span>
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] shrink-0 ${
                        isSelected ? 'bg-indigo-600 text-white' : 'border border-slate-300 dark:border-slate-600'
                      }`}>
                        {isSelected ? '✓' : ''}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-1">{mod.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleAddMember}
              disabled={addingMember || !selectedUserForAdd || (selectedResponsibility === 'Other' ? !customResponsibility.trim() : !selectedResponsibility.trim())}
              className="px-5 py-2.5 bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white font-bold text-xs rounded-xl hover:shadow-md hover:shadow-fuchsia-500/25 disabled:opacity-50 transition-all cursor-pointer flex items-center gap-2"
            >
              {addingMember ? 'Adding to Committee...' : 'Add Member & Assign Permissions'}
            </button>
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
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                      Lead Faculty Coordinator
                    </span>
                    <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
                      Full Access
                    </span>
                  </div>
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
                    <div className="min-w-0 space-y-1">
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                        {member.name || member.user?.name || 'Faculty Member'}
                      </p>
                      <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 truncate">
                        {member.role || member.responsibility || 'Faculty Committee Member'}
                      </p>
                      {renderPermissionsBadge(member) && (
                        <div className="pt-0.5">
                          {renderPermissionsBadge(member)}
                        </div>
                      )}
                    </div>
                  </div>

                  {hasFullAccess && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openPermissionsModal(member)}
                        className="px-2 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Edit Module Permissions"
                      >
                        Permissions
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.id)}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                        title="Remove Member"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
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
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-600 dark:text-fuchsia-400 block">
                      Lead Student Organizer / Proposer
                    </span>
                    <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-fuchsia-100 dark:bg-fuchsia-900 text-fuchsia-700 dark:text-fuchsia-300">
                      Full Access
                    </span>
                  </div>
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
                    <div className="min-w-0 space-y-1">
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                        {member.name || member.user?.name || 'Team Member'}
                      </p>
                      <p className="text-[10px] font-bold text-fuchsia-600 dark:text-fuchsia-400 truncate">
                        {member.role || member.responsibility || 'Student Committee Member'}
                      </p>
                      {renderPermissionsBadge(member) && (
                        <div className="pt-0.5">
                          {renderPermissionsBadge(member)}
                        </div>
                      )}
                    </div>
                  </div>

                  {hasFullAccess && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openPermissionsModal(member)}
                        className="px-2 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Edit Module Permissions"
                      >
                        Permissions
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.id)}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                        title="Remove Member"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
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

      {/* Edit Permissions Modal */}
      {editingPermissionsMember && (
        <Modal 
          isOpen={!!editingPermissionsMember} 
          onClose={() => setEditingPermissionsMember(null)}
          title={`Edit Module Permissions`}
          subtitle={`Configure which workspace tabs are accessible to ${editingPermissionsMember.name || 'this member'}.`}
        >
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
              <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                Workspace Modules ({memberEditingModules.length} selected)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMemberEditingModules(ALL_MODULE_IDS)}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <button
                  type="button"
                  onClick={() => setMemberEditingModules(['tasks'])}
                  className="text-xs font-bold text-slate-500 hover:underline cursor-pointer"
                >
                  Tasks Only
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[50vh] overflow-y-auto">
              {WORKSPACE_MODULES.map(mod => {
                const isSelected = memberEditingModules.includes(mod.id);
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => toggleEditMemberModule(mod.id)}
                    className={`p-3 rounded-xl text-left border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-400/40'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold block">{mod.name}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">{mod.desc}</span>
                    </div>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ml-2 ${
                      isSelected ? 'bg-indigo-600 text-white shadow-xs' : 'border border-slate-300 dark:border-slate-600'
                    }`}>
                      {isSelected ? '✓' : ''}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setEditingPermissionsMember(null)}
                className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                disabled={savingPermissions}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                disabled={savingPermissions || memberEditingModules.length === 0}
                className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-xs rounded-xl hover:shadow-md hover:shadow-indigo-500/25 disabled:opacity-50 transition cursor-pointer"
              >
                {savingPermissions ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default OrganizingTeamTab;
