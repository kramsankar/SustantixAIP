-- Runtime catalogue proof: each tenant's dataset layouts and named sheets are its own; a member reads only their own
-- tenant's and writes none; blocks come back in the order asked with each record's keys as written; the row view gives
-- one row per record with its group; every write statement is audited once per tenant; the first store is gone.
\set ON_ERROR_STOP 1

do $$
begin
  if to_regclass('aip.dataset_part') is not null or to_regclass('aip.dataset_block') is not null then
    raise exception 'the first runtime-data store was not replaced';
  end if;
end $$;

-- Two tenants, each with a sheet of the same name but different rows (keys deliberately out of alphabetical order).
set role service_role;
insert into aip.runtime_dataset(tenant_id, dataset, label, layout, bytes) values
  ('00000000-0000-0000-0000-00000000000a', '00000000000000aa', 'Test dataset', '{"z":1,"rows":{"$aipSheet":"Crew Assignments"},"wo":{"$aipGoverned":"Work Orders","columns":["WO_ID"]}}', 90),
  ('00000000-0000-0000-0000-00000000000b', '00000000000000aa', 'Test dataset', '{"z":2,"rows":{"$aipSheet":"Crew Assignments"}}', 50);
insert into aip.runtime_sheet(tenant_id, sheet, row_count, bytes, used_by) values
  ('00000000-0000-0000-0000-00000000000a', 'Crew Assignments', 3, 99, array['Test dataset /rows']),
  ('00000000-0000-0000-0000-00000000000a', 'Alternatives · scenarios', 3, 30, array['Test dataset /DEC-1/scenarios', 'Test dataset /DEC-2/scenarios']),
  ('00000000-0000-0000-0000-00000000000b', 'Crew Assignments', 1, 33, array['Test dataset /rows']);
insert into aip.runtime_sheet_group(tenant_id, sheet, group_key, first_ordinal, row_count) values
  ('00000000-0000-0000-0000-00000000000a', 'Alternatives · scenarios', 'DEC-1', 0, 2),
  ('00000000-0000-0000-0000-00000000000a', 'Alternatives · scenarios', 'DEC-2', 2, 1);
insert into aip.runtime_sheet_block(tenant_id, sheet, first_ordinal, row_count, bytes, rows) values
  ('00000000-0000-0000-0000-00000000000a', 'Crew Assignments', 2, 1, 33, '[{"Zone":"c","Crew":"C-3","Id":3}]'),
  ('00000000-0000-0000-0000-00000000000a', 'Crew Assignments', 0, 2, 66, '[{"Zone":"a","Crew":"C-1","Id":1},{"Zone":"b","Crew":"C-2","Id":2}]'),
  ('00000000-0000-0000-0000-00000000000a', 'Alternatives · scenarios', 0, 3, 30, '[{"s":1},{"s":2},{"s":3}]'),
  ('00000000-0000-0000-0000-00000000000b', 'Crew Assignments', 0, 1, 33, '[{"Zone":"x","Crew":"C-9","Id":9}]');
reset role;

do $$
declare n int;
begin
  -- One audit entry per statement and tenant, not one per record.
  select count(*) into n from aip.audit_log where entity = 'runtime_sheet_block' and action = 'insert';
  if n <> 2 then raise exception 'expected 2 statement audits for sheet blocks, got %', n; end if;
  select count(*) into n from aip.audit_log
   where entity = 'runtime_sheet_block' and tenant_id = '00000000-0000-0000-0000-00000000000a' and (after->>'records')::int = 3;
  if n <> 1 then raise exception 'sheet block audit does not count what was written'; end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
