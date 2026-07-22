import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SparkleDoodle, ArrowDoodle, PinDoodle } from '../components/Doodles';

const FacultyOrgDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalEvents: 0,
    activeEvents: 0,
    pendingApprovals: 0,
    totalRegistrations: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recentEvents, setRecentEvents] = useState([]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch my events (which includes department events for faculty org)
      const eventsRes = await axios.get('/api/events/organizer/my-events');
      const events = eventsRes.data;

      const totalRegs = events.reduce((sum, evt) => sum + (evt.registeredCount || 0), 0);
      const pending = events.filter(e => ['pending_approval', 'under_review', 'needs_revision'].includes(e.status)).length;

      setStats({
        totalEvents: events.length,
        activeEvents: events.filter(e => e.status === 'active' || e.status === 'published').length,
        pendingApprovals: pending,
        totalRegistrations: totalRegs
      });

      // Show up to 4 most recently created events
      const sortedEvents = [...events].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setRecentEvents(sortedEvents.slice(0, 4));

    } catch (err) {
      console.error(err);
      setError('Failed to load dashboard metrics. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const cardDetails = [
    {
      title: 'Assigned Proposals',
      value: stats.totalEvents,
      subtitle: `${stats.activeEvents} Approved / Published`,
      bgColor: 'bg-pastel-lavender/20',
      borderColor: 'border-pastel-lavender/50',
      iconColor: 'text-pastel-lavender',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      rotation: 'rotate-1'
    },
    {
      title: 'Pending Approvals',
      value: stats.pendingApprovals,
      subtitle: 'Student proposals waiting',
      bgColor: 'bg-pastel-yellow/30',
      borderColor: 'border-pastel-yellow/80',
      iconColor: 'text-yellow-600',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      rotation: '-rotate-2'
    },
    {
      title: 'Total Registrations',
      value: stats.totalRegistrations,
      subtitle: 'Across all assigned events',
      bgColor: 'bg-pastel-mint/30',
      borderColor: 'border-pastel-mint/80',
      iconColor: 'text-green-600',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      rotation: 'rotate-2'
    }
  ];

  return (
    <div className="flex-grow py-20 bg-background relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-10 right-10 w-96 h-96 bg-pastel-mint/30 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-float-slow"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="mb-10 animate-fade-in-up flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex items-center gap-3">
             <PinDoodle className="w-10 h-10 text-pastel-lavender" />
            <div>
              <h1 className="font-heading text-4xl font-black text-text-primary">Faculty <span className="marker-highlight">Coordinator</span></h1>
              <p className="font-quicksand font-bold text-text-secondary text-sm mt-1.5">Review and approve proposals for the <span className="text-pastel-lavender">{user?.department}</span> department</p>
            </div>
          </div>
          <div className="relative">
             <ArrowDoodle className="w-12 h-12 text-pastel-lavender absolute -top-8 -left-10 -rotate-12 hidden md:block" />
             <Link to="/faculty-organizer/events" className="btn-primary px-5 py-3 rounded-2xl text-sm font-heading font-bold text-white shadow-pastel-glow inline-block text-center shrink-0">
               Review Proposals
             </Link>
          </div>
        </div>

        {/* Dashboard Card Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="polaroid h-36 animate-pulse glass-panel" />
            ))}
          </div>
        ) : error ? (
          <div className="mb-10 p-4 bg-pastel-coral/20 border-2 border-pastel-coral text-red-500 rounded-2xl text-sm font-bold font-quicksand animate-fade-in-up">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {cardDetails.map((card, idx) => (
              <div 
                key={idx} 
                className={`animate-fade-in-up polaroid relative p-6 flex items-center justify-between group cursor-default ${card.rotation}`}
                style={{ animationDelay: `${idx * 100 + 100}ms` }}
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 tape tape-1 !w-16"></div>
                <div>
                  <h3 className="text-text-secondary text-[10px] font-bold uppercase tracking-[0.1em] font-quicksand">{card.title}</h3>
                  <p className="text-4xl font-heading font-black text-text-primary mt-2">{card.value}</p>
                  <p className="text-text-secondary text-xs mt-1.5 font-bold font-quicksand">{card.subtitle}</p>
                </div>
                <div className={`h-14 w-14 rounded-2xl ${card.bgColor} border-2 ${card.borderColor} flex items-center justify-center ${card.iconColor} group-hover:scale-110 transition-transform duration-300`}>
                  {card.icon}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recent Events Panel */}
        <div className="animate-fade-in-up delay-300 polaroid p-6 relative">
          <div className="absolute -top-3 left-20 tape tape-2 !w-24"></div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-heading font-bold text-text-primary uppercase tracking-[0.15em] flex items-center gap-2">
               <SparkleDoodle className="w-5 h-5 text-pastel-lavender" />
               Recent Assigned Proposals
            </h3>
            <Link to="/faculty-organizer/events" className="text-xs font-bold font-quicksand text-pastel-lavender hover:text-pastel-pink transition-colors">View All →</Link>
          </div>

          {loading ? (
             <div className="space-y-4 animate-pulse">
               {[...Array(2)].map((_, i) => (
                 <div key={i} className="h-20 glass-panel rounded-2xl border-2 border-slate-200" />
               ))}
             </div>
          ) : recentEvents.length === 0 ? (
            <div className="text-center py-12 glass-panel rounded-2xl border-2 border-slate-200 border-dashed">
              <p className="text-sm font-bold font-quicksand text-text-secondary">No assigned proposals found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recentEvents.map((evt, i) => (
                <div 
                  key={evt._id || evt.id} 
                  className="animate-fade-in-up flex items-center justify-between p-4 glass-panel rounded-2xl border-2 border-slate-200 hover:border-pastel-lavender/50 hover:bg-pastel-lavender/5 shadow-sm transition-all duration-300 group"
                  style={{ animationDelay: `${i * 80 + 400}ms` }}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-16 rounded-xl overflow-hidden border-2 border-slate-200">
                      <img src={evt.imageUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <h4 className="text-sm font-heading font-bold text-text-primary line-clamp-1 group-hover:text-pastel-lavender transition-colors">{evt.title}</h4>
                      <p className="text-[10px] text-text-secondary mt-1 font-bold font-quicksand uppercase tracking-wider">{evt.category} &bull; {new Date(evt.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end justify-center">
                    <span className={`text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-xl border-2 ${
                      evt.status === 'active' || evt.status === 'published'
                        ? 'bg-pastel-mint/30 text-green-700 border-pastel-mint' 
                        : ['pending_approval', 'under_review', 'needs_revision'].includes(evt.status)
                        ? 'bg-pastel-yellow/30 text-yellow-700 border-pastel-yellow'
                        : 'glass-panel text-text-secondary border-slate-200'
                    }`}>
                      {evt.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default FacultyOrgDashboard;
