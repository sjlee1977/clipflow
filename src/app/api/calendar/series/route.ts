import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import OpenAI from 'openai';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

    const { data, error: fetchError } = await supabase
      .from('content_series')
      .select('*, content_plans(id, title, status, scheduled_at, content_type)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (fetchError) throw fetchError;
    return NextResponse.json({ series: data ?? [] });
  } catch (err) {
    console.error('[calendar/series GET]', err);
    return NextResponse.json({ error: '조회 실패' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

    const { title, topic, description, episode_count, generateOutline } = await req.json();
    if (!title || !topic) return NextResponse.json({ error: '제목과 주제가 필요합니다' }, { status: 400 });

    const count = episode_count ?? 5;
    let episodes: Array<{ episode_number: number; title: string; description: string; keywords: string[] }> = [];

    // AI로 시리즈 에피소드 구성 생성
    if (generateOutline) {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const aiRes = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `당신은 유튜브/블로그 콘텐츠 전략가입니다. 주어진 주제로 시리즈 콘텐츠 구성을 JSON으로 반환하세요.`,
          },
          {
            role: 'user',
            content: `시리즈 주제: "${topic}"
시리즈명: "${title}"
${description ? `설명: ${description}` : ''}
에피소드 수: ${count}편

각 에피소드를 다음 JSON 배열 형식으로 반환해주세요:
[
  {
    "episode_number": 1,
    "title": "에피소드 제목 (유튜브 검색에 잘 걸리는 제목)",
    "description": "이 에피소드에서 다룰 핵심 내용 2~3문장",
    "keywords": ["키워드1", "키워드2", "키워드3"]
  }
]

JSON만 반환하고 다른 텍스트는 포함하지 마세요.`,
          },
        ],
        max_tokens: 2000,
        temperature: 0.8,
        response_format: { type: 'json_object' },
      });

      try {
        const parsed = JSON.parse(aiRes.choices[0]?.message?.content ?? '{}');
        episodes = Array.isArray(parsed) ? parsed : (parsed.episodes ?? []);
      } catch {
        episodes = [];
      }
    }

    const { data, error: insertError } = await supabase
      .from('content_series')
      .insert({ user_id: user.id, title, topic, description, episode_count: count, episodes, status: 'planning' })
      .select()
      .single();

    if (insertError) throw insertError;
    return NextResponse.json({ series: data });
  } catch (err) {
    console.error('[calendar/series POST]', err);
    return NextResponse.json({ error: '생성 실패' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

    const { id } = await req.json();
    await supabase.from('content_series').delete().eq('id', id).eq('user_id', user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[calendar/series DELETE]', err);
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
  }
}
