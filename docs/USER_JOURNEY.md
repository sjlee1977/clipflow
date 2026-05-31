# ClipFlow — 사용자 여정 (Phase 1, 2026-05-31)

> 이 문서는 PRODUCT_SENSE.md v2의 한 문장을 한 줄기 흐름으로 풀어낸 것.
> 모든 UI·API·DB 결정은 이 여정의 마찰을 줄이는 방향으로만 한다.

---

## 0. Happy Path (한 줄 요약)

**랜딩 → 30초 가입 → 첫 영상 1편 (3분 내) → 자동화 셋업 → 매일 자동 발행**

→ 사용자가 ClipFlow를 처음 만나서 "**아 이거 진짜 되네**" 느끼는 데 **5분 이내**.

---

## 1. 단계별 흐름 (Marketing-Psychology 적용)

| # | 단계 | 페이지 | 사용자가 보는 것 | 심리 작동 | 마찰 제거 |
|---|---|---|---|---|---|
| 1 | **인지** | `/` (랜딩) | 30초 데모 영상 + "주제 한 줄만 던져보세요" | 호기심 + 즉시성 | 회원가입 강요 없음. **데모는 가입 전 시청** |
| 2 | **체험 유도** | `/` (랜딩 하단) | 텍스트 박스 "오늘 뭐 만들고 싶으세요?" + 예시 5개 | 작은 약속 (commitment) | 가입 전에 30초 영상 미리보기 가능 |
| 3 | **가입** | `/login` | 카카오/구글 1클릭 | 진입 장벽 0 | 이메일·비번 X. 약관 동의 1개로 통합 |
| 4 | **첫 영상** | `/dashboard/new` | 주제 입력 → 진행 바 (대본 → 영상 → 썸네일) | 즉각적 보상 | 결제 정보 묻지 않음. 무료 영상 1편 즉시 |
| 5 | **결과 만끽 (Aha moment)** | `/dashboard/preview/[id]` | 완성 영상 재생 + "이거 진짜 자동인데?" | 놀라움 + 자랑하고 싶음 | 다운로드·공유 즉시. 워터마크 작게 |
| 6 | **자동화 셋업** | `/dashboard/auto` | 채널 연결 + "매일 새벽 자동 업로드 켜기" 토글 | 미래 자동화 약속 | YouTube OAuth 1클릭. 일정 입력 안 시킴 (기본 오전 7시) |
| 7 | **첫 자동 발행** | (백그라운드) | 다음날 아침 푸시 알림 "어제 만든 영상 업로드 완료" | 약속 이행 = 신뢰 | 사용자 개입 0 |
| 8 | **유료 전환 시점** | `/dashboard/billing` | 무료 한도 도달 시 "무제한 월 X원" 카드 | 손실 회피 + 가격 정당화 | 카카오페이·신용카드 1클릭. 환불 7일 |
| 9 | **재방문 루프** | `/dashboard/library` | 누적 영상 + 통계 + "다음 주제 추천" | 진척 시각화 | 마지막 본 곳에서 시작 |

---

## 2. 페이지 구조 (현재 23개 → 8개로 다이어트)

### 유지 (8개)

| 경로 | 역할 | 우선순위 |
|---|---|---|
| `/` | 랜딩 (마케팅 + 데모) | ★★★★★ |
| `/login` | 가입·로그인 (카카오·구글) | ★★★★★ |
| `/dashboard` | 홈 (요약·다음 작업 추천) | ★★★★★ |
| `/dashboard/new` | **새 영상 만들기 (핵심 화면)** | ★★★★★ |
| `/dashboard/library` | 내 영상 (히스토리·재생·재발행) | ★★★★ |
| `/dashboard/auto` | 자동화 셋업 (채널·스케줄) | ★★★★ |
| `/dashboard/billing` | 구독·결제 | ★★★ |
| `/dashboard/settings` | 계정 설정 (최소화) | ★★ |

### 제거 (15개 — Phase 2에서 통째)

