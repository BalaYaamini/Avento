import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying');
  const [error, setError] = useState(null);

  const orderId = searchParams.get('order_id');

  useEffect(() => {
    if (!orderId) {
      setStatus('error');
      setError('No order ID found.');
      return;
    }

    const verifyPayment = async () => {
      try {
        const { data } = await axios.get(`/api/payments/order-status/${orderId}`);

        if (data.status === 'paid') {
          setStatus('success');
        } else if (data.status === 'failed') {
          setStatus('failed');
          setError(data.failureReason || 'Payment was not completed.');
        } else {
          // Still processing, check again
          setTimeout(verifyPayment, 2000);
        }
      } catch (err) {
        setStatus('error');
        setError(err.response?.data?.message || 'Failed to verify payment.');
      }
    };

    verifyPayment();
  }, [orderId]);

  if (status === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center p-8">
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Verifying Payment...</h2>
          <p className="text-slate-500">Please wait while we confirm your payment.</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-green-50">
        <div className="text-center p-8 max-w-md">
          <div className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">Payment Successful!</h2>
          <p className="text-slate-600 mb-6">Your team registration has been confirmed. You will receive a confirmation notification shortly.</p>
          <button
            onClick={() => navigate('/my-registrations')}
            className="px-6 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/25"
          >
            View My Registrations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
      <div className="text-center p-8 max-w-md">
        <div className="h-20 w-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-3">Payment Failed</h2>
        <p className="text-slate-600 mb-2">{error || 'Your payment could not be completed.'}</p>
        <p className="text-sm text-slate-500 mb-6">Your team is still pending. Please retry the payment.</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate('/my-registrations')}
            className="px-6 py-3 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 transition-colors"
          >
            Go to Registrations
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
