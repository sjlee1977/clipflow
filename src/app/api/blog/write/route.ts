import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase-server';
import fs from 'fs';
import path from 'path';

// ── 위키 파일 로더 ──────────────────────────────────────────────────────────────
const WIKI_DIR = path.join(process.cwd(), 'wiki');

function readWikiFile(relativePath: string): string {
  try {
    return fs.readFileSync(path.join(WIKI_DIR, relativePath), 'utf-8');
  } catch {
    return '';
  }
}

function getLatestFeedback(): string {
  try {
    const feedbackDir = path.join(WIKI_DIR, 'feedback');
    const files = fs.readdirSync(feedbackDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse();
    if (files.length === 0) return '';
    return fs.readFileSync(path.join(feedbackDir, files[0]), 'utf-8');
  } catch {
    return '';
  }
}

// 이 글에 필요한 원칙 파일을 로드
function loadRelevantPrinciples(content: string, tone: string): string {
  const persona    = readWikiFile('blog/writer-persona.md');
  const hook       = readWikiFile('blog/hook-writing.md');
  const structure  = readWikiFile('blog/structure.md');
  const narrative  = readWikiFile('blog/narrative-techniques.md');
  const cta        = readWikiFile('blog/cta-writing.md');

  // 항상 로드: 페르소나 + 훅 + 구조 + 서사기법 + CTA
  let principles = [
    persona    ? `### 작가 페르소나\n${persona}`        : '',
    hook       ? `### 훅 작성 원칙\n${hook}`            : '',
    structure  ? `### 블로그 구조 원칙\n${structure}`   : '',
    narrative  ? `### 서사 기법\n${narrative}`          : '',
    cta        ? `### CTA 작성 원칙\n${cta}`            : '',
  ].filter(Boolean).join('\n\n');

  // 조건부 로드
  const lowerContent = content.toLowerCase();
  const hasNumbers   = /\d+%|\d+배|\d+명|\d+만|\d+억/.test(content);
  const isStorytelling = tone === 'friendly' || tone === 'casual';
  const isSEO        = lowerContent.includes('seo') || lowerContent.includes('검색') || lowerContent.includes('키워드');

  if (hasNumbers) {
    const numbers = readWikiFile('blog/numbers-usage.md');
    if (numbers) principles += `\n\n### 숫자/데이터 활용 원칙\n${numbers}`;
  }
  if (isStorytelling) {
    const emotional = readWikiFile('blog/emotional-flow.md');
    if (emotional) principles += `\n\n### 감정 흐름 설계 원칙\n${emotional}`;
  }
  if (isSEO) {
    const seo = readWikiFile('blog/seo-principles.md');
    if (seo) principles += `\n\n### SEO 원칙\n${seo}`;
  }

  const feedback = getLatestFeedback();
  if (feedback) {
    principles += `\n\n### 최근 피드백 (반드시 반영)\n${feedback}`;
  }

  return principles;
}

// ── System Prompt 빌더 ──────────────────────────────────────────────────────────
function buildSystemPrompt(content: string, tone: string): string {
  const principles = loadRelevantPrinciples(content, tone);

  return `당신은 10년 경력의 전문 블로그 작가입니다.
아래 글쓰기 원칙과 서사 기법을 완전히 내면화한 상태로 글을 씁니다.
원칙을 "따른다"가 아니라 원칙이 몸에 배어 있는 작가처럼 씁니다.

━━━━━━━━━━━━━━━━━━━━━━━━━
글쓰기 원칙 & 기법
━━━━━━━━━━━━━━━━━━━━━━━━━
${principles}

━━━━━━━━━━━━━━━━━━━━━━━━━
작성 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━
- 마크다운 형식 (## 제목, ### 소제목, **굵게**, - 목록, > 인용)
- 한국어 문체. 독자는 30대 직장인 한 명이라고 가정한다.
- 글을 완성한 후 아래 10개 항목을 스스로 점검하고, 미달 항목은 즉시 수정한다:

  [ 훅 ] 1. 첫 문장이 훅 유형(A/B/C형) 중 하나이고, "안녕하세요"로 시작하지 않는가?
  [ 훅 ] 2. 첫 단락이 구체적 장면이나 상황으로 시작하는가?
  [ 구조 ] 3. 5막 구조(훅→갈등→반전→증명→해소)의 흐름이 명확한가?
  [ 구조 ] 4. 소제목만 읽어도 서사 흐름이 파악되는가?
  [ 서사 ] 5. "보여주기(Show)"를 사용하는가? "그는 피곤했다" 같은 직접 서술은 없는가?
  [ 서사 ] 6. 짧은 문장과 긴 문장이 의도적으로 섞여 리듬이 살아있는가?
  [ 서사 ] 7. 3번째 단락 부근에 "놀람 포인트"가 있는가?
  [ 감정 ] 8. 긴장→공감→놀람→안도→행동의 감정 흐름이 설계되어 있는가?
  [ 금지 ] 9. "지금까지 ~알아보았습니다", "도움이 됐으면 좋겠습니다" 같은 금지 표현이 없는가?
  [ CTA ] 10. CTA가 1개이고, 핵심 인사이트 전달 직후에 배치되어 있는가?`;
}

// ── LLM 호출 (Gemini / Claude / Qwen) ─────────────────────────────────────────
async function callLLM(
  model: string,
  apiKeys: Record<string, string>,
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  maxTokens = 3000,
  temperature = 0.7,
): Promise<string> {
  const isClaude = model.startsWith('claude');
  const isQwen   = model.startsWith('qwen');

  if (isClaude) {
    const key = apiKeys.anthropic;
    if (!key) throw new Error('Anthropic API 키가 없습니다 (설정에서 등록)');
    const client = new Anthropic({ apiKey: key });
    const res = await client.messages.create({
      model, max_tokens: maxTokens, temperature,
      system: systemPrompt,
      messages,
    });
    return res.content[0]?.type === 'text' ? res.content[0].text : '';
  }

  if (isQwen) {
    const key = apiKeys.qwen;
    if (!key) throw new Error('Qwen API 키가 없습니다 (설정에서 등록)');
    const res = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: maxTokens, temperature,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Qwen 오류: ${data?.error?.message ?? res.status}`);
    return data.choices?.[0]?.message?.content ?? '';
  }

  // Gemini (기본)
  const key = apiKeys.gemini;
  if (!key) throw new Error('Gemini API 키가 없습니다 (설정에서 등록)');
  const ai = new GoogleGenAI({ apiKey: key });
  const contents = messages.map(m => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const response = await ai.models.generateContent({
    model,
    contents,
    config: { systemInstruction: systemPrompt, maxOutputTokens: maxTokens, temperature },
  });
  return response.text ?? '';
}

export async function POST(req: NextRequest) {
  try {
    const {
      content,
      title,
      tone       = 'friendly',
      length     = 'medium',
      customPrompt,
      quality    = 'standard',  // 'standard' | 'premium'
      llmModelId,               // 사용자가 선택한 모델 (없으면 자동 선택)
    } = await req.json();

    if (!content && !customPrompt) {
      return NextResponse.json({ error: '내용이 필요합니다' }, { status: 400 });
    }

    // 사용자 API 키 로드
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const meta    = user.user_metadata ?? {};
    const apiKeys = {
      gemini:    meta.gemini_api_key    ?? '',
      anthropic: meta.anthropic_api_key ?? '',
      qwen:      meta.qwen_api_key      ?? '',
    };

    // 모델 결정: 요청 모델 → 사용 가능한 키 순서로 자동 선택
    let model = llmModelId ?? '';
    if (!model) {
      if (apiKeys.gemini)         model = 'gemini-2.5-flash';
      else if (apiKeys.anthropic) model = 'claude-sonnet-4-6';
      else if (apiKeys.qwen)      model = 'qwen3.5-plus';
      else return NextResponse.json(
        { error: 'API 키가 없습니다. 설정 페이지에서 Gemini, Claude, 또는 Qwen API 키를 등록해주세요.' },
        { status: 400 },
      );
    }

    const toneMap: Record<string, string> = {
      friendly:     '친근하고 대화체',
      professional: '전문적이고 격식체',
      casual:       '편안하고 자유로운',
      educational:  '교육적이고 설명적인',
    };

    const lengthMap: Record<string, string> = {
      short:  '500~800자',
      medium: '800~1500자',
      long:   '1500~3000자',
    };

    const userMessage = customPrompt
      ? customPrompt
      : `다음 내용을 ${toneMap[tone] || '친근한'} 문체로 ${lengthMap[length] || '800~1500자'} 분량의 블로그 포스트로 작성해주세요.${title ? `\n\n참고 제목: ${title}` : ''}

---원본 내용---
${content.slice(0, 8000)}`;

    const systemPrompt = buildSystemPrompt(content || customPrompt || '', tone);

    // ── 1차 작성 ────────────────────────────────────────────────────────────────
    let blogContent = await callLLM(
      model, apiKeys, systemPrompt,
      [{ role: 'user', content: userMessage }],
      3000, 0.7,
    );

    // ── 2-pass: 자기비평 → 수정 (quality === 'premium') ──────────────────────
    if (quality === 'premium' && blogContent) {
      const critiquePrompt = `아래는 당신이 방금 작성한 블로그 초고입니다.

---초고---
${blogContent}
---

다음 10개 기준으로 냉정하게 비평하고, 미달 항목을 모두 수정해서 최종본을 작성하세요.

비평 기준:
1. 첫 문장이 훅 A/B/C형인가? "안녕하세요"나 "~알아보겠습니다"로 시작하지 않는가?
2. 첫 단락이 구체적 장면(시간, 장소, 행동)으로 시작하는가?
3. 5막 구조(훅→갈등→반전→증명→해소) 흐름이 있는가?
4. "보여주기(Show)"를 사용했는가? "그는 힘들었다" 같은 직접 서술은 없는가?
5. 짧고 강한 문장과 긴 설명 문장이 의도적으로 섞여 리듬이 있는가?
6. 3번째 단락 근처에 놀람 포인트가 있는가?
7. 금지 표현("지금까지 알아보았습니다", "도움이 됐으면" 등)이 없는가?
8. CTA가 정확히 1개이고, 핵심 인사이트 직후에 배치되었는가?
9. 소제목만 읽어도 서사 흐름이 파악되는가?
10. 마지막 단락이 첫 단락의 장면이나 표현을 되울리는가(클로징 에코)?

수정이 필요한 항목을 먼저 간단히 나열한 뒤 (예: "2번 미달 — 장면 없음"), 완성된 최종본 전체를 마크다운으로 출력하세요.
최종본은 \`---최종본---\` 으로 시작하세요.`;

      const revisionRaw = await callLLM(
        model, apiKeys, systemPrompt,
        [
          { role: 'user',      content: userMessage },
          { role: 'assistant', content: blogContent },
          { role: 'user',      content: critiquePrompt },
        ],
        4000, 0.5,
      );

      const finalMatch = revisionRaw.match(/---최종본---([\s\S]+)/);
      blogContent = finalMatch ? finalMatch[1].trim() : revisionRaw;
    }

    const titleMatch = blogContent.match(/^#\s+(.+)$/m);
    const extractedTitle = titleMatch ? titleMatch[1] : title || '블로그 포스트';

    return NextResponse.json({
      content: blogContent,
      title:   extractedTitle,
      model,
      quality,
    });
  } catch (err: unknown) {
    console.error('[blog/write]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '블로그 작성 중 오류가 발생했습니다' },
      { status: 500 },
    );
  }
}
