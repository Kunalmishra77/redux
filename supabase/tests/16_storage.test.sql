-- §5 storage · buckets and object policies · CLAUDE.md rules 8, 9.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select is((select count(*)::int from storage.buckets where id in
  ('survey-photos','handover-photos','documents','call-recordings','signatures','brand')), 6, 'the six buckets exist');
select is((select count(*)::int from storage.buckets where public and id <> 'brand'
  and id in ('survey-photos','handover-photos','documents','call-recordings','signatures')), 0, 'every bucket but brand is private');
select is((select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects'
  and policyname in ('survey_photos_insert','survey_photos_select','handover_photos_insert_obj','handover_photos_select_obj',
                     'documents_select','call_recordings_select','signatures_insert','signatures_select','brand_write')
  and cmd in ('UPDATE','DELETE')), 0, 'rule 9: no update or delete policy — stored photos and documents are immutable');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'surveyor1@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'surveyor2@test.local'),
  ('00000000-0000-0000-0000-0000000000d1', 'customer@test.local');
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-0000000000b1', 'Surveyor One'), ('00000000-0000-0000-0000-0000000000b2', 'Surveyor Two');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000b1', 'surveyor'), ('00000000-0000-0000-0000-0000000000b2', 'surveyor');
insert into public.customers (id, name, type, is_prospect, converted_at) values ('30000000-0000-0000-0000-0000000000f1', 'Photo Hotel', 'hotel', false, now());
insert into public.properties (id, customer_id, name, address) values ('31000000-0000-0000-0000-0000000000f1', '30000000-0000-0000-0000-0000000000f1', 'Photo Hotel', 'MG Road');
insert into public.surveys (id, property_id, surveyor_id, scheduled_at, slot_end_at, status) values
  ('32000000-0000-0000-0000-0000000000f1', '31000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b1', now(), now() + interval '2 hours', 'in_progress'),
  ('32000000-0000-0000-0000-0000000000f2', '31000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b1', now() - interval '3 days', now() - interval '3 days' + interval '2 hours', 'submitted');
insert into public.fitting_types (id, code, name) values ('33000000-0000-0000-0000-0000000000f1', 'test_photo_mixer', 'Test mixer') on conflict do nothing;
insert into public.fittings (id, survey_id, fitting_type_id, unit_label, idem_key, captured_at) values
  ('34000000-0000-0000-0000-0000000000f1', '32000000-0000-0000-0000-0000000000f1', '33000000-0000-0000-0000-0000000000f1', '101', 'test-storage-f1', now()),
  ('34000000-0000-0000-0000-0000000000f2', '32000000-0000-0000-0000-0000000000f2', '33000000-0000-0000-0000-0000000000f1', '101', 'test-storage-f2', now());

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000b1","user_role":"surveyor"}';
select lives_ok($$ insert into storage.objects (bucket_id, name) values
  ('survey-photos', 'surveys/32000000-0000-0000-0000-0000000000f1/34000000-0000-0000-0000-0000000000f1/front/aaa.jpg') $$,
  'D7-06: the assigned surveyor uploads to their open visit');
select throws_ok($$ insert into storage.objects (bucket_id, name) values
  ('survey-photos', 'surveys/32000000-0000-0000-0000-0000000000f2/34000000-0000-0000-0000-0000000000f2/front/bbb.jpg') $$,
  '42501', null, 'BR-S6: a submitted visit takes no more photos');
select throws_ok($$ insert into storage.objects (bucket_id, name) values
  ('survey-photos', 'surveys/32000000-0000-0000-0000-0000000000f1/34000000-0000-0000-0000-0000000000f2/front/ccc.jpg') $$,
  '42501', null, 'a photo cannot be parked under a fitting of another visit');
select is((select count(*)::int from storage.objects where bucket_id = 'survey-photos' and name like 'surveys/32000000-0000-0000-0000-0000000000f1/%'), 1,
  'rule 8: the surveyor can confirm the upload landed');
update storage.objects set name = name || '.x' where bucket_id = 'survey-photos' and name like 'surveys/32000000-0000-0000-0000-0000000000f1/%';
reset role;
select is((select count(*)::int from storage.objects where bucket_id = 'survey-photos' and name = 'surveys/32000000-0000-0000-0000-0000000000f1/34000000-0000-0000-0000-0000000000f1/front/aaa.jpg'), 1,
  'rule 9: a user cannot rename a stored photo (no update policy)');

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000b2","user_role":"surveyor"}';
select throws_ok($$ insert into storage.objects (bucket_id, name) values
  ('survey-photos', 'surveys/32000000-0000-0000-0000-0000000000f1/34000000-0000-0000-0000-0000000000f1/side/ddd.jpg') $$,
  '42501', null, 'another surveyor cannot upload to this visit');
select is((select count(*)::int from storage.objects where bucket_id = 'survey-photos' and name like 'surveys/32000000-0000-0000-0000-0000000000f1/%'), 0,
  'another surveyor cannot see its photos');

set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000d1","user_role":"customer"}';
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('brand', 'logo.png') $$,
  '42501', null, 'only the admin writes brand assets');

select * from finish();
rollback;
