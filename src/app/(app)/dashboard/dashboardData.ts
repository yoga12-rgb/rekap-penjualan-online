import {
  isoToWIBDateKey,
  isoToWIBHour,
  isoToWIBDayOfWeek,
  dayOfWeekLabel,
} from "@/lib/date";
import { formatIDR } from "@/lib/utils";

export type Option = { id: string; name: string };
export type Merchant = Option & { color?: string | null };
export type Variant = Option & { base_price?: number };

export type SummaryRow = {
  id: string;
  order_id: string;
  order_number: string | null;
  transaction_date: string;
  qty: number;
  initial_price: number;
  deduction_fee: number;
  net_profit: number;
  outlet_id: string;
  food_merchant_id: string;
  product_variant_id: string;
  outlets: { name: string } | null;
  food_merchants: { name: string; color: string | null } | null;
  product_variants: { name: string } | null;
};

export type AdCostRow = {
  id: string;
  cost_date: string;
  outlet_id: string;
  food_merchant_id: string;
  amount: number;
  outlets: { name: string } | null;
  food_merchants: { name: string; color: string | null } | null;
};

export type Totals = {
  gross: number;
  fee: number;
  feePercent: number;
  net: number;
  adCost: number;
  cleanProfit: number;
  qty: number;
  transactionCount: number;
  avgGross: number;
  avgQty: number;
  avgNet: number;
};

export type ComparisonFormat = "currency" | "number";
export type ComparisonMetric = {
  label: string;
  current: number;
  previous: number;
  delta: number;
  percentChange: number;
  format: ComparisonFormat;
};

export type DeclineMetric = {
  key: string;
  name: string;
  current: number;
  previous: number;
  delta: number;
  percentChange: number;
};

export type DailyPoint = {
  date: string;
  gross: number;
  fee: number;
  net: number;
  adCost: number;
  cleanProfit: number;
};

export type ProductPoint = {
  name: string;
  qty: number;
  gross: number;
  net: number;
};

export type MerchantPoint = {
  name: string;
  net: number;
  adCost: number;
  cleanProfit: number;
  color: string | null;
};

export type OutletPoint = {
  name: string;
  gross: number;
  net: number;
  adCost: number;
  cleanProfit: number;
  qty: number;
  transactionCount: number;
};

export type HourPoint = {
  hour: number;
  label: string;
  gross: number;
  net: number;
  qty: number;
  transactionCount: number;
};

export type DayOfWeekPoint = {
  dayIndex: number;
  label: string;
  gross: number;
  net: number;
  adCost: number;
  cleanProfit: number;
  qty: number;
  transactionCount: number;
};

export type DashboardData = {
  totals: Totals;
  comparison: ComparisonMetric[];
  daily: DailyPoint[];
  leaderboard: ProductPoint[];
  merchantBreakdown: MerchantPoint[];
  outletBreakdown: OutletPoint[];
  hourly: HourPoint[];
  productDeclines: DeclineMetric[];
  merchantDeclines: DeclineMetric[];
  insights: string[];
  dayOfWeek: DayOfWeekPoint[];
};

export function buildDashboardData({
  rows,
  previousRows,
  adCosts,
  previousAdCosts,
}: {
  rows: SummaryRow[];
  previousRows: SummaryRow[];
  adCosts: AdCostRow[];
  previousAdCosts: AdCostRow[];
}): DashboardData {
  const totals = buildTotals(rows, adCosts);
  const previousTotals = buildTotals(previousRows, previousAdCosts);
  const comparison = buildComparisonRows(totals, previousTotals);
  const daily = buildDaily(rows, adCosts);
  const leaderboard = buildLeaderboard(rows);
  const merchantBreakdown = buildMerchantBreakdown(rows, adCosts);
  const outletBreakdown = buildOutletBreakdown(rows, adCosts);
  const hourly = buildHourly(rows);
  const dayOfWeek = buildDayOfWeek(rows, adCosts);
  const productDeclines = buildDeclines(
    rows,
    previousRows,
    "product",
    "qty",
  ).slice(0, 5);
  const merchantDeclines = buildDeclines(
    rows,
    previousRows,
    "merchant",
    "net",
  ).slice(0, 5);
  const insights = buildInsights({
    totals,
    comparison,
    hourly,
    leaderboard,
    merchantBreakdown,
    outletBreakdown,
  });

  return {
    totals,
    comparison,
    daily,
    leaderboard,
    merchantBreakdown,
    outletBreakdown,
    hourly,
    productDeclines,
    merchantDeclines,
    insights,
    dayOfWeek,
  };
}

