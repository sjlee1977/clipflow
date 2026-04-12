'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Wand2, Send, Copy, Check, ChevronDown, ChevronUp, Loader2, FileText, RefreshCw, Settings } from 'lucide-react';

type Platform = 'wordpress' | 'naver' | 'nextblog';
type Tone = 'friendly' | 'professional' | 'casual' | 'educational';
type Length = 'short' | 'medium' | 'long';

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

const PLATFORM_INFO: Record<Platform, { label: string; color: string; icon: string; desc: string }> = {
  wordpress: { label: 'WordPress', color: '#21759b', icon: 'W', desc: 'REST API' },
  naver: { label: '네이버 블로그', color: '#03c75a', icon: 'N', desc: 'Open API' },
  nextblog: { label: 'Next.js 블로그', color: '#7c3aed', icon: '▲', desc: 'Supabase' },
};

const TONE_OPTIONS: { value: Tone; label: string }[] = [
  { value: 'friendly', label: '친근한' },
  { value: 'professional', label: '전문적인' },
  { value: 'casual', label: '자유로운' },
  { value: 'educational', label: '교육적인' },
];

const LENGTH_OPTIONS: { value: Length; label: string; desc: string }[] = [
  { value: 'short', label: '짧게', desc: '500~800자' },
  { value: 'medium', label: '보통', desc: '800~1500자' },
  { value: 'long', label: '길게', desc: '1500~3000자' },
];

