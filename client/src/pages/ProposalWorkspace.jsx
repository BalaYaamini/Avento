import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth, supabase } from '../context/AuthContext';
import axios from 'axios';
import { GeometricBlobDoodle, StickyNoteDoodle, SparkleDoodle } from '../components/Doodles';
import OrganizingTeamTab from '../components/OrganizingTeamTab';
import SlotManagementTab from '../components/SlotManagementTab';

// Helper to convert DB timestamp to local YYYY-MM-DDTHH:mm string for datetime-local input
const formatToDatetimeLocal = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Helper to convert local YYYY-MM-DDTHH:mm string back to standard UTC ISO string
const toUtcIso = (dateStr) => {
  if (!dateStr) return null;
  if (typeof dateStr === 'string' && (dateStr.endsWith('Z') || dateStr.includes('+'))) {
    return dateStr;
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

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
  const [publishing, setPublishing] = useState(false);

  // Event Details editing state
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [savingDetails, setSavingDetails] = useState(false);
  const [posterFile, setPosterFile] = useState(null);
  const [posterPreview, setPosterPreview] = useState('');

  // Team state
  const [team, setTeam] = useState([]);

  // Higher Official Permission State
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [higherOfficials, setHigherOfficials] = useState([]);
  const [loadingOfficials, setLoadingOfficials] = useState(false);
  const [selectedOfficialId, setSelectedOfficialId] = useState('');
  const [permissionSubject, setPermissionSubject] = useState('');
  const [proposalLetter, setProposalLetter] = useState('');
  const [permissionFiles, setPermissionFiles] = useState([]);
  const [submittingPermission, setSubmittingPermission] = useState(false);

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

  const openPermissionModal = () => {
    fetchHigherOfficials();
    const evtTitle = event?.title || 'Event Proposal';
    const evtDate = event?.date ? new Date(event.date).toLocaleDateString() : 'TBD';
    const evtVenue = event?.venue || 'Campus Venue';
    const proposer = user?.name || user?.fullName || 'Event Coordinator';

    setPermissionSubject(`Formal Permission Request: ${evtTitle}`);
    setProposalLetter(
`Respected Authority,

I am writing to formally request official permission to conduct the proposed event "${evtTitle}".

Event Summary:
- Proposed Date: ${evtDate}
- Venue: ${evtVenue}
- Category: ${event?.category || 'Technical'}
- Estimated Capacity: ${event?.capacity || '50'}
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
    formData.append('official_id', selectedOfficialId);
    formData.append('officialId', selectedOfficialId);
    formData.append('subject', permissionSubject.trim() || `Permission Request: ${event?.title || 'Event'}`);
    formData.append('proposal_letter', proposalLetter.trim());
    formData.append('proposalLetter', proposalLetter.trim());

    Array.from(permissionFiles).forEach(file => {
      formData.append('attachments', file);
    });

    try {
      setSubmittingPermission(true);
      await axios.post(`/api/events/${proposalId}/official-permission`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('Formal proposal letter and documents submitted to Higher Official successfully.');
      setIsPermissionModalOpen(false);
      setPermissionFiles([]);
      fetchWorkspace(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit permission request.');
    } finally {
      setSubmittingPermission(false);
    }
  };

  const fetchWorkspace = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await axios.get(`/api/events/${proposalId}/proposal-workspace?_t=${Date.now()}`);
      if (res.data) {
        setData(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load proposal workspace.');
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };
  
  const fetchTeam = async () => {
    try {
      const res = await axios.get(`/api/events/${proposalId}/proposal-team?_t=${Date.now()}`);
      setTeam(res.data);
    } catch (err) {
      console.error('Failed to fetch team', err);
    }
  };

  useEffect(() => {
    fetchWorkspace();
    fetchTeam();

    // Poll every 5 seconds for real-time status and discussion sync
    const interval = setInterval(() => {
      fetchWorkspace(true);
      fetchTeam();
    }, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalId]);

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

      const payload = { 
        ...editFormData, 
        date: toUtcIso(editFormData.date),
        registrationDeadline: editFormData.registrationDeadline ? toUtcIso(editFormData.registrationDeadline) : null,
        imageUrl: finalImageUrl 
      };
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
    if (event?.status === 'needs_revision' && (status === 'approved' || status === 'rejected')) {
      alert('This proposal is currently awaiting revisions from the student organizer. Approval and rejection are locked until the student resubmits.');
      return;
    }

    if (status === 'needs_revision' && !remarks) {
      alert('Please provide revision comments.');
      return;
    }

    if (!window.confirm(`Are you sure you want to change the status to ${status.replace('_', ' ')}?`)) return;

    try {
      setProcessingAction(true);
      const res = await axios.put(`/api/events/${proposalId}/proposal-status`, { status, remarks });
      // Immediately reflect updated event status in UI — preserve nested objects (faculty, student_organizer) that raw API response doesn't include
      setData(prev => {
        if (!prev) return prev;
        const prevEvent = prev.event || {};
        const apiEvent = res.data || {};
        return {
          ...prev,
          event: {
            ...prevEvent,
            ...apiEvent,
            // Preserve nested objects that the status API doesn't return
            faculty: prevEvent.faculty,
            student_organizer: prevEvent.student_organizer,
            // Explicitly set the new status and remarks
            status: status,
            approval_remarks: status === 'needs_revision' ? (remarks || apiEvent.approval_remarks) : (remarks || apiEvent.approval_remarks || prevEvent.approval_remarks)
          }
        };
      });
      setFacultyAction(null);
      setRemarks('');
      // Re-fetch to get fully hydrated data from server
      await Promise.all([fetchWorkspace(true), fetchTeam()]);
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.message || 'Failed to update status.');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleResubmit = async () => {
    if (!window.confirm('Are you sure you want to resubmit this proposal for review?')) return;
    try {
      setProcessingAction(true);
      const res = await axios.put(`/api/events/${proposalId}/proposal-resubmit`);
      // Immediately reflect updated status — preserve nested objects (faculty, student_organizer) that raw API doesn't include
      setData(prev => {
        if (!prev) return prev;
        const prevEvent = prev.event || {};
        const apiEvent = res.data || {};
        return {
          ...prev,
          event: {
            ...prevEvent,
            ...apiEvent,
            faculty: prevEvent.faculty,
            student_organizer: prevEvent.student_organizer,
            status: 'pending_approval',
            approval_remarks: null,
            revision_number: apiEvent.revision_number || (prevEvent.revision_number || 1) + 1
          }
        };
      });
      alert('Proposal resubmitted for review successfully! The faculty coordinator has been notified.');
      await Promise.all([fetchWorkspace(true), fetchTeam()]);
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.message || 'Failed to resubmit proposal.');
    } finally {
      setProcessingAction(false);
    }
  };

  const handlePublish = async () => {
    if (!window.confirm('Are you sure you want to publish this event? Once published, registrations will be open to all students.')) return;
    try {
      setPublishing(true);
      await axios.put(`/api/events/${proposalId}/publish`);
      alert('Event published successfully! Opening your unified Event Workspace...');
      navigate(`/workspace/${proposalId}`);
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.message || 'Failed to publish event.');
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-fuchsia-500/20 border-t-fuchsia-600 rounded-full animate-spin" />
        <p className="text-sm font-bold text-slate-500">Loading Proposal Workspace...</p>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-center p-8 bg-slate-50 min-h-screen">{error}</div>;
  }

  if (!data) return null;

  const { event, discussions, documents, timeline } = data;
  
  const isFaculty = Boolean(user && (
    String(user.id) === String(event.faculty_id) || 
    user.roles?.includes('admin') || 
    user.role === 'admin' ||
    user.roles?.includes('faculty') ||
    user.roles?.includes('faculty_organizer') ||
    user.role === 'faculty' ||
    user.role === 'faculty_organizer'
  ));
  const isCreator = Boolean(user && (
    String(user.id) === String(event.proposed_by) || 
    String(user.id) === String(event.student_organizer_id) || 
    String(user.id) === String(event.organizer_id) ||
    String(user.id) === String(event.created_by) || 
    user.roles?.includes('admin') || 
    user.role === 'admin'
  ));

  // Dynamically resolve actual names for coordinator and proposer (prevent generic placeholders)
  const coordinatorName =
    event.faculty?.name ||
    event.faculty?.full_name ||
    team.find(t => t.global_role?.startsWith('faculty') || t.role === 'Faculty Coordinator' || t.user_id === event.faculty_id)?.name ||
    event.faculty_name ||
    (event.faculty_id ? 'Assigned Coordinator' : 'Not Assigned');

  const proposerName = (() => {
    // 1. Check direct event student organizer / proposer properties
    const directProposer = event.student_organizer || event.proposer;
    if (directProposer?.name && directProposer.name.trim() && directProposer.name !== 'Student' && directProposer.name !== 'Student Organizer') {
      return directProposer.name;
    }
    if (event.proposer_name && event.proposer_name.trim() && event.proposer_name !== 'Student' && event.proposer_name !== 'Student Organizer') {
      return event.proposer_name;
    }
    if (event.student_name && event.student_name.trim() && event.student_name !== 'Student' && event.student_name !== 'Student Organizer') {
      return event.student_name;
    }

    // 2. Search in team list for the proposer or lead organizer
    const teamProposer = team.find(t => 
      (t.user_id === event.proposed_by || t.user_id === event.student_organizer_id || t.user_id === event.created_by || t.user_id === event.organizer_id) &&
      t.name && t.name.trim() && t.name !== 'Student' && t.name !== 'Student Organizer'
    );
    if (teamProposer?.name) return teamProposer.name;

    // 3. Search in team for any student member with a valid non-placeholder name
    const studentTeamMember = team.find(t => 
      !(t.global_role?.startsWith('faculty') || t.role?.toLowerCase()?.includes('faculty') || t.user_id === event.faculty_id) &&
      t.name && t.name.trim() && t.name !== 'Student' && t.name !== 'Student Organizer'
    );
    if (studentTeamMember?.name) return studentTeamMember.name;

    // 4. Check timeline for proposal submission actor
    const timelineActor = data?.timeline?.find(t => t.action?.toLowerCase().includes('submitted') || t.action?.toLowerCase().includes('created'))?.actor;
    if (timelineActor?.name && timelineActor.name.trim() && timelineActor.name !== 'Student' && timelineActor.name !== 'Student Organizer') {
      return timelineActor.name;
    }

    // 5. If current user is student or creator
    if ((isCreator || user?.role === 'student' || user?.roles?.includes('student')) && (user?.name || user?.fullName) && (user.name || user.fullName).trim() && (user.name || user.fullName) !== 'Student') {
      return user.name || user.fullName;
    }

    // 6. Check if email gives a meaningful formatted username
    const studentEmail = directProposer?.email || teamProposer?.email || studentTeamMember?.email || (isCreator ? user?.email : null);
    if (studentEmail) {
      const emailPrefix = studentEmail.split('@')[0];
      const emailName = emailPrefix.replace(/[._-]+/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const roll = directProposer?.roll_number || teamProposer?.roll_number || studentTeamMember?.roll_number || (isCreator ? user?.roll_number : null);
      if (emailName && emailName.toLowerCase() !== 'student') {
        return roll ? `${emailName} (${roll})` : emailName;
      }
      if (roll) return `Student (${roll})`;
      if (emailPrefix) return emailPrefix;
    }

    // 7. Check roll number if present
    const roll = directProposer?.roll_number || teamProposer?.roll_number || studentTeamMember?.roll_number || (isCreator ? user?.roll_number : null);
    if (roll) return `Student (${roll})`;

    // 8. Fallback to direct name or generic role
    if (directProposer?.name) return directProposer.name;
    if (studentTeamMember?.name) return studentTeamMember.name;

    return 'Student Organizer';
  })();

  const getStatusBadge = (status) => {
    const s = status || 'draft';
    switch (s) {
      case 'pending_approval':
      case 'under_review':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            Under Review
          </span>
        );
      case 'needs_revision':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
            Needs Revision
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Approved
          </span>
        );
      case 'published':
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
            Published
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
            {s.replace(/_/g, ' ')}
          </span>
        );
    }
  };

  const officialPermissions = data?.officialPermissions || [];
  const latestPermission = officialPermissions[0] || null;

  const tabs = [
    { id: 'summary', label: 'Overview & Details' },
    { id: 'discussion', label: 'Discussion', count: discussions?.length || 0 },
    { id: 'documents', label: 'Documents', count: documents?.length || 0 },
    { id: 'permissions', label: 'Higher Official Permissions', count: officialPermissions.length },
    { id: 'team', label: 'Organizing Team', count: team?.length || 0 },
    { id: 'timeline', label: 'Timeline', count: timeline?.length || 0 },
    ...((event.has_slots || event.registration_type === 'slot_wise') ? [{ id: 'slots', label: 'Slot Schedule' }] : [])
  ];

  const getFileUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    return axios.defaults.baseURL ? `${axios.defaults.baseURL}${url}` : `http://localhost:5001${url}`;
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-body text-slate-700">
      <GeometricBlobDoodle className="absolute top-10 right-10 w-96 h-96 text-pastel-lavender -z-10 opacity-25 animate-spin-slow" />
      <GeometricBlobDoodle className="absolute bottom-20 left-10 w-80 h-80 text-pastel-mint -z-10 opacity-25 animate-float" />

      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        
        {/* Back Link & Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link 
            to={isFaculty ? "/faculty-organizer/events" : "/student-organizer/events"} 
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-fuchsia-600 bg-white/80 backdrop-blur-sm px-3.5 py-1.5 rounded-xl border border-slate-200/70 shadow-xs transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Proposals</span>
          </Link>
          <span className="text-xs font-medium text-slate-400">
            Workspace ID: <span className="font-mono text-slate-600">{proposalId.slice(0, 8)}...</span>
          </span>
        </div>

        {/* Hero Header Card */}
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs relative overflow-hidden">
          <StickyNoteDoodle className="absolute -top-4 -right-4 w-12 h-12 text-pastel-yellow opacity-70 hidden md:block" />
          
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-3 flex-1">
              {/* Category, Status & Revision Badges */}
              <div className="flex flex-wrap items-center gap-2.5">
                {event.category && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200/70">
                    {event.category}
                  </span>
                )}
                {getStatusBadge(event.status)}
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200/70">
                  Revision {event.revision_number || 1}
                </span>
                {latestPermission && (
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                    latestPermission.status === 'granted'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : latestPermission.status === 'rejected'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : latestPermission.status === 'revision_requested'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-violet-50 text-violet-700 border-violet-200'
                  }`}>
                    <span>Official: {latestPermission.status === 'granted' ? 'Permission Granted' : latestPermission.status === 'rejected' ? 'Permission Denied' : latestPermission.status === 'revision_requested' ? 'Revision Needed' : 'Pending Review'}</span>
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-black text-slate-900 leading-tight">
                {event.title}
              </h1>

              {/* Key Meta Badges */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium pt-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/80 text-slate-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  <span>{event.venue || 'Venue TBD'}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/80 text-slate-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                  <span>{new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                  </svg>
                  <span>Coordinator: {coordinatorName}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/80 text-slate-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                  <span>Proposed by: {proposerName}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/80 text-slate-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                  </svg>
                  <span>{team.length} Team Members</span>
                </div>
              </div>
            </div>

            {/* Header Primary Action */}
            <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {event.status === 'approved' && (isCreator || user?.roles?.includes('admin') || user?.role === 'admin') && (
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="btn-primary px-6 py-3 rounded-2xl font-bold text-sm text-white shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer hover:opacity-95 active:scale-95 transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{publishing ? 'Publishing Event...' : 'Publish Event Live'}</span>
                </button>
              )}

              {['published', 'active'].includes(event.status) && (
                <Link
                  to={`/workspace/${proposalId}`}
                  className="px-6 py-3 rounded-2xl font-bold text-sm bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/20 flex items-center justify-center gap-2 hover:opacity-95 transition-all cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                  <span>Open All-in-One Workspace</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Faculty Decision & Review Banner (if Faculty) */}
        {isFaculty && ['pending_approval', 'under_review'].includes(event.status) && (
          <div className="bg-gradient-to-r from-indigo-50/90 via-purple-50/80 to-white backdrop-blur-md rounded-3xl p-6 border border-indigo-200/80 shadow-xs animate-fade-in">
            {/* Student Resubmission Alert — only when revision_number > 1 */}
            {(event.revision_number || 1) > 1 && (
              <div className="mb-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200/80 flex items-start gap-3 animate-fade-in">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="font-display font-bold text-sm text-emerald-900 flex items-center gap-2">
                    <span>Student Resubmitted — Revision {event.revision_number} Ready for Review</span>
                    <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-full bg-emerald-200 text-emerald-900 animate-pulse">New</span>
                  </div>
                  <p className="text-xs text-emerald-800 mt-1">
                    The student has addressed your revision feedback and resubmitted this proposal. Please review the updated details, documents, and discussion thread before making a new decision.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <div>
                <h3 className="font-display font-bold text-lg text-slate-800 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                  </svg>
                  <span>Faculty Coordinator Decision Panel</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {(event.revision_number || 1) > 1
                    ? `Reviewing Revision ${event.revision_number} — Please re-evaluate the updated proposal before making a decision.`
                    : 'Review the event details, team members, and uploaded documents before making an approval decision.'
                  }
                </p>
              </div>
              <div className="text-xs font-bold text-slate-500">
                Current Status: <span className="uppercase text-indigo-600">{event.status.replace(/_/g, ' ')}</span>
                {(event.revision_number || 1) > 1 && <span className="ml-2 uppercase text-emerald-600">• Revision {event.revision_number}</span>}
              </div>
            </div>

            {/* Decision Buttons Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button 
                onClick={() => setFacultyAction(facultyAction === 'approve' ? null : 'approve')}
                className={`py-2.5 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  facultyAction === 'approve' 
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 shadow-sm' 
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span>Approve Proposal</span>
              </button>

              {event.status !== 'under_review' ? (
                <button 
                  onClick={() => handleFacultyAction('under_review')}
                  disabled={processingAction}
                  className="py-2.5 px-4 rounded-xl font-bold text-xs bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Mark Under Review</span>
                </button>
              ) : (
                <div className="py-2.5 px-4 rounded-xl font-bold text-xs bg-amber-100/70 text-amber-800 border border-amber-300 flex items-center justify-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-amber-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Under Active Review</span>
                </div>
              )}

              <button 
                onClick={() => setFacultyAction(facultyAction === 'request_revision' ? null : 'request_revision')}
                className={`py-2.5 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  facultyAction === 'request_revision' 
                    ? 'bg-orange-600 text-white ring-2 ring-orange-400 shadow-sm' 
                    : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Request Revision</span>
              </button>

              <button 
                onClick={() => setFacultyAction(facultyAction === 'reject' ? null : 'reject')}
                className={`py-2.5 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  facultyAction === 'reject' 
                    ? 'bg-red-600 text-white ring-2 ring-red-400 shadow-sm' 
                    : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Reject Proposal</span>
              </button>
            </div>

            {/* Interactive Decision Form */}
            {facultyAction && (
              <div className="mt-4 p-5 bg-white rounded-2xl border border-indigo-200 shadow-sm animate-fade-in-up">
                <label className="block text-xs font-bold text-slate-800 mb-2">
                  {facultyAction === 'request_revision' ? 'Specify Revision Instructions (Required)' : 
                   facultyAction === 'reject' ? 'State Rejection Reason (Required)' : 
                   'Approval Remarks & Instructions for Student (Optional)'}
                </label>
                <textarea 
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm mb-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50/50 resize-none font-body"
                  rows="3"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder={
                    facultyAction === 'request_revision' ? 'Clearly list what the student needs to update, modify, or add before approval...' :
                    facultyAction === 'reject' ? 'Provide constructive feedback explaining why this proposal cannot proceed...' :
                    'Add any congratulations or special instructions for the organizing team...'
                  }
                />
                <div className="flex gap-2 justify-end">
                  <button 
                    onClick={() => { setFacultyAction(null); setRemarks(''); }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => handleFacultyAction(facultyAction === 'approve' ? 'approved' : facultyAction === 'reject' ? 'rejected' : 'needs_revision')}
                    disabled={processingAction || (facultyAction === 'reject' && !remarks.trim()) || (facultyAction === 'request_revision' && !remarks.trim())}
                    className={`px-5 py-2 font-bold text-xs rounded-xl text-white transition-all shadow-xs cursor-pointer disabled:opacity-50 ${
                      facultyAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' :
                      facultyAction === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                      'bg-orange-600 hover:bg-orange-700'
                    }`}
                  >
                    {processingAction ? 'Confirming...' : 'Confirm Decision'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Faculty Awaiting Revision Notice (Actions Locked until Resubmission) */}
        {isFaculty && event.status === 'needs_revision' && (
          <div className="p-6 bg-gradient-to-r from-amber-50/90 via-orange-50/70 to-white rounded-3xl border border-amber-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-display font-bold">Proposal Under Revision — Actions Locked</span>
              </div>
              <p className="text-xs text-amber-800">
                You have requested revisions for this proposal. Review and approval actions are temporarily locked until the student resubmits the revised proposal.
              </p>
              {event.approval_remarks && (
                <div className="mt-2 text-xs text-slate-700 bg-white/85 p-3 rounded-xl border border-amber-200/60 max-w-3xl">
                  <span className="font-bold text-slate-800">Requested Revisions: </span>
                  {event.approval_remarks}
                </div>
              )}
            </div>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-100/80 text-amber-800 border border-amber-200 shrink-0 self-start md:self-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
              Awaiting Student Resubmission
            </span>
          </div>
        )}

        {/* Proposal Approved Banner */}
        {event.status === 'approved' && (
          <div className="p-6 bg-gradient-to-r from-emerald-50/95 via-teal-50/80 to-white rounded-3xl border border-emerald-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5 animate-fade-in">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-base">
                <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="font-display">Proposal Formally Approved</span>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed max-w-3xl">
                This event proposal has been reviewed and approved by the Faculty Coordinator. 
                {isCreator ? ' You can now review the final parameters and publish the event live to begin student registrations.' : ' The student organizing lead or administrator can now publish the event live.'}
              </p>
              {event.approval_remarks && (
                <div className="mt-2 text-xs text-slate-700 bg-white/90 p-3.5 rounded-xl border border-emerald-200/80 max-w-3xl">
                  <span className="font-bold text-slate-800">Approval Remarks: </span>
                  <span className="whitespace-pre-line">{event.approval_remarks.replace(/\[Approved By: [^\]]+\]/g, '').trim() || 'Approved.'}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              {(isCreator || user?.roles?.includes('admin') || user?.role === 'admin') && (
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="px-6 py-3 rounded-2xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{publishing ? 'Publishing Live...' : 'Publish Event Live'}</span>
                </button>
              )}
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0 self-start sm:self-auto">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Approved
              </span>
            </div>
          </div>
        )}

        {/* Proposal Rejected Banner */}
        {event.status === 'rejected' && (
          <div className="p-6 bg-gradient-to-r from-red-50/90 via-rose-50/70 to-white rounded-3xl border border-red-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2 text-red-900 font-bold text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="font-display font-bold">Proposal Rejected</span>
              </div>
              <p className="text-xs text-red-800">
                This proposal has been rejected by the Faculty Coordinator. Review the feedback below.
              </p>
              {event.approval_remarks && (
                <div className="mt-2 text-xs text-slate-700 bg-white/90 p-3 rounded-xl border border-red-200/80 max-w-3xl">
                  <span className="font-bold text-slate-800">Coordinator Remarks: </span>
                  {event.approval_remarks}
                </div>
              )}
            </div>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200 shrink-0 self-start md:self-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
              Rejected
            </span>
          </div>
        )}

        {/* Needs Revision Notification Banner for Student */}
        {isCreator && event.status === 'needs_revision' && (
          <div className="p-6 bg-gradient-to-r from-orange-50/95 via-amber-50/90 to-white rounded-3xl border border-orange-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5 animate-fade-in">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2 text-orange-950 font-bold text-sm">
                <div className="w-7 h-7 rounded-full bg-orange-500/20 text-orange-700 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <span className="font-display font-bold">Revision Requested by Faculty Coordinator</span>
              </div>
              <p className="text-xs text-orange-900/90 leading-relaxed max-w-3xl font-medium">
                {event.approval_remarks || 'Please address coordinator remarks, update your event details or upload revised documents, and resubmit for review.'}
              </p>
            </div>
            <button
              onClick={handleResubmit}
              disabled={processingAction}
              className="px-6 py-3 rounded-2xl font-bold text-xs bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white shadow-md shadow-orange-500/25 transition-all shrink-0 cursor-pointer self-start md:self-auto flex items-center gap-2 disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{processingAction ? 'Submitting...' : 'Resubmit Proposal for Review'}</span>
            </button>
          </div>
        )}

        {/* Student Pending Review / Under Review Banner */}
        {!isFaculty && ['pending_approval', 'under_review'].includes(event.status) && (
          <div className="p-6 bg-gradient-to-r from-indigo-50/90 via-purple-50/60 to-white rounded-3xl border border-indigo-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5 animate-fade-in">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2 text-indigo-950 font-bold text-sm">
                <div className="w-7 h-7 rounded-full bg-indigo-500/15 text-indigo-700 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="font-display font-bold">Proposal Submitted — Under Faculty Review</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                Your proposal (Revision {event.revision_number || 1}) has been submitted to <span className="font-bold text-slate-800">{coordinatorName}</span> for review. You will receive an automated email and notification once an approval decision is recorded.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-indigo-100/90 text-indigo-800 border border-indigo-200/80 shrink-0 self-start md:self-auto">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              Awaiting Faculty Decision
            </span>
          </div>
        )}

        {/* Workspace Tab Navigation Track */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <div className="p-1.5 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/70 shadow-xs flex items-center gap-1.5 shrink-0">
            {tabs.map(tab => {
              const renderTabIcon = () => {
                switch(tab.id) {
                  case 'summary':
                    return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
                  case 'discussion':
                    return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;
                  case 'documents':
                    return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>;
                  case 'permissions':
                    return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>;
                  case 'team':
                    return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
                  case 'timeline':
                    return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
                  case 'slots':
                    return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
                  default:
                    return null;
                }
              };
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-fuchsia-500 text-white shadow-sm shadow-fuchsia-500/20'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  {renderTabIcon()}
                  <span>{tab.label}</span>
                  {typeof tab.count === 'number' && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      activeTab === tab.id ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Workspace Main Tab Panels */}
        <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-xs p-6 min-h-[500px]">
          
          {/* TAB 1: OVERVIEW & DETAILS */}
          {activeTab === 'summary' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="font-display font-bold text-xl text-slate-900">Event Overview & Specifications</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Comprehensive proposal parameters and settings</p>
                </div>
                {(isCreator || isFaculty || user?.roles?.includes('admin')) && !isEditingDetails && (
                  <button 
                    onClick={() => {
                      setEditFormData({
                        title: event.title || '',
                        description: event.description || '',
                        date: formatToDatetimeLocal(event.date),
                        registrationDeadline: formatToDatetimeLocal(event.registration_deadline),
                        category: event.category || '',
                        venue: event.venue || '',
                        registrationType: event.registration_type || 'individual',
                        hasSlots: Boolean(event.has_slots),
                        durationDays: event.duration_days || 1,
                        minTeamSize: event.min_team_size || 1,
                        maxTeamSize: event.max_team_size || 1,
                        maxTeams: event.max_teams || '',
                        capacity: event.capacity || '',
                        imageUrl: event.image_url || event.imageUrl || ''
                      });
                      setPosterFile(null);
                      setPosterPreview('');
                      setIsEditingDetails(true);
                    }}
                    className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>Edit Details</span>
                  </button>
                )}
              </div>

              {isEditingDetails ? (
                <div className="space-y-5 animate-fade-in bg-slate-50/60 p-6 rounded-2xl border border-slate-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Event Title *</label>
                      <input
                        type="text"
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-fuchsia-500 focus:outline-none"
                        value={editFormData.title}
                        onChange={(e) => setEditFormData({...editFormData, title: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Category *</label>
                      <input
                        type="text"
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-fuchsia-500 focus:outline-none"
                        value={editFormData.category}
                        onChange={(e) => setEditFormData({...editFormData, category: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Venue / Hall *</label>
                      <input
                        type="text"
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-fuchsia-500 focus:outline-none"
                        value={editFormData.venue}
                        onChange={(e) => setEditFormData({...editFormData, venue: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Proposed Date & Time *</label>
                      <input
                        type="datetime-local"
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-fuchsia-500 focus:outline-none"
                        value={editFormData.date}
                        onChange={(e) => setEditFormData({...editFormData, date: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Registration Type</label>
                      <select
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-fuchsia-500 focus:outline-none cursor-pointer"
                        value={editFormData.registrationType}
                        onChange={(e) => {
                          const rt = e.target.value;
                          setEditFormData({
                            ...editFormData,
                            registrationType: rt,
                            hasSlots: rt === 'slot_wise' ? true : editFormData.hasSlots
                          });
                        }}
                      >
                        <option value="individual">Individual Registration</option>
                        <option value="team">Team Registration</option>
                        <option value="slot_wise">Slot-Wise Registration</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Registration Deadline</label>
                      <input
                        type="datetime-local"
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-fuchsia-500 focus:outline-none"
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
                            className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-fuchsia-500 focus:outline-none"
                            value={editFormData.minTeamSize}
                            onChange={(e) => setEditFormData({...editFormData, minTeamSize: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Max Team Size</label>
                          <input
                            type="number"
                            min="1"
                            className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-fuchsia-500 focus:outline-none"
                            value={editFormData.maxTeamSize}
                            onChange={(e) => setEditFormData({...editFormData, maxTeamSize: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Max Teams Limit</label>
                          <input
                            type="number"
                            min="1"
                            className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-fuchsia-500 focus:outline-none"
                            value={editFormData.maxTeams}
                            onChange={(e) => setEditFormData({...editFormData, maxTeams: e.target.value})}
                          />
                        </div>
                      </>
                    )}

                    {editFormData.registrationType === 'individual' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Capacity (Seats)</label>
                        <input
                          type="number"
                          min="1"
                          className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-fuchsia-500 focus:outline-none"
                          value={editFormData.capacity}
                          onChange={(e) => setEditFormData({...editFormData, capacity: e.target.value})}
                          placeholder="Total seats available"
                        />
                      </div>
                    )}
                  </div>

                  {/* Slot-Wise Registration Toggle */}
                  <div className="flex items-center justify-between p-3.5 bg-cyan-50/60 border border-cyan-200/60 rounded-xl">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Enable Slot-Wise Registration</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Allow participants to select their convenient time slot</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editFormData.hasSlots}
                        onChange={(e) => setEditFormData({
                          ...editFormData,
                          hasSlots: e.target.checked,
                          registrationType: (!e.target.checked && editFormData.registrationType === 'slot_wise') ? 'individual' : editFormData.registrationType
                        })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-fuchsia-600"></div>
                    </label>
                  </div>

                  {/* Event Duration (Days) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Event Duration (Days)</label>
                    <input
                      type="number"
                      min="1"
                      max="7"
                      className="w-full sm:max-w-[160px] p-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-fuchsia-500 focus:outline-none"
                      value={editFormData.durationDays}
                      onChange={(e) => setEditFormData({...editFormData, durationDays: e.target.value})}
                    />
                    <p className="text-[10px] text-slate-500 mt-1">For 2+ day events, the Slot Schedule tab will ask for Day 1, Day 2… when creating slots, and slots are listed day-wise.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Event Poster Image</label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      {(posterPreview || editFormData.imageUrl) && (
                        <img 
                          src={posterPreview || editFormData.imageUrl} 
                          alt="Poster Preview" 
                          className="w-48 h-28 rounded-xl border border-slate-200 object-cover shadow-xs"
                        />
                      )}
                      <label className="cursor-pointer px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition-colors shadow-xs inline-block">
                        Choose New Poster
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
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Description *</label>
                    <textarea
                      className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-fuchsia-500 focus:outline-none min-h-[140px]"
                      value={editFormData.description}
                      onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                      placeholder="Enter detailed proposal description..."
                    />
                  </div>
                  
                  <div className="flex gap-2 justify-end pt-2">
                    <button 
                      onClick={() => setIsEditingDetails(false)}
                      disabled={savingDetails}
                      className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveDetails}
                      disabled={savingDetails || !editFormData.title?.trim() || !editFormData.description?.trim()}
                      className="btn-primary px-5 py-2 font-bold text-xs rounded-xl text-white shadow-xs cursor-pointer flex items-center gap-2"
                    >
                      {savingDetails ? 'Saving...' : 'Save Details'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Poster & Specs Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Poster */}
                    <div className="lg:col-span-1">
                      <div className="w-full h-52 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/80 shadow-xs relative">
                        <img 
                          src={event.image_url || event.imageUrl} 
                          alt={event.title} 
                          className="w-full h-full object-cover" 
                        />
                        {event.category && (
                          <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold bg-black/60 text-white backdrop-blur-xs">
                            {event.category}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Specification Badges Grid */}
                    <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/60">
                        <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider block mb-1">Venue</span>
                        <p className="font-semibold text-slate-800 text-sm">{event.venue || 'TBA'}</p>
                      </div>

                      <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/60">
                        <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider block mb-1">Date & Time</span>
                        <p className="font-semibold text-slate-800 text-sm">
                          {event.date ? new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'TBA'}
                        </p>
                      </div>

                      <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/60">
                        <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider block mb-1">Registration Type</span>
                        <p className="font-semibold text-slate-800 text-sm capitalize">
                          {event.registration_type === 'team' ? 'Team Event' : event.registration_type === 'slot_wise' ? 'Slot-Wise Event' : 'Individual Event'}{event.has_slots && event.registration_type !== 'slot_wise' ? ' (Slot-Wise)' : ''}
                        </p>
                      </div>

                      {event.registration_type === 'team' ? (
                        <>
                          <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/60">
                            <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider block mb-1">Team Size Limit</span>
                            <p className="font-semibold text-slate-800 text-sm">{event.min_team_size} to {event.max_team_size} members</p>
                          </div>
                          <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/60">
                            <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider block mb-1">Max Teams</span>
                            <p className="font-semibold text-slate-800 text-sm">{event.max_teams ? `${event.max_teams} teams` : 'Unlimited'}</p>
                          </div>
                        </>
                      ) : (
                        <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/60">
                          <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider block mb-1">Capacity</span>
                          <p className="font-semibold text-slate-800 text-sm">{event.capacity ? `${event.capacity} seats` : 'Open'}</p>
                        </div>
                      )}

                      {event.registration_deadline && (
                        <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/60">
                          <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider block mb-1">Reg. Deadline</span>
                          <p className="font-semibold text-slate-800 text-sm">
                            {new Date(event.registration_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      )}

                      {event.has_slots && (
                        <div className="p-3.5 bg-cyan-50/80 rounded-2xl border border-cyan-200/60">
                          <span className="text-cyan-600 font-bold text-[10px] uppercase tracking-wider block mb-1">Slot-Wise Registration</span>
                          <p className="font-semibold text-cyan-800 text-sm flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Enabled
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Description Section */}
                  <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200/60 space-y-2">
                    <h3 className="font-display font-bold text-sm text-slate-800 uppercase tracking-wider">Proposal Description</h3>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {event.description || 'No description provided.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: REVIEW & DISCUSSION */}
          {activeTab === 'discussion' && (
            <div className="flex flex-col h-[550px] animate-fade-in">
              <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-900">Review & Discussion Channel</h3>
                  <p className="text-xs text-slate-500">Direct message channel between student organizers and faculty coordinator</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-100">
                  {discussions.length} {discussions.length === 1 ? 'Message' : 'Messages'}
                </span>
              </div>

              {/* Messages Container */}
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-2">
                {discussions.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-8">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <p className="font-bold text-sm text-slate-600">No discussion messages yet</p>
                    <p className="text-xs text-slate-400 max-w-xs mt-1">Start a conversation regarding questions, requirements, or approvals.</p>
                  </div>
                ) : (
                  discussions.map(msg => {
                    const isMe = String(msg.user_id) === String(user.id);
                    const isFacultySender = String(msg.user_id) === String(event.faculty_id);
                    const isProposerSender = String(msg.user_id) === String(event.proposed_by) || String(msg.user_id) === String(event.student_organizer_id);

                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-4 transition-all ${
                          isMe 
                            ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-tr-xs shadow-xs' 
                            : 'bg-slate-50 border border-slate-200/80 text-slate-800 rounded-tl-xs shadow-xs'
                        }`}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs font-bold">
                              {isMe ? 'You' : (msg.sender?.full_name || msg.sender?.name || 'User')}
                            </span>
                            {isFacultySender && (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isMe ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'}`}>
                                Faculty
                              </span>
                            )}
                            {isProposerSender && !isFacultySender && (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isMe ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
                                Proposer
                              </span>
                            )}
                            <span className={`text-[10px] ml-auto opacity-75`}>
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

              {/* Message Input Bar */}
              <form onSubmit={handleSendMessage} className="mt-4 pt-3 border-t border-slate-100 flex items-end gap-3">
                <div className="flex-1 relative">
                  <textarea
                    className="w-full p-3.5 pr-12 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-fuchsia-500 focus:outline-none resize-none font-body transition-all max-h-28 min-h-[50px]"
                    placeholder="Type a message or response to coordinator..."
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
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 rotate-90" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: DOCUMENTS */}
          {activeTab === 'documents' && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-900">Proposal Documents & Attachments</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Rulebooks, schedules, budgets, and approval forms</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {documents.length} {documents.length === 1 ? 'File' : 'Files'}
                </span>
              </div>

              {/* Upload Box */}
              {(isCreator || isFaculty || user?.roles?.includes('admin')) && ['draft', 'pending_approval', 'under_review', 'needs_revision'].includes(event.status) && (
                <form onSubmit={handleUploadDocument} className="p-6 bg-slate-50/70 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Upload Revision / Supplementary Document</label>
                    <input 
                      type="file" 
                      onChange={(e) => setUploadFile(e.target.files[0])}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-white file:text-fuchsia-700 hover:file:bg-fuchsia-50 file:border-slate-200 file:shadow-xs cursor-pointer"
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
              )}

              {/* Documents List */}
              <div className="space-y-3">
                {documents.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 italic bg-slate-50/50 rounded-2xl border border-slate-100">
                    No documents uploaded for this proposal yet.
                  </div>
                ) : (
                  documents.map(doc => (
                    <div 
                      key={doc.id} 
                      className="p-4 bg-slate-50/60 hover:bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center justify-between gap-4 transition-all"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-indigo-500 shrink-0 shadow-xs">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-slate-800 truncate">{doc.file_name}</p>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                            <span className="font-bold text-fuchsia-600 bg-fuchsia-50 px-2 py-0.5 rounded-md">
                              Revision {doc.version || 1}
                            </span>
                            <span>•</span>
                            <span>Uploaded by {doc.uploader?.full_name || doc.uploader?.name || 'User'}</span>
                            <span>•</span>
                            <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Download & Remove Buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        <a 
                          href={getFileUrl(doc.file_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-white border border-slate-200/80 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-colors shadow-xs inline-flex items-center gap-1.5"
                          download
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          <span>Download</span>
                        </a>
                        {(isCreator || isFaculty || user?.roles?.includes('admin')) && ['draft', 'pending_approval', 'under_review', 'needs_revision'].includes(event.status) && (
                          <button
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

          {/* TAB: HIGHER OFFICIAL PERMISSIONS */}
          {activeTab === 'permissions' && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-bold text-lg text-slate-900">Permission from Higher Official</h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Formal administrative clearance, proposal letters, and official decision remarks from University Admins / Higher Authorities
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={openPermissionModal}
                    className="btn-primary px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer shrink-0"
                  >
                    <span>Request Permission from Higher Official</span>
                  </button>

                  {user?.roles?.includes('admin') && (
                    <Link
                      to="/admin/permissions"
                      className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors shrink-0"
                    >
                      Admin Decision Portal
                    </Link>
                  )}
                </div>
              </div>

              {/* Permissions History List */}
              <div className="space-y-4">
                {officialPermissions.length === 0 ? (
                  <div className="p-12 text-center bg-slate-50/60 rounded-3xl border border-slate-200/80 space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center mx-auto text-2xl shadow-xs border border-slate-200">
                      📜
                    </div>
                    <h4 className="text-sm font-bold text-slate-800">No Official Permissions Requested Yet</h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                      Faculty and student coordinators can request formal permission from a Higher Official (University Admin) by drafting a proposal letter and attaching supporting documents.
                    </p>
                    <button
                      type="button"
                      onClick={openPermissionModal}
                      className="mt-2 btn-primary px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-95 transition-all inline-flex items-center gap-2 cursor-pointer"
                    >
                      <span>Request Official Clearance Now</span>
                    </button>
                  </div>
                ) : (
                  officialPermissions.map(perm => {
                    const attachments = Array.isArray(perm.attachments) ? perm.attachments : [];
                    return (
                      <div
                        key={perm.id}
                        className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-5 hover:border-violet-300 transition-all"
                      >
                        {/* Header of Permission Record */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                                perm.status === 'granted'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : perm.status === 'rejected'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : perm.status === 'revision_requested'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-violet-50 text-violet-700 border-violet-200'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  perm.status === 'granted' ? 'bg-emerald-500' :
                                  perm.status === 'rejected' ? 'bg-rose-500' :
                                  perm.status === 'revision_requested' ? 'bg-amber-500' : 'bg-violet-500 animate-pulse'
                                }`}></span>
                                {perm.status === 'granted' ? 'Permission Granted' :
                                 perm.status === 'rejected' ? 'Permission Denied' :
                                 perm.status === 'revision_requested' ? 'Revision Requested' : 'Pending Official Review'}
                              </span>
                              <span className="text-xs text-slate-400 font-medium">
                                Submitted {new Date(perm.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
                            <h4 className="text-base font-bold text-slate-900 mt-1">
                              {perm.subject || 'Higher Official Permission Request'}
                            </h4>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-right sm:text-left shrink-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase">Target Authority</div>
                            <div className="font-bold text-slate-800">{perm.official_user?.name || perm.official_user?.fullName || 'Higher Official'}</div>
                            <div className="text-slate-500 text-[11px]">{perm.official_user?.department || 'University Admin'}</div>
                          </div>
                        </div>

                        {/* Proposal Letter Text */}
                        <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/60 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">
                          {perm.proposal_letter}
                        </div>

                        {/* Attachments */}
                        {attachments.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                              Attached Proposal Documents ({attachments.length})
                            </div>
                            <div className="flex flex-wrap gap-2.5">
                              {attachments.map((file, idx) => (
                                <a
                                  key={idx}
                                  href={getFileUrl(file.file_url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-2xs inline-flex items-center gap-2 transition-colors"
                                  download
                                >
                                  <span>📄</span>
                                  <span className="truncate max-w-xs">{file.file_name}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Official Decision Remarks */}
                        {perm.decided_at && (
                          <div className={`p-4 rounded-xl border text-xs space-y-1 ${
                            perm.status === 'granted'
                              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                              : perm.status === 'rejected'
                              ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                              : 'bg-amber-50/80 border-amber-200 text-amber-900'
                          }`}>
                            <div className="flex items-center justify-between font-bold">
                              <span>Official Decision Remarks from Higher Authority:</span>
                              <span className="text-[10px] font-normal opacity-75">
                                Decided on {new Date(perm.decided_at).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="mt-1 leading-relaxed font-medium">
                              {perm.official_remarks || 'Permission decision recorded.'}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ORGANIZING TEAM */}
          {activeTab === 'team' && (
            <OrganizingTeamTab
              eventId={proposalId}
              event={event}
              user={user}
              hasFullAccess={isCreator || isFaculty}
            />
          )}

          {/* TAB 5: TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-900">Activity & Proposal History</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Chronological audit log of all decisions and uploads</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                  {timeline.length} Events
                </span>
              </div>

              <div className="py-4 relative pl-4 sm:pl-8">
                <div className="absolute left-[23px] sm:left-[39px] top-6 bottom-6 w-0.5 bg-slate-200 rounded-full" />
                <div className="space-y-6">
                  {timeline.length === 0 ? (
                    <div className="text-center text-slate-400 italic py-8">No timeline entries yet.</div>
                  ) : (
                    timeline.map((item, idx) => (
                      <div key={item.id || idx} className="flex items-start gap-4 relative">
                        <div className="w-8 h-8 rounded-full bg-white border-2 border-fuchsia-500 text-fuchsia-600 flex items-center justify-center font-bold text-xs shadow-xs relative z-10 shrink-0">
                          {idx + 1}
                        </div>
                        <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/70 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                            <p className="font-bold text-xs text-slate-800">{item.action}</p>
                            <span className="text-[10px] text-slate-400">
                              {new Date(item.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {item.details && (
                            <p className="text-xs text-slate-600 mt-0.5">{item.details}</p>
                          )}
                          {item.actor && (
                            <div className="text-[10px] font-medium text-indigo-500 mt-1.5">
                              Actor: {item.actor.full_name || item.actor.name}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: SLOT SCHEDULE & MANAGEMENT */}
          {activeTab === 'slots' && (event.has_slots || event.registration_type === 'slot_wise') && (
            <div className="animate-fade-in">
              <SlotManagementTab
                eventId={proposalId}
                event={event}
                user={user}
                hasFullAccess={Boolean(isCreator || isFaculty || user?.roles?.includes('admin') || user?.role === 'admin')}
              />
            </div>
          )}

        </div>

      </div>

      {/* ── MODAL: REQUEST PERMISSION FROM HIGHER OFFICIAL ── */}
      {isPermissionModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-scale-up max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-violet-50 text-violet-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-900">
                    Request Permission from Higher Official
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select a university authority, write your proposal letter, and attach supporting files.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPermissionModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handlePermissionSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
              
              {/* Higher Official Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select Higher Official (University Admin) *
                </label>
                <select
                  required
                  value={selectedOfficialId}
                  onChange={(e) => setSelectedOfficialId(e.target.value)}
                  className="w-full bg-white text-slate-800 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all cursor-pointer shadow-xs"
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
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Subject / Heading
                </label>
                <input
                  type="text"
                  required
                  value={permissionSubject}
                  onChange={(e) => setPermissionSubject(e.target.value)}
                  placeholder="e.g. Formal Permission Request for Annual Hackathon 2026"
                  className="w-full bg-white text-slate-800 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                />
              </div>

              {/* Proposal Letter Body */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Proposal Letter *
                </label>
                <textarea
                  required
                  rows={8}
                  value={proposalLetter}
                  onChange={(e) => setProposalLetter(e.target.value)}
                  placeholder="Write formal event proposal letter to the higher official..."
                  className="w-full p-4 text-sm bg-white border border-slate-300 text-slate-800 rounded-2xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:outline-none transition-all font-sans leading-relaxed"
                />
              </div>

              {/* Attachments */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Attach Supporting Documents (Agenda, Budget, Circulars)
                </label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*"
                  onChange={(e) => setPermissionFiles(e.target.files)}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-violet-700 hover:file:bg-violet-50 file:border-slate-200 file:shadow-xs cursor-pointer"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  You can select multiple PDF, Word, PowerPoint, Excel, or image files.
                </p>
              </div>

              {/* Footer Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPermissionModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPermission}
                  className="btn-primary px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submittingPermission ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Sending Letter...</span>
                    </>
                  ) : (
                    <>
                      <span>✉️</span>
                      <span>Send Proposal Letter to Higher Official</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProposalWorkspace;
