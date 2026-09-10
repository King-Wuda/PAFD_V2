-- Resolution and rollback, tested against the real schema.
--
--   supabase start
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')" \
--        -v ON_ERROR_STOP=1 -f supabase/tests/resolution.test.sql
--
-- Everything runs inside a transaction that is rolled back, so it leaves the
-- database exactly as it found it.

begin;

create or replace function assert_eq(actual anyelement, expected anyelement, label text)
returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception '% — expected %, got %', label, coalesce(expected::text, 'NULL'),
                                                    coalesce(actual::text, 'NULL');
  end if;
  raise notice 'ok: %', label;
end;
$$;

do $$
declare
  v_list_a uuid;
  v_list_b uuid;
  v_price  numeric;
  v_flag   boolean;
  v_date   date;
begin
  -- January list: X, Y, and a P.O.A. item.
  v_list_a := import_price_list(
    'Test Supplier', date '2026-01-01', 'jan.csv', 'excl VAT', 'tester',
    '[{"code":"X","description":"elbow","unit":"each","price":"100.00"},
      {"code":"Y","description":"tee","unit":"each","price":"50.00"},
      {"code":"Z","description":"tank connector","unit":"each","price":null}]'::jsonb);

  perform assert_eq((select row_count from price_lists where id = v_list_a), 3,
                    'import records its row count');

  -- June list: X repriced, Y dropped, Z still P.O.A.
  v_list_b := import_price_list(
    'Test Supplier', date '2026-06-01', 'jun.csv', null, 'tester',
    '[{"code":"X","description":"elbow","unit":"each","price":"110.00"},
      {"code":"Z","description":"tank connector","unit":"each","price":null}]'::jsonb);

  perform assert_eq((select count(*)::int from suppliers where name = 'Test Supplier'), 1,
                    'a second import reuses the supplier');

  -- X takes the newer price.
  select price, on_current_list into v_price, v_flag
    from current_prices where supplier = 'Test Supplier' and code = 'X';
  perform assert_eq(v_price, 110.00::numeric, 'X takes the June price');
  perform assert_eq(v_flag, true, 'X is on the current list');

  -- Y is absent from June. It is kept at its January price and flagged.
  select price, on_current_list, effective_from into v_price, v_flag, v_date
    from current_prices where supplier = 'Test Supplier' and code = 'Y';
  perform assert_eq(v_price, 50.00::numeric, 'Y keeps its January price');
  perform assert_eq(v_flag, false, 'Y is flagged as not on the current list');
  perform assert_eq(v_date, date '2026-01-01', 'Y reports the list it came from');

  -- P.O.A. survives as NULL, not as zero.
  select price into v_price
    from current_prices where supplier = 'Test Supplier' and code = 'Z';
  perform assert_eq(v_price, null::numeric, 'Z stays P.O.A.');

  -- Rollback: retire June.
  perform set_price_list_superseded(v_list_b, true);

  select price, on_current_list into v_price, v_flag
    from current_prices where supplier = 'Test Supplier' and code = 'X';
  perform assert_eq(v_price, 100.00::numeric, 'rollback restores the January price');
  perform assert_eq(v_flag, true, 'January becomes the current list again');

  select on_current_list into v_flag
    from current_prices where supplier = 'Test Supplier' and code = 'Y';
  perform assert_eq(v_flag, true, 'Y is on the current list again');

  -- Nothing was destroyed: both imports and all four price rows are still there.
  perform assert_eq((select count(*)::int from price_lists
                      where supplier_id = (select id from suppliers where name = 'Test Supplier')),
                    2, 'rollback deletes no imports');
  perform assert_eq((select count(*)::int from prices
                      where price_list_id in (v_list_a, v_list_b)), 5,
                    'rollback deletes no prices');

  -- And it is reversible.
  perform set_price_list_superseded(v_list_b, false);
  select price into v_price
    from current_prices where supplier = 'Test Supplier' and code = 'X';
  perform assert_eq(v_price, 110.00::numeric, 'un-superseding brings June back');

  raise notice 'all resolution assertions passed';
end;
$$;

-- The unique index must reject a duplicate code within one import.
do $$
begin
  begin
    perform import_price_list(
      'Dup Supplier', date '2026-01-01', null, null, 'tester',
      '[{"code":"A","price":"1.00"},{"code":"A","price":"2.00"}]'::jsonb);
    raise exception 'duplicate code within a list was accepted';
  exception when unique_violation then
    raise notice 'ok: duplicate code within one import is rejected';
  end;
end;
$$;

rollback;
