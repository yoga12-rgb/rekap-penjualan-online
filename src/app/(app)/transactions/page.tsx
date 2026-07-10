import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { TransactionsClient } from "./TransactionsClient";
import {
  EMPTY_TRANSACTION_ORDER_PAGE,
  EMPTY_TRANSACTION_SUMMARY,
  groupTransactionRows,
  summarizeTransactionRows,
  type TransactionMerchant,
  type TransactionOrderPage,
  type TransactionRow,
  type TransactionSummary,
  type TransactionVariant,
} from "./transactionData";
import {
  todayWIBKey,
  daysAgoWIBKey,
  wibStartOfDay,
  wibEndOfDay,
  firstParam,
  isValidDateKey,
} from "@/lib/date";
import { uuidParam } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SP = {
  from?: string | string[];
  to?: string | string[];
  outlet?: string | string[];
  merchant?: string | string[];
  variant?: string | string[];
  q?: string | string[];
  is_fake?: string | string[];
  tx_from?: string | string[];
  tx_to?: string | string[];
  tx_outlet?: string | string[];
  tx_merchant?: string | string[];
  tx_variant?: string | string[];
  tx_q?: string | string[];
  tx_is_fake?: string | string[];
};

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";
const FALLBACK_PAGE_SIZE = 1000;
const INITIAL_ORDER_PAGE_SIZE = 12;

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

function normalizeNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSummary(data: unknown): TransactionSummary {
  if (!data || typeof data !== "object") return EMPTY_TRANSACTION_SUMMARY;
  const item = data as Record<string, unknown>;
  return {
    orderCount: normalizeNumber(item.orderCount),
    qty: normalizeNumber(item.qty),
    gross: normalizeNumber(item.gross),
    fee: normalizeNumber(item.fee),
    net: normalizeNumber(item.net),
    hpp: normalizeNumber(item.hpp),
    cleanProfit: normalizeNumber(item.cleanProfit),
  };
}

function normalizeOrderPage(data: unknown): TransactionOrderPage {
  if (!data || typeof data !== "object") return EMPTY_TRANSACTION_ORDER_PAGE;
  const item = data as Record<string, unknown>;
  return {
    groups: Array.isArray(item.groups)
      ? (item.groups as TransactionOrderPage["groups"])
      : [],
    nextOffset: normalizeNumber(item.nextOffset),
    hasMore: Boolean(item.hasMore),
  };
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const params = await searchParams;

  const rawFrom = firstParam(params.from) || firstParam(params.tx_from);
  const rawTo = firstParam(params.to) || firstParam(params.tx_to);
  let fromStr = isValidDateKey(rawFrom) ? rawFrom : daysAgoWIBKey(6);
  let toStr = isValidDateKey(rawTo) ? rawTo : todayWIBKey();
  let rangeWasReversed = false;
  if (fromStr > toStr) {
    [fromStr, toStr] = [toStr, fromStr];
    rangeWasReversed = true;
  }

  const searchTerm = sanitizeSearchTerm(
    firstParam(params.q) || firstParam(params.tx_q),
  );
  const filter = {
    from: fromStr,
    to: toStr,
    outlet:
      profile.role === "super_admin"
        ? uuidParam(firstParam(params.outlet) || firstParam(params.tx_outlet))
        : "",
    merchant: uuidParam(
      firstParam(params.merchant) || firstParam(params.tx_merchant),
    ),
    variant: uuidParam(
      firstParam(params.variant) || firstParam(params.tx_variant),
    ),
    q: searchTerm,
    is_fake: firstParam(params.is_fake) || firstParam(params.tx_is_fake) || "all",
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

  const rpcParams = {
    p_from: filter.from,
    p_to: filter.to,
    p_outlet: filter.outlet || null,
    p_merchant: filter.merchant || null,
    p_variant: filter.variant || null,
    p_q: filter.q || null,
    p_is_fake: filter.is_fake,
  };

  const [summaryResult, orderPageResult] = await Promise.all([
    (supabase as any).rpc("get_transactions_summary", rpcParams),
    (supabase as any).rpc("get_transaction_order_page", {
      ...rpcParams,
      p_offset: 0,
      p_limit: INITIAL_ORDER_PAGE_SIZE,
    }),
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
      .range(offset, offset + FALLBACK_PAGE_SIZE - 1);

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

  let summary = normalizeSummary(summaryResult.data);
  let orderPage = normalizeOrderPage(orderPageResult.data);
  let loadError: string | null = null;

  if (summaryResult.error || orderPageResult.error) {
    const rows: TransactionRow[] = [];
    for (let offset = 0; ; offset += FALLBACK_PAGE_SIZE) {
      const { data } = await buildQuery(offset);
      const pageRows = (data ?? []) as any[];
      rows.push(...(pageRows as TransactionRow[]));
      if (pageRows.length < FALLBACK_PAGE_SIZE) break;
    }

    const fallbackGroups = groupTransactionRows(rows);
    summary = summarizeTransactionRows(rows);
    orderPage = {
      groups: fallbackGroups,
      nextOffset: fallbackGroups.length,
      hasMore: false,
    };
    loadError =
      "Mode fallback transaksi aktif. Jalankan migration 012 agar pagination server berjalan penuh.";
  }

  return (
    <TransactionsClient
      role={profile.role}
      myOutletId={profile.outlet_id}
      outlets={outlets ?? []}
      merchants={(merchants ?? []) as TransactionMerchant[]}
      variants={(variants ?? []) as TransactionVariant[]}
      initialGroups={orderPage.groups}
      initialNextOffset={orderPage.nextOffset}
      initialHasMore={orderPage.hasMore}
      summary={summary}
      filter={filter}
      loadError={loadError}
    />
  );
}
