'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { Repeat2, Loader2, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

type Script = { id: string; title: string; content: string; created_at: string };
type FormatKey = 'twitter' | 'linkedin' | 'instagram' | 'tiktok' | 'blog_summary';

const FORMAT_META: Record<FormatKey, { label: string; icon: string; color: string; desc: string }> = {
  twitter:      { label: 'Twitter / X', icon: '✕', color: '#1DA1F2', desc: '스레드 5~8개 트윗' },
  linkedin:     { label: 'LinkedIn',    icon: 'in', color: '#0A66C2', desc: '전문적 포스트 1000~1500자' },
  instagram:    { label: 'Instagram',   icon: '◈', color: '#E1306C', desc: '캡션 + 해시태그 30개' },
  tiktok:       { label: 'TikTok / 쇼츠', icon: '♪', color: '#FF0050', desc: '60초 쇼츠 대본' },
  blog_summary: { label: '블로그 도입부', icon: '✎', color: '#a855f7', desc: 'SEO 소개글 + 목차' },
};

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

  useEffect(() => {
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

  async function handleConvert() {
    const content = useManual ? manualContent : selectedScript?.content;
    if (!content?.trim()) return;
    setConverting(true);
    setError('');
    setResults({});
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

  const sourceContent = useManual ? manualContent : selectedScript?.content ?? '';

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <span className="w-1 h-7 bg-[#22c55e]" />
        <div>
          <h1 className="text-[18px] font-black tracking-tight text-white uppercase">멀티포맷 변환</h1>
          <p className="text-[11px] text-white/30 font-mono tracking-widest mt-0.5">ONE SOURCE → MULTI CHANNEL</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">
        {/* ─── 좌측: 소스 + 설정 ─── */}
        <div className="space-y-4">
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-4">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">소스 대본</p>

            {/* 탭 */}
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

            {useManual ? (
              <textarea
                value={manualContent}
                onChange={e => setManualContent(e.target.value)}
                placeholder="변환할 대본 내용을 붙여넣으세요..."
                rows={8}
                className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-3 py-2 text-[12px] text-white/70 font-mono outline-none resize-none focus:border-[#22c55e]/30 placeholder-white/20"
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
                    onClick={() => setSelectedScript(s)}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${
                      selectedScript?.id === s.id
                        ? 'border-[#22c55e]/40 bg-[#22c55e]/8 text-white'
                        : 'border-white/6 text-white/50 hover:text-white/70 hover:border-white/12'
                    }`}
                  >
                    <p className="text-[12px] font-bold truncate">{s.title || '제목 없음'}</p>
                    <p className="text-[10px] font-mono text-white/25 mt-0.5">{s.content.length.toLocaleString()}자</p>
                  </button>
                ))}
              </div>
            )}

            {sourceContent && (
              <div className="bg-white/[0.02] border border-white/6 rounded-lg px-3 py-2">
                <p className="text-[10px] font-mono text-white/30 mb-1">미리보기</p>
                <p className="text-[11px] text-white/50 font-mono leading-relaxed line-clamp-3">{sourceContent.slice(0, 150)}...</p>
              </div>
            )}
          </div>

          {/* 포맷 선택 */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-3">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">변환 채널</p>
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
                    <p className="text-[10px] font-mono text-white/25">{meta.desc}</p>
                  </div>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    selectedFormats.has(key) ? 'border-[#22c55e] bg-[#22c55e]' : 'border-white/20'
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
              className="w-full flex items-center justify-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-40 text-black font-black text-[13px] uppercase py-2.5 rounded-lg transition-colors"
            >
              {converting ? (
                <><Loader2 size={14} className="animate-spin" />변환 중 ({selectedFormats.size}개)...</>
              ) : (
                <><Repeat2 size={14} />{selectedFormats.size}개 채널로 변환</>
              )}
            </button>
          </div>
        </div>

        {/* ─── 우측: 결과 ─── */}
        <div className="space-y-3">
          {converting && (
            <div className="rounded-xl border border-white/8 bg-white/[0.02] flex items-center justify-center py-16 gap-3">
              <Loader2 size={18} className="animate-spin text-[#22c55e]/60" />
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
              <p className="text-[12px] text-white/20 font-mono">대본을 선택하고 변환 버튼을 누르세요</p>
            </div>
          )}

          {!converting && Object.keys(results).length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <p className="text-[11px] font-mono text-white/30">{Object.keys(results).length}개 채널 변환 완료</p>
              </div>
              {(Object.entries(results) as [FormatKey, string][]).map(([key, text]) => {
                const meta = FORMAT_META[key];
                const isExpanded = expandedKey === key;
                return (
                  <div key={key} className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
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
                          <p className="text-[10px] font-mono text-white/25">{text.length.toLocaleString()}자</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={e => { e.stopPropagation(); handleCopy(key, text); }}
                          className="flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 border border-white/15 hover:border-white/30 text-white/50 hover:text-white/80 rounded-md transition-colors"
                        >
                          {copiedKey === key ? <Check size={11} /> : <Copy size={11} />}
                          {copiedKey === key ? '복사됨' : '복사'}
                        </button>
                        {isExpanded ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
                      </div>
                    </div>
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
