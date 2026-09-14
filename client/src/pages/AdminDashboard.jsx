import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const AdminDashboard = () => {
  const [stats, setStats] = useState({ totalEvents: 0, totalUsers: 0, totalRegistrations: 0, activeEvents: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recentEvents, setRecentEvents] = useState([]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true); setError(null);
      const [eventsRes, usersRes, regsRes] = await Promise.all([
        axios.get('/api/events'), axios.get('/api/users'), axios.get('/api/registrations/all')
      ]);
      const events = eventsRes.data;
      setStats({
        totalEvents: events.length,
        totalUsers: usersRes.data.length,
        totalRegistrations: regsRes.data.length,
        activeEvents: events.filter(e => e.status === 'active').length
      });
      const sorted = [...events].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setRecentEvents(sorted.slice(0, 4));
    } catch (err) {
      console.error(err);
      setError('Failed to load dashboard metrics.');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchDashboardStats(); }, []);

  return (
    <div>
      {/* Hero Header */}
      <div className="app-hero">
        <div className="app-hero-content">
          <div className="app-hero-tag">Admin Console</div>
          <h1>Manage Your <span style={{ color: '#06b6d4' }}>Events</span></h1>
          <p>Platform overview metrics, event management, and user administration — all in one place.</p>
          <div className="app-stat-badges">
            <div className="app-stat-badge">
              <span>Events:</span>
              <strong>{stats.totalEvents}</strong>
            </div>
            <div className="app-stat-badge">
              <span>Users:</span>
              <strong>{stats.totalUsers}</strong>
            </div>
            <div className="app-stat-badge">
              <span>Registrations:</span>
              <strong>{stats.totalRegistrations}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="app-content">
        {/* Stats Grid */}
        <div className="app-stats-grid">
          <div className="app-stat-card">
            <div className="app-stat-label">Total Events</div>
            <div className="app-stat-value">{stats.totalEvents}</div>
            <div className="app-stat-change up">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
              {stats.activeEvents} Active
            </div>
          </div>
          <div className="app-stat-card ">
            <div className="app-stat-label">Registered Users</div>
            <div className="app-stat-value">{stats.totalUsers}</div>
            <div className="app-stat-change up">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
              All time
            </div>
          </div>
          <div className="app-stat-card ">
            <div className="app-stat-label">Registrations</div>
            <div className="app-stat-value">{stats.totalRegistrations}</div>
            <div className="app-stat-change up">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
              Total
            </div>
          </div>
          <div className="app-stat-card ">
            <div className="app-stat-label">Active Events</div>
            <div className="app-stat-value">{stats.activeEvents}</div>
            <div className="app-stat-change down">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>
              Currently running
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="app-content-grid">
          {/* Recent Events Table */}
          <div className="app-card">
            <div className="app-card-header">
              <h3>Recent Events</h3>
              <Link to="/admin/events" className="view-all">View All</Link>
            </div>
            <div className="app-table-wrap">
              {loading ? (
                <div className="p-8 text-center text-txt-muted text-sm">Loading events...</div>
              ) : recentEvents.length === 0 ? (
                <div className="p-8 text-center text-txt-muted text-sm">No events yet.</div>
              ) : (
                <table className="app-table">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Type</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Seats</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentEvents.map((evt) => (
                      <tr key={evt._id || evt.id}>
                        <td><div className="event-name">{evt.title}</div></td>
                        <td className="event-type">{evt.category}</td>
                        <td className="event-type">{new Date(evt.date).toLocaleDateString()}</td>
                        <td>
                          <span className={`app-status-badge ${evt.status === 'active' ? 'active' : evt.status === 'upcoming' ? 'upcoming' : 'completed'}`}>
                            {evt.status}
                          </span>
                        </td>
                        <td>
                          <div className="app-seat-text">{evt.registeredCount || 0} / {evt.capacity}</div>
                          <div className="app-seat-bar">
                            <div className="app-seat-bar-fill admin-fill" style={{ width: `${Math.min(100, ((evt.registeredCount || 0) / (evt.capacity || 1)) * 100)}%` }}></div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="app-right-col">
            {/* Quick Actions */}
            <div className="app-card">
              <div className="app-card-header">
                <h3>Quick Actions</h3>
              </div>
              <div className="app-actions-grid">
                <Link to="/admin/events" className="app-action-btn">
                  <div className="app-action-icon" style={{ background: 'rgba(6,182,212,0.12)', color: '#06b6d4' }}>+</div>
                  New Event
                </Link>
                <Link to="/admin/registrations" className="app-action-btn">
                  <div className="app-action-icon" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  </div>
                  Export Data
                </Link>
                <Link to="/admin/announcements" className="app-action-btn">
                  <div className="app-action-icon" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>
                  </div>
                  Send Notice
                </Link>
                <Link to="/admin/users" className="app-action-btn">
                  <div className="app-action-icon" style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6' }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                  </div>
                  Manage Users
                </Link>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="app-card">
              <div className="app-card-header">
                <h3>Recent Events</h3>
                <Link to="/admin/events" className="view-all">View All</Link>
              </div>
              <div className="app-activity-list">
                {recentEvents.slice(0, 4).map((evt, i) => (
                  <div key={evt._id || evt.id} className="app-activity-item">
                    <div className="app-activity-dot" style={{ background: evt.status === 'active' ? '#22c55e' : '#06b6d4' }}></div>
                    <div>
                      <div className="app-activity-text"><strong>{evt.title}</strong></div>
                      <div className="app-activity-time">{evt.category} • {new Date(evt.date).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
                {recentEvents.length === 0 && !loading && (
                  <div className="p-4 text-center text-txt-muted text-sm">No activity yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-xl text-sm">{error}</div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
