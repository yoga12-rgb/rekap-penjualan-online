"use server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const Schema = z.object({
  name: z.string().min(1),
  base_price: z.coerce.number().nonnegative(),
  hpp: z.coerce.number().nonnegative().default(0)
});

const PriceSchema = z.object({
  food_merchant_id: z.string().uuid(),
  price: z.coerce.number().nonnegative().nullable()
});
const IdSchema = z.string().uuid();

export async function createProduct(formData: FormData) {
  await requireAdmin();
  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Data tidak valid" };
  const supabase = await createClient();
  const { error } = await supabase.from("product_variants").insert(parsed.data);
  if (error) return { error: error.message };
  revalidatePath("/masters/products");
  revalidatePath("/transactions");
  return { ok: true };
}
export async function updateProduct(id: string, formData: FormData) {
  await requireAdmin();
  const idResult = IdSchema.safeParse(id);
  if (!idResult.success) return { error: "ID produk tidak valid" };
  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Data tidak valid" };
  const supabase = await createClient();
  const { error } = await supabase.from("product_variants").update(parsed.data).eq("id", idResult.data);
  if (error) return { error: error.message };
  revalidatePath("/masters/products");
  revalidatePath("/transactions");
  return { ok: true };
}

export async function updateProductPrices(productId: string, payload: unknown) {
  await requireAdmin();
  const idResult = IdSchema.safeParse(productId);
  if (!idResult.success) return { error: "ID produk tidak valid" };
  const parsed = z.array(PriceSchema).safeParse(payload);
  if (!parsed.success) return { error: "Data harga tidak valid" };

  const supabase = await createClient();
  const deleteIds = parsed.data
    .filter((item) => item.price == null)
    .map((item) => item.food_merchant_id);
  const upsertRows = parsed.data
    .filter((item): item is { food_merchant_id: string; price: number } => item.price != null)
    .map((item) => ({
      product_variant_id: idResult.data,
      food_merchant_id: item.food_merchant_id,
      price: item.price
    }));

  if (upsertRows.length) {
    const { error } = await supabase
      .from("product_variant_prices")
      .upsert(upsertRows, { onConflict: "product_variant_id,food_merchant_id" });
    if (error) return { error: error.message };
  }

  if (deleteIds.length) {
    const { error } = await supabase
      .from("product_variant_prices")
      .delete()
      .eq("product_variant_id", idResult.data)
      .in("food_merchant_id", deleteIds);
    if (error) return { error: error.message };
  }

  revalidatePath("/masters/products");
  revalidatePath("/transactions");
  return { ok: true };
}

export async function deleteProduct(id: string) {
  await requireAdmin();
  const idResult = IdSchema.safeParse(id);
  if (!idResult.success) return { error: "ID produk tidak valid" };
  const supabase = await createClient();
  const { error } = await supabase.from("product_variants").delete().eq("id", idResult.data);
  if (error) return { error: error.message };
  revalidatePath("/masters/products");
  revalidatePath("/transactions");
  return { ok: true };
}
