"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { formatIDR } from "@/lib/utils";
import { toast } from "@/components/Toast";
import { Plus, Trash2, Pencil, Filter, X, AlertCircle } from "lucide-react";
import { createOrder, updateTransaction, deleteTransaction, deleteOrder } from "./actions";
import { MerchantBadge } from "@/components/MerchantBadge";
import { getMerchantTheme } from "@/lib/merchantColors";
import { Combobox } from "@/components/ui/Combobox";
import {
  isoToWIBDisplay, isoToWIBLocalInput, todayWIBKey, daysAgoWIBKey, startOfYearWIBKey
} from "@/lib/date";

type Option = { id: string; name: string };
type Merchant = Option & { color?: string | null };
type Variant = Option & { base_price: number };
type Row = {
  id: string;
  order_id: string | null;
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

type Group = {
  order_id: string;
  date: string;
  outlet: string;
  merchant: string;
  merchantColor: string | null;
  rows: Row[];
  gross: number;
  fee: number;
  net: number;
};
const TRANSACTIONS_FILTER_STORAGE_KEY = "transactions-filters";

export function TransactionsClient({
  role, myOutletId, outlets, merchants, variants, rows, filter
}: {
  role: "super_admin" | "kasir";
  myOutletId: string | null;
  outlets: Option[];
  merchants: Merchant[];
  variants: Variant[];
  rows: Row[];
  filter: { from: string; to: string; outlet: string; merchant: string; variant: string; q: string };
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const skipNextFilterSave = useRef(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [pending, start] = useTransition();
  const [search, setSearch] = useState(filter.q);

  useEffect(() => {
    const hasUrlFilter = sp.toString().length > 0;
    const saved = localStorage.getItem(TRANSACTIONS_FILTER_STORAGE_KEY);
    if (!hasUrlFilter && saved) {
      try {
        const params = new URLSearchParams(JSON.parse(saved) as Record<string, string>);
        skipNextFilterSave.current = true;
        router.replace(`/transactions?${params.toString()}`);
      } catch {
        localStorage.removeItem(TRANSACTIONS_FILTER_STORAGE_KEY);
      }
    }
  }, [router, sp]);

  useEffect(() => {
    setSearch(filter.q);
  }, [filter.q]);

  useEffect(() => {
    if (skipNextFilterSave.current) {
      skipNextFilterSave.current = false;
      return;
    }
    const params = new URLSearchParams();
    params.set("from", filter.from);
    params.set("to", filter.to);
    if (filter.outlet) params.set("outlet", filter.outlet);
    if (filter.merchant) params.set("merchant", filter.merchant);
    if (filter.variant) params.set("variant", filter.variant);
    if (filter.q) params.set("q", filter.q);
    localStorage.setItem(TRANSACTIONS_FILTER_STORAGE_KEY, JSON.stringify(Object.fromEntries(params)));
  }, [filter.from, filter.to, filter.outlet, filter.merchant, filter.variant, filter.q]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.push(`/transactions?${next.toString()}`);
  }
  function setRangePreset(preset: "today" | "7d" | "30d" | "ytd") {
    const next = new URLSearchParams(sp.toString());
    if (preset === "today") {
      next.set("from", todayWIBKey()); next.set("to", todayWIBKey());
    } else if (preset === "7d") {
      next.set("from", daysAgoWIBKey(6)); next.set("to", todayWIBKey());
    } else if (preset === "30d") {
      next.set("from", daysAgoWIBKey(29)); next.set("to", todayWIBKey());
    } else if (preset === "ytd") {
      next.set("from", startOfYearWIBKey()); next.set("to", todayWIBKey());
    }
    router.push(`/transactions?${next.toString()}`);
  }
  function clearFilter() {
    localStorage.removeItem(TRANSACTIONS_FILTER_STORAGE_KEY);
    router.push("/transactions");
    setSearch("");
  }

  const hasActiveFilter =
    filter.from !== todayWIBKey() ||
    filter.to !== todayWIBKey() ||
    !!filter.outlet ||
    !!filter.merchant ||
    !!filter.variant ||
    !!filter.q;
  const fromInvalid = filter.from > filter.to;

  const filteredRows = useMemo(() => {
    if (!filter.q) return rows;
    const needle = filter.q.toLowerCase();
    return rows.filter((r) =>
      (r.product_variants?.name ?? "").toLowerCase().includes(needle) ||
      (r.outlets?.name ?? "").toLowerCase().includes(needle) ||
      (r.food_merchants?.name ?? "").toLowerCase().includes(needle)
    );
  }, [rows, filter.q]);

  const groups: Group[] = useMemo(() => {
    const map = new Map<string, Group>();
    for (const r of filteredRows) {
      const key = r.order_id ?? r.id;
      const cur = map.get(key) ?? {
        order_id: key,
        date: r.transaction_date,
        outlet: r.outlets?.name ?? "",
        merchant: r.food_merchants?.name ?? "",
        merchantColor: r.food_merchants?.color ?? null,
        rows: [], gross: 0, fee: 0, net: 0
      };
      cur.rows.push(r);
      cur.gross += r.qty * r.initial_price;
      cur.fee += Number(r.deduction_fee || 0);
      cur.net += Number(r.net_profit || 0);
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredRows]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        acc.gross += r.qty * r.initial_price;
        acc.fee += Number(r.deduction_fee || 0);
        acc.net += Number(r.net_profit || 0);
        acc.qty += r.qty;
        return acc;
      },
      { gross: 0, fee: 0, net: 0, qty: 0 }
    );
  }, [filteredRows]);

  async function onDeleteOrder(g: Group) {
    if (!confirm(`Hapus seluruh transaksi (${g.rows.length} baris)?`)) return;
    start(async () => {
      const res = await deleteOrder(g.order_id);
      if ((res as any)?.error) toast((res as any).error, "error");
      else toast("Transaksi dihapus", "success");
    });
  }
  async function onDeleteRow(r: Row) {
    if (!confirm("Hapus baris ini?")) return;
    start(async () => {
      const res = await deleteTransaction(r.id);
      if ((res as any)?.error) toast((res as any).error, "error");
      else toast("Baris dihapus", "success");
    });
  }
  async function onSubmitEdit(form: HTMLFormElement) {
    if (!editing) return;
    const fd = new FormData(form);
    start(async () => {
      const res = await updateTransaction(editing.id, fd);
      if ((res as any)?.error) toast((res as any).error, "error");
      else { toast("Tersimpan", "success"); setEditing(null); }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Transaksi</h1>
        <button className="btn-primary" onClick={() => setOpenCreate(true)}>
          <Plus size={16} /> Tambah Transaksi
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <Filter size={16} /> Filter
          {hasActiveFilter && (
            <button onClick={clearFilter} className="ml-auto btn-ghost text-xs">
              <X size={14} /> Reset
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
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
                placeholder="Semua"
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
              placeholder="Semua"
              clearable
            />
          </div>
          <div>
            <label className="label">Varian</label>
            <Combobox
              options={variants.map((v) => ({ value: v.id, label: v.name, hint: formatIDR(v.base_price) }))}
              value={filter.variant}
              onChange={(v) => setParam("variant", v)}
              placeholder="Semua"
              clearable
            />
          </div>
          <div>
            <label className="label">Cari</label>
            <input
              type="text"
              className="input"
              placeholder="produk / outlet..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") setParam("q", search); }}
              onBlur={() => { if (search !== filter.q) setParam("q", search); }}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-outline" onClick={() => setRangePreset("today")}>Hari ini</button>
          <button className="btn-outline" onClick={() => setRangePreset("7d")}>7 Hari</button>
          <button className="btn-outline" onClick={() => setRangePreset("30d")}>30 Hari</button>
          <button className="btn-outline" onClick={() => setRangePreset("ytd")}>YTD</button>
        </div>
      </div>

      {/* SUMMARY */}
      {fromInvalid && (
        <div className="card p-3 flex items-center gap-2 text-sm">
          <AlertCircle size={16} className="text-amber-600" />
          <span>Tanggal "Dari" lebih besar dari "Sampai" — sistem otomatis menukar untuk query.</span>
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat title="Transaksi" value={`${groups.length} order`} sub={`${filteredRows.length} baris`} />
        <Stat title="Total Omset" value={formatIDR(totals.gross)} />
        <Stat title="Total Komisi" value={formatIDR(totals.fee)} />
        <Stat title="Net Profit" value={formatIDR(totals.net)} accent />
      </div>

      <div className="space-y-3">
        {groups.map((g) => {
          const theme = getMerchantTheme(g.merchant, g.merchantColor);
          return (
          <div
            key={g.order_id}
            className="card p-3 sm:p-4 border-l-4"
            style={{ borderLeftColor: theme.bg }}
          >
            <div className="flex flex-col gap-2 mb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="text-base sm:text-lg font-bold leading-tight truncate">{g.outlet}</div>
                  <div className="text-xs sm:text-sm flex flex-wrap items-center gap-x-2 gap-y-1" style={{ color: "var(--muted)" }}>
                    <span>{isoToWIBDisplay(g.date)}</span>
                    <MerchantBadge name={g.merchant} color={g.merchantColor} solid />
                    {g.rows.length > 1 && <span className="badge">{g.rows.length} item</span>}
                  </div>
                </div>
                <button className="btn-ghost text-red-600 shrink-0" onClick={() => onDeleteOrder(g)} title="Hapus seluruh transaksi">
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
                <span style={{ color: "var(--muted)" }}>Omset: <b>{formatIDR(g.gross)}</b></span>
                <span style={{ color: "var(--muted)" }}>Komisi: <b>{formatIDR(g.fee)}</b></span>
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Net: {formatIDR(g.net)}</span>
              </div>
            </div>
            {/* Mobile: list ringkas */}
            <div className="sm:hidden space-y-2">
              {g.rows.map((r) => (
                <div key={r.id} className="rounded-md border p-2.5 flex items-start justify-between gap-2"
                     style={{ borderColor: "var(--border)" }}>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{r.product_variants?.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                      {r.qty} × {formatIDR(r.initial_price)} = <b>{formatIDR(r.qty * r.initial_price)}</b>
                    </div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>
                      Komisi: {formatIDR(r.deduction_fee)} · Net: <b className="text-emerald-700 dark:text-emerald-400">{formatIDR(r.net_profit)}</b>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button className="btn-ghost py-1 px-2" onClick={() => setEditing(r)} aria-label="Edit baris">
                      <Pencil size={14} />
                    </button>
                    <button className="btn-ghost text-red-600 py-1 px-2" onClick={() => onDeleteRow(r)} aria-label="Hapus baris">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: tabel */}
            <div className="hidden sm:block overflow-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Harga</th>
                    <th className="text-right">Subtotal</th>
                    <th className="text-right">Komisi (proporsional)</th>
                    <th className="text-right">Net</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.product_variants?.name}</td>
                      <td className="text-right">{r.qty}</td>
                      <td className="text-right">{formatIDR(r.initial_price)}</td>
                      <td className="text-right">{formatIDR(r.qty * r.initial_price)}</td>
                      <td className="text-right">{formatIDR(r.deduction_fee)}</td>
                      <td className="text-right font-medium">{formatIDR(r.net_profit)}</td>
                      <td className="text-right whitespace-nowrap">
                        <button className="btn-ghost" onClick={() => setEditing(r)} title="Edit baris">
                          <Pencil size={14} />
                        </button>
                        <button className="btn-ghost text-red-600" onClick={() => onDeleteRow(r)} title="Hapus baris">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          );
        })}
        {!groups.length && (
          <div className="card p-6 text-center" style={{ color: "var(--muted)" }}>Belum ada transaksi.</div>
        )}
      </div>

      <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="Tambah Transaksi">
        <CreateOrderForm
          role={role}
          myOutletId={myOutletId}
          outlets={outlets}
          merchants={merchants}
          variants={variants}
          onDone={() => setOpenCreate(false)}
        />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Baris Transaksi">
        {editing && (
          <EditRowForm
            role={role}
            myOutletId={myOutletId}
            outlets={outlets}
            merchants={merchants}
            variants={variants}
            row={editing}
            onSubmit={onSubmitEdit}
            pending={pending}
          />
        )}
      </Modal>
    </div>
  );
}

/* ============================================================
 * Create form: multi-varian dengan 1 nominal komisi
 * ============================================================ */

type Item = {
  key: number;
  product_variant_id: string;
  qty: number;
  initial_price: number;
};

function CreateOrderForm({
  role, myOutletId, outlets, merchants, variants, onDone
}: {
  role: "super_admin" | "kasir";
  myOutletId: string | null;
  outlets: Option[]; merchants: Option[]; variants: Variant[];
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [outletId, setOutletId] = useState<string>(role === "kasir" ? (myOutletId ?? "") : "");
  const [merchantId, setMerchantId] = useState<string>("");
  const [date, setDate] = useState<string>(() => isoToWIBLocalInput(new Date().toISOString()));
  const [fee, setFee] = useState<number>(0);
  const [items, setItems] = useState<Item[]>([
    { key: 1, product_variant_id: "", qty: 1, initial_price: 0 }
  ]);

  function setItem(i: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }
  function addItem() {
    setItems((p) => [...p, { key: Date.now(), product_variant_id: "", qty: 1, initial_price: 0 }]);
  }
  function removeItem(i: number) {
    setItems((p) => p.length === 1 ? p : p.filter((_, idx) => idx !== i));
  }
  function onVariantChange(i: number, id: string) {
    const v = variants.find((x) => x.id === id);
    setItem(i, { product_variant_id: id, initial_price: v?.base_price ?? 0 });
  }

  const totals = useMemo(() => {
    const gross = items.reduce((a, it) => a + it.qty * it.initial_price, 0);
    return { gross, net: gross - fee };
  }, [items, fee]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) return toast("Outlet wajib dipilih", "error");
    if (!merchantId) return toast("Merchant wajib dipilih", "error");
    for (const it of items) {
      if (!it.product_variant_id) return toast("Varian wajib diisi pada semua baris", "error");
      if (it.qty < 1) return toast("Qty harus minimal 1", "error");
      if (it.initial_price < 0) return toast("Harga tidak valid", "error");
    }
    start(async () => {
      const res = await createOrder({
        outlet_id: outletId,
        food_merchant_id: merchantId,
        transaction_date: date,
        deduction_fee: fee,
        items: items.map((it) => ({
          product_variant_id: it.product_variant_id,
          qty: it.qty,
          initial_price: it.initial_price
        }))
      });
      if ((res as any)?.error) toast((res as any).error, "error");
      else { toast("Transaksi tersimpan", "success"); onDone(); }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-md border p-3"
        style={{ borderColor: "var(--border)", backgroundColor: "color-mix(in oklab, var(--bg) 55%, var(--card))" }}
      >
        <div className="sm:col-span-2">
          <label className="label">Outlet</label>
          {role === "kasir" ? (
            <input className="input" disabled
                   value={outlets.find((o) => o.id === myOutletId)?.name ?? "(belum diassign)"} />
          ) : (
            <select className="input" value={outletId}
                    onChange={(e) => setOutletId(e.target.value)} required>
              <option value="">-- pilih outlet --</option>
              {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
        </div>
        <div>
          <label className="label">Food Merchant</label>
          <select className="input" value={merchantId}
                  onChange={(e) => setMerchantId(e.target.value)} required>
            <option value="">-- pilih --</option>
            {merchants.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tanggal/Waktu</label>
          <input className="input" type="datetime-local" required
                 value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div
        className="rounded-md border p-3"
        style={{ borderColor: "var(--border)", backgroundColor: "color-mix(in oklab, var(--bg) 55%, var(--card))" }}
      >
        <div className="flex items-center justify-between mb-1">
          <label className="label">Item Transaksi</label>
          <button type="button" className="btn-outline" onClick={addItem}>
            <Plus size={14} /> Tambah Varian
          </button>
        </div>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={it.key} className="grid grid-cols-12 gap-2 items-end rounded-md border p-2"
                 style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
              <div className="col-span-12 sm:col-span-6">
                <label className="text-xs" style={{ color: "var(--muted)" }}>Varian</label>
                <Combobox
                  options={variants.map((v) => ({ value: v.id, label: v.name, hint: formatIDR(v.base_price) }))}
                  value={it.product_variant_id}
                  onChange={(v) => onVariantChange(i, v)}
                  placeholder="-- pilih --"
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <label className="text-xs" style={{ color: "var(--muted)" }}>Qty</label>
                <input className="input" type="number" min={1} step={1} value={it.qty}
                       onChange={(e) => setItem(i, { qty: Number(e.target.value) })} required />
              </div>
              <div className="col-span-7 sm:col-span-3">
                <label className="text-xs" style={{ color: "var(--muted)" }}>Harga</label>
                <input className="input" type="number" min={0} step={1} value={it.initial_price}
                       onChange={(e) => setItem(i, { initial_price: Number(e.target.value) })} required />
              </div>
              <div className="col-span-1 flex justify-end">
                <button type="button" className="btn-ghost text-red-600"
                        onClick={() => removeItem(i)}
                        disabled={items.length === 1}
                        title="Hapus baris">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-md border p-3"
        style={{ borderColor: "var(--border)", backgroundColor: "color-mix(in oklab, var(--bg) 55%, var(--card))" }}
      >
        <div>
          <label className="label">Total Komisi (1 transaksi)</label>
          <input className="input" type="number" min={0} step={1} value={fee}
                 onChange={(e) => setFee(Number(e.target.value))} required />
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Akan dibagi proporsional ke setiap varian sesuai omset.
          </p>
        </div>
        <div className="text-left sm:text-right space-y-1">
          <div className="text-sm" style={{ color: "var(--muted)" }}>Total Omset</div>
          <div className="text-base sm:text-lg font-semibold">{formatIDR(totals.gross)}</div>
          <div className="text-sm" style={{ color: "var(--muted)" }}>Estimasi Net Profit</div>
          <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{formatIDR(totals.net)}</div>
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Menyimpan..." : "Simpan Transaksi"}
        </button>
      </div>
    </form>
  );
}

/* ============================================================
 * Edit baris (single row) — komisi per baris bisa diubah manual
 * ============================================================ */
function EditRowForm({
  role, myOutletId, outlets, merchants, variants, row, onSubmit, pending
}: {
  role: "super_admin" | "kasir";
  myOutletId: string | null;
  outlets: Option[]; merchants: Option[]; variants: Variant[];
  row: Row;
  onSubmit: (f: HTMLFormElement) => void;
  pending: boolean;
}) {
  const [variantId, setVariantId] = useState(row.product_variant_id);
  return (
    <form
      className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-md border p-3"
      style={{ borderColor: "var(--border)", backgroundColor: "color-mix(in oklab, var(--bg) 55%, var(--card))" }}
      onSubmit={(e) => { e.preventDefault(); onSubmit(e.currentTarget); }}
    >
      <div className="sm:col-span-2">
        <label className="label">Outlet</label>
        {role === "kasir" ? (
          <>
            <input className="input" disabled
                   value={outlets.find((o) => o.id === myOutletId)?.name ?? ""} />
            <input type="hidden" name="outlet_id" value={myOutletId ?? ""} />
          </>
        ) : (
          <select className="input" name="outlet_id" defaultValue={row.outlet_id} required>
            {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
      </div>
      <div>
        <label className="label">Food Merchant</label>
        <select className="input" name="food_merchant_id" defaultValue={row.food_merchant_id} required>
          {merchants.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Tanggal/Waktu</label>
        <input className="input" name="transaction_date" type="datetime-local"
               defaultValue={isoToWIBLocalInput(row.transaction_date)} required />
      </div>
      <div>
        <label className="label">Varian</label>
        <Combobox
          options={variants.map((v) => ({ value: v.id, label: v.name, hint: formatIDR(v.base_price) }))}
          value={variantId}
          onChange={setVariantId}
          placeholder="-- pilih --"
        />
        <input type="hidden" name="product_variant_id" value={variantId} />
      </div>
      <div>
        <label className="label">Qty</label>
        <input className="input" name="qty" type="number" min={1} step={1}
               defaultValue={row.qty} required />
      </div>
      <div>
        <label className="label">Harga</label>
        <input className="input" name="initial_price" type="number" min={0} step={1}
               defaultValue={row.initial_price} required />
      </div>
      <div>
        <label className="label">Komisi (untuk baris ini)</label>
        <input className="input" name="deduction_fee" type="number" min={0} step={1}
               defaultValue={row.deduction_fee} required />
      </div>
      <div className="sm:col-span-2 flex justify-end pt-1">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </form>
  );
}

function Stat({ title, value, sub, accent }: { title: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`card p-3 ${accent ? "ring-2 ring-red-200 dark:ring-red-900/40" : ""}`}>
      <div className="text-[10px] sm:text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>{title}</div>
      <div className={`mt-1 text-base sm:text-lg font-bold leading-tight break-words ${accent ? "text-red-700 dark:text-red-300" : ""}`}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{sub}</div>}
    </div>
  );
}
