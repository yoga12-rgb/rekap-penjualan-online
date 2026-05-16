import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { TransactionsClient } from "./TransactionsClient";

export const dynamic = "force-dynamic";

type SP = {
  from?: string;
  to?: string;
  outlet?: string;
  merchant?: string;
  variant?: string;
  q?: string;
};

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10)
  };
}

export default async function TransactionsPage({ searchParams }: { searchParams: SP }) {
  const profile = await requireProfile();
  const supabase = createClient();
  const def = defaultRange();

  const filter = {
    from: searchParams.from ?? def.from,
    to: searchParams.to ?? def.to,
    outlet: searchParams.outlet ?? "",
    merchant: searchParams.merchant ?? "",
    variant: searchParams.variant ?? "",
    q: searchParams.q ?? ""
  };

  const [{ data: outlets }, { data: merchants }, { data: variants }] = await Promise.all([
    supabase.from("outlets").select("id,name").order("name"),
    supabase.from("food_merchants").select("id,name,color").order("name"),
    supabase.from("product_variants").select("id,name,base_price").order("name")
  ]);

  let q = supabase
    .from("transactions")
    .select("id, order_id, transaction_date, qty, initial_price, deduction_fee, net_profit, outlet_id, food_merchant_id, product_variant_id, outlets(name), food_merchants(name,color), product_variants(name)")
    .gte("transaction_date", `${filter.from}T00:00:00`)
    .lte("transaction_date", `${filter.to}T23:59:59`)
    .order("transaction_date", { ascending: false })
    .limit(1000);

  if (filter.outlet) q = q.eq("outlet_id", filter.outlet);
  if (filter.merchant) q = q.eq("food_merchant_id", filter.merchant);
  if (filter.variant) q = q.eq("product_variant_id", filter.variant);

  const { data: rows } = await q;

  return (
    <TransactionsClient
      role={profile.role}
      myOutletId={profile.outlet_id}
      outlets={outlets ?? []}
      merchants={merchants ?? []}
      variants={(variants ?? []) as any}
      rows={(rows ?? []) as any}
      filter={filter}
    />
  );
}
