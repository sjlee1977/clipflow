import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // user.id
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  if (error || !code || !state) {
    return NextResponse.redirect(
      `${appUrl}/dashboard/my-channel?error=${encodeURIComponent(error ?? 'cancelled')}`
    );
  }

  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/dashboard/my-channel?error=not_configured`);
  }

  const redirectUri = `${appUrl}/api/youtube/oauth/callback`;

  // 코드 → 토큰 교환
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${appUrl}/dashboard/my-channel?error=token_exchange`);
  }

  const tokens = await tokenRes.json();
  const { access_token, refresh_token, expires_in } = tokens;
  const expiry = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString();

  // 채널 정보 조회
  let channelId = '', channelName = '', channelThumbnail = '';
  try {
    const chRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const chData = await chRes.json();
    const ch = chData.items?.[0];
    if (ch) {
      channelId = ch.id ?? '';
      channelName = ch.snippet?.title ?? '';
      channelThumbnail = ch.snippet?.thumbnails?.default?.url ?? '';
    }
  } catch { /* ignore */ }

  // Supabase에 저장
  const supabase = await createAdminClient();
  const { error: upsertError } = await supabase.from('youtube_oauth_tokens').upsert(
    {
      user_id: state,
      access_token,
      refresh_token: refresh_token ?? null,
      expiry,
      channel_id: channelId,
      channel_name: channelName,
      channel_thumbnail: channelThumbnail,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (upsertError) {
    console.error('[youtube/oauth/callback] upsert error:', upsertError);
    return NextResponse.redirect(
      `${appUrl}/dashboard/my-channel?error=${encodeURIComponent(upsertError.message)}`
    );
  }

  return NextResponse.redirect(`${appUrl}/dashboard/my-channel?connected=1`);
}
