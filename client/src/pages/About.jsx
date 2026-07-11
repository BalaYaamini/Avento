import React from 'react';
import { 
  SparkleDoodle, StarDoodle, HeartDoodle, SquiggleDoodle, RocketDoodle, 
  TicketDoodle, CalendarDoodle, CertificateDoodle, QRDoodle, 
  GraduationCapDoodle, CollaborationDoodle, LeafDoodle, FlowerDoodle, CloudDoodle, TargetDoodle,
  ArrowDoodle, CampusJourneyDoodle
} from '../components/Doodles';

const About = () => {
  const platformHighlights = [
    { title: 'Smart Event Registration', desc: 'Seamlessly discover and register for events with one click.', icon: <TicketDoodle className="w-10 h-10 text-pastel-coral" /> },
    { title: 'QR Attendance', desc: 'Fast, secure, and touchless check-ins for every participant.', icon: <QRDoodle className="w-10 h-10 text-pastel-blue" /> },
    { title: 'Certificate Generation', desc: 'Automated digital credentials for your achievements.', icon: <CertificateDoodle className="w-10 h-10 text-pastel-yellow" /> },
    { title: 'Event Discovery', desc: 'Find workshops, hackathons, and cultural fests easily.', icon: <TargetDoodle className="w-10 h-10 text-pastel-mint" /> },
    { title: 'Smart Notifications', desc: 'Stay updated with personalized event reminders.', icon: <SparkleDoodle className="w-10 h-10 text-pastel-pink" /> },
    { title: 'Organizer Workspace', desc: 'A dedicated command center for event coordinators.', icon: <CollaborationDoodle className="w-10 h-10 text-pastel-lavender" /> }
  ];

  const studentJourney = [
    { step: 'Discover', icon: <TargetDoodle className="w-8 h-8 text-pastel-lavender" /> },
    { step: 'Register', icon: <TicketDoodle className="w-8 h-8 text-pastel-coral" /> },
    { step: 'Participate', icon: <HeartDoodle className="w-8 h-8 text-pastel-pink" /> },
    { step: 'Scan QR', icon: <QRDoodle className="w-8 h-8 text-pastel-blue" /> },
    { step: 'Earn Certificates', icon: <CertificateDoodle className="w-8 h-8 text-pastel-yellow" /> }
  ];

  const organizerJourney = [
    { step: 'Create Event', icon: <CalendarDoodle className="w-8 h-8 text-pastel-lavender" /> },
    { step: 'Manage Registrations', icon: <CollaborationDoodle className="w-8 h-8 text-pastel-mint" /> },
    { step: 'Track Attendance', icon: <QRDoodle className="w-8 h-8 text-pastel-blue" /> },
    { step: 'Issue Certificates', icon: <CertificateDoodle className="w-8 h-8 text-pastel-yellow" /> },
    { step: 'Celebrate Success', icon: <SparkleDoodle className="w-8 h-8 text-pastel-pink" /> }
  ];

  return (
    <div className="flex-grow overflow-hidden bg-background transition-colors duration-300">
      
      {/* 1. HERO SECTION */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col items-center text-center">
        <CloudDoodle className="absolute top-20 left-10 w-16 h-16 text-pastel-blue/40 mix-blend-multiply animate-float-slow hidden md:block" />
        <CloudDoodle className="absolute top-40 right-16 w-20 h-20 text-pastel-lavender/30 mix-blend-multiply animate-float hidden md:block" />
        <StarDoodle className="absolute top-32 left-1/4 w-8 h-8 text-pastel-yellow mix-blend-multiply animate-pulse hidden sm:block" />
        <SparkleDoodle className="absolute top-24 right-1/4 w-10 h-10 text-pastel-pink mix-blend-multiply animate-bounce-gentle" />

        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-pastel-lavender/10 text-pastel-lavender border border-pastel-lavender/20 mb-8 animate-fade-in-up">
          <LeafDoodle className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-widest">Our Story</span>
        </div>

        <h1 className="font-display text-5xl md:text-7xl font-black text-slate-800 mb-6 tracking-tight animate-fade-in-up delay-100 relative">
          More than an Event Platform.
          <br className="hidden md:block" />
          <span className="relative inline-block mt-2">
            AVENTO is where campus
            <span className="relative inline-block mx-3">
              <span className="relative z-10 text-pastel-coral">memories</span>
              <SquiggleDoodle className="absolute -bottom-2 left-0 w-full h-4 text-pastel-yellow/60 z-0" />
            </span>
            begin.
          </span>
        </h1>

        <p className="font-body text-slate-600 text-lg md:text-xl max-w-3xl mx-auto leading-relaxed mb-12 animate-fade-in-up delay-200">
          AVENTO is built to simplify the entire campus event journey. From discovering the perfect workshop to registering, attending, and earning your digital certificates, we make campus life effortless and engaging.
        </p>

        <div className="relative animate-fade-in-up delay-300 w-full max-w-2xl mx-auto">
          <div className="absolute inset-0 bg-gradient-to-r from-pastel-lavender/30 to-pastel-coral/30 mix-blend-multiply blur-3xl rounded-full" />
          <div className="relative glass-panel backdrop-blur-xl border border-slate-200 shadow-2xl shadow-pastel-lavender/10 rounded-[3rem] p-8 md:p-12 flex justify-center items-center scrapbook-panel-hover">
            <CampusJourneyDoodle className="w-64 h-64 md:w-80 md:h-80 animate-float-slow z-10" />
            <GraduationCapDoodle className="absolute -top-6 -right-6 w-16 h-16 text-pastel-mint animate-bounce-gentle z-20" />
            <FlowerDoodle className="absolute -bottom-8 -left-8 w-20 h-20 text-pastel-pink animate-spin-slow z-20" />
          </div>
        </div>
      </section>

      {/* 2. THE STORY BEHIND AVENTO */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="scrapbook-panel p-10 md:p-16 text-center relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-pastel-lavender via-pastel-pink to-pastel-yellow mix-blend-multiply" />
          <HeartDoodle className="absolute top-10 left-10 w-12 h-12 text-pastel-coral/40 mix-blend-multiply group-hover:scale-125 transition-transform duration-500" />
          <StarDoodle className="absolute bottom-10 right-10 w-16 h-16 text-pastel-yellow/50 mix-blend-multiply group-hover:rotate-90 transition-transform duration-700" />
          
          <h2 className="font-display text-3xl md:text-4xl font-bold text-slate-800 mb-6">
            The Story Behind <span className="text-pastel-lavender">AVENTO</span>
          </h2>
          <p className="font-body text-slate-600 text-lg leading-loose max-w-3xl mx-auto">
            AVENTO represents adventure, opportunity, participation, creativity, memories, and growth. We realized that campus life is defined by the moments we share outside the classroom. Every hackathon, cultural fest, and workshop is a chance to grow. We built this platform so that every event becomes more than just attendance—it becomes an unforgettable experience.
          </p>
        </div>
      </section>

      {/* 3. MISSION & VISION */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="scrapbook-panel p-10 relative overflow-hidden group">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-pastel-mint/30 mix-blend-multiply rounded-full blur-2xl group-hover:bg-pastel-mint/50 transition-colors duration-500" />
            <RocketDoodle className="w-12 h-12 text-pastel-mint mb-6 relative z-10" />
            <h3 className="font-display text-2xl font-bold text-slate-800 mb-4 relative z-10">Our Mission</h3>
            <p className="font-body text-slate-600 leading-relaxed relative z-10">
              To eliminate the friction of organizing and attending campus activities. We want to empower students to discover their passions and help organizers seamlessly manage experiences without the administrative headache.
            </p>
          </div>
          <div className="scrapbook-panel p-10 relative overflow-hidden group">
            <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-pastel-blue/30 mix-blend-multiply rounded-full blur-2xl group-hover:bg-pastel-blue/50 transition-colors duration-500" />
            <TargetDoodle className="w-12 h-12 text-pastel-blue mb-6 relative z-10" />
            <h3 className="font-display text-2xl font-bold text-slate-800 mb-4 relative z-10">Our Vision</h3>
            <p className="font-body text-slate-600 leading-relaxed relative z-10">
              A future where campus events are smarter, more connected, and deeply engaging. We envision a digital ecosystem where every student's extracurricular journey is celebrated, tracked, and rewarded beautifully.
            </p>
          </div>
        </div>
      </section>

      {/* 4. PLATFORM HIGHLIGHTS */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16 relative">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-slate-800 mb-4">Platform Highlights</h2>
          <SquiggleDoodle className="w-24 h-6 text-pastel-pink mx-auto" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {platformHighlights.map((feat, idx) => (
            <div key={idx} className="scrapbook-panel p-8 scrapbook-panel-hover group">
              <div className="mb-6 flex justify-between items-start">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                  {feat.icon}
                </div>
                <StarDoodle className="w-4 h-4 text-pastel-yellow opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <h4 className="font-display text-xl font-bold text-slate-800 mb-3">{feat.title}</h4>
              <p className="font-body text-slate-500 text-sm leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. STUDENT EXPERIENCE */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-pastel-lavender/30 to-transparent hidden lg:block" />
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-slate-800 mb-4">The Student Experience</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-6 relative z-10">
          {studentJourney.map((item, idx) => (
            <div key={idx} className="flex flex-col items-center text-center group">
              <div className="w-20 h-20 bg-white rounded-full shadow-lg border-2 border-pastel-lavender/20 flex items-center justify-center mb-4 group-hover:-translate-y-2 transition-transform duration-300 relative">
                {item.icon}
                {idx !== studentJourney.length - 1 && (
                  <div className="absolute -right-8 top-1/2 -translate-y-1/2 hidden lg:block text-pastel-lavender/40">
                    →
                  </div>
                )}
              </div>
              <h5 className="font-display font-bold text-slate-700">{item.step}</h5>
            </div>
          ))}
        </div>
      </section>

      {/* 6. ORGANIZER EXPERIENCE */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-slate-50 rounded-[3rem] border border-slate-200 mb-20">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-slate-800 mb-4">The Organizer Experience</h2>
          <p className="text-slate-500">From concept to celebration, completely streamlined.</p>
        </div>
        <div className="flex flex-col md:flex-row justify-center items-center gap-4 md:gap-8">
          {organizerJourney.map((item, idx) => (
            <React.Fragment key={idx}>
              <div className="polaroid w-40 flex flex-col items-center text-center group">
                <div className="w-16 h-16 bg-slate-50 rounded-xl flex items-center justify-center mb-4 border border-slate-100 group-hover:scale-110 transition-transform duration-300">
                  {item.icon}
                </div>
                <h5 className="font-display font-bold text-slate-700 text-sm">{item.step}</h5>
              </div>
              {idx !== organizerJourney.length - 1 && (
                <ArrowDoodle className="w-8 h-8 text-pastel-lavender rotate-90 md:rotate-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* 7. CLOSING QUOTE */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-center relative">
        <SparkleDoodle className="absolute top-10 left-10 w-8 h-8 text-pastel-yellow mix-blend-multiply animate-spin-slow" />
        <SparkleDoodle className="absolute bottom-10 right-10 w-12 h-12 text-pastel-pink mix-blend-multiply animate-bounce-gentle" />
        
        <blockquote className="font-display text-2xl md:text-4xl font-bold text-slate-800 leading-tight mb-8">
          "Every event creates a memory. <br className="hidden sm:block" />
          <span className="text-pastel-lavender">AVENTO</span> helps bring those memories to life."
        </blockquote>
        <div className="w-16 h-1 bg-gradient-to-r from-pastel-coral to-pastel-lavender mx-auto rounded-full mb-8" />
        <p className="font-body text-slate-500 uppercase tracking-widest text-xs font-bold">
          Built with passion for students, organizers, <br className="sm:hidden" /> and every unforgettable campus experience.
        </p>
      </section>

    </div>
  );
};

export default About;
