import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Modal from '../components/Modal';
import FeedbackModal from '../components/FeedbackModal';
import { QRCodeSVG } from 'qrcode.react';
import { supabase, useAuth } from '../context/AuthContext';
import RegistrationCountdown from '../components/RegistrationCountdown';
import PaymentSection, { isValidUtr } from '../components/PaymentSection';

const StudentRegistrations = () => {
  const { user } = useAuth();
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [isConfirmCancelOpen, setIsConfirmCancelOpen] = useState(false);
  const [confirmCancelReg, setConfirmCancelReg] = useState(null);
  const [isConfirmRejectOpen, setIsConfirmRejectOpen] = useState(false);
  const [confirmRejectReg, setConfirmRejectReg] = useState(null);
  const [isConfirmLeaveOpen, setIsConfirmLeaveOpen] = useState(false);
  const [confirmLeaveReg, setConfirmLeaveReg] = useState(null);
  const [teamModalData, setTeamModalData] = useState(null);
  const [qrModalData, setQrModalData] = useState(null);
  const [isConfirmTeamOpen, setIsConfirmTeamOpen] = useState(false);
  const [confirmTeamReg, setConfirmTeamReg] = useState(null);
  
  // Edit Team state
  const [editTeamData, setEditTeamData] = useState(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [isEditTeamOpen, setIsEditTeamOpen] = useState(false);
  const [teamEditFeedback, setTeamEditFeedback] = useState(null);
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [nameUnavailable, setNameUnavailable] = useState(false);
  
  // External invite state for Edit Team
  const [editInviteName, setEditInviteName] = useState('');
  const [editInviteEmail, setEditInviteEmail] = useState('');
  const [editInvitingExternal, setEditInvitingExternal] = useState(false);
  const [editExternalInvites, setEditExternalInvites] = useState([]);
  
  // Leader Contact Number for Team Confirmation
  const [leaderContactNumber, setLeaderContactNumber] = useState('');
  const [contactNumberError, setContactNumberError] = useState('');
  const [teamUtr, setTeamUtr] = useState('');
  
  // Debounce team name checking for Edit Team
  useEffect(() => {
    if (!editTeamName || editTeamName.trim() === '' || !editTeamData) {
      setNameUnavailable(false);
      setIsCheckingName(false);
      return;
    }
    
    const eventId = editTeamData.eventId?.id || editTeamData.eventId?._id;
    const teamId = editTeamData.teamId?.id;

    const checkName = async () => {
      setIsCheckingName(true);
      try {
        const res = await axios.get(`/api/registrations/event/${eventId}/check-team-name?name=${encodeURIComponent(editTeamName)}&excludeTeamId=${teamId}`);
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
  }, [editTeamName, editTeamData]);

  // Sync editTeamData with registrations so modal updates immediately
  useEffect(() => {
    if (isEditTeamOpen && editTeamData) {
      const updatedReg = registrations.find(r => r.id === editTeamData.id);
      if (updatedReg && JSON.stringify(updatedReg) !== JSON.stringify(editTeamData)) {
        setEditTeamData(updatedReg);
      }
    }
  }, [registrations, isEditTeamOpen]);

  // Feedback & Allocation states
  const [feedbackStatuses, setFeedbackStatuses] = useState({});
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackEvent, setFeedbackEvent] = useState(null);
  const [teamAllocations, setTeamAllocations] = useState({});

  // Problem statement selection states
  const [selectedPsToConfirm, setSelectedPsToConfirm] = useState(null);
  const [isSubmittingPs, setIsSubmittingPs] = useState(false);
  const [psError, setPsError] = useState(null);

  const handleConfirmPsSelection = async () => {
    if (!selectedPsToConfirm) return;
    const { eventId, ps } = selectedPsToConfirm;

    setIsSubmittingPs(true);
    setPsError(null);
    try {
      await axios.post(`/api/allocations/event/${eventId}/select-problem-statement`, {
        problemStatementId: ps.id
      });
      setSelectedPsToConfirm(null);
      fetchRegistrations();
    } catch (err) {
      console.error('Select problem statement error:', err);
      setPsError(err.response?.data?.message || 'Failed to select problem statement.');
    } finally {
      setIsSubmittingPs(false);
    }
  };

  // Organizer Requests state
  const [activeSubTab, setActiveSubTab] = useState('registrations');
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [withdrawRequestObj, setWithdrawRequestObj] = useState(null);
  const [withdrawingId, setWithdrawingId] = useState(null);

  const fetchAllocationsForRegistrations = async (regs) => {
    if (!regs || regs.length === 0) return;
    const activeRegs = regs.filter(r => r.status === 'registered');
    const allocMap = {};

    await Promise.all(
      activeRegs.map(async (r) => {
        const eventId = r.event_id || r.eventId?.id || r.eventId?._id;
        if (eventId && !allocMap[eventId]) {
          try {
            const res = await axios.get(`/api/allocations/event/${eventId}/my-allocation`);
            if (res.data) {
              allocMap[eventId] = res.data;
            }
          } catch (err) {
            // Silence allocation fetch error
          }
        }
      })
    );

    setTeamAllocations(allocMap);
  };

  const fetchRegistrations = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get('/api/registrations/my-registrations');
      setRegistrations(res.data);
      fetchAllocationsForRegistrations(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch registrations. Please reload.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      setLoadingRequests(true);
      const res = await axios.get('/api/events/organizer-requests/my-requests');
      setRequests(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const fetchFeedbackStatuses = async () => {
    try {
      const res = await axios.get('/api/feedbacks/my-statuses');
      setFeedbackStatuses(res.data);
    } catch (err) {
      console.error('Failed to fetch feedback statuses', err);
    }
  };

  useEffect(() => {
    fetchRegistrations();
    fetchFeedbackStatuses();

    // Set up realtime subscription for team membership & problem statement slot changes
    const regSubscription = supabase
      .channel('public:event_registrations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_registrations' },
        () => {
          fetchRegistrations();
        }
      )
      .subscribe();

    const psSubscription = supabase
      .channel('public:event_problem_statements')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_problem_statements' },
        () => {
          fetchRegistrations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(regSubscription);
      supabase.removeChannel(psSubscription);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'invitations') {
      setActiveSubTab('invitations');
    }
  }, []);

  useEffect(() => {
    if (registrations && registrations.length > 0) {
      const pendingRegId = sessionStorage.getItem('pendingAcceptRegId');
      if (pendingRegId) {
        const targetReg = registrations.find(r => String(r.id) === String(pendingRegId));
        if (targetReg && targetReg.status === 'pending') {
          sessionStorage.removeItem('pendingAcceptRegId');
          handleAcceptInvitation(pendingRegId);
        } else if (targetReg && targetReg.status === 'registered') {
          sessionStorage.removeItem('pendingAcceptRegId');
        }
      }
    }
  }, [registrations]);

  useEffect(() => {
    if (activeSubTab === 'requests') {
      fetchRequests();
    }
  }, [activeSubTab]);

  useEffect(() => {
    if (isEditTeamOpen && editTeamData) {
      const updatedReg = registrations.find(r => r.id === editTeamData.id);
      if (updatedReg) {
        setEditTeamData(updatedReg);
      }
    }
  }, [registrations, isEditTeamOpen]);

  // Keep View Team modal data in sync with real-time updates
  useEffect(() => {
    if (teamModalData) {
      const updatedReg = registrations.find(r => r.id === teamModalData.id);
      if (updatedReg) {
        setTeamModalData(updatedReg);
      }
    }
  }, [registrations]);

  const handleConfirmWithdrawRequest = async () => {
    if (!withdrawRequestObj) return;
    const { id: requestId, eventId } = withdrawRequestObj;
    setWithdrawRequestObj(null);
    setWithdrawingId(requestId);
    setFeedback(null);
    try {
      await axios.put(`/api/events/${eventId}/organizer-requests/${requestId}/withdraw`);
      setFeedback({ type: 'success', message: 'Organizer request withdrawn successfully.' });
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'withdrawn' } : r));
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to withdraw organizer request.' });
    } finally {
      setWithdrawingId(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const openConfirmCancel = (reg) => {
    setConfirmCancelReg(reg);
    setIsConfirmCancelOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!confirmCancelReg) return;
    const regId = confirmCancelReg.id;
    setIsConfirmCancelOpen(false);
    setConfirmCancelReg(null);

    setCancellingId(regId);
    setFeedback(null);
    try {
      await axios.delete(`/api/registrations/${regId}`);
      setFeedback({ type: 'success', message: 'Registration cancelled successfully.' });
      
      // Update state local list
      setRegistrations(prev => prev.filter(reg => reg.id !== regId));
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to cancel registration.' });
    } finally {
      setCancellingId(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleAcceptInvitation = async (regId) => {
    setProcessingId(regId);
    setFeedback(null);
    try {
      await axios.post(`/api/registrations/${regId}/accept`);
      sessionStorage.removeItem('pendingAcceptRegId');
      sessionStorage.removeItem('profile_redirect_url');
      setFeedback({ type: 'success', message: 'Team invitation accepted successfully!' });
      fetchRegistrations();
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.profileIncomplete) {
        sessionStorage.setItem('pendingAcceptRegId', regId);
        sessionStorage.setItem('profile_redirect_url', '/registrations?tab=invitations');
      }
      setFeedback({ 
        type: 'error', 
        message: errData?.message || 'Failed to accept invitation.',
        profileIncomplete: !!errData?.profileIncomplete
      });
    } finally {
      setProcessingId(null);
      setTimeout(() => setFeedback(null), 8000);
    }
  };

  const openConfirmReject = (reg) => {
    setConfirmRejectReg(reg);
    setIsConfirmRejectOpen(true);
  };

  const handleRejectInvitation = async (regId) => {
    setProcessingId(regId);
    setFeedback(null);
    try {
      await axios.post(`/api/registrations/${regId}/reject`);
      setFeedback({ type: 'success', message: 'Team invitation rejected.' });
      setRegistrations(prev => prev.map(r => r.id === regId ? { ...r, status: 'rejected' } : r));
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to reject invitation.' });
    } finally {
      setProcessingId(null);
      setIsConfirmRejectOpen(false);
      setConfirmRejectReg(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const openConfirmLeave = (reg) => {
    setConfirmLeaveReg(reg);
    setIsConfirmLeaveOpen(true);
  };

  const handleLeaveTeam = async (teamId) => {
    setProcessingId(teamId);
    setFeedback(null);
    try {
      await axios.post(`/api/registrations/team/leave`, { teamId });
      setFeedback({ type: 'success', message: 'Successfully left the team.' });
      fetchRegistrations(); // Refresh to get reactivated invitations
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to leave team.' });
    } finally {
      setProcessingId(null);
      setIsConfirmLeaveOpen(false);
      setConfirmLeaveReg(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleConfirmTeam = (reg) => {
    setConfirmTeamReg(reg);
    setIsConfirmTeamOpen(true);
  };

  const handleConfirmTeamSubmit = async () => {
    if (!confirmTeamReg) return;
    
    if (confirmTeamReg.eventId?.payment_enabled && !isValidUtr(teamUtr)) {
      setContactNumberError('Enter a valid 12-22 character UTR before confirming payment.');
      return;
    }

    const teamId = confirmTeamReg.teamId.id;
    setProcessingId(teamId);
    setFeedback(null);
    try {
      await axios.post(`/api/registrations/team/${teamId}/confirm`, {
        utrNumber: teamUtr
      });
      const isAwaitingVerification = confirmTeamReg.eventId?.payment_enabled;
      setFeedback({ type: 'success', message: isAwaitingVerification ? 'UTR submitted. Awaiting payment verification.' : 'Team registration confirmed successfully!' });
      if (!isAwaitingVerification) {
        setRegistrations(prev => prev.map(r => r.team_id === teamId ? { 
          ...r, 
          status: 'registered',
          teamDetails: { ...(r.teamDetails || {}), teamStatus: 'registered' }
        } : r));
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to confirm team.' });
    } finally {
      setProcessingId(null);
      setIsConfirmTeamOpen(false);
      setConfirmTeamReg(null);
      setLeaderContactNumber('');
      setContactNumberError('');
      setTeamUtr('');
      setTimeout(() => setFeedback(null), 4000);
      fetchRegistrations();
    }
  };

  const handleEditTeamOpen = async (reg) => {
    setEditTeamData(reg);
    setEditTeamName(reg.teamId?.name || '');
    setEditExternalInvites([]);
    setEditInviteName('');
    setEditInviteEmail('');
    setIsEditTeamOpen(true);
    setTeamEditFeedback(null);
    setSelectedStudentEdit('');
    
    // Fetch eligible students for this event
    try {
      const eventId = reg.eventId?.id || reg.eventId?._id;
      const res = await axios.get(`/api/registrations/event/${eventId}/eligible-students`);
      setEligibleStudentsEdit(res.data);
    } catch (err) {
      console.error('Error fetching eligible students for edit:', err);
    }
  };

  const handleUpdateTeamName = async () => {
    if (!editTeamName.trim() || !editTeamData) return;
    const teamId = editTeamData.teamId.id;
    setProcessingId(`name-${teamId}`);
    setTeamEditFeedback(null);
    try {
      await axios.put(`/api/registrations/team/${teamId}`, { teamName: editTeamName });
      setTeamEditFeedback({ type: 'success', message: 'Team name updated successfully.' });
      fetchRegistrations();
    } catch (err) {
      setTeamEditFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to update team name.' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleInviteExternalEdit = async () => {
    if (!editInviteName.trim() || !editInviteEmail.trim() || !editTeamData) return;
    const teamId = editTeamData.teamId.id;
    setEditInvitingExternal(true);
    setTeamEditFeedback(null);
    try {
      await axios.post(`/api/registrations/team/${teamId}/invite-external`, {
        email: editInviteEmail.trim(),
        name: editInviteName.trim()
      });
      setTeamEditFeedback({ type: 'success', message: `Invitation sent to ${editInviteEmail.trim()}.` });
      setEditExternalInvites([...editExternalInvites, { name: editInviteName.trim(), email: editInviteEmail.trim() }]);
      setEditInviteName('');
      setEditInviteEmail('');
      fetchRegistrations();
    } catch (err) {
      setTeamEditFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to send invitation.' });
    } finally {
      setEditInvitingExternal(false);
    }
  };

  const handleRemoveTeamMember = async (memberId) => {
    if (!editTeamData) return;
    const teamId = editTeamData.teamId.id;
    setProcessingId(`remove-${memberId}`);
    setTeamEditFeedback(null);
    try {
      await axios.delete(`/api/registrations/team/${teamId}/members/${memberId}`);
      setTeamEditFeedback({ type: 'success', message: 'Team member removed successfully.' });
      fetchRegistrations();
      
      // Refresh eligible students to add the removed one back
      const eventId = editTeamData.eventId?.id || editTeamData.eventId?._id;
      const res = await axios.get(`/api/registrations/event/${eventId}/eligible-students`);
      setEligibleStudentsEdit(res.data);
    } catch (err) {
      setTeamEditFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to remove team member.' });
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString) => {
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  const invitationsList = registrations.filter(r => {
    // Exclude if the user is the Team Leader (these belong in My Registrations)
    if (r.team_id && r.teamDetails?.leader_id === r.user_id) return false;

    if (r.status === 'pending') return true;
    if (r.status === 'rejected' || r.status === 'auto_rejected' || r.status === 'cancelled') return true;
    if (r.status === 'registered' && r.team_id) return true;
    return false;
  });

  return (
    <div className="flex-grow py-20 text-slate-700">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10 animate-fade-in-up">
          <div>
            <h1 className="font-display text-3xl font-black text-text-primary">My Registered <span className="heading-gradient">Events</span></h1>
            <p className="font-body text-slate-600 text-sm mt-1.5">Track and manage your campus event bookings</p>
          </div>
          <Link to="/" className="btn-primary text-center px-5 py-2.5 text-xs font-display font-bold rounded-xl text-white self-start shadow-lg shadow-violet-500/15">
            Browse More Events
          </Link>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className={`mb-6 p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up ${
            feedback.type === 'success' 
              ? 'bg-emerald-500/8 border-emerald-500/15 text-emerald-600 dark:text-emerald-400' 
              : 'bg-red-500/8 border-red-500/15 text-red-600 dark:text-red-400'
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-lg">{feedback.type === 'success' ? '✓' : '⚠'}</span>
              <span className="text-sm font-semibold">{feedback.message}</span>
            </div>
            {feedback.profileIncomplete && (
              <Link 
                to="/profile?redirect=%2Fregistrations" 
                onClick={() => sessionStorage.setItem('profile_redirect_url', '/registrations')}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-sm shrink-0 transition-all text-center cursor-pointer"
              >
                Complete Profile Settings →
              </Link>
            )}
          </div>
        )}

        {/* Sub tabs */}
        <div className="flex gap-4 mb-8 border-b border-slate-200/10 pb-5">
          <button
            onClick={() => setActiveSubTab('registrations')}
            className={`px-5 py-2.5 rounded-xl text-xs font-display font-bold transition-all duration-300 ${
              activeSubTab === 'registrations'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                : 'bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white'
            }`}
          >
            Event Registrations
          </button>
          <button
            onClick={() => setActiveSubTab('invitations')}
            className={`px-5 py-2.5 rounded-xl text-xs font-display font-bold transition-all duration-300 ${
              activeSubTab === 'invitations'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                : 'bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white'
            }`}
          >
            Team Invitations
            {registrations.filter(r => r.status === 'pending' && (!r.teamId || r.teamId.leader_id !== user?.id)).length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {registrations.filter(r => r.status === 'pending' && (!r.teamId || r.teamId.leader_id !== user?.id)).length}
              </span>
            )}
          </button>
        </div>

        {/* Sub-tab: Registrations list */}
        {activeSubTab === 'registrations' && (
          <>
            {registrations.filter(r => r.status === 'pending' && (!r.teamId || r.teamId.leader_id !== user?.id)).length > 0 && (
              <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-violet-600/15 via-purple-600/15 to-indigo-600/15 border border-violet-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shadow-violet-500/5 animate-fade-in-up">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-violet-600 text-white flex items-center justify-center text-lg font-bold shrink-0 shadow-md">
                    📩
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">
                      You have {registrations.filter(r => r.status === 'pending' && (!r.teamId || r.teamId.leader_id !== user?.id)).length} pending team invitation(s)!
                    </h4>
                    <p className="text-xs text-slate-600">A team leader has invited you to join their team for an event.</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveSubTab('invitations')}
                  className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-xl shadow-md transition-all shrink-0 cursor-pointer"
                >
                  View Team Invitations →
                </button>
              </div>
            )}
            {loading ? (
              <div className="glass-panel rounded-2xl overflow-hidden">
                <div className="p-6 space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-white/20 rounded-xl animate-pulse" />
                  ))}
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-20 animate-fade-in-up">
                <div className="h-16 w-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto text-red-400 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <p className="text-red-400 font-bold mb-3">{error}</p>
                <button onClick={fetchRegistrations} className="btn-primary px-6 py-2.5 text-sm font-bold rounded-xl text-white">Retry</button>
              </div>
            ) : registrations.filter(r => r.status === 'registered' || (r.status === 'pending' && r.teamId && r.teamId.leader_id === user?.id)).length === 0 ? (
              <div className="text-center py-24 glass-panel rounded-2xl animate-fade-in-scale">
                <div className="h-20 w-20 bg-white/50 rounded-2xl flex items-center justify-center mx-auto text-slate-600 mb-5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <h3 className="text-xl font-display font-bold text-slate-800 mb-2">No Registered Events</h3>
                <p className="text-sm font-body text-slate-600 max-w-sm mx-auto mb-6">You have not registered for any events yet. Check out the homepage to browse active sessions.</p>
                <Link to="/" className="btn-primary px-6 py-2.5 text-xs font-display font-bold rounded-xl text-white">Explore Events</Link>
              </div>
            ) : (
              /* Registrations Cards Container */
              <div className="animate-fade-in-up delay-100 flex flex-col gap-5 mb-10">
                {registrations.filter(r => r.status === 'registered' || (r.status === 'pending' && r.teamId && r.teamId.leader_id === user?.id)).map((reg, i) => {
                  const evt = reg.eventId;
                  if (!evt) return null; // safety if event was deleted

                  return (
                    <div 
                      key={reg.id} 
                      className="glass-panel p-6 rounded-[2rem] shadow-sm border border-slate-200/60 hover:shadow-md transition-all duration-300 animate-fade-in-up flex flex-col"
                      style={{ animationDelay: `${i * 40 + 150}ms` }}
                    >
                      {/* Top Section: Image, Details, and Status */}
                      <div className="flex flex-col sm:flex-row gap-6 items-start">
                        {/* Event Image */}
                        <img
                          src={evt.image_url || evt.imageUrl || ''}
                          alt={evt.title}
                          className="h-24 w-36 sm:h-28 sm:w-44 rounded-2xl object-cover bg-slate-50 shrink-0 shadow-sm border border-slate-100"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22400%22%20height%3D%22300%22%20viewBox%3D%220%200%20400%20300%22%3E%3Crect%20width%3D%22400%22%20height%3D%22300%22%20fill%3D%22%23f8fafc%22%2F%3E%3Cpath%20d%3D%22M150%20200%20L200%20140%20L250%20200%20Z%22%20fill%3D%22%23e2e8f0%22%2F%3E%3Ccircle%20cx%3D%22160%22%20cy%3D%22120%22%20r%3D%2215%22%20fill%3D%22%23e2e8f0%22%2F%3E%3Ctext%20x%3D%22200%22%20y%3D%22240%22%20font-family%3D%22sans-serif%22%20font-size%3D%2218%22%20font-weight%3D%22600%22%20fill%3D%22%2394a3b8%22%20text-anchor%3D%22middle%22%3ENo%20Image%3C%2Ftext%3E%3C%2Fsvg%3E';
                          }}
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
                              {reg.teamId && (reg.teamDetails?.teamStatus === 'pending' && reg.teamId?.status !== 'registered' && reg.status !== 'registered') ? (
                                (() => {
                                  const leaderId = reg.teamDetails?.leader_id || reg.teamId?.leader_id || reg.user_id;
                                  const members = reg.teamDetails?.members || [];
                                  const acceptedUserIds = new Set();
                                  if (leaderId) acceptedUserIds.add(String(leaderId));
                                  members.forEach(m => {
                                    if (m.status === 'registered') {
                                      acceptedUserIds.add(String(m.id || m.user_id));
                                    }
                                  });
                                  const acceptedCount = acceptedUserIds.size;
                                  const minRequired = evt.min_team_size || 1;
                                  const isReady = acceptedCount >= minRequired;
                                   if (evt.payment_enabled && reg.payment_status === 'submitted') {
                                     return <span className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl border bg-blue-500/8 text-blue-500 border-blue-500/15">Payment Verification Pending</span>;
                                   }
                                   if (evt.payment_enabled && reg.payment_status === 'rejected') {
                                     return <span className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl border bg-red-500/8 text-red-500 border-red-500/15">Payment Rejected: Resubmit UTR</span>;
                                   }
                                   return isReady ? (
                                    <span className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl border bg-blue-500/8 text-blue-500 border-blue-500/15 flex items-center gap-1.5">
                                      🟢 Ready for Team Confirmation
                                    </span>
                                  ) : (
                                    <span className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl border bg-amber-500/8 text-amber-500 border-amber-500/15 flex items-center gap-1.5">
                                      🟡 Waiting for Member Approval
                                    </span>
                                  );
                                })()
                              ) : (
                                <span className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl border bg-emerald-500/8 text-emerald-500 border-emerald-500/15 flex items-center gap-1.5">
                                  ✓ Registered
                                </span>
                              )}
                              <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wider mt-1">
                                {evt.category}
                              </span>
                            </div>
                          </div>
                          
                          <div className="mt-4 text-xs text-slate-500 font-medium italic">
                            {(() => {
                              const dateValue = reg.registrationDate || reg.created_at || reg.createdAt;
                              if (!dateValue) return 'Booking date unavailable';
                              const d = new Date(dateValue);
                              if (isNaN(d.getTime())) return 'Booking date unavailable';
                              return `Booked on ${d.toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`;
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="h-px bg-slate-200/60 my-5 w-full" />

                      {/* Bottom Section: Actions */}
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        {evt.status === 'completed' && (
                          feedbackStatuses[evt.id || evt._id] ? (
                            <span className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center">
                              ✓ Feedback Submitted
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                setFeedbackEvent(evt);
                                setIsFeedbackModalOpen(true);
                              }}
                              className="px-5 py-2 text-xs font-bold rounded-xl bg-violet-500/10 text-violet-600 border border-violet-500/20 hover:bg-violet-500/20 transition-all duration-300"
                            >
                              Submit Feedback
                            </button>
                          )
                        )}
                        {new Date(evt.date) < new Date() ? (
                          <span className="px-5 py-2 text-[10px] font-bold rounded-xl bg-slate-500/10 text-slate-500 border border-slate-500/20 flex items-center text-center">
                            Event Completed – Pass unavailable.
                          </span>
                        ) : (!reg.teamId || reg.teamDetails?.teamStatus === 'registered' || reg.teamId?.status === 'registered' || reg.status === 'registered') ? (
                          <button
                            onClick={() => setQrModalData(reg)}
                            className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20 hover:bg-blue-500/20 transition-all duration-300"
                          >
                            View Pass
                          </button>
                        ) : null}
                        {(() => {
                          const isConfirmedReg = reg.status === 'registered' || reg.teamId?.status === 'registered' || reg.teamDetails?.teamStatus === 'registered';
                          const currentCount = evt.confirmed_teams_count || evt.registered_count || 0;
                          const isTeamEvt = evt.registration_type === 'team';
                          const isSlotsFull = isTeamEvt
                            ? (evt.max_teams ? currentCount >= evt.max_teams : false)
                            : (evt.capacity ? currentCount >= evt.capacity : false);

                          if (!isConfirmedReg && !reg.teamId && isSlotsFull) {
                            return (
                              <span className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center text-center">
                                SLOTS FULL — No more team slots are available.
                              </span>
                            );
                          }

                          return (
                            <>
                              {reg.teamId && (
                                <button
                                  onClick={() => setTeamModalData(reg)}
                                  className="px-5 py-2 text-xs font-bold rounded-xl bg-fuchsia-500/10 text-fuchsia-600 border border-fuchsia-500/20 hover:bg-fuchsia-500/20 transition-all duration-300"
                                >
                                  View Team
                                </button>
                              )}
                              {evt.status !== 'completed' && (
                                !reg.teamId ? (
                                  (!evt.registration_deadline || new Date() <= new Date(evt.registration_deadline)) && (
                                    <button
                                      onClick={() => openConfirmCancel(reg)}
                                      disabled={cancellingId === reg.id}
                                      className="px-5 py-2 text-xs font-bold rounded-xl bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20 transition-all duration-300 disabled:opacity-50"
                                    >
                                      {cancellingId === reg.id ? 'Cancelling...' : 'Cancel Registration'}
                                    </button>
                                  )
                                ) : (reg.teamDetails?.leader_id === reg.user_id) ? (
                                  <div className="flex gap-2 items-center">
                                    {reg.teamDetails?.teamStatus === 'pending' && (
                                      <>
                                        <button
                                          onClick={() => handleEditTeamOpen(reg)}
                                          className="px-5 py-2 text-xs font-bold rounded-xl bg-violet-500/10 text-violet-600 border border-violet-500/20 hover:bg-violet-500/20 transition-all duration-300"
                                        >
                                          Edit Team
                                        </button>
                                        {(() => {
                                           const leaderId = reg.teamDetails?.leader_id || reg.teamId?.leader_id || reg.user_id;
                                           const members = reg.teamDetails?.members || [];
                                           const acceptedUserIds = new Set();
                                           if (leaderId) acceptedUserIds.add(String(leaderId));
                                           members.forEach(m => {
                                             if (m.status === 'registered' || m.status === 'accepted') {
                                               acceptedUserIds.add(String(m.id || m.user_id));
                                             }
                                           });
                                           const acceptedCount = acceptedUserIds.size;
                                           const minRequired = evt.min_team_size || 1;
                                           const isReady = acceptedCount >= minRequired;
                                           const deadlinePassed = evt.registration_deadline && new Date() > new Date(evt.registration_deadline);
                                         
                                            if (deadlinePassed) {
                                             return (
                                               <span className="px-5 py-2 text-[10px] font-bold rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center text-center">
                                                 Registration deadline has passed. This team can no longer be confirmed.
                                               </span>
                                             );
                                            }

                                            if (evt.payment_enabled && reg.payment_status === 'submitted') {
                                              return (
                                                <span className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20">
                                                  Payment verification pending
                                                </span>
                                              );
                                            }

                                            if (isReady) {
                                             return (
                                               <button
                                                 onClick={() => handleConfirmTeam(reg)}
                                                 disabled={processingId === reg.teamId.id}
                                                 className="px-5 py-2 text-xs font-bold rounded-xl transition-all duration-300 disabled:opacity-50 bg-emerald-500 text-white border border-emerald-600 hover:bg-emerald-600 shadow-sm shadow-emerald-500/20"
                                               >
                                                 {processingId === reg.teamId.id ? 'Confirming...' : 'Confirm Team'}
                                               </button>
                                             );
                                           }
                                           
                                           return null;
                                         })()}
                                      </>
                                    )}
                                    {reg.teamDetails?.teamStatus !== 'registered' && (!evt.registration_deadline || new Date() <= new Date(evt.registration_deadline)) && (
                                      <button
                                        onClick={() => openConfirmCancel(reg)}
                                        disabled={cancellingId === reg.id}
                                        className="px-5 py-2 text-xs font-bold rounded-xl bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20 transition-all duration-300 disabled:opacity-50"
                                      >
                                        {cancellingId === reg.id ? 'Cancelling...' : 'Cancel Registration'}
                                      </button>
                                    )}
                                  </div>
                                ) : null
                              )}
                            </>
                          );
                        })()}
                      </div>

                      {/* Allocation Card (Student View) */}
                      {(() => {
                        const eventId = evt.id || evt._id;
                        const allocData = teamAllocations[eventId];
                        if (!allocData) return null;

                        const { allocation, teamConfirmed, checkedIn, isLeader, isIndividual, availableProblemStatements, message, venueRoom } = allocData;
                        const displayVenue = (venueRoom && venueRoom.trim()) ? venueRoom.trim() : 'Yet to assign';

                        // Only show for confirmed teams or individual registrations
                        if (!teamConfirmed) return null;

                        // 1. If ALREADY has an assigned Problem Statement (by Admin, Leader, or Individual selection), render it immediately!
                        if (allocation && allocation.problemStatement && allocation.problemStatement.trim() !== '') {
                          const allocVenue = allocation.venueRoom && allocation.venueRoom.trim() ? allocation.venueRoom.trim() : displayVenue;

                          return (
                            <div className="mt-4 p-4 bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/20 rounded-2xl animate-fade-in space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                                  <span>🎯</span>
                                  <span>Your Event Allocation ({allocation.teamName || 'Your Allocation'})</span>
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                                  Allocation Assigned
                                </span>
                              </div>

                              <div className="space-y-2 text-xs">
                                <div className="bg-white/60 dark:bg-slate-900/60 p-3 rounded-xl border border-emerald-500/10 space-y-1">
                                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-text-secondary">Problem Statement</div>
                                  <div className="font-bold text-sm text-text-primary">
                                    {allocation.code ? `[${allocation.code}] ${allocation.problemStatement}` : allocation.problemStatement}
                                  </div>
                                  {allocation.description && (
                                    <p className="text-xs text-text-secondary mt-1 leading-relaxed">{allocation.description}</p>
                                  )}
                                </div>

                                <div className="bg-white/60 dark:bg-slate-900/60 p-3 rounded-xl border border-emerald-500/10 flex items-center justify-between">
                                  <span className="text-text-secondary font-semibold text-xs">📍 Allocated Venue / Room</span>
                                  <span className="font-extrabold text-violet-600 dark:text-violet-400 text-xs">{allocVenue}</span>
                                </div>

                                <div className="pt-1 flex justify-end">
                                  <button
                                    onClick={async () => {
                                      try {
                                        const res = await axios.get(`/api/allocations/event/${eventId}/problem-statement-pdf`, {
                                          responseType: 'blob'
                                        });
                                        const blob = new Blob([res.data], { type: 'application/pdf' });
                                        const url = window.URL.createObjectURL(blob);
                                        const link = document.createElement('a');
                                        link.href = url;
                                        link.download = `Problem_Statements_${eventId}.pdf`;
                                        document.body.appendChild(link);
                                        link.click();
                                        link.remove();
                                        window.URL.revokeObjectURL(url);
                                      } catch (err) {
                                        alert(err.response?.data?.message || 'Attendance check-in is required before accessing the PDF.');
                                      }
                                    }}
                                    className="px-3.5 py-1.5 bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 rounded-xl text-xs font-bold hover:bg-violet-500/20 transition-all flex items-center gap-1.5"
                                  >
                                    📄 Download Problem Statement PDF
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // 2. If unallocated and student hasn't scanned QR / checked in yet
                        if (!checkedIn) {
                          return (
                            <div className="mt-4 p-4 bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/20 rounded-2xl animate-fade-in space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                                  <span>🔒</span>
                                  <span>Problem Statement Selection & PDF</span>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                  Check-in Required
                                </span>
                              </div>
                              
                              <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                                Attendance check-in is required before accessing the problem statement document or making a selection.
                              </p>

                              {displayVenue !== 'Yet to assign' && (
                                <div className="text-xs font-semibold text-text-primary pt-1">
                                  📍 Assigned Venue / Room: <span className="font-extrabold text-violet-600">{displayVenue}</span>
                                </div>
                              )}
                            </div>
                          );
                        }

                        // 3. If checked in, but problem statement not selected yet and user is not team leader
                        if (!isLeader) {
                          return (
                            <div className="mt-4 p-4 bg-blue-500/10 dark:bg-blue-950/40 border border-blue-500/20 rounded-2xl animate-fade-in space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                                  <span>📍</span>
                                  <span>Problem Statement Selection</span>
                                </div>
                                <button
                                  onClick={async () => {
                                    try {
                                      const res = await axios.get(`/api/allocations/event/${eventId}/problem-statement-pdf`, {
                                        responseType: 'blob'
                                      });
                                      const blob = new Blob([res.data], { type: 'application/pdf' });
                                      const url = window.URL.createObjectURL(blob);
                                      const link = document.createElement('a');
                                      link.href = url;
                                      link.download = `Problem_Statements_${eventId}.pdf`;
                                      document.body.appendChild(link);
                                      link.click();
                                      link.remove();
                                      window.URL.revokeObjectURL(url);
                                    } catch (err) {
                                      alert(err.response?.data?.message || 'Attendance check-in is required before accessing the PDF.');
                                    }
                                  }}
                                  className="px-3 py-1 bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 rounded-lg text-xs font-bold hover:bg-violet-500/20 transition-all flex items-center gap-1"
                                >
                                  📄 View PDF Document
                                </button>
                              </div>
                              <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                                {message || 'Waiting for your team leader to make a selection.'}
                              </p>
                              {displayVenue !== 'Yet to assign' && (
                                <div className="text-xs font-semibold text-text-primary pt-1">
                                  📍 Assigned Venue / Room: <span className="font-extrabold text-violet-600">{displayVenue}</span>
                                </div>
                              )}
                            </div>
                          );
                        }

                        // 4. PROBLEM STATEMENT SELECTION INTERFACE (Leader or Individual - Checked In!)
                        return (
                          <div className="mt-4 p-5 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-slate-900/10 dark:from-violet-950/40 dark:via-purple-950/20 dark:to-slate-900/40 border border-violet-500/20 rounded-2xl animate-fade-in space-y-4 shadow-soft">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-violet-500/15 pb-3.5">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="w-8 h-8 rounded-xl bg-violet-500/20 text-violet-600 dark:text-violet-400 border border-violet-500/30 flex items-center justify-center text-sm font-bold">
                                    🎯
                                  </span>
                                  <h4 className="font-heading font-extrabold text-base text-text-primary tracking-tight">
                                    Choose Your Problem Statement
                                  </h4>
                                </div>
                                <p className="text-xs text-text-secondary font-medium mt-1 leading-relaxed">
                                  {isIndividual
                                    ? 'Select one problem statement for your event. Your selection will be final after confirmation.'
                                    : 'Select one problem statement for your entire team. Your selection will be final after confirmation.'}
                                </p>
                                {displayVenue !== 'Yet to assign' && (
                                  <div className="text-xs font-bold text-violet-600 dark:text-violet-400 pt-1 flex items-center gap-1">
                                    <span>📍 Assigned Venue / Room:</span>
                                    <span>{displayVenue}</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={async () => {
                                    try {
                                      const res = await axios.get(`/api/allocations/event/${eventId}/problem-statement-pdf`, {
                                        responseType: 'blob'
                                      });
                                      const blob = new Blob([res.data], { type: 'application/pdf' });
                                      const url = window.URL.createObjectURL(blob);
                                      const link = document.createElement('a');
                                      link.href = url;
                                      link.download = `Problem_Statements_${eventId}.pdf`;
                                      document.body.appendChild(link);
                                      link.click();
                                      link.remove();
                                      window.URL.revokeObjectURL(url);
                                    } catch (err) {
                                      alert(err.response?.data?.message || 'Attendance check-in is required before accessing the PDF.');
                                    }
                                  }}
                                  className="px-3.5 py-1.5 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700 transition-all flex items-center gap-1.5 shadow-sm"
                                >
                                  📄 Download Problem Statements PDF
                                </button>
                              </div>
                            </div>

                            {psError && (
                              <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs font-bold flex items-center gap-2">
                                <span>⚠️</span> <span>{psError}</span>
                              </div>
                            )}

                            {/* Available Selection Cards Grid */}
                            {(!availableProblemStatements || availableProblemStatements.length === 0) ? (
                              <div className="p-8 bg-white/60 dark:bg-slate-900/60 rounded-xl text-xs text-text-secondary text-center font-medium">
                                No problem statements configured for this event yet.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                                {availableProblemStatements.map((ps, idx) => {
                                  const isSelected = selectedPsToConfirm?.ps?.id === ps.id;
                                  const psCode = ps.code || `PS${String(idx + 1).padStart(2, '0')}`;

                                  const rawCap = ps.maxCapacity ?? ps.max_capacity;
                                  const maxCapacity = (rawCap !== undefined && rawCap !== null && !isNaN(Number(rawCap)) && Number(rawCap) > 0) ? Number(rawCap) : 5;
                                  const allocatedCount = Number(ps.allocatedCount || ps.allocated_count || 0);
                                  const slotsRemaining = ps.slotsRemaining !== undefined 
                                    ? Number(ps.slotsRemaining) 
                                    : Math.max(0, maxCapacity - allocatedCount);
                                  const isFull = slotsRemaining <= 0;

                                  return (
                                    <div 
                                      key={ps.id || idx}
                                      className={`group rounded-2xl p-5 border-2 transition-all flex flex-col justify-between shadow-sm relative ${
                                        isFull
                                          ? 'bg-gray-100/50 dark:bg-slate-900/40 border-gray-300/40 dark:border-slate-800 opacity-85'
                                          : isSelected
                                            ? 'bg-violet-500/10 dark:bg-violet-950/40 border-violet-500 shadow-md ring-2 ring-violet-500/20'
                                            : 'bg-white/90 dark:bg-slate-800/90 border-pastel-lavender/30 hover:border-violet-500/40 hover:shadow-soft'
                                      }`}
                                    >
                                      {/* Card Top Info */}
                                      <div className="space-y-3">
                                        <div className="flex justify-between items-center pb-2.5 border-b border-pastel-lavender/10">
                                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                                            {psCode}
                                          </span>
                                          <div className="flex items-center gap-1.5">
                                            {isFull ? (
                                              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                                                🔴 Full (0 Slots Left)
                                              </span>
                                            ) : (
                                              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                                                ⚡ {slotsRemaining} / {maxCapacity} Slots Left
                                              </span>
                                            )}
                                            {isSelected && (
                                              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20">
                                                ✓ Selected
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        <div className="space-y-1.5">
                                          <h5 className="font-heading font-extrabold text-sm text-text-primary group-hover:text-violet-600 transition-colors leading-snug">
                                            [{psCode}] {ps.title}
                                          </h5>
                                          {ps.description && (
                                            <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">
                                              {ps.description}
                                            </p>
                                          )}
                                        </div>
                                      </div>

                                      {/* Card Bottom Actions */}
                                      <div className="pt-4 mt-4 border-t border-pastel-lavender/10">
                                        <div className="flex justify-between items-center">
                                          <span className="text-[11px] font-bold text-text-secondary">
                                            {isFull ? 'No slots remaining' : `${slotsRemaining} slot(s) open`}
                                          </span>
                                          <button
                                            disabled={isFull}
                                            onClick={() => !isFull && setSelectedPsToConfirm({ eventId, ps })}
                                            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 ${
                                              isFull
                                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300/30'
                                                : isSelected
                                                  ? 'bg-violet-600 text-white ring-2 ring-violet-500/40'
                                                  : 'btn-primary text-white hover:shadow-md'
                                            }`}
                                          >
                                            {isFull ? 'Fully Booked' : isSelected ? '✓ Selected' : 'Select'}
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Sub-tab: Team Invitations list */}
        {activeSubTab === 'invitations' && (
          <>
            {loading ? (
              <div className="glass-panel rounded-2xl overflow-hidden">
                <div className="p-6 space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-white/20 rounded-xl animate-pulse" />
                  ))}
                </div>
              </div>
            ) : invitationsList.length === 0 ? (
              <div className="text-center py-24 glass-panel rounded-2xl animate-fade-in-scale">
                <div className="h-20 w-20 bg-white/50 rounded-2xl flex items-center justify-center mx-auto text-slate-600 mb-5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-display font-bold text-slate-800 mb-2">No Invitations</h3>
                <p className="text-sm font-body text-slate-600 max-w-sm mx-auto mb-6">You don't have any pending or accepted team invitations right now.</p>
              </div>
            ) : (
              <div className="animate-fade-in-up delay-100 flex flex-col gap-5 mb-10">
                {invitationsList.map((reg, i) => {
                  const evt = reg.eventId || {
                    id: reg.event_id,
                    title: 'Registered Event',
                    category: 'Event',
                    date: reg.created_at || new Date().toISOString()
                  };
                  const teamName = reg.teamId?.name || 'A team';
                  
                  if (!evt && !reg.event_id) return null;

                  const hasActiveTeamForEvent = registrations.some(r => 
                    r.eventId?.id === evt.id && 
                    (r.status === 'registered' || (r.teamDetails && r.teamDetails.leader_id === user?.id))
                  );

                  const leader = reg.teamDetails?.members?.find(m => m.id === reg.teamDetails?.leader_id);
                  const leaderEmail = leader?.email || '';
                  const leaderRollNumber = leaderEmail ? leaderEmail.split('@')[0] : '';
                  const leaderName = leader?.fullName || 'Unknown';

                  return (
                    <div 
                      key={reg.id} 
                      className="glass-panel p-6 rounded-[2rem] shadow-sm border border-amber-200/60 hover:shadow-md transition-all duration-300 animate-fade-in-up flex flex-col bg-amber-50/20"
                      style={{ animationDelay: `${i * 40 + 150}ms` }}
                    >
                      <div className="flex flex-col sm:flex-row gap-6 items-start">
                        <div className="flex-1 min-w-0 w-full">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                            <div>
                              <h3 className="font-display font-bold text-xl text-slate-800 line-clamp-1">Event Name: {evt.title}</h3>
                              
                              <div className="mt-4 space-y-1">
                                <p className="text-sm font-body text-slate-700">
                                  <span className="font-bold">Team Name:</span> {teamName}
                                </p>
                                <p className="text-sm font-body text-slate-700">
                                  <span className="font-bold">Team Leader:</span> {leaderName} {leaderRollNumber && `(${leaderRollNumber})`}
                                </p>
                              </div>
                              
                              <div className="mt-6 mb-4">
                                <h4 className="text-sm font-bold text-slate-800 mb-2">Team Members:</h4>
                                <ul className="space-y-1.5 mt-3">
                                  {reg.teamDetails?.members?.map(member => {
                                    const email = member.email || '';
                                    const rollNum = email ? email.split('@')[0] : '';
                                    const isLeader = member.id === reg.teamDetails?.leader_id;
                                    const rawStatus = member.status || 'pending';
                                    let displayStatus = isLeader ? 'Leader' : (rawStatus === 'registered' ? 'Accepted' : rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1));
                                    if (rawStatus === 'auto_rejected') displayStatus = 'Unavailable (Joined Another Team)';
                                    
                                    return (
                                      <li key={member.id} className="text-sm text-slate-700">
                                        {member.fullName || 'Unknown'} {rollNum && `(${rollNum})`} <span className="text-slate-400 mx-1">–</span> <span>{displayStatus}</span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>

                              {evt.registration_deadline && (
                                <div className="mt-6 mb-2 space-y-2">
                                  <p className="text-sm font-bold text-slate-700">
                                    Registration Deadline: {formatDate(evt.registration_deadline)}
                                  </p>
                                  <RegistrationCountdown 
                                    deadline={evt.registration_deadline} 
                                    onDeadlinePassed={() => fetchRegistrations()} 
                                  />
                                </div>
                              )}
                            </div>
                            
                            <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                              {reg.status === 'registered' ? (
                                <span className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl border bg-emerald-500/10 text-emerald-600 border-emerald-500/20 flex items-center gap-1.5">
                                  Accepted
                                </span>
                              ) : reg.status === 'rejected' || reg.status === 'auto_rejected' ? (
                                <span className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl border bg-red-500/10 text-red-600 border-red-500/20 flex items-center gap-1.5">
                                  Rejected
                                </span>
                              ) : reg.status === 'cancelled' ? (
                                <span className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl border bg-slate-500/10 text-slate-600 border-slate-500/20 flex items-center gap-1.5">
                                  Left Team
                                </span>
                              ) : (
                                <span className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl border bg-amber-500/8 text-amber-600 border-amber-500/15 flex items-center gap-1.5">
                                  Pending Approval
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="h-px bg-slate-200/60 my-5 w-full" />

                      <div className="flex flex-wrap items-center justify-end gap-3">
                        {reg.status === 'rejected' ? (
                          <span className="text-xs text-red-500 font-bold bg-red-500/10 px-4 py-2 rounded-xl">
                            You have rejected this invitation. You cannot join this team again unless the Team Leader sends you a new invitation.
                          </span>
                        ) : reg.status === 'auto_rejected' ? (
                          <span className="text-xs text-slate-500 font-bold bg-slate-100 px-4 py-2 rounded-xl border">
                            You cannot accept this invitation because you have already joined another team.
                          </span>
                        ) : reg.status === 'cancelled' ? (
                          <span className="text-xs text-slate-500 font-bold bg-slate-100 px-4 py-2 rounded-xl border">
                            You have left this team.
                          </span>
                        ) : evt.registration_deadline && new Date() > new Date(evt.registration_deadline) ? (
                          <span className="px-5 py-2 text-xs font-bold rounded-xl bg-slate-500/10 text-slate-500 border border-slate-500/20 flex items-center">
                            {reg.status === 'registered' ? 'Registration Closed' : 'Approval Closed'}
                          </span>
                        ) : reg.status === 'registered' ? (
                          reg.teamId && reg.teamId.status === 'registered' ? (
                            <span className="text-xs text-emerald-600 font-bold bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl">
                              Team Confirmed
                            </span>
                          ) : (
                            <button
                              onClick={() => openConfirmLeave(reg)}
                              disabled={processingId === reg.team_id}
                              className="px-5 py-2 text-xs font-bold rounded-xl bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20 transition-all duration-300 disabled:opacity-50"
                            >
                              {processingId === reg.team_id ? 'Processing...' : 'Leave Team'}
                            </button>
                          )
                        ) : reg.teamId && reg.teamId.status === 'registered' ? (
                          <span className="text-xs text-amber-600 font-bold bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-xl">
                            Team Finalized — You can no longer join this team.
                          </span>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAcceptInvitation(reg.id)}
                              disabled={processingId === reg.id}
                              className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white border border-emerald-600 transition-all duration-300 disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-500/20"
                            >
                              {processingId === reg.id ? 'Processing...' : 'Accept Invitation'}
                            </button>
                            <button
                              onClick={() => openConfirmReject(reg)}
                              disabled={processingId === reg.id}
                              className="px-5 py-2 text-xs font-bold rounded-xl bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20 transition-all duration-300 disabled:opacity-50 cursor-pointer"
                            >
                              Reject Invitation
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Sub-tab: Organizer Requests list */}
        {activeSubTab === 'requests' && (
          <>
            {loadingRequests ? (
              <div className="glass-panel rounded-2xl overflow-hidden">
                <div className="p-6 space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-white/20 rounded-xl animate-pulse" />
                  ))}
                </div>
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-24 glass-panel rounded-2xl animate-fade-in-scale">
                <div className="h-20 w-20 bg-white/50 rounded-2xl flex items-center justify-center mx-auto text-slate-600 mb-5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-xl font-display font-bold text-slate-800 mb-2">No Organizer Requests</h3>
                <p className="text-sm font-body text-slate-600 max-w-sm mx-auto mb-6">You have not submitted any join requests yet. Browse the homepage to request to join organizing teams.</p>
              </div>
            ) : (
              /* Organizer Requests Cards Container */
              <div className="animate-fade-in-up delay-100 flex flex-col gap-5 mb-10">
                {requests.map((req, i) => (
                  <div 
                    key={req.id} 
                    className="glass-panel p-6 rounded-[2rem] shadow-sm border border-slate-200/60 hover:shadow-md transition-all duration-300 animate-fade-in-up flex flex-col"
                    style={{ animationDelay: `${i * 40 + 150}ms` }}
                  >
                    {/* Top Section */}
                    <div className="flex flex-col sm:flex-row gap-6 items-start">
                      {/* Details */}
                      <div className="flex-1 min-w-0 w-full">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                          <div>
                            <h3 className="font-display font-bold text-xl text-slate-800 line-clamp-1">{req.eventTitle}</h3>
                            
                            {/* Venue and Date */}
                            <div className="mt-3 space-y-2">
                              <div className="flex items-center gap-2.5 text-sm text-slate-600 font-medium">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                </svg>
                                {req.eventVenue}
                              </div>
                              <div className="flex items-center gap-2.5 text-sm text-slate-600 font-medium">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                </svg>
                                {formatDate(req.eventDate)}
                              </div>
                            </div>
                          </div>
                          
                          {/* Status Badge */}
                          <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                            <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl border ${
                              req.status === 'approved'
                                ? 'bg-emerald-500/8 text-emerald-500 border-emerald-500/15'
                                : req.status === 'pending'
                                  ? 'bg-amber-500/8 text-amber-500 border-amber-500/15'
                                  : req.status === 'rejected'
                                    ? 'bg-red-500/8 text-red-500 border-red-500/15'
                                    : 'bg-slate-100 text-slate-500 border-slate-200 italic' // withdrawn
                            }`}>
                              {req.status}
                            </span>
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wider mt-1">
                              {req.category}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 text-xs text-slate-500 font-medium italic">
                          Requested on {new Date(req.requestedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-slate-200/60 my-5 w-full" />

                    {/* Bottom Section: Actions */}
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      {req.status === 'pending' && (
                        <button
                          onClick={() => setWithdrawRequestObj(req)}
                          disabled={withdrawingId === req.id}
                          className="px-5 py-2 text-xs font-bold rounded-xl bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20 transition-all duration-300 disabled:opacity-50"
                        >
                          {withdrawingId === req.id ? 'Withdrawing...' : 'Withdraw Request'}
                        </button>
                      )}
                      {req.status !== 'pending' && (
                        <span className="text-xs text-slate-400 font-medium italic">No actions available</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Cancellation Confirmation Modal */}
        <Modal
          isOpen={isConfirmCancelOpen}
          onClose={() => {
            setIsConfirmCancelOpen(false);
            setConfirmCancelReg(null);
          }}
          title="Cancel Registration"
        >
          {confirmCancelReg && (
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
                    setConfirmCancelReg(null);
                  }}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl btn-secondary"
                >
                  Keep Registration
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  className="px-6 py-2.5 text-xs font-display font-bold btn-danger"
                >
                  Yes, Cancel Registration
                </button>
              </div>
            </div>
          )}
        </Modal>

        {/* Withdraw Organizer Request Confirmation Modal */}
        <Modal
          isOpen={withdrawRequestObj !== null}
          onClose={() => setWithdrawRequestObj(null)}
          title="Withdraw Request"
        >
          {withdrawRequestObj && (
            <div className="space-y-5">
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                Are you sure you want to withdraw this event organizer request?
              </p>
              
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setWithdrawRequestObj(null)}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl btn-secondary"
                >
                  Keep Request
                </button>
                <button
                  type="button"
                  onClick={handleConfirmWithdrawRequest}
                  className="px-6 py-2.5 text-xs font-display font-bold btn-danger"
                >
                  Withdraw
                </button>
              </div>
            </div>
          )}
        </Modal>

        {/* Confirm Reject Invitation Modal */}
        <Modal
          isOpen={isConfirmRejectOpen}
          onClose={() => {
            if (processingId) return;
            setIsConfirmRejectOpen(false);
            setConfirmRejectReg(null);
          }}
          title="Reject Team Invitation?"
        >
          {confirmRejectReg && (
            <div className="space-y-6">
              <p className="text-slate-600 text-sm font-body">
                If you reject this invitation, you will not be able to join this team again unless the Team Leader sends you a new invitation.
              </p>
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3 items-start">
                <span className="text-xl">⚠</span>
                <p className="text-red-500 text-xs font-semibold mt-1">
                  Are you sure you want to reject this invitation?
                </p>
              </div>
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => {
                    setIsConfirmRejectOpen(false);
                    setConfirmRejectReg(null);
                  }}
                  disabled={processingId === confirmRejectReg.id}
                  className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRejectInvitation(confirmRejectReg.id)}
                  disabled={processingId === confirmRejectReg.id}
                  className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processingId === confirmRejectReg.id ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                      Rejecting...
                    </>
                  ) : (
                    'Reject Invitation'
                  )}
                </button>
              </div>
            </div>
          )}
        </Modal>

        {/* Confirm Leave Team Modal */}
        <Modal
          isOpen={isConfirmLeaveOpen}
          onClose={() => {
            if (processingId) return;
            setIsConfirmLeaveOpen(false);
            setConfirmLeaveReg(null);
          }}
          title="Leave Team?"
        >
          {confirmLeaveReg && (
            <div className="space-y-6">
              <p className="text-slate-600 text-sm font-body">
                If you leave this team, you will no longer be a member of it. You may join another team or create your own team if you are eligible.
              </p>
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3 items-start">
                <span className="text-xl">⚠</span>
                <p className="text-red-500 text-xs font-semibold mt-1">
                  Are you sure you want to leave?
                </p>
              </div>
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => {
                    setIsConfirmLeaveOpen(false);
                    setConfirmLeaveReg(null);
                  }}
                  disabled={processingId === confirmLeaveReg.team_id}
                  className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleLeaveTeam(confirmLeaveReg.team_id)}
                  disabled={processingId === confirmLeaveReg.team_id}
                  className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processingId === confirmLeaveReg.team_id ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                      Leaving...
                    </>
                  ) : (
                    'Leave Team'
                  )}
                </button>
              </div>
            </div>
          )}
        </Modal>

        {/* Confirm Team Registration Modal */}
        <Modal
          isOpen={isConfirmTeamOpen}
          onClose={() => {
            if (processingId === confirmTeamReg?.teamId?.id) return;
            setIsConfirmTeamOpen(false);
            setConfirmTeamReg(null);
            setLeaderContactNumber('');
            setContactNumberError('');
          }}
          title="Confirm Team Registration"
        >
          {confirmTeamReg && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                <p className="text-sm font-bold text-emerald-800">The minimum required members have accepted the invitation.</p>
                <p className="text-sm mt-2 text-emerald-700">You may confirm your team now, or wait until additional invited members accept before the registration deadline.</p>
              </div>

              {confirmTeamReg.eventId?.registration_deadline && (
                <div className="p-4 bg-slate-100 rounded-xl border border-slate-200">
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Registration Deadline:</p>
                  <p className="text-base font-bold text-slate-800 mt-1">
                    {new Date(confirmTeamReg.eventId.registration_deadline).toLocaleDateString('en-GB', {
                      day: '2-digit', month: 'long', year: 'numeric'
                    })} – {new Date(confirmTeamReg.eventId.registration_deadline).toLocaleTimeString('en-US', {
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
              )}

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-sm font-bold text-slate-700 mb-2">Team Name: <span className="font-medium">{confirmTeamReg.teamId.name}</span></p>
                <p className="text-sm font-bold text-slate-700 mb-2">Team Members:</p>
                <ul className="space-y-2 text-sm text-slate-600 pl-2">
                  {confirmTeamReg.teamDetails?.members?.map(m => (
                    <li key={m.id} className="flex justify-between items-center border-b border-slate-200/50 pb-1 last:border-0 last:pb-0">
                      <span>{m.id === confirmTeamReg.teamDetails?.leader_id ? 'Team Leader' : m.fullName}</span>
                      <span className={`font-bold ${m.status === 'registered' || m.id === confirmTeamReg.teamDetails?.leader_id ? 'text-emerald-500' : (m.status === 'pending' ? 'text-amber-500' : 'text-red-500')}`}>
                        {m.status === 'registered' || m.id === confirmTeamReg.teamDetails?.leader_id ? 'Accepted' : (m.status === 'pending' ? 'Pending' : 'Rejected')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                <div className="text-xs text-amber-800 space-y-2">
                  <p className="font-bold">After confirming:</p>
                  <ul className="list-disc list-inside space-y-1 ml-1 font-medium">
                    <li>The team registration will become final.</li>
                    <li>Team membership will be locked.</li>
                    <li>Members cannot leave.</li>
                    <li>New members cannot be added.</li>
                    <li>Team details cannot be modified.</li>
                  </ul>
                </div>
              </div>

              <PaymentSection event={confirmTeamReg.eventId} utr={teamUtr} onUtrChange={setTeamUtr} rejectionReason={confirmTeamReg.payment_rejection_reason} />
              
              <div className="flex gap-3 justify-end pt-4 mt-2 border-t border-slate-200/20">
                <button
                  type="button"
                  onClick={() => {
                    setIsConfirmTeamOpen(false);
                    setConfirmTeamReg(null);
                    setLeaderContactNumber('');
                    setContactNumberError('');
                  }}
                  disabled={processingId === confirmTeamReg.teamId.id}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmTeamSubmit}
                  disabled={processingId === confirmTeamReg.teamId.id}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-500/20 transition-all duration-300 disabled:opacity-50 flex items-center justify-center min-w-[120px]"
                >
                  {processingId === confirmTeamReg.teamId.id ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    'Confirm Team'
                  )}
                </button>
              </div>
            </div>
          )}
        </Modal>

        {/* Team Details Modal */}
        {teamModalData && (
          <Modal
            isOpen={!!teamModalData}
            onClose={() => setTeamModalData(null)}
            title={`Team: ${teamModalData.teamId.name}`}
          >
            <div className="space-y-4">
              <div className="bg-slate-500/5 border border-slate-200/10 p-4 rounded-xl">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Team Leader</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-800">
                      {teamModalData.teamDetails?.members?.find(m => m.id === teamModalData.teamDetails.leader_id)?.fullName || 'Unknown'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {teamModalData.teamDetails?.members?.find(m => m.id === teamModalData.teamDetails.leader_id)?.email || ''}
                    </div>
                  </div>
                  <span className="text-[10px] bg-fuchsia-500/10 text-fuchsia-600 font-bold px-2 py-1 rounded border border-fuchsia-500/20 uppercase">
                    Leader
                  </span>
                </div>
              </div>

              <div className="bg-slate-500/5 border border-slate-200/10 p-4 rounded-xl">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Team Members</h4>
                <ul className="space-y-3">
                  {(teamModalData.teamDetails?.members || []).map(member => (
                    <li key={member.id} className="flex items-center justify-between border-b border-slate-200/20 pb-3 last:border-0 last:pb-0">
                      <div>
                        <div className="text-sm font-bold text-slate-700">{member.fullName || 'Unknown'}</div>
                        <div className="text-xs text-slate-500">
                          {member.roll_number || ''} {member.department ? `• ${member.department}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {(member.status === 'registered' || member.id === teamModalData.teamDetails?.leader_id) && <span className="text-[10px] text-emerald-500 font-bold uppercase">🟢 Accepted</span>}
                        {member.status === 'pending' && member.id !== teamModalData.teamDetails?.leader_id && <span className="text-[10px] text-amber-500 font-bold uppercase">🟡 Pending</span>}
                        {member.status === 'rejected' && member.id !== teamModalData.teamDetails?.leader_id && <span className="text-[10px] text-red-500 font-bold uppercase">🔴 Rejected</span>}
                        {member.status === 'auto_rejected' && member.id !== teamModalData.teamDetails?.leader_id && <span className="text-[10px] text-slate-400 font-bold uppercase">Unavailable (Joined another team)</span>}
                        {member.status === 'cancelled' && member.id !== teamModalData.teamDetails?.leader_id && <span className="text-[10px] text-slate-400 font-bold uppercase">⚪ Left Team</span>}
                        {member.id === teamModalData.teamDetails?.leader_id && (
                          <span className="text-[10px] text-fuchsia-400 font-bold uppercase">Leader</span>
                        )}
                      </div>
                    </li>
                  ))}
                  {(!teamModalData.teamDetails?.members || teamModalData.teamDetails.members.length === 0) && (
                    <li className="text-xs text-slate-500 italic">No members found.</li>
                  )}
                </ul>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setTeamModalData(null)}
                className="px-5 py-2.5 text-sm font-bold rounded-xl btn-secondary"
              >
                Close
              </button>
            </div>
          </Modal>
        )}

        {/* Edit Team Modal */}
        <Modal
          isOpen={isEditTeamOpen}
          onClose={() => {
            if (processingId) return;
            setIsEditTeamOpen(false);
            setEditTeamData(null);
          }}
          title="Edit Team"
        >
          {editTeamData && (
            <div className="space-y-6">
              {teamEditFeedback && (
                <div className={`p-3 rounded-lg text-xs font-bold flex items-center gap-2 ${
                  teamEditFeedback.type === 'success' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
                }`}>
                  {teamEditFeedback.type === 'success' ? '✓' : '⚠'} {teamEditFeedback.message}
                </div>
              )}

              {/* Team Name Edit */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Team Name</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={editTeamName}
                      onChange={(e) => setEditTeamName(e.target.value)}
                      className={`w-full bg-white border text-slate-800 text-sm rounded-xl focus:outline-none block p-2.5 transition-all duration-300 ${
                        nameUnavailable
                          ? 'border-red-500/80 focus:border-red-500/80'
                          : 'border-slate-200 focus:border-violet-500'
                      }`}
                      placeholder="Enter team name"
                      disabled={!!processingId}
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
                  <button
                    onClick={handleUpdateTeamName}
                    disabled={!!processingId || editTeamName.trim() === editTeamData.teamId.name || isCheckingName || nameUnavailable}
                    className="px-4 py-2.5 text-xs font-bold rounded-xl bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50 transition-colors"
                  >
                    {processingId === `name-${editTeamData.teamId.id}` ? 'Saving...' : 'Save Name'}
                  </button>
                </div>
                {nameUnavailable && (
                  <p className="mt-1.5 text-xs font-bold text-red-500">
                    This team name already exists. Please choose a different name.
                  </p>
                )}
              </div>

              {/* Members List */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Team Members</label>
                  <span className="text-xs text-slate-500 font-medium">
                    {(editTeamData.teamDetails?.members?.filter(m => m.status === 'registered' || m.status === 'pending' || m.id === editTeamData.teamId.leader_id).length || 0)} 
                    / {editTeamData.eventId?.max_team_size || '∞'} Max
                  </span>
                </div>
                <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                  <ul className="divide-y divide-slate-200/60">
                    {(editTeamData.teamDetails?.members || []).map(member => {
                      const isLeader = member.id === editTeamData.teamId.leader_id;
                      // Determine if removable:
                      // Leader is not removable.
                      // If requirement: "The leader should be able to remove/replace the rejected member and invite another eligible student."
                      // They should also be able to remove a pending member. Or an accepted member if the team is still pending overall.
                      const isRemovable = !isLeader;
                      
                      return (
                        <li key={member.id} className="p-3 flex items-center justify-between hover:bg-slate-100/50 transition-colors">
                          <div>
                            <div className="text-sm font-bold text-slate-700 flex items-center gap-2">
                              {member.fullName || 'Unknown'}
                              {isLeader && <span className="text-[9px] bg-fuchsia-500/10 text-fuchsia-600 font-bold px-1.5 py-0.5 rounded uppercase border border-fuchsia-500/20">Leader</span>}
                            </div>
                            <div className="text-xs flex items-center gap-2 mt-0.5">
                              <span className={`font-bold uppercase text-[9px] px-1.5 py-0.5 rounded ${
                                member.status === 'registered' || isLeader ? 'bg-emerald-500/10 text-emerald-600' :
                                member.status === 'pending' ? 'bg-amber-500/10 text-amber-600' :
                                'bg-red-500/10 text-red-600'
                              }`}>
                                {isLeader || member.status === 'registered' ? 'Accepted' : member.status}
                              </span>
                              <span className="text-slate-400">{member.email}</span>
                            </div>
                          </div>
                          {isRemovable && (
                            <button
                              onClick={() => handleRemoveTeamMember(member.id)}
                              disabled={!!processingId}
                              className="text-xs font-bold text-red-500 hover:text-red-700 disabled:opacity-50 px-2 py-1 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-100"
                            >
                              {processingId === `remove-${member.id}` ? 'Removing...' : 'Remove'}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>

              {/* Invite External Member by Email */}
              {(() => {
                const currentCount = editTeamData.teamDetails?.members?.filter(m => m.status === 'registered' || m.status === 'pending' || m.id === editTeamData.teamId.leader_id).length || 0;
                const maxCount = editTeamData.eventId?.max_team_size || 999;
                
                if (currentCount < maxCount) {
                  return (
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Invite Member by Email</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Full Name"
                          value={editInviteName}
                          onChange={(e) => setEditInviteName(e.target.value)}
                          disabled={!!processingId}
                          className="flex-1 bg-white border border-slate-200 text-slate-800 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-500 transition-all duration-300"
                        />
                        <input
                          type="email"
                          placeholder="Email"
                          value={editInviteEmail}
                          onChange={(e) => setEditInviteEmail(e.target.value)}
                          disabled={!!processingId}
                          className="flex-1 bg-white border border-slate-200 text-slate-800 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-500 transition-all duration-300"
                        />
                        <button
                          onClick={handleInviteExternalEdit}
                          disabled={!!processingId || !editInviteName.trim() || !editInviteEmail.trim()}
                          className="px-4 py-2.5 text-xs font-bold rounded-xl bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          {editInvitingExternal ? 'Sending...' : 'Invite'}
                        </button>
                      </div>
                      {editExternalInvites.length > 0 && (
                        <div className="space-y-1.5">
                          {editExternalInvites.map((inv, i) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-violet-50/50 rounded-lg border border-violet-200/50">
                              <div className="text-xs">
                                <span className="font-bold text-slate-700">{inv.name}</span>
                                <span className="text-slate-500 ml-1">({inv.email})</span>
                                <span className="ml-1 text-violet-600 font-bold">— invite sent</span>
                              </div>
                              <button
                                onClick={() => setEditExternalInvites(editExternalInvites.filter((_, idx) => idx !== i))}
                                className="text-red-400 hover:text-red-600 text-xs font-bold px-2"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                } else {
                  return (
                    <div className="p-3 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl text-xs font-bold text-center">
                      Team has reached the maximum size ({maxCount} members).
                    </div>
                  );
                }
              })()}

              <div className="pt-4 flex justify-end">
                <button
                  onClick={() => {
                    setIsEditTeamOpen(false);
                    setEditTeamData(null);
                  }}
                  disabled={!!processingId}
                  className="px-6 py-2.5 text-sm font-bold rounded-xl btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </Modal>

        {/* QR Code Pass Modal */}
        {qrModalData && (
          <Modal
            isOpen={!!qrModalData}
            onClose={() => setQrModalData(null)}
            title="Event Pass"
          >
            <div className="flex flex-col items-center justify-center py-6 space-y-6">
              <div className="text-center">
                <h3 className="font-display font-bold text-lg text-slate-800">{qrModalData.eventId?.title}</h3>
                <p className="text-xs font-medium text-slate-500 mt-1 uppercase tracking-wider">{qrModalData.eventId?.venue} • {formatDate(qrModalData.eventId?.date)}</p>
              </div>
              <div className="bg-[#FFFFFF] dark:bg-[#FFFFFF] !bg-[#FFFFFF] p-4 rounded-xl shadow-lg border border-slate-200 flex items-center justify-center">
                <QRCodeSVG 
                  value={String(qrModalData.id || qrModalData.registration_id || qrModalData.user_id || 'EVENT_PASS')} 
                  size={200} 
                  level="H" 
                  bgColor="#FFFFFF"
                  fgColor="#000000"
                  includeMargin={false} 
                />
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-600 font-medium">Show this QR code at the venue for attendance verification.</p>
                {qrModalData.attendance_status === 'Present' && (
                  <div className="mt-4 px-4 py-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                    <span>✓</span> Attendance Verified
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setQrModalData(null)}
                className="px-5 py-2.5 text-sm font-bold rounded-xl btn-secondary"
              >
                Close
              </button>
            </div>
          </Modal>
        )}

        {/* Feedback Modal */}
        <FeedbackModal
          isOpen={isFeedbackModalOpen}
          onClose={() => setIsFeedbackModalOpen(false)}
          event={feedbackEvent}
          onSubmitSuccess={() => {
            setIsFeedbackModalOpen(false);
            setFeedback({ type: 'success', message: 'Thank you for your feedback!' });
            fetchFeedbackStatuses(); // Refresh statuses
            setTimeout(() => setFeedback(null), 4000);
          }}
        />

        {/* Problem Statement Selection Confirmation Modal */}
        {selectedPsToConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-pastel-lavender/30 p-6 max-w-md w-full shadow-2xl space-y-4 animate-scale-up">
              <div className="flex justify-between items-center pb-3 border-b border-pastel-lavender/20">
                <h4 className="font-heading font-bold text-base text-text-primary flex items-center gap-2">
                  <span>🎯 Confirm Problem Statement</span>
                </h4>
                <button 
                  onClick={() => setSelectedPsToConfirm(null)}
                  className="text-xs font-bold text-text-secondary hover:text-text-primary"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 text-xs text-text-secondary">
                <p>You are about to select the following problem statement for your entire team:</p>
                <div className="p-3.5 bg-violet-500/10 border border-violet-500/20 rounded-xl space-y-1.5">
                  <p className="font-bold text-sm text-violet-600 dark:text-violet-400">
                    {selectedPsToConfirm.ps.title}
                  </p>
                </div>
                <p className="text-amber-600 dark:text-amber-400 font-semibold pt-1">
                  ⚠️ Note: This selection will be assigned to your team and locked.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setSelectedPsToConfirm(null)}
                  disabled={isSubmittingPs}
                  className="px-4 py-2 text-xs font-bold btn-secondary rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPsSelection}
                  disabled={isSubmittingPs}
                  className="btn-primary px-5 py-2 text-xs font-bold text-white rounded-xl shadow-md disabled:opacity-50"
                >
                  {isSubmittingPs ? 'Confirming...' : 'Confirm Selection'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default StudentRegistrations;
