'use client';

import { useState, useEffect } from 'react';

type Provider = 'anthropic' | 'gemini' | 'kling' | 'fal';

const inputCls = 'flex-1 bg-black/40 text-white/80 border border-white/15 focus:border-white/40 focus:outline-none text-[13px] font-mono placeholder:text-white/20 px-3 py-2 transition-colors';

/* ── 단일 키 섹션 (Anthropic, Gemini) ── */
function SingleKeySection({
  name, label, color, models, placeholder, docsUrl, hasKey, maskedKey, onSave, onDelete,
}: {
  name: string; label: string; color: string; models: string[];
  placeholder: string; docsUrl: string;
  hasKey: boolean; maskedKey: string;
  onSave: (provider: Provider, key: string) => Promise<void>;
  onDelete: (provider: Provider) => Promise<void>;
}) {
  const providerMap: Record<string, Provider> = { anthropic: 'anthropic', google: 'gemini', 'fal.ai': 'fal' };
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
    <div className="border border-white/10 bg-white/[0.02]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <div>
            <p className="text-white text-[13px] font-bold font-mono">{name} — {label}</p>
            <p className="text-white/35 text-[11.5px] font-mono mt-0.5">{models.join(' · ')}</p>
          </div>
        </div>
        {hasKey
          ? <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 border border-green-400/30 text-green-400/80 bg-green-400/5"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />연결됨</span>
          : <span className="text-[11px] font-mono px-2 py-1 border border-white/10 text-white/30">미설정</span>}
      </div>
      <div className="px-5 py-4">
        {hasKey && !editing ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 bg-black/30 border border-white/10 px-3 py-2">
              <span className="text-white/50 text-[13px] font-mono flex-1">{showKey ? maskedKey : '••••••••••••••••••••'}</span>
              <button onClick={() => setShowKey(v => !v)} className="text-white/30 hover:text-white/60 text-[11px] font-mono transition-colors">{showKey ? '숨기기' : '보기'}</button>
            </div>
            <button onClick={() => setEditing(true)} className="px-3 py-2 border border-white/15 text-white/50 hover:text-white/80 hover:border-white/30 text-[12px] font-mono transition-colors">변경</button>
            <button onClick={async () => { setDeleting(true); await onDelete(provider); setDeleting(false); setEditing(false); }} disabled={deleting} className="px-3 py-2 border border-red-500/20 text-red-400/50 hover:text-red-400 hover:border-red-400/40 text-[12px] font-mono transition-colors disabled:opacity-40">{deleting ? '삭제 중...' : '삭제'}</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input type="password" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} placeholder={placeholder} className={inputCls} />
              <button onClick={handleSave} disabled={!input.trim() || saving} className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 disabled:bg-white/10 disabled:cursor-not-allowed text-black disabled:text-white/20 font-bold text-[12px] font-mono transition-colors whitespace-nowrap">{saving ? '저장 중...' : '저장'}</button>
              {editing && <button onClick={() => { setEditing(false); setInput(''); }} className="px-3 py-2 border border-white/10 text-white/40 hover:text-white/70 text-[12px] font-mono transition-colors">취소</button>}
            </div>
            <p className="text-white/25 text-[11.5px] font-mono">API 키는 내 계정에만 암호화되어 저장됩니다 · <a href={docsUrl} target="_blank" rel="noopener noreferrer" className="text-[#17BEBB]/50 hover:text-[#17BEBB] transition-colors">키 발급 →</a></p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Kling 이중 키 섹션 ── */
function KlingKeySection({
  hasKey, maskedAccess, maskedSecret, onSave, onDelete,
}: {
  hasKey: boolean; maskedAccess: string; maskedSecret: string;
  onSave: (provider: Provider, key: string, key2: string) => Promise<void>;
  onDelete: (provider: Provider) => Promise<void>;
}) {
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showKeys, setShowKeys] = useState(false);

  async function handleSave() {
    if (!accessKey.trim() || !secretKey.trim()) return;
    setSaving(true);
    await onSave('kling', accessKey.trim(), secretKey.trim());
    setSaving(false); setAccessKey(''); setSecretKey(''); setEditing(false);
  }

  return (
    <div className="border border-white/10 bg-white/[0.02]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-purple-400" />
          <div>
            <p className="text-white text-[13px] font-bold font-mono">Kling AI — 영상 생성</p>
            <p className="text-white/35 text-[11.5px] font-mono mt-0.5">Kling V1.0 · Kling V2.5 Turbo · Kling V2.6</p>
          </div>
        </div>
        {hasKey
          ? <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 border border-green-400/30 text-green-400/80 bg-green-400/5"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />연결됨</span>
          : <span className="text-[11px] font-mono px-2 py-1 border border-white/10 text-white/30">미설정</span>}
      </div>
      <div className="px-5 py-4">
        {hasKey && !editing ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-black/30 border border-white/10 px-3 py-2">
              <span className="text-white/35 text-[11px] font-mono w-20 shrink-0">Access Key</span>
              <span className="text-white/50 text-[13px] font-mono flex-1">{showKeys ? maskedAccess : '••••••••••••••••••••'}</span>
            </div>
            <div className="flex items-center gap-2 bg-black/30 border border-white/10 px-3 py-2">
              <span className="text-white/35 text-[11px] font-mono w-20 shrink-0">Secret Key</span>
              <span className="text-white/50 text-[13px] font-mono flex-1">{showKeys ? maskedSecret : '••••••••••••••••••••'}</span>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button onClick={() => setShowKeys(v => !v)} className="text-white/30 hover:text-white/60 text-[11px] font-mono transition-colors">{showKeys ? '숨기기' : '보기'}</button>
              <button onClick={() => setEditing(true)} className="px-3 py-1.5 border border-white/15 text-white/50 hover:text-white/80 hover:border-white/30 text-[12px] font-mono transition-colors">변경</button>
              <button onClick={async () => { setDeleting(true); await onDelete('kling'); setDeleting(false); }} disabled={deleting} className="px-3 py-1.5 border border-red-500/20 text-red-400/50 hover:text-red-400 hover:border-red-400/40 text-[12px] font-mono transition-colors disabled:opacity-40">{deleting ? '삭제 중...' : '삭제'}</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex gap-2 items-center">
                <span className="text-white/35 text-[11.5px] font-mono w-20 shrink-0">Access Key</span>
                <input type="password" value={accessKey} onChange={e => setAccessKey(e.target.value)} placeholder="Ay3Fang..." className={inputCls} />
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-white/35 text-[11.5px] font-mono w-20 shrink-0">Secret Key</span>
                <input type="password" value={secretKey} onChange={e => setSecretKey(e.target.value)} placeholder="3fMgAf..." className={inputCls} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={!accessKey.trim() || !secretKey.trim() || saving} className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 disabled:bg-white/10 disabled:cursor-not-allowed text-black disabled:text-white/20 font-bold text-[12px] font-mono transition-colors">{saving ? '저장 중...' : '저장'}</button>
              {editing && <button onClick={() => { setEditing(false); setAccessKey(''); setSecretKey(''); }} className="px-3 py-2 border border-white/10 text-white/40 hover:text-white/70 text-[12px] font-mono transition-colors">취소</button>}
            </div>
            <p className="text-white/25 text-[11.5px] font-mono">Kling AI 콘솔에서 Access Key + Secret Key를 발급받아 입력해주세요 · <a href="https://klingai.com" target="_blank" rel="noopener noreferrer" className="text-[#17BEBB]/50 hover:text-[#17BEBB] transition-colors">klingai.com →</a></p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [keys, setKeys] = useState({ hasAnthropic: false, hasGemini: false, hasKling: false, hasFal: false, anthropic: '', gemini: '', klingAccess: '', klingSecret: '', fal: '' });
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
    <div className="max-w-2xl mx-auto">
      <div className="relative mt-10 mb-8">
        <div className="absolute top-0 left-0 -translate-y-full inline-flex items-center gap-1.5 px-4 py-1.5 border-t border-l border-r border-white/15 bg-[#0a0a0a]">
          <span className="w-1 h-1 bg-white/40 rounded-full" />
          <span className="text-white/50 text-[13px] font-mono tracking-widest uppercase">설정</span>
        </div>
        <div className="border border-white/10 px-5 py-4 bg-white/[0.015]">
          <p className="text-white/80 text-[13px] font-mono leading-relaxed">각 AI 제공사의 API 키를 등록하면 해당 모델을 사용할 수 있습니다.</p>
          <p className="text-white/35 text-[12px] font-mono mt-1">키는 내 계정에만 저장되며 다른 사용자와 공유되지 않습니다.</p>
        </div>
      </div>

      {/* 연결 현황 */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Claude (대본)', has: keys.hasAnthropic, color: '#E4572E' },
          { label: 'Gemini (이미지)', has: keys.hasGemini, color: '#17BEBB' },
          { label: 'Kling (영상)', has: keys.hasKling, color: '#a78bfa' },
          { label: 'fal.ai (영상)', has: keys.hasFal, color: '#f97316' },
        ].map(({ label, has, color }) => (
          <div key={label} className={`flex items-center gap-2 px-4 py-3 border ${has ? 'border-green-400/20 bg-green-400/[0.04]' : 'border-white/8 bg-white/[0.02]'}`}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: has ? '#4ade80' : '#ffffff20' }} />
            <span className="text-[11.5px] font-mono text-white/55 truncate">{label}</span>
            <span className={`ml-auto text-[10px] font-mono shrink-0 ${has ? 'text-green-400/70' : 'text-white/20'}`}>{has ? '✓' : '—'}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 px-5 py-8 text-white/30 text-[13px] font-mono">
          <span className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />불러오는 중...
        </div>
      ) : (
        <div className="space-y-4">
          <SingleKeySection
            name="Anthropic" label="Claude" color="#E4572E"
            models={['Claude Opus 4.5', 'Claude Sonnet 4.5', 'Claude Haiku 4.5']}
            placeholder="sk-ant-..."
            docsUrl="https://console.anthropic.com/settings/keys"
            hasKey={keys.hasAnthropic} maskedKey={keys.anthropic}
            onSave={handleSave} onDelete={handleDelete}
          />
          <SingleKeySection
            name="Google" label="Gemini" color="#17BEBB"
            models={['Gemini 2.5 Flash Image', 'Gemini 2.5 Pro Image']}
            placeholder="AIzaSy..."
            docsUrl="https://aistudio.google.com/app/apikey"
            hasKey={keys.hasGemini} maskedKey={keys.gemini}
            onSave={handleSave} onDelete={handleDelete}
          />
          <KlingKeySection
            hasKey={keys.hasKling}
            maskedAccess={keys.klingAccess}
            maskedSecret={keys.klingSecret}
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
        </div>
      )}

      <div className="mt-6 border border-white/5 bg-white/[0.02] px-5 py-4 space-y-3">
        <p className="text-[#17BEBB]/60 text-[12px] font-mono tracking-widest uppercase mb-2">API 키 발급</p>
        {[
          { label: 'Anthropic (Claude) — 대본 생성', url: 'https://console.anthropic.com/settings/keys', desc: 'console.anthropic.com → API Keys' },
          { label: 'Google (Gemini) — 이미지 생성', url: 'https://aistudio.google.com/app/apikey', desc: 'aistudio.google.com → Get API Key' },
          { label: 'Kling AI — 영상 생성', url: 'https://klingai.com', desc: 'klingai.com → 개발자 콘솔 → Access Key' },
          { label: 'fal.ai — 영상 생성', url: 'https://fal.ai/dashboard/keys', desc: 'fal.ai → Dashboard → API Keys' },
        ].map(({ label, url, desc }) => (
          <div key={label} className="flex items-start justify-between gap-4">
            <div>
              <p className="text-white/60 text-[12.5px] font-mono">{label}</p>
              <p className="text-white/30 text-[11.5px] font-mono">{desc}</p>
            </div>
            <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[#17BEBB]/50 hover:text-[#17BEBB] text-[12px] font-mono transition-colors">이동 →</a>
          </div>
        ))}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur border border-white/20 px-5 py-2.5 text-white/80 text-[13px] font-mono z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
