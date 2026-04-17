// ─── Tier 정의 ────────────────────────────────────────────────────────────────
export type Tier = 'guest' | 'tier1' | 'tier2' | 'tier3' | 'admin';

export const TIER_LABELS: Record<Tier, string> = {
  guest: '비회원',
  tier1: 'Tier 1',
  tier2: 'Tier 2',
  tier3: 'Tier 3',
  admin: 'Admin',
};

export const TIER_COLORS: Record<Tier, { bg: string; color: string; border: string }> = {
  guest: { bg: 'rgba(156,163,175,0.10)', color: '#9ca3af', border: 'rgba(156,163,175,0.25)' },
  tier1: { bg: 'rgba(79,142,247,0.10)',  color: '#4f8ef7', border: 'rgba(79,142,247,0.30)'  },
  tier2: { bg: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: 'rgba(167,139,250,0.35)' },
  tier3: { bg: 'rgba(34,211,238,0.12)',  color: '#22d3ee', border: 'rgba(34,211,238,0.35)'  },
  admin: { bg: 'rgba(239,68,68,0.10)',   color: '#f87171', border: 'rgba(239,68,68,0.30)'   },
};

// ─── Guest 사용량 한도 ─────────────────────────────────────────────────────────
export const GUEST_LIMITS = { daily: 3, monthly: 10 };

// ─── 티어 순서 (높을수록 권한 높음) ───────────────────────────────────────────
const TIER_RANK: Record<Tier, number> = {
  guest: 0,
  tier1: 1,
  tier2: 2,
  tier3: 3,
  admin: 4,
};

// ─── 라우트별 최소 티어 ────────────────────────────────────────────────────────
const ROUTE_REQUIREMENTS: { pattern: RegExp; tier: Tier }[] = [
  // admin 전용
  { pattern: /^\/dashboard\/admin/,                  tier: 'admin' },

  // tier3 이상
  { pattern: /^\/dashboard\/trends\/subscriber/,     tier: 'tier3' },

  // tier2 이상
  { pattern: /^\/dashboard\/video/,                  tier: 'tier2' },
  { pattern: /^\/dashboard\/auto-blog/,              tier: 'tier2' },
  { pattern: /^\/dashboard\/reformat/,               tier: 'tier2' },
  { pattern: /^\/dashboard\/competitor/,             tier: 'tier2' },
  { pattern: /^\/dashboard\/trends\/outliers/,       tier: 'tier2' },
  { pattern: /^\/dashboard\/trends\/comments/,       tier: 'tier2' },
  { pattern: /^\/dashboard\/calendar/,               tier: 'tier2' },
  { pattern: /^\/dashboard\/my-channel/,             tier: 'tier2' },

  // tier1 이상 (로그인 필요)
  { pattern: /^\/dashboard\/keyword/,                tier: 'tier1' },
  { pattern: /^\/dashboard\/script/,                 tier: 'tier1' },
  { pattern: /^\/dashboard\/blog/,                   tier: 'tier1' },
  { pattern: /^\/dashboard\/prompt/,                 tier: 'tier1' },
  { pattern: /^\/dashboard\/thumbnail/,              tier: 'tier1' },
  { pattern: /^\/dashboard\/history/,                tier: 'tier1' },
  { pattern: /^\/dashboard\/my-scripts/,             tier: 'tier1' },
  { pattern: /^\/dashboard\/carousel/,               tier: 'tier1' },
  { pattern: /^\/dashboard\/trends\/viral/,          tier: 'tier1' },
  { pattern: /^\/dashboard\/settings/,               tier: 'tier1' },
];

/** 해당 라우트에 접근하기 위한 최소 티어 반환 */
export function requiredTier(route: string): Tier {
  for (const { pattern, tier } of ROUTE_REQUIREMENTS) {
    if (pattern.test(route)) return tier;
  }
  return 'guest';
}

/** tier가 route에 접근 가능한지 여부 */
export function canAccess(tier: Tier, route: string): boolean {
  const needed = requiredTier(route);
  return TIER_RANK[tier] >= TIER_RANK[needed];
}
