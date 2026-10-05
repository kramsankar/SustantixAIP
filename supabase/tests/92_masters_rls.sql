-- Master-data proof (phase 2): masters are administrator-written and registers planner-written, rows stay inside
-- their tenant, a foreign key can never point into another tenant, a controlled value must be a platform default or
-- the tenant's own, and every change is versioned and audited under its business code.
\set ON_ERROR_STOP 1

-- Fixtures (as the migration owner): one site and asset per tenant, a tenant-B-only priority.
insert into aip.site(tenant_id, code, name) values
  ('00000000-0000-0000-0000-00000000000a', 'SITE-A', 'Site A'),
  ('00000000-0000-0000-0000-00000000000b', 'SITE-B', 'Site B')
on conflict do nothing;
insert into aip.ref_priority(tenant_id, code, label) values ('00000000-0000-0000-0000-00000000000b', 'B-ONLY', 'Tenant B priority')
on conflict do nothing;

set role authenticated;

-- Tenant A administrator: writes masters in tenant A only.
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000003', false);
do $$
declare n int; v bigint; site_b uuid; asset_a uuid;
begin
  insert into aip.asset(tenant_id, code, tag, site_id, asset_class_id)
  select '00000000-0000-0000-0000-00000000000a', 'AST-A-1', 'A-INV-1', s.id, c.id
  from aip.site s, aip.ref_asset_class c where s.code = 'SITE-A' and c.tenant_id is null and c.code = 'INVERTER';
  update aip.asset set tag = 'A-INV-001' where code = 'AST-A-1';
  select row_version, id into v, asset_a from aip.asset where code = 'AST-A-1';
  if v <> 2 then raise exception 'row_version not incremented (%)', v; end if;
  select count(*) into n from aip.site;
  if n <> 1 then raise exception 'isolation breach: admin A sees % sites', n; end if;
  begin
    insert into aip.site(tenant_id, code, name) values ('00000000-0000-0000-0000-00000000000b', 'ROGUE', 'Rogue');
    raise exception 'isolation breach: admin A inserted a tenant B site';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Structural guarantees hold even for a writer that bypasses row-level security.
do $$
declare site_b uuid; asset_a uuid; prio_b uuid;
begin
  select id into site_b from aip.site where code = 'SITE-B';
  select id into prio_b from aip.ref_priority where code = 'B-ONLY';
  begin
    update aip.asset set site_id = site_b where code = 'AST-A-1';
    raise exception 'cross-tenant link: tenant A asset now sits on tenant B site';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into aip.intervention(tenant_id, code, priority_id) values ('00000000-0000-0000-0000-00000000000a', 'INT-ROGUE', prio_b);
    raise exception 'cross-tenant vocabulary: tenant A used tenant B priority';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into aip.intervention(tenant_id, code, priority_id) values ('00000000-0000-0000-0000-00000000000a', 'INT-ROGUE', gen_random_uuid());
    raise exception 'unknown controlled value accepted';
  exception when foreign_key_violation then null;
  end;
end $$;

set role authenticated;

-- Tenant A planner: writes registers, reads masters, cannot change them.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
do $$
declare n int;
begin
  insert into aip.intervention(tenant_id, code, site_id, asset_id, priority_id, value_exposure, currency)
  select '00000000-0000-0000-0000-00000000000a', 'INT-A-1', s.id, a.id, p.id, 125000.5, 'INR'
  from aip.site s, aip.asset a, aip.ref_priority p where s.code = 'SITE-A' and a.code = 'AST-A-1' and p.tenant_id is null and p.code = 'HIGH';
  insert into aip.intervention(tenant_id, code, priority_id)
  select '00000000-0000-0000-0000-00000000000a', 'INT-A-2', p.id from aip.ref_priority p where p.code = 'URGENT';
  update aip.asset set tag = 'planner-edit' where code = 'AST-A-1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'planner A changed a master'; end if;
  begin
    insert into aip.site(tenant_id, code, name) values ('00000000-0000-0000-0000-00000000000a', 'SITE-A2', 'Planner site');
    raise exception 'planner A created a master row';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into aip.intervention(tenant_id, code, value_exposure, currency) values ('00000000-0000-0000-0000-00000000000a', 'INT-BAD', 1, 'inr');
    raise exception 'invalid currency accepted';
  exception when check_violation then null;
  end;
end $$;

-- Tenant B viewer: sees nothing of tenant A, writes nothing.
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
do $$
declare n int;
begin
  select count(*) into n from aip.asset;
  if n <> 0 then raise exception 'isolation breach: viewer B sees % assets', n; end if;
  select count(*) into n from aip.intervention;
  if n <> 0 then raise exception 'isolation breach: viewer B sees % interventions', n; end if;
  select count(*) into n from aip.master_lineage where tenant_id = '00000000-0000-0000-0000-00000000000a';
  if n <> 0 then raise exception 'isolation breach: viewer B sees tenant A lineage'; end if;
  update aip.site set name = 'viewer-edit';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'viewer B changed % site(s)', n; end if;
end $$;
reset role;

do $$
declare n int;
begin
  select count(*) into n from aip.audit_log where entity = 'asset' and entity_key = 'AST-A-1' and tenant_id = '00000000-0000-0000-0000-00000000000a';
  if n <> 2 then raise exception 'expected insert + update audit entries for AST-A-1, found %', n; end if;
  select count(*) into n from aip.audit_log where entity = 'intervention' and entity_key in ('INT-A-1', 'INT-A-2');
  if n <> 2 then raise exception 'expected 2 intervention audit entries, found %', n; end if;
end $$;
\echo 'masters: tenant-safe keys, guarded vocabulary, admin-written masters, planner-written registers, versioned and audited'
