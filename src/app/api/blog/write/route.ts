/**
 * SEO 최적화 블로그 작성 API
 *
 * POST /api/blog/write
 *
 * Body:
 *   targetKeyword   필수: 메인 SEO 키워드
 *   relatedKeywords 옵션: 연관/LSI 키워드 배열 (검색량 높은 순 권장)
 *   platform        옵션: 'naver'(기본) | 'google'
 *   tone            옵션: 'informative'|'friendly'|'professional'|'storytelling'
 *   minLength       옵션: 최소 글자수 (기본 2000)
 *   source          옵션: 참고 원문 (URL 크롤링 결과 등)
 *   customPrompt    옵션: 추가 지시사항
 *   llmProvider     옵션: 'openai'|'anthropic'|'qwen' (기본: 설정된 키 우선순위대로)
 *   monthlyVolume   옵션: 검색량 (SEO 전략 조정용)
 *
 * Returns:
 *   content         마크다운 본문
 *   title           SEO 최적화 제목
 *   metaTitle       메타 title (60자 이내)
 *   metaDescription 메타 설명 (160자 이내)
 *   slug            URL slug (영문 + 하이픈)
 *   tags            네이버/구글 태그 배열 (10개)
 *   seoChecklist    SEO 점검 항목 배열
 *   provider        사용된 LLM 제공자
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// ─── LLM 호출 추상화 ──────────────────────────────────────────────────────────
async function callLLM(
  provider: string,
  apiKey: string,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  maxTokens = 4000,
): Promise<string> {
  if (provider === 'anthropic') {
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    const sys = messages.find(m => m.role === 'system')?.content ?? '';
    const userMsgs = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    const res = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: sys,
      messages: userMsgs,
    });
    return res.content[0]?.type === 'text' ? res.content[0].text : '';
  }

  if (provider === 'qwen') {
    const res = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'qwen-plus', messages, max_tokens: maxTokens, temperature: 0.7 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Qwen 오류 [${res.status}]: ${JSON.stringify(data)}`);
    return data.choices?.[0]?.message?.content ?? '';
  }

  // OpenAI (기본 fallback)
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });
  const res = await client.chat.completions.create({
    model: 'gpt-4o',
    messages,
    max_tokens: maxTokens,
    temperature: 0.7,
  });
  return res.choices[0]?.message?.content ?? '';
}

// ─── 플랫폼별 SEO 전략 가이드 ─────────────────────────────────────────────────
function getSeoGuide(platform: string, targetKeyword: string, relatedKeywords: string[]): string {
  const related = relatedKeywords.slice(0, 8).join(', ');
  const year = new Date().getFullYear();

  if (platform === 'naver') {
    return `
## 네이버 블로그 SEO 최적화 규칙 (C-RANK + DIA 알고리즘)

### 제목 규칙
- 제목 맨 앞에 "**${targetKeyword}**" 포함 (필수)
- 제목 길이 25~35자 권장
- 클릭을 유도하는 숫자나 강조 표현 포함 (예: "5가지", "완벽 정리", "${year}년 최신")

### 본문 구조 (DIA 알고리즘 핵심)
- 첫 문단(100자 이내)에 "${targetKeyword}" 자연스럽게 등장
- 소제목(##, ###)에 연관 키워드 배치: ${related}
- 최소 2000자 (검색 상위 노출의 기본 조건)
- 이미지 권장 위치: [이미지 삽입: 설명] 형태로 표시
- 본문 중간중간 핵심 키워드 3~5회 자연스럽게 반복
- 문단 말미에 공감/댓글 유도 문구 포함 (C-RANK에 영향)

### 태그 전략 (10개)
- 메인 키워드, 연관 키워드 우선
- 한글/영어 혼용 가능
- 검색량이 높은 순으로 배치

### 네이버 특화 문체
- 친근하고 대화체 문체 권장
- 정보 전달 + 개인 경험/의견 혼합
- 소제목 아래 요약 1~2줄 배치 (사용자 체류시간 증가)
- 결론에서 핵심 요약 + 다음 글 예고 또는 행동 유도`;
  }

  return `
## 구글 SEO 최적화 규칙 (E-E-A-T + Core Web Vitals)

### 제목 규칙 (H1)
- "${targetKeyword}"를 앞부분에 배치
- 60자 이내, 클릭률(CTR) 최적화
- 연도/숫자/형용사로 차별화 (예: "${year}년 최신", "완전 정복")

### 본문 구조 (E-E-A-T)
- 첫 문단에 "${targetKeyword}" 포함 + 글의 핵심 가치 제시
- H2 소제목: 연관 검색어 포함 ${related}
- H3: FAQ 형태 (People Also Ask 겨냥)
- 최소 1500자, 경쟁 키워드는 2500자+
- 리스트/표 활용 (Featured Snippet 겨냥)
- 전문성: 출처 언급, 통계/수치 포함

### 메타 최적화
- Meta Title: "${targetKeyword}" 포함, 60자 이내
- Meta Description: 검색 의도 반영, 160자 이내, CTA 포함

### 구글 특화 요소
- FAQ 섹션 (H3 + 답변 형식)
- 관련 키워드 자연 배치 (LSI keywords)
- 내부 링크 제안 [관련 글: ...] 형태로 표시
- 결론: 핵심 요약 + 독자 행동 유도`;
}

// ─── SEO 점검 리스트 생성 ─────────────────────────────────────────────────────
function buildSeoChecklist(
  content: string,
  title: string,
  targetKeyword: string,
  platform: string,
  minLength: number,
): { item: string; pass: boolean; tip: string }[] {
  const lower = content.toLowerCase();
  const kwLower = targetKeyword.toLowerCase();
  const firstParagraph = content.split('\n').slice(0, 5).join(' ');
  const headings = content.match(/^#{1,3}\s.+$/gm) ?? [];
  const wordCount = content.replace(/[^가-힣a-zA-Z\s]/g, '').trim().length;

  const checks = [
    {
      item: `제목에 "${targetKeyword}" 포함`,
      pass: title.includes(targetKeyword),
      tip: '제목 앞부분에 메인 키워드를 반드시 포함하세요',
    },
    {
      item: `첫 문단에 "${targetKeyword}" 등장`,
      pass: firstParagraph.includes(targetKeyword),
      tip: '첫 100자 이내에 키워드가 등장해야 합니다',
    },
    {
      item: `최소 글자수 ${minLength.toLocaleString()}자 달성`,
      pass: wordCount >= minLength,
      tip: `현재 약 ${wordCount.toLocaleString()}자 — ${minLength.toLocaleString()}자 이상이 SEO에 유리합니다`,
    },
    {
      item: '소제목(H2/H3) 3개 이상',
      pass: headings.length >= 3,
      tip: '소제목으로 글 구조를 명확히 하면 체류시간이 증가합니다',
    },
    {
      item: `본문에 "${targetKeyword}" 3회 이상 반복`,
      pass: (lower.match(new RegExp(kwLower, 'g')) ?? []).length >= 3,
      tip: '키워드를 자연스럽게 3~5회 반복하세요 (과도하면 패널티)',
    },
  ];

  if (platform === 'naver') {
    checks.push({
      item: '이미지 삽입 안내 포함',
      pass: content.includes('[이미지'),
      tip: '네이버 블로그는 이미지 포함 시 체류시간 증가로 C-RANK 상승',
    });
    checks.push({
      item: '공감/댓글 유도 문구 포함',
      pass: content.includes('공감') || content.includes('댓글') || content.includes('구독'),
      tip: '글 마지막에 공감/댓글/구독 유도 문구가 C-RANK에 영향을 줍니다',
    });
  } else {
    checks.push({
      item: 'FAQ 섹션 포함',
      pass: content.toLowerCase().includes('faq') || content.includes('자주 묻는') || content.includes('Q.') || content.includes('질문'),
      tip: 'FAQ는 구글 Featured Snippet 노출 가능성을 높입니다',
    });
    checks.push({
      item: '내부 링크 제안 포함',
      pass: content.includes('[관련 글') || content.includes('[함께 보면'),
      tip: '내부 링크는 사이트 체류시간 증가와 크롤링 최적화에 기여합니다',
    });
  }

  return checks;
}

// ─── Slug 생성 ────────────────────────────────────────────────────────────────
function generateSlug(keyword: string): string {
  // 한글을 romanize하는 간단 음역 맵
  const koreanRomanMap: Record<string, string> = {
    '홈트레이닝': 'home-training', '다이어트': 'diet', '운동': 'exercise',
    '건강': 'health', '요리': 'cooking', '재테크': 'investment',
    '주식': 'stock', '부동산': 'real-estate', '여행': 'travel',
    '맛집': 'restaurant', '카페': 'cafe', '리뷰': 'review',
  };
  // 등록된 단어가 있으면 사용
  for (const [ko, en] of Object.entries(koreanRomanMap)) {
    if (keyword.includes(ko)) return en + '-' + Date.now().toString(36);
  }
  // 영어/숫자만 추출해 slug 생성
  const ascii = keyword.replace(/[^a-zA-Z0-9\s-]/g, '').trim().toLowerCase().replace(/\s+/g, '-');
  if (ascii.length > 3) return ascii + '-' + Date.now().toString(36);
  // 한글 키워드를 영문으로 변환할 수 없을 경우 timestamp 기반
  return 'post-' + Date.now().toString(36);
}

// ─── POST Handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const meta = user.user_metadata ?? {};

    const {
      targetKeyword,
      relatedKeywords = [],
      platform        = 'naver',
      tone            = 'informative',
      minLength       = 2000,
      source          = '',
      customPrompt    = '',
      llmProvider     = '',
      monthlyVolume   = 0,
    } = await req.json() as {
      targetKeyword:   string;
      relatedKeywords?: string[];
      platform?:       'naver' | 'google';
      tone?:           string;
      minLength?:      number;
      source?:         string;
      customPrompt?:   string;
      llmProvider?:    string;
      monthlyVolume?:  number;
    };

    if (!targetKeyword?.trim()) {
      return NextResponse.json({ error: '목표 키워드(targetKeyword)가 필요합니다' }, { status: 400 });
    }

    // ── LLM 제공자 선택 (우선순위: 요청 → Anthropic → OpenAI → Qwen) ──────────
    let provider = '';
    let apiKey   = '';

    const candidates = llmProvider
      ? [[llmProvider, meta[`${llmProvider === 'anthropic' ? 'anthropic' : llmProvider === 'openai' ? 'openai' : 'qwen'}_api_key`]]]
      : [
          ['anthropic', meta.anthropic_api_key],
          ['openai',    meta.openai_api_key],
          ['qwen',      meta.qwen_api_key],
        ];

    for (const [p, k] of candidates) {
      if (k) { provider = p as string; apiKey = k as string; break; }
    }

    if (!provider) {
      return NextResponse.json(
        { error: 'Anthropic, OpenAI, Qwen 중 하나의 API 키를 설정에서 등록해주세요.' },
        { status: 400 }
      );
    }

    // ── 볼륨 기반 전략 조정 ────────────────────────────────────────────────────
    const volumeHint = monthlyVolume > 0
      ? `\n※ 이 키워드의 월간 검색량은 약 ${monthlyVolume.toLocaleString()}회입니다. ${
          monthlyVolume > 50000 ? '검색량이 매우 높아 경쟁이 치열합니다. 독창적인 앵글과 심층 정보로 차별화하세요.' :
          monthlyVolume > 10000 ? '적당한 검색량입니다. 충실한 정보와 실용적 팁으로 경쟁 우위를 확보하세요.' :
          '검색량이 낮은 롱테일 키워드입니다. 구체적이고 전문적인 내용으로 타겟 독자를 공략하세요.'
        }`
      : '';

    // ── 톤 안내 ───────────────────────────────────────────────────────────────
    const toneMap: Record<string, string> = {
      informative:   '정보 전달적이고 신뢰감 있는',
      friendly:      '친근하고 대화하듯 편안한',
      professional:  '전문적이고 권위 있는',
      storytelling:  '스토리텔링 기반의 흥미로운',
    };
    const toneDesc = toneMap[tone] ?? toneMap.informative;

    const seoGuide = getSeoGuide(platform, targetKeyword, relatedKeywords);
    const relatedKwStr = relatedKeywords.slice(0, 10).join(', ');

    // ── 시스템 프롬프트 ───────────────────────────────────────────────────────
    const today = new Date().toISOString().slice(0, 10);
    const year  = today.slice(0, 4);

    const systemPrompt = `당신은 SEO 전문 블로그 작가입니다. ${platform === 'naver' ? '네이버 블로그' : '구글 검색'} 최상위 노출을 목표로 고품질 콘텐츠를 작성합니다.

⚠ 현재 날짜: ${today}
- 제목·본문에 연도를 쓸 때 반드시 ${year}년으로 작성하세요
- "2024년 최신", "2023년 기준" 등 이미 지난 연도 표현 절대 사용 금지
- 연도가 포함된 예시(예: "2024년 최신")는 ${year}년으로 바꿔 적용하세요
- 참고 자료에 연도가 명시되지 않은 수치·법령·기준은 본문 끝에 "※ 정확한 수치는 공식 기관에서 확인하세요" 한 줄 안내 포함

${seoGuide}

## 출력 형식 (JSON)
반드시 아래 JSON 형식으로만 응답하세요. JSON 외 다른 텍스트 없이:
{
  "title": "SEO 최적화된 블로그 제목",
  "metaTitle": "메타 title (60자 이내)",
  "metaDescription": "메타 설명 (160자 이내, 클릭 유도 CTA 포함)",
  "content": "## 마크다운 형식 본문...",
  "tags": ["태그1", "태그2", "태그3", "태그4", "태그5", "태그6", "태그7", "태그8", "태그9", "태그10"]
}

content 필드는 반드시 마크다운이어야 하며 최소 ${minLength}자 이상입니다.`;

    // ── 사용자 프롬프트 ───────────────────────────────────────────────────────
    const userPrompt = `다음 조건으로 SEO 최적화 블로그 글을 작성해주세요.

**메인 키워드**: ${targetKeyword}
**연관 키워드**: ${relatedKwStr || '(없음)'}
**플랫폼**: ${platform === 'naver' ? '네이버 블로그' : '구글/워드프레스 블로그'}
**문체**: ${toneDesc}
**최소 글자수**: ${minLength.toLocaleString()}자 이상${volumeHint}
${source ? `\n**참고 원문**:\n${source.slice(0, 5000)}` : ''}
${customPrompt ? `\n**추가 지시사항**: ${customPrompt}` : ''}

JSON 형식으로만 응답하세요.`;

    const rawContent = await callLLM(
      provider,
      apiKey,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      5000,
    );

    // ── JSON 파싱 ─────────────────────────────────────────────────────────────
    let parsed: {
      title: string;
      metaTitle: string;
      metaDescription: string;
      content: string;
      tags: string[];
    };

    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON 형식을 찾지 못했습니다');
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      // JSON 파싱 실패 시 rawContent 자체를 content로 처리
      const fallbackTitle = `${targetKeyword} 완벽 가이드`;
      parsed = {
        title:           fallbackTitle,
        metaTitle:       fallbackTitle.slice(0, 60),
        metaDescription: `${targetKeyword}에 대한 모든 것을 알아보세요.`.slice(0, 160),
        content:         rawContent,
        tags:            [targetKeyword, ...relatedKeywords.slice(0, 9)],
      };
    }

    // ── 메타 필드 보정 ────────────────────────────────────────────────────────
    if (!parsed.metaTitle) parsed.metaTitle = parsed.title.slice(0, 60);
    if (!parsed.metaDescription) {
      const first = parsed.content.replace(/^#+\s.*$/m, '').trim().slice(0, 160);
      parsed.metaDescription = first || `${targetKeyword} - 자세히 알아보세요`;
    }
    if (!parsed.tags || parsed.tags.length === 0) {
      parsed.tags = [targetKeyword, ...relatedKeywords.slice(0, 9)];
    }

    // ── SEO 점검 ─────────────────────────────────────────────────────────────
    const seoChecklist = buildSeoChecklist(
      parsed.content,
      parsed.title,
      targetKeyword,
      platform,
      minLength,
    );

    const slug = generateSlug(targetKeyword);
    const passCount = seoChecklist.filter(c => c.pass).length;
    const seoScore = Math.round((passCount / seoChecklist.length) * 100);

    return NextResponse.json({
      title:           parsed.title,
      metaTitle:       parsed.metaTitle.slice(0, 60),
      metaDescription: parsed.metaDescription.slice(0, 160),
      content:         parsed.content,
      tags:            parsed.tags.slice(0, 10),
      slug,
      seoChecklist,
      seoScore,
      provider,
      targetKeyword,
      platform,
    });
  } catch (err: unknown) {
    console.error('[blog/write]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '블로그 작성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
