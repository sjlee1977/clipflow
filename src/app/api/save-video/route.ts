import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      user_id,
      title,
      video_url,
      format,
      scene_count,
      voice_id,
      image_style,
      image_model,
      template_id,
      tts_provider,
      file_name,
      scenes,
    } = body;

    if (!video_url) {
      return NextResponse.json({ error: 'video_url is required' }, { status: 400 });
    }

    const { data, error } = await supabase.from('videos').insert({
      user_id: user_id ?? null,
      title: title ?? '제목 없음',
      video_url,
      format: format ?? 'shorts',
      scene_count: scene_count ?? 0,
      voice_id: voice_id ?? '',
      image_style: image_style ?? 'none',
      image_model: image_model ?? '',
      template_id: template_id ?? 'classic',
      tts_provider: tts_provider ?? 'google',
      file_name: file_name ?? '',
      scenes: scenes ?? [],
    }).select('id').single();

    if (error) {
      console.error('[save-video] insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err: any) {
    console.error('[save-video] error:', err);
    return NextResponse.json({ error: err.message ?? 'unknown error' }, { status: 500 });
  }
}
