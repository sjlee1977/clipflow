# Anthropic Claude Design — 시스템 프롬프트 추출 (참고용)

> 출처: ConGen 채널 5편 (2026-04-26) 영상에서 소개된 GitHub 유출본
> 원본: <https://github.com/elder-plinius/CL4R1T4S/blob/main/ANTHROPIC/Claude-Design-Sys-Prompt.txt>
> 추출일: 2026-05-31
>
> **활용**: ClipFlow `docs/DESIGN.md` v2의 base 자료. 이 파일은 원본 인용 보관용,
> 실제 적용 규칙은 DESIGN.md에 있음.

---

## 디자인 철학

> "전문가처럼 설계하되, 웹 트렌드를 피하고 매체와 맥락에 맞춘 결과물을 만든다.
> HTML은 도구일 뿐, 산출물의 형식은 다양하다."

---

## 핵심 원칙 (Principle)

| 원칙 | 원문 | 한국어 |
|---|---|---|
| **맥락 중심** | "Avoid web design tropes and conventions unless you are making a web page" | 슬라이드·영상·프로토타입은 웹 관례를 따르지 않음 |
| **자산 기반 설계** | "Good hi-fi designs do not start from scratch — they are rooted in existing design context" | 기존 UI 키트·디자인 시스템을 복사·학습하고 새로 만들지 않음 |
| **질문 우선** | "Asking many good questions is ESSENTIAL" | 설계 전 최소 10개 이상의 집중된 질문으로 요구사항 명확화 |
| **최소주의** | "Do not add filler content... Every element should earn its place" | 불필요한 더미 텍스트·아이콘·통계 제거 |
| **스케일 규칙** | "For 1920x1080 slides, text should never be smaller than 24px" | 슬라이드/모바일 각각 최소 글자 크기 준수 |
| **색상 조화** | "Try to use colors from brand / design system... if too restrictive, use oklch to define harmonious colors" | 브랜드 팔레트 우선, 필요시 OKLCH로 조화 색상 생성 |
| **접근성 실행** | "Never use 'scrollIntoView'... it can mess up the web app" | DOM 스크롤 메서드 신중함, 애니메이션은 안정적 실행 |
| **시각 어휘 일관성** | "Match copywriting style, color palette, tone, hover/click states, animation styles" | 기존 UI의 톤·색상·상호작용·밀도·그림자 패턴 일관성 유지 |

---

## 컬러 시스템

- **브랜드 팔레트 우선 사용** (기존 디자인 시스템에서 복사)
- **제한적 팔레트인 경우**: OKLCH 색공간으로 조화로운 신규 색상 정의
- **이모지**: 디자인 시스템이 사용하지 않으면 미포함
- **색상 발명 금지**: "Avoid inventing new colors from scratch"

---

## 타이포그래피

| 매체 | 최소 크기 | 규칙 |
|---|---|---|
| **슬라이드** (1920×1080) | 24px | "Text should never be smaller than 24px" |
| **모바일** | 44px (터치 타겟) | 타겟 크기 최소 규칙 |
| **인쇄물** | 12pt | 가독성 기준 |
| **CSS 적용** | `text-wrap: pretty` | 텍스트 정렬 개선 |

---

## 컴포넌트 패턴

### 기본 원칙
- "Copy needed assets from design systems; do not reference them directly"
- 대형 자산 폴더(>20파일) 일괄 복사 금지, 필요한 것만 선택 복사
- 반응형 + 레터박스 처리 (고정 크기: 1920×1080)

### 주요 패턴
| 컴포넌트 | 용도 | 구현 키 |
|---|---|---|
| **Device Frames** | iOS/Android/MacOS/Browser 목업 | `copy_starter_component` |
| **Slide Deck** | 프레젠테이션 | `deck_stage.js` — 스케일·키보드 네비·localStorage |
| **Design Canvas** | 정적 옵션 비교 | `design_canvas.jsx` — 그리드 |
| **Animations** | 타임라인 기반 | `animations.jsx` — Stage/Sprite/Easing/interpolate() |
| **React Components** | 인라인 JSX | Pinned React 18.3.1 + Babel 7.29.0 |

