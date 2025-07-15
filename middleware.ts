
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

  // Define public routes that don't require authentication
  const publicRoutes = [
    '/login', 
    '/signup', 
    '/forgot-password', 
    '/update-password', 
    '/auth/callback',
    '/sitemap.xml'
  ];

  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  // Allow access to public and API routes
  if (isPublicRoute || pathname.startsWith('/api')) {
    return response;
  }
  
  // Redirect to login if no session and trying to access a protected route
  if (!session) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname) // Save the intended destination
    return NextResponse.redirect(url)
  }

  // If user is logged in, check if their profile is complete
  if (session) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', session.user.id)
      .single();

    const isProfileComplete = profile && profile.username;
    
    // Redirect to complete profile if needed
    if (!isProfileComplete && pathname !== '/complete-profile') {
      return NextResponse.redirect(new URL('/complete-profile', request.url));
    }
    
    // If profile is complete, redirect from auth pages to chat
    if (isProfileComplete && (pathname === '/login' || pathname === '/signup' || pathname === '/complete-profile')) {
      return NextResponse.redirect(new URL('/chat', request.url));
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
