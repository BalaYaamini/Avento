import { useState, useEffect } from 'react';
import axios from 'axios';

const AdminRegistrations = () => {
  const [registrations, setRegistrations] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [selectedEventId, setSelectedEventId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [cancellingId, setCancellingId] = useState(null);

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
      // Remove local copy from screen
      setRegistrations(prev => prev.filter(reg => reg._id !== regId));
      alert('Registration successfully revoked.');
    } catch (err) {
      console.error(err);
      alert('Failed to cancel registration.');
    } finally {
      setCancellingId(null);
    }
  };

  // Filter registrations list dynamically
  const filteredRegistrations = registrations.filter(reg => {
    const evt = reg.eventId;
    const usr = reg.userId;
    if (!evt || !usr) return false; // filter out orphaned registrations

    const regEventId = evt._id || evt.id;
    const matchesEvent = selectedEventId ? String(regEventId) === String(selectedEventId) : true;

    const query = searchQuery.toLowerCase();
    const matchesSearch = searchQuery
      ? usr.fullName.toLowerCase().includes(query) || usr.email.toLowerCase().includes(query) || evt.title.toLowerCase().includes(query)
      : true;

    return matchesEvent && matchesSearch;
  });

  return (
    <div className="flex-grow py-20 text-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-10 animate-fade-in-up">
          <h1 className="font-display text-3xl font-black text-text-primary">Event <span className="heading-gradient">Registrations</span></h1>
          <p className="font-body text-slate-600 text-sm mt-1.5">Review student roster bookings and revoke seats</p>
        </div>

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
                    <th className="px-6 py-4">Registered Event</th>
                    <th className="px-6 py-4">Booking Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30 text-sm font-body">
                  {filteredRegistrations.map((reg, i) => (
                    <tr 
                      key={reg._id} 
                      className="hover:bg-white/20 transition-all duration-300 animate-fade-in-up"
                      style={{ animationDelay: `${i * 40 + 250}ms` }}
                    >
                      <td className="px-6 py-4 font-display font-bold text-slate-800">
                        {reg.userId.fullName}
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
                      <td className="px-6 py-4 font-semibold text-slate-700 line-clamp-1 text-xs">
                        {reg.eventId.title}
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-xs">
                        {new Date(reg.registrationDate || reg.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleCancelRegistration(reg._id, reg.userId.fullName, reg.eventId.title)}
                          disabled={cancellingId === reg._id}
                          className="px-4 py-1.5 text-xs font-bold rounded-lg bg-red-500/8 text-red-400 border border-red-500/15 hover:bg-red-500/15 hover:border-red-500/30 transition-all duration-300 disabled:opacity-50"
                        >
                          {cancellingId === reg._id ? 'Revoking...' : 'Revoke Booking'}
                        </button>
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

export default AdminRegistrations;
