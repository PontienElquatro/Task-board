-- Read-only catalog audit. Contains no workspace contents, emails or session tokens.
select c.relname,c.relrowsecurity,
  has_table_privilege('anon',c.oid,'SELECT') as anon_read,
  has_table_privilege('authenticated',c.oid,'SELECT') as client_read,
  has_table_privilege('authenticated',c.oid,'INSERT') as client_insert,
  has_table_privilege('authenticated',c.oid,'UPDATE') as client_update,
  has_table_privilege('authenticated',c.oid,'DELETE') as client_delete
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('taskboard_workspaces','taskboard_admin_allowlist','taskboard_admin_audit');
select tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname='public' and tablename like 'taskboard_%';
select p.proname,p.prosecdef,p.proconfig,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as client_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname like 'save_taskboard_workspace%';
