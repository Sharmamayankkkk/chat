
import { NextResponse } from 'next/server';
import { readdir } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  const publicDir = join(process.cwd(), 'public');
  
  let stickers: string[] = [];
  let emojis: string[] = [];

  try {
    try {
      const stickersDir = join(publicDir, 'stickers');
      const stickerFiles = await readdir(stickersDir);
      stickers = stickerFiles
        .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
        .map(file => `/stickers/${file}`);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw new Error(`Failed to read stickers directory: ${error.message}`);
      }
      // If directory doesn't exist, stickers array remains empty, which is fine.
    }
    
    try {
      const emojisDir = join(publicDir, 'emoji');
      const emojiFiles = await readdir(emojisDir);
      emojis = emojiFiles
        .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
        .map(file => `/emoji/${file}`);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw new Error(`Failed to read emoji directory: ${error.message}`);
      }
      // If directory doesn't exist, emojis array remains empty.
    }

    return NextResponse.json({ stickers, emojis });

  } catch (error: any) {
    console.error("Error in /api/assets:", error);
    return NextResponse.json({ error: 'Failed to load app assets.' }, { status: 500 });
  }
}
