import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { DashboardClient } from "./DashboardClient";
import {
  attachDashboardInsights,
  buildDashboardData,
  type AdCostRow,
  type DashboardData,
  type Merchant,
  type Option,
  type SummaryRow,
  type Variant,
} from "./dashboardData";
import {
  todayWIBKey,
  daysAgoWIBKey,
  wibStartOfDay,
  wibEndOfDay,
  firstParam,
  isValidDateKey,
  previousPeriodForRange,
} from "@/lib/date";
import { uuidParam } from "@/lib/utils";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 1000;

type SP = {
  from?: string | string[];
  to?: string | string[];
  outlet?: string | string[];
  merchant?: string | string[];
  variant?: string | string[];
  dash_from?: string | string[];
  dash_to?: string | string[];
  dash_outlet?: string | string[];
  dash_merchant?: string | string[];
  dash_variant?: string | string[];
};

type QueryError = { message?: string } | null;
type QueryPage<T> = PromiseLike<{ data: T[] | null; error: QueryError }>;
type LoadResult<T> = { rows: T[]; error: string | null };
type DashboardRpcResult = {
  data: DashboardData | null;
  error: string | null;
};

function asQueryPage<T>(query: unknown): QueryPage<T> {
  return query as QueryPage<T>;
}

function emptyLoadResult<T>(): LoadResult<T> {
  return { rows: [], error: null };
}

function nullableUuid(value: string) {
  return value || null;
}

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
  const rawFrom = firstParam(params.from) || firstParam(params.dash_from);
  const rawTo = firstParam(params.to) || firstParam(params.dash_to);
  let fromStr = isValidDateKey(rawFrom) ? rawFrom : defaultFrom;
  let toStr = isValidDateKey(rawTo) ? rawTo : defaultTo;
  let rangeWasReversed = false;
  // Auto-correct kalau user balikin range
  if (fromStr > toStr) {
    [fromStr, toStr] = [toStr, fromStr];
    rangeWasReversed = true;
  }

  const outlet =
    profile.role === "super_admin"
      ? uuidParam(firstParam(params.outlet) || firstParam(params.dash_outlet))
      : "";
  const merchant = uuidParam(
    firstParam(params.merchant) || firstParam(params.dash_merchant),
  );
  const variant = uuidParam(
    firstParam(params.variant) || firstParam(params.dash_variant),
  );
  const previousRange = previousPeriodForRange(fromStr, toStr);

  let outletsQuery = supabase.from("outlets").select("id,name").order("name");
  if (profile.role === "kasir") {
    outletsQuery = profile.outlet_id
      ? outletsQuery.eq("id", profile.outlet_id)
      : outletsQuery.is("id", null);
  }

  function formatLoadError(label: string, error: QueryError) {
    return error?.message ? `${label}: ${error.message}` : null;
  }

  async function fetchAll<T>(
    label: string,
    buildPage: (offset: number) => QueryPage<T>,
  ): Promise<LoadResult<T>> {
    const rows: T[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await buildPage(offset);
      if (error) return { rows, error: formatLoadError(label, error) };
      const pageRows = data ?? [];
      rows.push(...pageRows);
      if (pageRows.length < PAGE_SIZE) break;
    }
    return { rows, error: null };
  }

  async function fetchDashboardRpc(): Promise<DashboardRpcResult> {
    const { data, error } = await (supabase as any).rpc("get_dashboard_summary", {
      p_from: fromStr,
      p_to: toStr,
      p_previous_from: previousRange.from,
      p_previous_to: previousRange.to,
      p_outlet: nullableUuid(outlet),
      p_merchant: nullableUuid(merchant),
      p_variant: nullableUuid(variant),
    });
    if (error) {
      return {
        data: null,
        error: formatLoadError("RPC dashboard", error),
      };
    }
    return {
      data: attachDashboardInsights(data as DashboardData),
      error: null,
    };
  }

  function buildTransactionsQuery(
    from: string,
    to: string,
    offset: number,
  ): QueryPage<SummaryRow> {
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
    return asQueryPage<SummaryRow>(query);
  }

  function buildAdCostsQuery(
    from: string,
    to: string,
    offset: number,
  ): QueryPage<AdCostRow> {
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
    return asQueryPage<AdCostRow>(query);
  }

  const [
    outletsResult,
    merchantsResult,
    variantsResult,
    rpcResult,
  ] = await Promise.all([
    outletsQuery,
    supabase.from("food_merchants").select("id,name,color").order("name"),
    supabase
      .from("product_variants")
      .select("id,name,base_price")
      .order("name"),
    fetchDashboardRpc(),
  ]);

  let dashboardData = rpcResult.data;
  let dashboardSource = "rpc";
  let rowsResult = emptyLoadResult<SummaryRow>();
  let previousRowsResult = emptyLoadResult<SummaryRow>();
  let adCostsResult = emptyLoadResult<AdCostRow>();
  let previousAdCostsResult = emptyLoadResult<AdCostRow>();

  if (!dashboardData) {
    dashboardSource = "fallback";
    if (rpcResult.error) {
      console.warn(
        `Dashboard RPC failed; falling back to row fetch: ${rpcResult.error}`,
      );
    }
    [
      rowsResult,
      previousRowsResult,
      adCostsResult,
      previousAdCostsResult,
    ] = await Promise.all([
        fetchAll("Transaksi periode ini", (offset) =>
          buildTransactionsQuery(fromStr, toStr, offset),
        ),
        fetchAll("Transaksi periode sebelumnya", (offset) =>
          buildTransactionsQuery(previousRange.from, previousRange.to, offset),
        ),
        variant
          ? Promise.resolve(emptyLoadResult<AdCostRow>())
          : fetchAll("Biaya iklan periode ini", (offset) =>
              buildAdCostsQuery(fromStr, toStr, offset),
            ),
        variant
          ? Promise.resolve(emptyLoadResult<AdCostRow>())
          : fetchAll("Biaya iklan periode sebelumnya", (offset) =>
              buildAdCostsQuery(previousRange.from, previousRange.to, offset),
            ),
      ]);

    dashboardData = buildDashboardData({
      rows: rowsResult.rows,
      previousRows: previousRowsResult.rows,
      adCosts: adCostsResult.rows,
      previousAdCosts: previousAdCostsResult.rows,
    });
  }

  console.info(
    `Dashboard data source: ${dashboardSource}`,
  );

  const loadErrors = [
    formatLoadError("Outlet", outletsResult.error),
    formatLoadError("Merchant", merchantsResult.error),
    formatLoadError("Varian produk", variantsResult.error),
    rowsResult.error,
    previousRowsResult.error,
    adCostsResult.error,
    previousAdCostsResult.error,
  ].filter((error): error is string => Boolean(error));

  return (
    <DashboardClient
      role={profile.role}
      outlets={(outletsResult.data ?? []) as Option[]}
      merchants={(merchantsResult.data ?? []) as Merchant[]}
      variants={(variantsResult.data ?? []) as Variant[]}
      dashboardData={dashboardData}
      previousRange={previousRange}
      filter={{
        from: fromStr,
        to: toStr,
        outlet,
        merchant,
        variant,
        rangeWasReversed,
      }}
      loadErrors={loadErrors}
    />
  );
}
