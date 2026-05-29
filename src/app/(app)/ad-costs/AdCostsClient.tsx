"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/Toast";
import { formatIDR } from "@/lib/utils";
import {
  todayWIBKey,
  daysAgoWIBKey,
  startOfMonthWIBKey,
  endOfMonthWIBKey,
  startOfPreviousMonthWIBKey,
  endOfPreviousMonthWIBKey,
  startOfYearWIBKey,
} from "@/lib/date";
import { MerchantBadge } from "@/components/MerchantBadge";
import {
  AlertCircle,
  Filter,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { deleteAdCost, updateAdCost, upsertAdCost } from "./actions";
import {
  setAdCostsFilterCookie,
  clearAdCostsFilterCookie,
} from "@/lib/filterCookies";

type Option = { id: string; name: string };
type Merchant = Option & { color?: string | null };
type Row = {
  id: string;
  cost_date: string;
  outlet_id: string;
  food_merchant_id: string;
  amount: number;
  note: string | null;
  created_at: string;
  outlets: { name: string } | null;
  food_merchants: { name: string; color: string | null } | null;
};
type DatePreset = "today" | "7d" | "30d" | "month" | "lastMonth" | "ytd";
type AdCostsFilter = {
  from: string;
  to: string;
  outlet: string;
  merchant: string;
  rangeWasReversed?: boolean;
};
type AdCostsFilterKey = "from" | "to" | "outlet" | "merchant";

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

function CurrencyInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
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
        className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm tabular-nums outline-none"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(formatNumberInput(e.target.value))}
        required
      />
    </div>
  );
}

