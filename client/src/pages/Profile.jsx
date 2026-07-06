import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const { user, updateProfile, clearError } = useAuth();
  
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    clearError();
    if (user) {
      setFullName(user.fullName || '');
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);

    if (!fullName.trim()) {
      setFeedback({ type: 'error', message: 'Name cannot be empty.' });
      return;
    }

    setSubmitting(true);
    const result = await updateProfile(fullName.trim());
    setSubmitting(false);

    if (result.success) {
      setFeedback({ type: 'success', message: 'Display name updated successfully!' });
    } else {
      setFeedback({ type: 'error', message: result.message || 'Failed to update name.' });
    }

    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div className="flex-grow py-20 text-slate-700">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-10 animate-fade-in-up">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500/15 to-pink-500/15 flex items-center justify-center mx-auto mb-4 border border-violet-500/15">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-black text-text-primary">Profile <span className="heading-gradient">Settings</span></h1>
          <p className="font-body text-slate-600 text-sm mt-1.5">Manage your account settings</p>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 animate-fade-in-up ${
            feedback.type === 'success' 
              ? 'bg-emerald-500/8 border-emerald-500/15 text-emerald-400' 
              : 'bg-red-500/8 border-red-500/15 text-red-400'
          }`}>
            <span className="text-lg">{feedback.type === 'success' ? '✓' : '⚠'}</span>
            <span className="text-sm font-semibold">{feedback.message}</span>
          </div>
        )}

        {/* Profile Card */}
        <div className="animate-fade-in-up delay-100 glass-panel rounded-2xl p-8 shadow-2xl shadow-violet-500/5">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Editable: Full Name */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2" htmlFor="profile-fullName">
                Display Name
              </label>
              <input
                type="text"
                id="profile-fullName"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300"
              />
              <p className="mt-1.5 text-[10px] text-slate-500 font-medium">This name will appear across the platform — events, proposals, organizer lists, etc.</p>
            </div>

            {/* Read-only: Email */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">
                Email Address
              </label>
              <div className="w-full bg-white/30 text-slate-600 border border-slate-300/30 rounded-xl px-4 py-2.5 text-sm font-body cursor-not-allowed select-all">
                {user?.email || '—'}
              </div>
              <p className="mt-1.5 text-[10px] text-slate-500 font-medium">Email cannot be changed.</p>
            </div>

            {/* Read-only: Role */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Account Role</label>
              <div className="bg-white/30 border border-slate-300/30 rounded-xl px-4 py-2.5 text-sm font-bold text-violet-400 capitalize cursor-not-allowed">
                {user?.roles?.includes('admin') ? 'Admin' :
                 (user?.roles?.includes('faculty') || user?.roles?.includes('faculty_organizer')) ? 'Faculty' :
                 user?.roles?.includes('student') ? 'Student' : '—'}
              </div>
              <p className="mt-1.5 text-[10px] text-slate-500 font-medium">Role is determined by your institutional email domain.</p>
            </div>

            <button
              type="submit"
              disabled={submitting || fullName.trim() === (user?.fullName || '')}
              className="w-full btn-primary py-3 rounded-xl text-sm font-display font-bold text-white shadow-lg shadow-violet-500/15 disabled:opacity-50 mt-4"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Saving...
                </span>
              ) : 'Update Name'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default Profile;
