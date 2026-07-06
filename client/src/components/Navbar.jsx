import { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Notification State
  const [notifications, setNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // Fetch notifications
  useEffect(() => {
    if (!user) return;
    const fetchNotifs = async () => {
      try {
        const res = await axios.get('/api/notifications/my');
        setNotifications(res.data || []);
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      }
    };
    fetchNotifs();
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkAsRead = async (id) => {
    try {
      await axios.patch(`/api/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await axios.patch('/api/notifications/my/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  /* ── Scroll listener for backdrop effect ── */
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    navigate('/login');
  };

  const navLinkClass = ({ isActive }) =>
    `text-sm font-semibold tracking-wide transition-all duration-300 hover:text-pastel-coral font-quicksand ${
      isActive ? 'text-pastel-lavender border-b-4 border-pastel-lavender pb-1 translate-y-[-2px]' : 'text-text-secondary'
    }`;

  const mobileNavLinkClass = ({ isActive }) =>
    `block text-base font-semibold px-4 py-3 rounded-2xl transition-colors font-quicksand ${
      isActive ? 'bg-pastel-lavender/20 text-pastel-lavender border-l-4 border-pastel-lavender' : 'text-text-secondary hover:bg-pastel-lavender/10'
    }`;

  return (
    <nav className={`sticky top-0 z-50 transition-all duration-500 ${scrolled ? 'bg-white/80 backdrop-blur-lg shadow-soft border-b border-pastel-lavender/30 py-1' : 'bg-transparent py-3'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo Section */}
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative flex items-center pl-2">
                {/* Subtle pastel blob behind logo */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-pastel-lavender/5 rounded-full blur-md pointer-events-none"></div>
                
                <img 
                  src="/logo.png?v=3" 
                  alt="Avento Logo" 
                  className="h-[52px] w-auto object-contain transition-all duration-300 ease-in-out group-hover:scale-[1.05] relative z-10"
                />

                {/* Tiny hand-drawn sparkle nearby */}
                <svg className="absolute -top-1 -right-3 w-4 h-4 text-pastel-coral animate-pulse pointer-events-none opacity-80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C12 7.52285 16.4772 12 22 12C16.4772 12 12 16.4772 12 22C12 16.4772 7.52285 12 2 12C7.52285 12 12 7.52285 12 2Z" fill="currentColor"/>
                </svg>
              </div>
              <span className="font-heading font-bold text-[28px] tracking-[0.5px] bg-gradient-to-r from-pastel-coral via-pastel-lavender to-pastel-yellow bg-clip-text text-transparent">
                AVENTO
              </span>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <NavLink to="/" end className={navLinkClass}>Home</NavLink>
            <NavLink to="/about" className={navLinkClass}>About</NavLink>
            <NavLink to="/contact" className={navLinkClass}>Contact</NavLink>

            {/* Student Navigation (unified) */}
            {user && user.roles?.includes('student') && (
              <>
                <NavLink to="/student-organizer" end className={navLinkClass}>Dashboard</NavLink>
                <NavLink to="/student-organizer/events" className={navLinkClass}>My Events</NavLink>
                <NavLink to="/my-registrations" className={navLinkClass}>Registrations</NavLink>
                <NavLink to="/my-certificates" className={navLinkClass}>Certificates</NavLink>
                <NavLink to="/profile" className={navLinkClass}>Profile</NavLink>
              </>
            )}

            {/* Faculty Organizer Navigation */}
            {user && (user.roles?.includes('faculty') || user.roles?.includes('faculty_organizer')) && (
               <>
                 <NavLink to="/faculty-organizer" end className={navLinkClass}>Dashboard</NavLink>
                 <NavLink to="/faculty-organizer/events" className={navLinkClass}>Proposals</NavLink>
               </>
             )}

             {/* Administrator Navigation */}
             {user && user.roles?.includes('admin') && (
               <>
                 <NavLink to="/admin" end className={navLinkClass}>Dashboard</NavLink>
                 <NavLink to="/admin/events" className={navLinkClass}>Events</NavLink>
                 <NavLink to="/admin/users" className={navLinkClass}>Users</NavLink>
               </>
             )}
           </div>

           {/* Profile & Auth Section (Desktop) */}
           <div className="hidden md:flex items-center space-x-4">
             {user ? (
               <div className="flex items-center gap-4">
                 
                 {/* Notification Bell (Desktop) */}
                 <div className="relative">
                   <button 
                     onClick={() => setIsNotifOpen(!isNotifOpen)} 
                     className="relative p-2 text-text-secondary hover:text-pastel-lavender transition-colors focus:outline-none"
                   >
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                     </svg>
                     {unreadCount > 0 && (
                       <span className="absolute top-1 right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-pastel-coral rounded-full transform translate-x-1/4 -translate-y-1/4">
                         {unreadCount > 99 ? '99+' : unreadCount}
                       </span>
                     )}
                   </button>

                   {isNotifOpen && (
                     <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-pastel-lavender/20 overflow-hidden z-50">
                       <div className="flex justify-between items-center px-4 py-3 bg-pastel-lavender/10 border-b border-pastel-lavender/20">
                         <h3 className="font-bold text-sm text-text-primary">Notifications</h3>
                         {unreadCount > 0 && (
                           <button onClick={handleMarkAllAsRead} className="text-xs text-pastel-lavender hover:text-pastel-coral font-semibold transition-colors">
                             Mark all as read
                           </button>
                         )}
                       </div>
                       <div className="max-h-80 overflow-y-auto">
                         {notifications.length === 0 ? (
                           <div className="p-4 text-center text-sm text-text-secondary">No notifications yet.</div>
                         ) : (
                           notifications.map(notif => (
                             <div 
                               key={notif.id} 
                               onClick={() => !notif.isRead && handleMarkAsRead(notif.id)}
                               className={`p-4 border-b border-gray-100 last:border-0 cursor-pointer transition-colors ${!notif.isRead ? 'bg-pastel-lavender/5' : 'hover:bg-gray-50'}`}
                             >
                               <div className="flex justify-between items-start mb-1">
                                 <h4 className={`text-sm font-semibold pr-2 ${!notif.isRead ? 'text-text-primary' : 'text-gray-600'}`}>{notif.title}</h4>
                                 {!notif.isRead && <span className="w-2 h-2 flex-shrink-0 rounded-full bg-pastel-coral mt-1"></span>}
                               </div>
                               <p className="text-xs text-gray-500 mb-2">{notif.message}</p>
                               <span className="text-[10px] text-gray-400">{new Date(notif.createdAt).toLocaleString()}</span>
                             </div>
                           ))
                         )}
                       </div>
                     </div>
                   )}
                 </div>

                 <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-full border-2 border-pastel-lavender/20 shadow-sm">
                   <div className="text-right">
                    <p className="text-[10px] font-bold text-pastel-coral uppercase tracking-widest font-quicksand">
                      {user.roles?.includes('admin') ? 'Admin' : 
                       (user.roles?.includes('faculty') || user.roles?.includes('faculty_organizer')) ? 'Faculty' : 
                       'Student'}
                    </p>
                   <p className="text-sm font-bold text-text-primary font-body">{user.fullName}</p>
                 </div>
                 <button
                   onClick={handleLogout}
                   className="btn-secondary px-4 py-1.5 text-sm font-bold rounded-xl"
                 >
                   Logout
                 </button>
                 </div>
               </div>
             ) : (
               <div className="flex items-center gap-4">
                 <Link
                   to="/login"
                   className="text-sm font-bold text-text-secondary hover:text-pastel-lavender transition-colors duration-300 font-quicksand"
                 >
                   Sign In
                 </Link>
                 <Link
                   to="/register"
                   className="btn-primary px-6 py-2.5 text-sm font-bold shadow-pastel-glow"
                 >
                   Sign Up
                 </Link>
               </div>
             )}
           </div>

           {/* Mobile menu button */}
           <div className="flex md:hidden">
             <button
               onClick={() => setIsOpen(!isOpen)}
               type="button"
               className="inline-flex items-center justify-center p-2 rounded-xl text-text-secondary hover:bg-pastel-lavender/10 focus:outline-none transition-all duration-300"
               aria-expanded={isOpen}
             >
               <span className="sr-only">Open main menu</span>
               <div className="relative w-6 h-6">
                 <span className={`absolute block h-0.5 w-6 bg-current transform transition-all duration-300 ease-out-expo rounded-full ${isOpen ? 'rotate-45 top-3' : 'top-1'}`}></span>
                 <span className={`absolute block h-0.5 w-6 bg-current top-3 transition-all duration-200 rounded-full ${isOpen ? 'opacity-0 scale-x-0' : 'opacity-100'}`}></span>
                 <span className={`absolute block h-0.5 w-6 bg-current transform transition-all duration-300 ease-out-expo rounded-full ${isOpen ? '-rotate-45 top-3' : 'top-5'}`}></span>
               </div>
             </button>
           </div>
         </div>
       </div>

       {/* Mobile Menu — Animated */}
       <div 
         className={`md:hidden overflow-hidden transition-all duration-500 ease-out-expo bg-white border-t border-pastel-lavender/20 shadow-soft ${
           isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
         }`} 
       >
         <div className="px-4 pt-4 pb-6 space-y-2">
           <NavLink to="/" end onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>Home</NavLink>
           <NavLink to="/about" onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>About</NavLink>
           <NavLink to="/contact" onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>Contact</NavLink>

           {user && user.roles?.includes('student') && (
             <>
               <NavLink to="/student-organizer" end onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>Dashboard</NavLink>
               <NavLink to="/student-organizer/events" onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>My Events</NavLink>
               <NavLink to="/my-registrations" onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>Registrations</NavLink>
               <NavLink to="/my-certificates" onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>Certificates</NavLink>
               <NavLink to="/profile" onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>Profile</NavLink>
             </>
           )}

           {user && (user.roles?.includes('faculty') || user.roles?.includes('faculty_organizer')) && (
             <>
               <NavLink to="/faculty-organizer" end onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>Dashboard</NavLink>
               <NavLink to="/faculty-organizer/events" onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>Proposals</NavLink>
             </>
           )}

          {user && user.roles?.includes('admin') && (
            <>
              <NavLink to="/admin" end onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>Dashboard</NavLink>
              <NavLink to="/admin/events" onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>Events</NavLink>
              <NavLink to="/admin/users" onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>Users</NavLink>
            </>
          )}

          {user && (
            <div className="pt-4 border-t border-pastel-lavender/20 mt-4">
              <div className="flex justify-between items-center px-4 mb-2">
                <h3 className="font-bold text-sm text-text-primary">Notifications {unreadCount > 0 && <span className="text-pastel-coral">({unreadCount})</span>}</h3>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllAsRead} className="text-xs text-pastel-lavender font-semibold">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-60 overflow-y-auto px-2">
                {notifications.length === 0 ? (
                  <div className="p-2 text-center text-sm text-text-secondary">No notifications.</div>
                ) : (
                  notifications.map(notif => (
                    <div 
                      key={notif.id} 
                      onClick={() => !notif.isRead && handleMarkAsRead(notif.id)}
                      className={`p-3 mb-2 rounded-xl border border-gray-100 cursor-pointer ${!notif.isRead ? 'bg-pastel-lavender/10' : 'bg-gray-50'}`}
                    >
                      <div className="flex justify-between items-start">
                        <h4 className="text-sm font-semibold">{notif.title}</h4>
                        {!notif.isRead && <span className="w-2 h-2 rounded-full bg-pastel-coral mt-1"></span>}
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{notif.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {user ? (
            <div className="pt-4 pb-2 mt-2 border-t border-pastel-lavender/20">
              <div className="flex items-center justify-between bg-pastel-lavender/10 p-4 rounded-2xl">
                <div>
                  <p className="text-xs font-bold text-pastel-coral uppercase tracking-widest">
                    {user.roles?.includes('admin') ? 'Admin' : 
                     (user.roles?.includes('faculty') || user.roles?.includes('faculty_organizer')) ? 'Faculty' : 
                     'Student'}
                  </p>
                  <p className="text-base font-bold text-text-primary">{user.fullName}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="btn-secondary px-4 py-2 text-sm"
                >
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-6 pb-2 mt-4 border-t border-pastel-lavender/20 flex flex-col gap-3">
              <Link
                to="/login"
                onClick={() => setIsOpen(false)}
                className="w-full text-center px-4 py-3 text-sm font-bold rounded-2xl btn-secondary"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                onClick={() => setIsOpen(false)}
                className="w-full text-center px-4 py-3 text-sm font-bold rounded-2xl btn-primary"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
