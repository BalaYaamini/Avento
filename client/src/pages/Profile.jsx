import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const Profile = () => {
  const { user, updateProfile, updateFullProfile, clearError } = useAuth();
  
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [college, setCollege] = useState('');
  const [gender, setGender] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    clearError();
    if (user) {
      setFullName(user.fullName || '');
      setPhone(user.phone || '');
      setCollege(user.college || '');
      setGender(user.gender || '');
      setAvatarUrl(user.avatarUrl || '');
    }
  }, [user]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: 'error', message: 'Photo must be under 5MB.' });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadErr } = await supabase.storage
        .from('profile-photos')
        .upload(fileName, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;
      setAvatarUrl(publicUrl);

      const result = await updateFullProfile({ avatar_url: publicUrl });
      if (result.success) {
        setFeedback({ type: 'success', message: 'Photo updated successfully!' });
      } else {
        setFeedback({ type: 'error', message: result.message || 'Failed to save photo.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to upload photo: ' + err.message });
    } finally {
      setUploading(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);
    setSubmitting(true);

    const result = await updateFullProfile({
      phone: phone.trim(),
      college: college.trim(),
      gender,
    });

    setSubmitting(false);
    if (result.success) {
      setFeedback({ type: 'success', message: 'Profile updated successfully!' });
    } else {
      setFeedback({ type: 'error', message: result.message || 'Failed to update profile.' });
    }
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div className="flex-grow py-20 text-slate-700">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        
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

        {/* Photo Section */}
        <div className="animate-fade-in-up delay-75 glass-panel rounded-2xl p-6 mb-4 shadow-2xl shadow-violet-500/5">
          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-4">Profile Photo</label>
          <div className="flex items-center gap-6">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-20 h-20 rounded-2xl object-cover border-2 border-violet-200" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/15 to-pink-500/15 flex items-center justify-center border-2 border-dashed border-violet-300">
                  <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
              )}
              <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="btn-primary px-4 py-2 rounded-xl text-xs font-bold shadow-pastel-glow disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : avatarUrl ? 'Change Photo' : 'Upload Photo'}
              </button>
              <p className="text-[10px] text-slate-500 mt-1.5">JPEG, PNG or WebP. Max 5MB.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* Profile Form */}
        <div className="animate-fade-in-up delay-100 glass-panel rounded-2xl p-8 shadow-2xl shadow-violet-500/5">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Full Name */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300"
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Email Address</label>
              <div className="w-full bg-white/30 text-slate-600 border border-slate-300/30 rounded-xl px-4 py-2.5 text-sm font-body cursor-not-allowed select-all">
                {user?.email || '—'}
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 XXXXX XXXXX"
                className="w-full bg-white/60 text-slate-800 placeholder-slate-400 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300"
              />
            </div>

            {/* College / University */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">College / University</label>
              <input
                type="text"
                value={college}
                onChange={(e) => setCollege(e.target.value)}
                placeholder="e.g. SR University"
                className="w-full bg-white/60 text-slate-800 placeholder-slate-400 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300 cursor-pointer"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>

            {/* Role (read-only) */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Account Role</label>
              <div className="bg-white/30 border border-slate-300/30 rounded-xl px-4 py-2.5 text-sm font-bold text-violet-400 capitalize cursor-not-allowed">
                {user?.roles?.includes('admin') ? 'Admin' :
                 (user?.roles?.includes('faculty') || user?.roles?.includes('faculty_organizer')) ? 'Faculty' :
                 user?.roles?.includes('student') ? 'Student' : '—'}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
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
              ) : 'Save Profile'}
            </button>
          </form>
        </div>

        <Link to="/scoring-events" className="mt-5 flex items-center justify-between rounded-2xl border border-violet-200 bg-violet-50/60 p-5 transition hover:bg-violet-100">
          <div><h2 className="font-display text-sm font-bold text-violet-800">Event Scoring</h2><p className="mt-1 text-xs text-violet-600">View scoreboards published for participants.</p></div><span className="text-xl font-bold text-violet-600">→</span>
        </Link>

      </div>
    </div>
  );
};

export default Profile;
