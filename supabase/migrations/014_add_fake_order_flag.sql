alter table public.transactions add column if not exists is_fake boolean not null default false;

create or replace function public.get_dashboard_summary(
  p_from date,
  p_to date,
  p_previous_from date,
  p_previous_to date,
  p_outlet uuid default null,
  p_merchant uuid default null,
  p_variant uuid default null
)
returns jsonb
language sql
stable
set search_path = public
as $$
with
current_tx as (
  select
    t.id,
    t.order_id,
    t.outlet_id,
    t.food_merchant_id,
    t.product_variant_id,
    t.transaction_date,
    t.qty::numeric as qty,
    t.initial_price::numeric as initial_price,
    t.deduction_fee::numeric as deduction_fee,
    t.net_profit::numeric as net_profit,
    (t.qty::numeric * t.initial_price::numeric) as gross,
    coalesce(t.order_id::text, t.id::text) as transaction_key,
    ((t.transaction_date at time zone 'Asia/Jakarta')::date)::text as date_key,
    extract(hour from (t.transaction_date at time zone 'Asia/Jakarta'))::int as hour_key,
    coalesce(o.name, '-') as outlet_name,
    coalesce(m.name, '-') as merchant_name,
    m.color as merchant_color,
    coalesce(v.name, '-') as product_name
  from public.transactions t
  left join public.outlets o on o.id = t.outlet_id
  left join public.food_merchants m on m.id = t.food_merchant_id
  left join public.product_variants v on v.id = t.product_variant_id
  where t.transaction_date >= (p_from::text || ' 00:00:00+07')::timestamptz
    and t.transaction_date <= (p_to::text || ' 23:59:59.999+07')::timestamptz
    and t.is_fake = false
    and (p_outlet is null or t.outlet_id = p_outlet)
    and (p_merchant is null or t.food_merchant_id = p_merchant)
    and (p_variant is null or t.product_variant_id = p_variant)
),
previous_tx as (
  select
    t.id,
    t.order_id,
    t.food_merchant_id,
    t.product_variant_id,
    t.qty::numeric as qty,
    t.net_profit::numeric as net_profit,
    (t.qty::numeric * t.initial_price::numeric) as gross,
    t.deduction_fee::numeric as deduction_fee,
    coalesce(t.order_id::text, t.id::text) as transaction_key,
    coalesce(m.name, '-') as merchant_name,
    coalesce(v.name, '-') as product_name
  from public.transactions t
  left join public.food_merchants m on m.id = t.food_merchant_id
  left join public.product_variants v on v.id = t.product_variant_id
  where t.transaction_date >= (p_previous_from::text || ' 00:00:00+07')::timestamptz
    and t.transaction_date <= (p_previous_to::text || ' 23:59:59.999+07')::timestamptz
    and t.is_fake = false
    and (p_outlet is null or t.outlet_id = p_outlet)
    and (p_merchant is null or t.food_merchant_id = p_merchant)
    and (p_variant is null or t.product_variant_id = p_variant)
),
current_ad as (
  select
    a.cost_date::text as date_key,
    a.outlet_id,
    a.food_merchant_id,
    a.amount::numeric as amount,
    coalesce(o.name, '-') as outlet_name,
    coalesce(m.name, '-') as merchant_name,
    m.color as merchant_color
  from public.daily_ad_costs a
  left join public.outlets o on o.id = a.outlet_id
  left join public.food_merchants m on m.id = a.food_merchant_id
  where p_variant is null
    and a.cost_date >= p_from
    and a.cost_date <= p_to
    and (p_outlet is null or a.outlet_id = p_outlet)
    and (p_merchant is null or a.food_merchant_id = p_merchant)
),
previous_ad as (
  select a.amount::numeric as amount
  from public.daily_ad_costs a
  where p_variant is null
    and a.cost_date >= p_previous_from
    and a.cost_date <= p_previous_to
    and (p_outlet is null or a.outlet_id = p_outlet)
    and (p_merchant is null or a.food_merchant_id = p_merchant)
),
current_tx_totals as (
  select
    coalesce(sum(gross), 0) as gross,
    coalesce(sum(deduction_fee), 0) as fee,
    coalesce(sum(net_profit), 0) as net,
    coalesce(sum(qty), 0) as qty,
    count(distinct transaction_key)::numeric as transaction_count
  from current_tx
),
previous_tx_totals as (
  select
    coalesce(sum(gross), 0) as gross,
    coalesce(sum(deduction_fee), 0) as fee,
    coalesce(sum(net_profit), 0) as net,
    coalesce(sum(qty), 0) as qty,
    count(distinct transaction_key)::numeric as transaction_count
  from previous_tx
),
current_totals as (
  select
    t.gross,
    t.fee,
    case when t.gross > 0 then (t.fee / t.gross) * 100 else 0 end as fee_percent,
    t.net,
    coalesce((select sum(amount) from current_ad), 0) as ad_cost,
    t.net - coalesce((select sum(amount) from current_ad), 0) as clean_profit,
    t.qty,
    t.transaction_count,
    case when t.transaction_count > 0 then t.gross / t.transaction_count else 0 end as avg_gross,
    case when t.transaction_count > 0 then t.qty / t.transaction_count else 0 end as avg_qty,
    case when t.transaction_count > 0 then t.net / t.transaction_count else 0 end as avg_net
  from current_tx_totals t
),
previous_totals as (
  select
    t.gross,
    t.fee,
    case when t.gross > 0 then (t.fee / t.gross) * 100 else 0 end as fee_percent,
    t.net,
    coalesce((select sum(amount) from previous_ad), 0) as ad_cost,
    t.net - coalesce((select sum(amount) from previous_ad), 0) as clean_profit,
    t.qty,
    t.transaction_count,
    case when t.transaction_count > 0 then t.gross / t.transaction_count else 0 end as avg_gross,
    case when t.transaction_count > 0 then t.qty / t.transaction_count else 0 end as avg_qty,
    case when t.transaction_count > 0 then t.net / t.transaction_count else 0 end as avg_net
  from previous_tx_totals t
),
comparison_rows as (
  select item.*
  from current_totals c
  cross join previous_totals p
  cross join lateral (
    values
      ('Omset', c.gross, p.gross, 'currency'),
      ('Net Profit', c.net, p.net, 'currency'),
      ('Profit Bersih', c.clean_profit, p.clean_profit, 'currency'),
      ('Qty', c.qty, p.qty, 'number'),
      ('Rata-rata Qty', c.avg_qty, p.avg_qty, 'number'),
      ('Transaksi', c.transaction_count, p.transaction_count, 'number')
  ) as item(label, current_value, previous_value, format)
),
daily_tx as (
  select date_key, sum(gross) as gross, sum(deduction_fee) as fee, sum(net_profit) as net
  from current_tx
  group by date_key
),
daily_ad as (
  select date_key, sum(amount) as ad_cost
  from current_ad
  group by date_key
),
daily as (
  select
    coalesce(t.date_key, a.date_key) as date,
    coalesce(t.gross, 0) as gross,
    coalesce(t.fee, 0) as fee,
    coalesce(t.net, 0) as net,
    coalesce(a.ad_cost, 0) as ad_cost,
    coalesce(t.net, 0) - coalesce(a.ad_cost, 0) as clean_profit
  from daily_tx t
  full outer join daily_ad a on a.date_key = t.date_key
),
leaderboard as (
  select
    product_variant_id,
    min(product_name) as name,
    sum(qty) as qty,
    sum(gross) as gross,
    sum(net_profit) as net
  from current_tx
  group by product_variant_id
  order by sum(qty) desc
  limit 10
),
merchant_tx as (
  select
    food_merchant_id,
    min(merchant_name) as name,
    min(merchant_color) as color,
    sum(net_profit) as net
  from current_tx
  group by food_merchant_id
),
merchant_ad as (
  select
    food_merchant_id,
    min(merchant_name) as name,
    min(merchant_color) as color,
    sum(amount) as ad_cost
  from current_ad
  group by food_merchant_id
),
merchant_breakdown as (
  select
    coalesce(t.food_merchant_id, a.food_merchant_id) as id,
    coalesce(t.name, a.name, '-') as name,
    coalesce(t.net, 0) as net,
    coalesce(a.ad_cost, 0) as ad_cost,
    coalesce(t.net, 0) - coalesce(a.ad_cost, 0) as clean_profit,
    coalesce(t.color, a.color) as color
  from merchant_tx t
  full outer join merchant_ad a on a.food_merchant_id = t.food_merchant_id
),
outlet_tx as (
  select
    outlet_id,
    min(outlet_name) as name,
    sum(gross) as gross,
    sum(net_profit) as net,
    sum(qty) as qty,
    count(distinct transaction_key)::numeric as transaction_count
  from current_tx
  group by outlet_id
),
outlet_ad as (
  select
    outlet_id,
    min(outlet_name) as name,
    sum(amount) as ad_cost
  from current_ad
  group by outlet_id
),
outlet_breakdown as (
  select
    coalesce(t.outlet_id, a.outlet_id) as id,
    coalesce(t.name, a.name, '-') as name,
    coalesce(t.gross, 0) as gross,
    coalesce(t.net, 0) as net,
    coalesce(a.ad_cost, 0) as ad_cost,
    coalesce(t.net, 0) - coalesce(a.ad_cost, 0) as clean_profit,
    coalesce(t.qty, 0) as qty,
    coalesce(t.transaction_count, 0) as transaction_count
  from outlet_tx t
  full outer join outlet_ad a on a.outlet_id = t.outlet_id
),
hourly_tx as (
  select
    hour_key,
    sum(gross) as gross,
    sum(net_profit) as net,
    sum(qty) as qty,
    count(distinct transaction_key)::numeric as transaction_count
  from current_tx
  group by hour_key
),
hourly as (
  select
    h.hour as hour,
    lpad(h.hour::text, 2, '0') || ':00' as label,
    coalesce(t.gross, 0) as gross,
    coalesce(t.net, 0) as net,
    coalesce(t.qty, 0) as qty,
    coalesce(t.transaction_count, 0) as transaction_count
  from generate_series(0, 23) as h(hour)
  left join hourly_tx t on t.hour_key = h.hour
),
product_current as (
  select product_variant_id as key, min(product_name) as name, sum(qty) as value
  from current_tx
  group by product_variant_id
),
product_previous as (
  select product_variant_id as key, min(product_name) as name, sum(qty) as value
  from previous_tx
  group by product_variant_id
),
product_declines as (
  select
    coalesce(c.key, p.key)::text as key,
    coalesce(c.name, p.name, '-') as name,
    coalesce(c.value, 0) as current,
    coalesce(p.value, 0) as previous,
    coalesce(c.value, 0) - coalesce(p.value, 0) as delta
  from product_current c
  full outer join product_previous p on p.key = c.key
  where coalesce(c.value, 0) - coalesce(p.value, 0) < 0
    and coalesce(p.value, 0) > 0
  order by coalesce(c.value, 0) - coalesce(p.value, 0)
  limit 5
),
merchant_current as (
  select food_merchant_id as key, min(merchant_name) as name, sum(net_profit) as value
  from current_tx
  group by food_merchant_id
),
merchant_previous as (
  select food_merchant_id as key, min(merchant_name) as name, sum(net_profit) as value
  from previous_tx
  group by food_merchant_id
),
merchant_declines as (
  select
    coalesce(c.key, p.key)::text as key,
    coalesce(c.name, p.name, '-') as name,
    coalesce(c.value, 0) as current,
    coalesce(p.value, 0) as previous,
    coalesce(c.value, 0) - coalesce(p.value, 0) as delta
  from merchant_current c
  full outer join merchant_previous p on p.key = c.key
  where coalesce(c.value, 0) - coalesce(p.value, 0) < 0
    and coalesce(p.value, 0) > 0
  order by coalesce(c.value, 0) - coalesce(p.value, 0)
  limit 5
),
merchant_increases as (
  select
    coalesce(c.key, p.key)::text as key,
    coalesce(c.name, p.name, '-') as name,
    coalesce(c.value, 0) as current,
    coalesce(p.value, 0) as previous,
    coalesce(c.value, 0) - coalesce(p.value, 0) as delta
  from merchant_current c
  full outer join merchant_previous p on p.key = c.key
  where coalesce(c.value, 0) - coalesce(p.value, 0) > 0
  order by coalesce(c.value, 0) - coalesce(p.value, 0) desc
  limit 5
)
select jsonb_build_object(
  'totals', (
    select jsonb_build_object(
      'gross', gross,
      'fee', fee,
      'feePercent', fee_percent,
      'net', net,
      'adCost', ad_cost,
      'cleanProfit', clean_profit,
      'qty', qty,
      'transactionCount', transaction_count,
      'avgGross', avg_gross,
      'avgQty', avg_qty,
      'avgNet', avg_net
    )
    from current_totals
  ),
  'comparison', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'label', label,
        'current', current_value,
        'previous', previous_value,
        'delta', current_value - previous_value,
        'percentChange',
          case
            when previous_value <> 0 then ((current_value - previous_value) / abs(previous_value)) * 100
            when current_value > 0 then 100
            when current_value < 0 then -100
            else 0
          end,
        'format', format
      )
    )
    from comparison_rows
  ), '[]'::jsonb),
  'daily', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'date', date,
        'gross', gross,
        'fee', fee,
        'net', net,
        'adCost', ad_cost,
        'cleanProfit', clean_profit
      )
      order by date
    )
    from daily
  ), '[]'::jsonb),
  'leaderboard', coalesce((
    select jsonb_agg(
      jsonb_build_object('name', name, 'qty', qty, 'gross', gross, 'net', net)
      order by qty desc
    )
    from leaderboard
  ), '[]'::jsonb),
  'merchantBreakdown', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'name', name,
        'net', net,
        'adCost', ad_cost,
        'cleanProfit', clean_profit,
        'color', color
      )
      order by clean_profit desc
    )
    from merchant_breakdown
  ), '[]'::jsonb),
  'outletBreakdown', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'name', name,
        'gross', gross,
        'net', net,
        'adCost', ad_cost,
        'cleanProfit', clean_profit,
        'qty', qty,
        'transactionCount', transaction_count
      )
      order by clean_profit desc
    )
    from outlet_breakdown
  ), '[]'::jsonb),
  'hourly', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'hour', hour,
        'label', label,
        'gross', gross,
        'net', net,
        'qty', qty,
        'transactionCount', transaction_count
      )
      order by hour
    )
    from hourly
  ), '[]'::jsonb),
  'productDeclines', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'key', key,
        'name', name,
        'current', current,
        'previous', previous,
        'delta', delta,
        'percentChange', case when previous > 0 then (delta / previous) * 100 else 0 end
      )
      order by delta
    )
    from product_declines
  ), '[]'::jsonb),
  'merchantDeclines', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'key', key,
        'name', name,
        'current', current,
        'previous', previous,
        'delta', delta,
        'percentChange', case when previous > 0 then (delta / previous) * 100 else 0 end
      )
      order by delta
    )
    from merchant_declines
  ), '[]'::jsonb),
  'merchantIncreases', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'key', key,
        'name', name,
        'current', current,
        'previous', previous,
        'delta', delta,
        'percentChange', case when previous > 0 then (delta / previous) * 100 else 0 end
      )
      order by delta desc
    )
    from merchant_increases
  ), '[]'::jsonb),
  'insights', '[]'::jsonb
);
$$;

