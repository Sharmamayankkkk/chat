
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
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  
  const publicRoutes = ['/login', '/signup', '/forgot-password', '/update-password', '/auth/callback', '/complete-profile'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  if (pathname.startsWith('/join/')) {
    return response;
  }

  // If the user is not logged in and the route is not public, redirect to login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // If the user is logged in, check if their profile is complete
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single();
    
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
    const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));
    if (isAuthRoute) {
      return NextResponse.redirect(new URL('/chat', request.url))
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
