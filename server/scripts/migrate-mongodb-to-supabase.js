#!/usr/bin/env node
// server/scripts/migrate-mongodb-to-supabase.js
// One-time script to migrate data from MongoDB to Supabase
// Run: node server/scripts/migrate-mongodb-to-supabase.js
// Requires MONGO_URI and SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env

const mongoose = require('mongoose');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mongoose schemas (read-only, for migration only)
const UserSchema = new mongoose.Schema({
  _id: String,
  name: String,
  email: String,
  role: String,
  isVerified: Boolean,
}, { timestamps: true, collection: 'users' });

const OtpSchema = new mongoose.Schema({
  email: String,
  otp: String,
  createdAt: { type: Date, default: Date.now, expires: 300 },
}, { collection: 'otps' });

const AnnouncementSchema = new mongoose.Schema({
  title: String,
  message: String,
  imageUrl: String,
  audience: String,
  status: String,
  eventId: String,
  eventName: String,
  authorId: String,
  authorName: String,
}, { timestamps: true, collection: 'announcements' });

const AnnouncementReadSchema = new mongoose.Schema({
  userId: String,
  announcementId: String,
}, { timestamps: true, collection: 'announcementreads' });

const ProblemStatementDocSchema = new mongoose.Schema({
  eventId: String,
  pdfUrl: String,
  fileName: String,
  updatedAt: Date,
}, { collection: 'problem_statement_documents' });

async function migrate() {
  console.log('=== MongoDB → Supabase Migration Script ===\n');

  // Connect to MongoDB
  console.log('[1/6] Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'avento' });
  console.log('  Connected.\n');

  const User = mongoose.model('User', UserSchema);
  const Announcement = mongoose.model('Announcement', AnnouncementSchema);
  const AnnouncementRead = mongoose.model('AnnouncementRead', AnnouncementReadSchema);
  const ProblemStatementDoc = mongoose.model('ProblemStatementDoc', ProblemStatementDocSchema);

  // 2. Migrate role updates from MongoDB users to Supabase profiles
  console.log('[2/6] Syncing user roles from MongoDB → Supabase profiles...');
  const mongoUsers = await User.find({});
  let roleUpdated = 0;
  for (const mu of mongoUsers) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', mu._id)
        .maybeSingle();

      if (profile && profile.role !== mu.role) {
        await supabase.from('profiles').update({ role: mu.role }).eq('id', mu._id);
        roleUpdated++;
      } else if (!profile) {
        // Profile missing in Supabase — create one
        await supabase.from('profiles').upsert({
          id: mu._id,
          email: mu.email,
          name: mu.name,
          role: mu.role,
          created_at: mu.createdAt || new Date().toISOString(),
        }, { onConflict: 'id' });
        roleUpdated++;
      }
    } catch (e) {
      console.warn(`  Skip user ${mu.email}: ${e.message}`);
    }
  }
  console.log(`  Synced/created ${roleUpdated} profiles.\n`);

  // 3. Migrate announcements
  console.log('[3/6] Migrating announcements...');
  const announcements = await Announcement.find({}).lean();
  let annMigrated = 0;
  for (const ann of announcements) {
    try {
      await supabase.from('announcements').upsert({
        id: ann._id,
        title: ann.title,
        message: ann.message,
        image_url: ann.imageUrl || '',
        audience: ann.audience || 'all',
        status: ann.status || 'published',
        event_id: ann.eventId || '',
        event_name: ann.eventName || '',
        author_id: ann.authorId || '',
        author_name: ann.authorName || 'Administrator',
        created_at: ann.createdAt || new Date().toISOString(),
        updated_at: ann.updatedAt || new Date().toISOString(),
      }, { onConflict: 'id' });
      annMigrated++;
    } catch (e) {
      console.warn(`  Skip announcement "${ann.title}": ${e.message}`);
    }
  }
  console.log(`  Migrated ${annMigrated}/${announcements.length} announcements.\n`);

  // 4. Migrate announcement reads
  console.log('[4/6] Migrating announcement reads...');
  const reads = await AnnouncementRead.find({}).lean();
  let readMigrated = 0;
  // Batch insert in chunks of 500
  const READ_BATCH = 500;
  for (let i = 0; i < reads.length; i += READ_BATCH) {
    const batch = reads.slice(i, i + READ_BATCH).map(r => ({
      user_id: r.userId,
      announcement_id: r.announcementId,
    }));
    const { error } = await supabase.from('announcement_reads').upsert(batch, { onConflict: 'user_id,announcement_id' });
    if (error) {
      console.warn(`  Batch ${Math.floor(i / READ_BATCH) + 1} warning: ${error.message}`);
    } else {
      readMigrated += batch.length;
    }
  }
  console.log(`  Migrated ${readMigrated}/${reads.length} announcement reads.\n`);

  // 5. Migrate problem statement documents
  console.log('[5/6] Migrating problem statement documents...');
  const psDocs = await ProblemStatementDoc.find({}).lean();
  let psMigrated = 0;
  for (const doc of psDocs) {
    try {
      await supabase.from('problem_statement_documents').upsert({
        event_id: doc.eventId,
        pdf_url: doc.pdfUrl,
        file_name: doc.fileName,
        updated_at: doc.updatedAt || new Date().toISOString(),
      }, { onConflict: 'event_id' });
      psMigrated++;
    } catch (e) {
      console.warn(`  Skip PS doc for event ${doc.eventId}: ${e.message}`);
    }
  }
  console.log(`  Migrated ${psMigrated}/${psDocs.length} problem statement documents.\n`);

  // 6. Summary
  console.log('[6/6] Migration complete!');
  console.log(`  Users (roles synced): ${roleUpdated}`);
  console.log(`  Announcements: ${annMigrated}`);
  console.log(`  Announcement reads: ${readMigrated}`);
  console.log(`  Problem statement docs: ${psMigrated}`);
  console.log('\nYou can now safely remove MONGO_URI from .env and deploy.');

  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
