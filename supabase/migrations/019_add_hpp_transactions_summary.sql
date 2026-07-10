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
    t.total_hpp::numeric as total_hpp,
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
  'net', coalesce(sum(net_profit), 0),
  'hpp', coalesce(sum(total_hpp), 0),
  'cleanProfit', coalesce(sum(net_profit), 0) - coalesce(sum(total_hpp), 0)
)
from filtered_tx;
$$;
