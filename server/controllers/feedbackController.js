const supabase = require('../config/supabaseClient');

/**
 * Submit feedback for an event
 * POST /api/feedbacks
 */
const submitFeedback = async (req, res) => {
  try {
    const { 
      eventId, 
      contentRating, 
      speakerRating, 
      organizationRating, 
      engagementRating, 
      overallRating, 
      suggestions 
    } = req.body;
    const userId = req.user.id;

    if (!eventId || !contentRating || !speakerRating || !organizationRating || !engagementRating || !overallRating) {
      return res.status(400).json({ message: 'All ratings are required.' });
    }

    // Check if event exists and is completed
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, status')
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

    if (regError || !registration) {
      return res.status(403).json({ message: 'Only registered participants can submit feedback.' });
    }

    // Insert feedback (UNIQUE constraint will prevent duplicate submissions)
    const { data: feedback, error: insertError } = await supabase
      .from('feedbacks')
      .insert({
        event_id: eventId,
        user_id: userId,
        content_rating: contentRating,
        speaker_rating: speakerRating,
        organization_rating: organizationRating,
        engagement_rating: engagementRating,
        overall_rating: overallRating,
        suggestions: suggestions || null
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
    
    // Authorization check is usually done via middleware or in controller
    // but here we just need to ensure the user has access.
    // Assuming frontend only shows this if authorized, but let's be safe.
    
    // 1. Get total registrations
    const { count: registeredCount, error: regError } = await supabase
      .from('event_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId);
      
    if (regError) throw regError;

    // 2. Get all feedbacks
    const { data: feedbacks, error: fbError } = await supabase
      .from('feedbacks')
      .select('*')
      .eq('event_id', eventId);

    if (fbError) throw fbError;

    const submittedCount = feedbacks.length;
    const pendingCount = (registeredCount || 0) - submittedCount;
    const responseRate = registeredCount > 0 ? Math.round((submittedCount / registeredCount) * 100) : 0;

    // Calculate averages and distribution
    let contentTotal = 0;
    let speakerTotal = 0;
    let orgTotal = 0;
    let engagementTotal = 0;
    let overallTotal = 0;

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const suggestions = [];

    feedbacks.forEach(fb => {
      contentTotal += Number(fb.content_rating) || 0;
      speakerTotal += Number(fb.speaker_rating) || 0;
      orgTotal += Number(fb.organization_rating) || 0;
      engagementTotal += Number(fb.engagement_rating) || 0;
      overallTotal += Number(fb.overall_rating) || 0;

      const rating = Number(fb.overall_rating) || 0;
      if (rating >= 1 && rating <= 5) {
        distribution[rating] += 1;
      }

      if (fb.suggestions && fb.suggestions.trim() !== '') {
        suggestions.push({
          id: fb.id,
          text: fb.suggestions,
          date: fb.created_at
        });
      }
    });

    const calculateAvg = (total) => submittedCount > 0 ? (total / submittedCount).toFixed(1) : '0.0';

    const analytics = {
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
      suggestions: suggestions.sort((a, b) => new Date(b.date) - new Date(a.date)) // Newest first
    };

    res.json(analytics);
  } catch (err) {
    console.error('Get event feedbacks error:', err);
    res.status(500).json({ message: 'Server error fetching feedback analytics', error: err.message });
  }
};

/**
 * Check if a user has submitted feedback for an event
 * GET /api/feedbacks/event/:eventId/user/:userId/status
 */
const getUserFeedbackStatus = async (req, res) => {
  try {
    const { eventId, userId } = req.params;
    
    // Only allow users to check their own status, unless admin
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
  getUserFeedbackStatus,
  getMyFeedbackStatuses
};
