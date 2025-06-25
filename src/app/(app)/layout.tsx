'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SidebarProvider } from "@/components/ui/sidebar";
import { ChatLayout } from "./components/chat-layout";
import { useAppContext } from "@/providers/app-provider";
import { Icons } from '@/components/icons';

function AppShellLoading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Icons.logo className="h-16 w-16 animate-pulse text-primary" />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const { chats, loggedInUser, isReady } = useAppContext();
    const router = useRouter();

    useEffect(() => {
        if (isReady && !loggedInUser) {
            router.push('/login');
        }
    }, [isReady, loggedInUser, router]);

    useEffect(() => {
        if (isReady && loggedInUser) {
            // Request notification permission on load
            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        console.log('Notification permission granted.');
                    } else {
                        console.log('Notification permission denied.');
                    }
                });
            }
        }
    }, [isReady, loggedInUser]);
    
    if (!isReady || !loggedInUser) {
        return <AppShellLoading />;
    }
    
    return (
        <SidebarProvider defaultOpen>
            <ChatLayout chats={chats}>
              {children}
            </ChatLayout>
        </SidebarProvider>
    );
}
