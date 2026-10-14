-- Service-only global search, applied before pagination. No invitation secrets
-- or private project/task contents are exposed by this projection.
create or replace function maat_private.admin_team_directory(search_query text default '', requested_page integer default 1)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  term text := lower(btrim(coalesce(search_query, '')));
begin
  if requested_page < 1 or requested_page > 10000 or requested_page is null or length(term) > 120 then
    raise exception 'Invalid team directory query' using errcode = '22023';
  end if;
  -- strpos deliberately treats %, _, commas and quotes as literal input.
  with matching as materialized (
    select t.id, t.name, t.owner_id, t.created_at, coalesce(u.email, '') as owner_email
    from public.taskboard_teams t
    left join auth.users u on u.id = t.owner_id
    where term = '' or strpos(lower(t.name), term) > 0
      or strpos(lower(coalesce(u.email, '')), term) > 0
      or strpos(t.id::text, term) > 0
      or strpos(t.owner_id::text, term) > 0
  ), page_rows as (
    select * from matching order by created_at desc, id desc
    limit 50 offset (requested_page - 1) * 50
  )
  select jsonb_build_object(
    'teams', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc, p.id desc) from page_rows p), '[]'::jsonb),
    'total', (select count(*) from matching), 'page', requested_page
  ) into result;
  return result;
end;
$$;
revoke all on function maat_private.admin_team_directory(text, integer) from public, anon, authenticated;
grant execute on function maat_private.admin_team_directory(text, integer) to service_role;
create or replace function public.taskboard_admin_team_directory(search_query text default '', requested_page integer default 1)
returns jsonb language sql security invoker set search_path='' as $$
  select maat_private.admin_team_directory(search_query,requested_page);
$$;
revoke all on function public.taskboard_admin_team_directory(text, integer) from public, anon, authenticated;
grant execute on function public.taskboard_admin_team_directory(text, integer) to service_role;
