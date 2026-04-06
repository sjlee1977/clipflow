import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const meta = user.user_metadata ?? {};
    return NextResponse.json({
      anthropic: meta.anthropic_api_key ? maskKey(meta.anthropic_api_key) : '',
      gemini: meta.gemini_api_key ? maskKey(meta.gemini_api_key) : '',
      minimax: meta.minimax_api_key ? maskKey(meta.minimax_api_key) : '',
      minimaxGroup: meta.minimax_group_id ? maskKey(meta.minimax_group_id) : '',
      elevenlabs: meta.elevenlabs_api_key ? maskKey(meta.elevenlabs_api_key) : '',
      klingAccess: meta.kling_access_key ? maskKey(meta.kling_access_key) : '',
      klingSecret: meta.kling_secret_key ? maskKey(meta.kling_secret_key) : '',
      fal: meta.fal_api_key ? maskKey(meta.fal_api_key) : '',
      qwen: meta.qwen_api_key ? maskKey(meta.qwen_api_key) : '',
      hasAnthropic: !!meta.anthropic_api_key,
      hasGemini: !!meta.gemini_api_key,
      hasMinimax: !!meta.minimax_api_key && !!meta.minimax_group_id,
      hasElevenlabs: !!meta.elevenlabs_api_key,
      hasKling: !!meta.kling_access_key && !!meta.kling_secret_key,
      hasFal: !!meta.fal_api_key,
      hasQwen: !!meta.qwen_api_key,
    });
  } catch {
    return NextResponse.json({ error: '키 조회 실패' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const { provider, apiKey, apiKey2 } = await req.json();
    if (!provider || !apiKey) return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });

    let updateData: Record<string, string>;
    if (provider === 'anthropic') {
      updateData = { anthropic_api_key: apiKey.trim() };
    } else if (provider === 'gemini') {
      updateData = { gemini_api_key: apiKey.trim() };
    } else if (provider === 'minimax') {
      if (!apiKey2) return NextResponse.json({ error: 'MiniMax Group ID가 필요합니다' }, { status: 400 });
      updateData = { minimax_api_key: apiKey.trim(), minimax_group_id: apiKey2.trim() };
    } else if (provider === 'elevenlabs') {
      updateData = { elevenlabs_api_key: apiKey.trim() };
    } else if (provider === 'kling') {
      if (!apiKey2) return NextResponse.json({ error: 'Kling Secret Key가 필요합니다' }, { status: 400 });
      updateData = { kling_access_key: apiKey.trim(), kling_secret_key: apiKey2.trim() };
    } else if (provider === 'fal') {
      updateData = { fal_api_key: apiKey.trim() };
    } else if (provider === 'qwen') {
      updateData = { qwen_api_key: apiKey.trim() };
    } else {
      return NextResponse.json({ error: '알 수 없는 프로바이더' }, { status: 400 });
    }

    const { error: updateError } = await supabase.auth.updateUser({ data: updateData });

    if (updateError) throw updateError;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '키 저장 실패' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const { provider } = await req.json();
    const metaMap: Record<string, Record<string, null>> = {
      anthropic: { anthropic_api_key: null },
      gemini: { gemini_api_key: null },
      minimax: { minimax_api_key: null, minimax_group_id: null },
      elevenlabs: { elevenlabs_api_key: null },
      kling: { kling_access_key: null, kling_secret_key: null },
      fal: { fal_api_key: null },
      qwen: { qwen_api_key: null },
    };
    await supabase.auth.updateUser({ data: metaMap[provider] ?? {} });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '키 삭제 실패' }, { status: 500 });
  }
}

function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••';
  return key.slice(0, 4) + '••••••••••••' + key.slice(-4);
}
