import React from 'react';

export const StarDoodle = ({ className = "w-6 h-6 text-pastel-yellow" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 5L61 35H95L68 55L78 85L50 65L22 85L32 55L5 35H39L50 5Z" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const SparkleDoodle = ({ className = "w-6 h-6 text-pastel-pink" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 0C50 30 70 50 100 50C70 50 50 70 50 100C50 70 30 50 0 50C30 50 50 30 50 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

export const SquiggleDoodle = ({ className = "w-16 h-4 text-pastel-mint" }) => (
  <svg className={className} viewBox="0 0 100 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 10Q15 0 25 10T45 10T65 10T85 10T95 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const HeartDoodle = ({ className = "w-6 h-6 text-pastel-coral" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 85C50 85 15 55 15 30C15 15 25 5 40 5C48 5 50 15 50 15C50 15 52 5 60 5C75 5 85 15 85 30C85 55 50 85 50 85Z" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const ArrowDoodle = ({ className = "w-10 h-10 text-pastel-blue" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 90Q50 90 90 10M90 10L60 15M90 10L85 40" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const PinDoodle = ({ className = "w-8 h-8 text-pastel-lavender" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="30" r="20" fill="currentColor" />
    <path d="M50 50L50 90" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
  </svg>
);

export const CameraDoodle = ({ className = "w-8 h-8 text-pastel-lavender" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="15" y="30" width="70" height="50" rx="5" stroke="currentColor" strokeWidth="6"/>
    <circle cx="50" cy="55" r="15" stroke="currentColor" strokeWidth="6"/>
    <rect x="35" y="20" width="30" height="10" stroke="currentColor" strokeWidth="6"/>
  </svg>
);

export const CoffeeDoodle = ({ className = "w-8 h-8 text-pastel-lavender" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 30H70V70C70 80 60 90 45 90C30 90 20 80 20 70V30Z" stroke="currentColor" strokeWidth="6"/>
    <path d="M70 40H80C85 40 85 60 80 60H70" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
    <path d="M35 10Q40 20 35 30" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
    <path d="M55 10Q60 20 55 30" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
  </svg>
);

export const MusicDoodle = ({ className = "w-8 h-8 text-pastel-lavender" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M40 80C40 85 35 90 25 90C15 90 10 85 10 80C10 75 15 70 25 70C35 70 40 75 40 80ZM40 80V20L90 10V70C90 75 85 80 75 80C65 80 60 75 60 70C60 65 65 60 75 60C85 60 90 65 90 70M40 40L90 30" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const PaletteDoodle = ({ className = "w-8 h-8 text-pastel-lavender" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 10C25 10 10 30 10 50C10 75 30 90 50 90C60 90 70 85 70 75C70 65 60 65 60 55C60 45 70 45 80 45C95 45 90 25 90 20C90 10 75 10 50 10Z" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="30" cy="40" r="5" fill="currentColor"/>
    <circle cx="45" cy="25" r="5" fill="currentColor"/>
    <circle cx="65" cy="30" r="5" fill="currentColor"/>
  </svg>
);

export const RocketDoodle = ({ className = "w-8 h-8 text-pastel-lavender" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M40 10C60 10 80 30 90 50C90 50 85 70 70 70C70 70 65 90 50 90C30 80 10 60 10 40C10 40 30 35 40 10Z" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M70 70L90 90" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
    <path d="M30 30L10 10" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
    <circle cx="60" cy="40" r="8" stroke="currentColor" strokeWidth="6"/>
  </svg>
);