export default function BlogPage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [crawling, setCrawling] = useState(false);
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);
  const [crawlError, setCrawlError] = useState('');
  const [showSource, setShowSource] = useState(false);

  const [tone, setTone] = useState<Tone>('friendly');
  const [length, setLength] = useState<Length>('medium');
  const [customPrompt, setCustomPrompt] = useState('');
  const [writing, setWriting] = useState(false);
  const [blogContent, setBlogContent] = useState('');
  const [blogTitle, setBlogTitle] = useState('');
  const [writeError, setWriteError] = useState('');
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  const [copied, setCopied] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('wordpress');
  const [platformStatus, setPlatformStatus] = useState<PlatformStatus>({ wordpress: false, naver: false, nextblog: false });
  const [statusOverride, setStatusOverride] = useState<'draft' | 'publish' | 'published'>('draft');
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ success: boolean; message: string; link?: string } | null>(null);

  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch('/api/blog/credentials')
      .then(r => r.json())
      .then(d => {
        if (d.wordpress || d.naver || d.nextblog) {
          setPlatformStatus({
            wordpress: d.wordpress?.connected ?? false,
            naver: d.naver?.connected ?? false,
            nextblog: d.nextblog?.connected ?? false,
          });
          // 연결된 첫 번째 플랫폼 자동 선택
          if (d.wordpress?.connected) setSelectedPlatform('wordpress');
          else if (d.naver?.connected) setSelectedPlatform('naver');
          else if (d.nextblog?.connected) setSelectedPlatform('nextblog');
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
      const res = await fetch('/api/blog/crawl', {
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
    try {
      const res = await fetch('/api/blog/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: crawlResult?.content || '',
          title: crawlResult?.title || '',
          tone,
          length,
          customPrompt: customPrompt.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '작성 실패');
      setBlogContent(data.content);
      setBlogTitle(data.title);
      setActiveTab('edit');
    } catch (err: unknown) {
      setWriteError(err instanceof Error ? err.message : '블로그 작성 중 오류 발생');
    } finally {
      setWriting(false);
    }
  }

  async function handlePublish() {
    if (!blogContent.trim() || !blogTitle.trim()) return;
    if (!platformStatus[selectedPlatform]) {
      router.push('/dashboard/settings');
      return;
    }
    setPublishing(true);
    setPublishResult(null);
    try {
      const res = await fetch('/api/blog/publish', {
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
      .replace(/^## (.+)$/gm, '<h2 style="font-size:16px;font-weight:900;color:#fff;margin-top:20px;margin-bottom:8px">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 style="font-size:18px;font-weight:900;color:#fff;margin-top:8px;margin-bottom:12px">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li style="margin-left:16px;list-style:disc;color:rgba(255,255,255,0.7);font-size:13px;line-height:1.6">$1</li>')
      .replace(/\n\n/g, '</p><p style="color:rgba(255,255,255,0.7);font-size:13px;line-height:1.6;margin-bottom:12px">')
      .replace(/\n/g, '<br>');
    return `<p style="color:rgba(255,255,255,0.7);font-size:13px;line-height:1.6;margin-bottom:12px">${html}</p>`;
  }

  const anyConnected = Object.values(platformStatus).some(Boolean);

  return (
    <div className="max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <span className="w-1 h-7 bg-[#22c55e]" />
        <div>
          <h1 className="text-[18px] font-black tracking-tight text-white uppercase">블로그 작성</h1>
          <p className="text-[11px] text-white/30 font-mono tracking-widest mt-0.5">BLOG WRITER & PUBLISHER</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-5">
        {/* ─── 좌측: 크롤링 + 에디터 ─── */}
        <div className="space-y-4">
          {/* URL 크롤링 */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Globe size={12} />URL 크롤링
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
              <p className="text-[13px] text-white/30 font-mono">URL을 입력하거나 직접 작성을 시작하세요</p>
              <button
                onClick={() => { setBlogContent('# 블로그 제목\n\n여기에 내용을 작성하세요...'); setBlogTitle('블로그 제목'); }}
                className="text-[12px] text-[#22c55e]/50 hover:text-[#22c55e] transition-colors font-mono"
              >
                빈 문서로 시작 →
              </button>
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
                placeholder="예: SEO 최적화, 특정 독자층..."
                rows={3}
                className="w-full bg-white/[0.03] border border-white/8 hover:border-white/15 focus:border-[#22c55e]/30 rounded-lg px-3 py-2 text-[12px] text-white/70 placeholder-white/20 outline-none transition-colors font-mono resize-none"
              />
            </div>

            {writeError && <p className="text-red-400/80 text-[12px] font-mono">{writeError}</p>}

            <button
              onClick={handleWrite}
              disabled={writing || (!crawlResult && !customPrompt.trim())}
              className="w-full flex items-center justify-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-40 text-black font-black text-[13px] tracking-tight uppercase py-2.5 rounded-lg transition-colors"
            >
              {writing ? (
                <><Loader2 size={14} className="animate-spin" /> 작성 중...</>
              ) : blogContent ? (
                <><RefreshCw size={14} /> 다시 작성</>
              ) : (
                <><Wand2 size={14} /> AI 블로그 작성</>
              )}
            </button>
          </div>

          {/* 발행 */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-4">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Send size={12} />발행 플랫폼
            </p>

            {/* 플랫폼 선택 */}
            <div className="space-y-1.5">
              {(Object.keys(PLATFORM_INFO) as Platform[]).map(platform => {
                const info = PLATFORM_INFO[platform];
                const isSelected = selectedPlatform === platform;
                const isConn = platformStatus[platform];
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

            {/* 연결 안 된 경우 안내 */}
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

            {/* 연결된 경우 발행 상태 선택 */}
            {platformStatus[selectedPlatform] && (
              <div>
                <p className="text-[10px] text-white/25 font-mono mb-2 uppercase tracking-wider">발행 상태</p>
                <div className="flex gap-1.5">
                  {(selectedPlatform === 'nextblog'
                    ? [{ v: 'draft', l: '초안' }, { v: 'published', l: '발행' }]
                    : [{ v: 'draft', l: '초안' }, { v: 'publish', l: '발행' }]
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

            {/* 결과 메시지 */}
            {publishResult && (
              <div className={`text-[12px] font-mono p-3 rounded-lg border ${
                publishResult.success ? 'text-[#22c55e]/80 border-[#22c55e]/20 bg-[#22c55e]/5' : 'text-red-400/80 border-red-500/20 bg-red-500/5'
              }`}>
                {publishResult.message}
                {publishResult.link && (
                  <a href={publishResult.link} target="_blank" rel="noopener noreferrer" className="block mt-1 text-[11px] underline opacity-70 hover:opacity-100 break-all">
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
        </div>
      </div>
    </div>
  );
}
