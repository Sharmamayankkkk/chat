
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
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: "",
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: "",
            ...options,
          })
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Define routes that are accessible to everyone, even without a login.
  const publicRoutes = [
    "/login",
    "/signup",
    "/forgot-password",
    "/update-password",
  ]
  
  // Check if the current route is one of the public routes.
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // Define auth routes where a logged-in user should be redirected away.
  const authRoutes = ["/login", "/signup", "/forgot-password"]
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))

  // If a user is logged in, redirect them away from login, signup, etc.
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/chat", request.url))
  }
  
  // If a user is not logged in and is trying to access a protected route, redirect to login.
  // A route is considered protected if it's NOT in our public list.
  if (!user && !isPublicRoute) {
    // The root path has its own logic below, so we exclude it here.
    if (pathname !== "/") {
      return NextResponse.redirect(new URL("/login", request.url))
    }
  }

  // Handle the root path ("/") separately.
  if (pathname === "/") {
    if (user) {
      return NextResponse.redirect(new URL("/chat", request.url))
    } else {
      return NextResponse.redirect(new URL("/login", request.url))
    }
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
