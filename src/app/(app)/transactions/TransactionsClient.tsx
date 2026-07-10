"use client";
import {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { formatIDR } from "@/lib/utils";
import { toast } from "@/components/Toast";
import {
  Plus,
  Trash2,
  Pencil,
  Filter,
  X,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { createOrder, updateOrder, deleteOrder } from "./actions";
import { MerchantBadge } from "@/components/MerchantBadge";
import { getMerchantTheme } from "@/lib/merchantColors";
import { Combobox } from "@/components/ui/Combobox";
import {
  isoToWIBDisplay,
  isoToWIBLocalInput,
  todayWIBKey,
  daysAgoWIBKey,
  startOfYearWIBKey,
} from "@/lib/date";
import {
  clearScopedFilterParams,
  copyPersistentUrlParams,
  queryString,
  setScopedFilterParams,
} from "@/lib/urlParams";
import {
  EMPTY_TRANSACTION_SUMMARY,
  type TransactionGroup,
  type TransactionMerchant,
  type TransactionOption,
  type TransactionSummary,
  type TransactionVariant,
} from "./transactionData";

type Option = TransactionOption;
type Merchant = TransactionMerchant;
type Variant = TransactionVariant;
type Group = TransactionGroup;
type TransactionDatePreset = "today" | "7d" | "30d" | "ytd";
type TransactionFilter = {
  from: string;
  to: string;
  outlet: string;
  merchant: string;
  variant: string;
  q: string;
  rangeWasReversed?: boolean;
};
type TransactionFilterKey =
  | "from"
  | "to"
  | "outlet"
  | "merchant"
  | "variant"
  | "q";
const GROUPS_PER_LOAD = 12;
const VIRTUAL_CARD_STYLE = {
  contentVisibility: "auto",
  containIntrinsicSize: "240px",
} satisfies CSSProperties;

export function TransactionsClient({
  role,
  myOutletId,
  outlets,
  merchants,
  variants,
  initialGroups,
  initialNextOffset,
  initialHasMore,
  summary,
  filter,
  loadError,
}: {
  role: "super_admin" | "kasir";
  myOutletId: string | null;
  outlets: Option[];
  merchants: Merchant[];
  variants: Variant[];
  initialGroups: Group[];
  initialNextOffset: number;
  initialHasMore: boolean;
  summary: TransactionSummary;
  filter: TransactionFilter;
  loadError?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const addTransactionButtonRef = useRef<HTMLButtonElement>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Group | null>(null);
  const [filterPending, startFilterTransition] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [deletingOrder, setDeletingOrder] = useState<Group | null>(null);
  const [draftFilter, setDraftFilter] = useState<TransactionFilter>({
    from: filter.from,
    to: filter.to,
    outlet: filter.outlet,
    merchant: filter.merchant,
    variant: filter.variant,
    q: filter.q,
  });
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showFloatingFilter, setShowFloatingFilter] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Filter hidup di query string agar URL bisa dibagikan dan tidak perlu cookie.

  useEffect(() => {
    setDraftFilter({
      from: filter.from,
      to: filter.to,
      outlet: filter.outlet,
      merchant: filter.merchant,
      variant: filter.variant,
      q: filter.q,
    });
  }, [
    filter.from,
    filter.to,
    filter.outlet,
    filter.merchant,
    filter.variant,
    filter.q,
  ]);

  const buildFilterParams = useCallback((nextFilter: TransactionFilter) => {
    const next = new URLSearchParams();
    copyPersistentUrlParams(searchParams, next);
    next.set("from", nextFilter.from);
    next.set("to", nextFilter.to);
    if (nextFilter.outlet) next.set("outlet", nextFilter.outlet);
    if (nextFilter.merchant) next.set("merchant", nextFilter.merchant);
    if (nextFilter.variant) next.set("variant", nextFilter.variant);
    if (nextFilter.q) next.set("q", nextFilter.q);
    setScopedFilterParams("transactions", next, {
      from: nextFilter.from,
      to: nextFilter.to,
      outlet: nextFilter.outlet,
      merchant: nextFilter.merchant,
      variant: nextFilter.variant,
      q: nextFilter.q,
    });
    return next;
  }, [searchParams]);
  function setDraftParam(key: TransactionFilterKey, value: string) {
    setDraftFilter((current) => ({ ...current, [key]: value }));
  }
  function applyFilter(nextFilter = draftFilter) {
    const next = buildFilterParams(nextFilter);
    startFilterTransition(() =>
      router.push(`/transactions${queryString(next)}`),
    );
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
    const range = getPresetRange(preset);
    const nextFilter = { ...filter, from: range.from, to: range.to };
    setDraftFilter(nextFilter);
    applyFilter(nextFilter);
  }
  function clearFilter() {
    const next = new URLSearchParams();
    copyPersistentUrlParams(searchParams, next);
    clearScopedFilterParams("transactions", next);
    startFilterTransition(() =>
      router.push(`/transactions${queryString(next)}`),
    );
    setDraftFilter({
      from: daysAgoWIBKey(6),
      to: todayWIBKey(),
      outlet: "",
      merchant: "",
      variant: "",
      q: "",
    });
  }

  const hasActiveFilter =
    filter.from !== daysAgoWIBKey(6) ||
    filter.to !== todayWIBKey() ||
    !!filter.outlet ||
    !!filter.merchant ||
    !!filter.variant ||
    !!filter.q;
  const hasDraftChanges =
    draftFilter.from !== filter.from ||
    draftFilter.to !== filter.to ||
    draftFilter.outlet !== filter.outlet ||
    draftFilter.merchant !== filter.merchant ||
    draftFilter.variant !== filter.variant ||
    draftFilter.q !== filter.q;
  const showResetFilter = hasActiveFilter || hasDraftChanges;

  useEffect(() => {
    setGroups(initialGroups);
    setNextOffset(initialNextOffset);
    setHasMore(initialHasMore);
    setIsLoadingMore(false);
  }, [
    initialGroups,
    initialNextOffset,
    initialHasMore,
    filter.from,
    filter.to,
    filter.outlet,
    filter.merchant,
    filter.variant,
    filter.q,
  ]);

  const totals = summary ?? EMPTY_TRANSACTION_SUMMARY;

  const loadMoreOrders = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const params = buildFilterParams(filter);
    params.set("offset", String(nextOffset));
    params.set("limit", String(GROUPS_PER_LOAD));

    try {
      const response = await fetch(`/api/transactions/orders?${params}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Gagal memuat data");

      setGroups((current) => [...current, ...(payload.groups ?? [])]);
      setNextOffset(Number(payload.nextOffset ?? nextOffset));
      setHasMore(Boolean(payload.hasMore));
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Gagal memuat transaksi berikutnya",
        "error",
      );
    } finally {
      setIsLoadingMore(false);
    }
  }, [buildFilterParams, filter, hasMore, isLoadingMore, nextOffset]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMoreOrders();
        }
      },
      { rootMargin: "320px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadMoreOrders]);

  useEffect(() => {
    function onScroll() {
      setShowFloatingFilter(window.scrollY > 520);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function onConfirmDeleteOrder() {
    if (!deletingOrder) return;
    startDelete(async () => {
      const res = await deleteOrder(deletingOrder.order_id);
      if ((res as any)?.error) toast((res as any).error, "error");
      else {
        toast("Transaksi dihapus", "success");
        setDeletingOrder(null);
        router.refresh();
      }
    });
  }
  function closeCreateModalAndFocusAddButton() {
    setOpenCreate(false);
    router.refresh();
    requestAnimationFrame(() => {
      addTransactionButtonRef.current?.focus();
    });
  }
  function scrollToFilterBar() {
    filterBarRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Transaksi</h1>
        <button
          ref={addTransactionButtonRef}
          className="btn-primary"
          onClick={() => setOpenCreate(true)}
        >
          <Plus size={16} /> Tambah Transaksi
        </button>
      </div>

      {/* FILTER BAR */}
      <div ref={filterBarRef} className="card p-3 space-y-2.5 scroll-mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Filter size={16} /> Filter
            {filterPending && (
              <span
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300"
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
                onClick={clearFilter}
                className="btn-ghost h-9 px-3 text-xs sm:text-sm"
              >
                <X size={14} /> Reset
              </button>
            )}
            <button
              className="btn-primary h-9 flex-1 px-3 text-xs font-semibold shadow-sm sm:flex-none sm:text-sm"
              onClick={() => applyFilter()}
              disabled={!hasDraftChanges || filterPending}
            >
              Terapkan Filter
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div>
            <label className="label">Dari</label>
            <input
              type="date"
              className="input"
              value={draftFilter.from}
              onChange={(e) => setDraftParam("from", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Sampai</label>
            <input
              type="date"
              className="input"
              value={draftFilter.to}
              onChange={(e) => setDraftParam("to", e.target.value)}
            />
          </div>
          {role === "super_admin" && (
            <div>
              <label className="label">Outlet</label>
              <Combobox
                options={outlets.map((o) => ({ value: o.id, label: o.name }))}
                value={draftFilter.outlet}
                onChange={(v) => setDraftParam("outlet", v)}
                placeholder="Semua"
                clearable
              />
            </div>
          )}
          <div>
            <label className="label">Merchant</label>
            <Combobox
              options={merchants.map((m) => ({ value: m.id, label: m.name }))}
              value={draftFilter.merchant}
              onChange={(v) => setDraftParam("merchant", v)}
              placeholder="Semua"
              clearable
            />
          </div>
          <div>
            <label className="label">Varian</label>
            <Combobox
              options={variants.map((v) => ({
                value: v.id,
                label: v.name,
                hint: getVariantHint(v, draftFilter.merchant),
              }))}
              value={draftFilter.variant}
              onChange={(v) => setDraftParam("variant", v)}
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
              value={draftFilter.q}
              onChange={(e) => setDraftParam("q", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyFilter();
              }}
            />
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          <DatePresetButton
            active={isPresetActive("today")}
            onClick={() => setRangePreset("today")}
          >
            Hari ini
          </DatePresetButton>
          <DatePresetButton
            active={isPresetActive("7d")}
            onClick={() => setRangePreset("7d")}
          >
            7 Hari
          </DatePresetButton>
          <DatePresetButton
            active={isPresetActive("30d")}
            onClick={() => setRangePreset("30d")}
          >
            30 Hari
          </DatePresetButton>
          <DatePresetButton
            active={isPresetActive("ytd")}
            onClick={() => setRangePreset("ytd")}
          >
            YTD
          </DatePresetButton>
        </div>
      </div>

      {/* SUMMARY */}
      {filter.rangeWasReversed && (
        <div className="card p-3 flex items-center gap-2 text-sm">
          <AlertCircle size={16} className="text-amber-600" />
          <span>
            Tanggal "Dari" lebih besar dari "Sampai"; sistem otomatis menukar
            untuk query.
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat
          title="Transaksi"
          value={`${totals.orderCount.toLocaleString("id-ID")} order`}
          sub={`${totals.qty.toLocaleString("id-ID")} QTY`}
          tone="indigo"
        />
        <Stat title="Total Omset" value={formatIDR(totals.gross)} tone="sky" />
        <Stat
          title="Potongan/Komisi"
          value={formatIDR(totals.fee)}
          sub={formatPercent(feePercent(totals.fee, totals.gross))}
          tone="amber"
        />
        <Stat title="Net Profit" value={formatIDR(totals.net)} tone="emerald" />
      </div>

      <div className="space-y-3">
        {loadError && (
          <div className="card p-3 text-sm text-amber-700 dark:text-amber-300">
            {loadError}
          </div>
        )}
        {groups.map((g) => {
          const theme = getMerchantTheme(g.merchant, g.merchantColor);
          return (
            <div
              key={g.order_id}
              className="card relative overflow-hidden p-3 sm:p-4"
              style={{
                ...VIRTUAL_CARD_STYLE,
                borderColor: "var(--border)",
                backgroundColor: "var(--card)",
                boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
              }}
            >
              <div
                className="pointer-events-none absolute inset-y-0 left-0 w-2"
                style={{ backgroundColor: theme.bg }}
              />
              <div
                className="flex flex-col gap-2 mb-3 rounded-md border px-3 py-2.5"
                style={{
                  borderColor: theme.ring,
                  backgroundColor: `color-mix(in srgb, ${theme.bg} 5%, var(--card))`,
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="text-base sm:text-lg font-bold leading-tight truncate text-slate-950 dark:text-white">
                      {g.outlet}
                    </div>
                    <div className="text-xs sm:text-sm flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-700 dark:text-slate-300">
                      <span>{isoToWIBDisplay(g.date)}</span>
                      {g.orderNumber && (
                        <span className="badge">No. {g.orderNumber}</span>
                      )}
                      {g.is_fake && (
                        <span className="badge border-red-200 bg-red-100 text-red-800 dark:border-red-900/30 dark:bg-red-900/40 dark:text-red-200">
                          Fake Order
                        </span>
                      )}
                      <MerchantBadge
                        name={g.merchant}
                        color={g.merchantColor}
                        solid
                      />
                      <span className="badge">
                        {g.qty.toLocaleString("id-ID")} QTY
                      </span>
                      <span className="badge">
                        {g.rows.length.toLocaleString("id-ID")} item
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      className="btn-ghost"
                      onClick={() => setEditingOrder(g)}
                      title="Edit transaksi"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="btn-ghost text-red-600"
                      onClick={() => setDeletingOrder(g)}
                      title="Hapus transaksi"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
                  <span className="text-slate-700 dark:text-slate-300">
                    Omset:{" "}
                    <b className="font-bold text-slate-950 dark:text-white">
                      {formatIDR(g.gross)}
                    </b>
                  </span>
                  <span className="text-slate-700 dark:text-slate-300">
                    Potongan/Komisi:{" "}
                    <b className="font-bold text-slate-950 dark:text-white">
                      {formatIDR(g.fee)}
                    </b>{" "}
                    ({formatPercent(feePercent(g.fee, g.gross))})
                  </span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-300">
                    Net: {formatIDR(g.net)}
                  </span>
                  {g.is_fake && (
                    <span className="font-bold text-red-700 dark:text-red-300">
                      Pengeluaran: {formatIDR(g.company_expense)} (Uang Hangus: {formatIDR(g.company_expense - g.net)})
                    </span>
                  )}
                </div>
              </div>
              {/* Mobile: list ringkas */}
              <div className="sm:hidden space-y-2">
                {g.rows.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-md border p-2.5 flex items-start justify-between gap-2"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">
                        {r.product_variants?.name}
                      </div>
                      <div
                        className="text-xs mt-0.5"
                        style={{ color: "var(--muted)" }}
                      >
                        {r.qty} × {formatIDR(r.initial_price)} ={" "}
                        <b>{formatIDR(r.qty * r.initial_price)}</b>
                      </div>
                      <div
                        className="text-xs"
                        style={{ color: "var(--muted)" }}
                      >
                        Potongan/Komisi: {formatIDR(r.deduction_fee)} (
                        {formatPercent(
                          feePercent(r.deduction_fee, r.qty * r.initial_price),
                        )}
                        ) · Net:{" "}
                        <b className="text-emerald-700 dark:text-emerald-400">
                          {formatIDR(r.net_profit)}
                        </b>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: tabel */}
              <div
                className="hidden sm:block overflow-auto rounded-md border"
                style={{ borderColor: "var(--border)" }}
              >
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
                        <td className="font-medium text-slate-950 dark:text-white">
                          {r.product_variants?.name}
                        </td>
                        <td className="text-right text-slate-950 dark:text-white">
                          {r.qty}
                        </td>
                        <td className="text-right text-slate-950 dark:text-white">
                          {formatIDR(r.initial_price)}
                        </td>
                        <td className="text-right text-slate-950 dark:text-white">
                          {formatIDR(r.qty * r.initial_price)}
                        </td>
                        <td className="text-right">
                          <div className="text-slate-950 dark:text-white">
                            {formatIDR(r.deduction_fee)}
                          </div>
                          <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                            {formatPercent(
                              feePercent(
                                r.deduction_fee,
                                r.qty * r.initial_price,
                              ),
                            )}
                          </div>
                        </td>
                        <td className="text-right font-extrabold text-slate-950 dark:text-white">
                          {formatIDR(r.net_profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
        {!groups.length && !hasMore && (
          <div
            className="card p-6 text-center"
            style={{ color: "var(--muted)" }}
          >
            Belum ada transaksi.
          </div>
        )}
        {hasMore && (
          <div
            ref={loadMoreRef}
            className="py-4 text-center text-sm"
            style={{ color: "var(--muted)" }}
          >
            {isLoadingMore
              ? "Memuat transaksi berikutnya..."
              : "Scroll untuk memuat transaksi berikutnya"}
          </div>
        )}
      </div>

      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Tambah Transaksi"
        size="xl"
        bodyScroll={false}
      >
        <CreateOrderForm
          role={role}
          myOutletId={myOutletId}
          outlets={outlets}
          merchants={merchants}
          variants={variants}
          onDone={closeCreateModalAndFocusAddButton}
        />
      </Modal>

      <Modal
        open={!!editingOrder}
        onClose={() => setEditingOrder(null)}
        title="Edit Transaksi"
        size="xl"
      >
        {editingOrder && (
          <EditOrderForm
            role={role}
            myOutletId={myOutletId}
            outlets={outlets}
            merchants={merchants}
            variants={variants}
            group={editingOrder}
            onDone={() => {
              setEditingOrder(null);
              router.refresh();
            }}
          />
        )}
      </Modal>

      <Modal
        open={!!deletingOrder}
        onClose={() => {
          if (!deletePending) setDeletingOrder(null);
        }}
        title="Hapus Transaksi"
        size="md"
      >
        {deletingOrder && (
          <div className="space-y-4">
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
              <div className="flex items-start gap-2">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <div className="font-semibold">
                    Transaksi ini akan dihapus permanen.
                  </div>
                  <div className="text-sm text-red-700 dark:text-red-300">
                    Semua item dalam card ini ikut terhapus dan tidak bisa
                    dikembalikan dari aplikasi.
                  </div>
                </div>
              </div>
            </div>

            <div
              className="rounded-md border p-3 text-sm"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--bg)",
              }}
            >
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <div style={{ color: "var(--muted)" }}>Outlet</div>
                <div className="text-right font-medium">
                  {deletingOrder.outlet || "-"}
                </div>
                <div style={{ color: "var(--muted)" }}>Merchant</div>
                <div className="text-right font-medium">
                  {deletingOrder.merchant || "-"}
                </div>
                <div style={{ color: "var(--muted)" }}>No. Pesanan</div>
                <div className="text-right font-medium">
                  {deletingOrder.orderNumber || "-"}
                </div>
                <div style={{ color: "var(--muted)" }}>Item</div>
                <div className="text-right font-medium">
                  {deletingOrder.rows.length} baris
                </div>
                <div style={{ color: "var(--muted)" }}>Net</div>
                <div className="text-right font-bold">
                  {formatIDR(deletingOrder.net)}
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="btn-outline"
                onClick={() => setDeletingOrder(null)}
                disabled={deletePending}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn-primary bg-red-700 hover:bg-red-800"
                onClick={onConfirmDeleteOrder}
                disabled={deletePending}
              >
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
          style={{
            backgroundColor: "var(--card)",
            borderColor: "var(--border)",
            color: "var(--fg)",
          }}
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

function getMerchantVariantPrice(
  variants: Variant[],
  variantId: string,
  merchantId: string,
) {
  const variant = variants.find((item) => item.id === variantId);
  if (!variant) return 0;
  const merchantPrice = variant.product_variant_prices?.find(
    (price) => price.food_merchant_id === merchantId,
  );
  return Number(merchantPrice?.price ?? variant.base_price);
}

function getVariantHint(variant: Variant, merchantId: string) {
  const merchantPrice = variant.product_variant_prices?.find(
    (price) => price.food_merchant_id === merchantId,
  );
  const price = Number(merchantPrice?.price ?? variant.base_price);
  return merchantPrice ? formatIDR(price) : `${formatIDR(price)} default`;
}

function CurrencyInput({
  value,
  onChange,
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div
      className="flex h-10 w-full overflow-hidden rounded-md border focus-within:border-brand focus-within:ring-2 focus-within:ring-red-100 dark:focus-within:ring-red-900/30"
      style={{
        backgroundColor: "var(--bg)",
        borderColor: "var(--border)",
        color: "var(--fg)",
      }}
    >
      <span
        className="flex items-center border-r px-3 text-sm font-medium shrink-0"
        style={{ borderColor: "var(--border)", color: "var(--muted)" }}
      >
        Rp
      </span>
      <input
        className="min-w-0 flex-1 bg-transparent px-3 py-2 text-base tabular-nums outline-none sm:text-sm"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(formatNumberInput(e.target.value))}
        required={required}
      />
    </div>
  );
}

function CreateOrderForm({
  role,
  myOutletId,
  outlets,
  merchants,
  variants,
  onDone,
}: {
  role: "super_admin" | "kasir";
  myOutletId: string | null;
  outlets: Option[];
  merchants: Option[];
  variants: Variant[];
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [outletId, setOutletId] = useState<string>(
    role === "kasir" ? (myOutletId ?? "") : "",
  );
  const [orderNumber, setOrderNumber] = useState("");
  const [merchantId, setMerchantId] = useState<string>("");
  const [date, setDate] = useState<string>(() =>
    isoToWIBLocalInput(new Date().toISOString()),
  );
  const [netIncome, setNetIncome] = useState<string>("");
  const [isFake, setIsFake] = useState(false);
  const [companyExpense, setCompanyExpense] = useState<string>("");
  const [items, setItems] = useState<Item[]>([
    { key: 1, product_variant_id: "", qty: 1, initial_price: "" },
  ]);

  function setItem(i: number, patch: Partial<Item>) {
    setItems((prev) =>
      prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)),
    );
  }
  function addItem() {
    setItems((p) => [
      ...p,
      { key: Date.now(), product_variant_id: "", qty: 1, initial_price: "" },
    ]);
  }
  function removeItem(i: number) {
    setItems((p) => (p.length === 1 ? p : p.filter((_, idx) => idx !== i)));
  }
  function onMerchantChange(id: string) {
    setMerchantId(id);
    setItems((current) =>
      current.map((item) => {
        if (!item.product_variant_id) return item;
        return {
          ...item,
          initial_price: formatNumberInput(
            getMerchantVariantPrice(variants, item.product_variant_id, id),
          ),
        };
      }),
    );
  }
  function onVariantChange(i: number, id: string) {
    const price = id ? getMerchantVariantPrice(variants, id, merchantId) : 0;
    setItem(i, {
      product_variant_id: id,
      initial_price: id ? formatNumberInput(price) : "",
    });
  }

  const totals = useMemo(() => {
    const gross = items.reduce(
      (a, it) => a + it.qty * parseNumberInput(it.initial_price),
      0,
    );
    const net = parseNumberInput(netIncome);
    const fee = Math.max(gross - net, 0);
    return {
      gross,
      net,
      fee,
      feePercent: feePercent(fee, gross),
      isNetTooHigh: net > gross,
    };
  }, [items, netIncome]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) return toast("Outlet wajib dipilih", "error");
    if (!merchantId) return toast("Merchant wajib dipilih", "error");
    for (const it of items) {
      if (!it.product_variant_id)
        return toast("Varian wajib diisi pada semua baris", "error");
      if (it.qty < 1) return toast("Qty harus minimal 1", "error");
      if (parseNumberInput(it.initial_price) < 0)
        return toast("Harga tidak valid", "error");
    }
    const netValue = parseNumberInput(netIncome);
    const grossValue = items.reduce(
      (a, it) => a + it.qty * parseNumberInput(it.initial_price),
      0,
    );
    if (netValue > grossValue)
      return toast(
        "Pendapatan bersih tidak boleh lebih besar dari total omset",
        "error",
      );
      
    if (isFake && parseNumberInput(companyExpense) < netValue) {
      return toast("Pengeluaran perusahaan tidak boleh lebih kecil dari pendapatan bersih", "error");
    }

    const feeValue = grossValue - netValue;
    start(async () => {
      const res = await createOrder({
        outlet_id: outletId,
        order_number: orderNumber,
        food_merchant_id: merchantId,
        transaction_date: date,
        deduction_fee: feeValue,
        is_fake: isFake,
        company_expense: parseNumberInput(companyExpense),
        items: items.map((it) => ({
          product_variant_id: it.product_variant_id,
          qty: it.qty,
          initial_price: parseNumberInput(it.initial_price),
        })),
      });
      if ((res as any)?.error) toast((res as any).error, "error");
      else {
        toast("Transaksi tersimpan", "success");
        onDone();
      }
    });
  }

  const submitText = pending ? "Menyimpan..." : "Simpan Transaksi";
  const netTooHighMessage =
    "Pendapatan bersih tidak boleh lebih besar dari total omset.";

  return (
    <form onSubmit={onSubmit} className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 lg:flex-row lg:gap-3">
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 lg:gap-3">
          <div
            className="grid shrink-0 grid-cols-2 gap-1.5 rounded-md border p-1.5 min-w-0 sm:gap-3 sm:p-4 md:grid-cols-3"
            style={{
              borderColor: "var(--border)",
              backgroundColor:
                "color-mix(in oklab, var(--bg) 55%, var(--card))",
            }}
          >
            <div className="col-span-2 min-w-0 md:col-span-3">
              <label className="label">Outlet</label>
              {role === "kasir" ? (
                <input
                  className="input"
                  disabled
                  value={
                    outlets.find((o) => o.id === myOutletId)?.name ??
                    "(belum diassign)"
                  }
                />
              ) : (
                <select
                  className="input"
                  value={outletId}
                  onChange={(e) => setOutletId(e.target.value)}
                  required
                >
                  <option value="">-- pilih outlet --</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="min-w-0">
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
              <select
                className="input"
                value={merchantId}
                onChange={(e) => onMerchantChange(e.target.value)}
                required
              >
                <option value="">-- pilih --</option>
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 min-w-0 sm:col-span-1">
              <label className="label">Tanggal/Waktu</label>
              <input
                className="input"
                type="datetime-local"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border p-2.5 min-w-0 sm:p-4"
            style={{
              borderColor: "var(--border)",
              backgroundColor:
                "color-mix(in oklab, var(--bg) 55%, var(--card))",
            }}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="label">Item Transaksi</label>
              <button
                type="button"
                className="btn-outline h-9 shrink-0 px-2.5 text-sm sm:h-10 sm:px-3"
                onClick={addItem}
              >
                <Plus size={14} />
                <span className="hidden sm:inline">Tambah</span> Varian
              </button>
            </div>
            <div className="-mr-1 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1 sm:max-h-[22rem] lg:max-h-[calc(92vh-18rem)]">
              {items.map((it, i) => (
                <div
                  key={it.key}
                  className="relative grid grid-cols-2 gap-2 items-end rounded-md border p-2.5 min-w-0 sm:grid-cols-12"
                  style={{
                    borderColor: "var(--border)",
                    backgroundColor: "var(--card)",
                  }}
                >
                  <div className="col-span-2 min-w-0 pr-11 sm:col-span-12 md:col-span-5 md:pr-0">
                    <label
                      className="text-xs"
                      style={{ color: "var(--muted)" }}
                    >
                      Varian
                    </label>
                    <Combobox
                      options={variants.map((v) => ({
                        value: v.id,
                        label: v.name,
                        hint: getVariantHint(v, merchantId),
                      }))}
                      value={it.product_variant_id}
                      onChange={(v) => onVariantChange(i, v)}
                      placeholder="-- pilih --"
                    />
                  </div>
                  <div className="col-span-1 min-w-0 sm:col-span-4 md:col-span-2">
                    <label
                      className="text-xs"
                      style={{ color: "var(--muted)" }}
                    >
                      Qty
                    </label>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      step={1}
                      value={it.qty}
                      onChange={(e) =>
                        setItem(i, { qty: Number(e.target.value) })
                      }
                      required
                    />
                  </div>
                  <div className="col-span-1 min-w-0 sm:col-span-8 md:col-span-4">
                    <label
                      className="text-xs"
                      style={{ color: "var(--muted)" }}
                    >
                      Harga
                    </label>
                    <CurrencyInput
                      value={it.initial_price}
                      onChange={(value) => setItem(i, { initial_price: value })}
                      required
                    />
                  </div>
                  <div className="absolute right-2 top-2 md:static md:col-span-1 md:flex md:justify-end md:pb-0.5">
                    <button
                      type="button"
                      className="btn-ghost text-red-600 h-10 w-10 p-0"
                      onClick={() => removeItem(i)}
                      disabled={items.length === 1}
                      title="Hapus baris"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="hidden min-w-0 shrink-0 space-y-3 lg:sticky lg:top-0 lg:block lg:w-80">
          <div
            className="grid grid-cols-1 gap-3 rounded-md border p-4 min-w-0"
            style={{
              borderColor: "var(--border)",
              backgroundColor:
                "color-mix(in oklab, var(--bg) 55%, var(--card))",
            }}
          >
            <div className="min-w-0 rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
              <label className="mb-2 block text-sm font-bold text-emerald-800 dark:text-emerald-200">
                Pendapatan Bersih (1 transaksi)
              </label>
              <CurrencyInput
                value={netIncome}
                onChange={setNetIncome}
                required
              />
              {!isFake && (
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                  Potongan/komisi dihitung otomatis dari total omset dikurangi
                  pendapatan bersih.
                </p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={isFake} onChange={(e) => setIsFake(e.target.checked)} className="rounded text-red-600 focus:ring-red-500" />
              Tandai sebagai Fake Order
            </label>
            {isFake && (
              <div className="min-w-0 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900/60 dark:bg-red-950/30 space-y-3">
                <div>
                  <label className="mb-2 block text-sm font-bold text-red-800 dark:text-red-200">
                    Pengeluaran Dana Perusahaan
                  </label>
                  <CurrencyInput value={companyExpense} onChange={setCompanyExpense} required />
                </div>
                <div className="pt-2 border-t border-red-200 dark:border-red-900/40">
                  <div className="text-sm font-bold text-red-800 dark:text-red-200 mb-1">Total Biaya Hangus</div>
                  <div className="text-lg font-black text-red-700 dark:text-red-400">
                    {formatIDR(Math.max(0, parseNumberInput(companyExpense) - parseNumberInput(netIncome)))}
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 gap-2 min-w-0">
              <SummaryMetric
                label="Total Omset"
                value={formatIDR(totals.gross)}
              />
              {!isFake && (
                <SummaryMetric
                  label="Potongan/Komisi"
                  value={formatIDR(totals.fee)}
                  sub={`${formatPercent(totals.feePercent)} dari total omset`}
                  danger={totals.isNetTooHigh}
                />
              )}
              <SummaryMetric
                label="Pendapatan Bersih"
                value={formatIDR(totals.net)}
                valueClassName="text-emerald-700 dark:text-emerald-400"
              />
              {totals.isNetTooHigh && (
                <div className="text-xs text-red-700 dark:text-red-300">
                  {netTooHighMessage}
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary h-11 w-full"
            disabled={pending}
          >
            {submitText}
          </button>
        </aside>
      </div>

      <div
        className="-mx-4 mt-2 shrink-0 border-t px-4 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden"
        style={{
          backgroundColor: "var(--card)",
          borderColor: "var(--border)",
        }}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              Pendapatan Bersih
            </label>
            <CurrencyInput value={netIncome} onChange={setNetIncome} required />
          </div>
          <div
            className="min-w-[6.5rem] rounded-md border px-2.5 py-2 text-right"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--bg)",
            }}
          >
            <div
              className="text-[11px] font-medium"
              style={{ color: "var(--muted)" }}
            >
              Total Omset
            </div>
            <div className="text-sm font-bold leading-tight">
              {formatIDR(totals.gross)}
            </div>
          </div>
        </div>
        <div
          className="mt-2 grid grid-cols-2 gap-2 rounded-md border px-2.5 py-2 text-xs"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
        >
          <div className="min-w-0">
            <div className="font-medium" style={{ color: "var(--muted)" }}>
              Potongan
            </div>
            <div
              className={`truncate font-bold ${
                totals.isNetTooHigh ? "text-red-700 dark:text-red-300" : ""
              }`}
            >
              {formatIDR(totals.fee)}
            </div>
          </div>
          <div className="min-w-0 text-right">
            <div className="font-medium" style={{ color: "var(--muted)" }}>
              Bersih
            </div>
            <div className="truncate font-bold text-emerald-700 dark:text-emerald-400">
              {formatIDR(totals.net)}
            </div>
          </div>
        </div>
        {totals.isNetTooHigh && (
          <div className="mt-1.5 text-xs text-red-700 dark:text-red-300">
            {netTooHighMessage}
          </div>
        )}
        <button
          type="submit"
          className="btn-primary mt-2 h-11 w-full"
          disabled={pending}
        >
          {submitText}
        </button>
      </div>
    </form>
  );
}

function SummaryMetric({
  label,
  value,
  sub,
  danger = false,
  wide = false,
  valueClassName = "",
}: {
  label: string;
  value: string;
  sub?: string;
  danger?: boolean;
  wide?: boolean;
  valueClassName?: string;
}) {
  return (
    <div
      className={`min-w-0 rounded-md border p-2.5 ${wide ? "col-span-2 lg:col-span-1" : ""}`}
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
    >
      <div className="text-xs font-medium" style={{ color: "var(--muted)" }}>
        {label}
      </div>
      <div
        className={`mt-0.5 break-words text-base font-bold ${danger ? "text-red-700 dark:text-red-300" : valueClassName}`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * Edit form: 1 order penuh dengan input pendapatan bersih
 * ============================================================ */
function EditOrderForm({
  role,
  myOutletId,
  outlets,
  merchants,
  variants,
  group,
  onDone,
}: {
  role: "super_admin" | "kasir";
  myOutletId: string | null;
  outlets: Option[];
  merchants: Option[];
  variants: Variant[];
  group: Group;
  onDone: () => void;
}) {
  const firstRow = group.rows[0];
  const [pending, start] = useTransition();
  const [outletId, setOutletId] = useState<string>(
    role === "kasir" ? (myOutletId ?? "") : (firstRow?.outlet_id ?? ""),
  );
  const [orderNumber, setOrderNumber] = useState(group.orderNumber ?? "");
  const [merchantId, setMerchantId] = useState<string>(
    firstRow?.food_merchant_id ?? "",
  );
  const [date, setDate] = useState<string>(() =>
    isoToWIBLocalInput(group.date),
  );
  const [netIncome, setNetIncome] = useState<string>(() =>
    formatNumberInput(group.net),
  );
  const [isFake, setIsFake] = useState(group.is_fake ?? false);
  const [companyExpense, setCompanyExpense] = useState<string>(() => 
    formatNumberInput(group.company_expense || 0)
  );
  const [items, setItems] = useState<Item[]>(() =>
    group.rows.map((row, index) => ({
      key: index + 1,
      id: row.id,
      product_variant_id: row.product_variant_id,
      qty: row.qty,
      initial_price: formatNumberInput(row.initial_price),
    })),
  );

  function setItem(i: number, patch: Partial<Item>) {
    setItems((prev) =>
      prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)),
    );
  }
  function addItem() {
    setItems((p) => [
      ...p,
      { key: Date.now(), product_variant_id: "", qty: 1, initial_price: "" },
    ]);
  }
  function removeItem(i: number) {
    setItems((p) => (p.length === 1 ? p : p.filter((_, idx) => idx !== i)));
  }
  function onMerchantChange(id: string) {
    setMerchantId(id);
    setItems((current) =>
      current.map((item) => {
        if (!item.product_variant_id) return item;
        return {
          ...item,
          initial_price: formatNumberInput(
            getMerchantVariantPrice(variants, item.product_variant_id, id),
          ),
        };
      }),
    );
  }
  function onVariantChange(i: number, id: string) {
    const price = id ? getMerchantVariantPrice(variants, id, merchantId) : 0;
    setItem(i, {
      product_variant_id: id,
      initial_price: id ? formatNumberInput(price) : "",
    });
  }

  const totals = useMemo(() => {
    const gross = items.reduce(
      (a, it) => a + it.qty * parseNumberInput(it.initial_price),
      0,
    );
    const net = parseNumberInput(netIncome);
    const fee = Math.max(gross - net, 0);
    return {
      gross,
      net,
      fee,
      feePercent: feePercent(fee, gross),
      isNetTooHigh: net > gross,
    };
  }, [items, netIncome]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) return toast("Outlet wajib dipilih", "error");
    if (!merchantId) return toast("Merchant wajib dipilih", "error");
    for (const it of items) {
      if (!it.product_variant_id)
        return toast("Varian wajib diisi pada semua baris", "error");
      if (it.qty < 1) return toast("Qty harus minimal 1", "error");
      if (parseNumberInput(it.initial_price) < 0)
        return toast("Harga tidak valid", "error");
    }
    if (totals.isNetTooHigh)
      return toast(
        "Pendapatan bersih tidak boleh lebih besar dari total omset",
        "error",
      );

    start(async () => {
      const res = await updateOrder({
        order_id: group.order_id,
        outlet_id: outletId,
        order_number: orderNumber,
        food_merchant_id: merchantId,
        transaction_date: date,
        deduction_fee: totals.fee,
        is_fake: isFake,
        company_expense: parseNumberInput(companyExpense),
        items: items.map((it) => ({
          id: it.id,
          product_variant_id: it.product_variant_id,
          qty: it.qty,
          initial_price: parseNumberInput(it.initial_price),
        })),
      });
      if ((res as any)?.error) toast((res as any).error, "error");
      else {
        toast("Transaksi diperbarui", "success");
        onDone();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div
        className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-md border p-3 min-w-0"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "color-mix(in oklab, var(--bg) 55%, var(--card))",
        }}
      >
        <div className="md:col-span-3 min-w-0">
          <label className="label">Outlet</label>
          {role === "kasir" ? (
            <input
              className="input"
              disabled
              value={
                outlets.find((o) => o.id === myOutletId)?.name ??
                "(belum diassign)"
              }
            />
          ) : (
            <select
              className="input"
              value={outletId}
              onChange={(e) => setOutletId(e.target.value)}
              required
            >
              <option value="">-- pilih outlet --</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
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
          <select
            className="input"
            value={merchantId}
            onChange={(e) => onMerchantChange(e.target.value)}
            required
          >
            <option value="">-- pilih --</option>
            {merchants.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label className="label">Tanggal/Waktu</label>
          <input
            className="input"
            type="datetime-local"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      <div
        className="rounded-md border p-3 min-w-0"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "color-mix(in oklab, var(--bg) 55%, var(--card))",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <label className="label">Item Transaksi</label>
          <button
            type="button"
            className="btn-outline w-full sm:w-auto"
            onClick={addItem}
          >
            <Plus size={14} /> Tambah Varian
          </button>
        </div>
        <div className="-mr-1 max-h-[34vh] space-y-2 overflow-y-auto overscroll-contain pr-1 sm:max-h-[22rem] lg:max-h-[calc(92vh-18rem)]">
          {items.map((it, i) => (
            <div
              key={it.key}
              className="relative grid grid-cols-1 sm:grid-cols-12 gap-2 items-end rounded-md border p-2.5 min-w-0"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--card)",
              }}
            >
              <div className="min-w-0 pr-11 sm:col-span-12 md:col-span-5 md:pr-0">
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  Varian
                </label>
                <Combobox
                  options={variants.map((v) => ({
                    value: v.id,
                    label: v.name,
                    hint: getVariantHint(v, merchantId),
                  }))}
                  value={it.product_variant_id}
                  onChange={(v) => onVariantChange(i, v)}
                  placeholder="-- pilih --"
                />
              </div>
              <div className="min-w-0 sm:col-span-4 md:col-span-2">
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  Qty
                </label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  step={1}
                  value={it.qty}
                  onChange={(e) => setItem(i, { qty: Number(e.target.value) })}
                  required
                />
              </div>
              <div className="min-w-0 sm:col-span-8 md:col-span-4">
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  Harga
                </label>
                <CurrencyInput
                  value={it.initial_price}
                  onChange={(value) => setItem(i, { initial_price: value })}
                  required
                />
              </div>
              <div className="absolute right-2 top-2 md:static md:col-span-1 md:flex md:justify-end md:pb-0.5">
                <button
                  type="button"
                  className="btn-ghost text-red-600 h-10 w-10 p-0"
                  onClick={() => removeItem(i)}
                  disabled={items.length === 1}
                  title="Hapus baris"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-md border p-3 min-w-0"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "color-mix(in oklab, var(--bg) 55%, var(--card))",
        }}
      >
        <div className="min-w-0 rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
          <label className="mb-2 block text-sm font-bold text-emerald-800 dark:text-emerald-200">
            Pendapatan Bersih (1 transaksi)
          </label>
          <CurrencyInput value={netIncome} onChange={setNetIncome} required />
          {!isFake && (
            <p className="text-xs mt-1 text-emerald-700 dark:text-emerald-300">
              Potongan/komisi dihitung otomatis dari total omset dikurangi
              pendapatan bersih.
            </p>
          )}
        </div>
        <div className="min-w-0 text-left sm:text-right space-y-1">
          <label className="flex sm:justify-end items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            <input type="checkbox" checked={isFake} onChange={(e) => setIsFake(e.target.checked)} className="rounded text-red-600 focus:ring-red-500" />
            Tandai sebagai Fake Order
          </label>
          
          {isFake && (
            <div className="min-w-0 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900/60 dark:bg-red-950/30 mb-2 text-left space-y-3">
              <div>
                <label className="mb-2 block text-sm font-bold text-red-800 dark:text-red-200">
                  Pengeluaran Dana Perusahaan
                </label>
                <CurrencyInput value={companyExpense} onChange={setCompanyExpense} required />
              </div>
              <div className="pt-2 border-t border-red-200 dark:border-red-900/40">
                <div className="text-sm font-bold text-red-800 dark:text-red-200 mb-1">Total Biaya Hangus</div>
                <div className="text-lg font-black text-red-700 dark:text-red-400">
                  {formatIDR(Math.max(0, parseNumberInput(companyExpense) - parseNumberInput(netIncome)))}
                </div>
              </div>
            </div>
          )}

          <div className="text-sm" style={{ color: "var(--muted)" }}>
            Total Omset
          </div>
          <div className="text-base sm:text-lg font-semibold">
            {formatIDR(totals.gross)}
          </div>
          
          {!isFake && (
            <>
              <div className="text-sm" style={{ color: "var(--muted)" }}>
                Potongan/Komisi
              </div>
              <div
                className={`text-base sm:text-lg font-semibold ${totals.isNetTooHigh ? "text-red-700 dark:text-red-300" : ""}`}
              >
                {formatIDR(totals.fee)}
              </div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>
                {formatPercent(totals.feePercent)} dari total omset
              </div>
            </>
          )}
          <div className="text-sm" style={{ color: "var(--muted)" }}>
            Pendapatan Bersih
          </div>
          <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
            {formatIDR(totals.net)}
          </div>
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
  indigo:
    "border-indigo-500 bg-indigo-50 text-indigo-950 ring-indigo-200 dark:border-indigo-400 dark:bg-indigo-950/35 dark:text-indigo-100 dark:ring-indigo-900/50",
  sky: "border-sky-500 bg-sky-50 text-sky-950 ring-sky-200 dark:border-sky-400 dark:bg-sky-950/35 dark:text-sky-100 dark:ring-sky-900/50",
  amber:
    "border-amber-500 bg-amber-50 text-amber-950 ring-amber-200 dark:border-amber-400 dark:bg-amber-950/35 dark:text-amber-100 dark:ring-amber-900/50",
  emerald:
    "border-emerald-500 bg-emerald-50 text-emerald-950 ring-emerald-200 dark:border-emerald-400 dark:bg-emerald-950/35 dark:text-emerald-100 dark:ring-emerald-900/50",
};

const STAT_VALUE_TONES = {
  indigo: "text-indigo-900 dark:text-indigo-100",
  sky: "text-sky-900 dark:text-sky-100",
  amber: "text-amber-900 dark:text-amber-100",
  emerald: "text-emerald-900 dark:text-emerald-100",
};

const STAT_META_TONES = {
  indigo: "text-indigo-700 dark:text-indigo-200",
  sky: "text-sky-700 dark:text-sky-200",
  amber: "text-amber-700 dark:text-amber-200",
  emerald: "text-emerald-700 dark:text-emerald-200",
};

function Stat({
  title,
  value,
  sub,
  tone,
}: {
  title: string;
  value: string;
  sub?: string;
  tone: keyof typeof STAT_TONES;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-l-4 px-3 py-2.5 shadow-sm ring-1 ${STAT_TONES[tone]}`}
    >
      <div
        className={`text-xs uppercase font-bold tracking-wide ${STAT_META_TONES[tone]}`}
      >
        {title}
      </div>
      <div
        className={`mt-1 text-lg sm:text-xl font-extrabold leading-tight break-words ${STAT_VALUE_TONES[tone]}`}
      >
        {value}
      </div>
      {sub && (
        <div
          className={`mt-0.5 text-xs sm:text-sm font-semibold ${STAT_META_TONES[tone]}`}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function DatePresetButton({
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
      className={`btn-outline transition-colors ${
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
