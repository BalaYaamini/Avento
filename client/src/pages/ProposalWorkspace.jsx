import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const ProposalWorkspace = () => {
  const { proposalId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [activeTab, setActiveTab] = useState('summary');
  
  // Discussion state
  const [message, setMessage] = useState('');
  const [submittingMsg, setSubmittingMsg] = useState(false);
  const messagesEndRef = useRef(null);

  // Document state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  // Faculty action state
  const [facultyAction, setFacultyAction] = useState(null); // 'approve', 'request_revision', 'reject'
  const [remarks, setRemarks] = useState('');
  const [processingAction, setProcessingAction] = useState(false);

  // Team state
  const [team, setTeam] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const searchTimeoutRef = useRef(null);

  const fetchWorkspace = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await axios.get(`/api/events/${proposalId}/proposal-workspace`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load proposal workspace.');
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };
  
  const fetchTeam = async () => {
    try {
      const res = await axios.get(`/api/events/${proposalId}/proposal-team`);
      setTeam(res.data);
    } catch (err) {
      console.error('Failed to fetch team', err);
    }
  };

  useEffect(() => {
    fetchWorkspace();
    fetchTeam();
    // In a real app we'd setup realtime subscriptions here for discussions, but polling or just refreshing after actions is fine for now
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalId]);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await axios.get(`/api/users/search?query=${encodeURIComponent(searchQuery)}`);
        setSearchResults(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  }, [searchQuery]);

  const handleAddTeamMember = async (userRecord, roleStr) => {
    try {
      setAddingMember(true);
      await axios.post(`/api/events/${proposalId}/proposal-team`, {
        userId: userRecord.id,
        name: userRecord.name || userRecord.fullName,
        email: userRecord.email,
        department: userRecord.department,
        role: roleStr
      });
      setSearchQuery('');
      setSearchResults([]);
      fetchTeam();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add team member.');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveTeamMember = async (memberId) => {
    if (!window.confirm('Are you sure you want to remove this team member?')) return;
    try {
      await axios.delete(`/api/events/${proposalId}/proposal-team/${memberId}`);
      fetchTeam();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove team member.');
    }
  };

  useEffect(() => {
    if (activeTab === 'discussion') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTab, data?.discussions]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    try {
      setSubmittingMsg(true);
      await axios.post(`/api/events/${proposalId}/discussion`, { message });
      setMessage('');
      fetchWorkspace(true);
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
      await axios.post(`/api/events/${proposalId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadFile(null);
      fetchWorkspace(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  const handleFacultyAction = async (status) => {
    if (status === 'needs_revision' && !remarks) {
      alert('Please provide revision comments.');
      return;
    }

    if (!window.confirm(`Are you sure you want to change the status to ${status.replace('_', ' ')}?`)) return;

    try {
      setProcessingAction(true);
      await axios.put(`/api/events/${proposalId}/proposal-status`, { status, remarks });
      setFacultyAction(null);
      setRemarks('');
      fetchWorkspace(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status.');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleResubmit = async () => {
    if (!window.confirm('Are you sure you want to resubmit this proposal?')) return;
    try {
      setProcessingAction(true);
      await axios.put(`/api/events/${proposalId}/proposal-resubmit`);
      fetchWorkspace(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to resubmit proposal.');
    } finally {
      setProcessingAction(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50">
        <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-center p-8 bg-slate-50 min-h-screen">{error}</div>;
  }

  if (!data) return null;

  const { event, discussions, documents, timeline } = data;
  
  const isFaculty = user.id === event.faculty_id;
  const isCreator = user.id === event.proposed_by || user.id === event.student_organizer_id;

  const getStatusBadge = (status) => {
    const s = status || 'draft';
    const config = {
      'draft': 'bg-slate-100 text-slate-600 border-slate-200',
      'pending_approval': 'bg-blue-100 text-blue-600 border-blue-200',
      'under_review': 'bg-amber-100 text-amber-600 border-amber-200',
      'needs_revision': 'bg-orange-100 text-orange-600 border-orange-200',
      'approved': 'bg-emerald-100 text-emerald-600 border-emerald-200',
      'rejected': 'bg-red-100 text-red-600 border-red-200',
      'published': 'bg-teal-100 text-teal-600 border-teal-200',
      'active': 'bg-indigo-100 text-indigo-600 border-indigo-200'
    };
    const c = config[s] || config.draft;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${c}`}>
        {s.replace('_', ' ')}
      </span>
    );
  };

  const tabs = [
    { id: 'summary', label: 'Summary' },
    { id: 'team', label: 'Organizing Team' },
    { id: 'discussion', label: 'Discussion' },
    { id: 'documents', label: 'Documents' },
    { id: 'timeline', label: 'Timeline' }
  ];

  // Helper to determine base URL for documents (to handle both dev and prod)
  // We'll use axios config base URL or assume the same origin if not set.
  const getFileUrl = (url) => {
      return axios.defaults.baseURL ? `${axios.defaults.baseURL}${url}` : `http://localhost:5001${url}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-body">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-6">
        
        {/* Sidebar */}
        <div className="w-full md:w-1/3 shrink-0 flex flex-col gap-6">
          {/* Proposal Header */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <Link to={isFaculty ? "/faculty-organizer/events" : "/student-organizer/events"} className="text-sm font-bold text-indigo-500 hover:text-indigo-700 flex items-center gap-1 mb-4 transition-colors">
              ← Back to Events
            </Link>
            <h1 className="text-2xl font-black font-display text-slate-800 mb-2 leading-tight">{event.title}</h1>
            <div className="flex flex-wrap gap-2 mb-4">
              {getStatusBadge(event.status)}
              <span className="px-3 py-1 rounded-full text-xs font-bold border bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100 uppercase tracking-wider">
                Rev {event.revision_number || 1}
              </span>
            </div>
            
            <div className="space-y-4 text-sm mt-6">
              <div>
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Category</span>
                <p className="font-semibold text-slate-700">{event.category}</p>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Proposed Date</span>
                <p className="font-semibold text-slate-700">{new Date(event.date).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Venue</span>
                <p className="font-semibold text-slate-700">{event.venue}</p>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Organizer</span>
                <p className="font-semibold text-slate-700">{event.student_organizer?.full_name}</p>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Faculty Coordinator</span>
                <p className="font-semibold text-slate-700">{event.faculty?.full_name}</p>
              </div>
              {event.capacity && (
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Budget/Capacity</span>
                  <p className="font-semibold text-slate-700">{event.capacity} seats</p>
                </div>
              )}
            </div>
          </div>

          {/* Workflow Actions */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="text-sm font-black font-display text-slate-800 uppercase tracking-wider mb-4 border-b pb-2">Workflow Actions</h3>
            
            {isFaculty && (event.status === 'pending_approval' || event.status === 'under_review') && (
              <div className="flex flex-col gap-3">
                {event.status === 'pending_approval' && (
                  <button 
                    onClick={() => handleFacultyAction('under_review')}
                    disabled={processingAction}
                    className="w-full py-2.5 rounded-xl font-bold text-sm bg-indigo-500 hover:bg-indigo-600 text-white transition-colors"
                  >
                    Start Review (Mark Under Review)
                  </button>
                )}
                
                {event.status === 'under_review' && (
                  <>
                    <button 
                      onClick={() => setFacultyAction(facultyAction === 'approve' ? null : 'approve')}
                      className="w-full py-2.5 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                    >
                      Approve Proposal
                    </button>
                    <button 
                      onClick={() => setFacultyAction(facultyAction === 'request_revision' ? null : 'request_revision')}
                      className="w-full py-2.5 rounded-xl font-bold text-sm bg-orange-500 hover:bg-orange-600 text-white transition-colors"
                    >
                      Request Revision
                    </button>
                    <button 
                      onClick={() => setFacultyAction(facultyAction === 'reject' ? null : 'reject')}
                      className="w-full py-2.5 rounded-xl font-bold text-sm bg-red-500 hover:bg-red-600 text-white transition-colors"
                    >
                      Reject Proposal
                    </button>
                  </>
                )}
                
                {facultyAction && (
                  <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200 animate-fade-in-up">
                    <label className="block text-xs font-bold text-slate-600 mb-2">
                      {facultyAction === 'request_revision' ? 'Revision Comments (Required)' : 'Remarks (Optional)'}
                    </label>
                    <textarea 
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm mb-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      rows="3"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Enter comments..."
                    />
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setFacultyAction(null)}
                        className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => handleFacultyAction(facultyAction === 'approve' ? 'approved' : facultyAction === 'reject' ? 'rejected' : 'needs_revision')}
                        disabled={processingAction}
                        className={`flex-1 py-2 font-bold text-xs rounded-lg text-white transition-colors ${
                          facultyAction === 'approve' ? 'bg-emerald-500 hover:bg-emerald-600' :
                          facultyAction === 'reject' ? 'bg-red-500 hover:bg-red-600' :
                          'bg-orange-500 hover:bg-orange-600'
                        }`}
                      >
                        {processingAction ? 'Processing...' : 'Confirm'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {isCreator && event.status === 'needs_revision' && (
              <div className="flex flex-col gap-3">
                <div className="p-3 bg-orange-50 text-orange-800 rounded-xl border border-orange-200 text-sm font-medium mb-2">
                  <span className="font-bold block mb-1">Faculty Remarks:</span>
                  {event.approval_remarks}
                </div>
                <button 
                  onClick={handleResubmit}
                  disabled={processingAction}
                  className="w-full py-2.5 rounded-xl font-bold text-sm bg-indigo-500 hover:bg-indigo-600 text-white transition-colors"
                >
                  {processingAction ? 'Processing...' : 'Resubmit Proposal'}
                </button>
                <p className="text-xs text-slate-500 text-center px-2">Make sure you have uploaded the revised documents before resubmitting.</p>
              </div>
            )}

            {(!isFaculty && event.status !== 'needs_revision') || (isFaculty && !['pending_approval', 'under_review'].includes(event.status)) ? (
              <p className="text-sm text-slate-500 italic text-center">No workflow actions available at this stage.</p>
            ) : null}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden h-[80vh] md:h-auto min-h-[600px]">
          {/* Tabs */}
          <div className="flex border-b border-slate-100 overflow-x-auto hide-scrollbar">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-4 px-6 text-sm font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                  activeTab === tab.id 
                    ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' 
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6 relative bg-slate-50/30">
            
            {/* Summary Tab */}
            {activeTab === 'summary' && (
              <div className="space-y-6 animate-fade-in">
                <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Description</h3>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{event.description}</p>
                </div>
              </div>
            )}

            {/* Team Tab */}
            {activeTab === 'team' && (
              <div className="space-y-6 animate-fade-in">
                {/* Search & Add */}
                {(isCreator || isFaculty || user?.roles?.includes('admin')) && ['draft', 'pending_approval', 'under_review', 'needs_revision'].includes(event.status) && (
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">Assign Organizers</h3>
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="Search by name, email, or department..." 
                        className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      {isSearching && (
                        <div className="absolute right-3 top-3 animate-spin h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
                      )}
                    </div>
                    
                    {searchResults.length > 0 && (
                      <div className="mt-2 border border-slate-100 rounded-lg divide-y divide-slate-100 bg-slate-50 overflow-hidden">
                        {searchResults.map(u => (
                          <div key={u.id} className="p-3 flex items-center justify-between hover:bg-slate-100 transition-colors">
                            <div>
                              <p className="font-bold text-sm text-slate-800">{u.name || u.fullName}</p>
                              <p className="text-xs text-slate-500">{u.email} {u.department ? `• ${u.department}` : ''}</p>
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => handleAddTeamMember(u, 'Student Organizer')}
                                disabled={addingMember || team.some(t => t.user_id === u.id)}
                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                              >
                                Add Student
                              </button>
                              {(isFaculty || user?.roles?.includes('admin')) && (
                                <button 
                                  onClick={() => handleAddTeamMember(u, 'Faculty Coordinator')}
                                  disabled={addingMember || team.some(t => t.user_id === u.id)}
                                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                                >
                                  Add Faculty
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Team Members List */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700">Organizing Team</h3>
                  </div>
                  
                  <div className="p-4 border-b border-slate-100 bg-white">
                     <h4 className="font-bold text-sm text-indigo-600 mb-3 uppercase tracking-wider">Faculty Coordinators</h4>
                     <ul className="divide-y divide-slate-100">
                       {team.filter(t => t.role === 'Faculty Coordinator').length === 0 && (
                         <li className="py-2 text-xs text-slate-400 italic">No faculty assigned yet.</li>
                       )}
                       {team.filter(t => t.role === 'Faculty Coordinator').map(t => (
                         <li key={t.id} className="py-3 flex justify-between items-center">
                           <div>
                             <p className="font-bold text-sm text-slate-800">{t.name}</p>
                             <p className="text-xs text-slate-500">{t.email}</p>
                           </div>
                           {(isFaculty || user?.roles?.includes('admin')) && t.user_id !== event.faculty_id && ['draft', 'pending_approval', 'under_review', 'needs_revision'].includes(event.status) && (
                             <button onClick={() => handleRemoveTeamMember(t.id)} className="text-xs text-red-500 hover:text-red-700 font-bold px-2 py-1 bg-red-50 rounded transition-colors">Remove</button>
                           )}
                         </li>
                       ))}
                     </ul>
                  </div>

                  <div className="p-4 bg-white">
                     <h4 className="font-bold text-sm text-indigo-600 mb-3 uppercase tracking-wider">Student Organizers</h4>
                     <ul className="divide-y divide-slate-100">
                       {team.filter(t => t.role === 'Student Organizer').length === 0 && (
                         <li className="py-2 text-xs text-slate-400 italic">No students assigned yet.</li>
                       )}
                       {team.filter(t => t.role === 'Student Organizer').map(t => (
                         <li key={t.id} className="py-3 flex justify-between items-center">
                           <div>
                             <p className="font-bold text-sm text-slate-800">{t.name}</p>
                             <p className="text-xs text-slate-500">{t.email}</p>
                           </div>
                           {(isCreator || isFaculty || user?.roles?.includes('admin')) && t.user_id !== event.proposed_by && t.user_id !== event.student_organizer_id && ['draft', 'pending_approval', 'under_review', 'needs_revision'].includes(event.status) && (
                             <button onClick={() => handleRemoveTeamMember(t.id)} className="text-xs text-red-500 hover:text-red-700 font-bold px-2 py-1 bg-red-50 rounded transition-colors">Remove</button>
                           )}
                         </li>
                       ))}
                     </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Discussion Tab */}
            {activeTab === 'discussion' && (
              <div className="flex flex-col h-full animate-fade-in">
                <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2">
                  {discussions.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 italic">No messages yet.</div>
                  ) : (
                    discussions.map(msg => {
                      const isMe = msg.user_id === user.id;
                      return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <div className={`max-w-[80%] rounded-2xl p-4 ${isMe ? 'bg-indigo-500 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm'}`}>
                            <div className="flex items-center gap-2 mb-1 opacity-80">
                              <span className="text-[10px] font-bold">{isMe ? 'You' : msg.sender?.full_name}</span>
                              <span className="text-[9px]">• {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-sm">{msg.message}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
                
                <form onSubmit={handleSendMessage} className="mt-auto bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex items-end gap-2">
                  <textarea
                    className="flex-1 max-h-32 min-h-[44px] p-3 text-sm focus:outline-none resize-none bg-transparent"
                    placeholder="Type a message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                  />
                  <button 
                    type="submit" 
                    disabled={submittingMsg || !message.trim()}
                    className="p-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                  </button>
                </form>
              </div>
            )}

            {/* Documents Tab */}
            {activeTab === 'documents' && (
              <div className="space-y-6 animate-fade-in">
                {(isCreator || isFaculty) && ['draft', 'pending_approval', 'under_review', 'needs_revision'].includes(event.status) && (
                  <form onSubmit={handleUploadDocument} className="bg-white p-6 rounded-xl border border-slate-200 border-dashed flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-bold text-slate-700 mb-2">Upload Document</label>
                      <input 
                        type="file" 
                        onChange={(e) => setUploadFile(e.target.files[0])}
                        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                        accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
                      />
                    </div>
                    <button 
                      type="submit"
                      disabled={!uploadFile || uploading}
                      className="px-6 py-2.5 bg-slate-800 text-white text-sm font-bold rounded-xl hover:bg-slate-700 disabled:opacity-50 transition-colors"
                    >
                      {uploading ? 'Uploading...' : 'Upload'}
                    </button>
                  </form>
                )}

                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="font-bold text-slate-700">Document History</h3>
                  </div>
                  {documents.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 italic">No documents uploaded yet.</div>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {documents.map(doc => (
                        <li key={doc.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div>
                              <p className="font-bold text-sm text-slate-700 line-clamp-1">{doc.file_name}</p>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                                <span className="uppercase tracking-wider font-bold text-indigo-500">Rev {doc.version}</span>
                                <span>•</span>
                                <span>{doc.uploader?.full_name}</span>
                                <span>•</span>
                                <span>{new Date(doc.created_at).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                          <a 
                            href={getFileUrl(doc.file_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            download
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Timeline Tab */}
            {activeTab === 'timeline' && (
              <div className="py-4 animate-fade-in relative">
                <div className="absolute left-[27px] top-4 bottom-4 w-0.5 bg-slate-200 rounded-full" />
                <div className="space-y-6 relative">
                  {timeline.length === 0 ? (
                    <div className="text-center text-slate-400 italic">No timeline events.</div>
                  ) : (
                    timeline.map((item, idx) => (
                      <div key={item.id} className="flex gap-4 relative">
                        <div className="w-14 h-14 shrink-0 bg-white rounded-full border-4 border-slate-50 flex items-center justify-center shadow-sm relative z-10 text-indigo-500">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="pt-2">
                          <p className="font-bold text-slate-800 text-sm">{item.action}</p>
                          {item.details && <p className="text-sm text-slate-500 mt-1">{item.details}</p>}
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-2">
                            <span className="font-medium text-indigo-400">{item.actor?.full_name}</span>
                            <span>•</span>
                            <span>{new Date(item.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default ProposalWorkspace;
