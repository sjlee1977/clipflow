/**
 * Wiki 수집 파이프라인 — URL → source + knowledge 자동 저장
 *
 * POST /api/wiki/sources/ingest
 * Body: { url: string, category?: string }
 *
 * 파이프라인:
 *   1. URL 크롤링 (Readability)
 *   2. 품질 필터 (저품질 자료 입구 차단)
 *   3. LLM 지식 추출
 *   4. type='source'  저장 — 원본 전문 보관
 *   5. type='knowledge' 저장 — 합성 지식 누적 (같은 topic이면 append)
 *
 * 품질 기준:
 *   - 본문 500자 미만 → 거부 (너무 짧음)
 *   - 광고/스팸 패턴 감지 → 거부
 *   - LLM이 관련성·신뢰도 점수 판정 → 50점 미만 거부
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';

// ── LLM 호출 (write-agent와 동일한 패턴) ──────────────────────────────────────
async function callLLM(
  model: string,
  apiKeys: Record<string, string>,
  system: string,
  userMsg: string,
  maxTokens = 1000,
): Promise<string> {
  const isClaude = model.startsWith('claude');
  const isQwen   = model.startsWith('qwen');
  const jsonInstruction = '\n\n반드시 유효한 JSON만 출력하세요. 마크다운 코드블록 없이.';

  if (isClaude) {
    const client = new Anthropic({ apiKey: apiKeys.anthropic });
    const res = await client.messages.create({
      model, max_tokens: maxTokens, temperature: 0.1,
      system: system + jsonInstruction,
      messages: [{ role: 'user', content: userMsg }],
    });
    return res.content[0]?.type === 'text' ? res.content[0].text : '';
  }

  if (isQwen) {
    const res = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKeys.qwen}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: maxTokens, temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system + jsonInstruction },
          { role: 'user',   content: userMsg },
        ],
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  // Gemini
  const ai = new GoogleGenAI({ apiKey: apiKeys.gemini });
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: userMsg }] }],
    config: {
      systemInstruction: system + jsonInstruction,
      maxOutputTokens: maxTokens,
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  });
  return response.text ?? '';
}

function safeJson<T>(raw: string, fallback: T): T {
  const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```\s*/g, '').trim();
  const match   = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return fallback;
  try { return JSON.parse(match[0]) as T; }
  catch { return fallback; }
}

// ── 품질 필터 — 1단계: 구조적 체크 (LLM 없음) ─────────────────────────────────
interface QualityResult {
  pass: boolean;
  reason: string;
  score: number;
}

function structuralQualityCheck(text: string, title: string): QualityResult {
  if (text.length < 500) {
    return { pass: false, reason: `본문이 너무 짧습니다 (${text.length}자 < 500자)`, score: 0 };
  }

  // 광고/스팸 패턴
  const spamPatterns = [
    /클릭\s*하\s*세\s*요/,
    /지금\s*구매/,
    /\d+%\s*할인/,
    /무료\s*체험/,
    /광고\s*문의/,
    /바로가기/,
  ];
  const spamCount = spamPatterns.filter(p => p.test(text)).length;
  if (spamCount >= 3) {
    return { pass: false, reason: `광고/스팸 패턴 ${spamCount}개 감지`, score: 0 };
  }

  // 반복 문자 비율 (저품질 SEO 어뷰징)
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const shortLineRatio = lines.filter(l => l.trim().length < 20).length / Math.max(lines.length, 1);
  if (shortLineRatio > 0.7 && lines.length > 20) {
    return { pass: false, reason: `단문 나열 비율 과다 (${Math.round(shortLineRatio * 100)}%)`, score: 20 };
  }

  return { pass: true, reason: '구조적 검사 통과', score: 60 };
}

