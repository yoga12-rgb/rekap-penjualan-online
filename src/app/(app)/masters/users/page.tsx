import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { UsersClient } from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requireAdmin();
  const supabase = createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, outlet_id")
    .order("full_name");
  const { data: outlets } = await supabase.from("outlets").select("id,name").order("name");

  // Ambil email dari auth.users via service role (perlu SUPABASE_SERVICE_ROLE_KEY)
  const admin = createAdminClient();
  const { data: usersList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const emailMap = new Map<string, string>(
    (usersList?.users ?? []).map((u: any) => [u.id, u.email ?? ""])
  );

  const rows = (profiles ?? []).map((p: any) => ({
    ...p,
    email: emailMap.get(p.id) ?? null
  }));

  return <UsersClient rows={rows as any} outlets={(outlets ?? []) as any} />;
}
