'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Zap, Play, CheckCircle2, XCircle, Clock, SkipForward,
  Loader2, TrendingUp, Search, Globe, FileText, Send,
  ChevronDown, ChevronUp, BarChart2, Tag, ExternalLink,
  RefreshCw, Settings,
} from 'lucide-react';

// ─── 타입 ─────────────────────────────────────────────────────────────────────
type StepStatus = 'pending' | 'running' | 'done' | 'skipped' | 'error';
type SeoPlatform = 'naver' | 'google';
type Tone = 'friendly' | 'professional' | 'casual' | 'educational';

interface PipelineStep {
  id:     string;
  label:  string;
  status: StepStatus;
  data?:  unknown;
  error?: string;
}

interface TopicResult {
  topic:           string;
  keyword:         string;
  relatedKeywords: string[];
  reason:          string;
}

interface KeywordData {
  keyword:      string;
  monthlyTotal: number;
  competition:  number;
  opportunity:  number;
}

interface PostResult {
  title:           string;
  content:         string;
  metaTitle:       string;
  metaDescription: string;
  slug:            string;
  tags:            string[];
  seoScore:        number;
}

interface RunResult {
  steps:         PipelineStep[];
  topic?:        TopicResult;
  keywordData?:  KeywordData | null;
  competitors?:  { title: string; url: string; length: number }[];
  post?:         PostResult;
  publishResult?: { success: boolean; link?: string } | null;
  provider?:     string;
  error?:        string;
}

// ─── 상수 ─────────────────────────────────────────────────────────────────────
const STEP_ICONS: Record<string, React.ReactNode> = {
  trends:   <TrendingUp size={13} />,
  topic:    <Search     size={13} />,
  keywords: <BarChart2  size={13} />,
  crawl:    <Globe      size={13} />,
  write:    <FileText   size={13} />,
  publish:  <Send       size={13} />,
};

const GEO_OPTIONS  = [{ v: 'KR', l: '한국' }, { v: 'US', l: '미국' }, { v: 'JP', l: '일본' }];
const TONE_OPTIONS: { value: Tone; label: string }[] = [
  { value: 'friendly',     label: '친근한' },
  { value: 'professional', label: '전문적인' },
  { value: 'casual',       label: '자유로운' },
  { value: 'educational',  label: '교육적인' },
];
const LENGTH_OPTIONS = [
  { value: 800,  label: '짧게',  desc: '~800자' },
  { value: 1500, label: '보통',  desc: '~1500자' },
  { value: 2500, label: '길게',  desc: '~2500자' },
];

// ─── Step 상태 아이콘 ─────────────────────────────────────────────────────────
function StatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'running':  return <Loader2      size={14} className="animate-spin text-[#22c55e]" />;
    case 'done':     return <CheckCircle2 size={14} className="text-[#22c55e]" />;
    case 'error':    return <XCircle      size={14} className="text-red-400" />;
    case 'skipped':  return <SkipForward  size={14} className="text-white/25" />;
    default:         return <Clock        size={14} className="text-white/20" />;
  }
}