// ── 품질 필터 — 2단계: LLM 관련성·신뢰도 평가 ─────────────────────────────────
async function llmQualityCheck(
  model: string, apiKeys: Record<string, string>,
  title: string, excerpt: string,
): Promise<QualityResult> {
  const raw = await callLLM(
    model, apiKeys,
    '당신은 콘텐츠 품질 평가자입니다. 아래 자료를 평가하고 JSON으로 답하세요.',
    `제목: ${title}\n요약: ${excerpt.slice(0, 500)}\n\n평가 기준:\n- 정보성: 구체적인 수치/사례/원리가 있는가\n- 신뢰도: 출처가 명확하거나 전문성이 느껴지는가\n- 유용성: 블로그 글 작성에 재사용할 수 있는 내용인가\n\n출력:\n{"score": 0~100, "reason": "한 줄 이유", "category": "finance|psychology|health|tech|society|general"}`,
    300,
  );
  const result = safeJson<{ score?: number; reason?: string; category?: string }>(raw, {});
  const score  = result.score ?? 50;
  if (score < 50) {
    return { pass: false, reason: result.reason ?? `품질 점수 미달 (${score}점)`, score };
  }
  return { pass: true, reason: result.reason ?? `품질 점수 통과 (${score}점)`, score };
}

// ── 지식 추출 ──────────────────────────────────────────────────────────────────
interface KnowledgeExtract {
  category: string; topic: string; title: string; tags: string[];
  keyFacts: string[]; painPoints: string[]; angles: string[]; cautions: string[];
}

async function extractKnowledge(
  model: string, apiKeys: Record<string, string>,
  articleTitle: string, articleText: string, hintCategory: string,
): Promise<KnowledgeExtract | null> {
  const raw = await callLLM(
    model, apiKeys,
    '당신은 자료에서 재사용 가능한 지식을 추출하는 전문가입니다.',
    `제목: ${articleTitle}\n\n본문 (앞 3000자):\n${articleText.slice(0, 3000)}\n\n힌트 카테고리: ${hintCategory || '없음'}\n\n출력 (JSON):\n{"category":"finance|psychology|health|tech|society|general","topic":"영문-슬러그","title":"한글-주제명","tags":["태그1","태그2","태그3"],"keyFacts":["수치/팩트1","수치/팩트2"],"painPoints":["독자고통1","독자고통2"],"angles":["차별화앵글1","차별화앵글2"],"cautions":["팩트체크주의1"]}`,
    800,
  );
  const extracted = safeJson<Partial<KnowledgeExtract>>(raw, {});
  if (!extracted.topic || !extracted.title) return null;
  return {
    category:   extracted.category   ?? 'general',
    topic:      extracted.topic,
    title:      extracted.title,
    tags:       extracted.tags        ?? [],
    keyFacts:   extracted.keyFacts    ?? [],
    painPoints: extracted.painPoints  ?? [],
    angles:     extracted.angles      ?? [],
    cautions:   extracted.cautions    ?? [],
  };
}

