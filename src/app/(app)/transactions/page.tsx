import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { TransactionsClient } from "./TransactionsClient";
import {
  daysAgoWIBKey, todayWIBKey, wibStartOfDay, wibEndOfDay, firstParam, isValidDateKey
} from "@/lib/date";

export const dynamic = "force-dynamic";

type SP = {
  from?: string | string[];
  to?: string | string[];
  outlet?: string | string[];
  merchant?: string | string[];
  variant?: string | string[];
  q?: string | string[];
};

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const params = await searchParams;

  const rawFrom = firstParam(params.from);
  const rawTo = firstParam(params.to);
  let fromStr = isValidDateKey(rawFrom) ? rawFrom : daysAgoWIBKey(29);
  let toStr = isValidDateKey(rawTo) ? rawTo : todayWIBKey();
  if (fromStr > toStr) [fromStr, toStr] = [toStr, fromStr];

  const filter = {
    from: fromStr,
    to: toStr,
    outlet: profile.role === "super_admin" ? firstParam(params.outlet) : "",
    merchant: firstParam(params.merchant),
    variant: firstParam(params.variant),
    q: firstParam(params.q)
  };

  const [{ data: outlets }, { data: merchants }, { data: variants }] = await Promise.all([
    supabase.from("outlets").select("id,name").order("name"),
    supabase.from("food_merchants").select("id,name,color").order("name"),
    supabase.from("product_variants").select("id,name,base_price").order("name")
  ]);

  let q = supabase
    .from("transactions")
    .select("id, order_id, transaction_date, qty, initial_price, deduction_fee, net_profit, outlet_id, food_merchant_id, product_variant_id, outlets(name), food_merchants(name,color), product_variants(name)")
    .gte("transaction_date", wibStartOfDay(filter.from))
    .lte("transaction_date", wibEndOfDay(filter.to))
    .order("transaction_date", { ascending: false })
    .limit(1000);

  if (profile.role === "kasir") q = profile.outlet_id ? q.eq("outlet_id", profile.outlet_id) : q.is("outlet_id", null);
  if (filter.outlet) q = q.eq("outlet_id", filter.outlet);
  if (filter.merchant) q = q.eq("food_merchant_id", filter.merchant);
  if (filter.variant) q = q.eq("product_variant_id", filter.variant);

  const { data: rows } = await q;

  return (
    <TransactionsClient
      role={profile.role}
      myOutletId={profile.outlet_id}
      outlets={outlets ?? []}
      merchants={(merchants ?? []) as any}
      variants={(variants ?? []) as any}
      rows={(rows ?? []) as any}
      filter={filter}
    />
  );
}
