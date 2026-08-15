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
  
  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get('/api/events/organizer/my-events');
      setEvents(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch assigned proposals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const openReviewModal = (event) => {
    setSelectedEvent(event);
    setApprovalRemarks('');
    setFeedback(null);
    setIsModalOpen(true);
  };

  const handleReviewAction = async (actionType) => {
    if (!selectedEvent) return;
    
    if (actionType === 'reject' && !approvalRemarks) {
      setFeedback({ type: 'error', message: 'Please provide remarks for rejection.' });
      return;
    }

    setSubmitting(true);
    try {
      const newStatus = actionType === 'approve' ? 'approved' : 'rejected';
      await axios.put(`/api/events/${selectedEvent._id || selectedEvent.id}/status`, {
        status: newStatus,
        approvalRemarks
      });
      setFeedback({ type: 'success', message: `Event proposal ${actionType === 'approve' ? 'approved' : 'rejected'} successfully.` });
      
      setTimeout(() => {
        setIsModalOpen(false);
        fetchEvents();
      }, 1000);
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to update event status.' });
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
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/workspace/${evt._id || evt.id}`}
                            className="px-4 py-1.5 text-[10px] font-bold rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all duration-300 mr-2"
                          >
                            Workspace
                          </Link>
                          {evt.status === 'published' && <span className="text-xs text-emerald-400 font-semibold italic px-2">Published</span>}
                        </div>
                        {evt.status === 'rejected' && evt.approval_remarks && (
                          <div className="text-[9px] text-red-400 mt-1 text-right max-w-[160px] ml-auto truncate" title={evt.approval_remarks}>
                            {evt.approval_remarks}
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
            <div className={`mb-6 p-4 rounded-xl border text-sm font-semibold flex gap-2.5 animate-fade-in-up ${
              feedback.type === 'success' ? 'bg-emerald-500/8 border-emerald-500/15 text-emerald-400' : 'bg-red-500/8 border-red-500/15 text-red-400'
            }`}>
              <span>{feedback.type === 'success' ? '✓' : '⚠'}</span>
              <span>{feedback.message}</span>
            </div>
          )}

          {selectedEvent && (
            <div className="space-y-5">
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
              
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.1em] mb-2">Approval Remarks (Optional for Approve, Required for Reject)</label>
                <textarea
                  rows={3}
                  value={approvalRemarks}
                  onChange={(e) => setApprovalRemarks(e.target.value)}
                  placeholder="Feedback for the student organizer..."
                  className="w-full bg-white/10 dark:bg-slate-800/40 text-text-primary border border-pastel-lavender/20 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300 resize-none"
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
                  type="button"
                  onClick={() => handleReviewAction('reject')}
                  disabled={submitting}
                  className="px-5 py-2.5 text-xs font-bold btn-danger disabled:opacity-50"
                >
                  {submitting ? 'Processing...' : 'Reject Proposal'}
                </button>
                <button
                  type="button"
                  onClick={() => handleReviewAction('approve')}
                  disabled={submitting}
                  className="btn-primary px-6 py-2.5 text-xs font-display font-bold rounded-xl text-white shadow-lg shadow-violet-500/15 disabled:opacity-50"
                >
                  {submitting ? 'Processing...' : 'Approve Proposal'}
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

export default FacultyOrgEvents;
