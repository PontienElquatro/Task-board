begin;
do $$
declare principal uuid; candidate uuid:=gen_random_uuid(); session uuid:=gen_random_uuid(); candidate_session uuid:=gen_random_uuid(); identity jsonb; version integer;
begin
  select principal_id into principal from maat_private.admin_control where singleton;
  insert into auth.users(id,email,email_confirmed_at) values(candidate,'maat-role-test-'||candidate::text||'@example.invalid',now());
  insert into auth.sessions(id,user_id,created_at,updated_at) values(session,principal,now(),now()),(candidate_session,candidate,now(),now());
  identity:=public.taskboard_admin_access(principal,session,'identity');
  if not (identity->>'isPrincipal')::boolean then raise exception 'Principal missing'; end if;
  begin
    perform public.taskboard_admin_access(candidate,candidate_session,'identity');
    raise exception 'Standard account accepted';
  exception when insufficient_privilege then null; end;
  insert into public.taskboard_account_deletions(user_id,requested_at,delete_after,status) values(candidate,now(),now()+interval '720 hours','pending');
  begin
    perform public.taskboard_admin_access(principal,session,'grant',candidate,array['teams_read'],null,'Pending deletion fixture');
    raise exception 'Pending deletion appointment accepted';
  exception when insufficient_privilege then null; end;
  delete from public.taskboard_account_deletions where user_id=candidate;
  perform public.taskboard_admin_access(principal,session,'grant',candidate,array['teams_read'],null,'Rollback role fixture');
  begin
    perform public.taskboard_admin_access(principal,session,'grant',candidate,array['users_read'],null,'Concurrent grant fixture');
    raise exception 'Stale role version accepted';
  exception when sqlstate 'PT409' then null; end;
  identity:=public.taskboard_admin_access(candidate,candidate_session,'identity');
  if (identity->>'isPrincipal')::boolean or identity->'permissions'<>'["teams_read"]'::jsonb then raise exception 'Permission escalation'; end if;
  begin
    perform public.taskboard_set_account_status(candidate,'test@example.invalid',principal,'quatrosus@gmail.com',true,false,'Unauthorized moderation fixture');
    raise exception 'Delegate moderation accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.taskboard_admin_access(candidate,candidate_session,'grant',candidate,array['users_manage'],1,'Attempt self escalation');
    raise exception 'Delegate self escalation accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.taskboard_admin_access(principal,session,'revoke',principal,null,1,'Attempt principal removal');
    raise exception 'Principal revoked';
  exception when insufficient_privilege then null; end;
  select c.version into version from maat_private.admin_control c where singleton;
  perform public.taskboard_admin_access(principal,session,'transfer_request',candidate,null,version,'Rollback transfer fixture');
  begin
    perform public.taskboard_admin_access(principal,session,'transfer_accept',null,null,version+1,'Invalid acceptance fixture');
    raise exception 'Wrong successor accepted';
  exception when sqlstate 'PT409' then null; end;
  perform public.taskboard_admin_access(principal,session,'transfer_cancel',null,null,version+1,'Rollback cancellation fixture');
  if exists(select 1 from maat_private.admin_control where singleton and successor_id is not null) then raise exception 'Transfer not cancelled'; end if;
  select c.version into version from maat_private.admin_control c where singleton;
  perform public.taskboard_admin_access(principal,session,'transfer_request',candidate,null,version,'Rollback transfer fixture');
  update maat_private.admin_control set transfer_expires_at=now()-interval '1 second' where singleton;
  begin
    perform public.taskboard_admin_access(candidate,candidate_session,'transfer_accept',null,null,version+1,'Expired transfer fixture');
    raise exception 'Expired transfer accepted';
  exception when sqlstate 'PT409' then null; end;
  update maat_private.admin_control set transfer_expires_at=now()+interval '24 hours' where singleton;
  perform public.taskboard_admin_access(candidate,candidate_session,'transfer_accept',null,null,version+1,'Rollback acceptance fixture');
  identity:=public.taskboard_admin_access(candidate,candidate_session,'identity');
  if not (identity->>'isPrincipal')::boolean then raise exception 'Transfer failed'; end if;
  update auth.users set email='maat-renamed-'||candidate::text||'@example.invalid' where id=candidate;
  identity:=public.taskboard_admin_access(candidate,candidate_session,'identity');
  if not (identity->>'isPrincipal')::boolean or not exists(select 1 from public.taskboard_admin_allowlist where email='maat-renamed-'||candidate::text||'@example.invalid') then raise exception 'Email change lost principal or deletion protection'; end if;
  update auth.sessions set created_at=now()-interval '11 minutes' where id=candidate_session;
  begin
    perform public.taskboard_admin_access(candidate,candidate_session,'revoke',principal,null,1,'Stale sign-in fixture');
    raise exception 'Stale sign-in accepted';
  exception when sqlstate 'PT401' then null; end;
  delete from auth.sessions where id=session;
  begin
    perform public.taskboard_admin_access(principal,session,'identity');
    raise exception 'Revoked session accepted';
  exception when insufficient_privilege then null; end;
  if has_function_privilege('authenticated','public.taskboard_admin_access(uuid,uuid,text,uuid,text[],integer,text)','execute') then raise exception 'Client RPC exposed'; end if;
end;
$$;
rollback;
select 'Roles, principal protection, successor acceptance, recent sign-in and live sessions passed; all fixtures rolled back' as result;
