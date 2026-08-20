import React from 'react';

const DEFAULT_QUESTIONS = [
  { id: 'q_content', label: 'Event Content', type: 'rating', required: true },
  { id: 'q_speaker', label: 'Speaker / Presenter', type: 'rating', required: true },
  { id: 'q_org', label: 'Organization', type: 'rating', required: true },
  { id: 'q_engagement', label: 'Engagement', type: 'rating', required: true },
  { id: 'q_overall', label: 'Overall Satisfaction', type: 'rating', required: true },
  { id: 'q_suggestions', label: 'Suggestions for Improvement', type: 'text', required: false }
];

const FeedbackQuestionBuilder = ({ questions, setQuestions }) => {
  const currentQuestions = (questions && Array.isArray(questions) && questions.length > 0)
    ? questions
    : DEFAULT_QUESTIONS;

  const handleUpdateLabel = (index, newLabel) => {
    const updated = [...currentQuestions];
    updated[index] = { ...updated[index], label: newLabel };
    setQuestions(updated);
  };

  const handleUpdateType = (index, newType) => {
    const updated = [...currentQuestions];
    updated[index] = { ...updated[index], type: newType };
    setQuestions(updated);
  };

  const handleToggleRequired = (index) => {
    const updated = [...currentQuestions];
    updated[index] = { ...updated[index], required: !updated[index].required };
    setQuestions(updated);
  };

  const handleAddQuestion = (type = 'rating') => {
    const newId = `q_custom_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newQ = {
      id: newId,
      label: type === 'rating' ? 'Custom Rating Question' : 'Custom Feedback Comment',
      type,
      required: true
    };
    setQuestions([...currentQuestions, newQ]);
  };

  const handleRemoveQuestion = (index) => {
    if (currentQuestions.length <= 1) return;
    const updated = currentQuestions.filter((_, idx) => idx !== index);
    setQuestions(updated);
  };

  const handleMove = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= currentQuestions.length) return;
    const updated = [...currentQuestions];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);
    setQuestions(updated);
  };

  const handleResetToDefault = () => {
    setQuestions([...DEFAULT_QUESTIONS]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span>⚙️ Custom Feedback Form Questions</span>
            <span className="text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 font-extrabold px-2 py-0.5 rounded-full">
              {currentQuestions.length} Questions
            </span>
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Only the questions specified below will be shown to participants when submitting feedback.
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetToDefault}
          className="text-xs font-semibold text-slate-500 hover:text-violet-600 dark:text-slate-400 transition-colors flex items-center gap-1"
          title="Reset to default 5 star ratings + suggestions"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
          </svg>
          Reset Default 5
        </button>
      </div>

      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
        {currentQuestions.map((q, idx) => (
          <div 
            key={q.id || idx}
            className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 transition-all hover:border-violet-300 dark:hover:border-violet-700/50 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-2.5">
              <span className="text-xs font-black text-slate-400 dark:text-slate-600 w-5">
                #{idx + 1}
              </span>

              {/* Move controls */}
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => handleMove(idx, -1)}
                  className="p-0.5 text-slate-400 hover:text-violet-600 disabled:opacity-20 text-[10px]"
                >
                  ▲
                </button>
                <button
                  type="button"
                  disabled={idx === currentQuestions.length - 1}
                  onClick={() => handleMove(idx, 1)}
                  className="p-0.5 text-slate-400 hover:text-violet-600 disabled:opacity-20 text-[10px]"
                >
                  ▼
                </button>
              </div>

              {/* Question Label Input */}
              <input
                type="text"
                value={q.label}
                onChange={(e) => handleUpdateLabel(idx, e.target.value)}
                placeholder="Enter question title..."
                className="flex-grow bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-400"
              />

              {/* Question Type Selector */}
              <select
                value={q.type}
                onChange={(e) => handleUpdateType(idx, e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                <option value="rating">★ 1-5 Star Rating</option>
                <option value="text">✍ Text Comment</option>
              </select>

              {/* Delete Button */}
              <button
                type="button"
                onClick={() => handleRemoveQuestion(idx)}
                disabled={currentQuestions.length <= 1}
                className="p-1.5 text-slate-400 hover:text-red-500 disabled:opacity-20 transition-colors"
                title="Remove question"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pl-8">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={q.required !== false}
                  onChange={() => handleToggleRequired(idx)}
                  className="rounded text-violet-600 focus:ring-violet-400 h-3.5 w-3.5"
                />
                <span>Required field</span>
              </label>

              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {q.type === 'rating' ? 'Rating Stars (1 - 5)' : 'Open Text Field'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Add New Question Buttons */}
      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          onClick={() => handleAddQuestion('rating')}
          className="flex-1 px-3 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:hover:bg-violet-900/50 dark:text-violet-300 border border-violet-200 dark:border-violet-800/50 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
        >
          <span>+ Add Star Rating Question</span>
        </button>

        <button
          type="button"
          onClick={() => handleAddQuestion('text')}
          className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
        >
          <span>+ Add Text Comment Question</span>
        </button>
      </div>
    </div>
  );
};

export default FeedbackQuestionBuilder;
