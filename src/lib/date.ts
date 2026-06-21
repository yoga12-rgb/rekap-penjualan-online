/**
 * Helper tanggal aware WIB (Asia/Jakarta, GMT+7).
 * Semua filter, bucket harian, dan input transaksi pakai util ini agar konsisten.
 */

export const WIB_OFFSET = "+07:00";
export const WIB_TZ = "Asia/Jakarta";

/** "YYYY-MM-DD" hari ini di WIB */
export function todayWIBKey(): string {
  return formatWIBDateKey(new Date());
}

/** "YYYY-MM-DD" sebuah Date dilihat di WIB */
export function formatWIBDateKey(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d); // en-CA → "YYYY-MM-DD"
}

/** "YYYY-MM-DD" n hari lalu di kalender WIB */
export function daysAgoWIBKey(n: number): string {
  const todayKey = todayWIBKey();
  const [y, m, d] = todayKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - n);
  return dt.toISOString().slice(0, 10);
}

function dateKeyToUTCDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Tambah/kurangi n hari dari date key kalender. */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const dt = dateKeyToUTCDate(dateKey);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Selisih hari inklusif untuk rentang tanggal. */
export function inclusiveDaysBetween(from: string, to: string): number {
  const start = dateKeyToUTCDate(from).getTime();
  const end = dateKeyToUTCDate(to).getTime();
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

/** Rentang periode sebelumnya dengan panjang hari yang sama. */
export function previousPeriodForRange(
  from: string,
  to: string,
): { from: string; to: string } {
  const length = inclusiveDaysBetween(from, to);
  const previousTo = addDaysToDateKey(from, -1);
  return {
    from: addDaysToDateKey(previousTo, -(length - 1)),
    to: previousTo,
  };
}

export function startOfMonthWIBKey(): string {
  return todayWIBKey().slice(0, 7) + "-01";
}

export function endOfMonthWIBKey(): string {
  const [y, m] = todayWIBKey().split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export function startOfPreviousMonthWIBKey(): string {
  const [y, m] = todayWIBKey().split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
}

export function endOfPreviousMonthWIBKey(): string {
  const [y, m] = todayWIBKey().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
}

export function startOfYearWIBKey(): string {
  return todayWIBKey().slice(0, 4) + "-01-01";
}
export function endOfYearWIBKey(): string {
  return todayWIBKey().slice(0, 4) + "-12-31";
}

/** Validasi date key dari query/input agar tidak mengirim range malformed ke DB. */
export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/** Awal hari WIB sebagai timestamptz untuk Postgres `>=` */
export function wibStartOfDay(dateKey: string): string {
  return `${dateKey}T00:00:00${WIB_OFFSET}`;
}
/** Akhir hari WIB sebagai timestamptz untuk Postgres `<=` */
export function wibEndOfDay(dateKey: string): string {
  return `${dateKey}T23:59:59.999${WIB_OFFSET}`;
}

/**
 * Konversi nilai `<input type="datetime-local">` (tanpa TZ) → ISO dengan offset WIB.
 * "2025-01-15T14:30" → "2025-01-15T14:30:00+07:00"
 */
export function wibLocalToIso(local: string): string {
  if (!local) return local;
  if (/[+-]\d{2}:\d{2}$|Z$/.test(local)) return local; // sudah ada TZ
  const withSec = /T\d{2}:\d{2}$/.test(local) ? local + ":00" : local;
  return withSec + WIB_OFFSET;
}

/**
 * Konversi ISO timestamp dari server → "YYYY-MM-DDTHH:MM" yang dibaca di WIB,
 * cocok untuk default value `<input type="datetime-local">`.
 */
export function isoToWIBLocalInput(iso: string): string {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: WIB_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  // sv-SE → "YYYY-MM-DD HH:MM"
  return fmt.format(d).replace(" ", "T");
}

/** Bucket key tanggal WIB dari ISO timestamp */
export function isoToWIBDateKey(iso: string): string {
  return formatWIBDateKey(new Date(iso));
}

/** Bucket jam WIB dari ISO timestamp, 0-23. */
export function isoToWIBHour(iso: string): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: WIB_TZ,
    hour: "2-digit",
    hour12: false,
  }).format(new Date(iso));
  return Number(hour === "24" ? "0" : hour);
}

/** Hari dalam seminggu di WIB, 0=Senin, 6=Minggu */
export function isoToWIBDayOfWeek(iso: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: WIB_TZ,
    weekday: "short",
  }).format(new Date(iso));
  // Map English short weekday to 0=Senin index
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  return map[fmt] ?? 0;
}

/** Label hari dari indeks (0=Senin, 6=Minggu) */
export function dayOfWeekLabel(index: number): string {
  const labels = [
    "Senin",
    "Selasa",
    "Rabu",
    "Kamis",
    "Jumat",
    "Sabtu",
    "Minggu",
  ];
  return labels[index] ?? "-";
}

/** Format ISO timestamp ke string lokal WIB (untuk export & label tabel). */
export function isoToWIBDisplay(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    timeZone: WIB_TZ,
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** Util untuk normalisasi searchParams `string | string[] | undefined` */
export function firstParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}
