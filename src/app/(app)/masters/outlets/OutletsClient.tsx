"use client";
import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/Toast";
import { createOutlet, updateOutlet, deleteOutlet } from "./actions";

type Row = { id: string; name: string; created_at: string };

export function OutletsClient({ rows }: { rows: Row[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [pending, start] = useTransition();

  function openCreate() { setEditing(null); setOpen(true); }
  function openEdit(r: Row) { setEditing(r); setOpen(true); }

  async function onSubmit(form: HTMLFormElement) {
    const fd = new FormData(form);
    start(async () => {
      const res = editing ? await updateOutlet(editing.id, fd) : await createOutlet(fd);
      if ((res as any)?.error) toast((res as any).error, "error");
      else { toast("Tersimpan", "success"); setOpen(false); }
    });
  }
  function onConfirmDelete() {
    if (!deleting) return;
    start(async () => {
      const res = await deleteOutlet(deleting.id);
      setDeleting(null);
      if ((res as any)?.error) toast((res as any).error, "error");
      else toast("Dihapus", "success");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-bold">Master Outlet</h1>
        <button className="btn-primary" onClick={openCreate}>+ Tambah Outlet</button>
      </div>
      <div className="card overflow-auto">
        <table className="table">
          <thead><tr><th>Nama</th><th>Dibuat</th><th className="text-right">Aksi</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-medium align-middle">{r.name}</td>
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
                <td colSpan={3}>
                  <EmptyState title="Belum ada data" description="Belum ada outlet." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Outlet" : "Tambah Outlet"}>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(e.currentTarget); }} className="space-y-3">
          <div>
            <label htmlFor="outlet-name" className="label">Nama Outlet</label>
            <input id="outlet-name" className="input" name="name" defaultValue={editing?.name ?? ""} required />
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" disabled={pending}>{pending ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={onConfirmDelete}
        title="Hapus Outlet"
        message={
          <>
            Outlet <b>"{deleting?.name}"</b> akan dihapus permanen.
          </>
        }
        busy={pending}
      />
    </div>
  );
}
