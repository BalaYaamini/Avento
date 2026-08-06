import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, supabase } from '../context/AuthContext';
import { SparkleDoodle, StarDoodle, LaptopDoodle } from '../components/Doodles';
import PasswordInput from '../components/PasswordInput';
import axios from 'axios';
import { validatePasswordStrength } from '../utils/passwordValidator';

const ChangePassword = () => {
  const { user, getRedirectPath } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState(null); // 'loading', 'success', 'error'
  const [message, setMessage] = useState('');

  const reqs = {
    length: password.length >= 8 && password.length <= 128,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9\s]/.test(password),
    nospaces: !/\s/.test(password) && password.length > 0,
    notdefault: password !== 'Student@123' && password !== 'Faculty@123' && password.length > 0
  };

  const allReqsMet = validatePasswordStrength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setStatus('error');
      setMessage('Please fill in all fields.');
      return;
    }

    if (!allReqsMet) {
      setStatus('error');
      setMessage('Please ensure all password requirements are met.');
      return;
    }

    if (password !== confirmPassword) {
      setStatus('error');
      setMessage('Passwords do not match.');
      return;
    }

    setStatus('loading');
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Your session has expired. Please log in again.');
      }

      await axios.post('/api/auth/sync-password', {
        access_token: session.access_token,
        password: password
      });

      if (user) {
        // First login flow: user is already authenticated with backend
        setStatus('success');
        setMessage('Password updated successfully! Redirecting to your dashboard...');
        
        setTimeout(() => {
          const defaultPath = getRedirectPath(user?.roles || []);
          navigate(defaultPath, { replace: true });
          window.location.reload();
        }, 2000);
      } else {
        // Forgot Password reset flow: no backend user session yet
        setStatus('success');
        setMessage('Password updated successfully. Please login with your new password.');
        
        // Clear the temporary Supabase recovery session
        await supabase.auth.signOut();
        
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 3000);
      }

    } catch (err) {
      setStatus('error');
      setMessage(err.response?.data?.message || err.message || 'Failed to update password. Please try again.');
    }
  };

  const CheckItem = ({ met, text }) => (
    <div className={`flex items-center gap-2 text-xs font-bold font-quicksand transition-colors ${met ? 'text-green-600' : 'text-slate-400'}`}>
      <span>{met ? '✓' : '○'}</span>
      <span>{text}</span>
    </div>
  );

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
                  placeholder="New Password"
                  className="w-full bg-gray-50 text-text-primary placeholder-gray-400 border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-body focus:outline-none focus:border-pastel-lavender focus:ring-4 focus:ring-pastel-lavender/20 transition-all duration-300"
                />
                { (password === 'Student@123' || password === 'Faculty@123') && (
                  <p className="text-red-500 text-xs font-bold mt-2 animate-fade-in-up">
                    You cannot use your default password. Please create a new password.
                  </p>
                )}
              </div>

              {/* Dynamic Checklist */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-1.5 mt-2">
                <p className="text-xs font-bold text-slate-700 mb-1">Password requirements:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <CheckItem met={reqs.length} text="Minimum 8 characters" />
                  <CheckItem met={reqs.uppercase} text="One uppercase letter" />
                  <CheckItem met={reqs.lowercase} text="One lowercase letter" />
                  <CheckItem met={reqs.number} text="One number" />
                  <CheckItem met={reqs.special} text="One special character" />
                  <CheckItem met={reqs.nospaces} text="No spaces" />
                  <CheckItem met={reqs.notdefault} text="Password must not be the default password (Student@123 / Faculty@123)" />
                  <CheckItem met={password.length > 0} text="Password must be different from your current password" />
                </div>
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
