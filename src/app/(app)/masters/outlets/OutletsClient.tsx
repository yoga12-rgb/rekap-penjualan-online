"use client";
import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
          <thead><tr><th>Nama</th><th>Dibuat</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{new Date(r.created_at).toLocaleDateString("id-ID")}</td>
                <td className="text-right whitespace-nowrap">
                  <button className="btn-ghost" onClick={() => openEdit(r)}>Edit</button>
                  <button className="btn-ghost text-red-600" onClick={() => setDeleting(r)}>Hapus</button>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={3} className="text-center py-6 text-slate-500">Belum ada data.</td></tr>}
          </tbody>
        </table>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Outlet" : "Tambah Outlet"}>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(e.currentTarget); }} className="space-y-3">
          <div>
            <label className="label">Nama Outlet</label>
            <input className="input" name="name" defaultValue={editing?.name ?? ""} required />
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
