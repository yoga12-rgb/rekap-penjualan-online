"use client";
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type ReactNode,
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
  isoToWIBDisplay,
  todayWIBKey,
  daysAgoWIBKey,
  startOfMonthWIBKey,
  endOfMonthWIBKey,
  startOfPreviousMonthWIBKey,
  endOfPreviousMonthWIBKey,
  startOfYearWIBKey,
  endOfYearWIBKey,
} from "@/lib/date";
import { AlertCircle, Loader2, RefreshCw, X } from "lucide-react";
import {
  clearScopedFilterParams,
  copyPersistentUrlParams,
  queryString,
  setScopedFilterParams,
} from "@/lib/urlParams";
import type {
  ComparisonMetric,
  DashboardData,
  DeclineMetric,
  Merchant,
  Option,
  SummaryRow,
  Variant,
} from "./dashboardData";

type DashboardFilter = {
  from: string;
  to: string;
  outlet: string;
  merchant: string;
  variant: string;
  rangeWasReversed?: boolean;
  compMode: string;
  compFrom: string;
  compTo: string;
};
type DashboardFilterKey =
  | "from"
  | "to"
  | "outlet"
  | "merchant"
  | "variant"
  | "compMode"
  | "compFrom"
  | "compTo";

const DASHBOARD_CHART_MARGIN = { top: 8, right: 12, bottom: 8, left: 16 };
const DASHBOARD_CHART_ANIMATION = false;
const MONEY_AXIS_WIDTH = 88;
const COUNT_AXIS_WIDTH = 48;
const DASHBOARD_TOOLTIP_CONTENT_STYLE: CSSProperties = {
  backgroundColor: "color-mix(in oklab, var(--card) 96%, var(--fg) 4%)",
  border: "1px solid color-mix(in oklab, var(--border) 70%, var(--fg) 30%)",
  borderRadius: 12,
  boxShadow: "var(--shadow-popover)",
  color: "var(--fg)",
  padding: "10px 12px",
};
const DASHBOARD_TOOLTIP_LABEL_STYLE: CSSProperties = {
  color: "var(--fg)",
  fontWeight: 700,
  marginBottom: 4,
};
const DASHBOARD_TOOLTIP_ITEM_STYLE: CSSProperties = {
  color: "var(--fg)",
  fontWeight: 600,
};
type DashboardTooltipItem = {
  name?: string | number;
  dataKey?: string | number;
  value?: unknown;
  color?: string;
  fill?: string;
  stroke?: string;
};
type DashboardTooltipValueFormatter = (
  value: unknown,
  name: unknown,
  dataKey: unknown,
) => ReactNode;
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
  | "details"
  | "hari";
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
  hari: "Hari",
};

