
'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
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
      <DialogContent className="max-w-[90vw] max-h-[90vh] w-auto h-auto bg-transparent border-none shadow-none p-0 flex items-center justify-center">
        <DialogTitle className="sr-only">Image Viewer</DialogTitle>
        <DialogDescription className="sr-only">Viewing attached image in a modal. Press escape to close.</DialogDescription>
        <Image
          src={src}
          alt="Full screen image view"
          width={1920}
          height={1080}
          className="max-w-full max-h-[90vh] w-auto object-contain rounded-lg"
        />
      </DialogContent>
    </Dialog>
  );
}
