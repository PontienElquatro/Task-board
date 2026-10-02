-- Maat-test ONLY. First create fixture A's workspace with expected_revision=0.
-- Run this transaction concurrently in TWO SQL connections against revision 1.
-- Expect one saved/revision 2 and one stale/code PT409; inspect the final row.
begin;
create function pg_temp.run_race() returns jsonb language plpgsql security invoker as $$
declare result bigint;
begin
  result:=public.save_taskboard_workspace_for_user('00000000-0000-4000-8000-000000000061',1,'{"fixture":"race"}');
  perform pg_sleep(2);
  return jsonb_build_object('outcome','saved','revision',result);
exception when sqlstate 'PT409' then return jsonb_build_object('outcome','stale','code','PT409');
end;$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000061","role":"authenticated"}',true);
select pg_temp.run_race() as result;
commit;
