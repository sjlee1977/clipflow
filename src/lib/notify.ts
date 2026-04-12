/**
 * Clipflow 알림 시스템
 * - 텔레그램 봇 API (Bot Token + Chat ID)
 * - 트렌드 알림 · 발행 리마인더
 */

export interface NotifyConfig {
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  notify_trends?: boolean;
  notify_schedule?: boolean;
}

// ─── 텔레그램 메시지 전송 ─────────────────────────────────────────────────────

export async function sendTelegram(
  botToken: string,
  chatId: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.description ?? '전송 실패' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '네트워크 오류' };
  }
}

// ─── 트렌드 알림 메시지 포맷 ─────────────────────────────────────────────────

export function buildTrendMessage(insights: {
  keyword: string;
  summary: string;
  opportunity: 'high' | 'medium' | 'watch';
  categoryLabel: string;
}[]): string {
  const high = insights.filter(i => i.opportunity === 'high');
  const targets = high.length > 0 ? high : insights.slice(0, 2);

  const lines = targets.map(i => {
    const badge = i.opportunity === 'high' ? '🔥 선점 기회' : i.opportunity === 'medium' ? '📈 주목' : '👀 관찰';
    return `${badge} <b>${i.keyword}</b>\n${i.summary}`;
  });

  return [
    '📡 <b>Clipflow 트렌드 알림</b>',
    '',
    lines.join('\n\n'),
    '',
    `총 ${insights.length}개 인사이트 감지됨`,
    '👉 Clipflow 대시보드에서 대본 생성하기',
  ].join('\n');
}

// ─── 발행 리마인더 메시지 포맷 ───────────────────────────────────────────────

export function buildScheduleMessage(plans: {
  title: string;
  platform?: string;
  scheduled_at?: string;
}[]): string {
  const items = plans.slice(0, 5).map(p => {
    const time = p.scheduled_at
      ? new Date(p.scheduled_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      : '';
    const platform = p.platform ? ` (${p.platform})` : '';
    return `• ${p.title || '제목 없음'}${platform}${time ? ' — ' + time : ''}`;
  });

  return [
    '📅 <b>오늘 발행 예정 콘텐츠</b>',
    '',
    items.join('\n'),
    plans.length > 5 ? `외 ${plans.length - 5}개` : '',
    '',
    '👉 Clipflow 캘린더에서 확인하기',
  ].filter(Boolean).join('\n');
}

// ─── 사용자별 알림 전송 ───────────────────────────────────────────────────────

export async function notifyUser(
  config: NotifyConfig,
  message: string,
  type: 'trends' | 'schedule'
): Promise<{ sent: boolean; error?: string }> {
  const enabled = type === 'trends' ? config.notify_trends : config.notify_schedule;
  if (!enabled) return { sent: false };

  if (config.telegram_bot_token && config.telegram_chat_id) {
    const result = await sendTelegram(
      config.telegram_bot_token,
      config.telegram_chat_id,
      message
    );
    return { sent: result.ok, error: result.error };
  }

  return { sent: false, error: '알림 채널이 설정되지 않았습니다' };
}
