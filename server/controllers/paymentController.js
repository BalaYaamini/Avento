const supabase = require('../config/supabaseClient');
const razorpay = require('../config/razorpay');
const crypto = require('crypto');

// Helper: compute payment amount based on payment_model (returns paise for Razorpay)
const computeAmountPaise = (event, memberCount) => {
  let amountRupees;
  if (event.payment_model === 'per_member') {
    amountRupees = Number(event.payment_amount) * memberCount;
  } else {
    amountRupees = Number(event.payment_amount);
  }
  return Math.round(amountRupees * 100); // Razorpay expects paise
};

// POST /api/payments/create-order
exports.createOrder = async (req, res) => {
  try {
    const { teamId } = req.body;
    const userId = req.user.id;

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID is required.' });
    }

    // Fetch team with event details
    const { data: teamData, error: teamErr } = await supabase
      .from('event_teams')
      .select('id, event_id, leader_id, status, events(*)')
      .eq('id', teamId)
      .single();

    if (teamErr || !teamData) {
      return res.status(404).json({ message: 'Team not found.' });
    }

    // Only team leader can initiate payment
    if (teamData.leader_id !== userId) {
      return res.status(403).json({ message: 'Only the team leader can initiate payment.' });
    }

    // Team must be pending
    if (teamData.status !== 'pending') {
      return res.status(400).json({ message: 'Team is not in pending status.' });
    }

    const event = teamData.events;
    if (!event || !event.payment_enabled) {
      return res.status(400).json({ message: 'Payment is not enabled for this event.' });
    }

    // All members must have accepted
    const { data: teamRegs } = await supabase
      .from('event_registrations')
      .select('user_id, status')
      .eq('team_id', teamId);

    const allAccepted = (teamRegs || []).every(r =>
      r.status === 'registered' || r.user_id === userId
    );
    if (!allAccepted) {
      const pendingCount = (teamRegs || []).filter(r => r.status === 'pending').length;
      return res.status(400).json({
        message: `Cannot proceed to payment. ${pendingCount} member(s) have not accepted yet.`,
        allMembersAccepted: false,
        pendingCount
      });
    }

    // Delete any old pending orders for this team (stale from abandoned checkouts)
    await supabase
      .from('payment_orders')
      .delete()
      .eq('team_id', teamId)
      .eq('status', 'created');

    const memberCount = (teamRegs || []).length;
    const amountPaise = computeAmountPaise(event, memberCount);
    const orderId = `avento_${teamId.substring(0, 8)}_${Date.now()}`;

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: orderId,
      notes: {
        team_id: teamId,
        event_id: event.id,
        user_id: userId,
        event_title: event.title || ''
      }
    });

    if (!razorpayOrder || !razorpayOrder.id) {
      console.error('Razorpay order creation failed:', razorpayOrder);
      return res.status(500).json({ message: 'Failed to create payment order.' });
    }

    // Store order in database
    const { error: insertErr } = await supabase
      .from('payment_orders')
      .insert({
        team_id: teamId,
        event_id: event.id,
        user_id: userId,
        cashfree_order_id: razorpayOrder.id,
        amount: amountPaise / 100,
        currency: 'INR',
        status: 'created',
        member_count: memberCount
      });

    if (insertErr) {
      console.error('Error storing payment order:', insertErr.message);
    }

    res.json({
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('Create order error:', err.message);
    res.status(500).json({ message: 'Server error creating payment order.', error: err.message });
  }
};

// POST /api/payments/verify
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing payment verification parameters.' });
    }

    // Verify signature using HMAC SHA256
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: 'Payment verification failed. Invalid signature.' });
    }

    // Fetch the payment order
    const { data: paymentOrder, error: orderErr } = await supabase
      .from('payment_orders')
      .select('*, event_teams(*)')
      .eq('cashfree_order_id', razorpay_order_id)
      .maybeSingle();

    if (orderErr || !paymentOrder) {
      return res.status(404).json({ message: 'Payment order not found.' });
    }

    // Signature is valid — update order status
    await supabase
      .from('payment_orders')
      .update({
        status: 'paid',
        cashfree_payment_id: razorpay_payment_id,
        updated_at: new Date().toISOString()
      })
      .eq('cashfree_order_id', razorpay_order_id);

    // Finalize team registration
    const team = paymentOrder.event_teams;
    const { data: event } = await supabase.from('events').select('*').eq('id', paymentOrder.event_id).single();

    const { data: acceptedRegs } = await supabase
      .from('event_registrations')
      .select('user_id')
      .eq('team_id', paymentOrder.team_id)
      .eq('status', 'registered');

    const acceptedUserIds = (acceptedRegs || []).map(r => r.user_id);

    const { finalizeTeamRegistration } = require('./registrationController');
    await finalizeTeamRegistration(paymentOrder.team_id, event, team.leader_id, acceptedUserIds);

    // Send notifications
    try {
      const { notifyUser } = require('../services/notificationService');
      await notifyUser(team.leader_id, {
        title: 'Payment Successful',
        message: `Your payment of ₹${paymentOrder.amount} for "${event.title}" was successful. Your team is now confirmed!`,
        type: 'payment_success'
      });
    } catch (notifErr) {
      console.warn('Notification error:', notifErr.message);
    }

    res.json({ status: 'SUCCESS', message: 'Payment verified. Team registration confirmed!' });
  } catch (err) {
    console.error('Verify payment error:', err.message);
    res.status(500).json({ message: 'Server error verifying payment.', error: err.message });
  }
};

