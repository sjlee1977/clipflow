import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import { GoogleGenAI } from '@google/genai';

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function getVideoMeta(videoId: string): Promise<{ title: string }> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (!res.ok) return { title: '' };
    const data = await res.json();
    return { title: data.title ?? '' };
  } catch {
    return { title: '' };
  }
}

// YouTube 페이지에서 영상 설명 스크래핑 (자막 없을 때 대체)
async function scrapeVideoDescription(videoId: string): Promise<string> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      },
    });
    const html = await res.text();

    // ytInitialData에서 description 추출
    const descMatch = html.match(/"description":\{"simpleText":"((?:[^"\\]|\\.)*)"\}/);
    if (descMatch) {
      return descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').slice(0, 8000);
    }

    // attributedDescription 형태 시도
    const attrMatch = html.match(/"attributedDescription":\{"content":"((?:[^"\\]|\\.)*)"/);
    if (attrMatch) {
      return attrMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').slice(0, 8000);
    }

    return '';
  } catch {
    return '';
  }
}

// 카테고리별 AI 추출 스키마 정의
const CATEGORY_SCHEMAS: Record<string, { description: string; fields: Record<string, string> }> = {
  general: {
    description: '일반 유튜브 채널 대본 요청서',
    fields: {
      topic: '시청자가 클릭하고 싶은 구체적인 제목 형태 (한 줄)',
      angle: '이 영상만의 핵심 인사이트 또는 대부분이 모르는 반전 포인트 (1~3문장)',
      genContent: '영상에서 다루는 주요 내용·사실·데이터·사례를 줄바꿈으로 정리 (없으면 빈 문자열)',
      genPoint1: '영상의 첫 번째 핵심 포인트 (없으면 빈 문자열)',
      genPoint2: '영상의 두 번째 핵심 포인트 (없으면 빈 문자열)',
      genPoint3: '영상의 세 번째 핵심 포인트 (없으면 빈 문자열)',
      genCaution: '영상에서 언급된 주의사항·반론·예외 케이스 (없으면 빈 문자열)',
      genReference: '영상에서 언급된 참고 자료·사례·출처 (없으면 빈 문자열)',
      genAudience: '영상이 타겟하는 시청자층 및 말투/톤 특징 (없으면 빈 문자열)',
    },
  },
  economy: {
    description: '경제/주식 유튜브 채널 대본 요청서',
    fields: {
      topic: '시청자가 클릭하고 싶은 구체적인 제목 형태 (한 줄)',
      angle: '대부분이 잘못 알고 있는 것 또는 핵심 인사이트 (1~3문장)',
      econData: '영상에서 언급된 날짜·지수·환율·수급 등 핵심 수치를 줄바꿈으로 정리 (없으면 빈 문자열)',
      econBullish: '영상에서 언급된 낙관적 시나리오 또는 상승 조건 (없으면 빈 문자열)',
      econNeutral: '영상에서 언급된 중립 분석 또는 박스권 전망 (없으면 빈 문자열)',
      econBearish: '영상에서 언급된 비관적 시나리오 또는 하락 리스크 (없으면 빈 문자열)',
      econRisk: '영상에서 언급된 리스크 발동 조건과 영향 경로 (없으면 빈 문자열)',
      econSector: '영상에서 언급된 주목 종목·섹터·자산 (없으면 빈 문자열)',
      econIndicator: '영상에서 언급된 체크해야 할 지표와 기준선 (없으면 빈 문자열)',
    },
  },
  history: {
    description: '역사 유튜브 채널 대본 요청서',
    fields: {
      topic: '시청자가 클릭하고 싶은 구체적인 제목 형태 (한 줄)',
      angle: '이 역사 주제의 핵심 인사이트 또는 대부분이 모르는 반전 (1~3문장)',
      histEra: '영상에서 다루는 시대·사건·배경을 줄바꿈으로 정리',
      histConnect: '이 역사적 사건이 현재 우리에게 왜 중요한지 (없으면 빈 문자열)',
      histPattern: '영상에서 언급된 반복되는 역사 패턴 (없으면 빈 문자열)',
      histFacts: '영상에서 언급된 핵심 수치·팩트를 줄바꿈으로 정리 (없으면 빈 문자열)',
      histLesson: '시청자가 가져갈 교훈 한 줄 (없으면 빈 문자열)',
    },
  },
  psychology: {
    description: '심리학 유튜브 채널 대본 요청서',
    fields: {
      topic: '시청자가 클릭하고 싶은 구체적인 제목 형태 (한 줄)',
      angle: '이 심리 현상의 핵심 인사이트 또는 대부분이 모르는 반전 (1~3문장)',
      psychPhenomenon: '영상에서 다루는 핵심 심리 현상 이름과 정의',
      psychResearch: '영상에서 언급된 연구자명·실험명·연도·결과 수치 (없으면 빈 문자열)',
      psychApplication: '영상에서 언급된 일상 적용 사례 (없으면 빈 문자열)',
      psychBehavior: '영상에서 제안하는 행동 변화 포인트 (없으면 빈 문자열)',
    },
  },
  horror: {
    description: '공포 유튜브 채널 대본 요청서',
    fields: {
      topic: '시청자가 클릭하고 싶은 구체적인 제목 형태 (한 줄)',
      angle: '시청자가 예상 못 한 반전 또는 핵심 공포 포인트 (1~3문장)',
      horrorMaterial: '영상에서 다루는 공포 소재·배경·상황을 줄바꿈으로 정리',
      horrorTwist: '영상의 핵심 반전 포인트 (없으면 빈 문자열)',
      horrorTension: '영상에서 긴장감을 고조시키는 구간 설정 (없으면 빈 문자열)',
      horrorFact: '영상에서 언급된 충격적인 수치·사실 (없으면 빈 문자열)',
      horrorEnding: '영상의 마무리 방향 또는 메시지 한 줄 (없으면 빈 문자열)',
    },
  },
  health: {
    description: '건강 유튜브 채널 대본 요청서',
    fields: {
      topic: '시청자가 클릭하고 싶은 구체적인 제목 형태 (한 줄)',
      angle: '대중의 잘못된 상식을 뒤집는 핵심 인사이트 (1~3문장)',
      healthTopic: '영상에서 다루는 건강 주제와 핵심 현상을 줄바꿈으로 정리',
      healthResearch: '영상에서 언급된 연구기관·논문·수치 (없으면 빈 문자열)',
      healthMisconception: '영상에서 뒤집는 잘못된 상식 (없으면 빈 문자열)',
      healthAction: '영상에서 제안하는 실천 행동 지침 (없으면 빈 문자열)',
      healthCaution: '영상에서 언급된 주의사항·면책 내용 (없으면 빈 문자열)',
    },
  },
};

