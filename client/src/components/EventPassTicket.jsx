import React, { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import html2canvas from 'html2canvas';

// QR is rendered on a canvas at 3x its on-screen size so the exported PNG
// (html2canvas scale: 3) maps 1:1 to real pixels — the QR stays perfectly crisp.
const QR_SIZE_PX = 98;
const QR_EXPORT_SCALE = 3;

// Parse a date without the UTC-offset trap: date-only strings ("2026-11-05")
// would otherwise resolve to the previous day in negative-offset timezones.
const parseEventDate = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(raw);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const ROLE_LABELS = {
  student: 'STUDENT',
  student_organizer: 'STUDENT',
  faculty: 'FACULTY',
  faculty_organizer: 'FACULTY',
  organizer: 'ORGANIZER',
  admin: 'ADMIN'
};

// Single clean, signature Avento Cyan Theme
export const CYAN_THEME = {
  id: 'cyan',
  name: 'Avento Cyan',
  stubBg: 'bg-gradient-to-b from-cyan-600 via-teal-600 to-cyan-700',
  bodyBg: 'bg-[#f8fcfe] dark:bg-slate-900',
  waveFill: '#06b6d4',
  accent: '#0891b2',
  accentText: 'text-cyan-700 dark:text-cyan-400',
  accentBadge: 'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800',
  titleColor: 'text-slate-900 dark:text-white',
  qrBorder: 'border-cyan-300 dark:border-cyan-700',
  qrLabel: 'text-cyan-700 dark:text-cyan-400',
  iconBg: 'bg-cyan-600 text-white',
  pillBg: 'bg-white dark:bg-slate-800/90 border-cyan-100 dark:border-cyan-900/60'
};

const EventPassTicket = ({
  registration,
  user,
  allocation,
  onClose,
  showDownloadButton = true
}) => {
  const ticketRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  if (!registration) return null;

  const event = registration.eventId || registration.event || {};
  const regId = registration.id || registration.registration_id || '';
  const theme = CYAN_THEME;

  // ── Attendee Information (from the signed-in profile) ──────────────────
  const attendeeName = user?.fullName || user?.name || 'Attendee';

  const roleLabel =
    ROLE_LABELS[String(user?.role || '').toLowerCase()] || 'STUDENT';
  const rollNumber = user?.rollNumber || user?.roll_number || '';
  const attendeeInstitution =
    user?.college_name ||
    user?.college ||
    user?.collegeName ||
    user?.university ||
    'SREENIDHI UNIVERSITY';

  const attendeeSecondary = [roleLabel, user?.department ? String(user.department).toUpperCase() : null]
    .filter(Boolean)
    .join(' · ');
  const attendeeTertiary = [rollNumber, attendeeInstitution]
    .filter(Boolean)
    .join(' · ');

  // ── Slot resolution (identical to the registration card: for team
  //    registrations the team's slot is the source of truth) ─────────────
  const teamSlot = registration.teamId?.slot || null;
  const ownSlot = registration.slot || null;
  const slot = registration.teamId ? (teamSlot || ownSlot) : (ownSlot || teamSlot);

  // ── Date: the session date (slot date) when a slot exists ──────────────
  const sessionDateValue = slot?.slot_date || event.date || '';
  const eventDateObj = parseEventDate(sessionDateValue);
  const eventDateHasTime = /T\d{2}:\d{2}/.test(String(event.date || ''));

  const dateFormatted = eventDateObj
    ? eventDateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Date TBD';
  const weekdayFormatted = eventDateObj
    ? `(${eventDateObj.toLocaleDateString('en-US', { weekday: 'short' })})`
    : '';

  // ── Time: slot range when available, else the event start time ─────────
  const timeFormatted = slot?.start_time && slot?.end_time
    ? `${String(slot.start_time).substring(0, 5)} - ${String(slot.end_time).substring(0, 5)}`
    : eventDateHasTime && eventDateObj
    ? eventDateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : 'Time TBD';

  // ── Venue: allocated room (when venue allocation is active) wins over
  //    the slot room, otherwise the event venue ───────────────────────────
  const venueEnabled = allocation?.allocationConfig?.venue?.enabled !== false;
  const allocatedRoomRaw = String(allocation?.allocation?.venueRoom || allocation?.venueRoom || '').trim();
  const allocatedRoom = venueEnabled && allocatedRoomRaw && !/^yet to assign$/i.test(allocatedRoomRaw)
    ? allocatedRoomRaw
    : '';
  const slotRoom = slot?.venue_room ? `Room ${slot.venue_room}` : '';
  const roomDisplay = allocatedRoom || slotRoom;
  const venueFormatted = event.venue || 'Venue TBD';
  const fullVenueDisplay = roomDisplay
    ? `${venueFormatted}, ${roomDisplay}`
    : venueFormatted;

  // Display Registration ID — short code derived from the real registration
  // UUID (the exact value encoded in the QR, which the scanner looks up).
  const regIdShort =
    String(regId || registration.user_id || '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 8) || 'PENDING';
  const displayRegId = `AVT-${regIdShort}`;

  // Event Category / Type
  const eventType =
    event.category ||
    (registration.teamId || event.registration_type === 'team' ? 'Team Event' : 'Individual Event');

  // Exact QR payload required by the verification scanner
  // (server resolves: registration UUID → user id → roll number → email)
  const qrPayload = String(regId || registration.user_id || rollNumber || user?.email || 'EVENT_PASS');

  // Handle Download Pass as high-res PNG image
  const handleDownload = async () => {
    if (!ticketRef.current || downloading) return;
    try {
      setDownloading(true);
      // Make sure web fonts (Manrope/Outfit) are loaded before rasterizing,
      // otherwise the exported image falls back to a different font.
      if (document.fonts?.ready) {
        try {
          await document.fonts.ready;
        } catch (e) {
          /* ignore font-ready errors */
        }
      }
      const canvas = await html2canvas(ticketRef.current, {
        scale: QR_EXPORT_SCALE,
        useCORS: true,
        backgroundColor: null,
        logging: false,
        // html2canvas paints text a few pixels lower than the browser lays it
        // out. Inside overflow-hidden boxes (.truncate / .line-clamp-1) that
        // slices the bottom off every glyph in the exported PNG. Extend the
        // clip box downward only in the cloned document — the paired negative
        // margin keeps the on-screen layout (and the long-text truncation)
        // exactly the same.
        onclone: (clonedDoc) => {
          const compensation = clonedDoc.createElement('style');
          compensation.textContent =
            '.truncate, .line-clamp-1 { padding-bottom: 6px !important; margin-bottom: -6px !important; }';
          clonedDoc.head.appendChild(compensation);
        }
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const safeTitle = (event.title || 'Event').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `Avento_Pass_${safeTitle}_${displayRegId}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to download event pass:', err);
      alert('Could not download pass image. You can take a screenshot instead.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* Scrollable Container for small screens */}
      <div className="w-full overflow-x-auto pb-2 pt-0.5 flex justify-center">
        {/* Pass-Shaped Ticket Container with Sleek, Reduced Height */}
        <div
          ref={ticketRef}
          className={`relative flex flex-col md:flex-row w-full max-w-[760px] min-w-[320px] md:min-w-[720px] rounded-2xl shadow-md border border-slate-200/90 dark:border-slate-800 overflow-hidden ${theme.bodyBg} select-none transition-all duration-300`}
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          {/* ════════════════════════════════════════════════════════════════
              LEFT STUB SECTION (Sleeker Compact Ticket Stub)
          ════════════════════════════════════════════════════════════════ */}
          <div
            className={`relative flex md:flex-col items-center justify-between p-2.5 sm:p-3 text-white ${theme.stubBg} w-full md:w-[120px] shrink-0 overflow-hidden`}
          >
            {/* Avento Brand Header */}
            <div className="flex items-center gap-1.5 z-10">
              <div className="w-6 h-6 rounded-md bg-white/20 backdrop-blur-xs flex items-center justify-center p-0.5 shadow-xs border border-white/30 shrink-0">
                <svg viewBox="0 0 40 40" fill="none" className="w-full h-full text-white">
                  <path
                    d="M20 5L7 33H16L20 23L24 33H33L20 5Z"
                    fill="currentColor"
                  />
                  <path
                    d="M17 26H23L20 18L17 26Z"
                    fill="#0891b2"
                    fillOpacity="0.5"
                  />
                </svg>
              </div>
              <span className="font-extrabold tracking-wider text-xs uppercase text-white font-heading">
                Avento
              </span>
            </div>

            {/* Compact Faux Barcode */}
            <div className="flex md:flex-col items-center justify-center my-1 z-10 gap-1">
              <div className="flex md:flex-row flex-col items-center justify-center gap-[2px] p-1 bg-white/10 backdrop-blur-xs rounded-md border border-white/20 shadow-inner">
                <div className="w-0.5 md:w-1 h-4 md:h-10 bg-white opacity-90" />
                <div className="w-1 md:w-0.5 h-4 md:h-10 bg-white opacity-70" />
                <div className="w-0.5 md:w-1.5 h-4 md:h-10 bg-white opacity-90" />
                <div className="w-0.5 md:w-0.5 h-4 md:h-10 bg-white opacity-50" />
                <div className="w-1 md:w-1 h-4 md:h-10 bg-white opacity-90" />
                <div className="w-0.5 md:w-2 h-4 md:h-10 bg-white opacity-90" />
                <div className="w-0.5 md:w-0.5 h-4 md:h-10 bg-white opacity-60" />
                <div className="w-1 md:w-1 h-4 md:h-10 bg-white opacity-85" />
                <div className="w-0.5 md:w-1.5 h-4 md:h-10 bg-white opacity-90" />
                <div className="w-0.5 md:w-0.5 h-4 md:h-10 bg-white opacity-70" />
                <div className="w-1 md:w-1 h-4 md:h-10 bg-white opacity-90" />
                <div className="w-0.5 md:w-0.5 h-4 md:h-10 bg-white opacity-50" />
                <div className="w-1 md:w-1.5 h-4 md:h-10 bg-white opacity-90" />
              </div>

              {/* Vertical Rotated Text */}
              <div
                className="hidden md:block text-[7px] font-black uppercase tracking-[0.2em] text-white/80 whitespace-nowrap"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              >
                PASS · {regIdShort}
              </div>
            </div>

            {/* Bottom Pass Type indicator */}
            <div className="text-[7.5px] font-black tracking-widest uppercase text-white/95 px-1.5 py-0.5 rounded bg-black/20 border border-white/20 z-10">
              OFFICIAL
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════
              CLASSIC TICKET PASS NOTCHES & PERFORATION
          ════════════════════════════════════════════════════════════════ */}
          {/* Top Notch Cutout */}
          <div
            className="hidden md:block absolute -top-3 left-[120px] -translate-x-1/2 w-6 h-6 rounded-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 z-30 shadow-inner"
          />
          {/* Bottom Notch Cutout */}
          <div
            className="hidden md:block absolute -bottom-3 left-[120px] -translate-x-1/2 w-6 h-6 rounded-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 z-30 shadow-inner"
          />
          {/* Vertical Dashed Perforation Line */}
          <div className="hidden md:block absolute top-2.5 bottom-2.5 left-[120px] -translate-x-1/2 border-r-2 border-dashed border-cyan-300/70 dark:border-cyan-800/70 z-20 pointer-events-none" />

          {/* ════════════════════════════════════════════════════════════════
              MAIN TICKET BODY SECTION (Sleek Height & Compact Layout)
          ════════════════════════════════════════════════════════════════ */}
          <div className="relative flex-1 py-2.5 px-3.5 sm:py-3 sm:px-4 flex flex-col justify-between overflow-hidden">
            {/* Background Decorative Cyan Waves */}
            <svg
              className="absolute top-0 right-0 w-48 h-28 pointer-events-none opacity-20 z-0"
              viewBox="0 0 300 200"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M100 0C150 40 220 20 300 80V0H100Z"
                fill={theme.waveFill}
                fillOpacity="0.15"
              />
              <path
                d="M180 0C220 60 250 80 300 120V0H180Z"
                fill={theme.waveFill}
                fillOpacity="0.25"
              />
            </svg>

            {/* TOP ROW: Category, Title, and Clean Tagline */}
            <div className="relative z-10 flex items-start justify-between gap-2.5">
              <div className="flex-1 pr-2 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[8.5px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                    EVENT PASS
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider border ${theme.accentBadge}`}>
                    {eventType}
                  </span>
                </div>

                {/* Event Title */}
                <h2
                  className={`text-base sm:text-lg font-black tracking-tight leading-snug line-clamp-1 font-heading ${theme.titleColor}`}
                  title={event.title}
                >
                  {event.title || 'Campus Event'}
                </h2>

                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  Build · Learn · Grow
                </p>
              </div>

              {/* Clean Tagline on Top Right */}
              <div className="hidden sm:flex flex-col items-end shrink-0 text-right">
                <span className="text-[10px] font-bold tracking-wide text-cyan-700 dark:text-cyan-400">
                  Your Pass to the Experience
                </span>
                <div className="flex items-center gap-1 mt-0.5 text-cyan-500">
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                  </svg>
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>

            {/* ATTENDEE ROW (Compact) */}
            <div className="relative z-10 my-1 flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-[11px] shadow-xs shrink-0 ${theme.iconBg}`}
              >
                {attendeeName.charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0">
                <div className="font-extrabold text-[13px] text-slate-800 dark:text-white leading-tight truncate">
                  {attendeeName}
                </div>
                <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                  {attendeeSecondary}
                </div>
                {attendeeTertiary && (
                  <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                    {attendeeTertiary}
                  </div>
                )}
              </div>
            </div>

            {/* MAIN CONTENT SPLIT: Left Specs Grid + Right QR Code Card */}
            <div className="relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-0.5">
              {/* Left Column: Event Details Grid (Date, Time, Venue, IDs) */}
              <div className="flex-1 space-y-1.5 min-w-0">
                {/* 3-Column Info Pills: DATE, TIME, VENUE */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  {/* DATE */}
                  <div className={`py-1 px-1.5 rounded-lg border ${theme.pillBg}`}>
                    <div className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-slate-400">
                      <svg className="w-2.5 h-2.5 text-cyan-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>DATE</span>
                    </div>
                    <div className="text-[10px] font-bold text-slate-800 dark:text-slate-100 mt-0.5 leading-tight truncate">
                      {dateFormatted} <span className="text-[8.5px] font-medium text-slate-500">{weekdayFormatted}</span>
                    </div>
                  </div>

                  {/* TIME */}
                  <div className={`py-1 px-1.5 rounded-lg border ${theme.pillBg}`}>
                    <div className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-slate-400">
                      <svg className="w-2.5 h-2.5 text-cyan-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>TIME</span>
                    </div>
                    <div className="text-[10px] font-bold text-slate-800 dark:text-slate-100 mt-0.5 leading-tight truncate" title={timeFormatted}>
                      {timeFormatted}
                    </div>
                  </div>

                  {/* VENUE */}
                  <div className={`py-1 px-1.5 rounded-lg border ${theme.pillBg}`}>
                    <div className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-slate-400">
                      <svg className="w-2.5 h-2.5 text-cyan-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                      <span>VENUE</span>
                    </div>
                    <div className="text-[10px] font-bold text-slate-800 dark:text-slate-100 mt-0.5 leading-tight truncate" title={fullVenueDisplay}>
                      {fullVenueDisplay}
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Registration ID & Team Details */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-800/60 text-xs">
                  {/* Registration ID */}
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                    <span className="text-[9px] font-extrabold uppercase text-slate-400">REG ID:</span>
                    <span
                      className="font-mono font-bold text-slate-800 dark:text-slate-200 text-[10.5px] tracking-wide"
                      title={regId ? `Registration ID: ${regId}` : undefined}
                    >
                      {displayRegId}
                    </span>
                  </div>

                  {/* Team indicator with clean SVG icon */}
                  {registration.teamId?.name && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-cyan-700 dark:text-cyan-400">
                      <svg className="w-3 h-3 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span>Team:</span>
                      <span className="truncate max-w-[120px]">{registration.teamId.name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Clean QR Code Card */}
              <div className="flex flex-col items-center justify-center shrink-0 sm:pl-1.5">
                <div
                  className={`p-1.5 bg-white dark:bg-white rounded-xl border shadow-xs flex flex-col items-center justify-center ${theme.qrBorder}`}
                >
                  <div className="bg-white p-0.5 rounded-lg flex items-center justify-center">
                    <QRCodeCanvas
                      value={qrPayload}
                      size={QR_SIZE_PX * QR_EXPORT_SCALE}
                      style={{
                        width: `${QR_SIZE_PX}px`,
                        height: `${QR_SIZE_PX}px`,
                        imageRendering: 'pixelated'
                      }}
                      level="H"
                      bgColor="#FFFFFF"
                      fgColor="#000000"
                      marginSize={4}
                      aria-label="Event entry QR code"
                    />
                  </div>

                  <span
                    className={`mt-0.5 text-[7.5px] font-black uppercase tracking-[0.2em] ${theme.qrLabel}`}
                  >
                    SCAN TO CHECK IN
                  </span>
                </div>

                <div className="mt-0.5 text-[9px] font-semibold text-slate-400 dark:text-slate-500 text-center">
                  Official Admission Pass
                </div>
              </div>
            </div>

            {/* Attendance Status Banner (if verified) */}
            {registration.attendance_status === 'Present' && (
              <div className="mt-1 px-2.5 py-0.5 bg-emerald-500/15 border border-emerald-500/30 rounded-md text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center justify-center gap-1.5 animate-fade-in">
                <span>✓</span>
                <span>Attendance Verified at Venue</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ACTION BUTTONS TOOLBAR */}
      <div className="mt-3 flex items-center justify-between w-full max-w-[760px] px-2 flex-wrap gap-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Valid for entry on event date</span>
        </div>

        <div className="flex items-center gap-2">
          {showDownloadButton && (
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {downloading ? (
                <>
                  <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download Pass (PNG)</span>
                </>
              )}
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="btn-primary px-4 py-1.5 text-xs font-bold rounded-xl text-white shadow-xs cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventPassTicket;
