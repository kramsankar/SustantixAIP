-- Tenant isolation proof: a member of tenant A can neither read nor write tenant B,
-- viewers cannot write, and the audit log is append-only. Fails loudly on any breach.
\set ON_ERROR_STOP 1
insert into auth.users(id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'planner.a@tenant-a.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'viewer.b@tenant-b.test')
on conflict do nothing;
insert into aip.tenants(id, name, region, default_currency) values
  ('00000000-0000-0000-0000-00000000000a', 'Tenant A', 'IN', 'INR'),
  ('00000000-0000-0000-0000-00000000000b', 'Tenant B', 'AE', 'AED')
on conflict do nothing;
insert into aip.tenant_members(tenant_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'planner'),
  ('00000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002', 'viewer')
on conflict do nothing;
insert into aip."work_orders"(tenant_id, row_key, work_order_id, estimated_cost, currency) values
  ('00000000-0000-0000-0000-00000000000a', 'WO-A-1', 'WO-A-1', 1000.50, 'INR'),
  ('00000000-0000-0000-0000-00000000000b', 'WO-B-1', 'WO-B-1', 2000.25, 'AED');

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
do $$
declare n int;
begin
  select count(*) into n from aip."work_orders";
  if n <> 1 then raise exception 'isolation breach: planner A sees % work orders', n; end if;
  update aip."work_orders" set estimated_cost = 1 where row_key = 'WO-B-1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'isolation breach: planner A updated tenant B'; end if;
  begin
    insert into aip."work_orders"(tenant_id, row_key, work_order_id) values ('00000000-0000-0000-0000-00000000000b', 'X', 'X');
    raise exception 'isolation breach: planner A inserted into tenant B';
  exception when insufficient_privilege then null;
  end;
  update aip."work_orders" set estimated_cost = 1100 where row_key = 'WO-A-1';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'planner A could not update own tenant'; end if;
end $$;

select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
do $$
declare n int;
begin
  select count(*) into n from aip."work_orders";
  if n <> 1 then raise exception 'isolation breach: viewer B sees % work orders', n; end if;
  update aip."work_orders" set estimated_cost = 1 where row_key = 'WO-B-1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'viewer B was able to write'; end if;
  select count(*) into n from aip.audit_log;
  if n <> 0 then raise exception 'viewer B can read the audit log'; end if;
  select count(*) into n from aip.license_clock;
  raise exception 'viewer B can read license_clock';
exception when insufficient_privilege then null;
end $$;
reset role;

do $$
declare n int;
begin
  select count(*) into n from aip.audit_log where entity = 'work_orders' and action = 'update';
  if n <> 1 then raise exception 'expected exactly one audited update, found %', n; end if;
  begin
    update aip.audit_log set action = 'tampered';
    raise exception 'audit log accepted an update';
  exception when raise_exception then
    if sqlerrm not like '%append-only%' then raise; end if;
  end;
end $$;
select 'RLS isolation: PASS' as result;
