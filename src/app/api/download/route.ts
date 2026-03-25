import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  const filename = req.nextUrl.searchParams.get('filename') ?? 'video.mp4';

  if (!url) return NextResponse.json({ error: 'url 파라미터가 필요합니다' }, { status: 400 });

  const res = await fetch(url);
  if (!res.ok) return NextResponse.json({ error: '파일을 가져올 수 없습니다' }, { status: 502 });

  return new NextResponse(res.body, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}.mp4"`,
    },
  });
}
