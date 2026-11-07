import React, { useState, useEffect } from 'react';
import axios from 'axios';

const DEFAULT_SUBJECT = 'Reminder: {{eventName}} starts in 3 hours';
const DEFAULT_BODY = `Hi {{recipientName}},

This is a friendly reminder that your event is starting in 3 hours. Please find your session details and event pass in this email. Keep this email handy and show the QR code at the check-in desk.

Please report to the venue on time.

See you there!
- Team Avento`;

const ReminderEmailModal = ({ isOpen, onClose, eventId, event, onUpdate }) => {
  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState('default');
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    if (event) {
      const config = event.reminder_email_config || {};
      setEnabled(config.enabled !== false);
      setMode(config.mode === 'custom' ? 'custom' : 'default');
      setSubject(config.subject || DEFAULT_SUBJECT);
      setBody(config.body || '');
    }
  }, [event, isOpen]);

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
        enabled,
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
              Automated Event Reminders
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-words">
              Reminders are emailed to confirmed registrants 3 hours before their session for <span className="font-semibold text-cyan-600">{event?.title}</span>.
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
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Send reminder emails</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Each confirmed student receives one reminder per session (multi-slot events use their registered slot).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(prev => !prev)}
              className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${enabled ? 'bg-cyan-600' : 'bg-slate-300 dark:bg-slate-600'}`}
              aria-pressed={enabled}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : ''}`} />
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
                  placeholder="e.g. Reminder: {{eventName}} starts in 3 hours"
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
                Session details (date, time, reporting time, venue, slot, pass ID) and the student's QR event pass are always included below this message.
              </div>
            </div>
          </div>
        )}
        </div>

        <div className="flex items-center justify-between gap-3 shrink-0 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
          <button
            type="button"
            onClick={() => setIsPreviewOpen(prev => !prev)}
            className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer shrink-0"
          >
            {isPreviewOpen ? 'Hide Preview' : 'Preview Email'}
          </button>
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
