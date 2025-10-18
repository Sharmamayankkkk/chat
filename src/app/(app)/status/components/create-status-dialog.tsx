
'use client';

import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Image as ImageIcon, Send } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/providers/app-provider';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@/lib/utils';

interface CreateStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusCreated: () => void;
}

export function CreateStatusDialog({ open, onOpenChange, onStatusCreated }: CreateStatusDialogProps) {
  const { toast } = useToast();
  const { loggedInUser } = useAppContext();
  const supabase = createClient();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const resetState = () => {
    setFile(null);
    setPreview(null);
    setCaption('');
    setIsLoading(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetState();
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async () => {
    if (!file || !loggedInUser) return;
    setIsLoading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `public/statuses/${loggedInUser.id}/${uuidv4()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('attachments').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(filePath);

      const { error: insertError } = await supabase.from('statuses').insert({
        user_id: loggedInUser.id,
        media_url: urlData.publicUrl,
        media_type: 'image',
        caption: caption,
      });

      if (insertError) throw insertError;

      toast({ title: 'Status Posted!', description: 'Your status is now visible to others.' });
      onStatusCreated();
      handleOpenChange(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error posting status', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a New Status</DialogTitle>
          <DialogDescription>Share an image with your community. It will disappear after 24 hours.</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          {preview ? (
            <div className="space-y-4">
                <div className="relative aspect-square w-full max-w-sm mx-auto rounded-lg overflow-hidden bg-muted">
                    <Image src={preview} alt="Status preview" fill className="object-contain" />
                </div>
                <Input
                    placeholder="Add a caption..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    disabled={isLoading}
                />
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-64 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:bg-muted"
            >
              <ImageIcon className="h-12 w-12 mb-2" />
              <span>Click to select an image</span>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
            </button>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!file || isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Post Status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
