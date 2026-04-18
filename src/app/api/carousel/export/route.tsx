/**
 * POST /api/carousel/export — Satori 1080×1080 SVG 생성
 * 6가지 레이아웃 × 6가지 카드 타입 완전 지원
 */
import { NextRequest } from 'next/server';
import satori from 'satori';
import { readFileSync } from 'fs';
import { join } from 'path';

export const runtime = 'nodejs';

interface ExportCard {
  index:            number;
  cardType:         'title' | 'keypoint' | 'highlight' | 'quote' | 'data' | 'cta';
  title:            string;
  subtitle?:        string;
  bullets?:         string[];
  stat?:            string;
  statDesc?:        string;
  quote?:           string;
  quoteBy?:         string;
  emoji?:           string;
  bgColor?:         string;
  accentColor?:     string;
  accentSecondary?: string;
  textPrimary?:     string;
  textSecondary?:   string;
  textMuted?:       string;
  titleFontWeight?: number;
  styleId?:         string;
  layout?:          string;
}

type W = 100|200|300|400|500|600|700|800|900;
const clampW = (w?: number): W => ((w ?? 800) >= 750 ? 900 : 700);
const pad = (n: number) => String(n).padStart(2, '0');

// Satori 폰트(Noto Sans KR)에 없는 이모지·특수기호를 제거해 크래시 방지
// Noto Sans KR은 한글·라틴만 지원; emoji/symbols는 글리프 없음
const stripEmoji = (s?: string): string =>
  (s ?? '')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')   // Supplemental Multilingual Plane 전체 (이모지 대부분)
    .replace(/[\u{2300}-\u{23FF}]/gu, '')       // Misc Technical (⌚⌛⏪ 등)
    .replace(/[\u{2460}-\u{24FF}]/gu, '')       // Enclosed Alphanumerics (①② 등)
    .replace(/[\u{25A0}-\u{27BF}]/gu, '')       // Geometric Shapes, Dingbats (▣●★ 등)
    .replace(/[\u{2B00}-\u{2BFF}]/gu, '')       // Misc Symbols and Arrows (⭐⬛ 등)
    .replace(/[\u{FE00}-\u{FEFF}]/gu, '')       // Variation Selectors
    .replace(/\u200D/gu, '')                    // Zero Width Joiner (ZWJ sequences)
    .trim();

let fonts: { name: string; data: ArrayBuffer; weight: W; style: 'normal' }[] | null = null;
function loadFonts() {
  if (fonts) return fonts;
  const base = join(process.cwd(), 'node_modules/@fontsource/noto-sans-kr/files');
  const load = (f: string) => readFileSync(join(base, f)).buffer as ArrayBuffer;
  fonts = [
    { name: 'KR', data: load('noto-sans-kr-korean-400-normal.woff'), weight: 400, style: 'normal' },
    { name: 'KR', data: load('noto-sans-kr-korean-700-normal.woff'), weight: 700, style: 'normal' },
    { name: 'KR', data: load('noto-sans-kr-korean-900-normal.woff'), weight: 900, style: 'normal' },
    { name: 'KR', data: load('noto-sans-kr-latin-400-normal.woff'),  weight: 400, style: 'normal' },
    { name: 'KR', data: load('noto-sans-kr-latin-700-normal.woff'),  weight: 700, style: 'normal' },
    { name: 'KR', data: load('noto-sans-kr-latin-900-normal.woff'),  weight: 900, style: 'normal' },
  ];
  return fonts;
}

/** Satori 렌더 실패 시 반환할 단순 SVG — 항상 6장 다운로드 보장 */
function fallbackSvg(card: ExportCard): string {
  const bg  = card.bgColor      ?? '#070d1e';
  const ac  = card.accentColor  ?? '#4f8ef7';
  const tp  = card.textPrimary  ?? '#e8f0ff';
  const ts  = card.textSecondary ?? 'rgba(232,240,255,0.6)';
  const title   = stripEmoji(card.title   ?? '').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]!));
  const ct      = (card.cardType ?? '').toUpperCase();
  const idx     = String((card.index ?? 0) + 1).padStart(2, '0');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080">
  <rect width="1080" height="1080" fill="${bg}"/>
  <rect x="0" y="0" width="1080" height="5" fill="${ac}"/>
  <text x="80" y="90" font-family="sans-serif" font-size="28" fill="${ac}" font-weight="700" letter-spacing="4">${ct}</text>
  <text x="80" y="540" font-family="sans-serif" font-size="54" fill="${tp}" font-weight="700">${title}</text>
  <text x="80" y="980" font-family="sans-serif" font-size="22" fill="${ts}">${idx}</text>
