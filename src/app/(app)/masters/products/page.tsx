import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { ProductsClient } from "./ProductsClient";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("product_variants").select("id,name,base_price,created_at").order("name");
  return <ProductsClient rows={(data ?? []) as any} />;
}
