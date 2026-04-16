'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Globe, Wand2, Send, Copy, Check, ChevronDown, ChevronUp,
  Loader2, FileText, RefreshCw, Settings, Search, Tag,
  TrendingUp, BarChart2, CheckCircle2, XCircle, Info,
  Hash, Star, BookOpen,
} from 'lucide-react';

type Platform    = 'wordpress' | 'naver' | 'nextblog';
type SeoPlatform = 'naver' | 'google';
type Tone        = 'friendly' | 'professional' | 'casual' | 'educational';
type Length      = 'short' | 'medium' | 'long';

type CrawlResult = {
  title: string;
  byline: string;
  content: string;
  siteName: string;
  length: number;
};

type PlatformStatus = {
  wordpress: boolean;
  naver: boolean;
  nextblog: boolean;
};

type SeoCheckItem = {
  item: string;
  pass: boolean;
  tip: string;
};

type WriteResult = {
  title: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
  slug: string;
  tags: string[];
  seoChecklist: SeoCheckItem[];
  seoScore: number;
  provider: string;
  targetKeyword: string;
  platform: string;
};

const PLATFORM_INFO: Record<Platform, { label: string; color: string; icon: string; desc: string }> = {
  wordpress: { label: 'WordPress', color: '#21759b', icon: 'W', desc: 'REST API' },
  naver:     { label: '네이버 블로그', color: '#03c75a', icon: 'N', desc: 'Open API' },
  nextblog:  { label: 'Next.js 블로그', color: '#7c3aed', icon: '▲', desc: 'Supabase' },
};

const SEO_PLATFORM_INFO: Record<SeoPlatform, { label: string; color: string; desc: string }> = {
  naver:  { label: '네이버 SEO',  color: '#03c75a', desc: 'C-RANK + DIA 알고리즘' },
  google: { label: '구글 SEO',   color: '#4285f4', desc: 'E-E-A-T 기준' },
};

const TONE_OPTIONS: { value: Tone; label: string }[] = [
  { value: 'friendly',     label: '친근한' },
  { value: 'professional', label: '전문적인' },
  { value: 'casual',       label: '자유로운' },
  { value: 'educational',  label: '교육적인' },
];

const LENGTH_OPTIONS: { value: Length; label: string; desc: string }[] = [
  { value: 'short',  label: '짧게', desc: '500~800자' },
  { value: 'medium', label: '보통', desc: '800~1500자' },
  { value: 'long',   label: '길게', desc: '1500~3000자' },
];

// ─── SEO Score Ring ─────────────────────────────────────────────────────────
function SeoScoreRing({ score }: { score: number }) {
  const r      = 26;
  const circ   = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color  = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={68} height={68} viewBox="0 0 68 68">
      <circle cx={34} cy={34} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
      <circle
        cx={34} cy={34} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 34 34)"
      />
      <text x={34} y={34} textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize={14} fontWeight={900}>{score}</text>
    </svg>
  );
}

