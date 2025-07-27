
'use client';

import { notFound, useParams, useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAppContext } from "@/providers/app-provider";
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Users, Shield, ArrowLeft, Trash2, LogOut, Link as LinkIcon, Settings, EyeOff, Copy, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import React from 'react';
import { EditGroupDialog } from './edit-group-dialog';
import type { Chat } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarTrigger } from '@/components/ui/sidebar';

export default function GroupInfoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { chats, loggedInUser, leaveGroup, deleteGroup, isReady } = useAppContext();
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  
  const group = chats.find(c => c.id === Number(params.id) && (c.type === 'group' || c.type === 'channel'));

  if (!isReady) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-8 md:grid-cols-3">
          <Skeleton className="h-64 md:col-span-1" />
          <div className="md:col-span-2 space-y-8">
            <Skeleton className="h-32" />
            <Skeleton className="h-48" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (!group || !group.participants) {
    notFound();
  }

  const isAdmin = group.participants.find(p => p.user_id === loggedInUser?.id)?.is_admin;
  
  const displayedParticipants = group.participants.filter(p => {
    // Hide Gurudev from non-admins
    if (p.profiles.role === 'gurudev' && !loggedInUser?.is_admin) {
      return false;
    }
    return true; // Show everyone else
  });

  const handleLeaveGroup = () => {
    leaveGroup(group.id);
    toast({ title: `You have left ${group.name}` });
    router.push('/chat');
  };

  const handleDeleteGroup = () => {
    deleteGroup(group.id);
    toast({ title: `${group.name} has been deleted`, variant: 'destructive' });
    router.push('/chat');
  };

  const copyInviteLink = () => {
    if(group.invite_code) {
      const link = `${window.location.origin}/join/${group.invite_code}`;
      navigator.clipboard.writeText(link);
      toast({ title: "Invite link copied!" });
    }
  }

  return (
    <div className="flex h-full flex-col">
      <EditGroupDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} group={group} />
      <header className="flex items-center gap-4 p-4 border-b bg-background sticky top-0 z-10">
        <SidebarTrigger className="md:hidden" />
        <h2 className="text-xl font-bold tracking-tight">{group.name} Info</h2>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="md:col-span-1">
            <Card>
              <CardContent className="p-6 flex flex-col items-center text-center">
                <Avatar className="h-24 w-24 mb-4 ring-2 ring-primary ring-offset-2 ring-offset-background">
                  <AvatarImage
                    src={group.avatar_url}
                    alt={group.name}
                    data-ai-hint="group symbol"
                  />
                  <AvatarFallback>{group.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <h3 className="text-xl font-semibold">{group.name}</h3>
                <p className="text-muted-foreground flex items-center gap-2 mt-1">
                  <Users className="h-4 w-4" /> {group.participants?.length} members
                </p>
                
                <div className="mt-6 flex flex-col gap-2 w-full">
                  <Button onClick={() => router.push(`/chat/${group.id}`)}>
                    <MessageSquare className="mr-2 h-4 w-4" /> Go to Chat
                  </Button>
                  
                  {isAdmin && (
                    <Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>
                      <Settings className="mr-2 h-4 w-4" /> Edit Group
                    </Button>
                  )}

                  {isAdmin ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Delete Group
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the group for everyone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteGroup} className="bg-destructive hover:bg-destructive/90">
                            Delete Group
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="text-destructive">
                          <LogOut className="mr-2 h-4 w-4" /> Leave Group
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure you want to leave?</AlertDialogTitle>
                          <AlertDialogDescription>
                            You will be removed from {group.name} and will no longer receive messages.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleLeaveGroup}>Leave</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="md:col-span-2 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>About this {group.type}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground italic">
                  {group.description || `This is the ${group.name} ${group.type}.`}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Group Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Group Type</p>
                  <Badge variant="secondary" className="capitalize">{group.is_public ? 'Public' : 'Private'}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <p className="font-medium">History for New Members</p>
                  <Badge variant="secondary" className="capitalize">{group.history_visible ? 'Visible' : 'Hidden'}</Badge>
                </div>
                {isAdmin && group.invite_code && (
                  <div className="space-y-2">
                    <Label>Invite Link</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={`${window.location.origin}/join/${group.invite_code}`} />
                      <Button variant="secondary" size="icon" onClick={copyInviteLink}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Members</CardTitle>
                <CardDescription>People in this {group.type}.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                  {displayedParticipants.map(participant => (
                      <div key={participant.user_id} className="flex items-center justify-between">
                          <Link href={`/profile/${participant.profiles.username}`} className="flex items-center gap-3 group">
                              <Avatar className="h-10 w-10">
                                  <AvatarImage src={participant.profiles.avatar_url} alt={participant.profiles.name} data-ai-hint="avatar" />
                                  <AvatarFallback>{participant.profiles.name.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div>
                                  <p className="font-semibold group-hover:underline">{participant.profiles.name}</p>
                                  <p className="text-sm text-muted-foreground">@{participant.profiles.username}</p>
                              </div>
                          </Link>
                          <div className="flex items-center gap-2">
                            {participant.profiles.role === 'gurudev' && <Badge variant="destructive">Gurudev</Badge>}
                            {participant.is_admin && participant.profiles.role !== 'gurudev' && <Badge variant="secondary" className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Admin</Badge>}
                          </div>
                      </div>
                  ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
