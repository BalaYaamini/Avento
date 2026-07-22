import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

// Supabase client (kept ONLY for events data fetching in other parts of the app if needed)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const AuthContext = createContext();

export const inferRole = (email) => {
  const e = (email || '').toLowerCase();
  if (e.endsWith('@cse.suh.edu.in') || e.endsWith('@aiml.suh.edu.in')) return 'student';
  if (e.endsWith('@suh.edu.in')) return 'faculty';
  if (e === 'admin.avento@gmail.com') return 'admin';
  return null;
};

export const getRedirectPath = (roles = []) => {
  if (roles.includes('admin')) return '/admin';
  if (roles.includes('faculty') || roles.includes('faculty_organizer')) return '/faculty-organizer';
  return '/'; // students go to home
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
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
  }, []);

  const login = async (email, password) => {
    try {
      setLoading(true);

      // Sign in with Supabase Auth to establish the client-side session
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });
      // We don't throw authError here to allow the backend logic to be the final decider,
      // but it establishes the session if successful!

      const res = await axios.post('/api/auth/login', { email: email.trim(), password });
      
      const { token, user: userData } = res.data;
      
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Trust the backend response completely, no client-side overrides
      setUser(userData); 
      
      return { success: true };
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

  const register = async (fullName, email, password, otp) => {
    try {
      setLoading(true);
      await axios.post('/api/auth/register', { 
        fullName, 
        email: email.trim().toLowerCase(), 
        password, 
        otp 
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
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const updateProfile = async (newName) => {
    try {
      const res = await axios.put('/api/users/profile/name', { name: newName });
      // Immediately update the local user state so changes propagate app-wide
      if (res.data?.user) {
        setUser(prev => ({ ...prev, fullName: res.data.user.fullName }));
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
    session: null, // Stub for backward compatibility
    loading,
    error,
    login,
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
