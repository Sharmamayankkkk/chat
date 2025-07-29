
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  // This response object is used to set cookies on the client.
  // It's a pass-through response that will be returned if no redirects are needed.
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create a Supabase client that can be used in this server-side middleware.
  // It's configured to read and write cookies to the request/response.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // Securely get the session from the server.
  const { data: { session } } = await supabase.auth.getSession();

  const { pathname } = request.nextUrl;

  // Define public routes that don't require authentication.
  const publicRoutes = [
    '/login', 
    '/signup', 
    '/forgot-password', 
    '/update-password', 
    '/auth/callback',
    '/terms-and-conditions',
    '/privacy-policy',
    '/sitemap.xml'
  ];
  
  // Check if the current path is a public route or an internal API/asset route.
  // If so, let the request through without authentication checks.
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  if (isPublicRoute || pathname.startsWith('/api') || pathname.startsWith('/join/')) {
    return response;
  }
  
  // If there's no active session, redirect the user to the login page.
  // We also append a 'next' query parameter to redirect them back to their
  // intended page after they log in.
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // If there is a session, check if the user has completed their profile.
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', session.user.id)
    .single();

  const isProfileComplete = profile && profile.username;
  
  // If the profile is not complete, redirect them to the /complete-profile page,
  // unless they are already on it.
  if (!isProfileComplete && pathname !== '/complete-profile') {
    return NextResponse.redirect(new URL('/complete-profile', request.url));
  }
  
  // If the profile is complete, but they are trying to access an auth page (like login),
  // redirect them to the main chat application.
  if (isProfileComplete && (pathname === '/login' || pathname === '/signup' || pathname === '/complete-profile')) {
    return NextResponse.redirect(new URL('/chat', request.url));
  }

  // If all checks pass, allow the request to proceed to the intended page.
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - and files with common image/asset extensions.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
