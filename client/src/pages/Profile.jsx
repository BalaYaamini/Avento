import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const Profile = () => {
  const { user, updateProfile, clearError } = useAuth();
  
  // ── Form state ──
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

  const initials = (user?.fullName || '')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  // ── Shared style helpers ──
  const labelCls = "block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2";
  const inputCls = "w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300";
  const selectCls = "w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300 appearance-none cursor-pointer";
  const readOnlyCls = "w-full bg-white/30 text-slate-600 border border-slate-300/30 rounded-xl px-4 py-2.5 text-sm font-body cursor-not-allowed select-all";
  const hintCls = "mt-1.5 text-[10px] text-slate-500 font-medium";

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
          <p className="font-body text-slate-600 text-sm mt-1.5">Manage your account and personal details</p>
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

            {/* Save Button */}
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

      {/* ── 1. Full-size Photo Lightbox Modal ── */}
      {showViewModal && photoPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowViewModal(false)}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fade-in" />
          
          <div className="relative z-10 flex flex-col items-center max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-black border border-white/10 max-h-[75vh]">
              <img
                src={photoPreview}
                alt="Profile Full Size"
                className="max-h-[70vh] w-auto object-contain mx-auto"
              />
              <button
                onClick={() => setShowViewModal(false)}
                className="absolute top-3 right-3 h-9 w-9 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center transition-colors border border-white/20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  handlePhotoSelect();
                }}
                className="btn-primary py-2.5 px-5 rounded-xl text-xs font-display font-bold text-white shadow-lg flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Crop / Change Photo
              </button>
              <button
                onClick={() => setShowViewModal(false)}
                className="bg-white/10 hover:bg-white/20 text-white py-2.5 px-5 rounded-xl text-xs font-display font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. Interactive Image Crop Modal ── */}
      {showCropModal && imageToCrop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowCropModal(false)}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fade-in" />
          
          <div
            className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-600 font-bold">
                  ✂️
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-slate-800">Crop Profile Photo</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Drag to adjust position & zoom to fit</p>
                </div>
              </div>
              <button
                onClick={() => setShowCropModal(false)}
                className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Cropper Container */}
            <div className="relative w-full h-80 bg-slate-900">
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={true}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            {/* Controls & Actions */}
            <div className="p-5 bg-white border-t border-slate-100 space-y-4">
              {/* Zoom Slider */}
              <div className="flex items-center gap-3 px-2">
                <span className="text-xs font-bold text-slate-500">🔍 -</span>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                />
                <span className="text-xs font-bold text-slate-500">+</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCropModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-display font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCroppedImage}
                  disabled={uploadingPhoto}
                  className="flex-1 btn-primary py-2.5 rounded-xl text-xs font-display font-bold text-white shadow-lg shadow-violet-500/15 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {uploadingPhoto ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <span>✓</span>
                      <span>Crop & Save Photo</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. Photo Guidelines Modal ── */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowGuideModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" />
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
                <button onClick={() => setShowGuideModal(false)} className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
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
              <button onClick={() => setShowGuideModal(false)} className="flex-1 py-2.5 rounded-xl text-sm font-display font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                Cancel
              </button>
              <button onClick={handleProceedUpload} className="flex-1 btn-primary py-2.5 rounded-xl text-sm font-display font-bold text-white shadow-lg shadow-violet-500/15 flex items-center justify-center gap-2">
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
