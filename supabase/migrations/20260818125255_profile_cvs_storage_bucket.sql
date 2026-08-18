-- CV files move from Cloudinary to Supabase Storage.
--
-- Until now profile_cvs.storage_path held a Cloudinary CDN URL: the bytes
-- lived outside this project entirely, behind a second vendor's credentials,
-- on a public raw-asset URL that RLS had no say over. Anyone who saw the URL
-- had the CV. This migration creates the private bucket that replaces it;
-- from here storage_path holds an OBJECT KEY inside that bucket:
--
--     <profileId>/<cvId>-<safeFileName>
--
-- The profile id is the literal FIRST path segment on purpose — the policies
-- below read it back with (storage.foldername(name))[1] to decide who may
-- touch the object, so this layout is part of the access-control contract,
-- not a formatting choice. lib/supabase/storage.ts's cvObjectPath() is the
-- only thing that builds it. All 22 seeded profile_cvs rows already carry
-- paths in exactly this shape, so this migration makes no data changes; the
-- one real Cloudinary-hosted CV in the live data is moved separately by the
-- one-off scripts/migrateCloudinaryCvsToStorage.cjs (run once, then deleted).
--
-- Three overlapping layers, the same defense-in-depth shape as
-- 20260813075322_user_activities.sql:
--   1. The bucket is PRIVATE (public = false) — no unauthenticated object URL
--      exists at all. Reads are short-lived signed URLs or authenticated
--      downloads, both gated by policy 2 below.
--   2. storage.objects RLS mirrors the EXISTING profile_cvs table policies
--      (from 20260812100000_multi_tenant_rls_scoping.sql) exactly: INSERT/
--      DELETE require is_privileged_in(organization_id) — org-scoped Admin
--      or BD Manager, matching profile_cvs_insert/_update; SELECT
--      additionally admits the profile's assigned owner, matching
--      profile_cvs_select. The file and its metadata row can never disagree
--      about who may see them.
--   3. Bucket-level file_size_limit + allowed_mime_types mirror
--      CV_HARD_MAX_BYTES / CV_HARD_ALLOWED_MIME_TYPES in
--      lib/services/profiles.ts, so a bypassed or regressed app-layer check
--      still cannot land an oversized or wrong-type file in the bucket.
--
-- RLS on storage.objects is ALREADY ENABLED by the Supabase platform
-- (verified live: pg_class.relrowsecurity = true on storage.objects) and the
-- table is owned by supabase_storage_admin, not this migration's role — this
-- migration must not, and does not, try to enable it.
--
-- Verified empirically before writing this file (not assumed): the
-- migration role can create policies on storage.objects despite not being a
-- member of supabase_storage_admin — tested via a real CREATE POLICY inside
-- a rolled-back transaction against the linked project. The bucket insert
-- and all three policies below applied cleanly in that dry run.
--
-- NOT DONE HERE, deliberately: anon's blanket grants on storage.objects
-- (pre-existing platform defaults, granted by supabase_storage_admin when
-- the storage schema was installed — the same shape 20260812120000's
-- comment describes for public tables it COULD revoke) are left alone; this
-- migration's role doesn't own storage.objects and can't revoke them. anon
-- gets no policy on this bucket below, so RLS masks every row regardless —
-- "masked, not granted," the same posture that migration treated as not an
-- active leak.
--
-- Additive migration (no reset required): apply with `npm run migrate:up`.

-- ---------------------------------------------------------------------------
-- Bucket
--
-- Upsert-shaped so re-applying this migration re-asserts the limits rather
-- than failing on the existing row.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-cvs',
  'profile-cvs',
  false,
  10485760, -- 10 MiB — same ceiling as CV_HARD_MAX_BYTES
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

-- ---------------------------------------------------------------------------
-- storage.objects policies for this bucket
--
-- Shape notes:
--   * The profile id segment is compared as TEXT (p.id::text = segment)
--     rather than casting the segment to uuid. A policy on storage.objects is
--     evaluated for rows in EVERY bucket, and Postgres does not guarantee the
--     bucket_id predicate short-circuits before the cast — a future bucket
--     with a non-uuid first folder would make `segment::uuid` raise instead
--     of returning false. Text comparison cannot raise. cvObjectPath() emits
--     the canonical lowercase uuid so the two sides always match.
--   * public.is_privileged_in is SECURITY DEFINER with a pinned search_path
--     and is already granted to authenticated (migration
--     20260812100000_multi_tenant_rls_scoping.sql); schema-qualified here
--     because a storage.objects policy runs with the storage API's
--     search_path, not this project's.
--   * deleted_at is intentionally not checked, matching
--     profile_cvs_select/_insert/_update: archiving is filtered by the app's
--     reads, not by RLS.
--   * No UPDATE policy — nothing upserts an existing object. Same rule as
--     20260812110000_trim_rls_to_tenant_tables.sql: the verbs granted are the
--     verbs the app actually issues (insert on upload, select on download /
--     signed-URL generation, delete on CV delete and on failed-insert
--     cleanup).
-- ---------------------------------------------------------------------------

-- Read (download + createSignedUrl). Mirrors profile_cvs_select: privileged
-- in the owning profile's org, or the user that profile is assigned to.
create policy profile_cvs_objects_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'profile-cvs'
    and exists (
      select 1
      from public.profiles p
      where p.id::text = (storage.foldername(name))[1]
        and (
          public.is_privileged_in(p.organization_id)
          or p.user_id = auth.uid()
        )
    )
  );

-- Write. Mirrors profile_cvs_insert: profile managers only — the assigned
-- user owns the profile but does not upload to it.
create policy profile_cvs_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-cvs'
    and exists (
      select 1
      from public.profiles p
      where p.id::text = (storage.foldername(name))[1]
        and public.is_privileged_in(p.organization_id)
    )
  );

-- Delete. The profile_cvs ROW is only ever soft-deleted (no delete policy, no
-- delete grant — job_profile_matches FKs depend on it), but the FILE is
-- really removed: on CV delete, and when a failed row insert would otherwise
-- orphan a freshly uploaded object. Same audience as insert.
create policy profile_cvs_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profile-cvs'
    and exists (
      select 1
      from public.profiles p
      where p.id::text = (storage.foldername(name))[1]
        and public.is_privileged_in(p.organization_id)
    )
  );