| 경로 | 사유 |
|---|---|
| `/dashboard/admin` | 관리자용 — 출시 후 별도 |
| `/dashboard/auto-blog` | 블로그 자동화 (dailyget이 함) |
| `/dashboard/blog` | 블로그 (제외) |
| `/dashboard/calendar` | 너무 복잡, /auto에 통합 |
| `/dashboard/carousel` | 카드뉴스 (출시 후) |
| `/dashboard/carousel-studio` | 위 동일 |
| `/dashboard/competitor` | SEO 분석 (제외) |
| `/dashboard/history` | /library와 중복 |
| `/dashboard/keyword` | SEO (제외) |
| `/dashboard/media-hub` | 부가 기능 (제외) |
| `/dashboard/my-channel` | /auto에 통합 |
| `/dashboard/my-scripts` | /library에 통합 |
| `/dashboard/prompt` | 개발자용 (제외) |
| `/dashboard/reformat` | 부가 기능 (제외) |
| `/dashboard/script` | /new에 통합 |
| `/dashboard/thumbnail` | /new에 통합 |
| `/dashboard/trends/comments` | SEO 분석 (제외) |
| `/dashboard/trends/outliers` | 위 동일 |
| `/dashboard/trends/subscriber` | 위 동일 |
| `/dashboard/trends/viral` | 위 동일 |
| `/dashboard/video` | /preview/[id]에 통합 |

→ **23개 → 8개 (-65%)**. 사용자가 길을 잃지 않음.

---

## 3. 첫 영상 5분 안에 — 마찰 0 설계

| 마찰점 | 없애는 방법 |
|---|---|
| 결제 정보 입력 | 무료 한도 안에서는 안 물음 |
| 채널 연결 | 첫 영상에는 필요 없음 (다운로드만 가능). 자동화 토글 누를 때 OAuth |
| 영상 스타일 선택 | 첫 영상은 "기본 스타일" 자동. 두 번째부터 옵션 |
| 자막 위치·폰트 선택 | 기본 자동. "더보기" 안 누르면 안 보임 |
| 길이 선택 | 첫 영상 30초 고정. 두 번째부터 1분·3분·5분 |

→ **"형님이 처음 써본다"는 가정**으로 모든 화면 검토. 클릭 한 번 더 시키면 사용자 90%가 떠남.

---

## 4. API 매핑 (Phase 2에서 살릴 핵심)

| 페이지 | 필요 API | 현재 코드 |
|---|---|---|
| `/dashboard/new` | `analyze-script` → `generate-script-agent` → `generate-scenes` → `generate-video` → `thumbnail` → `save-video` | 모두 있음 ✅ |
| `/dashboard/library` | `delete-video` + Supabase 조회 | 있음 |
| `/dashboard/auto` | `cron-publish` (영상용 신설) | 신규 (blog/cron-publish 패턴 차용 가능) |
| `/dashboard/billing` | Supabase + 카카오페이/스트라이프 webhook | 신규 |
| 인프라 | `notify/*` + `download/*` | 있음 |

→ **77 API → 20개 이내**로 갈 수 있는 청사진. Phase 2에서 실제 git rm.

---

## 5. Aha Moment 검증 (출시 후 핵심 KPI)

| 지표 | 목표 |
|---|---|
| 가입 → 첫 영상 완성 시간 | **5분 이내 (80% 사용자)** |
| 첫 영상 완성 → 자동화 토글 ON | **30% 이상** |
| 자동화 ON → 7일 유지 | **50% 이상** |
| 무료 한도 도달 → 유료 전환 | **5~10%** (Freemium 벤치마크) |

→ 출시 후 매주 이 4개만 본다. 다른 지표는 부차적.

---

## 6. 의도적으로 안 한 것 (이번 여정에서)

- ❌ **소셜 공유 기능** — 첫 영상이 끝장나면 사용자가 알아서 자랑함
- ❌ **A/B 테스트** — 사용자 100명까진 데이터 부족, 직감으로
- ❌ **AI 모델 선택 UI** — Sonnet·Gemini 자동 라우팅, 사용자 신경 안 씀
- ❌ **다국어 UI** — v1은 한국어만
- ❌ **모바일 앱** — v1은 모바일 웹만 (반응형)

---

## 7. 다음 단계 (Phase 2)

이 여정에 안 들어가는 모든 코드 = 제거 대상.
- API 33개 통째 제거 (블로그·SEO·미디어허브)
- Dashboard 페이지 15개 제거
- wiki/ 폴더의 블로그 영역 (`wiki/blog/`, `wiki/index.md` 등) 제거
- 관련 의존성 패키지 제거 (`@mozilla/readability` 등)

→ **다음 메시지에서 Phase 2 실제 git rm 시작.**

---

*마지막 갱신: 2026-05-31. 다음 갱신: Phase 2 정리 완료 시.*
