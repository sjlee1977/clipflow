# ClipFlow — 아키텍처 맵

## 전체 파일 구조

```
clipflow/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── analyze-script/route.ts        ← 대본 분석
│   │   │   ├── analyze-youtube/route.ts        ← YouTube URL 분석
│   │   │   ├── animate-scene/route.ts          ← 씬 애니메이션
│   │   │   ├── auto-blog/run/route.ts          ← 자동 블로그 파이프라인
│   │   │   ├── blog/
│   │   │   │   ├── crawl/route.ts              ← 블로그 크롤링
│   │   │   │   ├── credentials/route.ts        ← 블로그 인증 정보
│   │   │   │   ├── publish/route.ts            ← 블로그 발행
│   │   │   │   └── write/route.ts              ← AI 블로그 글쓰기
│   │   │   ├── calendar/
│   │   │   │   ├── plans/route.ts
│   │   │   │   └── series/route.ts
│   │   │   ├── carousel/export/route.tsx       ← 카루셀 내보내기
│   │   │   ├── carousels/
│   │   │   │   ├── [id]/route.ts
│   │   │   │   └── route.ts
│   │   │   ├── delete-video/route.ts
│   │   │   ├── download/route.ts
│   │   │   ├── generate-carousel/route.ts
│   │   │   ├── generate-scenes/route.ts        ← 씬 목록 생성
│   │   │   ├── generate-script/route.ts        ← AI 대본 생성 (LLM Wiki 연동)
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
│   │   │   ├── seo/
│   │   │   │   ├── google-trends/route.ts
│   │   │   │   ├── naver-shopping/route.ts
│   │   │   │   ├── naver-trend/route.ts
│   │   │   │   └── naver-volume/route.ts
│   │   │   ├── thumbnail/route.ts              ← 썸네일 생성
│   │   │   ├── trends/
│   │   │   │   ├── collect/route.ts
│   │   │   │   ├── insights/route.ts
│   │   │   │   ├── outliers/route.ts
│   │   │   │   ├── settings/route.ts
│   │   │   │   ├── subscriber/route.ts
│   │   │   │   ├── trigger/route.ts
│   │   │   │   └── viral/route.ts
│   │   │   ├── upload-image/route.ts
│   │   │   └── user-keys/route.ts              ← 사용자 API 키 관리
│   │   ├── auth/callback/route.ts              ← Supabase OAuth 콜백
│   │   ├── dashboard/
│   │   │   ├── layout.tsx                      ← 사이드바 포함 레이아웃
│   │   │   ├── page.tsx                        ← 대시보드 홈
│   │   │   ├── auto-blog/page.tsx
│   │   │   ├── blog/page.tsx
│   │   │   ├── calendar/page.tsx
│   │   │   ├── carousel/page.tsx
│   │   │   ├── history/page.tsx
│   │   │   ├── keyword/page.tsx
│   │   │   ├── my-scripts/page.tsx
│   │   │   ├── prompt/page.tsx                 ← YouTube 분석 + 대본 생성 입력
│   │   │   ├── reformat/page.tsx
│   │   │   ├── script/page.tsx                 ← 대본 결과 + 썸네일
│   │   │   ├── settings/page.tsx
│   │   │   ├── thumbnail/page.tsx
│   │   │   ├── trends/
│   │   │   │   ├── outliers/page.tsx
│   │   │   │   ├── subscriber/page.tsx
│   │   │   │   └── viral/page.tsx
│   │   │   └── video/page.tsx
│   │   ├── login/page.tsx
│   │   ├── page.tsx                            ← 랜딩 페이지
│   │   └── layout.tsx
│   ├── components/
│   │   ├── DateRangePicker.tsx
│   │   ├── SidebarScripts.tsx
│   │   ├── TemplateGallery.tsx
│   │   └── ThemeToggle.tsx
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── credits.ts
│   │   ├── dashscope-image.ts                  ← Qwen 이미지 생성
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
│   │   ├── supabase-browser.ts
│   │   ├── supabase-server.ts
│   │   ├── supabase.ts
│   │   ├── templates.ts
│   │   ├── trends-collect.ts
│   │   ├── useTheme.ts
│   │   ├── video-gen.ts
│   │   ├── youtube-trends.ts
│   │   └── youtube.ts
│   └── remotion/                               ← 영상 렌더링 씬 컴포넌트
├── wiki/                                       ← AI 프롬프트 지식 베이스 (LLM Wiki)
│   ├── blog/
│   └── script/
└── docs/                                       ← 프로젝트 지식 베이스
```

## 핵심 도메인 → API 매핑

| 도메인 | 페이지 | API 라우트 |
|--------|--------|-----------|
| **대본 생성** | `dashboard/prompt/`, `dashboard/script/` | `api/analyze-youtube/`, `api/analyze-script/`, `api/generate-script/` |
| **블로그** | `dashboard/blog/`, `dashboard/auto-blog/` | `api/blog/write/`, `api/blog/publish/`, `api/auto-blog/run/` |
| **영상** | `dashboard/video/` | `api/generate-scenes/`, `api/animate-scene/`, `api/generate-video/` |
| **SEO/트렌드** | `dashboard/keyword/`, `dashboard/trends/*` | `api/keyword/analyze/`, `api/seo/*`, `api/trends/*` |
| **썸네일** | `dashboard/thumbnail/` | `api/thumbnail/` |
| **캘린더** | `dashboard/calendar/` | `api/calendar/*` |
| **설정** | `dashboard/settings/` | `api/user-keys/` |

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
