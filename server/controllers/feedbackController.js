const supabase = require('../config/supabaseClient');

const DEFAULT_FEEDBACK_QUESTIONS = [
  { id: 'q_content', label: 'Event Content', type: 'rating', required: true },
  { id: 'q_speaker', label: 'Speaker / Presenter', type: 'rating', required: true },
  { id: 'q_org', label: 'Organization', type: 'rating', required: true },
  { id: 'q_engagement', label: 'Engagement', type: 'rating', required: true },
  { id: 'q_overall', label: 'Overall Satisfaction', type: 'rating', required: true },
  { id: 'q_suggestions', label: 'Suggestions for Improvement', type: 'text', required: false }
];

const isEventOrganizer = async (event, eventId, userId) => {
  const directOrganizerIds = [
    event.faculty_id,
    event.student_organizer_id,
    event.proposed_by,
    event.organizer_id,
    event.created_by
  ].filter(Boolean).map(String);

  if (directOrganizerIds.includes(String(userId))) return true;

  const [{ data: organizer }, { data: member }] = await Promise.all([
    supabase.from('event_organizers').select('id').eq('event_id', eventId).eq('student_id', userId).maybeSingle(),
    supabase.from('event_members').select('id').eq('event_id', eventId).eq('user_id', userId).maybeSingle()
  ]);

  return Boolean(organizer || member);
};

/**
 * Submit feedback for an event
 * POST /api/feedbacks
 */
