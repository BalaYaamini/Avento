import { useState } from 'react';
import { Link } from 'react-router-dom';
import { inferRole } from '../context/AuthContext';
import axios from 'axios';
import { StarDoodle, SparkleDoodle, BookDoodle } from '../components/Doodles';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null); // 'loading', 'success', 'error'
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setStatus('error');
      setMessage('Please enter your email address.');
      return;
    }

    const emailLower = email.trim().toLowerCase();
    const role = inferRole(emailLower);

    if (role !== 'student' && role !== 'faculty' && role !== 'admin') {
      setStatus('error');
      setMessage('Only registered users can reset passwords.');
      return;
    }

    setStatus('loading');
    try {
      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      await axios.post('/api/auth/send-password-reset', {
        email: emailLower,
        redirectTo: `${appUrl}/change-password`,
      });

      setStatus('success');
      setMessage(`Password reset link sent to ${emailLower}. Please check your inbox.`);
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Failed to send reset link. Please try again.');
    }
  };

  return (
    <div className="flex-grow flex items-center justify-center py-20 px-4 bg-background relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-1/4 right-1/4 h-64 w-64 rounded-full bg-pastel-lavender/30 blur-3xl mix-blend-multiply opacity-50 animate-float-slow"></div>
      <div className="absolute bottom-1/4 left-1/4 h-72 w-72 rounded-full bg-pastel-mint/30 blur-3xl mix-blend-multiply opacity-50 animate-float"></div>

      {/* Decorative Doodles */}
      <div className="absolute top-20 right-20 animate-wobble hidden md:block">
        <SparkleDoodle className="w-16 h-16 text-pastel-lavender" />
      </div>
      <div className="absolute bottom-20 left-20 animate-bounce-gentle hidden md:block">
        <StarDoodle className="w-12 h-12 text-pastel-mint" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        <div className="polaroid -rotate-1 p-8">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 tape tape-3 !w-32"></div>
          
          {/* Header */}
          <div className="text-center mb-8 pt-4 relative">
            <BookDoodle className="absolute top-0 right-4 w-8 h-8 text-pastel-mint opacity-60 animate-float-slow hidden sm:block" />
            <h1 className="font-heading text-2xl font-black text-text-primary tracking-wide relative inline-block">
              Reset Password
              <StarDoodle className="absolute -top-4 -left-6 w-6 h-6 text-pastel-yellow animate-spin-slow" />
            </h1>
            <p className="font-body text-text-secondary text-sm mt-2">Enter your institutional email</p>
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
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.1em] mb-2 font-quicksand" htmlFor="reset-email">
                  Institutional Email
                </label>
                <input
                  type="email"
                  id="reset-email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@university.edu"
                  className="w-full bg-gray-50 text-text-primary placeholder-gray-400 border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-body focus:outline-none focus:border-pastel-lavender focus:ring-4 focus:ring-pastel-lavender/20 transition-all duration-300"
                />
              </div>

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full btn-primary py-3 rounded-2xl text-sm font-heading font-bold text-white shadow-pastel-glow disabled:opacity-50 mt-4"
              >
                {status === 'loading' ? 'Sending Link...' : 'Send Reset Link'}
              </button>
            </form>
          )}

          {/* Back to Login link */}
          <div className="text-center mt-6">
            <Link to="/login" className="text-xs font-quicksand font-bold text-pastel-lavender hover:text-pastel-pink transition-colors">
              ← Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
