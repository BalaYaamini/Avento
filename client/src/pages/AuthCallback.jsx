import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AuthCallback = () => {
  const { completeGoogleLogin } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Completing sign-in...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const result = await completeGoogleLogin();
        if (result.success) {
          setStatus('Success! Redirecting...');
          if (result.hasPassword === false) {
            navigate('/set-password', { replace: true });
          } else {
            navigate('/', { replace: true });
          }
        } else {
          setStatus('Sign-in failed. Redirecting to login...');
          setTimeout(() => navigate('/login', { replace: true }), 2000);
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setStatus('Something went wrong. Redirecting...');
        setTimeout(() => navigate('/login', { replace: true }), 2000);
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="flex-grow flex items-center justify-center py-20 px-4 bg-background">
      <div className="text-center animate-fade-in-up">
        <div className="w-12 h-12 border-4 border-pastel-lavender border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="font-heading font-bold text-text-primary text-lg">{status}</p>
      </div>
    </div>
  );
};

export default AuthCallback;
