"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/Toast";
import { formatIDR } from "@/lib/utils";
import { createProduct, updateProduct, deleteProduct, updateProductPrices } from "./actions";

type Row = { id: string; name: string; hpp: number; base_price: number; created_at: string };
type Merchant = { id: string; name: string; color?: string | null };
type PriceRow = { product_variant_id: string; food_merchant_id: string; price: number };

function priceKey(productId: string, merchantId: string) {
  return `${productId}:${merchantId}`;
}

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
  id,
  value,
  onChange,
  required = false,
}: {
  id?: string;
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
        id={id}
        className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm tabular-nums outline-none"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(formatNumberInput(e.target.value))}
        required={required}
      />
    </div>
  );
}

function ProductForm({
  editing,
  pending,
  onSubmit,
}: {
  editing: Row | null;
  pending: boolean;
  onSubmit: (form: HTMLFormElement) => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [hpp, setHpp] = useState(() =>
    editing?.hpp != null ? formatNumberInput(editing.hpp) : "",
  );
  const [basePrice, setBasePrice] = useState(() =>
    editing?.base_price != null ? formatNumberInput(editing.base_price) : "",
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
        <label htmlFor="product-name" className="label">
          Nama Produk/Varian
        </label>
        <input
          id="product-name"
          name="name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
      </div>
      <div>
        <label htmlFor="product-hpp" className="label">
          HPP (Modal Dasar)
        </label>
        <CurrencyInput
          id="product-hpp"
          value={hpp}
          onChange={setHpp}
          required
        />
        <input type="hidden" name="hpp" value={parseNumberInput(hpp)} />
      </div>
      <div>
        <label htmlFor="product-base-price" className="label">
          Harga Jual (Default)
        </label>
        <CurrencyInput
          id="product-base-price"
          value={basePrice}
          onChange={setBasePrice}
          required
        />
        <input type="hidden" name="base_price" value={parseNumberInput(basePrice)} />
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          Dipakai jika harga khusus merchant belum diisi.
        </p>
      </div>
      <div className="flex justify-end">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </form>
  );
}

export function ProductsClient({
  rows,
  merchants,
  prices
}: {
  rows: Row[];
  merchants: Merchant[];
  prices: PriceRow[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingProductId, setSavingProductId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const priceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const price of prices) {
      map.set(priceKey(price.product_variant_id, price.food_merchant_id), Number(price.price));
    }
    return map;
  }, [prices]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const price of prices) {
      next[priceKey(price.product_variant_id, price.food_merchant_id)] = String(Number(price.price));
    }
    setDrafts(next);
  }, [prices]);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(r: Row) {
    setEditing(r);
    setOpen(true);
  }

  function getDraft(productId: string, merchantId: string) {
    const key = priceKey(productId, merchantId);
    if (key in drafts) return drafts[key];
    const saved = priceMap.get(key);
    return saved == null ? "" : String(saved);
  }

  function setDraft(productId: string, merchantId: string, value: string) {
    const key = priceKey(productId, merchantId);
    setDrafts((current) => ({ ...current, [key]: onlyDigits(value) }));
  }

  async function onSubmit(form: HTMLFormElement) {
    const fd = new FormData(form);
    start(async () => {
      const res = editing ? await updateProduct(editing.id, fd) : await createProduct(fd);
      if ((res as any)?.error) toast((res as any).error, "error");
      else {
        toast("Tersimpan", "success");
        setOpen(false);
      }
    });
  }

  async function onSavePrices(row: Row) {
    setSavingProductId(row.id);
    start(async () => {
      const payload = merchants.map((merchant) => {
        const raw = getDraft(row.id, merchant.id).trim();
        return {
          food_merchant_id: merchant.id,
          price: raw ? Number(raw) : null
        };
      });
      const res = await updateProductPrices(row.id, payload);
      setSavingProductId(null);
      if ((res as any)?.error) toast((res as any).error, "error");
      else toast(`Harga ${row.name} tersimpan`, "success");
    });
  }

  function onConfirmDelete() {
    if (!deleting) return;
    start(async () => {
      const res = await deleteProduct(deleting.id);
      setDeleting(null);
      if ((res as any)?.error) toast((res as any).error, "error");
      else toast("Dihapus", "success");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-bold">Master Produk & Varian</h1>
        <button className="btn-primary" onClick={openCreate}>+ Tambah Produk</button>
      </div>

      <div className="card p-3 text-xs" style={{ color: "var(--muted)" }}>
        Harga default dipakai sebagai fallback. Isi kolom merchant hanya jika harga produk berbeda di merchant tersebut.
        Mengubah master harga tidak mengubah transaksi lama karena transaksi menyimpan harga snapshot.
      </div>

      <div className="card overflow-auto max-h-[calc(100vh-240px)]">
        <table className="table min-w-[900px]">
          <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 shadow-sm">
            <tr>
              <th className="min-w-44">Produk</th>
              <th className="text-right min-w-36">HPP (Modal)</th>
              <th className="text-right min-w-36">Harga Jual Default</th>
              {merchants.map((merchant) => (
                <th key={merchant.id} className="text-right min-w-40">{merchant.name}</th>
              ))}
              <th className="text-right min-w-44">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="py-1.5">
                  <div className="font-medium leading-tight">{row.name}</div>
                  <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                    Dibuat {new Date(row.created_at).toLocaleDateString("id-ID")}
                  </div>
                </td>
                <td className="text-right font-medium text-orange-500 py-1.5 align-middle">{formatIDR(row.hpp)}</td>
                <td className="text-right font-medium py-1.5 align-middle">{formatIDR(row.base_price)}</td>
                {merchants.map((merchant) => {
                  const value = getDraft(row.id, merchant.id);
                  return (
                    <td key={merchant.id} className="text-right align-top py-1.5">
                      <input
                        aria-label={`Harga ${row.name} di ${merchant.name}`}
                        className="input text-right tabular-nums h-7 py-0.5 px-2 text-sm"
                        inputMode="numeric"
                        value={value}
                        placeholder={String(Number(row.base_price))}
                        onChange={(e) => setDraft(row.id, merchant.id, e.target.value)}
                      />
                      {!value && (
                        <div className="mt-0.5 text-[10px] leading-none" style={{ color: "var(--muted)" }}>
                          fallback {formatIDR(row.base_price)}
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="text-right whitespace-nowrap py-1.5 align-middle">
                  <button
                    className="btn-primary mr-1 h-7 px-2 py-0.5 text-xs"
                    onClick={() => onSavePrices(row)}
                    disabled={pending && savingProductId === row.id}
                  >
                    {pending && savingProductId === row.id ? "Menyimpan..." : "Simpan Harga"}
                  </button>
                  <button className="btn-ghost h-7 px-2 py-0.5 text-xs" onClick={() => openEdit(row)}>Edit</button>
                  <button className="btn-ghost text-red-600 h-7 px-2 py-0.5 text-xs" onClick={() => setDeleting(row)}>Hapus</button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={3 + merchants.length}>
                  <EmptyState title="Belum ada data" description="Belum ada produk atau varian." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Produk" : "Tambah Produk"}>
        <ProductForm key={editing?.id ?? "create"} editing={editing} pending={pending} onSubmit={onSubmit} />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={onConfirmDelete}
        title="Hapus Produk"
        message={
          <>
            Produk <b>"{deleting?.name}"</b> akan dihapus beserta harga per merchant-nya.
          </>
        }
        busy={pending}
      />
    </div>
  );
}
