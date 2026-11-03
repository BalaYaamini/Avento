import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SparkleDoodle, StickyNoteDoodle } from '../components/Doodles';

const AdminPermissions = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('all'); // 'all', 'pending', 'granted', 'rejected'
  const [searchQuery, setSearchQuery] = useState('');

  // Selected permission for detail modal / decision
  const [selectedPerm, setSelectedPerm] = useState(null);
  const [decisionModalMode, setDecisionModalMode] = useState(null); // 'view', 'decision'
  const [decisionAction, setDecisionAction] = useState('granted'); // 'granted', 'rejected', 'revision_requested'
  const [decisionRemarks, setDecisionRemarks] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get('/api/events/official-permissions/all');
      setPermissions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching official permissions:', err);
      setError(err.response?.data?.message || 'Failed to load higher official permission requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const handleDecisionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPerm) return;

    try {
      setSubmittingDecision(true);
      await axios.put(`/api/events/${selectedPerm.proposal_id}/official-permission/${selectedPerm.id}/decision`, {
        status: decisionAction,
        remarks: decisionRemarks.trim()
      });

      alert(`Permission request successfully ${decisionAction === 'granted' ? 'granted' : (decisionAction === 'rejected' ? 'rejected' : 'marked for revision')}.`);
      setSelectedPerm(null);
      setDecisionRemarks('');
      fetchPermissions();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit permission decision.');
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Permission Granted
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            Permission Denied
          </span>
        );
      case 'revision_requested':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Revision Requested
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-violet-100 text-violet-800 border border-violet-300">
            <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse"></span>
            Pending Official Review
          </span>
        );
    }
  };

  const filteredPermissions = permissions.filter(p => {
    if (selectedFilter !== 'all' && p.status !== selectedFilter) return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const title = (p.event?.title || p.subject || '').toLowerCase();
    const proposer = (p.event?.proposer?.name || p.requested_by_user?.name || '').toLowerCase();
    const faculty = (p.event?.faculty?.name || '').toLowerCase();
    const official = (p.official_user?.name || '').toLowerCase();
    return title.includes(query) || proposer.includes(query) || faculty.includes(query) || official.includes(query);
  });

  const pendingCount = permissions.filter(p => p.status === 'pending').length;
  const grantedCount = permissions.filter(p => p.status === 'granted').length;
  const rejectedCount = permissions.filter(p => p.status === 'rejected').length;

  return (
    <div className="flex-grow py-12 px-4 sm:px-6 lg:px-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-2.5 rounded-2xl bg-violet-50 text-violet-700">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-violet-700 bg-violet-50 px-3 py-1 rounded-full">
                University Authority Portal
              </span>
            </div>
            <h1 className="text-3xl font-display font-black text-slate-900">
              Higher Official <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600">Permissions</span>
            </h1>
            <p className="text-sm text-slate-500 max-w-2xl">
              Review formal proposal letters and attached event documents submitted by Student and Faculty Coordinators for administrative clearance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchPermissions}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <Link
              to="/admin"
              className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-xs"
            >
              Admin Dashboard
            </Link>
          </div>
        </div>

        {/* Stats and Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`p-5 rounded-2xl border transition-all text-left cursor-pointer ${
              selectedFilter === 'all'
                ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-500/20'
                : 'bg-white text-slate-700 border-slate-200 hover:border-violet-300'
            }`}
          >
            <div className="text-xs font-bold uppercase tracking-wider opacity-80">Total Requests</div>
            <div className="text-2xl font-display font-black mt-1">{permissions.length}</div>
            <div className="text-xs mt-1 opacity-75">All formal proposals</div>
          </button>

          <button
            onClick={() => setSelectedFilter('pending')}
            className={`p-5 rounded-2xl border transition-all text-left cursor-pointer ${
              selectedFilter === 'pending'
                ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-500/20'
                : 'bg-white text-slate-700 border-slate-200 hover:border-amber-300'
            }`}
          >
            <div className="text-xs font-bold uppercase tracking-wider opacity-80">Pending Decision</div>
            <div className="text-2xl font-display font-black mt-1">{pendingCount}</div>
            <div className="text-xs mt-1 opacity-75">Awaiting your approval</div>
          </button>

          <button
            onClick={() => setSelectedFilter('granted')}
            className={`p-5 rounded-2xl border transition-all text-left cursor-pointer ${
              selectedFilter === 'granted'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
                : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
            }`}
          >
            <div className="text-xs font-bold uppercase tracking-wider opacity-80">Permissions Granted</div>
            <div className="text-2xl font-display font-black mt-1">{grantedCount}</div>
            <div className="text-xs mt-1 opacity-75">Officially approved</div>
          </button>

          <button
            onClick={() => setSelectedFilter('rejected')}
            className={`p-5 rounded-2xl border transition-all text-left cursor-pointer ${
              selectedFilter === 'rejected'
                ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/20'
                : 'bg-white text-slate-700 border-slate-200 hover:border-rose-300'
            }`}
          >
            <div className="text-xs font-bold uppercase tracking-wider opacity-80">Denied / Revision</div>
            <div className="text-2xl font-display font-black mt-1">{rejectedCount}</div>
            <div className="text-xs mt-1 opacity-75">Needs changes or rejected</div>
          </button>
        </div>

        {/* Search & Filter */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 w-full relative">
            <svg className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by event title, student proposer, faculty coordinator, or official..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
            />
          </div>
        </div>

        {/* Permissions List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 bg-white rounded-3xl border border-slate-200">
            <div className="w-10 h-10 border-4 border-violet-500/20 border-t-violet-600 rounded-full animate-spin" />
            <p className="text-sm font-bold text-slate-500 mt-4">Loading Higher Official permission requests...</p>
          </div>
        ) : error ? (
          <div className="p-8 bg-red-50 text-red-700 rounded-3xl border border-red-200 text-center font-bold">
            {error}
          </div>
        ) : filteredPermissions.length === 0 ? (
          <div className="p-16 bg-white rounded-3xl border border-slate-200 text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800">No permission requests found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery ? 'No results matched your search criteria.' : 'When student or faculty coordinators request higher official permissions, they will appear here.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredPermissions.map(perm => {
              const attachments = Array.isArray(perm.attachments) ? perm.attachments : [];
              const isAssignedToMe = String(perm.official_id) === String(user?.id);

              return (
                <div 
                  key={perm.id}
                  className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6 hover:border-violet-300 transition-all relative overflow-hidden"
                >
                  {/* Top Bar: Event Badge & Status */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {perm.event?.category && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                          {perm.event.category}
                        </span>
                      )}
                      {getStatusBadge(perm.status)}
                      <span className="text-xs text-slate-400 font-medium">
                        Submitted on {new Date(perm.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedPerm(perm);
                          setDecisionModalMode('decision');
                          setDecisionAction('granted');
                          setDecisionRemarks(perm.official_remarks || '');
                        }}
                        className="btn-primary px-5 py-2 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-95 cursor-pointer flex items-center gap-1.5"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{perm.status === 'pending' ? 'Review & Decide' : 'Update Decision'}</span>
                      </button>

                      <Link
                        to={`/proposals/${perm.proposal_id}`}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                      >
                        Open Workspace
                      </Link>
                    </div>
                  </div>

                  {/* Event & Requester Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-2">
                      <h2 className="text-xl font-bold font-display text-slate-900 leading-snug">
                        {perm.event?.title || perm.subject}
                      </h2>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        {perm.event?.venue && (
                          <span className="flex items-center gap-1">
                            🏛️ {perm.event.venue}
                          </span>
                        )}
                        {perm.event?.date && (
                          <span className="flex items-center gap-1">
                            📅 {new Date(perm.event.date).toLocaleDateString()}
                          </span>
                        )}
                        <span>•</span>
                        <span>
                          Requested by: <strong className="text-slate-800">{perm.requested_by_user?.name || 'Coordinator'}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5 text-xs">
                      <div className="text-[10px] font-bold uppercase text-slate-400">Target Authority</div>
                      <div className="font-bold text-slate-800">{perm.official_user?.name || 'Higher Official'}</div>
                      <div className="text-slate-500">{perm.official_user?.department || 'University Administration'}</div>
                      <div className="text-[11px] text-slate-400">{perm.official_user?.email}</div>
                    </div>
                  </div>

                  {/* Proposal Letter Card */}
                  <div className="bg-gradient-to-br from-slate-50 to-indigo-50/20 p-6 rounded-2xl border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                        📜 Official Proposal Letter
                      </span>
                      {perm.subject && (
                        <span className="text-xs font-semibold text-slate-500 italic">
                          Subject: {perm.subject}
                        </span>
                      )}
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-slate-200/60 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                      {perm.proposal_letter}
                    </div>
                  </div>

                  {/* Attached Documents */}
                  {attachments.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        📎 Attached Proposal Documents ({attachments.length})
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {attachments.map((file, idx) => (
                          <div 
                            key={idx}
                            className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between gap-3 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-lg">📄</span>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-800 truncate">{file.file_name}</div>
                                <div className="text-[10px] text-slate-400 uppercase">{file.file_type || 'DOCUMENT'}</div>
                              </div>
                            </div>
                            <a
                              href={getFileUrl(file.file_url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg shadow-2xs shrink-0 inline-flex items-center gap-1"
                              download
                            >
                              <span>Download</span>
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Official Remarks / Decision Banner if decided */}
                  {perm.status !== 'pending' && (
                    <div className={`p-4 rounded-2xl border text-xs space-y-1 ${
                      perm.status === 'granted' 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                        : (perm.status === 'rejected' ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-amber-50 border-amber-200 text-amber-900')
                    }`}>
                      <div className="font-bold flex items-center gap-1.5">
                        <span>{perm.status === 'granted' ? '✓ Permission Granted by Authority' : '⚠ Official Decision Remarks:'}</span>
                        {perm.decided_at && (
                          <span className="font-normal opacity-75 text-[11px]">
                            • {new Date(perm.decided_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                      {perm.official_remarks && (
                        <p className="text-xs mt-1 bg-white/80 p-2.5 rounded-xl border border-slate-200/50">
                          {perm.official_remarks}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Decision Modal */}
        {selectedPerm && decisionModalMode === 'decision' && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-scale-up">
              
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-900">
                    Official Decision: {selectedPerm.event?.title || selectedPerm.subject}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Grant or deny higher authority clearance for this event proposal.
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

              {/* Form */}
              <form onSubmit={handleDecisionSubmit} className="p-6 space-y-5">
                
                {/* Decision Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Authority Action *
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setDecisionAction('granted')}
                      className={`p-3.5 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                        decisionAction === 'granted'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      <span className="text-base">✓</span>
                      <span>Grant Permission</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDecisionAction('revision_requested')}
                      className={`p-3.5 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                        decisionAction === 'revision_requested'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-500/20'
                          : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                      }`}
                    >
                      <span className="text-base">📝</span>
                      <span>Request Revision</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDecisionAction('rejected')}
                      className={`p-3.5 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                        decisionAction === 'rejected'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/20'
                          : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                      }`}
                    >
                      <span className="text-base">✕</span>
                      <span>Reject Permission</span>
                    </button>
                  </div>
                </div>

                {/* Official Remarks */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Official Authority Remarks &amp; Feedback {decisionAction !== 'granted' && '*'}
                  </label>
                  <textarea
                    rows={4}
                    required={decisionAction !== 'granted'}
                    value={decisionRemarks}
                    onChange={(e) => setDecisionRemarks(e.target.value)}
                    placeholder="Enter official instructions, conditions, or clearance remarks..."
                    className="w-full p-4 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-violet-500 focus:outline-none transition-all"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    These remarks will be recorded on the event timeline and notified to both the Student Proposer and Faculty Coordinator.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedPerm(null)}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingDecision}
                    className="btn-primary px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-md shadow-violet-500/20 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {submittingDecision ? 'Submitting Decision...' : 'Confirm Official Decision'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminPermissions;
