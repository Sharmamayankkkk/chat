import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get("code")
    const next = searchParams.get("next") ?? "/chat"

    if (code) {
      const supabase = createClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (!error) {
        // Successful authentication
        return NextResponse.redirect(`${origin}${next}`)
      } else {
        console.error("Auth callback error:", error)
        return NextResponse.redirect(`${origin}/login?error=Authentication failed: ${error.message}`)
      }
    }

    // No code provided
    return NextResponse.redirect(`${origin}/login?error=No authentication code provided`)
  } catch (error) {
    console.error("Auth callback exception:", error)
    const { origin } = new URL(request.url)
    return NextResponse.redirect(`${origin}/login?error=Authentication error occurred`)
  }
}
