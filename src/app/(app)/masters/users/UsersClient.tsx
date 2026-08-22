"use client";
import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
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
  const [deleting, setDeleting] = useState<Row | null>(null);
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
  function onConfirmDelete() {
    if (!deleting) return;
    start(async () => {
      const res = await deleteUser(deleting.id);
      setDeleting(null);
      if ((res as any)?.error) toast((res as any).error, "error");
      else toast("Dihapus", "success");
    });
  }

  function outletName(id: string | null) {
    return outlets.find((o) => o.id === id)?.name ?? "-";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-bold">Akun Kasir & Admin</h1>
        <button className="btn-primary" onClick={openCreate}>+ Tambah Akun</button>
      </div>
      <div className="card overflow-auto">
        <table className="table">
          <thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Outlet</th><th className="text-right">Aksi</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-medium align-middle">{r.full_name}</td>
                <td className="align-middle" style={{ color: "var(--muted)" }}>{r.email}</td>
                <td className="align-middle"><span className="badge">{r.role}</span></td>
                <td className="align-middle">{r.role === "kasir" ? outletName(r.outlet_id) : "-"}</td>
                <td className="text-right whitespace-nowrap py-2 align-middle">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      className="btn-ghost h-8 w-8 p-0"
                      onClick={() => openEdit(r)}
                      title={`Edit ${r.full_name ?? r.email}`}
                      aria-label={`Edit ${r.full_name ?? r.email}`}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      className="btn-ghost text-red-600 h-8 w-8 p-0"
                      onClick={() => setDeleting(r)}
                      title={`Hapus ${r.full_name ?? r.email}`}
                      aria-label={`Hapus ${r.full_name ?? r.email}`}
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
                  <EmptyState title="Belum ada akun" description="Belum ada akun kasir atau admin." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Akun" : "Tambah Akun"}>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(e.currentTarget); }} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {!editing && (
            <>
              <div className="sm:col-span-2">
                <label htmlFor="user-email" className="label">Email</label>
                <input id="user-email" className="input" name="email" type="email" required />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="user-password" className="label">Password</label>
                <input id="user-password" className="input" name="password" type="password" minLength={6} required />
              </div>
            </>
          )}
          {editing && (
            <div className="sm:col-span-2">
              <label htmlFor="user-new-password" className="label">Password Baru (opsional)</label>
              <input id="user-new-password" className="input" name="password" type="password" minLength={6} placeholder="Kosongkan jika tidak diubah" />
            </div>
          )}
          <div className="sm:col-span-2">
            <label htmlFor="user-full-name" className="label">Nama Lengkap</label>
            <input id="user-full-name" className="input" name="full_name" defaultValue={editing?.full_name ?? ""} required />
          </div>
          <div>
            <label htmlFor="user-role" className="label">Role</label>
            <select id="user-role" className="input" name="role" defaultValue={editing?.role ?? "kasir"}>
              <option value="kasir">Kasir</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <div>
            <label htmlFor="user-outlet" className="label">Outlet (untuk kasir)</label>
            <select id="user-outlet" className="input" name="outlet_id" defaultValue={editing?.outlet_id ?? ""}>
              <option value="">-- pilih --</option>
              {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2 flex justify-end pt-1">
            <button className="btn-primary" disabled={pending}>{pending ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={onConfirmDelete}
        title="Hapus Akun"
        message={
          <>
            Akun <b>"{deleting?.full_name ?? deleting?.email}"</b> akan dihapus permanen.
          </>
        }
        busy={pending}
      />
    </div>
  );
}
