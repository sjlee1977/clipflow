'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

type Script = {
  id: string;
  title: string;
  content: string;
  type: string;
  llm_model: string;
  created_at: string;
};

export default function MyScriptsPage() {
  const router = useRouter();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 6;

  useEffect(() => {
    const fetchScripts = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('scripts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[MyScripts] Fetch Error:', error);
      } else {
        setScripts(data || []);
      }
      setLoading(false);
    };

    fetchScripts();
  }, []);

  const handleUseScript = (script: Script) => {
    sessionStorage.setItem('clipflow_script', script.content);
    router.push('/dashboard');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('대본을 삭제하시겠습니까?')) return;
    
    const supabase = createClient();
    const { error } = await supabase.from('scripts').delete().eq('id', id);
    
    if (error) {
      alert('삭제 중 오류가 발생했습니다.');
    } else {
      setScripts(prev => prev.filter(s => s.id !== id));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-white/20 text-xs font-mono">
        <span className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />
        불러오는 중...
      </div>
    );
  }

  const totalPages = Math.ceil(scripts.length / PAGE_SIZE);
  const paged = scripts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 border border-orange-400/30 bg-[#0a0a0a]">
            <span className="w-1 h-1 bg-orange-400 rounded-full" />
            <span className="text-orange-400 text-[11px] font-mono tracking-widest uppercase">내 대본</span>
          </div>
          <span className="text-[#17BEBB]/70 text-xs tracking-widest uppercase font-mono">총 {scripts.length}개</span>
        </div>
        
        <button
          onClick={() => router.push('/dashboard/script')}
          className="px-4 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-[12px] font-mono transition-colors"
        >
          + 새 대본 만들기
        </button>
      </div>

      {scripts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border border-dashed border-white/5 bg-white/[0.01]">
          <p className="text-white/20 text-[13px] font-mono uppercase tracking-widest">No scripts saved yet</p>
          <button
            onClick={() => router.push('/dashboard/script')}
            className="mt-6 px-5 py-2 border border-white/10 text-white/40 hover:text-white/80 text-[12px] font-mono transition-colors"
          >
            대본 만들기 →
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paged.map((script) => (
              <div key={script.id} className="border border-white/10 bg-black/40 flex flex-col group hover:border-yellow-400/30 transition-all duration-300 shadow-xl overflow-hidden">
                {/* 스크립트 프리뷰 영역 (영상 썸네일 대체) */}
                <div className="relative bg-black/60 h-[320px] overflow-y-auto p-4 scrollbar-hide group-hover:bg-black/40 transition-colors">
                  <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />
                  <p className="text-white/40 text-[12.5px] font-mono leading-relaxed whitespace-pre-wrap">
                    {script.content}
                  </p>
                  <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                  
                  {/* 오버레이 뱃지 */}
                  <span className="absolute top-2 left-2 text-[9px] font-mono text-white/30 bg-black/80 px-1.5 py-0.5 border border-white/5 tracking-tighter">
                    {script.id.slice(0, 8).toUpperCase()}
                  </span>
                </div>

                {/* 정보 및 액션 영역 */}
                <div className="p-4 flex flex-col gap-3 border-t border-white/5">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[11px] font-mono text-[#17BEBB]/80 border border-[#17BEBB]/20 bg-[#17BEBB]/5 px-2 py-0.5">
                      {script.type === 'shorts' ? '9:16 쇼츠' : '16:9 유튜브'}
                    </span>
                    <span className="text-[11px] font-mono text-[#17BEBB]/80 border border-[#17BEBB]/20 bg-[#17BEBB]/5 px-2 py-0.5 truncate max-w-[120px]">
                      {script.llm_model?.split('/').pop() || 'Claude 4.6'}
                    </span>
                  </div>

                  <h3 className="text-white/80 text-[14px] font-bold font-mono line-clamp-1 min-h-[20px]">
                    {script.title || '제목 없는 대본'}
                  </h3>

                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className="text-white/30 text-[11px] font-mono">
                      {new Date(script.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDelete(script.id)}
                        className="text-[12px] font-mono text-red-500/50 hover:text-red-500 px-2 py-1 transition-colors"
                      >
                        삭제
                      </button>
                      <button
                        onClick={() => handleUseScript(script)}
                        className="text-[12px] font-mono text-black bg-yellow-400 hover:bg-yellow-300 px-4 py-1.5 font-bold transition-colors"
                      >
                        영상 제작
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-10">
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={page === 0}
                className="px-4 py-2 text-xs font-mono border border-white/10 text-white/40 hover:border-white/30 hover:text-white/70 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
              >
                ← PREV
              </button>
              <span className="text-white/20 text-xs font-mono tracking-widest">{page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages - 1}
                className="px-4 py-2 text-xs font-mono border border-white/10 text-white/40 hover:border-white/30 hover:text-white/70 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
              >
                NEXT →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
