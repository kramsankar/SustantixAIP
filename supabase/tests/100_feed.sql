-- Phase 5 proof: the change feed tells every member of a tenant which records changed (whoever changed them) without
-- revealing who changed them or the values, re-sends an overlap after the cursor, and is closed to other tenants.
\set ON_ERROR_STOP 1

set role authenticated;
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000003', false);
do $$
begin
  perform aip.apply_change_set('55555555-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'grid', $j$[
    {"entity":"work_order","op":"insert","code":"WO-A-FEED1","values":{"site":"SITE-A","asset":"AST-A-1","description":"Feed"}},
    {"entity":"work_order","op":"insert","code":"WO-A-FEED2","values":{"site":"SITE-A","asset":"AST-A-1","description":"Feed"}}
  ]$j$);
end $$;

-- A planner cannot read the administrator's change set, yet learns which records it changed.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
do $$
declare f jsonb; n int; mine jsonb;
begin
  select count(*) into n from aip.change_set where id = '55555555-0000-0000-0000-000000000001';
  if n <> 0 then raise exception 'precondition: planner reads another member''s change set'; end if;
  f := aip.change_feed('00000000-0000-0000-0000-00000000000a', null);
  if f->'items' <> '[]'::jsonb or f->>'cursor' is null or (f->>'truncated')::boolean then raise exception 'first call is not cursor-only: %', f; end if;
  -- The overlap re-sends what was applied shortly before the cursor.
  f := aip.change_feed('00000000-0000-0000-0000-00000000000a', (f->>'cursor')::timestamptz);
  select jsonb_agg(i) into mine from jsonb_array_elements(f->'items') i where i->>'changeSet' = '55555555-0000-0000-0000-000000000001';
  if jsonb_array_length(coalesce(mine, '[]')) <> 2 then raise exception 'feed misses the change set: %', f; end if;
  if (select count(*) from jsonb_array_elements(mine) i where i ?| array['actor','values','record']) <> 0 then raise exception 'feed reveals actor or values: %', mine; end if;
  if mine->0->>'code' <> 'WO-A-FEED1' or mine->1->>'op' <> 'insert' or mine->0->>'entity' <> 'work_order' then raise exception 'feed items wrong: %', mine; end if;
  -- A cursor in the future (past the overlap) has nothing new.
  f := aip.change_feed('00000000-0000-0000-0000-00000000000a', now() + interval '1 hour');
  if jsonb_array_length(f->'items') <> 0 then raise exception 'feed returns changes after the cursor'; end if;
  -- A page that slept for over a day reloads in full.
  f := aip.change_feed('00000000-0000-0000-0000-00000000000a', now() - interval '2 days');
  if not (f->>'truncated')::boolean or jsonb_array_length(f->'items') <> 0 then raise exception 'stale cursor not marked truncated: %', f; end if;
end $$;

-- Tenant B's member learns nothing about tenant A.
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
do $$
begin
  begin
    perform aip.change_feed('00000000-0000-0000-0000-00000000000a', now() - interval '1 minute');
    raise exception 'isolation breach: tenant B read tenant A''s feed';
  exception when insufficient_privilege then null;
  end;
  if jsonb_array_length(aip.change_feed('00000000-0000-0000-0000-00000000000b', now() - interval '1 minute')->'items') <> 0 then
    raise exception 'tenant B feed carries tenant A changes';
  end if;
end $$;
reset role;

-- Anonymous callers cannot reach it at all.
do $$
begin
  if has_function_privilege('anon', 'aip.change_feed(uuid, timestamptz)', 'execute') then raise exception 'anon may call the feed'; end if;
end $$;
\echo 'feed: every member sees which records changed, never who or what; overlap re-sent; stale cursors reload; tenant-isolated'
