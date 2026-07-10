-- Drop the existing functions to change signatures if needed (or use OR REPLACE)
-- We use OR REPLACE and add p_is_fake as the last parameter to avoid breaking existing callers if any.

create or replace function public.get_transactions_summary(
  p_from date,
  p_to date,
  p_outlet uuid default null,
  p_merchant uuid default null,
  p_variant uuid default null,
  p_q text default null,
  p_is_fake text default 'all'
)
returns jsonb
language sql
stable
set search_path = public
as $$
with filtered_tx as (
  select
    t.id,
    t.order_id,
    t.order_number,
    t.qty::numeric as qty,
    t.initial_price::numeric as initial_price,
    t.deduction_fee::numeric as deduction_fee,
    t.net_profit::numeric as net_profit,
    coalesce(t.order_id::text, t.id::text) as transaction_key
  from public.transactions t
  left join public.outlets o on o.id = t.outlet_id
  left join public.food_merchants m on m.id = t.food_merchant_id
  left join public.product_variants v on v.id = t.product_variant_id
  where t.transaction_date >= (p_from::text || ' 00:00:00+07')::timestamptz
    and t.transaction_date <= (p_to::text || ' 23:59:59.999+07')::timestamptz
    and (p_outlet is null or t.outlet_id = p_outlet)
    and (p_merchant is null or t.food_merchant_id = p_merchant)
    and (p_variant is null or t.product_variant_id = p_variant)
    and (
      nullif(trim(coalesce(p_q, '')), '') is null
      or t.order_number ilike '%' || trim(p_q) || '%'
      or o.name ilike '%' || trim(p_q) || '%'
      or m.name ilike '%' || trim(p_q) || '%'
      or v.name ilike '%' || trim(p_q) || '%'
    )
    and (
      p_is_fake = 'all'
      or (p_is_fake = 'fake' and t.is_fake = true)
      or (p_is_fake = 'normal' and t.is_fake = false)
    )
)
select jsonb_build_object(
  'orderCount', count(distinct transaction_key),
  'qty', coalesce(sum(qty), 0),
  'gross', coalesce(sum(qty * initial_price), 0),
  'fee', coalesce(sum(deduction_fee), 0),
  'net', coalesce(sum(net_profit), 0)
)
from filtered_tx;
$$;

create or replace function public.get_transaction_order_page(
  p_from date,
  p_to date,
  p_outlet uuid default null,
  p_merchant uuid default null,
  p_variant uuid default null,
  p_q text default null,
  p_offset integer default 0,
  p_limit integer default 12,
  p_is_fake text default 'all'
)
returns jsonb
language sql
stable
set search_path = public
as $$
with filtered_tx as (
  select
    t.id,
    t.order_id,
    t.order_number,
    t.transaction_date,
    t.qty::numeric as qty,
    t.initial_price::numeric as initial_price,
    t.deduction_fee::numeric as deduction_fee,
    t.net_profit::numeric as net_profit,
    t.outlet_id,
    t.food_merchant_id,
    t.product_variant_id,
    t.is_fake,
    t.company_expense,
    coalesce(t.order_id::text, t.id::text) as transaction_key,
    coalesce(o.name, '') as outlet_name,
    coalesce(m.name, '') as merchant_name,
    m.color as merchant_color,
    coalesce(v.name, '') as product_name
  from public.transactions t
  left join public.outlets o on o.id = t.outlet_id
  left join public.food_merchants m on m.id = t.food_merchant_id
  left join public.product_variants v on v.id = t.product_variant_id
  where t.transaction_date >= (p_from::text || ' 00:00:00+07')::timestamptz
    and t.transaction_date <= (p_to::text || ' 23:59:59.999+07')::timestamptz
    and (p_outlet is null or t.outlet_id = p_outlet)
    and (p_merchant is null or t.food_merchant_id = p_merchant)
    and (p_variant is null or t.product_variant_id = p_variant)
    and (
      nullif(trim(coalesce(p_q, '')), '') is null
      or t.order_number ilike '%' || trim(p_q) || '%'
      or o.name ilike '%' || trim(p_q) || '%'
      or m.name ilike '%' || trim(p_q) || '%'
      or v.name ilike '%' || trim(p_q) || '%'
    )
    and (
      p_is_fake = 'all'
      or (p_is_fake = 'fake' and t.is_fake = true)
      or (p_is_fake = 'normal' and t.is_fake = false)
    )
),
order_totals as (
  select
    transaction_key,
    max(transaction_date) as sort_date,
    max(order_number) as order_number,
    max(outlet_name) as outlet_name,
    max(merchant_name) as merchant_name,
    max(merchant_color) as merchant_color,
    bool_or(is_fake) as is_fake,
    sum(qty) as qty,
    sum(qty * initial_price) as gross,
    sum(deduction_fee) as fee,
    sum(net_profit) as net,
    sum(company_expense) as company_expense
  from filtered_tx
  group by transaction_key
),
order_count as (
  select count(*)::integer as total from order_totals
),
paged_orders as (
  select *
  from order_totals
  order by sort_date desc, transaction_key desc
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 12), 0), 48)
),
grouped as (
  select
    po.transaction_key,
    po.sort_date,
    po.order_number,
    po.outlet_name,
    po.merchant_name,
    po.merchant_color,
    po.is_fake,
    po.company_expense,
    po.qty,
    po.gross,
    po.fee,
    po.net,
    jsonb_agg(
      jsonb_build_object(
        'id', tx.id,
        'order_id', tx.order_id,
        'order_number', tx.order_number,
        'transaction_date', tx.transaction_date,
        'qty', tx.qty,
        'initial_price', tx.initial_price,
        'deduction_fee', tx.deduction_fee,
        'net_profit', tx.net_profit,
        'is_fake', tx.is_fake,
        'company_expense', tx.company_expense,
        'outlet_id', tx.outlet_id,
        'food_merchant_id', tx.food_merchant_id,
        'product_variant_id', tx.product_variant_id,
        'outlets', jsonb_build_object('name', tx.outlet_name),
        'food_merchants', jsonb_build_object(
          'name', tx.merchant_name,
          'color', tx.merchant_color
        ),
        'product_variants', jsonb_build_object('name', tx.product_name)
      )
      order by tx.transaction_date desc, tx.id desc
    ) as rows
  from paged_orders po
  join filtered_tx tx on tx.transaction_key = po.transaction_key
  group by
    po.transaction_key,
    po.sort_date,
    po.order_number,
    po.outlet_name,
    po.merchant_name,
    po.merchant_color,
    po.is_fake,
    po.company_expense,
    po.qty,
    po.gross,
    po.fee,
    po.net
)
select jsonb_build_object(
  'groups', coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'transaction_key', g.transaction_key,
          'sort_date', g.sort_date,
          'order_number', g.order_number,
          'outlet_name', g.outlet_name,
          'merchant_name', g.merchant_name,
          'merchant_color', g.merchant_color,
          'is_fake', g.is_fake,
          'company_expense', g.company_expense,
          'qty', g.qty,
          'gross', g.gross,
          'fee', g.fee,
          'net', g.net,
          'rows', g.rows
        )
        order by g.sort_date desc, g.transaction_key desc
      )
      from grouped g
    ),
    '[]'::jsonb
  ),
  'nextOffset', coalesce(p_offset, 0) + least(greatest(coalesce(p_limit, 12), 0), 48),
  'hasMore', (coalesce(p_offset, 0) + least(greatest(coalesce(p_limit, 12), 0), 48)) < coalesce((select total from order_count), 0)
);
$$;
