'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { Repeat2, Loader2, Copy, Check, ChevronDown, ChevronUp, ExternalLink, Send, FileText, X } from 'lucide-react';

type Script = { id: string; title: string; content: string; created_at: string };
type FormatKey = 'twitter' | 'linkedin' | 'instagram' | 'tiktok' | 'blog_summary';
type PublishState = 'idle' | 'publishing' | 'done' | 'error';

const FORMAT_META: Record<FormatKey, {
  label: string; icon: string; color: string; desc: string;
  publishType: 'blog' | 'social';
  socialUrl?: string;
  socialHint?: string;
}> = {
  twitter:      { label: 'Twitter / X',   icon: '✕',  color: '#1DA1F2', desc: '스레드 5~8개 트윗',         publishType: 'social', socialUrl: 'https://twitter.com/intent/tweet',      socialHint: '복사 후 Twitter에서 붙여넣기' },
  linkedin:     { label: 'LinkedIn',       icon: 'in', color: '#0A66C2', desc: '전문적 포스트 1000~1500자', publishType: 'social', socialUrl: 'https://www.linkedin.com/feed',           socialHint: '복사 후 LinkedIn 포스트 작성' },
  instagram:    { label: 'Instagram',      icon: '◈',  color: '#E1306C', desc: '캡션 + 해시태그 30개',      publishType: 'social', socialUrl: 'https://www.instagram.com',              socialHint: '복사 후 Instagram 앱에서 붙여넣기' },
  tiktok:       { label: 'TikTok / 쇼츠', icon: '♪',  color: '#FF0050', desc: '60초 쇼츠 대본',            publishType: 'social', socialUrl: 'https://www.tiktok.com/upload',         socialHint: '대본 복사 후 촬영 참고용' },
  blog_summary: { label: '블로그 도입부', icon: '✎',  color: '#a855f7', desc: 'SEO 소개글 + 목차',          publishType: 'blog' },
};

const BLOG_PLATFORMS = [
  { key: 'wordpress', label: 'WordPress',    icon: 'W' },
  { key: 'naver',     label: '네이버 블로그', icon: 'N' },
  { key: 'nextblog',  label: 'Next.js 블로그', icon: 'NX' },
] as const;

type BlogPlatformKey = typeof BLOG_PLATFORMS[number]['key'];

