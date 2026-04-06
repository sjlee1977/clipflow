import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * DashScope 계정에서 사용 가능한 TTS 모델과 목소리 목록을 조회하는 진단 API
 * GET /api/debug/qwen-models
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const meta = user?.user_metadata ?? {};
  const apiKey = (meta.qwen_api_key as string | undefined)?.trim();

  if (!apiKey) {
    return NextResponse.json({ error: 'Qwen API 키가 설정되지 않았습니다' }, { status: 400 });
  }

  const results: Record<string, any> = {};

  // 1. 표준 모델 목록 조회 시도
  const domains = ['dashscope-intl.aliyuncs.com', 'dashscope.aliyuncs.com'];
  for (const domain of domains) {
    try {
      const res = await fetch(`https://${domain}/api/v1/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'X-DashScope-ApiKey': apiKey,
        },
        signal: AbortSignal.timeout(5000),
      });
      const text = await res.text();
      results[`models_${domain}`] = { status: res.status, body: text.slice(0, 2000) };
    } catch (e: any) {
      results[`models_${domain}`] = { error: e.message };
    }
  }

  // 2. 각 TTS 모델 이름 후보를 실제로 테스트
  const testText = '테스트';
  const candidateModels = [
    // CosyVoice 계열
    { model: 'cosyvoice-v1', voice: 'loongbella', endpoint: 'cosyvoice-synthesis' },
    { model: 'cosyvoice-v2', voice: 'loongbella', endpoint: 'cosyvoice-synthesis' },
    { model: 'cosyvoice-v3-flash', voice: 'loongbella', endpoint: 'cosyvoice-synthesis' },
    // Qwen3-TTS 계열
    { model: 'qwen3-tts-flash', voice: 'Cherry', endpoint: 'generation' },
    { model: 'qwen-tts-v1', voice: 'samone', endpoint: 'generation' },
  ];

  for (const candidate of candidateModels) {
    const url = `https://dashscope-intl.aliyuncs.com/api/v1/services/audio/tts/${candidate.endpoint}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'X-DashScope-ApiKey': apiKey,
          'Content-Type': 'application/json',
          'X-DashScope-SSE': 'disable',
        },
        body: JSON.stringify({
          model: candidate.model,
          input: { text: testText },
          parameters: { voice: candidate.voice, format: 'mp3' },
        }),
        signal: AbortSignal.timeout(8000),
      });
      const text = await res.text();
      results[`test_${candidate.model}`] = {
        status: res.status,
        ok: res.ok,
        voice: candidate.voice,
        endpoint: candidate.endpoint,
        body: text.slice(0, 500),
      };
    } catch (e: any) {
      results[`test_${candidate.model}`] = { error: e.message };
    }
  }

  return NextResponse.json(results, { status: 200 });
}
