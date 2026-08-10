import { useEffect } from 'react';
import { SparkleDoodle } from './Doodles';

const Modal = ({ isOpen, onClose, title, subtitle, children }) => {
  // Prevent background scrolling when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-pastel-lavender/10 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-[calc(100%-32px)] sm:w-[calc(100%-40px)] max-w-[780px] bg-white dark:bg-slate-900 border-2 border-pastel-lavender/30 rounded-2xl sm:rounded-[2rem] shadow-[0_10px_40px_rgba(184,168,255,0.15)] flex flex-col max-h-[90vh] overflow-hidden animate-fade-in-scale"
        onClick={(e) => e.stopPropagation()}
      >
        <SparkleDoodle className="absolute bottom-12 right-12 w-8 h-8 text-pastel-coral opacity-20 animate-pulse pointer-events-none" />
        
        {/* Modal Header */}
        <div className="flex items-start justify-between px-5 sm:px-8 pt-6 sm:pt-8 pb-4 sm:pb-6 border-b border-pastel-lavender/20 bg-white dark:bg-slate-900 sticky top-0 z-20">
          <div className="flex flex-col pr-12">
            <h3 className="text-xl sm:text-2xl font-heading font-bold text-text-primary tracking-wide leading-none">{title}</h3>
            {subtitle && <p className="mt-2 text-sm text-text-secondary font-medium">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="absolute top-6 sm:top-8 right-5 sm:right-8 p-1.5 rounded-xl text-slate-400 hover:text-pastel-coral hover:bg-pastel-coral/10 transition-all duration-300 z-30"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Modal Body */}
        <div className="p-5 sm:p-8 pt-4 sm:pt-6 overflow-y-auto flex-grow text-text-secondary bg-white/50 dark:bg-slate-900/60 relative z-10">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
