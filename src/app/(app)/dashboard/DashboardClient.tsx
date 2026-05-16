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

type Option = { id: string; name: string };
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
  merchants: Option[];
  variants: Option[];
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
      const d = r.transaction_date.slice(0, 10);
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
        Tanggal: r.transaction_date,
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
    const today = new Date();
    let from = new Date();
    if (preset === "today") from = today;
    if (preset === "7d") from.setDate(today.getDate() - 6);
    if (preset === "30d") from.setDate(today.getDate() - 29);
    if (preset === "ytd") from = new Date(today.getFullYear(), 0, 1);
    if (preset === "year") {
      from = new Date(today.getFullYear(), 0, 1);
      const to = new Date(today.getFullYear(), 11, 31);
      const next = new URLSearchParams(sp.toString());
      next.set("from", from.toISOString().slice(0, 10));
      next.set("to", to.toISOString().slice(0, 10));
      router.push(`/dashboard?${next.toString()}`);
      return;
    }
    const next = new URLSearchParams(sp.toString());
    next.set("from", from.toISOString().slice(0, 10));
    next.set("to", today.toISOString().slice(0, 10));
    router.push(`/dashboard?${next.toString()}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
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
            <select className="input" value={filter.outlet}
                    onChange={(e) => setParam("outlet", e.target.value)}>
              <option value="">Semua Outlet</option>
              {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label">Merchant</label>
          <select className="input" value={filter.merchant}
                  onChange={(e) => setParam("merchant", e.target.value)}>
            <option value="">Semua Merchant</option>
            {merchants.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Varian Produk</label>
          <Combobox
            options={variants.map((v) => ({ value: v.id, label: v.name }))}
            value={filter.variant}
            onChange={(v) => setParam("variant", v)}
            placeholder="Semua Varian"
            clearable
            className="min-w-[180px]"
          />
        </div>
        <div className="flex gap-1">
          <button className="btn-outline" onClick={() => setRangePreset("today")}>Hari ini</button>
          <button className="btn-outline" onClick={() => setRangePreset("7d")}>7H</button>
          <button className="btn-outline" onClick={() => setRangePreset("30d")}>30H</button>
          <button className="btn-outline" onClick={() => setRangePreset("ytd")}>YTD</button>
          <button className="btn-outline" onClick={() => setRangePreset("year")}>Tahun</button>
        </div>
        <div className="ml-auto">
          <button className="btn-primary" onClick={exportXlsx}>Export Excel</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <KPI title="Total Omset" value={formatIDR(totals.gross)} />
        <KPI title="Total Potongan Admin" value={formatIDR(totals.fee)} />
        <KPI title="Net Profit" value={formatIDR(totals.net)} accent />
        <KPI title="Total Qty" value={totals.qty.toLocaleString("id-ID")} />
      </div>

      <div className="card p-4">
        <h3 className="font-semibold mb-2">Tren Penjualan Harian</h3>
        <div className="h-72">
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
              <Line type="monotone" dataKey="gross" name="Omset" stroke="#3b82f6" />
              <Line type="monotone" dataKey="net" name="Net Profit" stroke="#22c55e" />
              <Line type="monotone" dataKey="fee" name="Potongan" stroke="#ef4444" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="font-semibold mb-2">Produk Terlaris (Qty)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leaderboard}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted)" />
                <YAxis stroke="var(--muted)" />
                <Tooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--fg)" }} />
                <Bar dataKey="qty" fill="#b91c1c" />
              </BarChart>
            </ResponsiveContainer>
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
              {!leaderboard.length && <tr><td colSpan={3} className="text-center text-slate-500 py-4">Tidak ada data</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card p-4">
          <h3 className="font-semibold mb-2">Net Profit per Merchant</h3>
          <div className="h-64">
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
          <span className="text-xs text-slate-500">{rows.length} baris</span>
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
                  <td>{new Date(r.transaction_date).toLocaleString("id-ID")}</td>
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
              {!rows.length && <tr><td colSpan={9} className="text-center py-6 text-slate-500">Belum ada transaksi pada rentang ini.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPI({ title, value, accent }: { title: string; value: string; accent?: boolean }) {
  return (
    <div className={`card p-4 ${accent ? "ring-2 ring-red-200" : ""}`}>
      <div className="text-xs uppercase tracking-wide text-slate-500">{title}</div>
      <div className={`mt-1 text-xl font-bold ${accent ? "text-red-700" : ""}`}>{value}</div>
    </div>
  );
}
