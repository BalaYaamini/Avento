import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ConfirmationEmailModal = ({ isOpen, onClose, eventId, event, onUpdate }) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState(null);
  const [attachmentName, setAttachmentName] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    if (event) {
      const config = event.certificate_fields_config?.confirmation_email || {};
      setSubject(config.subject || `Team Confirmed – {{eventName}}`);
      setBody(config.body || `Dear {{teamLeaderName}},\n\nYour team "{{teamName}}" has been successfully confirmed for "{{eventName}}". See you there!\n\nRegards,\nAvento Team`);
      setAttachmentUrl(config.attachment_url || null);
      setAttachmentName(config.attachment_name || null);
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

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('File size exceeds maximum limit of 10MB.');
      return;
    }

    setIsUploading(true);
    setError('');
    const formData = new FormData();
    formData.append('attachment', file);

    try {
      const res = await axios.post(`/api/events/${eventId}/confirmation-attachment`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setAttachmentUrl(res.data.attachmentUrl);
      setAttachmentName(res.data.attachmentName);
      setSuccessMsg('Attachment uploaded successfully! Click Save to confirm changes.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload attachment.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAttachment = async () => {
    setIsSaving(true);
    try {
      await axios.delete(`/api/events/${eventId}/confirmation-attachment`);
      setAttachmentUrl(null);
      setAttachmentName(null);
      setSuccessMsg('Attachment removed.');
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove attachment.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccessMsg('');

    try {
      await axios.put(`/api/events/${eventId}/confirmation-email`, {
        subject,
        body,
        attachmentUrl,
        attachmentName
      });
      setSuccessMsg('Confirmation email configuration saved successfully!');
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
      .replace(/\{\{teamName\}\}/g, 'Alpha Coders')
      .replace(/\{\{recipientName\}\}/g, 'Alex Johnson')
      .replace(/\{\{teamLeaderName\}\}/g, 'Alex Johnson')
      .replace(/\{\{date\}\}/g, event?.date ? new Date(event.date).toLocaleDateString() : 'October 24, 2026')
      .replace(/\{\{venue\}\}/g, event?.venue || 'Main Auditorium');
  };

  const tags = ['{{eventName}}', '{{teamName}}', '{{recipientName}}', '{{teamLeaderName}}', '{{date}}', '{{venue}}'];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-fade-in-scale">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white font-heading">
              Customize Confirmation Email
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Configure the email sent when a team is confirmed for <span className="font-semibold text-fuchsia-600">{event?.title}</span>.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

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

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Email Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Team Confirmation for {{eventName}}"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 text-sm font-medium focus:ring-2 focus:ring-fuchsia-500 focus:outline-none transition-all"
              required
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-[11px] font-semibold text-slate-400 self-center mr-1">Insert placeholder:</span>
              {tags.map(t => (
                <button
                  type="button"
                  key={t}
                  onClick={() => insertTag('subject', t)}
                  className="px-2 py-0.5 text-[11px] font-mono bg-fuchsia-50 dark:bg-fuchsia-950/50 text-fuchsia-600 dark:text-fuchsia-400 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900 rounded-md transition-colors cursor-pointer"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Message / Guidelines / Notes
            </label>
            <textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter guidelines, instructions, schedule notes, or custom message..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 text-sm font-body focus:ring-2 focus:ring-fuchsia-500 focus:outline-none transition-all"
              required
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-[11px] font-semibold text-slate-400 self-center mr-1">Insert placeholder:</span>
              {tags.map(t => (
                <button
                  type="button"
                  key={t}
                  onClick={() => insertTag('body', t)}
                  className="px-2 py-0.5 text-[11px] font-mono bg-fuchsia-50 dark:bg-fuchsia-950/50 text-fuchsia-600 dark:text-fuchsia-400 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900 rounded-md transition-colors cursor-pointer"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Event Confirmation Attachment (PDF / Document)
            </label>
            {attachmentUrl ? (
              <div className="p-3.5 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-between border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2 bg-fuchsia-100 dark:bg-fuchsia-950 text-fuchsia-600 dark:text-fuchsia-400 rounded-xl shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{attachmentName || 'Attachment File'}</p>
                    <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-fuchsia-600 dark:text-fuchsia-400 hover:underline">View Attachment</a>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <label className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-650 rounded-xl cursor-pointer transition-colors">
                    Replace
                    <input type="file" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden" />
                  </label>
                  <button
                    type="button"
                    onClick={handleRemoveAttachment}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors"
                    title="Remove Attachment"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-fuchsia-500 dark:hover:border-fuchsia-500 rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 dark:bg-slate-800/30 hover:bg-fuchsia-50/30 transition-all">
                <svg className="w-8 h-8 text-slate-400 dark:text-slate-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {isUploading ? 'Uploading file...' : 'Click to upload event confirmation attachment'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Supports PDF, DOCX, Images up to 10MB</p>
                <input type="file" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden" disabled={isUploading} />
              </label>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsPreviewOpen(prev => !prev)}
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              {isPreviewOpen ? 'Hide Preview' : 'Preview Email'}
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-gradient-to-r from-fuchsia-600 via-purple-600 to-indigo-600 text-white font-bold text-xs rounded-xl hover:shadow-lg hover:shadow-fuchsia-500/25 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </form>

        {isPreviewOpen && (
          <div className="mt-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700 mb-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email Live Preview</span>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-fuchsia-100 text-fuchsia-600 rounded-full font-semibold">Sample Data</span>
            </div>
            <div className="space-y-2 text-xs">
              <p className="text-slate-800 dark:text-slate-200 font-bold">
                Subject: <span className="font-normal text-slate-600 dark:text-slate-300">{getPreviewText(subject)}</span>
              </p>
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-body whitespace-pre-line leading-relaxed">
                {getPreviewText(body)}
              </div>
              {attachmentName && (
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1">
                  <svg className="w-3.5 h-3.5 text-fuchsia-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <span>Attachment: <strong className="text-slate-700 dark:text-slate-200">{attachmentName}</strong></span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfirmationEmailModal;
