
import { NextResponse } from 'next/server';
import { readdir } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  const wallpapersDir = join(process.cwd(), 'public', 'chat-bg');
  
  try {
    const wallpaperFiles = await readdir(wallpapersDir);
    const wallpapers = wallpaperFiles
      .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
      .map(file => `/chat-bg/${file}`);

    return NextResponse.json({ wallpapers });
  } catch (error: any) {
    // If the directory doesn't exist, return an empty array.
    // This is not an error, just means no custom wallpapers are uploaded.
    if (error.code === 'ENOENT') {
      return NextResponse.json({ wallpapers: [] });
    }
    // For other errors, log them and return an internal server error.
    console.error('Error reading wallpapers directory:', error);
    return NextResponse.json({ error: 'Failed to read wallpapers' }, { status: 500 });
  }
}
