# ClipFlow — 디자인 시스템 (v2, 2026-05-31)

> v1 → v2 재작성 배경: PRODUCT_SENSE.md v2 정체성 확정 + Anthropic Claude Design 시스템
> 프롬프트 학습 (참고: `docs/references/anthropic-claude-design-prompt.md`).
> v1은 SidebarScripts·prompt page 등 Phase 2에서 삭제된 컴포넌트 참조 多 → `docs/DESIGN.v1-2026.md` 보관.

---

## 0. 한 줄 디자인 철학

> **"유튜브 시작 못한 50대 비개발자도 1분 만에 첫 영상 만들 수 있게.
> 화면은 적게, 결정은 더 적게, 결과는 즉시."**

(PRODUCT_SENSE.md 한 줄 정체성에서 도출)

---

## 1. 5대 원칙 (Claude Design 인용 + ClipFlow 적용)

| # | 원칙 | ClipFlow 적용 |
|---|---|---|
| 1 | **맥락 중심** | 영상 도구라 일반 SaaS 트렌드 회피. 영상 미리보기·재생이 메인 |
| 2 | **자산 기반 설계** | Vrew·VLLO·Pictory·ConGen UI 화면 학습 후 변형. shadcn/ui base |
| 3 | **질문 우선** | UI 결정 전 10개 질문 (사용자 직업·디바이스·화면 흐름·시각 변형) |
| 4 | **최소주의** | 더미 텍스트·통계·아이콘 추가 금지. 모든 요소가 정당해야 |
| 5 | **시각 어휘 일관성** | 모서리·그림자·밀도·호버·애니메이션 모든 페이지 동일 |

---

## 2. 색상 시스템

### 브랜드 팔레트
| 토큰 | hex | 용도 |
|---|---|---|
| `--accent` | `#ef4444` (red-500) | YouTube 관련 (브랜드 정합성) |
| `--success` | `#22c55e` (green-500) | 발행 완료·다운로드 가능 |
| `--warning` | `#f59e0b` (amber-500) | AI 처리 중 |
| `--info` | `#3b82f6` (blue-500) | 가이드·정보 |

### 신규 색상 = OKLCH로 조화 생성
```css
/* 예: accent 기준 보조색 */
--accent-soft: oklch(0.95 0.05 25);     /* 연한 톤 */
--accent-strong: oklch(0.5 0.18 25);    /* 짙은 톤 */
```

→ hex 직접 발명 금지. accent의 hue(25°) 유지, lightness만 변경.

### 다크/라이트
- 모든 컴포넌트 `ThemeToggle` 기반 `class="dark"` 전환 지원
- 시스템 테마 자동 감지 + 사용자 override

---

## 3. 타이포그래피

| 매체 | 최소 크기 | 폰트 |
|---|---|---|
| **데스크톱 본문** | 16px | system-ui, Pretendard (한국 가독성) |
| **모바일 본문** | 16px (가독성) | 동일 |
| **모바일 터치 타겟** | **44px ↑** (높이) | — |
| **영상 미리보기 자막** | 24px ↑ (1920×1080 기준) | — |
| **CSS 적용** | `text-wrap: pretty` | — |

→ 한국어는 영문 대비 가독성 낮음. 본문 14px 절대 금지.

---

## 4. 페이지·컴포넌트 구조

### 핵심 8 페이지 (USER_JOURNEY.md 일치)
```
/                       랜딩 (마케팅 + 가입 전 데모)
/login                  카카오·구글 1클릭
/dashboard              홈 (오늘 만들 영상 한 줄)
/dashboard/new          ★ 새 영상 (핵심 화면)
/dashboard/library      내 영상 + 통계
/dashboard/auto         채널 연결 + 자동화 토글
/dashboard/billing      구독 (v2 이후 — v1은 본인 도구라 미사용)
/dashboard/settings     계정 (최소화)
```

### 컴포넌트 패턴 (영상 도구 특화)

| 컴포넌트 | 용도 | 구현 키 |
|---|---|---|
| **VideoCard** | 영상 1편 표시 (썸네일·제목·길이·상태) | shadcn/ui Card + 16:9 ratio |
| **VideoPlayer** | 인라인 재생 + 다운로드·재발행 | Remotion Player 또는 video tag |
| **GenerateProgressBar** | 대본→이미지→영상 단계별 진행 | Step orbit + scanline + step text |
| **ToolbarButton** | 영상 액션 (다운로드·삭제·재생·업로드) | 32px height, 44px on mobile |
| **EmptyState** | "아직 영상이 없습니다" | 일러스트 + CTA 1개 |

→ shadcn/ui base. 자체 컴포넌트 신설 금지 (기존 패턴 학습 후 변형만).

---

## 5. 상호작용 패턴

### 영상 생성 진행 표시
```
[대본 생성 중...]     orbit (3 dots rotating)
[이미지 생성 중...]   pulse-ring center
[영상 렌더 중...]     scanline bar + 진행률 %
[완료!]              fade-in 영상 미리보기
```

각 단계 평균 시간 명시 (예: "이미지 생성 평균 30초"). 사용자 불안 해소.