export default function ReformatPage() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loadingScripts, setLoadingScripts] = useState(true);
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
  const [manualContent, setManualContent] = useState('');
  const [useManual, setUseManual] = useState(false);
  const [selectedFormats, setSelectedFormats] = useState<Set<FormatKey>>(new Set(['twitter', 'linkedin', 'instagram', 'tiktok']));
  const [converting, setConverting] = useState(false);
  const [results, setResults] = useState<Partial<Record<FormatKey, string>>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<FormatKey | null>(null);
  const [error, setError] = useState('');

  // 대본 연동 상태
  const [fromScript, setFromScript] = useState(false);
  const [fromScriptTitle, setFromScriptTitle] = useState('');

  // 블로그 발행 상태
  const [publishingPlatform, setPublishingPlatform] = useState<BlogPlatformKey | null>(null);
  const [publishStates, setPublishStates] = useState<Partial<Record<BlogPlatformKey, PublishState>>>({});
  const [publishResults, setPublishResults] = useState<Partial<Record<BlogPlatformKey, { link?: string; error?: string }>>>({});
  const [showBlogPublish, setShowBlogPublish] = useState(false);
  const [blogTitle, setBlogTitle] = useState('');

  useEffect(() => {
    // sessionStorage에서 대본 확인 (대본 페이지에서 연동)
    const savedScript = sessionStorage.getItem('clipflow_reformat_script');
    const savedTopic = sessionStorage.getItem('clipflow_reformat_topic');
    if (savedScript) {
      sessionStorage.removeItem('clipflow_reformat_script');
      sessionStorage.removeItem('clipflow_reformat_topic');
      setFromScript(true);
      setFromScriptTitle(savedTopic ?? '');
      setBlogTitle(savedTopic ?? '');
      setUseManual(true);
      setManualContent(savedScript);
    }

    const supabase = createClient();
    supabase.from('scripts').select('id, title, content, created_at').order('created_at', { ascending: false }).limit(20)
      .then(({ data }: { data: Script[] | null }) => { setScripts(data ?? []); setLoadingScripts(false); });
  }, []);

  function toggleFormat(fmt: FormatKey) {
    setSelectedFormats(prev => {
      const next = new Set(prev);
      if (next.has(fmt)) { if (next.size > 1) next.delete(fmt); }
      else next.add(fmt);
      return next;
    });
  }

  function clearScript() {
    setFromScript(false);
    setFromScriptTitle('');
    setManualContent('');
    setUseManual(false);
  }

  async function handleConvert() {
    const content = useManual ? manualContent : selectedScript?.content;
    if (!content?.trim()) return;
    setConverting(true);
    setError('');
    setResults({});
    setPublishStates({});
    setPublishResults({});
    try {
      const res = await fetch('/api/reformat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, formats: Array.from(selectedFormats) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '변환 실패');
      setResults(data.results ?? {});
      const firstKey = Object.keys(data.results ?? {})[0] as FormatKey | undefined;
      if (firstKey) setExpandedKey(firstKey);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '변환 오류');
    } finally {
      setConverting(false);
    }
  }

  function handleCopy(key: FormatKey, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  // 소셜: 복사 + 플랫폼 열기
  function handleSocialPublish(key: FormatKey, text: string) {
    const meta = FORMAT_META[key];
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    if (meta.socialUrl) window.open(meta.socialUrl, '_blank');
  }

  // 블로그: 직접 발행
  async function handleBlogPublish(platform: BlogPlatformKey) {
    const content = results.blog_summary;
    if (!content || !blogTitle.trim()) return;
    setPublishingPlatform(platform);
    setPublishStates(prev => ({ ...prev, [platform]: 'publishing' }));
    try {
      const res = await fetch('/api/blog/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, title: blogTitle.trim(), content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '발행 실패');
      setPublishStates(prev => ({ ...prev, [platform]: 'done' }));
      setPublishResults(prev => ({ ...prev, [platform]: { link: data.link || data.postUrl } }));
    } catch (err: unknown) {
      setPublishStates(prev => ({ ...prev, [platform]: 'error' }));
      setPublishResults(prev => ({ ...prev, [platform]: { error: err instanceof Error ? err.message : '발행 실패' } }));
    } finally {
      setPublishingPlatform(null);
    }
  }

  const sourceContent = useManual ? manualContent : selectedScript?.content ?? '';

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6 mt-4">
        <span className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0" style={{ background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.22)', color: '#4f8ef7' }}>
          <Repeat2 size={13} strokeWidth={1.8} />
        </span>
        <span className="text-[19px] font-semibold text-white" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>멀티채널 배포</span>
      </div>

      {/* 대본 연동 배너 */}
      {fromScript && (
        <div className="mb-5 rounded-xl border border-[#4f8ef7]/20 bg-[#4f8ef7]/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <FileText size={14} className="text-[#4f8ef7] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-[#4f8ef7] mb-0.5">대본에서 불러옴</p>
                <p className="text-[11px] font-mono text-white/40 truncate">{fromScriptTitle || '대본 내용 로드됨'}</p>
              </div>
            </div>
            <button onClick={clearScript} className="text-white/25 hover:text-white/50 transition-colors shrink-0">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">
        {/* ─── 좌측: 소스 + 설정 ─── */}
        <div className="space-y-4">
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-4">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">소스 대본</p>

            {!fromScript && (
              <div className="flex gap-1 p-0.5 bg-white/5 rounded-lg">
                {(['library', 'manual'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setUseManual(tab === 'manual')}
                    className={`flex-1 py-1.5 rounded-md text-[11px] font-mono font-bold transition-colors ${
                      (tab === 'manual') === useManual ? 'bg-white/10 text-white' : 'text-white/30'
                    }`}
                  >
                    {tab === 'library' ? '내 대본' : '직접 입력'}
                  </button>
                ))}
              </div>
            )}

            {useManual ? (
              <textarea
                value={manualContent}
                onChange={e => setManualContent(e.target.value)}
                placeholder="변환할 대본 내용을 붙여넣으세요..."
                rows={fromScript ? 5 : 8}
                className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-3 py-2 text-[12px] text-white/70 font-mono outline-none resize-none focus:border-[#4f8ef7]/30 placeholder-white/20"
              />
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {loadingScripts ? (
                  <div className="text-[12px] text-white/20 font-mono py-4 text-center">불러오는 중...</div>
                ) : scripts.length === 0 ? (
                  <div className="text-[12px] text-white/20 font-mono py-4 text-center">저장된 대본이 없습니다</div>
                ) : scripts.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedScript(s); setBlogTitle(s.title || ''); }}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${
                      selectedScript?.id === s.id
                        ? 'border-[#4f8ef7]/40 bg-[#4f8ef7]/8 text-white'
                        : 'border-white/6 text-white/50 hover:text-white/70 hover:border-white/12'
                    }`}
                  >
                    <p className="text-[12px] font-bold truncate">{s.title || '제목 없음'}</p>
                    <p className="text-[10px] text-white/25 mt-0.5">{s.content.length.toLocaleString()}자</p>
                  </button>
                ))}
              </div>
            )}

            {sourceContent && !fromScript && (
              <div className="bg-white/[0.02] border border-white/6 rounded-lg px-3 py-2">
                <p className="text-[10px] text-white/30 mb-1">미리보기</p>
                <p className="text-[11px] text-white/50 font-mono leading-relaxed line-clamp-3">{sourceContent.slice(0, 150)}...</p>
              </div>
            )}
          </div>

          {/* 채널 선택 */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-3">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">배포 채널 선택</p>
            <div className="space-y-1.5">
              {(Object.entries(FORMAT_META) as [FormatKey, typeof FORMAT_META[FormatKey]][]).map(([key, meta]) => (
                <button
                  key={key}
                  onClick={() => toggleFormat(key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                    selectedFormats.has(key) ? 'border-white/20 bg-white/8' : 'border-white/6 hover:border-white/12 bg-white/[0.01]'
                  }`}
                >
                  <div className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-black text-white shrink-0" style={{ backgroundColor: meta.color }}>
                    {meta.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[12px] font-bold ${selectedFormats.has(key) ? 'text-white' : 'text-white/50'}`}>{meta.label}</p>
                    <p className="text-[10px] text-white/25">{meta.desc}</p>
                  </div>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    selectedFormats.has(key) ? 'border-[#4f8ef7] bg-[#4f8ef7]' : 'border-white/20'
                  }`}>
                    {selectedFormats.has(key) && <Check size={9} className="text-black" />}
                  </div>
                </button>
              ))}
            </div>

            {error && <p className="text-red-400/80 text-[12px] font-mono">{error}</p>}

            <button
              onClick={handleConvert}
              disabled={converting || !sourceContent.trim()}
              className="w-full flex items-center justify-center gap-2 bg-[#4f8ef7] hover:bg-[#0284c7] disabled:opacity-40 text-black font-black text-[13px] uppercase py-2.5 rounded-lg transition-colors"
            >
              {converting ? (
                <><Loader2 size={14} className="animate-spin" />변환 중 ({selectedFormats.size}개)...</>
              ) : (
                <><Repeat2 size={14} />{selectedFormats.size}개 채널로 변환</>
              )}
            </button>
          </div>
        </div>

        {/* ─── 우측: 결과 + 발행 ─── */}
        <div className="space-y-3">
          {converting && (
            <div className="rounded-xl border border-white/8 bg-white/[0.02] flex items-center justify-center py-16 gap-3">
              <Loader2 size={18} className="animate-spin text-[#4f8ef7]/60" />
              <p className="text-[13px] text-white/40 font-mono">AI가 {selectedFormats.size}개 채널 형식으로 변환 중...</p>
            </div>
          )}

          {!converting && Object.keys(results).length === 0 && (
            <div className="rounded-xl border border-white/6 bg-white/[0.01] flex flex-col items-center justify-center py-16 gap-4">
              <div className="flex gap-2">
                {(['✕', 'in', '◈', '♪'] as const).map((icon, i) => (
                  <div key={i} className="w-9 h-9 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-white/20 text-[13px] font-bold">{icon}</div>
                ))}
              </div>
              <p className="text-[12px] text-white/20 font-mono">
                {fromScript ? '변환 버튼을 눌러 채널별 콘텐츠를 생성하세요' : '대본을 선택하고 변환 버튼을 누르세요'}
              </p>
            </div>
          )}

          {!converting && Object.keys(results).length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-mono text-white/30">{Object.keys(results).length}개 채널 변환 완료</p>
                <p className="text-[10px] text-white/20">각 채널별 발행 버튼을 눌러 배포하세요</p>
              </div>

              {(Object.entries(results) as [FormatKey, string][]).map(([key, text]) => {
                const meta = FORMAT_META[key];
                const isExpanded = expandedKey === key;
                const isBlog = meta.publishType === 'blog';

                return (
                  <div key={key} className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
                    {/* 헤더 */}
                    <div
                      className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
                      onClick={() => setExpandedKey(isExpanded ? null : key)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-black text-white shrink-0" style={{ backgroundColor: meta.color }}>
                          {meta.icon}
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-white">{meta.label}</p>
                          <p className="text-[10px] text-white/25">{text.length.toLocaleString()}자</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        {/* 복사 버튼 */}
                        <button
                          onClick={() => handleCopy(key, text)}
                          className="flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 border border-white/15 hover:border-white/30 text-white/50 hover:text-white/80 rounded-md transition-colors"
                        >
                          {copiedKey === key ? <Check size={11} /> : <Copy size={11} />}
                          {copiedKey === key ? '복사됨' : '복사'}
                        </button>

                        {/* 발행 버튼 */}
                        {isBlog ? (
                          <button
                            onClick={() => setShowBlogPublish(prev => !prev || expandedKey !== key)}
                            className="flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 border border-[#a855f7]/40 bg-[#a855f7]/10 hover:bg-[#a855f7]/20 text-[#a855f7]/80 hover:text-[#a855f7] rounded-md transition-colors"
                          >
                            <Send size={11} />발행
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSocialPublish(key, text)}
                            className="flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 border border-white/15 hover:border-white/30 text-white/50 hover:text-white/80 rounded-md transition-colors"
                            title={meta.socialHint}
                          >
                            <ExternalLink size={11} />복사+열기
                          </button>
                        )}

                        {isExpanded ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
                      </div>
                    </div>

                    {/* 블로그 발행 패널 */}
                    {isBlog && isExpanded && showBlogPublish && (
                      <div className="border-t border-[#a855f7]/15 bg-[#a855f7]/5 px-4 py-3 space-y-3">
                        <p className="text-[11px] font-bold text-[#a855f7]/70 uppercase tracking-widest">블로그 직접 발행</p>
                        <div>
                          <p className="text-[10px] text-white/30 mb-1">발행 제목</p>
                          <input
                            type="text"
                            value={blogTitle}
                            onChange={e => setBlogTitle(e.target.value)}
                            placeholder="블로그 포스트 제목"
                            className="w-full bg-white/[0.04] border border-white/10 focus:border-[#a855f7]/40 rounded-lg px-3 py-2 text-[12px] text-white/80 placeholder-white/20 outline-none transition-colors"
                          />
                        </div>
                        <div className="space-y-1.5">
                          {BLOG_PLATFORMS.map(p => {
                            const state = publishStates[p.key];
                            const result = publishResults[p.key];
                            return (
                              <div key={p.key} className="flex items-center gap-2">
                                <button
                                  onClick={() => handleBlogPublish(p.key)}
                                  disabled={!!publishingPlatform || !blogTitle.trim() || state === 'done'}
                                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-[12px] font-bold transition-all ${
                                    state === 'done'
                                      ? 'border-[#4f8ef7]/40 bg-[#4f8ef7]/10 text-[#4f8ef7]'
                                      : state === 'error'
                                      ? 'border-red-500/40 bg-red-500/10 text-red-400'
                                      : 'border-white/15 hover:border-[#a855f7]/40 hover:bg-[#a855f7]/10 text-white/60 hover:text-white/90'
                                  } disabled:opacity-40`}
                                >
                                  {state === 'publishing' && publishingPlatform === p.key ? (
                                    <><Loader2 size={12} className="animate-spin" />발행 중...</>
                                  ) : state === 'done' ? (
                                    <><Check size={12} />발행 완료</>
                                  ) : (
                                    <><Send size={12} />{p.label}에 발행</>
                                  )}
                                </button>
                                {result?.link && (
                                  <a href={result.link} target="_blank" rel="noopener noreferrer"
                                    className="text-[11px] font-mono text-[#4f8ef7]/60 hover:text-[#4f8ef7] transition-colors flex items-center gap-1"
                                  >
                                    <ExternalLink size={11} />보기
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {Object.values(publishResults).some(r => r?.error) && (
                          <p className="text-[11px] font-mono text-red-400/70">
                            {Object.values(publishResults).find(r => r?.error)?.error}
                          </p>
                        )}
                        <p className="text-[10px] text-white/20">
                          * 설정 페이지에서 블로그 계정 연결 필요
                        </p>
                      </div>
                    )}

                    {/* 소셜 힌트 */}
                    {!isBlog && isExpanded && (
                      <div className="border-t border-white/5 px-4 py-2 bg-white/[0.01]">
                        <p className="text-[10px] text-white/20">
                          💡 {meta.socialHint} — "복사+열기" 버튼으로 클립보드 복사 후 해당 플랫폼이 열립니다
                        </p>
                      </div>
                    )}

                    {/* 본문 */}
                    {isExpanded && (
                      <div className="border-t border-white/6 px-4 py-3 max-h-80 overflow-y-auto">
                        <pre className="text-[12px] text-white/70 font-mono leading-relaxed whitespace-pre-wrap">{text}</pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
