import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Modal from '../components/Modal';
import QRScanner from '../components/QRScanner';
import { supabase } from '../context/AuthContext';

const AdminEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Scanner Modal states
  const [scannerModalEvent, setScannerModalEvent] = useState(null);
  const [scanFeedback, setScanFeedback] = useState(null);

  // Form states (Same as Student Create Event, NO Faculty details)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Technical');
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState('');
  const [capacity, setCapacity] = useState('50');
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState('draft');

  const [posterOption, setPosterOption] = useState('upload'); // 'upload', 'url'
  const [posterFile, setPosterFile] = useState(null);
  const [posterPreview, setPosterPreview] = useState('');

  const [registrationType, setRegistrationType] = useState('individual');
  const [maxTeams, setMaxTeams] = useState('');
  const [minTeamSize, setMinTeamSize] = useState('1');
  const [maxTeamSize, setMaxTeamSize] = useState('4');
  const [allowCrossDepartment, setAllowCrossDepartment] = useState(true);
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentUpiId, setPaymentUpiId] = useState('');
  const [paymentQrUrl, setPaymentQrUrl] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [paymentQrFile, setPaymentQrFile] = useState(null);
  const [scoringEnabled, setScoringEnabled] = useState(false);
  const [feedbackQuestions, setFeedbackQuestions] = useState([]);

  // Organizers States
  const [candidatesList, setCandidatesList] = useState([]);
  const [orgSearchQuery, setOrgSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [orgModalEvent, setOrgModalEvent] = useState(null);
  const [orgMembers, setOrgMembers] = useState([]);
  const [selectedOrgStudent, setSelectedOrgStudent] = useState('');
  const [selectedOrgCategory, setSelectedOrgCategory] = useState('Event Head');
  const [selectedOrganizerRole, setSelectedOrganizerRole] = useState('normal');
  const [orgFeedback, setOrgFeedback] = useState(null);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [orgRequests, setOrgRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [joinTeamEnabled, setJoinTeamEnabled] = useState(false);

  // Actions Dropdown State
  const [openDropdownId, setOpenDropdownId] = useState(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.event-actions-dropdown')) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const categories = ['Technical', 'Cultural', 'Sports', 'Workshop', 'Seminar'];

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

  const getTomorrowISO = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0); // start of tomorrow
    return formatToDatetimeLocal(d);
  };

  const getMaxDeadlineISO = () => {
    if (!date) return '';
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    d.setHours(23, 59, 59, 999);
    return formatToDatetimeLocal(d);
  };

  const handleCloseRegistrations = async (eventId, eventTitle) => {
    if (!window.confirm(`Manually close registrations for "${eventTitle}"?`)) {
      return;
    }
    try {
      await axios.post(`/api/events/admin/${eventId}/close-registrations`);
      alert(`Registrations for "${eventTitle}" have been manually closed.`);
      fetchEvents();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to close registrations.');
    }
  };

  const handleOpenRegistrations = async (eventId, eventTitle) => {
    if (!window.confirm(`Manually open registrations for "${eventTitle}"?`)) {
      return;
    }
    try {
      await axios.post(`/api/events/admin/${eventId}/open-registrations`);
      alert(`Registrations for "${eventTitle}" have been manually opened.`);
      fetchEvents();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to open registrations.');
    }
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get('/api/events');
      setEvents(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch events list.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCandidates = async () => {
    try {
      const [studentsRes, facultyRes] = await Promise.all([
        axios.get('/api/users/students').catch(() => ({ data: [] })),
        axios.get('/api/users/faculty-coordinators').catch(() => ({ data: [] }))
      ]);

      const students = (studentsRes.data || []).map(s => ({
        ...s,
        type: 'Student',
        searchKey: `${s.fullName || ''} ${s.rollNumber || s.roll_number || ''} ${s.email || ''}`.toLowerCase()
      }));

      const faculty = (facultyRes.data || []).map(f => ({
        ...f,
        type: 'Faculty Coordinator',
        searchKey: `${f.fullName || ''} ${f.employeeId || f.employee_id || ''} ${f.department || ''} ${f.email || ''}`.toLowerCase()
      }));

      setCandidatesList([...students, ...faculty]);
    } catch (err) {
      console.error('Error fetching candidates:', err);
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchCandidates();
  }, []);

  // ── Create Modal ─────────────────────────────────────────────────────────────
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
    setCapacity('50');
    setImageUrl('');
    setStatus('draft');
    setRegistrationType('individual');
    setMaxTeams('');
    setMinTeamSize('1');
    setMaxTeamSize('4');
    setAllowCrossDepartment(true);
    setRegistrationDeadline('');
    setPaymentEnabled(false); setPaymentAmount(''); setPaymentUpiId(''); setPaymentQrUrl(''); setPaymentInstructions(''); setPaymentQrFile(null);
    setScoringEnabled(false);
    setFeedbackQuestions([]);
    setFeedback(null);
    setIsModalOpen(true);
  };

  // ── Edit Modal ───────────────────────────────────────────────────────────────
  const openEditModal = (event) => {
    setModalMode('edit');
    setSelectedEventId(event._id || event.id);
    setTitle(event.title || '');
    setDescription(event.description || '');
    setCategory(event.category || 'Technical');
    setVenue(event.venue || '');
    setDate(formatToDatetimeLocal(event.date));
    setCapacity(String(event.capacity || 50));
    setPosterOption(event.image_url || event.imageUrl ? 'url' : 'upload');
    setPosterFile(null);
    setPosterPreview('');
    setImageUrl(event.imageUrl || event.image_url || '');
    setStatus(event.status || 'draft');

    setRegistrationType(event.registration_type || 'individual');
    setMaxTeams(event.max_teams ? String(event.max_teams) : '');
    setMinTeamSize(event.min_team_size ? String(event.min_team_size) : '1');
    setMaxTeamSize(event.max_team_size ? String(event.max_team_size) : '4');
    setAllowCrossDepartment(event.allow_cross_department ?? true);
    setRegistrationDeadline(formatToDatetimeLocal(event.registration_deadline));

    setPaymentEnabled(!!event.payment_enabled);
    setPaymentAmount(event.payment_amount ? String(event.payment_amount) : '');
    setPaymentUpiId(event.payment_upi_id || '');
    setPaymentQrUrl(event.payment_qr_url || '');
    setPaymentInstructions(event.payment_instructions || '');
    setPaymentQrFile(null);

    setScoringEnabled(!!event.scoring_enabled);
    setFeedbackQuestions(event.feedback_questions || event.feedbackQuestions || []);

    setFeedback(null);
    setIsModalOpen(true);
  };

  // ── Submit Handler ────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);

    if (!title || !description || !category || !venue || !date || (registrationType === 'individual' && !capacity)) {
      setFeedback({ type: 'error', message: 'Please enter all required fields.' });
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
        capacity: registrationType === 'team' ? undefined : Number(capacity),
        imageUrl: finalImageUrl || undefined,
        // On create: always Draft. On edit: use current status value.
        status: modalMode === 'create' ? 'draft' : status,
        registrationType,
        maxTeams: registrationType === 'team' ? Number(maxTeams) : undefined,
        minTeamSize: registrationType === 'team' ? Number(minTeamSize) : undefined,
        maxTeamSize: registrationType === 'team' ? Number(maxTeamSize) : undefined,
        allowCrossDepartment: registrationType === 'team' ? allowCrossDepartment : undefined,
        registrationDeadline: registrationDeadline ? (registrationDeadline.includes('Z') || registrationDeadline.includes('+') ? registrationDeadline : new Date(registrationDeadline).toISOString()) : undefined,
        paymentEnabled, paymentAmount: paymentEnabled ? Number(paymentAmount) : undefined, paymentUpiId: paymentEnabled ? paymentUpiId : undefined,
        paymentQrUrl: paymentEnabled ? finalPaymentQrUrl : undefined, paymentInstructions: paymentEnabled ? paymentInstructions : undefined,
        scoringEnabled,
        feedbackQuestions,
      };

      if (modalMode === 'create') {
        await axios.post('/api/events', eventData);
        setFeedback({ type: 'success', message: 'Event saved as Draft!' });
      } else {
        await axios.put(`/api/events/${selectedEventId}`, eventData);
        setFeedback({ type: 'success', message: 'Event updated successfully!' });
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

  // ── Publish Event ─────────────────────────────────────────────────────────────
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

  // Delete Confirmation Modal state
  const [deleteConfirmEvent, setDeleteConfirmEvent] = useState(null);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);

  // ── Delete Handler ────────────────────────────────────────────────────────────
  const confirmDeleteEvent = async (eventId) => {
    try {
      setIsDeletingEvent(true);
      await axios.delete(`/api/events/${eventId}`);
      setEvents(prev => prev.filter(e => (e._id || e.id) !== eventId));
      setDeleteConfirmEvent(null);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to delete event.');
    } finally {
      setIsDeletingEvent(false);
    }
  };

  // ── Organizers Modal ──────────────────────────────────────────────────────────
  const openOrgModal = async (event) => {
    setOrgModalEvent(event);
    setJoinTeamEnabled(!!event.join_team_enabled);
    setSelectedOrgStudent('');
    setOrgSearchQuery('');
    setIsDropdownOpen(false);
    setSelectedOrgCategory('Event Head');
    setSelectedOrganizerRole('normal');
    setOrgFeedback(null);
    setIsOrgModalOpen(true);
    setLoadingOrgs(true);
    setLoadingRequests(true);
    fetchCandidates();
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

  const handleProcessRequest = async (requestId, statusVal) => {
    setOrgFeedback(null);
    try {
      await axios.put(`/api/events/${orgModalEvent._id || orgModalEvent.id}/organizer-requests/${requestId}`, {
        status: statusVal
      });
      setOrgFeedback({ type: 'success', message: `Request successfully ${statusVal}.` });

      const resReq = await axios.get(`/api/events/${orgModalEvent._id || orgModalEvent.id}/organizer-requests`);
      setOrgRequests(resReq.data);

      if (statusVal === 'approved') {
        const resOrg = await axios.get(`/api/events/${orgModalEvent._id || orgModalEvent.id}/organizers`);
        setOrgMembers(resOrg.data);
        fetchEvents();
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
      setOrgFeedback({ type: 'error', message: 'Please search and select a student or faculty member.' });
      return;
    }

    try {
      const res = await axios.post(`/api/events/${orgModalEvent._id || orgModalEvent.id}/organizers`, {
        studentId: selectedOrgStudent,
        category: selectedOrgCategory,
        organizerRole: selectedOrganizerRole
      });

      setOrgFeedback({ type: 'success', message: res.data.message || 'Organizer added successfully!' });
      setSelectedOrgStudent('');
      setOrgSearchQuery('');
      setIsDropdownOpen(false);

      const resOrgs = await axios.get(`/api/events/${orgModalEvent._id || orgModalEvent.id}/organizers`);
      setOrgMembers(resOrgs.data);
      fetchEvents();
    } catch (err) {
      setOrgFeedback({ type: 'error', message: err.response?.data?.message || 'Error adding organizer.' });
    }
  };

  const handleRemoveOrganizer = async (studentId) => {
    setOrgFeedback(null);
    try {
      await axios.delete(`/api/events/${orgModalEvent._id || orgModalEvent.id}/organizers/${studentId}`);
      setOrgFeedback({ type: 'success', message: 'Organizer removed successfully!' });

      const res = await axios.get(`/api/events/${orgModalEvent._id || orgModalEvent.id}/organizers`);
      setOrgMembers(res.data);
      fetchEvents();
    } catch (err) {
      setOrgFeedback({ type: 'error', message: err.response?.data?.message || 'Error removing organizer.' });
    }
  };

  // ── QR Attendance Scan ────────────────────────────────────────────────────────
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

  const statusBadgeClass = (s) => {
    if (s === 'active' || s === 'published') return 'bg-emerald-500/8 text-emerald-400 border-emerald-500/15';
    if (s === 'completed') return 'bg-blue-500/8 text-blue-400 border-blue-500/15';
    if (s === 'draft') return 'bg-amber-500/8 text-amber-400 border-amber-500/15';
    return 'bg-red-500/8 text-red-400 border-red-500/15';
  };

  return (
    <div className="flex-grow py-20 text-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10 animate-fade-in-up">
          <div>
            <h1 className="font-display text-3xl font-black text-text-primary">Configure <span className="heading-gradient">Events</span></h1>
            <p className="font-body text-slate-600 text-sm mt-1.5">Create drafts, manage organizers, and publish campus events</p>
          </div>
          <button
            onClick={openCreateModal}
            className="btn-primary px-6 py-3 text-xs font-display font-bold rounded-xl text-white shadow-lg shadow-violet-500/15 self-start"
          >
            + Create New Event
          </button>
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
        ) : events.length === 0 ? (
          <div className="text-center py-24 glass-panel rounded-2xl animate-fade-in-scale">
            <div className="h-20 w-20 bg-white/50 rounded-2xl flex items-center justify-center mx-auto text-slate-600 mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="text-xl font-display font-bold text-slate-800 mb-2">No Events Found</h3>
            <p className="text-sm font-body text-slate-600 mb-6">Create your first campus event to get started.</p>
            <button onClick={openCreateModal} className="btn-primary px-6 py-2.5 text-xs font-display font-bold rounded-xl text-white">Create Event</button>
          </div>
        ) : (
          /* Event Table */
          <div className="animate-fade-in-up delay-100 glass-panel rounded-2xl overflow-hidden shadow-2xl shadow-violet-500/3">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/40 border-b border-slate-200/40 text-slate-600 text-[10px] font-bold uppercase tracking-[0.1em]">
                    <th className="px-6 py-4">Event Details</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Roster</th>
                    <th className="px-6 py-4">Date &amp; Time</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30 text-sm font-body">
                  {events.map((evt, i) => (
                    <tr 
                      key={evt._id || evt.id} 
                      className="hover:bg-white/20 transition-all duration-300 animate-fade-in-up"
                      style={{ animationDelay: `${i * 40 + 150}ms` }}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={evt.imageUrl || evt.image_url} alt="" className="h-10 w-16 rounded-lg object-cover bg-white/50" />
                          <div>
                            <div className="font-display font-bold text-slate-800 line-clamp-1">{evt.title}</div>
                            <div className="text-[10px] text-slate-600 mt-0.5 font-medium">{evt.venue}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white/40 text-slate-600 border border-slate-300/30 uppercase tracking-wider">
                          {evt.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium">
                        {evt.registration_type === 'team' ? (
                          <span className="text-slate-600">Team Event</span>
                        ) : (
                          <span className={evt.registeredCount >= evt.capacity ? 'text-red-400 font-bold' : 'text-slate-600'}>
                            {evt.registeredCount ?? 0} / {evt.capacity}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-xs">
                        {formatDate(evt.date)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-lg border ${statusBadgeClass(evt.status)}`}>
                          {(evt.status || 'draft').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {/* Organizers button stays visible inline */}
                          {(evt.status === 'draft' || evt.status === 'active' || evt.status === 'published' || evt.status === 'completed') && (
                            <button
                              onClick={() => openOrgModal(evt)}
                              className="px-3 py-1.5 text-[10px] font-bold rounded-lg bg-violet-500/10 text-violet-600 border border-violet-500/20 hover:bg-violet-500/20 transition-all duration-300"
                            >
                              Organizers ({evt.organizersCount || 0})
                            </button>
                          )}

                          {/* Actions Dropdown */}
                          <div className="relative inline-block text-left event-actions-dropdown">
                            <button
                              type="button"
                              onClick={() => setOpenDropdownId(openDropdownId === (evt._id || evt.id) ? null : (evt._id || evt.id))}
                              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white/60 text-slate-700 border border-slate-300/50 hover:bg-white hover:border-slate-300 transition-all duration-300 flex items-center gap-1.5 cursor-pointer shadow-sm"
                            >
                              <span>Actions</span>
                              <svg className={`h-3.5 w-3.5 transition-transform duration-200 ${openDropdownId === (evt._id || evt.id) ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>

                            {openDropdownId === (evt._id || evt.id) && (
                              <div className="origin-top-right absolute right-0 mt-1.5 w-52 rounded-xl shadow-xl bg-white border border-slate-200 z-50 p-1.5 space-y-1 animate-fade-in-scale text-left">
                                {/* Workspace & ID Cards Access */}
                                <Link
                                  to={`/workspace/${evt._id || evt.id}?tab=id_cards`}
                                  onClick={() => setOpenDropdownId(null)}
                                  className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg flex items-center gap-2 transition-colors block"
                                >
                                  <svg className="h-4 w-4 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                  </svg>
                                  <span>Workspace (ID Cards)</span>
                                </Link>

                                {/* Scan QR */}
                                {(evt.status === 'active' || evt.status === 'published' || evt.status === 'completed') && new Date(evt.date) >= new Date() && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenDropdownId(null);
                                      setScanFeedback(null);
                                      setScannerModalEvent(evt);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-teal-50 hover:text-teal-600 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <svg className="h-4 w-4 text-teal-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <rect x="3" y="3" width="7" height="7" rx="1.5" strokeWidth="2" />
                                      <rect x="14" y="3" width="7" height="7" rx="1.5" strokeWidth="2" />
                                      <rect x="14" y="14" width="7" height="7" rx="1.5" strokeWidth="2" />
                                      <rect x="3" y="14" width="7" height="7" rx="1.5" strokeWidth="2" />
                                    </svg>
                                    <span>Scan QR</span>
                                  </button>
                                )}

                                {/* Close / Open Registrations */}
                                {(evt.status === 'active' || evt.status === 'published') && (
                                  evt.registration_deadline && new Date(evt.registration_deadline) <= new Date() ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenDropdownId(null);
                                        handleOpenRegistrations(evt._id || evt.id, evt.title);
                                      }}
                                      className="w-full text-left px-3 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                                    >
                                      <svg className="h-4 w-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                      </svg>
                                      <span>Open Registrations</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenDropdownId(null);
                                        handleCloseRegistrations(evt._id || evt.id, evt.title);
                                      }}
                                      className="w-full text-left px-3 py-2 text-xs font-bold text-amber-600 hover:bg-amber-50 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                                    >
                                      <svg className="h-4 w-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                      </svg>
                                      <span>Close Registrations</span>
                                    </button>
                                  )
                                )}

                                {/* Edit */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    openEditModal(evt);
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                                >
                                  <svg className="h-4 w-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  <span>Edit</span>
                                </button>

                                {/* Publish (if Draft) */}
                                {evt.status === 'draft' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenDropdownId(null);
                                      handlePublishEvent(evt._id || evt.id);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <svg className="h-4 w-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Publish</span>
                                  </button>
                                )}

                                {/* Delete (Destructive) */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    setDeleteConfirmEvent({ id: evt._id || evt.id, title: evt.title });
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg flex items-center gap-2 transition-colors border-t border-slate-100 mt-1 cursor-pointer"
                                >
                                  <svg className="h-4 w-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Create / Edit Event Modal ─────────────────────────────────────────── */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={modalMode === 'create' ? 'Create Event (Save as Draft)' : 'Modify Event Settings'}
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
                className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-white/60 text-slate-700 border border-slate-300/50 rounded-xl px-3 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300 cursor-pointer"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {modalMode === 'edit' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-white/60 text-slate-700 border border-slate-300/50 rounded-xl px-3 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300 cursor-pointer"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active (Open)</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Venue / Hall *</label>
                <input
                  type="text"
                  required
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="e.g. Seminar Hall A"
                  className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Date &amp; Time *</label>
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
                  className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Registration Closing / Team Approval Deadline</label>
                <input
                  type="datetime-local"
                  disabled={!date}
                  min={getTomorrowISO()}
                  max={getMaxDeadlineISO()}
                  value={registrationDeadline}
                  onChange={(e) => setRegistrationDeadline(e.target.value)}
                  className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {!date && <p className="text-[10px] text-violet-500 mt-1 font-semibold">Please select the event date first.</p>}
              </div>

              <div className="col-span-1 sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Event Poster</label>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setPosterOption('upload')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${posterOption === 'upload' ? 'bg-violet-100 text-violet-700 border border-violet-200' : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'}`}
                  >
                    Upload Poster
                  </button>
                  <button
                    type="button"
                    onClick={() => setPosterOption('url')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${posterOption === 'url' ? 'bg-violet-100 text-violet-700 border border-violet-200' : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'}`}
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
                      className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
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
                      className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300"
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
                    className="w-full bg-white/60 text-slate-700 border border-slate-300/50 rounded-xl px-3 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300 cursor-pointer"
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
                      className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300"
                    />
                  </div>
                </div>
              )}

              {registrationType === 'team' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 animate-fade-in-up">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Number of Teams Allowed *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={maxTeams}
                      onChange={(e) => setMaxTeams(e.target.value)}
                      className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300"
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
                      className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300"
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
                      className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300"
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
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600"></div>
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

            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Detailed Description *</label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Details about participation criteria, speaker profiles, event details..."
                className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300 resize-none"
              />
            </div>

            {modalMode === 'create' && (
              <div className="p-3 rounded-xl bg-amber-500/8 border border-amber-500/15 text-amber-600 text-xs font-semibold flex gap-2 items-start">
                <span className="mt-0.5">ℹ</span>
                <span>The event will be saved as <strong>Draft</strong>. You can manage organizers and publish it later from the events table.</span>
              </div>
            )}

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
                className="btn-primary px-6 py-2.5 text-xs font-display font-bold rounded-xl text-white shadow-lg shadow-violet-500/15 disabled:opacity-50"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Saving...
                  </span>
                ) : modalMode === 'create' ? 'Save as Draft' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>

        {/* ── Manage Organizers Modal ───────────────────────────────────────────── */}
        <Modal
          isOpen={isOrgModalOpen}
          onClose={() => setIsOrgModalOpen(false)}
          title={`Manage Organizers — ${orgModalEvent?.title || ''}`}
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
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600"></div>
            </label>
          </div>

          {/* Organizer Requests Section */}
          {orgRequests.length > 0 && (
            <div className="mb-6 pb-6 border-b border-slate-200/30">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 font-display">Pending Join Requests</h4>
              <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                {orgRequests.map(req => (
                  <div key={req.id} className="flex items-center justify-between p-3 bg-violet-500/5 rounded-xl border border-violet-500/15 animate-fade-in-up">
                    <div>
                      <div className="text-sm font-bold text-slate-800">{req.studentName}</div>
                      <div className="text-[10px] text-slate-600 font-medium">{req.studentEmail} &bull; {req.category}</div>
                      {req.message && <div className="text-[11px] text-slate-500 italic mt-1 font-body">"{req.message}"</div>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleProcessRequest(req.id, 'approved')}
                        className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all duration-300"
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
            </div>
          )}

          {/* Add Organizer Form */}
          <form onSubmit={handleAddOrganizer} className="space-y-4 mb-6 pb-6 border-b border-slate-200/30">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Add Organizer (Student or Faculty)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Live Search & Select Combobox */}
              <div className="relative">
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Search & Select Organizer *</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search name, roll no, or email..."
                    value={orgSearchQuery}
                    onFocus={() => setIsDropdownOpen(true)}
                    onChange={(e) => {
                      setOrgSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                      setSelectedOrgStudent('');
                    }}
                    className="w-full bg-white/60 text-slate-700 border border-slate-300/50 rounded-xl px-3 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300"
                  />
                  {selectedOrgStudent && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrgStudent('');
                        setOrgSearchQuery('');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Dropdown list */}
                {isDropdownOpen && (
                  <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl space-y-1 p-1">
                    {candidatesList.filter(c => {
                      if (!orgSearchQuery.trim()) return true;
                      const parts = orgSearchQuery.trim().toLowerCase().split(/\s+/);
                      return parts.every(part => c.searchKey.includes(part));
                    }).length === 0 ? (
                      <div className="px-3 py-2 text-xs text-slate-500 italic">No matching student or faculty found</div>
                    ) : (
                      candidatesList.filter(c => {
                        if (!orgSearchQuery.trim()) return true;
                        const parts = orgSearchQuery.trim().toLowerCase().split(/\s+/);
                        return parts.every(part => c.searchKey.includes(part));
                      }).map(c => {
                        const isSelected = selectedOrgStudent === c.id;
                        const isAlreadyOrg = orgMembers.some(m => String(m.userId) === String(c.id));
                        return (
                          <div
                            key={c.id}
                            onClick={() => {
                              if (isAlreadyOrg) return;
                              setSelectedOrgStudent(c.id);
                              setOrgSearchQuery(`${c.fullName} (${c.type === 'Student' ? (c.rollNumber || 'Student') : (c.department || 'Faculty')})`);
                              setIsDropdownOpen(false);
                            }}
                            className={`p-2.5 rounded-lg text-xs cursor-pointer flex justify-between items-start transition-colors ${
                              isSelected ? 'bg-violet-500/15 border border-violet-500/30' : isAlreadyOrg ? 'bg-gray-100 opacity-50 cursor-not-allowed' : 'hover:bg-slate-100'
                            }`}
                          >
                            <div>
                              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                {c.fullName}
                                {isAlreadyOrg && <span className="text-[9px] text-amber-600 font-normal">(Already Added)</span>}
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                {c.type === 'Student' ? `Roll No: ${c.rollNumber || 'N/A'}` : `Dept: ${c.department || 'N/A'} • ID: ${c.employeeId || 'N/A'}`} • {c.email}
                              </div>
                            </div>
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                              c.type === 'Student' ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' : 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                            }`}>
                              {c.type}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Category *</label>
                <select
                  required
                  value={selectedOrgCategory}
                  onChange={(e) => setSelectedOrgCategory(e.target.value)}
                  className="w-full bg-white/60 text-slate-700 border border-slate-300/50 rounded-xl px-3 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300 cursor-pointer"
                >
                  {['Event Head', 'Technical Team', 'Design Team', 'Media Team', 'Hospitality Team', 'Logistics Team', 'Volunteer', 'Other'].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={!selectedOrgStudent}
              className="btn-primary w-full py-2.5 rounded-xl text-xs font-bold text-white shadow-lg shadow-violet-500/15 disabled:opacity-50"
            >
              + Add Organizer
            </button>
          </form>

          {/* Current Organizers List */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 font-display">Current Organizers</h4>
            {loadingOrgs ? (
              <p className="text-xs text-slate-600 italic font-medium">Loading organizers...</p>
            ) : orgMembers.length === 0 ? (
              <p className="text-xs text-slate-600 italic">No organizers added yet.</p>
            ) : (
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {orgMembers.map(member => (
                  <div key={member.id || member.userId} className="flex items-center justify-between p-3 bg-white/30 rounded-xl border border-slate-200/20 animate-fade-in-up">
                    <div>
                      <div className="text-sm font-bold text-slate-800">{member.name}</div>
                      <div className="text-[10px] text-slate-600 font-medium">{member.email} &bull; {member.department}</div>
                      <div className="text-[9px] font-bold text-violet-400 uppercase tracking-wider mt-1.5 inline-block px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/15">
                        {member.category}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveOrganizer(member.userId)}
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

        {/* Delete Confirmation Modal */}
        {deleteConfirmEvent && (
          <Modal
            isOpen={!!deleteConfirmEvent}
            onClose={() => setDeleteConfirmEvent(null)}
            title="Are you sure you want to delete this event?"
          >
            <div className="space-y-5">
              <div className="flex items-start gap-3.5 p-4 bg-red-500/10 dark:bg-red-950/40 border border-red-500/20 rounded-2xl">
                <span className="text-xl shrink-0">⚠️</span>
                <div className="space-y-1">
                  <h4 className="font-heading font-extrabold text-sm text-red-600 dark:text-red-400">
                    Delete "{deleteConfirmEvent.title}"?
                  </h4>
                  <p className="text-xs text-text-secondary leading-relaxed font-medium">
                    This event may already have registered participants, teams, allocations, attendance records, and other associated data. Deleting it may affect existing event data. This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isDeletingEvent}
                  onClick={() => setDeleteConfirmEvent(null)}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl btn-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingEvent}
                  onClick={() => confirmDeleteEvent(deleteConfirmEvent.id)}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl bg-red-600 text-white hover:bg-red-700 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  {isDeletingEvent ? 'Deleting...' : 'Delete Event'}
                </button>
              </div>
            </div>
          </Modal>
        )}

      </div>
    </div>
  );
};

export default AdminEvents;
