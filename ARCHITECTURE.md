# ClipFlow — 아키텍처 맵

## 전체 파일 구조

```
clipflow/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── admin/users/route.ts            ← 관리자 사용자 목록
│   │   │   ├── analyze-script/route.ts        ← 대본 분석
│   │   │   ├── analyze-youtube/route.ts        ← YouTube URL 분석
│   │   │   ├── animate-scene/route.ts          ← 씬 애니메이션
│   │   │   ├── auto-blog/run/route.ts          ← 자동 블로그 파이프라인
│   │   │   ├── blog/
│   │   │   │   ├── crawl/route.ts              ← 블로그 크롤링
│   │   │   │   ├── credentials/route.ts        ← 블로그 인증 정보
│   │   │   │   ├── evaluate/route.ts           ← 블로그 품질 평가
│   │   │   │   ├── generate-titles/route.ts    ← 제목 후보 생성
│   │   │   │   ├── keyword-suggest/route.ts    ← 키워드 제안
│   │   │   │   ├── publish/route.ts            ← 블로그 발행
│   │   │   │   ├── score-titles/route.ts       ← 제목 점수 평가
│   │   │   │   ├── cron-publish/route.ts       ← 블로그 예약 자동 발행
│   │   │   │   ├── scheduled-posts/route.ts    ← 예약 게시글 목록
│   │   │   │   ├── write-agent/route.ts        ← AI 블로그 에이전트 (단계별)
│   │   │   │   ├── write-multi-platform/route.ts ← 멀티 플랫폼 발행
│   │   │   │   ├── write-pipeline/route.ts     ← 블로그 멀티에이전트 파이프라인
│   │   │   │   └── write/route.ts              ← AI 블로그 글쓰기 (단일)
│   │   │   ├── calendar/
│   │   │   │   ├── plans/route.ts
│   │   │   │   └── series/route.ts
│   │   │   ├── carousel/export/route.tsx       ← 카루셀 내보내기
│   │   │   ├── carousels/
│   │   │   │   ├── [id]/route.ts
│   │   │   │   └── route.ts
│   │   │   ├── competitor/transcript/route.ts  ← 경쟁자 영상 트랜스크립트
│   │   │   ├── delete-video/route.ts
│   │   │   ├── download/route.ts
│   │   │   ├── evaluate-script/route.ts        ← 대본 품질 평가
│   │   │   ├── debug/qwen-models/route.ts       ← Qwen 모델 목록 조회 (디버그)
│   │   │   ├── generate-carousel/route.ts
│   │   │   ├── generate-carousel-agent/route.ts ← AI 카드뉴스 에이전트
│   │   │   ├── generate-scenes/route.ts        ← 씬 목록 생성
│   │   │   ├── generate-script/route.ts        ← AI 대본 생성 (LLM Wiki 연동)
│   │   │   ├── generate-script-agent/route.ts  ← AI 대본 생성 에이전트 방식
│   │   │   ├── generate-video/route.ts         ← 영상 렌더링
│   │   │   ├── get-render-status/route.ts
│   │   │   ├── keyword/analyze/route.ts        ← SEO 키워드 분석
│   │   │   ├── notify/
│   │   │   │   ├── settings/route.ts
│   │   │   │   ├── test/route.ts
│   │   │   │   └── trigger/route.ts
│   │   │   ├── preview-speech/route.ts         ← TTS 미리듣기
│   │   │   ├── reformat/route.ts
│   │   │   ├── regenerate-image/route.ts
│   │   │   ├── save-video/route.ts             ← 영상 저장
│   │   │   ├── seo/
│   │   │   │   ├── google-trends/route.ts
│   │   │   │   ├── naver-content/route.ts      ← 네이버 발행량 조회
│   │   │   │   ├── naver-shopping/route.ts
│   │   │   │   ├── naver-trend/route.ts
│   │   │   │   └── naver-volume/route.ts       ← 네이버 검색량 조회
│   │   │   ├── shopping-shorts/generate/route.ts ← 쇼핑 쇼츠 생성
│   │   │   ├── media-hub/
│   │   │   │   ├── cron-publish/route.ts       ← 미디어허브 예약 발행
│   │   │   │   ├── posts/route.ts              ← 미디어허브 게시글 목록
│   │   │   │   ├── travel/research/route.ts    ← 여행 리서치 파이프라인
│   │   │   │   └── write/route.ts              ← 미디어허브 글쓰기
│   │   │   ├── suggest-topics/route.ts         ← 주제 추천
│   │   │   ├── thumbnail/route.ts              ← 썸네일 생성
│   │   │   ├── trends/
│   │   │   │   ├── collect/route.ts
│   │   │   │   ├── comments/route.ts           ← 댓글 트렌드 분석
│   │   │   │   ├── insights/route.ts
│   │   │   │   ├── outliers/route.ts
│   │   │   │   ├── settings/route.ts
│   │   │   │   ├── subscriber/route.ts
│   │   │   │   ├── trigger/route.ts
│   │   │   │   └── viral/route.ts
│   │   │   ├── upload-image/route.ts
│   │   │   ├── usage/route.ts                  ← 사용량 조회
│   │   │   ├── user/profile/route.ts           ← 사용자 프로필
│   │   │   ├── user-keys/route.ts              ← 사용자 API 키 관리
│   │   │   ├── wiki/
│   │   │   │   ├── journal/route.ts            ← 위키 저널 기록
│   │   │   │   ├── knowledge/query/route.ts    ← 지식 쿼리
│   │   │   │   ├── pages/route.ts              ← 위키 페이지 목록
│   │   │   │   ├── pages/[id]/route.ts         ← 위키 페이지 상세
│   │   │   │   ├── sources/ingest/route.ts     ← 외부 소스 수집
│   │   │   │   └── synthesis/route.ts          ← 지식 합성
│   │   │   └── youtube/
│   │   │       ├── analytics/route.ts          ← YouTube 채널 분석
│   │   │       ├── oauth/route.ts              ← YouTube OAuth 시작
│   │   │       └── oauth/callback/route.ts     ← YouTube OAuth 콜백
│   │   ├── auth/callback/route.ts              ← Supabase OAuth 콜백
│   │   ├── dashboard/
│   │   │   ├── layout.tsx                      ← 사이드바 포함 레이아웃
│   │   │   ├── page.tsx                        ← 대시보드 홈
│   │   │   ├── admin/page.tsx                  ← 관리자 패널
│   │   │   ├── auto-blog/page.tsx
│   │   │   ├── blog/page.tsx
│   │   │   ├── calendar/page.tsx
│   │   │   ├── carousel/page.tsx
│   │   │   ├── carousel-studio/page.tsx        ← 카드뉴스 제작 스튜디오
│   │   │   ├── competitor/page.tsx             ← 경쟁자 분석
│   │   │   ├── history/page.tsx
│   │   │   ├── keyword/page.tsx
│   │   │   ├── media-hub/page.tsx              ← 미디어허브
│   │   │   ├── my-channel/page.tsx             ← 내 채널 현황
│   │   │   ├── my-scripts/page.tsx
│   │   │   ├── prompt/page.tsx                 ← YouTube 분석 + 대본 생성 입력
│   │   │   ├── reformat/page.tsx
│   │   │   ├── script/page.tsx                 ← 대본 결과 + 썸네일
│   │   │   ├── settings/page.tsx
│   │   │   ├── thumbnail/page.tsx
│   │   │   ├── trends/
│   │   │   │   ├── comments/page.tsx           ← 댓글 트렌드
│   │   │   │   ├── outliers/page.tsx
│   │   │   │   ├── subscriber/page.tsx
│   │   │   │   └── viral/page.tsx
│   │   │   └── video/page.tsx
│   │   ├── login/page.tsx
│   │   ├── page.tsx                            ← 랜딩 페이지
│   │   └── layout.tsx
│   ├── components/
│   │   ├── carousel-card-preview.tsx           ← 카드뉴스 카드 미리보기
│   │   ├── DateRangePicker.tsx
│   │   ├── SidebarScripts.tsx
│   │   ├── TemplateGallery.tsx
│   │   ├── TierGuard.tsx                       ← 티어별 접근 제어 컴포넌트
│   │   └── ThemeToggle.tsx
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── carousel-styles.ts                  ← 카드뉴스 스타일/레이아웃 정의
│   │   ├── credits.ts                          ← 크레딧 차감 로직
│   │   ├── dashscope-image.ts                  ← Qwen 이미지 생성
│   │   ├── date.ts                             ← 날짜 유틸리티
│   │   ├── elevenlabs.ts                       ← ElevenLabs TTS
│   │   ├── fal-image.ts                        ← fal.ai 이미지 생성
│   │   ├── fal-video.ts                        ← fal.ai 영상 생성
│   │   ├── ffmpeg-render.ts
│   │   ├── fonts.ts
│   │   ├── google.ts
│   │   ├── is-admin.ts
│   │   ├── kling.ts                            ← Kling 영상 생성
│   │   ├── minimax-tts.ts                      ← MiniMax TTS
│   │   ├── minimax-video.ts                    ← MiniMax 영상 생성
│   │   ├── notify.ts                           ← Telegram 알림
│   │   ├── openai.ts
│   │   ├── openrouter.ts
│   │   ├── qwen-image.ts
│   │   ├── qwen-llm.ts
│   │   ├── qwen-tts.ts
│   │   ├── qwen-video.ts
│   │   ├── remotion.ts
│   │   ├── render-store.ts                     ← 카드뉴스 렌더링용 인메모리 스토어
│   │   ├── supabase-browser.ts
│   │   ├── supabase-server.ts
│   │   ├── supabase.ts
│   │   ├── templates.ts
│   │   ├── tier.ts                             ← 사용자 티어/플랜 관리
│   │   ├── trends-collect.ts
│   │   ├── useTheme.ts
│   │   ├── video-gen.ts
│   │   ├── youtube-trends.ts
│   │   └── youtube.ts
│   └── remotion/                               ← 영상 렌더링 씬 컴포넌트
├── wiki/                                       ← AI 프롬프트 지식 베이스 (LLM Wiki)
│   ├── blog/
│   ├── knowledge/
│   └── script/
└── docs/                                       ← 프로젝트 지식 베이스
```

