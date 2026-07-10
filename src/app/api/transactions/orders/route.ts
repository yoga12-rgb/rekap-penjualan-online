import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  isValidDateKey,
  todayWIBKey,
  daysAgoWIBKey,
} from "@/lib/date";
import { uuidParam } from "@/lib/utils";
import { EMPTY_TRANSACTION_ORDER_PAGE } from "@/app/(app)/transactions/transactionData";

const MAX_LIMIT = 48;

function boundedInteger(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 0), max);
}

function sanitizeSearchTerm(value: string | null) {
  return (value ?? "").trim().slice(0, 100);
}

export async function GET(request: Request) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const searchParams = new URL(request.url).searchParams;

  const rawFrom = searchParams.get("from") ?? "";
  const rawTo = searchParams.get("to") ?? "";
  let from = isValidDateKey(rawFrom) ? rawFrom : daysAgoWIBKey(6);
  let to = isValidDateKey(rawTo) ? rawTo : todayWIBKey();
  if (from > to) [from, to] = [to, from];

  const outlet =
    profile.role === "super_admin"
      ? uuidParam(searchParams.get("outlet") ?? "")
      : "";
  const merchant = uuidParam(searchParams.get("merchant") ?? "");
  const variant = uuidParam(searchParams.get("variant") ?? "");
  const q = sanitizeSearchTerm(searchParams.get("q"));
  const is_fake = searchParams.get("is_fake") || "all";
  const offset = boundedInteger(searchParams.get("offset"), 0, 1000000);
  const limit = boundedInteger(searchParams.get("limit"), 12, MAX_LIMIT);

  const { data, error } = await (supabase as any).rpc(
    "get_transaction_order_page",
    {
      p_from: from,
      p_to: to,
      p_outlet: outlet || null,
      p_merchant: merchant || null,
      p_variant: variant || null,
      p_q: q || null,
      p_offset: offset,
      p_limit: limit,
      p_is_fake: is_fake,
    },
  );

  if (error) {
    return NextResponse.json(
      { ...EMPTY_TRANSACTION_ORDER_PAGE, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(data ?? EMPTY_TRANSACTION_ORDER_PAGE);
}
