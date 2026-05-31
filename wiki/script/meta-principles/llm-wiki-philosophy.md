---
updated: 2026-05-31
ttl: 365
source: ConGen 채널 3편·4편 (2026-04-07, 2026-04-16)
권위: 안드레이 카르파시 (Tesla AI · OpenAI 공동창업자) — 270만 read
---

# LLM 위키 철학

## 한 줄 정리

> **"AI를 대화 도구가 아니라, 지식 관리 도구로 써라."**
> — 안드레이 카르파시

[원문 gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)

---

## 핵심 통찰 4가지

### 1. 대화는 사라지고, 위키는 남는다

| 대화형 AI (ChatGPT 등) | LLM 위키 |
|---|---|
| 물어보고 답 받고 끝 | 자료 던지면 영구 보존 |
| 다음 날 같은 질문 또 | 위키 참조 → 일관성 |
| 컨텍스트 매번 0부터 | 누적 지식 위에서 시작 |

### 2. 사서 vs 비서

| 노트북 LM (사서형) | LLM 위키 (비서형) |
|---|---|
| 사용자 물어보면 → 답 | 자료 던지면 → **알아서 정리** |
| 독립적 문서 | 자동으로 기존 지식과 연결 |
| 인덱싱·검색 | 능동적 합성·요약 |

### 3. 쓸수록 똑똑해지는 복리 구조

- 위키 10개 → 결과물 "괜찮음"
- 위키 40개 → **차원이 다름**
- 위키 80~150개 → 사용자 voice 완전 학습

→ **누적 = 자동 품질 향상.** 별도 학습·재훈련 없이.

### 4. 사람은 읽고, AI는 정리한다

- 사람: 읽기, 결정, 방향 설정 (편집장)
- AI: 정리, 합성, 누적 (기자)

→ "지루한 정리 작업"을 AI에 맡기고 사용자는 결정에만 집중.

---

## ClipFlow 적용

### 이미 구현됨
- `wiki/script/{economy,psychology,horror,health,history,general}/` — 6 카테고리
- 각 카테고리 4파일 (identity, tone, stage-notes, principles)
- `feedback/{category}/YYYY-MM-DD.md` — 누적 학습
- `CLAUDE.md` Startup Protocol — 새 대화마다 위키 현황 보고

### 추가 적립 대상 (이 폴더)
- meta-principles/ — LLM 위키 철학 자체 (이 파일)
- global-principles/ — 전역 5대 원칙 (카테고리 무관)
- styles/ — 17 스타일·캐릭터 시스템
- pipeline/ — 6단계 영상 생성 흐름

---

## dailyget·haruzine 검증

| 위키 영역 | dailyget 현황 | 영상 권유와 비교 |
|---|---|---|
| sources | 56편 | 80편 권장 — **근접** |
| concepts·entities·claims | 다수 | 40편 권장 — **충족** |
| writing-principles | 다수 | 40 원칙 권장 — **충족** |
| feedback (reviews) | 45편 | 누적형 — ✅ |
| 셀프 검수 | 5축 + stage2 + 132 tests | "AI 셀프 검수" — ✅ |

→ **dailyget는 이미 카르파시 권장 수준 달성.** ClipFlow도 같은 패턴으로.

---

## 참조

- 영상 3편: "모든 대본을 자동화 할 수 있는 방법" (2026-04-07)
- 영상 4편: "상위 0.1프로만 쓰는 AI 가장 똑똑하게 쓰는 방법" (2026-04-16)
- 카르파시 원본 gist
