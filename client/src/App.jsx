import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';

// Public views
import Home from './pages/Home';
import About from './pages/About';
import Contact from './pages/Contact';
import Login from './pages/Login';
import Register from './pages/Register';

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

/* Animated page wrapper — fades in content on route change */
const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <div key={location.pathname} className="animate-fade-in flex flex-col flex-grow">
      <Routes location={location}>
        {/* Public Paths */}
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

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
            <ProtectedRoute allowedRoles={['student']}>
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
        <div className="flex flex-col min-h-screen bg-[#fdfbf7] text-slate-800 relative overflow-hidden">
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
