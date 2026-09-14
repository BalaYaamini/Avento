import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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

  const [needsPassword, setNeedsPassword] = useState(false);
  const [otpStep, setOtpStep] = useState(0);
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
    if (!email || !password) { setLocalError('Please fill in all fields.'); return; }
    setSubmitting(true);
    const result = await login(email.trim(), password);
    setSubmitting(false);
    if (result.needsPassword) { setNeedsPassword(true); setLocalError(null); return; }
    if (!result.success) { setLocalError(result.message || 'Login failed. Check your credentials.'); }
  };

  const handleGoogleLogin = async () => {
    setLocalError(null);
    const result = await loginWithGoogle();
    if (!result.success) setLocalError(result.message);
  };

  const handleSendSetPasswordOtp = async () => {
    setLocalError(null);
    setOtpSending(true);
    try {
      await axios.post('/api/auth/send-set-password-otp', { email: email.trim().toLowerCase() });
      setOtpStep(1);
    } catch (err) {
      setLocalError(err.response?.data?.message || 'Failed to send OTP.');
    } finally { setOtpSending(false); }
  };

  const handleSetPasswordWithOtp = async (e) => {
    e.preventDefault();
    setLocalError(null);
    if (!otp || !newPassword || !confirmNewPassword) { setLocalError('Please fill in all fields.'); return; }
    if (newPassword !== confirmNewPassword) { setLocalError('Passwords do not match.'); return; }
    if (newPassword.length < 8) { setLocalError('Password must be at least 8 characters.'); return; }
    setOtpSetting(true);
    try {
      await axios.post('/api/auth/set-password-otp', { email: email.trim().toLowerCase(), otp, password: newPassword });
      setOtpSuccess(true);
    } catch (err) {
      setLocalError(err.response?.data?.message || 'Failed to set password.');
    } finally { setOtpSetting(false); }
  };

  const handleBackToLogin = () => {
    setNeedsPassword(false); setOtpStep(0); setOtpSuccess(false);
    setOtp(''); setNewPassword(''); setConfirmNewPassword(''); setLocalError(null);
  };

  return (
    <div className="app-auth-page">
      <div className="absolute top-1/4 left-1/4 h-64 w-64 rounded-full bg-accent/10 blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-accent/5 blur-3xl pointer-events-none"></div>

      <div className="app-auth-card relative z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <img src="/logo.png?v=3" alt="Avento" className="h-10 w-auto logo-cyan-tint" />
            <span className="text-xl font-bold text-txt-primary tracking-tight">Avento</span>
          </Link>
          <h2 className="text-2xl font-bold text-txt-primary">
            {needsPassword ? 'Set Password' : 'Welcome Back'}
          </h2>
          <p className="text-sm text-txt-secondary mt-2">
            {needsPassword ? 'Set a password so you can log in with email' : 'Sign in to your account'}
          </p>
        </div>

        {(localError || error) && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm font-medium flex gap-2 animate-fade-in-up">
            <span>⚠</span><span>{localError || error}</span>
          </div>
        )}

        {needsPassword && otpSuccess ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-500/10 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-txt-primary mb-2">Password Set!</h2>
            <p className="text-sm text-txt-secondary mb-6">You can now log in with your email and password.</p>
            <button onClick={handleBackToLogin} className="app-auth-btn">Back to Login</button>
          </div>
        ) : needsPassword ? (
          <div className="space-y-5">
            <div className="p-4 bg-accent/10 border border-accent/30 text-accent rounded-xl text-sm font-medium">
              This account was created with <strong>Google Sign-In</strong>. Enter a password to enable email login.
            </div>
            {otpStep === 0 ? (
              <button type="button" onClick={handleSendSetPasswordOtp} disabled={otpSending} className="app-auth-btn disabled:opacity-50">
                {otpSending ? 'Sending OTP...' : 'Send OTP to My Email'}
              </button>
            ) : (
              <form onSubmit={handleSetPasswordWithOtp} className="space-y-4">
                <div>
                  <label className="app-auth-label">Enter OTP</label>
                  <input type="text" required value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit code" maxLength={6}
                    className="app-auth-input text-center text-lg tracking-[0.3em]" />
                </div>
                <div>
                  <label className="app-auth-label">New Password</label>
                  <PasswordInput required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 8 characters" className="app-auth-input" />
                </div>
                <div>
                  <label className="app-auth-label">Confirm Password</label>
                  <PasswordInput required value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="Re-enter password" className="app-auth-input" />
                </div>
                <button type="submit" disabled={otpSetting} className="app-auth-btn disabled:opacity-50">
                  {otpSetting ? 'Setting Password...' : 'Set Password & Continue'}
                </button>
                <button type="button" onClick={handleBackToLogin} className="w-full text-center text-sm text-txt-secondary hover:text-accent transition-colors">
                  ← Back to Login
                </button>
              </form>
            )}
          </div>
        ) : (
          <>
            <button type="button" onClick={handleGoogleLogin} disabled={submitting || loading}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-surface-border bg-surface-secondary hover:bg-surface-hover text-sm font-semibold text-txt-primary transition-all disabled:opacity-50 mb-4">
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
                <div className="w-full border-t border-surface-border"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-surface-card px-4 text-xs text-txt-muted">or sign in with email</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="app-auth-label">Email Address</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="app-auth-input" />
              </div>
              <div>
                <label className="app-auth-label">Password</label>
                <PasswordInput required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="app-auth-input" />
              </div>
              <button type="submit" disabled={submitting} className="app-auth-btn disabled:opacity-50 mt-2">
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
              <Link to="/forgot-password" className="text-sm text-accent hover:text-accent-dark transition-colors">Forgot Password?</Link>
              <Link to="/register" className="text-sm text-accent hover:text-accent-dark transition-colors">Create Account →</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Login;
