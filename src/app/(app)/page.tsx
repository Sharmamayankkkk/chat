"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Icons } from "@/components/icons"
import { useAppContext } from "@/providers/app-provider"

export default function AppHome() {
  const router = useRouter()
  const { user, isReady } = useAppContext()

  useEffect(() => {
    // Only redirect after the app context is ready
    if (isReady) {
      // If user is authenticated, redirect to chat
      if (user) {
        router.replace("/chat")
      } else {
        // If not authenticated, redirect to login
        router.replace("/login")
      }
    }
  }, [user, isReady, router])

  // Show loading state while checking auth
  if (!isReady) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Card className="w-full max-w-md text-center border-0 shadow-none">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary animate-pulse">
              <Icons.logo className="h-10 w-10" />
            </div>
            <CardTitle className="text-2xl font-bold">Loading Krishna Connect</CardTitle>
            <CardDescription>Please wait while we prepare your experience...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // This fallback should rarely be seen due to the redirect above
  return (
    <div className="flex h-full items-center justify-center bg-background">
      <Card className="w-full max-w-md text-center border-0 shadow-none">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icons.logo className="h-10 w-10" />
          </div>
          <CardTitle className="text-2xl font-bold">Welcome to Krishna Connect</CardTitle>
          <CardDescription>Redirecting you to the right place...</CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
