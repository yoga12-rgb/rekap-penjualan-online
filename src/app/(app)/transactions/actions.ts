"use server";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { wibLocalToIso } from "@/lib/date";

const ItemSchema = z.object({
  id: z.string().uuid().optional(),
  product_variant_id: z.string().uuid(),
  qty: z.coerce.number().int().positive(),
  initial_price: z.coerce.number().nonnegative()
});

const OrderSchema = z.object({
  outlet_id: z.string().uuid(),
  order_number: z.string().trim().max(80).optional(),
  food_merchant_id: z.string().uuid(),
  transaction_date: z.string().min(1),
  deduction_fee: z.coerce.number().nonnegative(),
  items: z.array(ItemSchema).min(1)
});

const UpdateOrderSchema = OrderSchema.extend({
  order_id: z.string().uuid()
});

/** Bagi nominal komisi proporsional ke tiap baris berdasarkan omset.
 *  Sisa pembulatan dimasukkan ke baris dengan omset terbesar. */
function splitFeeProportional(items: { gross: number }[], totalFee: number): number[] {
  const totalGross = items.reduce((a, b) => a + b.gross, 0);
  if (totalGross <= 0 || totalFee <= 0) return items.map(() => 0);
  const raw = items.map((i) => Math.round((i.gross / totalGross) * totalFee));
  const diff = totalFee - raw.reduce((a, b) => a + b, 0);
  if (diff !== 0) {
    let idx = 0;
    let max = -1;
    items.forEach((it, i) => { if (it.gross > max) { max = it.gross; idx = i; } });
    raw[idx] += diff;
  }
  return raw;
}

export async function createOrder(payload: unknown) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const parsed = OrderSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  let outlet_id = parsed.data.outlet_id;
  if (profile.role === "kasir") {
    if (!profile.outlet_id) return { error: "Profil kasir belum diassign ke outlet" };
    outlet_id = profile.outlet_id;
  }

  const { items, food_merchant_id, transaction_date, deduction_fee } = parsed.data;
  const order_number = parsed.data.order_number?.trim() || null;
  const grosses = items.map((it) => ({ gross: it.qty * it.initial_price }));
  const fees = splitFeeProportional(grosses, deduction_fee);

  // Generate satu order_id di sisi DB? Lebih simpel: kirim crypto.randomUUID
  const order_id = crypto.randomUUID();
  const tx_iso = wibLocalToIso(transaction_date);

  const rows = items.map((it, i) => ({
    order_id,
    order_number,
    outlet_id,
    food_merchant_id,
    transaction_date: tx_iso,
    product_variant_id: it.product_variant_id,
    qty: it.qty,
    initial_price: it.initial_price,
    deduction_fee: fees[i],
    created_by: profile.id
  }));

  const { error } = await supabase.from("transactions").insert(rows);
  if (error) return { error: error.message };

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateOrder(payload: unknown) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const parsed = UpdateOrderSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const { order_id, items, food_merchant_id, transaction_date, deduction_fee } = parsed.data;
  const order_number = parsed.data.order_number?.trim() || null;

  const { data: existingRows, error: readError } = await supabase
    .from("transactions")
    .select("id")
    .eq("order_id", order_id);
  if (readError) return { error: readError.message };
  if (!existingRows?.length) return { error: "Transaksi tidak ditemukan" };

  let outlet_id = parsed.data.outlet_id;
  if (profile.role === "kasir") {
    if (!profile.outlet_id) return { error: "Profil kasir belum diassign ke outlet" };
    outlet_id = profile.outlet_id;
  }

  const grosses = items.map((it) => ({ gross: it.qty * it.initial_price }));
  const fees = splitFeeProportional(grosses, deduction_fee);
  const tx_iso = wibLocalToIso(transaction_date);
  const existingIds = new Set(existingRows.map((row) => row.id));
  const keptIds = new Set(items.map((item) => item.id).filter(Boolean));

  const removedIds = [...existingIds].filter((id) => !keptIds.has(id));
  if (removedIds.length) {
    const { error } = await supabase.from("transactions").delete().in("id", removedIds);
    if (error) return { error: error.message };
  }

  for (const [i, item] of items.entries()) {
    const row = {
      order_id,
      order_number,
      outlet_id,
      food_merchant_id,
      transaction_date: tx_iso,
      product_variant_id: item.product_variant_id,
      qty: item.qty,
      initial_price: item.initial_price,
      deduction_fee: fees[i]
    };

    if (item.id && existingIds.has(item.id)) {
      const { error } = await supabase.from("transactions").update(row).eq("id", item.id);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from("transactions").insert({ ...row, created_by: profile.id });
      if (error) return { error: error.message };
    }
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteOrder(orderId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().eq("order_id", orderId);
  if (error) return { error: error.message };
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { ok: true };
}
