-- 021_add_daily_matrix.sql
create or replace function public.get_revenue_matrix(
  p_from date,
  p_to date,
  p_group_by text default 'day',
  p_outlet uuid default null,
  p_merchant uuid default null
)
returns jsonb
language sql
stable
set search_path = public
as $$
with filtered_tx as (
  select
    t.id,
    t.outlet_id,
    t.food_merchant_id,
    t.qty::numeric as qty,
    t.initial_price::numeric as initial_price,
    t.deduction_fee::numeric as deduction_fee,
    t.net_profit::numeric as net_profit,
    case
      when p_group_by = 'month' then to_char(t.transaction_date at time zone 'Asia/Jakarta', 'YYYY-MM')
      when p_group_by = 'year' then to_char(t.transaction_date at time zone 'Asia/Jakarta', 'YYYY')
      else to_char(t.transaction_date at time zone 'Asia/Jakarta', 'YYYY-MM-DD')
    end as time_key
  from public.transactions t
  where t.transaction_date >= (p_from::text || ' 00:00:00+07')::timestamptz
    and t.transaction_date <= (p_to::text || ' 23:59:59.999+07')::timestamptz
    and (p_outlet is null or t.outlet_id = p_outlet)
    and (p_merchant is null or t.food_merchant_id = p_merchant)
    and t.is_fake = false
),
outlet_merchant_time as (
  select
    outlet_id,
    food_merchant_id,
    time_key,
    sum(qty * initial_price) as gross,
    sum(net_profit) as net
  from filtered_tx
  group by outlet_id, food_merchant_id, time_key
),
outlet_merchant_agg as (
  select
    outlet_id,
    food_merchant_id,
    sum(gross) as total_gross,
    sum(net) as total_net,
    jsonb_object_agg(
      time_key,
      jsonb_build_object('gross', gross, 'net', net)
    ) as time_data
  from outlet_merchant_time
  group by outlet_id, food_merchant_id
),
merchant_groups as (
  select
    oma.food_merchant_id,
    m.name as merchant_name,
    m.color as merchant_color,
    jsonb_agg(
      jsonb_build_object(
        'outlet_id', oma.outlet_id,
        'outlet_name', coalesce(o.name, 'Unknown'),
        'total_gross', oma.total_gross,
        'total_net', oma.total_net,
        'time_data', coalesce(oma.time_data, '{}'::jsonb)
      )
      order by o.name
    ) as outlets
  from outlet_merchant_agg oma
  left join public.outlets o on o.id = oma.outlet_id
  left join public.food_merchants m on m.id = oma.food_merchant_id
  group by oma.food_merchant_id, m.name, m.color
)
select coalesce(jsonb_agg(
  jsonb_build_object(
    'merchant_id', mg.food_merchant_id,
    'merchant_name', coalesce(mg.merchant_name, 'Unknown'),
    'merchant_color', mg.merchant_color,
    'outlets', mg.outlets
  )
  order by mg.merchant_name
), '[]'::jsonb)
from merchant_groups mg;
$$;

grant execute on function public.get_revenue_matrix(date, date, text, uuid, uuid) to authenticated;
