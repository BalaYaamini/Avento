const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');


// Load env variables
dotenv.config();

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

// Serve client static files in production
const path = require('path');
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
app.listen(PORT, () => {
  console.log(`🚀 AVENTO Server is running on port ${PORT}`);
});