grant execute on function public.get_dashboard_summary(date, date, date, date, uuid, uuid, uuid) to authenticated;


-- Aggregated transaction payloads for the Transactions page.
-- Keeps summary cards and order pagination on the database side.

create or replace function public.get_transactions_summary(
  p_from date,
  p_to date,
  p_outlet uuid default null,
  p_merchant uuid default null,
  p_variant uuid default null,
  p_q text default null
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
  p_limit integer default 12
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
    sum(net_profit) as net
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
    po.qty,
    po.gross,
    po.fee,
    po.net,
    po.is_fake,
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
    po.qty,
    po.gross,
    po.fee,
    po.net
),
page_meta as (
  select
    coalesce(count(*), 0)::integer as page_count,
    greatest(coalesce(p_offset, 0), 0)::integer as safe_offset
  from paged_orders
)
select jsonb_build_object(
  'groups', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'order_id', transaction_key,
        'orderNumber', order_number,
        'date', sort_date,
        'outlet', outlet_name,
        'merchant', merchant_name,
        'merchantColor', merchant_color,
        'is_fake', is_fake,
        'rows', rows,
        'qty', qty,
        'gross', gross,
        'fee', fee,
        'net', net
      )
      order by sort_date desc, transaction_key desc
    )
    from grouped
  ), '[]'::jsonb),
  'nextOffset', (select safe_offset + page_count from page_meta),
  'hasMore', (
    select oc.total > pm.safe_offset + pm.page_count
    from order_count oc
    cross join page_meta pm
  )
);
$$;

grant execute on function public.get_transactions_summary(date, date, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.get_transaction_order_page(date, date, uuid, uuid, uuid, text, integer, integer) to authenticated;
