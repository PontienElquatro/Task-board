-- Additive scheduling; existing team RLS policies remain authoritative.
alter table public.taskboard_shared_tasks
  add column if not exists start_date date,
  add column if not exists end_date date;
alter table public.taskboard_shared_tasks
  add constraint shared_tasks_schedule_order
  check (start_date is null or end_date is null or end_date >= start_date);
