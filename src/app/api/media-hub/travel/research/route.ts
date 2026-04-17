/**
 * POST /api/media-hub/travel/research
 *
 * 여행지 데이터 수집:
 * 1. Google Places Text Search API → 호텔·명소·맛집 목록
 * 2. API 키 없을 경우 기본 구조 반환 (수동 입력 유도)
 *
 * 사용자 설정: user_metadata.google_places_api_key
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

interface PlaceResult {
  name: string;
  address: string;
  rating: number;
  userRatingCount: number;
  types: string[];
  editorialSummary?: string;
  priceLevel?: string;
  websiteUri?: string;
  googleMapsUri?: string;
}

interface ResearchResult {
  destination: string;
  hotels: PlaceResult[];
  attractions: PlaceResult[];
  restaurants: PlaceResult[];
  overview: string;
  bestSeason: string;
  travelTips: string[];
  dataSource: 'google_places' | 'manual';
}

async function searchPlaces(query: string, apiKey: string): Promise<PlaceResult[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.types,places.editorialSummary,places.priceLevel,places.websiteUri,places.googleMapsUri',
    },
    body: JSON.stringify({ textQuery: query, languageCode: 'ko', maxResultCount: 5 }),
  });

  if (!res.ok) return [];
  const data = await res.json();
  return (data.places ?? []).map((p: Record<string, unknown>) => ({
    name:             (p.displayName as { text: string })?.text ?? '',
    address:          (p.formattedAddress as string) ?? '',
    rating:           (p.rating as number) ?? 0,
    userRatingCount:  (p.userRatingCount as number) ?? 0,
    types:            (p.types as string[]) ?? [],
    editorialSummary: (p.editorialSummary as { text: string })?.text ?? '',
    priceLevel:       (p.priceLevel as string) ?? '',
    websiteUri:       (p.websiteUri as string) ?? '',
    googleMapsUri:    (p.googleMapsUri as string) ?? '',
  }));
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const { destination, articleType } = await req.json() as { destination: string; articleType?: string };
    if (!destination?.trim()) return NextResponse.json({ error: '여행지를 입력하세요' }, { status: 400 });

    const meta    = (user.user_metadata ?? {}) as Record<string, string>;
    const gApiKey = meta.google_places_api_key ?? process.env.GOOGLE_PLACES_API_KEY ?? '';

    const result: ResearchResult = {
      destination: destination.trim(),
      hotels: [], attractions: [], restaurants: [],
      overview: '', bestSeason: '', travelTips: [],
      dataSource: 'manual',
    };

    if (gApiKey) {
      const dest = destination.trim();
      const [hotels, attractions, restaurants] = await Promise.all([
        searchPlaces(`${dest} 호텔 추천`, gApiKey),
        searchPlaces(`${dest} 관광명소`, gApiKey),
        searchPlaces(`${dest} 맛집 레스토랑`, gApiKey),
      ]);
      result.hotels      = hotels;
      result.attractions = attractions;
      result.restaurants = restaurants;
      result.dataSource  = 'google_places';
    }

    // 기사 유형별 기본 팁 생성 (API 유무와 무관)
    const tipsByType: Record<string, string[]> = {
      hotel:    ['예약은 최소 2주 전 권장', '조식 포함 여부 확인 필수', '위치(교통 접근성) 우선 체크'],
      guide:    ['현지 교통 패스 구매 검토', '환전은 현지 도착 후 ATM 이용 추천', '구글맵 오프라인 저장 필수'],
      hidden:   ['현지인 추천 앱 활용', '이른 아침 방문으로 인파 피하기', '소셜 미디어 해시태그 검색 활용'],
      food:     ['점심 타임(12-2시) 줄서기 각오', '현금 결제만 가능한 곳 많음', '알레르기 표현 현지어로 준비'],
      budget:   ['호스텔·게스트하우스 적극 활용', '무료 관광지 목록 사전 조사', '저가 항공 + 조기 예약 전략'],
    };
    result.travelTips = tipsByType[articleType ?? 'guide'] ?? tipsByType['guide'];

    return NextResponse.json(result);
  } catch (err) {
    console.error('[travel/research]', err);
    return NextResponse.json({ error: '리서치 실패' }, { status: 500 });
  }
}
