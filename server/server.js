const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

// Configure public DNS servers fallback to prevent local ISP/router DNS failures
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

const originalDnsLookup = dns.lookup;
dns.lookup = (hostname, options, callback) => {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  originalDnsLookup(hostname, options, (err, address, family) => {
    if (!err) return callback(null, address, family);
    if (err && (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN')) {
      return dns.resolve4(hostname, (resErr, addresses) => {
        if (!resErr && addresses && addresses.length > 0) {
          if (options && options.all) {
            return callback(null, addresses.map(a => ({ address: a, family: 4 })));
          }
          return callback(null, addresses[0], 4);
        }
        return callback(err, address, family);
      });
    }
    return callback(err, address, family);
  });
};

const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load env variables from server/.env (resolves correctly even when started from project root)
dotenv.config({ path: path.join(__dirname, '.env') });

// Startup verification: confirm critical env vars are loaded
if (!process.env.SUPABASE_URL) {
  console.error('⚠️  CRITICAL: SUPABASE_URL is NOT loaded from .env.');
} else {
  console.log('✅ SUPABASE_URL loaded:', process.env.SUPABASE_URL);
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('⚠️  CRITICAL: SUPABASE_SERVICE_ROLE_KEY is NOT loaded from .env. Supabase writes will fail due to RLS.');
} else {
  const keyPreview = process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 12) + '...';
  console.log('✅ SUPABASE_SERVICE_ROLE_KEY loaded. Key prefix:', keyPreview);
}

// Check database connectivity on startup
const supabase = require('./config/supabaseClient');
(async () => {
  try {
    const { error } = await supabase.from('events').select('id').limit(1);
    if (error) {
      if (error.message && (error.message.includes('fetch failed') || error.message.includes('ENOTFOUND'))) {
        console.error('\n🔴 [Supabase Connection FAILED]');
        console.error('   Could not connect to Supabase database:', process.env.SUPABASE_URL);
        console.error('   👉 If using a free-tier project, it is likely PAUSED due to inactivity.');
        console.error('   👉 Please go to https://supabase.com/dashboard and click "Restore project".\n');
      } else {
        console.warn('⚠️ [Supabase Status]:', error.message);
      }
    } else {
      console.log('✅ Supabase database connection verified successfully.');
    }
  } catch (err) {
    console.error('\n🔴 [Supabase Connection Check Exception]:', err.message);
  }
})();

// Initialize Background Jobs
const startEventCompletionJob = require('./jobs/eventCompletionJob');
startEventCompletionJob();

const startRegistrationClosingJob = require('./jobs/registrationClosingJob');
startRegistrationClosingJob();

const app = express();

// Global Middlewares
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Prevent browser and proxy caching on API routes
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Initialize Supabase integration check (Optional: log initialization)
console.log('⚡ Supabase Client Initialized.');

// Define API routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/announcements', require('./routes/announcementRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/registrations', require('./routes/registrationRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/certificates', require('./routes/certificateRoutes'));
app.use('/api/feedbacks', require('./routes/feedbackRoutes'));
app.use('/api/allocations', require('./routes/allocationRoutes'));
app.use('/api/slots', require('./routes/slotRoutes'));

// Serve client static files in production
const clientBuildPath = path.join(__dirname, '../client/dist');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(clientBuildPath));

// Base route for connectivity verification (fallback to static frontend index for SPA routes)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(clientBuildPath, 'index.html'), (err) => {
    if (err) {
      // If index.html doesn't exist, we allow standard API status fallback on root /
      if (req.path === '/') {
        res.json({ 
          message: 'Welcome to AVENTO – University Event Management Platform API (Frontend not built)',
          status: 'Running'
        });
      } else {
        res.status(404).send('Not Found');
      }
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Express Global Error:', err.stack);
  res.status(500).json({ message: `Express Error: ${err.message}`, error: err.message });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, async () => {
  console.log(`🚀 AVENTO Server is running on port ${PORT}`);

  // Post-startup Supabase connectivity test
  try {
    const supabase = require('./config/supabaseClient');
    const { data, error } = await supabase.from('events').select('id').limit(1);
    if (error) {
      console.error('⚠️  Supabase READ test FAILED:', error.message);
    } else {
      console.log('✅ Supabase READ test passed. Events table accessible.');
    }
  } catch (e) {
    console.error('⚠️  Supabase connectivity test error:', e.message);
  }
});
