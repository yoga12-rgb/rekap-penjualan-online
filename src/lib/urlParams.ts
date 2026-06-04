export type ThemeParam = "light" | "dark" | "system";
export type FilterScope = "dashboard" | "transactions" | "adCosts" | "surveys";

export const THEME_PARAM = "theme";
export const SIDEBAR_PARAM = "sidebar";

const FILTER_PREFIX: Record<FilterScope, string> = {
  dashboard: "dash",
  transactions: "tx",
  adCosts: "ad",
  surveys: "survey",
};

const FILTER_KEYS: Record<FilterScope, string[]> = {
  dashboard: ["from", "to", "outlet", "merchant", "variant"],
  transactions: ["from", "to", "outlet", "merchant", "variant", "q"],
  adCosts: ["from", "to", "outlet", "merchant"],
  surveys: ["tab", "from", "to", "outlet"],
};

function scopeForPathname(pathname: string): FilterScope | null {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return "dashboard";
  }
  if (pathname === "/transactions" || pathname.startsWith("/transactions/")) {
    return "transactions";
  }
  if (pathname === "/ad-costs" || pathname.startsWith("/ad-costs/")) {
    return "adCosts";
  }
  if (pathname === "/surveys" || pathname.startsWith("/surveys/")) {
    return "surveys";
  }
  return null;
}

function scopedName(scope: FilterScope, key: string) {
  return `${FILTER_PREFIX[scope]}_${key}`;
}

export function isThemeParam(value: string | null | undefined): value is ThemeParam {
  return value === "light" || value === "dark" || value === "system";
}

export function themeParam(value: string | null | undefined): ThemeParam {
  return isThemeParam(value) ? value : "system";
}

export function copyPersistentUrlParams(
  source: URLSearchParams,
  target: URLSearchParams,
) {
  const theme = source.get(THEME_PARAM);
  if (isThemeParam(theme)) target.set(THEME_PARAM, theme);

  if (source.get(SIDEBAR_PARAM) === "collapsed") {
    target.set(SIDEBAR_PARAM, "collapsed");
  }

  for (const scope of Object.keys(FILTER_KEYS) as FilterScope[]) {
    for (const key of FILTER_KEYS[scope]) {
      const value = source.get(scopedName(scope, key));
      if (value) target.set(scopedName(scope, key), value);
    }
  }
}

export function setScopedFilterParams(
  scope: FilterScope,
  target: URLSearchParams,
  values: Record<string, string>,
) {
  for (const key of FILTER_KEYS[scope]) {
    const value = values[key];
    if (value) {
      target.set(scopedName(scope, key), value);
    } else {
      target.delete(scopedName(scope, key));
    }
  }
}

export function clearScopedFilterParams(
  scope: FilterScope,
  target: URLSearchParams,
) {
  for (const key of FILTER_KEYS[scope]) {
    target.delete(scopedName(scope, key));
  }
}

function copyCurrentPageFilters(
  currentPathname: string,
  source: URLSearchParams,
  target: URLSearchParams,
) {
  const scope = scopeForPathname(currentPathname);
  if (!scope) return;
  for (const key of FILTER_KEYS[scope]) {
    const value = source.get(key);
    if (value) target.set(scopedName(scope, key), value);
  }
}

export function queryString(params: URLSearchParams) {
  const value = params.toString();
  return value ? `?${value}` : "";
}

export function hrefWithPersistentParams(
  href: string,
  source: URLSearchParams,
) {
  const params = new URLSearchParams();
  copyPersistentUrlParams(source, params);
  return `${href}${queryString(params)}`;
}

export function hrefWithCurrentOrPersistentParams(
  href: string,
  currentPathname: string,
  source: URLSearchParams,
) {
  const isCurrentPage =
    currentPathname === href || currentPathname.startsWith(`${href}/`);
  if (isCurrentPage) return `${href}${queryString(source)}`;

  const params = new URLSearchParams();
  copyPersistentUrlParams(source, params);
  copyCurrentPageFilters(currentPathname, source, params);
  return `${href}${queryString(params)}`;
}
