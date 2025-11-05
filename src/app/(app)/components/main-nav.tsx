
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageSquare, Calendar, Users, Compass } from 'lucide-react'
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

export function MainNav() {
  const pathname = usePathname()

  const menuItems = [
    {
      href: '/explore',
      label: 'Explore',
      icon: Users,
      isActive: pathname.startsWith('/explore'),
    },
    {
      href: '/chat',
      label: 'Chats',
      icon: MessageSquare,
      isActive: pathname.startsWith('/chat') || pathname === '/',
    },
    {
      href: '/status',
      label: 'Status',
      icon: Compass,
      isActive: pathname.startsWith('/status'),
    },
    {
      href: '/events',
      label: 'Events',
      icon: Calendar,
      isActive: pathname.startsWith('/events'),
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
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        )}
      </SidebarMenu>
    </nav>
  )
}
