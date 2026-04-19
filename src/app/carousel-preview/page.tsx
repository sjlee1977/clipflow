/**
 * /carousel-preview?t={token}
 * export-v2 Playwright가 방문해 스크린샷을 찍는 내부 렌더 페이지
 * 인증 없이 접근 가능 (미들웨어 matcher에서 제외됨)
 */
import { getRenderCard } from '@/lib/render-store';
import { CarouselCardPreview } from '@/components/carousel-card-preview';

export default async function CarouselPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const data = t ? getRenderCard(t) : undefined;

  if (!data) {
    return (
      <div style={{ width: 1080, height: 1080, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#fff', fontFamily: 'sans-serif' }}>render token expired</span>
      </div>
    );
  }

  // 컴포넌트는 ~360px 기준으로 설계됨 → 3배 scale-up → 1080px
  const NATURAL = 360;
  const SCALE   = 1080 / NATURAL;

  return (
    <div
      style={{ width: 1080, height: 1080, overflow: 'hidden', position: 'relative' }}
      data-render-ready="true"
    >
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: NATURAL, height: NATURAL,
        transform: `scale(${SCALE})`,
        transformOrigin: 'top left',
      }}>
        <CarouselCardPreview card={data.card} total={data.total} />
      </div>
    </div>
  );
}