export async function POST(req: NextRequest) {
  try {
    const { url, category = 'economy' } = await req.json();
    if (!url) return NextResponse.json({ error: 'URL을 입력해주세요' }, { status: 400 });

    const videoId = extractVideoId(url.trim());
    if (!videoId) return NextResponse.json({ error: '유효한 YouTube URL이 아닙니다' }, { status: 400 });

    const { title } = await getVideoMeta(videoId);

    // 자막 시도 — YouTube "스크립트 표시"와 동일한 API
    // 한국어 수동 → 한국어 자동생성 → 영어 수동 → 영어 자동생성 → 언어 무관 순으로 시도
    let fullTranscript = '';
    let transcriptSource = 'transcript';

    const langCandidates = ['ko', 'a.ko', 'en', 'a.en'];
    for (const lang of langCandidates) {
      try {
        const items = await YoutubeTranscript.fetchTranscript(videoId, { lang });
        if (items && items.length > 0) {
          fullTranscript = items.map(t => t.text).join(' ');
          break;
        }
      } catch { /* 다음 언어 시도 */ }
    }

    // 언어 코드 없이 마지막 한 번 더 시도 (첫 번째로 사용 가능한 자막)
    if (!fullTranscript) {
      try {
        const items = await YoutubeTranscript.fetchTranscript(videoId);
        if (items && items.length > 0) {
          fullTranscript = items.map(t => t.text).join(' ');
        }
      } catch { /* 자막 완전 없음 */ }
    }

    // 자막 없으면 페이지 설명으로 대체
    if (!fullTranscript) {
      const desc = await scrapeVideoDescription(videoId);
      if (desc) {
        fullTranscript = desc;
        transcriptSource = 'description';
      }
    }

    // 둘 다 없으면 제목만으로 분석
    if (!fullTranscript && !title) {
      return NextResponse.json({ error: '영상 정보를 가져올 수 없습니다. 비공개 영상이거나 잘못된 URL일 수 있습니다.' }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    const contentLabel = transcriptSource === 'description' ? '영상 설명(자막 없음, 설명란으로 대체)' : '자막';
    const transcriptForAI = fullTranscript.slice(0, 8000);

    const isAutoMode = category === 'auto';
    const categoryList = Object.keys(CATEGORY_SCHEMAS).filter(k => k !== 'general').join(', ');

    // auto 모드: 먼저 카테고리 감지 후 해당 스키마로 분석
    let resolvedCategory = category;
    if (isAutoMode) {
      const detectPrompt = `아래 유튜브 영상 제목과 내용을 보고 가장 적합한 카테고리 하나만 골라줘.
선택지: economy(경제/주식), history(역사), psychology(심리학), horror(공포), health(건강), general(기타/해당없음)
반드시 아래 JSON 형식으로만 응답해 (다른 텍스트 없이):
{"category": "선택한_카테고리"}

영상 제목: ${title || '(제목 없음)'}
${transcriptForAI ? `내용 요약:\n${transcriptForAI.slice(0, 2000)}` : ''}`;

      const detectRes = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: detectPrompt,
        config: { responseMimeType: 'application/json', temperature: 0.1 },
      });
      try {
        const detected = JSON.parse(detectRes.text ?? '{}');
        resolvedCategory = detected.category && CATEGORY_SCHEMAS[detected.category]
          ? detected.category
          : 'general';
      } catch {
        resolvedCategory = 'general';
      }
    }

    const schema = CATEGORY_SCHEMAS[resolvedCategory] ?? CATEGORY_SCHEMAS.general;
    const jsonSchema = Object.entries(schema.fields)
      .map(([key, desc]) => `  "${key}": "${desc}"`)
      .join(',\n');

    const prompt = `당신은 유튜브 영상 콘텐츠 분석 전문가입니다.
아래 영상을 분석하여 [${schema.description}] 작성에 필요한 정보를 추출하세요.
${!fullTranscript ? '자막과 설명 모두 없으므로 제목만으로 최대한 분석하세요.' : ''}

**중요: 모든 출력은 반드시 한국어로 작성하세요. 영상이 영어나 다른 외국어여도 한국어로 번역하여 작성하세요.**
**내용이 없는 필드는 반드시 빈 문자열("")로 두세요. 추측하거나 지어내지 마세요.**

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
${jsonSchema}
}

영상 제목: ${title || '(제목 없음)'}
${transcriptForAI ? `\n${contentLabel}:\n${transcriptForAI}` : ''}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    const content = response.text ?? '';
    if (!content) throw new Error('AI 응답 없음');

    const parsed = JSON.parse(content);
    return NextResponse.json({
      ...parsed,
      title,
      transcript: fullTranscript.slice(0, 15000),
      transcriptSource,
      detectedCategory: isAutoMode ? resolvedCategory : undefined,
    });
  } catch (err: unknown) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'AI 응답 파싱 실패. 다시 시도해주세요.' }, { status: 500 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '분석 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
