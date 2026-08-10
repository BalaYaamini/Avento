import { Link } from 'react-router-dom';
import { StarDoodle, LeafDoodle, FlowerDoodle } from './Doodles';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative bg-slate-900 mt-auto">
      {/* Top gradient divider */}
      <div className="relative">
        <div className="gradient-line-thick" />
        <LeafDoodle className="absolute -top-4 left-1/4 w-8 h-8 text-pastel-mint opacity-40 animate-wobble hidden md:block" />
        <FlowerDoodle className="absolute -top-5 right-1/4 w-10 h-10 text-pastel-pink opacity-40 animate-spin-slow hidden md:block" />
      </div>

      <div className="max-w-7xl mx-auto px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand Column */}
          <div className="space-y-5 col-span-1 md:col-span-2 relative">
            <StarDoodle className="absolute -top-6 -left-4 w-6 h-6 text-pastel-yellow opacity-40 animate-pulse" />
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 flex items-center justify-center p-1 transition-all duration-300">
                <img src="/logo.png?v=3" alt="Avento Logo" className="h-[52px] w-auto object-contain drop-shadow-sm" />
              </div>
              <span className="font-display font-extrabold text-xl tracking-wider text-white">AVENTO</span>
            </div>
            <p className="text-sm font-body text-slate-400 max-w-sm leading-relaxed">
              AVENTO is the centralized campus activity engine, simplifying event exploration, seat booking, and attendance tracking for students, and dashboard controls for organizers.
            </p>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.15em]">
              Powered by University Tech Division
            </div>
          </div>

          {/* Quick Links Column */}
          <div>
            <h3 className="text-xs font-display font-bold text-slate-300 uppercase tracking-[0.15em] mb-5">Platform</h3>
            <ul className="space-y-3 text-sm font-body text-slate-400">
              <li>
                <Link to="/" className="hover:text-white transition-all duration-300 hover:pl-1 inline-block">Browse Events</Link>
              </li>
              <li>
              {/* TODO: RE-ENABLE About page — <Link to="/about" className="hover:text-white transition-all duration-300 hover:pl-1 inline-block">About Portal</Link> */}
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-all duration-300 hover:pl-1 inline-block">Help Desk</Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-white transition-all duration-300 hover:pl-1 inline-block">Account Access</Link>
              </li>
            </ul>
          </div>

          {/* Contact & Support Column */}
          <div>
            <h3 className="text-xs font-display font-bold text-slate-300 uppercase tracking-[0.15em] mb-5">Support</h3>
            <div className="space-y-3">
              <p className="text-sm font-body text-slate-400 font-medium">Contact Us</p>
              <p className="text-sm text-slate-400">
                Email: <a href="mailto:admin.avento@gmail.com" className="text-slate-300 hover:text-white transition-colors cursor-pointer border-b border-transparent hover:border-white">admin.avento@gmail.com</a>
              </p>
              <p className="text-sm text-slate-400">Call: <span className="text-slate-300">9849808611 / 8008075869</span></p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-800 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-medium gap-4">
          <p>&copy; {currentYear} AVENTO — University Event Management Platform. All rights reserved.</p>
          <div className="flex items-center space-x-4">
            <span className="hover:text-slate-300 cursor-pointer transition-colors">Privacy Policy</span>
            <span className="text-slate-600">&bull;</span>
            <span className="hover:text-slate-300 cursor-pointer transition-colors">Terms of Service</span>
            <span className="text-slate-600">&bull;</span>
            <span className="hover:text-slate-300 cursor-pointer transition-colors">Campus Guidelines</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
