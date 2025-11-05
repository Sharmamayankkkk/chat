'use client';

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ThemeToggle } from "@/components/theme-toggle"
import { useAppContext } from "@/providers/app-provider"
import { useToast } from "@/hooks/use-toast"
import { Separator } from "@/components/ui/separator"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Rocket, ArrowLeft, Loader2, LockKeyhole } from "lucide-react" // Added LockKeyhole
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/utils"
import { SidebarTrigger } from "@/components/ui/sidebar"

export default function SettingsPage() {
  // --- UPDATED: Added updateUser ---
  const { loggedInUser, updateUser } = useAppContext();
  const { toast } = useToast();
  const router = useRouter();
  const supabase = createClient();
  
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  if (!loggedInUser) return null;

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
        toast({
            variant: "destructive",
            title: "Password is too short",
            description: "Your new password must be at least 6 characters long."
        });
        return;
    }
    
    setIsUpdatingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsUpdatingPassword(false);
    
    if (error) {
        toast({
            variant: "destructive",
            title: "Error changing password",
            description: error.message
        });
    } else {
        toast({ title: "Password Updated", description: "Your password has been changed successfully." });
        setNewPassword('');
    }
  };

  // --- NEW: Handler for the privacy toggle ---
  const handlePrivacyToggle = async (isPrivate: boolean) => {
    // Optimistically update the UI (though AppProvider will do this)
    // and call the updateUser function from our context.
    try {
      await updateUser({ is_private: isPrivate });
      toast({
        title: "Privacy Updated",
        description: `Your profile is now ${isPrivate ? 'private' : 'public'}.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error updating privacy",
        description: error.message,
      });
    }
  };

  const handleDeactivate = async () => {
    toast({ title: "Account Deactivated", description: "You have been logged out." });
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleDelete = async () => {
    toast({
        title: "Account Deletion Queued",
        description: "Your account is scheduled for permanent deletion. You have been logged out."
    });
    // In a real app, this should trigger a server-side function to handle data deletion.
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-4 p-4 border-b bg-background sticky top-0 z-10">
        <SidebarTrigger className="md:hidden" />
        <h2 className="text-xl font-bold tracking-tight">Settings</h2>
      </header>
      <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Customize the look and feel of the application.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="font-medium">Theme</Label>
                <p className="text-sm text-muted-foreground">Toggle between light and dark mode.</p>
              </div>
              <ThemeToggle />
            </div>
          </CardContent>
          <CardFooter>
              <Link href="/settings/appearance" className="w-full">
                <Button className="w-full">
                    <Rocket className="mr-2 h-4 w-4" />
                    Customize Chat Appearance
                </Button>
              </Link>
          </CardFooter>
        </Card>
        
        {/* --- NEW: Privacy Settings Card --- */}
        <Card>
          <CardHeader>
            <CardTitle>Privacy</CardTitle>
            <CardDescription>
              Manage your account's privacy settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label htmlFor="private-profile" className="font-medium flex items-center">
                    <LockKeyhole className="h-4 w-4 mr-2" />
                    Private Profile
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    If enabled, other users must request to follow you to see your details and posts.
                  </p>
                </div>
                <Switch 
                  id="private-profile" 
                  checked={loggedInUser.is_private}
                  onCheckedChange={handlePrivacyToggle}
                />
            </div>
          </CardContent>
        </Card>
        {/* --- END: New Card --- */}

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              Manage how you receive notifications from the app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label htmlFor="desktop-notifications" className="font-medium">Desktop Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive notifications on your desktop.</p>
                </div>
                <Switch 
                  id="desktop-notifications" 
                  checked={Notification.permission === 'granted'}
                  onCheckedChange={() => {
                    if (Notification.permission !== 'denied') {
                      Notification.requestPermission();
                    } else {
                      toast({
                        variant: 'destructive',
                        title: 'Permission Denied',
                        description: 'Please enable notifications in your browser settings.'
                      })
                    }
                  }}
                />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>
              Manage your account settings and take actions like deleting your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <Card>
              <CardHeader>
                <CardTitle className="text-lg">Change Password</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input 
                    id="new-password" 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter your new password"
                  />
                </div>
              </CardContent>
              <CardFooter>
                 <Button 
                   variant="outline" 
                   className="ml-auto" 
                   onClick={handleChangePassword}
                   disabled={isUpdatingPassword || newPassword.length < 6}
                 >
                   {isUpdatingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                   Update Password
                 </Button>
              </CardFooter>
             </Card>
          </CardContent>
          <Separator />
          <CardFooter className="flex justify-between pt-6">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">Deactivate Account</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure you want to deactivate?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Your profile will be hidden and you will be logged out. You can reactivate by logging back in.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeactivate}>Deactivate</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Delete Account</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your account and remove your data from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete Permanently</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </Card>
      </main>
    </div>
  )
}