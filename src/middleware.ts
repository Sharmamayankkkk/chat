
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options })
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl

  // These are routes that can be accessed without a full session
  const publicRoutes = ['/login', '/signup', '/forgot-password', '/update-password', '/auth/callback'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  if (pathname.startsWith('/join/')) {
    return response;
  }
  
  // If the user is logged in
  if (session) {
    // If the user is on the update password page, but not in recovery mode, redirect them.
    if (pathname === '/update-password' && session.user.user_metadata.recovery !== true) {
      return NextResponse.redirect(new URL('/settings', request.url))
    }

    const { data: profile } = await supabase.from('profiles').select('username').eq('id', session.user.id).single();
    const isProfileComplete = profile && profile.username;

    // If profile is incomplete, redirect to the completion page, unless they are already there.
    if (!isProfileComplete && pathname !== '/complete-profile') {
      return NextResponse.redirect(new URL('/complete-profile', request.url));
    }
    
    // If profile is complete but they are on the completion page, redirect to chat.
    if (isProfileComplete && pathname === '/complete-profile') {
      return NextResponse.redirect(new URL('/chat', request.url));
    }

    // If the user is logged in and tries to access login/signup, redirect to chat
    const authRoutes = ['/login', '/signup'];
    if (authRoutes.some(route => pathname.startsWith(route))) {
      return NextResponse.redirect(new URL('/chat', request.url))
    }
  } else {
    // If the user is not logged in and the route is not public, redirect to login
    if (!isPublicRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - and files with extensions like svg, png, jpg, jpeg, gif, wepb
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
