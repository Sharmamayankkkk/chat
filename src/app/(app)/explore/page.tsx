'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppContext } from '@/providers/app-provider';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Search, Sparkles, Users, Clock, Bell } from 'lucide-react';
import { PostCard, PostSkeleton } from './components/post-card';
import { CreatePost } from './components/create-post';
import { StatusRail } from './components/status-rail';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Post } from '@/lib';

type FeedFilter = 'foryou' | 'following' | 'latest';

export default function ExplorePage() {
  const { loggedInUser, isReady, posts, relationships, notifications } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('foryou');

  // We will build the "For You" and "Following" feed logic later.
  // For now, all tabs will just show the latest posts.
  const filteredPosts = useMemo(() => {
    if (!posts) return [];
    
    // TODO: Add 'foryou' and 'following' logic
    // For now, just sort by latest
    return posts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  }, [posts, feedFilter, relationships]);

  const unreadNotificationCount = useMemo(() => {
    return notifications.filter(n => !n.is_read).length;
  }, [notifications]);

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center gap-4 p-4">
          <SidebarTrigger className="md:hidden" />
          <h2 className="text-xl font-bold tracking-tight hidden md:block">Explore</h2>

          <div className="relative ml-auto flex-1 md:grow-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..." // We will add search functionality later
              className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <Link href="/notifications">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {unreadNotificationCount}
                </span>
              )}
            </Button>
          </Link>
        </div>

        {/* Feed Filter Tabs */}
        <Tabs value={feedFilter} onValueChange={(v) => setFeedFilter(v as FeedFilter)} className="w-full">
          <TabsList className="w-full justify-around rounded-none border-b bg-transparent h-auto p-0">
            <TabsTrigger
              value="foryou"
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              For You
            </TabsTrigger>
            <TabsTrigger
              value="following"
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              <Users className="h-4 w-4 mr-2" />
              Following
            </TabsTrigger>
            <TabsTrigger
              value="latest"
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              <Clock className="h-4 w-4 mr-2" />
              Latest
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      {/* Main content area */}
      <ScrollArea className="flex-1">
        <main className="max-w-2xl mx-auto">
          {/* Status Rail */}
          <div className="p-4">
            <StatusRail />
          </div>
          
          <Separator />
          
          {/* Create Post */}
          <CreatePost />
          
          <Separator />

          {/* Post Feed */}
          <div>
            {!isReady ? (
              <>
                <PostSkeleton />
                <PostSkeleton />
                <PostSkeleton />
              </>
            ) : filteredPosts.length > 0 ? (
              filteredPosts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))
            ) : (
              <div className="p-10 text-center">
                <p className="text-muted-foreground">
                  {feedFilter === 'following' 
                    ? "Posts from users you follow will appear here." 
                    : "No posts yet. Be the first!"}
                </p>
              </div>
            )}
          </div>
        </main>
      </ScrollArea>
    </div>
  );
}