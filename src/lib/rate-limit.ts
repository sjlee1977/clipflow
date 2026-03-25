import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

let ratelimit: Ratelimit | null = null;

function getRatelimit() {
  if (!ratelimit) {
    ratelimit = new Ratelimit({
      redis: new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      }),
      // 유저당 1분에 10회
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      prefix: 'clipflow:rl',
    });
  }
  return ratelimit;
}

/**
 * userId 기준으로 Rate Limit 체크.
 * 초과 시 429 응답 반환, 통과 시 null 반환.
 */
export async function checkRateLimit(userId: string): Promise<NextResponse | null> {
  const { success, limit, remaining, reset } = await getRatelimit().limit(userId);
  if (!success) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
        },
      }
    );
  }
  return null;
}
