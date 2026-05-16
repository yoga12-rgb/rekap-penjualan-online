import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { MerchantsClient } from "./MerchantsClient";

export const dynamic = "force-dynamic";

export default async function MerchantsPage() {
  await requireAdmin();
  const supabase = createClient();
  const { data } = await supabase
    .from("food_merchants")
    .select("id,name,color,created_at")
    .order("name");
  return <MerchantsClient rows={(data ?? []) as any} />;
}
