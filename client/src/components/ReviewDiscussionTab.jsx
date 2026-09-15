import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { supabase } from '../context/AuthContext';

const ReviewDiscussionTab = ({ eventId, event, user, hasFullAccess }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [subTab, setSubTab] = useState('discussion'); // 'discussion' | 'documents' | 'permissions' | 'timeline'
  
  // Discussion state
  const [message, setMessage] = useState('');
  const [submittingMsg, setSubmittingMsg] = useState(false);
  const messagesEndRef = useRef(null);

  // Document state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Higher Official Permission Request state
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [higherOfficials, setHigherOfficials] = useState([]);
  const [loadingOfficials, setLoadingOfficials] = useState(false);
  const [selectedOfficialId, setSelectedOfficialId] = useState('');
  const [permissionSubject, setPermissionSubject] = useState('');
  const [proposalLetter, setProposalLetter] = useState('');
  const [permissionFiles, setPermissionFiles] = useState([]);
  const [submittingPermission, setSubmittingPermission] = useState(false);

  // Higher Official in-place decision state (if user is admin/official)
  const [selectedDecisionPerm, setSelectedDecisionPerm] = useState(null);
  const [officialDecisionAction, setOfficialDecisionAction] = useState('granted');
  const [officialRemarks, setOfficialRemarks] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  const fetchWorkspaceData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await axios.get(`/api/events/${eventId}/proposal-workspace`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load proposal workspace data:', err);
      setError(err.response?.data?.message || 'Failed to load discussion and documents.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchHigherOfficials = async () => {
    try {
      setLoadingOfficials(true);
      const res = await axios.get('/api/users/higher-officials');
      setHigherOfficials(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load higher officials:', err);
    } finally {
      setLoadingOfficials(false);
    }
  };

  useEffect(() => {
    fetchWorkspaceData();
    // Poll every 12 seconds to keep conversation fresh
    const interval = setInterval(() => {
      fetchWorkspaceData(true);
    }, 12000);
    return () => clearInterval(interval);
  }, [eventId]);

  useEffect(() => {
    if (subTab === 'discussion' && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [data?.discussions, subTab]);

  const openPermissionModal = () => {
    fetchHigherOfficials();
    const evtTitle = event?.title || data?.event?.title || 'Event Proposal';
    const evtDate = event?.date || data?.event?.date ? new Date(event?.date || data?.event?.date).toLocaleDateString() : 'TBD';
    const evtVenue = event?.venue || data?.event?.venue || 'Campus Venue';
    const proposer = user?.name || user?.fullName || 'Event Coordinator';
    
    setPermissionSubject(`Formal Permission Request: ${evtTitle}`);
    setProposalLetter(
`Respected Authority,

I am writing to formally request official permission to conduct the proposed event "${evtTitle}".

Event Summary:
- Proposed Date: ${evtDate}
- Venue: ${evtVenue}
- Category: ${event?.category || data?.event?.category || 'Technical'}
- Estimated Participants / Capacity: ${event?.capacity || data?.event?.capacity || '50'}
- Coordinator: ${proposer}

Please find the attached proposal details, agenda, and budget estimate for your kind perusal and official clearance.

Thank you.
Sincerely,
${proposer}`
    );
    setSelectedOfficialId('');
    setPermissionFiles([]);
    setIsPermissionModalOpen(true);
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!message.trim() || submittingMsg) return;

    const trimmed = message.trim();
    try {
      setSubmittingMsg(true);
      await axios.post(`/api/events/${eventId}/discussion`, { message: trimmed });
      setMessage('');
      fetchWorkspaceData(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send message.');
    } finally {
      setSubmittingMsg(false);
    }
  };

  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;

    const formData = new FormData();
    formData.append('document', uploadFile);

    try {
      setUploading(true);
      await axios.post(`/api/events/${eventId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadFile(null);
      fetchWorkspaceData(true);
      alert('Document uploaded successfully.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveDocument = async (docId) => {
    if (!window.confirm('Are you sure you want to remove this document?')) return;
    try {
      await axios.delete(`/api/events/${eventId}/documents/${docId}`);
      fetchWorkspaceData(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove document.');
    }
  };

  const handlePermissionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOfficialId) {
      alert('Please select a Higher Official.');
      return;
    }
    if (!proposalLetter.trim()) {
      alert('Please enter a proposal letter.');
      return;
    }

    const formData = new FormData();
    formData.append('officialId', selectedOfficialId);
    formData.append('official_id', selectedOfficialId);
    formData.append('subject', permissionSubject.trim() || `Permission Request: ${event?.title || 'Event'}`);
    formData.append('proposalLetter', proposalLetter.trim());
    formData.append('proposal_letter', proposalLetter.trim());

    for (let i = 0; i < permissionFiles.length; i++) {
      formData.append('attachments', permissionFiles[i]);
    }

    try {
      setSubmittingPermission(true);
      await axios.post(`/api/events/${eventId}/official-permission`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      alert('Formal proposal letter and documents submitted to Higher Official successfully!');
      setIsPermissionModalOpen(false);
      setSubTab('permissions');
      fetchWorkspaceData(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit permission request to Higher Official.');
    } finally {
      setSubmittingPermission(false);
    }
  };

  const handleOfficialDecisionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDecisionPerm) return;

    try {
      setSubmittingDecision(true);
      await axios.put(`/api/events/${eventId}/official-permission/${selectedDecisionPerm.id}/decision`, {
        status: officialDecisionAction,
        remarks: officialRemarks.trim()
      });

      alert(`Official decision recorded: ${officialDecisionAction === 'granted' ? 'Permission Granted' : officialDecisionAction}.`);
      setSelectedDecisionPerm(null);
      setOfficialRemarks('');
      fetchWorkspaceData(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record official decision.');
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

  const getPermissionBadge = (status) => {
    switch (status) {
      case 'granted':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Permission Granted
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Permission Denied
          </span>
        );
      case 'revision_requested':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Revision Requested
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-violet-100 dark:bg-violet-950/80 text-violet-800 dark:text-violet-300 border border-violet-300 dark:border-violet-700">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse"></span>
            Pending Higher Official Review
          </span>
        );
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="w-8 h-8 border-4 border-fuchsia-500/20 border-t-fuchsia-600 rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-500 mt-3">Loading Discussion & Review records...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-2xl border border-red-200 text-center text-sm font-semibold">
        {error}
      </div>
    );
  }

  const discussions = data?.discussions || [];
  const documents = data?.documents || [];
  const timeline = data?.timeline || [];
  const officialPermissions = data?.officialPermissions || [];
  const isHigherOfficialUser = Boolean(user?.roles?.includes('admin') || user?.role === 'admin' || user?.role === 'official');

  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 mb-8 animate-fade-in">
      {/* Header and Sub-tab Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 mb-6 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Review & Discussion Workspace</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Official communication channel, proposal attachments, higher official permissions, and verification timeline
              </p>
            </div>
          </div>
        </div>

        {/* Action Button & Sub-navigation buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Permission from Higher Official Button */}
          <button
            type="button"
            onClick={openPermissionModal}
            className="btn-primary px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <span>Permission from Higher Official</span>
          </button>

          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/70 rounded-xl overflow-x-auto">
            <button
              type="button"
              onClick={() => setSubTab('discussion')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                subTab === 'discussion'
                  ? 'bg-white dark:bg-slate-700 text-fuchsia-600 dark:text-fuchsia-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <span>Discussion</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200">
                {discussions.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSubTab('documents')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                subTab === 'documents'
                  ? 'bg-white dark:bg-slate-700 text-fuchsia-600 dark:text-fuchsia-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <span>Documents</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200">
                {documents.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSubTab('permissions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                subTab === 'permissions'
                  ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <span>Permissions</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200">
                {officialPermissions.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSubTab('timeline')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                subTab === 'timeline'
                  ? 'bg-white dark:bg-slate-700 text-fuchsia-600 dark:text-fuchsia-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <span>⏱️ Timeline</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200">
                {timeline.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ── SUB-TAB 1: DISCUSSION CHANNEL ── */}
      {subTab === 'discussion' && (
        <div className="flex flex-col h-[520px]">
          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-2">
            {discussions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-8">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="font-bold text-sm text-slate-700 dark:text-slate-200">No discussion messages yet</p>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  Use this channel for queries, clarifications, and decisions between organizers and faculty coordinators.
                </p>
              </div>
            ) : (
              discussions.map(msg => {
                const isMe = String(msg.user_id) === String(user?.id);
                const isFacultySender = event.faculty_id && String(msg.user_id) === String(event.faculty_id);
                const isProposerSender = (event.proposed_by && String(msg.user_id) === String(event.proposed_by)) ||
                                         (event.student_organizer_id && String(msg.user_id) === String(event.student_organizer_id));

                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-4 transition-all ${
                      isMe 
                        ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-tr-xs shadow-xs' 
                        : 'bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-xs shadow-xs'
                    }`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-bold">
                          {isMe ? 'You' : (msg.sender?.name || msg.sender?.full_name || 'User')}
                        </span>
                        {isFacultySender && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isMe ? 'bg-white/20 text-white' : 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'}`}>
                            Faculty
                          </span>
                        )}
                        {isProposerSender && !isFacultySender && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isMe ? 'bg-white/20 text-white' : 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'}`}>
                            Lead Organizer
                          </span>
                        )}
                        <span className="text-[10px] ml-auto opacity-75">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input Box */}
          <form onSubmit={handleSendMessage} className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                className="w-full p-3.5 pr-12 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-fuchsia-500 focus:outline-none resize-none transition-all max-h-28 min-h-[50px]"
                placeholder="Type a message or update for the organizing committee..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
              />
              <div className="text-[10px] text-slate-400 mt-1 pl-1">
                Press <span className="font-semibold">Enter</span> to send • <span className="font-semibold">Shift + Enter</span> for new line
              </div>
            </div>
            <button 
              type="submit" 
              disabled={submittingMsg || !message.trim()}
              className="btn-primary p-3.5 rounded-2xl text-white shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center shrink-0 mb-5"
              title="Send Message"
            >
              <svg className="h-5 w-5 rotate-90" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </form>
        </div>
      )}

      {/* ── SUB-TAB 2: DOCUMENTS & ATTACHMENTS ── */}
      {subTab === 'documents' && (
        <div className="space-y-6">
          {/* Upload Form */}
          <form onSubmit={handleUploadDocument} className="p-6 bg-slate-50/70 dark:bg-slate-800/40 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Upload Event Resource, Schedule, or Approval Document
              </label>
              <input 
                type="file" 
                onChange={(e) => setUploadFile(e.target.files[0])}
                className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-white dark:file:bg-slate-700 file:text-fuchsia-700 dark:file:text-fuchsia-300 hover:file:bg-fuchsia-50 file:border-slate-200 file:shadow-xs cursor-pointer"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg"
              />
              <p className="text-[10px] text-slate-400 mt-1.5">Supported formats: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, PNG, JPG</p>
            </div>
            <button 
              type="submit" 
              disabled={!uploadFile || uploading}
              className="btn-primary px-6 py-2.5 rounded-xl font-bold text-xs text-white shadow-xs disabled:opacity-50 transition-all cursor-pointer shrink-0"
            >
              {uploading ? 'Uploading...' : 'Upload Document'}
            </button>
          </form>

          {/* Document list */}
          <div className="space-y-3">
            {documents.length === 0 ? (
              <div className="p-12 text-center text-slate-400 italic bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800">
                No documents uploaded for this event yet.
              </div>
            ) : (
              documents.map(doc => (
                <div 
                  key={doc.id} 
                  className="p-4 bg-slate-50/60 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl border border-slate-200/70 dark:border-slate-700 flex items-center justify-between gap-4 transition-all"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-white dark:bg-slate-700 border border-slate-200/80 dark:border-slate-600 flex items-center justify-center text-indigo-500 shrink-0 shadow-xs">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{doc.file_name}</p>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="font-bold text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-950 px-2 py-0.5 rounded-md">
                          Revision {doc.version || 1}
                        </span>
                        <span>•</span>
                        <span>Uploaded by {doc.uploader?.name || doc.uploader?.full_name || 'User'}</span>
                        <span>•</span>
                        <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a 
                      href={getFileUrl(doc.file_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200/80 dark:border-slate-600 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors shadow-xs inline-flex items-center gap-1.5"
                      download
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span>Download</span>
                    </a>
                    {hasFullAccess && (
                      <button
                        type="button"
                        onClick={() => handleRemoveDocument(doc.id)}
                        className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── SUB-TAB 3: HIGHER OFFICIAL PERMISSIONS ── */}
      {subTab === 'permissions' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-violet-50/70 to-indigo-50/50 dark:bg-slate-800/50 rounded-2xl border border-violet-200/80 dark:border-slate-700">
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                <span>Higher Official Proposal Permissions</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Official clearance letters and administrative approval records submitted to university authorities.
              </p>
            </div>
            <button
              type="button"
              onClick={openPermissionModal}
              className="btn-primary px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer shrink-0"
            >
              <span>+</span>
              <span>Send New Permission Request</span>
            </button>
          </div>

          {officialPermissions.length === 0 ? (
            <div className="p-12 text-center text-slate-400 italic bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <p className="font-semibold text-sm text-slate-600 dark:text-slate-300">No Higher Official permissions requested yet.</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Before the event is approved, you can send a formal proposal letter and attach documents to university administrators.
              </p>
              <button
                type="button"
                onClick={openPermissionModal}
                className="btn-primary px-5 py-2 rounded-xl text-xs font-bold text-white shadow-xs cursor-pointer mt-2"
              >
                Request Higher Official Permission
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {officialPermissions.map(perm => {
                const attachments = Array.isArray(perm.attachments) ? perm.attachments : [];
                return (
                  <div 
                    key={perm.id}
                    className="p-6 bg-slate-50/70 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-5"
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/60 dark:border-slate-700">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">{perm.subject || 'Permission Request'}</span>
                          {getPermissionBadge(perm.status)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                          <span>Sent to: <strong className="text-slate-800 dark:text-slate-200">{perm.official_user?.name || 'Higher Official'}</strong> ({perm.official_user?.department || 'University Admin'})</span>
                          <span>•</span>
                          <span>Requested by: {perm.requested_by_user?.name || 'Coordinator'}</span>
                          <span>•</span>
                          <span>{new Date(perm.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      {/* Higher Official in-place review action */}
                      {isHigherOfficialUser && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDecisionPerm(perm);
                            setOfficialDecisionAction(perm.status === 'pending' ? 'granted' : perm.status);
                            setOfficialRemarks(perm.official_remarks || '');
                          }}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white transition-all shadow-xs cursor-pointer"
                        >
                          {perm.status === 'pending' ? 'Review & Decide' : 'Edit Decision'}
                        </button>
                      )}
                    </div>

                    {/* Proposal Letter */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Proposal Letter:
                      </span>
                      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {perm.proposal_letter}
                      </div>
                    </div>

                    {/* Attachments */}
                    {attachments.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Attached Documents ({attachments.length}):
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {attachments.map((att, idx) => (
                            <div 
                              key={idx}
                              className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-700 flex items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span>📄</span>
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{att.file_name}</span>
                              </div>
                              <a
                                href={getFileUrl(att.file_url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg shrink-0"
                                download
                              >
                                Download
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Remarks Banner */}
                    {perm.status !== 'pending' && (
                      <div className={`p-4 rounded-xl border text-xs space-y-1 ${
                        perm.status === 'granted'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-900 dark:text-emerald-200'
                          : (perm.status === 'rejected' ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-900 dark:text-rose-200' : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 text-amber-900 dark:text-amber-200')
                      }`}>
                        <div className="font-bold flex items-center gap-2">
                          <span>{perm.status === 'granted' ? '✓ Authority Clearance Granted' : '⚠ Authority Decision Remarks:'}</span>
                          {perm.decided_at && (
                            <span className="font-normal opacity-75 text-[11px]">
                              • {new Date(perm.decided_at).toLocaleString()}
                            </span>
                          )}
                        </div>
                        {perm.official_remarks && (
                          <p className="mt-1 bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200/40">
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
        </div>
      )}

      {/* ── SUB-TAB 4: PROPOSAL TIMELINE & AUDIT TRAIL ── */}
      {subTab === 'timeline' && (
        <div className="space-y-6">
          <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-2.5 sm:before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
            {timeline.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No timeline audit events recorded yet.</p>
            ) : (
              timeline.map(item => {
                const isApproved = item.action?.toLowerCase().includes('approved') || item.action?.toLowerCase().includes('permission granted');
                const isRejected = item.action?.toLowerCase().includes('rejected') || item.action?.toLowerCase().includes('denied');
                const isRevision = item.action?.toLowerCase().includes('revision');
                const isPublished = item.action?.toLowerCase().includes('published');
                const isPermReq = item.action?.toLowerCase().includes('permission requested');

                return (
                  <div key={item.id} className="relative group">
                    {/* Circle Node */}
                    <div className={`absolute -left-[27px] sm:-left-[31px] top-1 w-6 h-6 rounded-full border-2 bg-white dark:bg-slate-800 flex items-center justify-center transition-all ${
                      isApproved ? 'border-emerald-500 text-emerald-500' :
                      isRejected ? 'border-rose-500 text-rose-500' :
                      isRevision ? 'border-amber-500 text-amber-500' :
                      isPublished ? 'border-indigo-500 text-indigo-500' :
                      isPermReq ? 'border-violet-500 text-violet-500' :
                      'border-slate-300 dark:border-slate-600 text-slate-400'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${
                        isApproved ? 'bg-emerald-500' :
                        isRejected ? 'bg-rose-500' :
                        isRevision ? 'bg-amber-500' :
                        isPublished ? 'bg-indigo-500' :
                        isPermReq ? 'bg-violet-500' :
                        'bg-slate-400'
                      }`} />
                    </div>

                    <div className="bg-slate-50/80 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                        <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{item.action}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Recorded by <span className="font-semibold text-slate-700 dark:text-slate-300">{item.user?.name || item.user?.full_name || 'System / Organizer'}</span>
                      </p>
                      {item.details && (
                        <div className="mt-2 text-xs bg-white dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                          {item.details}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: REQUEST PERMISSION FROM HIGHER OFFICIAL ── */}
      {isPermissionModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-scale-up max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-2xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </span>
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">
                    Request Permission from Higher Official
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Select a university authority, write your proposal letter, and attach supporting files.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPermissionModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handlePermissionSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
              
              {/* Higher Official Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Select Higher Official (University Authority) *
                </label>
                <select
                  required
                  value={selectedOfficialId}
                  onChange={(e) => setSelectedOfficialId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all cursor-pointer shadow-xs"
                >
                  <option value="" disabled>-- Choose Higher Official / University Admin --</option>
                  {higherOfficials.map(off => (
                    <option key={off.id} value={off.id}>
                      {off.displayLabel || `${off.name} (${off.department || 'University Admin'})`}
                    </option>
                  ))}
                </select>
                {higherOfficials.length === 0 && !loadingOfficials && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    No higher officials found. Please ensure an administrator account is active.
                  </p>
                )}
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Subject / Heading
                </label>
                <input
                  type="text"
                  required
                  value={permissionSubject}
                  onChange={(e) => setPermissionSubject(e.target.value)}
                  placeholder="e.g. Formal Permission Request for Annual Hackathon 2026"
                  className="w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                />
              </div>

              {/* Proposal Letter Body */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Proposal Letter *
                </label>
                <textarea
                  required
                  rows={8}
                  value={proposalLetter}
                  onChange={(e) => setProposalLetter(e.target.value)}
                  placeholder="Write formal event proposal letter to the higher official..."
                  className="w-full p-4 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:outline-none transition-all font-sans leading-relaxed"
                />
              </div>

              {/* Attachments */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Attach Documents / Proposal Files (Optional)
                </label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => setPermissionFiles(Array.from(e.target.files))}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-violet-50 dark:file:bg-slate-700 file:text-violet-700 dark:file:text-violet-300 hover:file:bg-violet-100 file:border-slate-200 file:shadow-xs cursor-pointer"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg"
                />
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Select multiple files: Event Schedule, Budget Sheets, Poster, Brochure, Resource Requirements (Max 10MB each).
                </p>
                {permissionFiles.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {permissionFiles.map((f, i) => (
                      <span key={i} className="px-2.5 py-1 bg-violet-50 dark:bg-slate-800 border border-violet-200 dark:border-slate-700 text-violet-800 dark:text-violet-300 rounded-lg text-xs font-medium flex items-center gap-1.5">
                        <span>📄</span>
                        <span className="truncate max-w-[180px]">{f.name}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPermissionModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPermission}
                  className="btn-primary px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-md shadow-violet-500/20 disabled:opacity-50 transition-all cursor-pointer flex items-center gap-2"
                >
                  <span>{submittingPermission ? 'Sending Request...' : 'Send to Higher Official'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: HIGHER OFFICIAL IN-PLACE DECISION ── */}
      {selectedDecisionPerm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-scale-up">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">
                  Record Authority Decision
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Grant permission, request revisions, or reject proposal clearance.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDecisionPerm(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOfficialDecisionSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Decision *
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setOfficialDecisionAction('granted')}
                    className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      officialDecisionAction === 'granted'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-emerald-50 dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    }`}
                  >
                    <span>✓</span>
                    <span>Grant</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOfficialDecisionAction('revision_requested')}
                    className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      officialDecisionAction === 'revision_requested'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-amber-50 dark:bg-slate-800 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    <span>📝</span>
                    <span>Revision</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOfficialDecisionAction('rejected')}
                    className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      officialDecisionAction === 'rejected'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-rose-50 dark:bg-slate-800 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                    }`}
                  >
                    <span>✕</span>
                    <span>Reject</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Official Remarks {officialDecisionAction !== 'granted' && '*'}
                </label>
                <textarea
                  rows={4}
                  required={officialDecisionAction !== 'granted'}
                  value={officialRemarks}
                  onChange={(e) => setOfficialRemarks(e.target.value)}
                  placeholder="Enter authority clearance remarks or required revisions..."
                  className="w-full p-3.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl focus:bg-white dark:focus:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedDecisionPerm(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDecision}
                  className="btn-primary px-5 py-2 rounded-xl text-xs font-bold text-white shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submittingDecision ? 'Submitting...' : 'Save Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewDiscussionTab;
