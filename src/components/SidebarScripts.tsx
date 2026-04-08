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

      if (!error && data) setScripts(data);
      setLoading(false);
    };

    fetchRecent();
    window.addEventListener('clipflow_script_updated', fetchRecent);
    return () => window.removeEventListener('clipflow_script_updated', fetchRecent);
  }, []);

  const handleUse = (s: Script) => {
    sessionStorage.setItem('clipflow_script', s.content);
    router.push('/dashboard/video');
    window.dispatchEvent(new Event('clipflow_script_updated'));
  };

  if (loading) {
    return (
      <div className="px-2 py-3 space-y-1.5">
        <div className="h-9 bg-white/5 animate-pulse rounded-lg" />
        <div className="h-9 bg-white/5 animate-pulse rounded-lg" />
      </div>
    );
  }

  if (scripts.length === 0) {
    return (
      <div className="px-3 py-4 text-center">
        <p className="text-white/20 text-xs">저장된 대본 없음</p>
      </div>
    );
  }

  return (
    <div className="px-2 py-2 space-y-0.5">
      <p className="text-white/25 text-[11px] font-medium uppercase tracking-widest px-2 mb-2">Recent Scripts</p>
      {scripts.map((s) => (
        <button
          key={s.id}
          onClick={() => handleUse(s)}
          className="w-full text-left group px-2.5 py-2 rounded-lg hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-white/65 group-hover:text-white/90 text-[12.5px] font-medium truncate flex-1 transition-colors">
              {s.title}
            </span>
            <span className="text-white/20 text-[10px] shrink-0">TXT</span>
          </div>
          <span className="text-white/30 text-[11px]">
            {new Date(s.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
          </span>
        </button>
      ))}

      <button
        onClick={() => router.push('/dashboard/my-scripts')}
        className="w-full text-center py-2 text-[11px] text-white/20 hover:text-white/50 transition-colors mt-1"
      >
        전체 보기
      </button>
    </div>
  );
}
