begin;
do $$
declare account uuid; claimed integer;
begin
 select u.id into account from auth.users u
 where not exists(select 1 from public.taskboard_admin_allowlist a where a.email=lower(u.email))
 and not exists(select 1 from public.taskboard_teams t where t.owner_id=u.id) limit 1;
 if account is null then raise exception 'Aucun compte de test approprié'; end if;
 insert into public.taskboard_account_deletions(user_id,requested_at,delete_after,status)
 values(account,now()-interval '721 hours',now()-interval '1 hour','pending')
 on conflict(user_id) do update set requested_at=excluded.requested_at,delete_after=excluded.delete_after,status='pending',cancelled_at=null;
 select count(*) into claimed from public.taskboard_claim_account_deletions(10) where user_id=account;
 if claimed<>1 then raise exception 'Demande due non réservée'; end if;
 select count(*) into claimed from public.taskboard_claim_account_deletions(10) where user_id=account;
 if claimed<>0 then raise exception 'Demande réservée deux fois'; end if;
 update public.taskboard_account_deletions set retry_after=now()-interval '1 minute' where user_id=account;
 select count(*) into claimed from public.taskboard_claim_account_deletions_v2(10) where user_id=account;
 if claimed<>0 then raise exception 'Active reservation stolen';end if;
 perform public.taskboard_deletion_step(account,(select claim_token from public.taskboard_account_deletions where user_id=account),'retry');
 update public.taskboard_account_deletions set retry_after=now()-interval '1 minute' where user_id=account;
 select count(*) into claimed from public.taskboard_claim_account_deletions(10) where user_id=account;
 if claimed<>1 then raise exception 'Reprise non réservée'; end if;
 if (select attempts from public.taskboard_account_deletions where user_id=account) < 2 then
  raise exception 'Compteur de reprises incorrect';
 end if;
 if exists(select 1 from public.taskboard_account_deletions where user_id=account and status<>'processing') then
  raise exception 'État processing non enregistré';
 end if;
end $$;
rollback;
