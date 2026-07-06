import React, { useState } from 'react';
import axios from 'axios';
import Modal from './Modal';

const StarRating = ({ rating, setRating, label }) => {
  return (
    <div className="mb-4">
      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">{label}</label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
              star <= rating 
                ? 'bg-amber-400 text-white shadow-lg shadow-amber-400/30 transform scale-110' 
                : 'bg-slate-100 text-slate-400 hover:bg-amber-100 hover:text-amber-300'
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
  const [contentRating, setContentRating] = useState(0);
  const [speakerRating, setSpeakerRating] = useState(0);
  const [organizationRating, setOrganizationRating] = useState(0);
  const [engagementRating, setEngagementRating] = useState(0);
  const [overallRating, setOverallRating] = useState(0);
  const [suggestions, setSuggestions] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  React.useEffect(() => {
    if (isOpen) {
      setContentRating(0);
      setSpeakerRating(0);
      setOrganizationRating(0);
      setEngagementRating(0);
      setOverallRating(0);
      setSuggestions('');
      setError(null);
    }
  }, [isOpen]);

  if (!event) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (!contentRating || !speakerRating || !organizationRating || !engagementRating || !overallRating) {
      setError("Please provide a rating for all categories.");
      return;
    }

    try {
      setIsSubmitting(true);
      await axios.post('/api/feedbacks', {
        eventId: event.id || event._id,
        contentRating,
        speakerRating,
        organizationRating,
        engagementRating,
        overallRating,
        suggestions
      });
      onSubmitSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit feedback.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Event Feedback">
      <form onSubmit={handleSubmit} className="space-y-4">
        
        <div className="bg-violet-50/50 p-4 rounded-xl border border-violet-100 mb-6">
          <h3 className="font-display font-bold text-slate-800 text-lg mb-1">{event.title}</h3>
          <p className="text-xs text-slate-500">We value your feedback. Please rate your experience.</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded-lg text-xs font-semibold mb-4 border border-red-100">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StarRating label="Event Content" rating={contentRating} setRating={setContentRating} />
          <StarRating label="Speaker / Presenter" rating={speakerRating} setRating={setSpeakerRating} />
          <StarRating label="Organization" rating={organizationRating} setRating={setOrganizationRating} />
          <StarRating label="Engagement" rating={engagementRating} setRating={setEngagementRating} />
        </div>
        
        <div className="pt-2 border-t border-slate-100">
          <StarRating label="Overall Satisfaction" rating={overallRating} setRating={setOverallRating} />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
            Suggestions for Improvement (Optional)
          </label>
          <textarea
            value={suggestions}
            onChange={(e) => setSuggestions(e.target.value)}
            rows="3"
            placeholder="Tell us what you liked or what could be better..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 transition-all"
          ></textarea>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-bold rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
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
