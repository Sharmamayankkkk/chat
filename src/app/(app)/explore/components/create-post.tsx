'use client';

import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAppContext } from '@/providers/app-provider';
import { ImageIcon, ListVideo, Smile, Calendar, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export function CreatePost() {
  const { loggedInUser, createPost } = useAppContext();
  const [content, setContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const { toast } = useToast();

  const handlePost = async () => {
    if (!content.trim()) return;

    setIsPosting(true);
    try {
      // We'll add media and polls here later
      await createPost(content);
      setContent(''); // Clear textarea on success
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error creating post',
        description: error.message,
      });
    } finally {
      setIsPosting(false);
    }
  };

  if (!loggedInUser) {
    return null; // Don't show create-post box if not logged in
  }

  return (
    <div className="flex gap-3 p-4 border-b">
      <Link href="/profile">
        <Avatar className="h-10 w-10">
          <AvatarImage src={loggedInUser.avatar_url} alt={loggedInUser.name} />
          <AvatarFallback>{loggedInUser.name.charAt(0)}</AvatarFallback>
        </Avatar>
      </Link>
      <div className="flex-1">
        <Textarea
          placeholder="What is happening?!"
          className="border-none focus-visible:ring-0 shadow-none p-0 text-lg resize-none"
          minRows={2}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={isPosting}
        />
        {/* We will add media/poll previews here later */}
        
        <div className="flex items-center justify-between mt-4">
          <div className="flex gap-1 text-primary">
            {/* We will wire these up later */}
            <Button variant="ghost" size="icon" disabled>
              <ImageIcon className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" disabled>
              <ListVideo className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" disabled>
              <Smile className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" disabled>
              <Calendar className="h-5 w-5" />
            </Button>
          </div>
          <Button onClick={handlePost} disabled={!content.trim() || isPosting}>
            {isPosting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Post
          </Button>
        </div>
      </div>
    </div>
  );
}