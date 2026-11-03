const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '.env') });
const supabase = require('./config/supabaseClient');

const BUCKET = 'email-assets';
const OBJECT = 'logo-mark-cyan.png';

async function uploadLogo() {
  const filePath = path.resolve(__dirname, '../client/public', OBJECT);
  const body = fs.readFileSync(filePath);
  console.log(`Uploading ${OBJECT} (${body.length} bytes) to public bucket "${BUCKET}"...`);

  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) throw listErr;
  if (!(buckets || []).some(b => b.name === BUCKET)) {
    const { error: createErr } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (createErr) throw createErr;
    console.log(`Created public bucket "${BUCKET}".`);
  }

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(OBJECT, body, { contentType: 'image/png', upsert: true });
  if (upErr) throw upErr;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(OBJECT);
  console.log('Public logo URL:', data.publicUrl);

  const check = await fetch(data.publicUrl);
  console.log('URL check:', check.status, check.headers.get('content-type'));
  if (!check.ok) throw new Error('Public URL is not reachable');
  console.log('Email logo is live.');
  process.exit(0);
}

uploadLogo().catch(err => {
  console.error('Upload failed:', err.message);
  process.exit(1);
});
