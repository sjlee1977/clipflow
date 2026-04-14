/**
 * 쇼핑 쇼츠 스크립트 생성 에이전트
 *
 * POST /api/shopping-shorts/generate
 *
 * Body:
 *   productName      제품명 (필수)
 *   productDesc      제품 설명/특징 (필수)
 *   targetAudience   타겟 고객 (기본: '20~30대 여성')
 *   duration         영상 길이 — '15' | '30' | '60' (기본: '30')
 *   style            스타일 — 'ugc' | 'demo' | 'before_after' | 'comparison' | 'problem_solve' (기본: 'problem_solve')
 *   platform         플랫폼 — 'youtube' | 'tiktok' | 'instagram' (기본: 'youtube')
 *   urgency          긴급성 문구 (선택: '오늘만 20% 할인' 등)
 *   hookType         훅 유형 지정 (선택, 미지정 시 AI가 선택)
 *
 * Response:
 *   script           타임스탬프 포함 전체 스크립트
 *   scenes           씬 목록 (시각 지시 포함)
 *   hashtags         추천 해시태그
 *   hookType         사용된 훅 유형
 *   estimatedSeconds 예상 총 길이(초)
 */
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// ── 위키 로더 ──────────────────────────────────────────────────────────────────
const WIKI_DIR = path.join(process.cwd(), 'wiki', 'shopping-shorts');

function readWiki(filename: string): string {
  try {
    return fs.readFileSync(path.join(WIKI_DIR, filename), 'utf-8');
  } catch {
    return '';
  }
}

// ── 타입 ───────────────────────────────────────────────────────────────────────
type Duration  = '15' | '30' | '60';
type Style     = 'ugc' | 'demo' | 'before_after' | 'comparison' | 'problem_solve';
type Platform  = 'youtube' | 'tiktok' | 'instagram';

interface Scene {
  timeRange:   string;  // "0~5초"
  voiceover:   string;  // 나레이션/말할 내용
  visual:      string;  // 카메라/화면 지시
  caption:     string;  // 자막 텍스트
}

interface ShortsScript {
  script:           string;       // 전체 스크립트 (읽기 편한 형식)
  scenes:           Scene[];      // 씬별 구분
  hashtags:         string[];     // 추천 해시태그 10개
  hookType:         string;       // 사용된 훅 유형
  estimatedSeconds: number;       // 예상 길이
  tokens:           number;
}

// ── 라벨 맵 ────────────────────────────────────────────────────────────────────
const STYLE_LABEL: Record<Style, string> = {
  ugc:           'UGC 후기형 (진짜 사용자처럼)',
  demo:          '제품 시연형 (기능 중심)',
  before_after:  '비포/애프터형 (변화/결과 강조)',
  comparison:    '비교형 (기존 제품 vs 이 제품)',
  problem_solve: '문제해결형 (고통 → 해결책)',
};

const PLATFORM_CTA: Record<Platform, string> = {
  youtube:   '설명란 링크 또는 댓글 유도',
  tiktok:    '바이오 링크 또는 북마크 유도',
  instagram: '프로필 링크 또는 DM 유도',
};

const DURATION_GUIDE: Record<Duration, string> = {
  '15': '15초: 훅(0~3초) + 핵심 시연(3~10초) + CTA(10~15초)',
  '30': '30초: 훅(0~5초) + 문제(5~10초) + 시연(10~22초) + 증거(22~27초) + CTA(27~30초)',
  '60': '60초: 훅(0~5초) + 문제공감(5~13초) + 시연(13~33초) + 혜택(33~45초) + 증거(45~52초) + CTA(52~60초)',
};