---

## 상호작용 패턴

### 애니메이션
- **기본**: CSS 전환 / 간단한 React 상태
- **고급**: `animations.jsx` 또는 Popmotion
- **영상형**: 재생 위치 localStorage에 저장

### 상태 관리
- **Edit Mode**: `window.postMessage()` 기반 부모 통신
- **Slide Navigation**: localStorage로 현재 위치 지속
- **Speaker Notes**: `window.postMessage({slideIndexChanged: N})` 동기화

### 스크롤
- **금지**: `scrollIntoView()` (웹앱 파괴 가능)
- **대체**: offset/position 계산 기반

---

## 접근성 · WCAG

명시 체크리스트 없음. 실행 원칙:
- 터치 타겟 최소 44px (모바일)
- 슬라이드 텍스트 최소 24px
- 스크롤 메서드 안정성 (접근성 도구 호환)
- 색상만으로 정보 전달 금지
- 반응형 필수

---

## 카피라이팅 톤

- **관례 회피**: "Avoid web design tropes"
- **일관성**: 기존 UI 톤·스타일 모방
- **간결**: "Ask before adding material"
- **정보성**: 더미 데이터 금지
- **사용자 중심**: "Provide user-centric answers about capabilities"

---

## 형식 · 구조 규칙

### 파일 명명
- 기술 용어 → 사용자 언어
  - ❌ `components.jsx`
  - ✅ `Landing Page.html`, `Onboarding Flow.html`

### 고정 크기 콘텐츠 (슬라이드·영상)
1. 기본 크기: 1920×1080 (16:9)
2. 뷰포트 적응: `transform: scale()`로 레터박싱
3. 네비게이션: 스케일 요소 **외부**에 배치
4. localStorage: 현재 위치 지속
5. 인쇄: 페이지당 1슬라이드

### React 다중 파일
- "Avoid writing large files (>1000 lines)"
- 컴포넌트 분할, 끝에서 import
- 스타일 객체 이름 충돌 방지 (`terminalStyles`, `buttonStyles` 식)
- 컴포넌트 공유: `Object.assign(window, { Comp1, Comp2 })`

---

## ClipFlow UI 즉시 활용 5가지

### 1. 기존 UI/컴포넌트 라이브러리 먼저 확보
- 디자인 시스템·UI 키트가 있다면 import
- 없다면 경쟁사/유사 제품 화면 스크린샷 수집
- "설계 전에 맥락을 모르면 좋은 디자인 불가능"

### 2. 질문으로 요구사항 잠금
- 화면 흐름·상호작용·시각 변형 개수 확인
- 톤(신규·창의적 vs. 규칙 준수)·색상·애니메이션 의도 파악
- 최소 10개 질문 + "Explore a few options" 옵션 제시

### 3. 색상은 OKLCH로 조화 생성
- ClipFlow 브랜드 팔레트 추출 (hex)
- OKLCH로 명도·채도 일관 유지하며 신규 색상 도출
- 그라데이션·배경색 공격적 사용 회피

### 4. 슬라이드/고정 크기 = 1920×1080 + 반응형 스케일
- 텍스트 최소 24px, 모바일 터치 44px
- `deck_stage.js` 또는 맞춤 스케일 요소
- 네비·컨트롤은 스케일 밖에 배치

### 5. 컴포넌트 일관성 = 시각 어휘 모방
- 모서리·그림자·밀도·호버 상태·애니메이션 스타일 일관
- 기존 UI 패턴 따르되 불필요한 요소 제거
- 아이콘·이미지는 플레이스홀더 > 형편한 시도

---

*이 자료는 ConGen 4부작 + 5편 시리즈 학습의 일부.
실제 적용 규칙은 `docs/DESIGN.md` v2 참조.*
