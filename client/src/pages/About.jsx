import { SparkleDoodle, StarDoodle, HeartDoodle, RocketDoodle, SquiggleDoodle } from '../components/Doodles';

const About = () => {
  const stats = [
    { value: '25+', label: 'Monthly Events', icon: '📅' },
    { value: '4,000+', label: 'Registered Students', icon: '👥' },
    { value: '98%', label: 'Attendance Satisfaction', icon: '⭐' },
    { value: '15+', label: 'Student Clubs & Societies', icon: '🎯' }
  ];

  const futureFeatures = [
    { title: 'OTP Verification', desc: 'Secure student authentication and reduced spam through verification systems.', icon: '🔐' },
    { title: 'Faculty and Coordinator Roles', desc: 'Structured approval workflows for event proposals and organizing groups.', icon: '👨‍🏫' },
    { title: 'Analytics Dashboard', desc: 'Visual insights into event participation, engagement, and seat occupancy trends.', icon: '📊' },
    { title: 'Waitlist and QR Attendance System', desc: 'Automated check-in system using QR codes for physical event tracking.', icon: '📱' },
    { title: 'Certificate Generation', desc: 'Automated certificate distribution for verified and attended participants.', icon: '🏆' }
  ];

  return (
    <div className="flex-grow py-20 text-slate-700">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Banner Section */}
        <div className="text-center mb-20 animate-fade-in-up">
          <div className="flex justify-center mb-5">
            <span className="inline-flex items-center gap-2 text-[10px] font-bold px-4 py-1.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 uppercase tracking-[0.15em]">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
              Portal Overview
            </span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-black text-text-primary mt-4 mb-5 tracking-tight relative inline-block">
            Unified Campus <span className="heading-gradient">Engagement Platform</span>
            <SparkleDoodle className="absolute -top-6 -right-8 w-10 h-10 text-pastel-coral animate-pulse" />
          </h1>
          <p className="font-body text-slate-600 max-w-2xl mx-auto text-lg leading-relaxed relative">
            <HeartDoodle className="absolute -top-4 -left-8 w-6 h-6 text-pastel-pink animate-bounce-gentle hidden sm:block" />
            AVENTO is a campus engagement platform designed by students for students, connecting event coordinators with participants and simplifying event discovery, registration, and management.
            <StarDoodle className="absolute -bottom-6 -right-6 w-8 h-8 text-pastel-yellow animate-float hidden sm:block" />
          </p>
        </div>

        <div className="flex justify-center mb-16 animate-fade-in-up">
          <SquiggleDoodle className="w-24 h-6 text-pastel-lavender/50" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-20">
          {stats.map((stat, i) => (
            <div 
              key={i} 
              className="animate-fade-in-up glass-panel glass-panel-hover p-6 rounded-2xl text-center group cursor-default"
              style={{ animationDelay: `${i * 100 + 100}ms` }}
            >
              <div className="text-2xl mb-2 group-hover:scale-125 transition-transform duration-300">{stat.icon}</div>
              <div className="text-2xl sm:text-3xl font-display font-black heading-gradient mb-1">
                {stat.value}
              </div>
              <div className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em]">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Detail Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          <div className="animate-fade-in-up delay-100 glass-panel glass-panel-hover p-8 rounded-2xl group">
            <h3 className="text-lg font-display font-bold text-text-primary mb-3 flex items-center gap-3 relative">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-pastel-coral/20 flex items-center justify-center border border-violet-500/20 group-hover:scale-110 transition-transform">
                <div className="h-2 w-2 rounded-full bg-violet-400" />
              </div>
              For Students
              <RocketDoodle className="absolute -top-4 right-4 w-6 h-6 text-pastel-lavender opacity-0 group-hover:opacity-100 group-hover:-translate-y-2 group-hover:translate-x-2 transition-all duration-500" />
            </h3>
            <p className="text-sm font-body text-slate-600 leading-relaxed mb-5">
              Students can easily explore and participate in campus activities including workshops, cultural events, sports tournaments, and hackathons through a clean, modern interface.
            </p>
            <ul className="space-y-2.5 text-xs font-bold text-slate-700">
              <li className="flex items-center gap-2.5">
                <span className="text-emerald-400">✓</span> Dynamic search and category-based filtering
              </li>
              <li className="flex items-center gap-2.5">
                <span className="text-emerald-400">✓</span> Real-time seat availability tracking
              </li>
              <li className="flex items-center gap-2.5">
                <span className="text-emerald-400">✓</span> Personal registration history and tracking
              </li>
            </ul>
          </div>

          <div className="animate-fade-in-up delay-200 glass-panel glass-panel-hover p-8 rounded-2xl group">
            <h3 className="text-lg font-display font-bold text-text-primary mb-3 flex items-center gap-3 relative">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 flex items-center justify-center border border-indigo-500/20 group-hover:scale-110 transition-transform">
                <div className="h-2 w-2 rounded-full bg-indigo-400" />
              </div>
              For Administrators
              <StarDoodle className="absolute -top-2 right-4 w-6 h-6 text-pastel-yellow opacity-0 group-hover:opacity-100 group-hover:rotate-45 transition-all duration-500" />
            </h3>
            <p className="text-sm font-body text-slate-600 leading-relaxed mb-5">
              Event organizers and administrators can efficiently manage events, participants, and engagement metrics through a centralized system.
            </p>
            <ul className="space-y-2.5 text-xs font-bold text-slate-700">
              <li className="flex items-center gap-2.5">
                <span className="text-emerald-400">✓</span> Instant event publishing with banners and updates
              </li>
              <li className="flex items-center gap-2.5">
                <span className="text-emerald-400">✓</span> Complete registration and participant management
              </li>
              <li className="flex items-center gap-2.5">
                <span className="text-emerald-400">✓</span> Quick access to user and event insights
              </li>
            </ul>
          </div>
        </div>

        <div className="animate-fade-in-up delay-300 glass-panel rounded-2xl p-8 relative">
          <SparkleDoodle className="absolute -top-3 left-4 w-6 h-6 text-pastel-yellow animate-float-slow" />
          <h3 className="text-xl font-display font-bold text-text-primary mb-8 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500/15 to-pastel-coral/15 flex items-center justify-center border border-violet-500/15">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            Future Product Roadmap
          </h3>
          <div className="space-y-6">
            {futureFeatures.map((feat, i) => (
              <div 
                key={i} 
                className="flex gap-5 border-l-2 border-slate-200/60 pl-5 hover:border-violet-500 transition-all duration-500 group cursor-default"
              >
                <div className="flex-shrink-0 text-xl group-hover:scale-110 transition-transform duration-300">{feat.icon}</div>
                <div>
                  <h4 className="text-sm font-display font-bold text-slate-800 group-hover:text-text-primary transition-colors">{feat.title}</h4>
                  <p className="text-xs font-body text-slate-600 mt-1 leading-relaxed group-hover:text-slate-600 transition-colors">{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default About;
