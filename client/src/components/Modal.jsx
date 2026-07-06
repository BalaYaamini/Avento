import { useEffect } from 'react';
import { SparkleDoodle } from './Doodles';

const Modal = ({ isOpen, onClose, title, children }) => {
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-pastel-lavender/10 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl bg-white border-2 border-pastel-lavender/30 rounded-3xl shadow-[0_10px_30px_rgba(184,168,255,0.15)] flex flex-col overflow-hidden max-h-[90vh] animate-fade-in-scale"
        onClick={(e) => e.stopPropagation()}
      >
        <SparkleDoodle className="absolute top-6 right-16 w-6 h-6 text-pastel-coral opacity-40 animate-pulse pointer-events-none" />
        {/* Modal Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-pastel-lavender/10">
          <h3 className="text-xl font-heading font-bold text-text-primary tracking-wide">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-pastel-coral hover:bg-pastel-coral/10 transition-all duration-300 relative z-10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Modal Body */}
        <div className="p-8 overflow-y-auto flex-grow text-text-secondary">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
