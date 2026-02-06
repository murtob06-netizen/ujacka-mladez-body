-- POS: otvorené účty (tabs)

create table if not exists pos_tabs (
  id bigserial primary key,
  label text not null,
  status text not null default 'open',
  created_by uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_order_id bigint
);

create table if not exists pos_tab_items (
  id bigserial primary key,
  tab_id bigint not null references pos_tabs(id) on delete cascade,
  product_id integer not null references pos_products(id) on delete restrict,
  qty integer not null default 1,
  created_at timestamptz not null default now()
);

alter table pos_tabs enable row level security;
alter table pos_tab_items enable row level security;

drop policy if exists "pos_tabs_admin_cashier_all" on pos_tabs;
drop policy if exists "pos_tab_items_admin_cashier_all" on pos_tab_items;

create policy "pos_tabs_admin_cashier_all" on pos_tabs
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','cashier'))
  )
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','cashier'))
  );

create policy "pos_tab_items_admin_cashier_all" on pos_tab_items
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','cashier'))
  )
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','cashier'))
  );

create or replace function public.pos_tab_add_item(
  p_tab_id bigint,
  p_product_id integer,
  p_qty integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_qty <= 0 then
    return;
  end if;

  insert into pos_tab_items(tab_id, product_id, qty)
  values (p_tab_id, p_product_id, p_qty)
  on conflict (tab_id, product_id)
  do update set qty = pos_tab_items.qty + excluded.qty;
end;
$$;

create unique index if not exists pos_tab_items_unique
  on pos_tab_items(tab_id, product_id);

create or replace function public.pos_tab_set_qty(
  p_tab_item_id bigint,
  p_qty integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_qty <= 0 then
    delete from pos_tab_items where id = p_tab_item_id;
    return;
  end if;

  update pos_tab_items set qty = p_qty where id = p_tab_item_id;
end;
$$;

create or replace function public.pos_close_tab(
  p_tab_id bigint,
  p_payment_method text,
  p_note text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items jsonb;
  v_order_id bigint;
begin
  if p_payment_method not in ('cash','card') then
    raise exception 'invalid payment';
  end if;

  select jsonb_agg(jsonb_build_object('product_id', i.product_id, 'qty', i.qty))
  into v_items
  from pos_tab_items i
  where i.tab_id = p_tab_id;

  if v_items is null then
    raise exception 'empty tab';
  end if;

  select pos_create_order(null, p_payment_method, v_items, coalesce(p_note, '')) into v_order_id;

  update pos_tabs
  set status = 'closed', closed_at = now(), closed_order_id = v_order_id
  where id = p_tab_id;

  return v_order_id;
end;
$$;

grant execute on function public.pos_tab_add_item(bigint, integer, integer) to authenticated;
grant execute on function public.pos_tab_set_qty(bigint, integer) to authenticated;
grant execute on function public.pos_close_tab(bigint, text, text) to authenticated;
