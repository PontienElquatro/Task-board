-- Apply to Maat-test first. Existing notifications are never changed.
begin;
create table public.taskboard_notification_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 assignments boolean not null default true,
 completions boolean not null default true
);
alter table public.taskboard_notification_preferences enable row level security;
revoke all on public.taskboard_notification_preferences from public,anon,authenticated;
grant select,insert,update on public.taskboard_notification_preferences to authenticated;
grant all on public.taskboard_notification_preferences to service_role;
create policy preferences_self_read on public.taskboard_notification_preferences for select to authenticated
 using(user_id=(select auth.uid()) and (select public.taskboard_account_active()));
create policy preferences_self_insert on public.taskboard_notification_preferences for insert to authenticated
 with check(user_id=(select auth.uid()) and (select public.taskboard_account_active()));
create policy preferences_self_update on public.taskboard_notification_preferences for update to authenticated
 using(user_id=(select auth.uid()) and (select public.taskboard_account_active()))
 with check(user_id=(select auth.uid()) and (select public.taskboard_account_active()));

-- Preserve the deployed trigger logic, adding an explicit recipient preference
-- guard. These functions already run with definer privileges and are not RPCs.
do $$
declare definition text; needle text := 'insert into public.taskboard_notifications('; replacement text;
begin
 definition := pg_get_functiondef('public.notify_taskboard_assignment()'::regprocedure);
 if strpos(definition,'taskboard_notification_preferences')>0 or
    (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then
   raise exception 'Unexpected assignment function; no changes committed';
 end if;
 replacement := E'if exists(select 1 from public.taskboard_notification_preferences where user_id=new.assignee_id and not assignments) then return new; end if;\n' || needle;
 execute replace(definition,needle,replacement);
 definition := pg_get_functiondef('maat_private.notify_work_completion()'::regprocedure);
 if strpos(definition,'taskboard_notification_preferences')>0 or
    (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then
   raise exception 'Unexpected completion function; no changes committed';
 end if;
 replacement := E'if exists(select 1 from public.taskboard_notification_preferences where user_id=recipient and not completions) then return new; end if;\n' || needle;
 execute replace(definition,needle,replacement);
end $$;
revoke all on function public.notify_taskboard_assignment() from public,anon,authenticated;
revoke all on function maat_private.notify_work_completion() from public,anon,authenticated;
commit;
