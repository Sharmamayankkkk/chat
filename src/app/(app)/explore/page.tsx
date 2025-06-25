
'use client';

import Image from 'next/image';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Globe, Users, BookOpen, Send, Instagram, Facebook, Youtube } from 'lucide-react'
import Link from 'next/link'

export default function ExplorePage() {

  const websites = [
    {
      name: 'KCS Main Website',
      description: 'Our trunk and foundation, the core of our digital presence.',
      href: '#', // Placeholder link
      icon: Globe,
      image: 'https://placehold.co/600x400.png',
    },
    {
      name: 'KCS Meet',
      description: 'Where ideas and people converge for virtual gatherings.',
      href: '#', // Placeholder link
      icon: Users,
      image: 'https://placehold.co/600x400.png',
    },
    {
      name: 'KCS Blog',
      description: 'Your window into community insights, stories, and wisdom.',
      href: '#', // Placeholder link
      icon: BookOpen,
      image: 'https://placehold.co/600x400.png',
    },
  ]

  const socialMedia = [
    {
      name: 'Telegram',
      href: '#', // Placeholder link
      icon: Send,
    },
    {
      name: 'Instagram',
      href: '#', // Placeholder link
      icon: Instagram,
    },
    {
      name: 'Facebook',
      href: '#', // Placeholder link
      icon: Facebook,
    },
    {
      name: 'YouTube',
      href: '#', // Placeholder link
      icon: Youtube,
    },
  ]

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <h2 className="text-3xl font-bold tracking-tight">Explore KCS</h2>
      <p className="text-muted-foreground max-w-2xl">
        Welcome to your central gateway to the KCS ecosystem, thoughtfully designed like a growing tree with vibrant branches. Each branch leads you to a unique part of our world.
      </p>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Our Digital Branches</CardTitle>
            <CardDescription>Explore the core platforms that make up our community.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
            {websites.map((site) => (
              <Card key={site.name} className="flex flex-col overflow-hidden">
                <div className="relative aspect-video">
                  <Image
                    src={site.image}
                    alt={`Preview of ${site.name}`}
                    fill
                    className="object-cover"
                    data-ai-hint="website preview"
                  />
                </div>
                <CardHeader className="flex-row items-center gap-4 pt-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <site.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{site.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-sm text-muted-foreground">{site.description}</p>
                </CardContent>
                <CardFooter>
                  <Link href={site.href} target="_blank" rel="noopener noreferrer" className="w-full">
                    <Button className="w-full">Visit Site</Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connect with Us</CardTitle>
            <CardDescription>Engage, learn, and stay updated with our community on social media.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {socialMedia.map((social) => (
              <Link key={social.name} href={social.href} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full h-14 text-base">
                  <social.icon className="mr-2 h-5 w-5" />
                  {social.name}
                </Button>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
