'use client';

import { useEffect, useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import type { Tier } from '@/lib/tier';
import { TIER_LABELS, TIER_COLORS } from '@/lib/tier';

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  tier: Tier;
  memo: string;
  joinedAt: string;
  lastSignIn: string | null;
}

const TIERS: Tier[] = ['guest', 'tier1', 'tier2', 'tier3', 'admin'];

function TierBadge({ tier }: { tier: Tier }) {
  const c = TIER_COLORS[tier];
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-md font-bold"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {TIER_LABELS[tier]}
    </span>
  );
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [editMemo, setEditMemo] = useState<Record<string, string>>({});

  async function fetchUsers() {
    setLoading(true);
    const res = await fetch('/api/admin/users');
    if (res.status === 403) { setForbidden(true); setLoading(false); return; }
    const { users } = await res.json();
    setUsers(users ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchUsers(); }, []);

  async function handleTierChange(userId: string, tier: Tier) {
    setSaving(userId);
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: userId, tier, memo: editMemo[userId] ?? users.find(u => u.id === userId)?.memo ?? '' }),
    });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, tier } : u));
    setSaving(null);
  }

  async function handleMemoSave(userId: string) {
    setSaving(userId + '_memo');
    const memo = editMemo[userId] ?? '';
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: userId, tier: users.find(u => u.id === userId)?.tier, memo }),
    });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, memo } : u));
    setSaving(null);
  }

  const filtered = users.filter(u =>
    (u.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (u.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  if (forbidden) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-[14px]" style={{ color: '#ef4444' }}>관리자 권한이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold" style={{ color: 'var(--text)' }}>회원 관리</h1>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            총 {users.length}명
          </p>
        </div>
        <button onClick={fetchUsers} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px]"
          style={{ background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.2)', color: '#4f8ef7' }}>
          <RefreshCw size={12} /> 새로고침
        </button>
      </div>

      {/* 검색 */}
      <div className="relative max-w-xs">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="이메일 또는 이름 검색"
          className="w-full pl-8 pr-3 py-2 rounded-lg text-[12px] outline-none"
          style={{ background: 'var(--sidebar)', border: '1px solid var(--border)', color: 'var(--text)' }}
        />
      </div>

      {/* 티어별 요약 */}
      <div className="flex gap-3 flex-wrap">
        {TIERS.map(tier => {
          const count = users.filter(u => u.tier === tier).length;
          const c = TIER_COLORS[tier];
          return (
            <div key={tier} className="px-3 py-2 rounded-lg text-[11px]"
              style={{ background: c.bg, border: `1px solid ${c.border}` }}>
              <span style={{ color: c.color }}>{TIER_LABELS[tier]}</span>
              <span className="ml-2 font-bold" style={{ color: 'var(--text)' }}>{count}명</span>
            </div>
          );
        })}
      </div>

      {/* 회원 테이블 */}
      {loading ? (
        <div className="text-center py-12 text-[13px]" style={{ color: 'var(--text-muted)' }}>불러오는 중...</div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ background: 'var(--sidebar)', borderBottom: '1px solid var(--border)' }}>
                {['이름 / 이메일', '등급', '가입일', '최근 로그인', '메모', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.id}
                  style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', background: 'var(--bg)' }}>
                  {/* 이름/이메일 */}
                  <td className="px-4 py-3">
                    <p className="font-medium" style={{ color: 'var(--text)' }}>{u.name ?? '—'}</p>
                    <p style={{ color: 'var(--text-faint)' }}>{u.email}</p>
                  </td>
                  {/* 티어 선택 */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <TierBadge tier={u.tier} />
                      <select
                        value={u.tier}
                        onChange={e => handleTierChange(u.id, e.target.value as Tier)}
                        disabled={saving === u.id}
                        className="text-[11px] px-2 py-1 rounded-lg outline-none"
                        style={{ background: 'var(--sidebar)', border: '1px solid var(--border)', color: 'var(--text)' }}
                      >
                        {TIERS.map(t => (
                          <option key={t} value={t}>{TIER_LABELS[t]}</option>
                        ))}
                      </select>
                      {saving === u.id && <span style={{ color: 'var(--text-faint)' }}>저장 중...</span>}
                    </div>
                  </td>
                  {/* 가입일 */}
                  <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                    {new Date(u.joinedAt).toLocaleDateString('ko-KR')}
                  </td>
                  {/* 최근 로그인 */}
                  <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                    {u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString('ko-KR') : '—'}
                  </td>
                  {/* 메모 */}
                  <td className="px-4 py-3">
                    <input
                      value={editMemo[u.id] ?? u.memo}
                      onChange={e => setEditMemo(prev => ({ ...prev, [u.id]: e.target.value }))}
                      placeholder="메모 입력"
                      className="w-full px-2 py-1 rounded text-[11px] outline-none"
                      style={{ background: 'var(--sidebar)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    />
                  </td>
                  {/* 저장 버튼 */}
                  <td className="px-4 py-3">
                    {editMemo[u.id] !== undefined && editMemo[u.id] !== u.memo && (
                      <button
                        onClick={() => handleMemoSave(u.id)}
                        disabled={saving === u.id + '_memo'}
                        className="px-2 py-1 rounded text-[10px]"
                        style={{ background: 'rgba(79,142,247,0.15)', color: '#4f8ef7', border: '1px solid rgba(79,142,247,0.25)' }}
                      >
                        저장
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>
                    검색 결과가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
