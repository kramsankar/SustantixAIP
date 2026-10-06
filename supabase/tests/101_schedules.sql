-- Phase 5 proof: schedule slots are computed in the schedule's own time zone (DST included); only administrators see,
-- change or run schedules; only the server claims them; a claimed slot never runs twice; configuration changes are
-- audited and run bookkeeping is not.
\set ON_ERROR_STOP 1

do $$
begin
  -- Hourly: the next whole hour.
  if aip.next_agent_slot('hourly', 0, 0, 'UTC', '2026-10-06 10:15+00') <> '2026-10-06 11:00+00' then raise exception 'hourly slot wrong'; end if;
  -- Daily at 06:00 in Kolkata (UTC+05:30): later today, or tomorrow once passed.
  if aip.next_agent_slot('daily', 6, 0, 'Asia/Kolkata', '2026-10-05 20:00+00') <> '2026-10-06 00:30+00' then raise exception 'daily slot (later today) wrong'; end if;
  if aip.next_agent_slot('daily', 6, 0, 'Asia/Kolkata', '2026-10-06 00:30+00') <> '2026-10-07 00:30+00' then raise exception 'daily slot (passed) wrong'; end if;
  -- Weekly, Monday 07:00 in Dubai, asked on Tuesday 2026-10-06: the following Monday.
  if aip.next_agent_slot('weekly', 7, 1, 'Asia/Dubai', '2026-10-06 12:00+00') <> '2026-10-12 03:00+00' then raise exception 'weekly slot wrong'; end if;
  -- Across the end of summer time in Berlin (2026-10-25): 06:00 local is 04:00 UTC before and 05:00 UTC after.
  if aip.next_agent_slot('daily', 6, 0, 'Europe/Berlin', '2026-10-24 12:00+00') <> '2026-10-25 05:00+00' then raise exception 'DST slot wrong'; end if;
  if aip.next_agent_slot('daily', 6, 0, 'Europe/Berlin', '2026-10-23 12:00+00') <> '2026-10-24 04:00+00' then raise exception 'pre-DST slot wrong'; end if;
end $$;

insert into auth.users(id, email) values ('ffffffff-0000-0000-0000-000000000006', 'schedule-test@integrations.sustantix.invalid') on conflict do nothing;
insert into aip.tenant_members(tenant_id, user_id, role) values ('00000000-0000-0000-0000-00000000000a', 'ffffffff-0000-0000-0000-000000000006', 'planner') on conflict do nothing;

-- The server creates a schedule (with its technical member); its first run is its next slot.
set role service_role;
insert into aip.agent_schedule(tenant_id, name, agent, prompt, cadence, at_hour, time_zone, actor, created_by)
values ('00000000-0000-0000-0000-00000000000a', 'Morning risk review', 'planning-agent', 'Which open work orders breach SLA today?', 'daily', 6, 'Asia/Kolkata',
        'ffffffff-0000-0000-0000-000000000006', 'cccccccc-0000-0000-0000-000000000003')
on conflict do nothing;
do $$
declare s aip.agent_schedule;
begin
  select * into s from aip.agent_schedule where name = 'Morning risk review';
  if s.next_run_at <= now() or s.next_run_at > now() + interval '1 day' then raise exception 'first slot wrong: %', s.next_run_at; end if;
  -- Not due: nothing to claim.
  if exists (select 1 from aip.claim_agent_schedule()) then raise exception 'claimed a schedule that is not due'; end if;
end $$;
reset role;

set role authenticated;
-- A planner neither sees nor changes nor runs schedules.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
do $$
declare n int;
begin
  select count(*) into n from aip.v_agent_schedule;
  if n <> 0 then raise exception 'planner sees schedules'; end if;
  update aip.agent_schedule set enabled = false;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'planner changed a schedule'; end if;
  begin
    perform aip.run_agent_schedules_now('00000000-0000-0000-0000-00000000000a', array(select id from aip.agent_schedule));
    raise exception 'planner ran a schedule';
  exception when insufficient_privilege then null;
  end;
  begin
    perform aip.claim_agent_schedule();
    raise exception 'a member claimed a schedule';
  exception when insufficient_privilege then null;
  end;
end $$;

-- An administrator sees, re-times and runs it; an unknown time zone is refused; the actor cannot be changed.
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000003', false);
do $$
declare n int; sid uuid; runs text;
begin
  select code::uuid, v.runs into sid, runs from aip.v_agent_schedule v where name = 'Morning risk review';
  if runs <> 'daily at 06:00' then raise exception 'schedule description wrong: %', runs; end if;
  update aip.agent_schedule set cadence = 'weekly', at_weekday = 1, at_hour = 7, time_zone = 'Asia/Dubai' where id = sid;
  begin
    update aip.agent_schedule set time_zone = 'Mars/Olympus_Mons' where id = sid;
    raise exception 'unknown time zone accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    update aip.agent_schedule set actor = 'cccccccc-0000-0000-0000-000000000003' where id = sid;
    raise exception 'administrator re-assigned the schedule''s identity';
  exception when insufficient_privilege then null;
  end;
  n := aip.run_agent_schedules_now('00000000-0000-0000-0000-00000000000a', array[sid]);
  if n <> 1 then raise exception 'run now did not take'; end if;
end $$;
reset role;

-- The worker claims it once, moves it to its next slot, and records the outcome.
set role service_role;
do $$
declare s aip.agent_schedule; again int;
begin
  select * into s from aip.claim_agent_schedule();
  if s.id is null or s.last_status <> 'running' then raise exception 'due schedule not claimed'; end if;
  if s.next_run_at <= now() or extract(isodow from s.next_run_at at time zone 'Asia/Dubai') <> 1 or extract(hour from s.next_run_at at time zone 'Asia/Dubai') <> 7 then
    raise exception 'claimed schedule not moved to its next slot: %', s.next_run_at;
  end if;
  select count(*) into again from aip.claim_agent_schedule();
  if again <> 0 then raise exception 'a slot was claimed twice'; end if;
  perform aip.finish_agent_schedule(s.id, 'completed', null, 'raised 2 proposals');
  if (select last_status from aip.agent_schedule where id = s.id) <> 'completed' then raise exception 'outcome not recorded'; end if;
  begin
    perform aip.finish_agent_schedule(s.id, 'running', null, null);
    raise exception 'bad status accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;

-- Created and re-timed: audited. Run now, claim and outcome: not.
do $$
declare n int;
begin
  select count(*) into n from aip.audit_log where entity = 'agent_schedule' and entity_key = 'Morning risk review';
  if n <> 2 then raise exception 'expected 2 audit rows (create, re-time), found %', n; end if;
  if has_function_privilege('authenticated', 'aip.claim_agent_schedule()', 'execute') or has_function_privilege('anon', 'aip.run_agent_schedules_now(uuid, uuid[])', 'execute') then
    raise exception 'worker functions reachable by clients';
  end if;
end $$;
\echo 'schedules: local-time slots across DST, admin-only, server-claimed once per slot, configuration audited'
