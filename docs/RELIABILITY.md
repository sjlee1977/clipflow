# ClipFlow — 안정성 규칙

## API 라우트 에러 처리 표준
```typescript
export async function POST(req: NextRequest) {
  try {
    // ... 로직
  } catch (err: unknown) {
    console.error('[route-name]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
```

## AI 모델 장애 대응
- Gemini `RESOURCE_EXHAUSTED`: AI Studio에서 월 한도 확인
- API 키 미설정: `{ error: '...API 키가 설정되지 않았습니다', needsKey: true }` 반환
- 응답 없음: `if (!script) throw new Error('응답 없음')` 패턴

## 타임아웃 관리
- LLM 생성 요청: 최대 60초 (Vercel/Railway 함수 제한 고려)
- 긴 생성 작업(영상 렌더링): 폴링 방식 (`get-render-status/`)

## DB 저장 내결함성
```typescript
// 1차 시도 (전체 필드)
// 실패 시 2차 시도 (필수 필드만)
// generate-script/route.ts 참조
```

## 현재 알려진 불안정 요소
→ [docs/exec-plans/tech-debt-tracker.md](exec-plans/tech-debt-tracker.md) 참조
