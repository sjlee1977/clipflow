# ClipFlow — 프론트엔드 규칙

## 기술 스택
- Next.js 14 App Router (서버/클라이언트 컴포넌트 분리)
- TypeScript (strict mode)
- Tailwind CSS (유틸리티 우선)

## 파일 구조 규칙
```
src/app/dashboard/{feature}/page.tsx   ← 각 기능 페이지
src/components/{Name}.tsx              ← 공유 컴포넌트
src/lib/{service}.ts                   ← 외부 서비스 클라이언트
```

## 서버 vs 클라이언트 컴포넌트
- 기본: 서버 컴포넌트 (`async` 함수)
- `useState`, `useEffect`, 이벤트 핸들러 필요 시: `"use client"` 선언
- Supabase 인증 조회: 서버 → `lib/supabase-server.ts`, 클라이언트 → `lib/supabase-browser.ts`

## API 호출 패턴
```typescript
// 클라이언트에서 API 호출 표준 패턴
const res = await fetch('/api/generate-script', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ topic, category, llmModelId }),
});
if (!res.ok) throw new Error(await res.text());
const data = await res.json();
```

## 상태 관리
- 전역 상태 라이브러리 없음 (불필요)
- 페이지 내 `useState` / `useReducer` 사용
- 서버 상태: Next.js `fetch` 캐싱 활용

## 타입 규칙
- `any` 타입 금지 — `unknown` + 타입 가드 사용
- API 응답은 반드시 타입 정의
- Supabase 테이블 타입: `supabase gen types` 으로 생성

## 금지 사항
- `console.log` 프로덕션 코드에 남기지 말 것
- `useEffect` 내 fetch 직접 호출 금지 — 커스텀 훅이나 이벤트 핸들러로 분리
- 인라인 스타일 (`style={{}}`) 최소화 — Tailwind 우선
