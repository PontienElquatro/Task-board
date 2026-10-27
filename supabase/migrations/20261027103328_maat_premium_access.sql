begin;

create table maat_private.premium_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  trial_started_at timestamptz not null,
  paid_until timestamptz,
  updated_at timestamptz not null default now(),
  check (paid_until is null or paid_until > trial_started_at)
);
create table maat_private.premium_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_tariff text not null check (char_length(btrim(requested_tariff)) between 1 and 80),
  payment_reference text check (payment_reference is null or char_length(btrim(payment_reference)) between 1 and 120),
  note text check (note is null or char_length(btrim(note)) <= 1000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  validity_days integer check (validity_days is null or validity_days in (30,90,365)),
  admin_note text check (admin_note is null or char_length(btrim(admin_note)) between 1 and 500),
  check ((status='pending' and reviewed_at is null and reviewed_by is null and validity_days is null)
    or (status<>'pending' and reviewed_at is not null and reviewed_by is not null))
);
create unique index premium_one_pending_request_per_user
  on maat_private.premium_access_requests(user_id) where status='pending';
create index premium_requests_review_queue on maat_private.premium_access_requests(created_at)
  where status='pending';
create table maat_private.premium_access_events (
  id bigint generated always as identity primary key,
  request_id uuid not null,
  user_id uuid not null,
  actor_id uuid,
  action text not null check (action in ('request_created','approved','rejected')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table maat_private.premium_entitlements enable row level security;
alter table maat_private.premium_access_requests enable row level security;
alter table maat_private.premium_access_events enable row level security;
revoke all on maat_private.premium_entitlements, maat_private.premium_access_requests,
  maat_private.premium_access_events from public,anon,authenticated;

create or replace function maat_private.premium_active_for_current_user()
returns boolean language sql stable security definer set search_path='' as $function$
  select auth.uid() is not null and exists(select 1 from maat_private.premium_entitlements e
    where e.user_id=auth.uid() and (now()<e.trial_started_at+interval '30 days' or e.paid_until>now()))
$function$;
revoke all on function maat_private.premium_active_for_current_user() from public,anon;
grant execute on function maat_private.premium_active_for_current_user() to authenticated,service_role;

-- Premium access is enforced at the database boundary for new collaborative
-- document changes; existing team data stays readable and removable.
drop policy if exists task_documents_insert on public.taskboard_shared_task_documents;
create policy task_documents_insert on public.taskboard_shared_task_documents
 for insert to authenticated with check(
  uploaded_by=(select auth.uid()) and public.taskboard_edit_team(team_id)
  and maat_private.premium_active_for_current_user()
  and exists(select 1 from public.taskboard_shared_tasks t
   where t.id=taskboard_shared_task_documents.task_id
    and t.team_id=taskboard_shared_task_documents.team_id)
 );
drop policy if exists task_documents_update on public.taskboard_shared_task_documents;
create policy task_documents_update on public.taskboard_shared_task_documents
 for update to authenticated using(public.taskboard_edit_team(team_id)
   and maat_private.premium_active_for_current_user())
 with check(public.taskboard_edit_team(team_id) and maat_private.premium_active_for_current_user());
create or replace function public.set_taskboard_central_document(document_uuid uuid)
returns void language plpgsql security invoker set search_path='' as $function$
declare target_task uuid;
begin
 if not maat_private.premium_active_for_current_user() then raise exception 'Premium access required' using errcode='42501';end if;
 select d.task_id into target_task from public.taskboard_shared_task_documents d
  where d.id=document_uuid and public.taskboard_edit_team(d.team_id);
 if target_task is null then raise exception 'Document inaccessible' using errcode='42501';end if;
 update public.taskboard_shared_task_documents set is_central=false
  where task_id=target_task and is_central;
 update public.taskboard_shared_task_documents set is_central=true
  where id=document_uuid and task_id=target_task;
 if not found then raise exception 'Document inaccessible' using errcode='42501';end if;
end
$function$;
revoke all on function public.set_taskboard_central_document(uuid) from public,anon;
grant execute on function public.set_taskboard_central_document(uuid) to authenticated;

drop policy if exists task_docs_insert on storage.objects;
create policy task_docs_insert on storage.objects for insert to authenticated with check(
 bucket_id='team-task-documents' and maat_private.premium_active_for_current_user() and exists(
  select 1 from public.taskboard_shared_task_documents d
  where d.id::text=storage.filename(name) and d.object_path=name
   and d.team_id::text=(storage.foldername(name))[1]
   and d.task_id::text=(storage.foldername(name))[2]
   and d.uploaded_by=(select auth.uid()) and public.taskboard_edit_team(d.team_id)));
drop policy if exists task_docs_gate_insert on storage.objects;
create policy task_docs_gate_insert on storage.objects as restrictive for insert to authenticated with check(
 bucket_id<>'team-task-documents' or (maat_private.premium_active_for_current_user() and exists(
  select 1 from public.taskboard_shared_task_documents d
  where d.id::text=storage.filename(name) and d.object_path=name
   and d.team_id::text=(storage.foldername(name))[1]
   and d.task_id::text=(storage.foldername(name))[2]
   and d.uploaded_by=(select auth.uid()) and public.taskboard_edit_team(d.team_id))));

-- Every account's trial begins at its actual creation time, including accounts
-- that existed before Premium was introduced.
insert into maat_private.premium_entitlements(user_id,trial_started_at)
select u.id,u.created_at
from auth.users u on conflict(user_id) do nothing;

create or replace function maat_private.start_premium_trial()
returns trigger language plpgsql security definer set search_path='' as $function$
begin
  insert into maat_private.premium_entitlements(user_id,trial_started_at)
  values(new.id,new.created_at) on conflict(user_id) do nothing;
  return new;
end
$function$;
revoke all on function maat_private.start_premium_trial() from public,anon,authenticated;
drop trigger if exists start_premium_trial_after_signup on auth.users;
create trigger start_premium_trial_after_signup after insert on auth.users
  for each row execute function maat_private.start_premium_trial();

create or replace function public.taskboard_premium_status()
returns jsonb language sql stable security definer set search_path='' as $function$
  select case when auth.uid() is null then '{}'::jsonb else coalesce((
    select jsonb_build_object(
      'trialStartedAt',e.trial_started_at,
      'trialEndsAt',e.trial_started_at+interval '30 days',
      'trialActive',now()<e.trial_started_at+interval '30 days',
      'paidUntil',e.paid_until,
      'paidActive',coalesce(e.paid_until>now(),false),
      'active',now()<e.trial_started_at+interval '30 days' or coalesce(e.paid_until>now(),false),
      'pendingRequest',q.id is not null,
      'requestStatus',q.status,
      'requestedTariff',q.requested_tariff,
      'requestCreatedAt',q.created_at
    )
    from maat_private.premium_entitlements e
    left join lateral (select r.id,r.status,r.requested_tariff,r.created_at
      from maat_private.premium_access_requests r where r.user_id=e.user_id
      order by r.created_at desc,r.id desc limit 1) q on true
    where e.user_id=auth.uid()
  ),'{}'::jsonb) end
$function$;
revoke all on function public.taskboard_premium_status() from public,anon;
grant execute on function public.taskboard_premium_status() to authenticated;

create or replace function public.taskboard_request_premium_access(
  requested_tariff text,payment_reference text default null,request_note text default null)
returns uuid language plpgsql security definer set search_path='' as $function$
declare actor uuid:=auth.uid(); entitlement maat_private.premium_entitlements%rowtype; new_request uuid;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501';end if;
  if char_length(btrim(coalesce(requested_tariff,''))) not between 1 and 80
    or payment_reference is not null and char_length(btrim(payment_reference)) not between 1 and 120
    or request_note is not null and char_length(btrim(request_note))>1000 then
    raise exception 'Invalid request' using errcode='22023';end if;
  select * into entitlement from maat_private.premium_entitlements where user_id=actor for update;
  if entitlement.user_id is null then raise exception 'Premium trial unavailable' using errcode='P0002';end if;
  if now()<entitlement.trial_started_at+interval '30 days' or entitlement.paid_until>now() then
    raise exception 'Premium access is already active' using errcode='PT409';end if;
  insert into maat_private.premium_access_requests(user_id,requested_tariff,payment_reference,note)
    values(actor,btrim(requested_tariff),nullif(btrim(payment_reference),''),nullif(btrim(request_note),''))
    returning id into new_request;
  insert into maat_private.premium_access_events(request_id,user_id,action)
    values(new_request,actor,'request_created');
  return new_request;
end
$function$;
revoke all on function public.taskboard_request_premium_access(text,text,text) from public,anon;
grant execute on function public.taskboard_request_premium_access(text,text,text) to authenticated;

create or replace function maat_private.review_premium_request(
  actor uuid,session uuid,request_uuid uuid,operation text,validity integer default null,
  action_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare request_row maat_private.premium_access_requests%rowtype; fresh boolean;
begin
  if actor is null or request_uuid is null or operation not in ('approve','reject')
    or action_note is null or char_length(btrim(action_note)) not between 10 and 500
    or operation='approve' and (validity is null or validity not in (30,90,365))
    or operation='reject' and validity is not null then
    raise exception 'Invalid review' using errcode='22023';end if;
  if not exists(select 1 from auth.users u where u.id=actor and u.email_confirmed_at is not null)
    or exists(select 1 from public.taskboard_account_status s where s.user_id=actor and s.suspended)
    or exists(select 1 from public.taskboard_account_deletions d where d.user_id=actor and d.status='processing')
    or not exists(select 1 from maat_private.admin_members m where m.user_id=actor
      and ('users_manage'=any(m.permissions) or exists(select 1 from maat_private.admin_control c
        where c.singleton and c.principal_id=actor))) then
    raise exception 'Premium reviewer required' using errcode='42501';end if;
  select s.created_at>now()-interval '10 minutes' into fresh from auth.sessions s
    where s.id=session and s.user_id=actor and (s.not_after is null or s.not_after>now());
  if fresh is distinct from true then raise exception 'Recent sign-in required' using errcode='PT401';end if;
  select * into request_row from maat_private.premium_access_requests where id=request_uuid for update;
  if request_row.id is null or request_row.status<>'pending' then
    raise exception 'Request unavailable' using errcode='PT409';end if;
  update maat_private.premium_access_requests set status=case operation when 'approve' then 'approved' else 'rejected' end,
    reviewed_at=now(),reviewed_by=actor,validity_days=validity,admin_note=btrim(action_note)
    where id=request_uuid;
  if operation='approve' then
    update maat_private.premium_entitlements set
      paid_until=greatest(now(),coalesce(paid_until,now()))+make_interval(days=>validity),updated_at=now()
      where user_id=request_row.user_id;
  end if;
  insert into maat_private.premium_access_events(request_id,user_id,actor_id,action,details)
    values(request_uuid,request_row.user_id,actor,operation,jsonb_build_object('validityDays',validity,'note',btrim(action_note)));
  return jsonb_build_object('success',true,'status',case operation when 'approve' then 'approved' else 'rejected' end);
end
$function$;
revoke all on function maat_private.review_premium_request(uuid,uuid,uuid,text,integer,text) from public,anon,authenticated;
grant execute on function maat_private.review_premium_request(uuid,uuid,uuid,text,integer,text) to service_role;

create or replace function maat_private.list_premium_requests(actor uuid,session uuid)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare fresh boolean; results jsonb;
begin
  if not exists(select 1 from auth.users u where u.id=actor and u.email_confirmed_at is not null)
    or exists(select 1 from public.taskboard_account_status s where s.user_id=actor and s.suspended)
    or not exists(select 1 from maat_private.admin_members m where m.user_id=actor
      and ('users_manage'=any(m.permissions) or exists(select 1 from maat_private.admin_control c
        where c.singleton and c.principal_id=actor))) then
    raise exception 'Premium reviewer required' using errcode='42501';end if;
  select s.created_at>now()-interval '10 minutes' into fresh from auth.sessions s
    where s.id=session and s.user_id=actor and (s.not_after is null or s.not_after>now());
  if fresh is distinct from true then raise exception 'Recent sign-in required' using errcode='PT401';end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'userId',r.user_id,'email',u.email,'requestedTariff',r.requested_tariff,
    'paymentReference',r.payment_reference,'note',r.note,'status',r.status,'createdAt',r.created_at)
    order by r.created_at,r.id),'[]'::jsonb) into results
  from maat_private.premium_access_requests r join auth.users u on u.id=r.user_id
  where r.status='pending';
  return results;
end
$function$;
revoke all on function maat_private.list_premium_requests(uuid,uuid) from public,anon,authenticated;
grant execute on function maat_private.list_premium_requests(uuid,uuid) to service_role;

create or replace function public.taskboard_admin_premium_requests(actor uuid,session uuid)
returns jsonb language sql security invoker set search_path='' as $function$
  select maat_private.list_premium_requests(actor,session);
$function$;
create or replace function public.taskboard_admin_review_premium(
  actor uuid,session uuid,request_uuid uuid,operation text,validity integer default null,
  action_note text default null)
returns jsonb language sql security invoker set search_path='' as $function$
  select maat_private.review_premium_request(actor,session,request_uuid,operation,validity,action_note);
$function$;
revoke all on function public.taskboard_admin_premium_requests(uuid,uuid) from public,anon,authenticated;
revoke all on function public.taskboard_admin_review_premium(uuid,uuid,uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.taskboard_admin_premium_requests(uuid,uuid) to service_role;
grant execute on function public.taskboard_admin_review_premium(uuid,uuid,uuid,text,integer,text) to service_role;

commit;
