-- Database-only data proof: runtime datasets are held per tenant; a member reads only their own tenant's datasets and
-- writes none; blocks come back in the order asked with each record's keys in their written order; every write
-- statement is audited once per tenant.
\set ON_ERROR_STOP 1

-- Two tenants, each with a dataset of the same id but different rows (keys deliberately out of alphabetical order).
set role service_role;
insert into aip.dataset_part(tenant_id, dataset, part, frame, row_count, bytes) values
  ('00000000-0000-0000-0000-00000000000a', '00000000000000aa', '$frame', '{"z":1,"rows":{"$aipPart":"/rows"}}', 0, 33),
  ('00000000-0000-0000-0000-00000000000a', '00000000000000aa', '/rows', null, 3, 60),
  ('00000000-0000-0000-0000-00000000000b', '00000000000000aa', '$frame', '{"z":2,"rows":{"$aipPart":"/rows"}}', 0, 33),
  ('00000000-0000-0000-0000-00000000000b', '00000000000000aa', '/rows', null, 1, 20);
insert into aip.dataset_block(tenant_id, dataset, part, first_ordinal, row_count, bytes, rows) values
  ('00000000-0000-0000-0000-00000000000a', '00000000000000aa', '/rows', 2, 1, 33, '[{"Zone":"c","Asset":"A-3","Id":3}]'),
  ('00000000-0000-0000-0000-00000000000a', '00000000000000aa', '/rows', 0, 2, 66, '[{"Zone":"a","Asset":"A-1","Id":1},{"Zone":"b","Asset":"A-2","Id":2}]'),
  ('00000000-0000-0000-0000-00000000000b', '00000000000000aa', '/rows', 0, 1, 33, '[{"Zone":"x","Asset":"B-1","Id":9}]');
reset role;

do $$
declare n int;
begin
  -- One audit entry per statement and tenant (two tenants in the insert), not one per record.
  select count(*) into n from aip.audit_log where entity = 'dataset_block' and action = 'insert';
  if n <> 2 then raise exception 'expected 2 statement audits for dataset blocks, got %', n; end if;
  select count(*) into n from aip.audit_log
   where entity = 'dataset_block' and tenant_id = '00000000-0000-0000-0000-00000000000a' and (after->>'records')::int = 2;
  if n <> 1 then raise exception 'dataset block audit does not count what was written'; end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
do $$
declare n int; j json; t text;
begin
  select count(*) into n from aip.dataset_block;
  if n <> 2 then raise exception 'isolation breach: member A sees % dataset blocks', n; end if;
  select count(*) into n from aip.dataset_part;
  if n <> 2 then raise exception 'isolation breach: member A sees % dataset parts', n; end if;
  -- Blocks in the order asked, keys as written (json, not jsonb).
  j := aip.dataset_blocks('00000000-0000-0000-0000-00000000000a', '[{"d":"00000000000000aa","p":"/rows","f":2},{"d":"00000000000000aa","p":"/rows","f":0}]');
  t := j::text;
  if t <> '[[{"Zone":"c","Asset":"A-3","Id":3}], [{"Zone":"a","Asset":"A-1","Id":1},{"Zone":"b","Asset":"A-2","Id":2}]]' then
    raise exception 'blocks wrong: %', t;
  end if;
  -- Another tenant's block answers null.
  j := aip.dataset_blocks('00000000-0000-0000-0000-00000000000b', '[{"d":"00000000000000aa","p":"/rows","f":0}]');
  if j::text <> '[null]' then raise exception 'isolation breach: member A read tenant B blocks: %', j; end if;
  -- Members never write datasets, their own tenant's included.
  begin
    insert into aip.dataset_block(tenant_id, dataset, part, first_ordinal, row_count, bytes, rows) values ('00000000-0000-0000-0000-00000000000a', '00000000000000aa', '/rows', 3, 1, 2, '[{}]');
    raise exception 'a member inserted a dataset block';
  exception when insufficient_privilege then null;
  end;
  begin
    update aip.dataset_part set row_count = 0;
    raise exception 'a member updated a dataset part';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from aip.dataset_block;
    raise exception 'a member deleted dataset blocks';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
do $$
declare j json;
begin
  j := aip.dataset_blocks('00000000-0000-0000-0000-00000000000b', '[{"d":"00000000000000aa","p":"/rows","f":0}]');
  if j::text <> '[[{"Zone":"x","Asset":"B-1","Id":9}]]' then raise exception 'viewer B cannot read own dataset: %', j; end if;
end $$;
reset role;

-- A frame is held only by the frame part, and a block needs its part.
do $$
begin
  begin
    insert into aip.dataset_part(tenant_id, dataset, part, frame) values ('00000000-0000-0000-0000-00000000000a', '00000000000000ab', '/x', '{}');
    raise exception 'a table part accepted a frame';
  exception when check_violation then null;
  end;
  begin
    insert into aip.dataset_block(tenant_id, dataset, part, first_ordinal, row_count, bytes, rows) values ('00000000-0000-0000-0000-00000000000a', '00000000000000ab', '/none', 0, 1, 4, '[{}]');
    raise exception 'a block without its part was accepted';
  exception when foreign_key_violation then null;
  end;
end $$;

-- Removing a tenant's datasets removes their blocks and is audited once.
set role service_role;
delete from aip.dataset_part where tenant_id = '00000000-0000-0000-0000-00000000000b';
reset role;
do $$
declare n int;
begin
  select count(*) into n from aip.dataset_block where tenant_id = '00000000-0000-0000-0000-00000000000b';
  if n <> 0 then raise exception 'blocks outlived their dataset'; end if;
  select count(*) into n from aip.audit_log where entity = 'dataset_block' and action = 'delete' and tenant_id = '00000000-0000-0000-0000-00000000000b';
  if n <> 1 then raise exception 'cascaded block removal not audited once (%)', n; end if;
end $$;
delete from aip.dataset_part where dataset in ('00000000000000aa', '00000000000000ab');
