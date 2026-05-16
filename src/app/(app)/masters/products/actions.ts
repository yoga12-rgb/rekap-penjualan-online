"use server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const Schema = z.object({
  name: z.string().min(1),
  base_price: z.coerce.number().nonnegative()
});

export async function createProduct(formData: FormData) {
  await requireAdmin();
  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Data tidak valid" };
  const supabase = createClient();
  const { error } = await supabase.from("product_variants").insert(parsed.data);
  if (error) return { error: error.message };
  revalidatePath("/masters/products");
  return { ok: true };
}
export async function updateProduct(id: string, formData: FormData) {
  await requireAdmin();
  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Data tidak valid" };
  const supabase = createClient();
  const { error } = await supabase.from("product_variants").update(parsed.data).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/masters/products");
  return { ok: true };
}
export async function deleteProduct(id: string) {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase.from("product_variants").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/masters/products");
  return { ok: true };
}
