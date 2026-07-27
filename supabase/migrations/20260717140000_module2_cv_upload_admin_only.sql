-- Revert engineer_cvs/cv-files upload access to Admin-only.
--
-- Originally built as Admin + assigned-BD by analogy to doc 01 §11's
-- "uploads mirror SELECT conditions" example (illustrated there only for
-- the lead-files bucket). On reconsideration this was a deliberate
-- business decision, not a bug fix: the BRD frames engineer-profile/CV
-- curation as an Admin task, and CVs are client-facing documents needing a
-- single point of quality control. Do NOT "fix" this back to Admin+BD
-- without revisiting that decision explicitly — see project memory
-- module2_cv_upload_cleanup_bug.md and the chunk C conversation history.

drop policy engineer_cvs_insert on public.engineer_cvs;

create policy engineer_cvs_insert on public.engineer_cvs
for insert
to authenticated
with check (public.is_admin() and uploaded_by = auth.uid());

drop policy cv_files_insert on storage.objects;

create policy cv_files_insert on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'cv-files'
  and public.is_admin()
);
