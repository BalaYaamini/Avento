import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';

const Register = () => {
  const { sendOtp, register, loginWithGoogle, error, clearError, user, loading } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [phone, setPhone] = useState('');
  const [college, setCollege] = useState('');
  const [gender, setGender] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    clearError();
    setLocalError(null);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user]);

  useEffect(() => {
    if (otpTimer <= 0) return;
    timerRef.current = setInterval(() => {
      setOtpTimer((prev) => { if (prev <= 1) { clearInterval(timerRef.current); return 0; } return prev - 1; });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [otpSent]);

  const formatTimer = (s) => { const m = Math.floor(s / 60); return `${m}:${(s % 60).toString().padStart(2, '0')}`; };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLocalError(null);
    if (!fullName.trim()) { setLocalError('Please enter your full name.'); return; }
    if (!email.trim()) { setLocalError('Please enter your email.'); return; }
    if (!phone.trim()) { setLocalError('Please enter your phone number.'); return; }
    if (!college.trim()) { setLocalError('Please enter your college/university.'); return; }
    if (!gender) { setLocalError('Please select your gender.'); return; }
    setSubmitting(true);
    const result = await sendOtp(email.trim());
    setSubmitting(false);
    if (result.success) { setOtpSent(true); setOtpTimer(300); setStep(2); }
    else { setLocalError(result.message); }
  };

  const handleVerifyAndRegister = async (e) => {
    e.preventDefault();
    setLocalError(null);
    if (!otp.trim()) { setLocalError('Please enter the OTP.'); return; }
    if (!password) { setLocalError('Please create a password.'); return; }
    if (password.length < 8) { setLocalError('Password must be at least 8 characters.'); return; }
    setSubmitting(true);
    const result = await register(fullName.trim(), email.trim(), password, otp.trim(), { phone: phone.trim(), college: college.trim(), gender });
    setSubmitting(false);
    if (result.success) { setSuccessMsg('Account created successfully! Redirecting to login...'); setTimeout(() => navigate('/login', { replace: true }), 2000); }
    else { setLocalError(result.message); }
  };

  const handleGoogleSignUp = async () => {
    setLocalError(null);
    const result = await loginWithGoogle();
    if (!result.success) setLocalError(result.message);
  };

  const handleResendOtp = async () => {
    if (otpTimer > 0) return;
    setLocalError(null); setSubmitting(true);
    const result = await sendOtp(email.trim());
    setSubmitting(false);
    if (result.success) setOtpTimer(300);
    else setLocalError(result.message);
  };

  const inputClass = "app-auth-input";

  return (
    <div className="app-auth-page">
      <div className="absolute top-1/4 left-1/4 h-64 w-64 rounded-full bg-accent/10 blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-accent/5 blur-3xl pointer-events-none"></div>

      <div className="app-auth-card relative z-10 animate-fade-in-up max-w-lg">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <img src="/logo.png?v=3" alt="Avento" className="h-10 w-auto logo-cyan-tint" />
            <span className="text-xl font-bold text-txt-primary tracking-tight">Avento</span>
          </Link>
          <h2 className="text-2xl font-bold text-txt-primary">Join Avento</h2>
          <p className="text-sm text-txt-secondary mt-2">
            {step === 1 ? 'Create your account to get started' : 'Verify your email to continue'}
          </p>
        </div>

        {(localError || error) && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm font-medium flex gap-2 animate-fade-in-up">
            <span>⚠</span><span>{localError || error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl text-sm font-medium animate-fade-in-up">
            {successMsg}
          </div>
        )}

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= 1 ? 'bg-accent text-white' : 'bg-surface-secondary text-txt-muted'}`}>1</div>
          <div className={`w-12 h-1 rounded transition-all ${step >= 2 ? 'bg-accent' : 'bg-surface-border'}`}></div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= 2 ? 'bg-accent text-white' : 'bg-surface-secondary text-txt-muted'}`}>2</div>
        </div>

        {step === 1 && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="app-auth-label">Full Name</label>
              <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" className={inputClass} />
            </div>
            <div>
              <label className="app-auth-label">Email Address</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} />
              <p className="text-xs text-txt-muted mt-1">Any valid email works - college or personal</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="app-auth-label">Phone Number</label>
                <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" className={inputClass} />
              </div>
              <div>
                <label className="app-auth-label">Gender</label>
                <select required value={gender} onChange={(e) => setGender(e.target.value)} className={inputClass}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            </div>
            <div>
              <label className="app-auth-label">College / University</label>
              <input type="text" required value={college} onChange={(e) => setCollege(e.target.value)} placeholder="e.g. SVU College of Engineering" className={inputClass} />
            </div>
            <button type="submit" disabled={submitting} className="app-auth-btn disabled:opacity-50 mt-2">
              {submitting ? 'Sending OTP...' : 'Send Verification Code'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyAndRegister} className="space-y-4">
            <div className="p-3 bg-accent/10 rounded-xl text-xs text-accent font-medium text-center">
              Code sent to <span className="text-txt-primary">{email}</span>
            </div>
            <div>
              <label className="app-auth-label">Verification Code (OTP)</label>
              <input type="text" required value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6}
                className={`${inputClass} text-center tracking-[0.3em] font-mono`} />
            </div>
            <div>
              <label className="app-auth-label">Create Password</label>
              <PasswordInput required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" className={inputClass} />
            </div>
            <button type="submit" disabled={submitting} className="app-auth-btn disabled:opacity-50 mt-2">
              {submitting ? 'Creating Account...' : 'Create Account'}
            </button>
            <div className="text-center">
              <button type="button" onClick={handleResendOtp} disabled={otpTimer > 0}
                className="text-sm font-medium transition-colors disabled:text-txt-muted disabled:cursor-not-allowed text-accent hover:text-accent-dark">
                {otpTimer > 0 ? `Resend code in ${formatTimer(otpTimer)}` : 'Resend verification code'}
              </button>
            </div>
            <button type="button" onClick={() => { setStep(1); setOtpSent(false); setOtp(''); setPassword(''); }}
              className="w-full text-center text-sm text-txt-secondary hover:text-accent transition-colors">
              ← Back to email
            </button>
          </form>
        )}

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-surface-border"></div></div>
          <div className="relative flex justify-center">
            <span className="bg-surface-card px-4 text-xs text-txt-muted">or continue with</span>
          </div>
        </div>

        <button type="button" onClick={handleGoogleSignUp} disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-surface-border bg-surface-secondary hover:bg-surface-hover text-sm font-semibold text-txt-primary transition-all disabled:opacity-50">
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {loading ? 'Connecting...' : 'Sign up with Google'}
        </button>

        <div className="text-center mt-6">
          <p className="text-sm text-txt-secondary">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-accent hover:text-accent-dark transition-colors">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
