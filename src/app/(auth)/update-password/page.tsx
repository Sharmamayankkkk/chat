
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
import { AlertCircle, CheckCircle, Eye, EyeOff, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSessionReady, setIsSessionReady] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    let recoveryEventReceived = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        recoveryEventReceived = true;
        setIsSessionReady(true);
      }
    });

    // After a short delay, check if the recovery event was received.
    // If not, it's likely an invalid link, so we redirect.
    const timer = setTimeout(() => {
        if (!recoveryEventReceived) {
            router.replace('/login?error=Invalid or expired password reset link.')
        }
    }, 3000)

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    }
  }, [router, supabase.auth]);

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
        setError(error.message)
      } else {
        setMessage("Your password has been successfully updated! You will be redirected to the login page.")
        // Sign out to clear the recovery session
        await supabase.auth.signOut()
        setTimeout(() => {
          router.replace("/login?message=Password updated successfully. Please log in.")
        }, 3000)
      }
    } catch (error: any) {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const passwordUpdateForm = (
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
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading || !!message}
            />
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowPassword(prev => !prev)}
                aria-label="Toggle password visibility"
            >
                {showPassword ? <EyeOff /> : <Eye />}
            </Button>
          </div>
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
  );

  const loadingScreen = (
      <div className="flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Verifying reset link...</p>
      </div>
  );

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
        {isSessionReady ? passwordUpdateForm : loadingScreen}
      </CardContent>
    </Card>
  )
}
