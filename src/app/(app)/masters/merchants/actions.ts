"use server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const HEX = /^#[0-9a-fA-F]{6}$/;

function parsePayload(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const colorRaw = String(formData.get("color") ?? "").trim();
  const color = HEX.test(colorRaw) ? colorRaw.toLowerCase() : null;
  return { name, color };
}

export async function createMerchant(formData: FormData) {
  await requireAdmin();
  const { name, color } = parsePayload(formData);
  if (!name) return { error: "Nama wajib diisi" };
  const supabase = await createClient();
  const { error } = await supabase.from("food_merchants").insert({ name, color });
  if (error) return { error: error.message };
  revalidatePath("/masters/merchants");
  return { ok: true };
}

export async function updateMerchant(id: string, formData: FormData) {
  await requireAdmin();
  const { name, color } = parsePayload(formData);
  if (!name) return { error: "Nama wajib diisi" };
  const supabase = await createClient();
  const { error } = await supabase.from("food_merchants").update({ name, color }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/masters/merchants");
  return { ok: true };
}

export async function deleteMerchant(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("food_merchants").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/masters/merchants");
  return { ok: true };
}
