import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { ProductsClient } from "./ProductsClient";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: rows }, { data: merchants }, { data: prices }] = await Promise.all([
    supabase.from("product_variants").select("id,name,base_price,created_at").order("name"),
    supabase.from("food_merchants").select("id,name,color").order("name"),
    supabase.from("product_variant_prices").select("product_variant_id,food_merchant_id,price")
  ]);
  return (
    <ProductsClient
      rows={(rows ?? []) as any}
      merchants={(merchants ?? []) as any}
      prices={(prices ?? []) as any}
    />
  );
}
