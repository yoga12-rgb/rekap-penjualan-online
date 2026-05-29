import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Path filter yang perlu restore filter dari cookie.
 */
const FILTER_PATHS = ["/dashboard", "/transactions", "/ad-costs"];
const COOKIE_MAP: Record<string, string> = {
  "/dashboard": "dashboard-filters",
  "/transactions": "transactions-filters",
  "/ad-costs": "adcosts-filters",
};

export async function updateSession(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Restore filter dari cookie sebelum page di-render
  // Dilakukan di sini agar seamless (tidak ada skeleton flash)
  if (FILTER_PATHS.includes(pathname) && !search) {
    const cookieName = COOKIE_MAP[pathname];
    const rawCookie = request.cookies.get(cookieName)?.value;

    if (rawCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(rawCookie)) as Record<
          string,
          string
        >;
        const validParams = Object.entries(parsed).filter(([_, v]) => v);

        if (validParams.length > 0) {
          const qs = new URLSearchParams(validParams).toString();
          const url = request.nextUrl.clone();
          url.search = qs;
          return NextResponse.redirect(url);
        }
      } catch {
        // Malformed cookie — lewatkan
      }
    }
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => request.cookies.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove: (name: string, options: CookieOptions) => {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage = pathname.startsWith("/login");
  const isPublic =
    isAuthPage || pathname.startsWith("/_next") || pathname === "/favicon.ico";

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }
  return response;
}