// ── System Prompt 빌더 ─────────────────────────────────────────────────────────
function buildSystemPrompt(
  productName: string,
  productDesc: string,
  targetAudience: string,
  duration: Duration,
  style: Style,
  platform: Platform,
  urgency: string,
  hookType: string,
): string {
  const structure  = readWiki('script-structure.md');
  const hooks      = readWiki('hook-patterns.md');
  const cta        = readWiki('cta-patterns.md');

  const hookInstruction = hookType
    ? `훅 유형: 반드시 "${hookType}" 패턴을 사용한다.`
    : '훅 유형: 아래 패턴 중 이 제품에 가장 효과적인 것을 선택한다.';

  return `당신은 쇼핑 쇼츠 스크립트 전문 작가입니다.
수백 개의 바이럴 쇼핑 영상을 만든 경험이 있습니다.
아래 원칙과 제품 정보를 바탕으로 스크립트를 생성합니다.

━━━━━━━━━━━━━━━━━━━━━━━━━
스크립트 구조 원칙
━━━━━━━━━━━━━━━━━━━━━━━━━
${structure || DURATION_GUIDE[duration]}

━━━━━━━━━━━━━━━━━━━━━━━━━
훅 패턴
━━━━━━━━━━━━━━━━━━━━━━━━━
${hooks || '훅은 3초 안에 시청자를 멈추게 해야 한다.'}
${hookInstruction}

━━━━━━━━━━━━━━━━━━━━━━━━━
CTA 원칙
━━━━━━━━━━━━━━━━━━━━━━━━━
${cta || 'CTA는 1개만, 마지막 5초 안에, 구체적 행동 지시.'}
플랫폼별 CTA: ${PLATFORM_CTA[platform]}
${urgency ? `긴급성 문구 반드시 포함: "${urgency}"` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━
제품 정보
━━━━━━━━━━━━━━━━━━━━━━━━━
제품명: ${productName}
설명: ${productDesc}
타겟: ${targetAudience}
스타일: ${STYLE_LABEL[style]}
영상 길이: ${duration}초
플랫폼: ${platform}

━━━━━━━━━━━━━━━━━━━━━━━━━
작성 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━
- 모든 문장은 구어체 (말하듯이)
- 한 문장 = 약 1초 = 15자 이내
- 자막에 들어갈 핵심 키워드는 [자막: ...] 으로 표시
- 시각 지시는 (화면: ...) 으로 표시
- 과장 금지 — 검증 가능한 내용만

━━━━━━━━━━━━━━━━━━━━━━━━━
출력 형식 (JSON만, 다른 텍스트 없음)
━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "hookType": "사용한 훅 패턴 이름",
  "script": "전체 스크립트 (읽기 쉬운 텍스트, 타임스탬프 포함)",
  "scenes": [
    {
      "timeRange": "0~3초",
      "voiceover": "실제 말할 내용",
      "visual": "카메라/화면 지시 (클로즈업, 비포샷 등)",
      "caption": "자막으로 강조할 텍스트"
    }
  ],
  "hashtags": ["#해시태그1", "#해시태그2", ... (10개)]
}`;
}

// ── POST Handler ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const {
      productName,
      productDesc,
      targetAudience = '20~30대',
      duration       = '30' as Duration,
      style          = 'problem_solve' as Style,
      platform       = 'youtube' as Platform,
      urgency        = '',
      hookType       = '',
    } = await req.json() as {
      productName:     string;
      productDesc:     string;
      targetAudience?: string;
      duration?:       Duration;
      style?:          Style;
      platform?:       Platform;
      urgency?:        string;
      hookType?:       string;
    };

    if (!productName || !productDesc) {
      return NextResponse.json(
        { error: '제품명(productName)과 제품 설명(productDesc)은 필수입니다' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API 키가 설정되지 않았습니다' },
        { status: 500 }
      );
    }

    const client       = new OpenAI({ apiKey });
    const systemPrompt = buildSystemPrompt(
      productName, productDesc, targetAudience,
      duration, style, platform, urgency, hookType,
    );

    const response = await client.chat.completions.create({
      model:           'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role:    'user',
          content: `위 정보를 바탕으로 ${duration}초 쇼핑 쇼츠 스크립트를 생성해주세요. JSON만 출력하세요.`,
        },
      ],
      max_tokens:      2000,
      temperature:     0.8,  // 창의성 높임
      response_format: { type: 'json_object' },
    });

    const raw    = response.choices[0]?.message?.content || '{}';
    const tokens = response.usage?.total_tokens ?? 0;

    let parsed: Partial<ShortsScript & { hashtags: string[] }>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: 'AI 응답 파싱 실패', raw },
        { status: 500 }
      );
    }

    const result: ShortsScript = {
      script:           parsed.script           ?? '',
      scenes:           parsed.scenes           ?? [],
      hashtags:         (parsed.hashtags        ?? []).slice(0, 10),
      hookType:         parsed.hookType ?? (hookType || '자동 선택'),
      estimatedSeconds: parseInt(duration),
      tokens,
    };

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('[shopping-shorts/generate]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '스크립트 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
