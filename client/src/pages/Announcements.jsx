import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const Announcements = () => {
  const { announcementId } = useParams();
  const [announcements, setAnnouncements] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [unreadData, setUnreadData] = useState({ totalUnread: 0, byEvent: [] });
  const [openAnnouncement, setOpenAnnouncement] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [annRes, regRes, unreadRes] = await Promise.all([
        axios.get('/api/announcements'),
        axios.get('/api/registrations/my-registrations').catch(() => ({ data: [] })),
        axios.get('/api/announcements/unread-summary')
      ]);
      setAnnouncements(annRes.data || []);
      setRegistrations(regRes.data || []);
      setUnreadData(unreadRes.data || { totalUnread: 0, byEvent: [] });
    } catch {
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (announcementId && announcements.length > 0) {
      const match = announcements.find(a => a.id === announcementId);
      if (match) {
        setOpenAnnouncement(match);
        if (!match.isRead) markAsRead(match.id);
      }
    }
  }, [announcementId, announcements]);

  const registeredEvents = registrations.reduce((acc, reg) => {
    const eid = reg.event_id || reg.eventId?.id || reg.eventId?._id;
    const name = reg.eventTitle || reg.eventId?.title || '';
    if (eid && !acc.find(e => e.id === eid)) acc.push({ id: eid, name });
    return acc;
  }, []);

  const unreadSet = new Set(unreadData.byEvent.map(b => b.eventId));
  const unreadCountMap = {};
  unreadData.byEvent.forEach(b => { unreadCountMap[b.eventId] = b.count; });

  const eventAnnouncements = announcements.filter(a => a.eventId);
  const publicAnnouncements = announcements.filter(a => !a.eventId);

  const eventGroups = {};
  eventAnnouncements.forEach(a => {
    if (!eventGroups[a.eventId]) eventGroups[a.eventId] = { eventId: a.eventId, eventName: a.eventName, items: [] };
    eventGroups[a.eventId].items.push(a);
  });

  const displayEvents = registeredEvents.filter(e => eventGroups[e.id]);

  const markAsRead = async (announcementId) => {
    try {
      await axios.post(`/api/announcements/${announcementId}/read`);
      setAnnouncements(prev => prev.map(a => a.id === announcementId ? { ...a, isRead: true } : a));
      setUnreadData(prev => {
        const newByEvent = [];
        let total = 0;
        prev.byEvent.forEach(b => {
          const removedItem = eventAnnouncements.find(a => a.id === announcementId && a.eventId === b.eventId);
          const newCount = removedItem ? b.count - 1 : b.count;
          if (newCount > 0) { newByEvent.push({ ...b, count: newCount }); total += newCount; }
          else total += 0;
        });
        return { totalUnread: Math.max(0, prev.totalUnread - 1), byEvent: newByEvent };
      });
    } catch {}
  };

  const markEventAllRead = async (eventId) => {
    try {
      await axios.post(`/api/announcements/event/${eventId}/read-all`);
      setAnnouncements(prev => prev.map(a => a.eventId === eventId ? { ...a, isRead: true } : a));
      setUnreadData(prev => ({
        totalUnread: Math.max(0, prev.totalUnread - (unreadCountMap[eventId] || 0)),
        byEvent: prev.byEvent.filter(b => b.eventId !== eventId)
      }));
    } catch {}
  };

  const openModal = async (item) => {
    setOpenAnnouncement(item);
    if (!item.isRead) await markAsRead(item.id);
  };

  const closeModal = () => setOpenAnnouncement(null);

  const viewEvent = async (eventId) => {
    setSelectedEvent(eventId);
    setActiveTab('event');
  };

  const viewAll = () => {
    setSelectedEvent(null);
    setActiveTab('all');
  };

  const viewPublic = () => {
    setSelectedEvent(null);
    setActiveTab('public');
  };

  const filteredAnnouncements = activeTab === 'event' && selectedEvent
    ? eventGroups[selectedEvent]?.items || []
    : activeTab === 'public'
    ? publicAnnouncements
    : announcements;

  if (loading) {
    return (
      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-24 text-text-secondary">Loading announcements...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow py-20 text-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="mb-10 animate-fade-in-up">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-pastel-coral mb-2">Stay informed</p>
          <h1 className="font-display text-3xl font-black text-text-primary">Announcements</h1>
          <p className="font-body text-slate-600 text-sm mt-1.5">The latest updates from the Avento administration.</p>
        </div>

        <div className="flex gap-3 mb-8 animate-fade-in-up delay-100 flex-wrap">
          <button onClick={viewAll} className={`px-5 py-2 text-xs font-bold rounded-xl transition-all ${activeTab === 'all' ? 'bg-violet-100 text-violet-700 border border-violet-200' : 'bg-white/50 text-slate-500 border border-slate-200 hover:bg-white/80'}`}>
            All
            {unreadData.totalUnread > 0 && <span className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold text-white bg-red-500 rounded-full">{unreadData.totalUnread}</span>}
          </button>
          <button onClick={viewPublic} className={`px-5 py-2 text-xs font-bold rounded-xl transition-all ${activeTab === 'public' && !selectedEvent ? 'bg-violet-100 text-violet-700 border border-violet-200' : 'bg-white/50 text-slate-500 border border-slate-200 hover:bg-white/80'}`}>
            Public
            {publicAnnouncements.some(a => !a.isRead) && <span className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold text-white bg-red-500 rounded-full">{publicAnnouncements.filter(a => !a.isRead).length}</span>}
          </button>
          {displayEvents.map(ev => (
            <button key={ev.id} onClick={() => viewEvent(ev.id)} className={`px-5 py-2 text-xs font-bold rounded-xl transition-all inline-flex items-center gap-2 ${activeTab === 'event' && selectedEvent === ev.id ? 'bg-violet-100 text-violet-700 border border-violet-200' : 'bg-white/50 text-slate-500 border border-slate-200 hover:bg-white/80'}`}>
              {ev.name}
              {unreadSet.has(ev.id) && <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold text-white bg-red-500 rounded-full">{unreadCountMap[ev.id]}</span>}
            </button>
          ))}
        </div>

        {filteredAnnouncements.length === 0 ? (
          <div className="text-center py-24 glass-panel rounded-2xl animate-fade-in-scale">
            <div className="h-20 w-20 bg-white/50 rounded-2xl flex items-center justify-center mx-auto text-slate-600 mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <h3 className="text-xl font-display font-bold text-slate-800 mb-2">No Announcements</h3>
            <p className="text-sm font-body text-slate-600">There are no announcements at the moment.</p>
          </div>
        ) : activeTab === 'all' ? (
          <div className="space-y-6 animate-fade-in-up delay-100">
            {Object.keys(eventGroups).length > 0 && (
              <div>
                <h2 className="font-display text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Event Announcements
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.values(eventGroups).map(group => {
                    const hasUnread = group.items.some(a => !a.isRead);
                    const unreadCount = group.items.filter(a => !a.isRead).length;
                    const latest = group.items[0];
                    return (
                      <button
                        key={group.eventId}
                        onClick={() => { viewEvent(group.eventId); }}
                        className={`text-left glass-panel rounded-2xl p-5 transition-all hover:shadow-xl hover:-translate-y-0.5 ${hasUnread ? 'ring-2 ring-red-300 ring-offset-1' : ''}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-50 text-violet-700 text-[10px] font-bold uppercase tracking-wider">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              {group.eventName || 'Event'}
                            </span>
                            {hasUnread && <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold text-white bg-red-500 rounded-full">{unreadCount}</span>}
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">{group.items.length} announcement{group.items.length > 1 ? 's' : ''}</span>
                        </div>
                        <h3 className="font-display font-bold text-slate-800 line-clamp-1 mb-1">{latest.title}</h3>
                        <p className="text-xs text-slate-500 line-clamp-2 mb-3">{latest.message}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">{new Date(latest.createdAt).toLocaleDateString()}</span>
                          {hasUnread && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {publicAnnouncements.length > 0 && (
              <div>
                <h2 className="font-display text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                  Public Announcements
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {publicAnnouncements.map(item => (
                    <button
                      key={item.id}
                      onClick={() => openModal(item)}
                      className={`text-left glass-panel rounded-2xl p-5 transition-all hover:shadow-xl hover:-translate-y-0.5 ${!item.isRead ? 'ring-2 ring-red-300 ring-offset-1' : ''}`}
                    >
                      {item.imageUrl && <img src={item.imageUrl} alt="" className="w-full h-32 object-cover rounded-xl mb-3" />}
                      <h3 className="font-display font-bold text-slate-800 line-clamp-1 mb-1 flex items-center gap-2">
                        {item.title}
                        {!item.isRead && <span className="w-2.5 h-2.5 flex-shrink-0 rounded-full bg-red-500 animate-pulse"></span>}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2 mb-3">{item.message}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleDateString()}</span>
                        {item.isRead ? (
                          <span className="inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600">Read</span>
                        ) : (
                          <span className="inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-red-50 text-red-600">New</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="animate-fade-in-up delay-100 glass-panel rounded-2xl overflow-hidden shadow-2xl shadow-violet-500/3">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/40 border-b border-slate-200/40 text-slate-600 text-[10px] font-bold uppercase tracking-[0.1em]">
                    <th className="px-6 py-4">Announcement</th>
                    <th className="px-6 py-4">Event</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30 text-sm font-body">
                  {filteredAnnouncements.map((item, i) => (
                    <tr
                      key={item.id}
                      className="hover:bg-white/20 transition-all duration-300 animate-fade-in-up cursor-pointer"
                      style={{ animationDelay: `${i * 40 + 150}ms` }}
                      onClick={() => openModal(item)}
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
                          <div className="flex items-center gap-2">
                            <div className="font-display font-bold text-slate-800 line-clamp-1">{item.title}</div>
                            {!item.isRead && <span className="w-2.5 h-2.5 flex-shrink-0 rounded-full bg-red-500 animate-pulse"></span>}
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
                      <td className="px-6 py-4 text-xs text-slate-600 whitespace-nowrap">{new Date(item.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right">
                        {item.isRead ? (
                          <span className="inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600">Read</span>
                        ) : (
                          <span className="inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-600">New</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {openAnnouncement && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={closeModal}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-6 py-5 border-b border-slate-100 flex justify-between items-center rounded-t-3xl z-10">
              <div className="flex items-center gap-3">
                {openAnnouncement.eventName ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-50 text-violet-700 text-[10px] font-bold uppercase tracking-wider">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    {openAnnouncement.eventName}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">Public</span>
                )}
              </div>
              <button onClick={closeModal} className="text-2xl text-slate-400 hover:text-slate-600 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100">&times;</button>
            </div>
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <h2 className="text-2xl font-heading font-bold text-text-primary">{openAnnouncement.title}</h2>
                <span className="text-xs text-slate-400 whitespace-nowrap mt-1">{new Date(openAnnouncement.createdAt).toLocaleString()}</span>
              </div>
              {openAnnouncement.imageUrl && (
                <img src={openAnnouncement.imageUrl} alt="" className="w-full max-h-80 object-cover rounded-2xl mb-6" />
              )}
              <div className="text-sm text-slate-600 font-body leading-relaxed whitespace-pre-wrap">{openAnnouncement.message}</div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400">By {openAnnouncement.authorName || 'Administrator'}</span>
                <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${openAnnouncement.audience === 'registered' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {openAnnouncement.audience === 'registered' ? 'Registered users' : 'All participants'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Announcements;
