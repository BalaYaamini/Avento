import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import QRScanner from '../components/QRScanner';

const FacultyOrgEvents = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Scanner Modal states
  const [scannerModalEvent, setScannerModalEvent] = useState(null);
  const [scanFeedback, setScanFeedback] = useState(null);

  // Form states (Remarks only)
  const [approvalRemarks, setApprovalRemarks] = useState('');
  
  const fetchEvents = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const res = await axios.get(`/api/events/organizer/my-events?_t=${Date.now()}`);
      setEvents(res.data);
    } catch (err) {
      console.error(err);
      if (!silent) setError('Failed to fetch assigned proposals.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(() => {
      fetchEvents(true);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const openReviewModal = (event) => {
    setSelectedEvent(event);
    setApprovalRemarks('');
    setFeedback(null);
    setIsModalOpen(true);
  };

  const handleReviewAction = async (actionType) => {
    if (!selectedEvent) return;
    
    if (actionType === 'reject' && !approvalRemarks.trim()) {
      setFeedback({ type: 'error', message: 'Please provide remarks for rejection.' });
      return;
    }

    if (actionType === 'needs_revision' && !approvalRemarks.trim()) {
      setFeedback({ type: 'error', message: 'Please provide remarks specifying required revisions.' });
      return;
    }

    if (selectedEvent.status === 'needs_revision' && (actionType === 'approve' || actionType === 'reject')) {
      setFeedback({ 
        type: 'error', 
        message: 'This proposal is currently awaiting student revisions. Approval and rejection are locked until the student resubmits.' 
      });
      return;
    }

    setSubmitting(true);
    try {
      const newStatus = actionType === 'approve' ? 'approved' 
        : actionType === 'under_review' ? 'under_review' 
        : actionType === 'needs_revision' ? 'needs_revision' 
        : 'rejected';
      const eventId = selectedEvent._id || selectedEvent.id;
      const res = await axios.put(`/api/events/${eventId}/proposal-status`, {
        status: newStatus,
        remarks: approvalRemarks
      });
      setFeedback({ 
        type: 'success', 
        message: `Event proposal marked as ${newStatus.replace('_', ' ')} successfully.` 
      });

      // Update local state immediately so user sees the change right away
      const apiData = res.data || {};
      setSelectedEvent(prev => prev ? { ...prev, ...apiData, status: newStatus, approval_remarks: approvalRemarks } : prev);
      setEvents(prev => prev.map(ev => {
        if ((ev._id || ev.id) === eventId) {
          return { ...ev, ...apiData, status: newStatus, approval_remarks: approvalRemarks };
        }
        return ev;
      }));
      
      setTimeout(() => {
        setIsModalOpen(false);
        fetchEvents(true);
      }, 700);
    } catch (err) {
      console.error('[FacultyOrgEvents] handleReviewAction FAILED:', err.response?.data || err.message);
      setFeedback({ type: 'error', message: err.response?.data?.error || err.response?.data?.message || 'Failed to update event status.' });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    const options = { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
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

  return (
    <div className="flex-grow py-20 text-text-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10 animate-fade-in-up">
          <div>
            <h1 className="font-display text-3xl font-black text-text-primary">Assigned <span className="heading-gradient">Proposals</span></h1>
            <p className="font-body text-text-secondary text-sm mt-1.5">Review and coordinate event proposals for the <span className="text-violet-400 font-bold">{user?.department}</span> department</p>
          </div>
        </div>

        {/* Loading / Empty States */}
        {loading ? (
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="p-6 space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-white/20 dark:bg-slate-800/30 rounded-xl animate-pulse" />
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
            <div className="h-20 w-20 bg-white/10 dark:bg-slate-800/40 rounded-2xl flex items-center justify-center mx-auto text-text-secondary mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6M12 9v6" />
              </svg>
            </div>
            <h3 className="text-xl font-display font-bold text-text-primary mb-2">No Proposals Assigned</h3>
            <p className="text-sm font-body text-text-secondary mb-6">There are no event proposals currently assigned to you for review.</p>
          </div>
        ) : (
          /* Event Table */
          <div className="animate-fade-in-up delay-100 glass-panel rounded-2xl overflow-hidden shadow-2xl shadow-violet-500/3">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/10 dark:bg-slate-800/40 border-b border-pastel-lavender/20 text-text-secondary text-[10px] font-bold uppercase tracking-[0.1em]">
                    <th className="px-6 py-4">Event Details</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Capacity / Teams</th>
                    <th className="px-6 py-4">Date & Time</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pastel-lavender/10 text-sm font-body">
                  {events.map((evt, i) => (
                      <tr 
                      key={evt._id || evt.id} 
                      className={`transition-all duration-300 animate-fade-in-up ${['pending_approval', 'under_review', 'needs_revision'].includes(evt.status) ? 'bg-amber-900/10 hover:bg-amber-900/20' : evt.status === 'rejected' ? 'bg-red-900/5 hover:bg-red-900/10' : 'hover:bg-white/10 dark:hover:bg-slate-800/30'}`}
                      style={{ animationDelay: `${i * 40 + 150}ms` }}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={evt.image_url || evt.imageUrl} alt="" className="h-10 w-16 rounded-lg object-cover bg-white/10" />
                          <div>
                            <div className="font-display font-bold text-text-primary line-clamp-1 flex items-center gap-2">
                              {evt.title}
                              {evt.studentOrganizerId && <span className="text-[9px] bg-fuchsia-500/20 text-fuchsia-400 px-1.5 py-0.5 rounded-md uppercase tracking-wider">Student Org</span>}
                            </div>
                            <div className="text-[10px] text-text-secondary mt-0.5 font-medium">{evt.venue}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white/10 dark:bg-slate-800/40 text-text-secondary border border-pastel-lavender/20 uppercase tracking-wider">
                          {evt.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-text-secondary">
                        {evt.registration_type === 'team' ? (
                          <span className="text-text-secondary">Team Event</span>
                        ) : (
                          evt.capacity
                        )}
                      </td>
                      <td className="px-6 py-4 text-text-secondary text-xs">
                        {formatDate(evt.date)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-lg border ${
                          evt.status === 'active' || evt.status === 'published'
                            ? 'bg-emerald-500/8 text-emerald-400 border-emerald-500/15'
                            : ['pending_approval', 'under_review', 'needs_revision'].includes(evt.status)
                              ? 'bg-amber-500/8 text-amber-400 border-amber-500/15 animate-pulse'
                              : evt.status === 'approved'
                                ? 'bg-sky-500/8 text-sky-400 border-sky-500/15'
                                : evt.status === 'rejected'
                                  ? 'bg-red-500/8 text-red-400 border-red-500/15'
                                  : 'bg-slate-500/8 text-slate-400 border-slate-500/15'
                        }`}>
                          {(evt.status || 'draft').replace(/_/g, ' ')}
                        </span>
                        {/* Resubmission indicator */}
                        {(evt.revision_number || 1) > 1 && ['pending_approval', 'under_review'].includes(evt.status) && (
                          <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                            Rev {evt.revision_number} • Resubmitted
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end flex-wrap gap-2">
                          {!['published', 'active', 'completed'].includes(evt.status) && (
                            <Link
                              to={`/proposals/${evt._id || evt.id}`}
                              className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-500/20 transition-all duration-300"
                            >
                              {['pending_approval', 'under_review', 'needs_revision'].includes(evt.status) ? 'Review & Discuss' : 'Proposal & Discuss'}
                            </Link>
                          )}

                          {['pending_approval', 'under_review'].includes(evt.status) && (
                            <button
                              onClick={() => openReviewModal(evt)}
                              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all duration-300 cursor-pointer ${
                                (evt.revision_number || 1) > 1
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 animate-pulse'
                                  : 'bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20'
                              }`}
                            >
                              {(evt.revision_number || 1) > 1 ? 'Review Resubmission' : 'Quick Decision'}
                            </button>
                          )}

                          {evt.status === 'needs_revision' && (
                            <span className="px-3 py-1.5 text-xs font-bold rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
                              Awaiting Resubmission
                            </span>
                          )}

                          {['published', 'active', 'completed'].includes(evt.status) && (
                            <Link
                              to={`/workspace/${evt._id || evt.id}`}
                              className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all duration-300"
                            >
                              Workspace
                            </Link>
                          )}

                          {['approved', 'published', 'active'].includes(evt.status) && (
                            <button
                              onClick={() => {
                                setScanFeedback(null);
                                setScannerModalEvent(evt);
                              }}
                              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20 transition-all duration-300"
                            >
                              Scan QR
                            </button>
                          )}

                          {evt.status === 'published' && <span className="text-xs text-emerald-400 font-semibold italic px-1">Published</span>}
                        </div>
                        {evt.status === 'rejected' && evt.approval_remarks && (
                          <div className="text-[9px] text-red-400 mt-1 text-right max-w-[180px] ml-auto truncate" title={evt.approval_remarks}>
                            Remarks: {evt.approval_remarks}
                          </div>
                        )}
                        {evt.status === 'needs_revision' && evt.approval_remarks && (
                          <div className="text-[9px] text-orange-400 mt-1 text-right max-w-[200px] ml-auto truncate font-medium" title={evt.approval_remarks}>
                            Revision: {evt.approval_remarks}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Review Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Review Student Proposal"
        >
          {feedback && (
            <div className={`mb-6 p-4 rounded-xl border text-sm font-semibold flex items-center gap-2.5 animate-fade-in-up ${
              feedback.type === 'success' ? 'bg-emerald-500/8 border-emerald-500/15 text-emerald-400' : 'bg-red-500/8 border-red-500/15 text-red-400'
            }`}>
              {feedback.type === 'success' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {selectedEvent && (
            <div className="space-y-5">
              {/* Resubmission Alert in Modal */}
              {(selectedEvent.revision_number || 1) > 1 && ['pending_approval', 'under_review'].includes(selectedEvent.status) && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs flex items-start gap-3 animate-fade-in-up">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <div className="space-y-1">
                    <div className="font-bold text-emerald-300 text-sm flex items-center gap-2">
                      Student Resubmitted — Revision {selectedEvent.revision_number}
                      <span className="px-2 py-0.5 text-[9px] uppercase font-bold tracking-wider rounded-full bg-emerald-500/30 text-emerald-200 animate-pulse">New</span>
                    </div>
                    <p className="text-text-secondary">
                      The student addressed your revision feedback and resubmitted. Please re-evaluate before making a decision.
                    </p>
                  </div>
                </div>
              )}

              <div className="p-4 bg-white/10 dark:bg-slate-800/40 rounded-xl border border-pastel-lavender/20">
                <h3 className="font-display text-lg font-bold text-text-primary mb-2">{selectedEvent.title}</h3>
                <p className="text-sm text-text-secondary mb-4">{selectedEvent.description}</p>
                <div className="grid grid-cols-2 gap-4 text-xs text-text-secondary">
                  <div><strong className="text-text-primary">Category:</strong> {selectedEvent.category}</div>
                  <div><strong className="text-text-primary">Venue:</strong> {selectedEvent.venue}</div>
                  <div><strong className="text-text-primary">Date:</strong> {formatDate(selectedEvent.date)}</div>
                  <div><strong className="text-text-primary">{selectedEvent.registration_type === 'team' ? 'Team Limit:' : 'Number of Slots:'}</strong> {selectedEvent.registration_type === 'team' ? `${selectedEvent.max_teams} teams` : selectedEvent.capacity}</div>
                </div>
              </div>
              
              {selectedEvent.status === 'needs_revision' ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-xs flex items-start gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="space-y-1">
                      <div className="font-bold text-orange-300 text-sm">Proposal Under Revision — Actions Locked</div>
                      <p className="text-text-secondary">
                        You have requested revisions for this proposal. Approval and rejection decisions are locked until the student organizer resubmits their revised proposal.
                      </p>
                      {selectedEvent.approval_remarks && (
                        <div className="mt-2.5 p-3 bg-black/25 rounded-xl border border-orange-500/20 text-text-primary">
                          <span className="font-bold text-orange-300">Requested Revisions: </span>
                          <span>{selectedEvent.approval_remarks}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-4 border-t border-slate-200/30">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 text-xs font-bold rounded-xl btn-secondary cursor-pointer"
                    >
                      Close
                    </button>
                    <Link
                      to={`/proposals/${selectedEvent._id || selectedEvent.id}`}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      Open Discussion & Review
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.1em] mb-2">Approval Remarks (Optional for Approve, Required for Reject/Revision)</label>
                    <textarea
                      rows={3}
                      value={approvalRemarks}
                      onChange={(e) => setApprovalRemarks(e.target.value)}
                      placeholder="Feedback or revision instructions for the student organizer..."
                      className="w-full bg-white/10 dark:bg-slate-800/40 text-text-primary border border-pastel-lavender/20 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300 resize-none"
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-5 border-t border-slate-200/30 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 text-xs font-bold rounded-xl btn-secondary cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReviewAction('under_review')}
                      disabled={submitting}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      {submitting ? 'Processing...' : 'Mark Under Review'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReviewAction('needs_revision')}
                      disabled={submitting}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-orange-500/20 text-orange-300 border border-orange-500/30 hover:bg-orange-500/30 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      {submitting ? 'Processing...' : 'Request Revision'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReviewAction('reject')}
                      disabled={submitting}
                      className="px-4 py-2 text-xs font-bold btn-danger disabled:opacity-50 cursor-pointer"
                    >
                      {submitting ? 'Processing...' : 'Reject Proposal'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReviewAction('approve')}
                      disabled={submitting}
                      className="btn-primary px-5 py-2 text-xs font-display font-bold rounded-xl text-white shadow-lg shadow-violet-500/15 disabled:opacity-50 cursor-pointer"
                    >
                      {submitting ? 'Processing...' : 'Approve Proposal'}
                    </button>
                  </div>
                </>
              )}
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
                  {scanFeedback.type === 'success' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

export default FacultyOrgEvents;
