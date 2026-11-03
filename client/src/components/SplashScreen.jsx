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

// Exact vector contours extracted 1:1 from /logo.png
const EMBLEM_PATH = "M 245 91 L 255 91 L 256 92 L 261 93 L 266 96 L 274 105 L 274 107 L 277 112 L 277 114 L 279 116 L 281 123 L 286 132 L 288 139 L 290 141 L 290 143 L 294 150 L 294 152 L 299 161 L 301 168 L 306 177 L 308 184 L 313 193 L 313 195 L 316 200 L 316 202 L 318 204 L 320 211 L 325 220 L 325 222 L 329 229 L 329 231 L 333 238 L 335 245 L 338 250 L 338 253 L 339 254 L 339 263 L 338 264 L 338 267 L 335 271 L 331 274 L 328 274 L 327 275 L 318 275 L 317 274 L 309 273 L 306 271 L 303 271 L 300 269 L 297 269 L 293 267 L 290 267 L 285 265 L 281 265 L 280 264 L 256 264 L 255 265 L 252 265 L 251 266 L 243 268 L 233 273 L 232 272 L 240 264 L 253 255 L 273 246 L 279 245 L 283 243 L 287 243 L 292 240 L 294 237 L 294 229 L 289 220 L 289 218 L 284 209 L 284 207 L 280 200 L 280 198 L 276 191 L 276 189 L 269 176 L 269 174 L 262 161 L 262 159 L 257 149 L 254 146 L 252 146 L 251 145 L 246 146 L 242 150 L 242 152 L 239 156 L 239 158 L 225 187 L 225 189 L 221 196 L 221 198 L 219 200 L 217 207 L 212 216 L 212 218 L 208 225 L 208 227 L 205 232 L 205 234 L 200 243 L 198 250 L 193 259 L 193 261 L 189 267 L 182 273 L 177 274 L 176 275 L 167 274 L 161 268 L 160 258 L 161 257 L 162 250 L 168 238 L 168 236 L 172 229 L 172 227 L 177 218 L 179 211 L 181 209 L 181 207 L 188 193 L 188 191 L 191 186 L 191 184 L 200 166 L 200 164 L 207 150 L 207 148 L 216 130 L 218 123 L 220 121 L 220 119 L 223 114 L 223 112 L 227 104 L 233 97 L 239 93 L 244 92 Z";
const SPARKLE_PATH = "M 250 169 L 252 177 L 254 179 L 256 179 L 259 181 L 262 181 L 254 184 L 251 188 L 250 193 L 249 192 L 248 187 L 246 184 L 242 182 L 238 182 L 238 181 L 245 179 L 248 176 L 248 174 L 250 170 Z";
const CALENDAR_PATHS = ["M 235 202 L 237 202 L 238 203 L 238 208 L 239 209 L 260 209 L 261 208 L 261 203 L 262 202 L 265 202 L 266 203 L 266 209 L 267 210 L 268 209 L 273 209 L 277 211 L 279 214 L 279 236 L 276 237 L 276 225 L 274 223 L 225 223 L 224 224 L 224 259 L 227 261 L 227 262 L 225 264 L 223 264 L 221 262 L 221 260 L 220 259 L 220 217 L 221 216 L 221 213 L 224 210 L 226 210 L 227 209 L 232 209 L 233 208 L 233 204 L 234 203 Z","M 234 231 L 240 231 L 240 238 L 239 239 L 235 239 L 233 238 L 233 232 Z","M 247 231 L 253 231 L 253 238 L 252 239 L 248 239 L 246 238 L 246 232 Z","M 260 231 L 265 231 L 266 232 L 266 238 L 261 239 L 259 237 L 259 232 Z","M 234 245 L 240 245 L 240 252 L 234 252 L 233 251 L 233 246 Z","M 247 245 L 253 245 L 253 252 L 247 252 L 246 251 L 246 246 Z"];
const WORDMARK_PATHS = ["M 325 292 L 334 292 L 334 302 L 335 303 L 345 303 L 345 311 L 335 311 L 334 312 L 334 339 L 338 342 L 345 342 L 345 349 L 333 349 L 329 347 L 326 344 L 326 342 L 325 341 L 325 312 L 324 311 L 319 311 L 319 303 L 324 303 L 325 302 L 325 293 Z","M 119 303 L 132 303 L 141 309 L 142 308 L 142 303 L 150 303 L 150 349 L 142 349 L 142 344 L 141 343 L 132 349 L 123 350 L 113 346 L 107 340 L 105 336 L 104 329 L 103 328 L 104 319 L 107 312 L 110 308 L 118 304 Z","M 160 303 L 168 303 L 169 304 L 171 308 L 171 310 L 173 313 L 174 318 L 176 321 L 176 323 L 178 326 L 178 329 L 180 332 L 181 337 L 183 339 L 184 338 L 186 330 L 188 327 L 189 322 L 191 319 L 192 314 L 196 306 L 196 304 L 197 303 L 206 303 L 205 307 L 203 310 L 202 315 L 200 318 L 200 320 L 198 323 L 196 330 L 193 335 L 193 337 L 191 340 L 191 343 L 188 349 L 178 349 L 177 348 L 176 344 L 174 341 L 174 339 L 172 336 L 172 334 L 170 331 L 170 329 L 168 326 L 168 324 L 166 321 L 166 319 L 164 316 L 164 314 L 161 309 L 160 304 Z","M 228 303 L 241 303 L 248 306 L 255 314 L 256 321 L 257 322 L 257 329 L 222 329 L 221 330 L 221 332 L 223 336 L 227 340 L 231 342 L 238 342 L 242 340 L 247 335 L 248 336 L 252 336 L 253 335 L 255 336 L 255 338 L 251 344 L 241 349 L 232 350 L 221 346 L 215 340 L 212 333 L 212 328 L 211 327 L 212 319 L 215 312 L 218 308 L 225 304 L 227 304 Z","M 268 303 L 276 303 L 278 308 L 285 303 L 297 303 L 298 304 L 300 304 L 306 309 L 308 312 L 309 318 L 310 319 L 310 348 L 309 349 L 301 349 L 301 320 L 299 315 L 294 311 L 284 311 L 279 315 L 277 319 L 277 348 L 276 349 L 268 349 L 268 304 Z","M 369 303 L 382 303 L 383 304 L 385 304 L 387 306 L 389 306 L 395 312 L 397 316 L 398 323 L 399 324 L 398 333 L 395 340 L 389 346 L 378 350 L 373 350 L 372 349 L 365 348 L 357 342 L 353 335 L 353 332 L 352 331 L 352 321 L 353 320 L 353 317 L 358 309 L 362 306 L 366 304 L 368 304 Z","M 234 310 L 227 312 L 221 319 L 221 321 L 222 322 L 247 322 L 248 320 L 246 316 L 242 312 L 240 311 L 236 311 L 235 310 Z","M 123 311 L 120 312 L 115 317 L 113 321 L 113 331 L 117 338 L 125 342 L 132 341 L 138 337 L 142 329 L 142 323 L 140 318 L 137 314 L 132 311 L 124 311 Z","M 371 311 L 368 312 L 363 317 L 361 321 L 361 331 L 363 335 L 368 340 L 372 342 L 378 342 L 381 340 L 383 340 L 387 336 L 390 330 L 390 323 L 386 315 L 380 311 L 372 311 Z"];
const TAGLINE_PATHS = ["M 116 369 L 122 369 L 117 371 L 121 373 L 117 375 L 122 377 L 116 377 L 116 370 Z","M 127 369 L 128 369 L 130 374 L 132 373 L 132 371 L 133 369 L 134 369 L 134 371 L 131 377 L 129 376 L 129 374 L 127 370 Z","M 140 369 L 145 369 L 145 370 L 142 370 L 141 371 L 145 373 L 143 373 L 141 375 L 145 377 L 140 377 L 140 370 Z","M 151 369 L 152 369 L 156 374 L 157 373 L 157 369 L 158 369 L 158 377 L 156 377 L 153 372 L 152 373 L 152 377 L 151 377 L 151 370 Z","M 163 369 L 169 369 L 169 370 L 167 371 L 167 377 L 166 377 L 166 371 L 165 370 L 163 370 Z","M 176 369 L 179 369 L 180 370 L 177 370 L 176 371 L 180 374 L 180 377 L 175 377 L 174 376 L 176 376 L 177 377 L 179 376 L 178 374 L 175 373 L 174 371 L 175 370 Z","M 210 369 L 214 369 L 215 370 L 211 370 L 209 372 L 209 374 L 211 376 L 215 376 L 214 377 L 209 377 L 208 375 L 208 371 L 209 370 Z","M 222 369 L 226 369 L 228 371 L 228 375 L 226 377 L 222 377 L 220 375 L 220 371 L 221 370 Z","M 234 369 L 235 369 L 238 373 L 239 372 L 239 369 L 240 369 L 240 377 L 239 377 L 236 373 L 235 374 L 235 377 L 234 377 L 234 370 Z","M 247 369 L 251 373 L 252 372 L 252 369 L 253 369 L 253 377 L 252 377 L 248 372 L 247 373 L 247 377 L 246 376 L 246 370 Z","M 260 369 L 265 369 L 260 371 L 264 373 L 262 373 L 260 375 L 265 377 L 260 377 L 259 376 L 259 370 Z","M 272 369 L 276 369 L 277 370 L 273 370 L 271 372 L 271 374 L 274 377 L 275 376 L 277 376 L 276 377 L 272 377 L 270 375 L 270 371 L 271 370 Z","M 282 369 L 288 369 L 288 370 L 286 371 L 286 377 L 285 377 L 285 371 L 284 370 L 282 370 Z","M 317 369 L 319 370 L 320 374 L 322 377 L 319 375 L 317 375 L 314 377 L 315 373 L 317 370 Z","M 328 369 L 332 369 L 333 370 L 329 370 L 327 372 L 327 374 L 330 377 L 331 376 L 333 376 L 332 377 L 328 377 L 326 375 L 326 371 L 327 370 Z","M 339 369 L 341 372 L 343 372 L 344 371 L 344 369 L 345 369 L 345 377 L 344 377 L 344 375 L 343 374 L 341 374 L 340 376 L 338 377 L 338 370 Z","M 351 369 L 352 369 L 352 377 L 351 377 L 351 370 Z","M 358 369 L 364 369 L 359 371 L 363 373 L 359 375 L 364 377 L 358 377 L 358 370 Z","M 369 369 L 370 369 L 370 371 L 372 374 L 374 372 L 374 370 L 376 369 L 373 377 L 371 377 L 369 370 Z","M 381 369 L 386 369 L 386 370 L 383 370 L 382 371 L 386 373 L 382 375 L 383 376 L 386 376 L 386 377 L 381 377 L 381 370 Z","M 224 370 L 221 372 L 221 374 L 224 377 L 227 374 L 227 372 L 225 370 Z"];

