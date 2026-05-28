"use server";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, type Profile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const AdCostSchema = z.object({
  cost_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
  outlet_id: z.string().uuid(),
  food_merchant_id: z.string().uuid(),
  amount: z.coerce.number().nonnegative(),
  note: z.string().trim().max(300).optional()
});

const IdSchema = z.string().uuid();

function cleanPayload(formData: FormData, profile: Profile) {
  const raw = Object.fromEntries(formData);
  if (profile.role === "kasir") {
    if (!profile.outlet_id) return { error: "Profil kasir belum diassign ke outlet" } as const;
    raw.outlet_id = profile.outlet_id;
  }

  const parsed = AdCostSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" } as const;
  return {
    data: {
      ...parsed.data,
      note: parsed.data.note?.trim() || null
    }
  } as const;
}

export async function upsertAdCost(formData: FormData) {
  const profile = await requireProfile();
  const payload = cleanPayload(formData, profile);
  if ("error" in payload) return { error: payload.error };
  const data = payload.data;

  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("daily_ad_costs")
    .select("id")
    .eq("cost_date", data.cost_date)
    .eq("outlet_id", data.outlet_id)
    .eq("food_merchant_id", data.food_merchant_id)
    .maybeSingle();
  if (readError) return { error: readError.message };

  const { error } = existing
    ? await supabase.from("daily_ad_costs").update(data).eq("id", existing.id)
    : await supabase.from("daily_ad_costs").insert({ ...data, created_by: profile.id });

  if (error) return { error: error.message };
  revalidatePath("/ad-costs");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateAdCost(id: string, formData: FormData) {
  const profile = await requireProfile();
  const idResult = IdSchema.safeParse(id);
  if (!idResult.success) return { error: "ID biaya iklan tidak valid" };

  const payload = cleanPayload(formData, profile);
  if ("error" in payload) return { error: payload.error };
  const data = payload.data;

  const supabase = await createClient();
  const { error } = await supabase.from("daily_ad_costs").update(data).eq("id", idResult.data);
  if (error) return { error: error.message };
  revalidatePath("/ad-costs");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteAdCost(id: string) {
  await requireProfile();
  const idResult = IdSchema.safeParse(id);
  if (!idResult.success) return { error: "ID biaya iklan tidak valid" };

  const supabase = await createClient();
  const { error } = await supabase.from("daily_ad_costs").delete().eq("id", idResult.data);
  if (error) return { error: error.message };
  revalidatePath("/ad-costs");
  revalidatePath("/dashboard");
  return { ok: true };
}
