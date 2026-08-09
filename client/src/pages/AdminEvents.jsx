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

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Technical');
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState('');
  const [capacity, setCapacity] = useState('50');
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState('active');

  const [posterOption, setPosterOption] = useState('upload'); // 'upload', 'url'
  const [posterFile, setPosterFile] = useState(null);
  const [posterPreview, setPosterPreview] = useState('');

  const [registrationType, setRegistrationType] = useState('individual');
  const [maxTeams, setMaxTeams] = useState('');
  const [minTeamSize, setMinTeamSize] = useState('1');
  const [maxTeamSize, setMaxTeamSize] = useState('4');
  const [allowCrossDepartment, setAllowCrossDepartment] = useState(true);
  const [registrationDeadline, setRegistrationDeadline] = useState('');

  const categories = ['Technical', 'Cultural', 'Sports', 'Workshop', 'Seminar'];

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

  useEffect(() => {
    fetchEvents();
  }, []);

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
    setStatus('active');
    setRegistrationType('individual');
    setMaxTeams('');
    setMinTeamSize('1');
    setMaxTeamSize('4');
    setAllowCrossDepartment(true);
    setRegistrationDeadline('');
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
    
    // Format date string to fit datetime-local input (YYYY-MM-DDTHH:MM)
    if (event.date) {
      const d = new Date(event.date);
      // Offset local timezone shift
      const tzOffset = d.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
      setDate(localISOTime);
    } else {
      setDate('');
    }
    
    setCapacity(String(event.capacity || 50));
    setPosterOption(event.image_url || event.imageUrl ? 'url' : 'upload');
    setPosterFile(null);
    setPosterPreview('');
    setImageUrl(event.imageUrl || event.image_url || '');
    setStatus(event.status || 'active');

    setRegistrationType(event.registration_type || 'individual');
    setMaxTeams(event.max_teams ? String(event.max_teams) : '');
    setMinTeamSize(event.min_team_size ? String(event.min_team_size) : '1');
    setMaxTeamSize(event.max_team_size ? String(event.max_team_size) : '4');
    setAllowCrossDepartment(event.allow_cross_department ?? true);
    
    if (event.registration_deadline) {
      const d = new Date(event.registration_deadline);
      const tzOffset = d.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
      setRegistrationDeadline(localISOTime);
    } else {
      setRegistrationDeadline('');
    }

    setFeedback(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);

    if (!title || !description || !category || !venue || !date || (registrationType === 'individual' && !capacity)) {
      setFeedback({ type: 'error', message: 'Please enter all required fields.' });
      return;
    }

    setSubmitting(true);
    
    let finalImageUrl = imageUrl;
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
        date,
        capacity: registrationType === 'team' ? undefined : Number(capacity),
        imageUrl: finalImageUrl || undefined,
        status,
        registrationType,
        maxTeams: registrationType === 'team' ? Number(maxTeams) : undefined,
        minTeamSize: registrationType === 'team' ? Number(minTeamSize) : undefined,
        maxTeamSize: registrationType === 'team' ? Number(maxTeamSize) : undefined,
        allowCrossDepartment: registrationType === 'team' ? allowCrossDepartment : undefined,
        registrationDeadline: registrationDeadline || undefined,
      };

      if (modalMode === 'create') {
        await axios.post('/api/events', eventData);
        setFeedback({ type: 'success', message: 'Event created successfully!' });
      } else {
        await axios.put(`/api/events/${selectedEventId}`, eventData);
        setFeedback({ type: 'success', message: 'Event updated successfully!' });
      }

      // Close modal on success and refresh list
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

  const handleDelete = async (eventId, title) => {
    if (!window.confirm(`Are you sure you want to delete the event: "${title}"?\nThis will permanently delete all associated registrations.`)) {
      return;
    }

    try {
      await axios.delete(`/api/events/${eventId}`);
      setEvents(prev => prev.filter(e => (e._id || e.id) !== eventId));
      alert('Event deleted successfully.');
    } catch (err) {
      console.error(err);
      alert('Failed to delete event.');
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

  return (
    <div className="flex-grow py-20 text-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10 animate-fade-in-up">
          <div>
            <h1 className="font-display text-3xl font-black text-text-primary">Configure <span className="heading-gradient">Events</span></h1>
            <p className="font-body text-slate-600 text-sm mt-1.5">Publish, edit, and withdraw campus events</p>
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
                    <th className="px-6 py-4">Date & Time</th>
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
                          <img src={evt.imageUrl} alt="" className="h-10 w-16 rounded-lg object-cover bg-white/50" />
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
                            {evt.registeredCount} / {evt.capacity}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-xs">
                        {formatDate(evt.date)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-lg border ${
                          evt.status === 'active' 
                            ? 'bg-emerald-500/8 text-emerald-400 border-emerald-500/15' 
                            : evt.status === 'completed'
                              ? 'bg-blue-500/8 text-blue-400 border-blue-500/15'
                              : 'bg-red-500/8 text-red-400 border-red-500/15'
                        }`}>
                          {evt.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {(evt.status === 'active' || evt.status === 'published' || evt.status === 'completed') && (
                          <>
                            {new Date(evt.date) >= new Date() && (
                              <button
                                onClick={() => {
                                  setScanFeedback(null);
                                  setScannerModalEvent(evt);
                                }}
                                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-teal-500/10 text-teal-500 border border-teal-500/20 hover:bg-teal-500/20 transition-all duration-300 inline-block align-middle mr-2"
                              >
                                Scan QR
                              </button>
                            )}
                            <Link
                              to={`/workspace/${evt._id || evt.id}`}
                              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all duration-300 inline-block align-middle"
                            >
                              Workspace
                            </Link>
                          </>
                        )}
                        <button
                          onClick={() => openEditModal(evt)}
                          className="px-4 py-1.5 text-xs font-bold rounded-lg btn-secondary"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(evt._id || evt.id, evt.title)}
                          className="px-4 py-1.5 text-xs font-bold rounded-lg bg-red-500/8 text-red-400 border border-red-500/15 hover:bg-red-500/15 hover:border-red-500/30 transition-all duration-300"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create / Edit Event Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={modalMode === 'create' ? 'Publish Campus Event' : 'Modify Event Settings'}
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

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-white/60 text-slate-700 border border-slate-300/50 rounded-xl px-3 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300 cursor-pointer"
                >
                  <option value="active">Active (Open)</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
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
                ) : modalMode === 'create' ? 'Publish Event' : 'Save Changes'}
              </button>
            </div>
          </form>
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

export default AdminEvents;
