#!/usr/bin/env node
// ONE-OFF: moves the Cloudinary-hosted CV files into the Supabase Storage
// `profile-cvs` bucket and rewrites profile_cvs.storage_path from the CDN URL
// to the object key. DELETE THIS FILE once it has run and been verified — it
// is a migration step, not a maintained tool.
//
// Prereq: the profile_cvs storage bucket migration is applied (npm run migrate:up).
// Usage:  node scripts/migrateCloudinaryCvsToStorage.cjs [--dry-run]
//
// Service-role client on purpose: this is a one-off operator task with no
// user session, the same carve-out lib/supabase/admin.ts describes for cron.
//
// Scoped to deleted_at is null — soft-deleted profile_cvs rows already had
// their Cloudinary assets destroyed by deleteProfileCv at delete time, so
// there is nothing left to move for them, and every read filters deleted_at
// anyway.

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: '.env.local' });
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient } = require('@supabase/supabase-js');

const BUCKET = 'profile-cvs';
const DRY_RUN = process.argv.includes('--dry-run');

// Must stay byte-identical to cvObjectPath() in lib/supabase/storage.ts — the
// storage.objects policies read the first path segment back as the profile id.
function cvObjectPath(profileId, cvId, fileName) {
  const safeFileName = fileName.replace(/[^a-z0-9._-]/gi, '_');
  return `${profileId.toLowerCase()}/${cvId}-${safeFileName}`;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY in .env.local');
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: rows, error } = await supabase
    .from('profile_cvs')
    .select('id, profile_id, file_name, file_type, storage_path')
    .is('deleted_at', null)
    .like('storage_path', 'https://res.cloudinary.com/%');

  if (error) {
    console.error('Could not list Cloudinary-hosted CVs:', error.message);
    process.exit(1);
  }
  if (rows.length === 0) {
    console.log('Nothing to migrate.');
    return;
  }

  let migrated = 0;
  for (const row of rows) {
    const path = cvObjectPath(row.profile_id, row.id, row.file_name);
    console.log(`\nCV ${row.id}\n  from ${row.storage_path}\n  to   ${BUCKET}/${path}`);
    if (DRY_RUN) continue;

    const response = await fetch(row.storage_path);
    if (!response.ok) {
      console.error(`  FAILED download (HTTP ${response.status}) — skipped`);
      continue;
    }
    const bytes = Buffer.from(await response.arrayBuffer());

    // upsert: a re-run overwrites the object instead of 409-ing, so the
    // script is idempotent even if a previous run died between upload and
    // the row update below. contentType is required — a Buffer body would
    // otherwise be stored as text/plain and rejected by the bucket's
    // allowed_mime_types.
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: row.file_type,
      cacheControl: '3600',
      upsert: true,
    });
    if (uploadError) {
      console.error(`  FAILED upload — ${uploadError.message}`);
      continue;
    }

    const { error: updateError } = await supabase
      .from('profile_cvs')
      .update({ storage_path: path })
      .eq('id', row.id);
    if (updateError) {
      // Object stays in place and the row still points at Cloudinary, so a
      // re-run retries this CV cleanly.
      console.error(`  FAILED storage_path update — ${updateError.message}`);
      continue;
    }

    console.log(`  OK (${bytes.length} bytes)`);
    migrated++;
  }

  console.log(`\n${migrated}/${rows.length} migrated.`);
  if (migrated !== rows.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
