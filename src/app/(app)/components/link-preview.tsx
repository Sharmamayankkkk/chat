'use client';

import React from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import type { AttachmentMetadata } from '@/lib/types';
import { Globe } from 'lucide-react';

interface LinkPreviewProps {
  metadata: AttachmentMetadata;
}

export function LinkPreview({ metadata }: LinkPreviewProps) {
  if (!metadata || !metadata.url) {
    return null;
  }

  const { url, title, description, image, icon } = metadata;
  let baseUrl: string;
  try {
    baseUrl = new URL(url).hostname;
  } catch (error) {
    baseUrl = url;
  }
  

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full max-w-sm rounded-lg overflow-hidden no-underline hover:opacity-90 transition-opacity"
      style={{ color: 'inherit' }}
    >
      <Card className="bg-background/20 backdrop-blur-sm border-0 w-full">
        {image && (
          <div className="relative aspect-video">
            <Image
              src={image}
              alt={title || 'Link preview image'}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 80vw, 320px"
              data-ai-hint="link preview"
            />
          </div>
        )}
        <CardContent className="p-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs opacity-80">
              {icon ? (
                <Image src={icon} alt="favicon" width={16} height={16} className="rounded-sm" />
              ) : (
                <Globe className="h-4 w-4" />
              )}
              <span className="truncate">{baseUrl}</span>
            </div>
            <p className="font-semibold line-clamp-2">{title || url}</p>
            {description && (
              <p className="text-xs opacity-80 line-clamp-3">
                {description}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </a>
  );
}