// ─── Inner Page (needs useSearchParams) ─────────────────────────────────────
function BlogPageInner() {
  const router        = useRouter();
  const searchParams  = useSearchParams();

  // URL params from keyword page
  const initKeyword  = searchParams.get('keyword')  ?? '';
  const initVolume   = searchParams.get('volume')   ?? '';
  const initRelated  = searchParams.get('related')  ?? '';

  // Crawl
  const [url,         setUrl]         = useState('');
  const [crawling,    setCrawling]    = useState(false);
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);
  const [crawlError,  setCrawlError]  = useState('');
  const [showSource,  setShowSource]  = useState(false);

  // SEO inputs
  const [targetKeyword,    setTargetKeyword]    = useState(initKeyword);
  const [relatedKeywords,  setRelatedKeywords]  = useState(
    initRelated ? initRelated.split(',').filter(Boolean).join(', ') : ''
  );
  const [monthlyVolume,    setMonthlyVolume]    = useState(initVolume);
  const [seoPlatform,      setSeoPlatform]      = useState<SeoPlatform>('naver');

  // Write options
  const [tone,         setTone]         = useState<Tone>('friendly');
  const [length,       setLength]       = useState<Length>('medium');
  const [customPrompt, setCustomPrompt] = useState('');
  const [writing,      setWriting]      = useState(false);
  const [writeError,   setWriteError]   = useState('');
  const [activeTab,    setActiveTab]    = useState<'edit' | 'preview'>('edit');
  const [seoTab,       setSeoTab]       = useState<'checklist' | 'meta'>('checklist');

  // Results
  const [writeResult, setWriteResult] = useState<WriteResult | null>(null);
  const [blogContent, setBlogContent] = useState('');
  const [blogTitle,   setBlogTitle]   = useState('');
  const [copied,      setCopied]      = useState(false);

  // Publish
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('wordpress');
  const [platformStatus,   setPlatformStatus]   = useState<PlatformStatus>({ wordpress: false, naver: false, nextblog: false });
  const [statusOverride,   setStatusOverride]   = useState<'draft' | 'publish' | 'published'>('draft');
  const [publishing,       setPublishing]       = useState(false);
  const [publishResult,    setPublishResult]    = useState<{ success: boolean; message: string; link?: string } | null>(null);

  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch('/api/blog/credentials')
      .then(r => r.json())
      .then(d => {
        if (d.wordpress || d.naver || d.nextblog) {
          setPlatformStatus({
            wordpress: d.wordpress?.connected  ?? false,
            naver:     d.naver?.connected      ?? false,
            nextblog:  d.nextblog?.connected   ?? false,
          });
          if      (d.wordpress?.connected) setSelectedPlatform('wordpress');
          else if (d.naver?.connected)     setSelectedPlatform('naver');
          else if (d.nextblog?.connected)  setSelectedPlatform('nextblog');
        }
      })
      .catch(() => {});
  }, []);

  async function handleCrawl() {
    if (!url.trim()) return;
    setCrawling(true);
    setCrawlError('');
    setCrawlResult(null);
    try {
      const res  = await fetch('/api/blog/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '크롤링 실패');
      setCrawlResult(data);
    } catch (err: unknown) {
      setCrawlError(err instanceof Error ? err.message : '크롤링 중 오류 발생');
    } finally {
      setCrawling(false);
    }
  }

  async function handleWrite() {
    setWriting(true);
    setWriteError('');
    setWriteResult(null);

    const related = relatedKeywords
      .split(/[,，\n]/)
      .map(s => s.trim())
      .filter(Boolean);

    const lengthMap: Record<Length, number> = { short: 600, medium: 1200, long: 2000 };

    try {
      const res  = await fetch('/api/blog/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source:          crawlResult ? `제목: ${crawlResult.title}\n\n${crawlResult.content}` : '',
          tone,
          customPrompt:    customPrompt.trim() || undefined,
          targetKeyword:   targetKeyword.trim(),
          relatedKeywords: related.length ? related : undefined,
          platform:        seoPlatform,
          minLength:       lengthMap[length],
          monthlyVolume:   monthlyVolume ? Number(monthlyVolume) : undefined,
        }),
      });
      const data = await res.json() as WriteResult & { error?: string };
      if (!res.ok) throw new Error(data.error || '작성 실패');
      setBlogContent(data.content);
      setBlogTitle(data.title);
      setWriteResult(data);
      setActiveTab('edit');
    } catch (err: unknown) {
      setWriteError(err instanceof Error ? err.message : '블로그 작성 중 오류 발생');
    } finally {
      setWriting(false);
    }
  }

  async function handlePublish() {
    if (!blogContent.trim() || !blogTitle.trim()) return;
    if (!platformStatus[selectedPlatform]) { router.push('/dashboard/settings'); return; }
    setPublishing(true);
    setPublishResult(null);
    try {
      const res  = await fetch('/api/blog/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: selectedPlatform, title: blogTitle, content: blogContent, statusOverride }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '발행 실패');
      setPublishResult({ success: true, message: '발행이 완료되었습니다!', link: data.link || data.postUrl });
    } catch (err: unknown) {
      setPublishResult({ success: false, message: err instanceof Error ? err.message : '발행 중 오류 발생' });
    } finally {
      setPublishing(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(blogContent).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  function renderMarkdown(md: string) {
    const html = md
      .replace(/^### (.+)$/gm, '<h3 style="font-size:14px;font-weight:700;color:rgba(255,255,255,0.9);margin-top:16px;margin-bottom:4px">$1</h3>')
      .replace(/^## (.+)$/gm,  '<h2 style="font-size:16px;font-weight:900;color:#fff;margin-top:20px;margin-bottom:8px">$1</h2>')
      .replace(/^# (.+)$/gm,   '<h1 style="font-size:18px;font-weight:900;color:#fff;margin-top:8px;margin-bottom:12px">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,     '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li style="margin-left:16px;list-style:disc;color:rgba(255,255,255,0.7);font-size:13px;line-height:1.6">$1</li>')
      .replace(/\n\n/g, '</p><p style="color:rgba(255,255,255,0.7);font-size:13px;line-height:1.6;margin-bottom:12px">')
      .replace(/\n/g, '<br>');
    return `<p style="color:rgba(255,255,255,0.7);font-size:13px;line-height:1.6;margin-bottom:12px">${html}</p>`;
  }

  const anyConnected = Object.values(platformStatus).some(Boolean);
  const passCount    = writeResult?.seoChecklist.filter(i => i.pass).length ?? 0;
  const totalCount   = writeResult?.seoChecklist.length ?? 0;

  return (
    <div className="max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <span className="w-1 h-7 bg-[#22c55e]" />
        <div>
          <h1 className="text-[18px] font-black tracking-tight text-white uppercase">SEO 블로그 작성</h1>
          <p className="text-[11px] text-white/30 font-mono tracking-widest mt-0.5">SEO-OPTIMIZED BLOG WRITER & PUBLISHER</p>
        </div>
        {initKeyword && (
          <div className="ml-auto flex items-center gap-2 bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-lg px-3 py-1.5">
            <Search size={11} className="text-[#22c55e]/70" />
            <span className="text-[12px] font-mono text-[#22c55e]/80">{initKeyword}</span>
            {initVolume && (
              <span className="text-[10px] font-mono text-white/30 border-l border-white/10 pl-2">
                월 {Number(initVolume).toLocaleString()}회
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-5">
        {/* ─── 좌측: SEO 입력 + 크롤링 + 에디터 ─── */}
        <div className="space-y-4">

          {/* SEO 키워드 설정 */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-3">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <TrendingUp size={12} />SEO 키워드 설정
            </p>

            {/* 플랫폼 선택 */}
            <div>
              <p className="text-[10px] text-white/25 font-mono mb-2 uppercase tracking-wider">SEO 최적화 플랫폼</p>
              <div className="flex gap-1.5">
                {(Object.keys(SEO_PLATFORM_INFO) as SeoPlatform[]).map(p => {
                  const info = SEO_PLATFORM_INFO[p];
                  const active = seoPlatform === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setSeoPlatform(p)}
                      className={`flex-1 py-2 px-3 rounded-lg border text-left transition-all ${
                        active ? 'border-white/20 bg-white/8' : 'border-white/6 hover:border-white/12'
                      }`}
                    >
                      <p className={`text-[12px] font-bold ${active ? 'text-white' : 'text-white/40'}`}>{info.label}</p>
                      <p className="text-[9px] font-mono text-white/20 mt-0.5">{info.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 타겟 키워드 */}
            <div>
              <p className="text-[10px] text-white/25 font-mono mb-1.5 uppercase tracking-wider">타겟 키워드</p>
              <div className="relative">
                <Hash size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                <input
                  type="text"
                  value={targetKeyword}
                  onChange={e => setTargetKeyword(e.target.value)}
                  placeholder="예: 홈트레이닝 루틴"
                  className="w-full bg-white/[0.04] border border-white/10 hover:border-white/20 focus:border-[#22c55e]/40 rounded-lg pl-8 pr-3 py-2 text-[13px] text-white/80 placeholder-white/20 outline-none transition-colors font-mono"
                />
                {monthlyVolume && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#22c55e]/60">
                    월 {Number(monthlyVolume).toLocaleString()}회
                  </span>
                )}
              </div>
            </div>

            {/* 연관 키워드 */}
            <div>
              <p className="text-[10px] text-white/25 font-mono mb-1.5 uppercase tracking-wider">연관 키워드 (콤마로 구분)</p>
              <textarea
                value={relatedKeywords}
                onChange={e => setRelatedKeywords(e.target.value)}
                placeholder="예: 홈트, 맨몸운동, 스쿼트, 코어운동..."
                rows={2}
                className="w-full bg-white/[0.03] border border-white/8 hover:border-white/15 focus:border-[#22c55e]/30 rounded-lg px-3 py-2 text-[12px] text-white/70 placeholder-white/20 outline-none transition-colors font-mono resize-none"
              />
            </div>
          </div>

          {/* URL 크롤링 */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Globe size={12} />참고 URL 크롤링 <span className="text-white/15 font-normal normal-case">(선택)</span>
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCrawl()}
                placeholder="https://example.com/article"
                className="flex-1 bg-white/[0.04] border border-white/10 hover:border-white/20 focus:border-[#22c55e]/40 rounded-lg px-3 py-2 text-[13px] text-white/80 placeholder-white/20 outline-none transition-colors font-mono"
              />
              <button
                onClick={handleCrawl}
                disabled={crawling || !url.trim()}
                className="flex items-center gap-2 bg-white/8 hover:bg-white/15 disabled:opacity-40 border border-white/10 text-white/70 text-[12px] font-bold px-4 py-2 rounded-lg transition-colors"
              >
                {crawling ? <Loader2 size={13} className="animate-spin" /> : <Globe size={13} />}
                {crawling ? '...' : '가져오기'}
              </button>
            </div>

            {crawlError && <p className="text-red-400/80 text-[12px] font-mono mt-2">{crawlError}</p>}

            {crawlResult && (
              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-white/40">{crawlResult.siteName}</span>
                    <span className="text-[10px] font-mono bg-white/8 border border-white/10 px-1.5 py-0.5 rounded text-white/30">
                      {crawlResult.length.toLocaleString()}자
                    </span>
                  </div>
                  <button
                    onClick={() => setShowSource(!showSource)}
                    className="text-[11px] font-mono text-white/30 hover:text-white/60 flex items-center gap-1 transition-colors"
                  >
                    원문 {showSource ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  </button>
                </div>
                <p className="text-[13px] font-bold text-white/80 mt-2 leading-snug">{crawlResult.title}</p>
                {crawlResult.byline && <p className="text-[11px] text-white/30 font-mono mt-0.5">{crawlResult.byline}</p>}
                {showSource && (
                  <div className="mt-3 max-h-48 overflow-y-auto rounded-lg bg-black/30 border border-white/8 p-3">
                    <p className="text-[11px] text-white/40 font-mono leading-relaxed whitespace-pre-wrap">
                      {crawlResult.content.slice(0, 3000)}{crawlResult.content.length > 3000 ? '\n...(생략)' : ''}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 블로그 에디터 */}
          {blogContent ? (
            <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8">
                <div className="flex gap-1">
                  {(['edit', 'preview'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`text-[11px] font-mono px-3 py-1 rounded transition-colors ${
                        activeTab === tab ? 'text-white bg-white/10' : 'text-white/30 hover:text-white/60'
                      }`}
                    >
                      {tab === 'edit' ? '편집' : '미리보기'}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-white/20">{blogContent.length.toLocaleString()}자</span>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 border border-white/15 hover:border-white/30 text-white/50 hover:text-white/80 rounded-md transition-colors"
                  >
                    {copied ? <Check size={11} /> : <Copy size={11} />}
                    {copied ? '복사됨' : '복사'}
                  </button>
                </div>
              </div>
              <div className="px-4 pt-3">
                <input
                  type="text"
                  value={blogTitle}
                  onChange={e => setBlogTitle(e.target.value)}
                  placeholder="블로그 제목..."
                  className="w-full bg-transparent border-b border-white/10 focus:border-white/30 pb-2 text-[16px] font-black text-white outline-none transition-colors placeholder-white/15"
                />
              </div>
              {activeTab === 'edit' ? (
                <textarea
                  ref={editorRef}
                  value={blogContent}
                  onChange={e => setBlogContent(e.target.value)}
                  className="w-full min-h-[400px] bg-transparent px-4 py-3 text-[13px] text-white/80 font-mono leading-relaxed outline-none resize-none"
                  spellCheck={false}
                />
              ) : (
                <div className="px-4 py-3 min-h-[400px]" dangerouslySetInnerHTML={{ __html: renderMarkdown(blogContent) }} />
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 border border-white/8 rounded-2xl flex items-center justify-center">
                <FileText size={24} className="text-white/10" />
              </div>
              <p className="text-[13px] text-white/30 font-mono">
                {targetKeyword ? `"${targetKeyword}" 키워드로 AI 블로그 글 작성` : 'URL을 입력하거나 직접 작성을 시작하세요'}
              </p>
              <button
                onClick={() => { setBlogContent('# 블로그 제목\n\n여기에 내용을 작성하세요...'); setBlogTitle('블로그 제목'); }}
                className="text-[12px] text-[#22c55e]/50 hover:text-[#22c55e] transition-colors font-mono"
              >
                빈 문서로 시작 →
              </button>
            </div>
          )}

          {/* SEO 분석 결과 */}
          {writeResult && (
            <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                <div className="flex items-center gap-2">
                  <BarChart2 size={13} className="text-white/40" />
                  <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">SEO 분석 결과</p>
                </div>
                <div className="flex gap-1">
                  {(['checklist', 'meta'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setSeoTab(t)}
                      className={`text-[11px] font-mono px-3 py-1 rounded transition-colors ${
                        seoTab === t ? 'text-white bg-white/10' : 'text-white/30 hover:text-white/60'
                      }`}
                    >
                      {t === 'checklist' ? '체크리스트' : '메타 태그'}
                    </button>
                  ))}
                </div>
              </div>

              {/* SEO 점수 요약 */}
              <div className="flex items-center gap-4 px-4 py-3 border-b border-white/6">
                <SeoScoreRing score={writeResult.seoScore} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[14px] font-black text-white">SEO 점수</p>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                      writeResult.seoScore >= 80 ? 'text-[#22c55e]/80 border-[#22c55e]/25 bg-[#22c55e]/8' :
                      writeResult.seoScore >= 60 ? 'text-amber-400/80 border-amber-400/25 bg-amber-400/8' :
                      'text-red-400/80 border-red-500/25 bg-red-500/8'
                    }`}>
                      {writeResult.seoScore >= 80 ? '우수' : writeResult.seoScore >= 60 ? '보통' : '미흡'}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-white/30">
                    {passCount}/{totalCount} 항목 통과 · {SEO_PLATFORM_INFO[writeResult.platform as SeoPlatform]?.label ?? writeResult.platform} 최적화
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {writeResult.tags.slice(0, 6).map(tag => (
                      <span key={tag} className="text-[10px] font-mono text-white/40 bg-white/5 border border-white/8 px-1.5 py-0.5 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 체크리스트 탭 */}
              {seoTab === 'checklist' && (
                <div className="divide-y divide-white/4">
                  {writeResult.seoChecklist.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                      {item.pass
                        ? <CheckCircle2 size={14} className="text-[#22c55e]/70 shrink-0 mt-0.5" />
                        : <XCircle     size={14} className="text-red-400/70 shrink-0 mt-0.5"     />
                      }
                      <div className="min-w-0 flex-1">
                        <p className={`text-[12px] font-bold ${item.pass ? 'text-white/70' : 'text-white/60'}`}>{item.item}</p>
                        {!item.pass && item.tip && (
                          <p className="text-[11px] font-mono text-amber-400/60 mt-0.5 leading-relaxed">{item.tip}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 메타 태그 탭 */}
              {seoTab === 'meta' && (
                <div className="p-4 space-y-3">
                  <MetaField icon={<BookOpen size={12} />} label="Meta Title" value={writeResult.metaTitle} maxLen={60} />
                  <MetaField icon={<Info size={12} />}     label="Meta Description" value={writeResult.metaDescription} maxLen={160} />
                  <MetaField icon={<Globe size={12} />}    label="Slug (URL)" value={writeResult.slug} />
                  <div>
                    <p className="text-[10px] text-white/25 font-mono uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Tag size={11} />태그
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {writeResult.tags.map(tag => (
                        <span key={tag} className="text-[11px] font-mono text-white/50 bg-white/5 border border-white/10 px-2 py-1 rounded-md">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── 우측: AI 설정 + 발행 ─── */}
        <div className="space-y-4">
          {/* AI 블로그 작성 */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-4">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Wand2 size={12} />AI 블로그 작성
            </p>

            <div>
              <p className="text-[10px] text-white/25 font-mono mb-2 uppercase tracking-wider">문체</p>
              <div className="grid grid-cols-2 gap-1.5">
                {TONE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setTone(opt.value)}
                    className={`text-[12px] font-mono py-1.5 rounded-lg border transition-colors ${
                      tone === opt.value ? 'border-[#22c55e]/40 bg-[#22c55e]/10 text-white' : 'border-white/8 text-white/40 hover:text-white/60'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] text-white/25 font-mono mb-2 uppercase tracking-wider">길이</p>
              <div className="flex gap-1.5">
                {LENGTH_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setLength(opt.value)}
                    className={`flex-1 text-center py-1.5 rounded-lg border transition-colors ${
                      length === opt.value ? 'border-[#22c55e]/40 bg-[#22c55e]/10 text-white' : 'border-white/8 text-white/40 hover:text-white/60'
                    }`}
                  >
                    <span className="text-[12px] font-mono block">{opt.label}</span>
                    <span className="text-[9px] font-mono text-white/25">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] text-white/25 font-mono mb-2 uppercase tracking-wider">추가 지시사항</p>
              <textarea
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                placeholder="예: 초보자 눈높이로 작성, 특정 섹션 강조..."
                rows={3}
                className="w-full bg-white/[0.03] border border-white/8 hover:border-white/15 focus:border-[#22c55e]/30 rounded-lg px-3 py-2 text-[12px] text-white/70 placeholder-white/20 outline-none transition-colors font-mono resize-none"
              />
            </div>

            {writeError && <p className="text-red-400/80 text-[12px] font-mono">{writeError}</p>}

            <button
              onClick={handleWrite}
              disabled={writing || !targetKeyword.trim()}
              className="w-full flex items-center justify-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-40 text-black font-black text-[13px] tracking-tight uppercase py-2.5 rounded-lg transition-colors"
            >
              {writing ? (
                <><Loader2 size={14} className="animate-spin" /> SEO 분석 중...</>
              ) : blogContent ? (
                <><RefreshCw size={14} /> 다시 작성</>
              ) : (
                <><Wand2 size={14} /> AI SEO 블로그 작성</>
              )}
            </button>

            {/* 작성 가이드 */}
            {!blogContent && (
              <div className="bg-white/[0.02] border border-white/6 rounded-lg p-3 space-y-1.5">
                <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider flex items-center gap-1.5">
                  <Star size={10} />작성 팁
                </p>
                {seoPlatform === 'naver' ? (
                  <>
                    <p className="text-[11px] font-mono text-white/25 leading-relaxed">• 타겟 키워드 설정 시 제목·소제목에 자동 배치</p>
                    <p className="text-[11px] font-mono text-white/25 leading-relaxed">• 네이버 C-RANK: 정기 포스팅 + 카테고리 집중</p>
                    <p className="text-[11px] font-mono text-white/25 leading-relaxed">• DIA: 출처·체험기 중심 심층 콘텐츠 유리</p>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] font-mono text-white/25 leading-relaxed">• E-E-A-T: 경험·전문성·권위·신뢰성 중심</p>
                    <p className="text-[11px] font-mono text-white/25 leading-relaxed">• 구글: 길이보다 정보 밀도·출처 신뢰도 중요</p>
                    <p className="text-[11px] font-mono text-white/25 leading-relaxed">• 메타 타이틀 60자, 디스크립션 160자 준수</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 발행 */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-4">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Send size={12} />발행 플랫폼
            </p>

            <div className="space-y-1.5">
              {(Object.keys(PLATFORM_INFO) as Platform[]).map(platform => {
                const info       = PLATFORM_INFO[platform];
                const isSelected = selectedPlatform === platform;
                const isConn     = platformStatus[platform];
                return (
                  <button
                    key={platform}
                    onClick={() => setSelectedPlatform(platform)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                      isSelected ? 'border-white/20 bg-white/8' : 'border-white/6 hover:border-white/12 bg-white/[0.01]'
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-black text-white shrink-0"
                      style={{ backgroundColor: info.color }}
                    >
                      {info.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] font-bold ${isSelected ? 'text-white' : 'text-white/60'}`}>{info.label}</p>
                      <p className="text-[10px] font-mono text-white/25">{info.desc}</p>
                    </div>
                    {isConn
                      ? <span className="text-[10px] font-mono text-green-400/70 shrink-0">연결됨</span>
                      : <span className="text-[10px] font-mono text-white/20 shrink-0">미연결</span>
                    }
                  </button>
                );
              })}
            </div>

            {!platformStatus[selectedPlatform] && (
              <div className="flex items-center gap-2 bg-white/[0.03] border border-white/8 rounded-lg px-3 py-2.5">
                <p className="text-[12px] text-white/40 font-mono flex-1">설정 페이지에서 계정을 연결해주세요</p>
                <button
                  onClick={() => router.push('/dashboard/settings')}
                  className="flex items-center gap-1.5 text-[11px] font-mono text-white/50 hover:text-white/80 border border-white/15 hover:border-white/30 px-2.5 py-1 rounded-md transition-colors shrink-0"
                >
                  <Settings size={11} />설정
                </button>
              </div>
            )}

            {platformStatus[selectedPlatform] && (
              <div>
                <p className="text-[10px] text-white/25 font-mono mb-2 uppercase tracking-wider">발행 상태</p>
                <div className="flex gap-1.5">
                  {(selectedPlatform === 'nextblog'
                    ? [{ v: 'draft', l: '초안' }, { v: 'published', l: '발행' }]
                    : [{ v: 'draft', l: '초안' }, { v: 'publish',   l: '발행' }]
                  ).map(({ v, l }) => (
                    <button
                      key={v}
                      onClick={() => setStatusOverride(v as 'draft' | 'publish' | 'published')}
                      className={`flex-1 text-[12px] font-mono py-1.5 rounded-lg border transition-colors ${
                        statusOverride === v ? 'border-white/20 bg-white/8 text-white' : 'border-white/8 text-white/30 hover:text-white/60'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {publishResult && (
              <div className={`text-[12px] font-mono p-3 rounded-lg border ${
                publishResult.success
                  ? 'text-[#22c55e]/80 border-[#22c55e]/20 bg-[#22c55e]/5'
                  : 'text-red-400/80 border-red-500/20 bg-red-500/5'
              }`}>
                {publishResult.message}
                {publishResult.link && (
                  <a href={publishResult.link} target="_blank" rel="noopener noreferrer"
                    className="block mt-1 text-[11px] underline opacity-70 hover:opacity-100 break-all">
                    {publishResult.link}
                  </a>
                )}
              </div>
            )}

            <button
              onClick={handlePublish}
              disabled={publishing || !blogContent.trim() || !blogTitle.trim()}
              className={`w-full flex items-center justify-center gap-2 font-black text-[13px] tracking-tight uppercase py-2.5 rounded-lg transition-colors ${
                platformStatus[selectedPlatform]
                  ? 'bg-white/8 hover:bg-white/15 disabled:opacity-30 border border-white/15 text-white/70'
                  : 'bg-white/5 border border-white/10 text-white/30 cursor-pointer'
              }`}
            >
              {publishing ? (
                <><Loader2 size={14} className="animate-spin" /> 발행 중...</>
              ) : platformStatus[selectedPlatform] ? (
                <><Send size={14} /> {PLATFORM_INFO[selectedPlatform].label}에 발행</>
              ) : (
                <><Settings size={14} /> 계정 연결하기</>
              )}
            </button>

            {!anyConnected && (
              <p className="text-[10px] text-white/20 font-mono text-center">
                설정 페이지에서 블로그 플랫폼을 먼저 연결하세요
              </p>
            )}
          </div>

          {/* 키워드 리서치로 돌아가기 */}
          {initKeyword && (
            <button
              onClick={() => router.push('/dashboard/keyword')}
              className="w-full flex items-center justify-center gap-2 text-[11px] font-mono text-white/30 hover:text-white/60 border border-white/8 hover:border-white/15 py-2 rounded-lg transition-colors"
            >
              <Search size={11} />키워드 리서치로 돌아가기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MetaField 컴포넌트 ───────────────────────────────────────────────────────
function MetaField({
  icon, label, value, maxLen,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  maxLen?: number;
}) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }
  const over = maxLen ? value.length > maxLen : false;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] text-white/25 font-mono uppercase tracking-wider flex items-center gap-1.5">
          {icon}{label}
          {maxLen && (
            <span className={`ml-1 ${over ? 'text-red-400/60' : 'text-white/15'}`}>
              {value.length}/{maxLen}
            </span>
          )}
        </p>
        <button onClick={copy} className="text-[10px] font-mono text-white/25 hover:text-white/60 transition-colors flex items-center gap-1">
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
      <div className={`bg-white/[0.03] border rounded-lg px-3 py-2 ${over ? 'border-red-500/20' : 'border-white/8'}`}>
        <p className="text-[12px] font-mono text-white/60 leading-relaxed break-all">{value}</p>
      </div>
    </div>
  );
}

// ─── 최상위 export (Suspense 래핑) ───────────────────────────────────────────
export default function BlogPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-white/20" />
      </div>
    }>
      <BlogPageInner />
    </Suspense>
  );
}
