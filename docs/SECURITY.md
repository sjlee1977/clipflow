# ClipFlow — 보안 규칙

## 절대 금지
- `.env` 파일 커밋 금지
- API 키, 시크릿을 응답 body에 포함 금지
- 클라이언트 컴포넌트에서 서버 전용 환경변수 접근 금지

## API 키 관리
- 사용자 API 키: Supabase `user_metadata`에만 저장
  ```typescript
  const meta = user.user_metadata ?? {};
  const apiKey = meta.gemini_api_key;  // 읽기
  ```
- 서비스 키: 서버 환경변수 (`process.env.OPENAI_API_KEY`)
- 클라이언트에 노출되는 환경변수: `NEXT_PUBLIC_` 접두사만 허용

## 인증 규칙
- 모든 `/api/` 라우트는 `supabase.auth.getUser()` 인증 검증 필수
- 미인증 요청: `401` 반환
- 관리자 전용 API: `lib/is-admin.ts` 추가 검증
- RLS 우회가 필요한 DB 작업: `createAdminClient()` 사용 (서버 전용)

## 입력 검증
- 사용자 입력은 경계(API 라우트 진입점)에서 검증
- `content.slice(0, 8000)` 패턴으로 입력 길이 제한 — LLM 비용 보호
- SQL injection 방지: Supabase SDK 사용 (raw query 금지)

## 에러 처리
- 내부 에러 메시지를 클라이언트에 그대로 노출 금지
- `err instanceof Error ? err.message : '알 수 없는 오류'` 패턴 사용
- API 키 관련 에러는 "설정 페이지에서 키를 등록하세요" 수준으로만 안내
