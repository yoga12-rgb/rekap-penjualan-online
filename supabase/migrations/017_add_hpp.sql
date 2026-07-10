alter table public.product_variants add column if not exists hpp numeric not null default 0;
alter table public.transactions add column if not exists total_hpp numeric not null default 0;

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

fake_tx as (
  select
    t.net_profit::numeric as net_profit,
    t.company_expense::numeric as company_expense,
    t.total_hpp::numeric as total_hpp
  from public.transactions t
  where t.transaction_date >= (p_from::text || ' 00:00:00+07')::timestamptz
    and t.transaction_date <= (p_to::text || ' 23:59:59.999+07')::timestamptz
    and t.is_fake = true
    and (p_outlet is null or t.outlet_id = p_outlet)
    and (p_merchant is null or t.food_merchant_id = p_merchant)
    and (p_variant is null or t.product_variant_id = p_variant)
),
fake_totals as (
  select
    coalesce(sum(company_expense), 0) as company_expense,
    coalesce(sum(net_profit), 0) as net,
    coalesce(sum(company_expense), 0) - coalesce(sum(net_profit), 0) as loss
  from fake_tx
),
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
    t.total_hpp::numeric as total_hpp,
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
    t.total_hpp::numeric as total_hpp,
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
    coalesce(sum(total_hpp), 0) as hpp,
    coalesce(sum(qty), 0) as qty,
    count(distinct transaction_key)::numeric as transaction_count
  from current_tx
),
previous_tx_totals as (
  select
    coalesce(sum(gross), 0) as gross,
    coalesce(sum(deduction_fee), 0) as fee,
    coalesce(sum(net_profit), 0) as net,
    coalesce(sum(total_hpp), 0) as hpp,
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
    t.hpp,
    coalesce((select sum(amount) from current_ad), 0) as ad_cost,
    t.net - coalesce((select sum(amount) from current_ad), 0) - t.hpp as clean_profit,
    t.qty,
    t.transaction_count,
    case when t.transaction_count > 0 then t.gross / t.transaction_count else 0 end as avg_gross,
    case when t.transaction_count > 0 then t.qty / t.transaction_count else 0 end as avg_qty,
    case when t.qty > 0 then t.net / t.qty else 0 end as margin_per_qty
  from current_tx_totals t
),
previous_totals as (
  select
    t.gross,
    t.fee,
    case when t.gross > 0 then (t.fee / t.gross) * 100 else 0 end as fee_percent,
    t.net,
    t.hpp,
    coalesce((select sum(amount) from previous_ad), 0) as ad_cost,
    t.net - coalesce((select sum(amount) from previous_ad), 0) - t.hpp as clean_profit,
    t.qty,
    t.transaction_count,
    case when t.transaction_count > 0 then t.gross / t.transaction_count else 0 end as avg_gross,
    case when t.transaction_count > 0 then t.qty / t.transaction_count else 0 end as avg_qty,
    case when t.qty > 0 then t.net / t.qty else 0 end as margin_per_qty
  from previous_tx_totals t
),
metrics_array as (
  select
    c.gross as c_gross, p.gross as p_gross,
    c.fee as c_fee, p.fee as p_fee,
    c.net as c_net, p.net as p_net,
    c.clean_profit as c_clean, p.clean_profit as p_clean,
    c.transaction_count as c_tx, p.transaction_count as p_tx,
    c.qty as c_qty, p.qty as p_qty,
    c.avg_gross as c_avg_g, p.avg_gross as p_avg_g,
    c.avg_qty as c_avg_q, p.avg_qty as p_avg_q,
    c.margin_per_qty as c_marg, p.margin_per_qty as p_marg,
    c.ad_cost as c_ad, p.ad_cost as p_ad,
    c.fee_percent as c_fee_pct, p.fee_percent as p_fee_pct,
    (select loss from fake_totals) as fake_loss
  from current_totals c
  cross join previous_totals p
)
select jsonb_build_object(
  'metrics', (
    select jsonb_agg(
      jsonb_build_object(
        'label', label,
        'current', current_val,
        'previous', previous_val,
        'format', format
      )
    )
    from (
      values
      ('Total Omset', (select c_gross from metrics_array), (select p_gross from metrics_array), 'currency'),
      ('Potongan/Komisi', (select c_fee from metrics_array), (select p_fee from metrics_array), 'currency'),
      ('% Komisi', (select c_fee_pct from metrics_array), (select p_fee_pct from metrics_array), 'percent'),
      ('Pendapatan Bersih', (select c_net from metrics_array), (select p_net from metrics_array), 'currency'),
      ('Biaya Iklan', (select c_ad from metrics_array), (select p_ad from metrics_array), 'currency'),
      ('Profit Bersih', (select c_clean from metrics_array), (select p_clean from metrics_array), 'currency'),
      ('Transaksi', (select c_tx from metrics_array), (select p_tx from metrics_array), 'number'),
      ('Barang Terjual', (select c_qty from metrics_array), (select p_qty from metrics_array), 'number'),
      ('Rata-rata Order', (select c_avg_g from metrics_array), (select p_avg_g from metrics_array), 'currency'),
      ('Rata-rata Qty', (select c_avg_q from metrics_array), (select p_avg_q from metrics_array), 'number'),
      ('Margin per Item', (select c_marg from metrics_array), (select p_marg from metrics_array), 'currency'),
      ('Biaya Fake Order', (select fake_loss from metrics_array), null, 'currency')
    ) as v(label, current_val, previous_val, format)
  ),
  'outlets', (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'name', outlet_name,
        'gross', gross,
        'qty', qty,
        'cleanProfit', clean_profit
      )
      order by gross desc
    ), '[]'::jsonb)
    from (
      select
        t.outlet_name,
        sum(t.gross) as gross,
        sum(t.qty) as qty,
        sum(t.net_profit) - coalesce((
          select sum(amount) from current_ad a where a.outlet_id = t.outlet_id
        ), 0) - sum(t.total_hpp) as clean_profit
      from current_tx t
      group by t.outlet_id, t.outlet_name
    ) sub
  ),
  'merchants', (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'name', merchant_name,
        'color', merchant_color,
        'gross', gross,
        'qty', qty,
        'cleanProfit', clean_profit,
        'previousGross', previous_gross,
        'previousQty', previous_qty
      )
      order by gross desc
    ), '[]'::jsonb)
    from (
      select
        coalesce(c.merchant_name, p.merchant_name) as merchant_name,
        coalesce(c.merchant_color, p.merchant_color) as merchant_color,
        coalesce(c.gross, 0) as gross,
        coalesce(c.qty, 0) as qty,
        coalesce(c.clean_profit, 0) as clean_profit,
        coalesce(p.previous_gross, 0) as previous_gross,
        coalesce(p.previous_qty, 0) as previous_qty
      from (
        select
          t.food_merchant_id,
          t.merchant_name,
          t.merchant_color,
          sum(t.gross) as gross,
          sum(t.qty) as qty,
          sum(t.net_profit) - coalesce((
            select sum(amount) from current_ad a where a.food_merchant_id = t.food_merchant_id
          ), 0) - sum(t.total_hpp) as clean_profit
        from current_tx t
        group by t.food_merchant_id, t.merchant_name, t.merchant_color
      ) c
      full outer join (
        select
          t.food_merchant_id,
          t.merchant_name,
          t.merchant_color,
          sum(t.gross) as previous_gross,
          sum(t.qty) as previous_qty
        from previous_tx t
        group by t.food_merchant_id, t.merchant_name, t.merchant_color
      ) p on p.food_merchant_id = c.food_merchant_id
    ) sub
  ),
  'products', (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'name', product_name,
        'gross', gross,
        'qty', qty,
        'cleanProfit', clean_profit,
        'previousGross', previous_gross,
        'previousQty', previous_qty
      )
      order by gross desc
    ), '[]'::jsonb)
    from (
      select
        coalesce(c.product_name, p.product_name) as product_name,
        coalesce(c.gross, 0) as gross,
        coalesce(c.qty, 0) as qty,
        coalesce(c.clean_profit, 0) as clean_profit,
        coalesce(p.previous_gross, 0) as previous_gross,
        coalesce(p.previous_qty, 0) as previous_qty
      from (
        select
          t.product_variant_id,
          t.product_name,
          sum(t.gross) as gross,
          sum(t.qty) as qty,
          sum(t.net_profit) - sum(t.total_hpp) as clean_profit
        from current_tx t
        group by t.product_variant_id, t.product_name
      ) c
      full outer join (
        select
          t.product_variant_id,
          t.product_name,
          sum(t.gross) as previous_gross,
          sum(t.qty) as previous_qty
        from previous_tx t
        group by t.product_variant_id, t.product_name
      ) p on p.product_variant_id = c.product_variant_id
    ) sub
  ),
  'trends', (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'date', date_key,
        'gross', gross,
        'cleanProfit', clean_profit,
        'qty', qty,
        'transactionCount', transaction_count
      )
      order by date_key
    ), '[]'::jsonb)
    from (
      select
        t.date_key,
        sum(t.gross) as gross,
        sum(t.qty) as qty,
        count(distinct t.transaction_key) as transaction_count,
        sum(t.net_profit) - coalesce((
          select sum(amount) from current_ad a where a.date_key = t.date_key
        ), 0) - sum(t.total_hpp) as clean_profit
      from current_tx t
      group by t.date_key
    ) sub
  ),
  'hours', (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'hour', hour_key,
        'gross', gross,
        'cleanProfit', clean_profit,
        'qty', qty,
        'transactionCount', transaction_count
      )
      order by hour_key
    ), '[]'::jsonb)
    from (
      select
        t.hour_key,
        sum(t.gross) as gross,
        sum(t.qty) as qty,
        count(distinct t.transaction_key) as transaction_count,
        sum(t.net_profit) - sum(t.total_hpp) as clean_profit
      from current_tx t
      group by t.hour_key
    ) sub
  ),
  'insights', '[]'::jsonb
);
$$;
