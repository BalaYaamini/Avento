import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import EventCard from '../components/EventCard';
import Modal from '../components/Modal';
import { 
  SparkleDoodle, 
  SquiggleDoodle, 
  StarDoodle,
  ArrowDoodle,
  PinDoodle
} from '../components/Doodles';
const Home = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [myRegistrations, setMyRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('published'); // default show published events
  const [registeringIds, setRegisteringIds] = useState({});
  const [feedback, setFeedback] = useState(null);

  // Organizers Modal state
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [orgModalEvent, setOrgModalEvent] = useState(null);
  const [eventOrganizers, setEventOrganizers] = useState([]);
  const [loadingOrganizers, setLoadingOrganizers] = useState(false);

  // Team Registration States
  const [studentsList, setStudentsList] = useState([]);
  const [isTeamRegOpen, setIsTeamRegOpen] = useState(false);
  const [teamRegEvent, setTeamRegEvent] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [selectedTeamMembers, setSelectedTeamMembers] = useState([]);
  const [selectedStudentToAdd, setSelectedStudentToAdd] = useState('');

  const fetchEligibleStudents = async (eventId) => {
    try {
      const res = await axios.get(`/api/registrations/event/${eventId}/eligible-students`);
      setStudentsList(res.data);
    } catch (err) {
      console.error('Error fetching eligible students:', err);
    }
  };

  const handleViewOrganizers = async (event) => {
    setOrgModalEvent(event);
    setIsOrgModalOpen(true);
    setLoadingOrganizers(true);
    try {
      const res = await axios.get(`/api/events/${event._id || event.id}/organizers`);
      setEventOrganizers(res.data);
    } catch (err) {
      console.error('Error fetching event organizers:', err);
      alert('Failed to load organizing team.');
    } finally {
      setLoadingOrganizers(false);
    }
  };

  // Registration Confirmation Modal States
  const [confirmRegEvent, setConfirmRegEvent] = useState(null);
  const [isConfirmRegOpen, setIsConfirmRegOpen] = useState(false);

  // Join Team Request States
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinEvent, setJoinEvent] = useState(null);
  const [selectedJoinCategory, setSelectedJoinCategory] = useState('Technical Team');

  const openJoinModal = (event) => {
    setJoinEvent(event);
    setSelectedJoinCategory('Technical Team');
    setIsJoinModalOpen(true);
  };

  const handleJoinTeamSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const eventId = joinEvent._id || joinEvent.id;
      await axios.post(`/api/events/${eventId}/organizer-requests`, {
        category: selectedJoinCategory
      });
      setFeedback({ type: 'success', message: 'Join request submitted successfully!' });
      fetchEvents();
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to submit join request.' });
    } finally {
      setIsJoinModalOpen(false);
      setJoinEvent(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const getUserJoinRequestStatus = (evt) => {
    if (!user) return null;
    const userId = user.id || user._id;
    if (!userId) return null;
    if (evt.organizerRequests && Array.isArray(evt.organizerRequests)) {
      const req = evt.organizerRequests.find(r => String(r.studentId) === String(userId));
      return req ? req.status : null;
    }
    return null;
  };

  const openConfirmReg = (event) => {
    if (event.registration_type === 'team') {
      setTeamRegEvent(event);
      setTeamName('');
      setSelectedTeamMembers([]);
      setSelectedStudentToAdd('');
      setIsTeamRegOpen(true);
      fetchEligibleStudents(event._id || event.id);
    } else {
      setConfirmRegEvent(event);
      setIsConfirmRegOpen(true);
    }
  };

  const handleConfirmRegister = async (eventId) => {
    setIsConfirmRegOpen(false);
    setConfirmRegEvent(null);
    await handleRegister(eventId);
  };

  // Cancellation Confirmation Modal States
  const [confirmCancelEvent, setConfirmCancelEvent] = useState(null);
  const [isConfirmCancelOpen, setIsConfirmCancelOpen] = useState(false);

  const openConfirmCancel = (event) => {
    setConfirmCancelEvent(event);
    setIsConfirmCancelOpen(true);
  };

  const handleCancelRegister = async (eventId) => {
    setFeedback(null);
    try {
      await axios.delete(`/api/registrations/event/${eventId}`);
      setFeedback({ type: 'success', message: 'Successfully cancelled registration for the event.' });
      await Promise.all([fetchEvents(), fetchMyRegistrations()]);
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to cancel registration.' });
    } finally {
      setIsConfirmCancelOpen(false);
      setConfirmCancelEvent(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const categories = ['All', 'Technical', 'Cultural', 'Sports', 'Workshop', 'Seminar'];

  const categoryIcons = {
    All: null,
    Technical: null,
    Cultural: null,
    Sports: null,
    Workshop: null,
    Seminar: null
  };

  const fetchEvents = async () => {
    try {
      // Only show loading skeleton on initial load, not during re-fetches
      if (events.length === 0) setLoading(true);
      setError(null);
      
      const queryParams = [];
      if (search) queryParams.push(`search=${encodeURIComponent(search)}`);
      if (category && category !== 'All') queryParams.push(`category=${category}`);
      if (status) queryParams.push(`status=${status}`);
      
      const url = `/api/events${queryParams.length > 0 ? '?' + queryParams.join('&') : ''}`;
      const res = await axios.get(url);
      setEvents(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch events. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyRegistrations = async () => {
    if (!user || !user.roles?.includes('student')) return;
    try {
      const res = await axios.get('/api/registrations/my-registrations');
      setMyRegistrations(res.data);
    } catch (err) {
      console.error('Error fetching student registrations:', err);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [search, category, status]);

  useEffect(() => {
    fetchMyRegistrations();
  }, [user]);

  const handleRegister = async (eventId) => {
    setRegisteringIds(prev => ({ ...prev, [eventId]: true }));
    setFeedback(null);
    try {
      await axios.post('/api/registrations', { eventId });
      setFeedback({ type: 'success', message: 'Successfully registered for the event! Check My Registrations page.' });
      
      // Refresh events list to update count, and user registration list
      // Await both to ensure state is updated before re-render
      await Promise.all([fetchEvents(), fetchMyRegistrations()]);
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to register.' });
    } finally {
      setRegisteringIds(prev => ({ ...prev, [eventId]: false }));
      // Auto clear feedback after 4 seconds
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleTeamRegister = async (e) => {
    e.preventDefault();
    const eventId = teamRegEvent._id || teamRegEvent.id;
    setRegisteringIds(prev => ({ ...prev, [eventId]: true }));
    setFeedback(null);
    try {
      const memberIds = selectedTeamMembers.map(m => m.id);
      await axios.post('/api/registrations/team', {
        eventId,
        teamName,
        memberIds
      });
      setFeedback({ type: 'success', message: 'Successfully registered team for the event!' });
      setIsTeamRegOpen(false);
      setTeamRegEvent(null);
      await Promise.all([fetchEvents(), fetchMyRegistrations()]);
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to register team.' });
    } finally {
      setRegisteringIds(prev => ({ ...prev, [eventId]: false }));
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const isUserRegistered = (eventId) => {
    return myRegistrations.some(reg => {
      // Check the raw Supabase column (event_id) first, then the joined alias (eventId)
      const rawId = reg.event_id;
      const joinedId = reg.eventId && typeof reg.eventId === 'object' ? reg.eventId._id || reg.eventId.id : reg.eventId;
      return String(rawId) === String(eventId) || String(joinedId) === String(eventId);
    });
  };

  const isUserOrganizer = (evt) => {
    if (!user) return false;
    const userId = user.id || user._id;
    if (!userId) return false;

    if (evt.organizerIds && Array.isArray(evt.organizerIds)) {
      if (evt.organizerIds.some(id => String(id) === String(userId))) {
        return true;
      }
    }

    if (evt.proposed_by && String(evt.proposed_by) === String(userId)) return true;
    if (evt.student_organizer_id && String(evt.student_organizer_id) === String(userId)) return true;
    if (evt.organizer_id && String(evt.organizer_id) === String(userId)) return true;

    return false;
  };

  return (
    <div className="flex-grow pb-16">
      {/* ════════════ SCRAPBOOK HERO SECTION ════════════ */}
      <div className="relative overflow-hidden py-24 sm:py-32 bg-background">
        <div className="absolute top-10 left-10 w-64 h-64 bg-pastel-lavender/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float-slow"></div>
        <div className="absolute top-0 right-20 w-72 h-72 bg-pastel-coral/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float"></div>
        <div className="absolute -bottom-8 left-40 w-72 h-72 bg-pastel-yellow/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float-slow" style={{ animationDelay: '2s' }}></div>

        {/* Floating Scrapbook Elements */}
        <div className="absolute top-20 left-[10%] animate-wobble hidden lg:block">
          <div className="polaroid w-32 rotate-[-10deg]">
            <div className="w-full h-24 bg-pastel-lavender/20 rounded-md flex items-center justify-center border border-pastel-lavender/30">
              <StarDoodle className="w-10 h-10 text-pastel-lavender" />
            </div>
            <p className="text-[10px] font-quicksand font-bold text-center mt-2 text-pastel-lavender">Best memories loading...</p>
          </div>
        </div>

        <div className="absolute top-32 right-[10%] animate-float hidden lg:block">
          <div className="bg-pastel-yellow w-40 p-4 shadow-md rotate-[5deg] font-quicksand font-bold text-yellow-800 text-sm relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 tape tape-1 !bg-white/40"></div>
            Good vibes only! See you there.
          </div>
        </div>

        <div className="absolute bottom-10 left-[20%] animate-bounce-gentle hidden lg:block">
          <SparkleDoodle className="w-16 h-16 text-pastel-coral opacity-60" />
        </div>

        <div className="absolute bottom-20 right-[25%] animate-float-slow hidden lg:block">
          <div className="bg-pastel-mint/80 w-36 p-3 shadow-sm -rotate-[8deg] font-quicksand font-bold text-green-800 text-xs rounded-br-xl relative">
            <PinDoodle className="absolute -top-4 left-2 w-6 h-6 text-pastel-coral" />
            Campus lore unlocked ✨
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          {/* Animated badge */}
          <div className="animate-fade-in-up flex justify-center mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold bg-white text-pastel-lavender border-2 border-pastel-lavender/30 tracking-wider uppercase shadow-sm">
              <span className="h-2 w-2 rounded-full bg-pastel-coral animate-pulse" />
              Find your vibe
            </span>
          </div>

          {/* Main headline */}
            <h1 className="animate-fade-in-up delay-100 font-heading text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-text-primary mb-6 leading-[1.1]">
              <span className="marker-highlight">Collect moments.</span><br className="hidden sm:block" />
              Meet your people.
            </h1>

          <p className="animate-fade-in-up delay-200 text-lg sm:text-xl font-body text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
            Your semester deserves better stories. Discover hackathons, cultural fests, and workshops — all in a single click. <span className="font-bold text-pastel-coral">Avento it.</span>
          </p>

          <div className="flex justify-center mb-8 animate-fade-in-up delay-300">
             <SquiggleDoodle className="w-24 h-6 text-pastel-lavender" />
          </div>

          {/* Scroll indicator */}
          <div className="animate-fade-in-up delay-500 flex justify-center">
            <div className="animate-bounce-gentle bg-white p-2 rounded-full border-2 border-pastel-lavender/20 shadow-sm text-pastel-lavender">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════ MAIN CONTENT ════════════ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        
        {/* Toast Notification */}
        {feedback && (
          <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-2xl shadow-2xl border backdrop-blur-xl flex items-center gap-3 animate-toast-enter ${
            feedback.type === 'success' 
              ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/30 shadow-emerald-500/10' 
              : 'bg-red-950/90 text-red-300 border-red-500/30 shadow-red-500/10'
          }`}>
            <span className="text-lg">{feedback.type === 'success' ? '✓' : '⚠'}</span>
            <span className="text-sm font-semibold">{feedback.message}</span>
          </div>
        )}

        {/* ── Filter Controls ── */}
        <div className="animate-fade-in-up delay-300 polaroid p-5 sm:p-6 mb-10 flex flex-col lg:flex-row items-center justify-between gap-5 relative z-20 mx-auto max-w-5xl -mt-8 rotate-1">
          <div className="absolute -top-3 left-10 tape tape-2 !w-24"></div>
          
          {/* Search Input */}
          <div className="relative w-full lg:w-80 group">
            <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-text-secondary group-focus-within:text-pastel-lavender transition-colors duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white text-text-primary placeholder-text-secondary border-2 border-gray-200 rounded-2xl py-3 pl-12 pr-4 text-sm font-quicksand font-bold focus:outline-none focus:border-pastel-lavender focus:ring-4 focus:ring-pastel-lavender/20 transition-all duration-300"
            />
          </div>

          {/* Category Chips */}
          <div className="flex flex-wrap gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat === 'All' ? '' : cat)}
                className={`text-xs font-bold px-5 py-2.5 rounded-2xl transition-all duration-300 border-2 whitespace-nowrap font-quicksand ${
                  (cat === 'All' && !category) || (cat === category)
                    ? 'bg-pastel-lavender/20 text-pastel-lavender border-pastel-lavender shadow-sm scale-105'
                    : 'bg-white text-text-secondary border-gray-200 hover:text-text-primary hover:border-pastel-lavender/50 hover:bg-pastel-lavender/5 hover:-translate-y-1'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em] font-quicksand">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-white text-text-primary border-2 border-gray-200 rounded-2xl px-4 py-2.5 text-xs font-bold font-quicksand focus:outline-none focus:border-pastel-lavender focus:ring-4 focus:ring-pastel-lavender/20 transition-all duration-300 cursor-pointer"
            >
              <option value="published">Open for Reg</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
              <option value="">All Events</option>
            </select>
          </div>
        </div>

        {/* ── Events Grid ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="polaroid h-[420px] animate-pulse overflow-hidden">
                <div className="h-48 bg-gray-200 rounded-xl mb-4" />
                <div className="space-y-3 px-2">
                  <div className="h-3 w-24 bg-pastel-coral/50 rounded-full" />
                  <div className="h-6 w-3/4 bg-gray-200 rounded-full" />
                  <div className="h-3 w-full bg-gray-100 rounded-full" />
                  <div className="h-3 w-2/3 bg-gray-100 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-20 animate-fade-in-up polaroid max-w-md mx-auto -rotate-2">
            <div className="h-16 w-16 bg-pastel-coral/20 rounded-2xl flex items-center justify-center mx-auto text-pastel-coral mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-pastel-coral font-bold mb-3 text-lg font-heading">{error}</p>
            <button onClick={fetchEvents} className="btn-primary px-6 py-2.5 text-sm font-bold rounded-2xl">Retry</button>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-24 polaroid max-w-lg mx-auto animate-fade-in-scale rotate-1 relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 tape tape-1 !w-32"></div>
            <div className="h-20 w-20 bg-pastel-yellow/20 rounded-3xl flex items-center justify-center mx-auto text-yellow-600 mb-5">
              <SparkleDoodle className="h-10 w-10 text-pastel-yellow" />
            </div>
            <h3 className="text-2xl font-bold text-text-primary mb-2 font-heading">No Events Found</h3>
            <p className="text-sm text-text-secondary max-w-sm mx-auto font-body">There are no events matching your search or filters at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {events.map((evt, index) => (
              <EventCard
                key={evt._id || evt.id}
                event={evt}
                index={index}
                isRegistered={isUserRegistered(evt._id || evt.id)}
                isOrganizer={isUserOrganizer(evt)}
                joinTeamEnabled={!!evt.join_team_enabled}
                requestStatus={getUserJoinRequestStatus(evt)}
                onRegister={() => openConfirmReg(evt)}
                onJoinTeam={() => openJoinModal(evt)}
                isSubmitting={registeringIds[evt._id || evt.id]}
                onViewOrganizers={() => handleViewOrganizers(evt)}
                onCancelRegister={() => openConfirmCancel(evt)}
              />
            ))}
          </div>
        )}

        {/* View Organizers Modal */}
        <Modal
          isOpen={isOrgModalOpen}
          onClose={() => setIsOrgModalOpen(false)}
          title={`Organizing Team - ${orgModalEvent?.title || ''}`}
        >
          {loadingOrganizers ? (
            <div className="flex justify-center py-10 animate-pulse text-xs font-semibold text-slate-600">
              Loading team members...
            </div>
          ) : eventOrganizers.length === 0 ? (
            <div className="text-center py-10 text-slate-600 italic text-xs">
              No organizers have joined this team yet.
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {eventOrganizers.map(org => (
                <div key={org.id} className="p-3 bg-white/40 border border-slate-200/20 rounded-xl">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">{org.name}</h4>
                      <p className="text-[10px] text-slate-600 font-medium mt-0.5">{org.department} &bull; {org.email}</p>
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/15">
                      {org.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>

        {/* Registration Confirmation Modal */}
        <Modal
          isOpen={isConfirmRegOpen}
          onClose={() => {
            setIsConfirmRegOpen(false);
            setConfirmRegEvent(null);
          }}
          title="Confirm Registration"
        >
          {confirmRegEvent && (
            <div className="space-y-5">
              {/* Event Image */}
              <div className="h-44 w-full rounded-xl overflow-hidden bg-white/10 relative">
                <img
                  src={confirmRegEvent.imageUrl || confirmRegEvent.image_url}
                  alt={confirmRegEvent.title}
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-3 left-3 text-[9px] font-bold px-2 py-0.5 rounded bg-violet-500 text-white uppercase tracking-wider">
                  {confirmRegEvent.category}
                </span>
              </div>

              {/* Event Details */}
              <div>
                <h3 className="text-lg font-display font-black text-slate-800">{confirmRegEvent.title}</h3>
                <p className="text-xs text-slate-600 font-body mt-2 leading-relaxed line-clamp-3">
                  {confirmRegEvent.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 border-y border-slate-200/20 py-3.5 text-xs">
                <div>
                  <span className="block text-[9px] font-bold text-slate-600 uppercase tracking-wider">Date</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(confirmRegEvent.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-slate-600 uppercase tracking-wider">Time</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(confirmRegEvent.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-slate-600 uppercase tracking-wider">Venue</span>
                  <span className="font-semibold text-slate-800">{confirmRegEvent.venue}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-slate-600 uppercase tracking-wider">Organizer/Proposer Name</span>
                  <span className="font-semibold text-slate-800">{confirmRegEvent.proposerName}</span>
                </div>
              </div>

              {/* Student Details */}
              <div className="bg-slate-500/5 border border-slate-200/10 p-3 rounded-xl text-xs space-y-1">
                <span className="block text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-1">Registrant Details</span>
                <div>
                  <span className="text-slate-600 font-medium">Student Name:</span>{' '}
                  <span className="font-semibold text-slate-800">{user?.fullName || user?.name || ''}</span>
                </div>
                <div>
                  <span className="text-slate-600 font-medium">Student Email:</span>{' '}
                  <span className="font-semibold text-slate-800">{user?.email || ''}</span>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsConfirmRegOpen(false);
                    setConfirmRegEvent(null);
                  }}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmRegister(confirmRegEvent._id || confirmRegEvent.id)}
                  className="btn-primary px-6 py-2.5 text-xs font-display font-bold rounded-xl text-white shadow-lg shadow-violet-500/15"
                >
                  Register Now
                </button>
              </div>
            </div>
          )}
        </Modal>

        {/* Team Registration Modal */}
        <Modal
          isOpen={isTeamRegOpen}
          onClose={() => {
            setIsTeamRegOpen(false);
            setTeamRegEvent(null);
          }}
          title="Team Registration"
        >
          {teamRegEvent && (
            <form onSubmit={handleTeamRegister} className="space-y-5">
              {/* Event Image */}
              <div className="h-32 w-full rounded-xl overflow-hidden bg-white/10 relative">
                <img
                  src={teamRegEvent.imageUrl || teamRegEvent.image_url}
                  alt={teamRegEvent.title}
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-3 left-3 text-[9px] font-bold px-2 py-0.5 rounded bg-fuchsia-500 text-white uppercase tracking-wider">
                  {teamRegEvent.category}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-display font-black text-slate-800">{teamRegEvent.title}</h3>
                <p className="text-[10px] text-fuchsia-600 font-bold uppercase tracking-wider mt-1 border border-fuchsia-500/20 bg-fuchsia-500/10 px-2 py-0.5 rounded inline-block">
                  Maximum Members: {teamRegEvent.max_team_size} 
                </p>
                {!teamRegEvent.allow_cross_department && (
                  <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider mt-1 ml-2 border border-red-500/20 bg-red-500/10 px-2 py-0.5 rounded inline-block">
                    Same Department Only
                  </p>
                )}
              </div>

              <div className="border-t border-slate-200/20 pt-4 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Team Name *</label>
                  <input
                    type="text"
                    required
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Enter team name"
                    className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-fuchsia-500/60 transition-all duration-300"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Add Team Members</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedStudentToAdd}
                      onChange={(e) => setSelectedStudentToAdd(e.target.value)}
                      className="flex-grow bg-white/60 text-slate-700 border border-slate-300/50 rounded-xl px-3 py-2.5 text-sm font-body focus:outline-none focus:border-fuchsia-500/60 transition-all duration-300 cursor-pointer"
                    >
                      <option value="">-- Select Student --</option>
                      {studentsList
                        .filter(s => s.id !== user?.id && !selectedTeamMembers.some(m => m.id === s.id))
                        .map(std => (
                        <option key={std.id} value={std.id}>
                          {std.displayLabel || std.fullName} ({std.department || 'Unknown Dept'})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={selectedTeamMembers.length + (teamRegEvent.team_leader_registration_required !== false ? 1 : 0) >= teamRegEvent.max_team_size}
                      onClick={() => {
                        if (!selectedStudentToAdd) return;
                        if (selectedTeamMembers.length + (teamRegEvent.team_leader_registration_required !== false ? 1 : 0) >= teamRegEvent.max_team_size) return;
                        const student = studentsList.find(s => s.id === selectedStudentToAdd);
                        if (student) {
                          setSelectedTeamMembers([...selectedTeamMembers, student]);
                          setSelectedStudentToAdd('');
                        }
                      }}
                      className="px-4 py-2 text-xs font-bold rounded-xl btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>
                  {selectedTeamMembers.length + (teamRegEvent.team_leader_registration_required !== false ? 1 : 0) >= teamRegEvent.max_team_size && (
                    <p className="text-xs text-red-500 mt-2 font-semibold">Maximum team size reached.</p>
                  )}
                </div>

                {/* Selected Members */}
                <div>
                  <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">
                    Current Members ({selectedTeamMembers.length + (teamRegEvent.team_leader_registration_required !== false ? 1 : 0)})
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {teamRegEvent.team_leader_registration_required !== false && (
                      <div className="flex items-center justify-between p-2.5 bg-fuchsia-500/5 rounded-lg border border-fuchsia-500/10">
                        <div className="text-sm font-semibold text-slate-800">
                          {user?.fullName || user?.name} <span className="text-[10px] ml-1 text-fuchsia-500">(Leader)</span>
                        </div>
                      </div>
                    )}
                    {selectedTeamMembers.map(member => (
                      <div key={member.id} className="flex items-center justify-between p-2.5 bg-white/40 rounded-lg border border-slate-200/40">
                        <div className="text-sm font-semibold text-slate-800">
                          {member.fullName || member.name}
                          <div className="text-[10px] text-slate-500 font-medium">{member.department}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedTeamMembers(selectedTeamMembers.filter(m => m.id !== member.id))}
                          className="text-red-400 hover:text-red-600 text-xs font-bold px-2 py-1"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Modal Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-200/20">
                <button
                  type="button"
                  onClick={() => {
                    setIsTeamRegOpen(false);
                    setTeamRegEvent(null);
                  }}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registeringIds[teamRegEvent._id || teamRegEvent.id]}
                  className="btn-primary px-6 py-2.5 text-xs font-display font-bold rounded-xl text-white shadow-lg shadow-fuchsia-500/15 disabled:opacity-50"
                >
                  {registeringIds[teamRegEvent._id || teamRegEvent.id] ? 'Registering...' : 'Submit Team Registration'}
                </button>
              </div>
            </form>
          )}
        </Modal>

        {/* Cancellation Confirmation Modal */}
        <Modal
          isOpen={isConfirmCancelOpen}
          onClose={() => {
            setIsConfirmCancelOpen(false);
            setConfirmCancelEvent(null);
          }}
          title="Cancel Registration"
        >
          {confirmCancelEvent && (
            <div className="space-y-5">
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                Are you sure you want to cancel your registration for this event?
              </p>

              {/* Modal Buttons */}
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsConfirmCancelOpen(false);
                    setConfirmCancelEvent(null);
                  }}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl btn-secondary"
                >
                  Keep Registration
                </button>
                <button
                  type="button"
                  onClick={() => handleCancelRegister(confirmCancelEvent._id || confirmCancelEvent.id)}
                  className="px-6 py-2.5 text-xs font-display font-bold btn-danger"
                >
                  Yes, Cancel Registration
                </button>
              </div>
            </div>
          )}
        </Modal>

        {/* Join organizing team modal */}
        <Modal
          isOpen={isJoinModalOpen}
          onClose={() => {
            setIsJoinModalOpen(false);
            setJoinEvent(null);
          }}
          title={`Join Organizing Team - ${joinEvent?.title || ''}`}
        >
          {joinEvent && (
            <form onSubmit={handleJoinTeamSubmit} className="space-y-5">
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Submit a request to join the organizing team for this event. The event proposer will review your request.
              </p>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Select Category *</label>
                <select
                  required
                  value={selectedJoinCategory}
                  onChange={(e) => setSelectedJoinCategory(e.target.value)}
                  className="w-full bg-white/60 text-slate-700 border border-slate-300/50 rounded-xl px-3 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300 cursor-pointer text-slate-700"
                >
                  {[
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

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsJoinModalOpen(false);
                    setJoinEvent(null);
                  }}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary px-6 py-2.5 text-xs font-display font-bold rounded-xl text-white shadow-lg shadow-violet-500/15"
                >
                  Submit Request
                </button>
              </div>
            </form>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default Home;
