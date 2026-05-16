import { getMerchantTheme } from "@/lib/merchantColors";

export function MerchantBadge({
  name,
  color,
  solid = false
}: {
  name: string | null | undefined;
  color?: string | null;
  solid?: boolean;
}) {
  const t = getMerchantTheme(name, color);
  const style = solid
    ? { backgroundColor: t.bg, color: t.fg }
    : { backgroundColor: t.soft, color: t.softFg, border: `1px solid ${t.ring}` };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      style={style}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: solid ? t.fg : t.bg }}
      />
      {name ?? "-"}
    </span>
  );
}

export function MerchantDot({
  name,
  color
}: { name: string | null | undefined; color?: string | null }) {
  const t = getMerchantTheme(name, color);
  return <span className="inline-block h-2.5 w-2.5 rounded-full mr-1.5 align-middle" style={{ backgroundColor: t.bg }} />;
}
