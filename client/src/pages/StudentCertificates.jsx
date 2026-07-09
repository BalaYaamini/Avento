import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const StudentCertificates = () => {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
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
    <div className="flex-1 bg-slate-50/50">
      <div className="pt-24 pb-12 px-6 lg:px-12 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-black text-text-primary">
              My <span className="heading-gradient text-fuchsia-500">Certificates</span>
            </h1>
            <p className="font-body text-slate-600 mt-2 text-sm md:text-base max-w-2xl">
              View and download your earned certificates for completed events.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-fuchsia-500"></div>
          </div>
        ) : error ? (
          <div className="text-center py-24 glass-panel rounded-2xl">
            <h3 className="text-xl font-bold text-red-500 mb-2">Oops!</h3>
            <p className="text-slate-600">{error}</p>
          </div>
        ) : certificates.length === 0 ? (
          <div className="text-center py-24 glass-panel rounded-2xl animate-fade-in-scale">
            <div className="h-20 w-20 bg-white/50 rounded-2xl flex items-center justify-center mx-auto text-slate-400 mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-display font-bold text-slate-800 mb-2">No Certificates Yet</h3>
            <p className="text-sm font-body text-slate-600">Register and attend events to earn certificates.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {certificates.map((cert) => (
              <div key={cert.id} className="glass-panel rounded-2xl overflow-hidden shadow-lg border border-slate-200/50 hover:shadow-xl transition-shadow duration-300">
                <div className="p-6">
                  <div className="text-xs text-fuchsia-600 font-bold tracking-wider uppercase mb-1">
                    {cert.eventId?.category || 'Event'}
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2 line-clamp-1">{cert.eventId?.title}</h3>
                  <div className="text-sm text-slate-500 mb-4">
                    Issued: {new Date(cert.issued_at).toLocaleDateString()}
                  </div>
                  <div className="text-xs font-mono text-slate-400 mb-6 bg-slate-100 p-2 rounded">
                    ID: {cert.certificate_id}
                  </div>
                  <a
                    href={getFullPdfUrl(cert.certificate_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center w-full bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
                  >
                    Download PDF
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentCertificates;
