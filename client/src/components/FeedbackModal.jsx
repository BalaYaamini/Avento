import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from './Modal';

const DEFAULT_QUESTIONS = [
  { id: 'q_content', label: 'Event Content', type: 'rating', required: true },
  { id: 'q_speaker', label: 'Speaker / Presenter', type: 'rating', required: true },
  { id: 'q_org', label: 'Organization', type: 'rating', required: true },
  { id: 'q_engagement', label: 'Engagement', type: 'rating', required: true },
  { id: 'q_overall', label: 'Overall Satisfaction', type: 'rating', required: true },
  { id: 'q_suggestions', label: 'Suggestions for Improvement', type: 'text', required: false }
];

const StarRating = ({ rating, setRating, label }) => {
  return (
    <div className="mb-4">
      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">{label}</label>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
              star <= (rating || 0)
                ? 'bg-amber-400 text-white shadow-lg shadow-amber-400/30 transform scale-110' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-amber-100 hover:text-amber-400'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
};

const FeedbackModal = ({ isOpen, onClose, event, onSubmitSuccess }) => {
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const questions = (event?.feedback_questions && Array.isArray(event.feedback_questions) && event.feedback_questions.length > 0)
    ? event.feedback_questions
    : DEFAULT_QUESTIONS;

  useEffect(() => {
    if (isOpen) {
      setAnswers({});
      setError(null);
    }
  }, [isOpen]);

  if (!event) return null;

  const handleAnswerChange = (qId, val) => {
    setAnswers(prev => ({ ...prev, [qId]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    // Check required questions
    for (const q of questions) {
      if (q.required !== false) {
        const val = answers[q.id];
        if (val === undefined || val === null || String(val).trim() === '' || (q.type === 'rating' && Number(val) === 0)) {
          setError(`Please complete required field: "${q.label}"`);
          return;
        }
      }
    }

    try {
      setIsSubmitting(true);
      await axios.post('/api/feedbacks', {
        eventId: event.id || event._id,
        responses: answers
      });
      onSubmitSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit feedback.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const ratingQuestions = questions.filter(q => q.type === 'rating');
  const textQuestions = questions.filter(q => q.type === 'text');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Event Feedback">
      <form onSubmit={handleSubmit} className="space-y-4">
        
        <div className="bg-violet-50/70 dark:bg-violet-950/30 p-4 rounded-xl border border-violet-100 dark:border-violet-800/40 mb-6">
          <h3 className="font-display font-bold text-slate-800 dark:text-slate-100 text-lg mb-1">{event.title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">We value your feedback. Please complete the questions below.</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded-lg text-xs font-semibold mb-4 border border-red-100">
            {error}
          </div>
        )}

        {/* Rating Questions Grid */}
        {ratingQuestions.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ratingQuestions.map(q => (
              <StarRating
                key={q.id}
                label={`${q.label}${q.required !== false ? ' *' : ''}`}
                rating={answers[q.id] || 0}
                setRating={(val) => handleAnswerChange(q.id, val)}
              />
            ))}
          </div>
        )}

        {/* Text Questions List */}
        {textQuestions.length > 0 && (
          <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            {textQuestions.map(q => (
              <div key={q.id}>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                  {q.label}{q.required !== false ? ' *' : ''}
                </label>
                <textarea
                  value={answers[q.id] || ''}
                  onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                  rows="3"
                  placeholder="Type your response here..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 transition-all text-slate-800 dark:text-slate-100"
                ></textarea>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-bold rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary px-6 py-2.5 text-xs font-display font-bold rounded-xl text-white shadow-lg shadow-violet-500/20 disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default FeedbackModal;
