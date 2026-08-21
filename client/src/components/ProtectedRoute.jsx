import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent text-slate-800">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-500"></div>
          <span className="text-sm text-slate-600 font-medium tracking-wide">Verifying authorization...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const userRoles = Array.isArray(user.roles)
    ? user.roles
    : (user.role ? [user.role] : []);

  if (allowedRoles && !userRoles.some(role => allowedRoles.includes(role))) {
    return <Navigate to="/" replace />;
  }

  // Enforce first-login password change for non-admin users
  if (user.first_login && !userRoles.includes('admin')) {
    return <Navigate to="/change-password" replace />;
  }

  return children;
};

export default ProtectedRoute;
