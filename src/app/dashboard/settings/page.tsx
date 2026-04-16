'use client';

import { useState, useEffect } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { TREND_CATEGORIES } from '@/lib/youtube-trends';

type Provider = 'anthropic' | 'gemini' | 'minimax' | 'elevenlabs' | 'kling' | 'fal' | 'qwen' | 'perplexity';

const inputCls = 'flex-1 bg-black/20 text-white/80 border border-white/10 rounded-lg focus:border-white/30 focus:outline-none text-[12px] font-mono placeholder:text-white/18 px-3 py-1.5 transition-colors';
const saveBtnCls = 'cf-filter-btn px-4 py-1.5 bg-transparent border border-white/12 text-white/60 font-medium text-[12px] font-mono rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap';

/* ── 단일 키 섹션 ── */
function SingleKeySection({
  name, label, color, models, placeholder, docsUrl, hasKey, maskedKey, onSave, onDelete,
}: {
  name: string; label: string; color: string; models: string[];
  placeholder: string; docsUrl: string;
  hasKey: boolean; maskedKey: string;
  onSave: (provider: Provider, key: string) => Promise<void>;
  onDelete: (provider: Provider) => Promise<void>;
}) {
  const providerMap: Record<string, Provider> = {
    anthropic: 'anthropic',
    google: 'gemini',
    elevenlabs: 'elevenlabs',
    'fal.ai': 'fal',
    'dashscope': 'qwen',
    'perplexity': 'perplexity',
  };
  const provider: Provider = providerMap[name.toLowerCase()] ?? 'gemini';
  const [input, setInput] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showKey, setShowKey] = useState(false);

  async function handleSave() {
    if (!input.trim()) return;
    setSaving(true);
    await onSave(provider, input.trim());
    setSaving(false); setInput(''); setEditing(false);
  }

  return (
    <div className="border border-white/8 bg-white/[0.015] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <div>
            <p className="text-white/80 text-[12px] font-medium font-mono">{name} — {label}</p>
            <p className="text-white/28 text-[10.5px] font-mono mt-0.5">{models.join(' · ')}</p>
          </div>
        </div>
        {hasKey
          ? <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-green-400/25 text-green-400/70 bg-green-400/5"><span className="w-1 h-1 rounded-full bg-green-400" />연결됨</span>
          : <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/8 text-white/25">미설정</span>}
      </div>
      <div className="px-4 py-3">
        {hasKey && !editing ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-black/20 border border-white/8 rounded-lg px-3 py-1.5">
              <span className="text-white/40 text-[12px] font-mono flex-1">{showKey ? maskedKey : '••••••••••••••••••'}</span>
              <button onClick={() => setShowKey(v => !v)} className="text-white/25 hover:text-white/55 text-[10px] transition-colors">{showKey ? '숨기기' : '보기'}</button>
            </div>
            <button onClick={() => setEditing(true)} className="px-2.5 py-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white/70 text-[11px] font-mono transition-colors">변경</button>
            <button onClick={async () => { setDeleting(true); await onDelete(provider); setDeleting(false); setEditing(false); }} disabled={deleting} className="px-2.5 py-1.5 rounded-lg border border-red-500/15 text-red-400/40 hover:text-red-400 text-[11px] font-mono transition-colors disabled:opacity-40">{deleting ? '...' : '삭제'}</button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex gap-2">
              <input type="password" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} placeholder={placeholder} className={inputCls} />
              <button onClick={handleSave} disabled={!input.trim() || saving} className={saveBtnCls}>{saving ? '저장 중...' : '저장'}</button>
              {editing && <button onClick={() => { setEditing(false); setInput(''); }} className="px-2.5 py-1.5 rounded-lg border border-white/8 text-white/35 hover:text-white/65 text-[11px] font-mono transition-colors">취소</button>}
            </div>
            <p className="text-white/20 text-[10.5px] font-mono">암호화 저장 · <a href={docsUrl} target="_blank" rel="noopener noreferrer" className="text-[#17BEBB]/45 hover:text-[#17BEBB] transition-colors">키 발급 →</a></p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 이중 키 섹션 (Kling, MiniMax) ── */
function DualKeySection({
  name, label, color, fields, hasKey, masked1, masked2, onSave, onDelete, docsUrl, provider
}: {
  name: string; label: string; color: string; 
  fields: { label: string; placeholder: string }[];
  hasKey: boolean; masked1: string; masked2: string;
  onSave: (provider: Provider, key: string, key2: string) => Promise<void>;
  onDelete: (provider: Provider) => Promise<void>;
  docsUrl: string;
  provider: Provider;
}) {
  const [val1, setVal1] = useState('');
  const [val2, setVal2] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showKeys, setShowKeys] = useState(false);

  async function handleSave() {
    if (!val1.trim() || !val2.trim()) return;
    setSaving(true);
    await onSave(provider, val1.trim(), val2.trim());
    setSaving(false); setVal1(''); setVal2(''); setEditing(false);
  }

  return (
    <div className="border border-white/8 bg-white/[0.015] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <div>
            <p className="text-white/80 text-[12px] font-medium font-mono">{name} — {label}</p>
            <p className="text-white/28 text-[10.5px] font-mono mt-0.5">{fields.map(f => f.label).join(' · ')}</p>
          </div>
        </div>
        {hasKey
          ? <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-green-400/25 text-green-400/70 bg-green-400/5"><span className="w-1 h-1 rounded-full bg-green-400" />연결됨</span>
          : <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/8 text-white/25">미설정</span>}
      </div>
      <div className="px-4 py-3">
        {hasKey && !editing ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 bg-black/20 border border-white/8 rounded-lg px-3 py-1.5">
              <span className="text-white/28 text-[10px] w-20 shrink-0">{fields[0].label}</span>
              <span className="text-white/45 text-[12px] font-mono flex-1">{showKeys ? masked1 : '••••••••••••••••••'}</span>
            </div>
            <div className="flex items-center gap-2 bg-black/20 border border-white/8 rounded-lg px-3 py-1.5">
              <span className="text-white/28 text-[10px] w-20 shrink-0">{fields[1].label}</span>
              <span className="text-white/45 text-[12px] font-mono flex-1">{showKeys ? masked2 : '••••••••••••••••••'}</span>
            </div>
            <div className="flex items-center gap-2.5 pt-0.5">
              <button onClick={() => setShowKeys(v => !v)} className="text-white/25 hover:text-white/55 text-[10px] transition-colors">{showKeys ? '숨기기' : '보기'}</button>
              <button onClick={() => setEditing(true)} className="px-2.5 py-1 rounded-lg border border-white/10 text-white/40 hover:text-white/70 text-[11px] font-mono transition-colors">변경</button>
              <button onClick={async () => { setDeleting(true); await onDelete(provider); setDeleting(false); }} disabled={deleting} className="px-2.5 py-1 rounded-lg border border-red-500/15 text-red-400/40 hover:text-red-400 text-[11px] font-mono transition-colors disabled:opacity-40">{deleting ? '...' : '삭제'}</button>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="space-y-1.5">
              <div className="flex gap-2 items-center">
                <span className="text-white/28 text-[10.5px] font-mono w-20 shrink-0">{fields[0].label}</span>
                <input type="password" value={val1} onChange={e => setVal1(e.target.value)} placeholder={fields[0].placeholder} className={inputCls} />
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-white/28 text-[10.5px] font-mono w-20 shrink-0">{fields[1].label}</span>
                <input type="password" value={val2} onChange={e => setVal2(e.target.value)} placeholder={fields[1].placeholder} className={inputCls} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={!val1.trim() || !val2.trim() || saving} className={saveBtnCls}>{saving ? '저장 중...' : '저장'}</button>
              {editing && <button onClick={() => { setEditing(false); setVal1(''); setVal2(''); }} className="px-2.5 py-1.5 rounded-lg border border-white/8 text-white/35 hover:text-white/65 text-[11px] font-mono transition-colors">취소</button>}
            </div>
            <p className="text-white/20 text-[10.5px] font-mono">가이드에 따라 입력 · <a href={docsUrl} target="_blank" rel="noopener noreferrer" className="text-[#17BEBB]/45 hover:text-[#17BEBB] transition-colors">발급 안내 →</a></p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 블로그 플랫폼 연결 섹션 ──
type BlogPlatform = 'wordpress' | 'naver' | 'nextblog';

interface BlogCredentials {
  wordpress: { connected: boolean; siteUrl: string; username: string; appPassword: string; status: string };
  naver: { connected: boolean; accessToken: string };
  nextblog: { connected: boolean; supabaseUrl: string; supabaseKey: string; status: string };
}

function BlogPlatformSection() {
  const [creds, setCreds] = useState<BlogCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<BlogPlatform | null>(null);
  const [deleting, setDeleting] = useState<BlogPlatform | null>(null);
  const [editing, setEditing] = useState<BlogPlatform | null>(null);
  const [toast, setToast] = useState('');
  const [selected, setSelected] = useState<BlogPlatform>('wordpress');

  const [wpForm, setWpForm] = useState({ siteUrl: '', username: '', appPassword: '', status: 'draft' });
  const [naverForm, setNaverForm] = useState({ accessToken: '' });
  const [nextForm, setNextForm] = useState({ supabaseUrl: '', supabaseKey: '', status: 'draft' });

  useEffect(() => { fetchCreds(); }, []);

  async function fetchCreds() {
    setLoading(true);
    try {
      const res = await fetch('/api/blog/credentials');
      if (res.ok) setCreds(await res.json());
    } finally { setLoading(false); }
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500); }

  async function handleSave(platform: BlogPlatform) {
    setSaving(platform);
    const configMap = { wordpress: wpForm, naver: naverForm, nextblog: nextForm };
    const res = await fetch('/api/blog/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, config: configMap[platform] }),
    });
    setSaving(null);
    if (res.ok) { showToast('저장되었습니다'); setEditing(null); await fetchCreds(); }
    else { const d = await res.json(); showToast(d.error || '저장 실패'); }
  }

  async function handleDelete(platform: BlogPlatform) {
    if (!confirm('연결 정보를 삭제하시겠습니까?')) return;
    setDeleting(platform);
    await fetch('/api/blog/credentials', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform }),
    });
    setDeleting(null);
    showToast('삭제되었습니다');
    await fetchCreds();
  }

  const platformMeta = {
    wordpress: { label: 'WordPress', color: '#21759b', icon: 'W', desc: 'REST API (Application Password)' },
    naver: { label: '네이버 블로그', color: '#03c75a', icon: 'N', desc: 'Open API (Access Token)' },
    nextblog: { label: 'Next.js 블로그', color: '#7c3aed', icon: '▲', desc: 'Supabase posts 테이블' },
  };

  if (loading) return (
    <div className="flex items-center gap-2 px-4 py-6 text-white/30 text-[12px] font-mono border border-white/8 rounded-xl">
      <span className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />불러오는 중...
    </div>
  );

  return (
    <div className="flex gap-6 items-start">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur border border-white/20 px-4 py-2 rounded-xl text-white/75 text-[12px] font-mono z-50">{toast}</div>
      )}

      {/* 사이드바 */}
      <div className="w-52 shrink-0 space-y-2 sticky top-4">
        <p className="text-[10px] text-white/25 uppercase tracking-widest mb-3">블로그 연결</p>
        {(Object.keys(platformMeta) as BlogPlatform[]).map(p => {
          const isConn = creds?.[p]?.connected ?? false;
          const isSel = selected === p;
          return (
            <button key={p} onClick={() => setSelected(p)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                isConn ? 'border-green-400/20 bg-green-400/[0.04]' : isSel ? 'border-white/12 bg-white/[0.03]' : 'border-white/6 bg-white/[0.01]'
              }`}>
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: isConn ? '#4ade80' : '#ffffff20' }} />
              <span className="text-[11px] font-mono text-white/50 flex-1 truncate text-left">{platformMeta[p].label}</span>
              <span className={`text-[10px] shrink-0 ${isConn ? 'text-green-400/70' : 'text-white/18'}`}>{isConn ? '✓' : '—'}</span>
            </button>
          );
        })}
      </div>

      {/* 선택된 플랫폼 */}
      <div className="flex-1 min-w-0">
      {(Object.keys(platformMeta) as BlogPlatform[]).filter(p => p === selected).map(platform => {
        const info = platformMeta[platform];
        const isConnected = creds?.[platform]?.connected ?? false;
        const isEditing = editing === platform;
        const isSaving = saving === platform;
        const isDeleting = deleting === platform;

        return (
          <div key={platform} className="border border-white/8 bg-white/[0.015] rounded-xl overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-black text-white shrink-0" style={{ backgroundColor: info.color }}>
                  {info.icon}
                </div>
                <div>
                  <p className="text-white text-[13px] font-bold font-mono">{info.label}</p>
                  <p className="text-white/35 text-[11.5px] font-mono mt-0.5">{info.desc}</p>
                </div>
              </div>
              {isConnected
                ? <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-green-400/25 text-green-400/70 bg-green-400/5"><span className="w-1 h-1 rounded-full bg-green-400" />연결됨</span>
                : <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/8 text-white/25">미연결</span>}
            </div>

            {/* 바디 */}
            <div className="px-4 py-3">
              {isConnected && !isEditing ? (
                <div className="flex items-center gap-3">
                  {platform === 'wordpress' && creds?.wordpress && (
                    <div className="flex-1 flex flex-col gap-1">
                      <div className="flex items-center gap-2 bg-black/20 border border-white/8 rounded-lg px-3 py-1.5">
                        <span className="text-white/25 text-[10px] w-20 shrink-0">Site URL</span>
                        <span className="text-white/55 text-[12px] font-mono truncate">{creds.wordpress.siteUrl}</span>
                      </div>
                      <div className="flex items-center gap-2 bg-black/20 border border-white/8 rounded-lg px-3 py-1.5">
                        <span className="text-white/25 text-[10px] w-20 shrink-0">Username</span>
                        <span className="text-white/55 text-[12px] font-mono">{creds.wordpress.username}</span>
                      </div>
                    </div>
                  )}
                  {platform === 'naver' && creds?.naver && (
                    <div className="flex-1 bg-black/20 border border-white/8 rounded-lg px-3 py-1.5">
                      <span className="text-white/25 text-[10px]">Access Token </span>
                      <span className="text-white/45 text-[12px] font-mono">{creds.naver.accessToken}</span>
                    </div>
                  )}
                  {platform === 'nextblog' && creds?.nextblog && (
                    <div className="flex-1 flex flex-col gap-1">
                      <div className="flex items-center gap-2 bg-black/20 border border-white/8 rounded-lg px-3 py-1.5">
                        <span className="text-white/25 text-[10px] w-24 shrink-0">Supabase URL</span>
                        <span className="text-white/55 text-[12px] font-mono truncate">{creds.nextblog.supabaseUrl}</span>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button onClick={() => setEditing(platform)} className="px-2.5 py-1 rounded-lg border border-white/10 text-white/40 hover:text-white/70 text-[11px] font-mono transition-colors">변경</button>
                    <button onClick={() => handleDelete(platform)} disabled={isDeleting} className="px-2.5 py-1 rounded-lg border border-red-500/15 text-red-400/40 hover:text-red-400 text-[11px] font-mono transition-colors disabled:opacity-40">{isDeleting ? '...' : '삭제'}</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {platform === 'wordpress' && (
                    <>
                      <div className="space-y-1.5">
                        <div className="flex gap-2 items-center">
                          <span className="text-white/28 text-[10.5px] font-mono w-28 shrink-0">Site URL</span>
                          <input type="text" value={wpForm.siteUrl} onChange={e => setWpForm(f => ({ ...f, siteUrl: e.target.value }))} placeholder="https://yourblog.com" className={inputCls} />
                        </div>
                        <div className="flex gap-2 items-center">
                          <span className="text-white/28 text-[10.5px] font-mono w-28 shrink-0">Username</span>
                          <input type="text" value={wpForm.username} onChange={e => setWpForm(f => ({ ...f, username: e.target.value }))} placeholder="admin" className={inputCls} />
                        </div>
                        <div className="flex gap-2 items-center">
                          <span className="text-white/28 text-[10.5px] font-mono w-28 shrink-0">App Password</span>
                          <input type="password" value={wpForm.appPassword} onChange={e => setWpForm(f => ({ ...f, appPassword: e.target.value }))} placeholder="xxxx xxxx xxxx xxxx" className={inputCls} />
                        </div>
                        <div className="flex gap-2 items-center">
                          <span className="text-white/28 text-[10.5px] font-mono w-28 shrink-0">기본 상태</span>
                          <div className="flex gap-1.5 flex-1">
                            {(['draft', 'publish'] as const).map(s => (
                              <button key={s} onClick={() => setWpForm(f => ({ ...f, status: s }))} className={`flex-1 text-[11px] font-mono py-1 rounded-lg border transition-colors ${wpForm.status === s ? 'border-white/25 bg-white/6 text-white/70' : 'border-white/8 text-white/28 hover:text-white/55'}`}>
                                {s === 'draft' ? '초안' : '발행'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <p className="text-white/18 text-[10px]">WordPress 관리자 → 프로필 → 앱 비밀번호</p>
                    </>
                  )}
                  {platform === 'naver' && (
                    <>
                      <div className="flex gap-2 items-center">
                        <span className="text-white/28 text-[10.5px] font-mono w-28 shrink-0">Access Token</span>
                        <input type="password" value={naverForm.accessToken} onChange={e => setNaverForm({ accessToken: e.target.value })} placeholder="Bearer 토큰" className={inputCls} />
                      </div>
                      <p className="text-white/18 text-[10px]">네이버 개발자센터 → 블로그 OAuth 발급</p>
                    </>
                  )}
                  {platform === 'nextblog' && (
                    <>
                      <div className="space-y-1.5">
                        <div className="flex gap-2 items-center">
                          <span className="text-white/28 text-[10.5px] font-mono w-28 shrink-0">Supabase URL</span>
                          <input type="text" value={nextForm.supabaseUrl} onChange={e => setNextForm(f => ({ ...f, supabaseUrl: e.target.value }))} placeholder="https://xxx.supabase.co" className={inputCls} />
                        </div>
                        <div className="flex gap-2 items-center">
                          <span className="text-white/28 text-[10.5px] font-mono w-28 shrink-0">Service Key</span>
                          <input type="password" value={nextForm.supabaseKey} onChange={e => setNextForm(f => ({ ...f, supabaseKey: e.target.value }))} placeholder="eyJ..." className={inputCls} />
                        </div>
                        <div className="flex gap-2 items-center">
                          <span className="text-white/28 text-[10.5px] font-mono w-28 shrink-0">기본 상태</span>
                          <div className="flex gap-1.5 flex-1">
                            {(['draft', 'published'] as const).map(s => (
                              <button key={s} onClick={() => setNextForm(f => ({ ...f, status: s }))} className={`flex-1 text-[11px] font-mono py-1 rounded-lg border transition-colors ${nextForm.status === s ? 'border-white/25 bg-white/6 text-white/70' : 'border-white/8 text-white/28 hover:text-white/55'}`}>
                                {s === 'draft' ? '초안' : '발행'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <p className="text-white/18 text-[10px]">Supabase → Settings → API → service_role</p>
                    </>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => handleSave(platform)} disabled={isSaving} className={saveBtnCls}>
                      {isSaving ? '저장 중...' : '저장'}
                    </button>
                    {isEditing && (
                      <button onClick={() => setEditing(null)} className="px-2.5 py-1.5 rounded-lg border border-white/8 text-white/35 hover:text-white/65 text-[11px] font-mono transition-colors">취소</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

interface TrendSettings {
  categories: string[];
  outlier_multiplier: number;
  viral_threshold_hourly: number;
  is_active: boolean;
}

// ── 알림 설정 섹션 ──
function NotificationSection() {
  const [hasTelegram, setHasTelegram] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [notifyTrends, setNotifyTrends] = useState(true);
  const [notifySchedule, setNotifySchedule] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState('');
  const [toastOk, setToastOk] = useState(true);

  useEffect(() => { fetchSettings(); }, []);

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await fetch('/api/notify/settings');
      if (res.ok) {
        const d = await res.json();
        setHasTelegram(d.hasTelegram);
        setNotifyTrends(d.notify_trends ?? true);
        setNotifySchedule(d.notify_schedule ?? true);
      }
    } finally { setLoading(false); }
  }

  function showToast(msg: string, ok = true) {
    setToast(msg); setToastOk(ok);
    setTimeout(() => setToast(''), 3000);
  }

  async function handleSave() {
    if (!botToken.trim() || !chatId.trim()) return;
    setSaving(true);
    const res = await fetch('/api/notify/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegram_bot_token: botToken.trim(), telegram_chat_id: chatId.trim(), notify_trends: notifyTrends, notify_schedule: notifySchedule }),
    });
    setSaving(false);
    if (res.ok) { showToast('저장되었습니다'); setEditing(false); setHasTelegram(true); setBotToken(''); setChatId(''); }
    else { const d = await res.json(); showToast(d.error || '저장 실패', false); }
  }

  async function handleToggle(key: 'trends' | 'schedule', value: boolean) {
    if (key === 'trends') setNotifyTrends(value);
    else setNotifySchedule(value);
    await fetch('/api/notify/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key === 'trends' ? 'notify_trends' : 'notify_schedule']: value }),
    });
  }

  async function handleTest() {
    setTesting(true);
    const res = await fetch('/api/notify/test', { method: 'POST' });
    setTesting(false);
    if (res.ok) showToast('테스트 메시지가 전송됐습니다! 텔레그램을 확인해보세요 ✅');
    else { const d = await res.json(); showToast(d.error || '전송 실패', false); }
  }

  async function handleDelete() {
    if (!confirm('알림 설정을 초기화하시겠습니까?')) return;
    await fetch('/api/notify/settings', { method: 'DELETE' });
    setHasTelegram(false); setEditing(false); showToast('초기화됐습니다');
  }

  if (loading) return (
    <div className="flex items-center gap-2 px-4 py-6 text-white/30 text-[12px] font-mono border border-white/8 rounded-xl">
      <span className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />불러오는 중...
    </div>
  );

  return (
    <div className="space-y-3">
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 backdrop-blur border px-4 py-2 rounded-xl text-[12px] font-mono z-50 ${toastOk ? 'bg-white/10 border-white/20 text-white/75' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>{toast}</div>
      )}

      {/* 텔레그램 연결 */}
      <div className="border border-white/8 bg-white/[0.015] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black text-white shrink-0" style={{ backgroundColor: '#229ED9' }}>✈</div>
            <div>
              <p className="text-white/80 text-[12px] font-medium font-mono">Telegram 봇 알림</p>
              <p className="text-white/28 text-[10.5px] font-mono mt-0.5">Bot Token + Chat ID로 무료 알림</p>
            </div>
          </div>
          {hasTelegram
            ? <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-green-400/25 text-green-400/70 bg-green-400/5"><span className="w-1 h-1 rounded-full bg-green-400" />연결됨</span>
            : <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/8 text-white/25">미설정</span>}
        </div>
        <div className="px-4 py-3">
          {hasTelegram && !editing ? (
            <div className="space-y-3">
              {/* 알림 토글 */}
              <div className="space-y-2">
                {([
                  { key: 'trends', label: '트렌드 급상승 알림', desc: '새로운 트렌드 감지 시 즉시 알림', value: notifyTrends },
                  { key: 'schedule', label: '발행 리마인더', desc: '오늘 예약된 콘텐츠 아침 알림', value: notifySchedule },
                ] as const).map(item => (
                  <div key={item.key} className="flex items-center justify-between px-3 py-2.5 border border-white/8 bg-white/[0.01] rounded-lg">
                    <div>
                      <p className="text-[12px] font-mono text-white/70">{item.label}</p>
                      <p className="text-[10px] text-white/30">{item.desc}</p>
                    </div>
                    <button
                      onClick={() => handleToggle(item.key, !item.value)}
                      className="relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0"
                      style={{ background: item.value ? '#4f8ef7' : 'rgba(255,255,255,0.1)' }}
                    >
                      <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                        style={{ transform: item.value ? 'translateX(22px)' : 'translateX(2px)' }} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <button onClick={handleTest} disabled={testing}
                  className="cf-filter-btn px-3 py-1 rounded-lg border border-[#229ED9]/30 bg-[#229ED9]/8 text-[#229ED9]/70 text-[11px] font-mono transition-colors disabled:opacity-40">
                  {testing ? '전송 중...' : '테스트 전송'}
                </button>
                <button onClick={() => setEditing(true)} className="px-2.5 py-1 rounded-lg border border-white/10 text-white/40 hover:text-white/70 text-[11px] font-mono transition-colors">변경</button>
                <button onClick={handleDelete} className="px-2.5 py-1 rounded-lg border border-red-500/15 text-red-400/40 hover:text-red-400 text-[11px] font-mono transition-colors">초기화</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-white/[0.01] border border-white/6 rounded-lg px-3 py-2.5 space-y-1">
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5">설정 방법</p>
                {[
                  '1. @BotFather 에게 /newbot 명령 전송',
                  '2. 봇 이름 설정 후 Bot Token 수령',
                  '3. 생성한 봇에게 메시지 전송 (채팅 시작)',
                  '4. @userinfobot 에게 메시지 → Chat ID 확인',
                ].map((step, i) => (
                  <p key={i} className="text-[10.5px] font-mono text-white/30">{step}</p>
                ))}
              </div>
              <div className="space-y-1.5">
                <div className="flex gap-2 items-center">
                  <span className="text-white/28 text-[10.5px] font-mono w-24 shrink-0">Bot Token</span>
                  <input type="password" value={botToken} onChange={e => setBotToken(e.target.value)}
                    placeholder="1234567890:ABCDEFabcdef..."
                    className={inputCls} />
                </div>
                <div className="flex gap-2 items-center">
                  <span className="text-white/28 text-[10.5px] font-mono w-24 shrink-0">Chat ID</span>
                  <input type="text" value={chatId} onChange={e => setChatId(e.target.value)}
                    placeholder="123456789"
                    className={inputCls} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={!botToken.trim() || !chatId.trim() || saving} className={saveBtnCls}>
                  {saving ? '저장 중...' : '저장'}
                </button>
                {editing && <button onClick={() => { setEditing(false); setBotToken(''); setChatId(''); }}
                  className="px-2.5 py-1.5 rounded-lg border border-white/8 text-white/35 hover:text-white/65 text-[11px] font-mono transition-colors">취소</button>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TrendSettingsSection() {
  const [settings, setSettings] = useState<TrendSettings>({
    categories: [],
    outlier_multiplier: 3.0,
    viral_threshold_hourly: 300.0,
    is_active: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/trends/settings')
      .then(r => r.json())
      .then(d => { setSettings(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function toggleCategory(key: string) {
    setSettings(s => ({
      ...s,
      categories: s.categories.includes(key)
        ? s.categories.filter(c => c !== key)
        : [...s.categories, key],
    }));
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch('/api/trends/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  }

  if (loading) return (
    <div className="flex items-center gap-2 px-4 py-6 text-white/30 text-[12px] font-mono border border-white/8 rounded-xl">
      <span className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />불러오는 중...
    </div>
  );

  return (
    <div className="border border-white/8 bg-white/[0.015] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#4f8ef7]" />
          <div>
            <p className="text-white/80 text-[12px] font-medium font-mono">트렌드 수집 설정</p>
            <p className="text-white/28 text-[10.5px] font-mono mt-0.5">자동 수집할 카테고리 및 감지 기준</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${settings.is_active ? 'border-green-400/25 text-green-400/70 bg-green-400/5' : 'border-white/8 text-white/25'}`}>
          <span className={`w-1 h-1 rounded-full ${settings.is_active ? 'bg-green-400' : 'bg-white/20'}`} />
          {settings.is_active ? '수집 활성화' : '수집 비활성화'}
        </span>
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* 활성화 토글 */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/70 text-[12.5px] font-mono">자동 수집 활성화</p>
            <p className="text-white/30 text-[11px] font-mono mt-0.5">비활성화 시 cron 수집이 건너뜁니다</p>
          </div>
          <button
            onClick={() => setSettings(s => ({ ...s, is_active: !s.is_active }))}
            className="relative w-11 h-6 rounded-full transition-colors duration-200"
            style={{ background: settings.is_active ? '#4f8ef7' : 'rgba(255,255,255,0.1)' }}
          >
            <span
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
              style={{ transform: settings.is_active ? 'translateX(22px)' : 'translateX(2px)' }}
            />
          </button>
        </div>

        {/* 카테고리 선택 */}
        <div>
          <p className="text-white/70 text-[12.5px] font-mono mb-3">
            수집할 카테고리
            <span className="ml-2 text-white/30 text-[11px]">({settings.categories.length}/{Object.keys(TREND_CATEGORIES).length}개 선택됨)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSettings(s => ({
                ...s,
                categories: s.categories.length === Object.keys(TREND_CATEGORIES).length ? [] : Object.keys(TREND_CATEGORIES),
              }))}
              className="px-2.5 py-1 text-[11px] font-mono rounded-md border transition-colors"
              style={{
                borderColor: settings.categories.length === Object.keys(TREND_CATEGORIES).length ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.08)',
                color: settings.categories.length === Object.keys(TREND_CATEGORIES).length ? '#4f8ef7' : 'rgba(255,255,255,0.30)',
                background: settings.categories.length === Object.keys(TREND_CATEGORIES).length ? 'rgba(56,189,248,0.07)' : 'transparent',
              }}
            >
              전체
            </button>
            {Object.entries(TREND_CATEGORIES).map(([key, cat]) => {
              const selected = settings.categories.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => toggleCategory(key)}
                  className="px-2.5 py-1 text-[11px] font-mono rounded-md border transition-colors"
                  style={{
                    borderColor: selected ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.08)',
                    color: selected ? '#4f8ef7' : 'rgba(255,255,255,0.30)',
                    background: selected ? 'rgba(56,189,248,0.07)' : 'transparent',
                  }}
                >
                  {cat.label}
                  {'youtubeId' in cat
                    ? <span className="ml-1.5 text-[9px] opacity-40">ID</span>
                    : <span className="ml-1.5 text-[9px] opacity-40">KW</span>}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-white/20 text-[10.5px] font-mono">ID: YouTube 공식 카테고리 (1유닛) · KW: 키워드 검색 (100유닛)</p>
        </div>

        {/* 감지 기준 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-white/70 text-[12.5px] font-mono mb-1.5">바이럴 임계값 (시간당 조회수)</p>
            <p className="text-white/25 text-[10.5px] font-mono mb-2">이 값 이상 증가 시 급상승으로 감지</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={settings.viral_threshold_hourly}
                onChange={e => setSettings(s => ({ ...s, viral_threshold_hourly: Number(e.target.value) }))}
                className="w-full bg-black/20 text-white/75 border border-white/10 rounded-lg focus:border-white/30 focus:outline-none text-[12px] font-mono px-3 py-1.5"
                min={0}
              />
              <span className="text-white/30 text-[11px] font-mono shrink-0">/h</span>
            </div>
          </div>
          <div>
            <p className="text-white/70 text-[12.5px] font-mono mb-1.5">이상치 배율</p>
            <p className="text-white/25 text-[10.5px] font-mono mb-2">채널 평균 대비 몇 배 이상 시 이상치</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={settings.outlier_multiplier}
                onChange={e => setSettings(s => ({ ...s, outlier_multiplier: Number(e.target.value) }))}
                className="w-full bg-black/20 text-white/75 border border-white/10 rounded-lg focus:border-white/30 focus:outline-none text-[12px] font-mono px-3 py-1.5"
                min={1}
                step={0.5}
              />
              <span className="text-white/30 text-[11px] font-mono shrink-0">배</span>
            </div>
          </div>
        </div>

        {/* 저장 버튼 */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={saving || settings.categories.length === 0}
            className={`cf-filter-btn px-4 py-1.5 rounded-lg border font-medium text-[12px] font-mono transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${saved ? 'border-sky-400/30 text-sky-400/80 bg-sky-400/8' : 'border-white/12 text-white/60 bg-transparent'}`}
          >
            {saving ? '저장 중...' : saved ? '✓ 저장됨' : '설정 저장'}
          </button>
          {settings.categories.length === 0 && (
            <p className="text-red-400/60 text-[11px] font-mono">카테고리를 1개 이상 선택해주세요</p>
          )}
        </div>
      </div>
    </div>
  );
}

type SettingsTab = 'api' | 'blog' | 'notify' | 'trends';

const SETTINGS_TABS: { id: SettingsTab; label: string; dot: string }[] = [
  { id: 'api',    label: 'API 키',    dot: '#17BEBB' },
  { id: 'blog',   label: '블로그 연결', dot: '#7c3aed' },
  { id: 'notify', label: '알림 설정',  dot: '#229ED9' },
  { id: 'trends', label: '트렌드 설정', dot: '#4f8ef7' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('api');
  const [keys, setKeys] = useState({
    hasAnthropic: false, hasGemini: false, hasMinimax: false, hasElevenlabs: false, hasKling: false, hasFal: false, hasQwen: false, hasPerplexity: false,
    anthropic: '', gemini: '', minimax: '', minimaxGroup: '', elevenlabs: '', klingAccess: '', klingSecret: '', fal: '', qwen: '', perplexity: ''
  });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  useEffect(() => { fetchKeys(); }, []);

  async function fetchKeys() {
    setLoading(true);
    try {
      const res = await fetch('/api/user-keys');
      if (res.ok) setKeys(await res.json());
    } finally { setLoading(false); }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  async function handleSave(provider: Provider, apiKey: string, apiKey2?: string) {
    const res = await fetch('/api/user-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, apiKey, apiKey2 }),
    });
    if (res.ok) { showToast('API 키가 저장되었습니다'); await fetchKeys(); }
    else { showToast('저장 실패. 다시 시도해주세요.'); }
  }

  async function handleDelete(provider: Provider) {
    const res = await fetch('/api/user-keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    });
    if (res.ok) { showToast('API 키가 삭제되었습니다'); await fetchKeys(); }
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6 mt-4">
        <span className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0" style={{ background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.22)', color: '#4f8ef7' }}>
          <SettingsIcon size={13} strokeWidth={1.8} />
        </span>
        <span className="text-[19px] font-semibold text-white" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>설정</span>
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-1 mb-6 border-b border-white/[0.06] pb-2">
        {SETTINGS_TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-active={isActive ? 'true' : undefined}
              className="cf-tab-btn flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-200 whitespace-nowrap"
              style={{
                color: isActive ? tab.dot : 'rgba(255,255,255,0.28)',
                background: isActive ? `${tab.dot}18` : 'transparent',
                border: isActive ? `1px solid ${tab.dot}4D` : '1px solid transparent',
                '--tab-rgb': isActive ? tab.dot.replace('#','').match(/.{2}/g)?.map(h=>parseInt(h,16)).join(',') : '255,255,255',
              } as React.CSSProperties}
              onMouseEnter={e => {
                if (!isActive) {
                  const el = e.currentTarget;
                  const rgb = tab.dot.replace('#','').match(/.{2}/g)?.map(h=>parseInt(h,16)).join(',') ?? '79,142,247';
                  el.style.color = `rgba(${rgb},0.8)`;
                  el.style.background = `rgba(${rgb},0.07)`;
                  el.style.borderColor = `rgba(${rgb},0.25)`;
                  el.setAttribute('data-glow','true');
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  const el = e.currentTarget;
                  el.style.color = 'rgba(255,255,255,0.28)';
                  el.style.background = 'transparent';
                  el.style.borderColor = 'transparent';
                  el.removeAttribute('data-glow');
                }
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: isActive ? tab.dot : 'rgba(255,255,255,0.2)' }} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 탭 콘텐츠 — 가로 레이아웃 */}
      {activeTab === 'api' && (
        <div className="flex gap-6 items-start">
          {/* 연결 현황 사이드 */}
          <div className="w-52 shrink-0 space-y-2 sticky top-4">
            <p className="text-[10px] text-white/25 uppercase tracking-widest mb-3">연결 현황</p>
            {[
              { label: 'Claude',      has: keys.hasAnthropic, color: '#E4572E' },
              { label: 'Gemini',      has: keys.hasGemini,    color: '#17BEBB' },
              { label: 'MiniMax',     has: keys.hasMinimax,   color: '#ff7e33' },
              { label: 'ElevenLabs',  has: keys.hasElevenlabs,color: '#27ae60' },
              { label: 'Kling AI',    has: keys.hasKling,     color: '#a78bfa' },
              { label: 'fal.ai',      has: keys.hasFal,       color: '#f97316' },
              { label: 'Qwen',        has: keys.hasQwen,        color: '#6366f1' },
              { label: 'Perplexity',  has: keys.hasPerplexity,  color: '#20b2aa' },
            ].map(({ label, has, color }) => (
              <div key={label} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${has ? 'border-green-400/20 bg-green-400/[0.04]' : 'border-white/8 bg-white/[0.02]'}`}>
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: has ? '#4ade80' : '#ffffff20' }} />
                <span className="text-[11px] font-mono text-white/55 flex-1 truncate">{label}</span>
                <span className={`text-[10px] shrink-0 ${has ? 'text-green-400/70' : 'text-white/20'}`}>{has ? '✓' : '—'}</span>
              </div>
            ))}
          </div>

          {/* API 키 목록 */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="flex items-center gap-2 px-5 py-8 text-white/30 text-[13px] font-mono">
                <span className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />불러오는 중...
              </div>
            ) : (
              <div className="space-y-3">
                <SingleKeySection
                  name="Anthropic" label="Claude" color="#E4572E"
                  models={['Claude Opus 4.6', 'Claude Sonnet 4.6', 'Claude Haiku 4.5']}
                  placeholder="sk-ant-..."
                  docsUrl="https://console.anthropic.com/settings/keys"
                  hasKey={keys.hasAnthropic} maskedKey={keys.anthropic}
                  onSave={handleSave} onDelete={handleDelete}
                />
                <SingleKeySection
                  name="Google" label="Gemini" color="#17BEBB"
                  models={['Gemini 2.5 Flash', 'Image Generation', 'TTS']}
                  placeholder="AIzaSy..."
                  docsUrl="https://aistudio.google.com/app/apikey"
                  hasKey={keys.hasGemini} maskedKey={keys.gemini}
                  onSave={handleSave} onDelete={handleDelete}
                />
                <DualKeySection
                  name="MiniMax" label="고품질 음성" color="#ff7e33"
                  provider="minimax"
                  fields={[{ label: 'API Key', placeholder: 'sk-api-...' }, { label: 'Group ID', placeholder: '1988...' }]}
                  docsUrl="https://platform.minimaxi.chat/user-center/basic-information"
                  hasKey={keys.hasMinimax} masked1={keys.minimax} masked2={keys.minimaxGroup}
                  onSave={handleSave} onDelete={handleDelete}
                />
                <SingleKeySection
                  name="ElevenLabs" label="프리미엄 음성" color="#27ae60"
                  models={['pNInz6obpgDQGcFmaJgB', 'Adam', 'Bella']}
                  placeholder="eleven_..."
                  docsUrl="https://elevenlabs.io/app/settings/api-keys"
                  hasKey={keys.hasElevenlabs} maskedKey={keys.elevenlabs}
                  onSave={handleSave} onDelete={handleDelete}
                />
                <DualKeySection
                  name="Kling AI" label="영상 생성" color="#a78bfa"
                  provider="kling"
                  fields={[{ label: 'Access Key', placeholder: 'Ay3Fang...' }, { label: 'Secret Key', placeholder: '3fMgAf...' }]}
                  docsUrl="https://klingai.com"
                  hasKey={keys.hasKling} masked1={keys.klingAccess} masked2={keys.klingSecret}
                  onSave={handleSave} onDelete={handleDelete}
                />
                <SingleKeySection
                  name="fal.ai" label="영상 생성" color="#f97316"
                  models={['WAN 2.1 Image-to-Video']}
                  placeholder="fal_..."
                  docsUrl="https://fal.ai/dashboard/keys"
                  hasKey={keys.hasFal} maskedKey={keys.fal}
                  onSave={handleSave} onDelete={handleDelete}
                />
                <SingleKeySection
                  name="DashScope" label="Qwen — 대본/음성/Omni" color="#6366f1"
                  models={['Qwen3.6-Plus', 'Qwen3.5-Omni', 'CosyVoice']}
                  placeholder="sk-..."
                  docsUrl="https://dashscope.console.aliyun.com/apiKey"
                  hasKey={keys.hasQwen} maskedKey={keys.qwen}
                  onSave={handleSave} onDelete={handleDelete}
                />
                <SingleKeySection
                  name="Perplexity" label="웹 리서치 — 블로그/대본 팩트 강화" color="#20b2aa"
                  models={['sonar', 'sonar-pro']}
                  placeholder="pplx-..."
                  docsUrl="https://www.perplexity.ai/settings/api"
                  hasKey={keys.hasPerplexity} maskedKey={keys.perplexity}
                  onSave={handleSave} onDelete={handleDelete}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'blog' && (
        <BlogPlatformSection />
      )}

      {activeTab === 'notify' && (
        <NotificationSection />
      )}

      {activeTab === 'trends' && (
        <TrendSettingsSection />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur border border-white/20 px-5 py-2.5 text-white/80 text-[13px] font-mono z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
