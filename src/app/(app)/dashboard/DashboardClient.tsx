"use client";
import { useMemo } from "react";
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
type Row = {
  id: string;
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

export function DashboardClient({
  role, outlets, merchants, variants, rows, filter
}: {
  role: "super_admin" | "kasir";
  outlets: Option[];
  merchants: Merchant[];
  variants: Variant[];
  rows: Row[];
  filter: { from: string; to: string; outlet: string; merchant: string; variant: string };
}) {
  const router = useRouter();
  const sp = useSearchParams();

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

  function exportXlsx() {
    import("xlsx").then((XLSX) => {
      const data = rows.map((r) => ({
        Tanggal: isoToWIBDisplay(r.transaction_date),
        Outlet: r.outlets?.name ?? "",
        Merchant: r.food_merchants?.name ?? "",
        Produk: r.product_variants?.name ?? "",
        Qty: r.qty,
        HargaSatuan: r.initial_price,
        Omset: r.qty * r.initial_price,
        Potongan: r.deduction_fee,
        NetProfit: r.net_profit
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Transactions");
      XLSX.writeFile(wb, `rekap_${filter.from}_to_${filter.to}.xlsx`);
    });
  }

  function setRangePreset(preset: "today" | "7d" | "30d" | "ytd" | "year") {
    if (preset === "today") return setRange(todayWIBKey(), todayWIBKey());
    if (preset === "7d") return setRange(daysAgoWIBKey(6), todayWIBKey());
    if (preset === "30d") return setRange(daysAgoWIBKey(29), todayWIBKey());
    if (preset === "ytd") return setRange(startOfYearWIBKey(), todayWIBKey());
    if (preset === "year") return setRange(startOfYearWIBKey(), endOfYearWIBKey());
  }

  const fromInvalid = filter.from > filter.to;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div>
          <label className="label">Dari</label>
          <input type="date" className="input" value={filter.from}
                 onChange={(e) => setParam("from", e.target.value)} />
        </div>
        <div>
          <label className="label">Sampai</label>
          <input type="date" className="input" value={filter.to}
                 onChange={(e) => setParam("to", e.target.value)} />
        </div>
        {role === "super_admin" && (
          <div>
            <label className="label">Outlet</label>
            <Combobox
              options={outlets.map((o) => ({ value: o.id, label: o.name }))}
              value={filter.outlet}
              onChange={(v) => setParam("outlet", v)}
              placeholder="Semua Outlet"
              clearable
            />
          </div>
        )}
        <div>
          <label className="label">Merchant</label>
          <Combobox
            options={merchants.map((m) => ({ value: m.id, label: m.name }))}
            value={filter.merchant}
            onChange={(v) => setParam("merchant", v)}
            placeholder="Semua Merchant"
            clearable
          />
        </div>
        <div>
          <label className="label">Varian Produk</label>
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
        </div>
        <div className="col-span-2 sm:col-span-3 lg:col-span-1 flex items-end">
          <button className="btn-primary w-full" onClick={exportXlsx} disabled={!rows.length}>
            Export Excel
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button className="btn-outline" onClick={() => setRangePreset("today")}>Hari ini</button>
        <button className="btn-outline" onClick={() => setRangePreset("7d")}>7H</button>
        <button className="btn-outline" onClick={() => setRangePreset("30d")}>30H</button>
        <button className="btn-outline" onClick={() => setRangePreset("ytd")}>YTD</button>
        <button className="btn-outline" onClick={() => setRangePreset("year")}>Tahun</button>
      </div>

      {fromInvalid && (
        <div className="card p-3 flex items-center gap-2 text-sm" style={{ borderColor: "#f59e0b" }}>
          <AlertCircle size={16} className="text-amber-600" />
          <span>Tanggal "Dari" lebih besar dari "Sampai" — sistem otomatis menukar urutan untuk query.</span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI title="Total Omset" value={formatIDR(totals.gross)} />
        <KPI title="Total Potongan Admin" value={formatIDR(totals.fee)} />
        <KPI title="Net Profit" value={formatIDR(totals.net)} accent />
        <KPI title="Total Qty" value={totals.qty.toLocaleString("id-ID")} />
      </div>

      <div className="card p-4">
        <h3 className="font-semibold mb-2">Tren Penjualan Harian</h3>
        <div className="h-72">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="font-semibold mb-2">Produk Terlaris (Qty)</h3>
          <div className="h-64">
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
          <table className="table mt-3">
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

        <div className="card p-4">
          <h3 className="font-semibold mb-2">Net Profit per Merchant</h3>
          <div className="h-64">
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
          <div className="mt-3 flex flex-wrap gap-2">
            {merchantBreakdown.map((m) => (
              <MerchantBadge key={m.name} name={m.name} color={m.color} />
            ))}
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold">Detail Transaksi</h3>
          <span className="text-xs" style={{ color: "var(--muted)" }}>{rows.length} baris</span>
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
              {!rows.length && (
                <tr>
                  <td colSpan={9} className="text-center py-6" style={{ color: "var(--muted)" }}>
                    Belum ada transaksi pada rentang ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPI({ title, value, accent }: { title: string; value: string; accent?: boolean }) {
  return (
    <div className={`card p-3 sm:p-4 ${accent ? "ring-2 ring-red-200 dark:ring-red-900/40" : ""}`}>
      <div className="text-[10px] sm:text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>{title}</div>
      <div className={`mt-1 text-base sm:text-xl font-bold leading-tight break-words ${accent ? "text-red-700 dark:text-red-300" : ""}`}>{value}</div>
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
