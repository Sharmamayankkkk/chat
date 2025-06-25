
'use client'

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, ShieldCheck } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { createClient } from '@/lib/utils';
import type { User } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/providers/app-provider';

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();
  const { toast } = useToast();
  const { loggedInUser } = useAppContext();
  const router = useRouter();

  const fetchUsers = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
        .from('profiles')
        .select(`*`)
        .order('name', { ascending: true });

    if (error) {
      console.error("Error fetching users:", error);
      toast({ variant: 'destructive', title: "Error fetching users", description: error.message });
      setUsers([]);
    } else {
       const formattedUsers = data.map((u: any) => ({
           ...u,
           email: u.user_email?.email
       }));
      setUsers(formattedUsers as User[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const toggleAdminStatus = async (user: User) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_admin: !user.is_admin })
      .eq('id', user.id);
    
    if (error) {
      toast({ variant: 'destructive', title: "Error updating user", description: error.message });
    } else {
      toast({ title: "User updated", description: `${user.name} is now ${!user.is_admin ? 'an admin' : 'a regular user'}.`});
      fetchUsers(); // Re-fetch users to update UI
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
  }
  
  const viewProfile = (username: string) => {
    router.push(`/profile/${username}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <CardDescription>
          View and manage all registered users in the system.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="flex flex-col gap-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : (
              users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                       <AvatarImage src={user.avatar_url} alt={user.name} data-ai-hint="avatar" />
                       <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <div className="font-medium">{user.name}</div>
                      <div className="text-sm text-muted-foreground">
                        @{user.username}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{user.email || 'N/A'}</TableCell>
                <TableCell className="capitalize">
                  {user.gender === 'male' ? 'Prabhuji' : user.gender === 'female' ? 'Mataji' : 'N/A'}
                </TableCell>
                <TableCell>
                  {getRoleBadge(user.role, user.is_admin)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-haspopup="true" size="icon" variant="ghost" disabled={user.id === loggedInUser?.id}>
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Toggle menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => toggleAdminStatus(user)} disabled={user.role === 'gurudev'}>
                        {user.is_admin ? 'Remove Admin' : 'Make Admin'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => viewProfile(user.username)}>
                        View Profile
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
