"use client";
import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/Toast";
import { MerchantBadge } from "@/components/MerchantBadge";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { resolvedHex } from "@/lib/merchantColors";
import { createMerchant, updateMerchant, deleteMerchant } from "./actions";

type Row = { id: string; name: string; color: string | null; created_at: string };

export function MerchantsClient({ rows }: { rows: Row[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [pending, start] = useTransition();

  function openCreate() { setEditing(null); setOpen(true); }
  function openEdit(r: Row) { setEditing(r); setOpen(true); }

  async function onSubmit(form: HTMLFormElement) {
    const fd = new FormData(form);
    start(async () => {
      const res = editing ? await updateMerchant(editing.id, fd) : await createMerchant(fd);
      if ((res as any)?.error) toast((res as any).error, "error");
      else { toast("Tersimpan", "success"); setOpen(false); }
    });
  }
  function onConfirmDelete() {
    if (!deleting) return;
    start(async () => {
      const res = await deleteMerchant(deleting.id);
      setDeleting(null);
      if ((res as any)?.error) toast((res as any).error, "error");
      else toast("Dihapus", "success");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-bold">Master Food Merchant</h1>
        <button className="btn-primary" onClick={openCreate}>+ Tambah Merchant</button>
      </div>
      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Warna dipakai untuk badge & chart. Kosongkan untuk pakai preset bawaan (GoFood/Grab/Shopee) atau warna otomatis dari nama.
      </p>
      <div className="card overflow-auto">
        <table className="table">
          <thead><tr><th>Nama</th><th>Warna</th><th>Preview</th><th>Dibuat</th><th className="text-right">Aksi</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-medium align-middle">{r.name}</td>
                <td className="align-middle">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-4 w-4 rounded border"
                          style={{ backgroundColor: resolvedHex(r.name, r.color), borderColor: "var(--border)" }} />
                    <code className="text-xs" style={{ color: "var(--muted)" }}>
                      {r.color ?? "(auto)"}
                    </code>
                  </div>
                </td>
                <td className="align-middle"><MerchantBadge name={r.name} color={r.color} solid /></td>
                <td className="align-middle" style={{ color: "var(--muted)" }}>
                  {new Date(r.created_at).toLocaleDateString("id-ID")}
                </td>
                <td className="text-right whitespace-nowrap py-2 align-middle">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      className="btn-ghost h-8 w-8 p-0"
                      onClick={() => openEdit(r)}
                      title={`Edit ${r.name}`}
                      aria-label={`Edit ${r.name}`}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      className="btn-ghost text-red-600 h-8 w-8 p-0"
                      onClick={() => setDeleting(r)}
                      title={`Hapus ${r.name}`}
                      aria-label={`Hapus ${r.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5}>
                  <EmptyState title="Belum ada data" description="Belum ada food merchant." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Merchant" : "Tambah Merchant"}>
        <MerchantForm key={editing?.id ?? "new"} editing={editing} pending={pending} onSubmit={onSubmit} />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={onConfirmDelete}
        title="Hapus Merchant"
        message={
          <>
            Merchant <b>"{deleting?.name}"</b> akan dihapus permanen.
          </>
        }
        busy={pending}
      />
    </div>
  );
}

function MerchantForm({
  editing, pending, onSubmit
}: {
  editing: Row | null;
  pending: boolean;
  onSubmit: (form: HTMLFormElement) => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [color, setColor] = useState<string>(editing?.color ?? resolvedHex(editing?.name ?? name));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(e.currentTarget); }} className="space-y-3">
      <div>
        <label htmlFor="merchant-name" className="label">Nama Merchant</label>
        <input id="merchant-name" className="input" name="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className="label">Warna Badge</label>
        <ColorPicker value={color} onChange={setColor} />
        <input type="hidden" name="color" value={color} />
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          Klik palet atau ubah hex. Kosongkan untuk pakai default.
        </p>
      </div>
      <div>
        <label className="label">Preview</label>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <MerchantBadge name={name || "Merchant"} color={color} solid />
          <MerchantBadge name={name || "Merchant"} color={color} />
        </div>
      </div>
      <div className="flex justify-end">
        <button className="btn-primary" disabled={pending}>{pending ? "Menyimpan..." : "Simpan"}</button>
      </div>
    </form>
  );
}
