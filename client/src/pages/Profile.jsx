import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import Cropper from 'react-easy-crop';

// Helper function to create HTML Image element asynchronously
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

// Helper function to generate cropped blob from canvas
async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/jpeg', 0.95);
  });
}

const Profile = () => {
  const { user, updateProfile, uploadAvatar, clearError } = useAuth();
  
  // ── Form state ──
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [degreeProgram, setDegreeProgram] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [department, setDepartment] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);

  // ── Modal states ──
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false); // Full-screen photo viewer
  const [showCropModal, setShowCropModal] = useState(false); // Interactive cropper
  
  // ── Cropper states ──
  const [imageToCrop, setImageToCrop] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    clearError();
    if (user) {
      setFullName(user.fullName || '');
      setPhone(user.phone || '');
      setGender(user.gender || '');
      setDegreeProgram(user.degreeProgram || '');
      setYearOfStudy(user.yearOfStudy || '');
      setCollegeName(user.collegeName || '');
      setRollNumber(user.rollNumber || '');
      setDepartment(user.department || '');
      setPhotoPreview(user.avatarUrl || null);
    }
  }, [user]);

  // Check if any field was changed compared to the user object
  const hasChanges = () => {
    if (!user) return false;
    return (
      fullName.trim() !== (user.fullName || '') ||
      phone.trim() !== (user.phone || '') ||
      gender !== (user.gender || '') ||
      degreeProgram.trim() !== (user.degreeProgram || '') ||
      yearOfStudy !== (user.yearOfStudy || '') ||
      collegeName.trim() !== (user.collegeName || '') ||
      rollNumber.trim() !== (user.rollNumber || '') ||
      department.trim() !== (user.department || '')
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);

    // ── 1. Display Name Validation ──
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setFeedback({ type: 'error', message: 'Display Name is required.' });
      return;
    }
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      setFeedback({ type: 'error', message: 'Display Name must be between 2 and 80 characters long.' });
      return;
    }
    if (/<[^>]*>|http:\/\/|https:\/\/|www\.|&[a-z0-9]+;/i.test(trimmedName)) {
      setFeedback({ type: 'error', message: 'Display Name cannot contain links or HTML tags.' });
      return;
    }
    if (!/^[a-zA-Z\u00C0-\u024F\s\.\'\-]+$/.test(trimmedName)) {
      setFeedback({ type: 'error', message: 'Display Name can only contain letters, spaces, initials, hyphens (-), and apostrophes (\').' });
      return;
    }

    // ── 2. Institution / College Name Validation ──
    const trimmedCollege = collegeName.trim();
    if (!trimmedCollege) {
      setFeedback({ type: 'error', message: 'College / Institution Name is required.' });
      return;
    }
    if (trimmedCollege.length < 2 || trimmedCollege.length > 150) {
      setFeedback({ type: 'error', message: 'Institution name must be between 2 and 150 characters long.' });
      return;
    }
    if (!/[a-zA-Z\u00C0-\u024F]/.test(trimmedCollege)) {
      setFeedback({ type: 'error', message: 'Institution name must contain letters and cannot consist only of numbers or special characters.' });
      return;
    }

    // ── 3. Roll Number Validation ──
    const isStudent = user?.roles?.includes('student');
    const trimmedRoll = rollNumber.trim().toUpperCase();
    if (isStudent && !trimmedRoll) {
      setFeedback({ type: 'error', message: 'College Roll Number is required for students.' });
      return;
    }
    if (trimmedRoll && !/^[a-zA-Z0-9\-\/]+$/.test(trimmedRoll)) {
      setFeedback({ type: 'error', message: 'Roll Number can only contain letters, numbers, hyphens (-), and slashes (/).' });
      return;
    }

    // ── 4. Phone Validation ──
    if (phone.trim()) {
      const digits = phone.replace(/\D/g, '');
      if (digits.length !== 10 || !/^[6-9]/.test(digits)) {
        setFeedback({ type: 'error', message: 'Please enter a valid 10-digit Indian mobile number (starting with 6-9).' });
        return;
      }
    }

    setSubmitting(true);
    const result = await updateProfile({
      name: trimmedName,
      phone: phone.trim(),
      gender,
      degreeProgram: degreeProgram.trim(),
      yearOfStudy,
      collegeName: trimmedCollege,
      rollNumber: trimmedRoll,
      department: department.trim(),
    });
    setSubmitting(false);

    if (result.success) {
      setFeedback({ type: 'success', message: 'Profile updated successfully!' });
    } else {
      setFeedback({ type: 'error', message: result.message || 'Failed to update profile.' });
    }

    setTimeout(() => setFeedback(null), 4000);
  };

  const handlePhotoSelect = () => {
    setShowGuideModal(true);
  };

  const handleProceedUpload = () => {
    setShowGuideModal(false);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

    // Read file for cropping modal
    const reader = new FileReader();
    reader.onload = () => {
      setImageToCrop(reader.result);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);

    // Reset file input so re-selecting same file triggers change
    e.target.value = '';
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSaveCroppedImage = async () => {
    try {
      if (!imageToCrop || !croppedAreaPixels) return;

      setUploadingPhoto(true);
      setShowCropModal(false);
      setFeedback(null);

      const croppedBlob = await getCroppedImg(imageToCrop, croppedAreaPixels);
      const croppedFile = new File([croppedBlob], 'profile-photo.jpg', { type: 'image/jpeg' });

      // Immediate local preview
      const previewUrl = URL.createObjectURL(croppedBlob);
      setPhotoPreview(previewUrl);

      const result = await uploadAvatar(croppedFile);
      setUploadingPhoto(false);

      if (result.success) {
        setPhotoPreview(result.avatarUrl);
        setFeedback({ type: 'success', message: 'Profile photo cropped and saved successfully!' });
      } else {
        setPhotoPreview(user?.avatarUrl || null);
        setFeedback({ type: 'error', message: result.message || 'Failed to upload photo.' });
      }
    } catch (err) {
      console.error('Cropping error:', err);
      setUploadingPhoto(false);
      setFeedback({ type: 'error', message: 'Error cropping image. Please try again.' });
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
        
        {/* Header */}
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

          {/* ── Profile Photo Section ── */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative group">
              {/* Avatar circle */}
              <div
                className="h-28 w-28 rounded-full overflow-hidden border-[3px] border-violet-500/20 shadow-lg shadow-violet-500/10 bg-gradient-to-br from-violet-100 to-pink-100 flex items-center justify-center cursor-pointer transition-all duration-300 group-hover:border-violet-500/50 group-hover:shadow-violet-500/20"
                onClick={() => {
                  if (photoPreview) setShowViewModal(true);
                  else handlePhotoSelect();
                }}
                title={photoPreview ? "Click to view full photo" : "Click to upload photo"}
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-display text-3xl font-black text-violet-400/60 select-none">{initials}</span>
                )}

                {/* Overlay actions on hover */}
                <div className="absolute inset-0 rounded-full bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {uploadingPhoto ? (
                    <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                  ) : photoPreview ? (
                    <div className="flex flex-col items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span className="text-white text-[10px] font-bold tracking-wide">VIEW</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-white text-[10px] font-bold tracking-wide">UPLOAD</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress ring */}
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

            <div className="flex items-center gap-3 mt-3">
              {photoPreview && (
                <button
                  type="button"
                  onClick={() => setShowViewModal(true)}
                  className="text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors cursor-pointer flex items-center gap-1 bg-slate-100 px-3 py-1.5 rounded-lg"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  View Photo
                </button>
              )}

              <button
                type="button"
                onClick={handlePhotoSelect}
                disabled={uploadingPhoto}
                className="text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg transition-colors duration-200 disabled:opacity-50 cursor-pointer flex items-center gap-1 shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {uploadingPhoto ? 'Uploading...' : (photoPreview ? 'Crop / Change Photo' : 'Upload Photo')}
              </button>
            </div>

            <p className="text-[10px] text-slate-400 mt-1.5">JPG, PNG, WebP, HEIC or HEIF • Max 5 MB</p>
          </div>

          {/* ── Profile Form ── */}
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* ─── Section: Personal Information ─── */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-6 w-6 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-xs font-display font-bold text-slate-700 uppercase tracking-wider">Personal Information</h3>
              </div>

              <div className="space-y-4">
                {/* Display Name */}
                <div>
                  <label className={labelCls} htmlFor="profile-fullName">Display Name *</label>
                  <input
                    type="text"
                    id="profile-fullName"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={inputCls}
                    placeholder="Enter your full name"
                  />
                  <p className={hintCls}>This name will appear across the platform — events, proposals, organizer lists, etc.</p>
                </div>

                {/* Phone + Gender (2 columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls} htmlFor="profile-phone">Phone Number</label>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-300/50 bg-white/40 text-slate-500 text-sm font-semibold select-none">+91</span>
                      <input
                        type="tel"
                        id="profile-phone"
                        value={phone}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          if (val.length <= 10) setPhone(val);
                        }}
                        className={`${inputCls} rounded-l-none`}
                        placeholder="9876543210"
                        maxLength={10}
                        inputMode="numeric"
                        pattern="[6-9][0-9]{9}"
                      />
                    </div>
                    <p className={hintCls}>10-digit Indian mobile number</p>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="profile-gender">Gender</label>
                    <div className="relative">
                      <select
                        id="profile-gender"
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className={selectCls}
                      >
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                        <svg className="h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Email (read-only) */}
                <div>
                  <label className={labelCls}>Email Address</label>
                  <div className={readOnlyCls}>{user?.email || '—'}</div>
                  <p className={hintCls}>Email cannot be changed.</p>
                </div>

                {/* Role (read-only) */}
                <div>
                  <label className={labelCls}>Account Role</label>
                  <div className="bg-white/30 border border-slate-300/30 rounded-xl px-4 py-2.5 text-sm font-bold text-violet-400 capitalize cursor-not-allowed">
                    {user?.roles?.includes('admin') ? 'Admin' :
                     (user?.roles?.includes('faculty') || user?.roles?.includes('faculty_organizer')) ? 'Faculty' :
                     user?.roles?.includes('student') ? 'Student' : '—'}
                  </div>
                  <p className={hintCls}>Role is determined by your institutional email domain.</p>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-200/60"></div>

            {/* ─── Section: Academic Details ─── */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-6 w-6 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path d="M12 14l9-5-9-5-9 5 9 5z" />
                    <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zM12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zM12 14v7" />
                  </svg>
                </div>
                <h3 className="text-xs font-display font-bold text-slate-700 uppercase tracking-wider">Academic Details</h3>
              </div>

              <div className="space-y-4">
                {/* College Name */}
                <div>
                  <label className={labelCls} htmlFor="profile-college">College / Institution Name *</label>
                  <input
                    type="text"
                    id="profile-college"
                    required
                    value={collegeName}
                    onChange={(e) => setCollegeName(e.target.value)}
                    className={inputCls}
                    placeholder="e.g. SRM University, Hindustan"
                  />
                </div>

                {/* Degree + Year (2 columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls} htmlFor="profile-degree">Degree / Program</label>
                    <input
                      type="text"
                      id="profile-degree"
                      value={degreeProgram}
                      onChange={(e) => setDegreeProgram(e.target.value)}
                      className={inputCls}
                      placeholder="e.g. B.Tech CSE, BCA, M.Sc"
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="profile-year">Year of Study</label>
                    <div className="relative">
                      <select
                        id="profile-year"
                        value={yearOfStudy}
                        onChange={(e) => setYearOfStudy(e.target.value)}
                        className={selectCls}
                      >
                        <option value="">Select Year</option>
                        <option value="1st Year">1st Year</option>
                        <option value="2nd Year">2nd Year</option>
                        <option value="3rd Year">3rd Year</option>
                        <option value="4th Year">4th Year</option>
                        <option value="5th Year">5th Year</option>
                        <option value="Alumni">Alumni</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                        <svg className="h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Roll Number + Department (2 columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls} htmlFor="profile-roll">
                      College Roll Number {user?.roles?.includes('student') ? '*' : ''}
                    </label>
                    <input
                      type="text"
                      id="profile-roll"
                      value={rollNumber}
                      onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
                      className={inputCls}
                      placeholder="e.g. 2203A51001"
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="profile-dept">Department</label>
                    <input
                      type="text"
                      id="profile-dept"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className={inputCls}
                      placeholder="e.g. CSE, AIML, ECE"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={submitting || !hasChanges()}
              className="w-full btn-primary py-3 rounded-xl text-sm font-display font-bold text-white shadow-lg shadow-violet-500/15 disabled:opacity-50 mt-2"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                'Save Profile'
              )}
            </button>
          </form>
        </div>
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
