import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";

type SP = { from?: string; to?: string; outlet?: string; merchant?: string; variant?: string };

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from, to };
}

export default async function DashboardPage({ searchParams }: { searchParams: SP }) {
  const profile = await requireProfile();
  const supabase = createClient();

  const def = defaultRange();
  const fromStr = searchParams.from ?? def.from.toISOString().slice(0, 10);
  const toStr = searchParams.to ?? def.to.toISOString().slice(0, 10);
  const outlet = searchParams.outlet ?? "";
  const merchant = searchParams.merchant ?? "";
  const variant = searchParams.variant ?? "";

  const [{ data: outlets }, { data: merchants }, { data: variants }] = await Promise.all([
    supabase.from("outlets").select("id,name").order("name"),
    supabase.from("food_merchants").select("id,name,color").order("name"),
    supabase.from("product_variants").select("id,name").order("name")
  ]);

  let q = supabase
    .from("transactions")
    .select("id, transaction_date, qty, initial_price, deduction_fee, net_profit, outlet_id, food_merchant_id, product_variant_id, outlets(name), food_merchants(name,color), product_variants(name)")
    .gte("transaction_date", `${fromStr}T00:00:00`)
    .lte("transaction_date", `${toStr}T23:59:59`)
    .order("transaction_date", { ascending: true });

  if (profile.role === "kasir" && profile.outlet_id) q = q.eq("outlet_id", profile.outlet_id);
  if (outlet) q = q.eq("outlet_id", outlet);
  if (merchant) q = q.eq("food_merchant_id", merchant);
  if (variant) q = q.eq("product_variant_id", variant);

  const { data: rows } = await q;

  return (
    <DashboardClient
      role={profile.role}
      outlets={outlets ?? []}
      merchants={merchants ?? []}
      variants={variants ?? []}
      rows={(rows ?? []) as any}
      filter={{ from: fromStr, to: toStr, outlet, merchant, variant }}
    />
  );
}
