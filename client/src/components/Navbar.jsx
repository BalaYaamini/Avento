import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const workspaceRef = useRef(null);

  // Theme State
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Notification State
  const [notifications, setNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifTimeoutRef = useRef(null);

  const handleNotifMouseEnter = () => {
    if (notifTimeoutRef.current) clearTimeout(notifTimeoutRef.current);
    setIsNotifOpen(true);
  };

  const handleNotifMouseLeave = () => {
    notifTimeoutRef.current = setTimeout(() => {
      setIsNotifOpen(false);
    }, 200);
  };

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

  // Announcement unread count
  const [announcementUnread, setAnnouncementUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      try {
        const res = await axios.get('/api/announcements/unread-summary');
        setAnnouncementUnread(res.data?.totalUnread || 0);
      } catch {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [user]);

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

  const handleNotificationItemClick = (notif) => {
    if (!notif.isRead) {
      handleMarkAsRead(notif.id);
    }
    setIsNotifOpen(false);
    setIsOpen(false);

    const title = (notif.title || '').toLowerCase();
    const message = (notif.message || '').toLowerCase();
    const type = (notif.type || '').toLowerCase();

    const isCertificateNotif = 
      title.includes('certificate') || 
      message.includes('certificate') || 
      type.includes('cert');

    if (isCertificateNotif) {
      navigate('/my-certificates');
    } else {
      navigate('/my-registrations');
    }
  };

  /* ── Scroll listener for backdrop effect ── */
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (workspaceRef.current && !workspaceRef.current.contains(event.target)) {
        setIsWorkspaceOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleWorkspaceKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsWorkspaceOpen(prev => !prev);
    } else if (e.key === 'Escape') {
      setIsWorkspaceOpen(false);
    }
  };

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    navigate('/login');
  };

  const navLinkClass = ({ isActive }) =>
    `text-sm font-semibold tracking-wide transition-all duration-300 hover:text-pastel-coral font-quicksand inline-flex items-center py-1 ${
      isActive ? 'text-pastel-lavender border-b-2 border-pastel-lavender font-bold' : 'text-text-secondary'
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
          <div className="w-52 flex-shrink-0 flex items-center">
            <Link to="/" className="flex items-center group">
              <div className="relative flex items-center">
                {/* Subtle pastel blob behind logo */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-pastel-lavender/10 rounded-full blur-md pointer-events-none"></div>
                
                <img 
                  src="/logo.png?v=3" 
                  alt="Avento Logo" 
                  className="h-14 sm:h-16 md:h-[72px] w-auto object-contain transition-all duration-300 ease-in-out group-hover:scale-[1.05] relative z-10"
                />

                {/* Tiny hand-drawn sparkle nearby */}
                <svg className="absolute -top-1 -right-3 w-4 h-4 text-pastel-coral animate-pulse pointer-events-none opacity-80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C12 7.52285 16.4772 12 22 12C16.4772 12 12 16.4772 12 22C12 16.4772 7.52285 12 2 12C7.52285 12 12 7.52285 12 2Z" fill="currentColor"/>
                </svg>
              </div>
            </Link>
          </div>

          {/* Centered Desktop Navigation Links */}
          <div className="hidden md:flex items-center justify-center flex-1 space-x-8 px-2">
            <NavLink to="/" end className={navLinkClass}>Home</NavLink>
            {/* TODO: RE-ENABLE About page — <NavLink to="/about" className={navLinkClass}>About</NavLink> */}
            <NavLink to="/contact" className={navLinkClass}>Contact</NavLink>

            {/* Student Navigation (unified) */}
              {user && user.roles?.includes('student') && (
              <>
                {/* My Workspace Dropdown */}
                <div 
                  className="relative" 
                  ref={workspaceRef}
                  onMouseEnter={() => setIsWorkspaceOpen(true)}
                  onMouseLeave={() => setIsWorkspaceOpen(false)}
                >
                  <button 
                    onClick={() => setIsWorkspaceOpen(!isWorkspaceOpen)}
                    onKeyDown={handleWorkspaceKeyDown}
                    className="flex items-center gap-1 text-sm font-semibold tracking-wide text-text-secondary hover:text-pastel-coral font-quicksand transition-all duration-300 focus:outline-none"
                    aria-haspopup="true"
                    aria-expanded={isWorkspaceOpen}
                  >
                    My Workspace
                    <svg className={`w-4 h-4 transition-transform duration-300 ${isWorkspaceOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown Menu Wrapper with padding to bridge the hover gap */}
                  <div 
                    className={`absolute left-0 top-full pt-4 w-48 z-[60] transition-all duration-300 origin-top ${
                      isWorkspaceOpen ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0 pointer-events-none'
                    }`}
                  >
                    <div className="bg-white rounded-xl shadow-lg border border-pastel-lavender/20 overflow-hidden flex flex-col py-2 relative z-[60]">
                      <NavLink 
                        to="/my-registrations" 
                        onClick={() => setIsWorkspaceOpen(false)}
                        className={({ isActive }) => `px-4 py-2 text-sm font-semibold transition-colors font-quicksand ${isActive ? 'bg-pastel-lavender/20 text-pastel-lavender border-l-4 border-pastel-lavender' : 'text-text-secondary hover:bg-pastel-lavender/10'}`}
                      >
                        Registrations
                      </NavLink>
                      <NavLink 
                        to="/my-certificates" 
                        onClick={() => setIsWorkspaceOpen(false)}
                        className={({ isActive }) => `px-4 py-2 text-sm font-semibold transition-colors font-quicksand ${isActive ? 'bg-pastel-lavender/20 text-pastel-lavender border-l-4 border-pastel-lavender' : 'text-text-secondary hover:bg-pastel-lavender/10'}`}
                      >
                        Certificates
                      </NavLink>
                      <NavLink to="/scoring-events" onClick={() => setIsWorkspaceOpen(false)} className={({ isActive }) => `px-4 py-2 text-sm font-semibold transition-colors font-quicksand ${isActive ? 'bg-pastel-lavender/20 text-pastel-lavender border-l-4 border-pastel-lavender' : 'text-text-secondary hover:bg-pastel-lavender/10'}`}>Scoring</NavLink>
                    </div>
                  </div>
                </div>

                <NavLink to="/announcements" className={navLinkClass}>Announcements{announcementUnread > 0 && <span className="ml-1 inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-bold text-white bg-red-500 rounded-full">{announcementUnread}</span>}</NavLink>
              </>
            )}

            {/* Faculty Organizer Navigation */}
            {user && (user.roles?.includes('faculty') || user.roles?.includes('faculty_organizer')) && (
               <>
                 <NavLink to="/faculty-organizer/events" className={navLinkClass}>Proposals</NavLink>
                 <NavLink to="/announcements" className={navLinkClass}>Announcements{announcementUnread > 0 && <span className="ml-1 inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-bold text-white bg-red-500 rounded-full">{announcementUnread}</span>}</NavLink>
               </>
             )}

             {/* Administrator Navigation */}
             {user && user.roles?.includes('admin') && (
               <>
                 <NavLink to="/admin" end className={navLinkClass}>Dashboard</NavLink>
                 <NavLink to="/admin/events" className={navLinkClass}>Events</NavLink>
                 <NavLink to="/admin/users" className={navLinkClass}>Users</NavLink>
                 <NavLink to="/admin/announcements" className={navLinkClass}>Announcements</NavLink>
               </>
             )}
           </div>

           {/* Profile & Auth Section (Desktop) */}
           <div className="hidden md:flex items-center justify-end w-52 space-x-3 flex-shrink-0">
             {user ? (
               <div className="flex items-center gap-3">
                 
                 {/* Theme Toggle (Desktop) */}
                 <button 
                   onClick={toggleTheme}
                   className="p-2 text-text-secondary hover:text-pastel-lavender transition-colors focus:outline-none"
                   aria-label="Toggle theme"
                 >
                   {theme === 'dark' ? (
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                   ) : (
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                   )}
                 </button>

                 {/* Notification Bell (Desktop) */}
                 <div 
                   className="relative"
                   onMouseEnter={handleNotifMouseEnter}
                   onMouseLeave={handleNotifMouseLeave}
                   onKeyDown={(e) => {
                     if (e.key === 'Escape') setIsNotifOpen(false);
                   }}
                 >
                   <button 
                     onClick={() => setIsNotifOpen(!isNotifOpen)} 
                     className="relative p-2 text-text-secondary hover:text-pastel-lavender transition-colors focus:outline-none"
                     aria-haspopup="true"
                     aria-expanded={isNotifOpen}
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

                   <div 
                     className={`absolute right-0 top-full pt-2 w-80 z-50 transition-all duration-300 origin-top ${
                       isNotifOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-2 scale-95 pointer-events-none'
                     }`}
                   >
                     <div className="bg-white rounded-2xl shadow-xl shadow-pastel-lavender/10 border border-pastel-lavender/20 overflow-hidden">
                       <div className="flex justify-between items-center px-4 py-3 bg-pastel-lavender/5 border-b border-pastel-lavender/10">
                         <h3 className="font-bold text-sm text-text-primary">Notifications</h3>
                         {unreadCount > 0 && (
                           <button onClick={handleMarkAllAsRead} className="text-xs text-pastel-lavender hover:text-pastel-coral font-semibold transition-colors focus:outline-none">
                             Mark all as read
                           </button>
                         )}
                       </div>
                       <div className="max-h-80 overflow-y-auto scrollbar-thin">
                         {notifications.length === 0 ? (
                           <div className="p-4 text-center text-sm text-text-secondary">No notifications yet.</div>
                         ) : (
                           notifications.map(notif => (
                             <div 
                               key={notif.id} 
                               onClick={() => handleNotificationItemClick(notif)}
                               onKeyDown={(e) => {
                                 if (e.key === 'Enter' || e.key === ' ') {
                                   e.preventDefault();
                                   handleNotificationItemClick(notif);
                                 }
                               }}
                               tabIndex={0}
                               className={`p-4 border-b border-gray-100 last:border-0 cursor-pointer transition-colors focus:outline-none focus:bg-pastel-lavender/10 ${!notif.isRead ? 'bg-pastel-lavender/5' : 'hover:bg-gray-50'}`}
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
                   </div>
                 </div>
                                   {/* Right Corner Profile Icon + Logout */}
                  <div className="flex items-center gap-3 bg-white/80 dark:bg-slate-800/80 px-3 py-1.5 rounded-full border border-pastel-lavender/30 shadow-soft">
                    <Link
                      to="/profile"
                      className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 via-purple-600 to-indigo-600 text-white font-heading font-black text-sm flex items-center justify-center shadow-sm hover:scale-105 hover:ring-2 hover:ring-violet-400 transition-all cursor-pointer"
                      title="View Profile"
                    >
                      {(user.fullName || user.name || user.email || 'U').charAt(0).toUpperCase()}
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="btn-secondary px-3.5 py-1 text-xs font-bold rounded-xl"
                    >
                      Logout
                    </button>
                  </div>
                </div>
             ) : (
               <div className="flex items-center gap-4">
                 {/* Theme Toggle (Desktop - Logged Out) */}
                 <button 
                   onClick={toggleTheme}
                   className="p-2 text-text-secondary hover:text-pastel-lavender transition-colors focus:outline-none"
                   aria-label="Toggle theme"
                 >
                   {theme === 'dark' ? (
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                   ) : (
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                   )}
                 </button>
                 <Link
                   to="/login"
                   className="text-sm font-bold text-text-secondary hover:text-pastel-lavender transition-colors duration-300 font-quicksand"
                 >
                   Sign In
                 </Link>
               </div>
             )}
           </div>

           {/* Mobile menu button */}
           <div className="flex items-center gap-2 md:hidden">
             {/* Theme Toggle (Mobile) */}
             <button 
               onClick={toggleTheme}
               className="p-2 text-text-secondary hover:text-pastel-lavender transition-colors focus:outline-none"
               aria-label="Toggle theme"
             >
               {theme === 'dark' ? (
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
               ) : (
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
               )}
             </button>
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
         className={`md:hidden overflow-y-auto overflow-x-hidden transition-all duration-500 ease-out-expo bg-white border-t border-pastel-lavender/20 shadow-soft ${
           isOpen ? 'max-h-[85vh] opacity-100' : 'max-h-0 opacity-0'
         }`} 
       >
         <div className="px-4 pt-4 pb-6 space-y-2">
           <NavLink to="/" end onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>Home</NavLink>
           {/* TODO: RE-ENABLE About page — <NavLink to="/about" onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>About</NavLink> */}
           <NavLink to="/contact" onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>Contact</NavLink>

           {user && user.roles?.includes('student') && (
             <>
               <div className="py-2 space-y-1">
                 <div className="px-4 py-2 text-sm font-bold text-text-primary uppercase tracking-wider">My Workspace</div>
                 <div className="pl-4 border-l-2 border-pastel-lavender/30 ml-4 space-y-1">
                   <NavLink to="/my-registrations" onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>Registrations</NavLink>
                    <NavLink to="/my-certificates" onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>Certificates</NavLink>
                    <NavLink to="/scoring-events" onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>Scoring</NavLink>
                 </div>
               </div>
               
                <NavLink to="/profile" onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>Profile</NavLink>
                 <NavLink to="/announcements" onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>Announcements{announcementUnread > 0 && <span className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-bold text-white bg-red-500 rounded-full">{announcementUnread}</span>}</NavLink>
             </>
           )}

           {user && (user.roles?.includes('faculty') || user.roles?.includes('faculty_organizer')) && (
             <>
               <NavLink to="/faculty-organizer/events" onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>Proposals</NavLink>
                <NavLink to="/profile" onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>Profile</NavLink>
                 <NavLink to="/announcements" onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>Announcements{announcementUnread > 0 && <span className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-bold text-white bg-red-500 rounded-full">{announcementUnread}</span>}</NavLink>
             </>
           )}

          {user && user.roles?.includes('admin') && (
            <>
              <NavLink to="/admin" end onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>Dashboard</NavLink>
              <NavLink to="/admin/events" onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>Events</NavLink>
                <NavLink to="/admin/users" onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>Users</NavLink>
                <NavLink to="/admin/announcements" onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>Announcements</NavLink>
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
                      onClick={() => handleNotificationItemClick(notif)}
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
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-violet-600 via-purple-600 to-indigo-600 text-white font-heading font-black text-base flex items-center justify-center shadow-sm">
                    {(user.fullName || user.name || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-pastel-coral uppercase tracking-widest font-quicksand">
                      {user.roles?.includes('admin') ? 'Admin' : 
                       (user.roles?.includes('faculty') || user.roles?.includes('faculty_organizer')) ? 'Faculty' : 
                       'Student'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="btn-secondary px-4 py-2 text-sm font-bold rounded-xl"
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
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
