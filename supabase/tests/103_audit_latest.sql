-- A tenant's newest audit entry (read on every sign-in for the workbook version) comes from the index alone, whatever
-- the size of the log: a seed writes one entry per record, all at the same instant.
\set ON_ERROR_STOP 1

do $$
declare plan text := ''; line text; latest bigint; want bigint;
begin
  if not exists (select 1 from pg_indexes where schemaname = 'aip' and tablename = 'audit_log'
                 and indexdef like '%(tenant_id, at DESC, id DESC)%') then
    raise exception 'aip.audit_log has no (tenant_id, at desc, id desc) index';
  end if;
  -- Many entries at one instant, for a tenant of their own: the newest is the highest id.
  insert into aip.tenants(id, name) values ('00000000-0000-0000-0000-0000000000a7', 'Audit latest') on conflict do nothing;
  insert into aip.audit_log(tenant_id, action, entity, at)
  select '00000000-0000-0000-0000-0000000000a7', 'insert', 'probe', '2026-10-12T00:00:00Z' from generate_series(1, 20000);
  analyze aip.audit_log;
  select max(id) into want from aip.audit_log where tenant_id = '00000000-0000-0000-0000-0000000000a7';
  select id into latest from aip.audit_log where tenant_id = '00000000-0000-0000-0000-0000000000a7' order by at desc, id desc limit 1;
  if latest <> want then raise exception 'newest audit entry is %, expected %', latest, want; end if;
  for line in execute 'explain select id from aip.audit_log where tenant_id = ''00000000-0000-0000-0000-0000000000a7'' order by at desc, id desc limit 1' loop
    plan := plan || line || E'\n';
  end loop;
  if plan not like '%audit_log_tenant_latest_idx%' or plan like '%Sort%' then raise exception 'newest audit entry is not read from the index: %', plan; end if;
end $$;
