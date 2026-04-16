# ClipFlow — Claude Code 가이드

## 프로젝트
YouTube 크리에이터를 위한 AI 올인원 플랫폼.
Next.js 14 (App Router) + Supabase + 다중 AI API.

## 새 대화 시작 시 — Startup Protocol

**새 대화의 첫 번째 응답 전, 단 한 번만 실행한다.**

### 1단계: wiki/index.md 읽기
`wiki/index.md`를 읽는다. 이것만으로 전체 위키 구조를 파악한다.

### 2단계: 현황 자동 보고
아래 항목을 계산해 **첫 응답 앞에** 한 블록으로 출력한다:

```
📋 위키 현황 (YYYY-MM-DD)
만료 임박(7일 이내): 파일명 — D일 후  |  없음
만료 완료:          파일명 — D일 초과  |  없음
volatile:           파일명             |  없음
충돌 마커:          파일A ↔ 파일B      |  없음
```

계산법: 각 파일 프론트매터의 `updated + ttl(일)` — 오늘 날짜 = 잔여일.
오늘 날짜는 시스템 메시지 `currentDate`에서 읽는다.

### 3단계: 선택적 파일 로드
wiki/index.md의 **"작업별 필수 파일"** 표에서 현재 요청 작업에 해당하는 파일만 읽는다.
모든 wiki 파일을 한꺼번에 읽지 않는다.

---

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

## 핵심 규칙 (5가지)
1. `.env` 커밋 금지 / API 키 출력 금지
2. 에이전트가 볼 수 없는 것은 존재하지 않는다 — 모든 결정은 이 리포지터리에 기록
3. wiki 파일 우선 → 없으면 코드 폴백 (wiki/script/, wiki/blog/ 참조)
4. `git checkout`, `git reset --hard`, `git restore` 등 working tree를 덮어쓰는 명령은 실행 전 반드시 `git status`로 미커밋 변경 확인 후 사용자 명시적 동의를 받을 것
5. "X만 바꿔줘" 요청은 X만 수정 — 요청 범위를 벗어난 변경은 먼저 설명하고 동의를 받은 후 진행