// ─── SEO Score Ring ───────────────────────────────────────────────────────────
function SeoScoreRing({ score }: { score: number }) {
  const r = 22, circ = 2 * Math.PI * r;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={56} height={56} viewBox="0 0 56 56">
      <circle cx={28} cy={28} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
      <circle cx={28} cy={28} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${(score / 100) * circ} ${circ}`}
        strokeLinecap="round" transform="rotate(-90 28 28)" />
      <text x={28} y={28} textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize={12} fontWeight={900}>{score}</text>
    </svg>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function AutoBlogPage() {
  const router = useRouter();

  // 설정
  const [geo,            setGeo]            = useState('KR');
  const [seoPlatform,    setSeoPlatform]    = useState<SeoPlatform>('naver');
  const [tone,           setTone]           = useState<Tone>('friendly');
  const [minLength,      setMinLength]      = useState(1500);
  const [autoPublish,    setAutoPublish]    = useState(false);
  const [publishPlatform, setPublishPlatform] = useState('wordpress');

  // 실행 상태
  const [running,  setRunning]  = useState(false);
  const [result,   setResult]   = useState<RunResult | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // 결과 펼침 토글
  function toggleExpand(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleRun() {
    setRunning(true);
    setResult(null);
    try {
      const res  = await fetch('/api/auto-blog/run', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ geo, seoPlatform, tone, minLength, autoPublish, publishPlatform }),
      });
      const data = await res.json() as RunResult;
      setResult(data);
    } catch (err: unknown) {
      setResult({ steps: [], error: err instanceof Error ? err.message : '실행 실패' });
    } finally {
      setRunning(false);
    }
  }

  function goToEdit() {
    if (!result?.post || !result?.topic) return;
    const params = new URLSearchParams({
      keyword: result.topic.keyword,
      related: result.topic.relatedKeywords.join(','),
      volume:  String(result.keywordData?.monthlyTotal ?? 0),
    });
    router.push(`/dashboard/blog?${params.toString()}`);
  }

  const allDone = result?.steps?.every(s => s.status === 'done' || s.status === 'skipped');

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <span className="w-1 h-7 bg-[#22c55e]" />
        <div>
          <h1 className="text-[18px] font-black tracking-tight text-white uppercase flex items-center gap-2">
            <Zap size={16} className="text-[#22c55e]" />
            자동 블로그 생성
          </h1>
          <p className="text-[11px] text-white/30 font-mono tracking-widest mt-0.5">
            TREND → TOPIC → KEYWORD → CRAWL → WRITE → PUBLISH
          </p>
        </div>
      </div>

      {/* 실행 전: 중앙 단일 컬럼 / 실행 후: 2컬럼 */}
      <div className={`${(running || result) ? 'grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-5' : 'max-w-xl'}`}>
        {/* ─── 좌측: 설정 패널 ─── */}
        <div className="space-y-4">
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-4">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">파이프라인 설정</p>

            {/* 지역 */}
            <div>
              <p className="text-[10px] text-white/25 font-mono mb-2 uppercase tracking-wider">트렌드 지역</p>
              <div className="flex gap-1.5">
                {GEO_OPTIONS.map(o => (
                  <button key={o.v} onClick={() => setGeo(o.v)}
                    className={`flex-1 text-[12px] font-mono py-1.5 rounded-lg border transition-colors ${
                      geo === o.v ? 'border-[#22c55e]/40 bg-[#22c55e]/10 text-white' : 'border-white/8 text-white/40 hover:text-white/60'
                    }`}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>

            {/* SEO 플랫폼 */}
            <div>
              <p className="text-[10px] text-white/25 font-mono mb-2 uppercase tracking-wider">SEO 최적화</p>
              <div className="flex gap-1.5">
                {(['naver', 'google'] as SeoPlatform[]).map(p => (
                  <button key={p} onClick={() => setSeoPlatform(p)}
                    className={`flex-1 py-1.5 rounded-lg border text-[12px] font-mono transition-colors ${
                      seoPlatform === p ? 'border-[#22c55e]/40 bg-[#22c55e]/10 text-white' : 'border-white/8 text-white/40 hover:text-white/60'
                    }`}>
                    {p === 'naver' ? '네이버' : '구글'}
                  </button>
                ))}
              </div>
            </div>

            {/* 문체 */}
            <div>
              <p className="text-[10px] text-white/25 font-mono mb-2 uppercase tracking-wider">문체</p>
              <div className="grid grid-cols-2 gap-1.5">
                {TONE_OPTIONS.map(o => (
                  <button key={o.value} onClick={() => setTone(o.value)}
                    className={`text-[12px] font-mono py-1.5 rounded-lg border transition-colors ${
                      tone === o.value ? 'border-[#22c55e]/40 bg-[#22c55e]/10 text-white' : 'border-white/8 text-white/40 hover:text-white/60'
                    }`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 길이 */}
            <div>
              <p className="text-[10px] text-white/25 font-mono mb-2 uppercase tracking-wider">글 길이</p>
              <div className="flex gap-1.5">
                {LENGTH_OPTIONS.map(o => (
                  <button key={o.value} onClick={() => setMinLength(o.value)}
                    className={`flex-1 text-center py-1.5 rounded-lg border transition-colors ${
                      minLength === o.value ? 'border-[#22c55e]/40 bg-[#22c55e]/10 text-white' : 'border-white/8 text-white/40 hover:text-white/60'
                    }`}>
                    <span className="text-[12px] font-mono block">{o.label}</span>
                    <span className="text-[9px] font-mono text-white/25">{o.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 자동 발행 */}
            <div className="flex items-center justify-between py-2 border-t border-white/6">
              <div>
                <p className="text-[12px] font-bold text-white/60">자동 발행</p>
                <p className="text-[10px] font-mono text-white/25">작성 후 초안으로 즉시 발행</p>
              </div>
              <button
                onClick={() => setAutoPublish(!autoPublish)}
                className={`w-10 h-[22px] rounded-full transition-colors relative shrink-0 ${autoPublish ? 'bg-[#22c55e]' : 'bg-white/15'}`}
              >
                <span className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform ${autoPublish ? 'translate-x-[18px]' : 'translate-x-0'}`} />
              </button>
            </div>

            {autoPublish && (
              <div>
                <p className="text-[10px] text-white/25 font-mono mb-2 uppercase tracking-wider">발행 플랫폼</p>
                <div className="flex gap-1.5">
                  {['wordpress', 'naver', 'nextblog'].map(p => (
                    <button key={p} onClick={() => setPublishPlatform(p)}
                      className={`flex-1 text-[11px] font-mono py-1.5 rounded-lg border transition-colors ${
                        publishPlatform === p ? 'border-[#22c55e]/40 bg-[#22c55e]/10 text-white' : 'border-white/8 text-white/30 hover:text-white/60'
                      }`}>
                      {p === 'wordpress' ? 'WP' : p === 'naver' ? 'Naver' : 'Next'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 실행 버튼 */}
          <button
            onClick={handleRun}
            disabled={running}
            className="w-full flex items-center justify-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-50 text-black font-black text-[14px] tracking-tight uppercase py-3 rounded-xl transition-colors"
          >
            {running
              ? <><Loader2 size={15} className="animate-spin" /> 파이프라인 실행 중...</>
              : result
                ? <><RefreshCw size={15} /> 다시 실행</>
                : <><Play size={15} /> 자동 생성 시작</>
            }
          </button>

          {/* 파이프라인 설명 */}
          {!result && !running && (
            <div className="rounded-xl border border-white/6 bg-white/[0.01] p-4 space-y-2">
              <p className="text-[11px] font-bold text-white/20 uppercase tracking-wider mb-3">실행 단계</p>
              {[
                { icon: <TrendingUp size={11} />, label: '구글 트렌드 급상승 키워드 수집' },
                { icon: <Search     size={11} />, label: 'AI가 블로그 적합 주제 선별' },
                { icon: <BarChart2  size={11} />, label: '네이버 검색량 + 경쟁도 분석' },
                { icon: <Globe      size={11} />, label: '상위 경쟁 블로그 3개 크롤링' },
                { icon: <FileText   size={11} />, label: 'SEO 최적화 블로그 글 작성' },
                { icon: <Send       size={11} />, label: '플랫폼 자동 발행 (선택)' },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-white/20">{s.icon}</span>
                  <p className="text-[11px] font-mono text-white/25">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── 우측: 파이프라인 진행 + 결과 ─── */}
        <div className="space-y-4">

          {/* 파이프라인 스텝 */}
          {(running || result) && (
            <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
              <div className="px-4 py-3 border-b border-white/6">
                <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">파이프라인 진행</p>
              </div>
              <div className="divide-y divide-white/4">
                {(result?.steps ?? generateLoadingSteps()).map((step) => (
                  <div key={step.id}>
                    <div
                      className={`flex items-center gap-3 px-4 py-3 ${step.data ? 'cursor-pointer hover:bg-white/[0.02]' : ''}`}
                      onClick={() => step.data && toggleExpand(step.id)}
                    >
                      <span className="text-white/30">{STEP_ICONS[step.id]}</span>
                      <span className={`flex-1 text-[13px] font-bold ${
                        step.status === 'done'    ? 'text-white/80' :
                        step.status === 'running' ? 'text-white' :
                        step.status === 'error'   ? 'text-red-400/80' :
                        step.status === 'skipped' ? 'text-white/20' :
                        'text-white/30'
                      }`}>{step.label}</span>
                      <StatusIcon status={step.status} />
                      {!!step.data && (
                        expanded[step.id]
                          ? <ChevronUp size={12} className="text-white/20" />
                          : <ChevronDown size={12} className="text-white/20" />
                      )}
                    </div>

                    {/* 스텝 상세 데이터 */}
                    {!!step.data && expanded[step.id] && (
                      <div className="px-4 pb-3 ml-5">
                        <StepDetail id={step.id} data={step.data} />
                      </div>
                    )}
                    {step.error && (
                      <p className="px-4 pb-2 ml-5 text-[11px] font-mono text-red-400/60">{step.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 결과 카드 */}
          {result?.post && (
            <div className="rounded-xl border border-[#22c55e]/20 bg-[#22c55e]/[0.03] overflow-hidden">
              <div className="flex items-center gap-4 px-4 py-4 border-b border-white/6">
                <SeoScoreRing score={result.post.seoScore} />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-black text-white leading-snug">{result.post.title}</p>
                  <p className="text-[11px] font-mono text-white/30 mt-1">
                    {result.post.content.length.toLocaleString()}자 ·
                    SEO {result.post.seoScore >= 80 ? '우수' : result.post.seoScore >= 60 ? '보통' : '미흡'} ·
                    {result.provider}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {result.post.tags.slice(0, 5).map(tag => (
                      <span key={tag} className="text-[10px] font-mono text-white/35 bg-white/5 border border-white/8 px-1.5 py-0.5 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 메타 정보 */}
              <div className="px-4 py-3 space-y-2 border-b border-white/6">
                <MetaLine label="Meta Title" value={result.post.metaTitle} maxLen={60} />
                <MetaLine label="Meta Description" value={result.post.metaDescription} maxLen={160} />
                <MetaLine label="Slug" value={result.post.slug} />
              </div>

              {/* 선정 이유 */}
              {result.topic && (
                <div className="px-4 py-3 border-b border-white/6">
                  <p className="text-[10px] font-mono text-white/25 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Search size={10} />주제 선정 이유
                  </p>
                  <p className="text-[12px] font-mono text-white/50">{result.topic.reason}</p>
                </div>
              )}

              {/* 키워드 데이터 */}
              {result.keywordData && (
                <div className="px-4 py-3 border-b border-white/6 flex gap-4">
                  <MetricMini label="월 검색량" value={result.keywordData.monthlyTotal.toLocaleString()} />
                  <MetricMini label="경쟁도" value={`${Math.round(result.keywordData.competition * 100)}%`} />
                  <MetricMini label="기회점수" value={`${result.keywordData.opportunity}점`} />
                </div>
              )}

              {/* 발행 결과 */}
              {result.publishResult?.success && (
                <div className="px-4 py-3 border-b border-white/6 flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-[#22c55e]" />
                  <p className="text-[12px] font-mono text-[#22c55e]/80 flex-1">초안 발행 완료</p>
                  {result.publishResult.link && (
                    <a href={result.publishResult.link} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] font-mono text-white/40 hover:text-white/70 transition-colors">
                      <ExternalLink size={11} />보기
                    </a>
                  )}
                </div>
              )}

              {/* 액션 버튼 */}
              <div className="px-4 py-3 flex gap-2">
                <button
                  onClick={goToEdit}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] text-black font-black text-[12px] tracking-tight uppercase py-2 rounded-lg transition-colors"
                >
                  <FileText size={13} />에디터에서 편집
                </button>
                <button
                  onClick={() => router.push('/dashboard/settings')}
                  className="flex items-center gap-1.5 text-[11px] font-mono text-white/40 hover:text-white/70 border border-white/10 hover:border-white/20 px-3 py-2 rounded-lg transition-colors"
                >
                  <Settings size={12} />설정
                </button>
              </div>
            </div>
          )}

          {/* 에러 */}
          {result?.error && !result.post && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
              <p className="text-[12px] font-mono text-red-400/80">{result.error}</p>
            </div>
          )}

          {/* 경쟁 포스트 목록 */}
          {result?.competitors && result.competitors.length > 0 && (
            <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
              <div className="px-4 py-3 border-b border-white/6">
                <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                  <Globe size={12} />분석한 경쟁 포스트
                </p>
              </div>
              <div className="divide-y divide-white/4">
                {result.competitors.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-[10px] font-mono text-white/20 w-4 shrink-0">{i + 1}</span>
                    <p className="text-[12px] text-white/60 flex-1 min-w-0 truncate">{c.title || c.url}</p>
                    <span className="text-[10px] font-mono text-white/20 shrink-0">{c.length.toLocaleString()}자</span>
                    <a href={c.url} target="_blank" rel="noopener noreferrer"
                      className="text-white/20 hover:text-white/60 transition-colors shrink-0">
                      <ExternalLink size={11} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 완료 후 다음 단계 안내 */}
          {allDone && result?.post && (
            <div className="rounded-xl border border-white/6 bg-white/[0.01] px-4 py-3">
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-2">다음 단계</p>
              <div className="space-y-1">
                <p className="text-[11px] font-mono text-white/30">1. 에디터에서 내용 검토 및 수정</p>
                <p className="text-[11px] font-mono text-white/30">2. 이미지 추가 후 플랫폼 발행</p>
                <p className="text-[11px] font-mono text-white/30">3. 발행 후 Google Search Console 등록</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 로딩 중 빈 스텝 목록 ────────────────────────────────────────────────────
function generateLoadingSteps(): PipelineStep[] {
  return [
    { id: 'trends',   label: '트렌드 수집',       status: 'running' },
    { id: 'topic',    label: 'AI 주제 선정',       status: 'pending' },
    { id: 'keywords', label: '키워드 리서치',      status: 'pending' },
    { id: 'crawl',    label: '경쟁 포스트 크롤링', status: 'pending' },
    { id: 'write',    label: 'SEO 글 작성',        status: 'pending' },
    { id: 'publish',  label: '자동 발행',          status: 'skipped' },
  ];
}

// ─── 스텝 상세 데이터 표시 ─────────────────────────────────────────────────────
function StepDetail({ id, data }: { id: string; data: unknown }) {
  const d = data as Record<string, unknown>;
  if (!d) return null;

  if (id === 'trends') {
    const sample = d.sample as string[] | undefined;
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {(sample ?? []).map((t, i) => (
          <span key={i} className="text-[10px] font-mono text-white/40 bg-white/5 border border-white/8 px-2 py-0.5 rounded-full">
            {t}
          </span>
        ))}
        {(d.count as number) > 5 && (
          <span className="text-[10px] font-mono text-white/20">+{(d.count as number) - 5}개</span>
        )}
      </div>
    );
  }

  if (id === 'topic') {
    return (
      <div className="space-y-1 mt-1">
        <p className="text-[11px] font-mono text-white/60">
          <span className="text-white/25">주제: </span>{String(d.topic ?? '')}
        </p>
        <p className="text-[11px] font-mono text-white/60">
          <span className="text-white/25">키워드: </span>
          <span className="text-[#22c55e]/70">#{String(d.keyword ?? '')}</span>
        </p>
        <div className="flex flex-wrap gap-1 mt-1">
          {((d.relatedKeywords as string[]) ?? []).map((k, i) => (
            <span key={i} className="text-[10px] font-mono text-white/35 bg-white/5 border border-white/8 px-1.5 py-0.5 rounded">
              #{k}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (id === 'keywords') {
    if (d.message) return <p className="text-[11px] font-mono text-white/30 mt-1">{String(d.message)}</p>;
    return (
      <div className="flex gap-4 mt-1">
        <MetricMini label="월 검색량" value={Number(d.monthlyTotal ?? 0).toLocaleString()} />
        <MetricMini label="경쟁도" value={`${Math.round(Number(d.competition ?? 0) * 100)}%`} />
        <MetricMini label="기회점수" value={`${Number(d.opportunity ?? 0)}점`} />
      </div>
    );
  }

  if (id === 'crawl') {
    if (d.message) return <p className="text-[11px] font-mono text-white/30 mt-1">{String(d.message)}</p>;
    return (
      <div className="space-y-0.5 mt-1">
        {((d.titles as string[]) ?? []).map((t, i) => (
          <p key={i} className="text-[11px] font-mono text-white/40 truncate">
            <span className="text-white/20">{i + 1}. </span>{t || '(제목 없음)'}
          </p>
        ))}
      </div>
    );
  }

  if (id === 'write') {
    return (
      <div className="flex items-center gap-4 mt-1">
        <MetricMini label="SEO점수" value={`${Number(d.seoScore ?? 0)}점`} />
        <MetricMini label="글자수" value={`${Number(d.length ?? 0).toLocaleString()}자`} />
      </div>
    );
  }

  return null;
}

// ─── 소형 메트릭 ─────────────────────────────────────────────────────────────
function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-mono text-white/20 uppercase tracking-wider">{label}</p>
      <p className="text-[13px] font-black text-white/70 mt-0.5">{value}</p>
    </div>
  );
}

// ─── 메타 라인 ───────────────────────────────────────────────────────────────
function MetaLine({ label, value, maxLen }: { label: string; value: string; maxLen?: number }) {
  const over = maxLen ? value.length > maxLen : false;
  return (
    <div className="flex items-start gap-3">
      <div className="flex items-center gap-1.5 shrink-0 w-28">
        <Tag size={10} className="text-white/20" />
        <p className="text-[10px] font-mono text-white/25">{label}</p>
        {maxLen && (
          <span className={`text-[9px] font-mono ${over ? 'text-red-400/60' : 'text-white/15'}`}>
            {value.length}/{maxLen}
          </span>
        )}
      </div>
      <p className={`text-[11px] font-mono flex-1 break-all ${over ? 'text-red-400/60' : 'text-white/50'}`}>
        {value}
      </p>
    </div>
  );
}
