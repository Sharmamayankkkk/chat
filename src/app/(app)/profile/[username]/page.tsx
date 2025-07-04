
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
import type { User, Chat } from '@/lib/types';
import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ReportDialog } from '../../components/report-dialog';

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
  const { loggedInUser, isReady, blockUser, unblockUser, blockedUsers, chats, addChat } = useAppContext();
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
        notFound();
        return;
      }
      setUser(userData as User);

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


  if (isLoading || !user || !loggedInUser) {
    return <ProfilePageLoader />;
  }
  
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

      // Fetch the full new chat object to add to context and navigate
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
       alert(`Error creating chat: ${error.message}`);
    }
  };
  
  const getRoleBadge = (role?: 'user' | 'admin' | 'gurudev', is_admin?: boolean) => {
    if (role === 'gurudev') {
      return <Badge variant="destructive">Gurudev</Badge>;
    }
    if (is_admin) {
      return <Badge variant="secondary" className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Admin</Badge>;
    }
    return <Badge variant="outline">User</Badge>;
  };
  
  const isBlocked = blockedUsers.includes(user.id);
  const canSendMessage = (loggedInUser.is_admin || user.role !== 'gurudev') && !isBlocked;

  return (
    <>
      <ReportDialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen} userToReport={user} />
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
          </Button>
          <h2 className="text-3xl font-bold tracking-tight">{user.name}'s Profile</h2>
        </div>
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
                  <Button onClick={handleSendMessage} disabled={!canSendMessage}>
                    <MessageSquare className="mr-2 h-4 w-4" /> Send Message
                  </Button>
                  <Button variant="outline" onClick={() => isBlocked ? unblockUser(user.id) : blockUser(user.id)}>
                    {isBlocked ? <UserCheck className="mr-2 h-4 w-4" /> : <UserX className="mr-2 h-4 w-4" />}
                    {isBlocked ? 'Unblock User' : 'Block User'}
                  </Button>
                   <Button variant="destructive" onClick={() => setIsReportDialogOpen(true)}>
                    <ShieldAlert className="mr-2 h-4 w-4" /> Report User
                  </Button>
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
                  <div>{getRoleBadge(user.role, user.is_admin)}</div>
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
      </div>
    </>
  );
}
