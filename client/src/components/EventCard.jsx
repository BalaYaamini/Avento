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
  
  const formatDate = (dateString) => {
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  const isTeam = event.registration_type === 'team';
  const isFull = isTeam 
    ? (event.max_teams ? (event.registeredCount || 0) >= event.max_teams : false)
    : (event.capacity ? (event.registeredCount || 0) >= event.capacity : false);
  const isActive = event.status === 'published' || event.status === 'active';

  // Category styling map — vibrant pastel colors
  const categoryStyles = {
    Technical: { bg: 'bg-pastel-lavender/30', text: 'text-pastel-lavender', border: 'border-pastel-lavender', doodle: <RocketDoodle className="w-10 h-10 text-pastel-lavender opacity-80" /> },
    Cultural: { bg: 'bg-pastel-coral/30', text: 'text-pastel-coral', border: 'border-pastel-coral', doodle: <PaletteDoodle className="w-10 h-10 text-pastel-coral opacity-80" /> },
    Sports: { bg: 'bg-pastel-mint/30', text: 'text-pastel-mint', border: 'border-pastel-mint', doodle: <StarDoodle className="w-10 h-10 text-pastel-mint opacity-80" /> },
    Workshop: { bg: 'bg-pastel-yellow/30', text: 'text-yellow-600', border: 'border-pastel-yellow', doodle: <ArrowDoodle className="w-10 h-10 text-pastel-yellow opacity-80" /> },
    Seminar: { bg: 'bg-pastel-blue/30', text: 'text-pastel-blue', border: 'border-pastel-blue', doodle: <CoffeeDoodle className="w-10 h-10 text-pastel-blue opacity-80" /> }
  };

  const catStyle = categoryStyles[event.category] || { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-300', doodle: <MusicDoodle className="w-10 h-10 text-gray-400 opacity-80" /> };

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
    <div 
      className={`animate-fade-in-up polaroid scrapbook-panel-hover relative flex w-full min-w-0 flex-col h-full group ${randomRotation}`}
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

      {/* Event Banner */}
      <div className="relative h-72 w-full overflow-hidden rounded-xl border-2 border-pastel-lavender/20 bg-slate-50 mb-4 sm:h-96">
        <img
          src={event.imageUrl}
          alt={event.title}
          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-700 ease-out-expo"
          onError={(e) => {
            e.target.src = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800';
          }}
        />

        {/* Category Badge */}
        <span className={`absolute bottom-3 left-3 text-[10px] font-bold px-3 py-1 rounded-xl border-2 backdrop-blur-md shadow-sm bg-white/90 ${catStyle.text} ${catStyle.border} uppercase tracking-wider`}>
          {event.category}
        </span>

        {/* Status Badge */}
        {!isActive && (
          <span className="absolute top-3 right-3 text-[10px] font-bold px-3 py-1 rounded-xl border-2 bg-red-50 text-red-400 border-red-200 backdrop-blur-md uppercase tracking-wider">
            {event.status.toUpperCase()}
          </span>
        )}

        {/* Team Badge */}
        {event.registration_type === 'team' && (
          <span className="absolute bottom-3 right-3 text-[10px] font-bold px-3 py-1 rounded-xl border-2 bg-pastel-lavender/10 text-pastel-lavender border-pastel-lavender/30 backdrop-blur-md uppercase tracking-wider flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Team Event
          </span>
        )}
      </div>

      {/* Card Content */}
      <div className="flex flex-col flex-grow px-2">
        {/* Date & Time */}
        <div className="flex items-center text-xs text-pastel-coral font-bold mb-2 tracking-wider uppercase font-quicksand">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {formatDate(event.date)}
        </div>

        {/* Title */}
        <h3 className="text-xl font-heading font-bold text-text-primary mb-2">
          {event.title}
        </h3>

        {/* Description */}
        <p className="text-sm font-body text-text-secondary mb-4 flex-grow leading-relaxed whitespace-pre-wrap">
          {event.description}
        </p>

        {/* Wavy divider */}
        <div className="w-full h-2 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSI0Ij48cGF0aCBkPSJNMCAyUTUgMCAxMCAyVDE1IDBUMjAgMiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjQjhBOEZGIiBzdHJva2Utd2lkdGg9IjEiLz48L3N2Zz4=')] bg-repeat-x mb-4 opacity-50"></div>

        {/* Venue & Organizers Count */}
        <div className="flex items-center justify-between text-xs text-text-secondary mb-4 font-bold font-quicksand">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-pastel-lavender" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="line-clamp-1">{event.venue}</span>
          </div>
          <span className="text-[10px] bg-pastel-yellow/20 text-yellow-600 px-2 py-1 rounded-lg border border-pastel-yellow">
            {event.organizersCount || 0} Organizers
          </span>
        </div>

        {/* Capacity Bar */}
        {event.registration_type !== 'team' && (
          <div className="space-y-1.5 mb-5">
            <div className="flex items-center justify-between text-[10px] font-bold tracking-wide font-quicksand">
              <span className="text-text-secondary uppercase">Seats Filled</span>
              <span className={isFull ? 'text-pastel-coral' : 'text-pastel-lavender'}>
                {event.registeredCount} / {event.capacity}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
              <div
                className={`h-full rounded-full ${
                  isFull 
                    ? 'bg-pastel-coral' 
                    : fillRate > 80 
                      ? 'bg-pastel-red' 
                      : 'bg-pastel-mint'
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
              className="w-full text-center px-4 py-2 text-xs font-bold rounded-xl bg-pastel-lavender/10 text-pastel-lavender border border-pastel-lavender/30 hover:bg-pastel-lavender/20 transition-all duration-300"
            >
              View Organizers
            </button>
          )}
          {isActive && event.scoring_enabled && event.scoreboard_visible && (
            <button onClick={onViewScores} className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-600 transition-all hover:bg-emerald-500/20">View Scoreboard</button>
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
  );
};

export default EventCard;
