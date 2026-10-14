begin;
do $$
declare account uuid; owner_account uuid; first_result jsonb; again jsonb;
begin
 update maat_private.account_deletion_config set enabled=false where singleton;
 select u.id into account from auth.users u
 where not exists(select 1 from public.taskboard_teams t where t.owner_id=u.id)
 and not exists(select 1 from public.taskboard_admin_allowlist a where a.email=lower(u.email))
 and not exists(select 1 from public.taskboard_account_status s where s.user_id=u.id and s.suspended)
 limit 1;
 if account is null then raise exception 'Requires an active non-admin account owning no team';end if;
 perform set_config('request.jwt.claim.sub',account::text,true);
 begin
  perform public.taskboard_manage_account_deletion('request');
  raise exception 'Requests were enabled before worker validation';
 exception when sqlstate '55000' then null;
 end;
 update maat_private.account_deletion_config set enabled=true where singleton;
 first_result:=public.taskboard_manage_account_deletion('request');
 if (first_result->>'deleteAfter')::timestamptz-(first_result->>'requestedAt')::timestamptz<>interval '720 hours' then raise exception 'Invalid grace period';end if;
 again:=public.taskboard_manage_account_deletion('request');
 if first_result<>again then raise exception 'Repeated request changed deadline';end if;
 again:=public.taskboard_manage_account_deletion('cancel');
 if again->>'status'<>'cancelled' then raise exception 'Cancel failed';end if;
 perform public.taskboard_manage_account_deletion('request');
 update public.taskboard_account_deletions set requested_at=now()-interval '721 hours',delete_after=now()-interval '1 hour' where user_id=account;
 begin
  perform public.taskboard_manage_account_deletion('cancel');
  raise exception 'Expired deadline accepted';
 exception when sqlstate '55000' then null;
 end;
 select owner_id into owner_account from public.taskboard_teams limit 1;
 if owner_account is null then raise exception 'Requires existing owner fixture';end if;
 perform set_config('request.jwt.claim.sub',owner_account::text,true);
 begin
  perform public.taskboard_manage_account_deletion('request');
  raise exception 'Owner accepted';
 exception when sqlstate '55000' or insufficient_privilege then null;
 end;
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.taskboard_manage_account_deletion('request');
  raise exception 'Unauthenticated request accepted';
 exception when insufficient_privilege then null;
 end;
 if has_table_privilege('authenticated','public.taskboard_account_deletions','UPDATE') or
 has_table_privilege('anon','public.taskboard_account_deletions','SELECT') then raise exception 'Unexpected grants';end if;
end $$;
rollback;
select 'Disabled requests, exact grace period, idempotence, cancellation, deadline and owner protections passed; no persistent request created' as result;
