import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SparkleDoodle, StarDoodle } from '../components/Doodles';

const ALLOWED_DOMAINS = ['@cse.suh.edu.in', '@aiml.suh.edu.in', '@suh.edu.in'];

const getRolePreview = (email) => {
  const e = email.trim().toLowerCase();
  if (e.endsWith('@cse.suh.edu.in') || e.endsWith('@aiml.suh.edu.in')) return 'student';
  if (e.endsWith('@suh.edu.in')) return 'faculty';
  if (e.includes('@') && !ALLOWED_DOMAINS.some(d => e.endsWith(d))) return 'blocked';
  return null;
};

const Register = () => {
  const { register, sendOtp, error, clearError, user, getRedirectPath } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1: details, 2: otp
  const [localError, setLocalError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  
  const [cooldown, setCooldown] = useState(0);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    clearError();
    setLocalError(null);
  }, [step]);

  // Redirect if already logged in (from previous session)
  useEffect(() => {
    if (user && user.fullName) {
      navigate(getRedirectPath(user.roles || []), { replace: true });
    }
  }, [user]);

  // Cooldown timer for OTP resend
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  // ── Step 1: Submit Details & Send OTP ─────────────────────────
  const handleSendOtp = async (e) => {
    e?.preventDefault();
    setLocalError(null);
    const emailLower = email.trim().toLowerCase();

    if (!fullName.trim()) {
      setLocalError('Please enter your full name.');
      return;
    }
    if (!emailLower) {
      setLocalError('Please enter your institutional email address.');
      return;
    }
    if (!ALLOWED_DOMAINS.some(d => emailLower.endsWith(d))) {
      setLocalError('Only @cse.suh.edu.in, @aiml.suh.edu.in, and @suh.edu.in emails are allowed.');
      return;
    }
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const result = await sendOtp(emailLower);
    setSubmitting(false);

    if (result.success) {
      setStep(2);
      setCooldown(60);
    } else {
      setLocalError(result.message || 'Failed to send OTP. Please try again.');
    }
  };

  // ── Step 2: Verify OTP & Register ─────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    setLocalError(null);
    
    if (!otp || otp.length < 6) {
      setLocalError('Please enter the 6-digit OTP sent to your email.');
      return;
    }
    
    setSubmitting(true);
    const result = await register(fullName.trim(), email.trim().toLowerCase(), password, otp.trim());
    setSubmitting(false);

    if (result.success) {
      setSuccessMsg('Account created successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } else {
      setLocalError(result.message || 'Registration failed. Please try again.');
    }
  };

  const rolePreview = getRolePreview(email);

  return (
    <div className="flex-grow flex items-center justify-center py-20 px-4 bg-background relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-1/4 left-1/4 h-64 w-64 rounded-full bg-pastel-yellow/30 blur-3xl mix-blend-multiply opacity-50 animate-float-slow"></div>
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-pastel-mint/30 blur-3xl mix-blend-multiply opacity-50 animate-float"></div>

      {/* Decorative Doodles */}
      <div className="absolute top-24 right-[15%] animate-wobble hidden md:block">
        <SparkleDoodle className="w-16 h-16 text-pastel-pink" />
      </div>
      <div className="absolute bottom-24 left-[15%] animate-bounce-gentle hidden md:block">
        <StarDoodle className="w-12 h-12 text-pastel-lavender" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        <div className="polaroid -rotate-1 p-8">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 tape tape-2 !w-32"></div>

          {/* Header */}
          <div className="text-center mb-8 pt-4">
            <h1 className="font-heading text-3xl font-black text-text-primary tracking-wide">
              {step === 1 && 'Join the Club!'}
              {step === 2 && 'Almost There!'}
            </h1>
            <p className="font-body text-text-secondary text-sm mt-2">
              {step === 1 && 'Step 1 of 2 — The basics'}
              {step === 2 && `Step 2 of 2 — OTP sent to ${email}`}
            </p>
          </div>

          {/* Progress bar */}
          <div className="flex gap-2 mb-6">
            {[1, 2].map(s => (
              <div key={s} className={`h-2 flex-1 rounded-full transition-all duration-500 border ${s <= step ? 'bg-pastel-lavender border-pastel-lavender/50' : 'bg-gray-100 border-gray-200'}`} />
            ))}
          </div>

          {/* Error / Success */}
          {(localError || error) && (
            <div className="mb-6 p-4 bg-pastel-coral/20 border-2 border-pastel-coral text-red-500 rounded-2xl text-sm font-bold font-quicksand flex gap-2.5 animate-fade-in-up">
              <span>⚠</span>
              <span>{localError || error}</span>
            </div>
          )}
          {successMsg && (
            <div className="mb-6 p-4 bg-pastel-mint/30 border-2 border-pastel-mint text-green-600 rounded-2xl text-sm font-bold font-quicksand flex gap-2.5 animate-fade-in-up">
              <span>✓</span>
              <span>{successMsg}</span>
            </div>
          )}

          {/* ── STEP 1: DETAILS ── */}
          {step === 1 && (
            <form onSubmit={handleSendOtp} className="space-y-5 animate-fade-in">
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.1em] mb-2 font-quicksand" htmlFor="reg-fullName">
                  Full Name
                </label>
                <input
                  type="text"
                  id="reg-fullName"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Your Full Name"
                  className="w-full bg-gray-50 text-text-primary placeholder-gray-400 border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-body focus:outline-none focus:border-pastel-lavender focus:ring-4 focus:ring-pastel-lavender/20 transition-all duration-300"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.1em] mb-2 font-quicksand" htmlFor="reg-email">
                  Institutional Email
                </label>
                <input
                  type="email"
                  id="reg-email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@cse.suh.edu.in"
                  className="w-full bg-gray-50 text-text-primary placeholder-gray-400 border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-body focus:outline-none focus:border-pastel-lavender focus:ring-4 focus:ring-pastel-lavender/20 transition-all duration-300"
                />

                {/* Dynamic role preview */}
                {rolePreview === 'student' && (
                  <div className="mt-3 px-4 py-2.5 rounded-xl text-xs font-bold font-quicksand flex items-center gap-2 bg-pastel-lavender/20 border border-pastel-lavender/40 text-pastel-lavender animate-fade-in-up">
                    <SparkleDoodle className="w-4 h-4 text-pastel-lavender" />
                    <span>Role auto-detected: <strong>Student</strong></span>
                  </div>
                )}
                {rolePreview === 'faculty' && (
                  <div className="mt-3 px-4 py-2.5 rounded-xl text-xs font-bold font-quicksand flex items-center gap-2 bg-pastel-mint/30 border border-pastel-mint text-green-600 animate-fade-in-up">
                    <SparkleDoodle className="w-4 h-4 text-green-600" />
                    <span>Role auto-detected: <strong>Faculty Coordinator</strong></span>
                  </div>
                )}
                {rolePreview === 'blocked' && (
                  <div className="mt-3 px-4 py-2.5 rounded-xl text-xs font-bold font-quicksand flex items-center gap-2 bg-pastel-coral/20 border border-pastel-coral text-red-500 animate-fade-in-up">
                    <span>⚠</span>
                    <span>This email domain is not allowed for registration.</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.1em] mb-2 font-quicksand" htmlFor="reg-password">
                    Password
                  </label>
                  <input
                    type="password"
                    id="reg-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min 6 chars"
                    className="w-full bg-gray-50 text-text-primary placeholder-gray-400 border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-body focus:outline-none focus:border-pastel-lavender focus:ring-4 focus:ring-pastel-lavender/20 transition-all duration-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.1em] mb-2 font-quicksand" htmlFor="reg-confirmPassword">
                    Confirm
                  </label>
                  <input
                    type="password"
                    id="reg-confirmPassword"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirm"
                    className="w-full bg-gray-50 text-text-primary placeholder-gray-400 border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-body focus:outline-none focus:border-pastel-lavender focus:ring-4 focus:ring-pastel-lavender/20 transition-all duration-300"
                  />
                </div>
              </div>

              <button
                type="submit"
                id="reg-send-otp-btn"
                disabled={submitting || rolePreview === 'blocked'}
                className="w-full btn-primary py-3 rounded-2xl text-sm font-heading font-bold text-white shadow-pastel-glow disabled:opacity-50 mt-4"
              >
                {submitting ? 'Sending OTP...' : 'Next Step'}
              </button>

              <div className="text-center mt-6">
                <p className="text-xs font-quicksand font-bold text-text-secondary">
                  Already have an account?{' '}
                  <Link to="/login" className="text-pastel-lavender hover:text-pastel-pink transition-colors">Sign In</Link>
                </p>
              </div>
            </form>
          )}

          {/* ── STEP 2: OTP ── */}
          {step === 2 && (
            <form onSubmit={handleRegister} className="space-y-5 animate-fade-in">
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.1em] mb-2 font-quicksand" htmlFor="reg-otp">
                  6-Digit OTP
                </label>
                <input
                  type="text"
                  id="reg-otp"
                  required
                  maxLength="6"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter OTP"
                  className="w-full bg-gray-50 text-text-primary placeholder-gray-400 border-2 border-gray-200 rounded-2xl px-4 py-4 text-center text-xl tracking-[0.5em] font-heading font-bold focus:outline-none focus:border-pastel-lavender focus:ring-4 focus:ring-pastel-lavender/20 transition-all duration-300"
                />
                <p className="text-xs text-text-secondary mt-3 text-center font-quicksand font-bold">
                  OTP was sent to <strong className="text-pastel-lavender">{email}</strong>
                </p>
              </div>

              <div className="flex justify-between items-center text-xs font-quicksand font-bold mt-2">
                <button type="button" onClick={() => setStep(1)} className="text-text-secondary hover:text-pastel-lavender transition-colors">
                  ← Change Details
                </button>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={cooldown > 0 || submitting}
                  className={`${cooldown > 0 ? 'text-gray-400' : 'text-pastel-pink hover:text-pastel-lavender'} transition-colors`}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
                </button>
              </div>

              <button
                type="submit"
                id="reg-verify-otp-btn"
                disabled={submitting || otp.length < 6}
                className="w-full btn-primary py-3 rounded-2xl text-sm font-heading font-bold text-white shadow-pastel-glow disabled:opacity-50 mt-4"
              >
                {submitting ? 'Verifying...' : 'Verify & Complete'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Register;
