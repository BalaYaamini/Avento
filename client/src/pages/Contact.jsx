import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Contact = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.fullName || user?.name || '',
    email: user?.email || '',
    subject: '',
    message: ''
  });
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.fullName || user.name || prev.name,
        email: user.email || prev.email
      }));
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    
    try {
      await axios.post('/api/users/contact', formData);
      setStatus('success');
      setFormData(prev => ({ ...prev, subject: '', message: '' }));
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const contactCards = [
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      title: 'Office Location',
      line1: 'Sreenidhi University',
      line2: 'Yamnampet'
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      title: 'Email Address',
      line1: 'admin.avento@gmail.com',
      line2: 'Response time: < 24 Hours'
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: 'Support Hours',
      line1: 'Monday - Friday',
      line2: '09:00 AM - 05:00 PM'
    }
  ];

  return (
    <div className="flex-grow py-20 text-slate-700">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-16 animate-fade-in-up">
          <span className="inline-flex items-center gap-2 text-[10px] font-bold px-4 py-1.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 uppercase tracking-[0.15em] mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
            Contact Support
          </span>
          <h1 className="font-display text-4xl sm:text-5xl font-black text-text-primary mt-4 mb-5 tracking-tight">
            Get in Touch with <span className="heading-gradient">Organizers</span>
          </h1>
          <p className="font-body text-slate-600 max-w-2xl mx-auto text-lg leading-relaxed">
            Having trouble registering? Want to request coordinator access for a student club? Send a request to our administrative support team.
          </p>
        </div>

        {/* Support Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
          {contactCards.map((card, i) => (
            <div 
              key={i} 
              className="animate-fade-in-up glass-panel glass-panel-hover p-6 rounded-2xl flex items-start gap-4 group"
              style={{ animationDelay: `${i * 100 + 100}ms` }}
            >
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-500/15 to-pink-500/15 text-violet-400 flex items-center justify-center flex-shrink-0 border border-violet-500/15 group-hover:shadow-lg group-hover:shadow-violet-500/10 transition-all duration-300 group-hover:scale-110">
                {card.icon}
              </div>
              <div>
                <h4 className="text-sm font-display font-bold text-text-primary">{card.title}</h4>
                <p className="text-xs font-body text-slate-600 mt-1.5">{card.line1}</p>
                <p className="text-xs font-body text-slate-600 mt-0.5">{card.line2}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Contact Form */}
        <div className="animate-fade-in-up delay-400 glass-panel rounded-2xl p-8 max-w-2xl mx-auto">
          <h3 className="text-lg font-display font-bold text-text-primary mb-6">Send a Message</h3>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2" htmlFor="name">Full Name</label>
                <input
                  type="text"
                  id="name"
                  required
                  readOnly={!!user}
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Student Name"
                  className={`w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300 ${user ? 'opacity-70 cursor-not-allowed' : ''}`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2" htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  required
                  readOnly={!!user}
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="student@university.edu"
                  className={`w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300 ${user ? 'opacity-70 cursor-not-allowed' : ''}`}
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2" htmlFor="subject">Subject</label>
              <input
                type="text"
                id="subject"
                required
                value={formData.subject}
                onChange={handleChange}
                placeholder="Registration Issue / Club Registration request"
                className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2" htmlFor="message">Message</label>
              <textarea
                id="message"
                required
                rows={4}
                value={formData.message}
                onChange={handleChange}
                placeholder="Type your message here..."
                className="w-full bg-white/60 text-slate-800 border border-slate-300/50 rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:border-violet-500/60 transition-all duration-300 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={status === 'sending'}
              className={`w-full py-3 rounded-xl text-sm font-display font-bold text-white disabled:opacity-50 transition-all duration-300 ${
                status === 'success' 
                  ? 'bg-emerald-600 shadow-lg shadow-emerald-500/20' 
                  : status === 'error'
                  ? 'bg-red-500 shadow-lg shadow-red-500/20'
                  : 'btn-primary shadow-lg shadow-violet-500/15'
              }`}
            >
              {status === 'sending' ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Sending Message...
                </span>
              ) : status === 'success' ? '✓ Your message has been sent successfully.' : status === 'error' ? 'Failed to send message. Please try again.' : 'Send Support Ticket'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default Contact;
