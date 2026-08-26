import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const Profile = () => {
  const { user, updateProfile, uploadAvatar, clearError } = useAuth();
  
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    clearError();
    if (user) {
      setFullName(user.fullName || '');
      setPhotoPreview(user.avatarUrl || null);
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

  const handlePhotoSelect = () => {
    // Show the guidance modal first instead of opening file picker directly
    setShowGuideModal(true);
  };

  const handleProceedUpload = () => {
    setShowGuideModal(false);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
      setFeedback({ type: 'error', message: 'Only JPG, JPEG, PNG, WebP, HEIC, and HEIF images are allowed.' });
      setTimeout(() => setFeedback(null), 4000);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: 'error', message: 'Photo must be under 5 MB.' });
      setTimeout(() => setFeedback(null), 4000);
      return;
    }

    // Show instant preview (browsers can't render HEIC/HEIF, so skip for those)
    const isHeic = ['heic', 'heif'].includes(ext);
    if (!isHeic) {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreview(ev.target.result);
      reader.readAsDataURL(file);
    }

    // Upload immediately
    setUploadingPhoto(true);
    setFeedback(null);
    const result = await uploadAvatar(file);
    setUploadingPhoto(false);

    if (result.success) {
      setPhotoPreview(result.avatarUrl);
      setFeedback({ type: 'success', message: 'Profile photo updated!' });
    } else {
      setPhotoPreview(user?.avatarUrl || null);
      setFeedback({ type: 'error', message: result.message || 'Failed to upload photo.' });
    }

    // Reset file input so the same file can be re-selected
    e.target.value = '';
    setTimeout(() => setFeedback(null), 4000);
  };

  // Derive initials for the avatar placeholder
  const initials = (user?.fullName || '')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

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

          {/* Profile Photo Section */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative group">
              {/* Avatar circle */}
              <div
                className="h-28 w-28 rounded-full overflow-hidden border-[3px] border-violet-500/20 shadow-lg shadow-violet-500/10 bg-gradient-to-br from-violet-100 to-pink-100 flex items-center justify-center cursor-pointer transition-all duration-300 group-hover:border-violet-500/40 group-hover:shadow-violet-500/20"
                onClick={handlePhotoSelect}
                title="Click to upload photo"
              >
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="font-display text-3xl font-black text-violet-400/60 select-none">{initials}</span>
                )}

                {/* Upload overlay on hover */}
                <div className="absolute inset-0 rounded-full bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {uploadingPhoto ? (
                    <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-white text-[10px] font-bold tracking-wide">UPLOAD</span>
                    </>
                  )}
                </div>
              </div>

              {/* Upload progress ring */}
              {uploadingPhoto && (
                <div className="absolute -inset-1 rounded-full border-2 border-transparent border-t-violet-500 animate-spin"></div>
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
              className="hidden"
              onChange={handleFileChange}
              id="profile-photo-input"
            />

            <button
              type="button"
              onClick={handlePhotoSelect}
              disabled={uploadingPhoto}
              className="mt-3 text-xs font-bold text-violet-500 hover:text-violet-600 transition-colors duration-200 disabled:opacity-50 cursor-pointer"
            >
              {uploadingPhoto ? 'Uploading...' : (photoPreview ? 'Change Photo' : 'Upload Photo')}
            </button>
            <p className="text-[10px] text-slate-400 mt-1">JPG, PNG, WebP, HEIC or HEIF • Max 5 MB</p>
          </div>

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
        <Link to="/scoring-events" className="mt-5 flex items-center justify-between rounded-2xl border border-violet-200 bg-violet-50/60 p-5 transition hover:bg-violet-100">
          <div><h2 className="font-display text-sm font-bold text-violet-800">Event Scoring</h2><p className="mt-1 text-xs text-violet-600">View scoreboards published for participants.</p></div><span className="text-xl font-bold text-violet-600">→</span>
        </Link>

      </div>

      {/* ── Photo Guidelines Modal ── */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowGuideModal(false)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" />
          
          {/* Modal */}
          <div
            className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
            style={{ animationDuration: '0.25s' }}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm rounded-t-2xl px-6 pt-6 pb-4 border-b border-slate-100 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400/20 to-orange-400/20 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-black text-slate-800">Photo Guidelines</h2>
                    <p className="text-[11px] text-slate-500 font-medium">Please ensure your photo is professional</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowGuideModal(false)}
                  className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Note Banner */}
            <div className="mx-6 mt-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200/60">
              <div className="flex gap-2.5">
                <span className="text-amber-500 text-base mt-0.5 flex-shrink-0">⚠️</span>
                <p className="text-xs text-amber-800 font-medium leading-relaxed">
                  <strong>Important:</strong> Your profile photo will be used on ID cards, certificates, and event registrations. 
                  Please upload a <strong>clear, professional photograph</strong> that meets the following standards.
                </p>
              </div>
            </div>

            {/* Good Examples */}
            <div className="px-6 mt-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="font-display text-sm font-bold text-emerald-700">Recommended — How it should look</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl overflow-hidden border-2 border-emerald-400/40 shadow-sm">
                  <img src="/photo-guide/good-1.jpg" alt="Good example: formal headshot with plain background" className="w-full aspect-square object-cover" />
                  <div className="bg-emerald-50 px-3 py-2">
                    <p className="text-[10px] text-emerald-700 font-bold">✓ Formal attire</p>
                    <p className="text-[10px] text-emerald-600">Plain background, clear face</p>
                  </div>
                </div>
                <div className="rounded-xl overflow-hidden border-2 border-emerald-400/40 shadow-sm">
                  <img src="/photo-guide/good-2.jpg" alt="Good example: professional ID photo" className="w-full aspect-square object-cover" />
                  <div className="bg-emerald-50 px-3 py-2">
                    <p className="text-[10px] text-emerald-700 font-bold">✓ Good lighting</p>
                    <p className="text-[10px] text-emerald-600">Looking at camera, well-groomed</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bad Examples */}
            <div className="px-6 mt-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="font-display text-sm font-bold text-red-700">Avoid — Not acceptable</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl overflow-hidden border-2 border-red-400/40 shadow-sm">
                  <img src="/photo-guide/bad-1.jpg" alt="Bad example: blurry dark selfie" className="w-full aspect-square object-cover" />
                  <div className="bg-red-50 px-3 py-2">
                    <p className="text-[10px] text-red-700 font-bold">✗ Blurry / dark selfie</p>
                    <p className="text-[10px] text-red-600">Poor lighting, messy background</p>
                  </div>
                </div>
                <div className="rounded-xl overflow-hidden border-2 border-red-400/40 shadow-sm">
                  <img src="/photo-guide/bad-2.jpg" alt="Bad example: group photo" className="w-full aspect-square object-cover" />
                  <div className="bg-red-50 px-3 py-2">
                    <p className="text-[10px] text-red-700 font-bold">✗ Group / party photo</p>
                    <p className="text-[10px] text-red-600">Multiple people, casual setting</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Checklist */}
            <div className="px-6 mt-5">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/60">
                <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2.5">Quick Checklist</h4>
                <div className="space-y-1.5">
                  {[
                    'Recent passport-size or headshot photo',
                    'Plain or light-colored background',
                    'Face clearly visible, looking at camera',
                    'Formal or semi-formal attire',
                    'No sunglasses, caps, or filters',
                    'Only you in the photo — no group pictures'
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-violet-500 text-xs mt-0.5">•</span>
                      <p className="text-[11px] text-slate-600 font-medium">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm rounded-b-2xl px-6 py-4 mt-5 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setShowGuideModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-display font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleProceedUpload}
                className="flex-1 btn-primary py-2.5 rounded-xl text-sm font-display font-bold text-white shadow-lg shadow-violet-500/15 flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                I Understand, Upload Photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