### 애니메이션 원칙
- 기본: CSS 전환 (200~300ms)
- 진행 상태: 의미 있는 모션 (단순 spinner 금지 → 어떤 단계인지 시각화)
- 영상 자동 재생 X (사용자가 명시적으로 누름)

### 금지 사항
- `scrollIntoView()` 사용 금지 (Claude Design 인용 — 웹앱 파괴 위험)
- 자동 모달 팝업 (사용자 동의 X)
- 더미 통계 (`123 사용자가 만들었습니다` 같은 가짜)

---

## 6. 접근성 (WCAG AA 최소)

- 색상 대비 4.5:1 이상 (본문)
- 키보드만으로 모든 작업 가능 (Tab 순서 자연스럽게)
- 폼 라벨 명시
- 색상만으로 정보 전달 금지 (텍스트·아이콘 병행)
- `aria-label` 모든 아이콘 버튼

---

## 7. 카피라이팅 톤

| 영역 | 톤 |
|---|---|
| **CTA 버튼** | 동작 + 결과 ("영상 만들기 시작" not "Generate") |
| **에러 메시지** | 무엇이 잘못 / 어떻게 해결 / 사과 1개 |
| **로딩 메시지** | "AI가 대본을 쓰고 있어요... (평균 30초)" |
| **빈 상태** | 다음 행동 제안 ("주제 하나만 던져보세요") |
| **자체 칭찬 금지** | "최고의 AI 자동화!" 같은 자기과시 X |

→ 50대 비개발자에게 말 거는 톤. 단호하되 친절. 영문/외래어 회피.

---

## 8. 파일·코드 명명

| ❌ 금지 | ✅ 권장 |
|---|---|
| `script-pipeline-v2.tsx` | 의미 명확한 이름 |
| 1,000+ 줄 단일 파일 | 컴포넌트 분할 |
| `style1`, `style2` | `videoCardStyles`, `playerToolbarStyles` |

→ "기술 용어 → 사용자 언어" (Claude Design 인용)

---

## 9. PRODUCT_SENSE.md 정체성과 맞물림

| PRODUCT_SENSE 항목 | DESIGN 반영 |
|---|---|
| 타깃: 유튜브 초보 (구독 0~1만) | 모든 UI 텍스트 = 영상 편집 처음 사람 기준 |
| 핵심 가치: 30초 만에 영상 1편 | `/dashboard/new` 5분 이내 완성 가능 |
| **v1 = 본인 도구** | `/dashboard/billing` 미구현 OK |
| BYOK | `/dashboard/settings`에 키 입력 UI 명확 |
| YouTube 자동 업로드 = 선택 옵션 | `/dashboard/auto` 토글 1개 |

---

## 10. 전역 디자인 스킬과의 관계 (충돌 해소)

전역 스킬 `frontend-design` · `ui-ux-pro-max`는 **도구**.
이 DESIGN.md는 **원칙**. 충돌 시 DESIGN.md가 1순위.

### 역할 분담

| 단계 | 도구 | 무엇을 |
|---|---|---|
| 1. 원칙 검증 | `docs/DESIGN.md` | 5대 원칙·색·타이포·금지 사항 통과 여부 |
| 2. 창의 톤 자문 | `frontend-design` 스킬 | DESIGN.md 안에서 "어떻게 distinctive하게?" — 평범한 SaaS 회피 |
| 3. 컴포넌트 검색 | `ui-ux-pro-max` (shadcn/ui MCP) | shadcn 컴포넌트 중 선택 — 67 스타일 중 DESIGN.md 맞는 것만 |
| 4. 원칙 재검증 | `docs/DESIGN.md` | 스킬 결과물이 다시 통과해야 함 |

### 명시적 우선순위

| 충돌 | 결정 |
|---|---|
| 스킬 "distinctive" vs DESIGN "자산 기반" | **DESIGN 우선** — shadcn/ui base 위에서만 distinctive |
| 스킬 67 스타일 다양성 vs DESIGN OKLCH 고정 색 | **DESIGN 우선** — accent hue(25°) 안에서 67 스타일 |
| 스킬 자율 결정 vs DESIGN 10개 질문 | **DESIGN 우선** — 자율 결정 금지, 질문 후 진행 |

### 공통 통찰 (보완 관계)

세 도구 모두 **"평범한 AI UI 거부"** 공유:
- frontend-design: "avoid generic AI aesthetics"
- Claude Design (이 문서 base): "avoid web design tropes"
- ui-ux-pro-max: "creative palette·style"

→ 충돌은 방법론 차이일 뿐, 방향은 일치.

---

## 11. v3 갱신 조건

다음 중 하나 발생 시 DESIGN.md v3:
- 사용자 100명 도달 (실사용 피드백 반영)
- 카테고리 시스템 도입 (ConGen 17 스타일 적용)
- 모바일 앱 출시 (UI 새 매체)
- 다국어 지원

---

*마지막 갱신: 2026-05-31. 참고: `docs/references/anthropic-claude-design-prompt.md`.*
