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

export const TicketDoodle = ({ className = "w-8 h-8 text-pastel-lavender" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 35H90V65H10V35Z" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 45C15 45 15 55 10 55" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
    <path d="M90 45C85 45 85 55 90 55" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
    <path d="M30 35V65" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round"/>
    <circle cx="20" cy="50" r="3" fill="currentColor"/>
  </svg>
);

export const CalendarDoodle = ({ className = "w-8 h-8 text-pastel-lavender" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 25H80C85 25 85 30 85 35V80C85 85 80 85 80 85H20C15 85 15 80 15 80V35C15 30 20 25 20 25Z" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M30 15V35" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
    <path d="M70 15V35" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
    <path d="M15 45H85" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
    <circle cx="35" cy="65" r="4" fill="currentColor"/>
  </svg>
);

export const CertificateDoodle = ({ className = "w-8 h-8 text-pastel-lavender" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 25H85V75H15V25Z" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="70" cy="60" r="10" stroke="currentColor" strokeWidth="4"/>
    <path d="M65 70L60 90L70 85L80 90L75 70" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M30 40H60" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
    <path d="M30 55H50" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
  </svg>
);

export const QRDoodle = ({ className = "w-8 h-8 text-pastel-lavender" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="15" y="15" width="25" height="25" rx="3" stroke="currentColor" strokeWidth="4"/>
    <rect x="60" y="15" width="25" height="25" rx="3" stroke="currentColor" strokeWidth="4"/>
    <rect x="15" y="60" width="25" height="25" rx="3" stroke="currentColor" strokeWidth="4"/>
    <path d="M22 22H28V28H22V22Z" fill="currentColor"/>
    <path d="M67 22H73V28H67V22Z" fill="currentColor"/>
    <path d="M22 67H28V73H22V67Z" fill="currentColor"/>
    <path d="M60 60H85V85H60V60Z" stroke="currentColor" strokeWidth="4" strokeDasharray="5 5" strokeLinecap="round"/>
  </svg>
);

export const GraduationCapDoodle = ({ className = "w-8 h-8 text-pastel-lavender" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 20L10 40L50 60L90 40L50 20Z" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M25 50V70C25 80 75 80 75 70V50" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M90 40V70" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
    <path d="M90 70C90 75 85 75 85 75C85 75 80 75 80 70C80 65 85 65 85 65C85 65 90 65 90 70Z" fill="currentColor"/>
  </svg>
);

export const CollaborationDoodle = ({ className = "w-24 h-24 text-pastel-lavender" }) => (
  <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Central Hub */}
    <circle cx="100" cy="100" r="30" stroke="currentColor" strokeWidth="4" strokeDasharray="8 4"/>
    {/* Connections */}
    <path d="M100 70L70 40" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
    <path d="M130 100L160 80" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
    <path d="M85 125L50 140" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
    <path d="M115 125L140 160" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
    {/* Nodes */}
    <circle cx="65" cy="35" r="10" stroke="currentColor" strokeWidth="4"/>
    <circle cx="165" cy="75" r="8" stroke="currentColor" strokeWidth="4"/>
    <circle cx="45" cy="145" r="12" stroke="currentColor" strokeWidth="4"/>
    <circle cx="145" cy="165" r="6" stroke="currentColor" strokeWidth="4"/>
    <path d="M60 35H70" stroke="currentColor" strokeWidth="2"/>
    <path d="M65 30V40" stroke="currentColor" strokeWidth="2"/>
    <path d="M40 145H50" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

export const LeafDoodle = ({ className = "w-8 h-8 text-pastel-mint" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 80C20 80 10 40 50 20C90 40 80 80 80 80C80 80 50 90 20 80Z" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20 80L50 50" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
    <path d="M50 50L65 40" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M40 60L55 50" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

export const FlowerDoodle = ({ className = "w-8 h-8 text-pastel-pink" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="10" fill="currentColor"/>
    <path d="M50 40C40 10 60 10 50 40Z" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M60 50C90 40 90 60 60 50Z" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M50 60C60 90 40 90 50 60Z" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M40 50C10 60 10 40 40 50Z" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const CloudDoodle = ({ className = "w-12 h-12 text-pastel-blue" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M25 65C15 65 15 50 25 50C25 35 45 30 55 45C65 35 85 45 80 60C90 65 85 75 75 75H30C20 75 20 65 25 65Z" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const TargetDoodle = ({ className = "w-8 h-8 text-pastel-coral" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray="10 6"/>
    <circle cx="50" cy="50" r="20" stroke="currentColor" strokeWidth="4"/>
    <circle cx="50" cy="50" r="5" fill="currentColor"/>
    <path d="M50 15V0M85 50H100M50 85V100M15 50H0" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
  </svg>
);

export const CampusJourneyDoodle = ({ className = "w-48 h-48" }) => (
  <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Abstract Background Blobs */}
    <path d="M20 70C10 40 40 10 70 20C100 30 120 70 90 100C60 130 30 100 20 70Z" fill="#BFE7FF" opacity="0.6" />
    <path d="M120 140C160 120 190 150 170 180C150 210 110 190 90 170C70 150 80 160 120 140Z" fill="#FFF1A6" opacity="0.6" />
    <circle cx="160" cy="50" r="35" fill="#F4978E" opacity="0.4" />
    <path d="M40 160C20 170 20 190 40 200C60 210 70 180 50 160Z" fill="#B8A8FF" opacity="0.5"/>

    {/* Coffee Cup (Top Left) */}
    <g transform="translate(20, 20) rotate(-15)">
      <path d="M15 25H45V50C45 60 35 70 30 70C25 70 15 60 15 50V25Z" fill="#FFFFFF" stroke="#222222" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M45 35H55C60 35 60 50 55 50H45" fill="none" stroke="#222222" strokeWidth="4" strokeLinecap="round"/>
      {/* Steam */}
      <path d="M25 10Q30 15 25 20" fill="none" stroke="#222222" strokeWidth="3" strokeLinecap="round"/>
      <path d="M35 5Q40 15 35 20" fill="none" stroke="#222222" strokeWidth="3" strokeLinecap="round"/>
    </g>

    {/* Calendar/Event Ticket (Top Right) */}
    <g transform="translate(130, 20) rotate(10)">
      <rect x="0" y="10" width="50" height="60" rx="6" fill="#FFFFFF" stroke="#222222" strokeWidth="4" strokeLinejoin="round"/>
      <path d="M0 30H50" stroke="#222222" strokeWidth="4"/>
      <path d="M15 0V20M35 0V20" stroke="#222222" strokeWidth="5" strokeLinecap="round"/>
      <circle cx="25" cy="45" r="5" fill="#F4978E" stroke="#222222" strokeWidth="3"/>
    </g>

    {/* Open Notebook (Center) */}
    <g transform="translate(45, 75) rotate(-5)">
      {/* Back Cover */}
      <rect x="0" y="0" width="120" height="80" rx="6" fill="#B8A8FF" stroke="#222222" strokeWidth="4" strokeLinejoin="round"/>
      {/* Pages */}
      <rect x="8" y="6" width="52" height="68" fill="#FFFFFF" stroke="#222222" strokeWidth="4" strokeLinejoin="round"/>
      <rect x="60" y="6" width="52" height="68" fill="#FFFFFF" stroke="#222222" strokeWidth="4" strokeLinejoin="round"/>
      {/* Binding rings */}
      <path d="M60 15H60.01M60 30H60.01M60 45H60.01M60 60H60.01" stroke="#222222" strokeWidth="8" strokeLinecap="round"/>
      {/* Text Lines */}
      <path d="M18 25H48M18 40H40M18 55H45" stroke="#222222" strokeWidth="3" strokeLinecap="round"/>
      <path d="M70 25H100M70 40H90" stroke="#222222" strokeWidth="3" strokeLinecap="round"/>
      {/* Small polaroid taped on right page */}
      <rect x="75" y="45" width="22" height="22" fill="#BEECCF" stroke="#222222" strokeWidth="3" strokeLinejoin="round"/>
      <path d="M80 40L92 50" stroke="#FFF1A6" strokeWidth="5" strokeLinecap="round"/> {/* Tape */}
    </g>

    {/* Pencil */}
    <g transform="translate(90, 150) rotate(-20)">
      <rect x="0" y="0" width="70" height="12" rx="2" fill="#FFD54F" stroke="#222222" strokeWidth="3" strokeLinejoin="round"/>
      <path d="M70 0L85 6L70 12Z" fill="#F4978E" stroke="#222222" strokeWidth="3" strokeLinejoin="round"/>
      <path d="M80 6L85 6" stroke="#222222" strokeWidth="3" strokeLinecap="round"/>
      <rect x="-12" y="0" width="12" height="12" rx="2" fill="#F4978E" stroke="#222222" strokeWidth="3" strokeLinejoin="round"/>
      <path d="M0 0V12" stroke="#222222" strokeWidth="3"/>
    </g>

    {/* Floating Elements (Stars, Sparkles) */}
    <g stroke="#222222" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      {/* Star Bottom Left */}
      <path d="M15 130L20 142H32L23 150L26 162L15 155L4 162L7 150L-2 142H10Z" fill="#FFF1A6" />
      {/* Sparkle Top Right */}
      <path d="M170 80C170 95 185 100 200 100C185 100 170 105 170 120C170 105 155 100 140 100C155 100 170 95 170 80Z" fill="#BEECCF" />
    </g>
  </svg>
);

export const PaperPlaneDoodle = ({ className = "w-8 h-8 text-pastel-blue" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 50L90 10L60 90L45 65L90 10L35 55L10 50Z" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M45 65V90L55 75" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 70Q30 90 60 95" stroke="currentColor" strokeWidth="4" strokeDasharray="5 5" strokeLinecap="round"/>
  </svg>
);

export const StickyNoteDoodle = ({ className = "w-8 h-8 text-pastel-yellow" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 20H80V70C80 75 75 80 70 80H20V20Z" fill="currentColor" stroke="#222222" strokeWidth="4" strokeLinejoin="round"/>
    <path d="M70 80L80 70C75 70 70 75 70 80Z" fill="#222222"/>
    <path d="M45 15L55 5" stroke="#B8A8FF" strokeWidth="6" strokeLinecap="round"/> {/* Tape */}
    <path d="M35 40H65M35 55H55" stroke="#222222" strokeWidth="4" strokeLinecap="round"/>
  </svg>
);

export const CelebrationRibbonDoodle = ({ className = "w-10 h-10 text-pastel-pink" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="40" r="20" fill="currentColor" stroke="#222222" strokeWidth="4"/>
    <circle cx="50" cy="40" r="10" stroke="#222222" strokeWidth="4"/>
    <path d="M40 57L25 90L40 80L55 90L47 60" stroke="#222222" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M60 57L75 90L60 80L45 90L53 60" stroke="#222222" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const BookDoodle = ({ className = "w-8 h-8 text-pastel-mint" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 20C40 20 20 15 20 15V75C20 75 40 80 50 80C60 80 80 75 80 75V15C80 15 60 20 50 20Z" fill="currentColor" stroke="#222222" strokeWidth="4" strokeLinejoin="round"/>
    <path d="M50 20V80" stroke="#222222" strokeWidth="4" strokeLinecap="round"/>
    <path d="M30 35H40M30 50H40M60 35H70" stroke="#222222" strokeWidth="4" strokeLinecap="round"/>
  </svg>
);

export const LaptopDoodle = ({ className = "w-10 h-10 text-pastel-lavender" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="20" y="30" width="60" height="40" rx="4" fill="currentColor" stroke="#222222" strokeWidth="4" strokeLinejoin="round"/>
    <path d="M10 75H90C92 75 95 78 95 80V85H5V80C5 78 8 75 10 75Z" fill="#FFF1A6" stroke="#222222" strokeWidth="4" strokeLinejoin="round"/>
    <rect x="40" y="75" width="20" height="4" fill="#222222"/>
  </svg>
);

export const GeometricBlobDoodle = ({ className = "w-24 h-24 text-pastel-blue" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M30 20C50 10 80 20 90 45C100 70 80 90 50 90C20 90 5 70 10 45C15 20 10 30 30 20Z" opacity="0.4"/>
  </svg>
);
