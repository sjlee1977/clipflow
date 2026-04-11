'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

type Script = {
  id: string;
  title: string;
  content: string;
  created_at: string;
};

type SortKey = 'latest' | 'oldest' | 'longest' | 'shortest';

// 대본 첫 문장 추출 (프롬프트 제거)
function extractFirstSentence(content: string): string {
  const clean = content.replace(/^(아래|다음|위의|요청서를|요청에|바탕으로|참고하여|작성해줘|작성해|써줘)[^\n]*/gm, '').trim();
  const first = clean.split(/[.!?。\n]/)[0]?.trim() || content.slice(0, 60);
  return first.length > 80 ? first.slice(0, 80) + '…' : first;
}

// 예상 영상 시간 (한국어 ~300자/분)
function estimateTime(chars: number): string {
  const secs = Math.round((chars / 300) * 60);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}초`;
  return `${m}분 ${s > 0 ? s + '초' : ''}`.trim();
}

// 길이에 따른 컬러 테마
function getLengthTheme(len: number) {
  if (len >= 2000) return { bar: 'bg-white/20', badge: 'text-white/50 bg-white/5 border-white/10', label: '긴 영상' };
  if (len >= 800) return { bar: 'bg-white/10', badge: 'text-white/40 bg-white/5 border-white/10', label: '중간' };
  return { bar: 'bg-white/8', badge: 'text-white/35 bg-white/5 border-white/10', label: '짧은 영상' };
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000);
  if (days > 0) return `${days}일 전`;
  if (hours > 0) return `${hours}시간 전`;
  return `방금 전`;
}

export default function MyScriptsPage() {
  const router = useRouter();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('latest');
  const [search, setSearch] = useState('');

  const handleCopy = (script: Script) => {
    navigator.clipboard.writeText(script.content).then(() => {
      setCopiedId(script.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  useEffect(() => {
    const fetchScripts = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('scripts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) console.error('[MyScripts] Fetch Error:', error);
      else setScripts(data || []);
      setLoading(false);
    };
    fetchScripts();
  }, []);

  const handleUseScript = (script: Script) => {
    sessionStorage.setItem('clipflow_script', script.content);
    router.push('/dashboard/video');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('대본을 삭제하시겠습니까?')) return;
    const supabase = createClient();
    const { error } = await supabase.from('scripts').delete().eq('id', id);
    if (error) alert('삭제 중 오류가 발생했습니다.');
    else setScripts(prev => prev.filter(s => s.id !== id));
  };

  const filtered = scripts
    .filter(s => !search || s.content.includes(search) || s.title?.includes(search))
    .sort((a, b) => {
      if (sort === 'latest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sort === 'longest') return b.content.length - a.content.length;
      return a.content.length - b.content.length;
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 gap-3 text-white/20">
        <span className="w-4 h-4 border border-white/20 border-t-white/60 rounded-full animate-spin" />
        <span className="text-[12px] font-mono tracking-widest uppercase">Loading...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="w-1 h-7 bg-[#22c55e]" />
          <div>
            <h1 className="text-[18px] font-black tracking-tight text-white uppercase">내 대본</h1>
            <p className="text-[11px] text-white/30 font-mono tracking-widest mt-0.5">SCRIPT LIBRARY</p>
          </div>
        </div>
        <button
          onClick={() => router.push('/dashboard/script')}
          className="bg-[#22c55e] hover:bg-[#16a34a] text-black font-black text-[12px] tracking-tight uppercase px-4 py-1.5 rounded-md transition-colors"
        >
          + 새 대본 만들기
        </button>
      </div>

      {/* 검색 + 정렬 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 text-[12px]">⌕</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="대본 검색..."
            className="w-full bg-white/[0.03] border border-white/8 hover:border-white/15 focus:border-[#22c55e]/40 rounded-lg pl-8 pr-3 py-1.5 text-[12px] text-white/70 placeholder-white/20 outline-none transition-colors font-mono"
          />
        </div>
        <div className="flex items-center gap-1 ml-auto">
          {(['latest', 'oldest', 'longest', 'shortest'] as SortKey[]).map(key => {
            const label = { latest: '최신순', oldest: '오래된순', longest: '긴 순', shortest: '짧은 순' }[key];
            return (
              <button
                key={key}
                onClick={() => setSort(key)}
                className={`text-[11px] font-mono px-2.5 py-1 rounded transition-colors ${
                  sort === key ? 'text-white bg-white/10' : 'text-white/30 hover:text-white/60'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 빈 상태 */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-32 gap-5">
          <div className="w-16 h-16 border border-white/8 rounded-2xl flex items-center justify-center">
            <span className="text-2xl text-white/10">✎</span>
          </div>
          <div className="text-center">
            <p className="text-[13px] text-white/30 font-mono">
              {search ? '검색 결과가 없습니다' : '저장된 대본이 없습니다'}
            </p>
            {!search && (
              <button onClick={() => router.push('/dashboard/script')} className="text-[12px] text-[#22c55e]/50 hover:text-[#22c55e] transition-colors mt-1 font-mono">
                새 대본 만들기 →
              </button>
            )}
          </div>
        </div>
      )}

      {/* 카드 그리드 */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((script, i) => {
            const theme = getLengthTheme(script.content.length);
            const firstSentence = extractFirstSentence(script.content);
            const preview = script.content.replace(/\s+/g, ' ').trim();
            const isCopied = copiedId === script.id;

            return (
              <div
                key={script.id}
                className="group relative flex flex-col rounded-xl border border-white/8 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-200 overflow-hidden"
              >
                {/* 상단 컬러 바 */}
                <div className={`h-[3px] w-full ${theme.bar}`} />

                {/* 카드 본문 */}
                <div className="flex flex-col flex-1 p-4">
                  {/* 상단: 뱃지 + 시간 */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${theme.badge}`}>
                        {theme.label}
                      </span>
                      <span className="text-[10px] font-mono text-white/20 border border-white/8 px-1.5 py-0.5 rounded">
                        ~{estimateTime(script.content.length)}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-white/20">{timeAgo(script.created_at)}</span>
                  </div>

                  {/* 핵심 문장 (큰 텍스트) */}
                  <p className="text-[15px] font-bold text-white/90 leading-snug mb-3 line-clamp-3">
                    {firstSentence}
                  </p>

                  {/* 대본 미리보기 */}
                  <p className="text-[11px] text-white/30 font-mono leading-relaxed line-clamp-4 flex-1">
                    {preview.slice(0, 200)}…
                  </p>

                  {/* 하단 정보 + 액션 */}
                  <div className="mt-4 pt-3 border-t border-white/8 flex items-center justify-between gap-2">
                    <span className="text-[12px] font-mono font-bold text-white/60">
                      {script.content.length.toLocaleString()}자
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleCopy(script)}
                        className="text-[11px] font-mono px-2.5 py-1 border border-white/20 hover:border-white/40 text-white/50 hover:text-white/80 rounded-md transition-colors"
                      >
                        {isCopied ? '✓ 복사됨' : '복사'}
                      </button>
                      <button
                        onClick={() => handleDelete(script.id)}
                        className="text-[11px] font-mono px-2.5 py-1 border border-red-500/20 hover:border-red-500/50 text-red-400/60 hover:text-red-400 rounded-md transition-colors"
                      >
                        삭제
                      </button>
                      <button
                        onClick={() => handleUseScript(script)}
                        className="bg-[#22c55e] hover:bg-[#16a34a] text-black font-black text-[11px] tracking-tight uppercase px-3 py-1 rounded-md transition-colors"
                      >
                        영상 제작 →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
