-- Coordinate moderation with role revocation/permission edits in one transaction.
create or replace function maat_private.require_admin_scope(actor uuid, scope text)
returns void language plpgsql security definer set search_path='' as $$
declare principal uuid;
begin
  select principal_id into principal from maat_private.admin_control where singleton for update;
  if not exists(select 1 from maat_private.admin_members m where m.user_id=actor
    and (actor=principal or scope=any(m.permissions))) then
    raise exception 'Permission required' using errcode='42501';
  end if;
end;
$$;
revoke all on function maat_private.require_admin_scope(uuid,text) from public,anon,authenticated;
grant execute on function maat_private.require_admin_scope(uuid,text) to service_role;

create or replace function public.taskboard_set_account_status(
 actor uuid, actor_email text, target uuid, target_email text,
 new_suspended boolean, expected_suspended boolean, action_reason text)
returns bigint language plpgsql security invoker set search_path='' as $$
declare audit_id bigint; previous boolean;
begin
 perform maat_private.require_admin_scope(actor,'users_manage');
 if actor=target then raise exception 'Own account protected' using errcode='42501'; end if;
 if not exists(select 1 from public.taskboard_admin_allowlist where email=lower(actor_email))
 or exists(select 1 from public.taskboard_account_status where user_id=actor and suspended)
 then raise exception 'Administrator required' using errcode='42501'; end if;
 if exists(select 1 from public.taskboard_admin_allowlist where email=lower(target_email))
 then raise exception 'Administrator protected' using errcode='42501'; end if;
 if new_suspended is null or expected_suspended is null or char_length(trim(coalesce(action_reason,''))) not between 10 and 500
 then raise exception 'Reason required' using errcode='22023'; end if;
 insert into public.taskboard_account_status(user_id) values(target) on conflict do nothing;
 select suspended into previous from public.taskboard_account_status where user_id=target for update;
 if previous<>expected_suspended or previous=new_suspended then raise exception 'Account changed' using errcode='PT409'; end if;
 update public.taskboard_account_status set suspended=new_suspended,changed_at=now() where user_id=target;
 insert into public.taskboard_admin_audit(actor_id,action,target_id,reason,auth_sync)
 values(actor,case when new_suspended then 'account_suspend' else 'account_reactivate' end,target,trim(action_reason),'pending') returning id into audit_id;
 return audit_id;
end;
$$;
revoke all on function public.taskboard_set_account_status(uuid,text,uuid,text,boolean,boolean,text) from public,anon,authenticated;
grant execute on function public.taskboard_set_account_status(uuid,text,uuid,text,boolean,boolean,text) to service_role;
