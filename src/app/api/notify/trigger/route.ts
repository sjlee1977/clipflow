import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';
import { notifyUser, buildTrendMessage, buildScheduleMessage } from '@/lib/notify';

// Cron 또는 트렌드 수집 완료 후 호출
// type: 'trends' | 'schedule'
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { type = 'trends', insights = [], plans = [] } = await req.json().catch(() => ({}));
    const supabase = await createAdminClient();

    // 알림 설정이 있는 모든 사용자 조회
    const { data: users } = await supabase.auth.admin.listUsers();
    if (!users?.users?.length) return NextResponse.json({ sent: 0 });

    const notifiableUsers = users.users.filter(u => {
      const meta = u.user_metadata ?? {};
      return meta.telegram_bot_token && meta.telegram_chat_id;
    });

    if (notifiableUsers.length === 0) {
      return NextResponse.json({ sent: 0, reason: '알림 설정된 사용자 없음' });
    }

    let message = '';

    if (type === 'trends' && insights.length > 0) {
      message = buildTrendMessage(insights);
    } else if (type === 'schedule') {
      // 오늘 예약된 콘텐츠 조회 (plans가 없으면 DB에서 직접 조회)
      const targetPlans = plans.length > 0 ? plans : await getTodayPlans(supabase);
      if (targetPlans.length === 0) return NextResponse.json({ sent: 0, reason: '오늘 예정된 콘텐츠 없음' });
      message = buildScheduleMessage(targetPlans);
    } else {
      return NextResponse.json({ sent: 0, reason: '전송할 메시지 없음' });
    }

    let sentCount = 0;
    const errors: string[] = [];

    for (const user of notifiableUsers) {
      const meta = user.user_metadata ?? {};
      const result = await notifyUser(
        {
          telegram_bot_token: meta.telegram_bot_token,
          telegram_chat_id: meta.telegram_chat_id,
          notify_trends: meta.notify_trends ?? true,
          notify_schedule: meta.notify_schedule ?? true,
        },
        message,
        type as 'trends' | 'schedule'
      );
      if (result.sent) sentCount++;
      else if (result.error) errors.push(`${user.email}: ${result.error}`);
    }

    return NextResponse.json({ sent: sentCount, total: notifiableUsers.length, errors });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

async function getTodayPlans(supabase: Awaited<ReturnType<typeof createAdminClient>>) {
  const today = new Date();
  const start = new Date(today); start.setHours(0, 0, 0, 0);
  const end   = new Date(today); end.setHours(23, 59, 59, 999);

  const { data } = await supabase
    .from('content_plans')
    .select('title, platform, scheduled_at')
    .eq('status', 'scheduled')
    .gte('scheduled_at', start.toISOString())
    .lte('scheduled_at', end.toISOString())
    .order('scheduled_at');

  return data ?? [];
}
