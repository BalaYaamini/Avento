const PaymentSection = ({ event, utr, onUtrChange, required = true, rejectionReason }) => {
  const value = utr || '';
  const isValid = /^[A-Z0-9]{12,22}$/i.test(value.trim());

  if (!event?.payment_enabled) return null;

  return (
    <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
      <div>
        <h4 className="text-sm font-bold text-amber-900">Payment Required</h4>
        <p className="mt-1 text-xs text-amber-800">Pay the amount below, then enter the transaction UTR to confirm your team.</p>
      </div>
      {rejectionReason && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">Previous UTR rejected: {rejectionReason}</div>}
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        {event.payment_qr_url && (
          <img src={event.payment_qr_url} alt="Payment QR code" className="h-40 w-40 rounded-xl border border-amber-200 bg-white object-contain p-2" />
        )}
        <div className="space-y-2 text-xs text-amber-900">
          <p><strong>Amount:</strong> Rs. {Number(event.payment_amount || 0).toFixed(2)}</p>
          {event.payment_upi_id && <p><strong>UPI ID:</strong> {event.payment_upi_id}</p>}
          {event.payment_instructions && <p className="whitespace-pre-wrap">{event.payment_instructions}</p>}
        </div>
      </div>
      <div>
        <label className="mb-2 block text-xs font-bold text-amber-900">UTR / Transaction Reference {required && <span className="text-red-600">*</span>}</label>
        <input
          value={value}
          required={required}
          maxLength={22}
          onChange={(e) => onUtrChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          placeholder="Enter 12-22 character UTR"
          className="w-full rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm text-slate-800 focus:border-amber-500 focus:outline-none"
        />
        {value && !isValid && <p className="mt-1 text-xs font-semibold text-red-600">UTR must contain 12-22 letters or numbers.</p>}
      </div>
    </div>
  );
};

export const isValidUtr = (utr) => /^[A-Z0-9]{12,22}$/i.test((utr || '').trim());
export default PaymentSection;
