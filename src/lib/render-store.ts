/**
 * 캐러셀 카드 렌더링용 임시 인메모리 스토어
 * export-v2 API → /carousel-preview 페이지 간 데이터 전달
 */
import type { CarouselCardData } from '@/components/carousel-card-preview';

const store = new Map<string, { card: CarouselCardData; total: number }>();

export function storeRenderCard(card: CarouselCardData, total: number): string {
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  store.set(token, { card, total });
  setTimeout(() => store.delete(token), 60_000);
  return token;
}

export function getRenderCard(token: string): { card: CarouselCardData; total: number } | undefined {
  return store.get(token);
}
