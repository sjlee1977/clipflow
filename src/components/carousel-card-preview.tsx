/**
 * CarouselCardPreview — 12가지 레이아웃 × 6가지 카드 타입
 *
 * 기존 6:
 *   bold-left   미드나잇 네이비 / 엠버 글로우 / 불 마켓
 *   centered    골드 누아르 / 선셋 앰버 / 벨벳 로즈
 *   editorial   포레스트 딥 / 마인드풀 젠
 *   magazine    네온 사이버 / 신스웨이브
 *   minimal     옵시디언 퓨어
 *   infographic 인포그래픽 클린
 *
 * Remotion 참조 6:
 *   split       코발트 스플릿
 *   kinetic     애시드 키네틱
 *   broadcast   스튜디오 브로드캐스트
 *   cinematic   누아르 시네마
 *   timeline    프로세스 블루
 *   glass       오로라 글래스
 */

export interface CarouselCardData {
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
  bgGradient?:      string;
  accentColor?:     string;
  accentSecondary?: string;
  textPrimary?:     string;
  textSecondary?:   string;
  textMuted?:       string;
  fontFamily?:      string;
  titleFontWeight?: number;
  letterSpacing?:   string;
  styleId?:         string;
  layout?:          string;
}

// ── 기본값 ───────────────────────────────────────────────────────────────────
const NOISE_SVG = "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")";

// ── 공유 Props ────────────────────────────────────────────────────────────────
interface CardProps {
  card: CarouselCardData;
  total: number;
  tp: string; ts: string; tm: string;
  ac: string; ac2: string;
  tw: number; ff: string; ls: string;
}

// ── 카드 번호 포맷 ────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');

// ── 텍스트 오버플로우 방지 공통 스타일 ──────────────────────────────────────────
// overflowWrap:'break-word'로 필요 시에만 줄바꿈 (break-all은 flex-basis:0 조합 시 1자 단위 깨짐 유발)
const TW = { overflowWrap: 'break-word' as const };
// flex-row 내부 span용: minWidth:0 + flex:1 1 auto (basis를 0px로 하면 break-word가 문자 단위로 깨짐)
const TWF = { minWidth: 0, flex: '1 1 auto' as const, overflowWrap: 'break-word' as const };

// ════════════════════════════════════════════════════════════════════════════
// LAYOUT 1 — BOLD-LEFT
// 좌측 수직 액센트 바, 강한 타이포, 점 마커
// ════════════════════════════════════════════════════════════════════════════
function BoldLeftCard({ card, total, tp, ts, tm, ac, tw }: CardProps) {
  const { cardType: ct, index: idx } = card;
  return (
    <div className="relative h-full flex flex-col p-3.5">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span style={{ color: tm }} className="text-[8px] font-bold tracking-widest">{pad(idx+1)}/{pad(total)}</span>
          <span style={{ background: `${ac}20`, color: ac, border: `1px solid ${ac}40` }}
            className="text-[7px] px-1.5 py-0.5 rounded-sm uppercase font-bold tracking-wider">{ct}</span>
        </div>
        {card.emoji && <span className="text-sm leading-none">{card.emoji}</span>}
      </div>

      {/* 콘텐츠 — 명시적 flex-col div로 fragment 대신 사용, 레이아웃 보장 */}
      <div className="flex-1 flex flex-col justify-center pl-2.5 overflow-hidden min-w-0" style={{ borderLeft: `2px solid ${ac}` }}>
        {ct === 'title' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'6px', width:'100%' }}>
            <p style={{ ...TW, color: tp, fontWeight: tw, letterSpacing: '-0.02em' }} className="text-[13px] leading-tight">{card.title}</p>
            {card.subtitle && <p style={{ ...TW, color: ts }} className="text-[9px] leading-relaxed">{card.subtitle}</p>}
          </div>
        )}
        {(ct === 'keypoint' || ct === 'data') && (
          <div style={{ display:'flex', flexDirection:'column', gap:'4px', width:'100%' }}>
            <p style={{ ...TW, color: tp, fontWeight: Math.min(tw, 700) }} className="text-[11px] leading-tight">{card.title}</p>
            {card.bullets?.slice(0,3).map((b,i) => (
              <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:'6px', width:'100%' }}>
                <div style={{ background: ac, width: '4px', height: '4px', borderRadius: '50%', flexShrink: 0, marginTop: '4px' }} />
                <span style={{ ...TWF, color: ts }} className="text-[8.5px] leading-snug">{b}</span>
              </div>
            ))}
          </div>
        )}
        {ct === 'highlight' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'6px', width:'100%' }}>
            <p style={{ ...TW, color: ts }} className="w-full text-[8.5px]">{card.title}</p>
            <p style={{ ...TW, color: ac, fontWeight: 900, letterSpacing: '-0.04em' }} className="w-full text-[22px] leading-none">{card.stat}</p>
            {card.statDesc && <p style={{ ...TW, color: tm }} className="w-full text-[8px]">{card.statDesc}</p>}
          </div>
        )}
        {ct === 'quote' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'4px', width:'100%' }}>
            <p style={{ ...TW, color: tm }} className="w-full text-[8px]">{card.title}</p>
            <p style={{ ...TW, color: tp, fontStyle: 'italic', fontWeight: 500 }} className="w-full text-[9.5px] leading-snug">"{card.quote}"</p>
            {card.quoteBy && <p style={{ ...TW, color: tm }} className="w-full text-[8px]">— {card.quoteBy}</p>}
          </div>
        )}
        {ct === 'cta' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'6px', width:'100%' }}>
            <p style={{ ...TW, color: tp, fontWeight: tw }} className="w-full text-[12px] leading-tight">{card.title}</p>
            {card.subtitle && <p style={{ ...TW, color: ts }} className="w-full text-[8.5px] leading-relaxed">{card.subtitle}</p>}
            <div style={{ background: ac, height: '2px', width: '20px', borderRadius: '1px' }} />
          </div>
        )}
      </div>

      {/* 푸터 */}
      <div className="flex items-center justify-end mt-1.5">
        <div className="flex items-center gap-1" style={{ opacity: 0.18 }}>
          <div style={{ background: ac }} className="w-1 h-1" />
          <span style={{ color: tp, letterSpacing: '0.12em' }} className="text-[6.5px] font-black uppercase">Clipflow</span>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LAYOUT 2 — CENTERED
