-- Phase 3 proof: planners write transactions, only administrators write time series, links and transactions stay in
-- their tenant, and compatibility views apply the caller's row-level security.
\set ON_ERROR_STOP 1

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
do $$
declare n int;
begin
  insert into aip.work_order(tenant_id, code, site_id, asset_id, description, source_ordinal)
  select '00000000-0000-0000-0000-00000000000a', 'WO-A-1', s.id, a.id, 'Replace fan', 1 from aip.site s, aip.asset a where s.code = 'SITE-A' and a.code = 'AST-A-1';
  insert into aip.record_link(tenant_id, code, from_entity, from_code, link_type, to_entity, to_code)
  values ('00000000-0000-0000-0000-00000000000a', 'intervention:INT-A-1>executed_by>work_order:WO-A-1', 'intervention', 'INT-A-1', 'executed_by', 'work_order', 'WO-A-1');
  begin
    insert into aip.plant_telemetry(tenant_id, code, at, site_id) select '00000000-0000-0000-0000-00000000000a', 'X', now(), s.id from aip.site s where s.code = 'SITE-A';
    raise exception 'planner A wrote telemetry';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from aip_compat.work_orders;
  if n <> 1 then raise exception 'compat view shows planner A % work orders, expected 1', n; end if;
  select count(*) into n from aip_compat.work_orders where work_order_id = 'WO-A-1' and asset_id = 'AST-A-1' and plant_id = 'SITE-A' and asset_tag = 'A-INV-001';
  if n <> 1 then raise exception 'compat view does not rebuild the sheet row from the normalized one'; end if;
end $$;

select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000003', false);
do $$
begin
  insert into aip.plant_telemetry(tenant_id, code, at, site_id, actual_ac_mw, source_ordinal)
  select '00000000-0000-0000-0000-00000000000a', '2026-08-01 12:00 | SITE-A', '2026-08-01 12:00', s.id, 42.5, 1 from aip.site s where s.code = 'SITE-A';
end $$;

select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
do $$
declare n int;
begin
  select count(*) into n from aip_compat.work_orders;
  if n <> 0 then raise exception 'isolation breach: viewer B sees % compat work orders', n; end if;
  select count(*) into n from aip_compat.twin_telemetry;
  if n <> 0 then raise exception 'isolation breach: viewer B sees % telemetry rows', n; end if;
  select count(*) into n from aip.record_link;
  if n <> 0 then raise exception 'isolation breach: viewer B sees % links', n; end if;
end $$;
reset role;

do $$
declare n int;
begin
  select count(*) into n from aip.audit_log where entity = 'work_order' and entity_key = 'WO-A-1';
  if n <> 1 then raise exception 'work order not audited'; end if;
end $$;
\echo 'transactions: planner-written, telemetry admin-only, compat views under RLS, audited'
