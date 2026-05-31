# 대본 생성 위키 — 목차

> 2026-05-31 갱신: ConGen 채널 4부작 인사이트 적립 (meta-principles, global-principles, styles, pipeline).
> 카르파시 LLM 위키 철학 + 5대 원칙 + 17 스타일·캐릭터 + 6단계 파이프라인.

---

## 1. 메타 원칙 (LLM 위키 철학 자체)
> 카르파시 (Tesla AI · OpenAI 공창) 270만 read 글의 적용.

| 파일 | 내용 |
|---|---|
| `meta-principles/llm-wiki-philosophy.md` | "AI를 대화 도구가 아니라 지식 관리 도구로" — 4가지 핵심 통찰 |
| `meta-principles/librarian-vs-secretary.md` | 사서형 vs 비서형 — ClipFlow 차별점 |

## 2. 전역 원칙 (카테고리 무관)

| 파일 | 내용 |
|---|---|
| `global-principles/5-principles.md` | ConGen 1편의 5대 원칙 (적은 원칙 > 많은 규칙 등) |

## 3. 스타일·캐릭터 시스템

| 파일 | 내용 |
|---|---|
| `styles/17-styles-and-characters.md` | 17 스타일 후보 + 캐릭터 시스템 + v1 권장 (5스타일 × 3캐릭터 = 90 조합) |

## 4. 6단계 파이프라인

| 파일 | 내용 |
|---|---|
| `pipeline/6-step-pipeline.md` | 주제→대본→음성→이미지→영상→자막·BGM→렌더. ClipFlow API 매핑 포함 |

---

## 5. 공유 구조

| 파일 | 내용 |
|---|---|
| `_shared/7-stage-structure.md` | 기본 7단계 대본 구조 (경제·일반 카테고리 기본값) |

---

## 6. 카테고리별 원칙

| 카테고리 | 정체성 | 톤 | 전용 프롬프트 | 단계 적응 | 원칙 |
|---|---|---|---|---|---|
| economy | economy/identity.md | economy/tone.md | — | economy/stage-notes.md | economy/principles.md |
| psychology | psychology/identity.md | psychology/tone.md | psychology/full-prompt.md | — | psychology/principles.md |
| horror | horror/identity.md | horror/tone.md | — | horror/stage-notes.md | horror/principles.md |
| health | health/identity.md | health/tone.md | — | health/stage-notes.md | health/principles.md |
| history | history/identity.md | history/tone.md | — | history/stage-notes.md | history/principles.md |
| general | general/identity.md | general/tone.md | — | — | general/principles.md |

---

## 7. 글쓰기 보조

| 파일 | 내용 |
|---|---|
| `ai-script-pipeline-guide.md` | 전체 파이프라인 가이드 (시스템 흐름) |
| `cta-writing.md` | 콜투액션 작성 |
| `emotional-flow.md` | 감정 흐름 설계 |
| `hook-writing.md` | 첫 3초 후크 |
| `narrative-techniques.md` | 내러티브 기법 |
| `writer-persona.md` | 글쓰는 사람 페르소나 |
| `evaluation-rubric.md` | 평가 루브릭 |
| `multi-agent-roles.md` | 멀티 에이전트 역할 |

---

## 8. 피드백 (누적 학습)

- `feedback/{category}/YYYY-MM-DD.md` — 카테고리별 최신 피드백 (가장 최신 파일 자동 로드)

---

## 9. 작업별 필수 파일 — Selective Loading Guide

> AI는 이 표에서 현재 작업에 해당하는 파일만 읽는다.

| 작업 유형 | 읽을 파일 (이것만) |
|---|---|
| 대본 초고 작성 (카테고리 X) | `{category}/identity.md` + `{category}/tone.md` + `{category}/principles.md` + 최신 피드백 |
| 전역 원칙 적용 | `global-principles/5-principles.md` |
| 스타일·캐릭터 결정 | `styles/17-styles-and-characters.md` |
| 영상 6단계 흐름 이해 | `pipeline/6-step-pipeline.md` |
| 위키 시스템 자체 점검 | `meta-principles/llm-wiki-philosophy.md` + `librarian-vs-secretary.md` |
| 평가·채점 | `evaluation-rubric.md` |
| 후크·CTA·감정 | 해당 보조 파일 1~2개 |

**여러 작업 겹칠 때**: 최대 5개 파일. 가장 관련성 높은 것 우선.

---

## 10. 운영 규칙

1. 파일이 존재하면 → 위키 파일 사용
2. 파일이 없으면 → 코드 내 하드코딩 폴백 사용
3. 원칙 파일은 시스템 프롬프트 마지막에 추가로 삽입
4. 피드백 파일은 "반드시 반영" 섹션으로 삽입
5. 전역 원칙(global-principles)은 항상 적용 (카테고리 무관)
6. 스타일·캐릭터는 사용자 선택 시에만 inject

---

## 11. 출처 권위

- **카르파시 LLM 위키**: <https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f>
- **ConGen 채널** (Ai-Con Lab): 1편 (5원칙) · 2편 (ConGen 출시) · 3편 (LLM 위키 이론) · 4편 (LLM 위키 실습)

---

*마지막 갱신: 2026-05-31. 다음 갱신: 새 영상 인사이트 발견 시.*
