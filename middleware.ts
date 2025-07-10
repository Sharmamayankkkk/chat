import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set(name, "", { ...options, maxAge: -1 });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, origin, searchParams } = request.nextUrl;

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

  return res;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
