
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icons } from '@/components/icons';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/utils';

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        setIsLoading(false);
        return;
    }

    const { data: existingProfile, error: usernameError } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username.trim())
      .single();

    if (usernameError && usernameError.code !== 'PGRST116') {
        setError('Could not verify username. Please try again.');
        setIsLoading(false);
        return;
    }
      
    if (existingProfile) {
      setError('This username is already taken. Please choose another one.');
      setIsLoading(false);
      return;
    }

    const avatar_url = gender === 'male' ? '/user_Avatar/male.png' : '/user_Avatar/female.png';

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                name: name.trim(),
                username: username.trim(),
                gender,
                avatar_url,
            },
        },
    });

    setIsLoading(false);

    if (signUpError) {
        setError(signUpError.message);
    } else if (signUpData.user?.identities?.length === 0) {
        setError("An account with this email address already exists. Please log in instead.");
    } else {
        toast({
            title: "Check your email!",
            description: "We've sent you a confirmation link to verify your email address.",
        });
        router.push('/login');
    }
  };
  
  const handleOAuthLogin = async (provider: 'google' | 'facebook') => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setIsLoading(false);
    if (error) {
      setError(error.message);
    }
  };

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader className="text-center">
        <div className="mb-4 flex justify-center">
            <Icons.logo className="h-12 w-12 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold">Create an Account</CardTitle>
        <CardDescription>Enter your details below to join Krishna Connect</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignup} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Signup Failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
                <Label htmlFor="full-name">Full Name</Label>
                <Input id="full-name" placeholder="John Doe" required value={name} onChange={(e) => setName(e.target.value)} disabled={isLoading} />
            </div>
             <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" placeholder="johndoe" required value={username} onChange={(e) => setUsername(e.target.value)} disabled={isLoading}/>
            </div>
            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="krishna@connect.com" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading}/>
            </div>
            <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                    <Input 
                        id="password" 
                        type={showPassword ? 'text' : 'password'} 
                        required 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        disabled={isLoading}
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
              <Label>Gender</Label>
              <RadioGroup value={gender} onValueChange={(value: 'male' | 'female') => setGender(value)} className="flex items-center space-x-4 pt-1" disabled={isLoading}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="male" id="male" />
                  <Label htmlFor="male" className="font-normal">Prabhuji (Male)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="female" id="female" />
                  <Label htmlFor="female" className="font-normal">Mataji (Female)</Label>
                </div>
              </RadioGroup>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                Create Account
            </Button>
        </form>
        <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or sign up with</span>
            </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" onClick={() => handleOAuthLogin('google')} disabled={isLoading}><Icons.google className="mr-2 h-4 w-4"/>Google</Button>
            <Button variant="outline" onClick={() => handleOAuthLogin('facebook')} disabled={isLoading}><Icons.facebook className="mr-2 h-4 w-4"/>Facebook</Button>
        </div>
        <div className="mt-4 text-center text-sm">
          Already have an account?{' '}
          <Link href="/login" className="underline">
            Login
          </Link>
        </div>
      </CardContent>
      <CardFooter className="text-center text-xs text-muted-foreground">
        <p>
          By creating an account, you agree to our{' '}
          <Link href="/terms-and-conditions" className="underline hover:text-primary">
            Terms &amp; Conditions
          </Link>{' '}
          and{' '}
          <Link href="/privacy-policy" className="underline hover:text-primary">
            Privacy Policy
          </Link>
          .
        </p>
      </CardFooter>
    </Card>
  );
}
