/**
 * carousel-styles.ts — 18가지 스타일 + 12가지 레이아웃
 *
 * 기존 6가지 layout:
 *   bold-left   : 좌측 수직 액센트 바, 강한 타이포
 *   centered    : 전체 중앙 정렬, 원형/바 장식
 *   editorial   : 배경 거대 카드번호, 얇은 선, 우아한 타이포
 *   magazine    : 상단 풀-와이드 타입 헤더, 잡지 스타일
 *   minimal     : 순수 타이포그래피, 장식 없음
 *   infographic : 격자 배경, 번호 박스, 데이터 시각화
 *
 * Remotion 참조 6가지 layout:
 *   split       : 좌우 분할 패널 — Remotion split-screen composition
 *   kinetic     : 키네틱 타이포그래피 — Remotion kinetic text freeze-frame
 *   broadcast   : 방송 하단자막 스타일 — Remotion lower-third graphics
 *   cinematic   : 시네마틱 레터박스 — Remotion film aesthetic
 *   timeline    : 타임라인/프로세스 — Remotion sequence animation
 *   glass       : 글래스모피즘 패널 — Remotion modern UI layers
 */

export type LayoutType =
  | 'bold-left' | 'centered' | 'editorial' | 'magazine' | 'minimal' | 'infographic'
  | 'split' | 'kinetic' | 'broadcast' | 'cinematic' | 'timeline' | 'glass' | 'photo-overlay';
export type FontFamily = 'sans' | 'mono';

export interface StyleDef {
  id: string;
  name: string;
  nameKo: string;
  mood: string[];
  desc: string;
  layout: LayoutType;
  lightMode?: boolean;  // 밝은 배경 — 텍스트/오버레이 반전 필요
  // 배경
  bg: string;
  bgAlt?: string;
  bgCta?: string;
  bgGradient: string;
  // 색상
  accent: string;
  accentSecondary?: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  noiseOpacity?: number;
  // 폰트
  font: {
    titleWeight: number;
    family: FontFamily;
    letterSpacing?: string;
  };
}

