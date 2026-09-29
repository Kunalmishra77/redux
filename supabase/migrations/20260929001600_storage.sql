-- §5 storage (04-auth-security-rls.md §5, 05-storage-media.md §1). Six buckets, all private except
-- `brand`. Access is decided by the RECORD the path names: a policy's subquery runs under the
-- caller's own RLS, so "can see the survey" == "can see its photos" — one rule, not two.
--
--   survey-photos    surveys/{survey_id}/{fitting_id}/{slot}/{sha256}.jpg   surveyor writes (own, open visit)
--   handover-photos  jobs/{job_id}/{unit_id}/{sha256}.jpg                   whoever runs the job writes
--   documents        quotes/{id}.pdf · invoices/{id}.pdf                    server writes (service role)
--   call-recordings  calls/{call_id}.mp3                                     server writes; super_admin + the agent read
--   signatures       handovers/{id}.png                                      whoever runs the job writes; staff read
--   brand            logos, site imagery                                     public read; super_admin writes
--
-- No UPDATE or DELETE policy on any private bucket: photos and documents are immutable (CLAUDE.md
-- rule 9, BR-X2). Deletions (DPDP erasure, recording expiry) go through the Storage API with the
-- service role and are logged in storage_deletions.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('survey-photos',   'survey-photos',   false, 5242880,  array['image/jpeg']),
  ('handover-photos', 'handover-photos', false, 5242880,  array['image/jpeg']),
  ('documents',       'documents',       false, 10485760, array['application/pdf']),
  ('call-recordings', 'call-recordings', false, 52428800, array['audio/mpeg','audio/mp4','audio/ogg','audio/wav']),
  ('signatures',      'signatures',      false, 1048576,  array['image/png']),
  ('brand',           'brand',           true,  10485760, null)
on conflict (id) do nothing;

-- ── survey-photos ──────────────────────────────────────────────────────────────
-- D7-06 / BR-S6: the assigned surveyor uploads while the visit is open; the path must name a
-- fitting of that survey (no photos parked under someone else's visit).
create policy survey_photos_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'survey-photos'
  and (storage.foldername(name))[1] = 'surveys'
  and exists (select 1 from public.surveys s
              join public.fittings f on f.survey_id = s.id
              where s.id::text = (storage.foldername(name))[2]
                and f.id::text = (storage.foldername(name))[3]
                and s.surveyor_id = (select auth.uid())
                and s.status in ('checked_in','in_progress'))
);
-- read = can see the survey (staff by role, the owning customer via surveys_select_customer). The
-- surveyor app also needs this to confirm an upload landed before deleting the local file (rule 8).
create policy survey_photos_select on storage.objects for select to authenticated
using (
  bucket_id = 'survey-photos'
  and exists (select 1 from public.surveys s where s.id::text = (storage.foldername(name))[2])
);

-- ── handover-photos ────────────────────────────────────────────────────────────
create policy handover_photos_insert_obj on storage.objects for insert to authenticated
with check (
  bucket_id = 'handover-photos'
  and (storage.foldername(name))[1] = 'jobs'
  and exists (select 1 from public.jobs j where j.id::text = (storage.foldername(name))[2]
              and public.can_run_job(j.id))
);
create policy handover_photos_select_obj on storage.objects for select to authenticated
using (
  bucket_id = 'handover-photos'
  and exists (select 1 from public.jobs j where j.id::text = (storage.foldername(name))[2])
);

-- ── documents (PDFs are rendered and written by the server) ────────────────────
create policy documents_select on storage.objects for select to authenticated
using (
  bucket_id = 'documents'
  and (
    ((storage.foldername(name))[1] = 'quotes'
      and exists (select 1 from public.quotations q where q.id::text = split_part(storage.filename(name), '.', 1)))
    or ((storage.foldername(name))[1] = 'invoices'
      and exists (select 1 from public.invoices i where i.id::text = split_part(storage.filename(name), '.', 1)))
  )
);

-- ── call-recordings (5-minute URLs; super_admin and the agent on that call) ─────
create policy call_recordings_select on storage.objects for select to authenticated
using (
  bucket_id = 'call-recordings'
  and ((select public.current_role_is('super_admin'))
       or exists (select 1 from public.calls c
                  where c.id::text = split_part(storage.filename(name), '.', 1)
                    and c.agent_id = (select auth.uid())))
);

-- ── signatures ─────────────────────────────────────────────────────────────────
create policy signatures_insert on storage.objects for insert to authenticated
with check (bucket_id = 'signatures' and (select public.is_staff()));
create policy signatures_select on storage.objects for select to authenticated
using (bucket_id = 'signatures' and (select public.is_staff()));

-- ── brand (public read through the CDN; only the admin changes it) ─────────────
create policy brand_write on storage.objects for insert to authenticated
with check (bucket_id = 'brand' and (select public.current_role_is('super_admin')));
