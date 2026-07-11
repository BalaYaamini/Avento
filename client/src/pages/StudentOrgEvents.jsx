import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import QRScanner from '../components/QRScanner';

const StudentOrgEvents = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create', 'edit'
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  
  // Scanner Modal states
  const [scannerModalEvent, setScannerModalEvent] = useState(null);
  const [scanFeedback, setScanFeedback] = useState(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Technical');
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState('');
  const [capacity, setCapacity] = useState('50');
  const [imageUrl, setImageUrl] = useState('');
  
  // Team configuration states
  const [registrationType, setRegistrationType] = useState('individual'); // 'individual', 'team'
  const [maxTeams, setMaxTeams] = useState('10');
  const [maxTeamSize, setMaxTeamSize] = useState('4');
  const [allowCrossDepartment, setAllowCrossDepartment] = useState(true);
  const [teamLeaderRegistrationRequired, setTeamLeaderRegistrationRequired] = useState(true);

  // Faculty and Team States
  const [facultyList, setFacultyList] = useState([]);
  const [assignedFaculty, setAssignedFaculty] = useState('');
  const [studentsList, setStudentsList] = useState([]);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [teamModalEvent, setTeamModalEvent] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [memberResponsibility, setMemberResponsibility] = useState('Volunteer');
  const [teamFeedback, setTeamFeedback] = useState(null);

  // Organizers States
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [orgModalEvent, setOrgModalEvent] = useState(null);
  const [orgMembers, setOrgMembers] = useState([]);
  const [selectedOrgStudent, setSelectedOrgStudent] = useState('');
  const [selectedOrgCategory, setSelectedOrgCategory] = useState('Event Head');
  const [orgFeedback, setOrgFeedback] = useState(null);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  
  const [orgRequests, setOrgRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [joinTeamEnabled, setJoinTeamEnabled] = useState(false);

  const categories = ['Technical', 'Cultural', 'Sports', 'Workshop', 'Seminar'];
  
  const [activeTab, setActiveTab] = useState('all');
  const [withdrawEvent, setWithdrawEvent] = useState(null);

  const fetchEvents = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const res = await axios.get('/api/events/organizer/my-events');
      setEvents(res.data);
    } catch (err) {
      console.error(err);
      if (!silent) setError('Failed to fetch events list.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchFaculty = async () => {
    try {
      const res = await axios.get('/api/users/faculty-coordinators');
      setFacultyList(res.data);
    } catch (err) {
      console.error('Error fetching faculty coordinators:', err);
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await axios.get('/api/users/students');
      setStudentsList(res.data);
    } catch (err) {
      console.error('Error fetching students:', err);
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchFaculty();
    fetchStudents();

    const interval = setInterval(() => {
      fetchEvents(true);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedEventId(null);
    setTitle('');
    setDescription('');
    setCategory('Technical');
    setVenue('');
    setDate('');
    setCapacity('50');
    setImageUrl('');
    setRegistrationType('individual');
    setMaxTeams('10');
    setMaxTeamSize('4');
    setAllowCrossDepartment(true);
    setTeamLeaderRegistrationRequired(true);
    setAssignedFaculty('');
    setFeedback(null);
    setIsModalOpen(true);
  };

  const openEditModal = (event) => {
    setModalMode('edit');
    setSelectedEventId(event._id || event.id);
    setTitle(event.title || '');
    setDescription(event.description || '');
    setCategory(event.category || 'Technical');
    setVenue(event.venue || '');
    
    if (event.date) {
      const d = new Date(event.date);
      const tzOffset = d.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
      setDate(localISOTime);
    } else {
      setDate('');
    }
    
    setCapacity(String(event.capacity || 50));
    setImageUrl(event.imageUrl || event.image_url || '');
    setRegistrationType(event.registration_type || 'individual');
    setMaxTeams(String(event.max_teams || 10));
    setMaxTeamSize(String(event.max_team_size || 4));
    setAllowCrossDepartment(event.allow_cross_department !== false);
    setTeamLeaderRegistrationRequired(event.team_leader_registration_required !== false);
    setAssignedFaculty(event.faculty_id || event.assignedFacultyId?._id || event.assignedFacultyId || '');
    setFeedback(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);

    if (!title || !description || !category || !venue || !date || !capacity || !assignedFaculty) {
      setFeedback({ type: 'error', message: 'Please enter all required fields including Faculty Coordinator.' });
      return;
    }

    const selectedDate = new Date(date);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    if (selectedDate < tomorrow) {
      setFeedback({ type: 'error', message: 'Event date must be at least one day in the future.' });
      return;
    }

    setSubmitting(true);
    try {
      const eventData = {
        title,
        description,
        category,
        venue,
        date,
        capacity: registrationType === 'team' ? undefined : Number(capacity),
        imageUrl: imageUrl || undefined,
        assignedFacultyId: assignedFaculty,
        registrationType,
        maxTeams: registrationType === 'team' ? Number(maxTeams) : undefined,
        minTeamSize: 1, // Fixed to 1 as per new UI simplification
        maxTeamSize: registrationType === 'team' ? Number(maxTeamSize) : 1,
        allowCrossDepartment,
        teamLeaderRegistrationRequired
      };

      if (modalMode === 'create') {
        await axios.post('/api/events', eventData);
        setFeedback({ type: 'success', message: 'Proposal drafted successfully!' });
      } else {
        await axios.put(`/api/events/${selectedEventId}`, eventData);
        setFeedback({ type: 'success', message: 'Proposal updated successfully!' });
      }

      setTimeout(() => {
        setIsModalOpen(false);
        fetchEvents();
      }, 1000);

    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Server error saving event.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (eventId, newStatus) => {
    try {
      await axios.put(`/api/events/${eventId}/status`, { status: newStatus });
      fetchEvents();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to update status.');
    }
  };

  const handlePublishEvent = async (eventId) => {
    if (!window.confirm('Are you sure you want to publish this event? Once published, it will be open for student registration.')) return;
    try {
      await axios.put(`/api/events/${eventId}/publish`);
      alert('Event published successfully!');
      fetchEvents();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to publish event.');
    }
  };

  const handleDelete = async (eventId, title) => {
    if (!window.confirm(`Are you sure you want to delete the proposal: "${title}"?`)) return;

    try {
      await axios.delete(`/api/events/${eventId}`);
      setEvents(prev => prev.filter(e => (e._id || e.id) !== eventId));
    } catch (err) {
      console.error(err);
      alert('Failed to delete event.');
    }
  };

  const handleConfirmWithdraw = async () => {
    if (!withdrawEvent) return;
    const eventId = withdrawEvent._id || withdrawEvent.id;
    try {
      await axios.put(`/api/events/${eventId}/withdraw`);
      setWithdrawEvent(null);
      fetchEvents();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to withdraw proposal.');
    }
  };

  const openTeamModal = (event) => {
    setTeamModalEvent(event);
    setTeamMembers(event.teamMembers || []);
    setSelectedStudent('');
    setMemberResponsibility('Volunteer');
    setTeamFeedback(null);
    setIsTeamModalOpen(true);
  };

  const handleAddTeamMember = async (e) => {
    e.preventDefault();
    setTeamFeedback(null);
    if (!selectedStudent) {
      setTeamFeedback({ type: 'error', message: 'Please select a student.' });
      return;
    }

    const studentObj = studentsList.find(s => s.id === selectedStudent);
    if (!studentObj) {
      setTeamFeedback({ type: 'error', message: 'Student not found.' });
      return;
    }

    try {
      const res = await axios.post(`/api/events/${teamModalEvent._id || teamModalEvent.id}/team-members`, {
        userId: studentObj.id,
        name: studentObj.fullName,
        rollNumber: studentObj.rollNumber,
        email: studentObj.email,
        responsibility: memberResponsibility
      });
      
      setTeamMembers(res.data.teamMembers || []);
      setTeamFeedback({ type: 'success', message: 'Team member added successfully!' });
      setSelectedStudent('');
      fetchEvents(); // Refresh main list to update counts
    } catch (err) {
      setTeamFeedback({ type: 'error', message: err.response?.data?.message || 'Error adding team member.' });
    }
  };

  const handleRemoveTeamMember = async (memberId) => {
    setTeamFeedback(null);
    try {
      const res = await axios.delete(`/api/events/${teamModalEvent._id || teamModalEvent.id}/team-members/${memberId}`);
      setTeamMembers(res.data.teamMembers || []);
      setTeamFeedback({ type: 'success', message: 'Team member removed successfully!' });
      fetchEvents(); // Refresh main list to update counts
    } catch (err) {
      setTeamFeedback({ type: 'error', message: err.response?.data?.message || 'Error removing team member.' });
    }
  };

  const openOrgModal = async (event) => {
    setOrgModalEvent(event);
    setJoinTeamEnabled(!!event.join_team_enabled);
    setSelectedOrgStudent('');
    setSelectedOrgCategory('Event Head');
    setOrgFeedback(null);
    setIsOrgModalOpen(true);
    setLoadingOrgs(true);
    setLoadingRequests(true);
    try {
      const res = await axios.get(`/api/events/${event._id || event.id}/organizers`);
      setOrgMembers(res.data);
    } catch (err) {
      console.error(err);
      setOrgFeedback({ type: 'error', message: 'Failed to load organizers.' });
    } finally {
      setLoadingOrgs(false);
    }

    try {
      const res = await axios.get(`/api/events/${event._id || event.id}/organizer-requests`);
      setOrgRequests(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleToggleJoinTeam = async (val) => {
    try {
      setJoinTeamEnabled(val);
      await axios.put(`/api/events/${orgModalEvent._id || orgModalEvent.id}/join-team-toggle`, {
        joinTeamEnabled: val
      });
      // Update local event object in events list
      setEvents(prev => prev.map(evt => {
        if (String(evt._id || evt.id) === String(orgModalEvent._id || orgModalEvent.id)) {
          return { ...evt, join_team_enabled: val };
        }
        return evt;
      }));
      setOrgFeedback({ type: 'success', message: 'Join team setting updated successfully.' });
    } catch (err) {
      console.error(err);
      setOrgFeedback({ type: 'error', message: err.response?.data?.message || 'Error updating join setting.' });
    }
  };

  const handleProcessRequest = async (requestId, status) => {
    setOrgFeedback(null);
    try {
      await axios.put(`/api/events/${orgModalEvent._id || orgModalEvent.id}/organizer-requests/${requestId}`, {
        status
      });
      setOrgFeedback({ type: 'success', message: `Request successfully ${status}.` });
      
      // Refresh requests
      const resReq = await axios.get(`/api/events/${orgModalEvent._id || orgModalEvent.id}/organizer-requests`);
      setOrgRequests(resReq.data);

      // Refresh organizers if approved
      if (status === 'approved') {
        const resOrg = await axios.get(`/api/events/${orgModalEvent._id || orgModalEvent.id}/organizers`);
        setOrgMembers(resOrg.data);
        fetchEvents(true); // Refresh main events list counts in background
      }
    } catch (err) {
      console.error(err);
      setOrgFeedback({ type: 'error', message: err.response?.data?.message || 'Error processing request.' });
    }
  };

  const handleAddOrganizer = async (e) => {
    e.preventDefault();
    setOrgFeedback(null);
    if (!selectedOrgStudent) {
      setOrgFeedback({ type: 'error', message: 'Please select a student.' });
      return;
    }

    const studentObj = studentsList.find(s => s.id === selectedOrgStudent);
    if (!studentObj) {
      setOrgFeedback({ type: 'error', message: 'Student not found.' });
      return;
    }

    try {
      await axios.post(`/api/events/${orgModalEvent._id || orgModalEvent.id}/organizers`, {
        studentId: studentObj.id,
        category: selectedOrgCategory
      });
      
      setOrgFeedback({ type: 'success', message: 'Organizer recruited successfully!' });
      setSelectedOrgStudent('');
      
      // Refresh local organizer list
      const res = await axios.get(`/api/events/${orgModalEvent._id || orgModalEvent.id}/organizers`);
      setOrgMembers(res.data);
      fetchEvents(); // Refresh counts in parent
    } catch (err) {
      setOrgFeedback({ type: 'error', message: err.response?.data?.message || 'Error recruiting organizer.' });
    }
  };

  const handleRemoveOrganizer = async (studentId) => {
    setOrgFeedback(null);
    try {
      await axios.delete(`/api/events/${orgModalEvent._id || orgModalEvent.id}/organizers/${studentId}`);
      setOrgFeedback({ type: 'success', message: 'Organizer removed successfully!' });
      
      // Refresh local organizer list
      const res = await axios.get(`/api/events/${orgModalEvent._id || orgModalEvent.id}/organizers`);
      setOrgMembers(res.data);
      fetchEvents(); // Refresh counts in parent
    } catch (err) {
      setOrgFeedback({ type: 'error', message: err.response?.data?.message || 'Error removing organizer.' });
    }
  };

  const handleScanSuccess = async (registrationId) => {
    console.log('Decoded QR value:', registrationId);
    if (!registrationId) return;
    setScanFeedback(null);
    try {
      const res = await axios.post('/api/attendance/verify', { registrationId });
      setScanFeedback({ type: 'success', message: res.data.message || 'Attendance recorded.' });
      setTimeout(() => setScannerModalEvent(null), 2000); // Close after 2s
    } catch (err) {
      setScanFeedback({ type: 'error', message: err.response?.data?.message || 'Invalid QR code.' });
    }
  };

  const formatDate = (dateString) => {
    const options = { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  const myProposals = events.filter(e => String(e.proposed_by) === String(user.id));
  const myOrganizingEvents = events.filter(e => String(e.proposed_by) !== String(user.id));

  return (
    <div className="flex-grow py-20 text-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10 animate-fade-in-up">
          <div>
            <h1 className="font-display text-3xl font-black text-text-primary">My <span className="heading-gradient text-fuchsia-400">Proposals</span></h1>
            <p className="font-body text-slate-600 text-sm mt-1.5">Draft, submit, and publish your events</p>
          </div>
          <button
            onClick={openCreateModal}
            className="btn-primary px-6 py-3 text-xs font-display font-bold rounded-xl text-white shadow-lg shadow-fuchsia-500/15 self-start"
          >
            + New Event Proposal
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-slate-200/10 pb-5">
          {[
            { id: 'all', label: 'All Proposals', count: myProposals.filter(e => e.status !== 'withdrawn').length },
            { id: 'pending_approval', label: 'Pending Review', count: myProposals.filter(e => e.status === 'pending_approval').length },
            { id: 'approved', label: 'Approved', count: myProposals.filter(e => e.status === 'approved').length },
            { id: 'published', label: 'Published Events', count: myProposals.filter(e => e.status === 'published').length },
            { id: 'rejected', label: 'Rejected', count: myProposals.filter(e => e.status === 'rejected').length },
            { id: 'withdrawn', label: 'My Withdrawn Proposals', count: myProposals.filter(e => e.status === 'withdrawn').length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-display font-bold transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/25'
                  : 'bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-500'
              }`}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Loading / Empty States */}
        {loading ? (
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="p-6 space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-white/20 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-20 animate-fade-in-up">
            <p className="text-red-400 font-bold mb-3">{error}</p>
            <button onClick={fetchEvents} className="btn-primary px-6 py-2.5 text-sm font-bold rounded-xl text-white">Retry</button>
          </div>
        ) : (
          <>
            {myProposals.length === 0 ? (
              <div className="text-center py-24 glass-panel rounded-2xl animate-fade-in-scale">
                <div className="h-20 w-20 bg-white/50 rounded-2xl flex items-center justify-center mx-auto text-slate-600 mb-5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h3 className="text-xl font-display font-bold text-slate-800 mb-2">No Proposals Found</h3>
                <p className="text-sm font-body text-slate-600 mb-6">Start planning your first campus event.</p>
                <button onClick={openCreateModal} className="btn-primary px-6 py-2.5 text-xs font-display font-bold rounded-xl text-white">Draft Proposal</button>
              </div>
            ) : myProposals.filter(e => activeTab === 'all' || e.status === activeTab).length === 0 ? (
              <div className="text-center py-24 glass-panel rounded-2xl animate-fade-in-scale">
                <div className="h-16 w-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto text-slate-400 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
                  </svg>
                </div>
                <h3 className="text-lg font-display font-bold text-slate-800 mb-2">No Proposals</h3>
                <p className="text-sm font-body text-slate-600">There are no proposals with the status "{activeTab.replace(/_/g, ' ')}".</p>
              </div>
            ) : (
              /* Event Table */
              <div className="animate-fade-in-up delay-100 glass-panel rounded-2xl overflow-hidden shadow-2xl shadow-fuchsia-500/3 mb-10">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/40 border-b border-slate-200/40 text-slate-600 text-[10px] font-bold uppercase tracking-[0.1em]">
                        <th className="px-6 py-4">Event Details</th>
                        <th className="px-6 py-4">Status & Remarks</th>
                        <th className="px-6 py-4">Date & Time</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30 text-sm font-body">
                      {myProposals
                        .filter(e => {
                          if (activeTab === 'all') return e.status !== 'withdrawn';
                          return e.status === activeTab;
                        })
                        .map((evt, i) => (
                          <tr 
                            key={evt._id || evt.id} 
                            className={`hover:bg-white/20 transition-all duration-300 animate-fade-in-up`}
                            style={{ animationDelay: `${i * 40 + 150}ms` }}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <img src={evt.image_url || evt.imageUrl} alt="" className="h-10 w-16 rounded-lg object-cover bg-white/50" />
                                <div>
                                  <div className="font-display font-bold text-slate-800 line-clamp-1">{evt.title}</div>
                                  <div className="text-[10px] text-slate-600 mt-0.5 font-medium">{evt.venue}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col items-start gap-1">
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-lg border ${
                                  evt.status === 'active' || evt.status === 'published'
                                    ? 'bg-emerald-500/8 text-emerald-400 border-emerald-500/15' 
                                    : evt.status === 'pending_approval'
                                      ? 'bg-amber-500/8 text-amber-400 border-amber-500/15'
                                      : evt.status === 'approved'
                                        ? 'bg-sky-500/8 text-sky-400 border-sky-500/15'
                                        : evt.status === 'rejected'
                                          ? 'bg-red-500/8 text-red-400 border-red-500/15'
                                          : 'bg-blue-500/8 text-blue-400 border-blue-500/15' // draft
                                }`}>
                                  {(evt.status || 'draft').replace(/_/g, ' ')}
                                </span>
                                {evt.approval_remarks && (evt.status === 'rejected') && (
                                  <span className="text-[10px] text-red-400 font-semibold max-w-[200px] line-clamp-2">
                                    Remarks: {evt.approval_remarks}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-slate-600 text-xs">
                              {formatDate(evt.date)}
                            </td>
                            <td className="px-6 py-4 text-right space-x-2 flex items-center justify-end">
                              {(evt.status === 'approved' || evt.status === 'published' || evt.status === 'active') && (
                                <button
                                  onClick={() => openOrgModal(evt)}
                                  className="px-3 py-1.5 text-[10px] font-bold rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-all duration-300"
                                >
                                  Manage Organizers ({evt.organizersCount || 0})
                                </button>
                              )}
                              {evt.status === 'draft' && (
                                <>
                                  <button
                                    onClick={() => openEditModal(evt)}
                                    className="px-4 py-1.5 text-[10px] font-bold rounded-lg btn-secondary"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleUpdateStatus(evt._id || evt.id, 'pending_approval')}
                                    className="px-4 py-1.5 text-[10px] font-bold rounded-lg bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 hover:bg-fuchsia-500/20 transition-all duration-300"
                                  >
                                    Submit
                                  </button>
                                  <button
                                    onClick={() => handleDelete(evt._id || evt.id, evt.title)}
                                    className="px-4 py-1.5 text-[10px] font-bold rounded-lg bg-red-500/8 text-red-400 border border-red-500/15 hover:bg-red-500/15 transition-all duration-300"
                                  >
                                    Del
                                  </button>
                                </>
                              )}
                              {evt.status === 'pending_approval' && (
                                <>
                                  <button
                                    onClick={() => openEditModal(evt)}
                                    className="px-4 py-1.5 text-[10px] font-bold rounded-lg btn-secondary"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => setWithdrawEvent(evt)}
                                    className="px-4 py-1.5 text-[10px] font-bold rounded-lg bg-red-500/8 text-red-400 border border-red-500/15 hover:bg-red-500/15 transition-all duration-300"
                                  >
                                    Withdraw
                                  </button>
                                  <span className="text-xs text-slate-600 font-medium italic">Pending Review...</span>
                                </>
                              )}
                              {evt.status === 'rejected' && (
                                <button
                                  onClick={() => openEditModal(evt)}
                                  className="px-4 py-1.5 text-[10px] font-bold rounded-lg btn-secondary"
                                >
                                  Edit
                                </button>
                              )}
                              {evt.status === 'approved' && (
                                 <>
                                   <button
                                     onClick={() => handlePublishEvent(evt._id || evt.id)}
                                     className="px-4 py-1.5 text-[10px] font-bold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all duration-300"
                                   >
                                     Publish Event
                                   </button>
                                   <button
                                     onClick={() => setWithdrawEvent(evt)}
                                     className="px-4 py-1.5 text-[10px] font-bold rounded-lg bg-red-500/8 text-red-400 border border-red-500/15 hover:bg-red-500/15 transition-all duration-300"
                                   >
                                     Withdraw
                                   </button>
                                 </>
                               )}
                               {(evt.status === 'approved' || evt.status === 'published' || evt.status === 'active' || evt.status === 'completed') && (
                                 <>
                                   <button
                                     onClick={() => {
                                       setScanFeedback(null);
                                       setScannerModalEvent(evt);
                                     }}
                                     className="px-4 py-1.5 text-[10px] font-bold rounded-lg bg-teal-500/10 text-teal-500 border border-teal-500/20 hover:bg-teal-500/20 transition-all duration-300"
                                   >
                                     Scan QR
                                   </button>
                                   <Link
                                       to={`/workspace/${evt._id || evt.id}`}
                                       className="px-4 py-1.5 text-[10px] font-bold rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all duration-300"
                                     >
                                       Workspace
                                     </Link>
                                 </>
                               )}
                               {evt.status === 'published' && (
                                 <span className="text-[12px] font-medium text-[#16a34a] opacity-80 px-2">Published</span>
                               )}
                               {evt.status === 'active' && (
                                 <span className="text-[12px] font-medium text-[#16a34a] opacity-80 px-2">Active</span>
                               )}
                               {evt.status === 'completed' && (
                                 <span className="text-[12px] font-medium text-slate-500 opacity-80 px-2">Completed</span>
                               )}
                               {evt.status === 'withdrawn' && (
                                 <span className="text-xs text-slate-600 font-medium italic px-2">Withdrawn</span>
                               )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Organizing Events Section */}
            {myOrganizingEvents.length > 0 && (
              <div className="mt-16 animate-fade-in-up">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <div>
                    <h2 className="font-display text-2xl font-black text-text-primary">Events I'm <span className="heading-gradient text-indigo-400">Organizing</span></h2>
                    <p className="font-body text-slate-600 text-sm mt-1">Shared workspaces where you are a recruited organizer.</p>
                  </div>
                </div>
                
                <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl shadow-indigo-500/3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-white/40 border-b border-slate-200/40 text-slate-600 text-[10px] font-bold uppercase tracking-[0.1em]">
                          <th className="px-6 py-4">Event Details</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Date & Time</th>
                          <th className="px-6 py-4 text-right">Workspace Access</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/30 text-sm font-body">
                        {myOrganizingEvents.map((evt, i) => (
                          <tr key={evt._id || evt.id} className="hover:bg-white/20 transition-all duration-300">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <img src={evt.image_url || evt.imageUrl} alt="" className="h-10 w-16 rounded-lg object-cover bg-white/50" />
                                <div>
                                  <div className="font-display font-bold text-slate-800 line-clamp-1">{evt.title}</div>
                                  <div className="text-[10px] text-slate-600 mt-0.5 font-medium">{evt.venue}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-lg border ${
                                evt.status === 'published' || evt.status === 'active' 
                                  ? 'bg-emerald-500/8 text-emerald-400 border-emerald-500/15'
                                  : 'bg-amber-500/8 text-amber-400 border-amber-500/15'
                              }`}>
                                {(evt.status || '').replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-600 text-xs">
                              {formatDate(evt.date)}
                            </td>
                            <td className="px-6 py-4 text-right space-x-2 flex justify-end">
                              {(evt.status === 'approved' || evt.status === 'published' || evt.status === 'active' || evt.status === 'completed') ? (
                                <>
                                  <button
                                    onClick={() => {
                                      setScanFeedback(null);
                                      setScannerModalEvent(evt);
                                    }}
                                    className="px-4 py-1.5 text-[10px] font-bold rounded-lg bg-teal-500/10 text-teal-500 border border-teal-500/20 hover:bg-teal-500/20 transition-all duration-300 inline-block"
                                  >
                                    Scan QR
                                  </button>
                                  <Link
                                    to={`/workspace/${evt._id || evt.id}`}
                                    className="px-4 py-1.5 text-[10px] font-bold rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all duration-300 inline-block"
                                  >
                                    Open Workspace
                                  </Link>
                                </>
                              ) : (
                                <span className="text-[10px] text-slate-500 italic">Not published yet</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Create / Edit Event Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={modalMode === 'create' ? 'Draft Event Proposal' : 'Edit Event Proposal'}
        >
          {feedback && (
            <div className={`mb-6 p-4 rounded-xl border text-sm font-semibold flex gap-2.5 animate-fade-in-up ${
              feedback.type === 'success' ? 'bg-emerald-500/8 border-emerald-500/15 text-emerald-400' : 'bg-red-500/8 border-red-500/15 text-red-400'
            }`}>
              <span>{feedback.type === 'success' ? '✓' : '⚠'}</span>
              <span>{feedback.message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Event Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Annual Hackathon 2026"
                className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-fuchsia-500/60 transition-all duration-300"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-white/60 text-slate-700 border border-slate-300/50 rounded-xl px-3 py-2.5 text-sm font-body focus:outline-none focus:border-fuchsia-500/60 transition-all duration-300 cursor-pointer"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Venue / Hall *</label>
                <input
                  type="text"
                  required
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="e.g. Seminar Hall A"
                  className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-fuchsia-500/60 transition-all duration-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  min={new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().slice(0, 16)}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-fuchsia-500/60 transition-all duration-300"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Expected Capacity *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-fuchsia-500/60 transition-all duration-300"
                />
              </div>
            </div>

            <div className="bg-slate-500/5 border border-slate-200/10 p-4 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Registration Configuration</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Registration Type *</label>
                  <select
                    value={registrationType}
                    onChange={(e) => setRegistrationType(e.target.value)}
                    className="w-full bg-white/60 text-slate-700 border border-slate-300/50 rounded-xl px-3 py-2.5 text-sm font-body focus:outline-none focus:border-fuchsia-500/60 transition-all duration-300 cursor-pointer"
                  >
                    <option value="individual">Individual Registration</option>
                    <option value="team">Team Registration</option>
                  </select>
                </div>
              </div>

              {registrationType === 'team' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in-up">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Number of Teams Allowed *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={maxTeams}
                      onChange={(e) => setMaxTeams(e.target.value)}
                      className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-fuchsia-500/60 transition-all duration-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Max Members Per Team *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={maxTeamSize}
                      onChange={(e) => setMaxTeamSize(e.target.value)}
                      className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-fuchsia-500/60 transition-all duration-300"
                    />
                  </div>

                  <div className="flex items-center justify-between col-span-1 sm:col-span-2 pt-2">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em]">Allow Cross-Department Teams</label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={allowCrossDepartment} 
                        onChange={(e) => setAllowCrossDepartment(e.target.checked)}
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-fuchsia-600"></div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Poster Image URL</label>
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Leave blank for generic poster"
                className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-fuchsia-500/60 transition-all duration-300"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Faculty Coordinator Reviewer *</label>
              <select
                required
                value={assignedFaculty}
                onChange={(e) => setAssignedFaculty(e.target.value)}
                className="w-full bg-white/60 text-slate-700 border border-slate-300/50 rounded-xl px-3 py-2.5 text-sm font-body focus:outline-none focus:border-fuchsia-500/60 transition-all duration-300 cursor-pointer"
              >
                <option value="">-- Select Faculty Coordinator --</option>
                {facultyList.map(fac => (
                  <option key={fac.id} value={fac.id}>
                    {fac.displayLabel || fac.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Detailed Description *</label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain the purpose, target audience, and activities of this event..."
                className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-fuchsia-500/60 transition-all duration-300 resize-none"
              />
            </div>

            <div className="flex gap-3 justify-end pt-5 border-t border-slate-200/30">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 text-xs font-bold rounded-xl btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary px-6 py-2.5 text-xs font-display font-bold rounded-xl text-white shadow-lg shadow-fuchsia-500/15 disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Save Draft'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Manage Team Modal */}
        <Modal
          isOpen={isTeamModalOpen}
          onClose={() => setIsTeamModalOpen(false)}
          title={`Manage Team - ${teamModalEvent?.title || ''}`}
        >
          {teamFeedback && (
            <div className={`mb-6 p-4 rounded-xl border text-sm font-semibold flex gap-2.5 animate-fade-in-up ${
              teamFeedback.type === 'success' ? 'bg-emerald-500/8 border-emerald-500/15 text-emerald-400' : 'bg-red-500/8 border-red-500/15 text-red-400'
            }`}>
              <span>{teamFeedback.type === 'success' ? '✓' : '⚠'}</span>
              <span>{teamFeedback.message}</span>
            </div>
          )}

          {/* Add Team Member Form */}
          <form onSubmit={handleAddTeamMember} className="space-y-4 mb-6 pb-6 border-b border-slate-200/30">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Add Team Member</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Select Student *</label>
                <select
                  required
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className="w-full bg-white/60 text-slate-700 border border-slate-300/50 rounded-xl px-3 py-2.5 text-sm font-body focus:outline-none focus:border-fuchsia-500/60 transition-all duration-300 cursor-pointer text-slate-700"
                >
                  <option value="" className="text-slate-700">-- Select Student --</option>
                  {studentsList.map(std => (
                    <option key={std.id} value={std.id} className="text-slate-700">
                      {std.displayLabel || std.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Responsibility *</label>
                <select
                  required
                  value={memberResponsibility}
                  onChange={(e) => setMemberResponsibility(e.target.value)}
                  className="w-full bg-white/60 text-slate-700 border border-slate-300/50 rounded-xl px-3 py-2.5 text-sm font-body focus:outline-none focus:border-fuchsia-500/60 transition-all duration-300 cursor-pointer text-slate-700"
                >
                  {['Coordinator', 'Volunteer', 'Media Team', 'Registration Team', 'Logistics Team', 'Technical Team'].map(resp => (
                    <option key={resp} value={resp} className="text-slate-700">{resp}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full py-2.5 rounded-xl text-xs font-bold text-white shadow-lg shadow-fuchsia-500/15"
            >
              + Add Member
            </button>
          </form>

          {/* Current Team Members List */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Current Team</h4>
            {teamMembers.length === 0 ? (
              <p className="text-xs text-slate-600 italic">No team members added yet.</p>
            ) : (
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {teamMembers.map(member => (
                  <div key={member._id || member.id} className="flex items-center justify-between p-3 bg-white/30 rounded-xl border border-slate-200/20">
                    <div>
                      <div className="text-sm font-bold text-slate-800">
                        {member.name} {member.rollNumber ? `(${member.rollNumber})` : ''}
                      </div>
                      <div className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider mt-0.5">
                        {member.responsibility}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveTeamMember(member._id || member.id)}
                      className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-red-500/8 text-red-400 border border-red-500/15 hover:bg-red-500/15 transition-all duration-300"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>

        {/* Manage Organizers Modal */}
        <Modal
          isOpen={isOrgModalOpen}
          onClose={() => setIsOrgModalOpen(false)}
          title={`Manage Organizers - ${orgModalEvent?.title || ''}`}
        >
          {orgFeedback && (
            <div className={`mb-6 p-4 rounded-xl border text-sm font-semibold flex gap-2.5 animate-fade-in-up ${
              orgFeedback.type === 'success' ? 'bg-emerald-500/8 border-emerald-500/15 text-emerald-400' : 'bg-red-500/8 border-red-500/15 text-red-400'
            }`}>
              <span>{orgFeedback.type === 'success' ? '✓' : '⚠'}</span>
              <span>{orgFeedback.message}</span>
            </div>
          )}

          {/* Join Organizing Team Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-violet-500/5 border border-violet-500/10 rounded-xl mb-6">
            <div>
              <h4 className="text-xs font-bold text-slate-800 font-display">Allow Students to Join Team</h4>
              <p className="text-[10px] text-slate-600 font-medium mt-0.5">Let students submit requests to join this event's organizing team</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={joinTeamEnabled} 
                onChange={(e) => handleToggleJoinTeam(e.target.checked)}
                className="sr-only peer" 
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-fuchsia-600"></div>
            </label>
          </div>

          {/* Recruit Organizer Form */}
          <form onSubmit={handleAddOrganizer} className="space-y-4 mb-6 pb-6 border-b border-slate-200/30">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Recruit Organizer</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Select Student *</label>
                <select
                  required
                  value={selectedOrgStudent}
                  onChange={(e) => setSelectedOrgStudent(e.target.value)}
                  className="w-full bg-white/60 text-slate-700 border border-slate-300/50 rounded-xl px-3 py-2.5 text-sm font-body focus:outline-none focus:border-fuchsia-500/60 transition-all duration-300 cursor-pointer text-slate-700"
                >
                  <option value="" className="text-slate-700">-- Select Student --</option>
                  {studentsList.map(std => (
                    <option key={std.id} value={std.id} className="text-slate-700">
                      {std.displayLabel || std.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Category *</label>
                <select
                  required
                  value={selectedOrgCategory}
                  onChange={(e) => setSelectedOrgCategory(e.target.value)}
                  className="w-full bg-white/60 text-slate-700 border border-slate-300/50 rounded-xl px-3 py-2.5 text-sm font-body focus:outline-none focus:border-fuchsia-500/60 transition-all duration-300 cursor-pointer text-slate-700"
                >
                  {[
                    'Event Head',
                    'Technical Team',
                    'Design Team',
                    'Media Team',
                    'Hospitality Team',
                    'Logistics Team',
                    'Volunteer',
                    'Other'
                  ].map(cat => (
                    <option key={cat} value={cat} className="text-slate-700">{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full py-2.5 rounded-xl text-xs font-bold text-white shadow-lg shadow-fuchsia-500/15"
            >
              Recruit Organizer
            </button>
          </form>

          {/* Current Organizers list */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 font-display">Recruited Organizers</h4>
            {loadingOrgs ? (
              <p className="text-xs text-slate-600 italic font-medium">Loading organizers...</p>
            ) : orgMembers.length === 0 ? (
              <p className="text-xs text-slate-600 italic">No organizers recruited yet.</p>
            ) : (
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {orgMembers.map(member => (
                  <div key={member.id || member.userId} className="flex items-center justify-between p-3 bg-white/30 rounded-xl border border-slate-200/20 animate-fade-in-up">
                    <div>
                      <div className="text-sm font-bold text-slate-800">
                        {member.name}
                      </div>
                      <div className="text-[10px] text-slate-600 font-medium">
                        {member.email} &bull; {member.department}
                      </div>
                      <div className="text-[9px] font-bold text-fuchsia-400 uppercase tracking-wider mt-1.5 inline-block px-2 py-0.5 rounded bg-fuchsia-500/10 border border-fuchsia-500/15">
                        {member.category}
                      </div>
                    </div>
                    {String(member.userId) !== String(orgModalEvent?.student_organizer_id) && String(member.userId) !== String(orgModalEvent?.proposed_by) && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOrganizer(member.userId)}
                        className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-red-500/8 text-red-400 border border-red-500/15 hover:bg-red-500/15 transition-all duration-300"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Join requests list */}
          <div className="mt-6 pt-6 border-t border-slate-200/30">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 font-display">Pending Join Requests</h4>
            {loadingRequests ? (
              <p className="text-xs text-slate-600 italic font-medium">Loading requests...</p>
            ) : orgRequests.filter(r => r.status === 'pending').length === 0 ? (
              <p className="text-xs text-slate-600 italic">No pending requests at the moment.</p>
            ) : (
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {orgRequests.filter(r => r.status === 'pending').map(req => (
                  <div key={req.id} className="flex items-center justify-between p-3 bg-white/30 rounded-xl border border-slate-200/20 animate-fade-in-up">
                    <div>
                      <div className="text-sm font-bold text-slate-800">
                        {req.name}
                      </div>
                      <div className="text-[10px] text-slate-600 font-medium">
                        {req.email} &bull; {req.department}
                      </div>
                      <div className="text-[9px] font-bold text-violet-400 uppercase tracking-wider mt-1.5 inline-block px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/15">
                        wants to join: {req.category}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleProcessRequest(req.id, 'approved')}
                        className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-emerald-500/8 text-emerald-400 border border-emerald-500/15 hover:bg-emerald-500/15 transition-all duration-300"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleProcessRequest(req.id, 'rejected')}
                        className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-red-500/8 text-red-400 border border-red-500/15 hover:bg-red-500/15 transition-all duration-300"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>

        {/* Withdraw Event Confirmation Modal */}
        <Modal
          isOpen={withdrawEvent !== null}
          onClose={() => setWithdrawEvent(null)}
          title="Withdraw Proposal"
        >
          {withdrawEvent && (
            <div className="space-y-5">
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                Are you sure you want to withdraw this event proposal?
              </p>
              
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setWithdrawEvent(null)}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmWithdraw}
                  className="px-6 py-2.5 text-xs font-display font-bold btn-danger"
                >
                  Yes, Withdraw
                </button>
              </div>
            </div>
          )}
        </Modal>

        {/* QR Scanner Modal */}
        {scannerModalEvent && (
          <Modal
            isOpen={!!scannerModalEvent}
            onClose={() => setScannerModalEvent(null)}
            title="Scan Attendance"
          >
            <div className="flex flex-col items-center justify-center space-y-4">
              <p className="text-sm text-slate-600">Scan student's QR pass to mark attendance for <strong>{scannerModalEvent.title}</strong>.</p>
              
              {scanFeedback && (
                <div className={`w-full p-3 rounded-xl border text-sm font-semibold flex items-center gap-2 ${
                  scanFeedback.type === 'success' ? 'bg-emerald-500/8 border-emerald-500/15 text-emerald-500' : 'bg-red-500/8 border-red-500/15 text-red-500'
                }`}>
                  <span>{scanFeedback.type === 'success' ? '✓' : '⚠'}</span>
                  <span>{scanFeedback.message}</span>
                </div>
              )}

              <div className="w-full max-w-sm rounded-xl overflow-hidden border border-slate-200">
                <QRScanner
                  onScanSuccess={handleScanSuccess}
                  onScanFailure={(error) => {
                    // console.warn(error);
                  }}
                />
              </div>

              <div className="mt-2 flex justify-end w-full">
                <button
                  onClick={() => setScannerModalEvent(null)}
                  className="px-5 py-2.5 text-sm font-bold rounded-xl btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </Modal>
        )}

      </div>
    </div>
  );
};

export default StudentOrgEvents;
