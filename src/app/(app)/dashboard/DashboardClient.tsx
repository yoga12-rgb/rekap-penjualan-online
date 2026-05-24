"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatIDR } from "@/lib/utils";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend, Cell
} from "recharts";
import { getMerchantTheme } from "@/lib/merchantColors";
import { MerchantBadge } from "@/components/MerchantBadge";
import { Combobox } from "@/components/ui/Combobox";
import {
  isoToWIBDateKey, isoToWIBDisplay, todayWIBKey, daysAgoWIBKey, startOfYearWIBKey, endOfYearWIBKey
} from "@/lib/date";
import { AlertCircle } from "lucide-react";

type Option = { id: string; name: string };
type Merchant = Option & { color?: string | null };
type Variant = Option & { base_price?: number };
type DashboardFilter = { from: string; to: string; outlet: string; merchant: string; variant: string; rangeWasReversed?: boolean };
type SummaryRow = {
  transaction_date: string;
  qty: number;
  initial_price: number;
  deduction_fee: number;
  net_profit: number;
  food_merchant_id: string;
  product_variant_id: string;
  food_merchants: { name: string; color: string | null } | null;
  product_variants: { name: string } | null;
};
type DetailRow = SummaryRow & {
  id: string;
  outlet_id: string;
  outlets: { name: string } | null;
};

type TransactionPage = {
  rows: DetailRow[];
  nextOffset: number;
  hasMore: boolean;
  error?: string;
};
type DashboardTab = "trend" | "products" | "merchants" | "details";

