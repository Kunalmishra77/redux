-- Local / CI fixtures only. Never runs against a hosted project.
-- Reference data (work types, condition flags, lost reasons, settings) is seeded by the
-- migrations, not here. Idempotent.

insert into public.cities (name, state_code) values
  ('Test City Delhi',   '07'),
  ('Test City Gurgaon', '06')
on conflict (name) do nothing;
