import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { OutletsClient } from "./OutletsClient";

export const dynamic = "force-dynamic";

export default async function OutletsPage() {
  await requireAdmin();
  const supabase = createClient();
  const { data } = await supabase.from("outlets").select("id,name,created_at").order("name");
  return <OutletsClient rows={data ?? []} />;
}
