import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const AuthContext = createContext();

export const inferRole = (email) => {
  const e = (email || '').toLowerCase();
  if (e === 'admin.avento@gmail.com') return 'admin';
  if (e.endsWith('@cse.suh.edu.in') || e.endsWith('@aiml.suh.edu.in')) return 'student';
  if (e.endsWith('@suh.edu.in')) return 'faculty';
  return 'student';
};

export const getRedirectPath = (roles = []) => {
  return '/';
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        if (window.location.pathname !== '/change-password') {
          window.location.href = '/change-password';
        }
      }
    });

    const initAuth = async () => {
      const localToken = localStorage.getItem('token');
      if (localToken) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${localToken}`;
        try {
          const res = await axios.get('/api/auth/profile');
          if (res.data?.user) {
            setUser(res.data.user);
          }
        } catch (err) {
          console.error('Failed to restore session from token:', err.message);
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
        }
      }
      setLoading(false);
    };
    initAuth();

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    try {
      setLoading(true);

      // First check with backend if account needs password setup
      const res = await axios.post('/api/auth/login', { email: email.trim(), password });

      // If backend says needsPassword, return that info without trying Supabase
      if (res.data.needsPassword) {
        return { success: false, needsPassword: true, message: res.data.message };
      }

      // Now sign in via Supabase Auth (password verified by backend, but Supabase session needed)
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (authError) {
        setError(authError.message);
        return { success: false, message: authError.message };
      }
      
      const { token, user: userData } = res.data;
      
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(userData); 
      
      return { success: true };
    } catch (e) {
      const msg = e.response?.data?.message || e.message;
      const needsPassword = e.response?.data?.needsPassword || false;
      if (needsPassword) {
        return { success: false, needsPassword: true, message: msg };
      }
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });
      if (error) throw error;
      return { success: true };
    } catch (e) {
      const msg = e.message || 'Google sign-in failed.';
      setError(msg);
      setLoading(false);
      return { success: false, message: msg };
    }
  };

  const completeGoogleLogin = async () => {
    try {
      setLoading(true);
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !session?.access_token) {
        throw new Error('Could not establish Google session.');
      }

      const res = await axios.post('/api/auth/google-login', {
        access_token: session.access_token
      });

      const { token, user: userData } = res.data;
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(userData);

      return { success: true, hasPassword: userData.hasPassword };
    } catch (e) {
      const msg = e.response?.data?.message || e.message;
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async (email) => {
    try {
      setLoading(true);
      const emailLower = email.trim().toLowerCase();
      await axios.post('/api/auth/send-otp', { email: emailLower });
      return { success: true, email: emailLower };
    } catch (e) {
      const msg = e.response?.data?.message || e.message;
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const register = async (fullName, email, password, otp, profileData = {}) => {
    try {
      setLoading(true);
      await axios.post('/api/auth/register', { 
        fullName, 
        email: email.trim().toLowerCase(), 
        password, 
        otp,
        phone: profileData.phone || '',
        college: profileData.college || '',
        gender: profileData.gender || ''
      });
      return { success: true };
    } catch (e) {
      const msg = e.response?.data?.message || e.message;
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const updateProfile = async (profileData) => {
    try {
      const res = await axios.put('/api/users/profile/details', profileData);
      // Immediately update the local user state so changes propagate app-wide
      if (res.data?.user) {
        setUser(prev => ({ ...prev, ...res.data.user }));
      }
      return { success: true };
    } catch (e) {
      const msg = e.response?.data?.message || e.message;
      return { success: false, message: msg };
    }
  };

  const clearError = () => setError(null);

  const value = {
    user,
    session: null,
    loading,
    error,
    login,
    loginWithGoogle,
    completeGoogleLogin,
    register,
    logout,
    sendOtp,
    updateProfile,
    clearError,
    getRedirectPath,
    inferRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
