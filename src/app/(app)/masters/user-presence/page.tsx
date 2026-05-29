import { requireAdmin } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: "super_admin" | "kasir";
  outlet_id: string | null;
  outlets: { name: string } | { name: string }[] | null;
};

type PresenceRow = {
  user_id: string;
  last_seen_at: string;
  ip_address: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  timezone: string | null;
  user_agent: string | null;
  path: string | null;
};

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
const RECENT_THRESHOLD_MS = 15 * 60 * 1000;

function statusFor(lastSeenAt: string | null) {
  if (!lastSeenAt) return { label: "Offline", tone: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" };
  const age = Date.now() - new Date(lastSeenAt).getTime();
  if (age <= ONLINE_THRESHOLD_MS) {
    return { label: "Online", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200" };
  }
  if (age <= RECENT_THRESHOLD_MS) {
    return { label: "Baru aktif", tone: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200" };
  }
  return { label: "Offline", tone: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" };
}

function formatLastSeen(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function locationText(row: PresenceRow | null) {
  if (!row) return "-";
  const parts = [row.city, row.region, row.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "Tidak tersedia";
}

function deviceText(userAgent: string | null | undefined) {
  if (!userAgent) return "-";
  const browser =
    userAgent.includes("Edg/") ? "Edge" :
    userAgent.includes("Chrome/") ? "Chrome" :
    userAgent.includes("Firefox/") ? "Firefox" :
    userAgent.includes("Safari/") ? "Safari" :
    "Browser";
  const os =
    userAgent.includes("Windows") ? "Windows" :
    userAgent.includes("Android") ? "Android" :
    userAgent.includes("iPhone") || userAgent.includes("iPad") ? "iOS" :
    userAgent.includes("Mac OS") ? "macOS" :
    userAgent.includes("Linux") ? "Linux" :
    "OS";
  return `${browser} / ${os}`;
}

function maskIp(value: string | null | undefined) {
  if (!value) return "-";
  const parts = value.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.xxx.xxx`;
  const ipv6 = value.split(":");
  if (ipv6.length > 2) return `${ipv6.slice(0, 3).join(":")}:xxxx`;
  return value;
}

function outletName(outlets: ProfileRow["outlets"]) {
  if (Array.isArray(outlets)) return outlets[0]?.name ?? null;
  return outlets?.name ?? null;
}

export default async function UserPresencePage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: profiles }, { data: presence }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, outlet_id, outlets(name)")
      .order("full_name"),
    supabase
      .from("user_presence")
      .select("user_id,last_seen_at,ip_address,country,region,city,timezone,user_agent,path")
      .order("last_seen_at", { ascending: false }),
  ]);

  const admin = createAdminClient();
  const { data: usersList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const emailMap = new Map<string, string>(
    (usersList?.users ?? []).map((user: any) => [user.id, user.email ?? ""]),
  );
  const presenceMap = new Map((presence ?? []).map((row: any) => [row.user_id, row as PresenceRow]));
  const rows = ((profiles ?? []) as unknown as ProfileRow[])
    .map((profile) => {
      const activity = presenceMap.get(profile.id) ?? null;
      const status = statusFor(activity?.last_seen_at ?? null);
      return { profile, activity, status };
    })
    .sort((a, b) => {
      const aTime = a.activity?.last_seen_at ? new Date(a.activity.last_seen_at).getTime() : 0;
      const bTime = b.activity?.last_seen_at ? new Date(b.activity.last_seen_at).getTime() : 0;
      return bTime - aTime;
    });

  const onlineCount = rows.filter((row) => row.status.label === "Online").length;
  const recentCount = rows.filter((row) => row.status.label === "Baru aktif").length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">User Online</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Status dihitung dari heartbeat aplikasi. Lokasi adalah perkiraan berdasarkan IP/proxy, bukan GPS.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Summary title="Online" value={onlineCount.toLocaleString("id-ID")} tone="emerald" />
        <Summary title="Baru Aktif" value={recentCount.toLocaleString("id-ID")} tone="amber" />
        <Summary title="Total User" value={rows.length.toLocaleString("id-ID")} tone="sky" />
        <Summary title="Threshold Online" value="2 menit" tone="slate" />
      </div>

      <div className="card overflow-auto">
        <table className="table min-w-[980px]">
          <thead>
            <tr>
              <th>User</th>
              <th>Status</th>
              <th>Last Seen</th>
              <th>IP</th>
              <th>Lokasi</th>
              <th>Device</th>
              <th>Halaman</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ profile, activity, status }) => (
              <tr key={profile.id}>
                <td>
                  <div className="font-semibold">{profile.full_name ?? emailMap.get(profile.id) ?? "User"}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>
                    {emailMap.get(profile.id) ?? "-"} · {profile.role}
                    {profile.role === "kasir" ? ` · ${outletName(profile.outlets) ?? "Tanpa outlet"}` : ""}
                  </div>
                </td>
                <td>
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${status.tone}`}>
                    {status.label}
                  </span>
                </td>
                <td>{formatLastSeen(activity?.last_seen_at ?? null)}</td>
                <td className="font-mono text-xs">{maskIp(activity?.ip_address)}</td>
                <td>
                  <div>{locationText(activity)}</div>
                  {activity?.timezone && (
                    <div className="text-xs" style={{ color: "var(--muted)" }}>{activity.timezone}</div>
                  )}
                </td>
                <td>{deviceText(activity?.user_agent)}</td>
                <td className="font-mono text-xs">{activity?.path ?? "-"}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="py-6 text-center" style={{ color: "var(--muted)" }}>
                  Belum ada user.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Summary({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "emerald" | "amber" | "sky" | "slate";
}) {
  const toneClass = {
    emerald: "border-l-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300",
    amber: "border-l-amber-500 bg-amber-50/80 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300",
    sky: "border-l-sky-500 bg-sky-50/80 dark:bg-sky-950/20 text-sky-700 dark:text-sky-300",
    slate: "border-l-slate-500 bg-slate-50/80 dark:bg-slate-900/40 text-slate-700 dark:text-slate-200",
  }[tone];

  return (
    <div className={`card border-l-4 px-3 py-2.5 ${toneClass}`}>
      <div className="text-xs uppercase font-semibold" style={{ color: "var(--muted)" }}>{title}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
