-- CR-001 (D31) — REDUX decision 2026-10-19 (open question D-g): for now the customer's own team dismantles
-- the fittings and refits them; REDUX collects, restores at the Eurobrass workshop and returns them.
-- The job stages keep their keys; only the words the customer reads change (job_update {{4}}).

create or replace function public.stage_words(p public.job_stage) returns text
language sql immutable set search_path = '' as $$
  select case p
    when 'dates_confirmed' then 'dates confirmed'
    when 'removal_pickup'  then 'dismantled by your team and collected for the Eurobrass workshop'
    when 'at_eurobrass'    then 'at the Eurobrass workshop for restoration'
    when 'quality_check'   then 'restored and in quality check'
    when 'refit_test'      then 'restored, pressure-tested and delivered back to you for refitting'
    when 'handover'        then 'handed over and back in service'
    else 'warranty active' end;
$$;
