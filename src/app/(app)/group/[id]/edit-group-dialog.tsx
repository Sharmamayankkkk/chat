
'use client'

import * as React from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { useAppContext } from "@/providers/app-provider"
import type { Chat, User, Participant } from '@/lib/types'
import { UserPlus, UserX, Loader2, Upload, RefreshCcw, Copy } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { createClient } from '@/lib/utils'
import { v4 as uuidv4 } from 'uuid';

interface EditGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: Chat;
}

export function EditGroupDialog({ open, onOpenChange, group }: EditGroupDialogProps) {
  const { allUsers, loggedInUser } = useAppContext();
  const { toast } = useToast();
  const supabase = createClient();

  const [name, setName] = React.useState(group.name || '');
  const [description, setDescription] = React.useState(group.description || '');
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = React.useState(group.avatar_url || '');
  const [participants, setParticipants] = React.useState<Participant[]>(group.participants);
  const [isLoading, setIsLoading] = React.useState(false);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);
  const [isPublic, setIsPublic] = React.useState(group.is_public);
  const [historyVisible, setHistoryVisible] = React.useState(group.history_visible);
  const [inviteCode, setInviteCode] = React.useState(group.invite_code);

  React.useEffect(() => {
    if (open) {
      setName(group.name || '');
      setDescription(group.description || '');
      setAvatarPreview(group.avatar_url || '');
      setParticipants(group.participants);
      setIsPublic(group.is_public);
      setHistoryVisible(group.history_visible);
      setInviteCode(group.invite_code);
      setAvatarFile(null);
    }
  }, [group, open]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleToggleAdmin = (userId: string) => {
    setParticipants(prev => prev.map(p => p.user_id === userId ? { ...p, is_admin: !p.is_admin } : p));
  };

  const handleRemoveMember = (userId: string) => {
    setParticipants(prev => prev.filter(p => p.user_id !== userId));
  };

  const handleAddMember = (user: User) => {
    if (!participants.some(p => p.user_id === user.id)) {
      setParticipants(prev => [...prev, {
        user_id: user.id,
        chat_id: group.id,
        is_admin: user.role === 'gurudev', // Gurudev is admin by default
        profiles: user
      }]);
    }
  };

  const copyInviteLink = () => {
    if (inviteCode) {
      const link = `${window.location.origin}/join/${inviteCode}`;
      navigator.clipboard.writeText(link);
      toast({ title: "Invite link copied!" });
    }
  }

  const handleSaveChanges = async () => {
    setIsLoading(true);
    try {
      // 1. Update chat info (name, description, avatar, settings, invite code)
      let avatar_url = group.avatar_url;
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `public/${group.id}/avatar.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('attachments').upload(filePath, avatarFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(filePath);
        avatar_url = `${urlData.publicUrl}?t=${new Date().getTime()}`; // Add timestamp to bust cache
      }

      const { error: chatUpdateError } = await supabase.from('chats')
        .update({ 
            name, 
            description, 
            avatar_url,
            is_public: isPublic,
            history_visible: historyVisible,
            invite_code: inviteCode
        })
        .eq('id', group.id);
      if (chatUpdateError) throw chatUpdateError;

      // 2. Sync participants
      const originalParticipantIds = new Set(group.participants.map(p => p.user_id));
      const newParticipantIds = new Set(participants.map(p => p.user_id));
      
      const toAdd = participants.filter(p => !originalParticipantIds.has(p.user_id));
      const toRemove = group.participants.filter(p => !newParticipantIds.has(p.user_id));
      const toUpdate = participants.filter(p => {
        const original = group.participants.find(op => op.user_id === p.user_id);
        return original && original.is_admin !== p.is_admin;
      });

      if (toAdd.length > 0) {
        const { error } = await supabase.from('participants').insert(toAdd.map(p => ({
          chat_id: p.chat_id, user_id: p.user_id, is_admin: p.is_admin
        })));
        if (error) throw error;
      }

      if (toRemove.length > 0) {
        const { error } = await supabase.from('participants').delete().in('user_id', toRemove.map(p => p.user_id)).eq('chat_id', group.id);
        if (error) throw error;
      }
      
      if (toUpdate.length > 0) {
        for (const p of toUpdate) {
            const { error } = await supabase.from('participants').update({ is_admin: p.is_admin }).match({ chat_id: p.chat_id, user_id: p.user_id });
            if (error) throw error;
        }
      }

      toast({ title: "Group Updated", description: `${name} has been updated successfully.` });
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error saving changes", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const otherUsers = allUsers.filter(u => !participants.some(p => p.user_id === u.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Group: {group.name}</DialogTitle>
          <DialogDescription>Modify the group's details and manage members.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="space-y-6 py-4">
            <div className="flex items-center gap-6">
              <div className="relative">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={avatarPreview} alt="Group avatar" />
                  <AvatarFallback>{name?.charAt(0).toUpperCase() || 'G'}</AvatarFallback>
                </Avatar>
                <Button type="button" size="sm" variant="outline" className="absolute -bottom-2 -right-2" onClick={() => avatarInputRef.current?.click()}>
                  <Upload className="h-3 w-3 mr-1" />
                  Change
                </Button>
                <input type="file" ref={avatarInputRef} onChange={handleAvatarChange} className="hidden" accept="image/*" />
              </div>
              <div className="flex-1 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="group-name">Group Name</Label>
                  <Input id="group-name" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="group-description">Description</Label>
                  <Textarea id="group-description" value={description} onChange={e => setDescription(e.target.value)} className="resize-none" />
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="settings" className="space-y-6 py-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label>Public Group</Label>
                <p className="text-xs text-muted-foreground">Allow anyone with the link to join.</p>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>
             <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label>Chat History</Label>
                <p className="text-xs text-muted-foreground">Allow new members to see past messages.</p>
              </div>
              <Switch checked={historyVisible} onCheckedChange={setHistoryVisible} />
            </div>
            <div className="space-y-2">
                <Label>Invite Link</Label>
                {inviteCode ? (
                    <div className="flex gap-2">
                      <Input readOnly value={`${window.location.origin}/join/${inviteCode}`} />
                      <Button variant="secondary" size="icon" onClick={copyInviteLink}><Copy className="h-4 w-4" /></Button>
                      <Button variant="destructive" size="icon" onClick={() => setInviteCode(null)}><UserX className="h-4 w-4" /></Button>
                    </div>
                ) : (
                    <Button variant="outline" className="w-full" onClick={() => setInviteCode(uuidv4())}>Generate Invite Link</Button>
                )}
            </div>
          </TabsContent>

          <TabsContent value="members" className="py-4">
            <TooltipProvider>
              <ScrollArea className="h-80 pr-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Current Members ({participants.length})</h4>
                    <div className="space-y-3">
                      {participants.map(p => (
                        <div key={p.user_id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                          <div className="flex items-center gap-3 mb-3 sm:mb-0">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={p.profiles.avatar_url} alt={p.profiles.name} />
                              <AvatarFallback>{p.profiles.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold">{p.profiles.name}</p>
                              <p className="text-xs text-muted-foreground">@{p.profiles.username}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between">
                            <div className="flex items-center space-x-2">
                              <Switch id={`admin-switch-${p.user_id}`} checked={p.is_admin} onCheckedChange={() => handleToggleAdmin(p.user_id)} disabled={p.user_id === loggedInUser?.id} aria-label={`Toggle admin status for ${p.profiles.name}`} />
                              <Label htmlFor={`admin-switch-${p.user_id}`} className="text-sm font-normal cursor-pointer">Admin</Label>
                            </div>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveMember(p.user_id)} disabled={p.user_id === loggedInUser?.id}>
                                  <UserX className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Remove from group</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">Add New Members</h4>
                    <div className="space-y-2">
                      {otherUsers.length > 0 ? otherUsers.map(user => (
                        <div key={user.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={user.avatar_url} alt={user.name} />
                              <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span>{user.name}</span>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => handleAddMember(user)}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Add
                          </Button>
                        </div>
                      )) : <p className="text-sm text-muted-foreground text-center py-4">All users are already in the group.</p>}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TooltipProvider>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleSaveChanges} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
