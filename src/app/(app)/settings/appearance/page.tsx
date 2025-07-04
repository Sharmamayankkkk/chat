'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Upload } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/providers/app-provider';
import { cn, getContrastingTextColor } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

const colorOptions = [
  // Vibrant
  'hsl(221.2 83.2% 53.3%)', // Blue
  'hsl(142.1 76.2% 36.3%)', // Green
  'hsl(262 80% 58%)',       // Purple
  'hsl(348 83% 60%)',       // Pink/Red
  'hsl(30 95% 55%)',        // Orange
  'hsl(180 70% 45%)',       // Teal
  'hsl(320 80% 60%)',       // Magenta
  'hsl(50 95% 55%)',        // Yellow
  
  // Dark
  'hsl(217.2 32.6% 17.5%)', // Dark Blue
  'hsl(145 50% 20%)',       // Dark Green
  'hsl(262 40% 25%)',       // Dark Purple
  'hsl(0 40% 25%)',         // Dark Red

  // Light / Pastel
  'hsl(210 40% 96.1%)',     // Light Gray-Blue
  'hsl(145 63% 90%)',       // Light Green
  'hsl(25 95% 90%)',        // Light Orange
  'hsl(340 82% 93%)',       // Light Pink
  'hsl(262 80% 94%)',       // Light Purple
  'hsl(200 80% 92%)',       // Light Sky Blue
];

