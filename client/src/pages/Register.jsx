import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { StarDoodle, SparkleDoodle } from '../components/Doodles';
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
      setOtpTimer((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [otpSent]);

  const formatTimer = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

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
    if (result.success) {
      setOtpSent(true);
      setOtpTimer(300);
      setStep(2);
    } else {
      setLocalError(result.message);
    }
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
    if (result.success) {
      setSuccessMsg('Account created successfully! Redirecting to login...');
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } else {
      setLocalError(result.message);
    }
  };

  const handleGoogleSignUp = async () => {
    setLocalError(null);
    const result = await loginWithGoogle();
    if (!result.success) {
      setLocalError(result.message);
    }
  };

  const handleResendOtp = async () => {
    if (otpTimer > 0) return;
    setLocalError(null);
    setSubmitting(true);
    const result = await sendOtp(email.trim());
    setSubmitting(false);
    if (result.success) {
      setOtpTimer(300);
    } else {
      setLocalError(result.message);
    }
  };

  return (
    <div className="flex-grow flex items-center justify-center py-20 px-4 bg-background relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 h-64 w-64 rounded-full bg-pastel-lavender/30 blur-3xl mix-blend-multiply opacity-50 animate-float-slow"></div>
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-pastel-pink/30 blur-3xl mix-blend-multiply opacity-50 animate-float"></div>

      <div className="absolute top-20 left-20 animate-wobble hidden md:block">
        <SparkleDoodle className="w-14 h-14 text-pastel-pink" />
      </div>
      <div className="absolute bottom-20 right-20 animate-bounce-gentle hidden md:block">
        <StarDoodle className="w-12 h-12 text-pastel-yellow" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        <div className="polaroid -rotate-1 p-8">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 tape tape-2 !w-28"></div>
          <div className="text-center mb-8 pt-4 relative">
            <h1 className="font-heading text-3xl font-black text-text-primary tracking-wide relative inline-block">
              Join Avento
              <SparkleDoodle className="absolute -top-4 -right-8 w-6 h-6 text-pastel-lavender animate-spin-slow" />
            </h1>
            <p className="font-body text-text-secondary text-sm mt-2">
              {step === 1 ? 'Create your account to get started' : 'Verify your email to continue'}
            </p>
          </div>

          {(localError || error) && (
            <div className="mb-6 p-4 bg-pastel-coral/20 border-2 border-pastel-coral text-red-500 rounded-2xl text-sm font-bold font-quicksand flex gap-2.5 animate-fade-in-up">
              <span>⚠</span>
              <span>{localError || error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-6 p-4 bg-green-50 border-2 border-green-300 text-green-600 rounded-2xl text-sm font-bold font-quicksand animate-fade-in-up">
              {successMsg}
            </div>
          )}

          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step >= 1 ? 'bg-pastel-lavender text-white' : 'bg-gray-200 text-gray-400'
            }`}>1</div>
            <div className={`w-12 h-1 rounded transition-all ${step >= 2 ? 'bg-pastel-lavender' : 'bg-gray-200'}`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step >= 2 ? 'bg-pastel-lavender text-white' : 'bg-gray-200 text-gray-400'
            }`}>2</div>
          </div>

          {/* Step 1: Name + Email */}
          {step === 1 && (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.1em] mb-2 font-quicksand">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full bg-gray-50 text-text-primary placeholder-gray-400 border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-body focus:outline-none focus:border-pastel-lavender focus:ring-4 focus:ring-pastel-lavender/20 transition-all duration-300"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.1em] mb-2 font-quicksand">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-gray-50 text-text-primary placeholder-gray-400 border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-body focus:outline-none focus:border-pastel-lavender focus:ring-4 focus:ring-pastel-lavender/20 transition-all duration-300"
                />
                <p className="text-[10px] text-text-secondary mt-1.5 font-quicksand">
                  Any valid email works - college or personal
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.1em] mb-2 font-quicksand">
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full bg-gray-50 text-text-primary placeholder-gray-400 border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-body focus:outline-none focus:border-pastel-lavender focus:ring-4 focus:ring-pastel-lavender/20 transition-all duration-300"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.1em] mb-2 font-quicksand">
                  College / University
                </label>
                <input
                  type="text"
                  required
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                  placeholder="e.g. SVU College of Engineering"
                  className="w-full bg-gray-50 text-text-primary placeholder-gray-400 border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-body focus:outline-none focus:border-pastel-lavender focus:ring-4 focus:ring-pastel-lavender/20 transition-all duration-300"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.1em] mb-2 font-quicksand">
                  Gender
                </label>
                <select
                  required
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full bg-gray-50 text-text-primary border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-body focus:outline-none focus:border-pastel-lavender focus:ring-4 focus:ring-pastel-lavender/20 transition-all duration-300"
                >
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full btn-primary py-3 rounded-2xl text-sm font-heading font-bold text-white shadow-pastel-glow disabled:opacity-50 mt-4"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Sending OTP...
                  </span>
                ) : 'Send Verification Code'}
              </button>
            </form>
          )}

          {/* Step 2: OTP + Password */}
          {step === 2 && (
            <form onSubmit={handleVerifyAndRegister} className="space-y-5">
              <div className="p-3 bg-pastel-lavender/10 rounded-xl text-xs text-pastel-lavender font-bold font-quicksand text-center">
                Code sent to <span className="text-text-primary">{email}</span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.1em] mb-2 font-quicksand">
                  Verification Code (OTP)
                </label>
                <input
                  type="text"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full bg-gray-50 text-text-primary placeholder-gray-400 border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-body text-center tracking-[0.3em] font-mono focus:outline-none focus:border-pastel-lavender focus:ring-4 focus:ring-pastel-lavender/20 transition-all duration-300"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.1em] mb-2 font-quicksand">
                  Create Password
                </label>
                <PasswordInput
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full bg-gray-50 text-text-primary placeholder-gray-400 border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-body focus:outline-none focus:border-pastel-lavender focus:ring-4 focus:ring-pastel-lavender/20 transition-all duration-300"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full btn-primary py-3 rounded-2xl text-sm font-heading font-bold text-white shadow-pastel-glow disabled:opacity-50 mt-4"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating Account...
                  </span>
                ) : 'Create Account'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={otpTimer > 0}
                  className="text-xs font-quicksand font-bold transition-colors disabled:text-gray-400 disabled:cursor-not-allowed text-pastel-lavender hover:text-pastel-pink"
                >
                  {otpTimer > 0 ? `Resend code in ${formatTimer(otpTimer)}` : 'Resend verification code'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => { setStep(1); setOtpSent(false); setOtp(''); setPassword(''); }}
                className="w-full text-center text-xs font-quicksand font-bold text-text-secondary hover:text-pastel-lavender transition-colors"
              >
                ← Back to email
              </button>
            </form>
          )}

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t-2 border-dashed border-gray-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest font-quicksand">or continue with</span>
            </div>
          </div>

          {/* Google Sign-Up */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl border-2 border-gray-200 bg-white hover:bg-gray-50 text-sm font-heading font-bold text-text-primary transition-all duration-300 disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {loading ? 'Connecting...' : 'Sign up with Google'}
          </button>

          <div className="text-center mt-6">
            <p className="text-xs font-quicksand text-text-secondary">
              Already have an account?{' '}
              <Link to="/login" className="font-bold text-pastel-lavender hover:text-pastel-pink transition-colors">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