const SplashScreen = () => {
  const [show, setShow] = useState(true);
  const [stage, setStage] = useState('initial'); // 'initial' | 'drawing' | 'colors' | 'hold' | 'fade'
  const [statusText, setStatusText] = useState('Initializing experience...');
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const isDark = (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark') || 
                 (typeof localStorage !== 'undefined' && localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    // Reduced motion support
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) {
      setPrefersReducedMotion(true);
      setStage('colors');
      setStatusText('Ready');

      const holdTimer = setTimeout(() => {
        setStage('fade');
      }, 900);

      const removeTimer = setTimeout(() => {
        setShow(false);
      }, 1600);

      return () => {
        clearTimeout(holdTimer);
        clearTimeout(removeTimer);
      };
    }

    // Dynamic status text sequence
    const t1 = setTimeout(() => {
      setStatusText('Connecting to campus network...');
    }, 600);

    const t2 = setTimeout(() => {
      setStatusText('Assembling workspace...');
    }, 1300);

    const t3 = setTimeout(() => {
      setStatusText('Welcome to Avento');
    }, 1800);

    // Sequence for progressive drawing experience:
    // 1. Start drawing lines (0ms)
    const drawTimer = setTimeout(() => {
      setStage('drawing');
    }, 40);

    // 2. Reveal actual logo colors & bloom (1750ms)
    const colorTimer = setTimeout(() => {
      setStage('colors');
    }, 1750);

    // 3. Hold the completed logo (2400ms)
    const holdTimer = setTimeout(() => {
      setStage('hold');
    }, 2400);

    // 4. Fade out splash screen (2900ms)
    const fadeTimer = setTimeout(() => {
      setStage('fade');
    }, 2900);

    // 5. Cleanly unmount splash from DOM (3600ms)
    const removeTimer = setTimeout(() => {
      setShow(false);
    }, 3600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(drawTimer);
      clearTimeout(colorTimer);
      clearTimeout(holdTimer);
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!show) return null;

  const isDrawing = stage === 'drawing';
  const hasColors = stage === 'colors' || stage === 'hold' || stage === 'fade';
  const isFading = stage === 'fade';

  return (
    <div
      id="avento-splash-screen"
      className={`splash-screen fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-[#FFFDFB] select-none transition-all duration-700 ease-in-out overflow-hidden ${
        isFading ? 'opacity-0 scale-[1.02] pointer-events-none' : 'opacity-100 scale-100 pointer-events-auto'
      }`}
      style={{
        backgroundImage: isDark 
          ? 'radial-gradient(rgba(255, 255, 255, 0.08) 1.5px, transparent 1.5px)' 
          : 'radial-gradient(#FFF1A6 1.5px, transparent 1.5px)',
        backgroundSize: '24px 24px'
      }}
    >
      {/* ── Scoped Keyframes and Animations ── */}
      <style>{`
        @keyframes cyanDrawLine {
          from {
            stroke-dashoffset: 1400;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes cyanDrawSparkle {
          from {
            stroke-dashoffset: 200;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes cyanDrawCal {
          from {
            stroke-dashoffset: 400;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes cyanDrawWordmark {
          from {
            stroke-dashoffset: 500;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes floatDrift1 {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(4deg); }
        }
        @keyframes floatDrift2 {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(12px) rotate(-5deg); }
        }
        @keyframes floatDrift3 {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-8px) scale(1.08); }
        }
        @keyframes shimmerLead {
          0% { left: 0%; opacity: 0.8; }
          50% { opacity: 1; }
          100% { left: 100%; opacity: 0.8; }
        }
        @keyframes badgeGlowPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.85; }
        }

        .cyan-tracing-stroke {
          fill-opacity: 0;
          stroke-dasharray: 1400;
          stroke-dashoffset: 1400;
          transition: opacity 0.5s ease-out;
        }

        .cyan-drawing .cyan-draw-emblem {
          animation: cyanDrawLine 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .cyan-drawing .cyan-draw-sparkle {
          stroke-dasharray: 200;
          stroke-dashoffset: 200;
          animation: cyanDrawSparkle 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.2s forwards;
        }
        .cyan-drawing .cyan-draw-cal {
          stroke-dasharray: 400;
          stroke-dashoffset: 400;
          animation: cyanDrawCal 0.9s cubic-bezier(0.4, 0, 0.2, 1) 0.35s forwards;
        }
        .cyan-drawing .cyan-draw-wordmark {
          stroke-dasharray: 500;
          stroke-dashoffset: 500;
          animation: cyanDrawWordmark 1.0s cubic-bezier(0.4, 0, 0.2, 1) 0.6s forwards;
        }

        .cyan-has-colors .cyan-tracing-stroke {
          opacity: 0 !important;
        }

        .animate-float-1 { animation: floatDrift1 5s ease-in-out infinite; }
        .animate-float-2 { animation: floatDrift2 6.2s ease-in-out infinite; }
        .animate-float-3 { animation: floatDrift3 4.5s ease-in-out infinite; }
      `}</style>

      {/* ── Decorative Doodles with Rich Floating Micro-Animations ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {/* Top-left cluster */}
        <div className="absolute top-12 left-10 md:top-16 md:left-20 animate-float-1 opacity-70">
          <StarDoodle className="w-9 h-9 text-pastel-yellow drop-shadow-sm" />
        </div>
        <div className="absolute top-24 left-8 md:top-32 md:left-14 animate-float-2 opacity-60">
          <SparkleDoodle className="w-7 h-7 text-pastel-pink drop-shadow-sm" />
        </div>

        {/* Top-right cluster */}
        <div className="absolute top-12 right-12 md:top-16 md:right-24 animate-float-3 opacity-70">
          <SparkleDoodle className="w-10 h-10 text-pastel-lavender drop-shadow-sm" />
        </div>
        <div className="absolute top-28 right-8 md:top-36 md:right-16 animate-float-1 opacity-60">
          <StarDoodle className="w-7 h-7 text-pastel-coral drop-shadow-sm" />
        </div>

        {/* Top center rocket */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 animate-float-2 opacity-55">
          <RocketDoodle className="w-9 h-9 text-[#22D3EE] drop-shadow-sm" />
        </div>

        {/* Mid-left */}
        <div className="absolute top-[36%] left-6 md:left-16 animate-float-3 opacity-60">
          <SquiggleDoodle className="w-18 h-5 text-pastel-mint drop-shadow-sm" />
        </div>
        <div className="absolute top-[52%] left-8 md:left-20 animate-float-1 opacity-55">
          <MusicDoodle className="w-9 h-9 text-[#38BDF8] drop-shadow-sm" />
        </div>

        {/* Mid-right */}
        <div className="absolute top-[36%] right-6 md:right-16 animate-float-2 opacity-65">
          <HeartDoodle className="w-9 h-9 text-pastel-coral drop-shadow-sm" />
        </div>
        <div className="absolute top-[52%] right-8 md:right-20 animate-float-3 opacity-55">
          <PinDoodle className="w-8 h-8 text-pastel-lavender drop-shadow-sm" />
        </div>

        {/* Bottom-left */}
        <div className="absolute bottom-16 left-12 md:bottom-20 md:left-24 animate-float-2 opacity-70">
          <CoffeeDoodle className="w-9 h-9 text-pastel-blue drop-shadow-sm" />
        </div>
        <div className="absolute bottom-8 left-16 md:bottom-10 md:left-32 animate-float-1 opacity-50">
          <SparkleDoodle className="w-7 h-7 text-pastel-yellow drop-shadow-sm" />
        </div>

        {/* Bottom-right */}
        <div className="absolute bottom-14 right-12 md:bottom-18 md:right-24 animate-float-3 opacity-65">
          <CameraDoodle className="w-9 h-9 text-pastel-mint drop-shadow-sm" />
        </div>
        <div className="absolute bottom-8 right-16 md:bottom-10 md:right-32 animate-float-2 opacity-55">
          <PaletteDoodle className="w-8 h-8 text-pastel-pink drop-shadow-sm" />
        </div>

        {/* Bottom-center squiggle */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-float-1 opacity-50">
          <SquiggleDoodle className="w-16 h-5 text-pastel-coral drop-shadow-sm" />
        </div>
      </div>

      {/* ── Center Logo & UI Container ── */}
      <div
        className={`relative z-10 flex flex-col items-center justify-center p-4 transition-transform duration-700 ease-out ${
          stage !== 'initial' ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        {/* Logo Frame */}
        <div 
          className={`relative flex items-center justify-center ${isDrawing ? 'cyan-drawing' : ''} ${hasColors ? 'cyan-has-colors' : ''}`}
        >
          {/* Actual uploaded Avento Logo Asset (100% exact match with top-left corner) */}
          <img
            src="/logo.png?v=3"
            alt="Avento Logo"
            className={`relative h-48 sm:h-56 md:h-64 lg:h-72 w-auto object-contain drop-shadow-xl logo-cyan-tint transition-all duration-700 ease-out ${
              hasColors || prefersReducedMotion ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          />

          {/* SVG Vector Progressive Line-Drawing Overlay (100% exact geometry alignment) */}
          {(!hasColors || isDrawing) && !prefersReducedMotion && (
            <svg
              className="absolute inset-0 w-full h-full object-contain pointer-events-none drop-shadow-xl"
              viewBox="0 0 500 500"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <defs>
                {/* Luminous Electric Cyan Pen Tracing Gradient */}
                <linearGradient id="aventoCyanPenStroke" x1="140" y1="90" x2="360" y2="360" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#A5F3FC" />
                  <stop offset="40%" stopColor="#38BDF8" />
                  <stop offset="80%" stopColor="#22D3EE" />
                  <stop offset="100%" stopColor="#06B6D4" />
                </linearGradient>

                {/* Glow filter for active drawing pen stroke */}
                <filter id="aventoCyanGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="1.8" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* 1. Exact Stylized Ribbon Emblem 'A' */}
              <path
                className="cyan-tracing-stroke cyan-draw-emblem"
                d={EMBLEM_PATH}
                fill="none"
                stroke="url(#aventoCyanPenStroke)"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#aventoCyanGlow)"
              />

              {/* 2. Exact Sparkle Star */}
              <path
                className="cyan-tracing-stroke cyan-draw-sparkle"
                d={SPARKLE_PATH}
                fill="none"
                stroke="#A5F3FC"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* 3. Exact Calendar Paths */}
              {CALENDAR_PATHS.map((p, i) => (
                <path
                  key={`cal-${i}`}
                  className="cyan-tracing-stroke cyan-draw-cal"
                  d={p}
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}

              {/* 4. Exact Wordmark Letter Paths */}
              {WORDMARK_PATHS.map((p, i) => (
                <path
                  key={`wm-${i}`}
                  className="cyan-tracing-stroke cyan-draw-wordmark"
                  d={p}
                  fill="none"
                  stroke="url(#aventoCyanPenStroke)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}

              {/* 5. Exact Tagline Paths */}
              {TAGLINE_PATHS.map((p, i) => (
                <path
                  key={`tag-${i}`}
                  className="cyan-tracing-stroke cyan-draw-wordmark"
                  d={p}
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </svg>
          )}
        </div>

        {/* Glassmorphic Capsule Subtitle */}
        <div 
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 backdrop-blur-md shadow-sm mt-6 transition-all duration-700 ${
            hasColors ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}
        >
          <span className="text-cyan-500 font-bold text-xs">✦</span>
          <p className="text-xs sm:text-sm font-extrabold tracking-[0.2em] uppercase font-display text-slate-600 dark:text-slate-300">
            University Event Management Platform
          </p>
          <span className="text-cyan-500 font-bold text-xs">✦</span>
        </div>

        {/* Dynamic Progress Indicator & Live Status */}
        <div className="flex flex-col items-center mt-5 gap-2.5">
          {/* Glass Capsule Progress Bar with cyan shimmer */}
          <div className="w-52 sm:w-64 h-2 p-0.5 bg-white/80 dark:bg-slate-900/80 rounded-full border border-slate-200/80 dark:border-slate-800/80 shadow-inner backdrop-blur-sm overflow-hidden relative">
            <div 
              className="h-full bg-gradient-to-r from-[#06b6d4] via-[#38bdf8] to-[#A5F3FC] rounded-full animate-splash-progress relative shadow-sm"
              style={{ animationDuration: '3.2s' }}
            />
          </div>

          {/* Dynamic Live Status Text */}
          <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-slate-400 dark:text-slate-500 font-body">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="transition-all duration-300">{statusText}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
