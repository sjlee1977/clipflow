# ClipFlow — Claude Code 가이드

## 프로젝트
YouTube 크리에이터를 위한 AI 올인원 플랫폼.
Next.js 14 (App Router) + Supabase + 다중 AI API.

## 먼저 읽을 것
- [AGENTS.md](AGENTS.md) — AI 에이전트 진입점 (작업 유형별 참조 맵)
- [ARCHITECTURE.md](ARCHITECTURE.md) — 도메인 구조, 레이어 규칙, API 매핑

## 문서 지도
| 필요한 것 | 파일 |
|----------|------|
| 제품 철학/방향 | [docs/PRODUCT_SENSE.md](docs/PRODUCT_SENSE.md) |
| 현재 작업/계획 | [docs/PLANS.md](docs/PLANS.md) |
| 기술 부채 | [docs/exec-plans/tech-debt-tracker.md](docs/exec-plans/tech-debt-tracker.md) |
| UI/디자인 규칙 | [docs/DESIGN.md](docs/DESIGN.md) |
| 프론트엔드 규칙 | [docs/FRONTEND.md](docs/FRONTEND.md) |
| 보안 규칙 | [docs/SECURITY.md](docs/SECURITY.md) |
| 안정성/에러처리 | [docs/RELIABILITY.md](docs/RELIABILITY.md) |
| 품질 등급 | [docs/QUALITY_SCORE.md](docs/QUALITY_SCORE.md) |
| AI 모델 목록 | [docs/references/ai-models.md](docs/references/ai-models.md) |
| 아키텍처 신념 | [docs/design-docs/core-beliefs.md](docs/design-docs/core-beliefs.md) |
| 블로그 AI 원칙 | [wiki/index.md](wiki/index.md) |
| 대본 AI 원칙 | [wiki/script/index.md](wiki/script/index.md) |

## 핵심 규칙 (3가지)
1. `.env` 커밋 금지 / API 키 출력 금지
2. 에이전트가 볼 수 없는 것은 존재하지 않는다 — 모든 결정은 이 리포지터리에 기록
3. wiki 파일 우선 → 없으면 코드 폴백 (wiki/script/, wiki/blog/ 참조)
