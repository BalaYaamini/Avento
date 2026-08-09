import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth, supabase } from '../context/AuthContext';
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

  // Event Details editing state
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [savingDetails, setSavingDetails] = useState(false);
  const [posterFile, setPosterFile] = useState(null);
  const [posterPreview, setPosterPreview] = useState('');

  // Team state
  const [team, setTeam] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [selectedUserForAdd, setSelectedUserForAdd] = useState(null);
  const [selectedResponsibility, setSelectedResponsibility] = useState('');
  const [selectedOrganizerType, setSelectedOrganizerType] = useState('normal');
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
    if (!roleStr) {
      alert('Please select a responsibility.');
      return;
    }
    try {
      setAddingMember(true);
      await axios.post(`/api/events/${proposalId}/proposal-team`, {
        userId: userRecord.id,
        name: userRecord.name || userRecord.fullName,
        email: userRecord.email,
        department: userRecord.department,
        role: roleStr,
        organizerType: selectedOrganizerType
      });
      setSearchQuery('');
      setSearchResults([]);
      setSelectedUserForAdd(null);
      setSelectedResponsibility('');
      setSelectedOrganizerType('normal');
      fetchTeam();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add team member.');
    } finally {
      setAddingMember(false);
    }
  };

  const handleChangeOrganizerType = async (memberId, newType) => {
    try {
      await axios.put(`/api/events/${proposalId}/proposal-team/${memberId}/role`, { organizerType: newType });
      fetchTeam();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to change organizer type.');
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

  const getRoleBadge = (userId, globalRole) => {
    if (userId === event?.faculty_id) return 'Faculty Coordinator';
    if (userId === event?.proposed_by || userId === event?.student_organizer_id) return 'Event Creator';
    const member = team.find(t => t.user_id === userId);
    if (member && member.role) return member.role;
    if (globalRole === 'admin') return 'System Admin';
    return globalRole === 'faculty' ? 'Faculty' : 'Student';
  };

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

  const handleSaveDetails = async () => {
    try {
      setSavingDetails(true);
      let finalImageUrl = editFormData.imageUrl;
      
      if (posterFile) {
        if (posterFile.size > 5 * 1024 * 1024) {
          alert('Poster image must be less than 5MB.');
          setSavingDetails(false);
          return;
        }
        
        const fileExt = posterFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('posters')
          .upload(filePath, posterFile);

        if (uploadError) {
          alert('Failed to upload poster image.');
          setSavingDetails(false);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from('posters')
          .getPublicUrl(filePath);
          
        finalImageUrl = publicUrlData.publicUrl;
      }

      const payload = { ...editFormData, imageUrl: finalImageUrl };
      await axios.put(`/api/events/${proposalId}/proposal-details`, payload);
      setIsEditingDetails(false);
      setPosterFile(null);
      setPosterPreview('');
      fetchWorkspace(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save event details.');
    } finally {
      setSavingDetails(false);
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

  const handleRemoveDocument = async (docId) => {
    if (!window.confirm('Are you sure you want to remove this document?')) return;
    try {
      await axios.delete(`/api/events/${proposalId}/documents/${docId}`);
      fetchWorkspace(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove document.');
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
              {event.registration_type === 'team' ? (
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Team Limit</span>
                  <p className="font-semibold text-slate-700">{event.max_teams} teams ({event.min_team_size}-{event.max_team_size} members)</p>
                </div>
              ) : event.capacity ? (
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Number of Slots</span>
                  <p className="font-semibold text-slate-700">{event.capacity} seats</p>
                </div>
              ) : null}
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
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800">Event Details</h3>
                    {(isCreator || isFaculty || user?.roles?.includes('admin')) && !isEditingDetails && (
                      <button 
                        onClick={() => {
                          const toLocalISO = (d) => {
                            if (!d) return '';
                            const date = new Date(d);
                            if (isNaN(date.getTime())) return '';
                            return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                          };
                          setEditFormData({
                            title: event.title || '',
                            description: event.description || '',
                            date: toLocalISO(event.date),
                            registrationDeadline: toLocalISO(event.registration_deadline),
                            category: event.category || '',
                            venue: event.venue || '',
                            registrationType: event.registration_type || 'individual',
                            minTeamSize: event.min_team_size || 1,
                            maxTeamSize: event.max_team_size || 1,
                            maxTeams: event.max_teams || '',
                            imageUrl: event.image_url || event.imageUrl || ''
                          });
                          setPosterFile(null);
                          setPosterPreview('');
                          setIsEditingDetails(true);
                        }}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Edit Details
                      </button>
                    )}
                  </div>
                  
                  {isEditingDetails ? (
                    <div className="space-y-4 animate-fade-in">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Event Title</label>
                          <input
                            type="text"
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            value={editFormData.title}
                            onChange={(e) => setEditFormData({...editFormData, title: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                          <input
                            type="text"
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            value={editFormData.category}
                            onChange={(e) => setEditFormData({...editFormData, category: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Venue</label>
                          <input
                            type="text"
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            value={editFormData.venue}
                            onChange={(e) => setEditFormData({...editFormData, venue: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Proposed Date</label>
                          <input
                            type="datetime-local"
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            value={editFormData.date}
                            onChange={(e) => setEditFormData({...editFormData, date: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Registration Type</label>
                          <select
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                            value={editFormData.registrationType}
                            onChange={(e) => setEditFormData({...editFormData, registrationType: e.target.value})}
                          >
                            <option value="individual">Individual</option>
                            <option value="team">Team</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Registration Deadline</label>
                          <input
                            type="datetime-local"
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            value={editFormData.registrationDeadline}
                            onChange={(e) => setEditFormData({...editFormData, registrationDeadline: e.target.value})}
                          />
                        </div>
                        
                        {editFormData.registrationType === 'team' && (
                          <>
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">Min Team Size</label>
                              <input
                                type="number"
                                min="1"
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                value={editFormData.minTeamSize}
                                onChange={(e) => setEditFormData({...editFormData, minTeamSize: e.target.value})}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">Max Team Size</label>
                              <input
                                type="number"
                                min="1"
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                value={editFormData.maxTeamSize}
                                onChange={(e) => setEditFormData({...editFormData, maxTeamSize: e.target.value})}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">Max Teams (Capacity)</label>
                              <input
                                type="number"
                                min="1"
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                value={editFormData.maxTeams}
                                onChange={(e) => setEditFormData({...editFormData, maxTeams: e.target.value})}
                              />
                            </div>
                          </>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1 mt-4">Event Poster</label>
                        <div className="flex flex-col gap-3">
                          {(posterPreview || editFormData.imageUrl) && (
                            <img 
                              src={posterPreview || editFormData.imageUrl} 
                              alt="Event Poster Preview" 
                              className="w-full max-w-sm rounded-xl border border-slate-200 object-cover aspect-video"
                            />
                          )}
                          <div className="flex items-center gap-3">
                            <label className="cursor-pointer px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors inline-block">
                              Change Poster
                              <input 
                                type="file" 
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files[0];
                                  if (file) {
                                    setPosterFile(file);
                                    setPosterPreview(URL.createObjectURL(file));
                                  }
                                }}
                              />
                            </label>
                            {posterFile && (
                              <span className="text-xs text-slate-500 font-medium truncate max-w-xs">New file selected: {posterFile.name}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1 mt-4">Event Description</label>
                        <textarea
                          className="w-full p-4 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[150px]"
                          value={editFormData.description}
                          onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                          placeholder="Enter event description..."
                        />
                      </div>
                      
                      <div className="flex gap-2 justify-end mt-4">
                        <button 
                          onClick={() => setIsEditingDetails(false)}
                          disabled={savingDetails}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleSaveDetails}
                          disabled={savingDetails || !editFormData.title?.trim() || !editFormData.description?.trim()}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {savingDetails ? (
                            <>
                              <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />
                              Saving...
                            </>
                          ) : 'Save Details'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h4 className="text-xl font-bold text-slate-800 mb-3">{event.title}</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 p-4 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-700">
                        <div><strong className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Category</strong> {event.category || 'N/A'}</div>
                        <div><strong className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Venue</strong> {event.venue || 'TBA'}</div>
                        <div><strong className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Date</strong> {event.date ? new Date(event.date).toLocaleString() : 'TBA'}</div>
                        <div><strong className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Type</strong> {event.registration_type === 'team' ? 'Team Event' : 'Individual Event'}</div>
                        {event.registration_type === 'team' && (
                          <>
                            <div><strong className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Min/Max Size</strong> {event.min_team_size} - {event.max_team_size} Members</div>
                            <div><strong className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Max Teams</strong> {event.max_teams || 'No Limit'}</div>
                          </>
                        )}
                        {event.registration_deadline && (
                          <div className="col-span-full md:col-span-1"><strong className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Reg. Deadline</strong> {new Date(event.registration_deadline).toLocaleString()}</div>
                        )}
                      </div>
                      <h5 className="text-sm font-bold text-slate-700 mb-2">Description</h5>
                      <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{event.description}</p>
                    </div>
                  )}
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
                    {selectedUserForAdd ? (
                      <div className="mt-4 p-5 border border-indigo-100 bg-indigo-50/30 rounded-xl animate-fade-in">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="font-bold text-sm text-slate-800">{selectedUserForAdd.name || selectedUserForAdd.fullName}</p>
                            <p className="text-xs text-slate-500">{selectedUserForAdd.email}</p>
                          </div>
                          <button onClick={() => setSelectedUserForAdd(null)} className="text-xs font-bold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm transition-colors">Change User</button>
                        </div>
                        
                        <div className="mb-4">
                          <label className="block text-xs font-bold text-slate-700 mb-2">Organizer Type <span className="text-red-500">*</span></label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedOrganizerType('core')}
                              className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors ${
                                selectedOrganizerType === 'core'
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              ⭐ Core Organizer
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedOrganizerType('normal')}
                              className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors ${
                                selectedOrganizerType === 'normal'
                                  ? 'bg-slate-700 text-white border-slate-700'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              Normal Organizer
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {selectedOrganizerType === 'core'
                              ? 'Core Organizers can access the Proposal Workspace and manage the organizing team.'
                              : 'Normal Organizers help with the event but cannot manage the organizing team.'}
                          </p>
                        </div>

                        <div className="mb-4">
                          <label className="block text-xs font-bold text-slate-700 mb-2">Responsibility <span className="text-red-500">*</span></label>
                          <select 
                            className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                            value={selectedResponsibility}
                            onChange={(e) => setSelectedResponsibility(e.target.value)}
                          >
                            <option value="">-- Select Responsibility --</option>
                            <option value="Event Lead">Event Lead</option>
                            <option value="Co-Lead">Co-Lead</option>
                            <option value="Logistics">Logistics</option>
                            <option value="Hospitality">Hospitality</option>
                            <option value="Registration">Registration</option>
                            <option value="Technical">Technical</option>
                            <option value="Marketing">Marketing</option>
                            <option value="Design">Design</option>
                            <option value="Photography">Photography</option>
                            <option value="Documentation">Documentation</option>
                            {(isFaculty || user?.roles?.includes('admin')) && (
                               <option value="Faculty Coordinator">Faculty Coordinator</option>
                            )}
                          </select>
                        </div>
                        
                        <button 
                          onClick={() => handleAddTeamMember(selectedUserForAdd, selectedResponsibility)}
                          disabled={!selectedResponsibility || addingMember}
                          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
                        >
                          {addingMember ? 'Adding...' : 'Add to Team'}
                        </button>
                      </div>
                    ) : (
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
                    )}
                    
                    {!selectedUserForAdd && searchResults.length > 0 && (
                      <div className="mt-2 border border-slate-100 rounded-lg divide-y divide-slate-100 bg-slate-50 overflow-hidden max-h-60 overflow-y-auto">
                        {searchResults.map(u => (
                          <div key={u.id} className="p-3 flex items-center justify-between hover:bg-slate-100 transition-colors">
                            <div>
                              <p className="font-bold text-sm text-slate-800">{u.name || u.fullName}</p>
                              <p className="text-xs text-slate-500">{u.email} {u.department ? `• ${u.department}` : ''}</p>
                            </div>
                            <button 
                              onClick={() => setSelectedUserForAdd(u)}
                              disabled={team.some(t => t.user_id === u.id)}
                              className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                            >
                              {team.some(t => t.user_id === u.id) ? 'Already Added' : 'Select'}
                            </button>
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
                       {team.filter(t => t.global_role?.startsWith('faculty')).length === 0 && (
                         <li className="py-2 text-xs text-slate-400 italic">No faculty assigned yet.</li>
                       )}
                       {team.filter(t => t.global_role?.startsWith('faculty')).map(t => (
                         <li key={t.id} className="py-3 flex justify-between items-center">
                           <div>
                             <p className="font-bold text-sm text-slate-800">
                               {t.name}
                               {t.role && (
                                 <span className="ml-3 px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full border border-slate-200">
                                   {t.role}
                                 </span>
                               )}
                             </p>
                             <p className="text-xs text-slate-500 mt-0.5">{t.email}</p>
                           </div>
                           {(isCreator || isFaculty || user?.roles?.includes('admin')) && ['draft', 'pending_approval', 'under_review', 'needs_revision'].includes(event.status) && t.user_id !== event.faculty_id && (
                             <button onClick={() => handleRemoveTeamMember(t.id)} className="text-xs text-red-500 hover:text-red-700 font-bold px-2 py-1 bg-red-50 rounded transition-colors">Remove</button>
                           )}
                         </li>
                       ))}
                     </ul>
                  </div>

                  <div className="p-4 bg-white">
                     <h4 className="font-bold text-sm text-indigo-600 mb-3 uppercase tracking-wider">Student Organizers</h4>
                     <ul className="divide-y divide-slate-100">
                       {team.filter(t => !t.global_role?.startsWith('faculty')).length === 0 && (
                         <li className="py-2 text-xs text-slate-400 italic">No students assigned yet.</li>
                       )}
                       {team.filter(t => !t.global_role?.startsWith('faculty')).map(t => {
                         const isProtected = t.user_id === event.proposed_by || t.user_id === event.student_organizer_id;
                         const isCoreOrg = t.organizer_type === 'core';
                         const canManage = (isCreator || isFaculty || user?.roles?.includes('admin')) && ['draft', 'pending_approval', 'under_review', 'needs_revision'].includes(event.status);
                         return (
                           <li key={t.id} className="py-3 flex justify-between items-center gap-3">
                             <div className="flex-1 min-w-0">
                               <p className="font-bold text-sm text-slate-800 flex items-center flex-wrap gap-1.5">
                                 {t.name}
                                 <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${isCoreOrg ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                   {isCoreOrg ? '⭐ Core' : 'Normal'}
                                 </span>
                                 {t.role && (
                                   <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-semibold rounded-full border border-slate-200">
                                     {t.role}
                                   </span>
                                 )}
                                 {isProtected && (
                                   <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full border border-amber-200">Primary</span>
                                 )}
                               </p>
                               <p className="text-xs text-slate-500 mt-0.5 truncate">{t.email}</p>
                             </div>
                             {canManage && (
                               <div className="flex items-center gap-1.5 shrink-0">
                                 {!isProtected && (
                                   <button
                                     onClick={() => handleChangeOrganizerType(t.id, isCoreOrg ? 'normal' : 'core')}
                                     className="text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                   >
                                     {isCoreOrg ? 'Set Normal' : 'Set Core'}
                                   </button>
                                 )}
                                 {!isProtected && (
                                   <button
                                     onClick={() => handleRemoveTeamMember(t.id)}
                                     className="text-[10px] text-red-500 hover:text-red-700 font-bold px-2 py-1 bg-red-50 rounded-lg border border-red-100 transition-colors"
                                   >
                                     Remove
                                   </button>
                                 )}
                               </div>
                             )}
                           </li>
                         );
                       })}
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
                            <div className="flex flex-col mb-2 opacity-90">
                              <span className="text-xs font-bold">{isMe ? 'You' : msg.sender?.full_name}</span>
                              <span className={`text-[10px] font-medium mt-0.5 ${isMe ? 'text-indigo-100' : 'text-slate-500'}`}>
                                {getRoleBadge(msg.user_id, msg.sender?.role)}
                              </span>
                              <span className="text-[10px] opacity-75 mt-0.5">
                                {new Date(msg.created_at).toLocaleDateString()} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
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
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
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
                          <div className="flex gap-2">
                            <a 
                              href={getFileUrl(doc.file_url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                              download
                              title="Download/View Document"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </a>
                            {(isCreator || isFaculty || user?.roles?.includes('admin')) && ['draft', 'pending_approval', 'under_review', 'needs_revision'].includes(event.status) && (
                              <button
                                onClick={() => handleRemoveDocument(doc.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                title="Remove Document"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              </button>
                            )}
                          </div>
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
