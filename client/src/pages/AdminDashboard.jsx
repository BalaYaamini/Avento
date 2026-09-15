import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SparkleDoodle, PinDoodle, StickyNoteDoodle } from '../components/Doodles';

const AdminDashboard = () => {
  const { user } = useAuth();
  const isAventoAdmin = user?.email === 'admin.avento@gmail.com';

  // ── SUPER ADMIN (Avento Admin) STATE ──────────────────────────────────────
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalUsers: 0,
    totalRegistrations: 0,
    activeEvents: 0
  });
  const [recentEvents, setRecentEvents] = useState([]);

  // ── HIGHER OFFICIAL STATE ────────────────────────────────────────────────
  const [activeOfficialTab, setActiveOfficialTab] = useState('proposals'); // 'proposals' | 'events'
  const [permissions, setPermissions] = useState([]);
  const [events, setEvents] = useState([]);
  const [proposalFilter, setProposalFilter] = useState('pending'); // 'all' | 'pending' | 'granted' | 'revision_requested' | 'rejected'
  const [eventFilter, setEventFilter] = useState('happening'); // 'happening' | 'upcoming' | 'all'
  const [searchQuery, setSearchQuery] = useState('');

  // Decision Modal State
  const [selectedPerm, setSelectedPerm] = useState(null);
  const [decisionAction, setDecisionAction] = useState('granted');
  const [decisionRemarks, setDecisionRemarks] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  // Common State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHigherOfficialData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [permRes, eventsRes] = await Promise.all([
        axios.get('/api/events/official-permissions/all').catch(() => ({ data: [] })),
        axios.get('/api/events').catch(() => ({ data: [] }))
      ]);

      setPermissions(Array.isArray(permRes.data) ? permRes.data : []);
      setEvents(Array.isArray(eventsRes.data) ? eventsRes.data : []);
    } catch (err) {
      console.error('Failed to load official dashboard data:', err);
      setError('Unable to load dashboard data. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuperAdminData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [eventsRes, usersRes, regsRes] = await Promise.all([
        axios.get('/api/events'),
        axios.get('/api/users'),
        axios.get('/api/registrations/all')
      ]);

      const evts = eventsRes.data || [];
      const usrs = usersRes.data || [];
      const registrations = regsRes.data || [];

      setStats({
        totalEvents: evts.length,
        totalUsers: usrs.length,
        totalRegistrations: registrations.length,
        activeEvents: evts.filter(e => e.status === 'active').length
      });

      const sorted = [...evts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setRecentEvents(sorted.slice(0, 3));
    } catch (err) {
      console.error(err);
      setError('Failed to aggregate dashboard metrics. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAventoAdmin) {
      fetchSuperAdminData();
    } else {
      fetchHigherOfficialData();
    }
  }, [isAventoAdmin]);

  const handleDecisionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPerm) return;

    try {
      setSubmittingDecision(true);
      await axios.put(`/api/events/${selectedPerm.proposal_id}/official-permission/${selectedPerm.id}/decision`, {
        status: decisionAction,
        remarks: decisionRemarks.trim()
      });

      alert(`Permission request successfully ${decisionAction === 'granted' ? 'approved' : (decisionAction === 'rejected' ? 'denied' : 'marked for revision')}.`);
      setSelectedPerm(null);
      setDecisionRemarks('');
      fetchHigherOfficialData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit decision.');
    } finally {
      setSubmittingDecision(false);
    }
  };

  const getFileUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    return axios.defaults.baseURL ? `${axios.defaults.baseURL}${url}` : `http://localhost:5001${url}`;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'granted':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Permission Granted
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Permission Denied
          </span>
        );
      case 'revision_requested':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Revision Requested
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-violet-50 text-violet-700 border border-violet-200">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse"></span>
            Pending Official Review
          </span>
        );
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: HIGHER OFFICIAL CONSOLE (Simple, Focused & Clean)
  // ══════════════════════════════════════════════════════════════════════════
  if (!isAventoAdmin) {
    const pendingPerms = permissions.filter(p => p.status === 'pending');
    const grantedPerms = permissions.filter(p => p.status === 'granted');
    const happeningEvents = events.filter(e => e.status === 'active' || e.status === 'published');
    const upcomingEvents = events.filter(e => {
      if (!e.date) return false;
      return new Date(e.date) >= new Date();
    });

    const filteredPermissions = permissions.filter(p => {
      if (proposalFilter !== 'all' && p.status !== proposalFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const title = (p.event?.title || p.subject || '').toLowerCase();
      const proposer = (p.event?.proposer?.name || p.requested_by_user?.name || '').toLowerCase();
      const faculty = (p.event?.faculty?.name || '').toLowerCase();
      return title.includes(q) || proposer.includes(q) || faculty.includes(q);
    });

    const filteredEvents = events.filter(e => {
      if (eventFilter === 'happening') {
        if (e.status !== 'active' && e.status !== 'published') return false;
      } else if (eventFilter === 'upcoming') {
        if (!e.date || new Date(e.date) < new Date()) return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const title = (e.title || '').toLowerCase();
      const cat = (e.category || '').toLowerCase();
      const venue = (e.venue || '').toLowerCase();
      return title.includes(q) || cat.includes(q) || venue.includes(q);
    });

    return (
      <div className="flex-grow py-10 px-4 sm:px-6 lg:px-8 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* Header Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-violet-50 text-violet-700 border border-violet-200">
                  Executive Console
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {user?.department || 'University Administration'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-black text-slate-900">
                Welcome, {user?.fullName || user?.name || 'Higher Official'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 max-w-xl">
                Quickly review incoming event proposals for administrative clearance and oversee active campus events.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={fetchHigherOfficialData}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh Data
              </button>
            </div>
          </div>

          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Metric 1: Pending Proposals */}
            <button
              onClick={() => { setActiveOfficialTab('proposals'); setProposalFilter('pending'); }}
              className={`p-6 rounded-2xl border text-left transition-all cursor-pointer shadow-2xs ${
                activeOfficialTab === 'proposals' && proposalFilter === 'pending'
                  ? 'bg-violet-50/80 border-violet-300 ring-2 ring-violet-500/20'
                  : 'bg-white border-slate-200 hover:border-violet-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Pending Clearances</span>
                <span className={`w-2.5 h-2.5 rounded-full ${pendingPerms.length > 0 ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'}`}></span>
              </div>
              <p className="text-3xl font-display font-black text-slate-900 mt-3">{pendingPerms.length}</p>
              <p className="text-xs font-medium text-slate-500 mt-1">
                {pendingPerms.length === 1 ? '1 proposal awaiting review' : `${pendingPerms.length} proposals awaiting review`}
              </p>
            </button>

            {/* Metric 2: Granted Approvals */}
            <button
              onClick={() => { setActiveOfficialTab('proposals'); setProposalFilter('granted'); }}
              className={`p-6 rounded-2xl border text-left transition-all cursor-pointer shadow-2xs ${
                activeOfficialTab === 'proposals' && proposalFilter === 'granted'
                  ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20'
                  : 'bg-white border-slate-200 hover:border-emerald-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Permissions Granted</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              </div>
              <p className="text-3xl font-display font-black text-slate-900 mt-3">{grantedPerms.length}</p>
              <p className="text-xs font-medium text-slate-500 mt-1">Approved event proposals</p>
            </button>

            {/* Metric 3: Campus Events */}
            <button
              onClick={() => { setActiveOfficialTab('events'); setEventFilter('happening'); }}
              className={`p-6 rounded-2xl border text-left transition-all cursor-pointer shadow-2xs ${
                activeOfficialTab === 'events'
                  ? 'bg-fuchsia-50/80 border-fuchsia-300 ring-2 ring-fuchsia-500/20'
                  : 'bg-white border-slate-200 hover:border-fuchsia-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Campus Events</span>
                <span className="w-2.5 h-2.5 rounded-full bg-fuchsia-500"></span>
              </div>
              <p className="text-3xl font-display font-black text-slate-900 mt-3">{happeningEvents.length}</p>
              <p className="text-xs font-medium text-slate-500 mt-1">Live & active campus events</p>
            </button>
          </div>

          {/* Main Content Area */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            
            {/* Navigation Tab Bar & Search */}
            <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              {/* Main Tabs */}
              <div className="flex items-center gap-2 p-1 bg-slate-100/80 rounded-2xl shrink-0">
                <button
                  type="button"
                  onClick={() => { setActiveOfficialTab('proposals'); setSearchQuery(''); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeOfficialTab === 'proposals'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Event Proposals</span>
                  {pendingPerms.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white">
                      {pendingPerms.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setActiveOfficialTab('events'); setSearchQuery(''); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeOfficialTab === 'events'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <svg className="w-4 h-4 text-fuchsia-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Campus Events</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                    {happeningEvents.length}
                  </span>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={activeOfficialTab === 'proposals' ? "Search proposals by title, student, or faculty..." : "Search events by title, category, venue..."}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Sub-Filters */}
            <div className="px-6 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2 overflow-x-auto scrollbar-none">
              {activeOfficialTab === 'proposals' ? (
                <>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-2 shrink-0">Filter:</span>
                  {[
                    { id: 'all', label: 'All Proposals', count: permissions.length },
                    { id: 'pending', label: 'Pending Review', count: pendingPerms.length },
                    { id: 'granted', label: 'Permission Granted', count: grantedPerms.length },
                    { id: 'revision_requested', label: 'Revision Needed', count: permissions.filter(p => p.status === 'revision_requested').length },
                    { id: 'rejected', label: 'Denied', count: permissions.filter(p => p.status === 'rejected').length }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setProposalFilter(f.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        proposalFilter === f.id
                          ? 'bg-violet-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {f.label} ({f.count})
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-2 shrink-0">Filter:</span>
                  {[
                    { id: 'happening', label: 'Live & Active Events', count: happeningEvents.length },
                    { id: 'upcoming', label: 'Upcoming Events', count: upcomingEvents.length },
                    { id: 'all', label: 'All Campus Events', count: events.length }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setEventFilter(f.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        eventFilter === f.id
                          ? 'bg-fuchsia-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {f.label} ({f.count})
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Content Display */}
            <div className="p-6">
              {loading ? (
                <div className="py-16 text-center text-slate-400 space-y-3">
                  <div className="w-8 h-8 border-3 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs font-bold text-slate-500">Loading records...</p>
                </div>
              ) : error ? (
                <div className="p-6 text-center text-rose-600 bg-rose-50 rounded-2xl text-xs font-bold">
                  {error}
                </div>
              ) : activeOfficialTab === 'proposals' ? (
                /* ── PROPOSALS LIST ── */
                filteredPermissions.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 space-y-2">
                    <p className="font-bold text-sm text-slate-700">No event proposals found</p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      {searchQuery ? 'Try adjusting your search criteria.' : 'No proposals match the selected status filter.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredPermissions.map(perm => {
                      const attachments = Array.isArray(perm.attachments) ? perm.attachments : [];
                      return (
                        <div
                          key={perm.id}
                          className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-4 hover:border-violet-300 transition-all"
                        >
                          {/* Top Row: Badges & Proposer info */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {getStatusBadge(perm.status)}
                                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
                                  {perm.event?.category || 'Event'}
                                </span>
                                <span className="text-xs text-slate-400">
                                  Submitted {new Date(perm.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                              </div>
                              <h3 className="text-base font-bold text-slate-900 mt-1">
                                {perm.subject || perm.event?.title || 'Formal Event Proposal'}
                              </h3>
                              <p className="text-xs text-slate-500">
                                Event: <strong className="text-slate-800">{perm.event?.title || 'Proposed Event'}</strong>
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Action: Open Workspace */}
                              <Link
                                to={`/proposals/${perm.proposal_id}`}
                                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                              >
                                View Workspace
                              </Link>

                              {/* Action: Review Decision */}
                              <button
                                onClick={() => {
                                  setSelectedPerm(perm);
                                  setDecisionAction(perm.status === 'pending' ? 'granted' : perm.status);
                                  setDecisionRemarks(perm.official_remarks || '');
                                }}
                                className="btn-primary px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-95 transition-all cursor-pointer shrink-0"
                              >
                                Review & Decide
                              </button>
                            </div>
                          </div>

                          {/* Coordinator Details & Letter Excerpt */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Student Proposer</span>
                              <div className="font-bold text-slate-800">{perm.requested_by_user?.name || perm.event?.proposer?.name || 'Student Coordinator'}</div>
                              <div className="text-slate-500 text-[11px]">{perm.requested_by_user?.department || 'Coordinator'}</div>
                            </div>

                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Faculty In-Charge</span>
                              <div className="font-bold text-slate-800">{perm.event?.faculty?.name || 'Assigned Faculty Coordinator'}</div>
                              <div className="text-slate-500 text-[11px]">{perm.event?.faculty?.department || 'Department Lead'}</div>
                            </div>

                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Supporting Documents</span>
                              <div className="font-bold text-slate-800">{attachments.length} Document(s) Attached</div>
                              <div className="text-slate-500 text-[11px]">Agenda, Budget, Circulars</div>
                            </div>
                          </div>

                          {/* Letter Body Preview */}
                          <div className="p-4 bg-slate-50/60 rounded-xl border border-slate-200/60 text-xs text-slate-700 leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap font-sans">
                            {perm.proposal_letter || 'No proposal letter text provided.'}
                          </div>

                          {/* Attachments pills */}
                          {attachments.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <span className="text-[11px] font-bold uppercase text-slate-400 mr-1">Attachments:</span>
                              {attachments.map((file, idx) => (
                                <a
                                  key={idx}
                                  href={getFileUrl(file.file_url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs inline-flex items-center gap-1.5 transition-colors"
                                  download
                                >
                                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  <span className="truncate max-w-xs">{file.file_name}</span>
                                </a>
                              ))}
                            </div>
                          )}

                          {/* Past Decision Remarks */}
                          {perm.decided_at && (
                            <div className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                              perm.status === 'granted'
                                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                                : perm.status === 'rejected'
                                ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                                : 'bg-amber-50/80 border-amber-200 text-amber-900'
                            }`}>
                              <div className="flex items-center justify-between font-bold">
                                <span>Official Decision Remarks:</span>
                                <span className="text-[10px] font-normal opacity-75">
                                  Decided on {new Date(perm.decided_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="mt-1 leading-relaxed font-medium">
                                {perm.official_remarks || 'Permission decision recorded.'}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                /* ── HAPPENING EVENTS GRID ── */
                filteredEvents.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 space-y-2">
                    <p className="font-bold text-sm text-slate-700">No events found</p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      {searchQuery ? 'Try searching for another event title or category.' : 'No events match the selected filter.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEvents.map(evt => (
                      <div
                        key={evt._id || evt.id}
                        className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col hover:border-fuchsia-300 transition-all group"
                      >
                        {/* Event Thumbnail */}
                        <div className="h-44 bg-slate-100 relative overflow-hidden">
                          {evt.imageUrl ? (
                            <img
                              src={evt.imageUrl}
                              alt={evt.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                          <div className="absolute top-3 left-3">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/90 text-slate-800 backdrop-blur-xs shadow-xs uppercase tracking-wider">
                              {evt.category || 'Event'}
                            </span>
                          </div>
                          <div className="absolute top-3 right-3">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold shadow-xs uppercase tracking-wider ${
                              evt.status === 'active' || evt.status === 'published'
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-700 text-white'
                            }`}>
                              {evt.status === 'active' || evt.status === 'published' ? 'Active / Live' : evt.status}
                            </span>
                          </div>
                        </div>

                        {/* Event Body */}
                        <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                          <div className="space-y-2">
                            <h4 className="font-display font-bold text-base text-slate-900 line-clamp-1 group-hover:text-fuchsia-600 transition-colors">
                              {evt.title}
                            </h4>
                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                              {evt.description || 'No description provided.'}
                            </p>
                          </div>

                          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>{evt.date ? new Date(evt.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span className="truncate">{evt.venue || 'Campus Venue'}</span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
                              <span>Registration Type: <strong>{evt.registration_type === 'team' ? 'Team Event' : 'Individual'}</strong></span>
                              <span>{evt.registeredCount || 0} / {evt.capacity || 0} booked</span>
                            </div>
                          </div>

                          {/* Link */}
                          <div className="pt-2">
                            <Link
                              to={`/workspace/${evt._id || evt.id}`}
                              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
                            >
                              <span>View Workspace Details</span>
                              <span>→</span>
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>

        </div>

        {/* ── DECISION MODAL ── */}
        {selectedPerm && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col animate-scale-up">
              
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-900">
                    Official Proposal Review & Decision
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Proposal: <strong className="text-slate-800">{selectedPerm.event?.title || selectedPerm.subject}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPerm(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <form onSubmit={handleDecisionSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
                
                {/* Proposal Letter text */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Proposal Letter Submitted:
                  </label>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto font-sans">
                    {selectedPerm.proposal_letter}
                  </div>
                </div>

                {/* Attachments */}
                {Array.isArray(selectedPerm.attachments) && selectedPerm.attachments.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Attached Documents ({selectedPerm.attachments.length}):
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {selectedPerm.attachments.map((file, idx) => (
                        <a
                          key={idx}
                          href={getFileUrl(file.file_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors"
                          download
                        >
                          <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>{file.file_name}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Decision Action Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Official Administrative Decision *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className={`flex items-center gap-2 p-3.5 rounded-xl border cursor-pointer text-xs font-bold transition-all ${
                      decisionAction === 'granted'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500/20'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}>
                      <input
                        type="radio"
                        name="officialDecision"
                        value="granted"
                        checked={decisionAction === 'granted'}
                        onChange={(e) => setDecisionAction(e.target.value)}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Grant Permission</span>
                    </label>

                    <label className={`flex items-center gap-2 p-3.5 rounded-xl border cursor-pointer text-xs font-bold transition-all ${
                      decisionAction === 'revision_requested'
                        ? 'bg-amber-50 text-amber-800 border-amber-300 ring-2 ring-amber-500/20'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}>
                      <input
                        type="radio"
                        name="officialDecision"
                        value="revision_requested"
                        checked={decisionAction === 'revision_requested'}
                        onChange={(e) => setDecisionAction(e.target.value)}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      <span>Request Revision</span>
                    </label>

                    <label className={`flex items-center gap-2 p-3.5 rounded-xl border cursor-pointer text-xs font-bold transition-all ${
                      decisionAction === 'rejected'
                        ? 'bg-rose-50 text-rose-800 border-rose-300 ring-2 ring-rose-500/20'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}>
                      <input
                        type="radio"
                        name="officialDecision"
                        value="rejected"
                        checked={decisionAction === 'rejected'}
                        onChange={(e) => setDecisionAction(e.target.value)}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span>Deny Permission</span>
                    </label>
                  </div>
                </div>

                {/* Remarks */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Official Decision Remarks / Directives
                  </label>
                  <textarea
                    rows={4}
                    value={decisionRemarks}
                    onChange={(e) => setDecisionRemarks(e.target.value)}
                    placeholder="Enter clearance instructions, budget approvals, venue conditions, or reasons for revision..."
                    className="w-full p-3.5 text-xs bg-white border border-slate-300 text-slate-800 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:outline-none transition-all leading-relaxed"
                  />
                </div>

                {/* Footer buttons */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedPerm(null)}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingDecision}
                    className="btn-primary px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {submittingDecision ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Saving Decision...</span>
                      </>
                    ) : (
                      <span>Confirm & Record Decision</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: AVENTO PLATFORM SUPER ADMIN VIEW
  // ══════════════════════════════════════════════════════════════════════════
  const cardDetails = [
    {
      title: 'Total Events',
      value: stats.totalEvents,
      subtitle: `${stats.activeEvents} Active / Open`,
      bgColor: 'bg-pastel-lavender/20',
      borderColor: 'border-pastel-lavender/50',
      iconColor: 'text-pastel-lavender',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      rotation: 'rotate-1'
    },
    {
      title: 'Registered Users',
      value: stats.totalUsers,
      subtitle: 'Students, Faculty & Admins',
      bgColor: 'bg-pastel-mint/30',
      borderColor: 'border-pastel-mint/80',
      iconColor: 'text-green-600',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      rotation: '-rotate-2'
    },
    {
      title: 'Total Registrations',
      value: stats.totalRegistrations,
      subtitle: 'Successful seat bookings',
      bgColor: 'bg-pastel-yellow/30',
      borderColor: 'border-pastel-yellow/80',
      iconColor: 'text-yellow-600',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      rotation: 'rotate-2'
    }
  ];

  const shortcuts = [
    { label: 'Configure & Create Events', to: '/admin/events', arrow: 'text-pastel-lavender' },
    { label: 'Review Official Permissions', to: '/admin/permissions', arrow: 'text-pastel-lavender' },
    { label: 'View Booked Registrations', to: '/admin/registrations', arrow: 'text-pastel-mint' },
    { label: 'Manage Portal Users', to: '/admin/users', arrow: 'text-pastel-pink' },
    { label: 'Post Announcements', to: '/admin/announcements', arrow: 'text-pastel-coral' }
  ];

  return (
    <div className="flex-grow py-20 bg-background relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-pastel-lavender/30 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-float"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="mb-10 animate-fade-in-up flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SparkleDoodle className="w-10 h-10 text-pastel-lavender" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-4xl font-black text-text-primary">
                  Avento Admin <span className="marker-highlight">Console</span>
                </h1>
                <span className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-700 border border-amber-300">
                  Platform Super Admin
                </span>
              </div>
              <p className="font-quicksand font-bold text-text-secondary text-sm mt-1.5">
                Master platform administrative controls & universal oversight across all events and permissions
              </p>
            </div>
          </div>
        </div>

        {/* Dashboard Card Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="polaroid h-36 animate-pulse glass-panel" />
            ))}
          </div>
        ) : error ? (
          <div className="mb-10 p-4 bg-pastel-coral/20 border-2 border-pastel-coral text-red-500 rounded-2xl text-sm font-bold font-quicksand animate-fade-in-up">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {cardDetails.map((card, idx) => (
              <div 
                key={idx} 
                className={`animate-fade-in-up polaroid relative p-6 flex items-center justify-between group cursor-default ${card.rotation}`}
                style={{ animationDelay: `${idx * 100 + 100}ms` }}
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 tape tape-1 !w-16"></div>
                <div>
                  <h3 className="text-text-secondary text-[10px] font-bold uppercase tracking-[0.1em] font-quicksand">{card.title}</h3>
                  <p className="text-4xl font-heading font-black text-text-primary mt-2">{card.value}</p>
                  <p className="text-text-secondary text-xs mt-1.5 font-bold font-quicksand">{card.subtitle}</p>
                </div>
                <div className={`h-14 w-14 rounded-2xl ${card.bgColor} border-2 ${card.borderColor} flex items-center justify-center ${card.iconColor} group-hover:scale-110 transition-transform duration-300`}>
                  {card.icon}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Panel / Recent Activity split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Admin shortcuts */}
          <div className="animate-fade-in-up delay-400 polaroid p-6 lg:col-span-1 flex flex-col justify-between relative -rotate-1">
            <PinDoodle className="absolute -top-4 right-4 w-8 h-8 text-pastel-pink" />
            <div>
              <h3 className="text-sm font-heading font-bold text-text-primary uppercase tracking-[0.15em] mb-4">Management Control Panel</h3>
              <p className="text-xs font-body text-text-secondary leading-relaxed mb-6 font-medium">Use these shortcuts to add events, view lists of registered students, or oversee users.</p>
            </div>
            <div className="space-y-3">
              {shortcuts.map((item, i) => (
                <Link 
                  key={i}
                  to={item.to} 
                  className="flex items-center justify-between p-4 rounded-2xl glass-panel border-2 border-slate-200 hover:border-pastel-lavender/50 hover:bg-pastel-lavender/10 text-text-primary font-bold font-quicksand text-xs transition-all duration-300 group/link shadow-sm"
                >
                  <span>{item.label}</span>
                  <span className={`${item.arrow} group-hover/link:translate-x-1 transition-transform duration-300`}>→</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Events */}
          <div className="animate-fade-in-up delay-500 polaroid p-6 lg:col-span-2 relative rotate-1">
            <div className="absolute -top-3 left-10 tape tape-2 !w-24"></div>
            <h3 className="text-sm font-heading font-bold text-text-primary uppercase tracking-[0.15em] mb-5">Recently Published Events</h3>
            {loading ? (
              <div className="space-y-4 animate-pulse">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="h-20 glass-panel rounded-2xl border-2 border-slate-200" />
                ))}
              </div>
            ) : recentEvents.length === 0 ? (
              <div className="text-center py-12 glass-panel rounded-2xl border-2 border-slate-200 border-dashed">
                <p className="text-sm text-text-secondary font-bold font-quicksand">No events published yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentEvents.map((evt, i) => (
                  <div 
                    key={evt._id || evt.id} 
                    className="animate-fade-in-up flex items-center justify-between p-4 glass-panel rounded-2xl border-2 border-slate-200 hover:border-pastel-pink/50 hover:bg-pastel-pink/5 shadow-sm transition-all duration-300 group"
                    style={{ animationDelay: `${i * 80 + 600}ms` }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-16 rounded-xl overflow-hidden border-2 border-slate-100">
                         <img src={evt.imageUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div>
                        <h4 className="text-sm font-heading font-bold text-text-primary line-clamp-1 group-hover:text-pastel-lavender transition-colors">{evt.title}</h4>
                        <p className="text-[10px] text-text-secondary mt-1 font-bold font-quicksand uppercase tracking-wider">{evt.category} &bull; {new Date(evt.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-xl border-2 ${
                        evt.status === 'active' 
                          ? 'bg-pastel-mint/30 text-green-700 border-pastel-mint' 
                          : 'bg-pastel-coral/20 text-red-500 border-pastel-coral'
                      }`}>
                        {evt.status}
                      </span>
                      <p className="text-[10px] text-text-secondary font-bold font-quicksand mt-2 uppercase tracking-wider">
                        {evt.registration_type === 'team' ? 'Team Event' : `${evt.registeredCount} / ${evt.capacity} booked`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;
