'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAppContext } from '@/providers/app-provider';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { User } from '@/lib';
import { Card } from '@/components/ui/card';
import { StatusRail } from './components/status-rail'; // <-- IMPORT THE NEW COMPONENT
import { Separator } from '@/components/ui/separator';

export default function ExplorePage() {
  const { loggedInUser, allUsers, isReady } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = useMemo(() => {
    if (!loggedInUser || !allUsers) return [];

    // Filter out the logged-in user from the list
    const otherUsers = allUsers.filter(u => u.id !== loggedInUser.id);

    if (!searchQuery) {
      return otherUsers; // Show all other users by default
    }

    const lowerQuery = searchQuery.toLowerCase();
    return otherUsers.filter(user => 
      user.name.toLowerCase().includes(lowerQuery) ||
      (user.username && user.username.toLowerCase().includes(lowerQuery))
    );
  }, [loggedInUser, allUsers, searchQuery]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-4 p-4 border-b bg-background sticky top-0 z-10">
        <SidebarTrigger className="md:hidden" />
        <h2 className="text-xl font-bold tracking-tight">Explore</h2>
        <div className="relative ml-auto flex-1 md:grow-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search users..."
            className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </header>
      <ScrollArea className="flex-1">
        <main className="p-4 md:p-8 space-y-6">
          
          {/* --- ADD THIS SECTION --- */}
          <StatusRail />
          <Separator />
          {/* --- END OF SECTION --- */}

          <div>
            <h3 className="text-2xl font-semibold tracking-tight mb-4">Discover Devotees</h3>
            {/* This is where we'll put the "Posts" feed later */}
          </div>

          {!isReady ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="flex items-center gap-4 p-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </Card>
              ))}
            </div>
          ) : filteredUsers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUsers.map((user: User) => (
                <Link 
                  key={user.id} 
                  href={`/profile/${user.username}`} 
                  className="w-full"
                >
                  <Card className="p-3 hover:bg-accent transition-colors">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={user.avatar_url} alt={user.name} />
                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">{user.name}</p>
                        <p className="text-sm text-muted-foreground">@{user.username}</p>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground">No users found matching your search.</p>
          )}
        </main>
      </ScrollArea>
    </div>
  );
}