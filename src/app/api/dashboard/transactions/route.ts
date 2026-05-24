import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { firstParam, isValidDateKey, wibEndOfDay, wibStartOfDay } from "@/lib/date";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

export async function GET(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const searchParams = Object.fromEntries(new URL(request.url).searchParams);

  const rawFrom = firstParam(searchParams.from);
  const rawTo = firstParam(searchParams.to);
  if (!isValidDateKey(rawFrom) || !isValidDateKey(rawTo)) {
    return NextResponse.json({ error: "Rentang tanggal tidak valid" }, { status: 400 });
  }

  let fromStr = rawFrom;
  let toStr = rawTo;
  if (fromStr > toStr) [fromStr, toStr] = [toStr, fromStr];

  const requestedLimit = Number(searchParams.limit ?? DEFAULT_LIMIT);
  const requestedOffset = Number(searchParams.offset ?? 0);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.trunc(requestedLimit), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const offset = Number.isFinite(requestedOffset) ? Math.max(Math.trunc(requestedOffset), 0) : 0;

  const outlet = profile.role === "super_admin" ? firstParam(searchParams.outlet) : "";
  const merchant = firstParam(searchParams.merchant);
  const variant = firstParam(searchParams.variant);

  let query = supabase
    .from("transactions")
    .select("id, transaction_date, qty, initial_price, deduction_fee, net_profit, outlet_id, food_merchant_id, product_variant_id, outlets(name), food_merchants(name,color), product_variants(name)")
    .gte("transaction_date", wibStartOfDay(fromStr))
    .lte("transaction_date", wibEndOfDay(toStr))
    .order("transaction_date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (profile.role === "kasir") {
    query = profile.outlet_id ? query.eq("outlet_id", profile.outlet_id) : query.is("outlet_id", null);
  }
  if (outlet) query = query.eq("outlet_id", outlet);
  if (merchant) query = query.eq("food_merchant_id", merchant);
  if (variant) query = query.eq("product_variant_id", variant);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  return NextResponse.json({
    rows,
    nextOffset: offset + rows.length,
    hasMore: rows.length === limit
  });
}
