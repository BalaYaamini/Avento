import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Modal from '../components/Modal';
import FeedbackModal from '../components/FeedbackModal';
import { QRCodeSVG } from 'qrcode.react';

const StudentRegistrations = () => {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [isConfirmCancelOpen, setIsConfirmCancelOpen] = useState(false);
  const [confirmCancelReg, setConfirmCancelReg] = useState(null);
  const [teamModalData, setTeamModalData] = useState(null);
  const [qrModalData, setQrModalData] = useState(null);
  
  // Feedback states
  const [feedbackStatuses, setFeedbackStatuses] = useState({});
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackEvent, setFeedbackEvent] = useState(null);

  // Organizer Requests state
  const [activeSubTab, setActiveSubTab] = useState('registrations');
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [withdrawRequestObj, setWithdrawRequestObj] = useState(null);
  const [withdrawingId, setWithdrawingId] = useState(null);

  const fetchRegistrations = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get('/api/registrations/my-registrations');
      setRegistrations(res.data);
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
  }, []);

  useEffect(() => {
    if (activeSubTab === 'requests') {
      fetchRequests();
    }
  }, [activeSubTab]);

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
      setFeedback({ type: 'success', message: 'Team invitation accepted.' });
      setRegistrations(prev => prev.map(r => r.id === regId ? { ...r, status: 'registered' } : r));
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to accept invitation.' });
    } finally {
      setProcessingId(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleRejectInvitation = async (regId) => {
    setProcessingId(regId);
    setFeedback(null);
    try {
      await axios.post(`/api/registrations/${regId}/reject`);
      setFeedback({ type: 'success', message: 'Team invitation rejected.' });
      setRegistrations(prev => prev.filter(r => r.id !== regId));
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to reject invitation.' });
    } finally {
      setProcessingId(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const formatDate = (dateString) => {
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

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
          <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 animate-fade-in-up ${
            feedback.type === 'success' 
              ? 'bg-emerald-500/8 border-emerald-500/15 text-emerald-400' 
              : 'bg-red-500/8 border-red-500/15 text-red-400'
          }`}>
            <span className="text-lg">{feedback.type === 'success' ? '✓' : '⚠'}</span>
            <span className="text-sm font-semibold">{feedback.message}</span>
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
            {registrations.filter(r => r.status === 'pending').length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {registrations.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSubTab('requests')}
            className={`px-5 py-2.5 rounded-xl text-xs font-display font-bold transition-all duration-300 ${
              activeSubTab === 'requests'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                : 'bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white'
            }`}
          >
            My Organizer Requests
          </button>
        </div>

        {/* Sub-tab: Registrations list */}
        {activeSubTab === 'registrations' && (
          <>
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
            ) : registrations.filter(r => r.status !== 'pending' && r.status !== 'expired').length === 0 ? (
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
                {registrations.filter(r => r.status !== 'pending' && r.status !== 'expired').map((reg, i) => {
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
                              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl border bg-emerald-500/8 text-emerald-500 border-emerald-500/15 flex items-center gap-1.5">
                                ✓ Registered
                              </span>
                              <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wider mt-1">
                                {evt.category}
                              </span>
                            </div>
                          </div>
                          
                          <div className="mt-4 text-xs text-slate-500 font-medium italic">
                            Booked on {new Date(reg.registrationDate).toLocaleDateString()}
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
                        ) : (
                          <button
                            onClick={() => setQrModalData(reg)}
                            className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20 hover:bg-blue-500/20 transition-all duration-300"
                          >
                            View Pass
                          </button>
                        )}
                        {reg.teamId && (
                          <button
                            onClick={() => setTeamModalData(reg)}
                            className="px-5 py-2 text-xs font-bold rounded-xl bg-fuchsia-500/10 text-fuchsia-600 border border-fuchsia-500/20 hover:bg-fuchsia-500/20 transition-all duration-300"
                          >
                            View Team
                          </button>
                        )}
                        {evt.status !== 'completed' && (
                          <button
                            onClick={() => openConfirmCancel(reg)}
                            disabled={cancellingId === reg.id}
                            className="px-5 py-2 text-xs font-bold rounded-xl bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20 transition-all duration-300 disabled:opacity-50"
                          >
                            {cancellingId === reg.id ? 'Cancelling...' : 'Cancel Seat'}
                          </button>
                        )}
                      </div>
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
            ) : registrations.filter(r => r.status === 'pending').length === 0 ? (
              <div className="text-center py-24 glass-panel rounded-2xl animate-fade-in-scale">
                <div className="h-20 w-20 bg-white/50 rounded-2xl flex items-center justify-center mx-auto text-slate-600 mb-5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-display font-bold text-slate-800 mb-2">No Pending Invitations</h3>
                <p className="text-sm font-body text-slate-600 max-w-sm mx-auto mb-6">You don't have any pending team invitations right now.</p>
              </div>
            ) : (
              <div className="animate-fade-in-up delay-100 flex flex-col gap-5 mb-10">
                {registrations.filter(r => r.status === 'pending').map((reg, i) => {
                  const evt = reg.eventId;
                  const teamName = reg.teamId?.name || 'A team';
                  
                  if (!evt) return null;

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
                              <h3 className="font-display font-bold text-xl text-slate-800 line-clamp-1">{evt.title}</h3>
                              <p className="text-sm font-body text-slate-600 mt-2">
                                You have been invited to join <span className="font-bold text-fuchsia-600">{teamName}</span> for this event.
                              </p>
                              {evt.registration_deadline && (
                                <p className="text-xs font-bold text-red-500 mt-2 flex items-center gap-1">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Deadline: {formatDate(evt.registration_deadline)}
                                </p>
                              )}
                            </div>
                            
                            <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl border bg-amber-500/8 text-amber-600 border-amber-500/15 flex items-center gap-1.5">
                                Pending Approval
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="h-px bg-slate-200/60 my-5 w-full" />

                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <button
                          onClick={() => handleRejectInvitation(reg.id)}
                          disabled={processingId === reg.id}
                          className="px-5 py-2 text-xs font-bold rounded-xl bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20 transition-all duration-300 disabled:opacity-50"
                        >
                          {processingId === reg.id ? 'Processing...' : 'Decline'}
                        </button>
                        <button
                          onClick={() => handleAcceptInvitation(reg.id)}
                          disabled={processingId === reg.id}
                          className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-500 text-white border border-emerald-600 hover:bg-emerald-600 transition-all duration-300 disabled:opacity-50"
                        >
                          {processingId === reg.id ? 'Processing...' : 'Accept Invitation'}
                        </button>
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
                      {member.id === teamModalData.teamDetails?.leader_id && (
                        <span className="text-[10px] text-fuchsia-400 font-bold uppercase">Leader</span>
                      )}
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
                <QRCodeSVG value={qrModalData.id} size={200} />
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

      </div>
    </div>
  );
};

export default StudentRegistrations;
