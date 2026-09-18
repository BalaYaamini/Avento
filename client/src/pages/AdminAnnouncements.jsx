import { useEffect, useState } from 'react';
import axios from 'axios';
import { supabase } from '../context/AuthContext';

const emptyForm = { title: '', message: '', audience: 'all', status: 'published', eventId: '', eventName: '' };

const AdminAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({ ...emptyForm, imageUrl: '' });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/announcements/admin');
      setAnnouncements(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch announcements.');
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      const res = await axios.get('/api/events');
      setEvents(res.data || []);
    } catch {}
  };

  useEffect(() => { fetchAnnouncements(); fetchEvents(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, imageUrl: '' });
    setImageFile(null);
    setImagePreview('');
    setError('');
    setIsModalOpen(true);
  };

  const openEdit = (announcement) => {
    setEditingId(announcement.id);
    setForm({ title: announcement.title, message: announcement.message, imageUrl: announcement.imageUrl || '', audience: announcement.audience, status: announcement.status, eventId: announcement.eventId || '', eventName: announcement.eventName || '' });
    setImageFile(null);
    setImagePreview(announcement.imageUrl || '');
    setError('');
    setIsModalOpen(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.message.trim()) return setError('Please enter a title and message.');
    if (form.title.trim().length > 140) return setError('Title cannot exceed 140 characters.');
    if (form.message.trim().length > 5000) return setError('Message cannot exceed 5000 characters.');
    
    try {
      setSubmitting(true);
      setError('');
      let imageUrl = form.imageUrl || '';
      if (imageFile) {
        if (imageFile.size > 5 * 1024 * 1024) throw new Error('Announcement image must be less than 5MB.');
        const ext = imageFile.name.split('.').pop();
        const path = `announcement-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('posters').upload(path, imageFile);
        if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);
        imageUrl = supabase.storage.from('posters').getPublicUrl(path).data.publicUrl;
      }
      const payload = {
        title: form.title.trim(),
        message: form.message.trim(),
        imageUrl: imageUrl || '',
        audience: form.audience || 'all',
        status: form.status || 'published',
        eventId: form.eventId || '',
        eventName: form.eventName || ''
      };
      if (editingId) await axios.put(`/api/announcements/${editingId}`, payload);
      else await axios.post('/api/announcements', payload);
      setIsModalOpen(false);
      await fetchAnnouncements();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to save announcement.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await axios.delete(`/api/announcements/${id}`);
      setAnnouncements(items => items.filter(item => item.id !== id));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete announcement.');
    }
  };

  const filteredAnnouncements = announcements.filter(a => {
    if (filter === 'event') return !!a.eventId;
    if (filter === 'public') return !a.eventId;
    return true;
  });

  return (
    <div className="flex-grow py-20 text-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10 animate-fade-in-up">
          <div>
            <h1 className="font-display text-3xl font-black text-text-primary">Configure <span className="heading-gradient">Announcements</span></h1>
            <p className="font-body text-slate-600 text-sm mt-1.5">Create drafts, publish to events, and manage campus announcements</p>
          </div>
          <button
            onClick={openCreate}
            className="btn-primary px-6 py-3 text-xs font-display font-bold rounded-xl text-white shadow-lg shadow-violet-500/15 self-start"
          >
            + Create Announcement
          </button>
        </div>

        <div className="flex gap-3 mb-8 animate-fade-in-up delay-100">
          {[['all', 'All'], ['event', 'Event Posts'], ['public', 'Public Posts']].map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} className={`px-5 py-2 text-xs font-bold rounded-xl transition-all ${filter === key ? 'bg-violet-100 text-violet-700 border border-violet-200' : 'bg-white/50 text-slate-500 border border-slate-200 hover:bg-white/80'}`}>{label}</button>
          ))}
        </div>

        {error && !isModalOpen && (
          <div className="text-center py-20 animate-fade-in-up">
            <p className="text-red-400 font-bold mb-3">{error}</p>
            <button onClick={fetchAnnouncements} className="btn-primary px-6 py-2.5 text-sm font-bold rounded-xl text-white">Retry</button>
          </div>
        )}

        {!error && (
          loading ? (
            <div className="glass-panel rounded-2xl overflow-hidden">
              <div className="p-6 space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-16 bg-white/20 rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
          ) : filteredAnnouncements.length === 0 ? (
            <div className="text-center py-24 glass-panel rounded-2xl animate-fade-in-scale">
              <div className="h-20 w-20 bg-white/50 rounded-2xl flex items-center justify-center mx-auto text-slate-600 mb-5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <h3 className="text-xl font-display font-bold text-slate-800 mb-2">No Announcements Found</h3>
              <p className="text-sm font-body text-slate-600 mb-6">Create your first announcement to get started.</p>
              <button onClick={openCreate} className="btn-primary px-6 py-2.5 text-xs font-display font-bold rounded-xl text-white">Create Announcement</button>
            </div>
          ) : (
            <div className="animate-fade-in-up delay-100 glass-panel rounded-2xl overflow-hidden shadow-2xl shadow-violet-500/3">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/40 border-b border-slate-200/40 text-slate-600 text-[10px] font-bold uppercase tracking-[0.1em]">
                      <th className="px-6 py-4">Announcement</th>
                      <th className="px-6 py-4">Event</th>
                      <th className="px-6 py-4">Audience</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/30 text-sm font-body">
                    {filteredAnnouncements.map((item, i) => (
                      <tr
                        key={item.id}
                        className="hover:bg-white/20 transition-all duration-300 animate-fade-in-up"
                        style={{ animationDelay: `${i * 40 + 150}ms` }}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt="" className="h-10 w-16 rounded-lg object-cover bg-white/50" />
                            ) : (
                              <div className="h-10 w-16 rounded-lg bg-violet-50 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                              </div>
                            )}
                            <div>
                              <div className="font-display font-bold text-slate-800 line-clamp-1">{item.title}</div>
                              <div className="text-[10px] text-slate-600 mt-0.5 font-medium line-clamp-1">{item.message}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {item.eventName ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-50 text-violet-700 text-[10px] font-bold uppercase tracking-wider">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              {item.eventName}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider">Public</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${item.audience === 'registered' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {item.audience === 'registered' ? 'Registered' : 'All'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${item.status === 'published' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{item.status}</span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600 whitespace-nowrap">{new Date(item.createdAt).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openEdit(item)} className="btn-secondary px-4 py-2 text-xs font-bold rounded-xl">Edit</button>
                            <button onClick={() => remove(item.id)} className="px-4 py-2 text-xs font-bold rounded-xl text-red-500 hover:bg-red-50">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </div>

      {isModalOpen && <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4">
        <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex justify-between items-center flex-shrink-0"><h2 className="text-lg sm:text-xl font-heading font-bold text-text-primary">{editingId ? 'Edit Announcement' : 'Create Announcement'}</h2><button onClick={() => setIsModalOpen(false)} className="text-2xl text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center">&times;</button></div>
          <form onSubmit={submit} className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1 min-h-0">
            {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-600 px-4 py-3 text-sm">{error}</div>}
            <label className="block"><span className="text-sm font-bold text-slate-700">Title</span><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} maxLength={140} className="mt-2 w-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-400 rounded-xl" placeholder="Announcement title" /></label>
            <label className="block"><span className="text-sm font-bold text-slate-700">Message</span><textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} maxLength={5000} rows={4} className="mt-2 w-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-400 rounded-xl resize-none" placeholder="Write the update for your users..." /></label>
            <div><span className="text-sm font-bold text-slate-700">Image (optional)</span><input type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0]; setImageFile(file || null); setImagePreview(file ? URL.createObjectURL(file) : form.imageUrl || ''); }} className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-violet-50 file:px-4 file:py-2 file:font-bold file:text-violet-700 hover:file:bg-violet-100" />{imagePreview && <img src={imagePreview} alt="Preview" className="mt-3 h-28 sm:h-32 w-full rounded-xl object-cover" />}</div>
            <label className="block"><span className="text-sm font-bold text-slate-700">Attach to Event (optional)</span><select value={form.eventId} onChange={e => { const opt = e.target.options[e.target.selectedIndex]; setForm({ ...form, eventId: e.target.value, eventName: opt.dataset.name || '' }); }} className="mt-2 w-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-400 rounded-xl"><option value="">No event — Public announcement</option>{events.map(ev => <option key={ev._id || ev.id} value={ev._id || ev.id} data-name={ev.title}>{ev.title}</option>)}</select></label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><label className="block"><span className="text-sm font-bold text-slate-700">Audience</span><select value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })} className="mt-2 w-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-400 rounded-xl"><option value="all">All participants</option><option value="registered">Registered users</option></select></label><label className="block"><span className="text-sm font-bold text-slate-700">Visibility</span><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="mt-2 w-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-400 rounded-xl"><option value="published">Publish now</option><option value="draft">Save as draft</option></select></label></div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2 pb-2 sm:pb-0 flex-shrink-0"><button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary px-5 py-2.5 text-sm font-bold rounded-xl w-full sm:w-auto">Cancel</button><button disabled={submitting} className="btn-primary px-6 py-2.5 text-sm font-bold rounded-xl text-white w-full sm:w-auto">{submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Post Announcement'}</button></div>
          </form>
        </div>
      </div>}
    </div>
  );
};

export default AdminAnnouncements;
