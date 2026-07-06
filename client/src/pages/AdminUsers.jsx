import { useState, useEffect } from 'react';
import axios from 'axios';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [selectedRole, setSelectedRole] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredUsers = users.filter(user => {
    const matchesRole = selectedRole 
      ? user.roles?.some(r => r.toLowerCase().includes(selectedRole.toLowerCase())) 
      : true;
    
    const query = searchQuery.toLowerCase();
    const matchesSearch = searchQuery
      ? user.fullName.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)
      : true;

    return matchesRole && matchesSearch;
  });

  return (
    <div className="flex-grow py-20 text-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-10 animate-fade-in-up">
          <h1 className="font-display text-3xl font-black text-text-primary">Registered <span className="heading-gradient">Accounts</span></h1>
          <p className="font-body text-slate-600 text-sm mt-1.5">Audit and search registered students and administrators</p>
        </div>

        {/* Filters Panel */}
        <div className="animate-fade-in-up delay-100 glass-panel rounded-2xl p-5 sm:p-6 mb-10 flex flex-col md:flex-row items-center gap-5 justify-between">
          
          {/* Role Filter */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] whitespace-nowrap">Filter Role</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="bg-white/60 text-slate-700 border border-slate-300/50 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:border-violet-500/60 transition-all duration-300 w-full md:w-48 cursor-pointer"
            >
              <option value="">All Roles</option>
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          {/* User Search */}
          <div className="relative w-full md:w-80 group">
            <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-600 group-focus-within:text-violet-400 transition-colors duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search user name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/60 text-slate-800 placeholder-slate-600 border border-slate-300/50 rounded-xl py-2.5 pl-11 pr-4 text-sm font-medium focus:outline-none focus:border-violet-500/60 transition-all duration-300"
            />
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
                    <th className="px-6 py-4">Full Name</th>
                    <th className="px-6 py-4">Email Address</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Proposed</th>
                    <th className="px-6 py-4">Organizing</th>
                    <th className="px-6 py-4">Registered</th>
                    <th className="px-6 py-4">Joined Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30 text-sm font-body">
                  {filteredUsers.map((user, i) => (
                    <tr 
                      key={user.id || user._id} 
                      className="hover:bg-white/20 transition-all duration-300 animate-fade-in-up"
                      style={{ animationDelay: `${i * 40 + 250}ms` }}
                    >
                      <td className="px-6 py-4 font-display font-bold text-slate-800">
                        {user.fullName}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-600 text-xs">
                        {user.email}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${
                          user.roles?.some(r => r.includes('admin')) 
                            ? 'bg-violet-500/8 text-violet-400 border-violet-500/15' 
                            : user.roles?.some(r => r.includes('faculty'))
                              ? 'bg-sky-500/8 text-sky-400 border-sky-500/15'
                              : 'bg-white/40 text-slate-600 border-slate-300/30'
                        }`}>
                          {user.roles?.some(r => r.includes('admin')) ? 'Admin' 
                           : user.roles?.some(r => r.includes('faculty')) ? 'Faculty' 
                           : 'Student'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-600 text-xs">
                        {user.roles?.some(r => r.includes('admin')) || user.roles?.some(r => r.includes('faculty')) ? '—' : `${user.proposedCount || 0} events`}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-600 text-xs">
                        {user.roles?.some(r => r.includes('admin')) || user.roles?.some(r => r.includes('faculty')) ? '—' : `${user.organizedCount || 0} events`}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-600 text-xs">
                        {user.roles?.some(r => r.includes('admin')) ? '—' : `${user.registrationCount || 0} bookings`}
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-xs">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        }) : 'Predefined'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminUsers;
