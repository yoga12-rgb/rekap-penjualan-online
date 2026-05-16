import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { DashboardClient } from "./DashboardClient";
import {
  daysAgoWIBKey, todayWIBKey, wibStartOfDay, wibEndOfDay, firstParam
} from "@/lib/date";

export const dynamic = "force-dynamic";

type SP = {
  from?: string | string[];
  to?: string | string[];
  outlet?: string | string[];
  merchant?: string | string[];
  variant?: string | string[];
};

export default async function DashboardPage({ searchParams }: { searchParams: SP }) {
  const profile = await requireProfile();
  const supabase = createClient();

  let fromStr = firstParam(searchParams.from) || daysAgoWIBKey(29);
  let toStr = firstParam(searchParams.to) || todayWIBKey();
  // Auto-correct kalau user balikin range
  if (fromStr > toStr) [fromStr, toStr] = [toStr, fromStr];

  const outlet = firstParam(searchParams.outlet);
  const merchant = firstParam(searchParams.merchant);
  const variant = firstParam(searchParams.variant);

  const [{ data: outlets }, { data: merchants }, { data: variants }] = await Promise.all([
    supabase.from("outlets").select("id,name").order("name"),
    supabase.from("food_merchants").select("id,name,color").order("name"),
    supabase.from("product_variants").select("id,name,base_price").order("name")
  ]);

  let q = supabase
    .from("transactions")
    .select("id, transaction_date, qty, initial_price, deduction_fee, net_profit, outlet_id, food_merchant_id, product_variant_id, outlets(name), food_merchants(name,color), product_variants(name)")
    .gte("transaction_date", wibStartOfDay(fromStr))
    .lte("transaction_date", wibEndOfDay(toStr))
    .order("transaction_date", { ascending: true });

  if (profile.role === "kasir" && profile.outlet_id) q = q.eq("outlet_id", profile.outlet_id);
  if (outlet) q = q.eq("outlet_id", outlet);
  if (merchant) q = q.eq("food_merchant_id", merchant);
  if (variant) q = q.eq("product_variant_id", variant);

  const { data: rows } = await q;

  return (
    <DashboardClient
      role={profile.role}
      outlets={outlets ?? []}
      merchants={(merchants ?? []) as any}
      variants={(variants ?? []) as any}
      rows={(rows ?? []) as any}
      filter={{ from: fromStr, to: toStr, outlet, merchant, variant }}
    />
  );
}