export default function ChatAppearancePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { themeSettings, setThemeSettings, loggedInUser } = useAppContext();
  const wallpaperUploadRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'outgoing' | 'incoming'>('outgoing');
  const [wallpapers, setWallpapers] = React.useState<string[]>(['/chat-bg.png']);
  const [isLoadingWallpapers, setIsLoadingWallpapers] = React.useState(true);

  useEffect(() => {
    const fetchWallpapers = async () => {
        setIsLoadingWallpapers(true);
        try {
            const response = await fetch('/api/wallpapers');
            if (!response.ok) {
                throw new Error(`Failed to fetch wallpapers: ${response.statusText}`);
            }
            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }
            if (data.wallpapers) {
                const uniqueWallpapers = [...new Set(['/chat-bg.png', ...data.wallpapers])];
                setWallpapers(uniqueWallpapers);
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error fetching wallpapers', description: String(error) });
        } finally {
            setIsLoadingWallpapers(false);
        }
    };
    fetchWallpapers();
  }, [toast]);

  const handleBubbleColorSelect = (color: string) => {
    const key = activeTab === 'outgoing' ? 'outgoingBubbleColor' : 'incomingBubbleColor';

    if (key === 'incomingBubbleColor' && color === themeSettings.usernameColor) {
      toast({
        variant: 'destructive',
        title: 'Color Conflict',
        description: 'Incoming bubble color cannot be the same as the username color.',
      });
      return;
    }

    setThemeSettings({ [key]: color });
    toast({ title: 'Bubble color updated!' });
  };
  
  const handleUsernameColorSelect = (color: string) => {
    if (color === themeSettings.incomingBubbleColor) {
        toast({
            variant: 'destructive',
            title: 'Color Conflict',
            description: 'Username color cannot be the same as the incoming bubble color.',
        });
        return;
    }
    setThemeSettings({ usernameColor: color });
    toast({ title: 'Username color updated!' });
  };

  const handleWallpaperSelect = (wallpaperUrl: string | null) => {
    setThemeSettings({ chatWallpaper: wallpaperUrl });
    toast({ title: 'Wallpaper changed!' });
  };

  const handleWallpaperUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const newWallpaper = e.target?.result as string;
        setThemeSettings({ chatWallpaper: newWallpaper });
        toast({ title: 'Wallpaper uploaded!' });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBrightnessChange = (value: number[]) => {
    setThemeSettings({ wallpaperBrightness: value[0] });
  };

  const wallpaperStyle = {
    backgroundImage: themeSettings.chatWallpaper ? `url(${themeSettings.chatWallpaper})` : undefined,
    backgroundColor: themeSettings.chatWallpaper ? 'transparent' : 'hsl(var(--muted))',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    filter: `brightness(${themeSettings.wallpaperBrightness / 100})`,
    backgroundRepeat: themeSettings.chatWallpaper?.startsWith('/chat-bg.png') ? 'repeat' : 'no-repeat',
  };

  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-center gap-4 p-4 border-b bg-background sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft />
          <span className="sr-only">Back</span>
        </Button>
        <h2 className="text-xl font-bold">Chat Appearance</h2>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-8">
        
        <Card className="overflow-hidden shadow-lg">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative h-96 w-full">
              <div className="absolute inset-0 transition-all duration-300" style={wallpaperStyle} />
              <div className="absolute inset-0 p-4 flex flex-col gap-3 justify-end bg-black/10">
                  <div className="flex items-end gap-2 max-w-[70%]">
                      <Avatar className="h-8 w-8 self-end">
                          <AvatarImage src="https://placehold.co/100x100.png" data-ai-hint="avatar" />
                          <AvatarFallback>A</AvatarFallback>
                      </Avatar>
                      <div 
                        className="rounded-lg py-2 px-3 text-sm" 
                        style={{ 
                            backgroundColor: themeSettings.incomingBubbleColor, 
                            color: getContrastingTextColor(themeSettings.incomingBubbleColor) 
                        }}
                      >
                        <div className="font-semibold mb-1 text-sm" style={{ color: themeSettings.usernameColor }}>
                            Alice
                        </div>
                        <p>Hi! This is how incoming messages will look.</p>
                      </div>
                  </div>
                  <div className="flex items-end gap-2 max-w-[70%] self-end">
                      <div 
                        className="rounded-lg py-2 px-3 text-sm" 
                        style={{ 
                            backgroundColor: themeSettings.outgoingBubbleColor, 
                            color: getContrastingTextColor(themeSettings.outgoingBubbleColor) 
                        }}
                      >
                          <p>And this is what your messages will look like.</p>
                      </div>
                      <Avatar className="h-8 w-8 self-end">
                          <AvatarImage src={loggedInUser?.avatar_url} />
                          <AvatarFallback>{loggedInUser?.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                  </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Bubble Color</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="outgoing">Outgoing</TabsTrigger>
                <TabsTrigger value="incoming">Incoming</TabsTrigger>
              </TabsList>
              <TabsContent value="outgoing" className="pt-4">
                <ColorGrid selectedColor={themeSettings.outgoingBubbleColor} onSelect={handleBubbleColorSelect} />
              </TabsContent>
              <TabsContent value="incoming" className="pt-4">
                <ColorGrid selectedColor={themeSettings.incomingBubbleColor} onSelect={handleBubbleColorSelect} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Username Color</CardTitle>
            <CardDescription>Color of the sender's name in group chats.</CardDescription>
          </CardHeader>
          <CardContent>
            <ColorGrid selectedColor={themeSettings.usernameColor} onSelect={handleUsernameColorSelect} />
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Chat Wallpaper</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-muted-foreground mb-3 block">Choose a wallpaper</Label>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                {isLoadingWallpapers ? (
                   [...Array(6)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)
                ) : (
                  wallpapers.map((wp) => (
                    <button key={wp} onClick={() => handleWallpaperSelect(wp)} className="relative aspect-square rounded-lg overflow-hidden ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                      <Image src={wp} alt="Wallpaper thumbnail" fill className="object-cover" />
                      {themeSettings.chatWallpaper === wp && (
                        <div className="absolute inset-0 bg-primary/70 flex items-center justify-center">
                          <Check className="h-6 w-6 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  ))
                )}
                <button onClick={() => wallpaperUploadRef.current?.click()} className={cn("relative aspect-square rounded-lg border-2 border-dashed border-muted-foreground/50 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:bg-accent hover:border-primary transition-colors", !wallpapers.includes(themeSettings.chatWallpaper || '') && themeSettings.chatWallpaper && 'border-primary bg-primary/10 text-primary')}>
                  <input type="file" ref={wallpaperUploadRef} onChange={handleWallpaperUpload} className="hidden" accept="image/*" />
                  <Upload className="h-6 w-6"/>
                  <span className="text-xs text-center">Upload Photo</span>
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <Label htmlFor="brightness" className="text-muted-foreground">Brightness</Label>
              <Slider
                id="brightness"
                value={[themeSettings.wallpaperBrightness]}
                onValueChange={handleBrightnessChange}
                min={20}
                max={100}
                step={1}
              />
            </div>
          </CardContent>
        </Card>

        <Badge variant="outline" className="py-2 px-3 text-center w-full justify-center">
            <p className="text-xs text-muted-foreground">Only you will see this theme. Your chat theme does not affect anyone else.</p>
        </Badge>
      </main>
    </div>
  );
}

function ColorGrid({ selectedColor, onSelect }: { selectedColor: string; onSelect: (color: string) => void }) {
  return (
    <div className="grid grid-cols-6 sm:grid-cols-9 gap-4 justify-items-center">
      {colorOptions.map((color) => (
        <button
          key={color}
          onClick={() => onSelect(color)}
          className="w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          style={{ 
              backgroundColor: color, 
              borderColor: selectedColor === color ? 'hsl(var(--primary))' : 'transparent' 
          }}
          aria-label={`Select color ${color}`}
        >
          {selectedColor === color && <Check className="h-5 w-5" style={{ color: getContrastingTextColor(color) }} />}
        </button>
      ))}
    </div>
  );
}
