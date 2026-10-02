/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#06b6d4',
          dark: '#0891b2',
          glow: 'rgba(6, 182, 212, 0.12)',
          'glow-strong': 'rgba(6, 182, 212, 0.25)',
        },
        admin: {
          DEFAULT: '#06b6d4',
          dark: '#0891b2',
          glow: 'rgba(6, 182, 212, 0.12)',
          'glow-strong': 'rgba(6, 182, 212, 0.25)',
        },
        surface: {
          body: '#0f172a',
          sidebar: '#121826',
          secondary: '#1e293b',
          card: '#1e293b',
          border: '#1e293b',
          hover: '#293548',
        },
        'txt': {
          primary: '#fafafa',
          secondary: '#a3a3a3',
          muted: '#525252',
        },
        pastel: {
          lavender: '#A5F3FC',
          coral: '#F4978E',
          red: '#E76F6F',
          mint: '#BEECCF',
          blue: '#BFE7FF',
          yellow: '#FFF1A6',
          pink: '#A5F3FC',
        },
        primary: {
          lavender: '#A5F3FC',
          coral: '#F4978E',
          yellow: '#FFF1A6',
        },
        background: 'var(--color-bg-base)',
        card: 'var(--color-bg-card)',
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          'light-primary': '#FFFFFF',
          'light-secondary': '#E5E7EB',
          'light-muted': '#D1D5DB',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Fredoka', 'system-ui', 'sans-serif'],
        body: ['Poppins', 'system-ui', 'sans-serif'],
        heading: ['Fredoka', 'system-ui', 'sans-serif'],
        quicksand: ['Quicksand', 'system-ui', 'sans-serif'],
        nunito: ['Nunito', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
        'float': '0 20px 40px -10px rgba(0, 0, 0, 0.08), 0 15px 30px -8px rgba(0, 0, 0, 0.03)',
        'pastel-glow': '0 0 20px rgba(165, 243, 252, 0.4), 0 0 40px rgba(244, 151, 142, 0.2)',
        'accent-glow': '0 0 20px rgba(6, 182, 212, 0.12)',
        'accent-glow-strong': '0 4px 24px rgba(6, 182, 212, 0.25)',
        'admin-glow': '0 0 20px rgba(6, 182, 212, 0.12)',
        'admin-glow-strong': '0 4px 24px rgba(6, 182, 212, 0.25)',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in-scale': 'fadeInScale 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fadeIn 0.5s ease both',
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'float-slow 8s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 8s ease infinite',
        'spin-slow': 'spin-slow 20s linear infinite',
        'bounce-gentle': 'bounce-gentle 2s ease-in-out infinite',
        'wobble': 'wobble 1s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'slide-in-left': 'slideInLeft 0.5s ease forwards',
        'bar-fill': 'barFill 1s ease forwards',
        'text-reveal': 'textReveal 0.6s ease forwards',
        'pulse': 'pulse 2s infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInScale: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-15px) rotate(2deg)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 15px rgba(6, 182, 212, 0.4)' },
          '50%': { boxShadow: '0 0 25px rgba(6, 182, 212, 0.6)' },
        },
        wobble: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-3deg)' },
          '75%': { transform: 'rotate(3deg)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        barFill: {
          'from': { width: '0' },
        },
        textReveal: {
          'from': { clipPath: 'inset(0 100% 0 0)' },
          'to': { clipPath: 'inset(0 0 0 0)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        'gradient-shift': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-lavender-coral': 'linear-gradient(135deg, #A5F3FC 0%, #F4978E 100%)',
        'gradient-lavender-yellow': 'linear-gradient(135deg, #A5F3FC 0%, #F4978E 50%, #FFF1A6 100%)',
        'gradient-mint-yellow': 'linear-gradient(135deg, #BEECCF 0%, #BFE7FF 50%, #FFF1A6 100%)',
        'gradient-accent': 'linear-gradient(135deg, #06b6d4, #0891b2)',
        'gradient-admin': 'linear-gradient(135deg, #06b6d4, #0891b2)',
      },
    },
  },
  plugins: [],
}
