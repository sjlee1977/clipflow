'use client';

import { useState, useEffect, useCallback } from 'react';
import { Globe, TrendingUp, Cpu, Search, Zap, Trash2, ChevronDown, ChevronUp, Clock, CheckCircle, AlertCircle, RefreshCw, Send } from 'lucide-react';
import { toDatetimeLocal } from '@/lib/date';

// ── 타입 ──────────────────────────────────────────────────────────────────────
type Category  = 'travel' | 'economy' | 'it';
type PostStatus = 'pending' | 'generating' | 'ready' | 'published' | 'failed';

interface MediaPost {
  id: string; category: Category; article_type: string;
  topic: string; destination?: string; keyword?: string;
  status: PostStatus; scheduled_at?: string;
  platforms: string[];
  naver_title?: string; wordpress_title?: string; personal_title?: string;
  evaluation?: { totalScore: number; passed: boolean };
  refinement_rounds?: number;
  naver_published_at?: string; wordpress_published_at?: string; personal_published_at?: string;
  error_message?: string; created_at: string;
}

interface ResearchData {
  destination: string;
  hotels:      { name: string; rating: number; address: string; editorialSummary?: string }[];
  attractions: { name: string; rating: number; address: string }[];
  restaurants: { name: string; rating: number; address: string }[];
  travelTips:  string[];
  dataSource:  'google_places' | 'manual';
}

// ── 카테고리 설정 ──────────────────────────────────────────────────────────────
const CATEGORIES: { key: Category; label: string; icon: React.ElementType; color: string; description: string }[] = [
  { key: 'travel',  label: '여행',  icon: Globe,      color: '#22d3ee', description: '여행지 가이드, 호텔 추천, 맛집 소개' },
  { key: 'economy', label: '경제',  icon: TrendingUp, color: '#f59e0b', description: '경제 뉴스, 시장 분석, 투자 인사이트' },
  { key: 'it',      label: 'IT',    icon: Cpu,        color: '#a78bfa', description: '신제품 리뷰, 기술 트렌드, 앱 추천' },
];

const TRAVEL_ARTICLE_TYPES = [
  { value: 'guide',  label: '여행 가이드' },
  { value: 'hotel',  label: '호텔 추천 TOP5' },
  { value: 'hidden', label: '숨은 명소' },
  { value: 'food',   label: '미식 투어' },
  { value: 'budget', label: '저예산 여행' },
];

const LLM_MODELS = [
  { value: 'claude-sonnet-4-6',          label: 'Claude Sonnet 4.6' },
  { value: 'claude-opus-4-7',            label: 'Claude Opus 4.7' },
  { value: 'gemini-2.0-flash',           label: 'Gemini 2.0 Flash' },
  { value: 'gemini-1.5-pro',             label: 'Gemini 1.5 Pro' },
  { value: 'qwen-plus',                  label: 'Qwen Plus' },
  { value: 'qwen-max',                   label: 'Qwen Max' },
];

const IMAGE_MODELS = [
  { value: 'fal/flux-schnell',   label: 'FLUX Schnell (빠름)' },
  { value: 'fal/flux-dev',       label: 'FLUX Dev (고품질)' },
  { value: 'fal/stable-diffusion-v3-medium', label: 'SD v3 Medium' },
];


