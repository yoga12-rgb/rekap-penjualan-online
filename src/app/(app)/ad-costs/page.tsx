import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { AdCostsClient } from "./AdCostsClient";
import { todayWIBKey, daysAgoWIBKey, firstParam, isValidDateKey } from "@/lib/date";

export const dynamic = "force-dynamic";

type SP = {
  from?: string | string[];
  to?: string | string[];
  outlet?: string | string[];
  merchant?: string | string[];
};

export default async function AdCostsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const params = await searchParams;

  const rawFrom = firstParam(params.from);
  const rawTo = firstParam(params.to);
  let from = isValidDateKey(rawFrom) ? rawFrom : daysAgoWIBKey(29);
  let to = isValidDateKey(rawTo) ? rawTo : todayWIBKey();
  let rangeWasReversed = false;
  if (from > to) {
    [from, to] = [to, from];
    rangeWasReversed = true;
  }

  const outlet = profile.role === "super_admin" ? firstParam(params.outlet) : "";
  const merchant = firstParam(params.merchant);

  let rowsQuery = supabase
    .from("daily_ad_costs")
    .select("id,cost_date,outlet_id,food_merchant_id,amount,note,created_at,outlets(name),food_merchants(name,color)")
    .gte("cost_date", from)
    .lte("cost_date", to)
    .order("cost_date", { ascending: false })
    .order("created_at", { ascending: false });

  let outletsQuery = supabase.from("outlets").select("id,name").order("name");
  if (profile.role === "kasir") {
    rowsQuery = profile.outlet_id ? rowsQuery.eq("outlet_id", profile.outlet_id) : rowsQuery.is("outlet_id", null);
    outletsQuery = profile.outlet_id ? outletsQuery.eq("id", profile.outlet_id) : outletsQuery.is("id", null);
  }
  if (outlet) rowsQuery = rowsQuery.eq("outlet_id", outlet);
  if (merchant) rowsQuery = rowsQuery.eq("food_merchant_id", merchant);

  const [{ data: rows }, { data: outlets }, { data: merchants }] = await Promise.all([
    rowsQuery,
    outletsQuery,
    supabase.from("food_merchants").select("id,name,color").order("name")
  ]);

  return (
    <AdCostsClient
      rows={(rows ?? []) as any}
      role={profile.role}
      myOutletId={profile.outlet_id}
      outlets={outlets ?? []}
      merchants={(merchants ?? []) as any}
      filter={{ from, to, outlet, merchant, rangeWasReversed }}
    />
  );
}