export const CAROUSEL_STYLES: StyleDef[] = [

  // ── 1. BOLD-LEFT ─────────────────────────────────────────────────────────
  {
    id: 'midnight-navy',
    name: 'Midnight Navy',
    nameKo: '미드나잇 네이비',
    mood: ['professional', 'corporate', 'linkedin', 'finance', 'trust', 'report'],
    desc: '다크 네이비 + 파란 액센트. 신뢰감 있는 비즈니스·금융·LinkedIn 콘텐츠에 최적.',
    layout: 'bold-left',
    bg: '#070d1e', bgAlt: '#0a1228', bgCta: '#0c1535',
    bgGradient: 'linear-gradient(135deg, rgba(79,142,247,0.1) 0%, rgba(0,0,0,0) 65%)',
    accent: '#4f8ef7',
    textPrimary: '#e8f0ff', textSecondary: 'rgba(232,240,255,0.62)', textMuted: 'rgba(232,240,255,0.28)',
    font: { titleWeight: 800, family: 'sans' },
  },
  {
    id: 'ember-glow',
    name: 'Ember Glow',
    nameKo: '엠버 글로우',
    mood: ['energetic', 'action', 'fitness', 'motivation', 'sport', 'youth'],
    desc: '칠흑 배경 + 불꽃 오렌지 발광. 에너지·액션·피트니스·스포츠·동기부여.',
    layout: 'bold-left',
    bg: '#0d0500', bgAlt: '#110700', bgCta: '#140800',
    bgGradient: 'radial-gradient(ellipse at center bottom, rgba(255,107,53,0.22) 0%, transparent 65%)',
    accent: '#ff6b35',
    textPrimary: '#fff2e8', textSecondary: 'rgba(255,242,232,0.6)', textMuted: 'rgba(255,242,232,0.28)',
    font: { titleWeight: 900, family: 'sans' },
  },
  {
    id: 'bull-market',
    name: 'Bull Market',
    nameKo: '불 마켓',
    mood: ['finance', 'growth', 'investing', 'stock', 'economics', 'data'],
    desc: '딥 블랙 + 에메랄드 그린 성장 액센트. 주식·투자·경제지표·성장 콘텐츠.',
    layout: 'bold-left',
    bg: '#010f05', bgAlt: '#011207', bgCta: '#011508',
    bgGradient: 'linear-gradient(180deg, rgba(16,185,129,0.16) 0%, rgba(0,0,0,0) 70%)',
    accent: '#10b981',
    textPrimary: '#d1fae5', textSecondary: 'rgba(209,250,229,0.6)', textMuted: 'rgba(209,250,229,0.28)',
    font: { titleWeight: 800, family: 'sans' },
  },

  // ── 2. CENTERED ───────────────────────────────────────────────────────────
  {
    id: 'gold-noir',
    name: 'Gold Noir',
    nameKo: '골드 누아르',
    mood: ['luxury', 'premium', 'gold', 'exclusive', 'achievement', 'fashion'],
    desc: '절대 블랙 + 순금 액센트. 럭셔리·프리미엄·성취·하이엔드 브랜드 무드.',
    layout: 'centered',
    bg: '#080600', bgAlt: '#0a0800', bgCta: '#0c0a00',
    bgGradient: 'radial-gradient(ellipse at top, rgba(245,158,11,0.18) 0%, transparent 60%)',
    accent: '#f59e0b',
    textPrimary: '#fff8e0', textSecondary: 'rgba(255,248,224,0.58)', textMuted: 'rgba(255,248,224,0.26)',
    font: { titleWeight: 800, family: 'sans', letterSpacing: '-0.02em' },
  },
  {
    id: 'sunset-amber',
    name: 'Sunset Amber',
    nameKo: '선셋 앰버',
    mood: ['warm', 'emotional', 'motivational', 'personal', 'lifestyle', 'story'],
    desc: '다크 브라운 + 앰버 액센트. 동기부여·개인 성장·라이프스타일 스토리.',
    layout: 'centered',
    bg: '#140a00', bgAlt: '#1a0e03', bgCta: '#1e1104',
    bgGradient: 'radial-gradient(ellipse at top right, rgba(245,158,11,0.2) 0%, transparent 65%)',
    accent: '#f59e0b',
    textPrimary: '#fff4d6', textSecondary: 'rgba(255,244,214,0.62)', textMuted: 'rgba(255,244,214,0.3)',
    font: { titleWeight: 800, family: 'sans' },
  },
  {
    id: 'velvet-rose',
    name: 'Velvet Rose',
    nameKo: '벨벳 로즈',
    mood: ['feminine', 'beauty', 'lifestyle', 'fashion', 'wellness', 'cosmetics'],
    desc: '벨벳 다크 + 로즈 핑크 액센트. 뷰티·패션·라이프스타일·코스메틱.',
    layout: 'centered',
    bg: '#120810', bgAlt: '#160a14', bgCta: '#190c17',
    bgGradient: 'radial-gradient(ellipse at bottom left, rgba(251,113,133,0.18) 0%, transparent 65%)',
    accent: '#fb7185',
    textPrimary: '#ffe4ef', textSecondary: 'rgba(255,228,239,0.6)', textMuted: 'rgba(255,228,239,0.28)',
    font: { titleWeight: 700, family: 'sans' },
  },

  // ── 3. EDITORIAL ──────────────────────────────────────────────────────────
  {
    id: 'forest-deep',
    name: 'Forest Deep',
    nameKo: '포레스트 딥',
    mood: ['nature', 'eco', 'calm', 'sustainability', 'environment', 'travel'],
    desc: '깊은 숲 다크 + 세이지 그린 액센트. 환경·지속가능·자연·여행 콘텐츠.',
    layout: 'editorial',
    bg: '#030e05', bgAlt: '#041008', bgCta: '#05120a',
    bgGradient: 'radial-gradient(ellipse at bottom, rgba(34,197,94,0.14) 0%, transparent 65%)',
    accent: '#22c55e',
    textPrimary: '#d4f5e0', textSecondary: 'rgba(212,245,224,0.58)', textMuted: 'rgba(212,245,224,0.28)',
    font: { titleWeight: 700, family: 'sans' },
  },
  {
    id: 'mindful-zen',
    name: 'Mindful Zen',
    nameKo: '마인드풀 젠',
    mood: ['meditation', 'mental-health', 'psychology', 'spiritual', 'calm', 'therapy'],
    desc: '젠 퍼플 다크 + 소프트 라벤더. 명상·심리·정신건강·영성·웰니스 콘텐츠.',
    layout: 'editorial',
    bg: '#060412', bgAlt: '#080516', bgCta: '#0a061a',
    bgGradient: 'radial-gradient(ellipse at center, rgba(139,92,246,0.15) 0%, transparent 65%)',
    accent: '#8b5cf6', accentSecondary: '#c084fc',
    textPrimary: '#ede8ff', textSecondary: 'rgba(237,232,255,0.58)', textMuted: 'rgba(237,232,255,0.26)',
    font: { titleWeight: 600, family: 'sans', letterSpacing: '0.01em' },
  },

  // ── 4. MAGAZINE ───────────────────────────────────────────────────────────
  {
    id: 'neon-cyber',
    name: 'Neon Cyber',
    nameKo: '네온 사이버',
    mood: ['tech', 'futuristic', 'cyberpunk', 'ai', 'digital', 'innovation'],
    desc: '사이버펑크 블랙 + 일렉트릭 시안 네온. AI·미래 기술·디지털 혁신·스타트업.',
    layout: 'magazine',
    bg: '#020510', bgAlt: '#030614', bgCta: '#040818',
    bgGradient: 'radial-gradient(ellipse at top right, rgba(0,245,255,0.15) 0%, transparent 60%)',
    accent: '#00f5ff',
    textPrimary: '#d0faff', textSecondary: 'rgba(208,250,255,0.58)', textMuted: 'rgba(208,250,255,0.28)',
    font: { titleWeight: 800, family: 'mono', letterSpacing: '-0.01em' },
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    nameKo: '신스웨이브',
    mood: ['retro-futuristic', 'music', 'creative', 'vibrant', 'pop', 'entertainment'],
    desc: '레트로 다크 퍼플 + 핑크·시안 듀얼 네온. 음악·팝·엔터테인먼트·크리에이티브.',
    layout: 'magazine',
    bg: '#0a0318', bgAlt: '#0d0420', bgCta: '#100525',
    bgGradient: 'linear-gradient(135deg, rgba(255,45,120,0.16) 0%, rgba(124,58,237,0.1) 50%, rgba(0,245,255,0.08) 100%)',
    accent: '#ff2d78', accentSecondary: '#00f5ff',
    textPrimary: '#ffd6f0', textSecondary: 'rgba(255,214,240,0.6)', textMuted: 'rgba(255,214,240,0.28)',
    font: { titleWeight: 800, family: 'sans' },
  },

  // ── 5. MINIMAL ────────────────────────────────────────────────────────────
  {
    id: 'obsidian-pure',
    name: 'Obsidian Pure',
    nameKo: '옵시디언 퓨어',
    mood: ['ultra-minimal', 'editorial', 'thought-leadership', 'essay', 'black-white'],
    desc: '흑요석 블랙 + 순백 액센트. 극단적 미니멀·에세이·사상·에디토리얼 무드.',
    layout: 'minimal',
    bg: '#060606', bgAlt: '#080808', bgCta: '#0a0a0a',
    bgGradient: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0) 70%)',
    accent: '#ffffff',
    textPrimary: '#ffffff', textSecondary: 'rgba(255,255,255,0.55)', textMuted: 'rgba(255,255,255,0.25)',
    font: { titleWeight: 900, family: 'sans', letterSpacing: '-0.03em' },
  },

  // ── 6. INFOGRAPHIC ────────────────────────────────────────────────────────
  {
    id: 'infographic-clean',
    name: 'Infographic Clean',
    nameKo: '인포그래픽 클린',
    mood: ['infographic', 'data-viz', 'diagram', 'educational', 'systematic', 'how-to', 'comparison'],
    desc: '인포그래픽·도식화 전용. 데이터 비교·프로세스·교육·How-to 콘텐츠에 최적.',
    layout: 'infographic',
    bg: '#030c18', bgAlt: '#040e1c', bgCta: '#051020',
    bgGradient: [
      'linear-gradient(180deg, rgba(56,189,248,0.1) 0%, rgba(0,0,0,0) 50%)',
      'repeating-linear-gradient(90deg, rgba(56,189,248,0.025) 0px, rgba(56,189,248,0.025) 1px, transparent 1px, transparent 44px)',
      'repeating-linear-gradient(0deg, rgba(56,189,248,0.025) 0px, rgba(56,189,248,0.025) 1px, transparent 1px, transparent 44px)',
    ].join(', '),
    accent: '#38bdf8', accentSecondary: '#34d399',
    textPrimary: '#e0f2fe', textSecondary: 'rgba(224,242,254,0.65)', textMuted: 'rgba(224,242,254,0.3)',
    noiseOpacity: 0.02,
    font: { titleWeight: 700, family: 'mono', letterSpacing: '0.01em' },
  },

  // ── 7. SPLIT (Remotion split-screen) ─────────────────────────────────────
  {
    id: 'cobalt-split',
    name: 'Cobalt Split',
    nameKo: '코발트 스플릿',
    mood: ['corporate', 'product', 'brand', 'presentation', 'bold', 'announcement'],
    desc: '좌우 분할 패널. 코발트 블루 솔리드 + 다크 콘텐츠 영역. 발표·브랜드·공지 콘텐츠.',
    layout: 'split',
    bg: '#04111f', bgAlt: '#051424', bgCta: '#061729',
    bgGradient: 'linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(0,0,0,0) 70%)',
    accent: '#2563eb', accentSecondary: '#60a5fa',
    textPrimary: '#eff6ff', textSecondary: 'rgba(239,246,255,0.65)', textMuted: 'rgba(239,246,255,0.3)',
    font: { titleWeight: 800, family: 'sans', letterSpacing: '-0.01em' },
  },

  // ── 8. KINETIC (Remotion kinetic typography) ──────────────────────────────
  {
    id: 'acid-kinetic',
    name: 'Acid Kinetic',
    nameKo: '애시드 키네틱',
    mood: ['creative', 'energetic', 'viral', 'youth', 'bold', 'social-media', 'trend'],
    desc: '키네틱 타이포그래피. 형광 라임 + 배경 초대형 텍스트 레이어. 바이럴·크리에이티브 콘텐츠.',
    layout: 'kinetic',
    bg: '#050a00', bgAlt: '#070d00', bgCta: '#091000',
    bgGradient: 'radial-gradient(ellipse at top left, rgba(163,230,53,0.2) 0%, transparent 55%)',
    accent: '#a3e635', accentSecondary: '#facc15',
    textPrimary: '#f7ffe0', textSecondary: 'rgba(247,255,224,0.65)', textMuted: 'rgba(247,255,224,0.28)',
    font: { titleWeight: 900, family: 'sans', letterSpacing: '-0.03em' },
  },

  // ── 9. BROADCAST (Remotion lower-third graphics) ──────────────────────────
  {
    id: 'studio-broadcast',
    name: 'Studio Broadcast',
    nameKo: '스튜디오 브로드캐스트',
    mood: ['news', 'media', 'announcement', 'breaking', 'educational', 'journalism'],
    desc: '방송 하단자막 스타일. 레드 액센트 바 + 하단 타이틀 슬레이트. 뉴스·미디어·공지 콘텐츠.',
    layout: 'broadcast',
    bg: '#0a0a0a', bgAlt: '#0d0d0d', bgCta: '#0f0f0f',
    bgGradient: 'linear-gradient(180deg, rgba(220,38,38,0.06) 0%, rgba(0,0,0,0) 60%)',
    accent: '#dc2626', accentSecondary: '#f87171',
    textPrimary: '#fafafa', textSecondary: 'rgba(250,250,250,0.65)', textMuted: 'rgba(250,250,250,0.3)',
    font: { titleWeight: 700, family: 'sans', letterSpacing: '0.005em' },
  },

  // ── 10. CINEMATIC (Remotion film aesthetic) ───────────────────────────────
  {
    id: 'noir-cinema',
    name: 'Noir Cinema',
    nameKo: '누아르 시네마',
    mood: ['cinematic', 'storytelling', 'drama', 'film', 'dark', 'narrative', 'suspense'],
    desc: '시네마틱 레터박스. 딥 틸 + 레터박스 바 + 대각선 포커스. 스토리텔링·드라마·영화 콘텐츠.',
    layout: 'cinematic',
    bg: '#020608', bgAlt: '#030a0e', bgCta: '#040c10',
    bgGradient: 'linear-gradient(160deg, rgba(20,184,166,0.14) 0%, rgba(0,0,0,0) 55%)',
    accent: '#14b8a6', accentSecondary: '#2dd4bf',
    textPrimary: '#f0fdfa', textSecondary: 'rgba(240,253,250,0.62)', textMuted: 'rgba(240,253,250,0.28)',
    font: { titleWeight: 600, family: 'sans', letterSpacing: '0.02em' },
  },

  // ── 11. TIMELINE (Remotion sequence animation) ────────────────────────────
  {
    id: 'process-blue',
    name: 'Process Blue',
    nameKo: '프로세스 블루',
    mood: ['process', 'how-to', 'tutorial', 'steps', 'guide', 'systematic', 'roadmap'],
    desc: '타임라인·프로세스 레이아웃. 인디고 + 수직 시퀀스 라인. 튜토리얼·로드맵·단계별 가이드.',
    layout: 'timeline',
    bg: '#06071a', bgAlt: '#07091f', bgCta: '#080a24',
    bgGradient: 'linear-gradient(180deg, rgba(99,102,241,0.16) 0%, rgba(0,0,0,0) 65%)',
    accent: '#6366f1', accentSecondary: '#a5b4fc',
    textPrimary: '#eef2ff', textSecondary: 'rgba(238,242,255,0.65)', textMuted: 'rgba(238,242,255,0.28)',
    font: { titleWeight: 700, family: 'sans' },
  },

  // ── 12. GLASS (Remotion glassmorphism UI) ─────────────────────────────────
  {
    id: 'aurora-glass',
    name: 'Aurora Glass',
    nameKo: '오로라 글래스',
    mood: ['trendy', 'modern', 'social-media', 'lifestyle', 'aesthetic', 'Gen-Z', 'premium'],
    desc: '글래스모피즘 패널. 오로라 그린+퍼플 듀얼 그라데이션 + 반투명 카드. 트렌디·소셜미디어.',
    layout: 'glass',
    bg: '#030811', bgAlt: '#040a14', bgCta: '#050c17',
    bgGradient: 'radial-gradient(ellipse at top left, rgba(52,211,153,0.22) 0%, rgba(139,92,246,0.14) 50%, transparent 80%)',
    accent: '#34d399', accentSecondary: '#8b5cf6',
    textPrimary: '#f0fdf4', textSecondary: 'rgba(240,253,244,0.65)', textMuted: 'rgba(240,253,244,0.3)',
    font: { titleWeight: 700, family: 'sans', letterSpacing: '-0.01em' },
  },

  // ── 13. CLEAN WHITE (밝은 에디토리얼) ──────────────────────────────────────
  {
    id: 'clean-white',
    name: 'Clean White',
    nameKo: '클린 화이트',
    mood: ['clean', 'minimal', 'editorial', 'fashion', 'product', 'business', 'corporate'],
    desc: '순백 배경 + 강렬한 블랙 타이포 + 레드 포인트. 패션·제품·비즈니스 미니멀.',
    layout: 'editorial',
    lightMode: true,
    bg: '#ffffff', bgAlt: '#f8f8f8', bgCta: '#f0f0f0',
    bgGradient: 'linear-gradient(135deg, rgba(0,0,0,0.015) 0%, rgba(0,0,0,0) 60%)',
    accent: '#e63946', accentSecondary: '#1a1a1a',
    textPrimary: '#0a0a0a', textSecondary: 'rgba(10,10,10,0.65)', textMuted: 'rgba(10,10,10,0.38)',
    font: { titleWeight: 900, family: 'sans', letterSpacing: '-0.03em' },
  },

  // ── 14. KOREA NEWS (공공기관 카드뉴스) ────────────────────────────────────
  {
    id: 'korea-news',
    name: 'Korea News',
    nameKo: '코리아 뉴스',
    mood: ['news', 'information', 'public', 'education', 'campaign', 'korea', 'government'],
    desc: '한국 공공기관 카드뉴스 스타일. 딥 블루 배경 + 흰 타이포 + 골드 포인트.',
    layout: 'magazine',
    bg: '#003087', bgAlt: '#002575', bgCta: '#001a5c',
    bgGradient: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(0,0,0,0.1) 80%)',
    accent: '#ffd700', accentSecondary: '#ffffff',
    textPrimary: '#ffffff', textSecondary: 'rgba(255,255,255,0.82)', textMuted: 'rgba(255,255,255,0.52)',
    font: { titleWeight: 800, family: 'sans' },
  },

  // ── 15. VIVID ORANGE (비비드 오렌지 프로모션) ─────────────────────────────
  {
    id: 'vivid-orange',
    name: 'Vivid Orange',
    nameKo: '비비드 오렌지',
    mood: ['energetic', 'sale', 'promotion', 'ecommerce', 'food', 'lifestyle', 'vibrant', 'deal'],
    desc: '비비드 오렌지-레드 배경. 프로모션·쇼핑·에너지·식음료·이벤트 콘텐츠에 최적.',
    layout: 'bold-left',
    bg: '#e84510', bgAlt: '#cc3c0e', bgCta: '#b5350c',
    bgGradient: 'linear-gradient(135deg, rgba(255,140,0,0.45) 0%, rgba(200,0,50,0.25) 100%)',
    accent: '#ffffff', accentSecondary: '#ffdd00',
    textPrimary: '#ffffff', textSecondary: 'rgba(255,255,255,0.88)', textMuted: 'rgba(255,255,255,0.58)',
    font: { titleWeight: 900, family: 'sans', letterSpacing: '-0.02em' },
  },

  // ── 16. CREAM EDITORIAL (따뜻한 에디토리얼) ───────────────────────────────
  {
    id: 'cream-editorial',
    name: 'Cream Editorial',
    nameKo: '크림 에디토리얼',
    mood: ['warm', 'premium', 'fashion', 'beauty', 'food', 'lifestyle', 'editorial', 'magazine'],
    desc: '따뜻한 크림 배경 + 다크 타이포 + 오렌지 포인트. 프리미엄 라이프스타일·패션.',
    layout: 'minimal',
    lightMode: true,
    bg: '#f7f2e9', bgAlt: '#f2ede4', bgCta: '#ede8df',
    bgGradient: 'linear-gradient(135deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0) 60%)',
    accent: '#e05c1a', accentSecondary: '#1a1a1a',
    textPrimary: '#1a1a1a', textSecondary: 'rgba(26,26,26,0.65)', textMuted: 'rgba(26,26,26,0.38)',
    font: { titleWeight: 900, family: 'sans', letterSpacing: '-0.02em' },
  },

  // ── 17. PHOTO STORY (포토 오버레이) ──────────────────────────────────────
  {
    id: 'photo-story',
    name: 'Photo Story',
    nameKo: '포토 스토리',
    mood: ['photo', 'story', 'lifestyle', 'travel', 'visual', 'dramatic', 'immersive'],
    desc: '사진 위 텍스트 오버레이 전용. 이미지 업로드 시 최고의 효과. 감성적 스토리텔링.',
    layout: 'photo-overlay',
    bg: '#1a1a2e', bgAlt: '#16213e', bgCta: '#0f3460',
    bgGradient: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.52) 55%, rgba(0,0,0,0.18) 100%)',
    accent: '#ffffff', accentSecondary: '#e94560',
    textPrimary: '#ffffff', textSecondary: 'rgba(255,255,255,0.88)', textMuted: 'rgba(255,255,255,0.58)',
    font: { titleWeight: 800, family: 'sans' },
  },
];

