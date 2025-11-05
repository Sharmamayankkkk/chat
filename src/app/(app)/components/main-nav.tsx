'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageSquare, Calendar, Users, Compass, Bell } from 'lucide-react' // Import Bell
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge, // Import Badge
} from '@/components/ui/sidebar'
import { useAppContext } from '@/providers/app-provider' // Import useAppContext
import { useMemo } from 'react'

export function MainNav() {
  const pathname = usePathname()
  const { notifications } = useAppContext() // Get notifications

  // Calculate unread notification count
  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.is_read).length;
  }, [notifications]);

  const menuItems = [
    {
      href: '/explore',
      label: 'Explore',
      icon: Compass,
      isActive: pathname.startsWith('/explore'),
      badge: 0, // No badge for explore
    },
    {
      href: '/chat',
      label: 'Chats',
      icon: MessageSquare,
      isActive: pathname.startsWith('/chat') || pathname === '/',
      badge: 0, // We'll use the one from chat.unreadCount, but not here
    },
    // --- NEW NOTIFICATIONS LINK ---
    {
      href: '/notifications',
      label: 'Notifications',
      icon: Bell,
      isActive: pathname.startsWith('/notifications'),
      badge: unreadCount, // Show unread count
    },
    // --- END NEW LINK ---
    {
      href: '/events',
      label: 'Events',
      icon: Calendar,
      isActive: pathname.startsWith('/events'),
      badge: 0,
    },
  ]

  return (
    <nav>
      <SidebarMenu>
        {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={item.isActive}
                className="w-full justify-start text-sm font-medium h-11"
              >
                <Link href={item.href}>
                  <item.icon className="h-5 w-5 mr-3" />
                  <span>{item.label}</span>
                  {item.badge > 0 && (
                    <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        )}
      </SidebarMenu>
    </nav>
  )
}