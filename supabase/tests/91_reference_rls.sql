-- Reference-layer proof: platform defaults are readable by every member and writable by nobody
-- through the API; tenant rows stay inside their tenant, need the admin role, are audited and versioned.
\set ON_ERROR_STOP 1
insert into auth.users(id, email) values
  ('cccccccc-0000-0000-0000-000000000003', 'admin.a@tenant-a.test')
on conflict do nothing;
insert into aip.tenant_members(tenant_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'cccccccc-0000-0000-0000-000000000003', 'admin')
on conflict do nothing;

do $$
declare n int;
begin
  select count(*) into n from aip.ref_priority where tenant_id is null;
  if n <> 4 then raise exception 'expected 4 platform priorities, found %', n; end if;
  select count(*) into n from aip.ref_status where tenant_id is null and scope = 'work_order';
  if n < 6 then raise exception 'work-order statuses missing (%)', n; end if;
  select count(*) into n from aip.ref_alias where tenant_id is null and ref_table = 'unit' and currency = 'INR';
  if n < 8 then raise exception 'currency-bearing unit aliases missing (%)', n; end if;
  select count(*) into n from aip.ref_binding;
  if n < 100 then raise exception 'reference bindings missing (%)', n; end if;
end $$;

set role authenticated;

-- Tenant A administrator: may extend the vocabulary for tenant A only.
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000003', false);
insert into aip.ref_priority(tenant_id, code, label, rank) values ('00000000-0000-0000-0000-00000000000a', 'URGENT', 'Urgent', 0);
do $$
declare n int; v bigint;
begin
  update aip.ref_priority set label = 'Urgent (tenant A)' where code = 'URGENT';
  select row_version into v from aip.ref_priority where code = 'URGENT';
  if v <> 2 then raise exception 'row_version not incremented (%)', v; end if;
  update aip.ref_priority set label = 'hijacked' where tenant_id is null;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'admin A changed % platform default(s)', n; end if;
  begin
    insert into aip.ref_priority(tenant_id, code, label) values (null, 'ROGUE', 'Rogue platform row');
    raise exception 'admin A inserted a platform default';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into aip.ref_priority(tenant_id, code, label) values ('00000000-0000-0000-0000-00000000000b', 'ROGUE', 'Rogue');
    raise exception 'admin A inserted into tenant B';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into aip.ref_binding(table_name, column_name, ref_table) values ('x', 'y', 'priority');
    raise exception 'admin A wrote a binding';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Tenant A planner: reads, cannot change the vocabulary.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
do $$
declare n int;
begin
  select count(*) into n from aip.ref_priority;
  if n <> 5 then raise exception 'planner A sees % priorities, expected 4 platform + 1 tenant', n; end if;
  begin
    insert into aip.ref_priority(tenant_id, code, label) values ('00000000-0000-0000-0000-00000000000a', 'LATER', 'Later');
    raise exception 'planner A extended the vocabulary';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Tenant B viewer: platform defaults only.
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
do $$
declare n int;
begin
  select count(*) into n from aip.ref_priority;
  if n <> 4 then raise exception 'isolation breach: viewer B sees % priorities', n; end if;
  select count(*) into n from aip.ref_alias where tenant_id is not null;
  if n <> 0 then raise exception 'isolation breach: viewer B sees tenant aliases'; end if;
end $$;
reset role;

do $$
declare n int;
begin
  select count(*) into n from aip.audit_log where entity = 'ref_priority' and entity_key = 'URGENT' and tenant_id = '00000000-0000-0000-0000-00000000000a';
  if n <> 2 then raise exception 'expected insert + update audit entries for URGENT, found %', n; end if;
  select count(*) into n from aip.audit_log where entity like 'ref_%' and tenant_id is null;
  if n <> 0 then raise exception 'platform defaults leaked into the audit log'; end if;
end $$;
\echo 'reference layer: platform defaults shared, tenant rows isolated, admin-only writes, audited and versioned'
