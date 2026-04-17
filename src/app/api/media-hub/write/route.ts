/**
 * POST /api/media-hub/write
 *
 * 카테고리별 멀티플랫폼 콘텐츠 생성 파이프라인.
 * 여행(travel) / 경제(economy) / IT(it) 카테고리 지원.
 *
 * 흐름: Researcher(1회) → Writer×3 → Editor×3 → Evaluator → [Refiner×3] → ImageGen
 */
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase-server';
import { generateFalImage } from '@/lib/fal-image';

type Platform = 'naver' | 'wordpress' | 'personal';
type Category = 'travel' | 'economy' | 'it';

interface PlatformVersion { title: string; content: string; images: { marker: string; url: string; alt: string }[] }
interface EvalResult { dimensions: { name: string; score: number; reason: string }[]; totalScore: number; passed: boolean; suggestions: string[] }

// ── LLM 호출 ─────────────────────────────────────────────────────────────────
async function llm(
  model: string, keys: Record<string, string>,
  system: string, messages: { role: 'user' | 'assistant'; content: string }[],
  maxTokens = 3500, temp = 0.7, json = false,
): Promise<string> {
  const isClaude = model.startsWith('claude');
  const isQwen   = model.startsWith('qwen');
  const sys = json && !model.startsWith('gemini')
    ? `${system}\n\n반드시 유효한 JSON만 출력. 마크다운 코드블록 없이.`
    : system;

  if (isClaude) {
    const client = new Anthropic({ apiKey: keys.anthropic });
    const res = await client.messages.create({ model, max_tokens: maxTokens, temperature: temp, system: sys, messages });
    return res.content[0]?.type === 'text' ? res.content[0].text : '';
  }
  if (isQwen) {
    const body: Record<string, unknown> = {
      model, max_tokens: maxTokens, temperature: temp,
      messages: [{ role: 'system', content: sys }, ...messages],
    };
    if (json) body.response_format = { type: 'json_object' };
    const res = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${keys.qwen}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Qwen 오류: ${data?.error?.message ?? res.status}`);
    return data.choices?.[0]?.message?.content ?? '';
  }
  const ai = new GoogleGenAI({ apiKey: keys.gemini });
  const config: Record<string, unknown> = { systemInstruction: sys, maxOutputTokens: maxTokens, temperature: temp };
  if (json) config.responseMimeType = 'application/json';
  const response = await ai.models.generateContent({
    model,
    contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    config,
  });
  return response.text ?? '';
}

function safeJson<T>(raw: string, fallback: T): T {
  const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```\s*/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return fallback;
  try { return JSON.parse(match[0]) as T; } catch { return fallback; }
}

// ── 플랫폼 가이드 ──────────────────────────────────────────────────────────────
const PLATFORM_GUIDE: Record<Platform, { lengthDesc: string; maxTokens: number; guide: string }> = {
  naver: {
    lengthDesc: '800~1200자 (모바일 최적화)',
    maxTokens: 3000,
    guide: `## 네이버 블로그 원칙
- 목표 길이: 800~1200자, 모바일 스크롤 3회 이내
- 문체: 친근한 구어체 ("~해요", "~거든요", "~더라고요")
- 문단: 최대 3줄 (모바일 가독성)
- 소제목: ## 2~3개 (네이버 VIEW 최적화)
- SEO: 키워드를 첫 문단 50자 이내 자연 배치
- 이미지: 2~3곳에 [IMAGE: 한국어 장면 설명] 삽입 필수`,
  },
  wordpress: {
    lengthDesc: '1500~2500자 (구글 SEO 최적)',
    maxTokens: 7000,
    guide: `## 워드프레스 SEO 원칙
- 목표 길이: 1500~2500자
- 문체: 전문적·신뢰감 있는 표현
- 구조: H2로 주요 섹션 3~4개, H3으로 세부 내용
- SEO: 키워드 밀도 1~2%, 첫 문단 150자가 메타 설명 역할
- 이미지: 각 H2 섹션 후 1개씩 [IMAGE: 한국어 장면 설명] 삽입
- 마무리: 명확한 결론 + 독자 행동 유도`,
  },
  personal: {
    lengthDesc: '1000~1500자 (개인 브랜딩)',
    maxTokens: 4500,
    guide: `## 개인 웹사이트 원칙
- 목표 길이: 1000~1500자
- 문체: 1인칭 개인 관점 ("저는", "제 경험으로는")
- 핵심: 네이버/워드프레스와 다른 독창적 각도 제시
- 이미지: 1~2곳에만 [IMAGE: 한국어 장면 설명] 삽입
- 마무리: 독자와 대화 유도`,
  },
};

// ── 카테고리별 시스템 프롬프트 ──────────────────────────────────────────────────
function getCategoryPrompt(category: Category, articleType: string): string {
  if (category === 'travel') {
    const typeGuide: Record<string, string> = {
      hotel:   '호텔·숙소 추천 글 (TOP 5 형식, 위치·가격·특징 포함)',
      guide:   '여행지 완벽 가이드 (교통·명소·맛집·예산 전반)',
      hidden:  '현지인만 아는 숨은 명소 소개 (대중 관광지 대비 차별점 강조)',
      food:    '미식 여행 가이드 (대표 음식·맛집 추천·현지 먹방 팁)',
      budget:  '저예산 여행 완벽 가이드 (비용 절약 팁 실수치 포함)',
    };
    return `당신은 10년 경력의 여행 전문 작가입니다.
기사 유형: ${typeGuide[articleType] ?? typeGuide['guide']}

작성 원칙:
- 독자가 실제 여행을 계획할 수 있는 실용적 정보 중심
- 구체적 수치(거리, 소요 시간, 예상 비용)를 반드시 포함
- 계절·시기별 특성 언급
- 현지 문화·예절 팁 1~2가지 포함
- 예약 링크나 공식 사이트 언급 권장 ("공식 사이트 참고" 형식)`;
  }

  if (category === 'economy') {
    return `당신은 경제 전문 기자입니다.
기사 유형: ${articleType}

작성 원칙:
- 최신 경제 데이터와 수치를 구체적으로 인용
- 독자가 투자·소비 결정에 활용할 수 있는 인사이트 제공
- 전문 용어는 쉽게 풀어서 설명
- 낙관/비관 양면을 균형 있게 서술`;
  }

  return `당신은 IT 전문 기자입니다.
기사 유형: ${articleType}

작성 원칙:
- 기술 트렌드를 비개발자도 이해할 수 있게 설명
- 실생활 적용 사례와 활용법 강조
- 제품 비교 시 구체적 스펙·가격 포함
- 업계 전망과 독자 액션 아이템 제시`;
}

// ── 이미지 생성 ────────────────────────────────────────────────────────────────
function buildFluxPrompt(desc: string, platform: Platform, category: Category): string {
  const categoryStyle = category === 'travel'
    ? 'travel photography, beautiful destination, natural scenery'
    : category === 'economy'
    ? 'business and finance, professional photography, charts and graphs aesthetic'
    : 'technology, modern tech devices, clean minimal';

  const base = `${categoryStyle}, ${desc}, high quality, natural lighting`;
  if (platform === 'naver')     return `${base}, warm colors, mobile-friendly`;
  if (platform === 'wordpress') return `${base}, professional editorial style`;
  return `${base}, personal brand photography, authentic candid`;
}

async function generateImages(
  content: string, platform: Platform, category: Category,
  imageModelId: string, falApiKey: string,
): Promise<{ content: string; images: { marker: string; url: string; alt: string }[] }> {
  const markers = [...content.matchAll(/\[IMAGE:\s*([^\]]+)\]/gi)];
  if (!markers.length || !falApiKey) return { content, images: [] };

  const images: { marker: string; url: string; alt: string }[] = [];
  let result = content;

  for (const match of markers) {
    const fullMatch  = match[0];
    const description = match[1];
    try {
      const prompt = await buildFluxPrompt(description.trim(), platform, category);
      const url    = await generateFalImage(prompt, imageModelId, 'landscape', falApiKey);
      if (url) {
        const alt = description.slice(0, 60);
        result = result.replace(fullMatch, `![${alt}](${url})`);
        images.push({ marker: fullMatch, url, alt });
      }
    } catch { /* 이미지 실패 시 마커 유지 */ }
  }
  return { content: result, images };
}

