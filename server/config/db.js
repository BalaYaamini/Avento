// server/config/db.js
// MongoDB has been removed. This file is kept as a no-op for backwards compatibility.
// All data is now stored in Supabase (PostgreSQL).
const connectDB = async () => {
  console.log('[DB] MongoDB removed — using Supabase only.');
};

module.exports = connectDB;
