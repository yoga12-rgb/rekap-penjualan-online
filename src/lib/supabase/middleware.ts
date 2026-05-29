import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { copyPersistentUrlParams, queryString } from "@/lib/urlParams";

function redirectWithPersistentParams(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  const params = new URLSearchParams();
  copyPersistentUrlParams(request.nextUrl.searchParams, params);
  url.pathname = pathname;
  url.search = queryString(params);
  return NextResponse.redirect(url);
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
    return redirectWithPersistentParams(request, "/login");
  }
  if (user && isAuthPage) {
    return redirectWithPersistentParams(request, "/dashboard");
  }

  return response;
}