// 전체 중앙 정렬, 원형 배지, 언더라인 바
// ════════════════════════════════════════════════════════════════════════════
function CenteredCard({ card, total, tp, ts, tm, ac, ac2, tw }: CardProps) {
  const { cardType: ct, index: idx } = card;
  return (
    <div className="relative h-full flex flex-col p-3.5">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-1.5">
        <span style={{ color: tm }} className="text-[8px] font-bold tracking-widest">{pad(idx+1)}/{pad(total)}</span>
        {card.emoji && <span className="text-sm leading-none">{card.emoji}</span>}
      </div>

      {/* 중앙 콘텐츠 */}
      <div className="flex-1 flex flex-col items-center justify-center text-center overflow-hidden min-w-0">
        {ct === 'title' && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'6px', width:'100%' }}>
            <div style={{ background: `${ac}20`, border: `1px solid ${ac}50`, borderRadius: '999px', padding: '2px 10px' }}>
              <span style={{ color: ac, letterSpacing: '0.12em' }} className="text-[7px] font-black uppercase">INTRO</span>
            </div>
            <p style={{ ...TW, color: tp, fontWeight: tw, letterSpacing: '-0.02em', textAlign: 'center' }} className="text-[13px] leading-tight">{card.title}</p>
            <div style={{ background: ac, height: '2px', width: '24px', borderRadius: '1px' }} />
            {card.subtitle && <p style={{ ...TW, color: ts, textAlign: 'center' }} className="text-[8.5px] leading-relaxed">{card.subtitle}</p>}
          </div>
        )}
        {(ct === 'keypoint' || ct === 'data') && (
          <div style={{ display:'flex', flexDirection:'column', gap:'4px', width:'100%' }}>
            <p style={{ ...TW, color: tp, fontWeight: Math.min(tw, 700), textAlign: 'center' }} className="text-[11px] leading-tight">{card.title}</p>
            <div style={{ background: `${ac}30`, height: '1px', width: '100%' }} />
            {card.bullets?.slice(0,3).map((b,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:'6px', width:'100%' }}>
                <div style={{ background: ac, width: '3px', height: '3px', borderRadius: '50%', flexShrink: 0 }} />
                <span style={{ ...TWF, color: ts, textAlign:'left' }} className="text-[8.5px] leading-snug">{b}</span>
              </div>
            ))}
          </div>
        )}
        {ct === 'highlight' && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'6px', width:'100%' }}>
            <p style={{ ...TW, color: ts, textAlign: 'center' }} className="text-[8.5px]">{card.title}</p>
            <p style={{ ...TW, color: ac, fontWeight: 900, letterSpacing: '-0.04em', textAlign: 'center' }} className="text-[22px] leading-none">{card.stat}</p>
            <div style={{ background: `linear-gradient(90deg,${ac},${ac2})`, height: '2px', width: '32px', borderRadius: '1px' }} />
            {card.statDesc && <p style={{ ...TW, color: tm, textAlign: 'center' }} className="text-[8px]">{card.statDesc}</p>}
          </div>
        )}
        {ct === 'quote' && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', width:'100%' }}>
            <span style={{ color: `${ac}60`, fontSize: '22px', lineHeight: 1 }}>"</span>
            <p style={{ ...TW, color: tp, fontStyle: 'italic', fontWeight: 500, textAlign: 'center' }} className="text-[9.5px] leading-snug">{card.quote}</p>
            {card.quoteBy && <p style={{ ...TW, color: tm, textAlign: 'center' }} className="text-[8px]">— {card.quoteBy}</p>}
          </div>
        )}
        {ct === 'cta' && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'6px', width:'100%' }}>
            <p style={{ ...TW, color: tp, fontWeight: tw, textAlign: 'center' }} className="text-[12px] leading-tight">{card.title}</p>
            {card.subtitle && <p style={{ ...TW, color: ts, textAlign: 'center' }} className="text-[8.5px] leading-relaxed">{card.subtitle}</p>}
            <div style={{ background: ac, borderRadius: '999px', padding: '3px 12px', marginTop: '2px' }}>
              <span style={{ color: '#050505', fontSize: '8px', fontWeight: 900, letterSpacing: '0.05em' }}>FOLLOW</span>
            </div>
          </div>
        )}
      </div>

      {/* 푸터 */}
      <div className="flex items-center justify-center mt-1.5">
        <div className="flex items-center gap-1" style={{ opacity: 0.16 }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: ac }} />
          <span style={{ color: tp, letterSpacing: '0.12em' }} className="text-[6.5px] font-black uppercase">Clipflow</span>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LAYOUT 3 — EDITORIAL
// 배경 거대 카드번호, 카테고리 오버라인, 얇은 선
// ════════════════════════════════════════════════════════════════════════════
function EditorialCard({ card, total, tp, ts, tm, ac, tw, ls }: CardProps) {
  const { cardType: ct, index: idx } = card;
  return (
    <div className="relative h-full flex flex-col p-3.5 overflow-hidden">
      {/* 배경 거대 카드번호 */}
      <div className="absolute" style={{
        right: '-8px', bottom: '-12px',
        fontSize: '90px', fontWeight: 900,
        color: tp, opacity: 0.04, lineHeight: 1,
        letterSpacing: '-0.05em', userSelect: 'none',
      }}>
        {pad(idx+1)}
      </div>

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div style={{ background: ac, width: '12px', height: '1px' }} />
          <span style={{ color: ac, letterSpacing: '0.12em' }} className="text-[7px] font-bold uppercase">{ct}</span>
        </div>
        {card.emoji && <span className="text-sm leading-none">{card.emoji}</span>}
      </div>

      {/* 얇은 구분선 */}
      <div style={{ background: `${tp}15`, height: '1px', marginBottom: '8px' }} />

      {/* 콘텐츠 */}
      <div className="flex-1 flex flex-col justify-center gap-1.5 overflow-hidden min-w-0">
        {ct === 'title' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'5px', width:'100%' }}>
            <p style={{ ...TW, color: tp, fontWeight: tw, letterSpacing: ls }} className="w-full text-[13px] leading-tight">{card.title}</p>
            {card.subtitle && (<>
              <div style={{ background: `${tp}12`, height: '1px', width: '100%' }} />
              <p style={{ ...TW, color: ts }} className="w-full text-[8.5px] leading-relaxed">{card.subtitle}</p>
            </>)}
          </div>
        )}
        {(ct === 'keypoint' || ct === 'data') && (
          <div style={{ display:'flex', flexDirection:'column', gap:'4px', width:'100%' }}>
            <p style={{ ...TW, color: tp, fontWeight: Math.min(tw, 700) }} className="w-full text-[11px] leading-tight">{card.title}</p>
            {card.bullets?.slice(0,3).map((b,i) => (
              <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:'5px', width:'100%' }}>
                <span style={{ color: ac, flexShrink: 0 }} className="text-[8px] mt-[1px]">—</span>
                <span style={{ ...TWF, color: ts }} className="text-[8.5px] leading-snug">{b}</span>
              </div>
            ))}
          </div>
        )}
        {ct === 'highlight' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'5px', width:'100%' }}>
            <p style={{ ...TW, color: tm, letterSpacing: '0.08em' }} className="w-full text-[7.5px] uppercase">{card.title}</p>
            <p style={{ ...TW, color: ac, fontWeight: 900, letterSpacing: '-0.04em' }} className="w-full text-[22px] leading-none">{card.stat}</p>
            <div style={{ background: `${tp}15`, height: '1px', width: '100%' }} />
            {card.statDesc && <p style={{ ...TW, color: ts }} className="w-full text-[8px]">{card.statDesc}</p>}
          </div>
        )}
        {ct === 'quote' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'4px', width:'100%' }}>
            <p style={{ ...TW, color: tm }} className="w-full text-[8px]">{card.title}</p>
            <p style={{ ...TW, color: tp, fontStyle: 'italic', fontWeight: 400, borderLeft: `1px solid ${ac}` }}
              className="w-full text-[9.5px] leading-snug pl-2">{card.quote}</p>
            {card.quoteBy && <p style={{ ...TW, color: tm }} className="w-full text-[8px]">— {card.quoteBy}</p>}
          </div>
        )}
        {ct === 'cta' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'5px', width:'100%' }}>
            <p style={{ ...TW, color: tp, fontWeight: tw, letterSpacing: ls }} className="w-full text-[12px] leading-tight">{card.title}</p>
            {card.subtitle && <p style={{ ...TW, color: ts }} className="w-full text-[8.5px] leading-relaxed">{card.subtitle}</p>}
            <div style={{ background: `${tp}15`, height: '1px', width: '100%', marginTop: '2px' }} />
          </div>
        )}
      </div>

      {/* 푸터: 번호 우측 */}
      <div className="flex items-center justify-between mt-1.5">
        <div className="flex items-center gap-1" style={{ opacity: 0.16 }}>
          <span style={{ color: tp, letterSpacing: '0.12em' }} className="text-[6.5px] font-black uppercase">Clipflow</span>
        </div>
        <span style={{ color: tm }} className="text-[8px] font-bold">{pad(idx+1)}</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LAYOUT 4 — MAGAZINE
