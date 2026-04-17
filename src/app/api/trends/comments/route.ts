import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { GoogleGenAI } from '@google/genai';

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function extractJSON(text: string): string {
  let s = text.trim();
  const match = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) s = match[1].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start !== -1 && end !== -1) return s.slice(start, end + 1);
  return s;
}

function getProvider(modelId: string): 'gemini' | 'claude' | 'qwen' {
  if (modelId.startsWith('gemini')) return 'gemini';
  if (modelId.startsWith('claude')) return 'claude';
  return 'qwen';
}

async function callAI(
  modelId: string,
  prompt: string,
  keys: { gemini?: string; claude?: string; qwen?: string }
): Promise<string> {
  const provider = getProvider(modelId);

  if (provider === 'gemini') {
    if (!keys.gemini) throw new Error('Google Gemini API 키가 설정되지 않았습니다. 설정 페이지에서 등록해주세요.');
    const ai = new GoogleGenAI({ apiKey: keys.gemini });
    const res = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: { responseMimeType: 'application/json', temperature: 0.4 },
    });
    return res.text ?? '';
  }

  if (provider === 'claude') {
    if (!keys.claude) throw new Error('Anthropic API 키가 설정되지 않았습니다. 설정 페이지에서 등록해주세요.');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': keys.claude.trim(),
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Claude 오류 (${res.status})`);
    const data = await res.json();
    return extractJSON(data.content?.[0]?.text ?? '');
  }

  if (!keys.qwen) throw new Error('Qwen API 키가 설정되지 않았습니다. 설정 페이지에서 등록해주세요.');
  const res = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${keys.qwen.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`Qwen 오류 (${res.status})`);
  const data = await res.json();
  return extractJSON(data.choices?.[0]?.message?.content ?? '');
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { url, modelId = 'qwen-max', maxComments = 100 } = body;
  if (!url) return NextResponse.json({ error: 'URL을 입력해주세요' }, { status: 400 });

  const videoId = extractVideoId(url.trim());
  if (!videoId) return NextResponse.json({ error: '유효한 YouTube URL이 아닙니다' }, { status: 400 });

  const meta = user.user_metadata ?? {};
  const keys = {
    gemini: meta.gemini_api_key as string | undefined,
    claude: meta.anthropic_api_key as string | undefined,
    qwen: meta.qwen_api_key as string | undefined,
  };

  const provider = getProvider(modelId);
  const keyCheck = { gemini: keys.gemini, claude: keys.claude, qwen: keys.qwen };
  if (!keyCheck[provider]) {
    const names = { gemini: 'Google Gemini', claude: 'Anthropic', qwen: 'Qwen' };
    return NextResponse.json(
      { error: `${names[provider]} API 키가 필요합니다. 설정 페이지에서 등록해주세요.` },
      { status: 403 }
    );
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'YouTube API 키가 서버에 설정되지 않았습니다.' }, { status: 500 });

  // 영상 제목 조회
  let videoTitle = '';
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`
    );
    const data = await res.json();
    videoTitle = data.items?.[0]?.snippet?.title ?? '';
  } catch { /* ignore */ }

  // 댓글 수집
  const limit = Math.min(Math.max(parseInt(String(maxComments)) || 100, 10), 200);
  const allComments: string[] = [];
  let pageToken = '';

  while (allComments.length < limit) {
    const remaining = limit - allComments.length;
    const url2 = new URL('https://www.googleapis.com/youtube/v3/commentThreads');
    url2.searchParams.set('part', 'snippet');
    url2.searchParams.set('videoId', videoId);
    url2.searchParams.set('maxResults', String(Math.min(remaining, 100)));
    url2.searchParams.set('order', 'relevance');
    url2.searchParams.set('key', apiKey);
    if (pageToken) url2.searchParams.set('pageToken', pageToken);

    const res = await fetch(url2.toString());
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.error?.message ?? `YouTube API 오류 (${res.status})` },
        { status: res.status }
      );
    }
    const data = await res.json();

    for (const item of data.items ?? []) {
      const text: string = item.snippet?.topLevelComment?.snippet?.textDisplay ?? '';
      if (text) allComments.push(text.replace(/<[^>]*>/g, '').trim());
    }

    pageToken = data.nextPageToken ?? '';
    if (!pageToken) break;
  }

  if (allComments.length === 0) {
    return NextResponse.json(
      { error: '댓글을 가져올 수 없습니다. 댓글이 비활성화된 영상일 수 있습니다.' },
      { status: 400 }
    );
  }

  const commentsText = allComments
    .slice(0, limit)
    .map((c, i) => `[${i + 1}] ${c}`)
    .join('\n')
    .slice(0, 14000);

  const prompt = `당신은 유튜브 크리에이터 전문 컨설턴트입니다. 아래 유튜브 영상의 댓글 ${allComments.length}개를 분석하여 크리에이터에게 유용한 인사이트를 추출해주세요.

영상 제목: ${videoTitle || '(알 수 없음)'}

댓글 목록:
${commentsText}

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "sentiment": {
    "positive": <긍정 댓글 비율 0-100 정수>,
    "neutral": <중립 댓글 비율 0-100 정수>,
    "negative": <부정 댓글 비율 0-100 정수>
  },
  "topThemes": [
    { "theme": "주제명 (10자 이내)", "count": <언급 횟수 추정 정수>, "summary": "이 주제가 댓글에서 어떻게 등장하는지 한 줄 설명" }
  ],
  "audienceQuestions": ["시청자들이 자주 묻는 질문 1", "질문 2", "질문 3"],
  "contentRequests": ["시청자들이 원하는 후속 콘텐츠 아이디어 1", "아이디어 2", "아이디어 3"],
  "painPoints": ["시청자들의 불만 또는 개선 요청 1", "불만 2"],
  "audienceProfile": "이 댓글들을 바탕으로 추정한 핵심 시청자층의 특징을 2~3문장으로 설명",
  "scriptIdeas": ["댓글 인사이트를 활용한 후속 영상 아이디어 1", "아이디어 2", "아이디어 3"]
}

주의사항:
- 모든 텍스트는 한국어로 작성 (영어 댓글도 한국어로 요약)
- topThemes는 3~5개
- sentiment 합계는 반드시 100`;

  try {
    const raw = await callAI(modelId, prompt, keys);
    const analysis = JSON.parse(extractJSON(raw));
    return NextResponse.json({
      videoId,
      videoTitle,
      totalComments: allComments.length,
      analysis,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message ?? '분석 실패' }, { status: 500 });
  }
}
