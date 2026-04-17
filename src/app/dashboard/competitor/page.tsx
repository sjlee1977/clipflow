'use client';

import { useState } from 'react';
import { Search, Copy, Check, PenLine, Clock, Eye, ThumbsUp, MessageSquare, Sparkles, Link2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface TranscriptItem { start: number; duration: number; text: string }
interface VideoData {
  videoId: string; title: string; channelName: string; channelId: string;
  publishedAt: string; thumbnail: string; viewCount: number; likeCount: number;
  commentCount: number; duration: string; transcript: string;
  transcriptItems: TranscriptItem[]; hasTranscript: boolean;
}
interface Analysis {
  topic?: string; angle?: string; hookStyle?: string;
  differentiation?: string; videoLength?: string;
}

const AI_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { id: 'qwen-max', label: 'Qwen Max' },
  { id: 'qwen-plus', label: 'Qwen Plus' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
];

const CATEGORIES = [
  { id: 'auto', label: '자동 감지' }, { id: 'general', label: '일반' },
  { id: 'economy', label: '경제/주식' }, { id: 'history', label: '역사' },
  { id: 'psychology', label: '심리학' }, { id: 'health', label: '건강' },
  { id: 'horror', label: '공포' },
];

function fmt(secs: number) {
  const m = Math.floor(secs / 60), s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
function fmtN(n: number) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}천`;
  return n.toLocaleString();
}

export default function CompetitorPage() {
  const router = useRouter();
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<VideoData | null>(null);
  const [showTs, setShowTs] = useState(false);
  const [copied, setCopied] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [aiModel, setAiModel] = useState('gemini-2.5-flash');
  const [category, setCategory] = useState('auto');

  async function handleExtract() {
    if (!urlInput.trim()) return;
    setLoading(true); setError(null); setVideo(null); setAnalysis(null); setAiError(null);
    try {
      const res = await fetch('/api/competitor/transcript', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '추출 실패');
      setVideo(data);
    } catch (e) { setError((e as Error).message); }
    setLoading(false);
  }

  async function handleAnalyze() {
    if (!urlInput.trim()) return;
    setAnalyzing(true); setAiError(null);
    try {
      const res = await fetch('/api/analyze-youtube', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim(), category, modelId: aiModel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '분석 실패');
      setAnalysis(data);
    } catch (e) { setAiError((e as Error).message); }
    setAnalyzing(false);
  }

  async function copyTranscript() {
    if (!video?.transcript) return;
    await navigator.clipboard.writeText(video.transcript);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  const selectStyle = {
    background: 'var(--sidebar)', border: '1px solid var(--border)',
    color: 'var(--text)', outline: 'none', borderRadius: '8px',
    padding: '6px 10px', fontSize: '12px',
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <span className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0"
          style={{ background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.22)', color: '#4f8ef7' }}>
          <Search size={13} strokeWidth={1.8} />
        </span>
        <div>
          <h1 className="text-[19px] font-semibold text-white">경쟁 영상 분석</h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
            API 키 없이 자막 추출 · AI로 핵심 구조 분석
          </p>
        </div>
      </div>

      {/* 입력 영역 */}
      <div className="space-y-2.5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
            <input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && handleExtract()}
              placeholder="YouTube URL 또는 영상 ID를 입력하세요"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[13px]"
              style={{ background: 'var(--sidebar)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(79,142,247,0.5)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>
          <button
            onClick={handleExtract} disabled={loading || !urlInput.trim()}
            className="px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all shrink-0"
            style={{
              background: 'rgba(79,142,247,0.12)', border: '1px solid rgba(79,142,247,0.3)',
              color: loading || !urlInput.trim() ? 'rgba(79,142,247,0.35)' : '#4f8ef7',
            }}
          >
            {loading ? '추출 중...' : '자막 추출'}
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select value={aiModel} onChange={e => setAiModel(e.target.value)} style={selectStyle}>
            {AI_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <select value={category} onChange={e => setCategory(e.target.value)} style={selectStyle}>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <button
            onClick={handleAnalyze} disabled={analyzing || !urlInput.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
            style={{
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
              color: analyzing || !urlInput.trim() ? 'rgba(74,222,128,0.3)' : '#4ade80',
            }}
          >
            <Sparkles size={11} />{analyzing ? 'AI 분석 중...' : 'AI 분석'}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-[13px]"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
          {error}
        </div>
      )}

      {/* 결과: 2컬럼 */}
      {video && (
        <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 360px' }}>

          {/* 트랜스크립트 패널 */}
          <div className="rounded-xl overflow-hidden flex flex-col" style={{ border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-4 py-2.5 shrink-0"
              style={{ background: 'var(--sidebar)', borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>트랜스크립트</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded"
                  style={video.hasTranscript
                    ? { background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }
                    : { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {video.hasTranscript ? `${video.transcriptItems.length}개` : '자막 없음'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {/* 타임스탬프 토글 */}
                <label className="flex items-center gap-1.5 text-[10px] cursor-pointer select-none"
                  style={{ color: 'var(--text-faint)' }}>
                  <div
                    className="relative w-7 h-4 rounded-full transition-colors cursor-pointer"
                    style={{ background: showTs ? 'rgba(79,142,247,0.4)' : 'rgba(255,255,255,0.1)' }}
                    onClick={() => setShowTs(!showTs)}
                  >
                    <div className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
                      style={{ left: showTs ? '14px' : '2px', background: showTs ? '#4f8ef7' : 'rgba(255,255,255,0.4)' }} />
                  </div>
                  타임스탬프
                </label>
                <button onClick={copyTranscript} disabled={!video.hasTranscript}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all"
                  style={{
                    background: copied ? 'rgba(34,197,94,0.1)' : 'rgba(79,142,247,0.08)',
                    border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(79,142,247,0.2)'}`,
                    color: copied ? '#4ade80' : '#4f8ef7',
                  }}>
                  {copied ? <><Check size={10} />복사됨</> : <><Copy size={10} />복사</>}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3" style={{ background: 'var(--bg)', maxHeight: '520px' }}>
              {!video.hasTranscript ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <p className="text-2xl">📄</p>
                  <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>자막이 없는 영상입니다</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>AI 분석으로 제목·설명을 기반으로 분석할 수 있습니다</p>
                </div>
              ) : showTs ? (
                <div className="space-y-0.5">
                  {video.transcriptItems.map((item, i) => (
                    <div key={i} className="flex gap-3 py-1 px-2 rounded-lg hover:bg-white/5 transition-colors group">
                      <a href={`https://www.youtube.com/watch?v=${video.videoId}&t=${Math.floor(item.start)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-[10px] shrink-0 mt-0.5 font-mono hover:underline"
                        style={{ color: '#4f8ef7', minWidth: '36px' }}>
                        {fmt(item.start)}
                      </a>
                      <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text)' }}>{item.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] leading-[1.9] whitespace-pre-wrap" style={{ color: 'var(--text)' }}>
                  {video.transcript}
                </p>
              )}
            </div>
          </div>

          {/* 오른쪽: 영상 정보 + AI 분석 */}
          <div className="space-y-4">
            {/* 영상 카드 */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <img src={video.thumbnail} alt={video.title} className="w-full aspect-video object-cover" />
              <div className="p-4 space-y-3" style={{ background: 'var(--sidebar)' }}>
                <p className="text-[13px] font-semibold leading-snug line-clamp-2" style={{ color: 'var(--text)' }}>
                  {video.title || '제목 없음'}
                </p>
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{video.channelName}</p>
                <div className="flex items-center gap-3 flex-wrap">
                  {video.viewCount > 0 && (
                    <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-faint)' }}>
                      <Eye size={11} />조회 {fmtN(video.viewCount)}
                    </span>
                  )}
                  {video.likeCount > 0 && (
                    <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-faint)' }}>
                      <ThumbsUp size={11} />{fmtN(video.likeCount)}
                    </span>
                  )}
                  {video.commentCount > 0 && (
                    <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-faint)' }}>
                      <MessageSquare size={11} />{fmtN(video.commentCount)}
                    </span>
                  )}
                  {video.duration && (
                    <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-faint)' }}>
                      <Clock size={11} />{video.duration}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => router.push(`/dashboard/script?topic=${encodeURIComponent(video.title)}`)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[12px] font-medium transition-all"
                  style={{ background: 'transparent', border: '1px solid rgba(79,142,247,0.25)', color: '#4f8ef7' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(79,142,247,0.1)'; e.currentTarget.style.borderColor = 'rgba(79,142,247,0.5)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(79,142,247,0.25)'; }}
                >
                  <PenLine size={12} />이 영상으로 대본 만들기
                </button>
              </div>
            </div>

            {/* AI 에러 */}
            {aiError && (
              <div className="px-4 py-3 rounded-xl text-[12px]"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                {aiError}
              </div>
            )}

            {/* AI 분석 로딩 */}
            {analyzing && (
              <div className="rounded-xl px-4 py-8 flex flex-col items-center gap-3"
                style={{ border: '1px solid rgba(79,142,247,0.2)', background: 'rgba(79,142,247,0.03)' }}>
                <div className="w-5 h-5 rounded-full border-2 animate-spin"
                  style={{ borderColor: 'rgba(79,142,247,0.2)', borderTopColor: '#4f8ef7' }} />
                <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>AI가 영상 구조를 분석하고 있습니다...</p>
              </div>
            )}

            {/* AI 분석 결과 */}
            {analysis && !analyzing && (
              <div className="rounded-xl overflow-hidden"
                style={{ border: '1px solid rgba(79,142,247,0.15)', background: 'linear-gradient(180deg, rgba(79,142,247,0.04) 0%, transparent 100%)' }}>
                <div className="px-4 py-2.5" style={{ borderBottom: '1px solid rgba(79,142,247,0.1)' }}>
                  <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--text-faint)' }}>
                    AI 분석 결과
                  </p>
                </div>
                <div className="px-4 py-3 space-y-3">
                  {[
                    { key: 'topic', label: '제목 각도' },
                    { key: 'angle', label: '핵심 인사이트' },
                    { key: 'hookStyle', label: '훅 스타일' },
                    { key: 'differentiation', label: '차별화 포인트' },
                    { key: 'videoLength', label: '영상 길이 추정' },
                  ].map(({ key, label }) => {
                    const val = analysis[key as keyof Analysis];
                    if (!val) return null;
                    return (
                      <div key={key}>
                        <p className="text-[10px] font-semibold mb-1" style={{ color: 'var(--text-ultra)' }}>{label}</p>
                        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text)' }}>{val}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 빈 상태 */}
      {!video && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-24 rounded-xl gap-4"
          style={{ border: '1px dashed var(--border)' }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.18)' }}>
            <Search size={20} style={{ color: '#4f8ef7', opacity: 0.6 }} />
          </div>
          <div className="text-center">
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>경쟁 영상 URL을 입력하세요</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-faint)' }}>
              자막을 자동 추출하고 AI로 핵심 구조를 분석합니다
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
