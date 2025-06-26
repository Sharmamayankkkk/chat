"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Icons } from "@/components/icons"
import type React from "react"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSessionReady, setIsSessionReady] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    // Check for recovery session on mount
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      console.log("Current session:", session)

      if (session) {
        setIsSessionReady(true)
      } else {
        // Check URL hash for session
        const hash = window.location.hash
        if (hash.includes("access_token")) {
          console.log("Found access token in URL hash")
          // Wait a bit for Supabase to process the hash
          setTimeout(async () => {
            const {
              data: { session: delayedSession },
            } = await supabase.auth.getSession()
            if (delayedSession) {
              setIsSessionReady(true)
            } else {
              console.log("No session found, redirecting to login")
              router.push("/login?error=Invalid reset link")
            }
          }, 1000)
        } else {
          console.log("No session or token found, redirecting to login")
          router.push("/login?error=Invalid reset link")
        }
      }
    }

    checkSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth state change in update-password:", event, !!session)

      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) {
        setIsSessionReady(true)
      } else if (event === "SIGNED_OUT") {
        router.push("/login")
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router, supabase.auth])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.")
      return
    }

    setError(null)
    setMessage(null)
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) {
        console.error("Password update error:", error)
        setError(error.message)
      } else {
        setMessage("Your password has been successfully updated! Redirecting to login...")
        setTimeout(async () => {
          await supabase.auth.signOut()
          router.push("/login?message=Password updated successfully")
        }, 3000)
      }
    } catch (error: any) {
      console.error("Unexpected error:", error)
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader className="text-center">
        <div className="mb-4 flex justify-center">
          <Icons.logo className="h-12 w-12 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold">Update Your Password</CardTitle>
        <CardDescription>Enter a new password for your account below.</CardDescription>
      </CardHeader>
      <CardContent>
        {isSessionReady ? (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {message && (
              <Alert
                variant="default"
                className="border-green-500/50 text-green-700 dark:border-green-500 [&>svg]:text-green-700"
              >
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Success!</AlertTitle>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading || !!message}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading || !!message}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading || !!message}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Password
            </Button>
          </form>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Processing reset link...</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
