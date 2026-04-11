import { NextRequest } from 'next/server';
import satori from 'satori';
import { readFileSync } from 'fs';
import { join } from 'path';

export const runtime = 'nodejs';

interface CarouselCard {
  index: number;
  cardType: 'title' | 'keypoint' | 'quote' | 'cta';
  title: string;
  subtitle?: string;
  bullets?: string[];
  emoji?: string;
  bgColor: string;
}

const ACCENT = '#22c55e';
type Weight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

let fonts: { name: string; data: ArrayBuffer; weight: Weight; style: 'normal' }[] | null = null;

function loadFonts() {
  if (fonts) return fonts;
  const base = join(process.cwd(), 'node_modules/@fontsource/noto-sans-kr/files');
  const load = (name: string) => readFileSync(join(base, name)).buffer as ArrayBuffer;
  fonts = [
    { name: 'KR', data: load('noto-sans-kr-korean-700-normal.woff'), weight: 700 as Weight, style: 'normal' },
    { name: 'KR', data: load('noto-sans-kr-korean-900-normal.woff'), weight: 900 as Weight, style: 'normal' },
    { name: 'KR', data: load('noto-sans-kr-latin-700-normal.woff'),  weight: 700 as Weight, style: 'normal' },
    { name: 'KR', data: load('noto-sans-kr-latin-900-normal.woff'),  weight: 900 as Weight, style: 'normal' },
  ];
  return fonts;
}

export async function POST(req: NextRequest) {
  try {
    const { card, total }: { card: CarouselCard; total: number } = await req.json();
    const loadedFonts = loadFonts();

    const svg = await satori(<CardView card={card} total={total} />, {
      width: 1080,
      height: 1080,
      fonts: loadedFonts,
    });

    return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

function CardView({ card, total }: { card: CarouselCard; total: number }) {
  return (
    <div style={{
      width: 1080, height: 1080,
      backgroundColor: card.bgColor,
      display: 'flex', flexDirection: 'column',
      padding: '80px',
      fontFamily: 'KR',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* 배경 그라디언트 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(160deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55) 100%)',
        display: 'flex',
      }} />

      {/* 우측 상단 글로우 */}
      <div style={{
        position: 'absolute', top: -200, right: -200,
        width: 600, height: 600, borderRadius: '50%',
        background: `radial-gradient(circle, ${ACCENT}28 0%, transparent 70%)`,
        display: 'flex',
      }} />

      {/* 좌측 하단 글로우 */}
      <div style={{
        position: 'absolute', bottom: -150, left: -150,
        width: 400, height: 400, borderRadius: '50%',
        background: `radial-gradient(circle, ${ACCENT}18 0%, transparent 70%)`,
        display: 'flex',
      }} />

      {/* 상단 액센트 바 */}
      <div style={{
        position: 'absolute', top: 0, left: 80,
        width: 700, height: 5,
        background: `linear-gradient(to right, ${ACCENT}, transparent)`,
        display: 'flex',
      }} />

      {/* 콘텐츠 레이어 */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 48 }}>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 26, fontWeight: 700 }}>
            {card.index + 1} / {total}
          </span>
          {card.emoji
            ? <span style={{ fontSize: 76, lineHeight: 1 }}>{card.emoji}</span>
            : <span style={{ width: 76 }} />
          }
        </div>

        {/* 메인 콘텐츠 */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
          {card.cardType === 'title' ? (
            <TitleContent card={card} />
          ) : card.cardType === 'cta' ? (
            <CTAContent card={card} />
          ) : (
            <KeypointContent card={card} />
          )}
        </div>

        {/* 푸터 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          paddingTop: 20,
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: ACCENT }} />
          <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: 20, fontWeight: 700 }}>CLIPFLOW</span>
        </div>
      </div>
    </div>
  );
}

function TitleContent({ card }: { card: CarouselCard }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 36 }}>
      <div style={{
        backgroundColor: `${ACCENT}22`,
        border: `1px solid ${ACCENT}66`,
        borderRadius: 40,
        padding: '8px 28px',
        display: 'flex',
      }}>
        <span style={{ color: ACCENT, fontSize: 18, fontWeight: 900, letterSpacing: 4 }}>INTRO</span>
      </div>

      <div style={{
        fontSize: 64, fontWeight: 900, color: '#ffffff',
        lineHeight: 1.35, textAlign: 'center',
      }}>
        {card.title}
      </div>

      <div style={{ width: 80, height: 4, backgroundColor: ACCENT, borderRadius: 2 }} />

      {card.subtitle && (
        <div style={{
          fontSize: 32, color: 'rgba(255,255,255,0.6)',
          lineHeight: 1.65, textAlign: 'center', fontWeight: 700,
        }}>
          {card.subtitle}
        </div>
      )}
    </div>
  );
}

function KeypointContent({ card }: { card: CarouselCard }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* 포인트 레이블 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 4, height: 20, backgroundColor: ACCENT, borderRadius: 2 }} />
        <span style={{ color: ACCENT, fontSize: 18, fontWeight: 900, letterSpacing: 3 }}>
          POINT {card.index}
        </span>
      </div>

      {/* 제목 */}
      <div style={{
        fontSize: 52, fontWeight: 900, color: '#ffffff',
        lineHeight: 1.4,
        borderLeft: `4px solid ${ACCENT}`,
        paddingLeft: 24,
      }}>
        {card.title}
      </div>

      {/* 구분선 */}
      <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />

      {/* 불릿 */}
      {card.bullets && card.bullets.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {card.bullets.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                backgroundColor: ACCENT, marginTop: 12, flexShrink: 0,
              }} />
              <span style={{ fontSize: 30, color: 'rgba(255,255,255,0.8)', lineHeight: 1.55, fontWeight: 700 }}>
                {b}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CTAContent({ card }: { card: CarouselCard }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
      <div style={{
        fontSize: 58, fontWeight: 900, color: '#ffffff',
        lineHeight: 1.35, textAlign: 'center',
      }}>
        {card.title}
      </div>

      {card.subtitle && (
        <div style={{
          fontSize: 30, color: 'rgba(255,255,255,0.6)',
          lineHeight: 1.65, textAlign: 'center', fontWeight: 700,
        }}>
          {card.subtitle}
        </div>
      )}

      {/* CTA 버튼 */}
      <div style={{
        marginTop: 16,
        backgroundColor: ACCENT,
        borderRadius: 50,
        padding: '18px 52px',
        display: 'flex', alignItems: 'center',
      }}>
        <span style={{ fontSize: 26, fontWeight: 900, color: '#071a0f' }}>
          팔로우 &amp; 구독하기
        </span>
      </div>
    </div>
  );
}
