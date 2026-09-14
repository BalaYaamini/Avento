import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { supabase } from '../context/AuthContext';

const ReviewDiscussionTab = ({ eventId, event, user, hasFullAccess }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [subTab, setSubTab] = useState('discussion'); // 'discussion' | 'documents' | 'timeline'
  
  // Discussion state
  const [message, setMessage] = useState('');
  const [submittingMsg, setSubmittingMsg] = useState(false);
  const messagesEndRef = useRef(null);

  // Document state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);

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

  const getFileUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    return axios.defaults.baseURL ? `${axios.defaults.baseURL}${url}` : `http://localhost:5001${url}`;
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

  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 mb-8 animate-fade-in">
      {/* Header and Sub-tab Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 mb-6 border-b border-slate-100 dark:border-slate-800">
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
                Official communication channel, proposal attachments, and verification timeline
              </p>
            </div>
          </div>
        </div>

        {/* Sub-navigation buttons */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/70 rounded-xl">
          <button
            type="button"
            onClick={() => setSubTab('discussion')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
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
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
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
            onClick={() => setSubTab('timeline')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
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
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
              />
              <p className="text-[10px] text-slate-400 mt-1.5">Supported formats: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX</p>
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

      {/* ── SUB-TAB 3: PROPOSAL TIMELINE & AUDIT TRAIL ── */}
      {subTab === 'timeline' && (
        <div className="space-y-6">
          <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-2.5 sm:before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
            {timeline.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No timeline audit events recorded yet.</p>
            ) : (
              timeline.map(item => {
                const isApproved = item.action?.toLowerCase().includes('approved');
                const isRejected = item.action?.toLowerCase().includes('rejected');
                const isRevision = item.action?.toLowerCase().includes('revision');
                const isPublished = item.action?.toLowerCase().includes('published');

                return (
                  <div key={item.id} className="relative group">
                    {/* Circle Node */}
                    <div className={`absolute -left-[27px] sm:-left-[31px] top-1 w-6 h-6 rounded-full border-2 bg-white dark:bg-slate-800 flex items-center justify-center transition-all ${
                      isApproved ? 'border-emerald-500 text-emerald-500' :
                      isRejected ? 'border-rose-500 text-rose-500' :
                      isRevision ? 'border-amber-500 text-amber-500' :
                      isPublished ? 'border-indigo-500 text-indigo-500' :
                      'border-slate-300 dark:border-slate-600 text-slate-400'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${
                        isApproved ? 'bg-emerald-500' :
                        isRejected ? 'bg-rose-500' :
                        isRevision ? 'bg-amber-500' :
                        isPublished ? 'bg-indigo-500' :
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
    </div>
  );
};

export default ReviewDiscussionTab;
