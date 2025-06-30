'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import Image from 'next/image';

interface ImageViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
}

export function ImageViewerDialog({ open, onOpenChange, src }: ImageViewerDialogProps) {
  if (!src) {
    return null;
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-full h-auto bg-transparent border-none shadow-none p-2">
        <DialogHeader className="sr-only">
          <DialogTitle>Image Viewer</DialogTitle>
          <DialogDescription>Viewing attached image in a modal.</DialogDescription>
        </DialogHeader>
        <div className="relative aspect-video">
          <Image
            src={src}
            alt="Full screen image view"
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1024px"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
