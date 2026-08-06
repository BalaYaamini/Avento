import { useState, useEffect } from 'react';

const RegistrationCountdown = ({ deadline, onDeadlinePassed }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isClosed, setIsClosed] = useState(false);

  useEffect(() => {
    if (!deadline) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const target = new Date(deadline).getTime();
      const difference = target - now;

      if (difference <= 0) {
        setIsClosed(true);
        setTimeLeft('Registration Closed');
        if (onDeadlinePassed) onDeadlinePassed();
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0 || days > 0) parts.push(`${hours}h`);
      if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
      parts.push(`${seconds}s`);

      setTimeLeft(parts.join(' '));
    };

    calculateTimeLeft(); // Initial call
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [deadline, onDeadlinePassed]);

  if (!deadline) return null;

  return (
    <div className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all duration-300 ${
      isClosed 
        ? 'bg-red-500/10 text-red-600 border-red-500/20' 
        : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
    }`}>
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
      </svg>
      {isClosed ? 'Registration Closed' : `Closes in: ${timeLeft}`}
    </div>
  );
};

export default RegistrationCountdown;
