import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { 
  RocketDoodle, 
  PaletteDoodle, 
  StarDoodle, 
  ArrowDoodle, 
  CoffeeDoodle, 
  MusicDoodle,
  PinDoodle
} from './Doodles';

const EventCard = ({ event, index = 0, isRegistered, isPendingRegistration, isOrganizer, joinTeamEnabled, requestStatus, onRegister, onJoinTeam, isSubmitting, onViewOrganizers, onViewScores, onCancelRegister }) => {
  const { user } = useAuth();
  const [showPosterZoom, setShowPosterZoom] = useState(false);

  useEffect(() => {
    if (!showPosterZoom) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowPosterZoom(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [showPosterZoom]);
  
  const formatDate = (dateString) => {
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  const isTeam = event.registration_type === 'team';
  const isFull = isTeam 
    ? (event.max_teams ? (event.registeredCount || 0) >= event.max_teams : false)
    : (event.capacity ? (event.registeredCount || 0) >= event.capacity : false);
  const isActive = event.status === 'published' || event.status === 'active';

  // Category styling map — vibrant high-contrast styles
  const categoryStyles = {
    Technical: { 
      bg: 'bg-cyan-50 dark:bg-cyan-950/40', 
      text: 'text-cyan-800 dark:text-cyan-300', 
      border: 'border-cyan-400/60 dark:border-cyan-500/40',
      badgeBg: 'bg-white/95 dark:bg-slate-900/95',
      badgeText: 'text-cyan-900 dark:text-cyan-200',
      badgeBorder: 'border-cyan-400 dark:border-cyan-500',
      dot: 'bg-cyan-500',
      doodle: <RocketDoodle className="w-10 h-10 text-cyan-500 opacity-80" /> 
    },
    Cultural: { 
      bg: 'bg-rose-50 dark:bg-rose-950/40', 
      text: 'text-rose-800 dark:text-rose-300', 
      border: 'border-rose-400/60 dark:border-rose-500/40',
      badgeBg: 'bg-white/95 dark:bg-slate-900/95',
      badgeText: 'text-rose-900 dark:text-rose-200',
      badgeBorder: 'border-rose-400 dark:border-rose-500',
      dot: 'bg-rose-500',
      doodle: <PaletteDoodle className="w-10 h-10 text-rose-500 opacity-80" /> 
    },
    Sports: { 
      bg: 'bg-emerald-50 dark:bg-emerald-950/40', 
      text: 'text-emerald-800 dark:text-emerald-300', 
      border: 'border-emerald-400/60 dark:border-emerald-500/40',
      badgeBg: 'bg-white/95 dark:bg-slate-900/95',
      badgeText: 'text-emerald-900 dark:text-emerald-200',
      badgeBorder: 'border-emerald-400 dark:border-emerald-500',
      dot: 'bg-emerald-500',
      doodle: <StarDoodle className="w-10 h-10 text-emerald-500 opacity-80" /> 
    },
    Workshop: { 
      bg: 'bg-amber-50 dark:bg-amber-950/40', 
      text: 'text-amber-800 dark:text-amber-300', 
      border: 'border-amber-400/60 dark:border-amber-500/40',
      badgeBg: 'bg-white/95 dark:bg-slate-900/95',
      badgeText: 'text-amber-900 dark:text-amber-200',
      badgeBorder: 'border-amber-400 dark:border-amber-500',
      dot: 'bg-amber-500',
      doodle: <ArrowDoodle className="w-10 h-10 text-amber-500 opacity-80" /> 
    },
    Seminar: { 
      bg: 'bg-indigo-50 dark:bg-indigo-950/40', 
      text: 'text-indigo-800 dark:text-indigo-300', 
      border: 'border-indigo-400/60 dark:border-indigo-500/40',
      badgeBg: 'bg-white/95 dark:bg-slate-900/95',
      badgeText: 'text-indigo-900 dark:text-indigo-200',
      badgeBorder: 'border-indigo-400 dark:border-indigo-500',
      dot: 'bg-indigo-500',
      doodle: <CoffeeDoodle className="w-10 h-10 text-indigo-500 opacity-80" /> 
    }
  };

  const catStyle = categoryStyles[event.category] || { 
    bg: 'bg-slate-50 dark:bg-slate-800/40', 
    text: 'text-slate-800 dark:text-slate-300', 
    border: 'border-slate-300 dark:border-slate-700',
    badgeBg: 'bg-white/95 dark:bg-slate-900/95',
    badgeText: 'text-slate-900 dark:text-slate-200',
    badgeBorder: 'border-slate-300 dark:border-slate-600',
    dot: 'bg-slate-500',
    doodle: <MusicDoodle className="w-10 h-10 text-slate-500 opacity-80" /> 
  };

  // Capacity fill rate
  const capVal = event.registration_type === 'team' ? (event.max_teams || 1) : event.capacity;
  const currCount = event.registeredCount || 0;
  const fillRate = Math.min(100, Math.round((currCount / capVal) * 100));

  // Stagger delay for entrance animation
  const staggerDelay = Math.min(index * 100, 600);

  // Random rotation for scrapbook feel
  const rotationClasses = ['rotate-1', '-rotate-1', 'rotate-2', '-rotate-2', 'rotate-0'];
  const randomRotation = rotationClasses[index % rotationClasses.length];

  return (
    <>
      <div 
        className={`animate-fade-in-up polaroid relative flex w-full min-w-0 flex-col h-full group ${randomRotation}`}
        style={{ animationDelay: `${staggerDelay}ms` }}
      >
        {/* Decorative Tape/Pin */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
          {index % 2 === 0 ? <div className="tape tape-1"></div> : <PinDoodle className="w-8 h-8 text-pastel-coral" />}
        </div>

        {/* Decorative Category Doodle */}
        <div className="absolute -right-2 -top-2 z-20 animate-float-slow">
          {catStyle.doodle}
        </div>

        {/* Event Banner (Click to Zoom) */}
        <div 
          onClick={() => setShowPosterZoom(true)}
          className="relative h-48 sm:h-52 w-full overflow-hidden rounded-xl border-2 border-slate-200/80 bg-slate-50 mb-3 cursor-pointer group/poster"
          title="Click to zoom poster & view details"
        >
          <img
            src={event.imageUrl}
            alt={event.title}
            className="w-full h-full object-contain"
            onError={(e) => {
              e.target.src = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800';
            }}
          />

          {/* Hover Zoom Badge */}
          <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover/poster:opacity-100 transition-opacity duration-200 flex items-center justify-center">
            <span className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-800 dark:text-white text-[11px] font-bold px-3 py-1.5 rounded-xl border border-white/40 shadow-lg flex items-center gap-1.5 transform scale-95 group-hover/poster:scale-100 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
              </svg>
              View Full Poster
            </span>
          </div>

        {/* Category Badge */}
        <span className={`absolute bottom-3 left-3 text-[10px] font-extrabold px-3 py-1 rounded-xl border-2 backdrop-blur-md shadow-md ${catStyle.badgeBg} ${catStyle.badgeText} ${catStyle.badgeBorder} uppercase tracking-wider flex items-center gap-1.5`}>
          <span className={`w-1.5 h-1.5 rounded-full ${catStyle.dot}`} />
          {event.category}
        </span>

        {/* Status Badge */}
        {!isActive && (
          <span className="absolute top-3 right-3 text-[10px] font-bold px-3 py-1 rounded-xl border-2 bg-red-50 text-red-600 border-red-200 backdrop-blur-md uppercase tracking-wider">
            {event.status.toUpperCase()}
          </span>
        )}

        {/* Team Badge */}
        {event.registration_type === 'team' && (
          <span className="absolute bottom-3 right-3 text-[10px] font-extrabold px-3 py-1 rounded-xl border-2 bg-slate-900/85 text-white border-white/20 backdrop-blur-md shadow-md uppercase tracking-wider flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Team Event
          </span>
        )}
      </div>

      {/* Card Content */}
      <div className="flex flex-col flex-grow px-1">
        {/* Date & Time */}
        <div className="flex items-center text-xs text-rose-600 dark:text-rose-400 font-bold mb-1.5 tracking-wider uppercase font-quicksand">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {formatDate(event.date)}
        </div>

        {/* Title */}
        <h3 className="text-lg font-heading font-bold text-text-primary mb-1.5 line-clamp-2" title={event.title}>
          {event.title}
        </h3>

        {/* Description */}
        <p className="text-xs sm:text-sm font-body text-text-secondary mb-3 flex-grow leading-relaxed line-clamp-3 whitespace-pre-wrap">
          {event.description}
        </p>

        {/* Wavy divider */}
        <div className="w-full h-2 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSI0Ij48cGF0aCBkPSJNMCAyUTUgMCAxMCAyVDE1IDBUMjAgMiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjQjhBOEZGIiBzdHJva2Utd2lkdGg9IjEiLz48L3N2Zz4=')] bg-repeat-x mb-3 opacity-50"></div>

        {/* Venue & Organizers Count */}
        <div className="flex items-center justify-between text-xs text-text-secondary mb-3 font-bold font-quicksand">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-cyan-600 dark:text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="line-clamp-1">{event.venue}</span>
          </div>
          <span className="text-[10px] font-bold bg-amber-50 text-amber-800 px-2 py-1 rounded-lg border border-amber-300/80">
            {event.organizersCount || 0} Organizers
          </span>
        </div>

        {/* Capacity Bar */}
        {event.registration_type !== 'team' && (
          <div className="space-y-1.5 mb-3">
            <div className="flex items-center justify-between text-[10px] font-bold tracking-wide font-quicksand">
              <span className="text-text-secondary uppercase">Seats Filled</span>
              <span className={isFull ? 'text-rose-600 font-bold' : 'text-cyan-700 dark:text-cyan-400 font-bold'}>
                {event.registeredCount} / {event.capacity}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
              <div
                className={`h-full rounded-full ${
                  isFull 
                    ? 'bg-rose-500' 
                    : fillRate > 80 
                      ? 'bg-amber-500' 
                      : 'bg-emerald-500'
                }`}
                style={{ width: `${fillRate}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-auto flex flex-col gap-2">
          {isActive && (
            <button
              onClick={onViewOrganizers}
              className="w-full text-center px-4 py-2 text-xs font-bold rounded-xl bg-cyan-50 text-cyan-800 border border-cyan-300 hover:bg-cyan-100 hover:text-cyan-900 transition-all duration-300 shadow-xs"
            >
              View Organizers
            </button>
          )}
          {isActive && event.scoring_enabled && event.scoreboard_visible && (
            <button onClick={onViewScores} className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-all hover:bg-emerald-500/20">View Scoreboard</button>
          )}

          <div className="w-full flex flex-col gap-2">
            {/* Capacity Display */}
            <div className="text-[10px] font-bold text-gray-500 mt-1 mb-1 px-1 w-full">
              {event.registration_type === 'team' ? (
                <div className="flex justify-between items-center bg-gray-50 rounded-lg p-2 border border-gray-100">
                  <span>{currCount} Team Slot{currCount !== 1 ? 's' : ''} Filled</span>
                  {event.max_teams && <span>{Math.max(0, event.max_teams - currCount)} Team Slot{Math.max(0, event.max_teams - currCount) !== 1 ? 's' : ''} Available</span>}
                </div>
              ) : (
                <div className="flex justify-between items-center bg-gray-50 rounded-lg p-2 border border-gray-100">
                  <span>{event.registeredCount || 0} / {event.capacity} Registered</span>
                  <span>{Math.max(0, event.capacity - (event.registeredCount || 0))} Remaining</span>
                </div>
              )}
            </div>

            {isOrganizer ? (
              <div className="w-full flex flex-col gap-2">
                {isFull && (
                  <button
                    disabled
                    className="w-full px-4 py-2.5 text-xs font-bold rounded-2xl bg-pastel-coral/20 text-red-500 border border-pastel-coral cursor-not-allowed uppercase tracking-wider text-center"
                  >
                    🔴 SLOTS FULL — Registration Closed
                  </button>
                )}
                <Link
                  to={`/workspace/${event._id || event.id}`}
                  className="w-full btn-primary px-4 py-2.5 text-sm font-bold font-heading rounded-2xl shadow-pastel-glow flex items-center justify-center gap-2 bg-gradient-to-r from-pastel-pink to-pastel-lavender text-white hover:opacity-90 transition-all text-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Workspace
                </Link>
              </div>
            ) : isRegistered ? (
              <div className="w-full flex flex-col gap-1.5">
                <Link
                  to="/my-registrations"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-2xl bg-pastel-mint/20 text-green-600 border border-pastel-mint hover:bg-pastel-mint/30 transition-all text-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {isFull ? 'REGISTERED · SLOTS FULL' : 'Registered! →'}
                </Link>
                {event.registration_type !== 'team' && (!event.registration_deadline || new Date() <= new Date(event.registration_deadline)) && (
                  <button
                    type="button"
                    onClick={onCancelRegister}
                    className="w-full text-center py-1 text-xs font-bold text-pastel-coral hover:opacity-80 transition-opacity"
                  >
                    Cancel Registration
                  </button>
                )}
              </div>
            ) : isPendingRegistration ? (
              <div className="w-full flex flex-col gap-1.5">
                {isFull && (
                  <div className="w-full px-4 py-1.5 text-[10px] font-bold rounded-xl bg-pastel-coral/20 text-red-500 border border-pastel-coral text-center uppercase tracking-wider mb-0.5">
                    🔴 SLOTS FULL
                  </div>
                )}
                <Link
                  to="/my-registrations"
                  className={`w-full px-4 py-2.5 text-sm font-bold rounded-2xl border text-center transition-all ${
                    isPendingRegistration === 'Ready for Team Confirmation'
                      ? 'bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20 shadow-sm'
                      : 'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20 shadow-sm'
                  }`}
                >
                  {isPendingRegistration === 'Ready for Team Confirmation' ? '🟢 Ready for Team Confirmation →' : '🟡 Waiting for Member Approval →'}
                </Link>
                {(!event.registration_deadline || new Date() <= new Date(event.registration_deadline)) && (
                  <button
                    type="button"
                    onClick={onCancelRegister}
                    className="w-full text-center py-1 text-xs font-bold text-pastel-coral hover:opacity-80 transition-opacity"
                  >
                    Cancel Registration
                  </button>
                )}
              </div>
            ) : isFull ? (
              <button
                disabled
                className="w-full px-4 py-2.5 text-xs font-bold rounded-2xl bg-pastel-coral/20 text-red-500 border border-pastel-coral cursor-not-allowed uppercase tracking-wider text-center"
              >
                🔴 SLOTS FULL — Registration Closed
              </button>
            ) : !user ? (
              <Link
                to="/login"
                className="block w-full text-center px-4 py-2.5 text-sm font-bold rounded-2xl btn-secondary"
              >
                Sign In to Register
              </Link>
            ) : (user.roles?.includes('admin') || user.roles?.includes('faculty')) ? (
              <div className="w-full flex flex-col gap-2 text-center text-xs font-bold text-text-secondary uppercase tracking-wider py-2">
                {user.roles?.includes('admin') ? (
                  <Link
                    to="/admin/events"
                    className="block w-full text-center px-4 py-2.5 text-sm font-bold rounded-2xl btn-secondary"
                  >
                    Configure Event
                  </Link>
                ) : (
                  <span>Faculty View</span>
                )}
              </div>
            ) : (
              <>
                {/* Main Action Button */}
                {!isActive ? (
                  <button
                    disabled
                    className="w-full px-4 py-2.5 text-sm font-bold rounded-2xl bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                  >
                    Event Closed
                  </button>
                ) : requestStatus === 'pending' ? (
                  <button
                    disabled
                    className="w-full px-4 py-2.5 text-sm font-bold rounded-2xl bg-gray-100 text-gray-500 border border-gray-200 cursor-not-allowed"
                  >
                    Request Pending
                  </button>
                ) : (
                  <button
                    onClick={() => onRegister(event._id || event.id)}
                    disabled={isSubmitting}
                    className="w-full btn-primary px-4 py-2.5 text-sm font-bold rounded-2xl shadow-pastel-glow disabled:opacity-50"
                  >
                    {isSubmitting ? 'Processing...' : (event.registration_type === 'team' ? 'Create Team' : 'Avento it!')}
                  </button>
                )}

                {/* Join organizing team button */}
                {isActive && joinTeamEnabled && !isOrganizer && (
                  <div className="w-full mt-1">
                    {requestStatus === 'pending' ? (
                      <button
                        disabled
                        className="w-full px-4 py-2.5 text-xs font-bold rounded-2xl bg-pastel-lavender/10 text-pastel-lavender border border-pastel-lavender/30 cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-pastel-lavender animate-pulse" />
                        Request Pending
                      </button>
                    ) : (
                      <button
                        onClick={onJoinTeam}
                        className="w-full px-4 py-2.5 text-xs font-bold rounded-2xl btn-secondary"
                      >
                        Join Organizing Team
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* ════════════ ZOOMED POSTER & DETAILS MODAL ════════════ */}
    {showPosterZoom && (
      <div 
        className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-fade-in"
        onClick={() => setShowPosterZoom(false)}
      >
        <div 
          className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 border-2 border-cyan-500/30 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-fade-in-scale"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-0 z-30">
            <div className="flex items-center gap-2.5 min-w-0 pr-4">
              <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border uppercase tracking-wider flex items-center gap-1.5 ${catStyle.badgeBg} ${catStyle.badgeText} ${catStyle.badgeBorder}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${catStyle.dot}`} />
                {event.category}
              </span>
              <h2 className="text-sm sm:text-lg font-heading font-bold text-text-primary truncate">{event.title}</h2>
            </div>
            <button
              onClick={() => setShowPosterZoom(false)}
              className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors flex-shrink-0"
              title="Close (Esc)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable Modal Body */}
          <div className="overflow-y-auto p-4 sm:p-6 space-y-6 flex-grow">
            {/* Full Poster Image */}
            <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950/5 dark:bg-slate-950 flex items-center justify-center p-2 sm:p-4 shadow-inner">
              <img
                src={event.imageUrl}
                alt={event.title}
                className="w-full max-h-[55vh] sm:max-h-[62vh] object-contain rounded-xl"
                onError={(e) => {
                  e.target.src = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800';
                }}
              />
            </div>

            {/* Event Details Section */}
            <div className="space-y-4">
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs font-extrabold px-3 py-1 rounded-xl border-2 backdrop-blur-md shadow-sm uppercase tracking-wider flex items-center gap-1.5 ${catStyle.badgeBg} ${catStyle.badgeText} ${catStyle.badgeBorder}`}>
                  <span className={`w-2 h-2 rounded-full ${catStyle.dot}`} />
                  {event.category}
                </span>
                {!isActive && (
                  <span className="text-xs font-bold px-3 py-1 rounded-xl border-2 bg-red-50 text-red-600 border-red-200 uppercase tracking-wider">
                    {event.status.toUpperCase()}
                  </span>
                )}
                {event.registration_type === 'team' && (
                  <span className="text-xs font-extrabold px-3 py-1 rounded-xl border-2 bg-slate-900/85 text-white border-white/20 uppercase tracking-wider flex items-center gap-1.5 shadow-md">
                    👥 Team Event ({event.min_team_size || 1} - {event.max_team_size || 4} Members)
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold font-heading text-text-primary leading-tight">
                {event.title}
              </h1>

              {/* 4-Card Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Date & Time
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-text-primary">{formatDate(event.date)}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-cyan-700 dark:text-cyan-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Venue
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-text-primary">{event.venue || 'Campus Venue'}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Organizers
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-text-primary">{event.organizersCount || 0} Team Members</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Capacity
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-text-primary">
                    {event.registration_type === 'team'
                      ? `${currCount} / ${event.max_teams || '∞'} Teams`
                      : `${currCount} / ${event.capacity || '∞'} Seats`}
                  </div>
                </div>
              </div>

              {/* Full Description */}
              <div className="pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary font-quicksand mb-2">Event Description</h4>
                <p className="text-xs sm:text-sm font-body text-text-secondary leading-relaxed whitespace-pre-wrap bg-slate-50/70 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                  {event.description}
                </p>
              </div>

              {/* Action Buttons inside Modal */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-2.5 items-center justify-end">
                {isActive && (
                  <button
                    onClick={() => { setShowPosterZoom(false); onViewOrganizers(); }}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-cyan-50 text-cyan-800 border border-cyan-300 hover:bg-cyan-100 hover:text-cyan-900 transition-all shadow-xs"
                  >
                    View Organizers
                  </button>
                )}
                {isActive && event.scoring_enabled && event.scoreboard_visible && (
                  <button
                    onClick={() => { setShowPosterZoom(false); onViewScores(); }}
                    className="px-4 py-2 text-xs font-bold rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-500/20 transition-all shadow-xs"
                  >
                    View Scoreboard
                  </button>
                )}
                <button
                  onClick={() => setShowPosterZoom(false)}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-gray-100 dark:bg-slate-800 text-text-primary hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
  );
};

export default EventCard;