function StatusBadge({ status }: { status: PostStatus }) {
  const cfg: Record<PostStatus, { label: string; color: string; bg: string }> = {
    pending:    { label: '대기',    color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
    generating: { label: '생성 중', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    ready:      { label: '준비됨',  color: '#22d3ee', bg: 'rgba(34,211,238,0.1)' },
    published:  { label: '발행됨',  color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
    failed:     { label: '실패',    color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  };
  const c = cfg[status];
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ color: c.color, background: c.bg, border: `1px solid ${c.color}33` }}>
      {c.label}
    </span>
  );
}

function PlatformDot({ published }: { published?: string }) {
  return (
    <div className="w-2 h-2 rounded-full" style={{ background: published ? '#4ade80' : 'rgba(148,163,184,0.3)' }} />
  );
}

// ── 여행 탭 ───────────────────────────────────────────────────────────────────
function TravelTab() {
  const [destination,  setDestination]  = useState('');
  const [articleType,  setArticleType]  = useState('guide');
  const [modelId,      setModelId]      = useState('claude-sonnet-4-6');
  const [imageModelId, setImageModelId] = useState('fal/flux-schnell');
  const [generateImages, setGenerateImages] = useState(true);
  const [platforms,    setPlatforms]    = useState(['naver', 'wordpress', 'personal']);

  const [researching,  setResearching]  = useState(false);
  const [researchData, setResearchData] = useState<ResearchData | null>(null);
  const [generating,   setGenerating]   = useState(false);
  const [genSteps,     setGenSteps]     = useState<{ agent: string; status: string; summary: string }[]>([]);

  const [posts,        setPosts]        = useState<MediaPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [scheduledAtEdits, setScheduledAtEdits] = useState<Record<string, string>>({});
  const [savingDateIds,    setSavingDateIds]    = useState<Set<string>>(new Set());

  const togglePlatform = (p: string) =>
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const loadPosts = useCallback(async () => {
    setLoadingPosts(true);
    const res = await fetch('/api/media-hub/posts?category=travel&limit=50');
    const data = await res.json();
    setPosts(data.posts ?? []);
    setLoadingPosts(false);
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  async function handleResearch() {
    if (!destination.trim()) return;
    setResearching(true);
    setResearchData(null);
    try {
      const res  = await fetch('/api/media-hub/travel/research', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: destination.trim(), articleType }),
      });
      const data = await res.json();
      if (res.ok) setResearchData(data);
    } finally {
      setResearching(false);
    }
  }

  async function handleGenerate() {
    if (!destination.trim()) return;
    setGenerating(true);
    setGenSteps([]);

    // 1. DB에 pending 레코드 생성
    const createRes = await fetch('/api/media-hub/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'travel', articleType, topic: destination.trim(),
        destination: destination.trim(), sourceData: researchData ?? {},
        platforms, llmModelId: modelId, imageModelId, generateImages,
      }),
    });
    const { id: postId } = await createRes.json();

    // 2. 글 생성 실행
    const writeRes = await fetch('/api/media-hub/write', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postId, category: 'travel', articleType,
        topic: destination.trim(), destination: destination.trim(),
        sourceData: researchData ?? {}, platforms, modelId, imageModelId,
        generateImages, saveToDb: true,
      }),
    });
    const result = await writeRes.json();
    setGenSteps(result.steps ?? []);

    setGenerating(false);
    await loadPosts();
  }

  async function handlePublishNow(post: MediaPost) {
    if (post.status !== 'ready') return;
    await fetch('/api/media-hub/posts', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: post.id, scheduledAt: new Date().toISOString() }),
    });
    await loadPosts();
  }

  async function saveScheduledAt(id: string) {
    const value = scheduledAtEdits[id];
    if (!value) return;
    setSavingDateIds(prev => new Set(prev).add(id));
    await fetch('/api/media-hub/posts', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, scheduledAt: new Date(value).toISOString() }),
    });
    setPosts(prev => prev.map(p => p.id === id ? { ...p, scheduled_at: new Date(value).toISOString() } : p));
    setSavingDateIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    setScheduledAtEdits(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return;
    await fetch('/api/media-hub/posts', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setPosts(prev => prev.filter(p => p.id !== id));
  }

  const stats = {
    total:     posts.length,
    pending:   posts.filter(p => p.status === 'pending').length,
    ready:     posts.filter(p => p.status === 'ready').length,
    published: posts.filter(p => p.status === 'published').length,
  };

  return (
    <div className="space-y-6">

      {/* 통계 */}
      {posts.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: '전체',  value: stats.total,     color: '#94a3b8' },
            { label: '대기',  value: stats.pending,   color: '#f59e0b' },
            { label: '준비',  value: stats.ready,     color: '#22d3ee' },
            { label: '발행',  value: stats.published, color: '#4ade80' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3 text-center"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* 생성 패널 */}
      <div className="rounded-2xl p-5 space-y-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>새 여행 콘텐츠 생성</p>

        {/* 여행지 + 기사 유형 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] mb-1 block" style={{ color: 'var(--text-muted)' }}>여행지</label>
            <input
              value={destination}
              onChange={e => setDestination(e.target.value)}
              placeholder="예: 도쿄, 발리, 제주도"
              onKeyDown={e => e.key === 'Enter' && handleResearch()}
              className="w-full px-3 py-2 rounded-xl text-[13px] outline-none"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>
          <div>
            <label className="text-[11px] mb-1 block" style={{ color: 'var(--text-muted)' }}>기사 유형</label>
            <select
              value={articleType}
              onChange={e => setArticleType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-[13px] outline-none"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              {TRAVEL_ARTICLE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        {/* 모델 설정 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] mb-1 block" style={{ color: 'var(--text-muted)' }}>LLM 모델</label>
            <select
              value={modelId}
              onChange={e => setModelId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-[13px] outline-none"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              {LLM_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] mb-1 block" style={{ color: 'var(--text-muted)' }}>이미지 모델</label>
            <select
              value={imageModelId}
              onChange={e => setImageModelId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-[13px] outline-none"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              {IMAGE_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>

        {/* 플랫폼 + 이미지 생성 */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>발행 플랫폼:</span>
          {['naver', 'wordpress', 'personal'].map(p => (
            <button key={p}
              onClick={() => togglePlatform(p)}
              className="text-[11px] px-2.5 py-1 rounded-lg transition-all"
              style={{
                background: platforms.includes(p) ? 'rgba(34,211,238,0.12)' : 'var(--bg)',
                border: `1px solid ${platforms.includes(p) ? 'rgba(34,211,238,0.4)' : 'var(--border)'}`,
                color: platforms.includes(p) ? '#22d3ee' : 'var(--text-muted)',
              }}>
              {{ naver: '네이버', wordpress: '워드프레스', personal: '개인사이트' }[p]}
            </button>
          ))}
          <label className="flex items-center gap-2 ml-auto cursor-pointer">
            <input type="checkbox" checked={generateImages} onChange={e => setGenerateImages(e.target.checked)}
              className="w-3.5 h-3.5 rounded" />
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>이미지 자동 생성</span>
          </label>
        </div>

        {/* 리서치 + 생성 버튼 */}
        <div className="flex gap-3">
          <button onClick={handleResearch} disabled={!destination.trim() || researching}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all disabled:opacity-40"
            style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)', color: '#22d3ee' }}>
            {researching ? <RefreshCw size={13} className="animate-spin" /> : <Search size={13} />}
            {researching ? '리서치 중...' : '데이터 리서치'}
          </button>
          <button onClick={handleGenerate} disabled={!destination.trim() || generating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all disabled:opacity-40"
            style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}>
            {generating ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} />}
            {generating ? '생성 중...' : '콘텐츠 생성'}
          </button>
        </div>
      </div>

      {/* 리서치 결과 */}
      {researchData && (
        <div className="rounded-2xl p-5 space-y-4"
          style={{ background: 'var(--bg-card)', border: '1px solid rgba(34,211,238,0.2)' }}>
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold" style={{ color: '#22d3ee' }}>
              {researchData.destination} 리서치 결과
            </p>
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.3)' }}>
              {researchData.dataSource === 'google_places' ? 'Google Places' : '기본 데이터'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '호텔', items: researchData.hotels },
              { label: '명소', items: researchData.attractions },
              { label: '맛집', items: researchData.restaurants },
            ].map(section => section.items.length > 0 && (
              <div key={section.label}>
                <p className="text-[11px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>{section.label}</p>
                <div className="space-y-1.5">
                  {section.items.slice(0, 3).map((item, i) => (
                    <div key={i} className="rounded-lg p-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <p className="text-[11px] font-medium truncate" style={{ color: 'var(--text)' }}>{item.name}</p>
                      {item.rating > 0 && (
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>★ {item.rating}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {researchData.travelTips.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>여행 팁</p>
              <ul className="space-y-1">
                {researchData.travelTips.map((tip, i) => (
                  <li key={i} className="text-[11px] flex items-start gap-1.5" style={{ color: 'var(--text-muted)' }}>
                    <span style={{ color: '#22d3ee' }}>•</span> {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 생성 진행 상황 */}
      {genSteps.length > 0 && (
        <div className="rounded-2xl p-5 space-y-2"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-[12px] font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>에이전트 실행 로그</p>
          {genSteps.map((step, i) => (
            <div key={i} className="flex items-center gap-3 text-[11px]">
              {step.status === 'done'
                ? <CheckCircle size={13} style={{ color: '#4ade80', flexShrink: 0 }} />
                : <AlertCircle size={13} style={{ color: '#f87171', flexShrink: 0 }} />}
              <span className="font-medium w-28 shrink-0" style={{ color: 'var(--text)' }}>{step.agent}</span>
              <span className="truncate" style={{ color: 'var(--text-muted)' }}>{step.summary}</span>
            </div>
          ))}
        </div>
      )}

      {/* 포스트 목록 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>생성된 콘텐츠</p>
          <button onClick={loadPosts} className="text-[11px] flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <RefreshCw size={11} /> 새로고침
          </button>
        </div>

        {loadingPosts ? (
          <div className="py-8 flex justify-center">
            <div className="w-5 h-5 border border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="py-12 text-center rounded-2xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <Globe size={32} className="mx-auto mb-3" style={{ color: 'var(--text-ultra)', opacity: 0.3 }} />
            <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>아직 생성된 콘텐츠가 없습니다</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-ultra)' }}>위에서 여행지를 입력하고 콘텐츠를 생성하세요</p>
          </div>
        ) : (
          posts.map(post => {
            const isExpanded = expandedId === post.id;
            return (
              <div key={post.id} className="rounded-2xl overflow-hidden"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

                {/* 포스트 헤더 */}
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : post.id)}>
                  <Globe size={14} style={{ color: '#22d3ee', flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text)' }}>
                      {post.naver_title ?? post.destination ?? post.topic}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {post.article_type} · {post.destination}
                      {post.evaluation && ` · ${post.evaluation.totalScore}점`}
                    </p>
                  </div>

                  {/* 플랫폼 도트 */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[9px] mr-0.5" style={{ color: 'var(--text-ultra)' }}>N</span>
                    <PlatformDot published={post.naver_published_at} />
                    <span className="text-[9px] mx-0.5" style={{ color: 'var(--text-ultra)' }}>W</span>
                    <PlatformDot published={post.wordpress_published_at} />
                    <span className="text-[9px] mx-0.5" style={{ color: 'var(--text-ultra)' }}>P</span>
                    <PlatformDot published={post.personal_published_at} />
                  </div>

                  <StatusBadge status={post.status} />
                  {isExpanded ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
                </div>

                {/* 확장 패널 */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: 'var(--border)' }}>

                    {/* 에러 메시지 */}
                    {post.error_message && (
                      <p className="text-[11px] mt-3 p-2 rounded-lg"
                        style={{ background: 'rgba(248,113,113,0.08)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>
                        {post.error_message}
                      </p>
                    )}

                    {/* 제목 목록 */}
                    {(post.naver_title || post.wordpress_title || post.personal_title) && (
                      <div className="mt-3 space-y-1.5">
                        <p className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>플랫폼별 제목</p>
                        {[
                          { label: '네이버',  title: post.naver_title,     color: '#4ade80' },
                          { label: '워드프레스', title: post.wordpress_title, color: '#60a5fa' },
                          { label: '개인사이트', title: post.personal_title,  color: '#c084fc' },
                        ].filter(r => r.title).map(r => (
                          <div key={r.label} className="flex items-start gap-2">
                            <span className="text-[10px] shrink-0 mt-0.5 px-1.5 py-0.5 rounded"
                              style={{ background: `${r.color}15`, color: r.color, border: `1px solid ${r.color}33` }}>
                              {r.label}
                            </span>
                            <p className="text-[12px]" style={{ color: 'var(--text)' }}>{r.title}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 발행 예약 시간 */}
                    <div className="flex items-center gap-2 mt-3">
                      <Clock size={12} style={{ color: 'var(--text-muted)' }} />
                      <input type="datetime-local"
                        defaultValue={toDatetimeLocal(post.scheduled_at)}
                        onChange={e => setScheduledAtEdits(p => ({ ...p, [post.id]: e.target.value }))}
                        className="text-[12px] px-2 py-1 rounded-lg outline-none [color-scheme:dark]"
                        style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                      />
                      <button
                        onClick={() => saveScheduledAt(post.id)}
                        disabled={!scheduledAtEdits[post.id] || savingDateIds.has(post.id)}
                        className="text-[11px] px-2.5 py-1 rounded-lg transition-all disabled:opacity-40"
                        style={{ background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.3)', color: '#4f8ef7' }}>
                        {savingDateIds.has(post.id) ? '저장 중...' : '저장'}
                      </button>
                    </div>

                    {/* 액션 버튼 */}
                    <div className="flex items-center gap-2 pt-1">
                      {post.status === 'ready' && (
                        <button onClick={() => handlePublishNow(post)}
                          className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg transition-all"
                          style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}>
                          <Send size={11} /> 지금 발행
                        </button>
                      )}
                      {(post.status === 'pending' || post.status === 'failed') && (
                        <button onClick={async () => {
                          const res = await fetch('/api/media-hub/write', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              postId: post.id, category: 'travel', articleType: post.article_type,
                              topic: post.destination ?? post.topic, destination: post.destination,
                              platforms: post.platforms, modelId, imageModelId, generateImages, saveToDb: true,
                            }),
                          });
                          const data = await res.json();
                          setGenSteps(data.steps ?? []);
                          await loadPosts();
                        }}
                          className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg transition-all"
                          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }}>
                          <Zap size={11} /> 콘텐츠 생성
                        </button>
                      )}
                      <button onClick={() => handleDelete(post.id)}
                        className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg transition-all ml-auto"
                        style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
                        <Trash2 size={11} /> 삭제
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── 준비 중 탭 ────────────────────────────────────────────────────────────────
function ComingSoonTab({ category }: { category: typeof CATEGORIES[number] }) {
  const Icon = category.icon;
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: `${category.color}12`, border: `1px solid ${category.color}33` }}>
        <Icon size={28} style={{ color: category.color, opacity: 0.7 }} />
      </div>
      <div className="text-center space-y-1">
        <p className="text-[16px] font-semibold" style={{ color: 'var(--text)' }}>{category.label} 카테고리 준비 중</p>
        <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{category.description}</p>
        <p className="text-[12px]" style={{ color: 'var(--text-ultra)' }}>여행 카테고리 고도화 후 순차 오픈 예정</p>
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function MediaHubPage() {
  const [activeCategory, setActiveCategory] = useState<Category>('travel');

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* 헤더 */}
      <div>
        <h1 className="text-[22px] font-bold" style={{ color: 'var(--text)' }}>미디어 허브</h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>
          카테고리별 AI 콘텐츠를 자동으로 생성하고 멀티플랫폼에 예약 발행합니다
        </p>
      </div>

      {/* 카테고리 탭 */}
      <div className="flex gap-2">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.key;
          return (
            <button key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all"
              style={{
                background: isActive ? `${cat.color}15` : 'var(--bg-card)',
                border: `1px solid ${isActive ? cat.color + '50' : 'var(--border)'}`,
                color: isActive ? cat.color : 'var(--text-muted)',
              }}>
              <Icon size={14} />
              {cat.label}
              {cat.key !== 'travel' && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-md"
                  style={{ background: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)' }}>
                  준비 중
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 탭 콘텐츠 */}
      {activeCategory === 'travel'  && <TravelTab />}
      {activeCategory === 'economy' && <ComingSoonTab category={CATEGORIES[1]} />}
      {activeCategory === 'it'      && <ComingSoonTab category={CATEGORIES[2]} />}
    </div>
  );
}
