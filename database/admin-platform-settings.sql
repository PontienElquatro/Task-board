-- Only public-facing contact/announcement text is stored in this readable table.
create table if not exists public.taskboard_platform_settings (
  singleton boolean primary key default true check(singleton),
  support_email text not null default '' check(length(support_email)<=254),
  announcement text not null default '' check(length(announcement)<=500),
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.taskboard_platform_settings enable row level security;
revoke all on public.taskboard_platform_settings from public,anon,authenticated;
grant select on public.taskboard_platform_settings to anon,authenticated;
grant select,insert,update on public.taskboard_platform_settings to service_role;
create policy public_platform_information on public.taskboard_platform_settings for select to anon,authenticated using(true);
insert into public.taskboard_platform_settings(singleton) values(true) on conflict do nothing;

create or replace function maat_private.update_platform_settings(actor uuid, session uuid,
  contact_email text, notice text, expected_version integer, action_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare access jsonb; result jsonb;
begin
  access:=maat_private.admin_access(actor,session,'identity');
  perform maat_private.require_admin_scope(actor,'settings_manage');
  if not (access->>'fresh')::boolean then raise exception 'Recent sign-in required' using errcode='PT401'; end if;
  if length(coalesce(contact_email,''))>254 or (coalesce(contact_email,'')<>'' and contact_email!~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
    or length(coalesce(notice,''))>500 or length(btrim(coalesce(action_reason,''))) not between 10 and 500 then
    raise exception 'Invalid settings' using errcode='22023'; end if;
  update public.taskboard_platform_settings set support_email=btrim(coalesce(contact_email,'')),announcement=btrim(coalesce(notice,'')),version=version+1,updated_at=now()
  where singleton and version=expected_version returning to_jsonb(taskboard_platform_settings.*) into result;
  if result is null then raise exception 'Settings changed' using errcode='PT409'; end if;
  insert into maat_private.admin_access_events(actor_id,action,reason) values(actor,'settings_update',btrim(action_reason));
  return result;
end;
$$;
revoke all on function maat_private.update_platform_settings(uuid,uuid,text,text,integer,text) from public,anon,authenticated;
grant execute on function maat_private.update_platform_settings(uuid,uuid,text,text,integer,text) to service_role;
create or replace function public.taskboard_update_platform_settings(actor uuid, session uuid,
  contact_email text, notice text, expected_version integer, action_reason text)
returns jsonb language sql security invoker set search_path='' as $$
  select maat_private.update_platform_settings(actor,session,contact_email,notice,expected_version,action_reason);
$$;
revoke all on function public.taskboard_update_platform_settings(uuid,uuid,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.taskboard_update_platform_settings(uuid,uuid,text,text,integer,text) to service_role;
