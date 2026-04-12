'use client';

import { useState, useRef } from 'react';
import { Globe, Wand2, Send, Copy, Check, ChevronDown, ChevronUp, Loader2, FileText, RefreshCw } from 'lucide-react';

type Platform = 'wordpress' | 'naver' | 'nextblog';
type Tone = 'friendly' | 'professional' | 'casual' | 'educational';
type Length = 'short' | 'medium' | 'long';
type PublishStatus = 'draft' | 'publish' | 'published';

type CrawlResult = {
  title: string;
  byline: string;
  excerpt: string;
  content: string;
  siteName: string;
  url: string;
  length: number;
};

type PlatformConfig = {
  wordpress: { siteUrl: string; username: string; appPassword: string; status: PublishStatus };
  naver: { accessToken: string };
  nextblog: { supabaseUrl: string; supabaseKey: string; status: PublishStatus };
};

const PLATFORM_INFO: Record<Platform, { label: string; color: string; icon: string; desc: string }> = {
  wordpress: { label: 'WordPress', color: '#21759b', icon: 'W', desc: 'REST API (Application Password)' },
  naver: { label: '네이버 블로그', color: '#03c75a', icon: 'N', desc: 'Open API (Access Token)' },
  nextblog: { label: 'Next.js 블로그', color: '#7c3aed', icon: '▲', desc: 'Supabase (posts 테이블)' },
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

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('wordpress');
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>({
    wordpress: { siteUrl: '', username: '', appPassword: '', status: 'draft' },
    naver: { accessToken: '' },
    nextblog: { supabaseUrl: '', supabaseKey: '', status: 'draft' },
  });
  const [showPlatformConfig, setShowPlatformConfig] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ success: boolean; message: string; link?: string } | null>(null);

  const editorRef = useRef<HTMLTextAreaElement>(null);

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
    setPublishing(true);
    setPublishResult(null);
    try {
      const config = platformConfig[selectedPlatform];
      const res = await fetch('/api/blog/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: selectedPlatform,
          title: blogTitle,
          content: blogContent,
          config,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '발행 실패');
      setPublishResult({
        success: true,
        message: '발행이 완료되었습니다!',
        link: data.link || data.postUrl || undefined,
      });
    } catch (err: unknown) {
      setPublishResult({
        success: false,
        message: err instanceof Error ? err.message : '발행 중 오류 발생',
      });
    } finally {
      setPublishing(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(blogContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // 마크다운 → HTML 미리보기 (간단 버전)
  function renderMarkdown(md: string) {
    const html = md
      .replace(/^### (.+)$/gm, '<h3 class="text-[14px] font-bold text-white/90 mt-4 mb-1">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-[16px] font-black text-white mt-5 mb-2">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-[18px] font-black text-white mt-2 mb-3">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-white/70 text-[13px] leading-relaxed">$1</li>')
      .replace(/\n\n/g, '</p><p class="text-white/70 text-[13px] leading-relaxed mb-3">')
      .replace(/\n/g, '<br>');
    return `<p class="text-white/70 text-[13px] leading-relaxed mb-3">${html}</p>`;
  }

  const updatePlatformConfig = <K extends Platform>(platform: K, key: keyof PlatformConfig[K], value: string) => {
    setPlatformConfig(prev => ({
      ...prev,
      [platform]: { ...prev[platform], [key]: value },
    }));
  };

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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-5">
        {/* ─── 좌측: 크롤링 + 에디터 ─── */}
        <div className="space-y-4">
          {/* URL 크롤링 */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <p className="text-[12px] font-bold text-white/60 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Globe size={13} />
              URL 크롤링
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
                {crawling ? '가져오는 중...' : '가져오기'}
              </button>
            </div>

            {crawlError && (
              <p className="text-red-400/80 text-[12px] font-mono mt-2">{crawlError}</p>
            )}

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
                    원문 보기 {showSource ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  </button>
                </div>
                <p className="text-[13px] font-bold text-white/80 mt-2 leading-snug">{crawlResult.title}</p>
                {crawlResult.byline && (
                  <p className="text-[11px] text-white/30 font-mono mt-0.5">{crawlResult.byline}</p>
                )}
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
          {blogContent && (
            <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
              {/* 탭 헤더 */}
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

              {/* 제목 입력 */}
              <div className="px-4 pt-3">
                <input
                  type="text"
                  value={blogTitle}
                  onChange={e => setBlogTitle(e.target.value)}
                  placeholder="블로그 제목..."
                  className="w-full bg-transparent border-b border-white/10 focus:border-white/30 pb-2 text-[16px] font-black text-white outline-none transition-colors placeholder-white/15"
                />
              </div>

              {/* 편집 / 미리보기 */}
              {activeTab === 'edit' ? (
                <textarea
                  ref={editorRef}
                  value={blogContent}
                  onChange={e => setBlogContent(e.target.value)}
                  className="w-full min-h-[400px] bg-transparent px-4 py-3 text-[13px] text-white/80 font-mono leading-relaxed outline-none resize-none placeholder-white/15"
                  placeholder="블로그 내용을 작성하세요..."
                  spellCheck={false}
                />
              ) : (
                <div
                  className="px-4 py-3 min-h-[400px] prose-invert"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(blogContent) }}
                />
              )}
            </div>
          )}

          {/* 빈 상태 */}
          {!blogContent && !crawlResult && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 border border-white/8 rounded-2xl flex items-center justify-center">
                <FileText size={24} className="text-white/10" />
              </div>
              <div className="text-center">
                <p className="text-[13px] text-white/30 font-mono">URL을 입력하거나 직접 작성을 시작하세요</p>
              </div>
              <button
                onClick={() => setBlogContent('# 블로그 제목\n\n여기에 내용을 작성하세요...')}
                className="text-[12px] text-[#22c55e]/50 hover:text-[#22c55e] transition-colors font-mono"
              >
                빈 문서로 시작 →
              </button>
            </div>
          )}

          {!blogContent && crawlResult && (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <p className="text-[13px] text-white/30 font-mono">우측에서 AI 작성 옵션을 설정하고 블로그를 생성하세요</p>
            </div>
          )}
        </div>

        {/* ─── 우측: AI 설정 + 발행 ─── */}
        <div className="space-y-4">
          {/* AI 블로그 작성 */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-4">
            <p className="text-[12px] font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
              <Wand2 size={13} />
              AI 블로그 작성
            </p>

            {/* 문체 */}
            <div>
              <p className="text-[11px] text-white/30 font-mono mb-2">문체</p>
              <div className="grid grid-cols-2 gap-1.5">
                {TONE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setTone(opt.value)}
                    className={`text-[12px] font-mono py-1.5 rounded-lg border transition-colors ${
                      tone === opt.value
                        ? 'border-[#22c55e]/40 bg-[#22c55e]/10 text-white'
                        : 'border-white/8 text-white/40 hover:text-white/60 hover:border-white/15'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 길이 */}
            <div>
              <p className="text-[11px] text-white/30 font-mono mb-2">길이</p>
              <div className="flex gap-1.5">
                {LENGTH_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setLength(opt.value)}
                    className={`flex-1 text-center py-1.5 rounded-lg border transition-colors ${
                      length === opt.value
                        ? 'border-[#22c55e]/40 bg-[#22c55e]/10 text-white'
                        : 'border-white/8 text-white/40 hover:text-white/60 hover:border-white/15'
                    }`}
                  >
                    <span className="text-[12px] font-mono block">{opt.label}</span>
                    <span className="text-[9px] font-mono text-white/25">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 커스텀 프롬프트 */}
            <div>
              <p className="text-[11px] text-white/30 font-mono mb-2">추가 지시사항 (선택)</p>
              <textarea
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                placeholder="예: SEO 최적화 키워드 포함, 특정 독자층 타겟..."
                rows={3}
                className="w-full bg-white/[0.03] border border-white/8 hover:border-white/15 focus:border-[#22c55e]/30 rounded-lg px-3 py-2 text-[12px] text-white/70 placeholder-white/20 outline-none transition-colors font-mono resize-none"
              />
            </div>

            {writeError && (
              <p className="text-red-400/80 text-[12px] font-mono">{writeError}</p>
            )}

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

          {/* 발행 설정 */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-4">
            <p className="text-[12px] font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
              <Send size={13} />
              발행 플랫폼
            </p>

            {/* 플랫폼 선택 */}
            <div className="space-y-1.5">
              {(Object.keys(PLATFORM_INFO) as Platform[]).map(platform => {
                const info = PLATFORM_INFO[platform];
                const isSelected = selectedPlatform === platform;
                return (
                  <button
                    key={platform}
                    onClick={() => { setSelectedPlatform(platform); setShowPlatformConfig(true); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                      isSelected
                        ? 'border-white/20 bg-white/8'
                        : 'border-white/6 hover:border-white/12 bg-white/[0.01]'
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-black text-white shrink-0"
                      style={{ backgroundColor: info.color }}
                    >
                      {info.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] font-bold ${isSelected ? 'text-white' : 'text-white/60'}`}>
                        {info.label}
                      </p>
                      <p className="text-[10px] font-mono text-white/25">{info.desc}</p>
                    </div>
                    {isSelected && (
                      <div className="w-1.5 h-1.5 bg-[#22c55e] rounded-full shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* 플랫폼 설정 토글 */}
            <button
              onClick={() => setShowPlatformConfig(!showPlatformConfig)}
              className="w-full flex items-center justify-between text-[11px] font-mono text-white/30 hover:text-white/60 transition-colors"
            >
              <span>연결 설정</span>
              {showPlatformConfig ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {showPlatformConfig && (
              <div className="space-y-2.5">
                {selectedPlatform === 'wordpress' && (
                  <>
                    <ConfigInput
                      label="사이트 URL"
                      placeholder="https://yourblog.com"
                      value={platformConfig.wordpress.siteUrl}
                      onChange={v => updatePlatformConfig('wordpress', 'siteUrl', v)}
                    />
                    <ConfigInput
                      label="사용자명"
                      placeholder="admin"
                      value={platformConfig.wordpress.username}
                      onChange={v => updatePlatformConfig('wordpress', 'username', v)}
                    />
                    <ConfigInput
                      label="앱 비밀번호"
                      placeholder="xxxx xxxx xxxx xxxx"
                      type="password"
                      value={platformConfig.wordpress.appPassword}
                      onChange={v => updatePlatformConfig('wordpress', 'appPassword', v)}
                    />
                    <div>
                      <p className="text-[10px] font-mono text-white/30 mb-1">발행 상태</p>
                      <div className="flex gap-1.5">
                        {(['draft', 'publish'] as const).map(s => (
                          <button
                            key={s}
                            onClick={() => updatePlatformConfig('wordpress', 'status', s)}
                            className={`flex-1 text-[11px] font-mono py-1 rounded border transition-colors ${
                              platformConfig.wordpress.status === s
                                ? 'border-white/20 bg-white/8 text-white'
                                : 'border-white/8 text-white/30 hover:text-white/60'
                            }`}
                          >
                            {s === 'draft' ? '초안' : '발행'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {selectedPlatform === 'naver' && (
                  <ConfigInput
                    label="액세스 토큰"
                    placeholder="Bearer 토큰을 입력하세요"
                    type="password"
                    value={platformConfig.naver.accessToken}
                    onChange={v => updatePlatformConfig('naver', 'accessToken', v)}
                  />
                )}
                {selectedPlatform === 'nextblog' && (
                  <>
                    <ConfigInput
                      label="Supabase URL"
                      placeholder="https://xxx.supabase.co"
                      value={platformConfig.nextblog.supabaseUrl}
                      onChange={v => updatePlatformConfig('nextblog', 'supabaseUrl', v)}
                    />
                    <ConfigInput
                      label="Service Role Key"
                      placeholder="eyJ..."
                      type="password"
                      value={platformConfig.nextblog.supabaseKey}
                      onChange={v => updatePlatformConfig('nextblog', 'supabaseKey', v)}
                    />
                    <div>
                      <p className="text-[10px] font-mono text-white/30 mb-1">발행 상태</p>
                      <div className="flex gap-1.5">
                        {(['draft', 'published'] as const).map(s => (
                          <button
                            key={s}
                            onClick={() => updatePlatformConfig('nextblog', 'status', s)}
                            className={`flex-1 text-[11px] font-mono py-1 rounded border transition-colors ${
                              platformConfig.nextblog.status === s
                                ? 'border-white/20 bg-white/8 text-white'
                                : 'border-white/8 text-white/30 hover:text-white/60'
                            }`}
                          >
                            {s === 'draft' ? '초안' : '발행'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 발행 버튼 */}
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
              className="w-full flex items-center justify-center gap-2 bg-white/8 hover:bg-white/15 disabled:opacity-30 border border-white/15 text-white/70 font-black text-[13px] tracking-tight uppercase py-2.5 rounded-lg transition-colors"
            >
              {publishing ? (
                <><Loader2 size={14} className="animate-spin" /> 발행 중...</>
              ) : (
                <><Send size={14} /> {PLATFORM_INFO[selectedPlatform].label}에 발행</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfigInput({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-mono text-white/30 mb-1">{label}</p>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/[0.03] border border-white/8 hover:border-white/15 focus:border-[#22c55e]/30 rounded-lg px-3 py-1.5 text-[12px] text-white/70 placeholder-white/20 outline-none transition-colors font-mono"
      />
    </div>
  );
}
