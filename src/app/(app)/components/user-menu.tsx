
'use client';

import Link from "next/link";
import { MoreHorizontal, Star } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAppContext } from "@/providers/app-provider";
import { createClient } from "@/lib/utils";

export function UserMenu() {
    const { loggedInUser } = useAppContext();
    const supabase = createClient();

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    if (!loggedInUser) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3 p-2 h-auto">
                    <Avatar className="h-9 w-9">
                        <AvatarImage src={loggedInUser.avatar_url} alt={loggedInUser.name} data-ai-hint="avatar" />
                        <AvatarFallback>{loggedInUser.name?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="truncate text-left">
                        <div className="font-semibold">{loggedInUser.name}</div>
                        <div className="text-xs text-muted-foreground">{loggedInUser.username}</div>
                    </div>
                    <MoreHorizontal className="ml-auto h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 mb-2" side="top" align="start">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Link href="/profile">
                  <DropdownMenuItem>Profile</DropdownMenuItem>
                </Link>
                <Link href="/starred">
                  <DropdownMenuItem>
                    <Star className="mr-2 h-4 w-4" />
                    <span>Starred Messages</span>
                  </DropdownMenuItem>
                </Link>
                <Link href="/settings">
                  <DropdownMenuItem>Settings</DropdownMenuItem>
                </Link>
                {loggedInUser.is_admin && (
                  <Link href="/admin">
                    <DropdownMenuItem>Admin Panel</DropdownMenuItem>
                  </Link>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="p-1">
                    <ThemeToggle />
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
