import { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const { theme, toggleTheme } = useTheme();

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
    `text-sm font-semibold tracking-wide transition-all duration-300 hover:text-pastel-coral font-quicksand inline-flex items-center py-1 ${
      isActive ? 'text-pastel-lavender border-b-2 border-pastel-lavender font-bold' : 'text-text-secondary'
    }`;

  const mobileNavLinkClass = ({ isActive }) =>
    `block text-base font-semibold px-4 py-3 rounded-2xl transition-colors font-quicksand ${
      isActive ? 'bg-pastel-lavender/20 text-pastel-lavender border-l-4 border-pastel-lavender' : 'text-text-secondary hover:bg-pastel-lavender/10'
    }`;

  return (
    <nav className={`sticky top-0 z-50 transition-[background-color,border-color,box-shadow] duration-200 py-2.5 ${
      scrolled
        ? 'bg-white/90 dark:bg-[#0F172A]/90 backdrop-blur-md shadow-sm border-b border-pastel-lavender/30 dark:border-slate-800'
        : 'bg-transparent border-b border-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex-shrink-0">
            <Link to="/" className="flex items-center gap-2.5 group">
              <img src="/logo-mark.png?v=4" alt="Avento Logo" className="h-10 w-auto object-contain logo-cyan-tint" />
              <span className="font-display font-black text-2xl tracking-tight navbar-logo-text transition-all duration-300">AVENTO</span>
            </Link>
          </div>

          <div className="hidden md:flex items-center justify-center flex-1 space-x-8 px-2">
            <NavLink to="/" end className={navLinkClass}>Home</NavLink>
            <NavLink to="/contact" className={navLinkClass}>Contact</NavLink>
          </div>

          <div className="hidden md:flex items-center justify-end w-52 space-x-3 flex-shrink-0">
            <button onClick={toggleTheme} className="p-2 text-text-secondary hover:text-pastel-lavender transition-colors focus:outline-none cursor-pointer" aria-label="Toggle theme">
              {theme === 'dark' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>
            {user ? (
              <div className="flex items-center gap-3">
                <Link to="/profile" className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 via-cyan-600 to-cyan-700 text-white font-heading font-black text-sm flex items-center justify-center shadow-sm hover:scale-105 hover:ring-2 hover:ring-cyan-400 transition-all cursor-pointer" title="View Profile">
                  {(user.fullName || user.name || user.email || 'U').charAt(0).toUpperCase()}
                </Link>
                <button onClick={handleLogout} className="btn-secondary px-3.5 py-1 text-xs font-bold rounded-xl cursor-pointer">Logout</button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <Link to="/login" className="text-sm font-bold text-text-secondary hover:text-pastel-lavender transition-colors duration-300 font-quicksand">Sign In</Link>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <button onClick={toggleTheme} className="p-2 text-text-secondary hover:text-pastel-lavender transition-colors focus:outline-none cursor-pointer" aria-label="Toggle theme">
              {theme === 'dark' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>
            <button onClick={() => setIsOpen(!isOpen)} type="button" className="inline-flex items-center justify-center p-2 rounded-xl text-text-secondary hover:bg-pastel-lavender/10 focus:outline-none transition-all duration-300 cursor-pointer" aria-expanded={isOpen}>
              <span className="sr-only">Open main menu</span>
              <div className="relative w-6 h-6">
                <span className={`absolute block h-0.5 w-6 bg-current transform transition-all duration-300 ease-out-expo rounded-full ${isOpen ? 'rotate-45 top-3' : 'top-1'}`}></span>
                <span className={`absolute block h-0.5 w-6 bg-current top-3 transition-all duration-200 rounded-full ${isOpen ? 'opacity-0 scale-x-0' : 'opacity-100'}`}></span>
                <span className={`absolute block h-0.5 w-6 bg-current transform transition-all duration-300 ease-out-expo rounded-full ${isOpen ? '-rotate-45 top-3' : 'top-5'}`}></span>
              </div>
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        <div className={`md:hidden overflow-y-auto overflow-x-hidden transition-all duration-500 ease-out-expo bg-white dark:bg-[#0F172A] border-t border-pastel-lavender/20 dark:border-slate-800 shadow-soft ${isOpen ? 'max-h-[85vh] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="px-4 pt-4 pb-6 space-y-2">
            <NavLink to="/" end onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>Home</NavLink>
            <NavLink to="/contact" onClick={() => setIsOpen(false)} className={mobileNavLinkClass}>Contact</NavLink>
            {user ? (
              <div className="pt-4 border-t border-pastel-lavender/20 dark:border-slate-800 mt-4">
                <div className="flex items-center justify-between bg-pastel-lavender/10 dark:bg-slate-800/50 p-4 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 via-cyan-600 to-cyan-700 text-white font-heading font-black text-base flex items-center justify-center shadow-sm">
                      {(user.fullName || user.name || user.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{user.fullName || user.name || user.email}</div>
                      <p className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest font-quicksand">
                        {user.email === 'admin.avento@gmail.com' ? 'Avento Admin' :
                         user.roles?.includes('admin') ? 'University Admin' :
                         (user.roles?.includes('faculty') || user.roles?.includes('faculty_organizer')) ? 'Faculty' :
                         'Student'}
                      </p>
                    </div>
                  </div>
                  <button onClick={handleLogout} className="btn-secondary px-4 py-2 text-sm font-bold rounded-xl cursor-pointer">Logout</button>
                </div>
              </div>
            ) : (
              <div className="pt-6 pb-2 mt-4 border-t border-pastel-lavender/20 dark:border-slate-800 flex flex-col gap-3">
                <Link to="/login" onClick={() => setIsOpen(false)} className="w-full text-center px-4 py-3 text-sm font-bold rounded-2xl btn-secondary">Sign In</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
