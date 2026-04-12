import { NextRequest, NextResponse } from 'next/server';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL이 필요합니다' }, { status: 400 });
    }

    // URL 유효성 검사
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: '유효하지 않은 URL입니다' }, { status: 400 });
    }

    // 페이지 가져오기
    const response = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: `페이지를 가져올 수 없습니다 (${response.status})` }, { status: 400 });
    }

    const html = await response.text();
    const dom = new JSDOM(html, { url: parsedUrl.toString() });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article) {
      return NextResponse.json({ error: '본문 내용을 추출할 수 없습니다' }, { status: 422 });
    }

    // 텍스트 정제 (HTML 태그 제거, 공백 정리)
    const cleanText = (article.textContent ?? '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();

    return NextResponse.json({
      title: article.title || '',
      byline: article.byline || '',
      excerpt: article.excerpt || '',
      content: cleanText,
      siteName: article.siteName || parsedUrl.hostname,
      url: parsedUrl.toString(),
      length: cleanText.length,
    });
  } catch (err: unknown) {
    console.error('[blog/crawl]', err);
    if (err instanceof Error && err.name === 'TimeoutError') {
      return NextResponse.json({ error: '페이지 로딩 시간이 초과되었습니다' }, { status: 408 });
    }
    return NextResponse.json({ error: '크롤링 중 오류가 발생했습니다' }, { status: 500 });
  }
}