const submitFeedback = async (req, res) => {
  try {
    const { 
      eventId, 
      responses,
      contentRating, 
      speakerRating, 
      organizationRating, 
      engagementRating, 
      overallRating, 
      suggestions 
    } = req.body;
    const userId = req.user.id;

    if (!eventId) {
      return res.status(400).json({ message: 'Event ID is required.' });
    }

    // Check if event exists and is completed
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, status, feedback_questions, faculty_id, student_organizer_id, proposed_by, organizer_id, created_by')
      .eq('id', eventId)
      .maybeSingle();

    if (eventError || !event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    if (event.status !== 'completed') {
      return res.status(400).json({ message: 'Feedback can only be submitted for completed events.' });
    }

    // Check if user is registered for the event
    const { data: registration, error: regError } = await supabase
      .from('event_registrations')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();

    const organizerAccess = await isEventOrganizer(event, eventId, userId);
    if (regError && !/no rows|multiple rows/i.test(regError.message || '')) throw regError;
    if (!registration && !organizerAccess) {
      return res.status(403).json({ message: 'Only registered participants or event organizers can submit feedback.' });
    }

    let finalResponses = responses || {};
    let finalContentRating = contentRating || finalResponses.contentRating || finalResponses['q_content'] || null;
    let finalSpeakerRating = speakerRating || finalResponses.speakerRating || finalResponses['q_speaker'] || null;
    let finalOrgRating = organizationRating || finalResponses.organizationRating || finalResponses['q_org'] || null;
    let finalEngagementRating = engagementRating || finalResponses.engagementRating || finalResponses['q_engagement'] || null;
    let finalOverallRating = overallRating || finalResponses.overallRating || finalResponses['q_overall'] || null;
    let finalSuggestions = suggestions || finalResponses.suggestions || finalResponses['q_suggestions'] || null;

    if (!responses) {
      finalResponses = {
        q_content: finalContentRating,
        q_speaker: finalSpeakerRating,
        q_org: finalOrgRating,
        q_engagement: finalEngagementRating,
        q_overall: finalOverallRating,
        q_suggestions: finalSuggestions
      };
    } else {
      const ratingVals = Object.values(responses).filter(v => typeof v === 'number');
      if (ratingVals.length > 0 && !finalOverallRating) {
        finalOverallRating = Math.round(ratingVals.reduce((a, b) => a + b, 0) / ratingVals.length);
      }
    }

    // Insert feedback (UNIQUE constraint will prevent duplicate submissions)
    const { data: feedback, error: insertError } = await supabase
      .from('feedbacks')
      .insert({
        event_id: eventId,
        user_id: userId,
        content_rating: finalContentRating,
        speaker_rating: finalSpeakerRating,
        organization_rating: finalOrgRating,
        engagement_rating: finalEngagementRating,
        overall_rating: finalOverallRating,
        suggestions: finalSuggestions,
        responses: finalResponses
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') { // Unique violation
        return res.status(400).json({ message: 'You have already submitted feedback for this event.' });
      }
      throw insertError;
    }

    res.status(201).json({ message: 'Feedback submitted successfully', feedback });
  } catch (err) {
    console.error('Submit feedback error:', err);
    res.status(500).json({ message: 'Server error submitting feedback', error: err.message });
  }
};

/**
 * Get feedback analytics for an event
 * GET /api/feedbacks/event/:eventId
 */
const getEventFeedbacks = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    // 1. Get event configuration
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('id, title, feedback_questions')
      .eq('id', eventId)
      .maybeSingle();

    if (eventErr || !event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    const questions = (event.feedback_questions && Array.isArray(event.feedback_questions) && event.feedback_questions.length > 0)
      ? event.feedback_questions
      : DEFAULT_FEEDBACK_QUESTIONS;

    // 2. Get total registrations
    const { count: registeredCount, error: regError } = await supabase
      .from('event_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId);
      
    if (regError) throw regError;

    // 3. Get all feedbacks
    const { data: feedbacks, error: fbError } = await supabase
      .from('feedbacks')
      .select('*')
      .eq('event_id', eventId);

    if (fbError) throw fbError;

    const submittedCount = feedbacks.length;
    const pendingCount = (registeredCount || 0) - submittedCount;
    const responseRate = registeredCount > 0 ? Math.round((submittedCount / registeredCount) * 100) : 0;

    // Standard fallback aggregations
    let contentTotal = 0, speakerTotal = 0, orgTotal = 0, engagementTotal = 0, overallTotal = 0;
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const suggestions = [];

    // Dynamic per-question analytics
    const questionAnalytics = {};
    questions.forEach(q => {
      if (q.type === 'rating') {
        questionAnalytics[q.id] = {
          id: q.id,
          label: q.label,
          type: 'rating',
          totalScore: 0,
          count: 0,
          average: '0.0',
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        };
      } else if (q.type === 'text') {
        questionAnalytics[q.id] = {
          id: q.id,
          label: q.label,
          type: 'text',
          responses: []
        };
      }
    });

    feedbacks.forEach(fb => {
      const fbResp = fb.responses || {};

      contentTotal += Number(fb.content_rating) || 0;
      speakerTotal += Number(fb.speaker_rating) || 0;
      orgTotal += Number(fb.organization_rating) || 0;
      engagementTotal += Number(fb.engagement_rating) || 0;
      overallTotal += Number(fb.overall_rating) || 0;

      const overallVal = Number(fb.overall_rating) || 0;
      if (overallVal >= 1 && overallVal <= 5) {
        distribution[overallVal] += 1;
      }

      if (fb.suggestions && fb.suggestions.trim() !== '') {
        suggestions.push({
          id: fb.id,
          text: fb.suggestions,
          date: fb.created_at
        });
      }

      // Process dynamic answers
      questions.forEach(q => {
        let val = fbResp[q.id];
        
        // Fallbacks for standard question IDs
        if (val === undefined || val === null) {
          if (q.id === 'q_content') val = fb.content_rating;
          else if (q.id === 'q_speaker') val = fb.speaker_rating;
          else if (q.id === 'q_org') val = fb.organization_rating;
          else if (q.id === 'q_engagement') val = fb.engagement_rating;
          else if (q.id === 'q_overall') val = fb.overall_rating;
          else if (q.id === 'q_suggestions') val = fb.suggestions;
        }

        if (q.type === 'rating' && val !== undefined && val !== null) {
          const numVal = Number(val);
          if (numVal >= 1 && numVal <= 5) {
            questionAnalytics[q.id].totalScore += numVal;
            questionAnalytics[q.id].count += 1;
            questionAnalytics[q.id].distribution[numVal] += 1;
          }
        } else if (q.type === 'text' && val && String(val).trim() !== '') {
          questionAnalytics[q.id].responses.push({
            id: fb.id,
            text: String(val).trim(),
            date: fb.created_at
          });
        }
      });
    });

    // Finalize question averages
    Object.keys(questionAnalytics).forEach(qId => {
      const qData = questionAnalytics[qId];
      if (qData.type === 'rating') {
        qData.average = qData.count > 0 ? (qData.totalScore / qData.count).toFixed(1) : '0.0';
      }
    });

    const calculateAvg = (total) => submittedCount > 0 ? (total / submittedCount).toFixed(1) : '0.0';

    const analytics = {
      questions,
      questionAnalytics,
      averages: {
        content: calculateAvg(contentTotal),
        speaker: calculateAvg(speakerTotal),
        organization: calculateAvg(orgTotal),
        engagement: calculateAvg(engagementTotal),
        overall: calculateAvg(overallTotal)
      },
      distribution,
      participation: {
        registered: registeredCount || 0,
        submitted: submittedCount,
        pending: pendingCount > 0 ? pendingCount : 0,
        responseRate
      },
      suggestions: suggestions.sort((a, b) => new Date(b.date) - new Date(a.date))
    };

    res.json(analytics);
  } catch (err) {
    console.error('Get event feedbacks error:', err);
    res.status(500).json({ message: 'Server error fetching feedback analytics', error: err.message });
  }
};

/**
 * Update feedback questions schema for an event
 * PUT /api/feedbacks/event/:eventId/questions
 */
const updateFeedbackQuestions = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { questions } = req.body;

    if (!Array.isArray(questions)) {
      return res.status(400).json({ message: 'Questions must be an array.' });
    }

    const { data: updatedEvent, error } = await supabase
      .from('events')
      .update({ feedback_questions: questions })
      .eq('id', eventId)
      .select('id, title, feedback_questions')
      .single();

    if (error) throw error;

    res.json({ message: 'Feedback questions updated successfully.', event: updatedEvent });
  } catch (err) {
    console.error('Update feedback questions error:', err);
    res.status(500).json({ message: 'Failed to update feedback questions', error: err.message });
  }
};

