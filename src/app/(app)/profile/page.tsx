'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAppContext } from "@/providers/app-provider";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck, Loader2, LockKeyhole } from "lucide-react"; // Added LockKeyhole
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";
import { SidebarTrigger } from "@/components/ui/sidebar";

function ProfilePageLoader() {
  // ... (loader component is unchanged)
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-48" />
      </div>
      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-1">
          <Card>
            <CardContent className="p-6 flex flex-col items-center text-center">
              <Skeleton className="h-24 w-24 rounded-full mb-4" />
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-32 mt-4" />
            </CardContent>
          </Card>
        </div>
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
              <CardDescription>Update your personal information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Skeleton className="h-4 w-12" /><Skeleton className="h-10 w-full" /></div>
                <div className="space-y-2"><Skeleton className="h-4 w-12" /><Skeleton className="h-10 w-full" /></div>
                <div className="space-y-2"><Skeleton className="h-4 w-12" /><Skeleton className="h-10 w-full" /></div>
                <div className="space-y-2"><Skeleton className="h-4 w-12" /><Skeleton className="h-10 w-full" /></div>
              </div>
              <div className="space-y-2"><Skeleton className="h-4 w-12" /><Skeleton className="h-20 w-full" /></div>
              <div className="flex justify-end"><Skeleton className="h-10 w-28" /></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


export default function ProfilePage() {
  const { loggedInUser, updateUser, isReady } = useAppContext();
  const { toast } = useToast();
  const router = useRouter();
  const supabase = createClient();
  
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isReady && !loggedInUser) {
      router.push('/login');
    }
    if (loggedInUser) {
        setName(loggedInUser.name);
        setUsername(loggedInUser.username);
        setBio(loggedInUser.bio || '');
        setAvatarPreview(loggedInUser.avatar_url);
    }
  }, [loggedInUser, isReady, router]);


  if (!isReady || !loggedInUser) {
    return <ProfilePageLoader />;
  }
  
  const getRoleBadge = (verified?: boolean) => {
    if (verified) {
        return <Badge variant="secondary" className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Verified</Badge>;
    }
    return <Badge variant="outline">User</Badge>;
  };

  const handleSaveChanges = async () => {
    if (!loggedInUser) return;
    setIsSaving(true);
    let newAvatarUrl = loggedInUser.avatar_url;

    try {
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `public/${loggedInUser.id}/avatar.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('attachments')
          .getPublicUrl(filePath);

        newAvatarUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;
      }
      
      // We pass the is_private value from loggedInUser to ensure it doesn't get reset
      await updateUser({
          name,
          username,
          bio,
          avatar_url: newAvatarUrl,
          is_private: loggedInUser.is_private 
      });

      setAvatarFile(null);
      toast({
        title: "Profile Updated",
        description: "Your changes have been saved successfully.",
      });

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: "Error updating profile",
        description: error.message
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setAvatarPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex h-full flex-col">
       <input
        type="file"
        ref={avatarInputRef}
        onChange={handleAvatarChange}
        className="hidden"
        accept="image/*"
      />
      <header className="flex items-center gap-4 p-4 border-b bg-background sticky top-0 z-10">
        <SidebarTrigger className="md:hidden" />
        <h2 className="text-xl font-bold tracking-tight">My Profile</h2>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="md:col-span-1">
            <Card>
              <CardContent className="p-6 flex flex-col items-center text-center">
                <Avatar className="h-24 w-24 mb-4">
                  <AvatarImage
                    src={avatarPreview}
                    alt={loggedInUser.name}
                    data-ai-hint="avatar"
                  />
                  <AvatarFallback>{name.charAt(0)}</AvatarFallback>
                </Avatar>
                
                {/* --- UPDATED: Added Lock Icon --- */}
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  {name}
                  {loggedInUser.is_private && (
                    <LockKeyhole className="h-5 w-5 text-muted-foreground" />
                  )}
                </h3>
                {/* --- END UPDATE --- */}
                
                <p className="text-muted-foreground">@{username}</p>
                <Button className="mt-4" onClick={() => avatarInputRef.current?.click()}>Change Avatar</Button>
              </CardContent>
            </Card>
          </div>
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Account Details</CardTitle>
                <CardDescription>Update your personal information.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} />
                  </div>
                   <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Input
                      id="gender"
                      value={
                        loggedInUser.gender === "male"
                          ? "Prabhuji (Male)"
                          : loggedInUser.gender === "female"
                          ? "Mataji (Female)"
                          : "Not specified"
                      }
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={loggedInUser.email || ''}
                      disabled
                    />
                  </div>
                  <div className="space-y-2 col-span-full">
                    <Label htmlFor="role">Role</Label>
                    <div className="w-min">
                      {getRoleBadge(loggedInUser.verified)}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    placeholder="Tell us a little bit about yourself"
                    className="resize-none"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveChanges} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}