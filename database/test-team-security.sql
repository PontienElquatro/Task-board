-- Disposable fixtures; no real members, invitations or roles are changed.
begin;
do $$
declare owner uuid:=gen_random_uuid(); administrator uuid:=gen_random_uuid();
 member uuid:=gen_random_uuid(); viewer uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
 tid uuid; other_team uuid; pid uuid;
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (owner,'owner-'||owner||'@example.invalid',now()),
 (administrator,'admin-'||administrator||'@example.invalid',now()),
 (member,'member-'||member||'@example.invalid',now()),
 (viewer,'viewer-'||viewer||'@example.invalid',now()),
 (outsider,'outside-'||outsider||'@example.invalid',now());
 insert into public.taskboard_teams(owner_id,name) values(owner,'__team_security_rollback__') returning id into tid;
 insert into public.taskboard_teams(owner_id,name) values(outsider,'__other_team_rollback__') returning id into other_team;
 if not exists(select 1 from public.taskboard_team_members where team_id=tid and user_id=owner and role='owner') then raise exception 'Atomic owner registration failed'; end if;
 insert into public.taskboard_team_members(team_id,user_id,role) values
 (tid,administrator,'admin'),(tid,member,'member'),(tid,viewer,'viewer');
 insert into public.taskboard_shared_projects(team_id,title) values(tid,'__private_project__') returning id into pid;
 perform set_config('maat.test_owner',owner::text,true);
 perform set_config('maat.test_admin',administrator::text,true);
 perform set_config('maat.test_member',member::text,true);
 perform set_config('maat.test_viewer',viewer::text,true);
 perform set_config('maat.test_outside',outsider::text,true);
 perform set_config('maat.test_team',tid::text,true);
 perform set_config('maat.test_project',pid::text,true);
end $$;
set local role authenticated;
do $$
declare owner uuid:=current_setting('maat.test_owner')::uuid; administrator uuid:=current_setting('maat.test_admin')::uuid;
 member uuid:=current_setting('maat.test_member')::uuid; viewer uuid:=current_setting('maat.test_viewer')::uuid;
 outsider uuid:=current_setting('maat.test_outside')::uuid; tid uuid:=current_setting('maat.test_team')::uuid;
 pid uuid:=current_setting('maat.test_project')::uuid; inv uuid; accepted uuid; denied boolean; affected integer;
begin
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 if public.is_taskboard_team_member(tid) or public.taskboard_manage_team(tid) or public.taskboard_edit_team(tid) then raise exception 'Cross-team permission leak'; end if;
 if exists(select 1 from public.taskboard_shared_projects where id=pid) then raise exception 'Cross-team project leak'; end if;
 if exists(select 1 from public.taskboard_team_profiles() where team_id=tid) then raise exception 'Cross-team profile leak'; end if;
 perform set_config('request.jwt.claim.sub',viewer::text,true);
 if not public.is_taskboard_team_member(tid) or public.taskboard_edit_team(tid) or public.taskboard_manage_team(tid) then raise exception 'Viewer permissions incorrect'; end if;
 update public.taskboard_shared_projects set title='forbidden' where id=pid;
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Viewer wrote project'; end if;
 denied:=false;
 begin perform public.manage_taskboard_member(tid,member,'admin'); exception when others then denied:=true; end;
 if not denied then raise exception 'Viewer promoted member'; end if;
 perform set_config('request.jwt.claim.sub',member::text,true);
 if not public.taskboard_edit_team(tid) or public.taskboard_manage_team(tid) then raise exception 'Member permissions incorrect'; end if;
 perform set_config('request.jwt.claim.sub',administrator::text,true);
 denied:=false;
 begin perform public.manage_taskboard_member(tid,member,'admin'); exception when others then denied:=true; end;
 if not denied then raise exception 'Admin promoted administrator'; end if;
 denied:=false;
 begin perform public.manage_taskboard_member(tid,owner,null); exception when others then denied:=true; end;
 if not denied then raise exception 'Admin removed owner'; end if;
 -- Valid admin invitation. Removing its issuer must invalidate acceptance.
 insert into public.taskboard_team_invitations(team_id,email,role,invited_by,token_hash)
 values(tid,'outside-'||outsider||'@example.invalid','member',administrator,repeat('a',72)) returning id into inv;
 perform set_config('request.jwt.claim.sub',owner::text,true);
 perform public.manage_taskboard_member(tid,administrator,null);
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 denied:=false;
 begin perform public.accept_taskboard_team_invitation(inv,repeat('a',72)); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Removed issuer invitation accepted'; end if;
 perform set_config('request.jwt.claim.sub',owner::text,true);
 perform public.cancel_taskboard_invitation(inv);
 -- Accepted markers and expiry cannot be chosen to bypass the lifecycle.
 denied:=false;
 begin
 insert into public.taskboard_team_invitations(team_id,email,role,invited_by,token_hash,accepted_at)
 values(tid,'outside-'||outsider||'@example.invalid','member',owner,repeat('b',72),now());
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Invitation born accepted'; end if;
 denied:=false;
 begin
 insert into public.taskboard_team_invitations(team_id,email,role,invited_by,token_hash,expires_at)
 values(tid,'outside-'||outsider||'@example.invalid','member',owner,repeat('c',72),now()+interval '30 days');
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Excess invitation lifetime'; end if;
 insert into public.taskboard_team_invitations(team_id,email,role,invited_by,token_hash)
 values(tid,'outside-'||outsider||'@example.invalid','viewer',owner,repeat('d',72)) returning id into inv;
 perform set_config('request.jwt.claim.sub',member::text,true);
 denied:=false;
 begin perform public.accept_taskboard_team_invitation(inv,repeat('d',72)); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Wrong recipient accepted invitation'; end if;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 accepted:=public.accept_taskboard_team_invitation(inv,repeat('d',72));
 if accepted<>tid or not public.is_taskboard_team_member(tid) then raise exception 'Valid invitation failed'; end if;
 if public.accept_taskboard_team_invitation(inv,repeat('d',72))<>tid then raise exception 'Idempotent acceptance failed'; end if;
 perform set_config('request.jwt.claim.sub',owner::text,true);
 perform public.manage_taskboard_member(tid,outsider,null);
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 denied:=false;
 begin perform public.accept_taskboard_team_invitation(inv,repeat('d',72)); exception when invalid_parameter_value then denied:=true; end;
 if not denied then raise exception 'Used invitation rejoined removed member'; end if;
 if exists(select 1 from public.taskboard_shared_projects where id=pid) then raise exception 'Revoked member retained access'; end if;
 denied:=false;
 begin insert into public.taskboard_team_members(team_id,user_id,role) values(tid,outsider,'admin');
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Direct membership insertion permitted'; end if;
end $$;
reset role;
do $$
declare f record;
begin
 for f in select p.oid,p.proname,p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('accept_taskboard_team_invitation','cancel_taskboard_invitation','manage_taskboard_member','is_taskboard_team_member','taskboard_edit_team','taskboard_manage_team','taskboard_team_roster','progress_taskboard_work') loop
 if f.prosecdef or has_function_privilege('anon',f.oid,'EXECUTE') then raise exception 'Unsafe public function %',f.proname; end if;
 end loop;
end $$;
rollback;
select 'Team role, invitation, revocation, isolation and privilege tests passed; fixtures rolled back' as result;