/**
 * Check if a user has submitted feedback for an event
 * GET /api/feedbacks/event/:eventId/user/:userId/status
 */
const getUserFeedbackStatus = async (req, res) => {
  try {
    const { eventId, userId } = req.params;
    
    if (req.user.id !== userId && !req.user.roles.includes('admin')) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const { data, error } = await supabase
      .from('feedbacks')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    res.json({ submitted: !!data });
  } catch (err) {
    console.error('Get user feedback status error:', err);
    res.status(500).json({ message: 'Server error checking feedback status', error: err.message });
  }
};

/**
 * Get all feedback statuses for the current user
 * GET /api/feedbacks/my-statuses
 */
const getMyFeedbackStatuses = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data, error } = await supabase
      .from('feedbacks')
      .select('event_id')
      .eq('user_id', userId);

    if (error) throw error;

    const statuses = {};
    (data || []).forEach(row => {
      statuses[row.event_id] = true;
    });

    res.json(statuses);
  } catch (err) {
    console.error('Get my feedback statuses error:', err);
    res.status(500).json({ message: 'Server error fetching feedback statuses', error: err.message });
  }
};

module.exports = {
  submitFeedback,
  getEventFeedbacks,
  updateFeedbackQuestions,
  getUserFeedbackStatus,
  getMyFeedbackStatuses
};
