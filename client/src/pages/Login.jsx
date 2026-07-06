import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { StarDoodle, SparkleDoodle } from '../components/Doodles';

const Login = () => {
  const { login, error, clearError, user, getRedirectPath } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    clearError();
    setLocalError(null);
  }, []);

  // Redirect when user is resolved after login
  useEffect(() => {
    if (user) {
      const defaultPath = getRedirectPath(user.roles || []);
      const origin = location.state?.from?.pathname || defaultPath;
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
    if (!result.success) {
      setLocalError(result.message || 'Login failed. Check your credentials.');
    }
  };

  return (
    <div className="flex-grow flex items-center justify-center py-20 px-4 bg-background relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-1/4 left-1/4 h-64 w-64 rounded-full bg-pastel-lavender/30 blur-3xl mix-blend-multiply opacity-50 animate-float-slow"></div>
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-pastel-pink/30 blur-3xl mix-blend-multiply opacity-50 animate-float"></div>

      {/* Decorative Doodles */}
      <div className="absolute top-20 right-20 animate-wobble hidden md:block">
        <SparkleDoodle className="w-16 h-16 text-pastel-pink" />
      </div>
      <div className="absolute bottom-20 left-20 animate-bounce-gentle hidden md:block">
        <StarDoodle className="w-12 h-12 text-pastel-yellow" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        <div className="polaroid rotate-1 p-8">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 tape tape-1 !w-32"></div>
          
          {/* Header */}
          <div className="text-center mb-8 pt-4">
            <h1 className="font-heading text-3xl font-black text-text-primary tracking-wide">Welcome Back!</h1>
            <p className="font-body text-text-secondary text-sm mt-2">Sign in to your AVENTO account</p>
          </div>

          {/* Error */}
          {(localError || error) && (
            <div className="mb-6 p-4 bg-pastel-coral/20 border-2 border-pastel-coral text-red-500 rounded-2xl text-sm font-bold font-quicksand flex gap-2.5 animate-fade-in-up">
              <span>⚠</span>
              <span>{localError || error}</span>
            </div>
          )}

          {/* Login Form */}
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
                placeholder="you@university.edu"
                className="w-full bg-gray-50 text-text-primary placeholder-gray-400 border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-body focus:outline-none focus:border-pastel-lavender focus:ring-4 focus:ring-pastel-lavender/20 transition-all duration-300"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.1em] mb-2 font-quicksand" htmlFor="login-password">
                Password
              </label>
              <input
                type="password"
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

          {/* Register link */}
          <div className="text-center mt-6">
            <p className="text-xs font-quicksand font-bold text-text-secondary">
              New to the platform?{' '}
              <Link to="/register" className="text-pastel-lavender hover:text-pastel-pink transition-colors">
                Register here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
