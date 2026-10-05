-- Phase 4 proof: change sets apply atomically with the caller's own rights, resolve references by business code
-- inside the tenant, refuse a stale row_version with the current row, replay idempotently, tag the audit trail,
-- and saved views and exports follow the same tenant and role rules.
\set ON_ERROR_STOP 1

set role authenticated;

-- Planner A: insert and update work orders in one set; references given as business codes.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
do $$
declare r jsonb; v bigint; n int;
begin
  r := aip.apply_change_set('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'grid', $j$[
    {"entity":"work_order","op":"insert","code":"WO-A-CS1","values":{"site":"SITE-A","asset":"AST-A-1","status":"OPEN","priority":"HIGH","description":"Inspect string","estimated_cost":"1250.75","pm_due_date":"2026-10-20"}},
    {"entity":"work_order","op":"update","code":"WO-A-1","baseVersion":1,"values":{"status":"IN_PROGRESS","sla_hours":48}}
  ]$j$);
  if r->>'replayed' <> 'false' or jsonb_array_length(r->'items') <> 2 then raise exception 'unexpected result %', r; end if;
  if (r->'items'->1->>'rowVersion')::int <> 2 then raise exception 'update did not advance row_version: %', r; end if;
  select count(*) into n from aip.v_work_order where code = 'WO-A-CS1' and site = 'SITE-A' and asset = 'AST-A-1' and status = 'OPEN' and estimated_cost = 1250.75 and currency = 'INR';
  if n <> 1 then raise exception 'inserted work order not as sent'; end if;
  select row_version into v from aip.work_order where code = 'WO-A-1';
  if v <> 2 then raise exception 'WO-A-1 at version %, expected 2', v; end if;

  -- Replaying the same id returns the stored result and changes nothing.
  r := aip.apply_change_set('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'grid', $j$[
    {"entity":"work_order","op":"update","code":"WO-A-1","baseVersion":2,"values":{"sla_hours":1}}
  ]$j$);
  if r->>'replayed' <> 'true' then raise exception 'replay not detected'; end if;
  select row_version into v from aip.work_order where code = 'WO-A-1';
  if v <> 2 then raise exception 'replay changed WO-A-1'; end if;

  -- A stale version is refused with the current row; the whole set rolls back.
  begin
    perform aip.apply_change_set('11111111-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'grid', $j$[
      {"entity":"work_order","op":"update","code":"WO-A-CS1","baseVersion":1,"values":{"sla_hours":12}},
      {"entity":"work_order","op":"update","code":"WO-A-1","baseVersion":1,"values":{"sla_hours":24}}
    ]$j$);
    raise exception 'stale version accepted';
  exception when sqlstate 'AX409' then
    declare d text; begin
      get stacked diagnostics d = pg_exception_detail;
      if (d::jsonb)->'current'->>'row_version' <> '2' or (d::jsonb)->>'code' <> 'WO-A-1' then raise exception 'conflict detail %', d; end if;
    end;
  end;
  select row_version into v from aip.work_order where code = 'WO-A-CS1';
  if v <> 1 then raise exception 'a refused set left a change behind'; end if;

  -- Unknown rows, references outside the tenant, inactive or wrong-scope vocabulary, read-only columns.
  begin
    perform aip.apply_change_set(gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'grid', '[{"entity":"work_order","op":"update","code":"WO-NOPE","baseVersion":1,"values":{"sla_hours":1}}]');
    raise exception 'missing row accepted';
  exception when sqlstate 'AX404' then null;
  end;
  begin
    perform aip.apply_change_set(gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'grid', '[{"entity":"work_order","op":"insert","code":"WO-A-X","values":{"site":"SITE-B"}}]');
    raise exception 'cross-tenant reference accepted';
  exception when foreign_key_violation then null;
  end;
  begin
    perform aip.apply_change_set(gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'grid', '[{"entity":"work_order","op":"insert","code":"WO-A-X","values":{"priority":"B-ONLY"}}]');
    raise exception 'another tenant''s vocabulary accepted';
  exception when foreign_key_violation then null;
  end;
  begin
    perform aip.apply_change_set(gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'grid', '[{"entity":"work_order","op":"insert","code":"WO-A-X","values":{"status":"OPERATIONAL"}}]');
    raise exception 'a status from another scope accepted';
  exception when foreign_key_violation then null;
  end;
  begin
    perform aip.apply_change_set(gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'grid', '[{"entity":"work_order","op":"update","code":"WO-A-1","baseVersion":2,"values":{"source_ordinal":9}}]');
    raise exception 'system column written';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform aip.apply_change_set(gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'grid', '[{"entity":"work_order","op":"insert","code":"WO-A-CS1","values":{}}]');
    raise exception 'duplicate code accepted';
  exception when unique_violation then null;
  end;
  begin
    perform aip.apply_change_set(gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'grid', '[{"entity":"work_order","op":"update","code":"WO-A-1","baseVersion":2,"values":{"sla_hours":"many"}}]');
    raise exception 'untyped value accepted';
  exception when invalid_text_representation then null;
  end;
  -- Planners do not write masters, and nobody writes time series cell by cell.
  begin
    perform aip.apply_change_set(gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'grid', '[{"entity":"site","op":"update","code":"SITE-A","baseVersion":1,"values":{"name":"Renamed"}}]');
    raise exception 'planner wrote a master';
  exception when insufficient_privilege then null;
  end;
  begin
    perform aip.apply_change_set(gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'grid', '[{"entity":"plant_telemetry","op":"delete","code":"x","baseVersion":1}]');
    raise exception 'time series written through a change set';
  exception when insufficient_privilege then null;
  end;
  -- Nor can a planner write into a tenant they do not belong to.
  begin
    perform aip.apply_change_set(gen_random_uuid(), '00000000-0000-0000-0000-00000000000b', 'grid', '[{"entity":"work_order","op":"insert","code":"WO-B-X","values":{}}]');
    raise exception 'planner A wrote tenant B';
  exception when insufficient_privilege then null;
  end;

  -- Delete needs the current version too.
  r := aip.apply_change_set('11111111-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 'runtime', '[{"entity":"work_order","op":"insert","code":"WO-A-TMP","values":{"description":"temporary"}}]');
  r := aip.apply_change_set('11111111-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000a', 'runtime', '[{"entity":"work_order","op":"delete","code":"WO-A-TMP","baseVersion":1}]');
  select count(*) into n from aip.work_order where code = 'WO-A-TMP';
  if n <> 0 then raise exception 'delete did not apply'; end if;

  -- Saved views: personal by default; a planner cannot share one.
  insert into aip.grid_view(tenant_id, grid, name, state) values ('00000000-0000-0000-0000-00000000000a', 'work-orders', 'My open', '{"filters":[{"field":"status","op":"eq","value":"OPEN"}]}');
  begin
    insert into aip.grid_view(tenant_id, grid, name, shared, state) values ('00000000-0000-0000-0000-00000000000a', 'work-orders', 'Team', true, '{}');
    raise exception 'planner shared a view';
  exception when insufficient_privilege then null;
  end;
  perform aip.record_grid_export('00000000-0000-0000-0000-00000000000a', 'work-orders', 'csv', 2, '{"filters":[]}');
end $$;

-- Viewer B: no change sets, no access to tenant A's views, no exports of tenant A.
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
do $$
declare n int;
begin
  begin
    perform aip.apply_change_set(gen_random_uuid(), '00000000-0000-0000-0000-00000000000b', 'grid', '[{"entity":"work_order","op":"insert","code":"WO-B-X","values":{}}]');
    raise exception 'viewer wrote a change set';
  exception when insufficient_privilege then null;
  end;
  begin
    perform aip.record_grid_export('00000000-0000-0000-0000-00000000000a', 'work-orders', 'csv', 2, '{}');
    raise exception 'viewer B exported tenant A';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from aip.grid_view;
  if n <> 0 then raise exception 'isolation breach: viewer B sees % views', n; end if;
  select count(*) into n from aip.change_set;
  if n <> 0 then raise exception 'isolation breach: viewer B sees % change sets', n; end if;
end $$;

-- Administrator A: writes masters and shares a view; sees the planner's change sets but not their personal views.
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000003', false);
do $$
declare n int; r jsonb;
begin
  r := aip.apply_change_set('11111111-0000-0000-0000-000000000005', '00000000-0000-0000-0000-00000000000a', 'grid', $j$[
    {"entity":"site","op":"update","code":"SITE-A","baseVersion":1,"values":{"name":"Site A North","capacity_mw":120,"region":null}}
  ]$j$);
  select count(*) into n from aip.v_site where code = 'SITE-A' and name = 'Site A North' and capacity_mw = 120 and row_version = 2;
  if n <> 1 then raise exception 'administrator update not applied'; end if;
  insert into aip.grid_view(tenant_id, grid, name, shared, state) values ('00000000-0000-0000-0000-00000000000a', 'work-orders', 'Team backlog', true, '{}');
  select count(*) into n from aip.grid_view;
  if n <> 1 then raise exception 'admin sees % views, expected only the shared one', n; end if;
  select count(*) into n from aip.change_set;
  if n <> 4 then raise exception 'admin sees % change sets, expected 4', n; end if;
  begin
    update aip.change_set set source = 'import';
    raise exception 'change set log is not append-only';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Planner A now sees the shared view as well as their own, and cannot change the shared one.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
do $$
declare n int;
begin
  select count(*) into n from aip.grid_view;
  if n <> 2 then raise exception 'planner sees % views, expected 2', n; end if;
  update aip.grid_view set name = 'Hijacked' where shared;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'planner changed a shared view'; end if;
end $$;
reset role;

do $$
declare n int;
begin
  select count(*) into n from aip.audit_log where change_set_id = '11111111-0000-0000-0000-000000000001';
  if n <> 2 then raise exception 'change set 1 left % audit entries, expected 2', n; end if;
  select count(*) into n from aip.audit_log where entity = 'work_order' and entity_key = 'WO-A-TMP' and change_set_id is not null;
  if n <> 2 then raise exception 'insert and delete not both audited under their change sets'; end if;
  select count(*) into n from aip.audit_log where action = 'export' and entity = 'grid' and entity_key = 'work-orders';
  if n <> 1 then raise exception 'export not audited'; end if;
  select count(*) into n from aip.audit_log where entity = 'grid_view';
  if n <> 2 then raise exception 'saved views not audited (%)', n; end if;
  if current_setting('aip.change_set_id', true) is not null and current_setting('aip.change_set_id', true) <> '' then
    raise exception 'change set id leaked out of its transaction';
  end if;
end $$;
\echo 'change sets: atomic, versioned, idempotent, tenant-safe, audited; saved views and exports governed'

-- The Reference Data grid reads platform vocabulary and only the caller's own tenant rows.
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
do $$
declare n int;
begin
  select count(*) into n from aip.v_reference where tenant_id is null and ref_table = 'status' and scope = 'work_order' and code = 'OPEN';
  if n <> 1 then raise exception 'reference view does not show platform vocabulary'; end if;
  select count(*) into n from aip.v_reference where code = 'B-ONLY';
  if n <> 0 then raise exception 'isolation breach: tenant B vocabulary visible to tenant A'; end if;
end $$;
reset role;
\echo 'reference view: platform vocabulary shared, tenant vocabulary isolated'
