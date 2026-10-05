-- Agents proof: a member's runs are theirs, proposals need a planner, decisions are one-way and recorded by the
-- decider, applying works with the decider's own permissions, and everything is audited and tenant-isolated.
\set ON_ERROR_STOP 1

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
do $$
declare run uuid; p uuid; ref text; n int; st text;
begin
  insert into aip.agent_run(tenant_id, code, agent, user_id, model, status, question)
  values ('00000000-0000-0000-0000-00000000000a', 'AGR-1', 'reliability-agent', 'aaaaaaaa-0000-0000-0000-000000000001', 'claude-test', 'running', 'What first?')
  returning id into run;
  insert into aip.agent_step(tenant_id, run_id, seq, kind, tool, payload) values
    ('00000000-0000-0000-0000-00000000000a', run, 0, 'tool_call', 'top_risks', '{}'),
    ('00000000-0000-0000-0000-00000000000a', run, 1, 'tool_result', 'top_risks', '{"rows":1}');
  begin
    insert into aip.agent_run(tenant_id, code, agent, user_id, model, status) values ('00000000-0000-0000-0000-00000000000a', 'AGR-X', 'aip-copilot', 'cccccccc-0000-0000-0000-000000000003', 'm', 'running');
    raise exception 'planner A started a run as another user';
  exception when insufficient_privilege then null;
  end;

  insert into aip.agent_proposal(tenant_id, code, agent, run_id, proposal_type, subject_type, subject_code, title, rationale, payload, evidence, proposed_by)
  values ('00000000-0000-0000-0000-00000000000a', 'PRP-1', 'reliability-agent', run, 'inspection', 'asset', 'AST-A-1', 'Inspect AST-A-1', 'Anomaly score 0.71 with yield 15 % below the fleet.',
          '{"asset":"AST-A-1","description":"Thermal scan and IV curve","priority":"HIGH","required_by":"2026-10-20"}', '[{"source":"AIP-ANOM-INV-1","detail":"score 0.71"}]', 'aaaaaaaa-0000-0000-0000-000000000001')
  returning id into p;
  begin
    update aip.agent_proposal set status = 'approved', decided_by = 'cccccccc-0000-0000-0000-000000000003' where id = p;
    raise exception 'decision recorded under another user';
  exception when insufficient_privilege then null;
  end;
  update aip.agent_proposal set status = 'approved', decided_by = 'aaaaaaaa-0000-0000-0000-000000000001', decision_note = 'agreed' where id = p;
  begin
    update aip.agent_proposal set payload = '{"asset":"AST-A-1","description":"changed","priority":"LOW"}' where id = p;
    raise exception 'approved proposal content changed';
  exception when check_violation then null;
  end;
  ref := aip.apply_agent_proposal(p);
  if ref <> 'AGT-PRP-1' then raise exception 'apply returned %', ref; end if;
  select status into st from aip.agent_proposal where id = p;
  if st <> 'applied' then raise exception 'proposal is %, expected applied', st; end if;
  select count(*) into n from aip.v_intervention where code = 'AGT-PRP-1' and asset = 'AST-A-1' and site = 'SITE-A' and maintenance_type = 'INSPECTION' and priority = 'HIGH' and planning_status = 'UNDER_REVIEW';
  if n <> 1 then raise exception 'applied inspection not in the intervention register as expected'; end if;
  begin
    update aip.agent_proposal set status = 'pending' where id = p;
    raise exception 'applied proposal reopened';
  exception when check_violation then null;
  end;
  begin
    perform aip.apply_agent_proposal(p);
    raise exception 'proposal applied twice';
  exception when check_violation then null;
  end;
end $$;

-- Tenant B viewer: sees none of tenant A's runs, steps or proposals, and cannot propose.
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
do $$
declare n int;
begin
  select count(*) into n from aip.agent_run;
  if n <> 0 then raise exception 'isolation breach: % runs visible', n; end if;
  select count(*) into n from aip.agent_step;
  if n <> 0 then raise exception 'isolation breach: % steps visible', n; end if;
  select count(*) into n from aip.agent_proposal;
  if n <> 0 then raise exception 'isolation breach: % proposals visible', n; end if;
  begin
    insert into aip.agent_proposal(tenant_id, code, agent, proposal_type, subject_type, subject_code, title, rationale, proposed_by)
    values ('00000000-0000-0000-0000-00000000000b', 'PRP-V', 'forecast-agent', 'notification', 'site', 'SITE-B', 'Viewer proposal', 'A viewer should not be able to propose anything.', 'bbbbbbbb-0000-0000-0000-000000000002');
    raise exception 'viewer B created a proposal';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Tenant A administrator sees the planner's run (administrators review every run of their tenant).
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000003', false);
do $$
declare n int;
begin
  select count(*) into n from aip.agent_run where code = 'AGR-1';
  if n <> 1 then raise exception 'admin A cannot review the planner''s run'; end if;
end $$;
reset role;

do $$
declare n int;
begin
  select count(*) into n from aip.audit_log where entity = 'agent_proposal' and entity_key = 'PRP-1';
  if n < 3 then raise exception 'proposal lifecycle not audited (% entries)', n; end if;
  select count(*) into n from aip.audit_log where entity = 'agent_step' and (after ->> 'steps')::int = 2;
  if n <> 1 then raise exception 'agent steps not audited as one batch (%)', n; end if;
  select count(*) into n from aip.audit_log where entity = 'intervention' and entity_key = 'AGT-PRP-1';
  if n <> 1 then raise exception 'applied intervention not audited'; end if;
end $$;
\echo 'agents: own runs, planner-only proposals, one-way decisions by the decider, applied with the caller''s rights, audited, isolated'
