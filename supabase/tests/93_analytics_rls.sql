-- Analytics results proof: runs belong to a governed model of the same tenant, planners record runs and outputs,
-- outputs are append-only and audited once per batch, quantiles stay ordered, and other tenants see nothing.
\set ON_ERROR_STOP 1

insert into aip.ml_model(tenant_id, code, name, engine) values
  ('00000000-0000-0000-0000-00000000000a', 'AIP-GEN-HYBRID-1', 'Hybrid solar generation forecast', 'forecast.generation'),
  ('00000000-0000-0000-0000-00000000000b', 'AIP-GEN-HYBRID-1', 'Hybrid solar generation forecast', 'forecast.generation')
on conflict do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
do $$
declare n int; run uuid;
begin
  insert into aip.model_run(tenant_id, code, ml_model_id, status, as_of, metrics)
  select '00000000-0000-0000-0000-00000000000a', 'AIP-GEN-HYBRID-1/2026-09-30T00:00', m.id, 'succeeded', '2026-09-30', '{"coveragePct": 79.7}'::jsonb
  from aip.ml_model m where m.code = 'AIP-GEN-HYBRID-1'
  returning id into run;
  insert into aip.model_output(tenant_id, run_id, subject_type, subject_code, measure, at, q10, q50, q90, unit) values
    ('00000000-0000-0000-0000-00000000000a', run, 'site', 'SITE-A', 'ac_power', '2026-08-20 12:00', 80, 90, 95, 'MW'),
    ('00000000-0000-0000-0000-00000000000a', run, 'site', 'SITE-A', 'ac_power', '2026-08-20 12:15', 81, 91, 96, 'MW'),
    ('00000000-0000-0000-0000-00000000000a', run, 'site', 'SITE-A', 'energy_horizon', null, 700, 750, 790, 'MWh');
  select count(*) into n from aip.v_model_output_latest where model = 'AIP-GEN-HYBRID-1';
  if n <> 3 then raise exception 'latest-output view shows % rows, expected 3', n; end if;
  begin
    update aip.model_output set q50 = 0 where run_id = run;
    raise exception 'outputs are not append-only (update allowed)';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from aip.model_output where run_id = run;
    raise exception 'outputs are not append-only (delete allowed)';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into aip.model_output(tenant_id, run_id, subject_type, subject_code, measure, q10, q50, q90, unit) values ('00000000-0000-0000-0000-00000000000a', run, 'site', 'SITE-A', 'ac_power', 95, 90, 99, 'MW');
    raise exception 'unordered quantiles accepted';
  exception when check_violation then null;
  end;
  begin
    insert into aip.model_run(tenant_id, code, ml_model_id, status, as_of)
    select '00000000-0000-0000-0000-00000000000b', 'ROGUE', m.id, 'succeeded', now() from aip.ml_model m where m.code = 'AIP-GEN-HYBRID-1';
    raise exception 'planner A recorded a run in tenant B';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Tenant B viewer sees no tenant A runs or outputs, and cannot record runs.
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
do $$
declare n int;
begin
  select count(*) into n from aip.model_output;
  if n <> 0 then raise exception 'isolation breach: viewer B sees % outputs', n; end if;
  select count(*) into n from aip.v_model_run_latest;
  if n <> 0 then raise exception 'isolation breach: viewer B sees % runs', n; end if;
  begin
    insert into aip.model_run(tenant_id, code, ml_model_id, status, as_of)
    select '00000000-0000-0000-0000-00000000000b', 'VIEWER', m.id, 'succeeded', now() from aip.ml_model m where m.code = 'AIP-GEN-HYBRID-1';
    raise exception 'viewer B recorded a run';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$
declare n int; run_b uuid;
begin
  select count(*) into n from aip.audit_log where entity = 'model_output' and tenant_id = '00000000-0000-0000-0000-00000000000a' and (after ->> 'rows')::int = 3;
  if n <> 1 then raise exception 'expected one audit entry for the 3-row output batch, found %', n; end if;
  select count(*) into n from aip.audit_log where entity = 'model_run' and entity_key = 'AIP-GEN-HYBRID-1/2026-09-30T00:00';
  if n <> 1 then raise exception 'model run not audited (% entries)', n; end if;
  -- A run must use a model of its own tenant, and outputs a run of their own tenant, even for the service role.
  begin
    insert into aip.model_run(tenant_id, code, ml_model_id, status, as_of)
    select '00000000-0000-0000-0000-00000000000a', 'CROSS', m.id, 'succeeded', now() from aip.ml_model m where m.code = 'AIP-GEN-HYBRID-1' and m.tenant_id = '00000000-0000-0000-0000-00000000000b';
    raise exception 'cross-tenant model link accepted';
  exception when foreign_key_violation then null;
  end;
  insert into aip.model_run(tenant_id, code, ml_model_id, status, as_of)
  select '00000000-0000-0000-0000-00000000000b', 'B-RUN', m.id, 'succeeded', now() from aip.ml_model m where m.code = 'AIP-GEN-HYBRID-1' and m.tenant_id = '00000000-0000-0000-0000-00000000000b'
  returning id into run_b;
  begin
    insert into aip.model_output(tenant_id, run_id, subject_type, subject_code, measure, unit) values ('00000000-0000-0000-0000-00000000000a', run_b, 'site', 'X', 'ac_power', 'MW');
    raise exception 'cross-tenant output link accepted';
  exception when foreign_key_violation then null;
  end;
end $$;
\echo 'analytics: runs tied to tenant models, append-only outputs audited per batch, ordered quantiles, isolated'
