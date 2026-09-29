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
  const [hasSlots, setHasSlots] = useState(false);
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
  const [resubmittingId, setResubmittingId] = useState(null);

  const fetchEvents = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const res = await axios.get(`/api/events/organizer/my-events?_t=${Date.now()}`);
      setEvents(res.data);
    } catch (err) {
      console.error(err);
      if (!silent) setError('Failed to fetch events list.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchFaculty = async () => {
    // Primary: query Supabase directly from the client (most reliable)
    try {
      const { data: byRole, error: roleErr } = await supabase
        .from('profiles')
        .select('id, name, email, role, department, employee_id, status')
        .in('role', ['faculty', 'faculty_organizer'])
        .neq('status', 'inactive');

      if (!roleErr && byRole && byRole.length > 0) {
        const filtered = byRole.filter(f => {
          const r = (f.role || '').toLowerCase();
          const name = (f.name || '').toLowerCase();
          const email = (f.email || '').toLowerCase();
          return (r === 'faculty' || r === 'faculty_organizer') &&
                 !r.includes('admin') &&
                 !r.includes('higher') &&
                 !r.includes('official') &&
                 !name.includes('higher official') &&
                 !name.includes('administrator') &&
                 !email.includes('admin');
        });

        const result = filtered.map(f => ({
          id: f.id,
          fullName: f.name,
          name: f.name,
          email: f.email,
          role: f.role,
          employeeId: f.employee_id || '',
          department: f.department || '',
          displayLabel: f.employee_id
            ? `${f.name} (${f.employee_id}${f.department ? ' - ' + f.department : ''})`
            : (f.department ? `${f.name} (${f.department})` : f.name)
        }));
        setFacultyList(result);
        return;
      }
      if (roleErr) console.warn('Supabase direct faculty query error:', roleErr.message);
    } catch (directErr) {
      console.warn('Supabase direct faculty query exception:', directErr.message);
    }

    // Fallback: try the backend API
    try {
      const res = await axios.get('/api/users/faculty-coordinators');
      const data = Array.isArray(res.data) ? res.data : [];
      const filtered = data.filter(f => {
        const r = (f.role || '').toLowerCase();
        const name = (f.fullName || f.name || '').toLowerCase();
        const email = (f.email || '').toLowerCase();
        return (r === 'faculty' || r === 'faculty_organizer') &&
               !r.includes('admin') &&
               !r.includes('higher') &&
               !r.includes('official') &&
               !name.includes('higher official') &&
               !name.includes('administrator') &&
               !email.includes('admin');
      });
      setFacultyList(filtered);
    } catch (apiErr) {
      console.error('Backend faculty API also failed:', apiErr?.response?.status, apiErr?.response?.data?.message || apiErr.message);
      setFacultyList([]);
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
    fetchFaculty();
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
    setHasSlots(false);
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
    fetchFaculty();
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
    setHasSlots(Boolean(event.has_slots));
    setTeamLeaderRegistrationRequired(event.team_leader_registration_required !== false);
    setPaymentEnabled(!!event.payment_enabled);
    setPaymentAmount(event.payment_amount ? String(event.payment_amount) : '');
    setPaymentUpiId(event.payment_upi_id || '');
    setPaymentQrUrl(event.payment_qr_url || '');
    setPaymentInstructions(event.payment_instructions || '');
    setPaymentQrFile(null);
    
    const facId = event.faculty_id || event.assignedFacultyId?._id || event.assignedFacultyId?.id || (typeof event.assignedFacultyId === 'string' ? event.assignedFacultyId : '') || '';
    setAssignedFaculty(facId);
    setFacultySearchTerm('');
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
        registrationDeadline: registrationDeadline ? (registrationDeadline.includes('Z') || registrationDeadline.includes('+') ? registrationDeadline : new Date(registrationDeadline).toISOString()) : null,
        capacity: registrationType === 'team' ? undefined : Number(capacity),
        imageUrl: finalImageUrl || undefined,
        assignedFacultyId: assignedFaculty,
        registrationType,
        maxTeams: registrationType === 'team' ? Number(maxTeams) : undefined,
        minTeamSize: registrationType === 'team' ? Number(minTeamSize) : 1,
        maxTeamSize: registrationType === 'team' ? Number(maxTeamSize) : 1,
        allowCrossDepartment,
        hasSlots,
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
        const updatedEvt = events.find(e => (e._id || e.id) === selectedEventId);
        const msg = updatedEvt?.status === 'needs_revision'
          ? 'Proposal details updated! Click "Resubmit for Review" when you are ready to send to faculty.'
          : 'Proposal updated successfully!';
        setFeedback({ type: 'success', message: msg });
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
      alert(err.response?.data?.error || err.response?.data?.message || 'Failed to publish event.');
    }
  };

  const handleResubmitProposal = async (eventId) => {
    if (!window.confirm('Are you sure you want to resubmit this revised proposal to the Faculty Coordinator for review?')) return;
    try {
      setResubmittingId(eventId);
      const res = await axios.put(`/api/events/${eventId}/proposal-resubmit`);
      setEvents(prev => prev.map(ev => {
        if ((ev._id || ev.id) === eventId) {
          return { 
            ...ev, 
            status: 'pending_approval', 
            approval_remarks: null,
            revision_number: res.data?.revision_number || (ev.revision_number || 1) + 1 
          };
        }
        return ev;
      }));
      alert('Proposal resubmitted for review successfully! The faculty coordinator has been notified.');
      fetchEvents(true);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || err.response?.data?.message || 'Failed to resubmit proposal.');
    } finally {
      setResubmittingId(null);
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
        organizerRole: 'organizer'
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

  const isMyProposal = (e) => {
    const myId = String(user?.id || '');
    if (!myId) return false;
    return (
      String(e.proposed_by || '') === myId ||
      String(e.created_by || '') === myId ||
      String(e.student_organizer_id || '') === myId ||
      String(e.organizer_id || '') === myId
    );
  };

  const myProposals = events.filter(isMyProposal);
  const myOrganizingEvents = events.filter(e => !isMyProposal(e));

  const countNeedsRevision = myProposals.filter(e => e.status === 'needs_revision').length;
  const countInReview = myProposals.filter(e => ['pending_approval', 'under_review'].includes(e.status)).length;
  const countApproved = myProposals.filter(e => e.status === 'approved').length;
  const countPublished = myProposals.filter(e => ['published', 'active'].includes(e.status)).length;
  const countRejected = myProposals.filter(e => e.status === 'rejected').length;
  const countWithdrawn = myProposals.filter(e => e.status === 'withdrawn').length;
  const countAll = myProposals.filter(e => e.status !== 'withdrawn').length;

  const filteredProposals = myProposals.filter(e => {
    if (activeTab === 'all') return e.status !== 'withdrawn';
    if (activeTab === 'needs_revision') return e.status === 'needs_revision';
    if (activeTab === 'pending_approval') return ['pending_approval', 'under_review'].includes(e.status);
    if (activeTab === 'approved') return e.status === 'approved';
    if (activeTab === 'published') return ['published', 'active'].includes(e.status);
    if (activeTab === 'rejected') return e.status === 'rejected';
    if (activeTab === 'withdrawn') return e.status === 'withdrawn';
    return true;
  });

  const filterTabs = [
    { id: 'all', label: 'All Proposals', count: countAll },
    ...(countNeedsRevision > 0 ? [{ id: 'needs_revision', label: 'Needs Revision', count: countNeedsRevision, isAlert: true }] : []),
    { id: 'pending_approval', label: 'In Review', count: countInReview },
    { id: 'approved', label: 'Approved', count: countApproved },
    { id: 'published', label: 'Published', count: countPublished },
    ...(countRejected > 0 ? [{ id: 'rejected', label: 'Rejected', count: countRejected }] : []),
    ...(countWithdrawn > 0 ? [{ id: 'withdrawn', label: 'Withdrawn', count: countWithdrawn }] : [])
  ];

  return (
    <div className="flex-grow py-12 text-slate-700 relative overflow-hidden">
      <GeometricBlobDoodle className="absolute top-10 right-10 w-96 h-96 text-pastel-lavender -z-10 opacity-30 animate-spin-slow" />
      <GeometricBlobDoodle className="absolute bottom-20 left-10 w-80 h-80 text-pastel-mint -z-10 opacity-30 animate-float" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in-up">
          <div className="relative">
            <StickyNoteDoodle className="absolute -top-6 -left-10 w-10 h-10 text-pastel-yellow opacity-80 animate-wobble hidden md:block" />
            <h1 className="font-display text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              My <span className="heading-gradient text-fuchsia-500">Proposals</span>
            </h1>
            <p className="font-body text-slate-500 text-sm mt-1">
              Track event proposals, collaborate with faculty coordinators, and launch approved events
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="btn-primary px-6 py-3 rounded-2xl text-sm font-bold shadow-md shadow-fuchsia-500/20 flex items-center justify-center gap-2 self-start sm:self-auto text-white cursor-pointer hover:opacity-95 transition-transform active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span>Propose New Event</span>
          </button>
        </div>

        {/* Action Required Banner if proposals need revision */}
        {countNeedsRevision > 0 && (
          <div className="mb-8 p-5 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-amber-950/40 border-2 border-amber-300 dark:border-amber-700/70 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2 font-display font-bold text-amber-950 dark:text-amber-100 text-base">
                  <span>Proposal Revision Requested</span>
                  <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                    {countNeedsRevision} {countNeedsRevision === 1 ? 'Action Needed' : 'Actions Needed'}
                  </span>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                  The faculty coordinator requested revisions on your event proposal. Review coordinator instructions, edit details, and resubmit for review.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('needs_revision')}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-all shrink-0 cursor-pointer self-start sm:self-auto"
            >
              View Revision Requests
            </button>
          </div>
        )}

        {/* Streamlined Filter Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-8 scrollbar-none">
          <div className="p-1.5 bg-slate-100/90 dark:bg-slate-800/60 backdrop-blur-md rounded-2xl border border-slate-200/70 dark:border-slate-700/60 flex items-center gap-1.5 shrink-0 shadow-xs">
            {filterTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  activeTab === tab.id
                    ? tab.isAlert 
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-fuchsia-700 dark:text-fuchsia-400 shadow-sm border border-slate-200/50 dark:border-slate-700'
                    : tab.isAlert
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 border border-amber-300/60'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
                }`}
              >
                {tab.isAlert && <span className={`w-2 h-2 rounded-full ${activeTab === tab.id ? 'bg-white animate-pulse' : 'bg-amber-500 animate-pulse'}`}></span>}
                <span>{tab.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  activeTab === tab.id
                    ? tab.isAlert ? 'bg-white/20 text-white' : 'bg-fuchsia-100 dark:bg-fuchsia-950 text-fuchsia-700 dark:text-fuchsia-400'
                    : tab.isAlert ? 'bg-amber-200 text-amber-900' : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Loading / Empty States */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-36 bg-white/70 rounded-3xl animate-pulse border border-slate-200/60" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-20 bg-white/60 rounded-3xl border border-slate-200/70 p-8 animate-fade-in-up">
            <p className="text-rose-500 font-bold mb-3">{error}</p>
            <button onClick={fetchEvents} className="btn-primary px-6 py-2.5 text-sm font-bold rounded-xl text-white cursor-pointer">
              Retry
            </button>
          </div>
        ) : (
          <>
            {myProposals.length === 0 ? (
              <div className="text-center py-20 bg-white/80 backdrop-blur-sm rounded-3xl border border-slate-200/70 shadow-xs p-8 animate-fade-in-scale">
                <div className="h-16 w-16 bg-fuchsia-50 text-fuchsia-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-display font-bold text-slate-800 mb-1.5">No Proposals Yet</h3>
                <p className="text-sm font-body text-slate-500 max-w-md mx-auto mb-6">
                  You haven't submitted any event proposals. Create one and assign it to a faculty coordinator for approval.
                </p>
                <button
                  onClick={openCreateModal}
                  className="btn-primary px-6 py-3 rounded-2xl text-sm font-bold shadow-md shadow-fuchsia-500/20 inline-flex items-center gap-2 text-white cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Create Your First Proposal</span>
                </button>
              </div>
            ) : filteredProposals.length === 0 ? (
              <div className="text-center py-16 bg-white/70 backdrop-blur-sm rounded-3xl border border-slate-200/60 p-8 animate-fade-in-scale">
                <div className="h-12 w-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-base font-display font-bold text-slate-800 mb-1">No matching proposals</h3>
                <p className="text-xs font-body text-slate-500">
                  There are no proposals under the "{activeTab.replace(/_/g, ' ')}" filter.
                </p>
              </div>
            ) : (
              /* Event Cards Container */
              <div className="flex flex-col gap-4 mb-10">
                {filteredProposals.map((evt, i) => {
                  const assignedFac = facultyList.find(f => f.id === evt.faculty_id);
                  const facName = assignedFac 
                    ? (assignedFac.fullName || assignedFac.name) 
                    : (evt.faculty?.name || evt.faculty?.full_name || evt.faculty_name || null);
                  const teamCount = evt.teamMembers?.length || evt.organizersCount || 1;

                  return (
                    <div 
                      key={evt._id || evt.id} 
                      className="bg-white/95 backdrop-blur-md p-5 sm:p-6 rounded-3xl shadow-xs hover:shadow-md border border-slate-200/80 transition-all duration-300 flex flex-col"
                    >
                      {/* Card Content Row */}
                      <div className="flex flex-col md:flex-row gap-5 items-start">
                        {/* Event Thumbnail */}
                        <div className="relative shrink-0 w-full md:w-48 h-32 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/60 shadow-xs">
                          <img 
                            src={evt.image_url || evt.imageUrl} 
                            alt={evt.title} 
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" 
                          />
                          {evt.category && (
                            <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-black/60 text-white backdrop-blur-xs">
                              {evt.category}
                            </span>
                          )}
                        </div>
                        
                        {/* Event Core Info */}
                        <div className="flex-1 min-w-0 w-full flex flex-col justify-between self-stretch">
                          <div>
                            {/* Title & Status Badge Row */}
                            <div className="flex flex-wrap items-start justify-between gap-3 mb-2.5">
                              <h3 className="font-display font-bold text-xl text-slate-900 leading-snug">
                                {evt.title}
                              </h3>
                              
                              {/* Status Badge */}
                              <div>
                                {['pending_approval', 'under_review'].includes(evt.status) && (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/70">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                    Under Review
                                  </span>
                                )}
                                {evt.status === 'needs_revision' && (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200/70">
                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                    Needs Revision
                                  </span>
                                )}
                                {evt.status === 'approved' && (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    Approved
                                  </span>
                                )}
                                {['published', 'active'].includes(evt.status) && (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200/70">
                                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                                    Published
                                  </span>
                                )}
                                {evt.status === 'rejected' && (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200/70">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                    Rejected
                                  </span>
                                )}
                                {evt.status === 'withdrawn' && (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                    Withdrawn
                                  </span>
                                )}
                                {evt.status === 'draft' && (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200/70">
                                    Draft
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Metadata Pills */}
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              {/* Venue */}
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100/80 text-slate-700 text-xs font-medium">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                </svg>
                                <span>{evt.venue || 'Venue TBD'}</span>
                              </div>

                              {/* Date & Time */}
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100/80 text-slate-700 text-xs font-medium">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                </svg>
                                <span>{formatDate(evt.date)}</span>
                              </div>

                              {/* Faculty Coordinator */}
                              {facName && (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50/80 text-indigo-700 text-xs font-medium border border-indigo-100/80">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                                  </svg>
                                  <span>Coordinator: {facName}</span>
                                </div>
                              )}

                              {/* Team count */}
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100/80 text-slate-600 text-xs font-medium">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                                </svg>
                                <span>{teamCount} {teamCount === 1 ? 'Organizer' : 'Organizers'}</span>
                              </div>
                            </div>

                            {/* Needs Revision Notice */}
                            {evt.status === 'needs_revision' && (
                              <div className="mt-3 text-xs bg-amber-500/10 border-2 border-amber-500/30 text-amber-950 dark:text-amber-200 p-4 rounded-2xl flex items-start gap-3 shadow-xs">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <div className="flex-1 space-y-1">
                                  <div className="flex flex-wrap items-center justify-between gap-2 font-bold text-amber-900 dark:text-amber-100 text-xs">
                                    <span className="flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                      Faculty Coordinator Revision Instructions:
                                    </span>
                                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                                      Revision {evt.revision_number || 1}
                                    </span>
                                  </div>
                                  <div className="text-xs text-amber-900/90 dark:text-amber-200/90 font-medium whitespace-pre-line leading-relaxed">
                                    {evt.approval_remarks || 'The faculty coordinator requested revisions for this proposal. Please review your details/documents with "Edit" and click "Resubmit for Review" below.'}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Rejection Notice */}
                            {evt.status === 'rejected' && evt.approval_remarks && (
                              <div className="mt-3 text-xs bg-rose-50 text-rose-800 p-3 rounded-2xl border border-rose-200/70 flex items-start gap-2.5">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <div>
                                  <span className="font-bold">Faculty Remarks:</span> {evt.approval_remarks}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card Action Footer */}
                      <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                        {/* Contextual Status Hint on left */}
                        <div className="text-xs text-slate-400 font-medium">
                          {['pending_approval', 'under_review'].includes(evt.status) && 'Awaiting faculty coordinator review & decision'}
                          {evt.status === 'needs_revision' && 'Action needed: Update details or upload revised documents'}
                          {evt.status === 'approved' && 'Approved! Ready to publish for student registrations'}
                          {['published', 'active'].includes(evt.status) && 'Registration active & workspace ready'}
                          {evt.status === 'draft' && 'Draft proposal saved locally'}
                          {evt.status === 'rejected' && 'Proposal rejected by faculty coordinator'}
                          {evt.status === 'withdrawn' && 'This proposal was withdrawn'}
                        </div>

                        {/* Action Buttons on right */}
                        <div className="flex items-center gap-2">
                          {/* Secondary: Edit if draft or needs_revision (only for proposal creator) */}
                          {['draft', 'needs_revision', 'rejected'].includes(evt.status) && isMyProposal(evt) && (
                            <button
                              onClick={() => openEditModal(evt)}
                              className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
                            >
                              Edit
                            </button>
                          )}

                          {/* Secondary: Withdraw (only for proposal creator) */}
                          {['pending_approval', 'under_review', 'needs_revision', 'draft'].includes(evt.status) && isMyProposal(evt) && (
                            <button
                              onClick={() => setWithdrawEvent(evt)}
                              className="px-3 py-2 text-xs font-semibold text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            >
                              Withdraw
                            </button>
                          )}

                          {/* Secondary: Organizers management if published/approved */}
                          {['approved', 'published', 'active'].includes(evt.status) && (
                            <button
                              onClick={() => openOrgModal(evt)}
                              className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
                            >
                              Organizers ({evt.organizersCount || 0})
                            </button>
                          )}

                          {/* Secondary: Scan QR if published */}
                          {['approved', 'published', 'active', 'completed'].includes(evt.status) && new Date(evt.date) >= new Date() && (
                            <button
                              onClick={() => {
                                setScanFeedback(null);
                                setScannerModalEvent(evt);
                              }}
                              className="px-3 py-2 text-xs font-bold rounded-xl bg-teal-50 text-teal-700 border border-teal-200/70 hover:bg-teal-100 transition-all cursor-pointer"
                            >
                              Scan QR
                            </button>
                          )}

                          {/* Primary CTA: Submit for Draft (only for proposal creator) */}
                          {evt.status === 'draft' && isMyProposal(evt) && (
                            <button
                              onClick={() => handleUpdateStatus(evt._id || evt.id, 'pending_approval')}
                              className="btn-primary px-4 py-2 text-xs font-bold rounded-xl text-white shadow-xs cursor-pointer"
                            >
                              Submit for Review
                            </button>
                          )}

                          {/* Primary CTA: Resubmit for Review if needs_revision (only for proposal creator) */}
                          {evt.status === 'needs_revision' && isMyProposal(evt) && (
                            <button
                              onClick={() => handleResubmitProposal(evt._id || evt.id)}
                              disabled={resubmittingId === (evt._id || evt.id)}
                              className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:opacity-50 text-white shadow-sm shadow-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              <span>{resubmittingId === (evt._id || evt.id) ? 'Resubmitting...' : 'Resubmit for Review'}</span>
                            </button>
                          )}

                          {/* Primary CTA: Publish for Approved */}
                          {evt.status === 'approved' && (
                            <button
                              onClick={() => handlePublishEvent(evt._id || evt.id)}
                              className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-sm shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Publish Event</span>
                            </button>
                          )}

                          {/* Primary CTA: Review & Discussion Workspace for pre-publish proposals */}
                          {evt.status !== 'draft' && !['published', 'active', 'completed'].includes(evt.status) && (
                            <Link
                              to={`/proposals/${evt._id || evt.id}`}
                              className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white shadow-sm shadow-violet-500/20 transition-all flex items-center gap-1.5"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                              </svg>
                              <span>Review & Discussion</span>
                            </Link>
                          )}

                          {/* Primary CTA: Workspace if published */}
                          {['published', 'active', 'completed'].includes(evt.status) && (
                            <Link
                              to={`/workspace/${evt._id || evt.id}`}
                              className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-700 hover:to-indigo-700 text-white shadow-sm shadow-fuchsia-500/20 transition-all flex items-center gap-1.5"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                              </svg>
                              <span>Workspace</span>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
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
            <div className={`mb-6 p-4 rounded-xl border text-sm font-semibold flex items-center gap-2.5 animate-fade-in-up ${
              feedback.type === 'success' ? 'bg-emerald-500/8 border-emerald-500/15 text-emerald-600' : 'bg-red-500/8 border-red-500/15 text-red-600'
            }`}>
              {feedback.type === 'success' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
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
              <div className="flex items-center justify-between p-3.5 bg-fuchsia-500/5 border border-fuchsia-500/10 rounded-xl mt-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Enable Slot-Wise Registration</h4>
                  <p className="text-[10px] text-slate-500">Allow participants to select their convenient time slot</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={hasSlots} 
                    onChange={(e) => setHasSlots(e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-fuchsia-600"></div>
                </label>
              </div>

              <div className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="flex items-center justify-between"><div><h4 className="text-xs font-bold text-slate-800">Enable Payment</h4><p className="text-[10px] text-slate-600">Require UTR verification at team confirmation.</p></div><input type="checkbox" checked={paymentEnabled} onChange={(e) => setPaymentEnabled(e.target.checked)} /></div>
                {paymentEnabled && <><input type="number" min="1" step="0.01" required value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Payment amount (Rs.)" className="w-full rounded-xl border border-slate-300/50 bg-white/60 px-4 py-2.5 text-sm" /><input value={paymentUpiId} onChange={(e) => setPaymentUpiId(e.target.value)} placeholder="UPI ID (optional)" className="w-full rounded-xl border border-slate-300/50 bg-white/60 px-4 py-2.5 text-sm" /><input type="file" accept="image/*" required={!paymentQrUrl} onChange={(e) => setPaymentQrFile(e.target.files[0] || null)} className="w-full text-sm" /><textarea value={paymentInstructions} onChange={(e) => setPaymentInstructions(e.target.value)} placeholder="Payment instructions (optional)" rows={2} className="w-full rounded-xl border border-slate-300/50 bg-white/60 px-4 py-2.5 text-sm" />{paymentQrUrl && <img src={paymentQrUrl} alt="Payment QR preview" className="h-24 w-24 rounded-lg object-contain" />}</>}
              </div>
              <label className="mt-4 flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50/60 p-4 text-xs font-bold text-slate-700"><input type="checkbox" checked={scoringEnabled} onChange={e => setScoringEnabled(e.target.checked)} /> Enable scoring module for this event</label>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em]">
                  Faculty Coordinator Reviewer *
                </label>
                <button
                  type="button"
                  onClick={() => fetchFaculty()}
                  className="text-[10px] font-semibold text-fuchsia-600 hover:text-fuchsia-700 flex items-center gap-1 transition-colors"
                  title="Reload faculty coordinators"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh List
                </button>
              </div>

              {facultyList.length > 5 && (
                <div className="mb-2">
                  <input
                    type="text"
                    placeholder="Filter faculty list by name, department, or ID..."
                    value={facultySearchTerm}
                    onChange={(e) => setFacultySearchTerm(e.target.value)}
                    className="w-full bg-white/60 text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-fuchsia-500 transition-all"
                  />
                </div>
              )}

              <select
                required
                value={assignedFaculty}
                onChange={(e) => setAssignedFaculty(e.target.value)}
                className="w-full bg-white/80 text-slate-800 border border-slate-300/60 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 transition-all duration-200 cursor-pointer shadow-sm"
              >
                <option value="" disabled>-- Select Faculty Coordinator Reviewer --</option>
                {(() => {
                  const filteredFaculty = facultyList.filter(fac => {
                    const r = (fac.role || '').toLowerCase();
                    const name = (fac.displayLabel || fac.fullName || fac.name || '').toLowerCase();
                    const email = (fac.email || '').toLowerCase();
                    if (
                      r.includes('admin') ||
                      r.includes('higher') ||
                      r.includes('official') ||
                      name.includes('higher official') ||
                      name.includes('administrator') ||
                      email.includes('admin')
                    ) {
                      return false;
                    }
                    if (!facultySearchTerm.trim()) return true;
                    const search = facultySearchTerm.toLowerCase();
                    const dept = (fac.department || '').toLowerCase();
                    const empId = (fac.employeeId || '').toLowerCase();
                    return name.includes(search) || email.includes(search) || dept.includes(search) || empId.includes(search);
                  });
                  const optionsToRender = assignedFaculty && !filteredFaculty.some(f => f.id === assignedFaculty)
                    ? [...filteredFaculty, facultyList.find(f => f.id === assignedFaculty)].filter(Boolean)
                    : filteredFaculty;

                  return optionsToRender.map(fac => (
                    <option key={fac.id} value={fac.id}>
                      {fac.displayLabel || fac.fullName || fac.name} {fac.email ? `(${fac.email})` : ''}
                    </option>
                  ));
                })()}
              </select>

              {facultyList.length === 0 && (
                <div className="mt-2 p-2.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                  <span>No faculty coordinators loaded yet.</span>
                  <button
                    type="button"
                    onClick={() => fetchFaculty()}
                    className="px-2 py-0.5 text-xs font-semibold bg-amber-200/70 hover:bg-amber-200 text-amber-900 rounded-md transition-colors"
                  >
                    Reload
                  </button>
                </div>
              )}

              {/* Selected Faculty Card preview */}
              {(() => {
                const selectedFac = facultyList.find(f => f.id === assignedFaculty);
                if (!selectedFac) return null;
                return (
                  <div className="mt-2.5 p-3 bg-gradient-to-r from-fuchsia-50/80 via-purple-50/50 to-indigo-50/50 border border-fuchsia-200/80 rounded-xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-fuchsia-600 to-purple-600 flex-shrink-0 flex items-center justify-center text-white font-bold text-xs uppercase shadow-sm">
                        {(selectedFac.fullName || selectedFac.name || 'F').charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate">
                          {selectedFac.fullName || selectedFac.name}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                          {selectedFac.department && <span>{selectedFac.department}</span>}
                          {selectedFac.employeeId && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-[10px] bg-white/80 px-1 py-0.2 rounded border border-slate-200 text-slate-600">
                                {selectedFac.employeeId}
                              </span>
                            </>
                          )}
                          {selectedFac.email && (
                            <>
                              <span>•</span>
                              <span className="text-slate-500 truncate">{selectedFac.email}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-lg bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200 flex-shrink-0">
                      Selected
                    </span>
                  </div>
                );
              })()}
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
            <div className={`mb-6 p-4 rounded-xl border text-sm font-semibold flex items-center gap-2.5 animate-fade-in-up ${
              teamFeedback.type === 'success' ? 'bg-emerald-500/8 border-emerald-500/15 text-emerald-600' : 'bg-red-500/8 border-red-500/15 text-red-600'
            }`}>
              {teamFeedback.type === 'success' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
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
            <div className={`mb-6 p-4 rounded-xl border text-sm font-semibold flex items-center gap-2.5 animate-fade-in-up ${
              orgFeedback.type === 'success' ? 'bg-emerald-500/8 border-emerald-500/15 text-emerald-600' : 'bg-red-500/8 border-red-500/15 text-red-600'
            }`}>
              {orgFeedback.type === 'success' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
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
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className="text-[9px] font-bold text-fuchsia-600 uppercase tracking-wider px-2 py-0.5 rounded bg-fuchsia-500/10 border border-fuchsia-500/15">
                          {member.category}
                        </div>
                        <div className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200">
                          Student Organizer
                        </div>
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
                  scanFeedback.type === 'success' ? 'bg-emerald-500/8 border-emerald-500/15 text-emerald-600' : 'bg-red-500/8 border-red-500/15 text-red-600'
                }`}>
                  {scanFeedback.type === 'success' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
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
