
import { NextResponse } from 'next/server';
import { readdir } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  const publicDir = join(process.cwd(), 'public');
  
  let stickers: string[] = [];
  let emojis: string[] = [];

  try {
    const stickersDir = join(publicDir, 'stickers');
    const stickerFiles = await readdir(stickersDir);
    stickers = stickerFiles
      .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
      .map(file => `/stickers/${file}`);
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      console.error('Error reading stickers directory:', error);
    }
  }
  
  try {
    const emojisDir = join(publicDir, 'emoji');
    const emojiFiles = await readdir(emojisDir);
    emojis = emojiFiles
      .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
      .map(file => `/emoji/${file}`);
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      console.error('Error reading emoji directory:', error);
    }
  }

  return NextResponse.json({ stickers, emojis });
}
