# Clipflow 프롬프트 감사 보고서

> 작성일: 2026-04-08

---

## 1. 우선순위 높음 — 보안/안정성

### 프롬프트 인젝션 취약점

- **`src/app/api/generate-script/route.ts` Line 587**
  사용자 `topic`이 escaping 없이 문자열 연결로 프롬프트에 직접 삽입됨
  ```typescript
  const userContent = topic + lengthInstruction; // 위험: 직접 연결
  ```

- **`src/lib/qwen-llm.ts` Line 21**
  사용자 입력 캐릭터 이름이 sanitization 없이 프롬프트에 삽입됨
  ```typescript
  const subCharacterInstruction = subCharacterNames.length > 0
    ? `\n추가 캐릭터: ${subCharacterNames.map((n, i) => `캐릭터${i + 2}(${n})`).join(', ')}`
    : '';
  ```

- **`src/app/api/analyze-youtube/route.ts` Lines 218~233**
  YouTube 외부 콘텐츠(설명/자막)가 검증 없이 AI 프롬프트에 삽입됨

### 입력 유효성 검사 부재

- `category`, `tone`, `llmModelId` 값에 화이트리스트 검증 없음 → 임의 값 허용
  ```typescript
  const resolvedCategory = category || 'general'; // 유효성 검사 없음
  const resolvedTone = tone || 'friendly_casual'; // 유효성 검사 없음
  const model = llmModelId ?? 'gemini-2.5-flash'; // model.startsWith()만 체크
  ```

- `topic` 최대 길이 제한 없음 → 토큰 폭발 가능
- `youtubeLength` 숫자 타입 검증 없음
- API Rate Limiting 없음 → API 쿼터 소진 위험

### 하드코딩된 S3 버킷 이름 노출

- **`src/lib/google.ts` Line 12**
  `.env` 미설정 시 버킷 이름이 소스코드에 노출됨
  ```typescript
  const BUCKET = process.env.S3_BUCKET ?? 'remotionlambda-apnortheast2-17lxfxukvf';
  ```

---

## 2. 우선순위 중간 — 유지보수/일관성

### 500줄 프롬프트가 라우트 핸들러 안에 하드코딩

- **`src/app/api/generate-script/route.ts` Lines 23~522**
  `CATEGORY_IDENTITIES`, `TONE_STYLES`, `CATEGORY_STAGE_NOTES`, 시스템 프롬프트 빌더 전부 단일 파일 인라인
  - 버전 관리, A/B 테스트, 핫스왑 불가
  - 배포 없이 프롬프트 수정 불가

### AI 프로바이더 간 설정 불일치

| 항목 | Claude | Gemini | Qwen |
|------|--------|--------|------|
| temperature | 미지정(기본값) | 0.8 | 0.8 |
| max_tokens | 8,192 | 65,536 | **미지정** |
| 에러 처리 상세도 | 기본 | 상세 | 최소 |

- Gemini `maxOutputTokens: 65536`은 과도하게 높음 → 비용 폭발 위험
- Qwen max_tokens 미지정 → 예측 불가능한 응답 길이

### 중복 스키마 정의 (DRY 원칙 위반)

`CATEGORY_SCHEMAS` 동일 내용이 두 파일에 중복 정의:
- `src/app/api/analyze-script/route.ts` Lines 5~99
- `src/app/api/analyze-youtube/route.ts` Lines 59~153

### JSON 파싱 오류 처리 취약

- **`src/lib/google.ts` Lines 223~247**
  LLM이 잘린 JSON 반환 시 복구 로직이 특정 패턴(`},`)에 의존 → 패턴 불일치 시 즉시 실패

### JSON 파싱 후 타입 검증 없음

```typescript
let parsed: any; // TypeScript 안전성 우회
parsed = JSON.parse(jsonStr); // 스키마 검증 없음
```

---

## 3. 우선순위 낮음 — UX/기능

### 사용자에게 숨겨진 제한사항

- 장면당 글자수 100~150자 제한이 UI에 표시 안됨 (`src/lib/google.ts` Lines 251~252)
- YouTube 분석 시 8,000자 초과분 조용히 잘림 → 경고 없음 (`analyze-youtube/route.ts` Line 219)
- 최대 장면 수 50개 하드코딩, UI 안내 없음 (`generate-scenes/route.ts` Line 221)
- 최대 YouTube 자막 길이 15,000자 하드코딩 (`analyze-youtube/route.ts` Line 286)

### 프롬프트 히스토리 및 재현 불가

- 저장 메타데이터에 `category`, `tone`, 실제 사용된 프롬프트 내용 없음
- 동일 결과 재현 불가

### 재시도 로직 없음

- API 호출 실패 시 즉시 에러 반환
- 지수 백오프(Exponential Backoff) 없음
- Rate Limit 429 에러 자동 재시도 없음

### 토큰 사용량 추적 불일치

- `generate-scenes` — 토큰 사용량 반환함
- `analyze-youtube`, `analyze-script` — 토큰 사용량 반환 안 함

### UI에서 프롬프트 파라미터 제어 불가

- temperature(창의성) 슬라이더 없음
- 최대 토큰 수 설정 없음
- 생성 전 최종 프롬프트 미리보기 없음

---

## 4. 권장 수정 우선순위

```
1. 입력 유효성 검사 추가 (category/tone/model 화이트리스트 enum)
2. 사용자 입력 프롬프트 삽입 시 구분자 또는 구조화된 형식 사용
3. 프롬프트 파일 분리 (src/lib/prompts/ 디렉토리로 추출)
4. Gemini max_tokens 합리적 값으로 조정, Qwen max_tokens 제한 추가
5. analyze-* 라우트에 콘텐츠 잘림 경고 추가 (UI + API 응답)
6. 카테고리 스키마 중복 제거 → src/lib/schemas.ts 공유 모듈 생성
7. API 라우트에 Rate Limiting 추가
8. 재시도 로직 + 지수 백오프 구현
9. 하드코딩된 S3 버킷 이름 제거
10. 프롬프트 히스토리 DB 필드 추가 (prompt_version, category, tone)
```

---

## 5. 관련 파일 목록

| 파일 | 주요 이슈 |
|------|-----------|
| `src/app/api/generate-script/route.ts` | 대형 인라인 프롬프트, 입력 검증 없음, 인젝션 |
| `src/app/api/generate-scenes/route.ts` | 캐릭터 이름 인젝션, imageStyle 검증 없음 |
| `src/app/api/analyze-script/route.ts` | 스키마 중복, silent truncation |
| `src/app/api/analyze-youtube/route.ts` | 외부 콘텐츠 인젝션, 스키마 중복, silent truncation |
| `src/lib/google.ts` | 대형 인라인 프롬프트, 취약한 JSON 복구, S3 버킷 하드코딩 |
| `src/lib/qwen-llm.ts` | 캐릭터 이름 인젝션, max_tokens 미지정 |
