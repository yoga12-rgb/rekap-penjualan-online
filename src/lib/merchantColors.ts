/**
 * Warna brand per Food Merchant.
 *
 * Urutan resolusi:
 *  1. `customHex` (warna kustom tersimpan di DB) — diutamakan
 *  2. PRESETS (regex match nama: gofood/grab/shopee)
 *  3. Palet fallback berbasis hash nama
 */

export type MerchantTheme = {
  bg: string;
  fg: string;
  ring: string;
  soft: string;
  softFg: string;
};

const PRESETS: { match: RegExp; theme: MerchantTheme }[] = [
  {
    match: /gofood|go-food|gojek/i,
    theme: { bg: "#e11d2a", fg: "#ffffff", ring: "#e11d2a40", soft: "#fee2e2", softFg: "#b91c1c" }
  },
  {
    match: /grabfood|grab-food|grab/i,
    theme: { bg: "#00b14f", fg: "#ffffff", ring: "#00b14f40", soft: "#d1fae5", softFg: "#047857" }
  },
  {
    match: /shopee/i,
    theme: { bg: "#ee4d2d", fg: "#ffffff", ring: "#ee4d2d40", soft: "#ffedd5", softFg: "#c2410c" }
  }
];

const FALLBACK_PALETTE: MerchantTheme[] = [
  { bg: "#6366f1", fg: "#fff", ring: "#6366f140", soft: "#e0e7ff", softFg: "#4338ca" },
  { bg: "#0ea5e9", fg: "#fff", ring: "#0ea5e940", soft: "#e0f2fe", softFg: "#0369a1" },
  { bg: "#a855f7", fg: "#fff", ring: "#a855f740", soft: "#f3e8ff", softFg: "#7e22ce" },
  { bg: "#f59e0b", fg: "#fff", ring: "#f59e0b40", soft: "#fef3c7", softFg: "#b45309" },
  { bg: "#14b8a6", fg: "#fff", ring: "#14b8a640", soft: "#ccfbf1", softFg: "#0f766e" },
  { bg: "#ec4899", fg: "#fff", ring: "#ec489940", soft: "#fce7f3", softFg: "#be185d" }
];

function hashIdx(s: string, mod: number) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
}

/** Konversi hex (#rrggbb) → {r,g,b} */
function hexToRgb(hex: string) {
  const m = /^#?([a-f\d]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Pilih warna teks (putih/hitam) berdasarkan kontras WCAG sederhana. */
function pickFg(bg: string) {
  const rgb = hexToRgb(bg);
  if (!rgb) return "#ffffff";
  const lum = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return lum > 0.6 ? "#0f172a" : "#ffffff";
}

/** Bangun theme dari hex tunggal: bg + fg auto + soft (dengan alpha) */
function themeFromHex(hex: string): MerchantTheme {
  const fg = pickFg(hex);
  return {
    bg: hex,
    fg,
    ring: `${hex}40`,
    soft: `${hex}1f`,
    softFg: hex
  };
}

export function getMerchantTheme(
  name: string | null | undefined,
  customHex?: string | null
): MerchantTheme {
  if (customHex && /^#[0-9a-fA-F]{6}$/.test(customHex)) {
    return themeFromHex(customHex.toLowerCase());
  }
  if (!name) return FALLBACK_PALETTE[0];
  for (const p of PRESETS) if (p.match.test(name)) return p.theme;
  return FALLBACK_PALETTE[hashIdx(name, FALLBACK_PALETTE.length)];
}

/** Util: dapatkan hex bg yang akan dipakai (untuk inisialisasi color picker) */
export function resolvedHex(name: string | null | undefined, customHex?: string | null) {
  return getMerchantTheme(name, customHex).bg;
}
