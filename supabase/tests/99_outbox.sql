-- Phase 5 proof: events are written in the same transaction as the change, only for enabled destinations subscribed
-- to them, carry the stored record, are claimed under a lease, back off on failure, are set aside after the last
-- attempt, can be retried only by administrators, and destination secrets never reach a client.
\set ON_ERROR_STOP 1

insert into aip.outbox_destination(tenant_id, name, url, events, entities, secret) values
  ('00000000-0000-0000-0000-00000000000a', 'EAM work orders', 'https://eam.example.com/aip', array['change','proposal'], '{work_order,inspection}', repeat('s', 40)),
  ('00000000-0000-0000-0000-00000000000a', 'Disabled', 'https://off.example.com/aip', array['change'], '{}', repeat('t', 40)),
  ('00000000-0000-0000-0000-00000000000b', 'Tenant B hook', 'https://b.example.com/aip', array['change'], '{}', repeat('u', 40))
on conflict do nothing;
update aip.outbox_destination set enabled = false where name = 'Disabled';

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
do $$
declare n int; p jsonb;
begin
  perform aip.apply_change_set('44444444-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'grid', $j$[
    {"entity":"work_order","op":"insert","code":"WO-A-OB1","values":{"site":"SITE-A","asset":"AST-A-1","description":"Outbox","estimated_cost":"99.5000"}}
  ]$j$);
  -- A refused change set leaves no event behind.
  begin
    perform aip.apply_change_set(gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'grid', '[{"entity":"work_order","op":"insert","code":"WO-A-OB2","values":{"site":"NOPE"}}]');
  exception when foreign_key_violation then null;
  end;
  -- Planners do not see the outbox.
  select count(*) into n from aip.outbox;
  if n <> 0 then raise exception 'planner sees the outbox'; end if;
end $$;

select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000003', false);
do $$
declare n int; p jsonb;
begin
  select count(*) into n from aip.v_outbox where record = 'WO-A-OB1' and event = 'work_order.insert' and destination = 'EAM work orders' and status = 'pending';
  if n <> 1 then raise exception 'change event not written to the subscribed destination (%)', n; end if;
  select count(*) into n from aip.outbox where code = 'WO-A-OB2';
  if n <> 0 then raise exception 'a refused change produced an event'; end if;
  select count(*) into n from aip.outbox;
  if n <> 1 then raise exception 'events for unsubscribed or disabled destinations (% rows)', n; end if;
  select payload into p from aip.outbox where code = 'WO-A-OB1';
  if p->>'changeSet' <> '44444444-0000-0000-0000-000000000001' or p->'record'->>'site' <> 'SITE-A' or p->'record'->>'estimated_cost' is null or p->'record' ? 'tenant_id' then
    raise exception 'event payload incomplete: %', p;
  end if;
  begin
    perform secret from aip.outbox_destination limit 1;
    raise exception 'destination secret readable by a client';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from aip.claim_outbox(10);
    raise exception 'a client claimed outbox events';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Approving a proposal of a subscribed type emits an event in the same transaction.
do $$
declare n int;
begin
  insert into aip.agent_proposal(tenant_id, code, agent, proposal_type, subject_type, subject_code, title, rationale, payload, proposed_by)
  values ('00000000-0000-0000-0000-00000000000a', 'PRP-OB1', 'reliability-agent', 'inspection', 'asset', 'AST-A-1', 'Inspect', 'Because', '{"asset":"AST-A-1","description":"Scan","priority":"HIGH"}', 'aaaaaaaa-0000-0000-0000-000000000001');
  update aip.agent_proposal set status = 'approved', decided_by = 'cccccccc-0000-0000-0000-000000000003', decided_at = now() where code = 'PRP-OB1';
  select count(*) into n from aip.outbox where event = 'proposal.approved' and code = 'PRP-OB1' and payload->>'type' = 'inspection';
  if n <> 1 then raise exception 'approved proposal not sent'; end if;
end $$;

-- The worker: claim under a lease, back off on failure, set aside after the last attempt.
set role service_role;
do $$
declare r aip.outbox; n int; i int; wait interval;
begin
  select count(*) into n from aip.claim_outbox(10);
  if n <> 2 then raise exception 'claimed % events, expected 2', n; end if;
  select count(*) into n from aip.claim_outbox(10);
  if n <> 0 then raise exception 'leased events claimed twice'; end if;
  select * into r from aip.outbox where code = 'WO-A-OB1';
  perform aip.complete_outbox(r.id, true, null);
  select * into r from aip.outbox where code = 'PRP-OB1';
  perform aip.complete_outbox(r.id, false, 'HTTP 503');
  select next_attempt_at - now() into wait from aip.outbox where id = r.id;
  if wait < interval '50 seconds' or wait > interval '70 seconds' then raise exception 'first retry after %, expected about a minute', wait; end if;
  for i in 2..8 loop
    update aip.outbox set next_attempt_at = now() - interval '1 second' where id = r.id;
    perform aip.claim_outbox(10);
    perform aip.complete_outbox(r.id, false, 'HTTP 503');
  end loop;
  select count(*) into n from aip.outbox where id = r.id and status = 'dead' and attempts = 8 and last_error = 'HTTP 503';
  if n <> 1 then raise exception 'event not set aside after the last attempt'; end if;
  select count(*) into n from aip.outbox where code = 'WO-A-OB1' and status = 'delivered' and delivered_at is not null;
  if n <> 1 then raise exception 'delivery not recorded'; end if;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
do $$
begin
  perform aip.retry_outbox('00000000-0000-0000-0000-00000000000a', array(select id from aip.outbox));
  raise exception 'a planner retried deliveries';
exception when insufficient_privilege then null;
end $$;
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000003', false);
do $$
declare n int;
begin
  select aip.retry_outbox('00000000-0000-0000-0000-00000000000a', array(select id::bigint from aip.outbox)) into n;
  if n <> 1 then raise exception 'retried % events, expected only the dead one', n; end if;
end $$;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
do $$
declare n int;
begin
  select count(*) into n from aip.v_outbox;
  if n <> 0 then raise exception 'isolation breach: tenant B sees tenant A events'; end if;
end $$;
reset role;
\echo 'outbox: same-transaction events for subscribed destinations, leased claims, back-off, dead letters, admin retry, secrets server-only'
