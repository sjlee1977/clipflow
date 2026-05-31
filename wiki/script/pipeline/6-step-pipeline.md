---
updated: 2026-05-31
ttl: 365
source: ConGen 채널 2편 (2026-03-27) — ConGen 6단계 파이프라인
---

# 6단계 영상 생성 파이프라인

> ConGen의 핵심 흐름. ClipFlow에 거의 그대로 적용.

---

## 6단계

```
[사용자 입력]
주제 1줄
       ↓
Step 1: 대본 (Script)
       ↓
Step 2: 음성 (Voice / TTS)
       ↓
Step 3: 이미지 (Image)
       ↓
Step 4: 영상 합성 (Video Composition)
       ↓
Step 5: 자막·BGM (Subtitle · BGM)
       ↓
Step 6: 최종 렌더 (Final Render)
       ↓
[결과물]
완성 영상 (.mp4)
```

---

## 각 단계 상세

### Step 1 — 대본 생성
| 항목 | 내용 |
|---|---|
| 입력 | 주제 1줄 + 카테고리 + 사용자 voice (위키 참조) |
| AI 모델 | Gemini · Claude · GPT (BYOK) |
| 위키 inject | `wiki/script/{cat}/identity.md` + `tone.md` + `principles.md` + 5 원칙 |
| 출력 | 텍스트 대본 (씬별 분리) |
| 평균 시간 | 10~30초 |

### Step 2 — 음성
| 항목 | 내용 |
|---|---|
| 입력 | Step 1 대본 + 캐릭터 voice ID |
| 도구 | ElevenLabs · Google TTS · OpenAI TTS |
| 출력 | 씬별 mp3 |
| 평균 시간 | 30초~1분 |

### Step 3 — 이미지
| 항목 | 내용 |
|---|---|
| 입력 | 씬별 대본 + 스타일 |
| 도구 | Fal AI · Gemini · DALL-E |
| 출력 | 씬당 이미지 1~3장 |
| 평균 시간 | 30초~1분 |

### Step 4 — 영상 합성
| 항목 | 내용 |
|---|---|
| 입력 | Step 2 음성 + Step 3 이미지 |
| 도구 | **Remotion** (React 기반) |
| 처리 | 이미지 → 모션 + 음성 동기화 |
| 평균 시간 | 1~3분 |

### Step 5 — 자막·BGM
| 항목 | 내용 |
|---|---|
| 입력 | Step 1 대본 + 음성 타이밍 |
| 처리 | 자막 오버레이 + 카테고리 BGM 선택 |
| 평균 시간 | 10~30초 |

### Step 6 — 최종 렌더
| 항목 | 내용 |
|---|---|
| 처리 | Remotion 최종 렌더 → mp4 |
| 저장 | R2 (Cloudflare R2 — egress 무료) |
| 평균 시간 | 1~3분 |

---

## 총 소요 시간

| 영상 길이 | 총 시간 |
|---|---|
| 30초 | **약 3~5분** |
| 1분 | 5~8분 |
| 3분 | 10~15분 |
| 5분 | 15~25분 |

→ ClipFlow v1 = 30초 영상 (3~5분 처리) 우선.

---

## API 키 3개만 (ConGen 모델)

| 키 | 용도 | 무료 한도 |
|---|---|---|
| **Gemini** | 대본·이미지 | 매우 후함 |
| **ElevenLabs** | TTS | 월 10,000자 |
| **Fal AI** | 이미지 | $0.001/이미지 |

→ ClipFlow BYOK 모델과 일치. 사용자가 본인 키 등록.

---

## ClipFlow 구현 매핑

| Step | ClipFlow API |
|---|---|
| 1 | `src/app/api/generate-script-agent/route.ts` |
| 2 | `src/app/api/preview-speech/route.ts` (확장 필요) |
| 3 | `src/app/api/regenerate-image/route.ts` |
| 4 | `src/app/api/animate-scene/route.ts` |
| 5 | `src/app/api/generate-video/route.ts` |
| 6 | `src/app/api/get-render-status/route.ts` (폴링) |

→ **모두 구현 존재. Phase 2에서 안 지움.** 다음 작업 = 통합 UX (사용자가 한 줄 누르면 6 Step 자동).

---

## 진행 표시 (DESIGN.md v2 반영)

각 Step별 진행 표시:
```
[Step 1/6 — 대본 작성 중]    orbit (3 dots)
[Step 2/6 — 음성 합성 중]    pulse-ring
[Step 3/6 — 이미지 생성 중]  scanline bar
[Step 4/6 — 영상 합성 중]    progress %
[Step 5/6 — 자막 + BGM]      progress %
[Step 6/6 — 최종 렌더 중]    progress % + 예상 남은 시간
[완료]                       fade-in 미리보기
```

→ DESIGN.md v2 §5 "상호작용 패턴" 그대로 적용.

---

## 영상 시점 (2편)

- 0:55 "6-Step Pipeline" 챕터 시작
- 1:05 Step 1 (이미지 모델)
- 3:30 Steps 2~6 시연
