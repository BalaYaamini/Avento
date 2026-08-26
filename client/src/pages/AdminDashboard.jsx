import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { SparkleDoodle, PinDoodle } from '../components/Doodles';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalUsers: 0,
    totalRegistrations: 0,
    activeEvents: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recentEvents, setRecentEvents] = useState([]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch events, users, and registrations in parallel
      const [eventsRes, usersRes, regsRes] = await Promise.all([
        axios.get('/api/events'),
        axios.get('/api/users'),
        axios.get('/api/registrations/all')
      ]);

      const events = eventsRes.data;
      const users = usersRes.data;
      const registrations = regsRes.data;

      setStats({
        totalEvents: events.length,
        totalUsers: users.length,
        totalRegistrations: registrations.length,
        activeEvents: events.filter(e => e.status === 'active').length
      });

      // Show up to 3 most recently created events
      const sortedEvents = [...events].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setRecentEvents(sortedEvents.slice(0, 3));

    } catch (err) {
      console.error(err);
      setError('Failed to aggregate dashboard metrics. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const cardDetails = [
    {
      title: 'Total Events',
      value: stats.totalEvents,
      subtitle: `${stats.activeEvents} Active / Open`,
      bgColor: 'bg-pastel-lavender/20',
      borderColor: 'border-pastel-lavender/50',
      iconColor: 'text-pastel-lavender',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      rotation: 'rotate-1'
    },
    {
      title: 'Registered Users',
      value: stats.totalUsers,
      subtitle: 'Students and Administrators',
      bgColor: 'bg-pastel-mint/30',
      borderColor: 'border-pastel-mint/80',
      iconColor: 'text-green-600',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      rotation: '-rotate-2'
    },
    {
      title: 'Total Registrations',
      value: stats.totalRegistrations,
      subtitle: 'Successful seat bookings',
      bgColor: 'bg-pastel-yellow/30',
      borderColor: 'border-pastel-yellow/80',
      iconColor: 'text-yellow-600',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      rotation: 'rotate-2'
    }
  ];

  const shortcuts = [
    { label: 'Configure & Create Events', to: '/admin/events', arrow: 'text-pastel-lavender' },
    { label: 'View Booked Registrations', to: '/admin/registrations', arrow: 'text-pastel-mint' },
    { label: 'Manage Portal Users', to: '/admin/users', arrow: 'text-pastel-pink' },
    { label: 'Post Announcements', to: '/admin/announcements', arrow: 'text-pastel-coral' }
  ];

  return (
    <div className="flex-grow py-20 bg-background relative overflow-hidden">
      {/* Abstract blobs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-pastel-lavender/30 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-float"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="mb-10 animate-fade-in-up flex items-center gap-3">
          <SparkleDoodle className="w-10 h-10 text-pastel-lavender" />
          <div>
            <h1 className="font-heading text-4xl font-black text-text-primary">Admin <span className="marker-highlight">Console</span></h1>
            <p className="font-quicksand font-bold text-text-secondary text-sm mt-1.5">Platform overview metrics and activity</p>
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

        {/* Action Panel / Recent Activity split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Admin shortcuts */}
          <div className="animate-fade-in-up delay-400 polaroid p-6 lg:col-span-1 flex flex-col justify-between relative -rotate-1">
            <PinDoodle className="absolute -top-4 right-4 w-8 h-8 text-pastel-pink" />
            <div>
              <h3 className="text-sm font-heading font-bold text-text-primary uppercase tracking-[0.15em] mb-4">Management Control Panel</h3>
              <p className="text-xs font-body text-text-secondary leading-relaxed mb-6 font-medium">Use these shortcuts to add events, view lists of registered students, or oversee users.</p>
            </div>
            <div className="space-y-3">
              {shortcuts.map((item, i) => (
                <Link 
                  key={i}
                  to={item.to} 
                  className="flex items-center justify-between p-4 rounded-2xl glass-panel border-2 border-slate-200 hover:border-pastel-lavender/50 hover:bg-pastel-lavender/10 text-text-primary font-bold font-quicksand text-xs transition-all duration-300 group/link shadow-sm"
                >
                  <span>{item.label}</span>
                  <span className={`${item.arrow} group-hover/link:translate-x-1 transition-transform duration-300`}>→</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Events */}
          <div className="animate-fade-in-up delay-500 polaroid p-6 lg:col-span-2 relative rotate-1">
            <div className="absolute -top-3 left-10 tape tape-2 !w-24"></div>
            <h3 className="text-sm font-heading font-bold text-text-primary uppercase tracking-[0.15em] mb-5">Recently Published Events</h3>
            {loading ? (
              <div className="space-y-4 animate-pulse">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="h-20 glass-panel rounded-2xl border-2 border-slate-200" />
                ))}
              </div>
            ) : recentEvents.length === 0 ? (
              <div className="text-center py-12 glass-panel rounded-2xl border-2 border-slate-200 border-dashed">
                <p className="text-sm text-text-secondary font-bold font-quicksand">No events published yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentEvents.map((evt, i) => (
                  <div 
                    key={evt._id || evt.id} 
                    className="animate-fade-in-up flex items-center justify-between p-4 glass-panel rounded-2xl border-2 border-slate-200 hover:border-pastel-pink/50 hover:bg-pastel-pink/5 shadow-sm transition-all duration-300 group"
                    style={{ animationDelay: `${i * 80 + 600}ms` }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-16 rounded-xl overflow-hidden border-2 border-slate-100">
                         <img src={evt.imageUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div>
                        <h4 className="text-sm font-heading font-bold text-text-primary line-clamp-1 group-hover:text-pastel-lavender transition-colors">{evt.title}</h4>
                        <p className="text-[10px] text-text-secondary mt-1 font-bold font-quicksand uppercase tracking-wider">{evt.category} &bull; {new Date(evt.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-xl border-2 ${
                        evt.status === 'active' 
                          ? 'bg-pastel-mint/30 text-green-700 border-pastel-mint' 
                          : 'bg-pastel-coral/20 text-red-500 border-pastel-coral'
                      }`}>
                        {evt.status}
                      </span>
                      <p className="text-[10px] text-text-secondary font-bold font-quicksand mt-2 uppercase tracking-wider">
                        {evt.registration_type === 'team' ? 'Team Event' : `${evt.registeredCount} / ${evt.capacity} booked`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;
