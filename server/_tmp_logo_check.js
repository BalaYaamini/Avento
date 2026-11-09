const { emailBrandHeader } = require('./services/notificationService');
const html = emailBrandHeader('Event Reminder');
const m = html.match(/src="([^"]+)"/);
console.log('IMG URL:', m ? m[1] : 'NONE');
(async () => {
  if (m) {
    try {
      const r = await fetch(m[1]);
      console.log('fetch status:', r.status, r.headers.get('content-type'));
    } catch (e) {
      console.log('fetch error:', e.message);
    }
  }
  process.exit(0);
})();
