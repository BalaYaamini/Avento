import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import EventCard from '../components/EventCard';
import Modal from '../components/Modal';
import { 
  SparkleDoodle, 
  SquiggleDoodle, 
  StarDoodle,
  ArrowDoodle,
  PinDoodle,
  CloudDoodle,
  PaperPlaneDoodle,
  GeometricBlobDoodle
} from '../components/Doodles';
import RegistrationCountdown from '../components/RegistrationCountdown';
import ScoringBoard from '../components/ScoringBoard';

const Home = () => {
  const navigate = useNavigate();
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
  const [scoreEvent, setScoreEvent] = useState(null);
  const [orgModalEvent, setOrgModalEvent] = useState(null);
  const [eventOrganizers, setEventOrganizers] = useState([]);
  const [loadingOrganizers, setLoadingOrganizers] = useState(false);

  // Team Registration States
  const [isTeamRegOpen, setIsTeamRegOpen] = useState(false);
  const [teamRegEvent, setTeamRegEvent] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [nameUnavailable, setNameUnavailable] = useState(false);
  
  // External member invite state
  const [externalInviteName, setExternalInviteName] = useState('');
  const [externalInviteEmail, setExternalInviteEmail] = useState('');
  const [invitingExternal, setInvitingExternal] = useState(false);
  const [externalInvites, setExternalInvites] = useState([]);
  
  // Debounce team name checking
  useEffect(() => {
    if (!teamName || teamName.trim() === '') {
      setNameUnavailable(false);
      setIsCheckingName(false);
      return;
    }
    
    if (!teamRegEvent) return;

    const eventId = teamRegEvent._id || teamRegEvent.id;
    const checkName = async () => {
      setIsCheckingName(true);
      try {
        const res = await axios.get(`/api/registrations/event/${eventId}/check-team-name?name=${encodeURIComponent(teamName)}`);
        setNameUnavailable(!res.data.available);
      } catch (err) {
        console.error('Error checking team name:', err);
      } finally {
        setIsCheckingName(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      checkName();
    }, 500); // 500ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [teamName, teamRegEvent]);

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
    if (isUserOrganizer(event)) {
      alert('You are an organizer for this event and cannot register as a participant.');
      return;
    }
    const isDeadlinePassed = event.registration_deadline && new Date() > new Date(event.registration_deadline);
    if (isDeadlinePassed) {
      alert('Registration has closed. The registration deadline has passed.');
      return;
    }
    const isTeam = event.registration_type === 'team';
    const isFull = isTeam 
      ? (event.max_teams ? (event.registeredCount || 0) >= event.max_teams : false)
      : (event.capacity ? (event.registeredCount || 0) >= event.capacity : false);
    if (isFull) {
      alert(isTeam ? 'No more team slots are available. Registration is full.' : 'Event capacity has been reached.');
      return;
    }
    // Check if user already has a pending or registered status for this event
    const eventIdStr = String(event.id || event._id);
    const existingReg = myRegistrations.find(reg => {
      const rawId = String(reg.event_id);
      const joinedId = String(reg.eventId && typeof reg.eventId === 'object' ? (reg.eventId.id || reg.eventId._id) : reg.eventId);
      const matchesEvent = rawId === eventIdStr || joinedId === eventIdStr;
      
      const teamStatus = reg.teamDetails?.teamStatus || reg.teamId?.status;
      const isPendingOnConfirmedTeam = reg.status === 'pending' && teamStatus === 'registered';

      return matchesEvent && (
        reg.status === 'registered' || 
        (reg.status === 'pending' && !isPendingOnConfirmedTeam)
      );
    });

    if (existingReg) {
      if (existingReg.status === 'pending') {
        alert(`You have pending team invitations for ${event.title || event.name || 'this event'}. Please reject all other team invitations for this event before creating your own team.`);
      } else {
        alert('You are already registered for this event.');
      }
      return;
    }

    if (event.registration_type === 'team') {
      setTeamRegEvent(event);
      setTeamName('');
      setExternalInvites([]);
      setExternalInviteName('');
      setExternalInviteEmail('');
      setIsTeamRegOpen(true);
    } else {
      if (!user.phone || !user.college || !user.gender) {
        setFeedback({ type: 'error', message: 'Please complete your profile (phone, college, gender) before registering.' });
        setTimeout(() => setFeedback(null), 4000);
        return;
      }
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

  const [profileIncompleteModalData, setProfileIncompleteModalData] = useState(null);

  // Auto trigger registration if redirected back after completing profile
  useEffect(() => {
    if (events && events.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const autoRegisterId = params.get('autoRegisterEventId');
      if (autoRegisterId) {
        const targetEvent = events.find(e => String(e.id || e._id) === String(autoRegisterId));
        if (targetEvent) {
          if (targetEvent.registration_type === 'team') {
            setTeamRegEvent(targetEvent);
            setIsTeamRegOpen(true);
            fetchEligibleStudents(targetEvent.id || targetEvent._id);
          } else {
            handleRegister(targetEvent.id || targetEvent._id);
          }
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    }
  }, [events]);

  const handleRegister = async (eventId) => {
    setRegisteringIds(prev => ({ ...prev, [eventId]: true }));
    setFeedback(null);
    try {
      await axios.post('/api/registrations', { eventId });
      setFeedback({ type: 'success', message: 'Successfully registered for the event! Check My Registrations page.' });
      await Promise.all([fetchEvents(), fetchMyRegistrations()]);
    } catch (err) {
      if (err.response?.data?.profileIncomplete) {
        setProfileIncompleteModalData({
          eventId: eventId,
          message: err.response.data.message,
          missingFields: err.response.data.missingFields
        });
      } else {
        setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to register.' });
      }
    } finally {
      setRegisteringIds(prev => ({ ...prev, [eventId]: false }));
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleTeamRegister = async (e) => {
    e.preventDefault();
    const eventId = teamRegEvent._id || teamRegEvent.id;
    
    const leaderCount = teamRegEvent.team_leader_registration_required !== false ? 1 : 0;
    const totalMembers = externalInvites.length + leaderCount;
    const minSize = teamRegEvent.min_team_size || 1;
    const maxSize = teamRegEvent.max_team_size || 4;

    if (totalMembers < minSize) {
      setFeedback({ type: 'error', message: `Team must have at least ${minSize} members.` });
      setTimeout(() => setFeedback(null), 4000);
      return;
    }
    if (totalMembers > maxSize) {
      setFeedback({ type: 'error', message: `Team cannot exceed ${maxSize} members.` });
      setTimeout(() => setFeedback(null), 4000);
      return;
    }

    setRegisteringIds(prev => ({ ...prev, [eventId]: true }));
    setFeedback(null);
    try {
      const teamRes = await axios.post('/api/registrations/team', {
        eventId,
        teamName,
        memberIds: [],
        externalInvites
      });

      const teamId = teamRes.data?.team?.id;
      if (teamId && externalInvites.length > 0) {
        for (const inv of externalInvites) {
          await axios.post(`/api/registrations/team/${teamId}/invite-external`, {
            email: inv.email,
            name: inv.name
          }).catch(() => {});
        }
      }

      setFeedback({ type: 'success', message: 'Successfully registered team for the event! Invitations sent to members.' });
      setIsTeamRegOpen(false);
      setTeamRegEvent(null);
      setExternalInvites([]);
      await Promise.all([fetchEvents(), fetchMyRegistrations()]);
    } catch (err) {
      if (err.response?.data?.profileIncomplete) {
        setIsTeamRegOpen(false);
        setTeamRegEvent(null);
        setProfileIncompleteModalData({
          eventId: eventId,
          message: err.response.data.message,
          missingFields: err.response.data.missingFields,
          incompleteMembers: err.response.data.incompleteMembers
        });
      } else {
        setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to register team.' });
      }
    } finally {
      setRegisteringIds(prev => ({ ...prev, [eventId]: false }));
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const isUserRegistered = (eventId) => {
    if (!user) return false;
    return myRegistrations.some(reg => {
      // Must be individual status 'registered' to even be considered (except for leaders of pending teams, but those aren't fully registered either)
      if (reg.status !== 'registered') return false;
      
      const rawId = reg.event_id;
      const joinedId = reg.eventId && typeof reg.eventId === 'object' ? reg.eventId._id || reg.eventId.id : reg.eventId;
      const matchesEvent = String(rawId) === String(eventId) || String(joinedId) === String(eventId);
      
      if (!matchesEvent) return false;

      // If it's a team registration, the overall team must also be registered
      if (reg.team_id || reg.teamId) {
        const teamStatus = reg.teamDetails?.teamStatus || reg.teamId?.status || 'pending';
        return teamStatus === 'registered';
      }

      return true;
    });
  };

  const getPendingTeamStatus = (event) => {
    if (!user) return null;
    const eventId = event._id || event.id;
    
    const pendingReg = myRegistrations.find(reg => {
      if (reg.status === 'rejected' || reg.status === 'auto_rejected' || reg.status === 'cancelled') return false;

      const rawId = reg.event_id;
      const joinedId = reg.eventId && typeof reg.eventId === 'object' ? reg.eventId._id || reg.eventId.id : reg.eventId;
      const matchesEvent = String(rawId) === String(eventId) || String(joinedId) === String(eventId);
      
      if (!matchesEvent) return false;
      
      // Must be a team registration
      if (!reg.team_id && !reg.teamId) return false;

      const leaderId = reg.teamDetails?.leader_id || reg.teamId?.leader_id;
      const isLeader = String(leaderId) === String(user.id || user._id);
      
      // For members, their individual status must be 'registered' (meaning they accepted the invite)
      if (!isLeader && reg.status !== 'registered') return false;

      const teamStatus = reg.teamDetails?.teamStatus || reg.teamId?.status || 'pending';
      return teamStatus === 'pending';
    });

    if (!pendingReg) return null;

    const leaderId = pendingReg.teamDetails?.leader_id || pendingReg.teamId?.leader_id || pendingReg.user_id;
    const members = pendingReg.teamDetails?.members || [];
    const acceptedUserIds = new Set();
    if (leaderId) acceptedUserIds.add(String(leaderId));
    members.forEach(m => {
      if (m.status === 'registered') {
        acceptedUserIds.add(String(m.id || m.user_id));
      }
    });
    const acceptedCount = acceptedUserIds.size;
    const minRequired = event.min_team_size || 1;
    const isReady = acceptedCount >= minRequired;
    
    return isReady ? 'Ready for Team Confirmation' : 'Waiting for Member Approval';
  };



  const isUserOrganizer = (evt) => {
    if (!user) return false;
    const userId = user.id || user._id;
    if (!userId) return false;

    if (user.roles?.includes('admin') || user.role === 'admin') return true;

    if (evt.organizerIds && Array.isArray(evt.organizerIds)) {
      if (evt.organizerIds.some(id => String(id) === String(userId))) {
        return true;
      }
    }

    if (evt.proposed_by && String(evt.proposed_by) === String(userId)) return true;
    if (evt.student_organizer_id && String(evt.student_organizer_id) === String(userId)) return true;
    if (evt.organizer_id && String(evt.organizer_id) === String(userId)) return true;
    if (evt.faculty_id && String(evt.faculty_id) === String(userId)) return true;

    return false;
  };

  return (
    <div className="flex-grow pb-16">
      {/* ════════════ SCRAPBOOK HERO SECTION WITH ANIMATED UNIVERSITY BACKGROUND ════════════ */}
      <div className="relative overflow-hidden py-24 sm:py-32 bg-slate-900">
        {/* Animated University Image Background */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img 
            src="https://suh.edu.in/wp-content/uploads/2025/06/SU-2-scaled-1.webp" 
            alt="University Campus" 
            className="w-full h-full object-cover object-center animate-hero-bg-zoom opacity-60 scale-105"
          />
          {/* Gradient Overlay to ensure text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-900/60 to-slate-950/80 backdrop-blur-[1px]" />
        </div>

        <div className="absolute top-10 left-10 w-64 h-64 bg-pastel-lavender/20 rounded-full mix-blend-screen filter blur-3xl opacity-60 animate-float-slow"></div>
        <div className="absolute top-0 right-20 w-72 h-72 bg-pastel-coral/20 rounded-full mix-blend-screen filter blur-3xl opacity-60 animate-float"></div>
        <div className="absolute -bottom-8 left-40 w-72 h-72 bg-pastel-yellow/20 rounded-full mix-blend-screen filter blur-3xl opacity-60 animate-float-slow" style={{ animationDelay: '2s' }}></div>

        {/* Floating Scrapbook Elements */}
        <div className="absolute top-20 left-[10%] animate-wobble hidden lg:block z-10">
          <div className="polaroid w-32 rotate-[-10deg]">
            <div className="w-full h-24 bg-pastel-lavender/20 rounded-md flex items-center justify-center border border-pastel-lavender/30">
              <StarDoodle className="w-10 h-10 text-pastel-lavender" />
            </div>
            <p className="text-[10px] font-quicksand font-bold text-center mt-2 text-pastel-lavender">Best memories loading...</p>
          </div>
        </div>

        <CloudDoodle className="absolute top-24 left-[30%] w-24 h-12 text-pastel-blue opacity-50 animate-float-slow hidden md:block z-10" />

        <div className="absolute top-32 right-[10%] animate-float hidden lg:block z-10">
          <div className="bg-pastel-yellow w-40 p-4 shadow-md rotate-[5deg] font-quicksand font-bold text-yellow-800 text-sm relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 tape tape-1 !bg-white/40"></div>
            Good vibes only! See you there.
          </div>
        </div>

        <PaperPlaneDoodle className="absolute top-40 right-[28%] w-16 h-16 text-pastel-coral opacity-60 animate-wobble hidden md:block -rotate-12 z-10" />

        <div className="absolute bottom-10 left-[20%] animate-bounce-gentle hidden lg:block z-10">
          <SparkleDoodle className="w-16 h-16 text-pastel-coral opacity-60" />
        </div>

        <div className="absolute bottom-20 right-[25%] animate-float-slow hidden lg:block z-10">
          <div className="bg-pastel-mint/80 w-36 p-3 shadow-sm -rotate-[8deg] font-quicksand font-bold text-green-800 text-xs rounded-br-xl relative">
            <PinDoodle className="absolute -top-4 left-2 w-6 h-6 text-pastel-coral" />
            Campus lore unlocked ✨
          </div>
        </div>
        
        <GeometricBlobDoodle className="absolute -top-10 -left-10 w-96 h-96 text-pastel-lavender opacity-30 z-0 hidden md:block animate-spin-slow" />
        <GeometricBlobDoodle className="absolute top-20 -right-20 w-[500px] h-[500px] text-pastel-mint opacity-30 z-0 hidden md:block animate-float-slow" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          {/* Animated badge */}
          <div className="animate-fade-in-up flex justify-center mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold bg-white/90 backdrop-blur-md text-pastel-lavender border-2 border-pastel-lavender/30 tracking-wider uppercase shadow-md">
              <span className="h-2 w-2 rounded-full bg-pastel-coral animate-pulse" />
              Find your vibe
            </span>
          </div>

          {/* Main headline */}
            <h1 className="animate-fade-in-up delay-100 font-heading text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white mb-6 leading-[1.1] drop-shadow-md">
              <span className="marker-highlight">Collect moments.</span><br className="hidden sm:block" />
              Meet your people.
            </h1>

          <p className="animate-fade-in-up delay-200 text-lg sm:text-xl font-body text-slate-200 max-w-2xl mx-auto mb-10 leading-relaxed font-medium drop-shadow-sm">
            Your semester deserves better stories. Discover hackathons, cultural fests, and workshops — all in a single click. <span className="font-bold text-pastel-coral">Avento it.</span>
          </p>

          <div className="flex justify-center mb-8 animate-fade-in-up delay-300">
             <SquiggleDoodle className="w-24 h-6 text-pastel-lavender" />
          </div>

          {/* Scroll indicator */}
          <div className="animate-fade-in-up delay-500 flex justify-center">
            <div className="animate-bounce-gentle bg-white/90 backdrop-blur-md p-2 rounded-full border-2 border-pastel-lavender/30 shadow-md text-pastel-lavender">
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
        <div className="animate-fade-in-up delay-300 polaroid p-4 sm:p-6 mb-10 flex flex-col lg:flex-row items-center justify-between gap-5 relative z-20 mx-auto max-w-5xl -mt-8 rotate-1">
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
          <div className="grid w-full grid-cols-1 gap-8">
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
          <div className="grid w-full grid-cols-1 gap-8">
            {events.map((evt, index) => (
              <EventCard
                key={evt._id || evt.id}
                event={evt}
                index={index}
                isRegistered={isUserRegistered(evt._id || evt.id)}
                isPendingRegistration={getPendingTeamStatus(evt)}
                isOrganizer={isUserOrganizer(evt)}
                joinTeamEnabled={!!evt.join_team_enabled}
                requestStatus={getUserJoinRequestStatus(evt)}
                onRegister={() => openConfirmReg(evt)}
                onJoinTeam={() => openJoinModal(evt)}
                isSubmitting={registeringIds[evt._id || evt.id]}
                onViewOrganizers={() => handleViewOrganizers(evt)}
                onViewScores={() => setScoreEvent(evt)}
                onCancelRegister={() => openConfirmCancel(evt)}
              />
            ))}
          </div>
        )}

        <Modal isOpen={!!scoreEvent} onClose={() => setScoreEvent(null)} title={`Scoreboard - ${scoreEvent?.title || ''}`}>
          {scoreEvent && <ScoringBoard eventId={scoreEvent.id || scoreEvent._id} canEdit={false} />}
        </Modal>

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
          title="Create Team"
          subtitle="Form your team and invite members"
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
                {teamRegEvent.registration_deadline && (
                  <div className="mt-2 mb-3">
                    <RegistrationCountdown 
                      deadline={teamRegEvent.registration_deadline} 
                      onDeadlinePassed={() => setTeamRegEvent(null) || setIsTeamRegOpen(false) || fetchEvents()} 
                    />
                  </div>
                )}
                <div className="flex gap-2 mt-1">
                  <p className="text-[10px] text-teal-600 font-bold uppercase tracking-wider border border-teal-500/20 bg-teal-500/10 px-2 py-0.5 rounded inline-block">
                    Minimum Members: {teamRegEvent.min_team_size || 1}
                  </p>
                  <p className="text-[10px] text-fuchsia-600 font-bold uppercase tracking-wider border border-fuchsia-500/20 bg-fuchsia-500/10 px-2 py-0.5 rounded inline-block">
                    Maximum Members: {teamRegEvent.max_team_size} 
                  </p>
                </div>
                {!teamRegEvent.allow_cross_department && (
                  <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider mt-1 ml-2 border border-red-500/20 bg-red-500/10 px-2 py-0.5 rounded inline-block">
                    Same Department Only
                  </p>
                )}
              </div>

              <div className="border-t border-slate-200/20 pt-4 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Team Name *</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="Enter team name"
                      className={`w-full bg-white/60 text-slate-800 border rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none transition-all duration-300 ${
                        nameUnavailable
                          ? 'border-red-500/80 focus:border-red-500/80' 
                          : 'border-slate-300/50 focus:border-fuchsia-500/60'
                      }`}
                    />
                    {isCheckingName && (
                      <div className="absolute right-3 top-3">
                        <svg className="animate-spin h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                    )}
                  </div>
                  {nameUnavailable && (
                    <p className="mt-1.5 text-xs font-bold text-red-500">
                      This team name already exists. Please choose a different name.
                    </p>
                  )}
                </div>

                {/* Invite Team Members by Email */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">
                    Invite Team Members by Email
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={externalInviteName}
                      onChange={(e) => setExternalInviteName(e.target.value)}
                      className="flex-1 bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-3 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300"
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={externalInviteEmail}
                      onChange={(e) => setExternalInviteEmail(e.target.value)}
                      className="flex-1 bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-3 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300"
                    />
                    <button
                      type="button"
                      disabled={!externalInviteName.trim() || !externalInviteEmail.trim() || invitingExternal}
                      onClick={() => {
                        if (!externalInviteName.trim() || !externalInviteEmail.trim()) return;
                        const leaderCount = teamRegEvent.team_leader_registration_required !== false ? 1 : 0;
                        if (externalInvites.length + leaderCount >= teamRegEvent.max_team_size) {
                          setFeedback({ type: 'error', message: 'Cannot add more members. Maximum team size reached.' });
                          setTimeout(() => setFeedback(null), 4000);
                          return;
                        }
                        setExternalInvites([...externalInvites, { name: externalInviteName.trim(), email: externalInviteEmail.trim() }]);
                        setExternalInviteName('');
                        setExternalInviteEmail('');
                      }}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm disabled:opacity-50"
                    >
                      + Add
                    </button>
                  </div>
                </div>

                {/* Selected Members & Invites */}
                <div>
                  <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">
                    Current Members ({externalInvites.length + (teamRegEvent.team_leader_registration_required !== false ? 1 : 0)})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {teamRegEvent.team_leader_registration_required !== false && (
                      <div className="flex items-center justify-between p-2.5 bg-fuchsia-500/5 rounded-lg border border-fuchsia-500/10">
                        <div className="text-sm font-semibold text-slate-800">
                          {user?.fullName || user?.name} <span className="text-[10px] ml-1 text-fuchsia-500 font-bold uppercase">(Leader)</span>
                        </div>
                      </div>
                    )}
                    {externalInvites.map((inv, i) => (
                      <div key={`ext-${i}`} className="flex items-center justify-between p-2.5 bg-emerald-50/50 rounded-lg border border-emerald-200/50">
                        <div className="text-sm font-semibold text-slate-800">
                          {inv.name}
                          <span className="text-[10px] ml-1 text-slate-500">({inv.email})</span>
                          <span className="text-[10px] ml-1 text-emerald-600 font-bold uppercase">— email invite</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setExternalInvites(externalInvites.filter((_, idx) => idx !== i))}
                          className="text-red-400 hover:text-red-600 text-xs font-bold px-2 py-1"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                    <p className="text-xs text-indigo-700 font-medium">
                      <strong className="font-bold">Note:</strong> Upon creating the team, invited members will receive an email to join. They must sign up on Avento and accept the invitation. Once the minimum required members accept, you can confirm the team.
                    </p>
                  </div>
                </div>
              </div>

              {externalInvites.length + (teamRegEvent.team_leader_registration_required !== false ? 1 : 0) < teamRegEvent.min_team_size && (
                <div className="mb-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                  <p className="text-xs text-red-600 font-semibold text-center">
                    Please invite at least {teamRegEvent.min_team_size} members to create the team.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsTeamRegOpen(false);
                    setTeamRegEvent(null);
                    setExternalInvites([]);
                  }}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registeringIds[teamRegEvent._id || teamRegEvent.id] || (externalInvites.length + (teamRegEvent.team_leader_registration_required !== false ? 1 : 0) < teamRegEvent.min_team_size) || isCheckingName || nameUnavailable}
                  className="btn-primary px-6 py-2.5 text-xs font-display font-bold rounded-xl text-white shadow-lg shadow-fuchsia-500/15 disabled:opacity-50"
                >
                  {registeringIds[teamRegEvent._id || teamRegEvent.id] ? 'Creating Team...' : 'Create Team & Send Invites'}
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

        {/* Profile Incomplete Warning Modal */}
        {profileIncompleteModalData && (
          <Modal
            isOpen={!!profileIncompleteModalData}
            onClose={() => setProfileIncompleteModalData(null)}
            title="Profile Incomplete"
          >
            <div className="p-4 space-y-5 text-center">
              <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto text-3xl border border-amber-500/20">
                ⚠️
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Complete Profile Required
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                  {profileIncompleteModalData.message || 'You must complete all required profile fields (Photo, Phone Number, College, Department, Degree, Year of Study, Roll Number) before registering for events.'}
                </p>
              </div>

              {profileIncompleteModalData.missingFields && profileIncompleteModalData.missingFields.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-3.5 text-left space-y-1.5 text-xs">
                  <span className="font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider text-[10px] block">
                    Missing Required Fields:
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {profileIncompleteModalData.missingFields.map((field, idx) => (
                      <span key={idx} className="px-2.5 py-1 bg-amber-200/60 dark:bg-amber-900/60 text-amber-950 dark:text-amber-200 font-bold rounded-lg text-[11px]">
                        • {field}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setProfileIncompleteModalData(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl btn-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (profileIncompleteModalData?.eventId) {
                      sessionStorage.setItem('pendingEventId', profileIncompleteModalData.eventId);
                    }
                    setProfileIncompleteModalData(null);
                    if (typeof navigate === 'function') {
                      navigate('/profile');
                    } else {
                      window.location.href = '/profile';
                    }
                  }}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Complete Profile Now</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
};

export default Home;
