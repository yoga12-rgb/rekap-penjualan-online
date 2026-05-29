/**
 * Helper untuk menyimpan dan membaca filter dari cookies.
 * Server component bisa membaca cookie dan langsung redirect,
 * sehingga hanya 1 fetch terjadi (tidak ada fetch default dulu).
 */

const DASHBOARD_COOKIE = "dashboard-filters";
const TRANSACTIONS_COOKIE = "transactions-filters";
const ADCOSTS_COOKIE = "adcosts-filters";

/** Key yang valid untuk dashboard filter */
type DashboardParamKey = "from" | "to" | "outlet" | "merchant" | "variant";
/** Key yang valid untuk transactions filter */
type TransactionParamKey = DashboardParamKey | "q";
/** Key yang valid untuk ad-costs filter */
type AdCostsParamKey = "from" | "to" | "outlet" | "merchant";

type DashboardParams = Partial<Record<DashboardParamKey, string>>;
type TransactionParams = Partial<Record<TransactionParamKey, string>>;
type AdCostsParams = Partial<Record<AdCostsParamKey, string>>;

/**
 * Client-side: set cookie filter.
 * path dibatasi ke halaman masing-masing agar tidak dikirim ke halaman lain.
 */
export function setDashboardFilterCookie(params: DashboardParams) {
  const value = JSON.stringify(params);
  document.cookie = `${DASHBOARD_COOKIE}=${encodeURIComponent(value)};path=/;max-age=86400;SameSite=Lax`;
}

export function setTransactionFilterCookie(params: TransactionParams) {
  const value = JSON.stringify(params);
  document.cookie = `${TRANSACTIONS_COOKIE}=${encodeURIComponent(value)};path=/;max-age=86400;SameSite=Lax`;
}

/**
 * Client-side: clear filter cookie (saat reset filter).
 */
export function clearDashboardFilterCookie() {
  document.cookie = `${DASHBOARD_COOKIE}=;path=/;max-age=0;SameSite=Lax`;
}

export function clearTransactionFilterCookie() {
  document.cookie = `${TRANSACTIONS_COOKIE}=;path=/;max-age=0;SameSite=Lax`;
}

/**
 * Client-side: set/clear cookie untuk ad-costs filter.
 */
export function setAdCostsFilterCookie(params: AdCostsParams) {
  const value = JSON.stringify(params);
  document.cookie = `${ADCOSTS_COOKIE}=${encodeURIComponent(value)};path=/;max-age=86400;SameSite=Lax`;
}

export function clearAdCostsFilterCookie() {
  document.cookie = `${ADCOSTS_COOKIE}=;path=/;max-age=0;SameSite=Lax`;
}

/**
 * Server-side: parse cookie value dari cookie header string.
 * Dipanggil di server component page.tsx.
 */
export function parseDashboardFilterFromCookie(
  cookieHeader: string | null,
): DashboardParams | null {
  return parseCookie(cookieHeader, DASHBOARD_COOKIE);
}

export function parseTransactionFilterFromCookie(
  cookieHeader: string | null,
): TransactionParams | null {
  return parseCookie(cookieHeader, TRANSACTIONS_COOKIE);
}

export function parseAdCostsFilterFromCookie(
  cookieHeader: string | null,
): AdCostsParams | null {
  return parseCookie(cookieHeader, ADCOSTS_COOKIE);
}

function parseCookie(
  cookieHeader: string | null,
  name: string,
): Record<string, string> | null {
  if (!cookieHeader) return null;
  try {
    const match = cookieHeader
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${name}=`));
    if (!match) return null;
    const raw = decodeURIComponent(match.slice(name.length + 1));
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
