import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const profile = await requireProfile();
  if (profile.role !== "super_admin") {
    return NextResponse.json({ error: "Access Denied" }, { status: 403 });
  }

  const supabase = await createClient();
  const searchParams = new URL(request.url).searchParams;

  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const groupBy = searchParams.get("group_by") ?? "day";

  if (!from || !to) {
    return NextResponse.json({ error: "Missing from/to parameters" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("get_revenue_matrix", {
    p_from: from,
    p_to: to,
    p_group_by: groupBy,
    p_outlet: null,
    p_merchant: null,
  });

  if (error) {
    console.error("Matrix API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