// 상단 풀-와이드 타입 헤더, 잡지 스타일
// ════════════════════════════════════════════════════════════════════════════
function MagazineCard({ card, total, tp, ts, tm, ac, ac2, tw, ff }: CardProps) {
  const { cardType: ct, index: idx } = card;
  const isMono = ff.includes('monospace') || ff.includes('Courier') || ff.includes('Mono');
  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      {/* 상단 풀-와이드 헤더 바 */}
      <div style={{ background: `linear-gradient(90deg, ${ac}, ${ac2 ?? ac}88)`, padding: '4px 12px' }}
        className="flex items-center justify-between shrink-0">
        <span style={{ color: '#050505', letterSpacing: isMono ? '0.08em' : '0.06em' }}
          className="text-[8px] font-black uppercase">{ct}</span>
        <span style={{ color: '#05050580' }} className="text-[7.5px] font-bold">{pad(idx+1)}/{pad(total)}</span>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 flex flex-col justify-center gap-1.5 px-3.5 py-2 overflow-hidden min-w-0">
        {ct === 'title' && (
          <>
            <p style={{ ...TW, color: tp, fontWeight: tw, fontFamily: ff, letterSpacing: isMono ? '-0.01em' : '-0.02em' }}
              className="text-[13px] leading-tight">{card.title}</p>
            {card.subtitle && <p style={{ ...TW, color: ts }} className="text-[8.5px] leading-relaxed">{card.subtitle}</p>}
            {card.emoji && <span className="text-lg mt-0.5">{card.emoji}</span>}
          </>
        )}
        {(ct === 'keypoint' || ct === 'data') && (
          <>
            <p style={{ ...TW, color: tp, fontWeight: Math.min(tw, 700), fontFamily: ff }} className="text-[11px] leading-tight">{card.title}</p>
            <div className="space-y-0.5 mt-0.5">
              {card.bullets?.slice(0,3).map((b,i) => (
                <div key={i} className="flex items-start gap-1">
                  <span style={{ color: ac, fontFamily: ff }} className="text-[8px] shrink-0">{'>'}</span>
                  <span style={{ ...TW, color: ts }} className="text-[8.5px] leading-snug">{b}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {ct === 'highlight' && (
          <>
            <p style={{ ...TW, color: ts, fontFamily: ff }} className="text-[8.5px]">{card.title}</p>
            <p style={{ ...TW, color: ac, fontWeight: 900, fontFamily: ff, letterSpacing: '-0.04em' }}
              className="text-[28px] leading-none">{card.stat}</p>
            {card.statDesc && <p style={{ ...TW, color: tm }} className="text-[8px]">{card.statDesc}</p>}
          </>
        )}
        {ct === 'quote' && (
          <>
            <p style={{ ...TW, color: tm, fontFamily: ff }} className="text-[8px]">{card.title}</p>
            <p style={{ ...TW, color: tp, fontFamily: ff }} className="text-[9.5px] leading-snug">
              <span style={{ color: ac }}>"</span>{card.quote}<span style={{ color: ac }}>"</span>
            </p>
            {card.quoteBy && <p style={{ ...TW, color: ac, fontFamily: ff }} className="text-[8px]">{card.quoteBy}</p>}
          </>
        )}
        {ct === 'cta' && (
          <>
            <p style={{ ...TW, color: tp, fontWeight: tw, fontFamily: ff }} className="text-[12px] leading-tight">{card.title}</p>
            {card.subtitle && <p style={{ ...TW, color: ts }} className="text-[8.5px] leading-relaxed">{card.subtitle}</p>}
            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
              <div style={{ background: ac, height: '2px', width: '20px', borderRadius: '1px' }} />
              <div style={{ background: `${ac}50`, height: '2px', width: '10px', borderRadius: '1px' }} />
            </div>
          </>
        )}
      </div>

      {/* 푸터 */}
      <div className="flex items-center justify-end px-3.5 pb-2">
        <div className="flex items-center gap-1" style={{ opacity: 0.18 }}>
          <div style={{ background: ac }} className="w-1 h-1" />
          <span style={{ color: tp, letterSpacing: '0.1em', fontFamily: ff }} className="text-[6.5px] font-black uppercase">Clipflow</span>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LAYOUT 5 — MINIMAL
// 순수 타이포그래피, 장식 최소, 넓은 공백
// ════════════════════════════════════════════════════════════════════════════
function MinimalCard({ card, total, tp, ts, tm, ac, tw, ls }: CardProps) {
  const { cardType: ct, index: idx } = card;
  return (
    <div className="relative h-full flex flex-col p-3.5">
      {/* 헤더: 번호만 */}
      <div className="flex items-center justify-between mb-3">
        <span style={{ color: tm, letterSpacing: '0.12em' }} className="text-[8px] font-bold">{pad(idx+1)}</span>
        <span style={{ color: `${tp}20`, letterSpacing: '0.06em' }} className="text-[7px] uppercase">{ct}</span>
      </div>

      {/* 얇은 선 */}
      <div style={{ background: `${tp}12`, height: '1px', marginBottom: '10px' }} />

      {/* 콘텐츠 */}
      <div className="flex-1 flex flex-col justify-center overflow-hidden min-w-0">
        {ct === 'title' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'6px', width:'100%' }}>
            <p style={{ ...TW, color: tp, fontWeight: tw, letterSpacing: ls, lineHeight: 1.2 }} className="w-full text-[14px]">{card.title}</p>
            {card.subtitle && (<>
              <div style={{ background: `${tp}10`, height: '1px', width: '100%' }} />
              <p style={{ ...TW, color: ts }} className="w-full text-[8.5px] leading-relaxed">{card.subtitle}</p>
            </>)}
          </div>
        )}
        {(ct === 'keypoint' || ct === 'data') && (
          <div style={{ display:'flex', flexDirection:'column', gap:'4px', width:'100%' }}>
            <p style={{ ...TW, color: tp, fontWeight: Math.min(tw, 700), letterSpacing: ls }} className="w-full text-[11px] leading-tight">{card.title}</p>
            {card.bullets?.slice(0,3).map((b,i) => (
              <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:'6px', width:'100%' }}>
                <span style={{ color: `${tp}30`, flexShrink: 0 }} className="text-[8px] mt-[1px]">–</span>
                <span style={{ ...TWF, color: ts }} className="text-[8.5px] leading-snug">{b}</span>
              </div>
            ))}
          </div>
        )}
        {ct === 'highlight' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'5px', width:'100%' }}>
            <p style={{ ...TW, color: tm, letterSpacing: '0.08em' }} className="w-full text-[7.5px] uppercase">{card.title}</p>
            <p style={{ ...TW, color: tp, fontWeight: 900, letterSpacing: '-0.05em' }} className="w-full text-[22px] leading-none">{card.stat}</p>
            <div style={{ background: `${tp}10`, height: '1px', width: '100%' }} />
            {card.statDesc && <p style={{ ...TW, color: ts }} className="w-full text-[8px]">{card.statDesc}</p>}
          </div>
        )}
        {ct === 'quote' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'4px', width:'100%' }}>
            <p style={{ color: `${tp}20`, fontWeight: 900, letterSpacing: '-0.02em' }} className="text-[20px] leading-none">"</p>
            <p style={{ ...TW, color: tp, fontWeight: 400, fontStyle: 'italic' }} className="w-full text-[9.5px] leading-relaxed">{card.quote}</p>
            {card.quoteBy && <p style={{ ...TW, color: tm }} className="w-full text-[7.5px]">— {card.quoteBy}</p>}
          </div>
        )}
        {ct === 'cta' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'6px', width:'100%' }}>
            <p style={{ ...TW, color: tp, fontWeight: tw, letterSpacing: ls }} className="w-full text-[12px] leading-tight">{card.title}</p>
            {card.subtitle && <p style={{ ...TW, color: ts }} className="w-full text-[8.5px] leading-relaxed">{card.subtitle}</p>}
            <div style={{ background: `${tp}15`, height: '1px', width: '100%' }} />
          </div>
        )}
      </div>

      {/* 푸터 */}
      <div className="flex items-center justify-between mt-2">
        <div style={{ background: `${tp}10`, height: '1px', flex: 1, marginRight: '8px' }} />
        <span style={{ color: tm, letterSpacing: '0.12em' }} className="text-[6px] font-black uppercase">CLIPFLOW</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LAYOUT 6 — INFOGRAPHIC