export function AdCostsClient({
  rows,
  role,
  myOutletId,
  outlets,
  merchants,
  filter,
}: {
  rows: Row[];
  role: "super_admin" | "kasir";
  myOutletId: string | null;
  outlets: Option[];
  merchants: Merchant[];
  filter: AdCostsFilter;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [pending, start] = useTransition();
  const [filterPending, startFilterTransition] = useTransition();
  const [draftFilter, setDraftFilter] = useState<AdCostsFilter>({
    from: filter.from,
    to: filter.to,
    outlet: filter.outlet,
    merchant: filter.merchant,
  });
  const total = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [rows],
  );

  // NOTE: Restore filter dari cookie ditangani server-side di page.tsx

  useEffect(() => {
    setDraftFilter({
      from: filter.from,
      to: filter.to,
      outlet: filter.outlet,
      merchant: filter.merchant,
    });
  }, [filter.from, filter.to, filter.outlet, filter.merchant]);

  // Simpan filter ke cookie saat berubah (agar server component bisa redirect)
  useEffect(() => {
    setAdCostsFilterCookie({
      from: filter.from,
      to: filter.to,
      outlet: filter.outlet,
      merchant: filter.merchant,
    });
  }, [filter.from, filter.to, filter.outlet, filter.merchant]);

  function buildFilterParams(nextFilter: AdCostsFilter) {
    const next = new URLSearchParams();
    next.set("from", nextFilter.from);
    next.set("to", nextFilter.to);
    if (nextFilter.outlet) next.set("outlet", nextFilter.outlet);
    if (nextFilter.merchant) next.set("merchant", nextFilter.merchant);
    return next;
  }

  function setDraftParam(key: AdCostsFilterKey, value: string) {
    setDraftFilter((current) => ({ ...current, [key]: value }));
  }

  function applyFilter(nextFilter = draftFilter) {
    const next = buildFilterParams(nextFilter);
    startFilterTransition(() => router.push(`/ad-costs?${next.toString()}`));
  }

  function clearFilter() {
    clearAdCostsFilterCookie();
    setDraftFilter({
      from: daysAgoWIBKey(29),
      to: todayWIBKey(),
      outlet: "",
      merchant: "",
    });
    startFilterTransition(() => router.push("/ad-costs"));
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
    return { from: startOfYearWIBKey(), to: todayWIBKey() };
  }

  function isPresetActive(preset: DatePreset) {
    const range = getPresetRange(preset);
    return filter.from === range.from && filter.to === range.to;
  }

  function setRangePreset(preset: DatePreset) {
    const range = getPresetRange(preset);
    const nextFilter = { ...draftFilter, from: range.from, to: range.to };
    setDraftFilter(nextFilter);
    applyFilter(nextFilter);
  }

  const hasActiveFilter =
    filter.from !== daysAgoWIBKey(29) ||
    filter.to !== todayWIBKey() ||
    !!filter.outlet ||
    !!filter.merchant;
  const hasDraftChanges =
    draftFilter.from !== filter.from ||
    draftFilter.to !== filter.to ||
    draftFilter.outlet !== filter.outlet ||
    draftFilter.merchant !== filter.merchant;
  const showResetFilter = hasActiveFilter || hasDraftChanges;

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(row: Row) {
    setEditing(row);
    setOpen(true);
  }

  async function onSubmit(form: HTMLFormElement) {
    const fd = new FormData(form);
    start(async () => {
      const res = editing
        ? await updateAdCost(editing.id, fd)
        : await upsertAdCost(fd);
      if ((res as any)?.error) toast((res as any).error, "error");
      else {
        toast("Biaya iklan tersimpan", "success");
        setOpen(false);
      }
    });
  }

  async function onDelete(row: Row) {
    if (
      !confirm(
        `Hapus biaya iklan ${row.outlets?.name ?? ""} - ${row.food_merchants?.name ?? ""}?`,
      )
    )
      return;
    start(async () => {
      const res = await deleteAdCost(row.id);
      if ((res as any)?.error) toast((res as any).error, "error");
      else toast("Biaya iklan dihapus", "success");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Biaya Iklan Harian</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Satu record per tanggal, outlet, dan merchant. Terpisah dari
            potongan admin transaksi.
          </p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={16} /> Tambah Biaya
        </button>
      </div>

      <div className="card p-3 space-y-2.5">
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
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
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
              <select
                className="input"
                value={draftFilter.outlet}
                onChange={(e) => setDraftParam("outlet", e.target.value)}
              >
                <option value="">Semua outlet</option>
                {outlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Merchant</label>
            <select
              className="input"
              value={draftFilter.merchant}
              onChange={(e) => setDraftParam("merchant", e.target.value)}
            >
              <option value="">Semua merchant</option>
              {merchants.map((merchant) => (
                <option key={merchant.id} value={merchant.id}>
                  {merchant.name}
                </option>
              ))}
            </select>
          </div>
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
        </div>
      </div>

      {filter.rangeWasReversed && (
        <div className="card p-3 flex items-center gap-2 text-sm">
          <AlertCircle size={16} className="text-amber-600" />
          <span>
            Tanggal "Dari" lebih besar dari "Sampai"; sistem otomatis menukar
            untuk query.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4">
          <div
            className="text-xs uppercase font-semibold"
            style={{ color: "var(--muted)" }}
          >
            Total Biaya Iklan
          </div>
          <div className="mt-1 text-xl font-bold">{formatIDR(total)}</div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            {filter.from} - {filter.to}
          </div>
        </div>
        <div className="card p-4">
          <div
            className="text-xs uppercase font-semibold"
            style={{ color: "var(--muted)" }}
          >
            Jumlah Record
          </div>
          <div className="mt-1 text-xl font-bold">
            {rows.length.toLocaleString("id-ID")}
          </div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            outlet + merchant + tanggal
          </div>
        </div>
      </div>

      <div className="card overflow-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Outlet</th>
              <th>Merchant</th>
              <th className="text-right">Biaya Iklan</th>
              <th>Catatan</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  {new Date(row.cost_date + "T00:00:00").toLocaleDateString(
                    "id-ID",
                  )}
                </td>
                <td>{row.outlets?.name ?? "-"}</td>
                <td>
                  <MerchantBadge
                    name={row.food_merchants?.name}
                    color={row.food_merchants?.color}
                  />
                </td>
                <td className="text-right font-medium">
                  {formatIDR(row.amount)}
                </td>
                <td className="max-w-xs truncate">{row.note || "-"}</td>
                <td className="text-right whitespace-nowrap">
                  <button
                    className="btn-ghost"
                    onClick={() => openEdit(row)}
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="btn-ghost text-red-600"
                    onClick={() => onDelete(row)}
                    title="Hapus"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td
                  colSpan={6}
                  className="text-center py-6"
                  style={{ color: "var(--muted)" }}
                >
                  Belum ada biaya iklan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit Biaya Iklan" : "Tambah Biaya Iklan"}
      >
        <AdCostForm
          editing={editing}
          role={role}
          myOutletId={myOutletId}
          outlets={outlets}
          merchants={merchants}
          pending={pending}
          onSubmit={onSubmit}
        />
      </Modal>
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

function AdCostForm({
  editing,
  role,
  myOutletId,
  outlets,
  merchants,
  pending,
  onSubmit,
}: {
  editing: Row | null;
  role: "super_admin" | "kasir";
  myOutletId: string | null;
  outlets: Option[];
  merchants: Merchant[];
  pending: boolean;
  onSubmit: (form: HTMLFormElement) => void;
}) {
  const [amount, setAmount] = useState(() =>
    formatNumberInput(editing?.amount ?? ""),
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(e.currentTarget);
      }}
      className="space-y-3"
    >
      <div>
        <label className="label">Tanggal</label>
        <input
          className="input"
          type="date"
          name="cost_date"
          defaultValue={editing?.cost_date ?? todayWIBKey()}
          required
        />
      </div>
      <div>
        <label className="label">Outlet</label>
        {role === "kasir" ? (
          <>
            <input
              className="input"
              disabled
              value={
                outlets.find((outlet) => outlet.id === myOutletId)?.name ??
                "(belum diassign)"
              }
            />
            <input type="hidden" name="outlet_id" value={myOutletId ?? ""} />
          </>
        ) : (
          <select
            className="input"
            name="outlet_id"
            defaultValue={editing?.outlet_id ?? ""}
            required
          >
            <option value="">-- pilih outlet --</option>
            {outlets.map((outlet) => (
              <option key={outlet.id} value={outlet.id}>
                {outlet.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div>
        <label className="label">Merchant</label>
        <select
          className="input"
          name="food_merchant_id"
          defaultValue={editing?.food_merchant_id ?? ""}
          required
        >
          <option value="">-- pilih merchant --</option>
          {merchants.map((merchant) => (
            <option key={merchant.id} value={merchant.id}>
              {merchant.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Biaya Iklan</label>
        <CurrencyInput value={amount} onChange={setAmount} />
        <input type="hidden" name="amount" value={parseNumberInput(amount)} />
      </div>
      <div>
        <label className="label">Catatan</label>
        <textarea
          className="input min-h-20"
          name="note"
          defaultValue={editing?.note ?? ""}
          maxLength={300}
        />
      </div>
      <div className="flex justify-end">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </form>
  );
}
