import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const ScoringDashboard = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        let url = '/api/events?status=published';
        if (user?.roles?.includes('admin') || user?.roles?.includes('faculty')) {
          url = '/api/events';
        }
        const res = await axios.get(url);
        setEvents(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-pastel-lavender border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary font-medium">Loading scoring events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text-primary tracking-tight">
          Scoring Dashboard
        </h1>
        <p className="text-text-secondary text-sm mt-1 font-quicksand">
          View leaderboards and enter scores for team events
        </p>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16 bg-white/60 backdrop-blur-sm border border-pastel-lavender/20 rounded-3xl">
          <p className="text-4xl mb-3">🏅</p>
          <p className="text-text-secondary font-semibold">No team events available for scoring.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {events.map((evt) => (
            <Link
              key={evt.id}
              to={`/events/${evt.id}/scoring`}
              className="group bg-white/60 backdrop-blur-sm border border-pastel-lavender/20 rounded-2xl p-5 hover:shadow-lg hover:scale-[1.02] hover:border-pastel-lavender/40 transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-pastel-lavender/10 text-pastel-lavender border border-pastel-lavender/20 uppercase tracking-wider">
                  {evt.category || 'Event'}
                </span>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                  evt.status === 'published' ? 'bg-green-100 text-green-700' :
                  evt.status === 'active' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {evt.status}
                </span>
              </div>

              <h3 className="font-heading font-bold text-text-primary group-hover:text-pastel-lavender transition-colors line-clamp-2">
                {evt.title}
              </h3>

              <p className="text-xs text-text-secondary mt-2 line-clamp-2">
                {evt.description || 'No description'}
              </p>

              <div className="flex items-center gap-3 mt-4 text-[10px] text-text-secondary">
                {evt.venue && (
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    {evt.venue}
                  </span>
                )}
                {evt.date && (
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {new Date(evt.date).toLocaleDateString()}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {evt.registered_count || 0} teams
                </span>
              </div>

              <div className="mt-4 flex items-center text-xs font-bold text-pastel-lavender group-hover:translate-x-1 transition-transform">
                Open Scoring Board
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default ScoringDashboard;
