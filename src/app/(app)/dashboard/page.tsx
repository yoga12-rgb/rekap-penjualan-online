import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { DashboardClient } from "./DashboardClient";
import {
  todayWIBKey,
  daysAgoWIBKey,
  wibStartOfDay,
  wibEndOfDay,
  firstParam,
  isValidDateKey,
  previousPeriodForRange,
} from "@/lib/date";

export const dynamic = "force-dynamic";

type SP = {
  from?: string | string[];
  to?: string | string[];
  outlet?: string | string[];
  merchant?: string | string[];
  variant?: string | string[];
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const params = await searchParams;

  const defaultFrom = daysAgoWIBKey(6);
  const defaultTo = todayWIBKey();
  const rawFrom = firstParam(params.from);
  const rawTo = firstParam(params.to);
  let fromStr = isValidDateKey(rawFrom) ? rawFrom : defaultFrom;
  let toStr = isValidDateKey(rawTo) ? rawTo : defaultTo;
  let rangeWasReversed = false;
  // Auto-correct kalau user balikin range
  if (fromStr > toStr) {
    [fromStr, toStr] = [toStr, fromStr];
    rangeWasReversed = true;
  }

  const outlet =
    profile.role === "super_admin" ? firstParam(params.outlet) : "";
  const merchant = firstParam(params.merchant);
  const variant = firstParam(params.variant);
  const previousRange = previousPeriodForRange(fromStr, toStr);

  const [{ data: outlets }, { data: merchants }, { data: variants }] =
    await Promise.all([
      supabase.from("outlets").select("id,name").order("name"),
      supabase.from("food_merchants").select("id,name,color").order("name"),
      supabase
        .from("product_variants")
        .select("id,name,base_price")
        .order("name"),
    ]);

  let q = supabase
    .from("transactions")
    .select(
      "id, order_id, order_number, transaction_date, qty, initial_price, deduction_fee, net_profit, outlet_id, food_merchant_id, product_variant_id, outlets(name), food_merchants(name,color), product_variants(name)",
    )
    .gte("transaction_date", wibStartOfDay(fromStr))
    .lte("transaction_date", wibEndOfDay(toStr))
    .order("transaction_date", { ascending: true });

  let previousQ = supabase
    .from("transactions")
    .select(
      "id, order_id, order_number, transaction_date, qty, initial_price, deduction_fee, net_profit, outlet_id, food_merchant_id, product_variant_id, outlets(name), food_merchants(name,color), product_variants(name)",
    )
    .gte("transaction_date", wibStartOfDay(previousRange.from))
    .lte("transaction_date", wibEndOfDay(previousRange.to))
    .order("transaction_date", { ascending: true });

  let adCostsQ = supabase
    .from("daily_ad_costs")
    .select(
      "id,cost_date,outlet_id,food_merchant_id,amount,outlets(name),food_merchants(name,color)",
    )
    .gte("cost_date", fromStr)
    .lte("cost_date", toStr)
    .order("cost_date", { ascending: true });

  let previousAdCostsQ = supabase
    .from("daily_ad_costs")
    .select(
      "id,cost_date,outlet_id,food_merchant_id,amount,outlets(name),food_merchants(name,color)",
    )
    .gte("cost_date", previousRange.from)
    .lte("cost_date", previousRange.to)
    .order("cost_date", { ascending: true });

  if (profile.role === "kasir") {
    q = profile.outlet_id
      ? q.eq("outlet_id", profile.outlet_id)
      : q.is("outlet_id", null);
    previousQ = profile.outlet_id
      ? previousQ.eq("outlet_id", profile.outlet_id)
      : previousQ.is("outlet_id", null);
    adCostsQ = profile.outlet_id
      ? adCostsQ.eq("outlet_id", profile.outlet_id)
      : adCostsQ.is("outlet_id", null);
    previousAdCostsQ = profile.outlet_id
      ? previousAdCostsQ.eq("outlet_id", profile.outlet_id)
      : previousAdCostsQ.is("outlet_id", null);
  }
  if (outlet) {
    q = q.eq("outlet_id", outlet);
    previousQ = previousQ.eq("outlet_id", outlet);
    adCostsQ = adCostsQ.eq("outlet_id", outlet);
    previousAdCostsQ = previousAdCostsQ.eq("outlet_id", outlet);
  }
  if (merchant) {
    q = q.eq("food_merchant_id", merchant);
    previousQ = previousQ.eq("food_merchant_id", merchant);
    adCostsQ = adCostsQ.eq("food_merchant_id", merchant);
    previousAdCostsQ = previousAdCostsQ.eq("food_merchant_id", merchant);
  }
  if (variant) {
    q = q.eq("product_variant_id", variant);
    previousQ = previousQ.eq("product_variant_id", variant);
  }

  const [
    { data: rows },
    { data: previousRows },
    { data: adCosts },
    { data: previousAdCosts },
  ] = await Promise.all([q, previousQ, adCostsQ, previousAdCostsQ]);

  return (
    <DashboardClient
      role={profile.role}
      outlets={outlets ?? []}
      merchants={(merchants ?? []) as any}
      variants={(variants ?? []) as any}
      rows={(rows ?? []) as any}
      previousRows={(previousRows ?? []) as any}
      adCosts={(variant ? [] : (adCosts ?? [])) as any}
      previousAdCosts={(variant ? [] : (previousAdCosts ?? [])) as any}
      previousRange={previousRange}
      filter={{
        from: fromStr,
        to: toStr,
        outlet,
        merchant,
        variant,
        rangeWasReversed,
      }}
    />
  );
}
