-- =============================================================================
-- CONSOLIDATED STORAGE — final end-state as of 2026-08-23.
--
-- Contents: the profile-cvs storage bucket, with NO client-facing
-- storage.objects policies. This matches the "security lives at the backend"
-- decision the same way table GRANTs (without RLS) do for public-schema
-- tables — the difference is that storage.objects RLS is force-enabled by
-- the Supabase platform itself and cannot be disabled by this project's
-- migration role, so "no policy" here means deny-all rather than open-all.
--
-- That is the intended, enterprise-standard shape: this mirrors how apps
-- backed by S3/GCS/Azure Blob handle private files when there's no
-- database-level RLS to lean on — the storage credential lives ONLY on the
-- server (here: the Supabase service-role key via lib/supabase/admin.ts),
-- never in a client-held session token, and clients never talk to the
-- storage API directly. A client that wants a file asks the Next.js backend
-- (app/api/profiles/*), which checks authorization in code (org, role,
-- profile ownership — same checks now used for every table) and then either
-- streams the file itself or mints a short-lived signed URL
-- (lib/supabase/storage.ts, CV_DOWNLOAD_URL_TTL_SECONDS) scoped to that one
-- object. `authenticated` and `anon` get zero grants on this bucket, so a
-- client holding only its own session key cannot read, upload, or delete any
-- object here even if it bypassed the app and called Storage directly.
--
-- (Earlier drafts of this migration considered a coarse
-- "authenticated + right bucket" policy as a stand-in for the removed
-- org/role-scoped policies from 20260818125255_profile_cvs_storage_bucket.sql.
-- That was rejected: it would let any authenticated session touch any CV
-- object directly via the Storage API, which is a materially weaker boundary
-- than "no client access at all, backend-mediated." Deny-all + backend-only
-- credential is both simpler and strictly safer, and needs no RLS helper
-- functions to exist.)
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-cvs',
  'profile-cvs',
  false,
  10485760, -- 10 MiB
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- No storage.objects policies for this bucket: authenticated/anon get no
-- grants at all, so RLS (forced on by the platform) defaults to deny-all for
-- them. Only the service-role key (which bypasses storage RLS entirely, same
-- as it bypasses table RLS) can read/write/delete objects here — see
-- lib/supabase/storage.ts and lib/supabase/admin.ts.
drop policy if exists profile_cvs_objects_select on storage.objects;
drop policy if exists profile_cvs_objects_insert on storage.objects;
drop policy if exists profile_cvs_objects_delete on storage.objects;
drop policy if exists profile_cvs_objects_update on storage.objects;
