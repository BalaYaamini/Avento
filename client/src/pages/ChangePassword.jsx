import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, supabase } from '../context/AuthContext';
import { SparkleDoodle, StarDoodle, LaptopDoodle } from '../components/Doodles';
import PasswordInput from '../components/PasswordInput';
import axios from 'axios';

const ChangePassword = () => {
  const { user, getRedirectPath } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState(null); // 'loading', 'success', 'error'
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setStatus('error');
      setMessage('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      setStatus('error');
      setMessage('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setStatus('error');
      setMessage('Passwords do not match.');
      return;
    }

    setStatus('loading');
    try {
      // 1. Update password natively via Supabase Auth (Client now has an active session from login/reset)
      const { error: authError } = await supabase.auth.updateUser({ password: password });
      
      if (authError) {
        throw authError;
      }

      // 2. Ping backend to synchronize the MongoDB user password and clear first_login flag
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await axios.post('/api/auth/sync-password', {
          access_token: session.access_token,
          password: password
        });
      } catch (backendError) {
        console.error("Failed to sync password to backend:", backendError);
      }

      setStatus('success');
      setMessage('Password updated successfully! Redirecting...');
      
      // Navigate to dashboard after 2 seconds
      setTimeout(() => {
        const defaultPath = getRedirectPath(user.roles || []);
        navigate(defaultPath, { replace: true });
        // Force reload to update user state if needed
        window.location.reload();
      }, 2000);

    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Failed to update password. Please try again.');
    }
  };

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
        <div className="polaroid -rotate-1 p-4 sm:p-8">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 tape tape-2 !w-32"></div>

          {/* Header */}
          <div className="text-center mb-8 pt-4 relative">
            <LaptopDoodle className="absolute top-0 right-4 w-10 h-10 text-pastel-mint opacity-60 animate-float-slow hidden sm:block" />
            <h1 className="font-heading text-2xl font-black text-text-primary tracking-wide relative inline-block">
              Set Your Password
              <StarDoodle className="absolute -top-4 -right-6 w-6 h-6 text-pastel-yellow animate-spin-slow" />
            </h1>
            <p className="font-body text-text-secondary text-sm mt-2">
              Please change your default password to continue.
            </p>
          </div>

          {/* Status Messages */}
          {status === 'error' && (
            <div className="mb-6 p-4 bg-pastel-coral/20 border-2 border-pastel-coral text-red-500 rounded-2xl text-sm font-bold font-quicksand flex gap-2.5 animate-fade-in-up">
              <span>⚠</span>
              <span>{message}</span>
            </div>
          )}
          {status === 'success' && (
            <div className="mb-6 p-4 bg-pastel-mint/30 border-2 border-pastel-mint text-green-600 rounded-2xl text-sm font-bold font-quicksand flex gap-2.5 animate-fade-in-up">
              <span>✓</span>
              <span>{message}</span>
            </div>
          )}

          {/* Form */}
          {status !== 'success' && (
            <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in">
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.1em] mb-2 font-quicksand" htmlFor="change-password">
                  New Password
                </label>
                <PasswordInput
                  id="change-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min 6 chars"
                  className="w-full bg-gray-50 text-text-primary placeholder-gray-400 border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-body focus:outline-none focus:border-pastel-lavender focus:ring-4 focus:ring-pastel-lavender/20 transition-all duration-300"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.1em] mb-2 font-quicksand" htmlFor="change-confirmPassword">
                  Confirm Password
                </label>
                <PasswordInput
                  id="change-confirmPassword"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm Password"
                  className="w-full bg-gray-50 text-text-primary placeholder-gray-400 border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-body focus:outline-none focus:border-pastel-lavender focus:ring-4 focus:ring-pastel-lavender/20 transition-all duration-300"
                />
              </div>

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full btn-primary py-3 rounded-2xl text-sm font-heading font-bold text-white shadow-pastel-glow disabled:opacity-50 mt-4"
              >
                {status === 'loading' ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;
