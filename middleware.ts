import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: "",
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    }
  );

  // Refresh session if expired - required for Server Components
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const { pathname, origin } = request.nextUrl;

  const publicRoutes = [
    "/login",
    "/signup",
    "/forgot-password",
    "/update-password",
    "/auth/callback",
  ];
  const authRoutes = ["/login", "/signup"];

  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );
  const isAuthRoute = authRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Handle auth callback route
  if (pathname.startsWith("/auth/callback")) {
    return response;
  }

  // If there's an error getting the user, treat as unauthenticated
  if (error) {
    console.error("Auth error in middleware:", error);
    if (!isPublicRoute) {
      const redirectUrl = new URL("/login", origin);
      redirectUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(redirectUrl);
    }
    return response;
  }

  // Unauthenticated user trying to access a protected route
  if (!user && !isPublicRoute) {
    const redirectUrl = new URL("/login", origin);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Authenticated user trying to access auth route
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/chat", origin));
  }

  // Root redirect for authenticated users
  if (user && pathname === "/") {
    return NextResponse.redirect(new URL("/chat", origin));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};