export function emptyDayOfWeekSkeleton(): DayOfWeekPoint[] {
  return Array.from({ length: 7 }, (_, i) => ({
    dayIndex: i,
    label: dayOfWeekLabel(i),
    gross: 0,
    net: 0,
    adCost: 0,
    cleanProfit: 0,
    qty: 0,
    transactionCount: 0,
  }));
}

export function attachDashboardInsights(data: DashboardData): DashboardData {
  return {
    ...data,
    insights: buildInsights({
      totals: data.totals,
      comparison: data.comparison,
      hourly: data.hourly,
      leaderboard: data.leaderboard,
      merchantBreakdown: data.merchantBreakdown,
      outletBreakdown: data.outletBreakdown,
    }),
    dayOfWeek: data.dayOfWeek?.length
      ? data.dayOfWeek
      : emptyDayOfWeekSkeleton(),
  };
}

export function getGross(row: SummaryRow) {
  return row.qty * row.initial_price;
}

function getTransactionKey(row: SummaryRow) {
  return row.order_id || row.id;
}

function buildTotals(rows: SummaryRow[], adCosts: AdCostRow[] = []): Totals {
  const transactionKeys = new Set<string>();
  const gross = rows.reduce((a, r) => {
    transactionKeys.add(getTransactionKey(r));
    return a + getGross(r);
  }, 0);
  const fee = rows.reduce((a, r) => a + Number(r.deduction_fee || 0), 0);
  const net = rows.reduce((a, r) => a + Number(r.net_profit || 0), 0);
  const adCost = adCosts.reduce((a, r) => a + Number(r.amount || 0), 0);
  const cleanProfit = net - adCost;
  const qty = rows.reduce((a, r) => a + r.qty, 0);
  const transactionCount = transactionKeys.size;
  const feePercent = gross > 0 ? (fee / gross) * 100 : 0;
  return {
    gross,
    fee,
    feePercent,
    net,
    adCost,
    cleanProfit,
    qty,
    transactionCount,
    avgGross: transactionCount > 0 ? gross / transactionCount : 0,
    avgQty: transactionCount > 0 ? qty / transactionCount : 0,
    avgNet: transactionCount > 0 ? net / transactionCount : 0,
  };
}

function buildComparisonRows(totals: Totals, previousTotals: Totals) {
  return [
    buildComparison("Omset", totals.gross, previousTotals.gross, "currency"),
    buildComparison("Net Profit", totals.net, previousTotals.net, "currency"),
    buildComparison(
      "Profit Bersih",
      totals.cleanProfit,
      previousTotals.cleanProfit,
      "currency",
    ),
    buildComparison("Qty", totals.qty, previousTotals.qty, "number"),
    buildComparison(
      "Rata-rata Qty",
      totals.avgQty,
      previousTotals.avgQty,
      "number",
    ),
    buildComparison(
      "Transaksi",
      totals.transactionCount,
      previousTotals.transactionCount,
      "number",
    ),
  ];
}

function buildComparison(
  label: string,
  current: number,
  previous: number,
  format: ComparisonFormat,
): ComparisonMetric {
  const delta = current - previous;
  const percentChange =
    previous !== 0
      ? (delta / Math.abs(previous)) * 100
      : current > 0
        ? 100
        : current < 0
          ? -100
          : 0;
  return { label, current, previous, delta, percentChange, format };
}

