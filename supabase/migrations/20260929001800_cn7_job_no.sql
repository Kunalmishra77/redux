-- CN7 "quote approved" carries the job number ({{3}}), but verify_quote_otp() approves the quote
-- before it opens the job, so the message was queued with none. When the job is created — in the
-- same transaction, before the worker can read the message — the job number is filled in.
create or replace function public.on_job_created_fill_cn7() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.messages set variables = variables || jsonb_build_object('job_no', new.job_no)
  where dedup_key = 'CN7:' || new.quotation_id and not (variables ? 'job_no');
  return null;
end $$;
create trigger trg_job_created_fill_cn7 after insert on public.jobs
  for each row execute function public.on_job_created_fill_cn7();