export function DashboardClient({
  role, outlets, merchants, variants, rows, filter
}: {
  role: "super_admin" | "kasir";
  outlets: Option[];
  merchants: Merchant[];
  variants: Variant[];
  rows: SummaryRow[];
  filter: DashboardFilter;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>("trend");

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.push(`/dashboard?${next.toString()}`);
  }

  function setRange(from: string, to: string) {
    const next = new URLSearchParams(sp.toString());
    next.set("from", from);
    next.set("to", to);
    router.push(`/dashboard?${next.toString()}`);
  }

  const totals = useMemo(() => {
    const gross = rows.reduce((a, r) => a + r.qty * r.initial_price, 0);
    const fee = rows.reduce((a, r) => a + Number(r.deduction_fee || 0), 0);
    const net = rows.reduce((a, r) => a + Number(r.net_profit || 0), 0);
    const qty = rows.reduce((a, r) => a + r.qty, 0);
    return { gross, fee, net, qty };
  }, [rows]);

  const daily = useMemo(() => {
    const map = new Map<string, { date: string; gross: number; fee: number; net: number }>();
    for (const r of rows) {
      const d = isoToWIBDateKey(r.transaction_date);
      const cur = map.get(d) ?? { date: d, gross: 0, fee: 0, net: 0 };
      cur.gross += r.qty * r.initial_price;
      cur.fee += Number(r.deduction_fee || 0);
      cur.net += Number(r.net_profit || 0);
      map.set(d, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [rows]);

  const leaderboard = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; net: number }>();
    for (const r of rows) {
      const key = r.product_variant_id;
      const cur = map.get(key) ?? { name: r.product_variants?.name ?? "-", qty: 0, net: 0 };
      cur.qty += r.qty;
      cur.net += Number(r.net_profit || 0);
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [rows]);

  const merchantBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; net: number; color: string | null }>();
    for (const r of rows) {
      const key = r.food_merchant_id;
      const cur = map.get(key) ?? {
        name: r.food_merchants?.name ?? "-",
        color: r.food_merchants?.color ?? null,
        net: 0
      };
      cur.net += Number(r.net_profit || 0);
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.net - a.net);
  }, [rows]);

  async function exportCsv() {
    setIsExporting(true);
    const detailRows: DetailRow[] = [];
    try {
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const page = await fetchTransactionPage(filter, offset, 100);
        detailRows.push(...page.rows);
        offset = page.nextOffset;
        hasMore = page.hasMore;
      }
    } finally {
      setIsExporting(false);
    }

    const headers = [
      "Tanggal",
      "Outlet",
      "Merchant",
      "Produk",
      "Qty",
      "HargaSatuan",
      "Omset",
      "Potongan",
      "NetProfit"
    ];
    const data = detailRows.map((r) => [
      isoToWIBDisplay(r.transaction_date),
      r.outlets?.name ?? "",
      r.food_merchants?.name ?? "",
      r.product_variants?.name ?? "",
      r.qty,
      r.initial_price,
      r.qty * r.initial_price,
      r.deduction_fee,
      r.net_profit
    ]);
    const escapeCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [headers, ...data].map((row) => row.map(escapeCell).join(",")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rekap_${filter.from}_to_${filter.to}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function setRangePreset(preset: "today" | "7d" | "30d" | "ytd" | "year") {
    if (preset === "today") return setRange(todayWIBKey(), todayWIBKey());
    if (preset === "7d") return setRange(daysAgoWIBKey(6), todayWIBKey());
    if (preset === "30d") return setRange(daysAgoWIBKey(29), todayWIBKey());
    if (preset === "ytd") return setRange(startOfYearWIBKey(), todayWIBKey());
    if (preset === "year") return setRange(startOfYearWIBKey(), endOfYearWIBKey());
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="card p-3 overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-2.5 items-end">
          <Field label="Dari">
            <input type="date" className="input" value={filter.from}
                   onChange={(e) => setParam("from", e.target.value)} />
          </Field>
          <Field label="Sampai">
            <input type="date" className="input" value={filter.to}
                   onChange={(e) => setParam("to", e.target.value)} />
          </Field>
          {role === "super_admin" && (
            <Field label="Outlet">
              <Combobox
                options={outlets.map((o) => ({ value: o.id, label: o.name }))}
                value={filter.outlet}
                onChange={(v) => setParam("outlet", v)}
                placeholder="Semua Outlet"
                clearable
              />
            </Field>
          )}
          <Field label="Merchant">
            <Combobox
              options={merchants.map((m) => ({ value: m.id, label: m.name }))}
              value={filter.merchant}
              onChange={(v) => setParam("merchant", v)}
              placeholder="Semua Merchant"
              clearable
            />
          </Field>
          <Field label="Varian Produk">
            <Combobox
              options={variants.map((v) => ({
                value: v.id,
                label: v.name,
                hint: v.base_price != null ? formatIDR(v.base_price) : undefined
              }))}
              value={filter.variant}
              onChange={(v) => setParam("variant", v)}
              placeholder="Semua Varian"
              clearable
            />
          </Field>
          <div className="col-span-2 md:col-span-1 min-w-0">
            <button className="btn-primary w-full h-10 px-3 whitespace-nowrap" onClick={exportCsv} disabled={!rows.length || isExporting}>
              {isExporting ? "Exporting..." : "Export CSV"}
            </button>
          </div>
        </div>

        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
          <PresetButton onClick={() => setRangePreset("today")}>Hari ini</PresetButton>
          <PresetButton onClick={() => setRangePreset("7d")}>7H</PresetButton>
          <PresetButton onClick={() => setRangePreset("30d")}>30H</PresetButton>
          <PresetButton onClick={() => setRangePreset("ytd")}>YTD</PresetButton>
          <PresetButton onClick={() => setRangePreset("year")}>Tahun</PresetButton>
        </div>
      </div>

      {filter.rangeWasReversed && (
        <div className="card px-3 py-2 flex items-center gap-2 text-xs sm:text-sm" style={{ borderColor: "#f59e0b" }}>
          <AlertCircle size={16} className="text-amber-600" />
          <span>Tanggal "Dari" lebih besar dari "Sampai"; sistem otomatis menukar urutan untuk query.</span>
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5">
        <KPI title="Total Omset" value={formatIDR(totals.gross)} />
        <KPI title="Total Potongan Admin" value={formatIDR(totals.fee)} />
        <KPI title="Net Profit" value={formatIDR(totals.net)} accent />
        <KPI title="Total Qty" value={totals.qty.toLocaleString("id-ID")} />
      </div>

      <div className="flex overflow-x-auto border-b -mb-1" style={{ borderColor: "var(--border)" }}>
        <TabButton active={activeTab === "trend"} onClick={() => setActiveTab("trend")}>
          Tren Harian
        </TabButton>
        <TabButton active={activeTab === "products"} onClick={() => setActiveTab("products")}>
          Produk Terlaris
        </TabButton>
        <TabButton active={activeTab === "merchants"} onClick={() => setActiveTab("merchants")}>
          Profit Merchant
        </TabButton>
        <TabButton active={activeTab === "details"} onClick={() => setActiveTab("details")}>
          Detail Transaksi
        </TabButton>
      </div>

      {activeTab === "trend" && <TrendTab daily={daily} />}
      {activeTab === "products" && <ProductsTab leaderboard={leaderboard} />}
      {activeTab === "merchants" && <MerchantsTab merchantBreakdown={merchantBreakdown} />}
      {activeTab === "details" && <DetailTransactions filter={filter} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children
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
        color: active ? undefined : "var(--muted)"
      }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="mb-1 block text-xs font-medium" style={{ color: "var(--muted)" }}>{label}</label>
      {children}
    </div>
  );
}

function PresetButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="btn-outline px-2.5 py-1.5 text-xs whitespace-nowrap" onClick={onClick}>
      {children}
    </button>
  );
}

