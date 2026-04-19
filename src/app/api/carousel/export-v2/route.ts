/**
 * POST /api/carousel/export-v2
 * Playwright가 /carousel-preview 페이지를 방문해 스크린샷 → PNG 반환
 * 프리뷰와 100% 동일한 렌더링 (CarouselCardPreview 공유)
 */
import { NextRequest, NextResponse } from 'next/server';
import { chromium, Browser } from 'playwright-core';
import { storeRenderCard } from '@/lib/render-store';
import type { CarouselCardData } from '@/components/carousel-card-preview';

export const runtime = 'nodejs';
export const maxDuration = 30;

// ── 브라우저 싱글턴 ────────────────────────────────────────────
let _browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (_browser?.isConnected()) return _browser;
  _browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--font-render-hinting=none',
    ],
  });
  return _browser;
}

// ── POST 핸들러 ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { card, total } = (await req.json()) as {
      card: CarouselCardData;
      total: number;
    };

    // 카드 데이터를 인메모리 스토어에 저장 → 토큰 발급
    const token = storeRenderCard(card, total);

    // 현재 서버의 origin 결정
    const reqOrigin = req.nextUrl.origin;
    // 로컬 개발: http://localhost:3000, Railway: 실제 도메인
    const renderUrl = `${reqOrigin}/carousel-preview?t=${token}`;

    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
      await page.setViewportSize({ width: 1080, height: 1080 });

      // 실제 Next.js 앱 페이지 방문 → 정확히 동일한 CSS·폰트·컴포넌트 사용
      await page.goto(renderUrl, { waitUntil: 'networkidle', timeout: 20_000 });

      // 폰트 로딩 완료 대기
      await page.evaluate(() => document.fonts.ready);

      // Next.js 개발 도구 버튼 제거 (dev 환경 아티팩트)
      await page.evaluate(() => {
        document.querySelectorAll('nextjs-portal, #__next-build-indicator, [data-nextjs-dialog-overlay]').forEach(el => el.remove());
      });

      // 이미지가 있는 경우 추가 대기
      if (card.backgroundImageUrl) {
        await page.waitForTimeout(200);
      }

      const png = await page.screenshot({
        type: 'png',
        clip: { x: 0, y: 0, width: 1080, height: 1080 },
      });

      return new NextResponse(Buffer.from(png), {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-store',
        },
      });
    } finally {
      await page.close();
    }
  } catch (err) {
    console.error('[export-v2]', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
