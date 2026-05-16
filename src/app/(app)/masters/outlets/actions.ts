"use server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createOutlet(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Nama wajib diisi" };
  const supabase = createClient();
  const { error } = await supabase.from("outlets").insert({ name });
  if (error) return { error: error.message };
  revalidatePath("/masters/outlets");
  return { ok: true };
}

export async function updateOutlet(id: string, formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Nama wajib diisi" };
  const supabase = createClient();
  const { error } = await supabase.from("outlets").update({ name }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/masters/outlets");
  return { ok: true };
}

export async function deleteOutlet(id: string) {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase.from("outlets").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/masters/outlets");
  return { ok: true };
}