// ── Researcher ────────────────────────────────────────────────────────────────
async function runResearcher(
  model: string, keys: Record<string, string>,
  category: Category, topic: string, destination: string, articleType: string,
  sourceData: Record<string, unknown>,
): Promise<string> {
  const dataStr = Object.keys(sourceData).length
    ? `\n\n## 수집된 리서치 데이터\n${JSON.stringify(sourceData, null, 2)}`
    : '';

  const prompt = `카테고리: ${category}
여행지/주제: ${destination || topic}
기사 유형: ${articleType}
${dataStr}

위 정보를 분석해 다음을 도출하세요:
1. 핵심 특징 및 차별점 3~5가지
2. 독자가 가장 궁금해할 질문 5가지
3. 포함해야 할 구체적 수치/사실
4. 글의 핵심 메시지 (1문장)
5. 추천 키워드 5개 (SEO용)`;

  return llm(model, keys,
    `당신은 콘텐츠 리서처입니다. 주어진 데이터를 분석해 작가가 활용할 핵심 인사이트를 정리합니다.`,
    [{ role: 'user', content: prompt }],
    2000, 0.5,
  );
}

// ── Platform Writer ────────────────────────────────────────────────────────────
async function runWriter(
  model: string, keys: Record<string, string>,
  platform: Platform, category: Category, topic: string, destination: string,
  articleType: string, researchInsights: string,
): Promise<{ title: string; content: string }> {
  const pg = PLATFORM_GUIDE[platform];
  const catPrompt = getCategoryPrompt(category, articleType);
  const subject = destination || topic;

  const raw = await llm(model, keys,
    `${catPrompt}\n\n${pg.guide}`,
    [{
      role: 'user',
      content: `주제: ${subject}
목표 길이: ${pg.lengthDesc}

리서치 인사이트:
${researchInsights}

위 정보를 바탕으로 ${platform} 최적화 글을 작성하세요.
형식: 첫 줄에 "제목: [제목]", 이후 본문.`,
    }],
    pg.maxTokens, 0.75,
  );

  const titleMatch = raw.match(/^제목:\s*(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : subject;
  const content = raw.replace(/^제목:.+\n?/m, '').trim();
  return { title, content };
}

// ── Platform Editor ────────────────────────────────────────────────────────────
async function runEditor(
  model: string, keys: Record<string, string>,
  platform: Platform, title: string, content: string,
): Promise<{ title: string; content: string }> {
  const pg = PLATFORM_GUIDE[platform];
  const raw = await llm(model, keys,
    `당신은 ${platform} 전문 편집자입니다. 글의 흐름·가독성·SEO를 개선합니다.`,
    [{
      role: 'user',
      content: `제목: ${title}\n\n${content}\n\n---\n편집 기준: ${pg.guide}\n\n개선된 버전을 "제목: [제목]" 형식으로 출력하세요.`,
    }],
    pg.maxTokens, 0.5,
  );

  const titleMatch = raw.match(/^제목:\s*(.+)$/m);
  return {
    title:   titleMatch ? titleMatch[1].trim() : title,
    content: raw.replace(/^제목:.+\n?/m, '').trim(),
  };
}

// ── Evaluator ─────────────────────────────────────────────────────────────────
async function runEvaluator(
  model: string, keys: Record<string, string>,
  category: Category, title: string, content: string,
): Promise<EvalResult> {
  const dimensions = category === 'travel'
    ? ['정보 정확성', '실용성', 'SEO', '가독성', '이미지 마커', '구조', '차별성', '독자 유도']
    : ['정보 신뢰성', '명확성', 'SEO', '가독성', '이미지 마커', '구조', '전문성', '독자 유도'];

  const raw = await llm(model, keys,
    `당신은 콘텐츠 품질 평가자입니다. 각 차원을 0~10점으로 평가해 JSON으로 출력합니다.`,
    [{
      role: 'user',
      content: `제목: ${title}\n\n${content}\n\n평가 차원: ${dimensions.join(', ')}\n\n{"dimensions":[{"name":"...","score":8,"reason":"..."}],"totalScore":80,"passed":true,"suggestions":[]}`,
    }],
    1500, 0.3, true,
  );

  return safeJson<EvalResult>(raw, {
    dimensions: dimensions.map(n => ({ name: n, score: 7, reason: '자동 평가' })),
    totalScore: 70, passed: false, suggestions: ['재작성 필요'],
  });
}

// ── Refiner ───────────────────────────────────────────────────────────────────
async function runRefiner(
  model: string, keys: Record<string, string>,
  platform: Platform, title: string, content: string,
  suggestions: string[],
): Promise<{ title: string; content: string }> {
  const pg = PLATFORM_GUIDE[platform];
  const raw = await llm(model, keys,
    `당신은 콘텐츠 개선 전문가입니다. 평가 결과를 바탕으로 글을 전면 개선합니다.`,
    [{
      role: 'user',
      content: `제목: ${title}\n\n${content}\n\n개선 사항:\n${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n"제목: [제목]" 형식으로 개선된 버전 출력`,
    }],
    pg.maxTokens, 0.7,
  );

  const titleMatch = raw.match(/^제목:\s*(.+)$/m);
  return {
    title:   titleMatch ? titleMatch[1].trim() : title,
    content: raw.replace(/^제목:.+\n?/m, '').trim(),
  };
}

// ── POST Handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const body = await req.json() as {
      postId?: string;
      category: Category; articleType?: string;
      topic: string; destination?: string;
      sourceData?: Record<string, unknown>;
      platforms?: Platform[]; modelId?: string;
      generateImages?: boolean; imageModelId?: string;
      saveToDb?: boolean;
    };

    const meta = (user.user_metadata ?? {}) as Record<string, string>;
    const keys = {
      anthropic: meta.anthropic_api_key ?? process.env.ANTHROPIC_API_KEY ?? '',
      gemini:    meta.gemini_api_key    ?? process.env.GEMINI_API_KEY    ?? '',
      qwen:      meta.qwen_api_key      ?? process.env.QWEN_API_KEY      ?? '',
    };
    const falKey   = meta.fal_api_key ?? process.env.FAL_KEY ?? '';
    const model    = body.modelId ?? 'claude-sonnet-4-6';
    const category = body.category ?? 'travel';
    const articleType = body.articleType ?? 'guide';
    const platforms   = body.platforms ?? ['naver', 'wordpress', 'personal'];
    const destination = body.destination ?? '';
    const sourceData  = body.sourceData ?? {};

    // DB 상태 → generating
    if (body.postId && body.saveToDb) {
      await supabase.from('media_posts').update({ status: 'generating' }).eq('id', body.postId).eq('user_id', user.id);
    }

    const steps: { agent: string; status: 'done' | 'error'; summary: string }[] = [];

    // 1. Researcher
    const researchInsights = await runResearcher(model, keys, category, body.topic, destination, articleType, sourceData)
      .then(r => { steps.push({ agent: 'Researcher', status: 'done', summary: r.slice(0, 100) }); return r; })
      .catch(e => { steps.push({ agent: 'Researcher', status: 'error', summary: String(e) }); return ''; });

    // 2. Writer×3 (병렬)
    const written = await Promise.all(
      platforms.map(p => runWriter(model, keys, p, category, body.topic, destination, articleType, researchInsights)
        .then(r => { steps.push({ agent: `Writer(${p})`, status: 'done', summary: r.title }); return { platform: p, ...r }; })
        .catch(e => { steps.push({ agent: `Writer(${p})`, status: 'error', summary: String(e) }); return { platform: p, title: body.topic, content: '' }; }),
      ),
    );

    // 3. Editor×3 (병렬)
    const edited = await Promise.all(
      written.map(w => runEditor(model, keys, w.platform as Platform, w.title, w.content)
        .then(r => { steps.push({ agent: `Editor(${w.platform})`, status: 'done', summary: r.title }); return { platform: w.platform, ...r }; })
        .catch(() => w),
      ),
    );

    // 4. Evaluator (WordPress 기준)
    const wpVersion  = edited.find(e => e.platform === 'wordpress') ?? edited[0];
    const evaluation = await runEvaluator(model, keys, category, wpVersion.title, wpVersion.content)
      .then(r => { steps.push({ agent: 'Evaluator', status: 'done', summary: `${r.totalScore}점 (${r.passed ? '통과' : '미달'})` }); return r; })
      .catch(e => { steps.push({ agent: 'Evaluator', status: 'error', summary: String(e) }); return { dimensions: [], totalScore: 0, passed: false, suggestions: [] }; });

    // 5. Refiner (80점 미달 시)
    let finalVersions = edited;
    let refinementRounds = 0;
    if (!evaluation.passed && evaluation.suggestions.length) {
      const refined = await Promise.all(
        edited.map(e => runRefiner(model, keys, e.platform as Platform, e.title, e.content, evaluation.suggestions)
          .then(r => { steps.push({ agent: `Refiner(${e.platform})`, status: 'done', summary: r.title }); return { platform: e.platform, ...r }; })
          .catch(() => e),
        ),
      );
      finalVersions = refined;
      refinementRounds = 1;
    }

    // 6. 이미지 생성 (병렬)
    const withImages = await Promise.all(
      finalVersions.map(async v => {
        if (!body.generateImages) return { ...v, images: [] };
        const result = await generateImages(v.content, v.platform as Platform, category, body.imageModelId ?? 'fal/flux-schnell', falKey);
        return { platform: v.platform, title: v.title, content: result.content, images: result.images };
      }),
    );

    // 플랫폼별 결과 추출
    const get = (p: Platform): PlatformVersion => {
      const v = withImages.find(x => x.platform === p);
      return v ? { title: v.title, content: v.content, images: v.images } : { title: body.topic, content: '', images: [] };
    };
    const naverV    = get('naver');
    const wpV       = get('wordpress');
    const personalV = get('personal');

    // 7. DB 저장
    if (body.postId && body.saveToDb) {
      await supabase.from('media_posts').update({
        status:             'ready',
        naver_title:        naverV.title,    naver_content:     naverV.content,    naver_images:     naverV.images,
        wordpress_title:    wpV.title,       wordpress_content: wpV.content,       wordpress_images: wpV.images,
        personal_title:     personalV.title, personal_content:  personalV.content, personal_images:  personalV.images,
        evaluation:         evaluation,
        refinement_rounds:  refinementRounds,
      }).eq('id', body.postId).eq('user_id', user.id);
    }

    return NextResponse.json({
      naver: naverV, wordpress: wpV, personal: personalV,
      evaluation, refinementRounds, steps,
      postId: body.postId,
    });
  } catch (err) {
    console.error('[media-hub/write]', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
