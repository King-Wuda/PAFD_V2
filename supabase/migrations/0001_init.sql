-- PAFD price database — initial schema.
--
-- Only prices live here. Catalogue geometry (sizes, schedules, standards,
-- drawings) is baked into the app as typed constants and is not stored.
--
-- price_lists and prices are append-only. Nothing is ever overwritten or
-- deleted by the app; a bad import is retired by setting superseded = true.

create extension if not exists "pgcrypto";

-- A supplier of price lists.
create table suppliers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

-- One import event. Every upload creates exactly one row here.
-- Never deleted. This is the unit of rollback.
create table price_lists (
  id             uuid primary key default gen_random_uuid(),
  supplier_id    uuid not null references suppliers(id),
  effective_from date not null,
  source_file    text,              -- original filename
  notes          text,              -- e.g. "excl VAT", page range, anything odd
  imported_at    timestamptz not null default now(),
  imported_by    text,              -- free-text name typed at import; no auth
  superseded     boolean not null default false,
  row_count      integer not null default 0
);

-- The prices themselves. Append-only.
create table prices (
  id             uuid primary key default gen_random_uuid(),
  price_list_id  uuid not null references price_lists(id) on delete cascade,
  code           text not null,     -- supplier code, e.g. PVCFGO10063
  description    text,
  unit           text,              -- "each", "m", "length"
  price          numeric(12,2),     -- NULL means P.O.A.
  created_at     timestamptz not null default now()
);

create index prices_code_idx          on prices (code);
create index prices_price_list_id_idx on prices (price_list_id);
create unique index prices_list_code_uniq on prices (price_list_id, code);

create index price_lists_supplier_idx on price_lists (supplier_id, effective_from desc);

-- The current price for every code we have ever seen from a supplier.
--
-- A code absent from the newest list is NOT dropped: `resolved` scans every
-- non-superseded list, so the code falls back to the most recent list that
-- does contain it. `on_current_list` is false for those, and effective_from
-- tells the user how old that price is.
create or replace view current_prices as
with latest as (
  select distinct on (pl.supplier_id)
    pl.supplier_id, pl.id, pl.effective_from
  from price_lists pl
  where not pl.superseded
  order by pl.supplier_id, pl.effective_from desc, pl.imported_at desc
),
resolved as (
  select distinct on (pl.supplier_id, p.code)
    pl.supplier_id, p.code, p.description, p.unit, p.price,
    pl.effective_from, pl.id as price_list_id
  from prices p
  join price_lists pl on pl.id = p.price_list_id
  where not pl.superseded
  order by pl.supplier_id, p.code, pl.effective_from desc, pl.imported_at desc
)
select
  s.name              as supplier,
  r.code,
  r.description,
  r.unit,
  r.price,
  r.effective_from,
  r.price_list_id,
  (r.price_list_id = l.id) as on_current_list,
  l.effective_from    as supplier_current_from
from resolved r
join suppliers s on s.id = r.supplier_id
left join latest l on l.supplier_id = r.supplier_id;

-- Write path -----------------------------------------------------------------
--
-- There is no auth (a deliberate decision: the data is not confidential and
-- this is an internal work tool). Writes are gated in the UI by a confirmation
-- dialogue. The database still refuses direct INSERT/UPDATE/DELETE from the
-- anon role, so the only way in is these two functions. That keeps the
-- append-only guarantee honest even if someone pokes the REST API by hand.

-- Creates one price_lists row and all its prices in a single transaction.
-- p_rows: jsonb array of {code, description, unit, price} — price null = P.O.A.
create or replace function import_price_list(
  p_supplier_name  text,
  p_effective_from date,
  p_source_file    text,
  p_notes          text,
  p_imported_by    text,
  p_rows           jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier_id   uuid;
  v_price_list_id uuid;
  v_count         integer;
begin
  if p_supplier_name is null or btrim(p_supplier_name) = '' then
    raise exception 'supplier name is required';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'no rows to import';
  end if;

  insert into suppliers (name)
  values (btrim(p_supplier_name))
  on conflict (name) do update set name = excluded.name
  returning id into v_supplier_id;

  insert into price_lists (
    supplier_id, effective_from, source_file, notes, imported_by
  ) values (
    v_supplier_id, p_effective_from, p_source_file, p_notes, p_imported_by
  ) returning id into v_price_list_id;

  insert into prices (price_list_id, code, description, unit, price)
  select
    v_price_list_id,
    upper(btrim(r->>'code')),
    nullif(btrim(coalesce(r->>'description', '')), ''),
    nullif(btrim(coalesce(r->>'unit', '')), ''),
    case when r->>'price' is null or btrim(r->>'price') = ''
         then null else (r->>'price')::numeric(12,2) end
  from jsonb_array_elements(p_rows) as r;

  get diagnostics v_count = row_count;
  update price_lists set row_count = v_count where id = v_price_list_id;

  return v_price_list_id;
end;
$$;

-- Rollback: retire an import, or bring it back. No data is lost either way.
create or replace function set_price_list_superseded(
  p_price_list_id uuid,
  p_superseded    boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update price_lists
     set superseded = p_superseded
   where id = p_price_list_id;

  if not found then
    raise exception 'price list % not found', p_price_list_id;
  end if;
end;
$$;

-- Policies -------------------------------------------------------------------

alter table suppliers   enable row level security;
alter table price_lists enable row level security;
alter table prices      enable row level security;

create policy suppliers_read   on suppliers   for select to anon, authenticated using (true);
create policy price_lists_read on price_lists for select to anon, authenticated using (true);
create policy prices_read      on prices      for select to anon, authenticated using (true);

-- No insert/update/delete policies: direct writes are refused for everyone
-- except the security-definer functions above.

grant execute on function import_price_list(text, date, text, text, text, jsonb) to anon, authenticated;
grant execute on function set_price_list_superseded(uuid, boolean)               to anon, authenticated;
