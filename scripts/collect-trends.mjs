/**
 * Railway Cron Worker - 트렌드 수집 스크립트
 *
 * Railway Dashboard에서 Cron Service로 추가:
 *   Command: node scripts/collect-trends.mjs
 *   Schedule: 0 * * * *  (매 정시, 1시간마다)
 *
 * 환경변수 필요:
 *   APP_URL       - 앱 URL (예: https://clipflow.up.railway.app)
 *   CRON_SECRET   - .env.local의 CRON_SECRET과 동일한 값
 */

const APP_URL = process.env.APP_URL;
const CRON_SECRET = process.env.CRON_SECRET;

if (!APP_URL || !CRON_SECRET) {
  console.error('[Cron] APP_URL 또는 CRON_SECRET 환경변수가 없습니다.');
  process.exit(1);
}

async function run() {
  const startTime = Date.now();
  console.log(`[Cron] 트렌드 수집 시작: ${new Date().toISOString()}`);

  try {
    const res = await fetch(`${APP_URL}/api/trends/collect`, {
      method: 'POST',
      headers: {
        'x-cron-secret': CRON_SECRET,
        'Content-Type': 'application/json',
      },
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error(`[Cron] 수집 실패 (${res.status}):`, body);
      process.exit(1);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Cron] 완료 (${elapsed}s):`, JSON.stringify(body.summary ?? body));
  } catch (err) {
    console.error('[Cron] 네트워크 오류:', err.message);
    process.exit(1);
  }
}

run();
