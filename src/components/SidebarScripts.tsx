'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { useRouter } from 'next/navigation';

type Script = {
  id: string;
  title: string;
  content: string;
  created_at: string;
};

export default function SidebarScripts() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchRecent = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('scripts')
        .select('id, title, content, created_at')
        .order('created_at', { ascending: false })
        .limit(8);

      if (!error && data) {
        setScripts(data);
      }
      setLoading(false);
    };

    fetchRecent();

    // 실시간 업데이트 리스너 (새 대본 생성 등)
    window.addEventListener('clipflow_script_updated', fetchRecent);
    return () => window.removeEventListener('clipflow_script_updated', fetchRecent);
  }, []);

  const handleUse = (s: Script) => {
    sessionStorage.setItem('clipflow_script', s.content);
    // 현재 페이지가 대시보드라면 새로고침 효과를 위해 강제 이동 또는 상태 공유가 필요할 수 있음
    // 여기서는 가장 단순하게 대시보드로 이동
    router.push('/dashboard/video');
    // 만약 이미 /dashboard에 있다면 리로드 트리거가 필요할 수 있음. 
    // 브라우저 이벤트로 알림
    window.dispatchEvent(new Event('clipflow_script_updated'));
  };

  if (loading) {
    return (
      <div className="px-3 py-4 space-y-2">
        <div className="h-10 bg-white/5 animate-pulse rounded-sm" />
        <div className="h-10 bg-white/5 animate-pulse rounded-sm" />
      </div>
    );
  }

  if (scripts.length === 0) {
    return (
      <div className="px-4 py-4 border border-dashed border-white/5 mx-2 my-2">
        <p className="text-white/10 text-[11px] font-mono text-center uppercase tracking-widest">No scripts saved</p>
      </div>
    );
  }

  return (
    <div className="px-2 py-3 space-y-1.5">
      <div className="flex items-center justify-between px-3 mb-2">
        <span className="text-white/30 text-[11px] font-mono uppercase tracking-[0.2em]">Recent Scripts</span>
      </div>
      {scripts.map((s) => (
        <button
          key={s.id}
          onClick={() => handleUse(s)}
          className="w-full text-left group px-3 py-2.5 border border-white/5 bg-white/[0.01] hover:border-yellow-400/30 hover:bg-yellow-400/[0.03] transition-all duration-300 relative overflow-hidden"
        >
          {/* 하이라이트 바 */}
          <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="flex items-center justify-between mb-1">
            <span className="text-white/75 group-hover:text-white text-[13px] font-mono font-bold truncate pr-3 flex-1 transition-colors">
              {s.title}
            </span>
            <span className="text-white/25 text-[11px] font-mono shrink-0">
              TXT
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/40 text-[11px] font-mono group-hover:text-white/60 transition-colors">
              {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}
            </span>
            <div className="flex items-center gap-1 transform translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300">
              <span className="text-[9px] text-yellow-400/80 font-mono font-black tracking-tighter">OPEN</span>
              <span className="text-[9px] text-yellow-400/80">→</span>
            </div>
          </div>
        </button>
      ))}
      
      <button
        onClick={() => router.push('/dashboard/my-scripts')}
        className="w-full flex items-center justify-center gap-2 py-3 text-[10px] font-mono text-white/15 hover:text-white/40 transition-colors uppercase tracking-[0.2em] mt-2 group"
      >
        <span className="w-4 h-[1px] bg-white/10 group-hover:w-6 transition-all" />
        All Scripts
        <span className="w-4 h-[1px] bg-white/10 group-hover:w-6 transition-all" />
      </button>
    </div>
  );
}
