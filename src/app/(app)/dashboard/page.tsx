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
const PAGE_SIZE = 1000;

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

  async function fetchAll(buildPage: (offset: number) => any) {
    const rows: any[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data } = await buildPage(offset);
      const pageRows = data ?? [];
      rows.push(...pageRows);
      if (pageRows.length < PAGE_SIZE) break;
    }
    return rows;
  }

  function buildTransactionsQuery(from: string, to: string, offset: number) {
    let query = supabase
      .from("transactions")
      .select(
        "id, order_id, order_number, transaction_date, qty, initial_price, deduction_fee, net_profit, outlet_id, food_merchant_id, product_variant_id, outlets(name), food_merchants(name,color), product_variants(name)",
      )
      .gte("transaction_date", wibStartOfDay(from))
      .lte("transaction_date", wibEndOfDay(to))
      .order("transaction_date", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (profile.role === "kasir") {
      query = profile.outlet_id
        ? query.eq("outlet_id", profile.outlet_id)
        : query.is("outlet_id", null);
    }
    if (outlet) query = query.eq("outlet_id", outlet);
    if (merchant) query = query.eq("food_merchant_id", merchant);
    if (variant) query = query.eq("product_variant_id", variant);
    return query;
  }

  function buildAdCostsQuery(from: string, to: string, offset: number) {
    let query = supabase
      .from("daily_ad_costs")
      .select(
        "id,cost_date,outlet_id,food_merchant_id,amount,outlets(name),food_merchants(name,color)",
      )
      .gte("cost_date", from)
      .lte("cost_date", to)
      .order("cost_date", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (profile.role === "kasir") {
      query = profile.outlet_id
        ? query.eq("outlet_id", profile.outlet_id)
        : query.is("outlet_id", null);
    }
    if (outlet) query = query.eq("outlet_id", outlet);
    if (merchant) query = query.eq("food_merchant_id", merchant);
    return query;
  }

  const [rows, previousRows, adCosts, previousAdCosts] = await Promise.all([
    fetchAll((offset) => buildTransactionsQuery(fromStr, toStr, offset)),
    fetchAll((offset) =>
      buildTransactionsQuery(previousRange.from, previousRange.to, offset),
    ),
    fetchAll((offset) => buildAdCostsQuery(fromStr, toStr, offset)),
    fetchAll((offset) =>
      buildAdCostsQuery(previousRange.from, previousRange.to, offset),
    ),
  ]);

  return (
    <DashboardClient
      role={profile.role}
      outlets={outlets ?? []}
      merchants={(merchants ?? []) as any}
      variants={(variants ?? []) as any}
      rows={rows as any}
      previousRows={previousRows as any}
      adCosts={(variant ? [] : adCosts) as any}
      previousAdCosts={(variant ? [] : previousAdCosts) as any}
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
