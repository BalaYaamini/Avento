import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { CertificateDoodle, SparkleDoodle, StarDoodle, CloudDoodle } from '../components/Doodles';
import FeedbackModal from '../components/FeedbackModal';

const StudentCertificates = () => {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedbackCert, setFeedbackCert] = useState(null);

  const fetchCertificates = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/certificates/my-certificates');
      setCertificates(res.data);
    } catch (err) {
      console.error('Error fetching certificates', err);
      setError('Failed to load certificates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertificates();
  }, []);

  const getFullPdfUrl = (urlPath) => {
    if (!urlPath) return '';
    if (urlPath.startsWith('http')) return urlPath;
    if (axios.defaults.baseURL) {
      const base = axios.defaults.baseURL.replace(/\/$/, '');
      const path = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
      return `${base}${path}`;
    }
    return urlPath;
  };

  return (
    <div className="flex-grow overflow-hidden bg-background transition-colors duration-300 min-h-screen relative">
      
      {/* Decorative Background Elements */}
      <CloudDoodle className="absolute top-20 left-10 w-16 h-16 text-pastel-blue/40 mix-blend-multiply animate-float-slow hidden md:block" />
      <StarDoodle className="absolute top-32 right-1/4 w-8 h-8 text-pastel-yellow mix-blend-multiply animate-pulse hidden sm:block" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-pastel-lavender/20 mix-blend-multiply blur-[100px] rounded-full pointer-events-none" />

      <div className="pt-24 pb-12 px-6 lg:px-12 max-w-7xl mx-auto relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-black text-text-primary">
              My <span className="text-gradient-primary">Certificates</span>
            </h1>
            <p className="font-body text-text-secondary mt-2 text-sm md:text-base max-w-2xl">
              View and download your earned certificates for completed events.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pastel-lavender"></div>
          </div>
        ) : error ? (
          <div className="text-center py-24 scrapbook-panel rounded-[2rem]">
            <h3 className="text-xl font-bold text-pastel-coral mb-2">Oops!</h3>
            <p className="text-text-secondary">{error}</p>
          </div>
        ) : certificates.length === 0 ? (
          <div className="text-center py-24 scrapbook-panel max-w-lg mx-auto animate-fade-in-scale rotate-1 relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 tape tape-1 !w-32"></div>
            <div className="h-20 w-20 bg-pastel-yellow/20 rounded-3xl flex items-center justify-center mx-auto text-yellow-600 mb-5 relative">
              <CertificateDoodle className="h-10 w-10 text-pastel-yellow" />
              <SparkleDoodle className="absolute -top-2 -right-2 w-6 h-6 text-pastel-coral animate-pulse" />
            </div>
            <h3 className="text-2xl font-bold text-text-primary mb-2 font-heading">No Certificates Yet</h3>
            <p className="text-sm font-body text-text-secondary">Register and attend events to earn certificates.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {certificates.map((cert) => (
              <div key={cert.id} className="scrapbook-panel scrapbook-panel-hover overflow-hidden relative group">
                {/* Decorative element */}
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-pastel-lavender/20 rounded-full blur-xl group-hover:bg-pastel-lavender/30 transition-colors duration-500"></div>
                
                <div className="p-6 md:p-8 relative z-10 flex flex-col h-full">
                  <div className="mb-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider ${
                      cert.certificate_type === 'organizer' 
                        ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                        : 'bg-pastel-lavender/10 text-pastel-lavender border border-pastel-lavender/20'
                    }`}>
                      <StarDoodle className="w-3 h-3" />
                      {cert.certificate_type === 'organizer' ? 'Organizer Certificate' : (cert.eventId?.category || 'Event')}
                    </span>
                  </div>
                  
                  <h3 className="text-xl font-display font-bold text-text-primary mb-2 line-clamp-2">{cert.eventId?.title}</h3>
                  
                  <div className="text-sm text-text-secondary mb-4 flex-grow">
                    <span className="block font-semibold mb-1">Issued On:</span>
                    {new Date(cert.issued_at).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                  
                  <div className="text-xs font-mono text-text-secondary/70 mb-6 bg-slate-50 dark:bg-[#0F172A] border border-slate-200 p-2.5 rounded-xl break-all">
                    ID: {cert.certificate_id}
                  </div>
                  
                  {cert.feedback_submitted ? (
                    <a
                      href={getFullPdfUrl(cert.certificate_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center w-full btn-primary px-6 py-3 text-sm font-display font-bold rounded-xl text-white"
                    >
                      Download Certificate
                    </a>
                  ) : (
                    <button
                      onClick={() => setFeedbackCert(cert)}
                      className="block text-center w-full bg-amber-500 hover:bg-amber-600 px-6 py-3 text-sm font-display font-bold rounded-xl text-white shadow-md shadow-amber-500/20 transition-all"
                    >
                      Submit Feedback to Download
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Feedback Modal for downloading certificate after event */}
      {feedbackCert && (
        <FeedbackModal
          isOpen={Boolean(feedbackCert)}
          onClose={() => setFeedbackCert(null)}
          event={{
            id: feedbackCert.event_id || feedbackCert.eventId?.id || feedbackCert.eventId?._id,
            title: feedbackCert.eventId?.title || 'Event Feedback',
            feedback_questions: feedbackCert.eventId?.feedback_questions
          }}
          onSubmitSuccess={() => {
            setFeedbackCert(null);
            fetchCertificates();
          }}
        />
      )}
    </div>
  );
};

export default StudentCertificates;
