import { NextRequest, NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const MAX_TEXT = 255;
const HEARTBEAT_MIN_INTERVAL_MS = 15_000;

const lastHeartbeatByUser = new Map<string, number>();

function clean(value: string | null | undefined, max = MAX_TEXT) {
  if (!value) return null;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    decoded = value;
  }
  decoded = decoded.trim();
  return decoded ? decoded.slice(0, max) : null;
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return clean(forwardedFor.split(",")[0]);
  return (
    clean(request.headers.get("x-real-ip")) ??
    clean(request.headers.get("cf-connecting-ip")) ??
    clean(request.headers.get("x-vercel-forwarded-for"))
  );
}

function getLocation(request: NextRequest) {
  return {
    country: clean(request.headers.get("x-vercel-ip-country") ?? request.headers.get("cf-ipcountry"), 80),
    region: clean(request.headers.get("x-vercel-ip-country-region"), 120),
    city: clean(request.headers.get("x-vercel-ip-city"), 120),
  };
}

async function readBody(request: NextRequest) {
  try {
    return (await request.json()) as { path?: string; timezone?: string };
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = Date.now();
  const previous = lastHeartbeatByUser.get(profile.id) ?? 0;
  if (now - previous < HEARTBEAT_MIN_INTERVAL_MS) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  lastHeartbeatByUser.set(profile.id, now);

  const body = await readBody(request);
  const supabase = await createClient();
  const location = getLocation(request);
  const { error } = await supabase.from("user_presence").upsert(
    {
      user_id: profile.id,
      last_seen_at: new Date().toISOString(),
      ip_address: getClientIp(request),
      country: location.country,
      region: location.region,
      city: location.city,
      timezone: clean(body.timezone, 120),
      user_agent: clean(request.headers.get("user-agent"), 500),
      path: clean(body.path, 180),
    },
    { onConflict: "user_id" },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