function TrendTab({ daily }: { daily: Array<{ date: string; gross: number; fee: number; net: number }> }) {
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
              <YAxis tickFormatter={(v) => Intl.NumberFormat("id-ID").format(v as number)} stroke="var(--muted)" />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--fg)" }}
                formatter={(v: any) => formatIDR(Number(v))}
              />
              <Legend />
              <Line type="monotone" dataKey="gross" name="Omset" stroke="#3b82f6"
                    dot={daily.length === 1} strokeWidth={2} />
              <Line type="monotone" dataKey="net" name="Net Profit" stroke="#22c55e"
                    dot={daily.length === 1} strokeWidth={2} />
              <Line type="monotone" dataKey="fee" name="Potongan" stroke="#ef4444"
                    dot={daily.length === 1} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function ProductsTab({ leaderboard }: { leaderboard: Array<{ name: string; qty: number; net: number }> }) {
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
              <Tooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--fg)" }} />
              <Bar dataKey="qty" fill="#b91c1c" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="overflow-auto mt-2">
      <table className="table">
        <thead><tr><th>Produk</th><th className="text-right">Qty</th><th className="text-right">Net</th></tr></thead>
        <tbody>
          {leaderboard.map((p) => (
            <tr key={p.name}>
              <td>{p.name}</td>
              <td className="text-right">{p.qty}</td>
              <td className="text-right">{formatIDR(p.net)}</td>
            </tr>
          ))}
          {!leaderboard.length && (
            <tr><td colSpan={3} className="text-center py-4" style={{ color: "var(--muted)" }}>Tidak ada data</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function MerchantsTab({
  merchantBreakdown
}: {
  merchantBreakdown: Array<{ name: string; net: number; color: string | null }>;
}) {
  return (
    <div className="card p-3">
      <h3 className="text-sm font-semibold mb-2">Net Profit per Merchant</h3>
      <div className="h-52 sm:h-60 lg:h-64">
        {merchantBreakdown.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={merchantBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--muted)" />
              <YAxis tickFormatter={(v) => Intl.NumberFormat("id-ID").format(v as number)} stroke="var(--muted)" />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--fg)" }}
                formatter={(v: any) => formatIDR(Number(v))}
              />
              <Bar dataKey="net">
                {merchantBreakdown.map((m) => (
                  <Cell key={m.name} fill={getMerchantTheme(m.name, m.color).bg} />
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

function buildTransactionUrl(filter: DashboardFilter, offset: number, limit: number) {
  const params = new URLSearchParams({
    from: filter.from,
    to: filter.to,
    offset: String(offset),
    limit: String(limit)
  });
  if (filter.outlet) params.set("outlet", filter.outlet);
  if (filter.merchant) params.set("merchant", filter.merchant);
  if (filter.variant) params.set("variant", filter.variant);
  return `/api/dashboard/transactions?${params.toString()}`;
}

async function fetchTransactionPage(filter: DashboardFilter, offset: number, limit: number) {
  const res = await fetch(buildTransactionUrl(filter, offset, limit), { cache: "no-store" });
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
      { rootMargin: "300px 0px" }
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
      setError(err instanceof Error ? err.message : "Gagal memuat detail transaksi");
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
      { rootMargin: "400px 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div ref={sectionRef} className="card p-3">
      <div className="flex justify-between items-center gap-3 mb-2">
        <h3 className="text-sm font-semibold">Detail Transaksi</h3>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {rows.length ? `${rows.length} dimuat` : isActive ? "Memuat..." : "Belum dimuat"}
        </span>
      </div>
      <div className="overflow-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Tanggal</th><th>Outlet</th><th>Merchant</th><th>Produk</th>
              <th className="text-right">Qty</th><th className="text-right">Harga</th>
              <th className="text-right">Omset</th><th className="text-right">Potongan</th>
              <th className="text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{isoToWIBDisplay(r.transaction_date)}</td>
                <td>{r.outlets?.name}</td>
                <td><MerchantBadge name={r.food_merchants?.name} color={r.food_merchants?.color} /></td>
                <td>{r.product_variants?.name}</td>
                <td className="text-right">{r.qty}</td>
                <td className="text-right">{formatIDR(r.initial_price)}</td>
                <td className="text-right">{formatIDR(r.qty * r.initial_price)}</td>
                <td className="text-right">{formatIDR(r.deduction_fee)}</td>
                <td className="text-right font-medium">{formatIDR(r.net_profit)}</td>
              </tr>
            ))}
            {isActive && !loading && !error && !rows.length && (
              <tr>
                <td colSpan={9} className="text-center py-6" style={{ color: "var(--muted)" }}>
                  Belum ada transaksi pada rentang ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {error && (
        <div className="mt-3 text-sm text-red-600 dark:text-red-300">{error}</div>
      )}
      <div ref={sentinelRef} className="h-8 flex items-center justify-center text-xs" style={{ color: "var(--muted)" }}>
        {loading ? "Memuat detail..." : hasMore && rows.length ? "Scroll untuk memuat lagi" : rows.length ? "Semua detail sudah dimuat" : ""}
      </div>
    </div>
  );
}

function KPI({ title, value, accent }: { title: string; value: string; accent?: boolean }) {
  return (
    <div className={`card px-3 py-2.5 ${accent ? "ring-2 ring-red-200 dark:ring-red-900/40" : ""}`}>
      <div className="text-[10px] sm:text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>{title}</div>
      <div className={`mt-0.5 text-sm sm:text-lg font-bold leading-tight break-words ${accent ? "text-red-700 dark:text-red-300" : ""}`}>{value}</div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-full flex items-center justify-center text-sm" style={{ color: "var(--muted)" }}>
      Tidak ada data untuk grafik ini.
    </div>
  );
}
