import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { sendTelegram } from '@/lib/notify';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

    const meta = user.user_metadata ?? {};
    const { telegram_bot_token, telegram_chat_id } = meta;

    if (!telegram_bot_token || !telegram_chat_id) {
      return NextResponse.json({ error: '텔레그램 Bot Token과 Chat ID를 먼저 설정해주세요' }, { status: 400 });
    }

    const message = [
      '✅ <b>Clipflow 알림 테스트</b>',
      '',
      '알림이 정상적으로 설정되었습니다!',
      '',
      '앞으로 이 채널로 아래 알림이 전송됩니다:',
      '• 🔥 트렌드 급상승 감지 알림',
      '• 📅 오늘 발행 예정 리마인더',
    ].join('\n');

    const result = await sendTelegram(telegram_bot_token, telegram_chat_id, message);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
