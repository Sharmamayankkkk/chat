'use client';

import Link from 'next/link';
import { notFound, useParams, useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAppContext } from "@/providers/app-provider";
import { Badge } from '@/components/ui/badge';
import { MessageSquare, UserX, Users, ArrowLeft, ShieldCheck, UserCheck, ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/utils';
import type { User, Chat } from '@/lib';
import { useState, useEffect, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
// import { ReportDialog } from '../components/report-dialog'; // We'll re-add this later
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useToast } from '@/hooks/use-toast';

function ProfilePageLoader() {
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
              <div className="mt-6 flex flex-col gap-2 w-full">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="md:col-span-2 space-y-8">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}


export default function UserProfilePage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const { toast } = useToast();
  
  // --- UPDATED: Destructuring from AppContext ---
  // We are now using the new state and functions from the provider
  const {
    loggedInUser,
    isReady,
    chats,
    addChat,
    relationships,      // NEW: Replaces dmRequests and blockedUsers
    followUser,         // NEW: Replaces sendFollowRequest
    approveFollow,      // NEW: Replaces approveFollowRequest
    rejectFollow,       // NEW: For rejecting a request
    unfollowUser,       // NEW: Replaces unfollowUser & cancelFollowRequest
    blockUser,
    unblockUser,
  } = useAppContext();
  // --- END OF UPDATES ---

  const [user, setUser] = useState<User | null>(null);
  const [mutualGroups, setMutualGroups] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!isReady) return;

    if (!loggedInUser || params.username === loggedInUser.username) {
      router.push('/profile');
      return;
    }
    
    const fetchUserData = async () => {
      setIsLoading(true);
      
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', params.username)
        .single();
      
      if (userError || !userData) {
        setIsLoading(false); // Make sure loader stops
        notFound();
        return;
      }
      setUser(userData as User);

      // This logic for mutual groups is fine
      const { data: participantData } = await supabase
        .from('participants')
        .select('chat_id')
        .eq('user_id', loggedInUser.id);
      
      const userChatIds = participantData?.map(p => p.chat_id) || [];
      
      if (userChatIds.length > 0) {
        const { data: mutualChatData } = await supabase
          .from('chats')
          .select('*, participants!inner(user_id)')
          .in('id', userChatIds)
          .eq('participants.user_id', userData.id)
          .eq('type', 'group');
          
        setMutualGroups(mutualChatData as unknown as Chat[]);
      }

      setIsLoading(false);
    };

    fetchUserData();

  }, [params.username, loggedInUser, isReady, router, supabase]);


  // --- NEW: Logic to derive relationship statuses ---
  // We use `useMemo` so this logic only re-runs when the data changes

  // Check my relationship TO this user (am I following/blocking them?)
  const myRelationship = useMemo(() => {
    if (!relationships || !loggedInUser || !user) return null;
    return relationships.find(r => r.user_one_id === loggedInUser.id && r.user_two_id === user.id);
  }, [relationships, loggedInUser, user]);

  // Check their relationship TO me (are they following me?)
  const theirRelationship = useMemo(() => {
    if (!relationships || !loggedInUser || !user) return null;
    return relationships.find(r => r.user_one_id === user.id && r.user_two_id === loggedInUser.id);
  }, [relationships, loggedInUser, user]);

  // Derive simple boolean states from these relationships
  const isBlockedByMe = myRelationship?.status === 'blocked';
  const iAmBlocked = theirRelationship?.status === 'blocked';
  const isFollowing = myRelationship?.status === 'approved';
  const isPending = myRelationship?.status === 'pending'; // I sent a request
  const hasPendingRequestFrom_them = theirRelationship?.status === 'pending'; // They sent me a request
  const isMutualFollow = isFollowing && theirRelationship?.status === 'approved';
  
  // --- END OF NEW LOGIC ---

  
  // This function is for the "Send Message" button
  const handleSendMessage = async () => {
    if (!loggedInUser || !user) return;

    // Check if a DM chat already exists in the context
    const existingChat = chats.find(c =>
      c.type === 'dm' &&
      c.participants?.length === 2 &&
      c.participants.some(p => p.user_id === loggedInUser.id) &&
      c.participants.some(p => p.user_id === user.id)
    );

    if (existingChat) {
      router.push(`/chat/${existingChat.id}`);
      return;
    }

    // If not, create a new one
    try {
      const { data: chatData, error: chatError } = await supabase
        .from('chats')
        .insert({ type: 'dm', created_by: loggedInUser.id })
        .select()
        .single();
      
      if (chatError) throw chatError;
      const newChatId = chatData.id;

      const participantData = [
        { chat_id: newChatId, user_id: loggedInUser.id },
        { chat_id: newChatId, user_id: user.id }
      ];
      
      const { error: participantsError } = await supabase.from('participants').insert(participantData);
      if (participantsError) throw participantsError;

      const { data: newFullChat, error: newChatError } = await supabase
        .from('chats')
        .select(`*, participants:participants!chat_id(*, profiles!user_id(*))`)
        .eq('id', newChatId)
        .single();

      if (newChatError || !newFullChat) throw newChatError || new Error("Failed to fetch newly created chat.");

      addChat({ ...newFullChat, messages: [] } as unknown as Chat);
      router.push(`/chat/${newChatId}`);
    } catch (error: any) {
       console.error("Error creating new chat:", error);
       toast({ variant: 'destructive', title: "Error starting chat", description: error.message });
    }
  };


  if (isLoading || !user || !loggedInUser) {
    return <ProfilePageLoader />;
  }

  // --- NEW: Button rendering logic ---
  const renderFollowButton = () => {
    // We don't show follow buttons if a block is in place
    if (isBlockedByMe || iAmBlocked) {
      return null;
    }

    // Case 1: They sent me a follow request
    if (hasPendingRequestFrom_them) {
      return (
        <>
          <Button onClick={() => approveFollow(user.id)}>Approve Request</Button>
          <Button variant="outline" onClick={() => rejectFollow(user.id)}>Reject</Button>
        </>
      );
    }

    // Case 2: I am following them
    if (isFollowing) {
      return (
        <Button variant="outline" onClick={() => unfollowUser(user.id)}>
          Following
        </Button>
      );
    }

    // Case 3: I sent them a request
    if (isPending) {
      return (
        <Button variant="outline" onClick={() => unfollowUser(user.id)}>
          Requested
        </Button>
      );
    }

    // Default Case: No relationship, I can follow them
    return (
      <Button onClick={() => followUser(user.id)}>
        Follow
      </Button>
    );
  };
  // --- END OF NEW BUTTON LOGIC ---

  const getRoleBadge = () => {
    return <Badge variant="outline">User</Badge>;
  };

  return (
    <div className="flex h-full flex-col">
      {/* <ReportDialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen} userToReport={user} /> */}
      
      <header className="flex items-center gap-4 p-4 border-b bg-background sticky top-0 z-10">
        <SidebarTrigger className="md:hidden" />
        <h2 className="text-xl font-bold tracking-tight">{user.name}'s Profile</h2>
      </header>
      <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="md:col-span-1">
            <Card>
              <CardContent className="p-6 flex flex-col items-center text-center">
                <Avatar className="h-24 w-24 mb-4 ring-2 ring-primary ring-offset-2 ring-offset-background">
                  <AvatarImage
                    src={user.avatar_url}
                    alt={user.name}
                    data-ai-hint="avatar"
                  />
                  <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <h3 className="text-xl font-semibold">{user.name}</h3>
                <p className="text-muted-foreground">@{user.username}</p>
                
                <div className="mt-6 flex flex-col gap-2 w-full">
                  
                  {/* --- UPDATED: Button Section --- */}
                  
                  {/* NEW: Show "Send Message" only on mutual follow */}
                  {isMutualFollow && !isBlockedByMe && !iAmBlocked && (
                    <Button onClick={handleSendMessage}>
                      <MessageSquare className="mr-2 h-4 w-4" /> Send Message
                    </Button>
                  )}
                  
                  {/* Render the new dynamic follow/pending/approve button(s) */}
                  {renderFollowButton()}

                  {/* The Block button now uses the new `isBlockedByMe` state */}
                  {!iAmBlocked && ( // Don't show block button if they blocked you
                    <Button 
                      variant="outline" 
                      onClick={() => isBlockedByMe ? unblockUser(user.id) : blockUser(user.id)}
                      // Don't allow blocking if you have a pending request from them
                      disabled={hasPendingRequestFrom_them}
                    >
                      {isBlockedByMe ? <UserCheck className="mr-2 h-4 w-4" /> : <UserX className="mr-2 h-4 w-4" />}
                      {isBlockedByMe ? 'Unblock User' : 'Block User'}
                    </Button>
                  )}
                  
                   {/* We'll re-enable this after updating ReportDialog */}
                   {/* <Button variant="destructive" onClick={() => setIsReportDialogOpen(true)}>
                    <ShieldAlert className="mr-2 h-4 w-4" /> Report User
                  </Button> */}

                  {/* --- END OF UPDATED BUTTONS --- */}

                </div>
              </CardContent>
            </Card>
          </div>
          <div className="md:col-span-2 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>About {user.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                 <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Gender</p>
                    <p className="text-foreground">
                      {user.gender === "male"
                        ? "Prabhuji (Male)"
                        : user.gender === "female"
                        ? "Mataji (Female)"
                        : "Not specified"}
                    </p>
                  </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Bio</p>
                  <p className="text-foreground italic">
                    {user.bio || "This user hasn't written a bio yet."}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Role</p>
                  <div>{getRoleBadge()}</div>
                </div>
              </CardContent>
            </Card>
            
            {mutualGroups.length > 0 && (
               <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      Shared Groups
                    </CardTitle>
                    <CardDescription>Groups you are both a member of.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {mutualGroups.map(group => (
                        <Link key={group.id} href={`/chat/${group.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={group.avatar_url} alt={group.name} data-ai-hint="group symbol" />
                                    <AvatarFallback>{group.name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold">{group.name}</p>
                                    <p className="text-sm text-muted-foreground">{group.participants?.length} members</p>
                                </div>
                            </div>
                        </Link>
                    ))}
                  </CardContent>
                </Card>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}