// ── POST Handler ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const body              = await req.json();
    const { url, category: hintCategory = '' } = body;
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url 필수' }, { status: 400 });
    }

    // URL 유효성
    let parsedUrl: URL;
    try { parsedUrl = new URL(url); }
    catch { return NextResponse.json({ error: '유효하지 않은 URL' }, { status: 400 }); }

    // 모델/키 결정
    const meta    = user.user_metadata ?? {};
    const apiKeys = {
      gemini:    meta.gemini_api_key    ?? '',
      anthropic: meta.anthropic_api_key ?? '',
      qwen:      meta.qwen_api_key      ?? '',
    };
    let model = '';
    if (apiKeys.gemini)         model = 'gemini-2.5-flash';
    else if (apiKeys.anthropic) model = 'claude-sonnet-4-6';
    else if (apiKeys.qwen)      model = 'qwen3.5-plus';
    else return NextResponse.json({ error: 'API 키가 없습니다' }, { status: 400 });

    // ── Step 1: 크롤링 ─────────────────────────────────────────────────────────
    const { JSDOM }       = await import('jsdom');
    const { Readability } = await import('@mozilla/readability');

    const fetchRes = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!fetchRes.ok) {
      return NextResponse.json({ error: `페이지를 가져올 수 없습니다 (${fetchRes.status})` }, { status: 400 });
    }

    const html    = await fetchRes.text();
    const dom     = new JSDOM(html, { url: parsedUrl.toString() });
    const article = new Readability(dom.window.document).parse();
    if (!article) {
      return NextResponse.json({ error: '본문을 추출할 수 없습니다' }, { status: 422 });
    }

    const cleanText = (article.textContent ?? '')
      .replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();

    // ── Step 2: 구조적 품질 필터 ──────────────────────────────────────────────
    const structCheck = structuralQualityCheck(cleanText, article.title ?? '');
    if (!structCheck.pass) {
      return NextResponse.json(
        { error: `품질 기준 미달: ${structCheck.reason}`, qualityScore: structCheck.score },
        { status: 422 },
      );
    }

    // ── Step 3: LLM 품질 평가 ─────────────────────────────────────────────────
    const llmCheck = await llmQualityCheck(model, apiKeys, article.title ?? '', article.excerpt ?? cleanText.slice(0, 300));
    if (!llmCheck.pass) {
      return NextResponse.json(
        { error: `품질 기준 미달: ${llmCheck.reason}`, qualityScore: llmCheck.score },
        { status: 422 },
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    // ── Step 4: type='source' 저장 (원본 전문 보관) ───────────────────────────
    const { data: sourceRow, error: sourceErr } = await supabase
      .from('user_wiki_pages')
      .insert({
        user_id:  user.id,
        type:     'source',
        category: hintCategory || 'general',
        topic:    parsedUrl.hostname,
        title:    article.title ?? url,
        content:  cleanText,
        tags:     [],
        metadata: {
          url,
          crawled_at:    today,
          quality_score: llmCheck.score,
          word_count:    cleanText.length,
          site_name:     article.siteName ?? parsedUrl.hostname,
          byline:        article.byline ?? '',
        },
      })
      .select('id')
      .single();
    if (sourceErr) throw sourceErr;

    // ── Step 5: LLM 지식 추출 → type='knowledge' 저장 ────────────────────────
    const extracted = await extractKnowledge(model, apiKeys, article.title ?? '', cleanText, hintCategory);

    let knowledgeId: string | null = null;
    if (extracted) {
      const knowledgeContent = `---
category: ${extracted.category}
topic: ${extracted.topic}
tags: [${extracted.tags.join(', ')}]
updated: ${today}
---

# ${extracted.title}

## 핵심 수치 / 팩트
${extracted.keyFacts.map(f => `- ${f}`).join('\n') || '- (없음)'}

## 독자 고통 포인트
${extracted.painPoints.map(p => `- ${p}`).join('\n') || '- (없음)'}

## 차별화 앵글
${extracted.angles.map(a => `- ${a}`).join('\n') || '- (없음)'}

## 주의 / 팩트체크 포인트
${extracted.cautions.map(c => `- ${c}`).join('\n') || '- (없음)'}
`;

      // 같은 topic이면 append, 없으면 신규
      const { data: existing } = await supabase
        .from('user_wiki_pages')
        .select('id, content')
        .eq('user_id', user.id)
        .eq('type', 'knowledge')
        .eq('topic', extracted.topic)
        .single();

      if (existing) {
        const appended = existing.content
          + `\n\n---\n\n## 업데이트 (${today}) — 출처: ${parsedUrl.hostname}\n\n`
          + extracted.keyFacts.map(f => `- ${f}`).join('\n');
        const { data: updated } = await supabase
          .from('user_wiki_pages')
          .update({ content: appended, tags: extracted.tags, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select('id')
          .single();
        knowledgeId = updated?.id ?? null;
      } else {
        const { data: created } = await supabase
          .from('user_wiki_pages')
          .insert({
            user_id: user.id, type: 'knowledge',
            category: extracted.category, topic: extracted.topic,
            title: extracted.title, content: knowledgeContent,
            tags: extracted.tags,
            metadata: {
              auto_extracted: true,
              source_id: sourceRow?.id,
              source_url: url,
              extracted_at: today,
            },
          })
          .select('id')
          .single();
        knowledgeId = created?.id ?? null;
      }
    }

    return NextResponse.json({
      ok:           true,
      sourceId:     sourceRow?.id,
      knowledgeId,
      qualityScore: llmCheck.score,
      qualityReason: llmCheck.reason,
      extracted: extracted ? {
        category: extracted.category,
        topic:    extracted.topic,
        title:    extracted.title,
        factsCount: extracted.keyFacts.length,
      } : null,
    }, { status: 201 });

  } catch (err: unknown) {
    console.error('[wiki/sources/ingest]', err);
    if (err instanceof Error && err.name === 'TimeoutError') {
      return NextResponse.json({ error: '페이지 로딩 시간 초과' }, { status: 408 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '수집 실패' },
      { status: 500 },
    );
  }
}
