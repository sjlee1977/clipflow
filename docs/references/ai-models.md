# AI 모델 레퍼런스

## 사용 중인 모델

### Google Gemini
- 기본 모델: `gemini-2.5-flash` (analyze-youtube 고정)
- 대본 생성 선택 가능 모델: `gemini-2.5-flash`, `gemini-2.0-flash`
- API 키 메타데이터 키: `gemini_api_key`
- 에러: `RESOURCE_EXHAUSTED` → AI Studio에서 월 한도 확인

### Anthropic Claude
- 대본 생성 선택 가능
- API 키 메타데이터 키: `anthropic_api_key`
- 모델 ID 패턴: `claude-*`

### OpenAI
- 블로그 글쓰기 전용: `gpt-4o-mini` (하드코딩)
- API 키: 서버 환경변수 `OPENAI_API_KEY`

### Qwen (DashScope)
- 대본 생성 선택 가능
- API 키 메타데이터 키: `qwen_api_key`
- 모델 ID 패턴: `qwen-*`
- 엔드포인트: `dashscope-intl.aliyuncs.com`

## 모델 라우팅 패턴
```typescript
const isClaude = model.startsWith('claude');
const isQwen = model.startsWith('qwen');
// 나머지는 Gemini
```

## 이미지/영상 생성 모델
- fal.ai: 이미지 생성 (`lib/fal-image.ts`)
- MiniMax: 영상 생성 (`lib/minimax-video.ts`)
- Kling: 영상 생성 (`lib/kling.ts`)

## TTS 모델
- ElevenLabs (`lib/elevenlabs.ts`)
- MiniMax TTS (`lib/minimax-tts.ts`)
- Qwen TTS (`lib/qwen-tts.ts`)
