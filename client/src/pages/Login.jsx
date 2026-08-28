import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { StarDoodle, SparkleDoodle, BookDoodle } from '../components/Doodles';
import PasswordInput from '../components/PasswordInput';
import axios from 'axios';

const Login = () => {
  const { login, loginWithGoogle, error, clearError, user, getRedirectPath, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);

  // Password setup for Google-only users
  const [needsPassword, setNeedsPassword] = useState(false);
  const [otpStep, setOtpStep] = useState(0); // 0: idle, 1: OTP sent, 2: setting password
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpSetting, setOtpSetting] = useState(false);
  const [otpSuccess, setOtpSuccess] = useState(false);

  useEffect(() => {
    clearError();
    setLocalError(null);
  }, []);

  useEffect(() => {
    if (user) {
      const isAdmin = user.roles?.includes('admin');
      
      if (user.first_login && !isAdmin) {
        navigate('/change-password', { replace: true });
        return;
      }
      
      const defaultPath = getRedirectPath(user.roles || []);
      const fromPath = location.state?.from?.pathname;
      const isDashboardPath = fromPath === '/admin' || fromPath === '/faculty-organizer' || fromPath === '/student-organizer' || fromPath === '/dashboard';
      const origin = (fromPath && !isDashboardPath) ? fromPath : defaultPath;
      navigate(origin, { replace: true });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);
    if (!email || !password) {
      setLocalError('Please fill in all fields.');
      return;
    }
    setSubmitting(true);
    const result = await login(email.trim(), password);
    setSubmitting(false);
    if (result.needsPassword) {
      setNeedsPassword(true);
      setLocalError(null);
      return;
    }
    if (!result.success) {
      setLocalError(result.message || 'Login failed. Check your credentials.');
    }
  };

  const handleGoogleLogin = async () => {
    setLocalError(null);
    const result = await loginWithGoogle();
    if (!result.success) {
      setLocalError(result.message);
    }
  };

  const handleSendSetPasswordOtp = async () => {
    setLocalError(null);
    setOtpSending(true);
    try {
      await axios.post('/api/auth/send-set-password-otp', { email: email.trim().toLowerCase() });
      setOtpStep(1);
    } catch (err) {
      setLocalError(err.response?.data?.message || 'Failed to send OTP.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleSetPasswordWithOtp = async (e) => {
    e.preventDefault();
    setLocalError(null);
    if (!otp || !newPassword || !confirmNewPassword) {
      setLocalError('Please fill in all fields.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setLocalError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setLocalError('Password must be at least 8 characters.');
      return;
    }
    setOtpSetting(true);
    try {
      await axios.post('/api/auth/set-password-otp', {
        email: email.trim().toLowerCase(),
        otp,
        password: newPassword
      });
      setOtpSuccess(true);
    } catch (err) {
      setLocalError(err.response?.data?.message || 'Failed to set password.');
    } finally {
      setOtpSetting(false);
    }
  };

  const handleBackToLogin = () => {
    setNeedsPassword(false);
    setOtpStep(0);
    setOtpSuccess(false);
    setOtp('');
    setNewPassword('');
    setConfirmNewPassword('');
    setLocalError(null);
  };

  return (
    <div className="flex-grow flex items-center justify-center py-20 px-4 bg-background relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 h-64 w-64 rounded-full bg-pastel-lavender/30 blur-3xl mix-blend-multiply opacity-50 animate-float-slow"></div>
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-pastel-pink/30 blur-3xl mix-blend-multiply opacity-50 animate-float"></div>

      <div className="absolute top-20 right-20 animate-wobble hidden md:block">
        <SparkleDoodle className="w-16 h-16 text-pastel-pink" />
      </div>
      <div className="absolute bottom-20 left-20 animate-bounce-gentle hidden md:block">
        <StarDoodle className="w-12 h-12 text-pastel-yellow" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        <div className="polaroid rotate-1 p-8">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 tape tape-1 !w-32"></div>
          
          <div className="text-center mb-8 pt-4 relative">
            <BookDoodle className="absolute top-0 left-4 w-8 h-8 text-pastel-lavender opacity-60 animate-float-slow hidden sm:block" />
            <h1 className="font-heading text-3xl font-black text-text-primary tracking-wide relative inline-block">
              {needsPassword ? 'Set Password' : 'Welcome Back!'}
              <StarDoodle className="absolute -top-4 -right-6 w-6 h-6 text-pastel-yellow animate-spin-slow" />
            </h1>
            <p className="font-body text-text-secondary text-sm mt-2">
              {needsPassword
                ? 'Set a password so you can log in with email'
                : 'Sign in to your AVENTO account'}
            </p>
          </div>

          {(localError || error) && (
            <div className="mb-6 p-4 bg-pastel-coral/20 border-2 border-pastel-coral text-red-500 rounded-2xl text-sm font-bold font-quicksand flex gap-2.5 animate-fade-in-up">
              <span>⚠</span>
              <span>{localError || error}</span>
            </div>
          )}

          {needsPassword && otpSuccess ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="font-heading text-xl font-bold text-slate-800 mb-2">Password Set!</h2>
              <p className="text-sm text-slate-500 mb-6">You can now log in with your email and password.</p>
              <button
                onClick={handleBackToLogin}
                className="btn-primary px-6 py-2 rounded-2xl text-sm font-heading font-bold text-white shadow-pastel-glow"
              >
                Back to Login
              </button>
            </div>
          ) : needsPassword ? (
            <div className="space-y-5">
              <div className="p-4 bg-blue-50 border-2 border-blue-200 text-blue-700 rounded-2xl text-sm font-bold font-quicksand">
                <span>This account was created with <strong>Google Sign-In</strong>. Enter a password to enable email login.</span>
              </div>

              {otpStep === 0 ? (
                <button
                  type="button"
                  onClick={handleSendSetPasswordOtp}
                  disabled={otpSending}
                  className="w-full btn-primary py-3 rounded-2xl text-sm font-heading font-bold text-white shadow-pastel-glow disabled:opacity-50"
                >
                  {otpSending ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending OTP...
                    </span>
                  ) : 'Send OTP to My Email'}
                </button>
              ) : (
                <form onSubmit={handleSetPasswordWithOtp} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.1em] mb-2 font-quicksand">
                      Enter OTP
                    </label>
                    <input
                      type="text"
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="6-digit code"
                      maxLength={6}
                      className="w-full bg-gray-50 text-text-primary placeholder-gray-400 border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-body focus:outline-none focus:border-pastel-lavender focus:ring-4 focus:ring-pastel-lavender/20 transition-all duration-300 text-center text-lg tracking-[0.3em]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.1em] mb-2 font-quicksand">
                      New Password
                    </label>
                    <PasswordInput
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full bg-gray-50 text-text-primary placeholder-gray-400 border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-body focus:outline-none focus:border-pastel-lavender focus:ring-4 focus:ring-pastel-lavender/20 transition-all duration-300"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.1em] mb-2 font-quicksand">
                      Confirm Password
                    </label>
                    <PasswordInput
                      required
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full bg-gray-50 text-text-primary placeholder-gray-400 border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-body focus:outline-none focus:border-pastel-lavender focus:ring-4 focus:ring-pastel-lavender/20 transition-all duration-300"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={otpSetting}
                    className="w-full btn-primary py-3 rounded-2xl text-sm font-heading font-bold text-white shadow-pastel-glow disabled:opacity-50"
                  >
                    {otpSetting ? 'Setting Password...' : 'Set Password & Continue'}
                  </button>

                  <button
                    type="button"
                    onClick={handleBackToLogin}
                    className="w-full text-center text-xs font-quicksand font-bold text-text-secondary hover:text-pastel-lavender transition-colors"
                  >
                    ← Back to Login
                  </button>
                </form>
              )}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={submitting || loading}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl border-2 border-gray-200 bg-white hover:bg-gray-50 text-sm font-heading font-bold text-text-primary transition-all duration-300 disabled:opacity-50 mb-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {loading ? 'Connecting...' : 'Sign in with Google'}
              </button>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t-2 border-dashed border-gray-200"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest font-quicksand">or sign in with email</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.1em] mb-2 font-quicksand" htmlFor="login-email">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="login-email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-gray-50 text-text-primary placeholder-gray-400 border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-body focus:outline-none focus:border-pastel-lavender focus:ring-4 focus:ring-pastel-lavender/20 transition-all duration-300"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.1em] mb-2 font-quicksand" htmlFor="login-password">
                    Password
                  </label>
                  <PasswordInput
                    id="login-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-gray-50 text-text-primary placeholder-gray-400 border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-body focus:outline-none focus:border-pastel-lavender focus:ring-4 focus:ring-pastel-lavender/20 transition-all duration-300"
                  />
                </div>

                <button
                  type="submit"
                  id="login-submit-btn"
                  disabled={submitting}
                  className="w-full btn-primary py-3 rounded-2xl text-sm font-heading font-bold text-white shadow-pastel-glow disabled:opacity-50 mt-4"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Authenticating...
                    </span>
                  ) : 'Sign In'}
                </button>
              </form>

              <div className="flex items-center justify-between mt-6">
                <Link to="/forgot-password" className="text-xs font-quicksand font-bold text-pastel-lavender hover:text-pastel-pink transition-colors">
                  Forgot Password?
                </Link>
                <Link to="/register" className="text-xs font-quicksand font-bold text-pastel-lavender hover:text-pastel-pink transition-colors">
                  Create Account →
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
