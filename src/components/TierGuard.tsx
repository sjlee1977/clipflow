'use client';

import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import type { Tier } from '@/lib/tier';
import { canAccess, TIER_LABELS, requiredTier } from '@/lib/tier';

interface TierGuardProps {
  route: string;
  children: React.ReactNode;
}

export default function TierGuard({ route, children }: TierGuardProps) {
  const [tier, setTier] = useState<Tier | null>(null);

  useEffect(() => {
    fetch('/api/user/profile')
      .then(r => r.json())
      .then(d => setTier(d.tier ?? 'guest'));
  }, []);

  if (tier === null) return null; // 로딩 중

  if (!canAccess(tier, route)) {
    const needed = requiredTier(route);
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <Lock size={28} style={{ color: '#ef4444', opacity: 0.7 }} />
        </div>
        <div className="text-center space-y-2">
          <p className="text-[16px] font-semibold" style={{ color: 'var(--text)' }}>
            접근 권한이 없습니다
          </p>
          <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
            이 기능은 <span className="font-bold" style={{ color: '#fbbf24' }}>{TIER_LABELS[needed]}</span> 이상 멤버십에서 이용할 수 있습니다.
          </p>
          <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
            현재 등급: <span style={{ color: 'var(--text-muted)' }}>{TIER_LABELS[tier]}</span>
          </p>
        </div>
        <a
          href="/dashboard/settings"
          className="px-5 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{
            background: 'linear-gradient(135deg, rgba(251,191,36,0.2), rgba(251,191,36,0.1))',
            border: '1px solid rgba(251,191,36,0.35)',
            color: '#fbbf24',
          }}
        >
          멤버십 업그레이드
        </a>
      </div>
    );
  }

  return <>{children}</>;
}

// ── 사용량 체크 훅 (guest용) ─────────────────────────────────
export function useUsageCheck() {
  const checkAndLog = async (action: string): Promise<{ ok: boolean; reason?: string }> => {
    try {
      const res = await fetch('/api/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      return { ok: data.ok, reason: data.reason };
    } catch {
      return { ok: true }; // 네트워크 오류 시 허용
    }
  };
  return { checkAndLog };
}

// ── 사용량 표시 배너 (guest용) ────────────────────────────────
export function GuestUsageBanner() {
  const [usage, setUsage] = useState<{ daily: { used: number; limit: number }; monthly: { used: number; limit: number } } | null>(null);
  const [tier, setTier] = useState<Tier | null>(null);

  useEffect(() => {
    fetch('/api/user/profile').then(r => r.json()).then(d => setTier(d.tier));
    fetch('/api/usage').then(r => r.json()).then(setUsage);
  }, []);

  if (tier !== 'guest' || !usage) return null;

  const dailyLeft = usage.daily.limit - usage.daily.used;
  const monthlyLeft = usage.monthly.limit - usage.monthly.used;

  return (
    <div
      className="flex items-center gap-4 px-4 py-2 rounded-xl mb-4 text-[12px]"
      style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}
    >
      <span style={{ color: '#fbbf24' }}>GUEST</span>
      <span style={{ color: 'var(--text-muted)' }}>
        오늘 <strong style={{ color: dailyLeft <= 1 ? '#ef4444' : 'var(--text)' }}>{dailyLeft}회</strong> 남음
      </span>
      <span style={{ color: 'var(--text-muted)' }}>
        이번 달 <strong style={{ color: monthlyLeft <= 5 ? '#ef4444' : 'var(--text)' }}>{monthlyLeft}회</strong> 남음
      </span>
      <a href="/dashboard/settings" className="ml-auto text-[11px] underline" style={{ color: '#fbbf24' }}>
        멤버십 가입
      </a>
    </div>
  );
}