// GET /api/payments/order-status/:orderId
exports.getOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    const { data: paymentOrder, error } = await supabase
      .from('payment_orders')
      .select('*')
      .eq('cashfree_order_id', orderId)
      .maybeSingle();

    if (error || !paymentOrder) {
      return res.status(404).json({ message: 'Payment order not found.' });
    }

    res.json({
      status: paymentOrder.status,
      amount: paymentOrder.amount,
      failureReason: paymentOrder.failure_reason
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching order status.', error: err.message });
  }
};

// POST /api/payments/webhook (no auth - Razorpay calls this)
exports.handleWebhook = async (req, res) => {
  try {
    const rawBody = req.rawBody;
    const signature = req.headers['x-razorpay-signature'];

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.error('Webhook signature verification failed');
      return res.status(400).json({ message: 'Invalid webhook signature.' });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event;

    // Idempotency check using Razorpay event id
    const eventId = event.id;
    if (eventId) {
      const { data: existing } = await supabase
        .from('payment_webhook_events')
        .select('event_id')
        .eq('event_id', eventId)
        .maybeSingle();

      if (existing) {
        return res.status(200).json({ message: 'Event already processed.' });
      }

      await supabase.from('payment_webhook_events').insert({ event_id: eventId });
    }

    if (eventType === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const orderId = payment.order_id;

      // Update order status
      await supabase
        .from('payment_orders')
        .update({
          status: 'paid',
          cashfree_payment_id: payment.id,
          updated_at: new Date().toISOString()
        })
        .eq('cashfree_order_id', orderId)
        .eq('status', 'created');

      // Fetch order and finalize team
      const { data: paymentOrder } = await supabase
        .from('payment_orders')
        .select('*')
        .eq('cashfree_order_id', orderId)
        .maybeSingle();

      if (paymentOrder && paymentOrder.status === 'paid') {
        const team = await supabase.from('event_teams').select('*').eq('id', paymentOrder.team_id).single();
        const eventRecord = await supabase.from('events').select('*').eq('id', paymentOrder.event_id).single();

        if (team.data && eventRecord.data) {
          const { finalizeTeamRegistration } = require('./registrationController');
          const { data: acceptedRegs } = await supabase
            .from('event_registrations')
            .select('user_id')
            .eq('team_id', paymentOrder.team_id)
            .eq('status', 'registered');
          const acceptedUserIds = (acceptedRegs || []).map(r => r.user_id);

          await finalizeTeamRegistration(paymentOrder.team_id, eventRecord.data, team.data.leader_id, acceptedUserIds);

          try {
            const { notifyUser } = require('../services/notificationService');
            await notifyUser(team.data.leader_id, {
              title: 'Payment Successful',
              message: `Your payment of ₹${paymentOrder.amount} for "${eventRecord.data.title}" was successful. Your team is now confirmed!`,
              type: 'payment_success'
            });
          } catch (notifErr) {
            console.warn('Webhook notification error:', notifErr.message);
          }
        }
      }
    } else if (eventType === 'payment.failed') {
      const payment = event.payload.payment.entity;
      const orderId = payment.order_id;

      await supabase
        .from('payment_orders')
        .update({
          status: 'failed',
          failure_reason: payment.error_description || 'Payment failed',
          updated_at: new Date().toISOString()
        })
        .eq('cashfree_order_id', orderId);
    }

    res.status(200).json({ message: 'Webhook processed.' });
  } catch (err) {
    console.error('Webhook processing error:', err.message);
    res.status(200).json({ message: 'Webhook received.' });
  }
};

// POST /api/payments/retry
exports.retryPayment = async (req, res) => {
  try {
    const { teamId } = req.body;
    const userId = req.user.id;

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID is required.' });
    }

    const { data: teamData, error: teamErr } = await supabase
      .from('event_teams')
      .select('id, leader_id, status')
      .eq('id', teamId)
      .single();

    if (teamErr || !teamData) {
      return res.status(404).json({ message: 'Team not found.' });
    }

    if (teamData.leader_id !== userId) {
      return res.status(403).json({ message: 'Only the team leader can retry payment.' });
    }

    if (teamData.status !== 'pending') {
      return res.status(400).json({ message: 'Team is not in pending status.' });
    }

    // Delete the failed order so a new one can be created
    await supabase
      .from('payment_orders')
      .delete()
      .eq('team_id', teamId)
      .eq('status', 'failed');

    res.json({ message: 'Ready to retry. Create a new payment order.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error retrying payment.', error: err.message });
  }
};