do $$
declare n int; j json; t text;
begin
  select count(*) into n from aip.runtime_sheet_block;
  if n <> 3 then raise exception 'isolation breach: member A sees % sheet blocks', n; end if;
  select count(*) into n from aip.runtime_dataset;
  if n <> 1 then raise exception 'isolation breach: member A sees % dataset layouts', n; end if;
  select layout::text into t from aip.runtime_dataset;
  if t not like '{"z":1,"rows":{"$aipSheet":"Crew Assignments"},%' then raise exception 'layout not kept as written: %', t; end if;
  -- Blocks in the order asked, keys as written (json, not jsonb).
  j := aip.runtime_sheet_blocks('00000000-0000-0000-0000-00000000000a', '[{"s":"Crew Assignments","f":2},{"s":"Crew Assignments","f":0}]');
  t := j::text;
  if t <> '[[{"Zone":"c","Crew":"C-3","Id":3}], [{"Zone":"a","Crew":"C-1","Id":1},{"Zone":"b","Crew":"C-2","Id":2}]]' then
    raise exception 'blocks wrong: %', t;
  end if;
  -- Another tenant's block answers null.
  j := aip.runtime_sheet_blocks('00000000-0000-0000-0000-00000000000b', '[{"s":"Crew Assignments","f":0}]');
  if j::text <> '[null]' then raise exception 'isolation breach: member A read tenant B blocks: %', j; end if;
  -- One row per record, in order, with its group.
  select string_agg(ordinal || ':' || coalesce(group_key, '-') || ':' || (record->>'s'), ',' order by ordinal) into t
  from aip.runtime_sheet_rows where sheet = 'Alternatives · scenarios';
  if t <> '0:DEC-1:1,1:DEC-1:2,2:DEC-2:3' then raise exception 'row view wrong: %', t; end if;
  select count(*) into n from aip.runtime_sheet_rows;
  if n <> 6 then raise exception 'row view shows % records to member A', n; end if;
  -- Members never write the catalogue, their own tenant's included.
  begin
    insert into aip.runtime_sheet_block(tenant_id, sheet, first_ordinal, row_count, bytes, rows) values ('00000000-0000-0000-0000-00000000000a', 'Crew Assignments', 3, 1, 2, '[{}]');
    raise exception 'a member inserted a sheet block';
  exception when insufficient_privilege then null;
  end;
  begin
    update aip.runtime_dataset set label = 'x';
    raise exception 'a member updated a dataset layout';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from aip.runtime_sheet;
    raise exception 'a member deleted sheets';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
do $$
declare j json;
begin
  j := aip.runtime_sheet_blocks('00000000-0000-0000-0000-00000000000b', '[{"s":"Crew Assignments","f":0}]');
  if j::text <> '[[{"Zone":"x","Crew":"C-9","Id":9}]]' then raise exception 'viewer B cannot read own sheet: %', j; end if;
end $$;
reset role;

-- A block and a group need their sheet; a dataset id is a runtime dataset id.
do $$
begin
  begin
    insert into aip.runtime_sheet_block(tenant_id, sheet, first_ordinal, row_count, bytes, rows) values ('00000000-0000-0000-0000-00000000000a', 'No such sheet', 0, 1, 4, '[{}]');
    raise exception 'a block without its sheet was accepted';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into aip.runtime_sheet_group(tenant_id, sheet, group_key, first_ordinal, row_count) values ('00000000-0000-0000-0000-00000000000a', 'No such sheet', 'g', 0, 1);
    raise exception 'a group without its sheet was accepted';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into aip.runtime_dataset(tenant_id, dataset, label, layout, bytes) values ('00000000-0000-0000-0000-00000000000a', '../x', 'x', '{}', 2);
    raise exception 'a bad dataset id was accepted';
  exception when check_violation then null;
  end;
end $$;

-- Removing a tenant's sheets removes their groups and blocks and is audited once.
set role service_role;
delete from aip.runtime_sheet where tenant_id = '00000000-0000-0000-0000-00000000000b';
reset role;
do $$
declare n int;
begin
  select count(*) into n from aip.runtime_sheet_block where tenant_id = '00000000-0000-0000-0000-00000000000b';
  if n <> 0 then raise exception 'blocks outlived their sheet'; end if;
  select count(*) into n from aip.audit_log where entity = 'runtime_sheet_block' and action = 'delete' and tenant_id = '00000000-0000-0000-0000-00000000000b';
  if n <> 1 then raise exception 'cascaded block removal not audited once (%)', n; end if;
end $$;
delete from aip.runtime_sheet where tenant_id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');
delete from aip.runtime_dataset where dataset = '00000000000000aa';
