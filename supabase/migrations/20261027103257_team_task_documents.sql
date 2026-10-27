begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('team-task-documents','team-task-documents',false,20971520,array[
 'application/pdf','image/jpeg','image/png','image/webp','text/plain','text/csv',
 'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,
 allowed_mime_types=excluded.allowed_mime_types;

create table public.taskboard_shared_task_documents (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null,
 team_id uuid not null,
 uploaded_by uuid default auth.uid() references auth.users(id) on delete set null,
 file_name text not null check(char_length(btrim(file_name)) between 1 and 255
  and position('/' in file_name)=0 and position(chr(92) in file_name)=0),
 content_type text not null check(content_type=any(array[
  'application/pdf','image/jpeg','image/png','image/webp','text/plain','text/csv',
  'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
 ])),
 size_bytes bigint not null check(size_bytes between 1 and 20971520),
 object_path text not null unique,
 is_central boolean not null default false,
 created_at timestamptz not null default now(),
 constraint taskboard_shared_task_documents_task_team_fkey
  foreign key(task_id,team_id) references public.taskboard_shared_tasks(id,team_id) on delete cascade,
 constraint taskboard_shared_task_documents_path_check
  check(object_path=team_id::text||'/'||task_id::text||'/'||id::text)
);
create index taskboard_shared_task_documents_task_created_idx
 on public.taskboard_shared_task_documents(task_id,created_at desc);
create unique index taskboard_shared_task_documents_one_central_idx
 on public.taskboard_shared_task_documents(task_id) where is_central;

alter table public.taskboard_shared_task_documents enable row level security;
revoke all on public.taskboard_shared_task_documents from public,anon,authenticated;
grant select,delete on public.taskboard_shared_task_documents to authenticated;
grant insert(id,task_id,team_id,file_name,content_type,size_bytes,object_path)
 on public.taskboard_shared_task_documents to authenticated;
grant update(is_central) on public.taskboard_shared_task_documents to authenticated;

create policy task_documents_read on public.taskboard_shared_task_documents
 for select to authenticated using(public.is_taskboard_team_member(team_id));
create policy task_documents_insert on public.taskboard_shared_task_documents
 for insert to authenticated with check(
  uploaded_by=(select auth.uid()) and public.taskboard_edit_team(team_id)
  and exists(select 1 from public.taskboard_shared_tasks t
   where t.id=taskboard_shared_task_documents.task_id
    and t.team_id=taskboard_shared_task_documents.team_id)
 );
create policy task_documents_update on public.taskboard_shared_task_documents
 for update to authenticated using(public.taskboard_edit_team(team_id))
 with check(public.taskboard_edit_team(team_id));
create policy task_documents_delete on public.taskboard_shared_task_documents
 for delete to authenticated using(public.taskboard_edit_team(team_id));

create or replace function public.set_taskboard_central_document(document_uuid uuid)
returns void language plpgsql security invoker set search_path='' as $function$
declare target_task uuid;
begin
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

drop policy if exists task_docs_select on storage.objects;
drop policy if exists task_docs_insert on storage.objects;
drop policy if exists task_docs_update on storage.objects;
drop policy if exists task_docs_delete on storage.objects;
drop policy if exists task_docs_gate_select on storage.objects;
drop policy if exists task_docs_gate_insert on storage.objects;
drop policy if exists task_docs_gate_update on storage.objects;
drop policy if exists task_docs_gate_delete on storage.objects;

create policy task_docs_select on storage.objects for select to authenticated using(
 bucket_id='team-task-documents' and exists(select 1 from public.taskboard_shared_task_documents d
  where d.id::text=storage.filename(name) and d.object_path=name
   and d.team_id::text=(storage.foldername(name))[1]
   and d.task_id::text=(storage.foldername(name))[2]
   and public.is_taskboard_team_member(d.team_id)));
create policy task_docs_insert on storage.objects for insert to authenticated with check(
 bucket_id='team-task-documents' and exists(select 1 from public.taskboard_shared_task_documents d
  where d.id::text=storage.filename(name) and d.object_path=name
   and d.team_id::text=(storage.foldername(name))[1]
   and d.task_id::text=(storage.foldername(name))[2]
   and d.uploaded_by=(select auth.uid()) and public.taskboard_edit_team(d.team_id)));
create policy task_docs_update on storage.objects for update to authenticated using(
 bucket_id='team-task-documents' and exists(select 1 from public.taskboard_shared_task_documents d
  where d.id::text=storage.filename(name) and d.object_path=name
   and d.team_id::text=(storage.foldername(name))[1]
   and d.task_id::text=(storage.foldername(name))[2]
   and public.taskboard_edit_team(d.team_id))) with check(
 bucket_id='team-task-documents' and exists(select 1 from public.taskboard_shared_task_documents d
  where d.id::text=storage.filename(name) and d.object_path=name
   and d.team_id::text=(storage.foldername(name))[1]
   and d.task_id::text=(storage.foldername(name))[2]
   and public.taskboard_edit_team(d.team_id)));
create policy task_docs_delete on storage.objects for delete to authenticated using(
 bucket_id='team-task-documents' and exists(select 1 from public.taskboard_shared_task_documents d
  where d.id::text=storage.filename(name) and d.object_path=name
   and d.team_id::text=(storage.foldername(name))[1]
   and d.task_id::text=(storage.foldername(name))[2]
   and public.taskboard_edit_team(d.team_id)));

-- An existing permissive catch-all Storage policy would otherwise bypass the
-- bucket-specific policies above. Restrictive policies intersect with it.
create policy task_docs_gate_select on storage.objects as restrictive for select to authenticated using(
 bucket_id<>'team-task-documents' or exists(select 1 from public.taskboard_shared_task_documents d
  where d.id::text=storage.filename(name) and d.object_path=name
   and d.team_id::text=(storage.foldername(name))[1]
   and d.task_id::text=(storage.foldername(name))[2]
   and public.is_taskboard_team_member(d.team_id)));
create policy task_docs_gate_insert on storage.objects as restrictive for insert to authenticated with check(
 bucket_id<>'team-task-documents' or exists(select 1 from public.taskboard_shared_task_documents d
  where d.id::text=storage.filename(name) and d.object_path=name
   and d.team_id::text=(storage.foldername(name))[1]
   and d.task_id::text=(storage.foldername(name))[2]
   and d.uploaded_by=(select auth.uid()) and public.taskboard_edit_team(d.team_id)));
create policy task_docs_gate_update on storage.objects as restrictive for update to authenticated using(
 bucket_id<>'team-task-documents' or exists(select 1 from public.taskboard_shared_task_documents d
  where d.id::text=storage.filename(name) and d.object_path=name
   and d.team_id::text=(storage.foldername(name))[1]
   and d.task_id::text=(storage.foldername(name))[2]
   and public.taskboard_edit_team(d.team_id))) with check(
 bucket_id<>'team-task-documents' or exists(select 1 from public.taskboard_shared_task_documents d
  where d.id::text=storage.filename(name) and d.object_path=name
   and d.team_id::text=(storage.foldername(name))[1]
   and d.task_id::text=(storage.foldername(name))[2]
   and public.taskboard_edit_team(d.team_id)));
create policy task_docs_gate_delete on storage.objects as restrictive for delete to authenticated using(
 bucket_id<>'team-task-documents' or exists(select 1 from public.taskboard_shared_task_documents d
  where d.id::text=storage.filename(name) and d.object_path=name
   and d.team_id::text=(storage.foldername(name))[1]
   and d.task_id::text=(storage.foldername(name))[2]
   and public.taskboard_edit_team(d.team_id)));

-- Keep shared team files when their uploader deletes their account.
create or replace function maat_private.deletion_step(account uuid,token uuid,operation text)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare item public.taskboard_account_deletions%rowtype; account_email text; objects jsonb;
begin
 select lower(email) into account_email from auth.users where id=account for update;
 if not found then return jsonb_build_object('deleted',true);end if;
 select * into item from public.taskboard_account_deletions d where d.user_id=account for update;
 if item.status is distinct from 'processing' or token is null or item.claim_token is distinct from token then
  raise exception 'Invalid reservation' using errcode='42501';end if;
 if operation='retry' then
  update public.taskboard_account_deletions set claim_token=null,retry_after=now()+interval '15 minutes' where user_id=account;
  insert into maat_private.account_deletion_events(user_id,outcome) values(account,'retry');
  return '{}'::jsonb;
 end if;
 if exists(select 1 from public.taskboard_teams where owner_id=account)
  or exists(select 1 from public.taskboard_admin_allowlist where email=account_email)
 then raise exception 'Protected account' using errcode='42501';end if;
 if operation='objects' then
  select coalesce(jsonb_agg(jsonb_build_object('bucket',o.bucket_id,'name',o.name)),'[]'::jsonb) into objects
  from (select bucket_id,name from storage.objects where bucket_id<>'team-task-documents'
   and (owner_id=account::text or owner=account or (bucket_id='avatars' and split_part(name,'/',1)=account::text))
   order by bucket_id,name limit 100) o;
  return objects;
 elsif operation='check' then return '{}'::jsonb;
 else raise exception 'Invalid operation' using errcode='22023';end if;
end
$function$;
revoke all on function maat_private.deletion_step(uuid,uuid,text) from public,anon,authenticated;
grant execute on function maat_private.deletion_step(uuid,uuid,text) to service_role;

create or replace function maat_private.guard_deletion()
returns trigger language plpgsql security definer set search_path='' as $function$
declare item public.taskboard_account_deletions%rowtype;
begin
 select * into item from public.taskboard_account_deletions where user_id=old.id;
 if item.status='processing' then
  lock table public.taskboard_admin_allowlist in share mode;
  if item.claim_token is null
   or exists(select 1 from public.taskboard_teams where owner_id=old.id)
   or exists(select 1 from public.taskboard_admin_allowlist where email=lower(old.email))
   or exists(select 1 from storage.objects where (owner_id=old.id::text or owner=old.id) and bucket_id<>'team-task-documents')
   or exists(select 1 from storage.objects where bucket_id='avatars' and split_part(name,'/',1)=old.id::text)
  then raise exception 'Account cleanup incomplete or protected' using errcode='42501';end if;
  insert into maat_private.account_deletion_events(user_id,outcome) values(old.id,'deleted');
 end if;
 return old;
end
$function$;
revoke all on function maat_private.guard_deletion() from public,anon,authenticated;

commit;
