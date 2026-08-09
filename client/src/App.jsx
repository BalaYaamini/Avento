import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import SplashScreen from './components/SplashScreen';

// Public views
import Home from './pages/Home';
import About from './pages/About';
import Contact from './pages/Contact';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ChangePassword from './pages/ChangePassword';

// Protected Student views
import Profile from './pages/Profile';
import StudentRegistrations from './pages/StudentRegistrations';
import StudentCertificates from './pages/StudentCertificates';

// Protected Administrator views
import AdminDashboard from './pages/AdminDashboard';
import AdminEvents from './pages/AdminEvents';
import AdminRegistrations from './pages/AdminRegistrations';
import AdminUsers from './pages/AdminUsers';

// Protected Faculty Organizer views
import FacultyOrgDashboard from './pages/FacultyOrgDashboard';
import FacultyOrgEvents from './pages/FacultyOrgEvents';

// Protected Student Organizer views
import StudentOrgDashboard from './pages/StudentOrgDashboard';
import StudentOrgEvents from './pages/StudentOrgEvents';

// Workspace view
import Workspace from './pages/Workspace';
import ProposalWorkspace from './pages/ProposalWorkspace';

/* Global Alert Override */
const GlobalAlert = () => {
  const [alertConfig, setAlertConfig] = useState({ isOpen: false, message: '' });

  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (message) => {
      setAlertConfig({ isOpen: true, message: String(message) });
    };

    return () => {
      window.alert = originalAlert;
    };
  }, []);

  if (!alertConfig.isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-fuchsia-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-fuchsia-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800 font-heading">Notification</h3>
          </div>
          <p className="text-slate-600 font-body whitespace-pre-wrap leading-relaxed">{alertConfig.message}</p>
        </div>
        <div className="bg-slate-50 px-6 py-4 flex justify-end">
          <button
            onClick={() => setAlertConfig({ isOpen: false, message: '' })}
            className="btn-primary px-6 py-2 text-sm font-bold rounded-xl text-white shadow-lg shadow-fuchsia-500/15"
          >
            Okay
          </button>
        </div>
      </div>
    </div>
  );
};

/* Animated page wrapper — fades in content on route change */
const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <div key={location.pathname} className="animate-fade-in flex flex-col flex-grow">
      <Routes location={location}>
        {/* Public Paths */}
        <Route path="/" element={<Home />} />
        {/* TODO: RE-ENABLE About page — <Route path="/about" element={<About />} /> */}
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/change-password" element={<ChangePassword />} />

        {/* Student Paths — accessible to both student and student_organizer */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-registrations"
          element={
            <ProtectedRoute allowedRoles={['student', 'faculty', 'student_organizer', 'faculty_organizer']}>
              <StudentRegistrations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-certificates"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentCertificates />
            </ProtectedRoute>
          }
        />

        {/* Administrator Only Paths */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/events"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminEvents />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/registrations"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminRegistrations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminUsers />
            </ProtectedRoute>
          }
        />

        {/* Faculty Organizer Only Paths */}
        <Route
          path="/faculty-organizer"
          element={
            <ProtectedRoute allowedRoles={['faculty', 'faculty_organizer']}>
              <FacultyOrgDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/faculty-organizer/events"
          element={
            <ProtectedRoute allowedRoles={['faculty', 'faculty_organizer']}>
              <FacultyOrgEvents />
            </ProtectedRoute>
          }
        />

        {/* Student Organizer Paths — only for student_organizer role */}
        <Route
          path="/student-organizer"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentOrgDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student-organizer/events"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentOrgEvents />
            </ProtectedRoute>
          }
        />

        {/* Workspace Path - Protected for roles that can be organizers or faculty */}
        <Route
          path="/workspace/:eventId"
          element={
            <ProtectedRoute allowedRoles={['admin', 'faculty', 'faculty_organizer', 'student']}>
              <Workspace />
            </ProtectedRoute>
          }
        />

        {/* Proposal Workspace Path */}
        <Route
          path="/proposals/:proposalId"
          element={
            <ProtectedRoute allowedRoles={['admin', 'faculty', 'faculty_organizer', 'student']}>
              <ProposalWorkspace />
            </ProtectedRoute>
          }
        />

        {/* Catch-all fallback */}
        <Route path="*" element={<Home />} />
      </Routes>
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <SplashScreen />
        <GlobalAlert />
        <div className="flex flex-col min-h-screen bg-background text-text-primary relative overflow-hidden transition-colors duration-300">
          {/* ── Animated Background Orbs ── */}
          <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
            <div className="absolute top-[-200px] left-[-200px] w-[700px] h-[700px] rounded-full bg-gradient-to-tr from-[#FFB6C1]/20 via-[#C8A2C8]/15 to-[#E6E6FA]/20 blur-[150px] animate-orb-1" />
            <div className="absolute bottom-[-250px] right-[-250px] w-[900px] h-[900px] rounded-full bg-gradient-to-br from-[#98FF98]/15 via-[#ADD8E6]/20 to-[#E6E6FA]/15 blur-[180px] animate-orb-2" />
            <div className="absolute top-[30%] right-[5%] w-[500px] h-[500px] rounded-full bg-gradient-to-bl from-[#FFDAB9]/20 via-[#FFFACD]/15 to-[#F08080]/10 blur-[130px] animate-orb-3" />
            <div className="absolute inset-0 dot-pattern opacity-20" />
          </div>

          <div className="relative z-10 flex flex-col min-h-screen w-full">
            <Navbar />
            <main className="flex-grow flex flex-col relative">
              <AnimatedRoutes />
            </main>
            <Footer />
          </div>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
