
'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { useAppContext } from "@/providers/app-provider"
import type { User } from '@/lib/'
import { createClient } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const createGroupSchema = z.object({
  name: z.string().min(3, "Group name must be at least 3 characters."),
  description: z.string().optional(),
  members: z.array(z.string()).min(1, "You must select at least one member."),
})

export function CreateGroupDialog({ open, onOpenChange }: CreateGroupDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { loggedInUser } = useAppContext();
  const [allUsers, setAllUsers] = React.useState<User[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const supabase = createClient();

  const form = useForm<z.infer<typeof createGroupSchema>>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: {
      name: '',
      description: '',
      members: [],
    },
  })

  React.useEffect(() => {
    if (open && loggedInUser) {
      const fetchUsers = async () => {
        setIsLoading(true);
        const { data, error } = await supabase.from('profiles').select('*');
        if (error) {
          toast({ variant: 'destructive', title: "Error fetching users", description: error.message });
          setAllUsers([]);
        } else {
          setAllUsers(data as User[]);
        }
        setIsLoading(false);
      };
      fetchUsers();
    } else {
        form.reset();
        setAllUsers([]);
    }
  }, [open, supabase, toast, form, loggedInUser]);

  const onSubmit = async (values: z.infer<typeof createGroupSchema>) => {
    if (!loggedInUser) return;
    setIsCreating(true);

    try {
        // 1. Create the chat.
        const { data: chatData, error: chatError } = await supabase
            .from('chats')
            .insert({
                name: values.name,
                description: values.description,
                avatar_url: `https://placehold.co/100x100.png`,
                type: 'group',
                created_by: loggedInUser.id,
            })
            .select()
            .single();
        
        if (chatError) throw chatError;
        const newChatId = chatData.id;

        // 2. Add participants, including creator.
        const allMemberIds = [...new Set([...values.members, loggedInUser.id])];
        const participantData = allMemberIds.map(userId => {
          const user = allUsers.find(u => u.id === userId);
          // Creator and Gurudev are admins by default
          const isAdmin = userId === loggedInUser.id;
          return {
            chat_id: newChatId,
            user_id: userId,
            is_admin: isAdmin,
          };
        });
        
        const { error: participantsError } = await supabase.from('participants').insert(participantData);
        if (participantsError) throw participantsError;
        
        toast({ title: "Group Created!", description: `The group "${values.name}" has been successfully created.` });
        onOpenChange(false);
        router.push(`/chat/${newChatId}`);
        router.refresh();

    } catch (error: any) {
        console.error("Supabase error details:", error);
        toast({
          variant: 'destructive',
          title: 'Error creating group',
          description: `Database error: ${error.message}. Please ensure RLS policies are correct or disabled for testing.`
        });
    } finally {
        setIsCreating(false);
    }
  }

  const otherUsers = allUsers.filter(u => u.id !== loggedInUser?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create a New Group</DialogTitle>
          <DialogDescription>Fill out the details below to start a new group chat.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={`https://placehold.co/100x100.png`} alt="Group avatar" data-ai-hint="logo symbol" />
                <AvatarFallback>{form.watch('name')?.charAt(0).toUpperCase() || 'G'}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Group Name</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g., Bhagavad Gita Study" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="What is this group about?" className="resize-none" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="members"
              render={() => (
                <FormItem>
                  <FormLabel>Add Members</FormLabel>
                  <ScrollArea className="h-40 w-full rounded-md border p-4">
                  {isLoading ? (
                      <div className="space-y-3">
                          <div className="flex items-center space-x-3"><Skeleton className="h-4 w-4 rounded-full" /><Skeleton className="h-4 w-2/3" /></div>
                          <div className="flex items-center space-x-3"><Skeleton className="h-4 w-4 rounded-full" /><Skeleton className="h-4 w-1/2" /></div>
                          <div className="flex items-center space-x-3"><Skeleton className="h-4 w-4 rounded-full" /><Skeleton className="h-4 w-3/4" /></div>
                      </div>
                  ) : otherUsers.length > 0 ? (
                    otherUsers.map((user) => (
                      <FormField
                        key={user.id}
                        control={form.control}
                        name="members"
                        render={({ field }) => (
                          <FormItem key={user.id} className="flex flex-row items-start space-x-3 space-y-0 mb-3">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(user.id)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...field.value, user.id])
                                    : field.onChange(field.value?.filter((value) => value !== user.id))
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal flex items-center gap-2 cursor-pointer">
                               <Avatar className="h-6 w-6">
                                    <AvatarImage src={user.avatar_url} alt={user.name} />
                                    <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                {user.name}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-center text-muted-foreground py-4">No other users found to add.</p>
                  )}
                  </ScrollArea>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isCreating}>{isCreating ? 'Creating...' : 'Create Group'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