export const LAYOUT_LABELS: Record<LayoutType, { ko: string; desc: string }> = {
  'bold-left':     { ko: '볼드레프트',   desc: '좌측 액센트 바' },
  'centered':      { ko: '센터드',       desc: '중앙 정렬' },
  'editorial':     { ko: '에디토리얼',   desc: '배경 카드번호' },
  'magazine':      { ko: '매거진',       desc: '상단 풀헤더' },
  'minimal':       { ko: '미니멀',       desc: '순수 타이포' },
  'infographic':   { ko: '인포그래픽',   desc: '격자+번호박스' },
  'split':         { ko: '스플릿',       desc: '좌우 분할' },
  'kinetic':       { ko: '키네틱',       desc: '대형 배경텍스트' },
  'broadcast':     { ko: '브로드캐스트', desc: '방송 자막바' },
  'cinematic':     { ko: '시네마틱',     desc: '레터박스' },
  'timeline':      { ko: '타임라인',     desc: '수직 시퀀스' },
  'glass':         { ko: '글래스',       desc: '글래스모피즘' },
  'photo-overlay': { ko: '포토오버레이', desc: '사진 위 텍스트' },
};

export const ALL_LAYOUT_TYPES: LayoutType[] = [
  'bold-left', 'centered', 'editorial', 'magazine', 'minimal', 'infographic',
  'split', 'kinetic', 'broadcast', 'cinematic', 'timeline', 'glass', 'photo-overlay',
];

export function getStyle(id: string): StyleDef {
  return CAROUSEL_STYLES.find(s => s.id === id) ?? CAROUSEL_STYLES[0];
}

export function getStyleList(): string {
  return CAROUSEL_STYLES.map((s, i) =>
    `${i + 1}. ${s.id} — ${s.nameKo} [레이아웃: ${s.layout}] [무드: ${s.mood.slice(0,3).join(', ')}]: ${s.desc}`
  ).join('\n');
}
