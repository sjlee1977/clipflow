import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// GET: 현재 알림 설정 조회
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

    const meta = user.user_metadata ?? {};
    return NextResponse.json({
      hasTelegram: !!(meta.telegram_bot_token && meta.telegram_chat_id),
      telegram_chat_id: meta.telegram_chat_id
        ? meta.telegram_chat_id.slice(0, 4) + '****'
        : '',
      notify_trends: meta.notify_trends ?? true,
      notify_schedule: meta.notify_schedule ?? true,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST: 알림 설정 저장
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (body.telegram_bot_token !== undefined) updates.telegram_bot_token = body.telegram_bot_token || null;
    if (body.telegram_chat_id !== undefined)   updates.telegram_chat_id   = body.telegram_chat_id   || null;
    if (body.notify_trends !== undefined)      updates.notify_trends      = Boolean(body.notify_trends);
    if (body.notify_schedule !== undefined)    updates.notify_schedule    = Boolean(body.notify_schedule);

    const { error: updateError } = await supabase.auth.updateUser({ data: updates });
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// DELETE: 알림 설정 초기화
export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

    await supabase.auth.updateUser({
      data: {
        telegram_bot_token: null,
        telegram_chat_id: null,
        notify_trends: null,
        notify_schedule: null,
      },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
