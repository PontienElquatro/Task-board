-- LOCAL ONLY. No email, password, token from a real user or persistent fixture.
begin;
create function pg_temp.expect_state(command text,expected text) returns void
language plpgsql security invoker as $$declare received text;begin
 begin execute command; exception when others then get stacked diagnostics received=returned_sqlstate; end;
 if received is distinct from expected then raise exception 'Expected %, got %',expected,received;end if;
end$$;
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-4000-8000-000000000081','owner-local@example.invalid',now()),
 ('00000000-0000-4000-8000-000000000082','recipient-local@example.invalid',null);
insert into public.taskboard_teams(id,owner_id,name) values
 ('10000000-0000-4000-8000-000000000081','00000000-0000-4000-8000-000000000081','Local invitation lifecycle');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000081',true);
insert into public.taskboard_team_invitations(id,team_id,email,role,invited_by,token_hash) values
 ('30000000-0000-4000-8000-000000000081','10000000-0000-4000-8000-000000000081','recipient-local@example.invalid','member','00000000-0000-4000-8000-000000000081',repeat('e',72));
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000082',true);
select pg_temp.expect_state($q$select public.accept_taskboard_team_invitation('30000000-0000-4000-8000-000000000081',repeat('e',72))$q$,'42501');
reset role;
update auth.users set email_confirmed_at=now() where id='00000000-0000-4000-8000-000000000082';
update public.taskboard_team_invitations set expires_at=now()-interval '1 minute';
set local role authenticated;
select pg_temp.expect_state($q$select public.accept_taskboard_team_invitation('30000000-0000-4000-8000-000000000081',repeat('e',72))$q$,'22023');
reset role;
update public.taskboard_team_invitations set expires_at=now()+interval '1 day';
set local role authenticated;
select pg_temp.expect_state($q$select public.accept_taskboard_team_invitation('30000000-0000-4000-8000-000000000081',repeat('f',72))$q$,'42501');
select pg_temp.expect_state($q$select public.accept_taskboard_team_invitation('30000000-0000-4000-8000-000000000081',null)$q$,'22023');
reset role;
insert into public.taskboard_account_status(user_id,suspended) values('00000000-0000-4000-8000-000000000082',true);
set local role authenticated;
select pg_temp.expect_state($q$select public.accept_taskboard_team_invitation('30000000-0000-4000-8000-000000000081',repeat('e',72))$q$,'42501');
reset role;
update public.taskboard_account_status set suspended=false;
insert into public.taskboard_account_status(user_id,suspended) values('00000000-0000-4000-8000-000000000081',true);
set local role authenticated;
select pg_temp.expect_state($q$select public.accept_taskboard_team_invitation('30000000-0000-4000-8000-000000000081',repeat('e',72))$q$,'42501');
reset role;
update public.taskboard_account_status set suspended=false;
set local role authenticated;
select public.accept_taskboard_team_invitation('30000000-0000-4000-8000-000000000081',repeat('e',72));
select pg_temp.expect_state($q$update public.taskboard_team_invitations set accepted_at=null$q$,'42501');
set local role anon;
select pg_temp.expect_state($q$select public.accept_taskboard_team_invitation('30000000-0000-4000-8000-000000000081',repeat('e',72))$q$,'42501');
reset role;
rollback;
select 'PASS invitation confirmation, expiry, token, suspension and anonymous edge cases; rolled back';
