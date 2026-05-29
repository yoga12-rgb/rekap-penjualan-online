import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { TransactionsClient } from "./TransactionsClient";
import {
  todayWIBKey,
  daysAgoWIBKey,
  wibStartOfDay,
  wibEndOfDay,
  firstParam,
  isValidDateKey,
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

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";
const PAGE_SIZE = 1000;

function sanitizeSearchTerm(value: string) {
  return value.trim().slice(0, 100);
}

function sanitizePostgrestPattern(value: string) {
  return value.replace(/[\\%_,()*]/g, " ").trim();
}

function matchingIds<T extends { id: string; name: string }>(
  items: T[] | null,
  term: string,
) {
  const needle = term.toLowerCase();
  return (items ?? [])
    .filter((item) => item.name.toLowerCase().includes(needle))
    .map((item) => item.id);
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const params = await searchParams;

  const rawFrom = firstParam(params.from);
  const rawTo = firstParam(params.to);
  let fromStr = isValidDateKey(rawFrom) ? rawFrom : daysAgoWIBKey(6);
  let toStr = isValidDateKey(rawTo) ? rawTo : todayWIBKey();
  let rangeWasReversed = false;
  if (fromStr > toStr) {
    [fromStr, toStr] = [toStr, fromStr];
    rangeWasReversed = true;
  }

  const searchTerm = sanitizeSearchTerm(firstParam(params.q));
  const filter = {
    from: fromStr,
    to: toStr,
    outlet: profile.role === "super_admin" ? firstParam(params.outlet) : "",
    merchant: firstParam(params.merchant),
    variant: firstParam(params.variant),
    q: searchTerm,
    rangeWasReversed,
  };

  const [{ data: outlets }, { data: merchants }, { data: variants }] =
    await Promise.all([
      supabase.from("outlets").select("id,name").order("name"),
      supabase.from("food_merchants").select("id,name,color").order("name"),
      supabase
        .from("product_variants")
        .select(
          "id,name,base_price,product_variant_prices(food_merchant_id,price)",
        )
        .order("name"),
    ]);

  function buildQuery(offset: number) {
    let query = supabase
      .from("transactions")
      .select(
        "id, order_id, order_number, transaction_date, qty, initial_price, deduction_fee, net_profit, outlet_id, food_merchant_id, product_variant_id, outlets(name), food_merchants(name,color), product_variants(name)",
      )
      .gte("transaction_date", wibStartOfDay(filter.from))
      .lte("transaction_date", wibEndOfDay(filter.to))
      .order("transaction_date", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (profile.role === "kasir")
      query = profile.outlet_id
        ? query.eq("outlet_id", profile.outlet_id)
        : query.is("outlet_id", null);
    if (filter.outlet) query = query.eq("outlet_id", filter.outlet);
    if (filter.merchant) query = query.eq("food_merchant_id", filter.merchant);
    if (filter.variant) query = query.eq("product_variant_id", filter.variant);
    if (filter.q) {
      const clauses: string[] = [];
      const patternTerm = sanitizePostgrestPattern(filter.q);
      if (patternTerm) clauses.push(`order_number.ilike.%${patternTerm}%`);

      const outletIds = matchingIds(outlets ?? [], filter.q);
      const merchantIds = matchingIds(merchants ?? [], filter.q);
      const variantIds = matchingIds(variants ?? [], filter.q);
      if (outletIds.length) clauses.push(`outlet_id.in.(${outletIds.join(",")})`);
      if (merchantIds.length)
        clauses.push(`food_merchant_id.in.(${merchantIds.join(",")})`);
      if (variantIds.length)
        clauses.push(`product_variant_id.in.(${variantIds.join(",")})`);

      query = clauses.length ? query.or(clauses.join(",")) : query.eq("id", EMPTY_UUID);
    }

    return query;
  }

  const rows: any[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data } = await buildQuery(offset);
    const pageRows = data ?? [];
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) break;
  }

  return (
    <TransactionsClient
      role={profile.role}
      myOutletId={profile.outlet_id}
      outlets={outlets ?? []}
      merchants={(merchants ?? []) as any}
      variants={(variants ?? []) as any}
      rows={rows as any}
      filter={filter}
    />
  );
}
