import React, { useState, useEffect } from 'react';
import { 
  StarDoodle, 
  SparkleDoodle, 
  SquiggleDoodle, 
  HeartDoodle, 
  MusicDoodle, 
  CoffeeDoodle,
  RocketDoodle,
  PinDoodle,
  PaletteDoodle,
  CameraDoodle
} from './Doodles';

const SplashScreen = () => {
  const [show, setShow] = useState(true);
  const [animateIn, setAnimateIn] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const isDark = (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark') || (typeof localStorage !== 'undefined' && localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    if (!show) return;

    // Slightly delayed trigger for ultra-smooth entrance
    const animTimer = setTimeout(() => {
      setAnimateIn(true);
    }, 80);

    // Trigger fade-out after 3.3 seconds
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 3300);

    // Remove after 700ms fade completes
    const removeTimer = setTimeout(() => {
      setShow(false);
    }, 4000);

    return () => {
      clearTimeout(animTimer);
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [show]);

  if (!show) return null;

  return (
    <div
      className={`splash-screen fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-[#FFFDFB] select-none pointer-events-none transition-opacity duration-700 ease-in-out ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        backgroundImage: isDark ? 'radial-gradient(rgba(255, 255, 255, 0.08) 1.5px, transparent 1.5px)' : 'radial-gradient(#FFF1A6 1.5px, transparent 1.5px)',
        backgroundSize: '24px 24px'
      }}
    >
      {/* ── Decorative Doodles — bigger, more visible, non-blocking ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">

        {/* Top-left corner cluster */}
        <div className="absolute top-8 left-8 md:top-12 md:left-14 animate-bounce opacity-60" style={{ animationDuration: '3.6s' }}>
          <StarDoodle className="w-8 h-8 text-pastel-yellow" />
        </div>
        <div className="absolute top-20 left-6 md:top-24 md:left-10 animate-pulse opacity-50" style={{ animationDuration: '4.1s' }}>
          <SparkleDoodle className="w-6 h-6 text-pastel-pink" />
        </div>

        {/* Top-right corner cluster */}
        <div className="absolute top-8 right-10 md:top-12 md:right-16 animate-pulse opacity-55" style={{ animationDuration: '2.9s' }}>
          <SparkleDoodle className="w-9 h-9 text-pastel-lavender" />
        </div>
        <div className="absolute top-20 right-8 md:top-24 md:right-12 animate-bounce opacity-50" style={{ animationDuration: '4.4s' }}>
          <StarDoodle className="w-6 h-6 text-pastel-coral" />
        </div>

        {/* Top center — tiny rocket */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 animate-pulse opacity-45" style={{ animationDuration: '3.5s' }}>
          <RocketDoodle className="w-8 h-8 text-[#B8A8FF]" />
        </div>

        {/* Mid-left */}
        <div className="absolute top-[38%] left-6 md:left-12 animate-pulse opacity-50" style={{ animationDuration: '4.2s' }}>
          <SquiggleDoodle className="w-16 h-4 text-pastel-mint" />
        </div>
        <div className="absolute top-[52%] left-8 md:left-16 animate-bounce opacity-45" style={{ animationDuration: '3.8s' }}>
          <MusicDoodle className="w-8 h-8 text-[#B8A8FF]" />
        </div>

        {/* Mid-right */}
        <div className="absolute top-[38%] right-6 md:right-12 animate-bounce opacity-50" style={{ animationDuration: '4.5s' }}>
          <HeartDoodle className="w-8 h-8 text-pastel-coral" />
        </div>
        <div className="absolute top-[54%] right-8 md:right-16 animate-pulse opacity-45" style={{ animationDuration: '3.3s' }}>
          <PinDoodle className="w-7 h-7 text-pastel-lavender" />
        </div>

        {/* Bottom-left cluster */}
        <div className="absolute bottom-14 left-10 md:bottom-18 md:left-16 animate-pulse opacity-55" style={{ animationDuration: '3.0s' }}>
          <CoffeeDoodle className="w-8 h-8 text-pastel-blue" />
        </div>
        <div className="absolute bottom-6 left-14 md:bottom-8 md:left-20 animate-bounce opacity-40" style={{ animationDuration: '4.6s' }}>
          <SparkleDoodle className="w-6 h-6 text-pastel-yellow" />
        </div>

        {/* Bottom-right cluster */}
        <div className="absolute bottom-12 right-10 md:bottom-16 md:right-16 animate-pulse opacity-50" style={{ animationDuration: '3.7s' }}>
          <CameraDoodle className="w-8 h-8 text-pastel-mint" />
        </div>
        <div className="absolute bottom-6 right-14 md:bottom-8 md:right-20 animate-bounce opacity-45" style={{ animationDuration: '4.0s' }}>
          <PaletteDoodle className="w-7 h-7 text-pastel-pink" />
        </div>

        {/* Bottom-center */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-pulse opacity-40" style={{ animationDuration: '4.3s' }}>
          <SquiggleDoodle className="w-14 h-4 text-pastel-coral" />
        </div>
      </div>

      {/* ── Soft ambient glow behind logo ── */}
      <div className="absolute w-96 h-96 rounded-full bg-gradient-to-tr from-[#B8A8FF]/30 via-[#F4978E]/20 to-[#FFF1A6]/35 blur-3xl animate-pulse pointer-events-none" />

      {/* ── Main Content — Ultra-smooth entrance ── */}
      <div
        className={`relative z-10 flex flex-col items-center justify-center p-8 transition-all duration-[1100ms] ease-out transform ${
          animateIn ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.88] translate-y-4'
        }`}
      >
        {/* Logo — Noticeably bigger */}
        <div className="relative mb-8 flex items-center justify-center">
          <div className="absolute -inset-6 bg-gradient-to-r from-[#B8A8FF]/20 to-[#F4978E]/20 rounded-3xl blur-xl" />
          <img
            src="/logo.png?v=3"
            alt="Avento Logo"
            className="relative h-36 md:h-44 lg:h-52 w-auto object-contain drop-shadow-lg"
          />
        </div>

        {/* Tagline */}
        <p className="text-xs md:text-sm font-bold tracking-[0.2em] text-slate-400 uppercase font-display mb-8">
          University Event Management Platform
        </p>

        {/* Progress bar — wider, tri-color gradient */}
        <div className="w-48 h-1.5 bg-slate-200/70 rounded-full overflow-hidden shadow-inner">
          <div className="h-full bg-gradient-to-r from-[#B8A8FF] via-[#F4978E] to-[#FFF1A6] rounded-full animate-splash-progress" />
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
