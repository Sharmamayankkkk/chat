'use client';

import React, { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAppContext } from "@/providers/app-provider";
import { Bell, UserPlus } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Notification } from '@/lib'; // Import our Notification type

export default function NotificationsPage() {
  const { 
    notifications, 
    markNotificationsAsRead, 
    approveFollow, 
    rejectFollow 
  } = useAppContext();

  // Mark notifications as read when the page is viewed
  useEffect(() => {
    markNotificationsAsRead();
  }, [markNotificationsAsRead]);

  const unreadNotifications = useMemo(() => {
    return notifications.filter(n => !n.is_read);
  }, [notifications]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-4 p-4 border-b bg-background sticky top-0 z-10">
        <SidebarTrigger className="md:hidden" />
        <h2 className="text-xl font-bold tracking-tight">Notifications</h2>
        <Button 
          variant="ghost" 
          size="sm" 
          className="ml-auto" 
          onClick={markNotificationsAsRead}
          disabled={unreadNotifications.length === 0}
        >
          Mark all as read
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto">
        {notifications.length > 0 ? (
          <div className="divide-y divide-border">
            {notifications.map((notification) => (
              <NotificationCard 
                key={notification.id} 
                notification={notification}
                onApprove={approveFollow}
                onReject={rejectFollow}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-10 text-center">
            <Bell className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold">No notifications yet</h3>
            <p className="text-muted-foreground">When you get follow requests or other updates, they'll show up here.</p>
          </div>
        )}
      </main>
    </div>
  );
}

// This is the component for a single notification item
function NotificationCard({ 
  notification,
  onApprove,
  onReject
}: { 
  notification: Notification, 
  onApprove: (id: string) => void,
  onReject: (id: string) => void
}) {
  const router = useRouter();

  const handleApprove = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onApprove(notification.actor.id);
  };

  const handleReject = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onReject(notification.actor.id);
  };

  const getNotificationContent = () => {
    switch (notification.type) {
      case 'follow_request':
        return (
          <>
            <span className="font-semibold">{notification.actor.name}</span> (@{notification.actor.username}) requested to follow you.
          </>
        );
      case 'new_follower':
        return (
          <>
            <span className="font-semibold">{notification.actor.name}</span> (@{notification.actor.username}) started following you.
          </>
        );
      // We can add cases for 'new_like', 'new_comment' here later
      default:
        return 'You have a new notification.';
    }
  };

  return (
    <Link 
      href={`/profile/${notification.actor.username}`} 
      className={cn(
        "flex items-start gap-4 p-4 hover:bg-accent transition-colors",
        !notification.is_read && "bg-primary/5 hover:bg-primary/10"
      )}
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-1">
        {notification.type === 'follow_request' ? (
          <UserPlus className="h-6 w-6 text-primary" />
        ) : (
          <Avatar className="h-10 w-10">
            <AvatarImage src={notification.actor.avatar_url} alt={notification.actor.name} />
            <AvatarFallback>{notification.actor.name.charAt(0)}</AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm">
            {getNotificationContent()}
          </p>
          {!notification.is_read && (
            <div className="h-2.5 w-2.5 rounded-full bg-primary flex-shrink-0 ml-4" />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
        
        {/* Actions for follow requests */}
        {notification.type === 'follow_request' && (
          <div className="flex items-center gap-2 pt-2">
            <Button size="sm" onClick={handleApprove}>Approve</Button>
            <Button size="sm" variant="outline" onClick={handleReject}>Reject</Button>
          </div>
        )}
      </div>
    </Link>
  );
}
