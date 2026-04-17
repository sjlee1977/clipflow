'use client';

import { useState } from 'react';
import { MessageSquare, Sparkles, Link2, PenLine, Users, Lightbulb, AlertCircle, HelpCircle, Megaphone } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Analysis {
  sentiment: { positive: number; neutral: number; negative: number };
  topThemes: { theme: string; count: number; summary: string }[];
  audienceQuestions: string[];
  contentRequests: string[];
  painPoints: string[];
  audienceProfile: string;
  scriptIdeas: string[];
}
interface Result { videoId: string; videoTitle: string; totalComments: number; analysis: Analysis }

const AI_MODELS = [
  { id: 'qwen-max', label: 'Qwen Max' },
  { id: 'qwen-plus', label: 'Qwen Plus' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
];

const MAX_OPTIONS = [50, 100, 200];

export default function CommentsPage() {
  const router = useRouter();
  const [urlInput, setUrlInput] = useState('');
  const [aiModel, setAiModel] = useState('qwen-max');
  const [maxComments, setMaxComments] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function handleAnalyze() {
    if (!urlInput.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch('/api/trends/comments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim(), modelId: aiModel, maxComments }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '분석 실패');
      setResult(data);
    } catch (e) { setError((e as Error).message); }
    setLoading(false);
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
          <MessageSquare size={13} strokeWidth={1.8} />
        </span>
        <div>
          <h1 className="text-[19px] font-semibold text-white">댓글 AI 분석</h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
            시청자 댓글에서 니즈·질문·콘텐츠 아이디어 발굴
          </p>
        </div>
      </div>

      {/* 입력 */}
      <div className="space-y-2.5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
            <input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && handleAnalyze()}
              placeholder="분석할 YouTube URL 또는 영상 ID"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[13px]"
              style={{ background: 'var(--sidebar)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(79,142,247,0.5)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>
          <button
            onClick={handleAnalyze} disabled={loading || !urlInput.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all shrink-0"
            style={{
              background: loading ? 'rgba(79,142,247,0.06)' : 'rgba(79,142,247,0.12)',
              border: '1px solid rgba(79,142,247,0.3)',
              color: loading || !urlInput.trim() ? 'rgba(79,142,247,0.35)' : '#4f8ef7',
            }}
          >
            <Sparkles size={13} />{loading ? '분석 중...' : 'AI 분석'}
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={aiModel} onChange={e => setAiModel(e.target.value)} style={selectStyle}>
            {AI_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <div className="flex items-center gap-0.5 p-1 rounded-lg" style={{ background: 'var(--hover-bg)' }}>
            {MAX_OPTIONS.map(n => (
              <button key={n} onClick={() => setMaxComments(n)}
                className="px-3 py-1 rounded-md text-[11px] font-medium transition-all"
                style={maxComments === n
                  ? { background: 'var(--sidebar)', color: '#4f8ef7', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }
                  : { color: 'var(--text-faint)' }}>
                {n}개
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-[13px]"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
          {error}
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="rounded-xl py-16 flex flex-col items-center gap-4"
          style={{ border: '1px solid rgba(79,142,247,0.2)', background: 'rgba(79,142,247,0.03)' }}>
          <div className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: 'rgba(79,142,247,0.2)', borderTopColor: '#4f8ef7' }} />
          <div className="text-center">
            <p className="text-[13px] font-medium" style={{ color: '#4f8ef7' }}>댓글 수집 및 AI 분석 중</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-faint)' }}>최대 {maxComments}개 댓글을 분석합니다. 잠시만 기다려주세요.</p>
          </div>
        </div>
      )}

      {/* 결과 */}
      {result && !loading && (
        <div className="space-y-5">
          {/* 영상 정보 + 감성 분석 바 */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <div className="px-5 py-4 space-y-3" style={{ background: 'var(--sidebar)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold line-clamp-1" style={{ color: 'var(--text)' }}>
                    {result.videoTitle || '영상 제목'}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
                    총 {result.totalComments}개 댓글 분석
                  </p>
                </div>
                <a href={`https://www.youtube.com/watch?v=${result.videoId}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-[11px] px-2.5 py-1 rounded-lg transition-all"
                  style={{ border: '1px solid var(--border)', color: 'var(--text-faint)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#4f8ef7')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}
                >
                  YouTube에서 보기 ↗
                </a>
              </div>

              {/* 감성 바 */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-faint)' }}>
                  <span>감성 분포</span>
                  <span style={{ color: '#4ade80' }}>긍정 {result.analysis.sentiment.positive}%</span>
                  <span style={{ color: 'var(--text-ultra)' }}>중립 {result.analysis.sentiment.neutral}%</span>
                  <span style={{ color: '#ef4444' }}>부정 {result.analysis.sentiment.negative}%</span>
                </div>
                <div className="flex rounded-full overflow-hidden h-2">
                  <div style={{ width: `${result.analysis.sentiment.positive}%`, background: '#4ade80' }} />
                  <div style={{ width: `${result.analysis.sentiment.neutral}%`, background: 'rgba(255,255,255,0.15)' }} />
                  <div style={{ width: `${result.analysis.sentiment.negative}%`, background: '#ef4444' }} />
                </div>
              </div>
            </div>
          </div>

          {/* 인사이트 카드 그리드 */}
          <div className="grid grid-cols-2 gap-4">

            {/* 주요 주제 */}
            <div className="rounded-xl overflow-hidden col-span-2"
              style={{ border: '1px solid var(--border)', background: 'var(--sidebar)' }}>
              <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <Megaphone size={13} style={{ color: '#4f8ef7' }} />
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>주요 주제</p>
              </div>
              <div className="px-4 py-3">
                {result.analysis.topThemes.length === 0 ? (
                  <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>추출된 주제가 없습니다</p>
                ) : (
                  <div className="space-y-2.5">
                    {result.analysis.topThemes.map((t, i) => {
                      const maxCount = Math.max(...result.analysis.topThemes.map(x => x.count));
                      const pct = maxCount > 0 ? (t.count / maxCount) * 100 : 0;
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] font-medium" style={{ color: 'var(--text)' }}>{t.theme}</span>
                            <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>~{t.count}회</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(79,142,247,0.1)' }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #4f8ef7, #4ade80)' }} />
                          </div>
                          <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>{t.summary}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 시청자 질문 */}
            <InsightCard icon={<HelpCircle size={13} style={{ color: '#f59e0b' }} />}
              title="시청자 질문" color="#f59e0b"
              items={result.analysis.audienceQuestions} />

            {/* 콘텐츠 요청 */}
            <InsightCard icon={<Lightbulb size={13} style={{ color: '#4ade80' }} />}
              title="콘텐츠 요청" color="#4ade80"
              items={result.analysis.contentRequests} />

            {/* 시청자 프로필 */}
            <div className="rounded-xl overflow-hidden"
              style={{ border: '1px solid var(--border)', background: 'var(--sidebar)' }}>
              <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <Users size={13} style={{ color: '#c084fc' }} />
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>시청자 프로필</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text)' }}>
                  {result.analysis.audienceProfile}
                </p>
              </div>
            </div>

            {/* 불만/개선 */}
            {result.analysis.painPoints.length > 0 && (
              <InsightCard icon={<AlertCircle size={13} style={{ color: '#ef4444' }} />}
                title="불만 · 개선 요청" color="#ef4444"
                items={result.analysis.painPoints} />
            )}

            {/* 대본 아이디어 */}
            <div className={`rounded-xl overflow-hidden ${result.analysis.painPoints.length > 0 ? 'col-span-2' : ''}`}
              style={{ border: '1px solid rgba(79,142,247,0.2)', background: 'linear-gradient(180deg, rgba(79,142,247,0.04) 0%, transparent 100%)' }}>
              <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(79,142,247,0.1)' }}>
                <div className="flex items-center gap-2">
                  <Sparkles size={13} style={{ color: '#4f8ef7' }} />
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>댓글 기반 대본 아이디어</p>
                </div>
              </div>
              <div className="px-4 py-3 space-y-2">
                {result.analysis.scriptIdeas.map((idea, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-[10px] font-bold shrink-0 mt-0.5 w-5 h-5 rounded flex items-center justify-center"
                      style={{ background: 'rgba(79,142,247,0.15)', color: '#4f8ef7' }}>
                      {i + 1}
                    </span>
                    <div className="flex-1 flex items-center justify-between gap-3">
                      <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text)' }}>{idea}</p>
                      <button
                        onClick={() => router.push(`/dashboard/script?topic=${encodeURIComponent(idea)}`)}
                        className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] transition-all"
                        style={{ background: 'transparent', border: '1px solid rgba(79,142,247,0.25)', color: '#4f8ef7' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(79,142,247,0.1)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <PenLine size={11} />대본
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 빈 상태 */}
      {!result && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-24 rounded-xl gap-4"
          style={{ border: '1px dashed var(--border)' }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.18)' }}>
            <MessageSquare size={20} style={{ color: '#4f8ef7', opacity: 0.6 }} />
          </div>
          <div className="text-center">
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>YouTube URL을 입력하세요</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-faint)' }}>
              댓글에서 시청자 니즈·질문·콘텐츠 아이디어를 발굴합니다
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function InsightCard({ icon, title, color, items }: {
  icon: React.ReactNode; title: string; color: string; items: string[];
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--sidebar)' }}>
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        {icon}
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{title}</p>
      </div>
      <div className="px-4 py-3 space-y-2">
        {items.length === 0 ? (
          <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>해당 항목 없음</p>
        ) : items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: color }} />
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text)' }}>{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
