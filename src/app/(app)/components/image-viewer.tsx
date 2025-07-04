'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import Image from 'next/image';
import { X, Download, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { useState } from 'react';

interface ImageViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  alt?: string;
  title?: string;
}

export function ImageViewerDialog({ 
  open, 
  onOpenChange, 
  src, 
  alt = "Image",
  title 
}: ImageViewerDialogProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!src) {
    return null;
  }

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.25));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleDownload = async () => {
    try {
      // Fetch the image data
      const response = await fetch(src);
      const blob = await response.blob();
      
      // Create a blob URL
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = blobUrl;
      
      // Extract filename from URL or use title
      const filename = title || src.split('/').pop() || 'image';
      link.download = filename;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the blob URL
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to direct link if fetch fails
      window.open(src, '_blank');
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset transforms when closing
    setTimeout(() => {
      setZoom(1);
      setRotation(0);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto h-auto bg-black/95 border-none shadow-2xl p-0 flex flex-col">
        <DialogTitle className="sr-only">Image Viewer - {title || alt}</DialogTitle>
        <DialogDescription className="sr-only">
          Viewing {title || alt} in full screen. Use controls to zoom, rotate, or download. Press escape to close.
        </DialogDescription>
        
        {/* Header with title and controls */}
        <div className="flex items-center justify-between p-4 bg-black/50 backdrop-blur-sm border-b border-white/10">
          <div className="flex-1">
            {title && (
              <h2 className="text-white font-medium text-lg truncate">{title}</h2>
            )}
          </div>
          
          {/* Control buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleZoomOut}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Zoom Out"
            >
              <ZoomOut size={18} />
            </button>
            
            <span className="text-white/70 text-sm min-w-[60px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            
            <button
              onClick={handleZoomIn}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Zoom In"
            >
              <ZoomIn size={18} />
            </button>
            
            <button
              onClick={handleRotate}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Rotate"
            >
              <RotateCw size={18} />
            </button>
            
            <button
              onClick={handleDownload}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Download"
            >
              <Download size={18} />
            </button>
            
            <button
              onClick={handleClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Image container */}
        <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
          <div 
            className="transition-transform duration-200 ease-out"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
          >
            <Image
              src={src}
              alt={alt}
              width={1920}
              height={1080}
              className="max-w-[80vw] max-h-[70vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
              priority
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
