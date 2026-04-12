import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { TREND_CATEGORIES } from '@/lib/youtube-trends';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SignalRow {
  video_id: string;
  signal_type: string;
  current_views: number | null;
  growth_rate_hourly: number | null;
  multiplier: number | null;
  subscriber_count: number | null;
  score: number;
  detected_at: string;
}

interface VideoRow {
  video_id: string;
  title: string | null;
  category: string | null;
}

interface CategoryBundle {
  category: string;
  categoryLabel: string;
  viral: (SignalRow & { title: string })[];
  outliers: (SignalRow & { title: string })[];
}

export interface TrendInsight {
  id: string;
  keyword: string;
  category: string;
  categoryLabel: string;
  summary: string;          // AI 한 줄 인사이트
  opportunity: 'high' | 'medium' | 'watch';
  signal_count: number;
  top_video_title: string;
  raw_viral: { video_id: string; title: string; growth_rate_hourly: number | null }[];
  raw_outliers: { video_id: string; title: string; multiplier: number | null; subscriber_count: number | null }[];
}

// ─── Qwen call ───────────────────────────────────────────────────────────────

async function callQwen(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'qwen-plus',
      messages: [
        { role: 'system', content: '당신은 유튜브 크리에이터 전략 전문가입니다. 데이터를 보고 크리에이터가 바로 행동할 수 있는 날카로운 인사이트를 한국어로 작성합니다.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
      max_tokens: 800,
    }),
  });
  if (!res.ok) throw new Error(`Qwen API ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// ─── Rule-based fallback insight ─────────────────────────────────────────────

function buildRuleInsight(bundle: CategoryBundle): string {
  const { categoryLabel, viral, outliers } = bundle;

  if (outliers.length > 0 && viral.length > 0) {
    const top = outliers[0];
    const mult = top.multiplier ? Math.round(top.multiplier) : '?';
    const subs = top.subscriber_count ? Math.round(top.subscriber_count / 10000) + '만' : '소규모';
    return `${categoryLabel} 카테고리에서 ${subs} 채널이 평균의 ${mult}배 조회수 달성. 급상승 영상 ${viral.length}개도 동시 감지 — 수요는 있고 진입 장벽은 낮습니다.`;
  }
  if (outliers.length > 0) {
    const top = outliers[0];
    const mult = top.multiplier ? Math.round(top.multiplier) : '?';
    return `${categoryLabel}에서 구독자 대비 조회수 ${mult}배 이상치 영상 발견. 이 주제는 구독자 없이도 터질 수 있습니다.`;
  }
  return `${categoryLabel} 카테고리에서 지난 24시간 급상승 영상 ${viral.length}개 감지됐습니다.`;
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const qwenKey: string | undefined = user.user_metadata?.qwen_api_key;

    // 사용자 카테고리 필터
    const { data: settings } = await supabase
      .from('trend_settings')
      .select('categories')
      .eq('user_id', user.id)
      .maybeSingle();
    const userCategories: string[] = settings?.categories ?? [];

    const since48h = new Date(Date.now() - 48 * 3600000).toISOString();

    // 시그널 조회
    const [viralRes, outlierRes] = await Promise.all([
      supabase
        .from('trend_signals')
        .select('video_id, signal_type, current_views, growth_rate_hourly, score, detected_at')
        .eq('signal_type', 'viral')
        .gte('detected_at', since48h)
        .order('score', { ascending: false })
        .limit(50),
      supabase
        .from('trend_signals')
        .select('video_id, signal_type, current_views, multiplier, subscriber_count, score, detected_at')
        .eq('signal_type', 'outlier')
        .gte('detected_at', since48h)
        .order('score', { ascending: false })
        .limit(50),
    ]);

    const allVideoIds = [
      ...new Set([
        ...(viralRes.data ?? []).map(s => s.video_id),
        ...(outlierRes.data ?? []).map(s => s.video_id),
      ])
    ];

    if (allVideoIds.length === 0) {
      return NextResponse.json({ insights: [] });
    }

    const { data: videos } = await supabase
      .from('trend_videos')
      .select('video_id, title, category')
      .in('video_id', allVideoIds);

    const videoMap = new Map<string, VideoRow>((videos ?? []).map(v => [v.video_id, v]));

    // 카테고리별로 묶기
    const bundles = new Map<string, CategoryBundle>();

    for (const s of viralRes.data ?? []) {
      const v = videoMap.get(s.video_id);
      if (!v?.category) continue;
      if (userCategories.length > 0 && !userCategories.includes(v.category)) continue;
      if (!bundles.has(v.category)) {
        bundles.set(v.category, {
          category: v.category,
          categoryLabel: TREND_CATEGORIES[v.category]?.label ?? v.category,
          viral: [],
          outliers: [],
        });
      }
      bundles.get(v.category)!.viral.push({ ...s, multiplier: null, subscriber_count: null, title: v.title ?? '' });
    }

    for (const s of outlierRes.data ?? []) {
      const v = videoMap.get(s.video_id);
      if (!v?.category) continue;
      if (userCategories.length > 0 && !userCategories.includes(v.category)) continue;
      if (!bundles.has(v.category)) {
        bundles.set(v.category, {
          category: v.category,
          categoryLabel: TREND_CATEGORIES[v.category]?.label ?? v.category,
          viral: [],
          outliers: [],
        });
      }
      bundles.get(v.category)!.outliers.push({ ...s, title: v.title ?? '', growth_rate_hourly: null });
    }

    // 시그널 수 기준 상위 카테고리만
    const topBundles = [...bundles.values()]
      .sort((a, b) => (b.viral.length + b.outliers.length * 2) - (a.viral.length + a.outliers.length * 2))
      .slice(0, 4);

    if (topBundles.length === 0) {
      return NextResponse.json({ insights: [] });
    }

    // AI 인사이트 생성 (Qwen 키 있으면 AI, 없으면 규칙 기반)
    const insights: TrendInsight[] = [];

    if (qwenKey) {
      // AI 일괄 분석
      const prompt = `다음은 유튜브 트렌드 데이터입니다. 각 카테고리별로 크리에이터가 즉시 행동할 수 있는 한 줄 인사이트를 JSON으로 만들어주세요.

카테고리별 데이터:
${topBundles.map(b => `
[${b.categoryLabel}]
급상승 영상 ${b.viral.length}개: ${b.viral.slice(0, 3).map(v => `"${v.title}"`).join(', ')}
이상치 영상 ${b.outliers.length}개: ${b.outliers.slice(0, 3).map(v => `"${v.title}" (채널평균 ${v.multiplier?.toFixed(1)}배)`).join(', ')}
`).join('')}

각 카테고리에 대해 다음 JSON 배열 형식으로 응답하세요:
[
  {
    "category": "카테고리_키",
    "keyword": "핵심 주제 키워드 (2~5자)",
    "summary": "크리에이터를 위한 한 줄 인사이트 (예: 'X 주제가 작은 채널에서도 폭발적 성과 → 지금이 진입 타이밍')",
    "opportunity": "high|medium|watch"
  }
]

규칙:
- summary는 40자 이내로
- opportunity: 이상치+급상승 동시 = high, 둘 중 하나만 = medium, 약한 신호 = watch
- JSON만 출력`;

      try {
        const raw = await callQwen(prompt, qwenKey);
        let jsonStr = raw.trim();
        if (jsonStr.includes('```')) {
          const m = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (m) jsonStr = m[1];
        }
        const parsed: { category: string; keyword: string; summary: string; opportunity: 'high' | 'medium' | 'watch' }[] = JSON.parse(jsonStr.trim());

        for (const item of parsed) {
          const bundle = bundles.get(item.category);
          if (!bundle) continue;
          const topVideo = bundle.viral[0] ?? bundle.outliers[0];
          insights.push({
            id: item.category,
            keyword: item.keyword,
            category: item.category,
            categoryLabel: bundle.categoryLabel,
            summary: item.summary,
            opportunity: item.opportunity,
            signal_count: bundle.viral.length + bundle.outliers.length,
            top_video_title: topVideo?.title ?? '',
            raw_viral: bundle.viral.slice(0, 5).map(v => ({ video_id: v.video_id, title: v.title, growth_rate_hourly: v.growth_rate_hourly ?? null })),
            raw_outliers: bundle.outliers.slice(0, 5).map(v => ({ video_id: v.video_id, title: v.title, multiplier: v.multiplier ?? null, subscriber_count: v.subscriber_count ?? null })),
          });
        }
      } catch {
        // Qwen 실패 → 규칙 기반으로 fallback
        for (const bundle of topBundles) {
          const topVideo = bundle.viral[0] ?? bundle.outliers[0];
          insights.push({
            id: bundle.category,
            keyword: bundle.categoryLabel,
            category: bundle.category,
            categoryLabel: bundle.categoryLabel,
            summary: buildRuleInsight(bundle),
            opportunity: bundle.outliers.length > 0 && bundle.viral.length > 0 ? 'high' : bundle.outliers.length > 0 ? 'medium' : 'watch',
            signal_count: bundle.viral.length + bundle.outliers.length,
            top_video_title: topVideo?.title ?? '',
            raw_viral: bundle.viral.slice(0, 5).map(v => ({ video_id: v.video_id, title: v.title, growth_rate_hourly: v.growth_rate_hourly ?? null })),
            raw_outliers: bundle.outliers.slice(0, 5).map(v => ({ video_id: v.video_id, title: v.title, multiplier: v.multiplier ?? null, subscriber_count: v.subscriber_count ?? null })),
          });
        }
      }
    } else {
      // 규칙 기반
      for (const bundle of topBundles) {
        const topVideo = bundle.viral[0] ?? bundle.outliers[0];
        insights.push({
          id: bundle.category,
          keyword: bundle.categoryLabel,
          category: bundle.category,
          categoryLabel: bundle.categoryLabel,
          summary: buildRuleInsight(bundle),
          opportunity: bundle.outliers.length > 0 && bundle.viral.length > 0 ? 'high' : bundle.outliers.length > 0 ? 'medium' : 'watch',
          signal_count: bundle.viral.length + bundle.outliers.length,
          top_video_title: topVideo?.title ?? '',
          raw_viral: bundle.viral.slice(0, 5).map(v => ({ video_id: v.video_id, title: v.title, growth_rate_hourly: v.growth_rate_hourly ?? null })),
          raw_outliers: bundle.outliers.slice(0, 5).map(v => ({ video_id: v.video_id, title: v.title, multiplier: v.multiplier ?? null, subscriber_count: v.subscriber_count ?? null })),
        });
      }
    }

    return NextResponse.json({ insights });
  } catch (err) {
    console.error('[trends/insights]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
