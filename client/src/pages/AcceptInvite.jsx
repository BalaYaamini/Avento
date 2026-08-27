import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const AcceptInvite = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const res = await axios.get(`/api/registrations/invite/${token}`);
        setInvite(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Invalid or expired invitation.');
      } finally {
        setLoading(false);
      }
    };
    fetchInvite();
  }, [token]);

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);
    try {
      const res = await axios.post(`/api/registrations/invite/${token}/accept`);
      setSuccess(res.data.message || 'You have joined the team!');
      setTimeout(() => navigate('/my-registrations'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to accept invitation.');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-grow py-20 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="flex-grow py-20 text-slate-700">
        <div className="max-w-lg mx-auto px-4 text-center">
          <div className="glass-panel rounded-2xl p-8">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="font-heading text-xl font-bold text-slate-800 mb-2">Invitation Invalid</h2>
            <p className="text-sm text-slate-500 mb-6">{error}</p>
            <button onClick={() => navigate('/')} className="btn-primary px-6 py-2.5 rounded-xl text-sm font-bold">Go Home</button>
          </div>
        </div>
      </div>
    );
  }

  if (invite?.status && invite.status !== 'pending') {
    return (
      <div className="flex-grow py-20 text-slate-700">
        <div className="max-w-lg mx-auto px-4 text-center">
          <div className="glass-panel rounded-2xl p-8">
            <div className="w-16 h-16 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="font-heading text-xl font-bold text-slate-800 mb-2">Invitation Already {invite.status}</h2>
            <p className="text-sm text-slate-500 mb-6">This invitation has already been {invite.status}.</p>
            <button onClick={() => navigate('/my-registrations')} className="btn-primary px-6 py-2.5 rounded-xl text-sm font-bold">View Registrations</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow py-20 text-slate-700">
      <div className="max-w-lg mx-auto px-4">
        <div className="glass-panel rounded-2xl p-8 shadow-2xl shadow-violet-500/5 animate-fade-in-up">
          
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-violet-100 text-violet-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h1 className="font-display text-2xl font-black text-text-primary">Team Invitation</h1>
            <p className="text-sm text-slate-500 mt-1">You've been invited to join a team!</p>
          </div>

          {success ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="font-heading text-xl font-bold text-slate-800 mb-2">Welcome to the Team!</h2>
              <p className="text-sm text-slate-500">{success}</p>
            </div>
          ) : (
            <>
              <div className="bg-white/60 rounded-xl p-5 mb-6 border border-slate-200/50">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase">Event</span>
                    <span className="text-sm font-bold text-slate-800">{invite?.eventTitle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase">Team</span>
                    <span className="text-sm font-bold text-violet-600">{invite?.teamName}</span>
                  </div>
                  {invite?.eventDate && (
                    <div className="flex justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase">Date</span>
                      <span className="text-sm text-slate-700">{new Date(invite.eventDate).toLocaleDateString()}</span>
                    </div>
                  )}
                  {invite?.eventVenue && (
                    <div className="flex justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase">Venue</span>
                      <span className="text-sm text-slate-700">{invite.eventVenue}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase">Invited As</span>
                    <span className="text-sm text-slate-700">{invite?.name || invite?.email}</span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-600">
                  {error}
                </div>
              )}

              {!user ? (
                <div className="text-center space-y-3">
                  <p className="text-sm text-slate-500">Sign up or log in to accept this invitation.</p>
                  <button
                    onClick={() => navigate('/register')}
                    className="w-full btn-primary py-3 rounded-xl text-sm font-bold"
                  >
                    Sign Up to Accept
                  </button>
                  <button
                    onClick={() => navigate('/login')}
                    className="w-full py-3 rounded-xl text-sm font-bold border border-slate-300 text-slate-600 hover:bg-slate-50"
                  >
                    Already have an account? Log In
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="w-full btn-primary py-3 rounded-xl text-sm font-bold shadow-pastel-glow disabled:opacity-50"
                >
                  {accepting ? 'Accepting...' : 'Accept Invitation'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AcceptInvite;
