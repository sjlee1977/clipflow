'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState } from 'react';
import { LayoutTemplate } from 'lucide-react';
import { CarouselCardPreview } from '@/components/carousel-card-preview';
import type { CarouselCardData } from '@/components/carousel-card-preview';

type Carousel = {
  id: string;
  topic: string;
  card_count: number;
  cards: CarouselCardData[];
  created_at: string;
};

export default function CarouselLibraryPage() {
  const [carousels, setCarousels] = useState<Carousel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    fetch('/api/carousels')
      .then(r => r.json())
      .then(d => {
        const list = d.carousels ?? [];
        setCarousels(list);
        if (list.length > 0) setSelectedId(list[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const selected = carousels.find(c => c.id === selectedId);

  async function handleDownload(carousel: Carousel) {
    setDownloading(carousel.id);
    setDownloadError(null);
    try {
      for (const card of carousel.cards) {
        const res = await fetch('/api/carousel/export-v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ card, total: carousel.cards.length }),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`카드 ${card.index + 1} 실패: ${errText}`);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `${carousel.topic}_card${card.index + 1}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        await new Promise(r => setTimeout(r, 300));
      }
    } catch (e) {
      setDownloadError((e as Error).message);
    } finally {
      setDownloading(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return;
    setDeletingId(id);
    try {
      await fetch(`/api/carousels/${id}`, { method: 'DELETE' });
      setCarousels(prev => prev.filter(c => c.id !== id));
      if (selectedId === id) setSelectedId(null);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex gap-0 -my-6" style={{ minHeight: 'calc(100vh - 56px)' }}>
      {/* 좌측 목록 사이드바 */}
      <div className="w-64 shrink-0 p-6 overflow-y-auto" style={{ borderRight: '1px solid var(--border)' }}>
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6 mt-4">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0" style={{ background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.22)', color: '#4f8ef7' }}>
              <LayoutTemplate size={13} strokeWidth={1.8} />
            </span>
            <span className="text-[19px] font-semibold text-white" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>내 캐러셀</span>
          </div>
          {!loading && carousels.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-mono text-white/20 tracking-widest uppercase">Total</span>
              <span className="text-[13px] font-black font-mono text-[#4f8ef7]">{carousels.length}</span>
            </div>
          )}
        </div>

        {/* 로딩 */}
        {loading && (
          <div className="flex items-center justify-center py-16 gap-3 text-white/20">
            <span className="w-4 h-4 border border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        )}

        {/* 빈 상태 */}
        {!loading && carousels.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-5">
            <div className="w-12 h-12 border border-white/8 rounded-2xl flex items-center justify-center">
              <span className="text-xl text-white/10">⊞</span>
            </div>
            <p className="text-[12px] text-white/30 font-mono text-center">저장된 캐러셀이 없습니다</p>
          </div>
        )}

        {/* 목록 */}
        {!loading && carousels.length > 0 && (
          <div className="space-y-1.5">
            {carousels.map(carousel => {
              const isActive = selectedId === carousel.id;
              const previewColors = carousel.cards.slice(0, 4).map(c => c.bgColor);
              return (
                <div
                  key={carousel.id}
                  onClick={() => setSelectedId(carousel.id)}
                  className={`group cursor-pointer rounded-lg border transition-all duration-150 overflow-hidden ${
                    isActive
                      ? 'border-[#4f8ef7]/40 bg-[#4f8ef7]/5'
                      : 'border-white/6 hover:border-white/15 bg-white/[0.02] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex h-1">
                    {previewColors.map((color, i) => (
                      <div key={i} className="flex-1" style={{ backgroundColor: color }} />
                    ))}
                    {previewColors.length < 4 && Array.from({ length: 4 - previewColors.length }).map((_, i) => (
                      <div key={`empty-${i}`} className="flex-1 bg-white/5" />
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] font-medium truncate transition-colors ${isActive ? 'text-white' : 'text-white/70'}`}>
                        {carousel.topic}
                      </p>
                      <p className="text-[10px] text-white/25 mt-0.5 tracking-wide">
                        카드 {carousel.card_count}장 · {new Date(carousel.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(carousel.id); }}
                      disabled={deletingId === carousel.id}
                      className="opacity-0 group-hover:opacity-100 text-red-400/30 hover:text-red-400 text-[11px] transition-all shrink-0 w-5 h-5 flex items-center justify-center"
                    >
                      {deletingId === carousel.id ? '·' : '✕'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 우측 미리보기 영역 */}
      <div className="flex-1 min-w-0 p-6 overflow-y-auto">
        {!selected && !loading && (
          <div className="flex items-center justify-center h-64 text-white/15 text-[12px] font-mono tracking-widest uppercase mt-4">
            Select a carousel
          </div>
        )}

        {selected && (
          <div className="mt-4">
            {/* 상단 액션 바 */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[14px] font-bold text-white leading-tight">{selected.topic}</p>
                <p className="text-[11px] font-mono text-white/25 tracking-widest uppercase mt-0.5">
                  {selected.card_count} Cards · {new Date(selected.cards[0] ? selected.created_at : '').toLocaleDateString('ko-KR')}
                </p>
              </div>
              <button
                onClick={() => handleDownload(selected)}
                disabled={downloading === selected.id}
                className="cf-filter-btn flex items-center gap-2 border border-white/20 bg-white/5 text-white/60 disabled:opacity-40 font-black text-[12px] tracking-tight uppercase px-4 py-1.5 rounded-lg transition-all"
              >
                {downloading === selected.id ? (
                  <><span className="w-3 h-3 border-2 border-[#4f8ef7]/30 border-t-[#4f8ef7] rounded-full animate-spin" /> 다운로드 중</>
                ) : (
                  <>↓ 전체 다운로드</>
                )}
              </button>
            </div>

            {/* 다운로드 에러 */}
            {downloadError && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-mono break-all">
                {downloadError}
              </div>
            )}

            {/* 카드 그리드 */}
            <div className="grid grid-cols-4 gap-3">
              {selected.cards.map(card => (
                <div
                  key={card.index}
                  ref={el => { cardRefs.current[`${selected.id}-${card.index}`] = el; }}
                >
                  <CarouselCardPreview card={card} total={selected.cards.length} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
