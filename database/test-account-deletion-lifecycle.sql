-- All users below are created in this transaction and rolled back.
begin;
do $$
declare account uuid:=gen_random_uuid(); reservation uuid; result jsonb; rejected boolean:=false;
begin
 insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at)
 values(account,'authenticated','authenticated',account::text||'@deletion-test.invalid',now(),now(),now());
 perform set_config('request.jwt.claim.sub',account::text,true);
 update maat_private.account_deletion_config set enabled=true where singleton;
 result:=public.taskboard_manage_account_deletion('request');
 if result->>'status'<>'pending' then raise exception 'Request failed';end if;
 if not public.taskboard_account_active() then raise exception 'Grace period blocked';end if;
 result:=public.taskboard_manage_account_deletion('cancel');
 if result->>'status'<>'cancelled' then raise exception 'Cancellation failed';end if;
 perform public.taskboard_manage_account_deletion('request');
 update public.taskboard_account_deletions set requested_at=now()-interval '721 hours',delete_after=now()-interval '1 hour' where user_id=account;
 begin perform public.taskboard_manage_account_deletion('cancel');exception when sqlstate '55000' then rejected:=true;end;
 if not rejected then raise exception 'Expired cancellation accepted';end if;
 select claim_token into reservation from public.taskboard_claim_account_deletions_v2(50) where user_id=account;
 if reservation is null then raise exception 'Missing reservation';end if;
 if public.taskboard_account_active() then raise exception 'Processing account active';end if;
 rejected:=false;
 begin perform public.taskboard_deletion_step(account,gen_random_uuid(),'check');exception when insufficient_privilege then rejected:=true;end;
 if not rejected then raise exception 'Wrong token accepted';end if;
 rejected:=false;
 begin insert into public.taskboard_teams(owner_id,name) values(account,'Disposable protected team');exception when insufficient_privilege then rejected:=true;end;
 if not rejected then raise exception 'Processing ownership accepted';end if;
 rejected:=false;
 begin insert into public.taskboard_admin_allowlist(email) values(account::text||'@deletion-test.invalid');exception when insufficient_privilege then rejected:=true;end;
 if not rejected then raise exception 'Processing administrator accepted';end if;
 if public.taskboard_deletion_step(account,reservation,'objects')<>'[]'::jsonb then raise exception 'Unexpected storage';end if;
 -- Delete only the disposable user inserted above; its request must cascade.
 delete from auth.users where id=account;
 if exists(select 1 from public.taskboard_account_deletions where user_id=account) then raise exception 'Request orphan';end if;
 if public.taskboard_account_active() then raise exception 'Deleted JWT accepted';end if;
 if not exists(select 1 from maat_private.account_deletion_events where user_id=account and outcome='deleted') then raise exception 'Missing completion audit';end if;
end $$;
rollback;