## 핵심 도메인 → API 매핑

| 도메인 | 페이지 | API 라우트 |
|--------|--------|-----------|
| **대본 생성** | `dashboard/prompt/`, `dashboard/script/` | `api/analyze-youtube/`, `api/analyze-script/`, `api/generate-script/`, `api/generate-script-agent/`, `api/evaluate-script/` |
| **블로그** | `dashboard/blog/`, `dashboard/auto-blog/` | `api/blog/write/`, `api/blog/write-agent/`, `api/blog/write-pipeline/`, `api/blog/evaluate/`, `api/blog/generate-titles/`, `api/blog/score-titles/`, `api/blog/keyword-suggest/`, `api/blog/publish/`, `api/auto-blog/run/` |
| **영상** | `dashboard/video/` | `api/generate-scenes/`, `api/animate-scene/`, `api/generate-video/`, `api/save-video/` |
| **SEO/트렌드** | `dashboard/keyword/`, `dashboard/trends/*` | `api/keyword/analyze/`, `api/seo/*`, `api/trends/*` |
| **썸네일** | `dashboard/thumbnail/` | `api/thumbnail/` |
| **카드뉴스** | `dashboard/carousel-studio/`, `dashboard/carousel/` | `api/generate-carousel-agent/`, `api/carousels/*`, `api/carousel/export/` |
| **미디어허브** | `dashboard/media-hub/` | `api/media-hub/*` |
| **캘린더** | `dashboard/calendar/` | `api/calendar/*` |
| **설정** | `dashboard/settings/` | `api/user-keys/`, `api/user/profile/`, `api/usage/` |
| **경쟁자 분석** | `dashboard/competitor/` | `api/competitor/transcript/` |
| **내 채널** | `dashboard/my-channel/` | `api/youtube/analytics/`, `api/youtube/oauth/` |
| **위키 시스템** | — | `api/wiki/pages/`, `api/wiki/sources/ingest/`, `api/wiki/knowledge/query/`, `api/wiki/synthesis/`, `api/wiki/journal/` |
| **관리자** | `dashboard/admin/` | `api/admin/users/` |

