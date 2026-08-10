-- profile_cvs — structured parse of each uploaded CV.
--
-- Until now a CV was stored as a file and nothing more: the bytes were
-- pushed to Cloudinary and only metadata landed in this table, so no
-- consumer could read a candidate's skills or history without re-reading
-- the document. These columns hold the parsed result once, per CV, as
-- friendly JSON (top-level `skills`, `experience`, `education`, … — the v1
-- shape is documented in database-schema.md §3.7).
--
-- Parsing is per CV, not per profile, because a profile can carry several
-- CVs and job_profile_matches scores each one separately.
--
-- parse_status is the operational half: a row is inserted 'pending', the
-- parse runs after the upload response, and a failure records why in
-- parse_error rather than blocking the upload. parse_schema_version makes a
-- future format change a targeted re-parse ("where parse_schema_version < 2")
-- instead of a guess about which rows are stale.
--
-- Additive migration (no reset required): apply with `npm run migrate:up`
-- (supabase db push). No grants needed — the seed's blanket grant already
-- covers this table, and table-level grants cover new columns.

alter table public.profile_cvs
  add column parsed_data          jsonb,
  add column parsed_at            timestamptz,
  add column parse_status         text not null default 'pending',
  add column parse_error          text,
  add column parse_model_version  text,
  add column parse_schema_version integer;

alter table public.profile_cvs
  add constraint profile_cvs_parse_status_check
  check (parse_status in ('pending', 'success', 'failed'));

-- A 'success' row that carries no JSON would be indistinguishable from an
-- unparsed one to every reader, so the status and the payload are kept
-- honest at the DB level rather than by convention.
alter table public.profile_cvs
  add constraint profile_cvs_parsed_data_present_on_success
  check (
    parse_status <> 'success'
    or (parsed_data is not null and parsed_at is not null and parse_schema_version is not null)
  );

-- The parse sweep looks for work, never for finished rows, so only the
-- unfinished ones are worth indexing. Existing rows (including the seeded
-- dummy CVs) default to 'pending' and are genuinely unparsed, so they are
-- picked up by the first sweep.
create index idx_profile_cvs_parse_status_pending
  on public.profile_cvs (parse_status)
  where parse_status <> 'success';
