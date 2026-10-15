create policy admin_allowlist_deny_client on public.taskboard_admin_allowlist for all to anon, authenticated using (false) with check (false);
create policy admin_audit_deny_client on public.taskboard_admin_audit for all to anon, authenticated using (false) with check (false);