export function DashboardClient({
  role,
  outlets,
  merchants,
  variants,
  dashboardData,
  previousRange,
  filter,
  loadErrors,
}: {
  role: "super_admin" | "kasir";
  outlets: Option[];
  merchants: Merchant[];
  variants: Variant[];
  dashboardData: DashboardData;
  previousRange: { from: string; to: string };
  filter: DashboardFilter;
  loadErrors?: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isExporting, setIsExporting] = useState(false);
  const [filterPending, startFilterTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<DashboardTab>("trend");
  const [draftFilter, setDraftFilter] = useState<DashboardFilter>({
    from: filter.from,
    to: filter.to,
    outlet: filter.outlet,
    merchant: filter.merchant,
    variant: filter.variant,
    compMode: filter.compMode || "auto",
    compFrom: filter.compFrom || "",
    compTo: filter.compTo || "",
  });

  // Filter hidup di query string agar URL bisa dibagikan dan tidak perlu cookie.

  useEffect(() => {
    setDraftFilter({
      from: filter.from,
      to: filter.to,
      outlet: filter.outlet,
      merchant: filter.merchant,
      variant: filter.variant,
      compMode: filter.compMode || "auto",
      compFrom: filter.compFrom || "",
      compTo: filter.compTo || "",
    });
  }, [
    filter.from,
    filter.to,
    filter.outlet,
    filter.merchant,
    filter.variant,
    filter.compMode,
    filter.compFrom,
    filter.compTo,
  ]);

  function buildFilterParams(nextFilter: DashboardFilter) {
    const next = new URLSearchParams();
    copyPersistentUrlParams(searchParams, next);
    next.set("from", nextFilter.from);
    next.set("to", nextFilter.to);
    if (nextFilter.outlet) next.set("outlet", nextFilter.outlet);
    if (nextFilter.merchant) next.set("merchant", nextFilter.merchant);
    if (nextFilter.variant) next.set("variant", nextFilter.variant);

    if (nextFilter.compMode) next.set("comp_mode", nextFilter.compMode);
    if (nextFilter.compFrom) next.set("comp_from", nextFilter.compFrom);
    if (nextFilter.compTo) next.set("comp_to", nextFilter.compTo);

    setScopedFilterParams("dashboard", next, {
      from: nextFilter.from,
      to: nextFilter.to,
      outlet: nextFilter.outlet,
      merchant: nextFilter.merchant,
      variant: nextFilter.variant,
      comp_mode: nextFilter.compMode,
      comp_from: nextFilter.compFrom,
      comp_to: nextFilter.compTo,
    });
    return next;
  }

  function setDraftParam(key: DashboardFilterKey, value: string) {
    setDraftFilter((current) => ({ ...current, [key]: value }));
  }

  function applyFilter(nextFilter = draftFilter) {
    const next = buildFilterParams(nextFilter);
    startFilterTransition(() => router.push(`/dashboard${queryString(next)}`));
  }

  function setRange(from: string, to: string) {
    const nextFilter = { ...filter, from, to };
    setDraftFilter(nextFilter);
    applyFilter(nextFilter);
  }

  const {
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
    dayOfWeek = [],
  } = dashboardData;
  const hasSummaryRows = totals.transactionCount > 0 || totals.qty > 0;

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

      if (activeTab === "hari") {
        downloadCsv(
          [
            "Hari",
            "Transaksi",
            "Qty",
            "Omset",
            "NetProfit",
            "BiayaIklan",
            "ProfitBersih",
          ],
          dayOfWeek.map((r) => [
            r.label,
            r.transactionCount,
            r.qty,
            r.gross,
            r.net,
            r.adCost,
            r.cleanProfit,
          ]),
          `performa_hari_${filter.from}_to_${filter.to}.csv`,
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
    const next = new URLSearchParams();
    copyPersistentUrlParams(searchParams, next);
    clearScopedFilterParams("dashboard", next);
    setDraftFilter({
      from: daysAgoWIBKey(6),
      to: todayWIBKey(),
      outlet: "",
      merchant: "",
      variant: "",
      compMode: "auto",
      compFrom: "",
      compTo: "",
    });
    startFilterTransition(() => router.push(`/dashboard${queryString(next)}`));
  }

  const hasActiveFilter =
    filter.from !== daysAgoWIBKey(6) ||
    filter.to !== todayWIBKey() ||
    !!filter.outlet ||
    !!filter.merchant ||
    !!filter.variant ||
    (filter.compMode || "auto") !== "auto" ||
    !!filter.compFrom ||
    !!filter.compTo;
  const hasDraftChanges =
    draftFilter.from !== filter.from ||
    draftFilter.to !== filter.to ||
    draftFilter.outlet !== filter.outlet ||
    draftFilter.merchant !== filter.merchant ||
    draftFilter.variant !== filter.variant ||
    draftFilter.compMode !== (filter.compMode || "auto") ||
    draftFilter.compFrom !== (filter.compFrom || "") ||
    draftFilter.compTo !== (filter.compTo || "");
  const showResetFilter = hasActiveFilter || hasDraftChanges;
  function selectTab(tab: DashboardTab) {
    setActiveTab(tab);
  }

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
              disabled={
                !hasSummaryRows ||
                isExporting ||
                (activeTab === "insights" && (filter.compMode || "auto") === "none")
              }
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

        <div className="border-t border-slate-100 dark:border-slate-800/60 my-2.5" />

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Pembanding Periode">
            <select
              className="input w-full"
              value={draftFilter.compMode}
              onChange={(e) => setDraftParam("compMode", e.target.value)}
            >
              <option value="auto">Periode Sebelumnya (Otomatis)</option>
              <option value="yoy">Tahun Lalu (YoY)</option>
              <option value="custom">Periode Kustom</option>
              <option value="none">Tanpa Pembanding</option>
            </select>
          </Field>

          {draftFilter.compMode === "custom" && (
            <>
              <Field label="Bandingkan Dari">
                <input
                  type="date"
                  className="input w-full"
                  value={draftFilter.compFrom}
                  onChange={(e) => setDraftParam("compFrom", e.target.value)}
                />
              </Field>
              <Field label="Bandingkan Sampai">
                <input
                  type="date"
                  className="input w-full"
                  value={draftFilter.compTo}
                  onChange={(e) => setDraftParam("compTo", e.target.value)}
                />
              </Field>
            </>
          )}
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

      {loadErrors && loadErrors.length > 0 && (
        <div
          className="card px-3 py-2 text-xs sm:text-sm"
          style={{ borderColor: "#ef4444" }}
        >
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">Sebagian data gagal dimuat.</div>
              <ul
                className="mt-1 list-disc space-y-1 pl-4"
                style={{ color: "var(--muted)" }}
              >
                {loadErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              className="btn-ghost h-8 shrink-0 px-2 text-xs"
              onClick={() => router.refresh()}
            >
              <RefreshCw size={14} />
              Reload
            </button>
          </div>
        </div>
      )}

      {!hasSummaryRows && (!loadErrors || loadErrors.length === 0) && (
        <div
          className="card px-3 py-2 flex items-start gap-2 text-xs sm:text-sm"
          style={{ borderColor: "var(--border)" }}
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-sky-600" />
          <span>
            Belum ada transaksi pada rentang dan filter ini. Ubah filter atau
            pilih periode lain untuk melihat grafik.
          </span>
        </div>
      )}

      {filter.variant && (
        <div
          className="card px-3 py-2 flex items-center gap-2 text-xs sm:text-sm"
          style={{ borderColor: "#8b5cf6" }}
        >
          <AlertCircle size={16} className="text-violet-600" />
          <span>
            Filter varian aktif; biaya iklan tidak dikurangkan karena biaya
            iklan dicatat per outlet dan merchant, bukan per varian.
          </span>
        </div>
      )}

      <>
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
            onClick={() => selectTab("trend")}
          >
            Tren Harian
          </TabButton>
          <TabButton
            active={activeTab === "products"}
            onClick={() => selectTab("products")}
          >
            Produk Terlaris
          </TabButton>
          <TabButton
            active={activeTab === "merchants"}
            onClick={() => selectTab("merchants")}
          >
            Profit Merchant
          </TabButton>
          <TabButton
            active={activeTab === "outlets"}
            onClick={() => selectTab("outlets")}
          >
            Outlet
          </TabButton>
          <TabButton
            active={activeTab === "hours"}
            onClick={() => selectTab("hours")}
          >
            Jam Ramai
          </TabButton>
          <TabButton
            active={activeTab === "insights"}
            onClick={() => selectTab("insights")}
          >
            Insight
          </TabButton>
          <TabButton
            active={activeTab === "hari"}
            onClick={() => selectTab("hari")}
          >
            Hari
          </TabButton>
          <TabButton
            active={activeTab === "details"}
            onClick={() => selectTab("details")}
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
        {activeTab === "hari" && <DayOfWeekTab dayOfWeek={dayOfWeek} />}
        {activeTab === "insights" && (
          <InsightsTab
            comparison={comparison}
            previousRange={previousRange}
            productDeclines={productDeclines}
            merchantDeclines={merchantDeclines}
            insights={insights}
            compMode={filter.compMode}
          />
        )}
        {activeTab === "details" && <DetailTransactions filter={filter} />}
      </>
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

function formatTooltipValue(value: unknown) {
  if (typeof value === "number") return value.toLocaleString("id-ID");
  return String(value ?? "-");
}

function DashboardTooltip({
  active,
  payload,
  label,
  valueFormatter = formatTooltipValue,
}: {
  active?: boolean;
  payload?: DashboardTooltipItem[];
  label?: string | number;
  valueFormatter?: DashboardTooltipValueFormatter;
}) {
  const items =
    payload?.filter(
      (item) => item.value !== null && item.value !== undefined,
    ) ?? [];
  if (!active || !items.length) return null;

  return (
    <div
      className="min-w-44 rounded-xl"
      style={DASHBOARD_TOOLTIP_CONTENT_STYLE}
    >
      {label !== undefined && label !== null && (
        <div className="text-sm" style={DASHBOARD_TOOLTIP_LABEL_STYLE}>
          {label}
        </div>
      )}
      <div className="space-y-1.5">
        {items.map((item, index) => {
          const color = item.color ?? item.fill ?? item.stroke ?? "#94a3b8";
          const name = String(item.name ?? item.dataKey ?? "Data");

          return (
            <div
              key={`${String(item.dataKey ?? item.name ?? "item")}-${index}`}
              className="flex items-start gap-2 text-sm"
              style={DASHBOARD_TOOLTIP_ITEM_STYLE}
            >
              <span
                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <div className="min-w-0">
                <div className="font-semibold leading-snug">{name}</div>
                <div
                  className="tabular-nums leading-snug"
                  style={{ color: "var(--muted)" }}
                >
                  {valueFormatter(item.value, item.name, item.dataKey)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const TrendTab = memo(function TrendTab({
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
            <LineChart data={daily} margin={DASHBOARD_CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" stroke="var(--muted)" />
              <YAxis
                width={MONEY_AXIS_WIDTH}
                tickMargin={8}
                tickFormatter={(v) =>
                  Intl.NumberFormat("id-ID").format(v as number)
                }
                stroke="var(--muted)"
              />
              <Tooltip
                content={
                  <DashboardTooltip
                    valueFormatter={(value) => formatIDR(Number(value))}
                  />
                }
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="gross"
                name="Omset"
                stroke="#3b82f6"
                dot={daily.length === 1}
                strokeWidth={2}
                isAnimationActive={DASHBOARD_CHART_ANIMATION}
              />
              <Line
                type="monotone"
                dataKey="net"
                name="Net Profit"
                stroke="#22c55e"
                dot={daily.length === 1}
                strokeWidth={2}
                isAnimationActive={DASHBOARD_CHART_ANIMATION}
              />
              <Line
                type="monotone"
                dataKey="cleanProfit"
                name="Profit Bersih"
                stroke="#8b5cf6"
                dot={daily.length === 1}
                strokeWidth={2}
                isAnimationActive={DASHBOARD_CHART_ANIMATION}
              />
              <Line
                type="monotone"
                dataKey="fee"
                name="Potongan"
                stroke="#ef4444"
                dot={daily.length === 1}
                strokeWidth={2}
                isAnimationActive={DASHBOARD_CHART_ANIMATION}
              />
              <Line
                type="monotone"
                dataKey="adCost"
                name="Biaya Iklan"
                stroke="#f97316"
                dot={daily.length === 1}
                strokeWidth={2}
                isAnimationActive={DASHBOARD_CHART_ANIMATION}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
});

const ProductsTab = memo(function ProductsTab({
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
            <BarChart data={leaderboard} margin={DASHBOARD_CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--muted)" />
              <YAxis
                width={COUNT_AXIS_WIDTH}
                tickMargin={8}
                stroke="var(--muted)"
              />
              <Tooltip content={<DashboardTooltip />} />
              <Bar
                dataKey="qty"
                name="Qty"
                fill="#b91c1c"
                isAnimationActive={DASHBOARD_CHART_ANIMATION}
              />
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
});

const MerchantsTab = memo(function MerchantsTab({
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
            <BarChart data={merchantBreakdown} margin={DASHBOARD_CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--muted)" />
              <YAxis
                width={MONEY_AXIS_WIDTH}
                tickMargin={8}
                tickFormatter={(v) =>
                  Intl.NumberFormat("id-ID").format(v as number)
                }
                stroke="var(--muted)"
              />
              <Tooltip
                content={
                  <DashboardTooltip
                    valueFormatter={(value) => formatIDR(Number(value))}
                  />
                }
              />
              <Bar
                dataKey="cleanProfit"
                name="Profit Bersih"
                isAnimationActive={DASHBOARD_CHART_ANIMATION}
              >
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
});

const OutletsTab = memo(function OutletsTab({
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
            <BarChart data={outletBreakdown} margin={DASHBOARD_CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--muted)" />
              <YAxis
                width={MONEY_AXIS_WIDTH}
                tickMargin={8}
                tickFormatter={(v) =>
                  Intl.NumberFormat("id-ID").format(v as number)
                }
                stroke="var(--muted)"
              />
              <Tooltip
                content={
                  <DashboardTooltip
                    valueFormatter={(value) => formatIDR(Number(value))}
                  />
                }
              />
              <Legend />
              <Bar
                dataKey="gross"
                name="Omset"
                fill="#3b82f6"
                isAnimationActive={DASHBOARD_CHART_ANIMATION}
              />
              <Bar
                dataKey="net"
                name="Net Profit"
                fill="#22c55e"
                isAnimationActive={DASHBOARD_CHART_ANIMATION}
              />
              <Bar
                dataKey="cleanProfit"
                name="Profit Bersih"
                fill="#8b5cf6"
                isAnimationActive={DASHBOARD_CHART_ANIMATION}
              />
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
});

const HoursTab = memo(function HoursTab({
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
            <BarChart data={hourly} margin={DASHBOARD_CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" stroke="var(--muted)" />
              <YAxis
                width={COUNT_AXIS_WIDTH}
                tickMargin={8}
                stroke="var(--muted)"
              />
              <Tooltip content={<DashboardTooltip />} />
              <Legend />
              <Bar
                dataKey="transactionCount"
                name="Transaksi"
                fill="#b91c1c"
                isAnimationActive={DASHBOARD_CHART_ANIMATION}
              />
              <Bar
                dataKey="qty"
                name="Qty"
                fill="#3b82f6"
                isAnimationActive={DASHBOARD_CHART_ANIMATION}
              />
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
});

const InsightsTab = memo(function InsightsTab({
  comparison,
  previousRange,
  productDeclines,
  merchantDeclines,
  insights,
  compMode = "auto",
}: {
  comparison: ComparisonMetric[];
  previousRange: { from: string; to: string };
  productDeclines: DeclineMetric[];
  merchantDeclines: DeclineMetric[];
  insights: string[];
  compMode?: string;
}) {
  if (compMode === "none") {
    return (
      <div className="card p-6 text-center space-y-2 flex flex-col items-center justify-center min-h-[300px]">
        <AlertCircle className="text-slate-400 dark:text-slate-600 mb-1" size={32} />
        <h3 className="text-sm font-semibold">Perbandingan Periode Dinonaktifkan</h3>
        <p className="text-xs max-w-sm" style={{ color: "var(--muted)" }}>
          Aktifkan pembanding periode di bagian filter jika Anda ingin melihat rangkuman performa dan perbandingan periode.
        </p>
      </div>
    );
  }

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
});

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

function formatPercent(value: number) {
  return `${value.toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function formatMetricValue(value: number, format: "currency" | "number") {
  if (format === "currency") return formatIDR(value);
  return value.toLocaleString("id-ID", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  });
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

const DetailTransactions = memo(function DetailTransactions({
  filter,
}: {
  filter: DashboardFilter;
}) {
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
});

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

const DAY_OF_WEEK_COLORS = [
  "#ef4444", // Senin - red
  "#f97316", // Selasa - orange
  "#eab308", // Rabu - yellow
  "#22c55e", // Kamis - green
  "#3b82f6", // Jumat - blue
  "#8b5cf6", // Sabtu - violet
  "#ec4899", // Minggu - pink
];

const DayOfWeekTab = memo(function DayOfWeekTab({
  dayOfWeek,
}: {
  dayOfWeek: Array<{
    dayIndex: number;
    label: string;
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
      <h3 className="text-sm font-semibold mb-2">Performa per Hari</h3>
      <div className="h-52 sm:h-60 lg:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={dayOfWeek}
            margin={DASHBOARD_CHART_MARGIN}
            layout="vertical"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" stroke="var(--muted)" />
            <YAxis
              dataKey="label"
              type="category"
              width={60}
              tickMargin={8}
              stroke="var(--muted)"
            />
            <Tooltip
              content={
                <DashboardTooltip
                  valueFormatter={(value) =>
                    typeof value === "number" && value >= 1000
                      ? formatIDR(value as number)
                      : formatTooltipValue(value)
                  }
                />
              }
            />
            <Legend />
            <Bar
              dataKey="net"
              name="Net Profit"
              isAnimationActive={DASHBOARD_CHART_ANIMATION}
            >
              {dayOfWeek.map((d) => (
                <Cell
                  key={d.label}
                  fill={DAY_OF_WEEK_COLORS[d.dayIndex] ?? "#94a3b8"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-auto mt-2">
        <table className="table">
          <thead>
            <tr>
              <th>Hari</th>
              <th className="text-right">Transaksi</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Omset</th>
              <th className="text-right">Net Profit</th>
              <th className="text-right">Biaya Iklan</th>
              <th className="text-right">Profit Bersih</th>
            </tr>
          </thead>
          <tbody>
            {dayOfWeek.map((d) => (
              <tr
                key={d.label}
                className={d.transactionCount > 0 ? "font-medium" : ""}
                style={
                  d.transactionCount > 0
                    ? { color: DAY_OF_WEEK_COLORS[d.dayIndex] }
                    : { color: "var(--muted)" }
                }
              >
                <td>{d.label}</td>
                <td className="text-right">
                  {d.transactionCount.toLocaleString("id-ID")}
                </td>
                <td className="text-right">{d.qty.toLocaleString("id-ID")}</td>
                <td className="text-right">{formatIDR(d.gross)}</td>
                <td className="text-right">{formatIDR(d.net)}</td>
                <td className="text-right">{formatIDR(d.adCost)}</td>
                <td className="text-right font-semibold">
                  {formatIDR(d.cleanProfit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

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
