-- Separate RPC: old clients keep using taskboard_team_roster() unchanged.
-- Metadata is presentation only; authorization comes exclusively from membership.
create schema if not exists maat_private;
revoke all on schema maat_private from public,anon;
grant usage on schema maat_private to authenticated;
create or replace function maat_private.team_profiles()
returns table(team_id uuid,user_id uuid,role text,display_name text,avatar_url text)
language sql stable security definer set search_path='' as $$
select m.team_id,m.user_id,m.role,
 coalesce(
  nullif(trim(concat_ws(' ',nullif(trim(u.raw_user_meta_data->>'first_name'),''),nullif(trim(u.raw_user_meta_data->>'last_name'),''))),''),
  nullif(trim(u.raw_user_meta_data->>'full_name'),''),
  nullif(trim(u.raw_user_meta_data->>'name'),''),'Membre'),
 case when u.raw_user_meta_data->>'avatar_url' like 'https://%' then u.raw_user_meta_data->>'avatar_url' else null end
from public.taskboard_team_members m join auth.users u on u.id=m.user_id
where (select auth.uid()) is not null and public.is_taskboard_team_member(m.team_id);
$$;
revoke all on function maat_private.team_profiles() from public,anon;
grant execute on function maat_private.team_profiles() to authenticated;

create or replace function public.taskboard_team_profiles()
returns table(team_id uuid,user_id uuid,role text,display_name text,avatar_url text)
language sql stable security invoker set search_path='' as $$
select * from maat_private.team_profiles();
$$;
revoke all on function public.taskboard_team_profiles() from public,anon;
grant execute on function public.taskboard_team_profiles() to authenticated;
