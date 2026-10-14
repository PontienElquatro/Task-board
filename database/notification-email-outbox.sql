-- Maat-test first. This prepares a queue; it does not send email or enable delivery.
begin;
alter table public.taskboard_notification_preferences
 add column email_assignments boolean not null default false;

create table maat_private.notification_email_config (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false
);
insert into maat_private.notification_email_config(singleton,enabled) values(true,false);
alter table maat_private.notification_email_config enable row level security;
revoke all on maat_private.notification_email_config from public,anon,authenticated,service_role;

-- The database owns the event revision; callers cannot spoof or replay it.
alter table public.taskboard_shared_tasks add column email_assignment_version uuid;
alter table public.taskboard_shared_subtasks add column email_assignment_version uuid;
create function maat_private.track_email_assignment_version()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then new.email_assignment_version:=gen_random_uuid();
 elsif new.assignee_id is distinct from old.assignee_id then new.email_assignment_version:=gen_random_uuid();
 else new.email_assignment_version:=old.email_assignment_version;end if;
 return new;
end;$$;
revoke all on function maat_private.track_email_assignment_version() from public,anon,authenticated;
create trigger track_email_assignment_version before insert or update on public.taskboard_shared_tasks
 for each row execute function maat_private.track_email_assignment_version();
create trigger track_email_assignment_version before insert or update on public.taskboard_shared_subtasks
 for each row execute function maat_private.track_email_assignment_version();

create table maat_private.notification_email_outbox (
 id uuid primary key default gen_random_uuid(),
 event_version uuid not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 team_id uuid not null references public.taskboard_teams(id) on delete cascade,
 task_id uuid references public.taskboard_shared_tasks(id) on delete cascade,
 subtask_id uuid references public.taskboard_shared_subtasks(id) on delete cascade,
 kind text not null default 'assignment' check(kind='assignment'),
 status text not null default 'pending' check(status in('pending','suppressed','sent','failed','uncertain')),
 created_at timestamptz not null default now(),
 unique(event_version,user_id),
 check((task_id is null)<>(subtask_id is null))
);
create index email_outbox_pending on maat_private.notification_email_outbox(created_at,id) where status='pending';
create index email_outbox_user on maat_private.notification_email_outbox(user_id);
create index email_outbox_team on maat_private.notification_email_outbox(team_id);
create index email_outbox_task on maat_private.notification_email_outbox(task_id) where task_id is not null;
create index email_outbox_subtask on maat_private.notification_email_outbox(subtask_id) where subtask_id is not null;
alter table maat_private.notification_email_outbox enable row level security;
revoke all on maat_private.notification_email_outbox from public,anon,authenticated,service_role;

create function maat_private.queue_assignment_email()
returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); is_subtask boolean:=tg_table_name='taskboard_shared_subtasks';
begin
 if tg_op='UPDATE' then
  if new.assignee_id is not distinct from old.assignee_id then return new;end if;
  update maat_private.notification_email_outbox set status='suppressed'
   where status='pending' and (case when is_subtask then subtask_id=new.id else task_id=new.id end);
 end if;
 if not exists(select 1 from maat_private.notification_email_config where singleton and enabled)
  or actor is null or new.assignee_id is null or actor=new.assignee_id
  or not public.taskboard_account_active() or not public.taskboard_edit_team(new.team_id)
  then return new;end if;
 if not exists(select 1 from public.taskboard_notification_preferences p where p.user_id=new.assignee_id and p.email_assignments)
  or not exists(select 1 from public.taskboard_team_members m where m.team_id=new.team_id and m.user_id=new.assignee_id)
  or not exists(select 1 from auth.users u where u.id=new.assignee_id and u.email_confirmed_at is not null and u.email is not null and (u.banned_until is null or u.banned_until<=now()))
  or exists(select 1 from public.taskboard_account_status s where s.user_id=new.assignee_id and s.suspended)
  or exists(select 1 from public.taskboard_account_deletions d where d.user_id=new.assignee_id and d.status='processing')
  then return new;end if;
 insert into maat_private.notification_email_outbox(event_version,user_id,team_id,task_id,subtask_id)
 values(new.email_assignment_version,new.assignee_id,new.team_id,
  case when is_subtask then null else new.id end,case when is_subtask then new.id else null end)
 on conflict(event_version,user_id) do nothing;
 return new;
end;$$;
revoke all on function maat_private.queue_assignment_email() from public,anon,authenticated;
create trigger queue_assignment_email after insert or update of assignee_id on public.taskboard_shared_tasks
 for each row execute function maat_private.queue_assignment_email();
create trigger queue_assignment_email after insert or update of assignee_id on public.taskboard_shared_subtasks
 for each row execute function maat_private.queue_assignment_email();

-- Opting out cancels pending events immediately; it never alters the bell history.
create function maat_private.cancel_assignment_emails()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not new.email_assignments then
  update maat_private.notification_email_outbox set status='suppressed' where user_id=new.user_id and status='pending';
 end if;
 return new;
end;$$;
revoke all on function maat_private.cancel_assignment_emails() from public,anon,authenticated;
create trigger cancel_assignment_emails after insert or update of email_assignments on public.taskboard_notification_preferences
 for each row execute function maat_private.cancel_assignment_emails();
commit;
