alter table public.taskboard_notifications
 add column if not exists actor_name text,
 add column if not exists actor_avatar_url text,
 add column if not exists project_name text;
create or replace function maat_private.enrich_notification()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 new.actor_name:=null;new.actor_avatar_url:=null;new.project_name:=null;
 if auth.uid() is not null and public.is_taskboard_team_member(new.team_id) then
  select coalesce(nullif(trim(concat_ws(' ',nullif(trim(raw_user_meta_data->>'first_name'),''),nullif(trim(raw_user_meta_data->>'last_name'),''))),''),nullif(trim(raw_user_meta_data->>'full_name'),''),nullif(trim(raw_user_meta_data->>'name'),''),'Membre'),
   case when raw_user_meta_data->>'avatar_url' like 'https://%' then raw_user_meta_data->>'avatar_url' end
  into new.actor_name,new.actor_avatar_url from auth.users where id=auth.uid();
 end if;
 select title into new.project_name from public.taskboard_shared_projects where id=new.project_id and team_id=new.team_id;
 return new;
end;$$;
revoke all on function maat_private.enrich_notification() from public,anon,authenticated;
drop trigger if exists enrich_notification on public.taskboard_notifications;
create trigger enrich_notification before insert on public.taskboard_notifications for each row execute function maat_private.enrich_notification();
-- Read state is the only field a recipient may modify.
revoke update on public.taskboard_notifications from authenticated;
revoke update(id,user_id,team_id,project_id,task_id,title,created_at,actor_name,actor_avatar_url,project_name) on public.taskboard_notifications from authenticated;
grant update(read_at) on public.taskboard_notifications to authenticated;
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='taskboard_notifications') then
  alter publication supabase_realtime add table public.taskboard_notifications;
 end if;
end $$;
