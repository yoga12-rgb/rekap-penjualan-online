"use server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const CreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1),
  role: z.enum(["super_admin", "kasir"]),
  outlet_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined))
});

export async function createUser(formData: FormData) {
  await requireAdmin();
  const parsed = CreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const { email, password, full_name, role, outlet_id } = parsed.data;
  if (role === "kasir" && !outlet_id) return { error: "Kasir harus diassign ke outlet" };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name }
  });
  if (error || !data.user) return { error: error?.message ?? "Gagal membuat user" };

  const supabase = await createClient();
  const { error: pErr } = await supabase.from("profiles").upsert({
    id: data.user.id, full_name, role, outlet_id: outlet_id ?? null
  });
  if (pErr) return { error: pErr.message };

  revalidatePath("/masters/users");
  return { ok: true };
}

const UpdateSchema = z.object({
  full_name: z.string().min(1),
  role: z.enum(["super_admin", "kasir"]),
  outlet_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  password: z.string().optional().or(z.literal(""))
});

export async function updateUser(id: string, formData: FormData) {
  await requireAdmin();
  const parsed = UpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Data tidak valid" };
  const { full_name, role, outlet_id, password } = parsed.data;
  if (role === "kasir" && !outlet_id) return { error: "Kasir harus diassign ke outlet" };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles")
    .update({ full_name, role, outlet_id: outlet_id ?? null }).eq("id", id);
  if (error) return { error: error.message };

  if (password && password.length >= 6) {
    const admin = createAdminClient();
    const { error: pwErr } = await admin.auth.admin.updateUserById(id, { password });
    if (pwErr) return { error: pwErr.message };
  }
  revalidatePath("/masters/users");
  return { ok: true };
}

export async function deleteUser(id: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { error: error.message };
  revalidatePath("/masters/users");
  return { ok: true };
}
