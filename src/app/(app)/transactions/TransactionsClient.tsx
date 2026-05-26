"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { formatIDR } from "@/lib/utils";
import { toast } from "@/components/Toast";
import { Plus, Trash2, Pencil, Filter, X, AlertCircle } from "lucide-react";
import { createOrder, updateOrder, deleteOrder } from "./actions";
import { MerchantBadge } from "@/components/MerchantBadge";
import { getMerchantTheme } from "@/lib/merchantColors";
import { Combobox } from "@/components/ui/Combobox";
import {
  isoToWIBDisplay, isoToWIBLocalInput, todayWIBKey, daysAgoWIBKey, startOfYearWIBKey
} from "@/lib/date";

type Option = { id: string; name: string };
type Merchant = Option & { color?: string | null };
type VariantPrice = { food_merchant_id: string; price: number };
type Variant = Option & { base_price: number; product_variant_prices?: VariantPrice[] | null };
type Row = {
  id: string;
  order_id: string | null;
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

type Group = {
  order_id: string;
  orderNumber: string | null;
  date: string;
  outlet: string;
  merchant: string;
  merchantColor: string | null;
  rows: Row[];
  gross: number;
  fee: number;
  net: number;
};
type TransactionDatePreset = "today" | "7d" | "30d" | "ytd";
const TRANSACTIONS_FILTER_STORAGE_KEY = "transactions-filters";
const INITIAL_VISIBLE_GROUPS = 12;
const GROUPS_PER_LOAD = 12;

export function TransactionsClient({
  role, myOutletId, outlets, merchants, variants, rows, filter
}: {
  role: "super_admin" | "kasir";
  myOutletId: string | null;
  outlets: Option[];
  merchants: Merchant[];
  variants: Variant[];
  rows: Row[];
  filter: { from: string; to: string; outlet: string; merchant: string; variant: string; q: string; rangeWasReversed?: boolean };
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const skipNextFilterSave = useRef(false);
  const addTransactionButtonRef = useRef<HTMLButtonElement>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Group | null>(null);
  const [deletePending, startDelete] = useTransition();
  const [deletingOrder, setDeletingOrder] = useState<Group | null>(null);
  const [search, setSearch] = useState(filter.q);
  const [visibleGroupCount, setVisibleGroupCount] = useState(INITIAL_VISIBLE_GROUPS);
  const [showFloatingFilter, setShowFloatingFilter] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hasUrlFilter = sp.toString().length > 0;
    const saved = localStorage.getItem(TRANSACTIONS_FILTER_STORAGE_KEY);
    if (!hasUrlFilter && saved) {
      try {
        const savedFilter = JSON.parse(saved) as Record<string, string>;
        if (isLegacyTodayOnlyFilter(savedFilter)) {
          localStorage.removeItem(TRANSACTIONS_FILTER_STORAGE_KEY);
          return;
        }
        const params = new URLSearchParams(savedFilter);
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
  function getPresetRange(preset: TransactionDatePreset) {
    if (preset === "today") return { from: todayWIBKey(), to: todayWIBKey() };
    if (preset === "7d") return { from: daysAgoWIBKey(6), to: todayWIBKey() };
    if (preset === "30d") return { from: daysAgoWIBKey(29), to: todayWIBKey() };
    return { from: startOfYearWIBKey(), to: todayWIBKey() };
  }

  function isPresetActive(preset: TransactionDatePreset) {
    const range = getPresetRange(preset);
    return filter.from === range.from && filter.to === range.to;
  }

  function setRangePreset(preset: TransactionDatePreset) {
    const next = new URLSearchParams(sp.toString());
    const range = getPresetRange(preset);
    next.set("from", range.from);
    next.set("to", range.to);
    router.push(`/transactions?${next.toString()}`);
  }
  function clearFilter() {
    localStorage.removeItem(TRANSACTIONS_FILTER_STORAGE_KEY);
    router.push("/transactions");
    setSearch("");
  }

  const hasActiveFilter =
    filter.from !== daysAgoWIBKey(6) ||
    filter.to !== todayWIBKey() ||
    !!filter.outlet ||
    !!filter.merchant ||
    !!filter.variant ||
    !!filter.q;

  const filteredRows = useMemo(() => {
    if (!filter.q) return rows;
    const needle = filter.q.toLowerCase();
    return rows.filter((r) =>
      (r.order_number ?? "").toLowerCase().includes(needle) ||
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
        orderNumber: r.order_number ?? null,
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

  useEffect(() => {
    setVisibleGroupCount(INITIAL_VISIBLE_GROUPS);
  }, [filter.from, filter.to, filter.outlet, filter.merchant, filter.variant, filter.q]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || visibleGroupCount >= groups.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleGroupCount((current) => Math.min(current + GROUPS_PER_LOAD, groups.length));
        }
      },
      { rootMargin: "320px 0px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [groups.length, visibleGroupCount]);

  useEffect(() => {
    function onScroll() {
      setShowFloatingFilter(window.scrollY > 520);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const visibleGroups = useMemo(
    () => groups.slice(0, visibleGroupCount),
    [groups, visibleGroupCount]
  );

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

  async function onConfirmDeleteOrder() {
    if (!deletingOrder) return;
    startDelete(async () => {
      const res = await deleteOrder(deletingOrder.order_id);
      if ((res as any)?.error) toast((res as any).error, "error");
      else {
        toast("Transaksi dihapus", "success");
        setDeletingOrder(null);
      }
    });
  }
  function closeCreateModalAndFocusAddButton() {
    setOpenCreate(false);
    requestAnimationFrame(() => {
      addTransactionButtonRef.current?.focus();
    });
  }
  function scrollToFilterBar() {
    filterBarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Transaksi</h1>
        <button ref={addTransactionButtonRef} className="btn-primary" onClick={() => setOpenCreate(true)}>
          <Plus size={16} /> Tambah Transaksi
        </button>
      </div>

      {/* FILTER BAR */}
      <div ref={filterBarRef} className="card p-4 space-y-3 scroll-mt-4">
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
              options={variants.map((v) => ({ value: v.id, label: v.name, hint: getVariantHint(v, filter.merchant) }))}
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
              placeholder="no. pesanan / produk / outlet..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") setParam("q", search); }}
              onBlur={() => { if (search !== filter.q) setParam("q", search); }}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <DatePresetButton active={isPresetActive("today")} onClick={() => setRangePreset("today")}>Hari ini</DatePresetButton>
          <DatePresetButton active={isPresetActive("7d")} onClick={() => setRangePreset("7d")}>7 Hari</DatePresetButton>
          <DatePresetButton active={isPresetActive("30d")} onClick={() => setRangePreset("30d")}>30 Hari</DatePresetButton>
          <DatePresetButton active={isPresetActive("ytd")} onClick={() => setRangePreset("ytd")}>YTD</DatePresetButton>
        </div>
      </div>

      {/* SUMMARY */}
      {filter.rangeWasReversed && (
        <div className="card p-3 flex items-center gap-2 text-sm">
          <AlertCircle size={16} className="text-amber-600" />
          <span>Tanggal "Dari" lebih besar dari "Sampai"; sistem otomatis menukar untuk query.</span>
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat title="Transaksi" value={`${groups.length} order`} sub={`${filteredRows.length} baris`} tone="indigo" />
        <Stat title="Total Omset" value={formatIDR(totals.gross)} tone="sky" />
        <Stat title="Potongan/Komisi" value={formatIDR(totals.fee)} sub={formatPercent(feePercent(totals.fee, totals.gross))} tone="amber" />
        <Stat title="Net Profit" value={formatIDR(totals.net)} tone="emerald" />
      </div>

      <div className="space-y-3">
        {visibleGroups.map((g) => {
          const theme = getMerchantTheme(g.merchant, g.merchantColor);
          return (
          <div
            key={g.order_id}
            className="card relative overflow-hidden p-3 sm:p-4"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--card)",
              boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)"
            }}
          >
            <div
              className="pointer-events-none absolute inset-y-0 left-0 w-2"
              style={{ backgroundColor: theme.bg }}
            />
            <div
              className="flex flex-col gap-2 mb-3 rounded-md border px-3 py-2.5"
              style={{ borderColor: theme.ring, backgroundColor: `color-mix(in srgb, ${theme.bg} 5%, var(--card))` }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="text-base sm:text-lg font-bold leading-tight truncate text-slate-950 dark:text-white">{g.outlet}</div>
                  <div className="text-xs sm:text-sm flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-700 dark:text-slate-300">
                    <span>{isoToWIBDisplay(g.date)}</span>
                    {g.orderNumber && <span className="badge">No. {g.orderNumber}</span>}
                    <MerchantBadge name={g.merchant} color={g.merchantColor} solid />
                    {g.rows.length > 1 && <span className="badge">{g.rows.length} item</span>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button className="btn-ghost" onClick={() => setEditingOrder(g)} title="Edit transaksi">
                    <Pencil size={16} />
                  </button>
                  <button className="btn-ghost text-red-600" onClick={() => setDeletingOrder(g)} title="Hapus transaksi">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
                <span className="text-slate-700 dark:text-slate-300">Omset: <b className="font-bold text-slate-950 dark:text-white">{formatIDR(g.gross)}</b></span>
                <span className="text-slate-700 dark:text-slate-300">
                  Potongan/Komisi: <b className="font-bold text-slate-950 dark:text-white">{formatIDR(g.fee)}</b> ({formatPercent(feePercent(g.fee, g.gross))})
                </span>
                <span className="font-bold text-emerald-700 dark:text-emerald-300">Net: {formatIDR(g.net)}</span>
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
                      Potongan/Komisi: {formatIDR(r.deduction_fee)} ({formatPercent(feePercent(r.deduction_fee, r.qty * r.initial_price))}) · Net: <b className="text-emerald-700 dark:text-emerald-400">{formatIDR(r.net_profit)}</b>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: tabel */}
            <div className="hidden sm:block overflow-auto rounded-md border" style={{ borderColor: "var(--border)" }}>
              <table className="table">
                <colgroup>
                  <col />
                  <col className="w-16" />
                  <col className="w-36" />
                  <col className="w-36" />
                  <col className="w-48" />
                  <col className="w-36" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Harga</th>
                    <th className="text-right">Subtotal</th>
                    <th className="text-right">Potongan/Komisi</th>
                    <th className="text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium text-slate-950 dark:text-white">{r.product_variants?.name}</td>
                      <td className="text-right text-slate-950 dark:text-white">{r.qty}</td>
                      <td className="text-right text-slate-950 dark:text-white">{formatIDR(r.initial_price)}</td>
                      <td className="text-right text-slate-950 dark:text-white">{formatIDR(r.qty * r.initial_price)}</td>
                      <td className="text-right">
                        <div className="text-slate-950 dark:text-white">{formatIDR(r.deduction_fee)}</div>
                        <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          {formatPercent(feePercent(r.deduction_fee, r.qty * r.initial_price))}
                        </div>
                      </td>
                      <td className="text-right font-extrabold text-slate-950 dark:text-white">{formatIDR(r.net_profit)}</td>
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
        {groups.length > visibleGroups.length && (
          <div ref={loadMoreRef} className="py-4 text-center text-sm" style={{ color: "var(--muted)" }}>
            Memuat transaksi berikutnya...
          </div>
        )}
      </div>

      <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="Tambah Transaksi" size="xl">
        <CreateOrderForm
          role={role}
          myOutletId={myOutletId}
          outlets={outlets}
          merchants={merchants}
          variants={variants}
          onDone={closeCreateModalAndFocusAddButton}
        />
      </Modal>

      <Modal open={!!editingOrder} onClose={() => setEditingOrder(null)} title="Edit Transaksi" size="xl">
        {editingOrder && (
          <EditOrderForm
            role={role}
            myOutletId={myOutletId}
            outlets={outlets}
            merchants={merchants}
            variants={variants}
            group={editingOrder}
            onDone={() => setEditingOrder(null)}
          />
        )}
      </Modal>

      <Modal open={!!deletingOrder} onClose={() => { if (!deletePending) setDeletingOrder(null); }} title="Hapus Transaksi" size="md">
        {deletingOrder && (
          <div className="space-y-4">
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
              <div className="flex items-start gap-2">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <div className="font-semibold">Transaksi ini akan dihapus permanen.</div>
                  <div className="text-sm text-red-700 dark:text-red-300">
                    Semua item dalam card ini ikut terhapus dan tidak bisa dikembalikan dari aplikasi.
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-md border p-3 text-sm" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <div style={{ color: "var(--muted)" }}>Outlet</div>
                <div className="text-right font-medium">{deletingOrder.outlet || "-"}</div>
                <div style={{ color: "var(--muted)" }}>Merchant</div>
                <div className="text-right font-medium">{deletingOrder.merchant || "-"}</div>
                <div style={{ color: "var(--muted)" }}>No. Pesanan</div>
                <div className="text-right font-medium">{deletingOrder.orderNumber || "-"}</div>
                <div style={{ color: "var(--muted)" }}>Item</div>
                <div className="text-right font-medium">{deletingOrder.rows.length} baris</div>
                <div style={{ color: "var(--muted)" }}>Net</div>
                <div className="text-right font-bold">{formatIDR(deletingOrder.net)}</div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="btn-outline" onClick={() => setDeletingOrder(null)} disabled={deletePending}>
                Batal
              </button>
              <button type="button" className="btn-primary bg-red-700 hover:bg-red-800" onClick={onConfirmDeleteOrder} disabled={deletePending}>
                {deletePending ? "Menghapus..." : "Hapus Transaksi"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {showFloatingFilter && (
        <button
          type="button"
          className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-lg transition hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-900"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--fg)" }}
          onClick={scrollToFilterBar}
        >
          <Filter size={16} />
          Filter
        </button>
      )}
    </div>
  );
}

/* ============================================================
 * Create form: multi-varian dengan 1 nominal pendapatan bersih
 * ============================================================ */

type Item = {
  key: number;
  id?: string;
  product_variant_id: string;
  qty: number;
  initial_price: string;
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatNumberInput(value: string | number) {
  const digits = onlyDigits(String(value));
  return digits ? Number(digits).toLocaleString("id-ID") : "";
}

function parseNumberInput(value: string) {
  const digits = onlyDigits(value);
  return digits ? Number(digits) : 0;
}

function formatPercent(value: number) {
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`;
}

function feePercent(fee: number, gross: number) {
  return gross > 0 ? (fee / gross) * 100 : 0;
}

function getMerchantVariantPrice(variants: Variant[], variantId: string, merchantId: string) {
  const variant = variants.find((item) => item.id === variantId);
  if (!variant) return 0;
  const merchantPrice = variant.product_variant_prices?.find((price) => price.food_merchant_id === merchantId);
  return Number(merchantPrice?.price ?? variant.base_price);
}

function getVariantHint(variant: Variant, merchantId: string) {
  const merchantPrice = variant.product_variant_prices?.find((price) => price.food_merchant_id === merchantId);
  const price = Number(merchantPrice?.price ?? variant.base_price);
  return merchantPrice ? formatIDR(price) : `${formatIDR(price)} default`;
}

function CurrencyInput({
  value,
  onChange,
  required = false
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div
      className="flex h-10 w-full overflow-hidden rounded-md border focus-within:border-brand focus-within:ring-2 focus-within:ring-red-100 dark:focus-within:ring-red-900/30"
      style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--fg)" }}
    >
      <span className="flex items-center border-r px-3 text-sm font-medium shrink-0" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
        Rp
      </span>
      <input
        className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm tabular-nums outline-none"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(formatNumberInput(e.target.value))}
        required={required}
      />
    </div>
  );
}

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
  const [orderNumber, setOrderNumber] = useState("");
  const [merchantId, setMerchantId] = useState<string>("");
  const [date, setDate] = useState<string>(() => isoToWIBLocalInput(new Date().toISOString()));
  const [netIncome, setNetIncome] = useState<string>("");
  const [items, setItems] = useState<Item[]>([
    { key: 1, product_variant_id: "", qty: 1, initial_price: "" }
  ]);

  function setItem(i: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }
  function addItem() {
    setItems((p) => [...p, { key: Date.now(), product_variant_id: "", qty: 1, initial_price: "" }]);
  }
  function removeItem(i: number) {
    setItems((p) => p.length === 1 ? p : p.filter((_, idx) => idx !== i));
  }
  function onMerchantChange(id: string) {
    setMerchantId(id);
    setItems((current) => current.map((item) => {
      if (!item.product_variant_id) return item;
      return {
        ...item,
        initial_price: formatNumberInput(getMerchantVariantPrice(variants, item.product_variant_id, id))
      };
    }));
  }
  function onVariantChange(i: number, id: string) {
    const price = id ? getMerchantVariantPrice(variants, id, merchantId) : 0;
    setItem(i, { product_variant_id: id, initial_price: id ? formatNumberInput(price) : "" });
  }

  const totals = useMemo(() => {
    const gross = items.reduce((a, it) => a + it.qty * parseNumberInput(it.initial_price), 0);
    const net = parseNumberInput(netIncome);
    const fee = Math.max(gross - net, 0);
    return { gross, net, fee, feePercent: feePercent(fee, gross), isNetTooHigh: net > gross };
  }, [items, netIncome]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) return toast("Outlet wajib dipilih", "error");
    if (!merchantId) return toast("Merchant wajib dipilih", "error");
    for (const it of items) {
      if (!it.product_variant_id) return toast("Varian wajib diisi pada semua baris", "error");
      if (it.qty < 1) return toast("Qty harus minimal 1", "error");
      if (parseNumberInput(it.initial_price) < 0) return toast("Harga tidak valid", "error");
    }
    const netValue = parseNumberInput(netIncome);
    const grossValue = items.reduce((a, it) => a + it.qty * parseNumberInput(it.initial_price), 0);
    if (netValue > grossValue) return toast("Pendapatan bersih tidak boleh lebih besar dari total omset", "error");
    const feeValue = grossValue - netValue;
    start(async () => {
      const res = await createOrder({
        outlet_id: outletId,
        order_number: orderNumber,
        food_merchant_id: merchantId,
        transaction_date: date,
        deduction_fee: feeValue,
        items: items.map((it) => ({
          product_variant_id: it.product_variant_id,
          qty: it.qty,
          initial_price: parseNumberInput(it.initial_price)
        }))
      });
      if ((res as any)?.error) toast((res as any).error, "error");
      else { toast("Transaksi tersimpan", "success"); onDone(); }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div
        className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-md border p-3 min-w-0"
        style={{ borderColor: "var(--border)", backgroundColor: "color-mix(in oklab, var(--bg) 55%, var(--card))" }}
      >
        <div className="md:col-span-3 min-w-0">
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
          <label className="label">Nomor Pesanan</label>
          <input
            className="input"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="Opsional"
            maxLength={80}
          />
        </div>
        <div className="min-w-0">
          <label className="label">Food Merchant</label>
          <select className="input" value={merchantId}
                  onChange={(e) => onMerchantChange(e.target.value)} required>
            <option value="">-- pilih --</option>
            {merchants.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label className="label">Tanggal/Waktu</label>
          <input className="input" type="datetime-local" required
                 value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div
        className="rounded-md border p-3 min-w-0"
        style={{ borderColor: "var(--border)", backgroundColor: "color-mix(in oklab, var(--bg) 55%, var(--card))" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <label className="label">Item Transaksi</label>
          <button type="button" className="btn-outline w-full sm:w-auto" onClick={addItem}>
            <Plus size={14} /> Tambah Varian
          </button>
        </div>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={it.key} className="relative grid grid-cols-1 sm:grid-cols-12 gap-2 items-end rounded-md border p-2.5 min-w-0"
                 style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
              <div className="min-w-0 pr-11 sm:col-span-12 md:col-span-5 md:pr-0">
                <label className="text-xs" style={{ color: "var(--muted)" }}>Varian</label>
                <Combobox
                  options={variants.map((v) => ({ value: v.id, label: v.name, hint: getVariantHint(v, merchantId) }))}
                  value={it.product_variant_id}
                  onChange={(v) => onVariantChange(i, v)}
                  placeholder="-- pilih --"
                />
              </div>
              <div className="min-w-0 sm:col-span-4 md:col-span-2">
                <label className="text-xs" style={{ color: "var(--muted)" }}>Qty</label>
                <input className="input" type="number" min={1} step={1} value={it.qty}
                       onChange={(e) => setItem(i, { qty: Number(e.target.value) })} required />
              </div>
              <div className="min-w-0 sm:col-span-8 md:col-span-4">
                <label className="text-xs" style={{ color: "var(--muted)" }}>Harga</label>
                <CurrencyInput
                  value={it.initial_price}
                  onChange={(value) => setItem(i, { initial_price: value })}
                  required
                />
              </div>
              <div className="absolute right-2 top-2 md:static md:col-span-1 md:flex md:justify-end md:pb-0.5">
                <button type="button" className="btn-ghost text-red-600 h-10 w-10 p-0"
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
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-md border p-3 min-w-0"
        style={{ borderColor: "var(--border)", backgroundColor: "color-mix(in oklab, var(--bg) 55%, var(--card))" }}
      >
        <div className="min-w-0 rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
          <label className="mb-2 block text-sm font-bold text-emerald-800 dark:text-emerald-200">Pendapatan Bersih (1 transaksi)</label>
          <CurrencyInput value={netIncome} onChange={setNetIncome} required />
          <p className="text-xs mt-1 text-emerald-700 dark:text-emerald-300">
            Potongan/komisi dihitung otomatis dari total omset dikurangi pendapatan bersih.
          </p>
        </div>
        <div className="min-w-0 text-left sm:text-right space-y-1">
          <div className="text-sm" style={{ color: "var(--muted)" }}>Total Omset</div>
          <div className="text-base sm:text-lg font-semibold">{formatIDR(totals.gross)}</div>
          <div className="text-sm" style={{ color: "var(--muted)" }}>Potongan/Komisi</div>
          <div className={`text-base sm:text-lg font-semibold ${totals.isNetTooHigh ? "text-red-700 dark:text-red-300" : ""}`}>
            {formatIDR(totals.fee)}
          </div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            {formatPercent(totals.feePercent)} dari total omset
          </div>
          <div className="text-sm" style={{ color: "var(--muted)" }}>Pendapatan Bersih</div>
          <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{formatIDR(totals.net)}</div>
          {totals.isNetTooHigh && (
            <div className="text-xs text-red-700 dark:text-red-300">
              Pendapatan bersih tidak boleh lebih besar dari total omset.
            </div>
          )}
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
 * Edit form: 1 order penuh dengan input pendapatan bersih
 * ============================================================ */
function EditOrderForm({
  role, myOutletId, outlets, merchants, variants, group, onDone
}: {
  role: "super_admin" | "kasir";
  myOutletId: string | null;
  outlets: Option[]; merchants: Option[]; variants: Variant[];
  group: Group;
  onDone: () => void;
}) {
  const firstRow = group.rows[0];
  const [pending, start] = useTransition();
  const [outletId, setOutletId] = useState<string>(role === "kasir" ? (myOutletId ?? "") : (firstRow?.outlet_id ?? ""));
  const [orderNumber, setOrderNumber] = useState(group.orderNumber ?? "");
  const [merchantId, setMerchantId] = useState<string>(firstRow?.food_merchant_id ?? "");
  const [date, setDate] = useState<string>(() => isoToWIBLocalInput(group.date));
  const [netIncome, setNetIncome] = useState<string>(() => formatNumberInput(group.net));
  const [items, setItems] = useState<Item[]>(() => group.rows.map((row, index) => ({
    key: index + 1,
    id: row.id,
    product_variant_id: row.product_variant_id,
    qty: row.qty,
    initial_price: formatNumberInput(row.initial_price)
  })));

  function setItem(i: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }
  function addItem() {
    setItems((p) => [...p, { key: Date.now(), product_variant_id: "", qty: 1, initial_price: "" }]);
  }
  function removeItem(i: number) {
    setItems((p) => p.length === 1 ? p : p.filter((_, idx) => idx !== i));
  }
  function onMerchantChange(id: string) {
    setMerchantId(id);
    setItems((current) => current.map((item) => {
      if (!item.product_variant_id) return item;
      return {
        ...item,
        initial_price: formatNumberInput(getMerchantVariantPrice(variants, item.product_variant_id, id))
      };
    }));
  }
  function onVariantChange(i: number, id: string) {
    const price = id ? getMerchantVariantPrice(variants, id, merchantId) : 0;
    setItem(i, { product_variant_id: id, initial_price: id ? formatNumberInput(price) : "" });
  }

  const totals = useMemo(() => {
    const gross = items.reduce((a, it) => a + it.qty * parseNumberInput(it.initial_price), 0);
    const net = parseNumberInput(netIncome);
    const fee = Math.max(gross - net, 0);
    return { gross, net, fee, feePercent: feePercent(fee, gross), isNetTooHigh: net > gross };
  }, [items, netIncome]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) return toast("Outlet wajib dipilih", "error");
    if (!merchantId) return toast("Merchant wajib dipilih", "error");
    for (const it of items) {
      if (!it.product_variant_id) return toast("Varian wajib diisi pada semua baris", "error");
      if (it.qty < 1) return toast("Qty harus minimal 1", "error");
      if (parseNumberInput(it.initial_price) < 0) return toast("Harga tidak valid", "error");
    }
    if (totals.isNetTooHigh) return toast("Pendapatan bersih tidak boleh lebih besar dari total omset", "error");

    start(async () => {
      const res = await updateOrder({
        order_id: group.order_id,
        outlet_id: outletId,
        order_number: orderNumber,
        food_merchant_id: merchantId,
        transaction_date: date,
        deduction_fee: totals.fee,
        items: items.map((it) => ({
          id: it.id,
          product_variant_id: it.product_variant_id,
          qty: it.qty,
          initial_price: parseNumberInput(it.initial_price)
        }))
      });
      if ((res as any)?.error) toast((res as any).error, "error");
      else { toast("Transaksi diperbarui", "success"); onDone(); }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div
        className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-md border p-3 min-w-0"
        style={{ borderColor: "var(--border)", backgroundColor: "color-mix(in oklab, var(--bg) 55%, var(--card))" }}
      >
        <div className="md:col-span-3 min-w-0">
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
          <label className="label">Nomor Pesanan</label>
          <input
            className="input"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="Opsional"
            maxLength={80}
          />
        </div>
        <div className="min-w-0">
          <label className="label">Food Merchant</label>
          <select className="input" value={merchantId}
                  onChange={(e) => onMerchantChange(e.target.value)} required>
            <option value="">-- pilih --</option>
            {merchants.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label className="label">Tanggal/Waktu</label>
          <input className="input" type="datetime-local" required
                 value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div
        className="rounded-md border p-3 min-w-0"
        style={{ borderColor: "var(--border)", backgroundColor: "color-mix(in oklab, var(--bg) 55%, var(--card))" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <label className="label">Item Transaksi</label>
          <button type="button" className="btn-outline w-full sm:w-auto" onClick={addItem}>
            <Plus size={14} /> Tambah Varian
          </button>
        </div>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={it.key} className="relative grid grid-cols-1 sm:grid-cols-12 gap-2 items-end rounded-md border p-2.5 min-w-0"
                 style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
              <div className="min-w-0 pr-11 sm:col-span-12 md:col-span-5 md:pr-0">
                <label className="text-xs" style={{ color: "var(--muted)" }}>Varian</label>
                <Combobox
                  options={variants.map((v) => ({ value: v.id, label: v.name, hint: getVariantHint(v, merchantId) }))}
                  value={it.product_variant_id}
                  onChange={(v) => onVariantChange(i, v)}
                  placeholder="-- pilih --"
                />
              </div>
              <div className="min-w-0 sm:col-span-4 md:col-span-2">
                <label className="text-xs" style={{ color: "var(--muted)" }}>Qty</label>
                <input className="input" type="number" min={1} step={1} value={it.qty}
                       onChange={(e) => setItem(i, { qty: Number(e.target.value) })} required />
              </div>
              <div className="min-w-0 sm:col-span-8 md:col-span-4">
                <label className="text-xs" style={{ color: "var(--muted)" }}>Harga</label>
                <CurrencyInput
                  value={it.initial_price}
                  onChange={(value) => setItem(i, { initial_price: value })}
                  required
                />
              </div>
              <div className="absolute right-2 top-2 md:static md:col-span-1 md:flex md:justify-end md:pb-0.5">
                <button type="button" className="btn-ghost text-red-600 h-10 w-10 p-0"
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
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-md border p-3 min-w-0"
        style={{ borderColor: "var(--border)", backgroundColor: "color-mix(in oklab, var(--bg) 55%, var(--card))" }}
      >
        <div className="min-w-0 rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
          <label className="mb-2 block text-sm font-bold text-emerald-800 dark:text-emerald-200">Pendapatan Bersih (1 transaksi)</label>
          <CurrencyInput value={netIncome} onChange={setNetIncome} required />
          <p className="text-xs mt-1 text-emerald-700 dark:text-emerald-300">
            Potongan/komisi dihitung otomatis dari total omset dikurangi pendapatan bersih.
          </p>
        </div>
        <div className="min-w-0 text-left sm:text-right space-y-1">
          <div className="text-sm" style={{ color: "var(--muted)" }}>Total Omset</div>
          <div className="text-base sm:text-lg font-semibold">{formatIDR(totals.gross)}</div>
          <div className="text-sm" style={{ color: "var(--muted)" }}>Potongan/Komisi</div>
          <div className={`text-base sm:text-lg font-semibold ${totals.isNetTooHigh ? "text-red-700 dark:text-red-300" : ""}`}>
            {formatIDR(totals.fee)}
          </div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            {formatPercent(totals.feePercent)} dari total omset
          </div>
          <div className="text-sm" style={{ color: "var(--muted)" }}>Pendapatan Bersih</div>
          <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{formatIDR(totals.net)}</div>
          {totals.isNetTooHigh && (
            <div className="text-xs text-red-700 dark:text-red-300">
              Pendapatan bersih tidak boleh lebih besar dari total omset.
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
      </div>
    </form>
  );
}

const STAT_TONES = {
  indigo: "border-indigo-500 bg-indigo-50 text-indigo-950 ring-indigo-200 dark:border-indigo-400 dark:bg-indigo-950/35 dark:text-indigo-100 dark:ring-indigo-900/50",
  sky: "border-sky-500 bg-sky-50 text-sky-950 ring-sky-200 dark:border-sky-400 dark:bg-sky-950/35 dark:text-sky-100 dark:ring-sky-900/50",
  amber: "border-amber-500 bg-amber-50 text-amber-950 ring-amber-200 dark:border-amber-400 dark:bg-amber-950/35 dark:text-amber-100 dark:ring-amber-900/50",
  emerald: "border-emerald-500 bg-emerald-50 text-emerald-950 ring-emerald-200 dark:border-emerald-400 dark:bg-emerald-950/35 dark:text-emerald-100 dark:ring-emerald-900/50"
};

const STAT_VALUE_TONES = {
  indigo: "text-indigo-900 dark:text-indigo-100",
  sky: "text-sky-900 dark:text-sky-100",
  amber: "text-amber-900 dark:text-amber-100",
  emerald: "text-emerald-900 dark:text-emerald-100"
};

const STAT_META_TONES = {
  indigo: "text-indigo-700 dark:text-indigo-200",
  sky: "text-sky-700 dark:text-sky-200",
  amber: "text-amber-700 dark:text-amber-200",
  emerald: "text-emerald-700 dark:text-emerald-200"
};

function Stat({
  title,
  value,
  sub,
  tone
}: {
  title: string;
  value: string;
  sub?: string;
  tone: keyof typeof STAT_TONES;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-l-4 p-4 shadow-sm ring-1 ${STAT_TONES[tone]}`}
    >
      <div className={`text-xs uppercase font-bold tracking-wide ${STAT_META_TONES[tone]}`}>{title}</div>
      <div className={`mt-2 text-xl sm:text-2xl font-extrabold leading-tight break-words ${STAT_VALUE_TONES[tone]}`}>
        {value}
      </div>
      {sub && <div className={`mt-1 text-sm font-semibold ${STAT_META_TONES[tone]}`}>{sub}</div>}
    </div>
  );
}

function DatePresetButton({
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
      className={`btn-outline transition-colors ${
        active
          ? "border-red-700 bg-red-700 text-white hover:bg-red-800 dark:border-red-500 dark:bg-red-600 dark:text-white dark:hover:bg-red-700"
          : ""
      }`}
      aria-pressed={active}
      onClick={onClick}
    >
      {active && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </button>
  );
}

function isLegacyTodayOnlyFilter(savedFilter: Record<string, string>) {
  return (
    savedFilter.from === todayWIBKey() &&
    savedFilter.to === todayWIBKey() &&
    !savedFilter.outlet &&
    !savedFilter.merchant &&
    !savedFilter.variant &&
    !savedFilter.q
  );
}
