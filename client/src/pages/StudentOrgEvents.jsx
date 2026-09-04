import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Modal from '../components/Modal';
import { useAuth, supabase } from '../context/AuthContext';
import QRScanner from '../components/QRScanner';
import { StickyNoteDoodle, GeometricBlobDoodle } from '../components/Doodles';

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

  const [posterOption, setPosterOption] = useState('upload'); // 'upload', 'url'
  const [posterFile, setPosterFile] = useState(null);
  const [posterPreview, setPosterPreview] = useState('');
  
  // Scanner Modal states
  const [scannerModalEvent, setScannerModalEvent] = useState(null);
  const [scanFeedback, setScanFeedback] = useState(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Technical');
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState('');
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [capacity, setCapacity] = useState('50');
  const [imageUrl, setImageUrl] = useState('');
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentUpiId, setPaymentUpiId] = useState('');
  const [paymentQrUrl, setPaymentQrUrl] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [paymentQrFile, setPaymentQrFile] = useState(null);
  const [scoringEnabled, setScoringEnabled] = useState(false);
  const [feedbackQuestions, setFeedbackQuestions] = useState([]);

  const getTomorrowISO = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0); // start of tomorrow
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const getMaxDeadlineISO = () => {
    if (!date) return '';
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    d.setHours(23, 59, 59, 999);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  
  // Team configuration states
  const [registrationType, setRegistrationType] = useState('individual'); // 'individual', 'team'
  const [maxTeams, setMaxTeams] = useState('10');
  const [minTeamSize, setMinTeamSize] = useState('1');
  const [maxTeamSize, setMaxTeamSize] = useState('4');
  const [allowCrossDepartment, setAllowCrossDepartment] = useState(true);
  const [teamLeaderRegistrationRequired, setTeamLeaderRegistrationRequired] = useState(true);

  // Faculty and Team States
  const [facultyList, setFacultyList] = useState([]);
  const [assignedFaculty, setAssignedFaculty] = useState('');
  const [facultySearchTerm, setFacultySearchTerm] = useState('');
  const [isFacultyDropdownOpen, setIsFacultyDropdownOpen] = useState(false);
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
  const [selectedOrganizerRole, setSelectedOrganizerRole] = useState('normal');
  const [confirmedTeamMembers, setConfirmedTeamMembers] = useState([]);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);
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

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedEventId(null);
    setPosterOption('upload');
    setPosterFile(null);
    setPosterPreview('');
    setTitle('');
    setDescription('');
    setCategory('Technical');
    setVenue('');
    setDate('');
    setRegistrationDeadline('');
    setScoringEnabled(false);
    setCapacity('50');
    setImageUrl('');
    setRegistrationType('individual');
    setMaxTeams('10');
    setMinTeamSize('1');
    setMaxTeamSize('4');
    setAllowCrossDepartment(true);
    setTeamLeaderRegistrationRequired(true);
    setPaymentEnabled(false); setPaymentAmount(''); setPaymentUpiId(''); setPaymentQrUrl(''); setPaymentInstructions(''); setPaymentQrFile(null);
    setAssignedFaculty('');
    setFacultySearchTerm('');
    setIsFacultyDropdownOpen(false);
    setFeedback(null);
    setScoringEnabled(!!event?.scoring_enabled);
    setFeedbackQuestions([]);
    setIsModalOpen(true);
  };

  const openEditModal = (event) => {
    setModalMode('edit');
    setSelectedEventId(event._id || event.id);
    setTitle(event.title || '');
    setDescription(event.description || '');
    setCategory(event.category || 'Technical');
    setVenue(event.venue || '');
    
    setDate(formatToDatetimeLocal(event.date));
    setRegistrationDeadline(formatToDatetimeLocal(event.registration_deadline));
    
    setCapacity(String(event.capacity || 50));
    setPosterOption(event.image_url || event.imageUrl ? 'url' : 'upload');
    setPosterFile(null);
    setPosterPreview('');
    setImageUrl(event.imageUrl || event.image_url || '');
    setRegistrationType(event.registration_type || 'individual');
    setMaxTeams(String(event.max_teams || 10));
    setMinTeamSize(String(event.min_team_size || 1));
    setMaxTeamSize(String(event.max_team_size || 4));
    setAllowCrossDepartment(event.allow_cross_department !== false);
    setTeamLeaderRegistrationRequired(event.team_leader_registration_required !== false);
    setPaymentEnabled(!!event.payment_enabled);
    setPaymentAmount(event.payment_amount ? String(event.payment_amount) : '');
    setPaymentUpiId(event.payment_upi_id || '');
    setPaymentQrUrl(event.payment_qr_url || '');
    setPaymentInstructions(event.payment_instructions || '');
    setPaymentQrFile(null);
    
    const facId = event.faculty_id || event.assignedFacultyId?._id || event.assignedFacultyId || '';
    setAssignedFaculty(facId);
    
    // Set faculty search term based on assigned faculty
    if (facId && facultyList.length > 0) {
      const fac = facultyList.find(f => f.id === facId);
      setFacultySearchTerm(fac ? (fac.displayLabel || fac.fullName || fac.name) : '');
    } else {
      setFacultySearchTerm('');
    }
    setIsFacultyDropdownOpen(false);
    
    setFeedbackQuestions(event.feedback_questions || event.feedbackQuestions || []);
    setFeedback(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);

    if (!title || !description || !category || !venue || !date || (registrationType !== 'team' && !capacity) || !assignedFaculty) {
      setFeedback({ type: 'error', message: 'Please enter all required fields including Faculty Coordinator.' });
      return;
    }

    if (registrationType === 'team') {
      const minSize = Number(minTeamSize);
      const maxSize = Number(maxTeamSize);
      
      if (minSize < 1) {
        setFeedback({ type: 'error', message: 'Minimum Team Size must be at least 1.' });
        return;
      }
      if (maxSize < minSize) {
        setFeedback({ type: 'error', message: 'Maximum Team Size must be greater than or equal to Minimum Team Size.' });
        return;
      }
    }
    if (paymentEnabled && (!paymentAmount || Number(paymentAmount) <= 0 || (!paymentQrUrl && !paymentQrFile))) {
      setFeedback({ type: 'error', message: 'Paid events require an amount and payment QR code.' }); return;
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

    let finalImageUrl = imageUrl;
    let finalPaymentQrUrl = paymentQrUrl;
    if (paymentEnabled && paymentQrFile) {
      const filePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${paymentQrFile.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from('payment-qr').upload(filePath, paymentQrFile, { upsert: true });
      if (uploadError) { setFeedback({ type: 'error', message: 'Failed to upload payment QR code.' }); setSubmitting(false); return; }
      finalPaymentQrUrl = supabase.storage.from('payment-qr').getPublicUrl(filePath).data.publicUrl;
    }
    if (posterOption === 'upload' && posterFile) {
      if (posterFile.size > 5 * 1024 * 1024) {
        setFeedback({ type: 'error', message: 'Poster image must be less than 5MB.' });
        setSubmitting(false);
        return;
      }
      
      const fileExt = posterFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('posters')
        .upload(filePath, posterFile);

      if (uploadError) {
        setFeedback({ type: 'error', message: 'Failed to upload poster image.' });
        setSubmitting(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('posters')
        .getPublicUrl(filePath);
        
      finalImageUrl = publicUrlData.publicUrl;
    }

    try {
      const eventData = {
        title,
        description,
        category,
        venue,
        date: date ? (date.includes('Z') || date.includes('+') ? date : new Date(date).toISOString()) : undefined,
        registrationDeadline: registrationDeadline ? (registrationDeadline.includes('Z') || registrationDeadline.includes('+') ? registrationDeadline : new Date(registrationDeadline).toISOString()) : undefined,
        capacity: registrationType === 'team' ? undefined : Number(capacity),
        imageUrl: finalImageUrl || undefined,
        assignedFacultyId: assignedFaculty,
        registrationType,
        maxTeams: registrationType === 'team' ? Number(maxTeams) : undefined,
        minTeamSize: registrationType === 'team' ? Number(minTeamSize) : 1,
        maxTeamSize: registrationType === 'team' ? Number(maxTeamSize) : 1,
        allowCrossDepartment,
        teamLeaderRegistrationRequired
        , paymentEnabled, paymentAmount: paymentEnabled ? Number(paymentAmount) : undefined, paymentUpiId: paymentEnabled ? paymentUpiId : undefined,
        paymentQrUrl: paymentEnabled ? finalPaymentQrUrl : undefined, paymentInstructions: paymentEnabled ? paymentInstructions : undefined
        , scoringEnabled
        , feedbackQuestions
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
    setSelectedOrganizerRole('normal');
    setStudentSearchQuery('');
    setIsStudentDropdownOpen(false);
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

    try {
      const res = await axios.get(`/api/events/${event._id || event.id}/confirmed-team-members`);
      setConfirmedTeamMembers(res.data);
    } catch (err) {
      console.error(err);
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
        category: selectedOrgCategory,
        organizerRole: selectedOrganizerRole
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
      const eventId = scannerModalEvent._id || scannerModalEvent.id;
      const res = await axios.post('/api/attendance/verify', { registrationId, eventId });
      if (res.data.success && res.data.student) {
        const { name } = res.data.student;
        setScanFeedback({ type: 'success', message: `Attendance marked successfully for ${name}.` });
      } else {
        setScanFeedback({ type: 'success', message: res.data.message || 'Attendance recorded.' });
      }
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
    <div className="flex-grow py-20 text-slate-700 relative overflow-hidden">
      <GeometricBlobDoodle className="absolute top-10 right-10 w-96 h-96 text-pastel-lavender -z-10 opacity-30 animate-spin-slow" />
      <GeometricBlobDoodle className="absolute bottom-20 left-10 w-80 h-80 text-pastel-mint -z-10 opacity-30 animate-float" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10 animate-fade-in-up">
          <div className="relative">
            <StickyNoteDoodle className="absolute -top-6 -left-10 w-10 h-10 text-pastel-yellow opacity-80 animate-wobble hidden md:block" />
            <h1 className="font-display text-3xl font-black text-text-primary">My <span className="heading-gradient text-fuchsia-400">Proposals</span></h1>
            <p className="font-body text-slate-600 text-sm mt-1.5">View your assigned events and proposals</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-slate-200/10 pb-5">
          {[
            { id: 'all', label: 'All Proposals', count: myProposals.filter(e => e.status !== 'withdrawn').length },
            { id: 'pending_approval', label: 'Pending Review', count: myProposals.filter(e => ['pending_approval', 'under_review', 'needs_revision'].includes(e.status)).length },
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
                <p className="text-sm font-body text-slate-600">You do not have any active event proposals assigned.</p>
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
              /* Event Cards Container */
              <div className="animate-fade-in-up delay-100 flex flex-col gap-5 mb-10">
                {myProposals
                  .filter(e => {
                    if (activeTab === 'all') return e.status !== 'withdrawn';
                    return e.status === activeTab;
                  })
                  .map((evt, i) => (
                    <div 
                      key={evt._id || evt.id} 
                      className="glass-panel p-6 rounded-[2rem] shadow-sm border border-slate-200/60 hover:shadow-md transition-all duration-300 animate-fade-in-up flex flex-col"
                      style={{ animationDelay: `${i * 40 + 150}ms` }}
                    >
                      {/* Top Section: Image, Details, and Status */}
                      <div className="flex flex-col sm:flex-row gap-6 items-start">
                        {/* Event Image */}
                        <img 
                          src={evt.image_url || evt.imageUrl} 
                          alt="" 
                          className="h-24 w-36 sm:h-28 sm:w-44 rounded-2xl object-cover bg-white/50 shrink-0 shadow-sm" 
                        />
                        
                        {/* Event Details */}
                        <div className="flex-1 min-w-0 w-full">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                            <div>
                              <h3 className="font-display font-bold text-xl text-slate-800 line-clamp-1">{evt.title}</h3>
                              
                              {/* Venue and Date */}
                              <div className="mt-3 space-y-2">
                                <div className="flex items-center gap-2.5 text-sm text-slate-600 font-medium">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                  </svg>
                                  {evt.venue}
                                </div>
                                <div className="flex items-center gap-2.5 text-sm text-slate-600 font-medium">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                  </svg>
                                  {formatDate(evt.date)}
                                </div>
                              </div>
                            </div>
                            
                            {/* Status Badge */}
                            <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                              <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl border ${
                                evt.status === 'active' || evt.status === 'published'
                                  ? 'bg-emerald-500/8 text-emerald-500 border-emerald-500/15' 
                                  : ['pending_approval', 'under_review', 'needs_revision'].includes(evt.status)
                                    ? 'bg-amber-500/8 text-amber-500 border-amber-500/15'
                                    : evt.status === 'approved'
                                      ? 'bg-sky-500/8 text-sky-500 border-sky-500/15'
                                      : evt.status === 'rejected'
                                        ? 'bg-red-500/8 text-red-500 border-red-500/15'
                                        : evt.status === 'completed'
                                          ? 'bg-slate-100 text-slate-500 border-slate-200'
                                          : evt.status === 'withdrawn'
                                            ? 'bg-slate-100 text-slate-500 border-slate-200 italic'
                                            : 'bg-blue-500/8 text-blue-500 border-blue-500/15' // draft
                              }`}>
                                {(evt.status || 'draft').replace(/_/g, ' ')}
                              </span>
                            </div>
                          </div>
                          
                          {/* Remarks for rejected */}
                          {evt.approval_remarks && (evt.status === 'rejected') && (
                            <div className="mt-4 text-xs text-red-500 bg-red-50/50 p-3 rounded-xl border border-red-100">
                              <span className="font-bold">Remarks:</span> {evt.approval_remarks}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="h-px bg-slate-200/60 my-5 w-full" />

                      {/* Bottom Section: Actions */}
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        {evt.status !== 'draft' && (() => {
                          const userId = user?.id;
                          const isCoreOrProposer =
                            String(evt.proposed_by || '') === String(userId) ||
                            String(evt.student_organizer_id || '') === String(userId) ||
                            String(evt.faculty_id || '') === String(userId) ||
                            evt.userOrganizerType === 'core';
                          return isCoreOrProposer ? (
                            <Link
                              to={`/workspace/${evt._id || evt.id}`}
                              className="px-5 py-2 text-xs font-bold rounded-xl bg-purple-500/10 text-purple-600 border border-purple-500/20 hover:bg-purple-500/20 transition-all duration-300"
                            >
                              Workspace
                            </Link>
                          ) : null;
                        })()}

                        {evt.status === 'draft' && (
                          <>
                            <button
                              onClick={() => openEditModal(evt)}
                              className="px-5 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all duration-300"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(evt._id || evt.id, 'pending_approval')}
                              className="px-5 py-2 text-xs font-bold rounded-xl bg-fuchsia-500/10 text-fuchsia-600 border border-fuchsia-500/20 hover:bg-fuchsia-500/20 transition-all duration-300"
                            >
                              Submit
                            </button>
                            <button
                              onClick={() => handleDelete(evt._id || evt.id, evt.title)}
                              className="px-5 py-2 text-xs font-bold rounded-xl bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20 transition-all duration-300"
                            >
                              Del
                            </button>
                            <button
                              onClick={() => setWithdrawEvent(evt)}
                              className="px-5 py-2 text-xs font-bold rounded-xl bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20 transition-all duration-300"
                            >
                              Withdraw
                            </button>
                          </>
                        )}

                        <Link
                          to={`/workspace/${evt._id || evt.id}`}
                          className="px-5 py-2 text-xs font-bold rounded-xl bg-sky-500/10 text-sky-600 border border-sky-500/20 hover:bg-sky-500/20 transition-all duration-300"
                        >
                          Organizer Workspace
                        </Link>
                        
                        {['approved', 'published', 'active', 'completed'].includes(evt.status) && new Date(evt.date) >= new Date() && (
                          <button
                            onClick={() => {
                              setScanFeedback(null);
                              setScannerModalEvent(evt);
                            }}
                            className="px-5 py-2 text-xs font-bold rounded-xl bg-teal-500/10 text-teal-600 border border-teal-500/20 hover:bg-teal-500/20 transition-all duration-300"
                          >
                            Scan QR
                          </button>
                        )}

                        {['approved', 'published', 'active'].includes(evt.status) && (
                          <button
                            onClick={() => openOrgModal(evt)}
                            className="px-5 py-2 text-xs font-bold rounded-xl border border-slate-300/60 text-slate-500 hover:bg-slate-50/50 hover:text-slate-700 transition-all duration-300"
                          >
                            Organizers ({evt.organizersCount || 0})
                          </button>
                        )}

                        {evt.status === 'rejected' && (
                          <button
                            onClick={() => openEditModal(evt)}
                            className="px-5 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all duration-300"
                          >
                            Edit
                          </button>
                        )}
                        {evt.status === 'approved' && (
                          <button
                            onClick={() => handlePublishEvent(evt._id || evt.id)}
                            className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all duration-300"
                          >
                            Publish
                          </button>
                        )}
                        {['pending_approval', 'under_review', 'needs_revision'].includes(evt.status) && (
                          <button
                            onClick={() => setWithdrawEvent(evt)}
                            className="px-5 py-2 text-xs font-bold rounded-xl bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20 transition-all duration-300"
                          >
                            Withdraw
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
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
                                  {new Date(evt.date) >= new Date() && (
                                    <button
                                      onClick={() => {
                                        setScanFeedback(null);
                                        setScannerModalEvent(evt);
                                      }}
                                      className="px-4 py-1.5 text-[10px] font-bold rounded-lg bg-teal-500/10 text-teal-500 border border-teal-500/20 hover:bg-teal-500/20 transition-all duration-300 inline-block mr-2"
                                    >
                                      Scan QR
                                    </button>
                                  )}
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
          subtitle={modalMode === 'create' ? 'Create and submit your proposal for faculty review.' : 'Update your proposal details.'}
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
                  min={getTomorrowISO()}
                  value={date}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setDate(newDate);
                    if (registrationDeadline) {
                      const maxAllowed = new Date(newDate);
                      maxAllowed.setDate(maxAllowed.getDate() - 1);
                      maxAllowed.setHours(23, 59, 59, 999);
                      if (new Date(registrationDeadline) > maxAllowed || new Date(registrationDeadline) < new Date(getTomorrowISO())) {
                        setRegistrationDeadline('');
                      }
                    }
                  }}
                  className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-fuchsia-500/60 transition-all duration-300"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Registration Closing / Team Approval Deadline</label>
                <input
                  type="datetime-local"
                  disabled={!date}
                  min={getTomorrowISO()}
                  max={getMaxDeadlineISO()}
                  value={registrationDeadline}
                  onChange={(e) => setRegistrationDeadline(e.target.value)}
                  className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-fuchsia-500/60 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {!date && <p className="text-[10px] text-fuchsia-500 mt-1 font-semibold">Please select the event date first.</p>}
              </div>

              <div className="col-span-1 sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Event Poster</label>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setPosterOption('upload')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${posterOption === 'upload' ? 'bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200' : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'}`}
                  >
                    Upload Poster
                  </button>
                  <button
                    type="button"
                    onClick={() => setPosterOption('url')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${posterOption === 'url' ? 'bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200' : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'}`}
                  >
                    Poster URL
                  </button>
                </div>

                {posterOption === 'upload' ? (
                  <div>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          setPosterFile(file);
                          setPosterPreview(URL.createObjectURL(file));
                        }
                      }}
                      className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2 text-sm font-body focus:outline-none focus:border-fuchsia-500/60 transition-all duration-300 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-fuchsia-50 file:text-fuchsia-700 hover:file:bg-fuchsia-100"
                    />
                    {(posterPreview || imageUrl) && (
                      <div className="mt-2 h-20 w-32 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                        <img src={posterPreview || imageUrl} alt="Preview" className="h-full w-full object-cover" />
                      </div>
                    )}
                    <p className="text-[9px] text-slate-400 mt-1">Max 5MB (JPG, PNG, WEBP)</p>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://example.com/poster.jpg"
                      className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-fuchsia-500/60 transition-all duration-300"
                    />
                    {imageUrl && (
                      <div className="mt-2 h-20 w-32 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                        <img src={imageUrl} alt="Preview" className="h-full w-full object-cover" />
                      </div>
                    )}
                  </div>
                )}
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

              {registrationType === 'individual' && (
                <div className="grid grid-cols-1 gap-4 mt-4 animate-fade-in-up">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Number of Slots *</label>
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
              )}

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
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Min Members Per Team *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={minTeamSize}
                      onChange={(e) => setMinTeamSize(e.target.value)}
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
              <div className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="flex items-center justify-between"><div><h4 className="text-xs font-bold text-slate-800">Enable Payment</h4><p className="text-[10px] text-slate-600">Require UTR verification at team confirmation.</p></div><input type="checkbox" checked={paymentEnabled} onChange={(e) => setPaymentEnabled(e.target.checked)} /></div>
                {paymentEnabled && <><input type="number" min="1" step="0.01" required value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Payment amount (Rs.)" className="w-full rounded-xl border border-slate-300/50 bg-white/60 px-4 py-2.5 text-sm" /><input value={paymentUpiId} onChange={(e) => setPaymentUpiId(e.target.value)} placeholder="UPI ID (optional)" className="w-full rounded-xl border border-slate-300/50 bg-white/60 px-4 py-2.5 text-sm" /><input type="file" accept="image/*" required={!paymentQrUrl} onChange={(e) => setPaymentQrFile(e.target.files[0] || null)} className="w-full text-sm" /><textarea value={paymentInstructions} onChange={(e) => setPaymentInstructions(e.target.value)} placeholder="Payment instructions (optional)" rows={2} className="w-full rounded-xl border border-slate-300/50 bg-white/60 px-4 py-2.5 text-sm" />{paymentQrUrl && <img src={paymentQrUrl} alt="Payment QR preview" className="h-24 w-24 rounded-lg object-contain" />}</>}
              </div>
              <label className="mt-4 flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50/60 p-4 text-xs font-bold text-slate-700"><input type="checkbox" checked={scoringEnabled} onChange={e => setScoringEnabled(e.target.checked)} /> Enable scoring module for this event</label>
            </div>

            <div className="relative">
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Faculty Coordinator Reviewer *</label>
              <input
                type="text"
                placeholder="-- Search Faculty Coordinator --"
                value={facultySearchTerm}
                onChange={(e) => {
                  setFacultySearchTerm(e.target.value);
                  setAssignedFaculty('');
                  setIsFacultyDropdownOpen(true);
                }}
                onFocus={() => setIsFacultyDropdownOpen(true)}
                onBlur={() => setTimeout(() => setIsFacultyDropdownOpen(false), 200)}
                className="w-full bg-white/60 text-slate-700 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-fuchsia-500/60 transition-all duration-300"
              />
              
              {isFacultyDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                  {facultyList
                    .filter(fac => {
                      const search = facultySearchTerm.toLowerCase();
                      const name = (fac.displayLabel || fac.fullName || fac.name || '').toLowerCase();
                      const email = (fac.email || '').toLowerCase();
                      const dept = (fac.department || '').toLowerCase();
                      return name.includes(search) || email.includes(search) || dept.includes(search);
                    })
                    .map(fac => (
                      <div
                        key={fac.id}
                        onMouseDown={(e) => {
                          e.preventDefault(); // Prevents input onBlur from firing before click registers
                          setAssignedFaculty(fac.id);
                          setFacultySearchTerm(fac.displayLabel || fac.fullName || fac.name);
                          setIsFacultyDropdownOpen(false);
                        }}
                        className={`px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 ${assignedFaculty === fac.id ? 'bg-fuchsia-50/50' : ''}`}
                      >
                        <div className="font-bold text-slate-700 text-sm">{fac.displayLabel || fac.fullName || fac.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {fac.department ? `${fac.department} • ` : ''}{fac.email}
                        </div>
                      </div>
                    ))}
                  
                  {facultyList.filter(fac => {
                    const search = facultySearchTerm.toLowerCase();
                    const name = (fac.displayLabel || fac.fullName || fac.name || '').toLowerCase();
                    const email = (fac.email || '').toLowerCase();
                    const dept = (fac.department || '').toLowerCase();
                    return name.includes(search) || email.includes(search) || dept.includes(search);
                  }).length === 0 && (
                    <div className="px-4 py-3 text-sm text-slate-500 text-center">
                      No matching faculty found
                    </div>
                  )}
                </div>
              )}
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

          {/* Add Organizer Form */}
          <form onSubmit={handleAddOrganizer} className="space-y-4 mb-6 pb-6 border-b border-slate-200/30">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-display">Recruit Organizer</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="relative">
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Select Student *</label>
                <div 
                  className="relative"
                  onMouseDown={(e) => {
                    // Prevent blur on input when clicking inside the dropdown
                    if (e.target.closest('.student-dropdown-menu')) {
                      e.preventDefault();
                    }
                  }}
                >
                  <input
                    type="text"
                    value={studentSearchQuery}
                    onChange={(e) => {
                      setStudentSearchQuery(e.target.value);
                      setIsStudentDropdownOpen(true);
                      if (selectedOrgStudent) setSelectedOrgStudent('');
                    }}
                    onFocus={() => setIsStudentDropdownOpen(true)}
                    onBlur={() => setIsStudentDropdownOpen(false)}
                    placeholder="Search by full name..."
                    className="w-full bg-white/60 text-slate-700 border border-slate-300/50 rounded-xl px-3 py-2.5 text-sm font-body focus:outline-none focus:border-fuchsia-500/60 transition-all duration-300"
                    required={!selectedOrgStudent}
                  />
                  {isStudentDropdownOpen && (
                    <div className="student-dropdown-menu absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                      {(() => {
                        const eligible = studentsList.filter(std => !confirmedTeamMembers.includes(std.id));
                        const filtered = eligible.filter(std => {
                          const query = studentSearchQuery.trim().toLowerCase();
                          if (!query) return true;
                          const name = (std.displayLabel || std.fullName || '').toLowerCase();
                          return name.includes(query);
                        });
                        
                        if (filtered.length === 0) {
                          return <div className="px-3 py-3 text-xs text-slate-500 text-center font-medium">No eligible students found.</div>;
                        }
                        
                        return filtered.map(std => (
                          <div
                            key={std.id}
                            className={`px-3 py-2 text-sm cursor-pointer transition-colors ${selectedOrgStudent === std.id ? 'bg-fuchsia-50 text-fuchsia-700 font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                            onClick={() => {
                                setSelectedOrgStudent(std.id);
                                setStudentSearchQuery(std.displayLabel || std.fullName);
                                setIsStudentDropdownOpen(false);
                            }}
                          >
                            {std.displayLabel || std.fullName}
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Category *</label>
                <select
                  required
                  value={selectedOrgCategory}
                  onChange={(e) => setSelectedOrgCategory(e.target.value)}
                  className="w-full bg-white/60 text-slate-700 border border-slate-300/50 rounded-xl px-3 py-2.5 text-sm font-body focus:outline-none focus:border-fuchsia-500/60 transition-all duration-300 cursor-pointer"
                >
                  {['Event Head', 'Technical Team', 'Design Team', 'Media Team', 'Hospitality Team', 'Logistics Team', 'Volunteer', 'Other'].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Role Type *</label>
                <select
                  required
                  value={selectedOrganizerRole}
                  onChange={(e) => setSelectedOrganizerRole(e.target.value)}
                  className="w-full bg-white/60 text-slate-700 border border-slate-300/50 rounded-xl px-3 py-2.5 text-sm font-body focus:outline-none focus:border-fuchsia-500/60 transition-all duration-300 cursor-pointer"
                >
                  <option value="normal">Normal Organizer</option>
                  <option value="core">Core Organizer</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full py-2.5 rounded-xl text-xs font-bold text-white shadow-lg shadow-fuchsia-500/15"
            >
              + Recruit Organizer
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
                      <div>
                        <div className="text-[9px] font-bold text-fuchsia-400 uppercase tracking-wider mt-1.5 inline-block px-2 py-0.5 rounded bg-fuchsia-500/10 border border-fuchsia-500/15 mr-2">
                          {member.category}
                        </div>
                        {member.organizerRole === 'core' && (
                          <div className="text-[9px] font-bold text-rose-400 uppercase tracking-wider mt-1.5 inline-block px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/15">
                            Core
                          </div>
                        )}
                        {member.organizerRole !== 'core' && (
                          <div className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider mt-1.5 inline-block px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/15">
                            Normal
                          </div>
                        )}
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
            onClose={() => { setScannerModalEvent(null); window.location.reload(); }}
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
                  onClick={() => { setScannerModalEvent(null); window.location.reload(); }}
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
