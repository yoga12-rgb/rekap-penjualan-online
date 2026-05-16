"use client";
import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/Toast";
import { createUser, updateUser, deleteUser } from "./actions";

type Outlet = { id: string; name: string };
type Row = {
  id: string;
  full_name: string | null;
  role: "super_admin" | "kasir";
  outlet_id: string | null;
  email: string | null;
};

export function UsersClient({ rows, outlets }: { rows: Row[]; outlets: Outlet[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [pending, start] = useTransition();
  function openCreate() { setEditing(null); setOpen(true); }
  function openEdit(r: Row) { setEditing(r); setOpen(true); }

  async function onSubmit(form: HTMLFormElement) {
    const fd = new FormData(form);
    start(async () => {
      const res = editing ? await updateUser(editing.id, fd) : await createUser(fd);
      if ((res as any)?.error) toast((res as any).error, "error");
      else { toast("Tersimpan", "success"); setOpen(false); }
    });
  }
  async function onDelete(r: Row) {
    if (!confirm(`Hapus akun "${r.full_name ?? r.email}"?`)) return;
    start(async () => {
      const res = await deleteUser(r.id);
      if ((res as any)?.error) toast((res as any).error, "error");
      else toast("Dihapus", "success");
    });
  }

  function outletName(id: string | null) {
    return outlets.find((o) => o.id === id)?.name ?? "-";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Akun Kasir & Admin</h1>
        <button className="btn-primary" onClick={openCreate}>+ Tambah Akun</button>
      </div>
      <div className="card overflow-auto">
        <table className="table">
          <thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Outlet</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.full_name}</td>
                <td>{r.email}</td>
                <td><span className="badge">{r.role}</span></td>
                <td>{r.role === "kasir" ? outletName(r.outlet_id) : "-"}</td>
                <td className="text-right whitespace-nowrap">
                  <button className="btn-ghost" onClick={() => openEdit(r)}>Edit</button>
                  <button className="btn-ghost text-red-600" onClick={() => onDelete(r)}>Hapus</button>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="text-center py-6 text-slate-500">Belum ada akun.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Akun" : "Tambah Akun"}>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(e.currentTarget); }} className="grid grid-cols-2 gap-3">
          {!editing && (
            <>
              <div className="col-span-2">
                <label className="label">Email</label>
                <input className="input" name="email" type="email" required />
              </div>
              <div className="col-span-2">
                <label className="label">Password</label>
                <input className="input" name="password" type="password" minLength={6} required />
              </div>
            </>
          )}
          {editing && (
            <div className="col-span-2">
              <label className="label">Password Baru (opsional)</label>
              <input className="input" name="password" type="password" minLength={6} placeholder="Kosongkan jika tidak diubah" />
            </div>
          )}
          <div className="col-span-2">
            <label className="label">Nama Lengkap</label>
            <input className="input" name="full_name" defaultValue={editing?.full_name ?? ""} required />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" name="role" defaultValue={editing?.role ?? "kasir"}>
              <option value="kasir">Kasir</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <div>
            <label className="label">Outlet (untuk kasir)</label>
            <select className="input" name="outlet_id" defaultValue={editing?.outlet_id ?? ""}>
              <option value="">-- pilih --</option>
              {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div className="col-span-2 flex justify-end pt-1">
            <button className="btn-primary" disabled={pending}>{pending ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
