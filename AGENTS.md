# ClipFlow — Agent Guide

## 이 리포지터리란
YouTube 크리에이터를 위한 AI 올인원 플랫폼.
대본 생성 → 영상 제작 → 블로그 발행까지 자동화.

## 시작 전 반드시 읽을 것
- [ARCHITECTURE.md](ARCHITECTURE.md) — 도메인 구조와 레이어 맵
- [docs/PLANS.md](docs/PLANS.md) — 현재 진행 중인 작업
- [docs/PRODUCT_SENSE.md](docs/PRODUCT_SENSE.md) — 제품 철학과 핵심 신념

## 작업 유형별 참조

| 작업 | 참조 파일 |
|------|---------|
| 새 기능 구현 | [docs/product-specs/index.md](docs/product-specs/index.md) |
| API 라우트 수정 | [ARCHITECTURE.md](ARCHITECTURE.md) → API 섹션 |
| AI 프롬프트 개선 | [wiki/script/](wiki/script/) 또는 [wiki/blog/](wiki/blog/) |
| UI/스타일 변경 | [docs/FRONTEND.md](docs/FRONTEND.md), [docs/DESIGN.md](docs/DESIGN.md) |
| 보안/인증 관련 | [docs/SECURITY.md](docs/SECURITY.md) |
| 성능/안정성 | [docs/RELIABILITY.md](docs/RELIABILITY.md) |
| 기술 부채 확인 | [docs/exec-plans/tech-debt-tracker.md](docs/exec-plans/tech-debt-tracker.md) |

## 커스텀 에이전트

| 에이전트 | 호출 방법 | 역할 |
|---------|----------|------|
| `quality-check` | "quality-check 에이전트 실행" 또는 코드 정리 요청 | 중복 제거, 문서-코드 일치화, dead code 탐지, 코드 스타일 점검 |

## 절대 규칙
- `.env` 파일 절대 수정/커밋 금지
- API 키 등 민감한 값 출력 금지
- 사용자 API 키는 Supabase `user_metadata`에만 저장
- AI 모델 규칙: [docs/references/ai-models.md](docs/references/ai-models.md) 참조

## 컨텍스트가 없는 것은 존재하지 않는다
Google Docs, Slack, 구두 합의에만 있는 결정은 이 리포지터리에서 접근 불가.
아키텍처 결정, 제품 방향, 팀 규칙은 반드시 `docs/`에 기록되어야 효력이 있다.
