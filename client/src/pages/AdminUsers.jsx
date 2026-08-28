import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ImportUsersModal from '../components/ImportUsersModal';
import { useAuth } from '../context/AuthContext';

const AdminUsers = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active tab: 'imported' | 'registered'
  const [activeTab, setActiveTab] = useState('imported');

  // Filters
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Modals state
  const [actionUser, setActionUser] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState(null);
  
  // Edit form state
  const [editForm, setEditForm] = useState({ fullName: '', department: '', role: '' });

  // Bulk Selection State
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const isAdmin = (u) => u.roles?.some(r => r.toLowerCase().includes('admin'));

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get('/api/users');
      setUsers(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch platform user list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openDropdownId !== null && !e.target.closest('[data-dropdown]')) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdownId]);

  // Split users by registration method
  const importedUsers = users.filter(u => u.registrationMethod === 'imported' || u.registrationMethod === 'admin');
  const registeredUsers = users.filter(u => u.registrationMethod === 'otp' || u.registrationMethod === 'google');

  // Apply filters based on active tab
  const baseUsers = activeTab === 'imported' ? importedUsers : registeredUsers;

  const filteredUsers = baseUsers.filter(user => {
    const matchesRole = selectedRole 
      ? user.roles?.some(r => r.toLowerCase().includes(selectedRole.toLowerCase())) 
      : true;

    const matchesMethod = activeTab === 'registered' && selectedMethod
      ? user.registrationMethod === selectedMethod
      : true;

    const query = searchQuery.toLowerCase();
    const matchesSearch = searchQuery
      ? user.fullName?.toLowerCase().includes(query) || 
        user.email?.toLowerCase().includes(query) || 
        user.employeeId?.toLowerCase().includes(query) || 
        user.rollNumber?.toLowerCase().includes(query)
      : true;

    return matchesRole && matchesMethod && matchesSearch;
  });

  const nonAdminUsersInView = filteredUsers.filter(u => !isAdmin(u));
  const isAllSelected = nonAdminUsersInView.length > 0 && nonAdminUsersInView.every(u => selectedUserIds.includes(u.id || u._id));

  // Stats for registered tab
  const googleCount = registeredUsers.filter(u => u.registrationMethod === 'google').length;
  const otpCount = registeredUsers.filter(u => u.registrationMethod === 'otp').length;

  const handleSelectAllToggle = () => {
    if (isAllSelected) {
      const viewIds = new Set(nonAdminUsersInView.map(u => u.id || u._id));
      setSelectedUserIds(prev => prev.filter(id => !viewIds.has(id)));
    } else {
      const viewIds = nonAdminUsersInView.map(u => u.id || u._id);
      setSelectedUserIds(prev => Array.from(new Set([...prev, ...viewIds])));
    }
  };

  const handleUserSelectToggle = (id) => {
    setSelectedUserIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDeleteSubmit = async () => {
    setBulkDeleting(true);
    try {
      const res = await axios.post('/api/users/bulk-delete', { userIds: selectedUserIds });
      alert(res.data.message || `Successfully deleted ${res.data.deletedCount} user(s).`);
      setSelectedUserIds([]);
      setIsBulkDeleteModalOpen(false);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to perform bulk user deletion.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleResetPassword = async () => {
    try {
      const res = await axios.put(`/api/users/${actionUser.id || actionUser._id}/reset-password`);
      setTempPassword(res.data.tempPassword);
      fetchUsers();
    } catch (err) {
      alert('Failed to reset password.');
    }
  };

  const openEditModal = (user) => {
    setActionUser(user);
    setEditForm({
      fullName: user.fullName || '',
      department: user.department || '',
      role: user.roles?.[0] || 'student'
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`/api/users/${actionUser.id || actionUser._id}`, editForm);
      setIsEditModalOpen(false);
      fetchUsers();
    } catch (err) {
      alert('Failed to update user.');
    }
  };

  const handleDelete = async () => {
    try {
      const userId = actionUser.id || actionUser._id;
      await axios.delete(`/api/users/${userId}`);
      setUsers(prev => prev.filter(u => (u.id || u._id) !== userId));
      setIsDeleteModalOpen(false);
    } catch (err) {
      console.error('Delete failed:', err.response?.data || err.message);
      alert(err.response?.data?.message || 'Failed to delete user.');
    }
  };

  return (
    <div className="flex-grow py-20 text-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-6 animate-fade-in-up">
          <h1 className="font-display text-3xl font-black text-text-primary">User <span className="heading-gradient">Management</span></h1>
          <p className="font-body text-slate-600 text-sm mt-1.5">Audit, import, and manage registered students and faculty</p>
        </div>

        {/* Tabs */}
        <div className="mb-8 animate-fade-in-up delay-75">
          <div className="flex gap-1 p-1 bg-white/60 rounded-xl border border-slate-200/50 w-fit">
            <button
              onClick={() => { setActiveTab('imported'); setSelectedMethod(''); setSelectedRole(''); setSearchQuery(''); setSelectedUserIds([]); }}
              className={`px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                activeTab === 'imported'
                  ? 'bg-violet-500 text-white shadow-md shadow-violet-500/20'
                  : 'text-slate-500 hover:bg-white/80'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Imported Users
                <span className="ml-1 px-1.5 py-0.5 rounded-md bg-white/20 text-[10px]">{importedUsers.length}</span>
              </span>
            </button>
            <button
              onClick={() => { setActiveTab('registered'); setSelectedRole(''); setSelectedMethod(''); setSearchQuery(''); setSelectedUserIds([]); }}
              className={`px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                activeTab === 'registered'
                  ? 'bg-violet-500 text-white shadow-md shadow-violet-500/20'
                  : 'text-slate-500 hover:bg-white/80'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                Registered Users
                <span className="ml-1 px-1.5 py-0.5 rounded-md bg-white/20 text-[10px]">{registeredUsers.length}</span>
              </span>
            </button>
          </div>
        </div>

        {/* Stats Row - Imported Tab */}
        {activeTab === 'imported' && users.length > 0 && (
          <div className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-in-up delay-75">
            <div className="glass-panel rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-500/10 text-violet-500 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <div>
                <div className="text-lg font-display font-black text-slate-800">{importedUsers.length}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Imported</div>
              </div>
            </div>
            <div className="glass-panel rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              </div>
              <div>
                <div className="text-lg font-display font-black text-slate-800">{importedUsers.filter(u => u.roles?.some(r => r.includes('student'))).length}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Students</div>
              </div>
            </div>
            <div className="glass-panel rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              </div>
              <div>
                <div className="text-lg font-display font-black text-slate-800">{importedUsers.filter(u => u.roles?.some(r => r.includes('faculty'))).length}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Faculty</div>
              </div>
            </div>
            <div className="glass-panel rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <div className="text-lg font-display font-black text-slate-800">{importedUsers.filter(u => u.first_login === true).length}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pending Login</div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Row - Registered Tab */}
        {activeTab === 'registered' && registeredUsers.length > 0 && (
          <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in-up delay-75">
            <div className="glass-panel rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-500/10 text-violet-500 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <div>
                <div className="text-lg font-display font-black text-slate-800">{registeredUsers.length}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Registered</div>
              </div>
            </div>
            <div className="glass-panel rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
              </div>
              <div>
                <div className="text-lg font-display font-black text-slate-800">{googleCount}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Google OAuth</div>
              </div>
            </div>
            <div className="glass-panel rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
              <div>
                <div className="text-lg font-display font-black text-slate-800">{otpCount}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email/OTP</div>
              </div>
            </div>
          </div>
        )}

        {/* Filters Panel */}
        <div className="animate-fade-in-up delay-100 glass-panel rounded-2xl p-5 sm:p-6 mb-10 flex flex-col lg:flex-row items-center gap-4 justify-between">
          
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
            {/* Role Filter */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <label className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] whitespace-nowrap">Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="bg-white/60 text-slate-700 border border-slate-300/50 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:border-violet-500/60 transition-all duration-300 w-full sm:w-32 cursor-pointer"
              >
                <option value="">All</option>
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {/* Method Filter - Only on Registered tab */}
            {activeTab === 'registered' && (
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] whitespace-nowrap">Method</label>
                <select
                  value={selectedMethod}
                  onChange={(e) => setSelectedMethod(e.target.value)}
                  className="bg-white/60 text-slate-700 border border-slate-300/50 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:border-violet-500/60 transition-all duration-300 w-full sm:w-40 cursor-pointer"
                >
                  <option value="">All Methods</option>
                  <option value="google">Google OAuth</option>
                  <option value="otp">Email/OTP</option>
                </select>
              </div>
            )}
          </div>

          {/* User Search */}
          <div className="relative w-full lg:w-80 group">
            <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-600 group-focus-within:text-violet-400 transition-colors duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search by name, email, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/60 text-slate-800 placeholder-slate-600 border border-slate-300/50 rounded-xl py-2.5 pl-11 pr-4 text-sm font-medium focus:outline-none focus:border-violet-500/60 transition-all duration-300"
            />
          </div>

          {/* Action Buttons */}
          <div className="w-full lg:w-auto mt-4 lg:mt-0 flex items-center gap-3">
            {selectedUserIds.length > 0 && (
              <button
                onClick={() => setIsBulkDeleteModalOpen(true)}
                className="w-full sm:w-auto bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Selected ({selectedUserIds.length})
              </button>
            )}

            {activeTab === 'imported' && (
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="w-full sm:w-auto btn-primary px-6 py-2.5 rounded-xl text-sm font-bold shadow-pastel-glow flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Import Users
              </button>
            )}
          </div>

        </div>

        {/* Loading / Table list */}
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
            <button onClick={fetchUsers} className="btn-primary px-6 py-2.5 text-sm font-bold rounded-xl text-white">Retry</button>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-24 glass-panel rounded-2xl animate-fade-in-scale">
            <div className="h-20 w-20 bg-white/50 rounded-2xl flex items-center justify-center mx-auto text-slate-600 mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-display font-bold text-slate-800 mb-2">No Accounts Found</h3>
            <p className="text-sm font-body text-slate-600">There are no accounts matching your search criteria.</p>
          </div>
        ) : (
          <div className="animate-fade-in-up delay-200 glass-panel rounded-2xl overflow-hidden shadow-2xl shadow-violet-500/3">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/40 border-b border-slate-200/40 text-slate-600 text-[10px] font-bold uppercase tracking-[0.1em]">
                    <th className="px-4 py-4 text-center w-12">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleSelectAllToggle}
                        disabled={nonAdminUsersInView.length === 0}
                        title="Select All Eligible Users (Excludes Admin)"
                        className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      />
                    </th>
                    <th className="px-6 py-4">Full Name</th>
                    <th className="px-6 py-4">Email / ID</th>
                    <th className="px-6 py-4">Role</th>
                    {activeTab === 'registered' && <th className="px-6 py-4">Method</th>}
                    <th className="px-6 py-4">Department</th>
                    {activeTab === 'imported' && <th className="px-6 py-4">First Login</th>}
                    <th className="px-6 py-4">Joined Date</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30 text-sm font-body">
                  {filteredUsers.map((user, i) => (
                    <tr 
                      key={user.id || user._id} 
                      className="hover:bg-white/20 transition-all duration-300 animate-fade-in-up"
                      style={{ animationDelay: `${i * 20 + 100}ms` }}
                    >
                      <td className="px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          disabled={isAdmin(user)}
                          checked={selectedUserIds.includes(user.id || user._id)}
                          onChange={() => handleUserSelectToggle(user.id || user._id)}
                          title={isAdmin(user) ? "Admin accounts cannot be selected or deleted" : "Select user"}
                          className={`w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 ${
                            isAdmin(user) ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        />
                      </td>
                      <td className="px-6 py-4 font-display font-bold text-slate-800">
                        {user.fullName}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-600 text-xs">{user.email}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{user.rollNumber || user.employeeId || 'No ID'}</div>
                      </td>
                      <td className="px-6 py-4">
                        {user.roles?.some(r => r.includes('admin')) ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20">
                            Admin
                          </span>
                        ) : (
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${
                            user.roles?.some(r => r.includes('faculty'))
                              ? 'bg-sky-500/8 text-sky-400 border-sky-500/15'
                              : 'bg-white/40 text-slate-600 border-slate-300/30'
                          }`}>
                            {user.roles?.some(r => r.includes('faculty')) ? 'Faculty' : 'Student'}
                          </span>
                        )}
                      </td>
                      {activeTab === 'registered' && (
                        <td className="px-6 py-4">
                          {user.registrationMethod === 'google' ? (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border bg-sky-500/10 text-sky-600 border-sky-500/20">
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                              Google
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                              OTP
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4 text-slate-600 text-xs font-bold">
                        {user.roles?.some(r => r.includes('admin')) ? '—' : (user.department || '—')}
                      </td>
                      {activeTab === 'imported' && (
                        <td className="px-6 py-4">
                          {user.roles?.some(r => r.includes('admin')) ? (
                            <span className="text-[10px] font-bold text-slate-400">Not Required</span>
                          ) : user.first_login ? (
                            <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-md border border-yellow-200">Pending</span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400">Completed</span>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4 text-slate-500 text-xs font-bold">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="relative inline-block" data-dropdown>
                          <button 
                            onClick={() => setOpenDropdownId(openDropdownId === (user.id || user._id) ? null : (user.id || user._id))}
                            className="text-slate-400 hover:text-violet-500 transition-colors p-1"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                          </button>
                          {openDropdownId === (user.id || user._id) && (
                            <div className="absolute right-0 mt-1 w-36 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden">
                              <button onClick={() => { setOpenDropdownId(null); openEditModal(user); }} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-violet-500 transition-colors">Edit User</button>
                              {(!user.roles || !user.roles.some(r => r.includes('admin'))) && (
                                <>
                                  <button onClick={() => { setOpenDropdownId(null); setActionUser(user); setIsResetModalOpen(true); }} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-violet-500 transition-colors">Reset Password</button>
                                  <button onClick={() => { setOpenDropdownId(null); setActionUser(user); setIsDeleteModalOpen(true); }} className="w-full text-left px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 transition-colors">Delete User</button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
      
      <ImportUsersModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => {
          setIsImportModalOpen(false);
          fetchUsers();
        }}
      />

      {/* Edit User Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h2 className="font-heading text-lg font-bold text-slate-800">Edit User</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">Full Name</label>
                <input type="text" required value={editForm.fullName} onChange={(e) => setEditForm({...editForm, fullName: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">Department</label>
                <input type="text" value={editForm.department} onChange={(e) => setEditForm({...editForm, department: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">Role</label>
                <input type="text" readOnly value={editForm.role} className="w-full bg-slate-50 text-slate-500 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold uppercase tracking-wider cursor-not-allowed" />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-5 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
                <button type="submit" className="btn-primary px-5 py-2 rounded-xl text-sm font-bold shadow-pastel-glow">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden text-center p-8">
            {!tempPassword ? (
              <>
                <div className="w-16 h-16 bg-yellow-100 text-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                </div>
                <h2 className="font-heading text-xl font-bold text-slate-800 mb-2">Reset Password</h2>
                <p className="text-sm text-slate-500 mb-6 font-quicksand">Are you sure you want to generate a new temporary password for <strong>{actionUser?.fullName}</strong>?</p>
                <div className="flex justify-center gap-3">
                  <button onClick={() => setIsResetModalOpen(false)} className="px-5 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
                  <button onClick={handleResetPassword} className="btn-primary px-5 py-2 rounded-xl text-sm font-bold shadow-pastel-glow">Yes, Reset</button>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h2 className="font-heading text-xl font-bold text-slate-800 mb-2">Password reset successful.</h2>
                <div className="text-left bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
                  <p className="text-sm font-bold text-slate-700 mb-2">User: <span className="font-normal">{actionUser?.fullName}</span></p>
                  <p className="text-sm font-bold text-slate-700">New Temporary Password:</p>
                  <div className="mt-1 mb-3 text-lg font-mono font-bold text-violet-600 tracking-wide">
                    {tempPassword}
                  </div>
                  <p className="text-xs font-bold text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-200">
                    User must change this password during next login.
                  </p>
                </div>
                <button onClick={() => { setIsResetModalOpen(false); setTempPassword(''); }} className="btn-primary w-full py-3 rounded-xl text-sm font-bold shadow-pastel-glow">Done</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden text-center p-8">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h2 className="font-heading text-xl font-bold text-slate-800 mb-2">Delete User?</h2>
            <p className="text-sm text-slate-500 mb-2 font-quicksand">Are you sure you want to permanently delete <strong>{actionUser?.fullName}</strong>?</p>
            <p className="text-xs text-red-500 font-bold mb-6">This action cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setIsDeleteModalOpen(false)} className="px-5 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
              <button onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-pastel-glow transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 bg-red-50/50 flex justify-between items-center">
              <h2 className="font-heading text-lg font-bold text-red-600 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Confirm Bulk User Deletion
              </h2>
              <button onClick={() => setIsBulkDeleteModalOpen(false)} className="text-slate-400 hover:text-slate-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm font-semibold text-slate-800">
                Are you sure you want to permanently delete <span className="font-bold text-red-600">{selectedUserIds.length} selected user account(s)</span>?
              </p>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-start gap-2">
                <span>🛡️</span>
                <span><strong>Admin Protection Guaranteed:</strong> The Administrator account is protected and will NOT be deleted.</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                ℹ️ This action will only remove the user credentials. Application events, registrations, teams, certificates, and attendance data will remain completely intact.
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBulkDeleteModalOpen(false)}
                  className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkDeleteSubmit}
                  disabled={bulkDeleting}
                  className="bg-red-500 hover:bg-red-600 text-white px-6 py-2.5 text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  {bulkDeleting ? 'Deleting Users...' : `Delete ${selectedUserIds.length} Users`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminUsers;