## 레이어 의존성 규칙

```
pages (dashboard/)
    ↓ fetch
API routes (app/api/)
    ↓ import
lib/ (외부 서비스 클라이언트)
    ↓ call
External APIs (Gemini, Claude, OpenAI, Supabase, fal.ai ...)
```

- `pages → API`: fetch만 (직접 import 금지)
- `API → lib`: import 허용
- `lib → pages`: 금지 (단방향)
- `components`: pages에서만 import

## AI 모델 라우팅 규칙

```typescript
// lib/ 내 모델 선택 패턴
const provider = modelId.startsWith('claude') ? 'anthropic'
               : modelId.startsWith('gemini') ? 'google'
               : 'qwen';  // dashscope
```

- **analyze-youtube**: Gemini 전용 (`gemini-2.5-flash` 고정)
- **generate-script**: 다중 모델 (사용자 선택)
- **blog/write**: OpenAI (`gpt-4o-mini`)
- 사용자 API 키 위치: `supabase.auth.getUser().user_metadata`

## LLM 위키 시스템

AI 프롬프트 품질을 파일로 관리하는 지식 베이스.

```
wiki/
  blog/     ← 블로그 글쓰기 원칙 (blog/write/route.ts가 읽음)
  script/   ← 대본 작성 원칙 (generate-script/route.ts가 읽음)
  feedback/ ← 날짜별 피드백 (자동 로드)
  sources/  ← 참고 자료
```

→ 상세: [wiki/script/index.md](wiki/script/index.md), [wiki/index.md](wiki/index.md)

## 인증 흐름

```
미들웨어 (middleware.ts)
  ↓ 비인증 요청
로그인 페이지 (/login)
  ↓ Supabase OAuth
auth/callback → 대시보드 리다이렉트
```

- 서버 컴포넌트: `lib/supabase-server.ts`
- 클라이언트 컴포넌트: `lib/supabase-browser.ts`
- 관리자 전용: `lib/is-admin.ts` + `createAdminClient()`

## 배포

- 플랫폼: Railway (`railway.toml`)
- 빌드: Next.js standalone
- 환경변수: Railway 대시보드에서 관리
