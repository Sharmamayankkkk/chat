
'use client'

import Link from 'next/link';
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icons } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAppContext } from '@/providers/app-provider';
import React, { useEffect } from 'react';
import { createClient } from '@/lib/utils';

function AdminShellLoading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted/40">
      <Icons.logo className="h-16 w-16 animate-pulse text-primary" />
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { loggedInUser, isReady } = useAppContext();
  const router = useRouter();
  const supabase = createClient();
  
  useEffect(() => {
    if (isReady && (!loggedInUser || !loggedInUser.is_admin)) {
      router.push('/login');
    }
  }, [isReady, loggedInUser, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh(); 
  };

  if (!isReady || !loggedInUser || !loggedInUser.is_admin) {
    return <AdminShellLoading />;
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
       <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
        <div className="flex items-center gap-2">
            <Link href="/chat">
              <Icons.logo className="h-8 w-8 text-primary" />
            </Link>
            <h1 className="text-xl font-semibold">Admin Panel</h1>
        </div>
        
        <div className="relative ml-auto flex-1 md:grow-0">
          {/* Future Search */}
        </div>
        <ThemeToggle />
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon" className="rounded-full">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={loggedInUser.avatar_url} alt={loggedInUser.name} data-ai-hint="avatar" />
                        <AvatarFallback>{loggedInUser.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="sr-only">Toggle user menu</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>{loggedInUser.name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Link href="/chat">
                    <DropdownMenuItem>Back to App</DropdownMenuItem>
                </Link>
                 <Link href="/profile">
                    <DropdownMenuItem>Profile</DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                 <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
       </header>
       <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
        {children}
       </main>
    </div>
  );
}