// 격자 배경, 번호 박스, 데이터 시각화
// ════════════════════════════════════════════════════════════════════════════
function InfographicCard({ card, total, tp, ts, tm, ac, ac2, tw }: CardProps) {
  const { cardType: ct, index: idx } = card;
  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      {/* 상단 액센트 바 */}
      <div style={{ background: `linear-gradient(90deg, ${ac}, ${ac2})`, height: '2px', flexShrink: 0 }} />

      <div className="flex-1 flex flex-col p-3 gap-1.5">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <div style={{ background: ac, width: '3px', height: '3px', borderRadius: '50%' }} />
            <span style={{ color: ac, letterSpacing: '0.08em' }} className="text-[7px] font-bold uppercase">{ct}</span>
          </div>
          <span style={{ color: tm, fontFamily: 'monospace' }} className="text-[8px] font-bold">{pad(idx+1)}/{pad(total)}</span>
        </div>

        {/* 구분선 */}
        <div style={{ background: `${ac}20`, height: '1px' }} />

        {/* 콘텐츠 — 모든 케이스를 명시적 div(flex-col)로 감싸 fragment 레이아웃 버그 방지 */}
        <div className="flex-1 flex flex-col justify-center overflow-hidden min-w-0">
          {ct === 'title' && (
            <div style={{ display:'flex', gap:'4px', overflow:'hidden', minWidth:0 }}>
              <div style={{ background: ac, width: '3px', borderRadius: '2px', flexShrink: 0 }} />
              <div style={{ display:'flex', flexDirection:'column', gap:'3px', minWidth:0, flex:'1 1 auto' }}>
                <p style={{ ...TW, color: tp, fontWeight: tw }} className="w-full text-[12px] leading-tight">{card.title}</p>
                {card.subtitle && <p style={{ ...TW, color: ts }} className="w-full text-[8.5px] leading-relaxed">{card.subtitle}</p>}
              </div>
            </div>
          )}
          {(ct === 'keypoint' || ct === 'data') && (
            <div style={{ display:'flex', flexDirection:'column', gap:'4px', width:'100%' }}>
              <p style={{ ...TW, color: ac, fontWeight: 700, letterSpacing: '0.06em' }} className="w-full text-[7.5px] uppercase">{card.title}</p>
              {card.bullets?.slice(0,3).map((b,i) => (
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:'5px', width:'100%' }}>
                  <div style={{
                    background: i === 0 ? ac : `${ac}40`, color: i === 0 ? '#000' : ac,
                    fontWeight: 700, flexShrink: 0, width: '14px', height: '14px', borderRadius: '2px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '7px',
                  }}>{i+1}</div>
                  <span style={{ ...TWF, color: ts }} className="text-[8.5px] leading-snug">{b}</span>
                </div>
              ))}
            </div>
          )}
          {ct === 'highlight' && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'5px', width:'100%' }}>
              <p style={{ ...TW, color: tm, letterSpacing: '0.06em', textAlign: 'center' }} className="w-full text-[7.5px] uppercase">{card.title}</p>
              <p style={{ ...TW, color: ac, fontWeight: 900, letterSpacing: '-0.03em', textAlign: 'center' }} className="w-full text-[20px] leading-none">{card.stat}</p>
              <div style={{ background: `${ac}30`, height: '1px', width: '100%' }} />
              {card.statDesc && <p style={{ ...TW, color: ts, textAlign: 'center' }} className="w-full text-[8px]">{card.statDesc}</p>}
            </div>
          )}
          {ct === 'quote' && (
            <div style={{ display:'flex', flexDirection:'column', gap:'4px', width:'100%' }}>
              <p style={{ ...TW, color: tm }} className="w-full text-[8px]">{card.title}</p>
              <div style={{ borderLeft: `2px solid ${ac}`, background: `${ac}08`, padding: '5px 7px', borderRadius: '0 3px 3px 0' }}>
                <p style={{ ...TW, color: tp, fontWeight: 500 }} className="w-full text-[8.5px] leading-snug">{card.quote}</p>
              </div>
              {card.quoteBy && <p style={{ ...TW, color: tm }} className="w-full text-[7.5px]">— {card.quoteBy}</p>}
            </div>
          )}
          {ct === 'cta' && (
            <div style={{ display:'flex', flexDirection:'column', gap:'6px', width:'100%' }}>
              <p style={{ ...TW, color: tp, fontWeight: tw }} className="w-full text-[11px] leading-tight">{card.title}</p>
              {card.subtitle && <p style={{ ...TW, color: ts }} className="w-full text-[8.5px] leading-relaxed">{card.subtitle}</p>}
              <div style={{ display:'flex', gap:'4px', marginTop:'2px' }}>
                <div style={{ background: ac, height: '2px', width: '20px', borderRadius: '1px' }} />
                <div style={{ background: ac2, height: '2px', width: '10px', borderRadius: '1px' }} />
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end">
          <span style={{ color: tm, letterSpacing: '0.1em', fontFamily: 'monospace' }} className="text-[6px] font-bold uppercase">CLIPFLOW</span>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LAYOUT 7 — SPLIT  (Remotion split-screen composition)
// 좌측 35% 솔리드 액센트 패널 + 우측 65% 콘텐츠
// ════════════════════════════════════════════════════════════════════════════
function SplitCard({ card, total, tp, ts, tm, ac, ac2, tw }: CardProps) {
  const { cardType: ct, index: idx } = card;
  return (
    <div className="relative h-full flex overflow-hidden">
      {/* 좌측 솔리드 패널 */}
      <div className="flex flex-col items-center justify-between py-3 shrink-0"
        style={{ width: '32%', background: ac, padding: '12px 8px' }}>
        <span style={{ color: '#00000060', letterSpacing: '0.15em', writingMode: 'vertical-rl' as const, transform: 'rotate(180deg)' }} className="text-[6px] font-black uppercase">Clipflow</span>
        <div className="flex flex-col items-center gap-1">
          <span style={{ color: '#000000', fontWeight: 900, opacity: 0.9 }} className="text-[22px] leading-none">{pad(idx+1)}</span>
          <div style={{ background: '#00000030', height: '1px', width: '20px' }} />
          <span style={{ color: '#00000060', fontWeight: 700 }} className="text-[6px]">{pad(total)}</span>
        </div>
        <span style={{ color: '#00000050', letterSpacing: '0.12em' }} className="text-[6px] font-bold uppercase">{ct}</span>
      </div>
      {/* 우측 콘텐츠 */}
      <div className="flex-1 flex flex-col justify-center gap-1.5 p-3 overflow-hidden min-w-0">
        {ct === 'title' && (
          <>
            <div style={{ background: `${ac}20`, border: `1px solid ${ac}40`, borderRadius: '4px', padding: '2px 8px', display: 'inline-block', alignSelf: 'flex-start' }}>
              <span style={{ color: ac2, letterSpacing: '0.1em' }} className="text-[6.5px] font-black uppercase">NEW</span>
            </div>
            <p style={{ ...TW, color: tp, fontWeight: tw, letterSpacing: '-0.02em' }} className="text-[12px] leading-tight">{card.title}</p>
            {card.subtitle && <p style={{ ...TW, color: ts }} className="text-[8px] leading-relaxed">{card.subtitle}</p>}
          </>
        )}
        {(ct === 'keypoint' || ct === 'data') && (
          <>
            <p style={{ ...TW, color: ac2, fontWeight: 700, letterSpacing: '0.06em' }} className="text-[7px] uppercase mb-0.5">{card.title}</p>
            {card.bullets?.slice(0,3).map((b,i) => (
              <div key={i} className="flex items-start gap-1.5">
                <div style={{ background: i === 0 ? ac : `${ac}50`, width: '3px', height: '3px', borderRadius: '50%', marginTop: '4px', flexShrink: 0 }} />
                <span style={{ ...TW, color: ts }} className="flex-1 min-w-0 text-[8px] leading-snug">{b}</span>
              </div>
            ))}
          </>
        )}
        {ct === 'highlight' && (
          <>
            <p style={{ ...TW, color: ts }} className="text-[7.5px]">{card.title}</p>
            <p style={{ ...TW, color: ac, fontWeight: 900, letterSpacing: '-0.04em' }} className="text-[22px] leading-none">{card.stat}</p>
            {card.statDesc && <p style={{ ...TW, color: tm }} className="text-[7.5px]">{card.statDesc}</p>}
          </>
        )}
        {ct === 'quote' && (
          <>
            <span style={{ color: `${ac}70`, fontWeight: 900 }} className="text-[18px] leading-none">"</span>
            <p style={{ ...TW, color: tp, fontStyle: 'italic', fontWeight: 400 }} className="text-[8.5px] leading-snug">{card.quote}</p>
            {card.quoteBy && <p style={{ ...TW, color: tm }} className="text-[7.5px]">— {card.quoteBy}</p>}
          </>
        )}
        {ct === 'cta' && (
          <>
            <p style={{ ...TW, color: tp, fontWeight: tw }} className="text-[11px] leading-tight">{card.title}</p>
            {card.subtitle && <p style={{ ...TW, color: ts }} className="text-[8px] leading-relaxed">{card.subtitle}</p>}
            <div style={{ background: ac, borderRadius: '999px', padding: '3px 10px', marginTop: '3px', alignSelf: 'flex-start' }}>
              <span style={{ color: '#000', fontSize: '7px', fontWeight: 900 }}>FOLLOW</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LAYOUT 8 — KINETIC  (Remotion kinetic typography)
// 배경 초대형 텍스트 레이어 + 전경 타이포 계층
// ════════════════════════════════════════════════════════════════════════════
function KineticCard({ card, total, tp, ts, tm, ac, ac2, tw, ls }: CardProps) {
  const { cardType: ct, index: idx } = card;
  const bigWord = (card.title || '').split(' ')[0]?.toUpperCase() ?? 'TEXT';
  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      {/* 배경 거대 텍스트 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <span style={{ color: ac, opacity: 0.07, fontWeight: 900, fontSize: '72px', letterSpacing: '-0.04em',
          lineHeight: 1, whiteSpace: 'nowrap', transform: 'rotate(-8deg)', userSelect: 'none' }}>
          {bigWord}
        </span>
      </div>
      {/* 상단 액센트 바 쌍 */}
      <div className="flex shrink-0" style={{ height: '3px' }}>
        <div style={{ flex: 2, background: ac }} />
        <div style={{ flex: 1, background: ac2 }} />
      </div>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <span style={{ color: ac, fontWeight: 900, letterSpacing: '-0.02em' }} className="text-[10px]">{pad(idx+1)}</span>
        <span style={{ color: tm, letterSpacing: '0.12em' }} className="text-[6.5px] font-bold uppercase">{ct}</span>
      </div>

      <div className="flex-1 flex flex-col justify-center px-3 gap-1.5 relative">
        {ct === 'title' && (
          <>
            <p style={{ color: ac, fontWeight: 900, letterSpacing: ls, lineHeight: 1 }} className="text-[14px]">{card.title}</p>
            {card.subtitle && <p style={{ color: ts }} className="text-[8px] leading-relaxed">{card.subtitle}</p>}
          </>
        )}
        {(ct === 'keypoint' || ct === 'data') && (
          <>
            <p style={{ color: tp, fontWeight: tw, letterSpacing: ls }} className="text-[11px] leading-tight">{card.title}</p>
            {card.bullets?.slice(0,3).map((b,i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span style={{ color: ac, fontWeight: 900 }} className="text-[9px] shrink-0 leading-none mt-[2px]">/</span>
                <span style={{ color: ts }} className="text-[8px] leading-snug">{b}</span>
              </div>
            ))}
          </>
        )}
        {ct === 'highlight' && (
          <>
            <p style={{ color: tm, letterSpacing: '0.1em' }} className="text-[7px] uppercase">{card.title}</p>
            <p style={{ color: ac, fontWeight: 900, letterSpacing: '-0.05em' }} className="text-[32px] leading-none">{card.stat}</p>
            {card.statDesc && <p style={{ color: ts }} className="text-[7.5px]">{card.statDesc}</p>}
          </>
        )}
        {ct === 'quote' && (
          <>
            <span style={{ color: ac, fontWeight: 900, opacity: 0.6 }} className="text-[20px] leading-none">"</span>
            <p style={{ color: tp, fontStyle: 'italic', fontWeight: 500 }} className="text-[8.5px] leading-snug">{card.quote}</p>
            {card.quoteBy && <p style={{ color: ac2 }} className="text-[7.5px] font-bold">— {card.quoteBy}</p>}
          </>
        )}
        {ct === 'cta' && (
          <>
            <p style={{ color: tp, fontWeight: tw, letterSpacing: ls }} className="text-[12px] leading-tight">{card.title}</p>
            {card.subtitle && <p style={{ color: ts }} className="text-[8px] leading-relaxed">{card.subtitle}</p>}
            <div className="flex gap-1 mt-1">
              <div style={{ background: ac, height: '2px', width: '18px', borderRadius: '1px' }} />
              <div style={{ background: ac2, height: '2px', width: '10px', borderRadius: '1px' }} />
            </div>
          </>
        )}
      </div>

      {/* 푸터 */}
      <div className="flex items-center justify-between px-3 pb-2">
        <div style={{ background: `${tp}10`, height: '1px', flex: 1, marginRight: '8px' }} />
        <span style={{ color: tm, letterSpacing: '0.1em' }} className="text-[5.5px] font-black uppercase">Clipflow</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LAYOUT 9 — BROADCAST  (Remotion lower-third graphics)
// 하단 타이틀 슬레이트 + 상단 티커 바
// ════════════════════════════════════════════════════════════════════════════
function BroadcastCard({ card, total, tp, ts, tm, ac, ac2, tw }: CardProps) {
  const { cardType: ct, index: idx } = card;
  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      {/* 상단 얇은 티커 바 */}
      <div style={{ background: ac, height: '2px', flexShrink: 0 }} />
      <div className="flex items-center justify-between px-3 py-1 shrink-0" style={{ background: `${ac}10` }}>
        <div className="flex items-center gap-1.5">
          <div style={{ background: ac, width: '5px', height: '5px', borderRadius: '50%' }} />
          <span style={{ color: ac, letterSpacing: '0.1em' }} className="text-[6.5px] font-black uppercase">LIVE</span>
        </div>
        <span style={{ color: tm }} className="text-[6px] font-bold">{pad(idx+1)}/{pad(total)}</span>
      </div>

      {/* 메인 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col justify-center px-3 gap-1.5">
        {ct === 'title' && (
          <>
            <p style={{ color: tp, fontWeight: tw }} className="text-[13px] leading-tight">{card.title}</p>
            {card.subtitle && <p style={{ color: ts }} className="text-[8px] leading-relaxed">{card.subtitle}</p>}
          </>
        )}
        {(ct === 'keypoint' || ct === 'data') && (
          <>
            <p style={{ color: tp, fontWeight: Math.min(tw, 700) }} className="text-[10px] leading-tight mb-0.5">{card.title}</p>
            {card.bullets?.slice(0,3).map((b,i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span style={{ color: ac, fontWeight: 700 }} className="text-[8px] shrink-0">▸</span>
                <span style={{ color: ts }} className="text-[8px] leading-snug">{b}</span>
              </div>
            ))}
          </>
        )}
        {ct === 'highlight' && (
          <>
            <p style={{ color: ts }} className="text-[7.5px]">{card.title}</p>
            <p style={{ color: ac, fontWeight: 900, letterSpacing: '-0.04em' }} className="text-[28px] leading-none">{card.stat}</p>
            {card.statDesc && <p style={{ color: tm }} className="text-[7.5px]">{card.statDesc}</p>}
          </>
        )}
        {ct === 'quote' && (
          <>
            <p style={{ color: tm }} className="text-[7.5px]">{card.title}</p>
            <p style={{ color: tp, fontStyle: 'italic' }} className="text-[9px] leading-snug">"{card.quote}"</p>
            {card.quoteBy && <p style={{ color: ac2 }} className="text-[7.5px]">— {card.quoteBy}</p>}
          </>
        )}
        {ct === 'cta' && (
          <>
            <p style={{ color: tp, fontWeight: tw }} className="text-[11px] leading-tight">{card.title}</p>
            {card.subtitle && <p style={{ color: ts }} className="text-[8px] leading-relaxed">{card.subtitle}</p>}
          </>
        )}
      </div>

      {/* 하단 슬레이트 (Lower Third) */}
      <div className="shrink-0" style={{ background: ac, padding: '4px 12px' }}>
        <div className="flex items-center justify-between">
          <span style={{ color: '#000', fontWeight: 900, letterSpacing: '-0.01em' }} className="text-[7px]">
            {ct === 'cta' ? 'FOLLOW NOW' : ct.toUpperCase()}
          </span>
          <div className="flex items-center gap-1">
            <div style={{ background: '#00000040', width: '1px', height: '8px' }} />
            <span style={{ color: '#00000070', letterSpacing: '0.06em' }} className="text-[6px] font-bold uppercase">Clipflow</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LAYOUT 10 — CINEMATIC  (Remotion film aesthetic)
// 상하 레터박스 바 + 대각선 포커스 라인 + 영화적 타이포
// ════════════════════════════════════════════════════════════════════════════
function CinematicCard({ card, total, tp, ts, tm, ac, tw, ls }: CardProps) {
  const { cardType: ct, index: idx } = card;
  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      {/* 상단 레터박스 */}
      <div style={{ background: '#000000', height: '14%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px' }}>
        <div className="flex items-center gap-1">
          <div style={{ background: ac, width: '8px', height: '1px' }} />
          <span style={{ color: `${ac}80`, letterSpacing: '0.15em' }} className="text-[5.5px] font-bold uppercase">{ct}</span>
        </div>
        <span style={{ color: `${tp}30`, letterSpacing: '0.1em' }} className="text-[5.5px]">{pad(idx+1)}/{pad(total)}</span>
      </div>

      {/* 대각선 액센트 라인 */}
      <div className="absolute pointer-events-none" style={{
        top: '14%', right: 0, width: '60%', height: '1px',
        background: `linear-gradient(to left, ${ac}60, transparent)`,
      }} />

      {/* 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col justify-center px-3.5 gap-1.5 relative">
        {ct === 'title' && (
          <>
            <p style={{ color: tp, fontWeight: tw, letterSpacing: ls, lineHeight: 1.15 }} className="text-[13px]">{card.title}</p>
            {card.subtitle && (
              <>
                <div style={{ background: ac, height: '1px', width: '16px' }} />
                <p style={{ color: ts, letterSpacing: '0.03em' }} className="text-[8px] leading-relaxed">{card.subtitle}</p>
              </>
            )}
          </>
        )}
        {(ct === 'keypoint' || ct === 'data') && (
          <>
            <p style={{ color: ac, fontWeight: 700, letterSpacing: '0.06em' }} className="text-[7px] uppercase">{card.title}</p>
            {card.bullets?.slice(0,3).map((b,i) => (
              <div key={i} className="flex items-start gap-2">
                <div style={{ background: ac, width: '1px', height: '100%', minHeight: '10px', flexShrink: 0, opacity: 0.6 }} />
                <span style={{ color: ts }} className="text-[8px] leading-snug">{b}</span>
              </div>
            ))}
          </>
        )}
        {ct === 'highlight' && (
          <>
            <p style={{ color: tm, letterSpacing: '0.12em' }} className="text-[7px] uppercase">{card.title}</p>
            <p style={{ color: ac, fontWeight: 900, letterSpacing: '-0.04em' }} className="text-[28px] leading-none">{card.stat}</p>
            <div style={{ background: `${tp}12`, height: '1px', width: '100%' }} />
            {card.statDesc && <p style={{ color: ts }} className="text-[7.5px]">{card.statDesc}</p>}
          </>
        )}
        {ct === 'quote' && (
          <>
            <p style={{ color: tm }} className="text-[7.5px] uppercase tracking-widest">{card.title}</p>
            <p style={{ color: tp, fontStyle: 'italic', fontWeight: 400, letterSpacing: '0.01em' }} className="text-[9px] leading-relaxed">"{card.quote}"</p>
            {card.quoteBy && <p style={{ color: ac, letterSpacing: '0.1em' }} className="text-[7px] uppercase">— {card.quoteBy}</p>}
          </>
        )}
        {ct === 'cta' && (
          <>
            <p style={{ color: tp, fontWeight: tw, letterSpacing: ls }} className="text-[12px] leading-tight">{card.title}</p>
            {card.subtitle && <p style={{ color: ts, letterSpacing: '0.02em' }} className="text-[8px] leading-relaxed">{card.subtitle}</p>}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <div style={{ background: ac, height: '1px', width: '12px' }} />
              <span style={{ color: ac, fontWeight: 700, letterSpacing: '0.08em' }} className="text-[7px] uppercase">Follow</span>
            </div>
          </>
        )}
      </div>

      {/* 하단 레터박스 */}
      <div style={{ background: '#000000', height: '10%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 12px' }}>
        <span style={{ color: `${tp}20`, letterSpacing: '0.12em' }} className="text-[5.5px] font-bold uppercase">Clipflow</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LAYOUT 11 — TIMELINE  (Remotion sequence animation)
// 좌측 수직 타임라인 라인 + 스텝 원형 마커
// ════════════════════════════════════════════════════════════════════════════
function TimelineCard({ card, total, tp, ts, tm, ac, ac2, tw }: CardProps) {
  const { cardType: ct, index: idx } = card;
  return (
    <div className="relative h-full flex flex-col p-3 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: ac, border: `1px solid ${ac2}` }} />
          <span style={{ color: ac, letterSpacing: '0.08em' }} className="text-[7px] font-bold uppercase">{ct}</span>
        </div>
        <span style={{ color: tm }} className="text-[7px] font-bold">{pad(idx+1)}/{pad(total)}</span>
      </div>
      <div style={{ background: `${ac}25`, height: '1px', marginBottom: '8px' }} />

      {/* 콘텐츠 */}
      <div className="flex-1 flex flex-col justify-center">
        {ct === 'title' && (
          <div className="flex gap-2 items-stretch">
            {/* 타임라인 기둥 */}
            <div className="flex flex-col items-center shrink-0" style={{ width: '16px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: ac, flexShrink: 0 }} />
              <div style={{ width: '2px', flex: 1, background: `linear-gradient(to bottom, ${ac}, transparent)` }} />
            </div>
            <div className="flex flex-col gap-1">
              <p style={{ color: tp, fontWeight: tw }} className="text-[12px] leading-tight">{card.title}</p>
              {card.subtitle && <p style={{ color: ts }} className="text-[8px] leading-relaxed">{card.subtitle}</p>}
            </div>
          </div>
        )}
        {(ct === 'keypoint' || ct === 'data') && (
          <div className="flex gap-2 items-stretch">
            <div className="flex flex-col items-center shrink-0 relative" style={{ width: '16px' }}>
              {/* 수직 타임라인 */}
              <div style={{ position: 'absolute', left: '7px', top: 0, bottom: 0, width: '2px', background: `linear-gradient(to bottom, ${ac}80, transparent)` }} />
              {card.bullets?.slice(0,3).map((_,i) => (
                <div key={i} className="relative flex-1 flex flex-col items-center justify-center">
                  <div style={{ width: i === 0 ? '10px' : '6px', height: i === 0 ? '10px' : '6px', borderRadius: '50%',
                    background: i === 0 ? ac : `${ac}40`, border: `1px solid ${i === 0 ? ac : `${ac}60`}`, zIndex: 1 }} />
                </div>
              ))}
            </div>
            <div className="flex flex-col justify-around flex-1 gap-0.5">
              <p style={{ color: ac, fontWeight: 700, letterSpacing: '0.06em' }} className="text-[6.5px] uppercase mb-0.5">{card.title}</p>
              {card.bullets?.slice(0,3).map((b,i) => (
                <p key={i} style={{ color: i === 0 ? tp : ts, fontWeight: i === 0 ? 600 : 400 }} className="text-[8px] leading-snug">{b}</p>
              ))}
            </div>
          </div>
        )}
        {ct === 'highlight' && (
          <div className="flex gap-2 items-center">
            <div className="flex flex-col items-center shrink-0" style={{ width: '16px', alignSelf: 'stretch' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: ac }} />
              <div style={{ width: '2px', flex: 1, background: `linear-gradient(to bottom, ${ac}60, transparent)` }} />
            </div>
            <div>
              <p style={{ color: tm, letterSpacing: '0.08em' }} className="text-[7px] uppercase">{card.title}</p>
              <p style={{ color: ac, fontWeight: 900, letterSpacing: '-0.04em' }} className="text-[28px] leading-none">{card.stat}</p>
              {card.statDesc && <p style={{ color: ts }} className="text-[7.5px]">{card.statDesc}</p>}
            </div>
          </div>
        )}
        {ct === 'quote' && (
          <div className="flex gap-2">
            <div style={{ width: '2px', background: ac, borderRadius: '1px', flexShrink: 0 }} />
            <div className="flex flex-col gap-1">
              <p style={{ color: tp, fontStyle: 'italic', fontWeight: 400 }} className="text-[9px] leading-snug">"{card.quote}"</p>
              {card.quoteBy && <p style={{ color: ac2, fontWeight: 700 }} className="text-[7.5px]">— {card.quoteBy}</p>}
            </div>
          </div>
        )}
        {ct === 'cta' && (
          <div className="flex gap-2 items-stretch">
            <div className="flex flex-col items-center shrink-0" style={{ width: '16px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: ac }} />
              <div style={{ width: '2px', flex: 1, background: `linear-gradient(to bottom, ${ac}, ${ac2}40)` }} />
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: ac2, opacity: 0.6 }} />
            </div>
            <div className="flex flex-col gap-1 justify-center">
              <p style={{ color: tp, fontWeight: tw }} className="text-[11px] leading-tight">{card.title}</p>
              {card.subtitle && <p style={{ color: ts }} className="text-[8px] leading-relaxed">{card.subtitle}</p>}
            </div>
          </div>
        )}
      </div>

      {/* 푸터 */}
      <div className="flex items-center gap-1 mt-1.5" style={{ opacity: 0.2 }}>
        <div style={{ width: '1px', height: '8px', background: ac }} />
        <span style={{ color: tp, letterSpacing: '0.1em' }} className="text-[6px] font-black uppercase">Clipflow</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LAYOUT 12 — GLASS  (Remotion glassmorphism UI)
// 반투명 글래스 패널 + 오로라 그라데이션 경계
// ════════════════════════════════════════════════════════════════════════════
function GlassCard({ card, total, tp, ts, tm, ac, ac2, tw, ls }: CardProps) {
  const { cardType: ct, index: idx } = card;
  return (
    <div className="relative h-full flex flex-col p-2 overflow-hidden">
      {/* 글래스 패널 */}
      <div className="relative flex-1 flex flex-col rounded-lg overflow-hidden" style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid rgba(255,255,255,0.10)`,
        backdropFilter: 'blur(10px)',
      }}>
        {/* 상단 오로라 경계선 */}
        <div style={{ height: '1px', background: `linear-gradient(90deg, transparent, ${ac}80, ${ac2}60, transparent)`, flexShrink: 0 }} />

        {/* 헤더 */}
        <div className="flex items-center justify-between px-2.5 pt-2 pb-1.5">
          <div className="flex items-center gap-1.5">
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: ac, boxShadow: `0 0 6px ${ac}80` }} />
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: ac2, boxShadow: `0 0 4px ${ac2}60` }} />
          </div>
          <span style={{ color: tm, letterSpacing: '0.1em' }} className="text-[6.5px] font-bold">{pad(idx+1)}/{pad(total)}</span>
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 flex flex-col justify-center px-2.5 pb-2 gap-1.5">
          {ct === 'title' && (
            <>
              <div style={{ background: `linear-gradient(135deg, ${ac}25, ${ac2}15)`, border: `1px solid ${ac}30`,
                borderRadius: '6px', padding: '2px 8px', alignSelf: 'flex-start' }}>
                <span style={{ color: ac, letterSpacing: '0.1em' }} className="text-[6.5px] font-black uppercase">START</span>
              </div>
              <p style={{ color: tp, fontWeight: tw, letterSpacing: ls }} className="text-[12.5px] leading-tight">{card.title}</p>
              {card.subtitle && <p style={{ color: ts }} className="text-[8px] leading-relaxed">{card.subtitle}</p>}
            </>
          )}
          {(ct === 'keypoint' || ct === 'data') && (
            <>
              <p style={{ color: tp, fontWeight: Math.min(tw, 700) }} className="text-[10.5px] leading-tight">{card.title}</p>
              <div style={{ background: `linear-gradient(90deg, ${ac}30, transparent)`, height: '1px' }} />
              {card.bullets?.slice(0,3).map((b,i) => (
                <div key={i} className="flex items-start gap-1.5" style={{
                  background: i === 0 ? `${ac}08` : 'transparent',
                  borderLeft: i === 0 ? `2px solid ${ac}60` : '2px solid transparent',
                  paddingLeft: '6px', borderRadius: '0 4px 4px 0',
                }}>
                  <span style={{ color: ts }} className="text-[8px] leading-snug">{b}</span>
                </div>
              ))}
            </>
          )}
          {ct === 'highlight' && (
            <>
              <p style={{ color: tm, letterSpacing: '0.08em' }} className="text-[7px] uppercase">{card.title}</p>
              <div style={{ background: `linear-gradient(135deg, ${ac}15, ${ac2}10)`, border: `1px solid ${ac}25`,
                borderRadius: '8px', padding: '6px 10px' }}>
                <p style={{ color: ac, fontWeight: 900, letterSpacing: '-0.04em' }} className="text-[26px] leading-none">{card.stat}</p>
              </div>
              {card.statDesc && <p style={{ color: ts }} className="text-[7.5px]">{card.statDesc}</p>}
            </>
          )}
          {ct === 'quote' && (
            <>
              <span style={{ color: `${ac}50`, fontWeight: 900 }} className="text-[16px] leading-none">"</span>
              <p style={{ color: tp, fontStyle: 'italic', fontWeight: 400 }} className="text-[8.5px] leading-snug">{card.quote}</p>
              {card.quoteBy && <p style={{ color: ac2 }} className="text-[7.5px] font-bold">— {card.quoteBy}</p>}
            </>
          )}
          {ct === 'cta' && (
            <>
              <p style={{ color: tp, fontWeight: tw }} className="text-[11.5px] leading-tight">{card.title}</p>
              {card.subtitle && <p style={{ color: ts }} className="text-[8px] leading-relaxed">{card.subtitle}</p>}
              <div style={{ background: `linear-gradient(135deg, ${ac}, ${ac2})`, borderRadius: '999px',
                padding: '4px 12px', alignSelf: 'flex-start', marginTop: '3px',
                boxShadow: `0 2px 12px ${ac}40` }}>
                <span style={{ color: '#050505', fontSize: '7px', fontWeight: 900, letterSpacing: '0.05em' }}>FOLLOW</span>
              </div>
            </>
          )}
        </div>

        {/* 하단 오로라 경계선 */}
        <div style={{ height: '1px', background: `linear-gradient(90deg, transparent, ${ac2}60, ${ac}40, transparent)`, flexShrink: 0 }} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ════════════════════════════════════════════════════════════════════════════
export function CarouselCardPreview({ card, total }: { card: CarouselCardData; total: number }) {
  const tp  = card.textPrimary    ?? '#e8f0ff';
  const ts  = card.textSecondary  ?? 'rgba(232,240,255,0.62)';
  const tm  = card.textMuted      ?? 'rgba(232,240,255,0.28)';
  const ac  = card.accentColor    ?? '#4f8ef7';
  const ac2 = card.accentSecondary ?? ac;
  const tw  = card.titleFontWeight ?? 800;
  const ff  = card.fontFamily ?? "'Noto Sans KR', sans-serif";
  const ls  = card.letterSpacing ?? 'normal';
  const bgC = card.bgColor ?? '#070d1e';
  const bg  = card.bgGradient ?? 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.15) 100%)';
  const layout = card.layout ?? 'bold-left';

  const props: CardProps = { card, total, tp, ts, tm, ac, ac2, tw, ff, ls };

  return (
    <div
      style={{ backgroundColor: bgC, fontFamily: ff }}
      className="relative aspect-square rounded-xl overflow-hidden cursor-default"
    >
      {/* 노이즈 텍스처 */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ opacity: 0.04, backgroundImage: NOISE_SVG, backgroundSize: '200px' }} />
      {/* 스타일별 그라데이션 오버레이 */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: bg }} />

      {/* 레이아웃 렌더링 */}
      <div className="relative h-full">
        {layout === 'bold-left'   && <BoldLeftCard    {...props} />}
        {layout === 'centered'    && <CenteredCard    {...props} />}
        {layout === 'editorial'   && <EditorialCard   {...props} />}
        {layout === 'magazine'    && <MagazineCard    {...props} />}
        {layout === 'minimal'     && <MinimalCard     {...props} />}
        {layout === 'infographic' && <InfographicCard {...props} />}
        {layout === 'split'       && <SplitCard       {...props} />}
        {layout === 'kinetic'     && <KineticCard     {...props} />}
        {layout === 'broadcast'   && <BroadcastCard   {...props} />}
        {layout === 'cinematic'   && <CinematicCard   {...props} />}
        {layout === 'timeline'    && <TimelineCard    {...props} />}
        {layout === 'glass'       && <GlassCard       {...props} />}
        {!['bold-left','centered','editorial','magazine','minimal','infographic',
           'split','kinetic','broadcast','cinematic','timeline','glass'].includes(layout) && (
          <BoldLeftCard {...props} />
        )}
      </div>
    </div>
  );
}
