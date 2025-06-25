'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icons } from '@/components/icons';
import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsSessionReady(true);
      } else if (!session) {
         // If there's no session, they probably landed here directly.
         router.push('/login');
      } else {
        // If there's a normal session, they don't need to be here.
        router.push('/chat');
      }
    });

    // Initial check for a recovery session
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
            // It might take a moment for the session to be established from the URL fragment
            setTimeout(() => {
                supabase.auth.getSession().then(({ data: { session: delayedSession } }) => {
                    if(!delayedSession) router.push('/login');
                });
            }, 500);
        }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, supabase.auth]);
  
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setError(null);
    setMessage(null);
    setIsLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    setIsLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setMessage('Your password has been successfully updated! Redirecting to login...');
      setTimeout(() => {
          supabase.auth.signOut();
          router.push('/login');
      }, 3000);
    }
  };

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
                <Alert variant="default" className="border-green-500/50 text-green-700 dark:border-green-500 [&>svg]:text-green-700">
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
                <p className="text-muted-foreground">Verifying session...</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
