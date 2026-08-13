import { useEffect, useState } from 'react';
import axios from 'axios';
import ScoringBoard from '../components/ScoringBoard';
import Modal from '../components/Modal';

const StudentScoringEvents = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const [eventsRes, registrationsRes] = await Promise.all([axios.get('/api/events?status=published'), axios.get('/api/registrations/my-registrations')]);
        const registeredEventIds = new Set((registrationsRes.data || []).filter(reg => {
          if (reg.status !== 'registered') return false;
          if (!reg.team_id && !reg.teamId) return true;
          return reg.teamId?.status === 'registered' || reg.teamDetails?.teamStatus === 'registered';
        }).map(reg => String(reg.event_id || reg.eventId?.id || reg.eventId?._id)));
        setEvents((eventsRes.data || []).filter(event => event.scoring_enabled && event.scoreboard_visible && registeredEventIds.has(String(event.id || event._id))));
      } catch (err) {
        setError('Failed to load scoring events. Please refresh.');
      } finally {
        setLoading(false);
      }
    };
    loadEvents();
  }, []);

  return (
    <div className="flex-grow py-20 text-slate-700">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 animate-fade-in-up">
          <h1 className="font-display text-3xl font-black text-text-primary">Scoring <span className="heading-gradient">Events</span></h1>
          <p className="mt-1.5 font-body text-sm text-slate-600">View scoreboards for events you are registered for.</p>
        </div>

        {loading ? <div className="glass-panel rounded-2xl p-8 text-center text-sm text-slate-500">Loading scoreboards...</div> : error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-600">{error}</div> : events.length === 0 ? <div className="glass-panel rounded-2xl p-12 text-center"><h3 className="font-display text-xl font-bold text-slate-800">No Available Scoreboards</h3><p className="mt-2 text-sm text-slate-500">Registered events with participant-visible scoreboards will appear here.</p></div> : <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{events.map(event => <article key={event.id || event._id} className="glass-panel overflow-hidden rounded-2xl border border-slate-200/60 shadow-sm"><img src={event.image_url || event.imageUrl} alt="" className="h-40 w-full object-cover" /><div className="p-5"><div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-violet-500">{event.category}</div><h2 className="font-display text-xl font-bold text-slate-800">{event.title}</h2><p className="mt-2 line-clamp-2 text-xs text-slate-500">{event.description}</p><p className="mt-3 text-xs font-semibold text-slate-500">{event.venue} · {new Date(event.date).toLocaleDateString()}</p><button onClick={() => setSelectedEvent(event)} className="btn-primary mt-5 w-full rounded-xl px-4 py-2.5 text-xs font-bold text-white">View Scoreboard</button></div></article>)}</div>}
      </div>
      <Modal isOpen={!!selectedEvent} onClose={() => setSelectedEvent(null)} title={`Scoreboard - ${selectedEvent?.title || ''}`}>
        {selectedEvent && <ScoringBoard eventId={selectedEvent.id || selectedEvent._id} canEdit={false} />}
      </Modal>
    </div>
  );
};

export default StudentScoringEvents;
