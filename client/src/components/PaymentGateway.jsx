import { useState } from 'react';
import axios from 'axios';

const PaymentGateway = ({ event, teamId, teamMembers, onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const memberCount = (teamMembers || []).length;
  const isPerMember = event.payment_model === 'per_member';
  const baseAmount = Number(event.payment_amount);
  const totalAmount = isPerMember ? baseAmount * memberCount : baseAmount;

  const handlePay = async () => {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Create order on server
      const { data: orderData } = await axios.post('/api/payments/create-order', {
        teamId
      });

      // Step 2: Load Razorpay SDK
      if (!window.Razorpay) {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
        });
      }

      // Step 3: Open Razorpay checkout
      const options = {
        key: orderData.razorpayKeyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Avento',
        description: `Payment for ${event.title || 'Event Registration'}`,
        order_id: orderData.orderId,
        handler: async (response) => {
          // Payment successful — verify on server
          try {
            const { data: verifyData } = await axios.post('/api/payments/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (verifyData.status === 'SUCCESS') {
              if (onSuccess) onSuccess(verifyData);
            } else {
              setError(verifyData.message || 'Payment verification failed.');
              setLoading(false);
            }
          } catch (verifyErr) {
            setError(verifyErr.response?.data?.message || 'Payment verification failed. Please contact support.');
            setLoading(false);
          }
        },
        prefill: {
          name: '',
          email: '',
          contact: ''
        },
        notes: {
          team_id: teamId,
          event_id: event.id
        },
        theme: {
          color: '#f59e0b'
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            setError('Payment was cancelled. Your team is still pending.');
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response) => {
        setError(response.error?.description || 'Payment failed. Please try again.');
        setLoading(false);
      });
      rzp.open();
    } catch (err) {
      const message = err.response?.data?.message || 'Payment initialization failed. Please try again.';
      setError(message);
      setLoading(false);
      if (onError) onError(err);
    }
  };

  return (
    <div className="border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 mb-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
        <div>
          <h4 className="font-bold text-amber-800">Online Payment Required</h4>
          <p className="text-xs text-amber-600">Complete payment to confirm your team registration</p>
        </div>
      </div>

      {/* Amount Breakdown */}
      <div className="bg-white/60 rounded-xl p-4 mb-4 border border-amber-100">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-slate-600">
            {isPerMember ? `₹${baseAmount} × ${memberCount} member${memberCount > 1 ? 's' : ''}` : 'Fixed team fee'}
          </span>
          <span className="text-sm font-bold text-slate-700">
            {isPerMember ? `₹${baseAmount}` : ''}
          </span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-amber-100">
          <span className="text-sm font-bold text-slate-700">Total Amount</span>
          <span className="text-lg font-black text-amber-700">₹{totalAmount}</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <button
        onClick={handlePay}
        disabled={loading}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold shadow-lg shadow-amber-500/25 hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            Processing...
          </span>
        ) : (
          `Pay ₹${totalAmount} Now`
        )}
      </button>

      <p className="text-xs text-center text-amber-600 mt-3">
        Secure payment powered by Razorpay
      </p>
    </div>
  );
};

export default PaymentGateway;
