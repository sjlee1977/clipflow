// ─── Tier 정의 ────────────────────────────────────────────────────────────────
export type Tier = 'guest' | 'free' | 'pro' | 'enterprise' | 'admin';

export const TIER_LABELS: Record<Tier, string> = {
  guest:      '비회원',
  free:       'Free',
  pro:        'Pro',
  enterprise: 'Enterprise',
  admin:      'Admin',
};

export const TIER_COLORS: Record<Tier, { bg: string; color: string; border: string }> = {
  guest:      { bg: 'rgba(156,163,175,0.10)', color: '#9ca3af', border: 'rgba(156,163,175,0.25)' },
  free:       { bg: 'rgba(79,142,247,0.10)',  color: '#4f8ef7', border: 'rgba(79,142,247,0.30)'  },
  pro:        { bg: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: 'rgba(167,139,250,0.35)' },
  enterprise: { bg: 'rgba(251,191,36,0.12)',  color: '#fbbf24', border: 'rgba(251,191,36,0.35)'  },
  admin:      { bg: 'rgba(239,68,68,0.10)',   color: '#f87171', border: 'rgba(239,68,68,0.30)'   },
};

// ─── 티어 순서 (높을수록 권한 높음) ───────────────────────────────────────────
const TIER_RANK: Record<Tier, number> = {
  guest:      0,
  free:       1,
  pro:        2,
  enterprise: 3,
  admin:      4,
};

// ─── 라우트별 최소 티어 ────────────────────────────────────────────────────────
const ROUTE_REQUIREMENTS: { pattern: RegExp; tier: Tier }[] = [
  // admin 전용
  { pattern: /^\/dashboard\/admin/,          tier: 'admin' },

  // enterprise 전용
  { pattern: /^\/dashboard\/trends\/subscriber/, tier: 'enterprise' },

  // pro 이상
  { pattern: /^\/dashboard\/video/,          tier: 'pro' },
  { pattern: /^\/dashboard\/auto-blog/,      tier: 'pro' },
  { pattern: /^\/dashboard\/reformat/,       tier: 'pro' },
  { pattern: /^\/dashboard\/competitor/,     tier: 'pro' },
  { pattern: /^\/dashboard\/trends\/outliers/, tier: 'pro' },
  { pattern: /^\/dashboard\/trends\/comments/, tier: 'pro' },
  { pattern: /^\/dashboard\/calendar/,       tier: 'pro' },
  { pattern: /^\/dashboard\/my-channel/,     tier: 'pro' },

  // free 이상 (로그인 필요)
  { pattern: /^\/dashboard\/keyword/,        tier: 'free' },
  { pattern: /^\/dashboard\/script/,         tier: 'free' },
  { pattern: /^\/dashboard\/blog/,           tier: 'free' },
  { pattern: /^\/dashboard\/prompt/,         tier: 'free' },
  { pattern: /^\/dashboard\/thumbnail/,      tier: 'free' },
  { pattern: /^\/dashboard\/history/,        tier: 'free' },
  { pattern: /^\/dashboard\/my-scripts/,     tier: 'free' },
  { pattern: /^\/dashboard\/carousel/,       tier: 'free' },
  { pattern: /^\/dashboard\/trends\/viral/,  tier: 'free' },
  { pattern: /^\/dashboard\/settings/,       tier: 'free' },
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
