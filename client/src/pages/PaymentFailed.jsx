import { useNavigate, useSearchParams } from 'react-router-dom';

const PaymentFailed = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
      <div className="text-center p-8 max-w-md">
        <div className="h-20 w-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-3">Payment Failed</h2>
        <p className="text-slate-600 mb-2">Your payment was not completed successfully.</p>
        <p className="text-sm text-slate-500 mb-6">Your team is still pending. You can retry the payment from your registrations page.</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate('/my-registrations')}
            className="px-6 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/25"
          >
            Retry Payment
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentFailed;
