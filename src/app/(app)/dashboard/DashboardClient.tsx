"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatIDR } from "@/lib/utils";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
  Cell,
} from "recharts";
import { getMerchantTheme } from "@/lib/merchantColors";
import { MerchantBadge } from "@/components/MerchantBadge";
import { Combobox } from "@/components/ui/Combobox";
import {
  isoToWIBDateKey,
  isoToWIBDisplay,
  isoToWIBHour,
  todayWIBKey,
  daysAgoWIBKey,
  startOfMonthWIBKey,
  endOfMonthWIBKey,
  startOfPreviousMonthWIBKey,
  endOfPreviousMonthWIBKey,
  startOfYearWIBKey,
  endOfYearWIBKey,
} from "@/lib/date";
import { AlertCircle, Loader2, X } from "lucide-react";
import {
  setDashboardFilterCookie,
  clearDashboardFilterCookie,
} from "@/lib/filterCookies";

type Option = { id: string; name: string };
type Merchant = Option & { color?: string | null };
type Variant = Option & { base_price?: number };
type DashboardFilter = {
  from: string;
  to: string;
  outlet: string;
  merchant: string;
  variant: string;
  rangeWasReversed?: boolean;
};
type DashboardFilterKey = "from" | "to" | "outlet" | "merchant" | "variant";
type SummaryRow = {
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
type AdCostRow = {
  id: string;
  cost_date: string;
  outlet_id: string;
  food_merchant_id: string;
  amount: number;
  outlets: { name: string } | null;
  food_merchants: { name: string; color: string | null } | null;
};
type DetailRow = SummaryRow;

type TransactionPage = {
  rows: DetailRow[];
  nextOffset: number;
  hasMore: boolean;
  error?: string;
};
type DashboardTab =
  | "trend"
  | "products"
  | "merchants"
  | "outlets"
  | "hours"
  | "insights"
  | "details";
type DatePreset =
  | "today"
  | "7d"
  | "30d"
  | "month"
  | "lastMonth"
  | "ytd"
  | "year";
const TAB_LABELS: Record<DashboardTab, string> = {
  trend: "Tren",
  products: "Produk",
  merchants: "Merchant",
  outlets: "Outlet",
  hours: "Jam",
  insights: "Insight",
  details: "Detail",
};

type Totals = {
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
type ComparisonMetric = ReturnType<typeof buildComparison>;
type DeclineMetric = ReturnType<typeof buildDeclines>[number];

export function DashboardClient({
  role,
  outlets,
  merchants,
  variants,
  rows,
  previousRows,
  adCosts,
  previousAdCosts,
  previousRange,
  filter,
}: {
  role: "super_admin" | "kasir";
  outlets: Option[];
  merchants: Merchant[];
  variants: Variant[];
  rows: SummaryRow[];
  previousRows: SummaryRow[];
  adCosts: AdCostRow[];
  previousAdCosts: AdCostRow[];
  previousRange: { from: string; to: string };
  filter: DashboardFilter;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const skipNextFilterSave = useRef(false);
  const [isExporting, setIsExporting] = useState(false);
  const [filterPending, startFilterTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<DashboardTab>("trend");
  const [draftFilter, setDraftFilter] = useState<DashboardFilter>({
    from: filter.from,
    to: filter.to,
    outlet: filter.outlet,
    merchant: filter.merchant,
    variant: filter.variant,
  });

  // NOTE: Restore filter dari cookie ditangani di updateSession (middleware)
  // sebelum page di-render, jadi client tidak perlu restore dari localStorage.

  useEffect(() => {
    setDraftFilter({
      from: filter.from,
      to: filter.to,
      outlet: filter.outlet,
      merchant: filter.merchant,
      variant: filter.variant,
    });
  }, [filter.from, filter.to, filter.outlet, filter.merchant, filter.variant]);

  // Simpan filter ke cookie setiap kali berubah (agar middleware bisa restore)
  useEffect(() => {
    setDashboardFilterCookie({
      from: filter.from,
      to: filter.to,
      outlet: filter.outlet,
      merchant: filter.merchant,
      variant: filter.variant,
    });
  }, [filter.from, filter.to, filter.outlet, filter.merchant, filter.variant]);

  function buildFilterParams(nextFilter: DashboardFilter) {
    const next = new URLSearchParams();
    next.set("from", nextFilter.from);
    next.set("to", nextFilter.to);
    if (nextFilter.outlet) next.set("outlet", nextFilter.outlet);
    if (nextFilter.merchant) next.set("merchant", nextFilter.merchant);
    if (nextFilter.variant) next.set("variant", nextFilter.variant);
    return next;
  }

  function setDraftParam(key: DashboardFilterKey, value: string) {
    setDraftFilter((current) => ({ ...current, [key]: value }));
  }

  function applyFilter(nextFilter = draftFilter) {
    const next = buildFilterParams(nextFilter);
    startFilterTransition(() => router.push(`/dashboard?${next.toString()}`));
  }

  function setRange(from: string, to: string) {
    const nextFilter = { ...draftFilter, from, to };
    setDraftFilter(nextFilter);
    applyFilter(nextFilter);
  }

  const totals = useMemo(() => buildTotals(rows, adCosts), [adCosts, rows]);
  const previousTotals = useMemo(
    () => buildTotals(previousRows, previousAdCosts),
    [previousAdCosts, previousRows],
  );

  const comparison = useMemo(
    () => [
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
        "Transaksi",
        totals.transactionCount,
        previousTotals.transactionCount,
        "number",
      ),
    ],
    [
      previousTotals.gross,
      previousTotals.net,
      previousTotals.cleanProfit,
      previousTotals.qty,
      previousTotals.transactionCount,
      totals.gross,
      totals.net,
      totals.cleanProfit,
      totals.qty,
      totals.transactionCount,
    ],
  );

  const daily = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        gross: number;
        fee: number;
        net: number;
        adCost: number;
        cleanProfit: number;
      }
    >();
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
      cur.gross += r.qty * r.initial_price;
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
    return Array.from(map.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }, [adCosts, rows]);

  const leaderboard = useMemo(() => {
    const map = new Map<
      string,
      { name: string; qty: number; gross: number; net: number }
    >();
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
  }, [rows]);

  const merchantBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        net: number;
        adCost: number;
        cleanProfit: number;
        color: string | null;
      }
    >();
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
    return Array.from(map.values()).sort(
      (a, b) => b.cleanProfit - a.cleanProfit,
    );
  }, [adCosts, rows]);

  const outletBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        gross: number;
        net: number;
        adCost: number;
        cleanProfit: number;
        qty: number;
        transactionKeys: Set<string>;
      }
    >();
    for (const r of rows) {
      const key = r.outlet_id || "unknown";
      const cur = map.get(key) ?? {
        name: r.outlets?.name ?? "-",
        gross: 0,
        net: 0,
        adCost: 0,
        cleanProfit: 0,
        qty: 0,
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
        transactionKeys: new Set<string>(),
      };
      cur.adCost += Number(cost.amount || 0);
      cur.cleanProfit = cur.net - cur.adCost;
      map.set(key, cur);
    }
    return Array.from(map.values())
      .map((o) => ({ ...o, transactionCount: o.transactionKeys.size }))
      .sort((a, b) => b.cleanProfit - a.cleanProfit);
  }, [adCosts, rows]);

  const hourly = useMemo(() => {
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
      ...b,
      transactionCount: b.transactionKeys.size,
    }));
  }, [rows]);

  const productDeclines = useMemo(
    () => buildDeclines(rows, previousRows, "product", "qty").slice(0, 5),
    [previousRows, rows],
  );

  const merchantDeclines = useMemo(
    () => buildDeclines(rows, previousRows, "merchant", "net").slice(0, 5),
    [previousRows, rows],
  );

  const insights = useMemo(() => {
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
  }, [
    comparison,
    hourly,
    leaderboard,
    merchantBreakdown,
    outletBreakdown,
    totals.feePercent,
    totals.adCost,
    totals.gross,
  ]);

  async function exportCsv() {
    setIsExporting(true);
    try {
      if (activeTab === "trend") {
        downloadCsv(
          [
            "Tanggal",
            "Omset",
            "Potongan",
            "NetProfit",
            "BiayaIklan",
            "ProfitBersih",
          ],
          daily.map((r) => [
            r.date,
            r.gross,
            r.fee,
            r.net,
            r.adCost,
            r.cleanProfit,
          ]),
          `tren_harian_${filter.from}_to_${filter.to}.csv`,
        );
        return;
      }

      if (activeTab === "products") {
        downloadCsv(
          ["Produk", "Qty", "Omset", "NetProfit"],
          leaderboard.map((r) => [r.name, r.qty, r.gross, r.net]),
          `produk_terlaris_${filter.from}_to_${filter.to}.csv`,
        );
        return;
      }

      if (activeTab === "merchants") {
        downloadCsv(
          ["Merchant", "NetProfit", "BiayaIklan", "ProfitBersih"],
          merchantBreakdown.map((r) => [
            r.name,
            r.net,
            r.adCost,
            r.cleanProfit,
          ]),
          `profit_merchant_${filter.from}_to_${filter.to}.csv`,
        );
        return;
      }

      if (activeTab === "outlets") {
        downloadCsv(
          [
            "Outlet",
            "Transaksi",
            "Qty",
            "Omset",
            "NetProfit",
            "BiayaIklan",
            "ProfitBersih",
          ],
          outletBreakdown.map((r) => [
            r.name,
            r.transactionCount,
            r.qty,
            r.gross,
            r.net,
            r.adCost,
            r.cleanProfit,
          ]),
          `top_outlet_${filter.from}_to_${filter.to}.csv`,
        );
        return;
      }

      if (activeTab === "hours") {
        downloadCsv(
          ["Jam", "Transaksi", "Qty", "Omset", "NetProfit"],
          hourly.map((r) => [
            r.label,
            r.transactionCount,
            r.qty,
            r.gross,
            r.net,
          ]),
          `jam_ramai_${filter.from}_to_${filter.to}.csv`,
        );
        return;
      }

      if (activeTab === "insights") {
        downloadCsv(
          [
            "Kategori",
            "Nama",
            "SaatIni",
            "PeriodeSebelumnya",
            "Selisih",
            "Perubahan",
          ],
          [
            ...comparison.map((r) => [
              r.label,
              "-",
              r.current,
              r.previous,
              r.delta,
              formatPercent(r.percentChange),
            ]),
            ...productDeclines.map((r) => [
              "Produk Turun",
              r.name,
              r.current,
              r.previous,
              r.delta,
              formatPercent(r.percentChange),
            ]),
            ...merchantDeclines.map((r) => [
              "Merchant Turun",
              r.name,
              r.current,
              r.previous,
              r.delta,
              formatPercent(r.percentChange),
            ]),
          ],
          `insight_${filter.from}_to_${filter.to}.csv`,
        );
        return;
      }

      const detailRows: DetailRow[] = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const page = await fetchTransactionPage(filter, offset, 100);
        detailRows.push(...page.rows);
        offset = page.nextOffset;
        hasMore = page.hasMore;
      }
      downloadCsv(
        [
          "Tanggal",
          "NomorPesanan",
          "Outlet",
          "Merchant",
          "Produk",
          "Qty",
          "HargaSatuan",
          "Omset",
          "Potongan",
          "NetProfit",
        ],
        detailRows.map((r) => [
          isoToWIBDisplay(r.transaction_date),
          r.order_number ?? "",
          r.outlets?.name ?? "",
          r.food_merchants?.name ?? "",
          r.product_variants?.name ?? "",
          r.qty,
          r.initial_price,
          getGross(r),
          r.deduction_fee,
          r.net_profit,
        ]),
        `detail_transaksi_${filter.from}_to_${filter.to}.csv`,
      );
    } finally {
      setIsExporting(false);
    }
  }

  function getPresetRange(preset: DatePreset) {
    if (preset === "today") return { from: todayWIBKey(), to: todayWIBKey() };
    if (preset === "7d") return { from: daysAgoWIBKey(6), to: todayWIBKey() };
    if (preset === "30d") return { from: daysAgoWIBKey(29), to: todayWIBKey() };
    if (preset === "month")
      return { from: startOfMonthWIBKey(), to: endOfMonthWIBKey() };
    if (preset === "lastMonth")
      return {
        from: startOfPreviousMonthWIBKey(),
        to: endOfPreviousMonthWIBKey(),
      };
    if (preset === "ytd")
      return { from: startOfYearWIBKey(), to: todayWIBKey() };
    return { from: startOfYearWIBKey(), to: endOfYearWIBKey() };
  }

  function isPresetActive(preset: DatePreset) {
    const range = getPresetRange(preset);
    return filter.from === range.from && filter.to === range.to;
  }

  function setRangePreset(preset: DatePreset) {
    const range = getPresetRange(preset);
    return setRange(range.from, range.to);
  }

  function clearFilter() {
    clearDashboardFilterCookie();
    setDraftFilter({
      from: daysAgoWIBKey(6),
      to: todayWIBKey(),
      outlet: "",
      merchant: "",
      variant: "",
    });
    startFilterTransition(() => router.push("/dashboard"));
  }

  const hasActiveFilter =
    filter.from !== daysAgoWIBKey(6) ||
    filter.to !== todayWIBKey() ||
    !!filter.outlet ||
    !!filter.merchant ||
    !!filter.variant;
  const hasDraftChanges =
    draftFilter.from !== filter.from ||
    draftFilter.to !== filter.to ||
    draftFilter.outlet !== filter.outlet ||
    draftFilter.merchant !== filter.merchant ||
    draftFilter.variant !== filter.variant;
  const showResetFilter = hasActiveFilter || hasDraftChanges;

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="card p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <span>Filter</span>
            {filterPending && (
              <span
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold"
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: "var(--bg)",
                }}
              >
                <Loader2 size={13} className="animate-spin" />
                Memuat
              </span>
            )}
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {showResetFilter && (
              <button
                className="btn-ghost h-9 px-3 text-xs sm:text-sm"
                onClick={clearFilter}
              >
                <X size={14} />
                Reset
              </button>
            )}
            <button
              className="btn-primary h-9 flex-1 px-3 text-xs font-semibold shadow-sm sm:flex-none sm:text-sm"
              onClick={() => applyFilter()}
              disabled={!hasDraftChanges || filterPending}
            >
              Terapkan Filter
            </button>
            <button
              className="btn-primary h-9 flex-1 px-3 text-xs sm:flex-none sm:text-sm"
              onClick={exportCsv}
              disabled={!rows.length || isExporting}
            >
              {isExporting ? "Exporting..." : `Export ${TAB_LABELS[activeTab]}`}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Field label="Dari">
            <input
              type="date"
              className="input"
              value={draftFilter.from}
              onChange={(e) => setDraftParam("from", e.target.value)}
            />
          </Field>
          <Field label="Sampai">
            <input
              type="date"
              className="input"
              value={draftFilter.to}
              onChange={(e) => setDraftParam("to", e.target.value)}
            />
          </Field>
          {role === "super_admin" && (
            <Field label="Outlet">
              <Combobox
                options={outlets.map((o) => ({ value: o.id, label: o.name }))}
                value={draftFilter.outlet}
                onChange={(v) => setDraftParam("outlet", v)}
                placeholder="Semua Outlet"
                clearable
              />
            </Field>
          )}
          <Field label="Merchant">
            <Combobox
              options={merchants.map((m) => ({ value: m.id, label: m.name }))}
              value={draftFilter.merchant}
              onChange={(v) => setDraftParam("merchant", v)}
              placeholder="Semua Merchant"
              clearable
            />
          </Field>
          <Field label="Varian Produk">
            <Combobox
              options={variants.map((v) => ({
                value: v.id,
                label: v.name,
                hint:
                  v.base_price != null ? formatIDR(v.base_price) : undefined,
              }))}
              value={draftFilter.variant}
              onChange={(v) => setDraftParam("variant", v)}
              placeholder="Semua Varian"
              clearable
            />
          </Field>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          <PresetButton
            active={isPresetActive("today")}
            onClick={() => setRangePreset("today")}
          >
            Hari ini
          </PresetButton>
          <PresetButton
            active={isPresetActive("7d")}
            onClick={() => setRangePreset("7d")}
          >
            7H
          </PresetButton>
          <PresetButton
            active={isPresetActive("30d")}
            onClick={() => setRangePreset("30d")}
          >
            30H
          </PresetButton>
          <PresetButton
            active={isPresetActive("month")}
            onClick={() => setRangePreset("month")}
          >
            Bulan ini
          </PresetButton>
          <PresetButton
            active={isPresetActive("lastMonth")}
            onClick={() => setRangePreset("lastMonth")}
          >
            Bulan lalu
          </PresetButton>
          <PresetButton
            active={isPresetActive("ytd")}
            onClick={() => setRangePreset("ytd")}
          >
            YTD
          </PresetButton>
          <PresetButton
            active={isPresetActive("year")}
            onClick={() => setRangePreset("year")}
          >
            Tahun
          </PresetButton>
        </div>
      </div>

      {filter.rangeWasReversed && (
        <div
          className="card px-3 py-2 flex items-center gap-2 text-xs sm:text-sm"
          style={{ borderColor: "#f59e0b" }}
        >
          <AlertCircle size={16} className="text-amber-600" />
          <span>
            Tanggal "Dari" lebih besar dari "Sampai"; sistem otomatis menukar
            urutan untuk query.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        <KPI
          title="Total Omset"
          value={formatIDR(totals.gross)}
          variant="gross"
        />
        <KPI
          title="Total Potongan Admin"
          value={formatIDR(totals.fee)}
          variant="fee"
        />
        <KPI
          title="Potongan Admin (%)"
          value={formatPercent(totals.feePercent)}
          variant="percent"
        />
        <KPI title="Net Profit" value={formatIDR(totals.net)} variant="net" />
        <KPI
          title="Biaya Iklan"
          value={formatIDR(totals.adCost)}
          variant="ad"
        />
        <KPI
          title="Profit Bersih"
          value={formatIDR(totals.cleanProfit)}
          variant="clean"
        />
        <KPI title="Total Qty" value={totals.qty.toLocaleString("id-ID")} />
        <KPI
          title="Total Transaksi"
          value={totals.transactionCount.toLocaleString("id-ID")}
        />
        <KPI title="Rata-rata Omset" value={formatIDR(totals.avgGross)} />
        <KPI
          title="Rata-rata Qty"
          value={totals.avgQty.toLocaleString("id-ID", {
            maximumFractionDigits: 2,
          })}
        />
        <KPI title="Rata-rata Net" value={formatIDR(totals.avgNet)} />
      </div>

      <div
        className="flex overflow-x-auto border-b -mb-1"
        style={{ borderColor: "var(--border)" }}
      >
        <TabButton
          active={activeTab === "trend"}
          onClick={() => setActiveTab("trend")}
        >
          Tren Harian
        </TabButton>
        <TabButton
          active={activeTab === "products"}
          onClick={() => setActiveTab("products")}
        >
          Produk Terlaris
        </TabButton>
        <TabButton
          active={activeTab === "merchants"}
          onClick={() => setActiveTab("merchants")}
        >
          Profit Merchant
        </TabButton>
        <TabButton
          active={activeTab === "outlets"}
          onClick={() => setActiveTab("outlets")}
        >
          Outlet
        </TabButton>
        <TabButton
          active={activeTab === "hours"}
          onClick={() => setActiveTab("hours")}
        >
          Jam Ramai
        </TabButton>
        <TabButton
          active={activeTab === "insights"}
          onClick={() => setActiveTab("insights")}
        >
          Insight
        </TabButton>
        <TabButton
          active={activeTab === "details"}
          onClick={() => setActiveTab("details")}
        >
          Detail Transaksi
        </TabButton>
      </div>

      {activeTab === "trend" && <TrendTab daily={daily} />}
      {activeTab === "products" && <ProductsTab leaderboard={leaderboard} />}
      {activeTab === "merchants" && (
        <MerchantsTab merchantBreakdown={merchantBreakdown} />
      )}
      {activeTab === "outlets" && (
        <OutletsTab outletBreakdown={outletBreakdown} />
      )}
      {activeTab === "hours" && <HoursTab hourly={hourly} />}
      {activeTab === "insights" && (
        <InsightsTab
          comparison={comparison}
          previousRange={previousRange}
          productDeclines={productDeclines}
          merchantDeclines={merchantDeclines}
          insights={insights}
        />
      )}
      {activeTab === "details" && <DetailTransactions filter={filter} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 ${active ? "text-red-700 dark:text-red-300" : ""}`}
      style={{
        borderColor: active ? "#b91c1c" : "transparent",
        color: active ? undefined : "var(--muted)",
      }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label
        className="mb-1 block text-xs font-medium"
        style={{ color: "var(--muted)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function PresetButton({
  active = false,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`btn-outline px-2.5 py-1.5 text-xs whitespace-nowrap transition-colors ${
        active
          ? "border-red-700 bg-red-700 text-white hover:bg-red-800 dark:border-red-500 dark:bg-red-600 dark:text-white dark:hover:bg-red-700"
          : ""
      }`}
      aria-pressed={active}
      onClick={onClick}
    >
      {active && (
        <span
          className="h-1.5 w-1.5 rounded-full bg-current"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}

function TrendTab({
  daily,
}: {
  daily: Array<{
    date: string;
    gross: number;
    fee: number;
    net: number;
    adCost: number;
    cleanProfit: number;
  }>;
}) {
  return (
    <div className="card p-3">
      <h3 className="text-sm font-semibold mb-2">Tren Penjualan Harian</h3>
      <div className="h-56 sm:h-64 lg:h-72">
        {daily.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" stroke="var(--muted)" />
              <YAxis
                tickFormatter={(v) =>
                  Intl.NumberFormat("id-ID").format(v as number)
                }
                stroke="var(--muted)"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  color: "var(--fg)",
                }}
                formatter={(v: any) => formatIDR(Number(v))}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="gross"
                name="Omset"
                stroke="#3b82f6"
                dot={daily.length === 1}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="net"
                name="Net Profit"
                stroke="#22c55e"
                dot={daily.length === 1}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="cleanProfit"
                name="Profit Bersih"
                stroke="#8b5cf6"
                dot={daily.length === 1}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="fee"
                name="Potongan"
                stroke="#ef4444"
                dot={daily.length === 1}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="adCost"
                name="Biaya Iklan"
                stroke="#f97316"
                dot={daily.length === 1}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function ProductsTab({
  leaderboard,
}: {
  leaderboard: Array<{ name: string; qty: number; gross: number; net: number }>;
}) {
  return (
    <div className="card p-3">
      <h3 className="text-sm font-semibold mb-2">Produk Terlaris (Qty)</h3>
      <div className="h-52 sm:h-60 lg:h-64">
        {leaderboard.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={leaderboard}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--muted)" />
              <YAxis stroke="var(--muted)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  color: "var(--fg)",
                }}
              />
              <Bar dataKey="qty" fill="#b91c1c" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="overflow-auto mt-2">
        <table className="table">
          <thead>
            <tr>
              <th>Produk</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((p) => (
              <tr key={p.name}>
                <td>{p.name}</td>
                <td className="text-right">{p.qty}</td>
                <td className="text-right">{formatIDR(p.net)}</td>
              </tr>
            ))}
            {!leaderboard.length && (
              <tr>
                <td
                  colSpan={3}
                  className="text-center py-4"
                  style={{ color: "var(--muted)" }}
                >
                  Tidak ada data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MerchantsTab({
  merchantBreakdown,
}: {
  merchantBreakdown: Array<{
    name: string;
    net: number;
    adCost: number;
    cleanProfit: number;
    color: string | null;
  }>;
}) {
  return (
    <div className="card p-3">
      <h3 className="text-sm font-semibold mb-2">Profit Bersih per Merchant</h3>
      <div className="h-52 sm:h-60 lg:h-64">
        {merchantBreakdown.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={merchantBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--muted)" />
              <YAxis
                tickFormatter={(v) =>
                  Intl.NumberFormat("id-ID").format(v as number)
                }
                stroke="var(--muted)"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  color: "var(--fg)",
                }}
                formatter={(v: any) => formatIDR(Number(v))}
              />
              <Bar dataKey="cleanProfit">
                {merchantBreakdown.map((m) => (
                  <Cell
                    key={m.name}
                    fill={getMerchantTheme(m.name, m.color).bg}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {merchantBreakdown.map((m) => (
          <MerchantBadge key={m.name} name={m.name} color={m.color} />
        ))}
      </div>
    </div>
  );
}

function OutletsTab({
  outletBreakdown,
}: {
  outletBreakdown: Array<{
    name: string;
    gross: number;
    net: number;
    adCost: number;
    cleanProfit: number;
    qty: number;
    transactionCount: number;
  }>;
}) {
  return (
    <div className="card p-3">
      <h3 className="text-sm font-semibold mb-2">Top Outlet</h3>
      <div className="h-52 sm:h-60 lg:h-64">
        {outletBreakdown.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={outletBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--muted)" />
              <YAxis
                tickFormatter={(v) =>
                  Intl.NumberFormat("id-ID").format(v as number)
                }
                stroke="var(--muted)"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  color: "var(--fg)",
                }}
                formatter={(v: any, name) =>
                  name === "gross" ||
                  name === "net" ||
                  name === "cleanProfit" ||
                  name === "adCost"
                    ? formatIDR(Number(v))
                    : Number(v).toLocaleString("id-ID")
                }
              />
              <Legend />
              <Bar dataKey="gross" name="Omset" fill="#3b82f6" />
              <Bar dataKey="net" name="Net Profit" fill="#22c55e" />
              <Bar dataKey="cleanProfit" name="Profit Bersih" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="overflow-auto mt-2">
        <table className="table">
          <thead>
            <tr>
              <th>Outlet</th>
              <th className="text-right">Transaksi</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Omset</th>
              <th className="text-right">Net</th>
              <th className="text-right">Iklan</th>
              <th className="text-right">Profit Bersih</th>
            </tr>
          </thead>
          <tbody>
            {outletBreakdown.map((o) => (
              <tr key={o.name}>
                <td>{o.name}</td>
                <td className="text-right">
                  {o.transactionCount.toLocaleString("id-ID")}
                </td>
                <td className="text-right">{o.qty.toLocaleString("id-ID")}</td>
                <td className="text-right">{formatIDR(o.gross)}</td>
                <td className="text-right font-medium">{formatIDR(o.net)}</td>
                <td className="text-right">{formatIDR(o.adCost)}</td>
                <td className="text-right font-medium">
                  {formatIDR(o.cleanProfit)}
                </td>
              </tr>
            ))}
            {!outletBreakdown.length && (
              <tr>
                <td
                  colSpan={7}
                  className="text-center py-4"
                  style={{ color: "var(--muted)" }}
                >
                  Tidak ada data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HoursTab({
  hourly,
}: {
  hourly: Array<{
    label: string;
    gross: number;
    net: number;
    qty: number;
    transactionCount: number;
  }>;
}) {
  const visibleHours = hourly.filter(
    (h) => h.transactionCount > 0 || h.qty > 0,
  );
  return (
    <div className="card p-3">
      <h3 className="text-sm font-semibold mb-2">Jam Ramai Transaksi</h3>
      <div className="h-52 sm:h-60 lg:h-64">
        {visibleHours.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourly}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" stroke="var(--muted)" />
              <YAxis stroke="var(--muted)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  color: "var(--fg)",
                }}
                formatter={(v: any, name) =>
                  name === "gross" || name === "net"
                    ? formatIDR(Number(v))
                    : Number(v).toLocaleString("id-ID")
                }
              />
              <Legend />
              <Bar dataKey="transactionCount" name="Transaksi" fill="#b91c1c" />
              <Bar dataKey="qty" name="Qty" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="overflow-auto mt-2">
        <table className="table">
          <thead>
            <tr>
              <th>Jam</th>
              <th className="text-right">Transaksi</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Omset</th>
              <th className="text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {visibleHours.map((h) => (
              <tr key={h.label}>
                <td>{h.label}</td>
                <td className="text-right">
                  {h.transactionCount.toLocaleString("id-ID")}
                </td>
                <td className="text-right">{h.qty.toLocaleString("id-ID")}</td>
                <td className="text-right">{formatIDR(h.gross)}</td>
                <td className="text-right font-medium">{formatIDR(h.net)}</td>
              </tr>
            ))}
            {!visibleHours.length && (
              <tr>
                <td
                  colSpan={5}
                  className="text-center py-4"
                  style={{ color: "var(--muted)" }}
                >
                  Tidak ada data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InsightsTab({
  comparison,
  previousRange,
  productDeclines,
  merchantDeclines,
  insights,
}: {
  comparison: ComparisonMetric[];
  previousRange: { from: string; to: string };
  productDeclines: DeclineMetric[];
  merchantDeclines: DeclineMetric[];
  insights: string[];
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold">Perbandingan Periode</h3>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            vs {previousRange.from} - {previousRange.to}
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {comparison.map((item) => (
            <ComparisonCard key={item.label} item={item} />
          ))}
        </div>
      </div>

      <div className="card p-3">
        <h3 className="text-sm font-semibold mb-2">Insight Otomatis</h3>
        <div className="space-y-2 text-sm">
          {insights.map((item) => (
            <div
              key={item}
              className="rounded-md border px-3 py-2"
              style={{ borderColor: "var(--border)" }}
            >
              {item}
            </div>
          ))}
          {!insights.length && (
            <div className="py-6 text-center" style={{ color: "var(--muted)" }}>
              Belum ada insight untuk rentang ini.
            </div>
          )}
        </div>
      </div>

      <DeclineTable
        title="Produk yang Performanya Turun"
        metricLabel="Qty"
        rows={productDeclines}
      />
      <DeclineTable
        title="Merchant yang Performanya Turun"
        metricLabel="Net Profit"
        rows={merchantDeclines}
        currency
      />
    </div>
  );
}

function ComparisonCard({ item }: { item: ComparisonMetric }) {
  const isUp = item.delta >= 0;
  return (
    <div
      className="rounded-md border px-3 py-2"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="text-xs uppercase" style={{ color: "var(--muted)" }}>
        {item.label}
      </div>
      <div className="mt-1 text-lg font-bold">
        {formatMetricValue(item.current, item.format)}
      </div>
      <div
        className={`text-xs font-medium ${isUp ? "text-emerald-600 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}
      >
        {isUp ? "+" : ""}
        {formatMetricValue(item.delta, item.format)} ({isUp ? "+" : ""}
        {formatPercent(item.percentChange)})
      </div>
      <div className="text-xs" style={{ color: "var(--muted)" }}>
        Sebelumnya {formatMetricValue(item.previous, item.format)}
      </div>
    </div>
  );
}

function DeclineTable({
  title,
  metricLabel,
  rows,
  currency,
}: {
  title: string;
  metricLabel: string;
  rows: DeclineMetric[];
  currency?: boolean;
}) {
  return (
    <div className="card p-3">
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      <div className="overflow-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Nama</th>
              <th className="text-right">Saat Ini</th>
              <th className="text-right">Sebelumnya</th>
              <th className="text-right">Turun</th>
              <th className="text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td className="text-right">
                  {currency
                    ? formatIDR(row.current)
                    : row.current.toLocaleString("id-ID")}
                </td>
                <td className="text-right">
                  {currency
                    ? formatIDR(row.previous)
                    : row.previous.toLocaleString("id-ID")}
                </td>
                <td className="text-right">
                  {currency
                    ? formatIDR(Math.abs(row.delta))
                    : Math.abs(row.delta).toLocaleString("id-ID")}
                </td>
                <td className="text-right text-red-700 dark:text-red-300">
                  {formatPercent(row.percentChange)}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td
                  colSpan={5}
                  className="text-center py-4"
                  style={{ color: "var(--muted)" }}
                >
                  Tidak ada penurunan {metricLabel.toLowerCase()} yang
                  terdeteksi.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getGross(row: SummaryRow) {
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

function buildComparison(
  label: string,
  current: number,
  previous: number,
  format: "currency" | "number",
) {
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

function buildDeclines(
  currentRows: SummaryRow[],
  previousRows: SummaryRow[],
  group: "product" | "merchant",
  metric: "qty" | "net",
) {
  const current = groupRows(currentRows, group, metric);
  const previous = groupRows(previousRows, group, metric);
  // Gabungkan semua key dari current dan previous
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
    .filter((item) => {
      // Hanya tampilkan yang benar-benar mengalami penurunan signifikan
      return item.delta < 0 && item.previous > 0;
    })
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

function formatPercent(value: number) {
  return `${value.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function formatMetricValue(value: number, format: "currency" | "number") {
  if (format === "currency") return formatIDR(value);
  return value.toLocaleString("id-ID");
}

function downloadCsv(
  headers: string[],
  data: Array<Array<string | number>>,
  filename: string,
) {
  const escapeCell = (value: string | number) =>
    `"${String(value).replace(/"/g, '""')}"`;
  const csv = [headers, ...data]
    .map((row) => row.map(escapeCell).join(","))
    .join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function isLegacyTodayOnlyFilter(savedFilter: Record<string, string>) {
  return (
    savedFilter.from === todayWIBKey() &&
    savedFilter.to === todayWIBKey() &&
    !savedFilter.outlet &&
    !savedFilter.merchant &&
    !savedFilter.variant
  );
}

function buildTransactionUrl(
  filter: DashboardFilter,
  offset: number,
  limit: number,
) {
  const params = new URLSearchParams({
    from: filter.from,
    to: filter.to,
    offset: String(offset),
    limit: String(limit),
  });
  if (filter.outlet) params.set("outlet", filter.outlet);
  if (filter.merchant) params.set("merchant", filter.merchant);
  if (filter.variant) params.set("variant", filter.variant);
  return `/api/dashboard/transactions?${params.toString()}`;
}

async function fetchTransactionPage(
  filter: DashboardFilter,
  offset: number,
  limit: number,
) {
  const res = await fetch(buildTransactionUrl(filter, offset, limit), {
    cache: "no-store",
  });
  const data = (await res.json()) as TransactionPage;
  if (!res.ok) throw new Error(data.error ?? "Gagal memuat detail transaksi");
  return data;
}

function getViewportPageSize() {
  if (typeof window === "undefined") return 30;
  const visibleRows = Math.ceil(window.innerHeight / 44);
  return Math.min(100, Math.max(20, visibleRows * 2));
}

function DetailTransactions({ filter }: { filter: DashboardFilter }) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  const [isActive, setIsActive] = useState(false);
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pageSize, setPageSize] = useState(30);

  const queryKey = `${filter.from}|${filter.to}|${filter.outlet}|${filter.merchant}|${filter.variant}`;

  useEffect(() => {
    setPageSize(getViewportPageSize());
  }, []);

  useEffect(() => {
    setRows([]);
    setOffset(0);
    setHasMore(true);
    setLoading(false);
    loadingRef.current = false;
    setError("");
    setIsActive(false);
  }, [queryKey]);

  useEffect(() => {
    const target = sectionRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setIsActive(true);
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [queryKey]);

  const loadMore = useCallback(async () => {
    if (!isActive || loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    setError("");
    try {
      const page = await fetchTransactionPage(filter, offset, pageSize);
      setRows((current) => {
        const seen = new Set(current.map((row) => row.id));
        return [...current, ...page.rows.filter((row) => !seen.has(row.id))];
      });
      setOffset(page.nextOffset);
      setHasMore(page.hasMore);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memuat detail transaksi",
      );
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [filter, hasMore, isActive, offset, pageSize]);

  useEffect(() => {
    if (isActive && rows.length === 0 && hasMore && !loading) void loadMore();
  }, [hasMore, isActive, loadMore, loading, rows.length]);

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void loadMore();
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div ref={sectionRef} className="card p-3">
      <div className="flex justify-between items-center gap-3 mb-2">
        <h3 className="text-sm font-semibold">Detail Transaksi</h3>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {rows.length
            ? `${rows.length} dimuat`
            : isActive
              ? "Memuat..."
              : "Belum dimuat"}
        </span>
      </div>
      <div className="overflow-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>No. Pesanan</th>
              <th>Outlet</th>
              <th>Merchant</th>
              <th>Produk</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Harga</th>
              <th className="text-right">Omset</th>
              <th className="text-right">Potongan</th>
              <th className="text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{isoToWIBDisplay(r.transaction_date)}</td>
                <td>{r.order_number ?? "-"}</td>
                <td>{r.outlets?.name}</td>
                <td>
                  <MerchantBadge
                    name={r.food_merchants?.name}
                    color={r.food_merchants?.color}
                  />
                </td>
                <td>{r.product_variants?.name}</td>
                <td className="text-right">{r.qty}</td>
                <td className="text-right">{formatIDR(r.initial_price)}</td>
                <td className="text-right">{formatIDR(getGross(r))}</td>
                <td className="text-right">{formatIDR(r.deduction_fee)}</td>
                <td className="text-right font-medium">
                  {formatIDR(r.net_profit)}
                </td>
              </tr>
            ))}
            {isActive && !loading && !error && !rows.length && (
              <tr>
                <td
                  colSpan={10}
                  className="text-center py-6"
                  style={{ color: "var(--muted)" }}
                >
                  Belum ada transaksi pada rentang ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {error && (
        <div className="mt-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      )}
      <div
        ref={sentinelRef}
        className="h-8 flex items-center justify-center text-xs"
        style={{ color: "var(--muted)" }}
      >
        {loading
          ? "Memuat detail..."
          : hasMore && rows.length
            ? "Scroll untuk memuat lagi"
            : rows.length
              ? "Semua detail sudah dimuat"
              : ""}
      </div>
    </div>
  );
}

type KPIVariant =
  | "default"
  | "gross"
  | "fee"
  | "percent"
  | "net"
  | "ad"
  | "clean";

const KPI_VARIANTS: Record<KPIVariant, { card: string; value: string }> = {
  default: {
    card: "",
    value: "",
  },
  gross: {
    card: "border-l-4 border-l-blue-500 bg-blue-50/70 dark:bg-blue-950/20",
    value: "text-blue-700 dark:text-blue-300",
  },
  fee: {
    card: "border-l-4 border-l-amber-500 bg-amber-50/80 dark:bg-amber-950/20",
    value: "text-amber-700 dark:text-amber-300",
  },
  percent: {
    card: "border-l-4 border-l-cyan-500 bg-cyan-50/80 dark:bg-cyan-950/20",
    value: "text-cyan-700 dark:text-cyan-300",
  },
  net: {
    card: "border-l-4 border-l-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/20",
    value: "text-emerald-700 dark:text-emerald-300",
  },
  ad: {
    card: "border-l-4 border-l-orange-500 bg-orange-50/80 dark:bg-orange-950/20",
    value: "text-orange-700 dark:text-orange-300",
  },
  clean: {
    card: "border-l-4 border-l-violet-500 bg-violet-50/80 dark:bg-violet-950/20",
    value: "text-violet-700 dark:text-violet-300",
  },
};

function KPI({
  title,
  value,
  variant = "default",
}: {
  title: string;
  value: string;
  variant?: KPIVariant;
}) {
  const tone = KPI_VARIANTS[variant];
  return (
    <div className={`card px-3 py-2.5 ${tone.card}`}>
      <div
        className="text-[10px] sm:text-xs uppercase tracking-wide"
        style={{ color: "var(--muted)" }}
      >
        {title}
      </div>
      <div
        className={`mt-0.5 text-sm sm:text-lg font-bold leading-tight break-words ${tone.value}`}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div
      className="h-full flex items-center justify-center text-sm"
      style={{ color: "var(--muted)" }}
    >
      Tidak ada data untuk grafik ini.
    </div>
  );
}
