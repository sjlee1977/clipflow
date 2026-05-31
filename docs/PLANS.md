# ClipFlow — 현재 계획 (2026-05-31 v2)

→ 진행 중인 작업: [exec-plans/active/](exec-plans/active/)
→ 기술 부채: [exec-plans/tech-debt-tracker.md](exec-plans/tech-debt-tracker.md)

## 정체성 (최신)

> **v1 = 형님 본인 도구** (PRODUCT_SENSE.md v3). SaaS 아님.
> dailyget·haruzine 글 → ClipFlow 영상화 도구로 본인 활용.
> v2 SaaS 출시 = 형님 영상 누적 300편+ 검증 후.

상세: [PRODUCT_SENSE.md](PRODUCT_SENSE.md) · [USER_JOURNEY.md](USER_JOURNEY.md) · [DESIGN.md](DESIGN.md)

---

## Phase 0~3 완료 (2026-05-31)

### Phase 0 — 정체성 워크숍 ✅
- 7개 질문 (타깃·고통·결과·제외·가격·퀄리티·1년목표) 결정
- PRODUCT_SENSE.md v2 → v3 (본인 도구 정체성 추가)
- v1 = Railway·Remotion 무료·R2 저장만 = **월 1만원 인프라**

### Phase 1 — 사용자 여정 ✅
- USER_JOURNEY.md 작성
- 23 페이지 → **8 페이지** 다이어트 청사진

### Phase 2 — 코드 정리 (실행) ✅
- 블로그·SEO·미디어허브 통째 제거 = **-24,310 lines / -61 files**
- API 라우트 100+ → 정리 (commit `37c97dc` → push)
- 빌드 통과 + .env.local placeholder (UI 검토용)

### Phase 3 — 청사진 (위키) ✅
- ConGen 채널 4부작 인사이트 적립 (commit `2310959`)
  - `wiki/script/meta-principles/` (LLM 위키 철학 + 사서 vs 비서)
  - `wiki/script/global-principles/` (5대 원칙)
  - `wiki/script/styles/` (17 스타일·캐릭터 시스템)
  - `wiki/script/pipeline/` (6단계 영상 생성)
- DESIGN.md v2 (Anthropic Claude Design + 5대 원칙)
- 전역 `harness-design` 스킬 신설 (~/.claude/skills/)

---

## 다음 작업 후보

### 인프라 결정 (보류 중)
- [ ] Supabase 위치 결정:
  - 옵션 A: NAS PocketBase 이주 (Supabase 한도 양보, 1~2시간)
  - 옵션 B: Supabase 유지 + Keep-alive cron (5분)
  - **현재 상태**: ClipFlow Supabase paused (활성 한도 2개를 LogBlock·GainSpot 차지)

### UI/UX 실전 (Phase 3 실행)
- [ ] `/dashboard/new` 시안 (harness-design 발동) — 핵심 화면 설계
- [ ] `/dashboard/library` 시안
- [ ] `/dashboard/auto` 시안 (YouTube OAuth 토글)
- [ ] `/dashboard` 홈 (오늘 만들 영상 한 줄)

### 위키 강화
- [ ] `wiki/script/feedback/` 실제 피드백 파일 축적 시작 (영상 1편 만들 때마다)
- [ ] `wiki/script/styles/style-presets/` 개별 스타일 마크다운 (5~7개로 시작)
- [ ] `wiki/script/styles/characters/` 캐릭터 정의 (3개로 시작)

### 영상 생성 통합
- [ ] 6단계 파이프라인 UI 연결 (대본→음성→이미지→영상→자막→렌더)
- [ ] BYOK 키 등록 UI (Gemini·ElevenLabs·Fal AI)
- [ ] R2 저장 통합 (영상 1편 완성 후 자동 업로드)
- [ ] Remotion Player 통합 (실시간 미리보기)

### 검증·품질
- [ ] QUALITY_SCORE.md 등급 개선
- [ ] AI 셀프 검수 게이트 (dailyget 5축 reader review 패턴 차용)
- [ ] 모바일 UI 최적화 (DESIGN.md v2 §3 타이포 기준)

---

## v1 → v2 전환 조건

다음 중 둘 이상 충족 시 v2 (SaaS) 출시 검토:
- [ ] 형님 영상 누적 **300편+** 발행 (시스템 검증)
- [ ] 외부 친구·지인 **5명+** 사용 요청
- [ ] dailyget·haruzine 영상 채널 구독 **1,000명+**
- [ ] Remotion Automators 라이선스 ($100/월) 부담 정당화할 매출 가설 확정

→ v1 단계 = 매출 0원 OK · 형님 본인 검증 우선.

---

## 외부 의존성·자산 (2026-05-31 기준)

| 자산 | 상태 |
|---|---|
| Railway 호스팅 | 설정 보존 (SSE·LLM 60초 필수, 변경 X) |
| Cloudflare R2 | 사용 예정 (영상 저장, egress 무료) |
| Supabase ClipFlow 프로젝트 | paused (활성 한도 차서) |
| Lambda + Remotion | 영상 렌더 (v1 본인 사용 = 무료 라이선스) |
| BYOK (Anthropic·Gemini·OpenAI·ElevenLabs·Fal) | 사용자 본인 키 (현재 = 형님 본인) |

---

*마지막 갱신: 2026-05-31. v1: 2026-04 (이전 버전 — 5월 31일 본격 재정비).*
