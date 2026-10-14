-- Soft dismissal: only the recipient may update this field through existing RLS.
alter table public.taskboard_notifications add column if not exists dismissed_at timestamptz;
grant update(dismissed_at) on public.taskboard_notifications to authenticated;