function buildDaily(rows: SummaryRow[], adCosts: AdCostRow[]) {
  const map = new Map<string, DailyPoint>();
  for (const r of rows) {
    const d = isoToWIBDateKey(r.transaction_date);
    const cur = map.get(d) ?? {
      date: d,
      gross: 0,
      fee: 0,
      net: 0,
      adCost: 0,
      cleanProfit: 0,
    };
    cur.gross += getGross(r);
    cur.fee += Number(r.deduction_fee || 0);
    cur.net += Number(r.net_profit || 0);
    cur.cleanProfit = cur.net - cur.adCost;
    map.set(d, cur);
  }
  for (const cost of adCosts) {
    const cur = map.get(cost.cost_date) ?? {
      date: cost.cost_date,
      gross: 0,
      fee: 0,
      net: 0,
      adCost: 0,
      cleanProfit: 0,
    };
    cur.adCost += Number(cost.amount || 0);
    cur.cleanProfit = cur.net - cur.adCost;
    map.set(cost.cost_date, cur);
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function buildLeaderboard(rows: SummaryRow[]) {
  const map = new Map<string, ProductPoint>();
  for (const r of rows) {
    const key = r.product_variant_id;
    const cur = map.get(key) ?? {
      name: r.product_variants?.name ?? "-",
      qty: 0,
      gross: 0,
      net: 0,
    };
    cur.qty += r.qty;
    cur.gross += getGross(r);
    cur.net += Number(r.net_profit || 0);
    map.set(key, cur);
  }
  return Array.from(map.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);
}

function buildMerchantBreakdown(rows: SummaryRow[], adCosts: AdCostRow[]) {
  const map = new Map<string, MerchantPoint>();
  for (const r of rows) {
    const key = r.food_merchant_id;
    const cur = map.get(key) ?? {
      name: r.food_merchants?.name ?? "-",
      color: r.food_merchants?.color ?? null,
      net: 0,
      adCost: 0,
      cleanProfit: 0,
    };
    cur.net += Number(r.net_profit || 0);
    cur.cleanProfit = cur.net - cur.adCost;
    map.set(key, cur);
  }
  for (const cost of adCosts) {
    const key = cost.food_merchant_id;
    const cur = map.get(key) ?? {
      name: cost.food_merchants?.name ?? "-",
      color: cost.food_merchants?.color ?? null,
      net: 0,
      adCost: 0,
      cleanProfit: 0,
    };
    cur.adCost += Number(cost.amount || 0);
    cur.cleanProfit = cur.net - cur.adCost;
    map.set(key, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.cleanProfit - a.cleanProfit);
}

function buildOutletBreakdown(rows: SummaryRow[], adCosts: AdCostRow[]) {
  const map = new Map<string, OutletPoint & { transactionKeys: Set<string> }>();
  for (const r of rows) {
    const key = r.outlet_id || "unknown";
    const cur = map.get(key) ?? {
      name: r.outlets?.name ?? "-",
      gross: 0,
      net: 0,
      adCost: 0,
      cleanProfit: 0,
      qty: 0,
      transactionCount: 0,
      transactionKeys: new Set<string>(),
    };
    cur.gross += getGross(r);
    cur.net += Number(r.net_profit || 0);
    cur.cleanProfit = cur.net - cur.adCost;
    cur.qty += r.qty;
    cur.transactionKeys.add(getTransactionKey(r));
    map.set(key, cur);
  }
  for (const cost of adCosts) {
    const key = cost.outlet_id || "unknown";
    const cur = map.get(key) ?? {
      name: cost.outlets?.name ?? "-",
      gross: 0,
      net: 0,
      adCost: 0,
      cleanProfit: 0,
      qty: 0,
      transactionCount: 0,
      transactionKeys: new Set<string>(),
    };
    cur.adCost += Number(cost.amount || 0);
    cur.cleanProfit = cur.net - cur.adCost;
    map.set(key, cur);
  }
  return Array.from(map.values())
    .map(({ transactionKeys, ...o }) => ({
      ...o,
      transactionCount: transactionKeys.size,
    }))
    .sort((a, b) => b.cleanProfit - a.cleanProfit);
}

export function buildDayOfWeek(rows: SummaryRow[], adCosts: AdCostRow[]) {
  const buckets: Array<{
    dayIndex: number;
    label: string;
    gross: number;
    net: number;
    adCost: number;
    cleanProfit: number;
    qty: number;
    transactionKeys: Set<string>;
  }> = Array.from({ length: 7 }, (_, i) => ({
    dayIndex: i,
    label: dayOfWeekLabel(i),
    gross: 0,
    net: 0,
    adCost: 0,
    cleanProfit: 0,
    qty: 0,
    transactionKeys: new Set<string>(),
  }));
  for (const r of rows) {
    const bucket = buckets[isoToWIBDayOfWeek(r.transaction_date)];
    bucket.gross += getGross(r);
    bucket.net += Number(r.net_profit || 0);
    bucket.cleanProfit = bucket.net - bucket.adCost;
    bucket.qty += r.qty;
    bucket.transactionKeys.add(getTransactionKey(r));
  }
  for (const cost of adCosts) {
    const bucket = buckets[isoToWIBDayOfWeek(cost.cost_date)];
    bucket.adCost += Number(cost.amount || 0);
    bucket.cleanProfit = bucket.net - bucket.adCost;
  }
  return buckets.map((b) => ({
    dayIndex: b.dayIndex,
    label: b.label,
    gross: b.gross,
    net: b.net,
    adCost: b.adCost,
    cleanProfit: b.cleanProfit,
    qty: b.qty,
    transactionCount: b.transactionKeys.size,
  }));
}

function buildHourly(rows: SummaryRow[]) {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}:00`,
    gross: 0,
    net: 0,
    qty: 0,
    transactionKeys: new Set<string>(),
  }));
  for (const r of rows) {
    const bucket = buckets[isoToWIBHour(r.transaction_date)];
    bucket.gross += getGross(r);
    bucket.net += Number(r.net_profit || 0);
    bucket.qty += r.qty;
    bucket.transactionKeys.add(getTransactionKey(r));
  }
  return buckets.map((b) => ({
    hour: b.hour,
    label: b.label,
    gross: b.gross,
    net: b.net,
    qty: b.qty,
    transactionCount: b.transactionKeys.size,
  }));
}

function buildDeclines(
  currentRows: SummaryRow[],
  previousRows: SummaryRow[],
  group: "product" | "merchant",
  metric: "qty" | "net",
) {
  const current = groupRows(currentRows, group, metric);
  const previous = groupRows(previousRows, group, metric);
  const allKeys = new Set([...current.keys(), ...previous.keys()]);
  return Array.from(allKeys)
    .map((key) => {
      const cur = current.get(key);
      const prev = previous.get(key);
      const currentValue = cur?.value ?? 0;
      const previousValue = prev?.value ?? 0;
      const delta = currentValue - previousValue;
      return {
        key,
        name: cur?.name ?? prev?.name ?? "-",
        current: currentValue,
        previous: previousValue,
        delta,
        percentChange:
          previousValue > 0
            ? (delta / previousValue) * 100
            : currentValue > 0
              ? (delta / currentValue) * 100
              : 0,
      };
    })
    .filter((item) => item.delta < 0 && item.previous > 0)
    .sort((a, b) => a.delta - b.delta);
}

function groupRows(
  rows: SummaryRow[],
  group: "product" | "merchant",
  metric: "qty" | "net",
) {
  const map = new Map<string, { name: string; value: number }>();
  for (const row of rows) {
    const key =
      group === "product" ? row.product_variant_id : row.food_merchant_id;
    const name =
      group === "product"
        ? (row.product_variants?.name ?? "-")
        : (row.food_merchants?.name ?? "-");
    const cur = map.get(key) ?? { name, value: 0 };
    cur.value += metric === "qty" ? row.qty : Number(row.net_profit || 0);
    map.set(key, cur);
  }
  return map;
}

function buildInsights({
  totals,
  comparison,
  hourly,
  leaderboard,
  merchantBreakdown,
  outletBreakdown,
}: {
  totals: Totals;
  comparison: ComparisonMetric[];
  hourly: HourPoint[];
  leaderboard: ProductPoint[];
  merchantBreakdown: MerchantPoint[];
  outletBreakdown: OutletPoint[];
}) {
  const topProduct = leaderboard[0];
  const topMerchant = merchantBreakdown[0];
  const topOutlet = outletBreakdown[0];
  const busiestHour = hourly.reduce(
    (best, item) =>
      item.transactionCount > best.transactionCount ? item : best,
    hourly[0],
  );
  const strongestComparison = comparison
    .filter((item) => item.previous > 0)
    .sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange))[0];
  return [
    topProduct
      ? `Produk terlaris periode ini: ${topProduct.name} (${topProduct.qty.toLocaleString("id-ID")} qty).`
      : "",
    topMerchant
      ? `Merchant dengan profit bersih tertinggi: ${topMerchant.name} (${formatIDR(topMerchant.cleanProfit)}).`
      : "",
    topOutlet
      ? `Outlet dengan profit bersih tertinggi: ${topOutlet.name} (${formatIDR(topOutlet.cleanProfit)}).`
      : "",
    totals.adCost > 0
      ? `Biaya iklan periode ini: ${formatIDR(totals.adCost)}.`
      : "",
    totals.gross > 0
      ? `Potongan admin setara ${formatPercent(totals.feePercent)} dari total omset.`
      : "",
    busiestHour?.transactionCount
      ? `Jam transaksi paling ramai: ${busiestHour.label} (${busiestHour.transactionCount.toLocaleString("id-ID")} transaksi).`
      : "",
    strongestComparison
      ? `${strongestComparison.label} ${strongestComparison.percentChange >= 0 ? "naik" : "turun"} ${formatPercent(Math.abs(strongestComparison.percentChange))} dibanding periode sebelumnya.`
      : "",
  ].filter(Boolean);
}

export function formatPercent(value: number) {
  return `${value.toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}
