-- Phase 5 proof: integrations act as their own tenant member (role rules and audit apply), only the server may act for
-- them, a disabled integration writes nothing, time series load only through import change sets, and the staging
-- ledger is isolated by tenant and keeps what was delivered unchanged.
\set ON_ERROR_STOP 1

insert into auth.users(id, email) values ('eeeeeeee-0000-0000-0000-000000000005', 'integration-test@integrations.sustantix.invalid') on conflict do nothing;
insert into aip.tenant_members(tenant_id, user_id, role) values ('00000000-0000-0000-0000-00000000000a', 'eeeeeeee-0000-0000-0000-000000000005', 'planner') on conflict do nothing;
insert into aip.integration(tenant_id, name, actor, key_hash, entities)
values ('00000000-0000-0000-0000-00000000000a', 'EAM Connector', 'eeeeeeee-0000-0000-0000-000000000005', repeat('a', 64), '{work_order}') on conflict do nothing;

-- The server (service role) applies an integration's change set as the integration's member.
set role service_role;
do $$
declare r jsonb; n int;
begin
  r := aip.apply_change_set_as('eeeeeeee-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'import',
    '[{"entity":"work_order","op":"insert","code":"WO-A-INT1","values":{"site":"SITE-A","asset":"AST-A-1","description":"From EAM"}}]');
  select count(*) into n from aip.change_set where id = '22222222-0000-0000-0000-000000000001' and actor = 'eeeeeeee-0000-0000-0000-000000000005' and source = 'import';
  if n <> 1 then raise exception 'integration change set not recorded under its member'; end if;
  -- Its member is a planner: masters stay out of reach.
  begin
    perform aip.apply_change_set_as('eeeeeeee-0000-0000-0000-000000000005', gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'import', '[{"entity":"site","op":"update","code":"SITE-A","baseVersion":2,"values":{"name":"x"}}]');
    raise exception 'planner integration wrote a master';
  exception when insufficient_privilege then null;
  end;
  -- Nobody acts for a user who is not an enabled integration of the tenant.
  begin
    perform aip.apply_change_set_as('aaaaaaaa-0000-0000-0000-000000000001', gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'import', '[{"entity":"work_order","op":"insert","code":"WO-A-NO","values":{}}]');
    raise exception 'acted for a person through the integration path';
  exception when insufficient_privilege then null;
  end;
  update aip.integration set enabled = false where name = 'EAM Connector';
  begin
    perform aip.apply_change_set_as('eeeeeeee-0000-0000-0000-000000000005', gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'import', '[{"entity":"work_order","op":"insert","code":"WO-A-OFF","values":{}}]');
    raise exception 'disabled integration wrote';
  exception when insufficient_privilege then null;
  end;
  update aip.integration set enabled = true where name = 'EAM Connector';
end $$;
reset role;

do $$
declare n int;
begin
  select count(*) into n from aip.audit_log where entity = 'work_order' and entity_key = 'WO-A-INT1' and actor = 'eeeeeeee-0000-0000-0000-000000000005' and change_set_id = '22222222-0000-0000-0000-000000000001';
  if n <> 1 then raise exception 'integration write not audited under its member and change set'; end if;
end $$;

set role authenticated;
-- People cannot use the integration path.
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000003', false);
do $$
begin
  perform aip.apply_change_set_as('eeeeeeee-0000-0000-0000-000000000005', gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'import', '[]');
  raise exception 'a person called apply_change_set_as';
exception when insufficient_privilege then null;
end $$;

-- Administrators load time series through import change sets; never through a grid's.
do $$
declare n int;
begin
  perform aip.apply_change_set(gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'import',
    '[{"entity":"plant_telemetry","op":"insert","code":"2026-08-01 13:00 | SITE-A","values":{"at":"2026-08-01T13:00:00","site":"SITE-A","actual_ac_mw":"41.25","data_provenance":"SCADA"}}]');
  select count(*) into n from aip.v_plant_telemetry where code = '2026-08-01 13:00 | SITE-A' and actual_ac_mw = 41.25;
  if n <> 1 then raise exception 'telemetry import not applied'; end if;
  begin
    perform aip.apply_change_set(gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'grid', '[{"entity":"plant_telemetry","op":"insert","code":"x","values":{"site":"SITE-A"}}]');
    raise exception 'a grid wrote a time series';
  exception when insufficient_privilege then null;
  end;
  begin
    perform aip.apply_change_set(gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'import', '[{"entity":"plant_telemetry","op":"insert","code":"y","values":{"source_ordinal":3}}]');
    raise exception 'an import wrote a system column';
  exception when invalid_parameter_value then null;
  end;
  -- Administrators see integrations but never their key hashes.
  begin
    perform key_hash from aip.integration limit 1;
    raise exception 'key hash readable';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from aip.integration;
  if n <> 1 then raise exception 'admin sees % integrations', n; end if;
end $$;

-- Planners record deliveries; what was delivered never changes afterwards.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
do $$
declare n int;
begin
  insert into aip.staging_batch(id, tenant_id, source, entity, actor, total, quarantined) values ('33333333-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'upload', 'work_order', 'aaaaaaaa-0000-0000-0000-000000000001', 1, 1);
  insert into aip.staging_row(tenant_id, batch_id, row_no, entity, code, "values", status, issues)
  values ('00000000-0000-0000-0000-00000000000a', '33333333-0000-0000-0000-000000000001', 1, 'work_order', 'WO-A-Q1', '{"site":"SP-99"}', 'quarantined', '[{"rule":"REF","message":"Plant ID \"SP-99\" does not exist"}]');
  select count(*) into n from aip.v_staging_quarantine where record = 'WO-A-Q1' and problem like '%SP-99%' and rules = 'REF';
  if n <> 1 then raise exception 'quarantine view does not show the row'; end if;
  begin
    update aip.staging_row set "values" = '{}' where code = 'WO-A-Q1';
    raise exception 'delivered values were changed';
  exception when insufficient_privilege then null;
  end;
  update aip.staging_row set status = 'discarded' where code = 'WO-A-Q1';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'outcome could not be recorded'; end if;
  begin
    insert into aip.staging_batch(id, tenant_id, source, entity, actor) values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'upload', 'work_order', 'cccccccc-0000-0000-0000-000000000003');
    raise exception 'a batch was recorded under someone else';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
do $$
declare n int;
begin
  select count(*) into n from aip.staging_row;
  if n <> 0 then raise exception 'isolation breach: tenant B sees staged rows'; end if;
  select count(*) into n from aip.integration;
  if n <> 0 then raise exception 'isolation breach: tenant B sees integrations'; end if;
end $$;
reset role;
\echo 'integrations: act as their own member, server-only, disable stops writes, series via import only, staging isolated and immutable'
