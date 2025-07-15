
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/utils';
import type { User } from '@/lib/types';

export default function CompleteProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            router.push('/login');
            return;
        }

        let profile = null;
        let profileError = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            
            if (data) {
                profile = data;
                profileError = null;
                break;
            }
            profileError = error;
            await new Promise(res => setTimeout(res, 300 * attempt));
        }
        
        if (profileError || !profile) {
            setError("Could not fetch your profile. Please try logging in again.");
            setIsLoading(false);
            console.error("Failed to fetch profile after multiple attempts:", profileError);
            return;
        }

        if (profile.username) {
            router.push('/chat');
            return;
        }
        
        setUser(profile as User);
        setName(profile.name || user.user_metadata.name || '');
        setUsername(profile.username || '');
        setGender(profile.gender || 'male');
        setIsLoading(false);
    };
    fetchUser();
  }, [router, supabase]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setIsLoading(true);

    if (!username.trim()) {
        setError('Username is required.');
        setIsLoading(false);
        return;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        setError('Username can only contain letters, numbers, and underscores.');
        setIsLoading(false);
        return;
    }

    const { data: existingProfile, error: usernameError } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username.trim())
      .neq('id', user.id)
      .single();

    if (usernameError && usernameError.code !== 'PGRST116') { // PGRST116 = no rows found, which is good
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

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        name: name.trim(),
        username: username.trim(),
        gender: gender,
        avatar_url: user.avatar_url || avatar_url
      })
      .eq('id', user.id);

    setIsLoading(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      toast({
        title: "Profile Complete!",
        description: "Welcome to Krishna Connect!",
      });
      router.push('/chat');
      router.refresh();
    }
  };

  if (isLoading || !user) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )
  }

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader className="text-center">
        <div className="mb-4 flex justify-center">
          <Icons.logo className="h-12 w-12 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold">Complete Your Profile</CardTitle>
        <CardDescription>Just a few more details to get you started.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="full-name">Full Name</Label>
            <Input id="full-name" placeholder="John Doe" required value={name} onChange={(e) => setName(e.target.value)} disabled={isLoading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" placeholder="johndoe" required value={username} onChange={(e) => setUsername(e.target.value)} disabled={isLoading} />
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
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save and Continue
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
