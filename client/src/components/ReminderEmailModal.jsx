import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const DEFAULT_SUBJECT = 'Reminder: {{eventName}} is coming up';
const DEFAULT_BODY = `Hi {{recipientName}},

This is a friendly reminder that your session is coming up soon. Please find your session details and event pass in this email. Keep this email handy and show the QR code at the check-in desk.

Please report to the venue on time.

See you there!
- Team Avento`;

const formatDateLabel = (dateKey) => {
  if (!dateKey) return '';
  const d = new Date(`${dateKey}T00:00:00`);
  if (isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

const ReminderEmailModal = ({ isOpen, onClose, eventId, event, onUpdate }) => {
  const [autoSend, setAutoSend] = useState(false);
  const [mode, setMode] = useState('default');
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isConfirmingSend, setIsConfirmingSend] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  useEffect(() => {
    if (event) {
      const config = event.reminder_email_config || {};
      setAutoSend(config.auto_send === true);
      setMode(config.mode === 'custom' ? 'custom' : 'default');
      setSubject(config.subject || DEFAULT_SUBJECT);
      setBody(config.body || '');
    }
  }, [event, isOpen]);

  const fetchRecipients = useCallback(async (dateKey) => {
    if (!eventId || !dateKey) {
      setRecipients([]);
      return;
    }
    setIsLoadingRecipients(true);
    try {
      const res = await axios.get(`/api/events/${eventId}/reminder-email/recipients`, {
        params: { date: dateKey }
      });
      setRecipients(res.data?.recipients || []);
    } catch {
      setRecipients([]);
    } finally {
      setIsLoadingRecipients(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (!isOpen || !eventId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`/api/events/${eventId}/reminder-email/recipients`);
        if (cancelled) return;
        const list = res.data?.dates || [];
        setDates(list);
        const initial = list.includes(res.data?.date) ? res.data.date : (list[0] || '');
        setSelectedDate(initial);
        if (initial) fetchRecipients(initial);
      } catch {
        if (!cancelled) setDates([]);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, eventId, fetchRecipients]);

  useEffect(() => {
    setIsConfirmingSend(false);
    setSendResult(null);
    if (selectedDate) fetchRecipients(selectedDate);
  }, [selectedDate, fetchRecipients]);

  if (!isOpen) return null;

  const insertTag = (field, tag) => {
    if (field === 'subject') {
      setSubject(prev => prev + ' ' + tag);
    } else {
      setBody(prev => prev + ' ' + tag);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccessMsg('');

    try {
      await axios.put(`/api/events/${eventId}/reminder-email`, {
        auto_send: autoSend,
        mode,
        subject,
        body
      });
      setSuccessMsg('Reminder email configuration saved successfully!');
      if (onUpdate) onUpdate();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = async () => {
    setIsTesting(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await axios.post(`/api/events/${eventId}/reminder-email/test`, { mode, subject, body });
      setSuccessMsg(res.data?.message || 'Test reminder email sent!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send test email.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSendManual = async () => {
    if (!selectedDate) return;
    setIsSending(true);
    setError('');
    setSuccessMsg('');
    setSendResult(null);
    try {
      const res = await axios.post(`/api/events/${eventId}/reminder-email/send-by-date`, {
        date: selectedDate,
        mode,
        subject,
        body
      });
      setSendResult(res.data || null);
      setSuccessMsg(res.data?.message || 'Reminders sent!');
      fetchRecipients(selectedDate);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reminder emails.');
    } finally {
      setIsSending(false);
      setIsConfirmingSend(false);
    }
  };

  const getPreviewText = (text) => {
    if (!text) return '';
    return text
      .replace(/\{\{eventName\}\}/g, event?.title || 'Tech Hackathon 2026')
      .replace(/\{\{recipientName\}\}/g, 'Alex Johnson')
      .replace(/\{\{date\}\}/g, event?.date ? new Date(event.date).toLocaleDateString() : 'October 24, 2026')
      .replace(/\{\{time\}\}/g, '09:00 - 10:00')
      .replace(/\{\{reportingTime\}\}/g, '09:00')
      .replace(/\{\{venue\}\}/g, event?.venue || 'Main Auditorium')
      .replace(/\{\{slotName\}\}/g, 'Batch 1')
      .replace(/\{\{teamName\}\}/g, 'Alpha Coders');
  };

  const tags = ['{{eventName}}', '{{recipientName}}', '{{date}}', '{{time}}', '{{reportingTime}}', '{{venue}}', '{{slotName}}', '{{teamName}}'];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden bg-slate-900/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-6">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full my-auto max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-3rem)] flex flex-col overflow-hidden p-5 sm:p-6 md:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-fade-in-scale">
        <div className="flex justify-between items-start sm:items-center gap-3 shrink-0 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white font-heading">
              Event Reminder Emails
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-words">
              Send reminder emails manually to the confirmed registrants of a chosen date for <span className="font-semibold text-cyan-600">{event?.title}</span>, or enable automated reminders 3 hours before each session.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pt-5">
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 text-xs font-semibold">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 text-xs font-semibold">
            {successMsg}
          </div>
        )}

        <form id="reminder-email-form" onSubmit={handleSave} className="space-y-5">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Automated reminders (3 hours before each session)</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Off by default. When enabled, each confirmed student receives one reminder per session (multi-slot events use their registered slot).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAutoSend(prev => !prev)}
              className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${autoSend ? 'bg-cyan-600' : 'bg-slate-300 dark:bg-slate-600'}`}
              aria-pressed={autoSend}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${autoSend ? 'translate-x-6' : ''}`} />
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Email Style
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode('default')}
                className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${mode === 'default'
                  ? 'border-cyan-500 bg-cyan-50/60 dark:bg-cyan-950/30'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}
              >
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Default Avento Email</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Friendly default reminder with session details and QR event pass.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setMode('custom')}
                className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${mode === 'custom'
                  ? 'border-cyan-500 bg-cyan-50/60 dark:bg-cyan-950/30'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}
              >
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Custom Instructions & Rules</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Add your own instructions and event rules alongside the details and pass.
                </p>
              </button>
            </div>
          </div>

          {mode === 'custom' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Email Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Reminder: {{eventName}} is coming up"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 text-sm font-medium focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all"
                  required
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[11px] font-semibold text-slate-400 self-center mr-1">Insert placeholder:</span>
                  {tags.map(t => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => insertTag('subject', t)}
                      className="px-2 py-0.5 text-[11px] font-mono bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-900 rounded-md transition-colors cursor-pointer"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Custom Instructions & Event Rules
                </label>
                <textarea
                  rows={6}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Enter custom instructions, event rules, reporting guidelines, or any message for your attendees..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 text-sm font-body focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all"
                  required
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[11px] font-semibold text-slate-400 self-center mr-1">Insert placeholder:</span>
                  {tags.map(t => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => insertTag('body', t)}
                      className="px-2 py-0.5 text-[11px] font-mono bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-900 rounded-md transition-colors cursor-pointer"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </form>

        <div className="mt-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700 mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Send Reminders Manually</span>
            <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-full font-semibold">By Date</span>
          </div>

          {dates.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No session dates found for this event yet.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Session Date
                  </label>
                  <select
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm font-medium focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all cursor-pointer"
                  >
                    {dates.map(d => (
                      <option key={d} value={d}>{formatDateLabel(d)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <span className="px-3 py-1.5 rounded-full bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 text-xs font-bold">
                    {isLoadingRecipients ? 'Loading...' : `${recipients.length} recipient${recipients.length === 1 ? '' : 's'}`}
                  </span>
                  {recipients.filter(r => r.alreadySent).length > 0 && (
                    <span className="px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-bold">
                      {recipients.filter(r => r.alreadySent).length} already emailed
                    </span>
                  )}
                </div>
              </div>

              {recipients.length > 0 && (
                <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                  {recipients.map(r => (
                    <div key={r.registrationId} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                          {r.name}
                          {r.teamName && <span className="ml-1.5 text-[10px] font-semibold text-cyan-600 dark:text-cyan-400">{r.teamName}</span>}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {r.email || 'No email'}
                          {r.slotName ? ` \u00B7 ${r.slotName}` : ''}
                        </p>
                      </div>
                      {r.alreadySent && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-[10px] font-bold shrink-0">
                          Sent
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {sendResult && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Last send: {sendResult.sent} sent, {sendResult.failed} failed, {sendResult.skipped} skipped
                  {sendResult.channel ? ` (via ${sendResult.channel === 'mock' ? 'mock mode' : sendResult.channel})` : ''}.
                </p>
              )}

              <div className="flex items-center gap-2">
                {isConfirmingSend ? (
                  <>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Send to {recipients.length} recipient{recipients.length === 1 ? '' : 's'} on {formatDateLabel(selectedDate)}?
                    </span>
                    <button
                      type="button"
                      onClick={handleSendManual}
                      disabled={isSending || recipients.length === 0}
                      className="ml-auto px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-cyan-700 rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSending ? 'Sending...' : 'Confirm & Send'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingSend(false)}
                      disabled={isSending}
                      className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl transition-colors cursor-pointer"
                    >
                      Back
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingSend(true)}
                    disabled={isSending || isLoadingRecipients || recipients.length === 0}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all cursor-pointer disabled:opacity-50"
                  >
                    Send Reminder Emails
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {isPreviewOpen && (
          <div className="mt-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700 mb-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email Live Preview</span>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-cyan-100 text-cyan-600 rounded-full font-semibold">Sample Data</span>
            </div>
            <div className="space-y-2 text-xs">
              <p className="text-slate-800 dark:text-slate-200 font-bold">
                Subject: <span className="font-normal text-slate-600 dark:text-slate-300">{getPreviewText(mode === 'custom' && subject ? subject : DEFAULT_SUBJECT)}</span>
              </p>
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-body whitespace-pre-line leading-relaxed">
                {getPreviewText(mode === 'custom' && body ? body : DEFAULT_BODY)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                Session details (date, time, reporting time, venue, slot) and a View My Pass button linking to the website are always included below this message.
              </div>
            </div>
          </div>
        )}
        </div>

        <div className="flex items-center justify-between gap-3 shrink-0 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsPreviewOpen(prev => !prev)}
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer shrink-0"
            >
              {isPreviewOpen ? 'Hide Preview' : 'Preview Email'}
            </button>
            <button
              type="button"
              onClick={handleSendTest}
              disabled={isTesting}
              className="px-4 py-2 text-xs font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/40 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 border border-cyan-200 dark:border-cyan-800 rounded-xl transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              title="Sends a [TEST] reminder email to your own address right now"
            >
              {isTesting ? 'Sending...' : 'Send Test Email'}
            </button>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="reminder-email-form"
              disabled={isSaving}
              className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-700 text-white font-bold text-xs rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReminderEmailModal;
