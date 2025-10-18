
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const caption = formData.get('caption') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    // File upload to the 'story' bucket
    const fileExt = file.name.split('.').pop();
    // The path includes the user's ID as a folder, matching the storage policy
    const filePath = `${user.id}/${uuidv4()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage.from('story').upload(filePath, file);
    if (uploadError) {
      throw uploadError;
    }

    const { data: urlData } = supabase.storage.from('story').getPublicUrl(filePath);

    // DB insert
    const { data: statusData, error: insertError } = await supabase
        .from('statuses')
        .insert({
            user_id: user.id,
            media_url: urlData.publicUrl,
            media_type: 'image', // For now, only support images
            caption: caption,
        })
        .select()
        .single();
    
    if (insertError) {
        // If the DB insert fails, try to delete the uploaded file
        await supabase.storage.from('story').remove([filePath]);
        throw insertError;
    }

    return NextResponse.json(statusData);
  } catch (error: any) {
    console.error('Error creating status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
