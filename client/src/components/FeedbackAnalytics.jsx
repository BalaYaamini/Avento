import React, { useState, useEffect } from 'react';
import axios from 'axios';

const RatingCard = ({ title, value, max = 5 }) => {
  const numericValue = parseFloat(value) || 0;
  const percentage = (numericValue / max) * 100;
  
  return (
    <div className="glass-panel p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
      <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-2 line-clamp-1" title={title}>{title}</h4>
      <div className="flex items-end gap-2 mb-2">
        <span className="text-3xl font-black text-text-primary">{value}</span>
        <span className="text-sm font-bold text-text-secondary mb-1">/ {max}</span>
      </div>
      
      {/* Visual Stars Representation */}
      <div className="flex text-amber-400 mb-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg 
            key={star} 
            xmlns="http://www.w3.org/2000/svg" 
            className={`h-4 w-4 ${star <= Math.round(numericValue) ? 'text-amber-400' : 'text-slate-200 dark:text-slate-700'}`} 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>

      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
        <div 
          className="bg-violet-500 h-1.5 rounded-full transition-all duration-1000" 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

const FeedbackAnalytics = ({ eventId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/api/feedbacks/event/${eventId}`);
        setData(res.data);
      } catch (err) {
        console.error('Error fetching feedback analytics:', err);
        setError('Failed to load feedback data.');
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
      fetchAnalytics();
    }
  }, [eventId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-center p-4">{error}</div>;
  }

  if (!data) return null;

  const { questions = [], questionAnalytics = {}, participation = {}, suggestions = [], distribution = {} } = data;
  const totalSubmissions = participation.submitted || 0;

  const ratingQuestions = (questions || []).filter(q => q.type === 'rating');
  const textQuestions = (questions || []).filter(q => q.type === 'text');

  return (
    <div className="space-y-8 animate-fade-in-up">
      
      {/* Participation Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-bold text-text-secondary uppercase">Registered</div>
          <div className="text-2xl font-black text-text-primary mt-1">{participation.registered || 0}</div>
        </div>
        <div className="scrapbook-panel p-4 rounded-xl border-t-4 border-t-emerald-400 border-slate-200 dark:border-slate-800">
          <div className="text-xs font-bold text-emerald-500 uppercase">Submitted</div>
          <div className="text-2xl font-black text-emerald-500 mt-1">{participation.submitted || 0}</div>
        </div>
        <div className="scrapbook-panel p-4 rounded-xl border-t-4 border-t-amber-400 border-slate-200 dark:border-slate-800">
          <div className="text-xs font-bold text-amber-500 uppercase">Pending</div>
          <div className="text-2xl font-black text-amber-500 mt-1">{participation.pending || 0}</div>
        </div>
        <div className="scrapbook-panel p-4 rounded-xl border-t-4 border-t-violet-400 border-slate-200 dark:border-slate-800">
          <div className="text-xs font-bold text-violet-500 uppercase">Response Rate</div>
          <div className="text-2xl font-black text-violet-500 mt-1">{participation.responseRate || 0}%</div>
        </div>
      </div>

      {totalSubmissions === 0 ? (
        <div className="glass-panel p-10 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
          <div className="text-text-secondary mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-text-primary">No Feedback Yet</h3>
          <p className="text-sm text-text-secondary">Analytics will appear here once participants start submitting feedback.</p>
        </div>
      ) : (
        <>
          {/* Dynamic Rating Cards */}
          {ratingQuestions.length > 0 && (
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                Rating Question Averages
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {ratingQuestions.map(q => {
                  const qStat = questionAnalytics[q.id] || {};
                  return (
                    <RatingCard key={q.id} title={q.label} value={qStat.average || '0.0'} />
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Rating Distribution Chart */}
            <div className="lg:col-span-1 glass-panel p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-sm font-bold text-text-primary mb-6">Overall Rating Distribution</h3>
              <div className="space-y-4">
                {[5, 4, 3, 2, 1].map(star => {
                  const count = distribution[star] || 0;
                  const percentage = totalSubmissions > 0 ? (count / totalSubmissions) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-3">
                      <div className="w-12 text-xs font-bold text-text-secondary flex items-center gap-1">
                        {star} <span className="text-amber-400">★</span>
                      </div>
                      <div className="flex-grow bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full h-3 overflow-hidden">
                        <div 
                          className="bg-amber-400 h-3 rounded-full" 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <div className="w-8 text-right text-xs font-bold text-text-secondary">{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Written Responses / Comments */}
            <div className="lg:col-span-2 glass-panel p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-sm font-bold text-text-primary mb-6">Participant Comments & Feedback</h3>
              
              {textQuestions.length > 0 ? (
                <div className="space-y-6">
                  {textQuestions.map(tq => {
                    const resps = questionAnalytics[tq.id]?.responses || [];
                    return (
                      <div key={tq.id} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">
                            {tq.label}
                          </h4>
                          <span className="text-[10px] font-bold bg-violet-500/10 text-violet-500 border border-violet-500/20 px-2 py-0.5 rounded-md">
                            {resps.length} Responses
                          </span>
                        </div>

                        {resps.length === 0 ? (
                          <div className="text-xs text-text-secondary italic bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                            No responses for this question yet.
                          </div>
                        ) : (
                          <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                            {resps.map((resp, idx) => (
                              <div key={resp.id || idx} className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                                <p className="text-xs text-text-primary leading-relaxed">"{resp.text}"</p>
                                <div className="text-[9px] text-text-secondary mt-1.5 font-medium">
                                  Submitted on {new Date(resp.date).toLocaleDateString()}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : suggestions.length > 0 ? (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {suggestions.map((suggestion, idx) => (
                    <div key={suggestion.id || idx} className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                      <p className="text-xs text-text-primary leading-relaxed">"{suggestion.text}"</p>
                      <div className="text-[9px] text-text-secondary mt-1.5 font-medium">
                        Submitted on {new Date(suggestion.date).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-text-secondary text-sm italic">
                  No written comments provided yet.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FeedbackAnalytics;
