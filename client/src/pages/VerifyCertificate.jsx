import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

const VerifyCertificate = () => {
  const { certificateId } = useParams();
  const [loading, setLoading] = useState(true);
  const [certData, setCertData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    const fetchVerification = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await axios.get(`/api/certificates/verify/${certificateId}`, {
          headers: { Authorization: '' }
        });
        if (res.data && res.data.valid) {
          setCertData(res.data);
        } else {
          setErrorMsg(res.data?.message || 'Certificate not found or is no longer valid.');
        }
      } catch (err) {
        setErrorMsg(err.response?.data?.message || 'Certificate not found or is no longer valid.');
      } finally {
        setLoading(false);
      }
    };

    if (certificateId) {
      fetchVerification();
    } else {
      setLoading(false);
      setErrorMsg('No Certificate ID provided.');
    }
  }, [certificateId]);

  return (
    <div className="min-h-screen py-16 px-4 flex items-center justify-center relative overflow-hidden">
      {/* Background Glow Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="w-full max-w-xl relative z-10">
        
        {/* Header Branding */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 group">
            <span className="text-2xl font-black tracking-tight text-slate-800 font-heading">
              AVENTO<span className="text-indigo-600">.</span>
            </span>
          </Link>
          <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mt-1">
            Official Public Certificate Verification
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-12 text-center shadow-xl">
            <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-800">Verifying Certificate...</h3>
            <p className="text-sm text-slate-500 mt-1">Checking secure database record for ID: <span className="font-mono text-indigo-600 font-medium">{certificateId}</span></p>
          </div>
        )}

        {/* Valid Certificate State */}
        {!loading && certData && (
          <div className="bg-white/90 backdrop-blur-xl border border-emerald-200/80 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-emerald-500/5 transition-all animate-fade-in-up">
            
            {/* Status Header */}
            <div className="flex flex-col items-center text-center pb-6 border-b border-slate-100 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center text-3xl font-extrabold shadow-sm mb-3">
                ✓
              </div>
              <h1 className="text-2xl font-black text-emerald-600 font-heading">
                Certificate Verified
              </h1>
              <span className="mt-2 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider rounded-full">
                Status: {certData.status || 'Valid'}
              </span>
            </div>

            {/* Certificate Meta Details Grid */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-100/80 gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Certificate ID</span>
                <span className="text-sm font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg w-fit">
                  {certData.certificateId || certificateId}
                </span>
              </div>

              {certData.certificateType && (
                <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-100/80 gap-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Certificate Type</span>
                  <span className="text-sm font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg w-fit">
                    {certData.certificateType} Certificate
                  </span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-100/80 gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {certData.certificateType === 'Organizer' ? 'Organizer Name' : 'Participant Name'}
                </span>
                <span className="text-sm font-bold text-slate-800">
                  {certData.studentName}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-100/80 gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Event Name</span>
                <span className="text-sm font-semibold text-slate-800 text-right sm:max-w-xs">
                  {certData.eventName}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-100/80 gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Event Date</span>
                <span className="text-sm font-medium text-slate-700">
                  {certData.eventDate}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-100/80 gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Issuing Organization</span>
                <span className="text-sm font-medium text-slate-700">
                  {certData.issuingOrganization}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-100/80 gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Status</span>
                <span className="text-sm font-bold text-emerald-600">
                  {certData.status || 'Valid'}
                </span>
              </div>

              {certData.issuedAt && (
                <div className="flex flex-col sm:flex-row sm:justify-between py-2 gap-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Issued On</span>
                  <span className="text-sm font-mono text-slate-600">
                    {new Date(certData.issuedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {/* Verification Footer Note */}
            <div className="mt-8 pt-4 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-400">
                This record was verified against the official AVENTO database.
              </p>
            </div>
          </div>
        )}

        {/* Invalid Certificate State */}
        {!loading && errorMsg && (
          <div className="bg-white/90 backdrop-blur-xl border border-red-200/80 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-red-500/5 text-center transition-all animate-fade-in-up">
            <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center text-3xl font-extrabold shadow-sm mx-auto mb-4">
              ✕
            </div>
            <h1 className="text-2xl font-black text-red-600 font-heading mb-2">
              Certificate Invalid
            </h1>
            <p className="text-sm text-slate-600 mb-6 font-medium">
              {errorMsg}
            </p>
            <div className="inline-block bg-slate-100 px-4 py-2 rounded-xl text-xs font-mono text-slate-500 border border-slate-200">
              Query ID: {certificateId}
            </div>
            <div className="mt-8 pt-4 border-t border-slate-100">
              <p className="text-[11px] text-slate-400">
                If you believe this is an error, please contact the event organizer or administrator.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default VerifyCertificate;