</svg>`;
}

export async function POST(req: NextRequest) {
  const { card: rawCard, total }: { card: ExportCard; total: number } = await req.json();

  // 이모지 제거 — Noto Sans KR 폰트에 이모지 글리프 없어 Satori 크래시 방지
  const card: ExportCard = {
    ...rawCard,
    title:    stripEmoji(rawCard.title),
    subtitle: rawCard.subtitle  ? stripEmoji(rawCard.subtitle)  : undefined,
    stat:     rawCard.stat      ? stripEmoji(rawCard.stat)      : undefined,
    statDesc: rawCard.statDesc  ? stripEmoji(rawCard.statDesc)  : undefined,
    quote:    rawCard.quote     ? stripEmoji(rawCard.quote)     : undefined,
    quoteBy:  rawCard.quoteBy   ? stripEmoji(rawCard.quoteBy)   : undefined,
  };

  try {
    const svg = await satori(<CardView card={card} total={total} />, {
      width: 1080, height: 1080, fonts: loadFonts(),
    });
    return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } });
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    console.error(`[carousel/export] card ${card.index} (${card.cardType}/${card.layout}) Satori error:`, msg);
    // Satori 실패 시 단순 SVG로 폴백 — 클라이언트는 항상 200을 받아 ZIP에 포함됨
    return new Response(fallbackSvg(card), {
      headers: {
        'Content-Type': 'image/svg+xml',
        'X-Satori-Error': msg.slice(0, 200),   // 디버깅용 헤더
      },
    });
  }
}

// ── 공통 Props ────────────────────────────────────────────────────────────────
interface P {
  card: ExportCard; total: number;
  tp: string; ts: string; tm: string;
  ac: string; ac2: string; tw: W;
}

// ── 메인 라우터 ───────────────────────────────────────────────────────────────
function CardView({ card, total }: { card: ExportCard; total: number }) {
  const tp  = card.textPrimary    ?? '#e8f0ff';
  const ts  = card.textSecondary  ?? 'rgba(232,240,255,0.62)';
  const tm  = card.textMuted      ?? 'rgba(232,240,255,0.28)';
  const ac  = card.accentColor    ?? '#4f8ef7';
  const ac2 = card.accentSecondary ?? ac;
  const tw  = clampW(card.titleFontWeight);
  const bg  = card.bgColor ?? '#070d1e';
  const layout = card.layout ?? 'bold-left';
  const p: P = { card, total, tp, ts, tm, ac, ac2, tw };

  return (
    <div style={{ width:1080, height:1080, backgroundColor: bg, display:'flex',
      flexDirection:'column', fontFamily:'KR', position:'relative', overflow:'hidden' }}>
      {/* 글로우 */}
      <div style={{ position:'absolute', top:-280, right:-280, width:800, height:800,
        borderRadius:'50%', background:`radial-gradient(circle, ${ac}18 0%, transparent 70%)`, display:'flex' }} />
      <div style={{ position:'absolute', bottom:-200, left:-200, width:600, height:600,
        borderRadius:'50%', background:`radial-gradient(circle, ${ac}0e 0%, transparent 70%)`, display:'flex' }} />
      {/* 레이아웃 */}
      <div style={{ display:'flex', flexDirection:'column', width:'100%', height:'100%', position:'relative' }}>
        {layout === 'bold-left'   && <BoldLeft   {...p} />}
        {layout === 'centered'    && <Centered   {...p} />}
        {layout === 'editorial'   && <Editorial  {...p} />}
        {layout === 'magazine'    && <Magazine   {...p} />}
        {layout === 'minimal'     && <Minimal    {...p} />}
        {layout === 'infographic' && <Infographic {...p} />}
        {layout === 'split'       && <Split      {...p} />}
        {layout === 'kinetic'     && <Kinetic    {...p} />}
        {layout === 'broadcast'   && <Broadcast  {...p} />}
        {layout === 'cinematic'   && <Cinematic  {...p} />}
        {layout === 'timeline'    && <Timeline   {...p} />}
        {layout === 'glass'       && <Glass      {...p} />}
        {!['bold-left','centered','editorial','magazine','minimal','infographic',
           'split','kinetic','broadcast','cinematic','timeline','glass'].includes(layout) && <BoldLeft {...p} />}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// BOLD-LEFT
// ════════════════════════════════════════════════════════════════════════════
function BoldLeft({ card, total, tp, ts, tm, ac, tw }: P) {
  const ct = card.cardType; const idx = card.index;
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', padding:'80px' }}>
      {/* 상단 액센트 라인 */}
      <div style={{ position:'absolute', top:0, left:80, width:500, height:4,
        background:`linear-gradient(to right, ${ac}, transparent)`, display:'flex' }} />
      {/* 헤더 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:52 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <span style={{ color:tm, fontSize:24, fontWeight:700 }}>{pad(idx+1)} / {pad(total)}</span>
          <div style={{ backgroundColor:`${ac}20`, border:`1px solid ${ac}40`, borderRadius:40,
            padding:'4px 20px', display:'flex' }}>
            <span style={{ color:ac, fontSize:18, fontWeight:700, letterSpacing:3 }}>{ct.toUpperCase()}</span>
          </div>
        </div>
        {card.emoji ? <span style={{ fontSize:80, lineHeight:1 }}>{card.emoji}</span>
                    : <span style={{ width:80, display:'flex' }} />}
      </div>
      {/* 좌측 바 콘텐츠 */}
      <div style={{ display:'flex', flex:1, gap:0 }}>
        <div style={{ width:6, backgroundColor:ac, borderRadius:3, marginRight:40, flexShrink:0, display:'flex' }} />
        <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', gap:24, flex:1 }}>
          {ct==='title' && (<>
            <div style={{ fontSize:68, fontWeight:tw, color:tp, lineHeight:1.3, letterSpacing:'-0.02em' }}>{card.title}</div>
            {card.subtitle && <div style={{ fontSize:32, color:ts, lineHeight:1.6, fontWeight:400 }}>{card.subtitle}</div>}
          </>)}
          {(ct==='keypoint'||ct==='data') && (<>
            <div style={{ fontSize:54, fontWeight:tw, color:tp, lineHeight:1.35 }}>{card.title}</div>
            <div style={{ height:1, backgroundColor:`${ac}25`, display:'flex' }} />
            {card.bullets?.slice(0,3).map((b,i) => (
              <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:20 }}>
                <div style={{ width:12, height:12, borderRadius:'50%', backgroundColor:ac, marginTop:10, flexShrink:0, display:'flex' }} />
                <span style={{ fontSize:32, color:ts, lineHeight:1.55, fontWeight:400 }}>{b}</span>
              </div>
            ))}
          </>)}
          {ct==='highlight' && (<>
            <div style={{ fontSize:30, color:ts, lineHeight:1.5, fontWeight:400 }}>{card.title}</div>
            <div style={{ fontSize:160, fontWeight:900, color:ac, lineHeight:1, letterSpacing:'-0.04em' }}>{card.stat}</div>
            <div style={{ height:2, backgroundColor:`${ac}25`, display:'flex' }} />
            {card.statDesc && <div style={{ fontSize:30, color:ts, lineHeight:1.6, fontWeight:400 }}>{card.statDesc}</div>}
          </>)}
          {ct==='quote' && (<>
            <div style={{ fontSize:24, color:tm, fontWeight:700 }}>{card.title}</div>
            <div style={{ fontSize:40, color:tp, fontStyle:'italic', lineHeight:1.7, fontWeight:400,
              borderLeft:`6px solid ${ac}`, paddingLeft:32 }}>{card.quote}</div>
            {card.quoteBy && <div style={{ fontSize:26, color:ts, fontWeight:700 }}>— {card.quoteBy}</div>}
          </>)}
          {ct==='cta' && (<>
            <div style={{ fontSize:64, fontWeight:tw, color:tp, lineHeight:1.3 }}>{card.title}</div>
            {card.subtitle && <div style={{ fontSize:30, color:ts, lineHeight:1.65, fontWeight:400 }}>{card.subtitle}</div>}
            <div style={{ width:100, height:5, backgroundColor:ac, borderRadius:3, display:'flex' }} />
          </>)}
        </div>
      </div>
      {/* 푸터 */}
      <div style={{ display:'flex', alignItems:'center', gap:12, paddingTop:24, borderTop:`1px solid ${ac}15` }}>
        <div style={{ width:10, height:10, backgroundColor:ac, display:'flex' }} />
        <span style={{ color:tm, fontSize:20, fontWeight:700, letterSpacing:4 }}>CLIPFLOW</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CENTERED
// ════════════════════════════════════════════════════════════════════════════
function Centered({ card, total, tp, ts, tm, ac, ac2, tw }: P) {
  const ct = card.cardType; const idx = card.index;
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', padding:'80px' }}>
      {/* 상단 방사형 글로우 중심 */}
      <div style={{ position:'absolute', top:-100, left:'50%', transform:'translateX(-50%)',
        width:600, height:600, borderRadius:'50%',
        background:`radial-gradient(circle, ${ac}15 0%, transparent 65%)`, display:'flex' }} />
      {/* 헤더 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:52 }}>
        <span style={{ color:tm, fontSize:24, fontWeight:700 }}>{pad(idx+1)} / {pad(total)}</span>
        {card.emoji ? <span style={{ fontSize:80, lineHeight:1 }}>{card.emoji}</span>
                    : <span style={{ width:80, display:'flex' }} />}
      </div>
      {/* 중앙 콘텐츠 */}
      <div style={{ display:'flex', flexDirection:'column', flex:1, alignItems:'center', justifyContent:'center', gap:28 }}>
        {ct==='title' && (<>
          <div style={{ backgroundColor:`${ac}22`, border:`1px solid ${ac}60`,
            borderRadius:50, padding:'6px 36px', display:'flex' }}>
            <span style={{ color:ac, fontSize:20, fontWeight:900, letterSpacing:5 }}>INTRO</span>
          </div>
          <div style={{ fontSize:68, fontWeight:tw, color:tp, lineHeight:1.3, textAlign:'center', letterSpacing:'-0.02em' }}>{card.title}</div>
          <div style={{ width:80, height:5, backgroundColor:ac, borderRadius:3, display:'flex' }} />
          {card.subtitle && <div style={{ fontSize:32, color:ts, lineHeight:1.65, textAlign:'center', fontWeight:400 }}>{card.subtitle}</div>}
        </>)}
        {(ct==='keypoint'||ct==='data') && (<>
          <div style={{ fontSize:54, fontWeight:tw, color:tp, lineHeight:1.35, textAlign:'center' }}>{card.title}</div>
          <div style={{ height:1, width:600, backgroundColor:`${ac}30`, display:'flex' }} />
          <div style={{ display:'flex', flexDirection:'column', gap:20, width:'100%' }}>
            {card.bullets?.slice(0,3).map((b,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:20 }}>
                <div style={{ width:10, height:10, borderRadius:'50%', backgroundColor:ac, flexShrink:0, display:'flex' }} />
                <span style={{ fontSize:30, color:ts, lineHeight:1.55, fontWeight:400 }}>{b}</span>
              </div>
            ))}
          </div>
        </>)}
        {ct==='highlight' && (<>
          <div style={{ fontSize:30, color:ts, textAlign:'center', fontWeight:400 }}>{card.title}</div>
          <div style={{ fontSize:170, fontWeight:900, color:ac, lineHeight:1, letterSpacing:'-0.04em' }}>{card.stat}</div>
          <div style={{ width:80, height:4, background:`linear-gradient(90deg,${ac},${ac2})`, borderRadius:3, display:'flex' }} />
          {card.statDesc && <div style={{ fontSize:30, color:ts, textAlign:'center', fontWeight:400 }}>{card.statDesc}</div>}
        </>)}
        {ct==='quote' && (<>
          <div style={{ fontSize:120, color:`${ac}50`, fontWeight:900, lineHeight:1 }}>"</div>
          <div style={{ fontSize:42, color:tp, fontStyle:'italic', lineHeight:1.7, textAlign:'center', fontWeight:400 }}>{card.quote}</div>
          {card.quoteBy && <div style={{ fontSize:26, color:tm, fontWeight:700 }}>— {card.quoteBy}</div>}
        </>)}
        {ct==='cta' && (<>
          <div style={{ fontSize:64, fontWeight:tw, color:tp, lineHeight:1.3, textAlign:'center' }}>{card.title}</div>
          {card.subtitle && <div style={{ fontSize:30, color:ts, lineHeight:1.65, textAlign:'center', fontWeight:400 }}>{card.subtitle}</div>}
          <div style={{ backgroundColor:ac, borderRadius:60, padding:'20px 64px', display:'flex' }}>
            <span style={{ fontSize:28, fontWeight:900, color:'#050505' }}>팔로우 &amp; 구독하기</span>
          </div>
        </>)}
      </div>
      {/* 푸터 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:14, paddingTop:24,
        borderTop:`1px solid ${ac}15` }}>
        <div style={{ width:10, height:10, borderRadius:'50%', backgroundColor:ac, display:'flex' }} />
        <span style={{ color:tm, fontSize:20, fontWeight:700, letterSpacing:4 }}>CLIPFLOW</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// EDITORIAL
// ════════════════════════════════════════════════════════════════════════════
function Editorial({ card, total, tp, ts, tm, ac, tw }: P) {
  const ct = card.cardType; const idx = card.index;
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', padding:'80px', position:'relative' }}>
      {/* 배경 거대 카드번호 */}
      <div style={{ position:'absolute', right:40, bottom:60, fontSize:520, fontWeight:900,
        color:tp, opacity:0.04, lineHeight:1, letterSpacing:'-0.05em', display:'flex' }}>
        {pad(idx+1)}
      </div>
      {/* 헤더 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:36 }}>
        <div style={{ display:'flex', alignItems:'center', gap:20 }}>
          <div style={{ width:40, height:2, backgroundColor:ac, display:'flex' }} />
          <span style={{ color:ac, fontSize:20, fontWeight:700, letterSpacing:4 }}>{ct.toUpperCase()}</span>
        </div>
        {card.emoji ? <span style={{ fontSize:70, lineHeight:1 }}>{card.emoji}</span>
                    : <span style={{ width:70, display:'flex' }} />}
      </div>
      {/* 얇은 선 */}
      <div style={{ height:1, backgroundColor:`${tp}15`, marginBottom:52, display:'flex' }} />
      {/* 콘텐츠 */}
      <div style={{ display:'flex', flexDirection:'column', flex:1, justifyContent:'center', gap:28, position:'relative' }}>
        {ct==='title' && (<>
          <div style={{ fontSize:66, fontWeight:tw, color:tp, lineHeight:1.3 }}>{card.title}</div>
          {card.subtitle && (<>
            <div style={{ height:1, backgroundColor:`${tp}12`, display:'flex' }} />
            <div style={{ fontSize:32, color:ts, lineHeight:1.6, fontWeight:400 }}>{card.subtitle}</div>
          </>)}
        </>)}
        {(ct==='keypoint'||ct==='data') && (<>
          <div style={{ fontSize:52, fontWeight:tw, color:tp, lineHeight:1.35 }}>{card.title}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            {card.bullets?.slice(0,3).map((b,i) => (
              <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:20 }}>
                <span style={{ color:ac, fontSize:28, lineHeight:'1.6', flexShrink:0 }}>—</span>
                <span style={{ fontSize:30, color:ts, lineHeight:1.6, fontWeight:400 }}>{b}</span>
              </div>
            ))}
          </div>
        </>)}
        {ct==='highlight' && (<>
          <div style={{ fontSize:22, color:tm, fontWeight:700, letterSpacing:5 }}>{card.title?.toUpperCase()}</div>
          <div style={{ fontSize:160, fontWeight:900, color:ac, lineHeight:1, letterSpacing:'-0.04em' }}>{card.stat}</div>
          <div style={{ height:1, backgroundColor:`${tp}15`, display:'flex' }} />
          {card.statDesc && <div style={{ fontSize:30, color:ts, fontWeight:400, lineHeight:1.6 }}>{card.statDesc}</div>}
        </>)}
        {ct==='quote' && (<>
          <div style={{ fontSize:24, color:tm, fontWeight:700 }}>{card.title}</div>
          <div style={{ fontSize:40, color:tp, fontStyle:'italic', lineHeight:1.7, fontWeight:400,
            borderLeft:`3px solid ${ac}`, paddingLeft:30 }}>{card.quote}</div>
          {card.quoteBy && <div style={{ fontSize:26, color:ts, fontWeight:700 }}>— {card.quoteBy}</div>}
        </>)}
        {ct==='cta' && (<>
          <div style={{ fontSize:62, fontWeight:tw, color:tp, lineHeight:1.3 }}>{card.title}</div>
          {card.subtitle && <div style={{ fontSize:30, color:ts, lineHeight:1.65, fontWeight:400 }}>{card.subtitle}</div>}
          <div style={{ height:1, backgroundColor:`${tp}15`, display:'flex' }} />
        </>)}
      </div>
      {/* 푸터 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:24,
        borderTop:`1px solid ${tp}10` }}>
        <span style={{ color:tm, fontSize:20, fontWeight:700, letterSpacing:4 }}>CLIPFLOW</span>
        <span style={{ color:tm, fontSize:24, fontWeight:700 }}>{pad(idx+1)}</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAGAZINE
// ════════════════════════════════════════════════════════════════════════════
function Magazine({ card, total, tp, ts, tm, ac, ac2, tw }: P) {
  const ct = card.cardType; const idx = card.index;
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* 풀-와이드 헤더 바 */}
      <div style={{ background:`linear-gradient(90deg, ${ac}, ${ac2}AA)`,
        padding:'18px 80px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
        <span style={{ color:'#050505', fontSize:22, fontWeight:900, letterSpacing:6 }}>{ct.toUpperCase()}</span>
        <span style={{ color:'#05050570', fontSize:20, fontWeight:700 }}>{pad(idx+1)} / {pad(total)}</span>
      </div>
      {/* 콘텐츠 */}
      <div style={{ display:'flex', flexDirection:'column', flex:1, padding:'60px 80px', justifyContent:'center', gap:28 }}>
        {ct==='title' && (<>
          <div style={{ fontSize:68, fontWeight:tw, color:tp, lineHeight:1.3, letterSpacing:'-0.02em' }}>{card.title}</div>
          {card.subtitle && <div style={{ fontSize:32, color:ts, lineHeight:1.6, fontWeight:400 }}>{card.subtitle}</div>}
          {card.emoji && <span style={{ fontSize:80, marginTop:8 }}>{card.emoji}</span>}
        </>)}
        {(ct==='keypoint'||ct==='data') && (<>
          <div style={{ fontSize:52, fontWeight:tw, color:tp, lineHeight:1.35 }}>{card.title}</div>
          {card.bullets?.slice(0,3).map((b,i) => (
            <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:20 }}>
              <span style={{ color:ac, fontSize:30, fontWeight:900, lineHeight:'1.5' }}>›</span>
              <span style={{ fontSize:30, color:ts, lineHeight:1.55, fontWeight:400 }}>{b}</span>
            </div>
          ))}
        </>)}
        {ct==='highlight' && (<>
          <div style={{ fontSize:30, color:ts, fontWeight:400 }}>{card.title}</div>
          <div style={{ fontSize:160, fontWeight:900, color:ac, lineHeight:1, letterSpacing:'-0.04em' }}>{card.stat}</div>
          {card.statDesc && <div style={{ fontSize:30, color:ts, fontWeight:400, lineHeight:1.5 }}>{card.statDesc}</div>}
        </>)}
        {ct==='quote' && (<>
          <div style={{ fontSize:24, color:tm, fontWeight:700 }}>{card.title}</div>
          <div style={{ fontSize:40, color:tp, lineHeight:1.7, fontWeight:400 }}>
            <span style={{ color:ac, fontWeight:900 }}>"</span>{card.quote}<span style={{ color:ac, fontWeight:900 }}>"</span>
          </div>
          {card.quoteBy && <div style={{ fontSize:26, color:ac, fontWeight:700 }}>{card.quoteBy}</div>}
        </>)}
        {ct==='cta' && (<>
          <div style={{ fontSize:64, fontWeight:tw, color:tp, lineHeight:1.3 }}>{card.title}</div>
          {card.subtitle && <div style={{ fontSize:30, color:ts, lineHeight:1.65, fontWeight:400 }}>{card.subtitle}</div>}
          <div style={{ display:'flex', gap:12, marginTop:8 }}>
            <div style={{ width:80, height:5, backgroundColor:ac, borderRadius:3, display:'flex' }} />
            <div style={{ width:40, height:5, backgroundColor:`${ac}50`, borderRadius:3, display:'flex' }} />
          </div>
        </>)}
      </div>
      {/* 푸터 */}
      <div style={{ display:'flex', alignItems:'center', gap:14, padding:'20px 80px',
        borderTop:`1px solid ${ac}15` }}>
        <div style={{ width:10, height:10, backgroundColor:ac, display:'flex' }} />
        <span style={{ color:tm, fontSize:20, fontWeight:700, letterSpacing:4 }}>CLIPFLOW</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MINIMAL
// ════════════════════════════════════════════════════════════════════════════
function Minimal({ card, total, tp, ts, tm, ac, tw }: P) {
  const ct = card.cardType; const idx = card.index;
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', padding:'80px' }}>
      {/* 헤더: 번호만 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:40 }}>
        <span style={{ color:tm, fontSize:28, fontWeight:700, letterSpacing:3 }}>{pad(idx+1)}</span>
        <span style={{ color:`${tp}20`, fontSize:20, letterSpacing:4 }}>{ct.toUpperCase()}</span>
      </div>
      {/* 얇은 선 */}
      <div style={{ height:1, backgroundColor:`${tp}12`, marginBottom:60, display:'flex' }} />
      {/* 콘텐츠 */}
      <div style={{ display:'flex', flexDirection:'column', flex:1, justifyContent:'center', gap:32 }}>
        {ct==='title' && (<>
          <div style={{ fontSize:70, fontWeight:tw, color:tp, lineHeight:1.25, letterSpacing:'-0.03em' }}>{card.title}</div>
          {card.subtitle && (<>
            <div style={{ height:1, backgroundColor:`${tp}10`, display:'flex' }} />
            <div style={{ fontSize:32, color:ts, lineHeight:1.6, fontWeight:400 }}>{card.subtitle}</div>
          </>)}
        </>)}
        {(ct==='keypoint'||ct==='data') && (<>
          <div style={{ fontSize:52, fontWeight:tw, color:tp, lineHeight:1.35, letterSpacing:'-0.02em' }}>{card.title}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            {card.bullets?.slice(0,3).map((b,i) => (
              <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:20 }}>
                <span style={{ color:`${tp}30`, fontSize:30, lineHeight:'1.5', flexShrink:0 }}>–</span>
                <span style={{ fontSize:30, color:ts, lineHeight:1.55, fontWeight:400 }}>{b}</span>
              </div>
            ))}
          </div>
        </>)}
        {ct==='highlight' && (<>
          <div style={{ fontSize:22, color:tm, fontWeight:700, letterSpacing:5 }}>{card.title?.toUpperCase()}</div>
          <div style={{ fontSize:170, fontWeight:900, color:tp, lineHeight:1, letterSpacing:'-0.05em' }}>{card.stat}</div>
          <div style={{ height:1, backgroundColor:`${tp}10`, display:'flex' }} />
          {card.statDesc && <div style={{ fontSize:30, color:ts, fontWeight:400, lineHeight:1.5 }}>{card.statDesc}</div>}
        </>)}
        {ct==='quote' && (<>
          <div style={{ fontSize:100, color:`${tp}18`, fontWeight:900, lineHeight:1 }}>"</div>
          <div style={{ fontSize:42, color:tp, fontStyle:'italic', lineHeight:1.7, fontWeight:400 }}>{card.quote}</div>
          {card.quoteBy && <div style={{ fontSize:26, color:tm, fontWeight:700 }}>— {card.quoteBy}</div>}
        </>)}
        {ct==='cta' && (<>
          <div style={{ fontSize:64, fontWeight:tw, color:tp, lineHeight:1.3, letterSpacing:'-0.02em' }}>{card.title}</div>
          {card.subtitle && <div style={{ fontSize:30, color:ts, lineHeight:1.65, fontWeight:400 }}>{card.subtitle}</div>}
          <div style={{ height:1, backgroundColor:`${tp}10`, display:'flex', marginTop:8 }} />
        </>)}
      </div>
      {/* 푸터 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:24 }}>
        <div style={{ flex:1, height:1, backgroundColor:`${tp}10`, marginRight:24, display:'flex' }} />
        <span style={{ color:tm, fontSize:18, fontWeight:700, letterSpacing:6 }}>CLIPFLOW</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// INFOGRAPHIC
// ════════════════════════════════════════════════════════════════════════════
function Infographic({ card, total, tp, ts, tm, ac, ac2, tw }: P) {
  const ct = card.cardType; const idx = card.index;
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* 상단 듀얼 액센트 바 */}
      <div style={{ display:'flex', height:8, flexShrink:0 }}>
        <div style={{ flex:2, background:ac, display:'flex' }} />
        <div style={{ flex:1, background:ac2, display:'flex' }} />
      </div>
      {/* 헤더 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
        padding:'24px 80px', borderBottom:`1px solid ${ac}20`, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ width:12, height:12, borderRadius:'50%', backgroundColor:ac, display:'flex' }} />
          <span style={{ color:ac, fontSize:20, fontWeight:700, letterSpacing:4 }}>{ct.toUpperCase()}</span>
        </div>
        <span style={{ color:tm, fontSize:22, fontWeight:700, fontFamily:'monospace' }}>{pad(idx+1)} / {pad(total)}</span>
      </div>
      {/* 콘텐츠 */}
      <div style={{ display:'flex', flexDirection:'column', flex:1, padding:'48px 80px', justifyContent:'center', gap:28 }}>
        {ct==='title' && (
          <div style={{ display:'flex', gap:32, alignItems:'stretch' }}>
            <div style={{ width:8, backgroundColor:ac, borderRadius:4, flexShrink:0, display:'flex' }} />
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ fontSize:64, fontWeight:tw, color:tp, lineHeight:1.3 }}>{card.title}</div>
              {card.subtitle && <div style={{ fontSize:30, color:ts, lineHeight:1.6, fontWeight:400 }}>{card.subtitle}</div>}
            </div>
          </div>
        )}
        {(ct==='keypoint'||ct==='data') && (<>
          <div style={{ fontSize:22, color:ac, fontWeight:700, letterSpacing:4 }}>{card.title?.toUpperCase()}</div>
          {card.bullets?.slice(0,3).map((b,i) => (
            <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:24 }}>
              <div style={{ width:44, height:44, borderRadius:8, flexShrink:0,
                backgroundColor: i===0 ? ac : `${ac}40`, display:'flex',
                alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:24, fontWeight:900, color: i===0 ? '#000' : ac }}>{i+1}</span>
              </div>
              <span style={{ fontSize:30, color:ts, lineHeight:1.55, fontWeight:400, flex:1 }}>{b}</span>
            </div>
          ))}
        </>)}
        {ct==='highlight' && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:24 }}>
            <div style={{ fontSize:22, color:tm, fontWeight:700, letterSpacing:4 }}>{card.title?.toUpperCase()}</div>
            <div style={{ backgroundColor:`${ac}12`, border:`2px solid ${ac}30`, borderRadius:20,
              padding:'32px 80px', display:'flex' }}>
              <span style={{ fontSize:160, fontWeight:900, color:ac, lineHeight:1, letterSpacing:'-0.04em' }}>{card.stat}</span>
            </div>
            <div style={{ height:2, width:500, backgroundColor:`${ac}30`, display:'flex' }} />
            {card.statDesc && <div style={{ fontSize:30, color:ts, textAlign:'center', fontWeight:400 }}>{card.statDesc}</div>}
          </div>
        )}
        {ct==='quote' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <div style={{ fontSize:24, color:tm, fontWeight:700 }}>{card.title}</div>
            <div style={{ borderLeft:`8px solid ${ac}`, backgroundColor:`${ac}10`,
              padding:'24px 36px', borderRadius:'0 12px 12px 0', display:'flex',
              flexDirection:'column', gap:12 }}>
              <div style={{ fontSize:36, color:tp, lineHeight:1.7, fontWeight:400 }}>{card.quote}</div>
              {card.quoteBy && <div style={{ fontSize:26, color:ts, fontWeight:700 }}>— {card.quoteBy}</div>}
            </div>
          </div>
        )}
        {ct==='cta' && (<>
          <div style={{ fontSize:62, fontWeight:tw, color:tp, lineHeight:1.3 }}>{card.title}</div>
          {card.subtitle && <div style={{ fontSize:30, color:ts, lineHeight:1.65, fontWeight:400 }}>{card.subtitle}</div>}
          <div style={{ display:'flex', gap:12 }}>
            <div style={{ width:100, height:6, backgroundColor:ac, borderRadius:3, display:'flex' }} />
            <div style={{ width:50, height:6, backgroundColor:ac2, borderRadius:3, display:'flex' }} />
          </div>
        </>)}
      </div>
      {/* 푸터 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end',
        padding:'16px 80px', borderTop:`1px solid ${ac}15` }}>
        <span style={{ color:tm, fontSize:18, fontWeight:700, letterSpacing:6, fontFamily:'monospace' }}>CLIPFLOW</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SPLIT  (Remotion split-screen)
// ════════════════════════════════════════════════════════════════════════════
function Split({ card, total, tp, ts, tm, ac, ac2, tw }: P) {
  const ct = card.cardType; const idx = card.index;
  return (
    <div style={{ display:'flex', height:'100%' }}>
      {/* 좌측 솔리드 패널 */}
      <div style={{ width:320, backgroundColor:ac, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'space-between', padding:'60px 24px', flexShrink:0 }}>
        <span style={{ color:'rgba(0,0,0,0.25)', fontSize:16, fontWeight:700, letterSpacing:5 }}>CLIPFLOW</span>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
          <span style={{ color:'rgba(0,0,0,0.9)', fontWeight:900, fontSize:100, lineHeight:1 }}>{pad(idx+1)}</span>
          <div style={{ width:60, height:2, backgroundColor:'rgba(0,0,0,0.25)', display:'flex' }} />
          <span style={{ color:'rgba(0,0,0,0.5)', fontSize:28, fontWeight:700 }}>{pad(total)}</span>
        </div>
        <span style={{ color:'rgba(0,0,0,0.35)', fontSize:20, fontWeight:700, letterSpacing:5 }}>{ct.toUpperCase()}</span>
      </div>
      {/* 우측 콘텐츠 */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'60px 80px', gap:28 }}>
        {ct==='title' && (<>
          <div style={{ backgroundColor:`${ac}20`, border:`1px solid ${ac}40`, borderRadius:8, padding:'6px 24px', display:'flex', alignSelf:'flex-start' }}>
            <span style={{ color:ac2, fontSize:20, fontWeight:900, letterSpacing:4 }}>NEW</span>
          </div>
          <div style={{ fontSize:66, fontWeight:tw, color:tp, lineHeight:1.3, letterSpacing:'-0.02em' }}>{card.title}</div>
          {card.subtitle && <div style={{ fontSize:30, color:ts, lineHeight:1.6, fontWeight:400 }}>{card.subtitle}</div>}
        </>)}
        {(ct==='keypoint'||ct==='data') && (<>
          <div style={{ fontSize:22, color:ac2, fontWeight:700, letterSpacing:4 }}>{card.title?.toUpperCase()}</div>
          {card.bullets?.slice(0,3).map((b,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:20 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', backgroundColor: i===0 ? ac : `${ac}50`, flexShrink:0, display:'flex' }} />
              <span style={{ fontSize:30, color:ts, lineHeight:1.55, fontWeight:400 }}>{b}</span>
            </div>
          ))}
        </>)}
        {ct==='highlight' && (<>
          <div style={{ fontSize:30, color:ts, fontWeight:400 }}>{card.title}</div>
          <div style={{ fontSize:160, fontWeight:900, color:ac, lineHeight:1, letterSpacing:'-0.04em' }}>{card.stat}</div>
          {card.statDesc && <div style={{ fontSize:30, color:ts, fontWeight:400 }}>{card.statDesc}</div>}
        </>)}
        {ct==='quote' && (<>
          <div style={{ fontSize:100, color:`${ac}50`, fontWeight:900, lineHeight:1 }}>"</div>
          <div style={{ fontSize:40, color:tp, fontStyle:'italic', lineHeight:1.7, fontWeight:400 }}>{card.quote}</div>
          {card.quoteBy && <div style={{ fontSize:26, color:ts, fontWeight:700 }}>— {card.quoteBy}</div>}
        </>)}
        {ct==='cta' && (<>
          <div style={{ fontSize:62, fontWeight:tw, color:tp, lineHeight:1.3 }}>{card.title}</div>
          {card.subtitle && <div style={{ fontSize:30, color:ts, lineHeight:1.65, fontWeight:400 }}>{card.subtitle}</div>}
          <div style={{ backgroundColor:ac, borderRadius:60, padding:'18px 60px', display:'flex', alignSelf:'flex-start' }}>
            <span style={{ fontSize:26, fontWeight:900, color:'#050505' }}>팔로우</span>
          </div>
        </>)}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// KINETIC  (Remotion kinetic typography)
// ════════════════════════════════════════════════════════════════════════════
function Kinetic({ card, total, tp, ts, tm, ac, ac2, tw }: P) {
  const ct = card.cardType; const idx = card.index;
  const bigWord = (card.title || '').split(' ')[0]?.toUpperCase() ?? 'TEXT';
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', position:'relative', overflow:'hidden' }}>
      {/* 배경 거대 텍스트 */}
      <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%) rotate(-10deg)',
        fontSize:480, fontWeight:900, color:ac, opacity:0.06, lineHeight:1,
        whiteSpace:'nowrap', letterSpacing:'-0.04em', display:'flex' }}>
        {bigWord}
      </div>
      {/* 상단 듀얼 바 */}
      <div style={{ display:'flex', height:8, flexShrink:0 }}>
        <div style={{ flex:2, backgroundColor:ac, display:'flex' }} />
        <div style={{ flex:1, backgroundColor:ac2, display:'flex' }} />
      </div>
      {/* 헤더 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'32px 80px 16px', flexShrink:0 }}>
        <span style={{ color:ac, fontWeight:900, fontSize:40, letterSpacing:'-0.02em' }}>{pad(idx+1)}</span>
        <span style={{ color:tm, fontSize:20, fontWeight:700, letterSpacing:5 }}>{ct.toUpperCase()}</span>
      </div>
      {/* 콘텐츠 */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'0 80px', gap:28, position:'relative' }}>
        {ct==='title' && (<>
          <div style={{ fontSize:72, fontWeight:tw, color:ac, lineHeight:1.2, letterSpacing:'-0.03em' }}>{card.title}</div>
          {card.subtitle && <div style={{ fontSize:30, color:ts, lineHeight:1.6, fontWeight:400 }}>{card.subtitle}</div>}
        </>)}
        {(ct==='keypoint'||ct==='data') && (<>
          <div style={{ fontSize:54, fontWeight:tw, color:tp, lineHeight:1.35, letterSpacing:'-0.02em' }}>{card.title}</div>
          {card.bullets?.slice(0,3).map((b,i) => (
            <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:20 }}>
              <span style={{ color:ac, fontSize:36, fontWeight:900, lineHeight:'1.4', flexShrink:0 }}>/</span>
              <span style={{ fontSize:30, color:ts, lineHeight:1.55, fontWeight:400 }}>{b}</span>
            </div>
          ))}
        </>)}
        {ct==='highlight' && (<>
          <div style={{ fontSize:22, color:tm, fontWeight:700, letterSpacing:6 }}>{card.title?.toUpperCase()}</div>
          <div style={{ fontSize:180, fontWeight:900, color:ac, lineHeight:1, letterSpacing:'-0.05em' }}>{card.stat}</div>
          {card.statDesc && <div style={{ fontSize:30, color:ts, fontWeight:400, lineHeight:1.5 }}>{card.statDesc}</div>}
        </>)}
        {ct==='quote' && (<>
          <div style={{ fontSize:100, color:`${ac}50`, fontWeight:900, lineHeight:1 }}>"</div>
          <div style={{ fontSize:42, color:tp, fontStyle:'italic', lineHeight:1.7, fontWeight:500 }}>{card.quote}</div>
          {card.quoteBy && <div style={{ fontSize:28, color:ac2, fontWeight:700 }}>— {card.quoteBy}</div>}
        </>)}
        {ct==='cta' && (<>
          <div style={{ fontSize:68, fontWeight:tw, color:tp, lineHeight:1.3, letterSpacing:'-0.02em' }}>{card.title}</div>
          {card.subtitle && <div style={{ fontSize:30, color:ts, lineHeight:1.65, fontWeight:400 }}>{card.subtitle}</div>}
          <div style={{ display:'flex', gap:16, marginTop:8 }}>
            <div style={{ width:100, height:5, backgroundColor:ac, borderRadius:3, display:'flex' }} />
            <div style={{ width:50, height:5, backgroundColor:ac2, borderRadius:3, display:'flex' }} />
          </div>
        </>)}
      </div>
      {/* 푸터 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'24px 80px' }}>
        <div style={{ flex:1, height:1, backgroundColor:`${tp}10`, marginRight:24, display:'flex' }} />
        <span style={{ color:tm, fontSize:18, fontWeight:700, letterSpacing:6 }}>CLIPFLOW</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// BROADCAST  (Remotion lower-third graphics)
// ════════════════════════════════════════════════════════════════════════════
function Broadcast({ card, total, tp, ts, tm, ac, ac2, tw }: P) {
  const ct = card.cardType; const idx = card.index;
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* 상단 티커 바 */}
      <div style={{ height:6, backgroundColor:ac, flexShrink:0, display:'flex' }} />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'18px 80px', backgroundColor:`${ac}12`, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ width:14, height:14, borderRadius:'50%', backgroundColor:ac, display:'flex' }} />
          <span style={{ color:ac, fontSize:22, fontWeight:900, letterSpacing:5 }}>LIVE</span>
        </div>
        <span style={{ color:tm, fontSize:20, fontWeight:700 }}>{pad(idx+1)} / {pad(total)}</span>
      </div>
      {/* 콘텐츠 */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'48px 80px', gap:28 }}>
        {ct==='title' && (<>
          <div style={{ fontSize:68, fontWeight:tw, color:tp, lineHeight:1.3 }}>{card.title}</div>
          {card.subtitle && <div style={{ fontSize:32, color:ts, lineHeight:1.6, fontWeight:400 }}>{card.subtitle}</div>}
        </>)}
        {(ct==='keypoint'||ct==='data') && (<>
          <div style={{ fontSize:52, fontWeight:tw, color:tp, lineHeight:1.35 }}>{card.title}</div>
          {card.bullets?.slice(0,3).map((b,i) => (
            <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:20 }}>
              <span style={{ color:ac, fontSize:28, fontWeight:700, lineHeight:'1.5' }}>▸</span>
              <span style={{ fontSize:30, color:ts, lineHeight:1.55, fontWeight:400 }}>{b}</span>
            </div>
          ))}
        </>)}
        {ct==='highlight' && (<>
          <div style={{ fontSize:30, color:ts, fontWeight:400 }}>{card.title}</div>
          <div style={{ fontSize:160, fontWeight:900, color:ac, lineHeight:1, letterSpacing:'-0.04em' }}>{card.stat}</div>
          {card.statDesc && <div style={{ fontSize:30, color:ts, fontWeight:400, lineHeight:1.5 }}>{card.statDesc}</div>}
        </>)}
        {ct==='quote' && (<>
          <div style={{ fontSize:24, color:tm, fontWeight:700 }}>{card.title}</div>
          <div style={{ fontSize:42, color:tp, fontStyle:'italic', lineHeight:1.7, fontWeight:400 }}>"{card.quote}"</div>
          {card.quoteBy && <div style={{ fontSize:28, color:ac2, fontWeight:700 }}>— {card.quoteBy}</div>}
        </>)}
        {ct==='cta' && (<>
          <div style={{ fontSize:64, fontWeight:tw, color:tp, lineHeight:1.3 }}>{card.title}</div>
          {card.subtitle && <div style={{ fontSize:30, color:ts, lineHeight:1.65, fontWeight:400 }}>{card.subtitle}</div>}
        </>)}
      </div>
      {/* 하단 슬레이트 (Lower Third) */}
      <div style={{ backgroundColor:ac, padding:'20px 80px', flexShrink:0, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ color:'#000', fontSize:28, fontWeight:900, letterSpacing:2 }}>
          {ct==='cta' ? 'FOLLOW NOW' : ct.toUpperCase()}
        </span>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ width:2, height:24, backgroundColor:'rgba(0,0,0,0.3)', display:'flex' }} />
          <span style={{ color:'rgba(0,0,0,0.5)', fontSize:20, fontWeight:700, letterSpacing:4 }}>CLIPFLOW</span>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CINEMATIC  (Remotion film aesthetic)
// ════════════════════════════════════════════════════════════════════════════
function Cinematic({ card, total, tp, ts, tm, ac, tw }: P) {
  const ct = card.cardType; const idx = card.index;
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', position:'relative' }}>
      {/* 상단 레터박스 */}
      <div style={{ height:140, backgroundColor:'#000000', flexShrink:0, display:'flex',
        alignItems:'center', justifyContent:'space-between', padding:'0 80px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:20 }}>
          <div style={{ width:30, height:2, backgroundColor:ac, display:'flex' }} />
          <span style={{ color:`${ac}80`, fontSize:20, fontWeight:700, letterSpacing:5 }}>{ct.toUpperCase()}</span>
        </div>
        <span style={{ color:`${tp}25`, fontSize:20, letterSpacing:4 }}>{pad(idx+1)}/{pad(total)}</span>
      </div>
      {/* 대각선 액센트 라인 */}
      <div style={{ position:'absolute', top:140, right:0, width:600, height:2,
        background:`linear-gradient(to left, ${ac}60, transparent)`, display:'flex' }} />
      {/* 콘텐츠 */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'60px 80px', gap:28 }}>
        {ct==='title' && (<>
          <div style={{ fontSize:68, fontWeight:tw, color:tp, lineHeight:1.25, letterSpacing:'0.02em' }}>{card.title}</div>
          {card.subtitle && (<>
            <div style={{ width:60, height:2, backgroundColor:ac, display:'flex' }} />
            <div style={{ fontSize:30, color:ts, lineHeight:1.6, fontWeight:400, letterSpacing:'0.02em' }}>{card.subtitle}</div>
          </>)}
        </>)}
        {(ct==='keypoint'||ct==='data') && (<>
          <div style={{ fontSize:22, color:ac, fontWeight:700, letterSpacing:5 }}>{card.title?.toUpperCase()}</div>
          {card.bullets?.slice(0,3).map((b,i) => (
            <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:20 }}>
              <div style={{ width:3, alignSelf:'stretch', backgroundColor:`${ac}50`, display:'flex', flexShrink:0 }} />
              <span style={{ fontSize:30, color:ts, lineHeight:1.55, fontWeight:400 }}>{b}</span>
            </div>
          ))}
        </>)}
        {ct==='highlight' && (<>
          <div style={{ fontSize:22, color:tm, fontWeight:700, letterSpacing:6 }}>{card.title?.toUpperCase()}</div>
          <div style={{ fontSize:160, fontWeight:900, color:ac, lineHeight:1, letterSpacing:'-0.04em' }}>{card.stat}</div>
          <div style={{ height:1, backgroundColor:`${tp}12`, display:'flex' }} />
          {card.statDesc && <div style={{ fontSize:30, color:ts, fontWeight:400, lineHeight:1.5 }}>{card.statDesc}</div>}
        </>)}
        {ct==='quote' && (<>
          <div style={{ fontSize:22, color:tm, fontWeight:700, letterSpacing:5 }}>{card.title?.toUpperCase()}</div>
          <div style={{ fontSize:42, color:tp, fontStyle:'italic', lineHeight:1.7, fontWeight:400, letterSpacing:'0.01em' }}>"{card.quote}"</div>
          {card.quoteBy && <div style={{ fontSize:26, color:ac, fontWeight:700, letterSpacing:3 }}>— {card.quoteBy}</div>}
        </>)}
        {ct==='cta' && (<>
          <div style={{ fontSize:64, fontWeight:tw, color:tp, lineHeight:1.3, letterSpacing:'0.02em' }}>{card.title}</div>
          {card.subtitle && <div style={{ fontSize:30, color:ts, lineHeight:1.65, fontWeight:400, letterSpacing:'0.02em' }}>{card.subtitle}</div>}
          <div style={{ display:'flex', alignItems:'center', gap:20, marginTop:8 }}>
            <div style={{ width:40, height:2, backgroundColor:ac, display:'flex' }} />
            <span style={{ color:ac, fontSize:24, fontWeight:700, letterSpacing:4 }}>FOLLOW</span>
          </div>
        </>)}
      </div>
      {/* 하단 레터박스 */}
      <div style={{ height:100, backgroundColor:'#000000', flexShrink:0, display:'flex',
        alignItems:'center', justifyContent:'flex-end', padding:'0 80px' }}>
        <span style={{ color:`${tp}20`, fontSize:18, fontWeight:700, letterSpacing:6 }}>CLIPFLOW</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TIMELINE  (Remotion sequence animation)
// ════════════════════════════════════════════════════════════════════════════
function Timeline({ card, total, tp, ts, tm, ac, ac2, tw }: P) {
  const ct = card.cardType; const idx = card.index;
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', padding:'80px' }}>
      {/* 헤더 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:32 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ width:20, height:20, borderRadius:'50%', backgroundColor:ac, border:`3px solid ${ac2}`, display:'flex' }} />
          <span style={{ color:ac, fontSize:22, fontWeight:700, letterSpacing:4 }}>{ct.toUpperCase()}</span>
        </div>
        <span style={{ color:tm, fontSize:22, fontWeight:700 }}>{pad(idx+1)} / {pad(total)}</span>
      </div>
      <div style={{ height:1, backgroundColor:`${ac}25`, marginBottom:48, display:'flex' }} />
      {/* 콘텐츠 */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center' }}>
        {ct==='title' && (
          <div style={{ display:'flex', gap:40, alignItems:'stretch' }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:24, flexShrink:0 }}>
              <div style={{ width:24, height:24, borderRadius:'50%', backgroundColor:ac, display:'flex' }} />
              <div style={{ width:3, flex:1, background:`linear-gradient(to bottom, ${ac}, transparent)`, display:'flex', marginTop:8 }} />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <div style={{ fontSize:64, fontWeight:tw, color:tp, lineHeight:1.3 }}>{card.title}</div>
              {card.subtitle && <div style={{ fontSize:30, color:ts, lineHeight:1.6, fontWeight:400 }}>{card.subtitle}</div>}
            </div>
          </div>
        )}
        {(ct==='keypoint'||ct==='data') && (
          <div style={{ display:'flex', gap:40, alignItems:'stretch' }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:24, flexShrink:0, position:'relative' }}>
              <div style={{ position:'absolute', top:12, bottom:12, left:11, width:3,
                background:`linear-gradient(to bottom, ${ac}80, transparent)`, display:'flex' }} />
              {card.bullets?.slice(0,3).map((_,i) => (
                <div key={i} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', zIndex:1 }}>
                  <div style={{ width: i===0 ? 20 : 14, height: i===0 ? 20 : 14, borderRadius:'50%',
                    backgroundColor: i===0 ? ac : `${ac}40`, border:`2px solid ${i===0 ? ac : `${ac}60`}`, display:'flex' }} />
                </div>
              ))}
            </div>
            <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'space-around', gap:8 }}>
              <div style={{ fontSize:22, color:ac, fontWeight:700, letterSpacing:4 }}>{card.title?.toUpperCase()}</div>
              {card.bullets?.slice(0,3).map((b,i) => (
                <div key={i} style={{ fontSize: i===0 ? 32 : 28, color: i===0 ? tp : ts,
                  fontWeight: i===0 ? 600 : 400, lineHeight:1.5 }}>{b}</div>
              ))}
            </div>
          </div>
        )}
        {ct==='highlight' && (
          <div style={{ display:'flex', gap:40, alignItems:'center' }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:24, flexShrink:0, alignSelf:'stretch' }}>
              <div style={{ width:24, height:24, borderRadius:'50%', backgroundColor:ac, display:'flex' }} />
              <div style={{ width:3, flex:1, background:`linear-gradient(to bottom, ${ac}60, transparent)`, display:'flex', marginTop:8 }} />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ fontSize:26, color:tm, fontWeight:700, letterSpacing:4 }}>{card.title?.toUpperCase()}</div>
              <div style={{ fontSize:160, fontWeight:900, color:ac, lineHeight:1, letterSpacing:'-0.04em' }}>{card.stat}</div>
              {card.statDesc && <div style={{ fontSize:28, color:ts, fontWeight:400, lineHeight:1.5 }}>{card.statDesc}</div>}
            </div>
          </div>
        )}
        {ct==='quote' && (
          <div style={{ display:'flex', gap:32 }}>
            <div style={{ width:6, backgroundColor:ac, borderRadius:3, flexShrink:0, display:'flex' }} />
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <div style={{ fontSize:42, color:tp, fontStyle:'italic', lineHeight:1.7, fontWeight:400 }}>"{card.quote}"</div>
              {card.quoteBy && <div style={{ fontSize:28, color:ac2, fontWeight:700 }}>— {card.quoteBy}</div>}
            </div>
          </div>
        )}
        {ct==='cta' && (
          <div style={{ display:'flex', gap:40, alignItems:'stretch' }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:24, flexShrink:0 }}>
              <div style={{ width:24, height:24, borderRadius:'50%', backgroundColor:ac, display:'flex' }} />
              <div style={{ width:3, flex:1, background:`linear-gradient(to bottom, ${ac}, ${ac2}40)`, display:'flex', marginTop:8 }} />
              <div style={{ width:16, height:16, borderRadius:'50%', backgroundColor:ac2, opacity:0.6, display:'flex' }} />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:20, justifyContent:'center' }}>
              <div style={{ fontSize:62, fontWeight:tw, color:tp, lineHeight:1.3 }}>{card.title}</div>
              {card.subtitle && <div style={{ fontSize:30, color:ts, lineHeight:1.65, fontWeight:400 }}>{card.subtitle}</div>}
            </div>
          </div>
        )}
      </div>
      {/* 푸터 */}
      <div style={{ display:'flex', alignItems:'center', gap:16, paddingTop:24, marginTop:16, borderTop:`1px solid ${ac}15` }}>
        <div style={{ width:3, height:20, backgroundColor:ac, display:'flex' }} />
        <span style={{ color:tm, fontSize:18, fontWeight:700, letterSpacing:5 }}>CLIPFLOW</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// GLASS  (Remotion glassmorphism UI)
// ════════════════════════════════════════════════════════════════════════════
function Glass({ card, total, tp, ts, tm, ac, ac2, tw }: P) {
  const ct = card.cardType; const idx = card.index;
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', padding:'40px' }}>
      {/* 글래스 패널 */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', borderRadius:24,
        backgroundColor:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.10)', overflow:'hidden' }}>
        {/* 상단 오로라 경계선 */}
        <div style={{ height:2, background:`linear-gradient(90deg, transparent, ${ac}80, ${ac2}60, transparent)`, flexShrink:0, display:'flex' }} />
        {/* 헤더 */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'32px 60px 20px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:16, height:16, borderRadius:'50%', backgroundColor:ac, display:'flex' }} />
            <div style={{ width:12, height:12, borderRadius:'50%', backgroundColor:ac2, display:'flex' }} />
            <div style={{ width:10, height:10, borderRadius:'50%', backgroundColor:`${tp}30`, display:'flex' }} />
          </div>
          <span style={{ color:tm, fontSize:20, fontWeight:700, letterSpacing:3 }}>{pad(idx+1)} / {pad(total)}</span>
        </div>
        {/* 콘텐츠 */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'0 60px 40px', gap:28 }}>
          {ct==='title' && (<>
            <div style={{ background:`linear-gradient(135deg, ${ac}30, ${ac2}18)`,
              border:`1px solid ${ac}35`, borderRadius:10, padding:'8px 28px', display:'flex', alignSelf:'flex-start' }}>
              <span style={{ color:ac, fontSize:20, fontWeight:900, letterSpacing:4 }}>START</span>
            </div>
            <div style={{ fontSize:66, fontWeight:tw, color:tp, lineHeight:1.3 }}>{card.title}</div>
            {card.subtitle && <div style={{ fontSize:30, color:ts, lineHeight:1.6, fontWeight:400 }}>{card.subtitle}</div>}
          </>)}
          {(ct==='keypoint'||ct==='data') && (<>
            <div style={{ fontSize:52, fontWeight:tw, color:tp, lineHeight:1.35 }}>{card.title}</div>
            <div style={{ height:1, background:`linear-gradient(90deg, ${ac}40, transparent)`, display:'flex' }} />
            {card.bullets?.slice(0,3).map((b,i) => (
              <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:0,
                backgroundColor: i===0 ? `${ac}10` : 'transparent',
                borderLeft: `4px solid ${i===0 ? ac : `${ac}25`}`,
                padding:'8px 20px', borderRadius:'0 8px 8px 0' }}>
                <span style={{ fontSize:30, color:ts, lineHeight:1.55, fontWeight:400 }}>{b}</span>
              </div>
            ))}
          </>)}
          {ct==='highlight' && (<>
            <div style={{ fontSize:22, color:tm, fontWeight:700, letterSpacing:5 }}>{card.title?.toUpperCase()}</div>
            <div style={{ background:`linear-gradient(135deg, ${ac}20, ${ac2}12)`,
              border:`1px solid ${ac}28`, borderRadius:16, padding:'32px 60px', display:'flex', alignSelf:'center' }}>
              <span style={{ fontSize:160, fontWeight:900, color:ac, lineHeight:1, letterSpacing:'-0.04em' }}>{card.stat}</span>
            </div>
            {card.statDesc && <div style={{ fontSize:28, color:ts, textAlign:'center', fontWeight:400 }}>{card.statDesc}</div>}
          </>)}
          {ct==='quote' && (<>
            <div style={{ fontSize:100, color:`${ac}45`, fontWeight:900, lineHeight:1 }}>"</div>
            <div style={{ fontSize:40, color:tp, fontStyle:'italic', lineHeight:1.7, fontWeight:400 }}>{card.quote}</div>
            {card.quoteBy && <div style={{ fontSize:26, color:ac2, fontWeight:700 }}>— {card.quoteBy}</div>}
          </>)}
          {ct==='cta' && (<>
            <div style={{ fontSize:62, fontWeight:tw, color:tp, lineHeight:1.3 }}>{card.title}</div>
            {card.subtitle && <div style={{ fontSize:30, color:ts, lineHeight:1.65, fontWeight:400 }}>{card.subtitle}</div>}
            <div style={{ background:`linear-gradient(135deg, ${ac}, ${ac2})`, borderRadius:60,
              padding:'20px 64px', display:'flex', alignSelf:'flex-start', marginTop:12 }}>
              <span style={{ fontSize:28, fontWeight:900, color:'#050505' }}>팔로우 &amp; 구독</span>
            </div>
          </>)}
        </div>
        {/* 하단 오로라 경계선 */}
        <div style={{ height:2, background:`linear-gradient(90deg, transparent, ${ac2}60, ${ac}40, transparent)`, flexShrink:0, display:'flex' }} />
      </div>
      {/* 외부 푸터 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', paddingTop:20 }}>
        <span style={{ color:tm, fontSize:16, fontWeight:700, letterSpacing:6 }}>CLIPFLOW</span>
      </div>
    </div>
  );
}
