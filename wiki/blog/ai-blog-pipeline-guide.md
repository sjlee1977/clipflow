---
updated: 2026-04-18
ttl: 60
ttl_reason: 코드(write-multi-platform/route.ts, generate-titles/route.ts) 변경 시 동기화 필요
volatile: false
split_children:
  - file: write-pipeline-agents.md
    contains: "5. 단일 플랫폼 파이프라인 에이전트, 6. 인간 필기감 원칙, 7. 할루시네이션 탐지 원칙"
---

# AI 블로그 자동화 파이프라인 — 완전 가이드

> **문서 목적**: ClipFlow AI 블로그 작성 시스템의 모든 판단 기준, 에이전트 구성, 실제 프롬프트, 설계 근거를 기록.
> 코드가 변경될 때마다 이 문서도 함께 업데이트됨.
>
> **최종 업데이트**: 2026-04-18
> **관련 파일**:
> - `src/app/api/blog/generate-titles/route.ts` — 제목 생성
> - `src/app/api/blog/score-titles/route.ts` — 독립 채점
> - `src/app/api/blog/write-multi-platform/route.ts` — **풀 자동화 멀티플랫폼 파이프라인 (현행)**
> - `src/app/api/blog/write-pipeline/route.ts` — 단일 플랫폼 파이프라인 (레거시)
> - `src/app/api/blog/cron-publish/route.ts` — 예약 자동 발행
> - `src/app/api/blog/scheduled-posts/route.ts` — 예약 포스트 CRUD

---

## 목차

1. [전체 파이프라인 흐름](#1-전체-파이프라인-흐름)
2. [키워드 리서치 — 데이터 출처와 판단 기준](#2-키워드-리서치)
3. [SEO 제목 생성 에이전트](#3-seo-제목-생성-에이전트)
4. [독립 채점 에이전트 — 8차원 × 12.5점](#4-독립-채점-에이전트)
5. [멀티플랫폼 글쓰기 파이프라인 (현행)](#5-멀티플랫폼-글쓰기-파이프라인)
6. [플랫폼별 작성 가이드](#6-플랫폼별-작성-가이드)
7. [단일 플랫폼 파이프라인 에이전트 → **write-pipeline-agents.md**](write-pipeline-agents.md) ← 분리됨
8. [글 품질 평가 — 10차원 100점](#8-글-품질-평가)
9. [AI 모델 선택 기준](#9-ai-모델-선택-기준)
10. [설계 판단 기록 — 왜 이렇게 만들었나](#10-설계-판단-기록)
11. [참조 출처](#11-참조-출처)

---

## 1. 전체 파이프라인 흐름

> **현행 시스템**: `write-multi-platform` (3개 플랫폼 동시 생성 풀 자동화)

```
[사용자 입력]
    키워드 + 제목 선택
         │
         ▼
[Phase 1: 리서치]
    ┌─────────────────────────────────────┐
    │  네이버 광고 API  → 월간 검색량       │
    │  네이버 Open API  → 월 새글 발행량    │
    │  네이버 DataLab   → 트렌드 방향       │
    └─────────────────────────────────────┘
         │
         ▼
[Phase 2: 제목 생성]
    SEO 제목 생성 에이전트 (temp 0.8)
    → 5가지 훅 유형 × 플랫폼 원칙 → 5개 제목
         │
         ▼ (자동, 생성 완료 후 실행)
[독립 채점 에이전트] (temp 0.1)
    → 8차원 × 12.5점 = 100점
    → 네이버 / 구글 루브릭 분리
    → 등급: S / A / B / C / D
         │
         ▼
    사용자가 제목 선택 (또는 직접 입력)
         │
         ▼
[Phase 3: 멀티플랫폼 글쓰기]

    Agent 1: 리서처 (temp 0.3, 1회)
    → 5막 아웃라인 JSON (painPoint, uniqueAngle, hookType, emotionalArc, structure, keyPoints)
         │
         ▼
    Agent 2(WP): 워드프레스 작가 (temp 0.8, 1회)
    → WP 초고 생성 (팩트체크 기준 텍스트 확보)
         │
         ▼
    Agent 2.5: 팩트체커 (temp 0.1, 1회)
    → WP 초고 기반 할루시네이션 탐지
    → HIGH 위험 목록 → 이후 편집자에게 전달
         │
         ├─────────────────────────────────┐
         ▼                                 ▼
    Agent 2(Naver) (병렬)          Agent 2(Personal) (병렬)
    네이버 작가 (temp 0.8)          개인 작가 (temp 0.8)
         │                                 │
         └──────────────┬──────────────────┘
                        ▼
    Agent 3×3: 플랫폼별 편집자 (temp 0.2, 병렬)
    → Naver / WordPress / Personal 동시 편집
    → AI 패턴 제거 + 팩트체크 반영 + 플랫폼 최적화
         │
         ▼
    Agent 4: 평가자 (temp 0.2, WP 기준 1회)
    → 10차원 × 10점 = 100점 환산
    → 등급: S / A (통과) / B / C / D (재작성)
         │
         ▼ (grade B 이하 = 75점 미만, 최대 2라운드)
    Agent 5×3: 리파이너 (temp 0.5, 병렬)
    → 3개 플랫폼 약점 동시 수정
    → 재평가 → 점수 변화 기록
         │
         ▼
    이미지 생성×3 (병렬, generateImgs=true 시)
    → [IMAGE: 설명] 마커 → FLUX 이미지 URL 교체
         │
         ▼
[Phase 4: 완료 및 저장]
    DB: scheduled_posts 테이블 저장 (saveToDb=true 시)
    → naver/wordpress/personal 버전 + 평가 + 예약 시간
    응답: { naver, wordpress, personal, outline, factCheck, evaluation, steps }
```

---

## 2. 키워드 리서치

### 2-1. 데이터 소스

| 데이터 | API | 엔드포인트 |
|--------|-----|-----------|
| 월간 검색량 | 네이버 검색광고 API | `GET /api/seo/naver-volume` |
| 광고 경쟁도 | 네이버 검색광고 API | 동일 (compIdx 필드) |
| 월 새글 발행량 | 네이버 Open API (블로그) | `GET /api/seo/naver-content` |
| 트렌드 방향 | 네이버 DataLab API | `GET /api/seo/naver-trend` |
| 연관 키워드 | 네이버 검색광고 API | 동일 (results 배열) |

### 2-2. 판단 기준

**월간 검색량**
- 10건 미만: 네이버 API 정책상 `< 10` 반환 → UI 표시 `—`
- 검색량 0 또는 API 실패: 제목 생성은 계속 진행 (graceful degradation)

**광고 경쟁도 해석**
- 낮음: 경쟁 광고주가 적음 → 정보성 블로그가 상위 노출 유리
- 높음: 상업적 키워드 → 정보성 각도로 차별화하면 틈새 공략 가능

**월 새글 발행량 해석**
- 검색량 대비 발행량이 많을수록 콘텐츠 포화 → 차별화된 각도 필수
- 이 수치는 검색량이 아닌 월간 신규 블로그 포스트 수 (혼동 주의)

**트렌드 방향 계산**
- 최근 4주 평균 vs 이전 4주 평균 비교
- 상승(10% 초과 증가) / 하락(10% 초과 감소) / 보합

---

## 3. SEO 제목 생성 에이전트

**파일**: `src/app/api/blog/generate-titles/route.ts`
**Temperature**: 0.8 (창의적 다양성)
**출력**: 5개 제목 (훅 유형별 1개씩)

### 3-1. 시스템 프롬프트

```
당신은 한국 디지털 마케팅 SEO 전문가입니다.
주어진 키워드와 리서치 데이터를 바탕으로 [네이버|구글] SEO 최적화 블로그 제목 5개를 생성합니다.

[네이버 플랫폼]
네이버 SEO 원칙: 질문형·정보성·생활 밀착형, 핵심 키워드 자연스럽게 포함, 30~50자 권장

[구글 플랫폼]
구글 SEO 원칙: 제목 앞에 핵심 키워드 배치, 명확한 혜택/숫자 제시, 50~70자 권장

훅 유형 가이드:
- 질문형: "~를 알고 계신가요?", "왜 ~일까요?" — 독자의 호기심 자극
- 숫자형: "N가지 ~", "N개월 만에 ~" — 구체성과 신뢰도 확보
- 충격형: "~의 충격적 진실", "아무도 말 안 하는 ~" — 강렬한 첫 인상
- 약속형: "N분이면 ~", "~하는 방법 완전 정복" — 명확한 가치 제시
- 비교형: "~ vs ~", "~ 차이점 총정리" — 결정을 못하는 독자 공략

SEO 점수 기준 (0~100):
- 키워드 포함 여부 (+20)
- 적정 길이 준수 (+20)
- 클릭 유발 훅 강도 (+30)
- 검색 의도 매칭 (+30)
```

### 3-2. 사용자 프롬프트 구성

```
키워드: "{keyword}"
월간 검색량: {searchVolume}회          ← 있을 때만
광고 경쟁도: {competition}             ← 있을 때만
월간 신규 발행: {contentSaturation}건  ← 있을 때만
트렌드: {trendDirection}               ← 있을 때만
연관 키워드: {relatedKeywords}         ← 최대 6개

위 데이터를 활용해 클릭률 높은 [플랫폼] SEO 최적화 제목 5개를 생성하세요.

JSON 출력 형식:
{
  "titles": [
    { "title": "제목", "hookType": "질문형", "seoScore": 88, "reason": "이유 25자 이내" },
    ...
  ]
}
```

### 3-3. Fallback 처리

LLM 호출 실패 또는 빈 결과 시, 키워드 기반 기본 5개 제목 자동 반환:
```
약속형: "{keyword} 완벽 정리 — 핵심만 골라 드립니다"
숫자형: "{keyword}이란? 쉽게 이해하는 5가지 포인트"
충격형: "아직도 {keyword} 헷갈리세요? 3분 정리"
약속형: "{keyword} 신청 방법 A to Z 완전 가이드"
비교형: "{keyword} vs 차상위계층 차이점 총정리"
```

---

## 4. 독립 채점 에이전트

**파일**: `src/app/api/blog/score-titles/route.ts`
**Temperature**: 0.1 (최대 일관성)
**설계 원칙**: 생성 에이전트와 완전 분리 → 자기채점 편향 제거

### 왜 독립 에이전트인가

같은 모델이 생성하고 채점하면 자신의 결과물에 관대해진다.
실제 테스트에서 자기채점 시 88~93점 인플레이션 확인.
별도 API 호출 + temperature 0.1 로 편향을 구조적으로 차단.

점수 재계산: AI가 반환한 totalScore는 무시하고,
8개 차원 점수의 합으로 서버에서 직접 계산:
```typescript
const dimTotal = dimensions.reduce((sum, d) => sum + d.score, 0);
const total = Math.round(Math.min(100, dimTotal));
```

### 4-1. 시스템 프롬프트 (공통)

```
당신은 SEO 헤드라인 분석 전문가입니다.
CoSchedule Headline Analyzer, MonsterInsights, AMI(Advanced Marketing Institute) EMV 공식,
[Naver C-Rank 알고리즘 | Google Search Console CTR 최적화 원칙]에 기반한
전문 채점 기준으로 [네이버|구글] SEO 제목을 독립적으로 평가합니다.

[중요] 당신의 역할은 제목을 만든 사람이 아니라 독립적인 심사위원입니다.
편견 없이, 기준에만 근거하여 냉정하게 채점하세요.
점수가 낮아도 솔직하게 주세요.

[플랫폼별 루브릭 삽입]

반드시 순수 JSON만 출력. 마크다운 코드블록 없이.
```

### 4-2. 네이버 채점 루브릭 (8차원 × 12.5점)

**출처**: CoSchedule + MonsterInsights + AMI EMV + 네이버 C-Rank

| # | 차원 | 만점 | 최고점 조건 | 출처 |
|---|------|------|------------|------|
| 1 | 길이 최적화 | 12.5 | **28~45자** (VIEW 탭 완전 표시) | CoSchedule Length Score |
| 2 | 키워드 배치 | 12.5 | 정확한 키워드 + **앞 1/3 이내** | 네이버 C-Rank |
| 3 | 훅 강도 | 12.5 | **공감형·질문형** 우선 | CoSchedule Headline Score |
| 4 | 감정 유발력 | 12.5 | **EMV 40%** 이상 + 파워워드 | AMI EMV Formula |
| 5 | 검색 의도 일치 | 12.5 | **정보성(Know)** 의도 완벽 일치 | 네이버 검색 패턴 |
| 6 | 클릭 심리 자극 | 12.5 | **FOMO + 공감** 결합 | MonsterInsights |
| 7 | 명확성 | 12.5 | 1초 내 내용 파악 가능 | IsItWP Clarity Score |
| 8 | 차별성 | 12.5 | 흔하지 않은 각도/구조 | CoSchedule Uniqueness Factor |

**EMV Formula**: `EMV(%) = 감정 단어 수 / 전체 단어 수 × 100`

**네이버 파워워드**: 완전정복, 비밀, 진실, 충격, 결국, 진짜, 이유, 방법, 무료, 즉시, 핵심, 공개

**네이버 공감어**: 불안, 기대, 희망, 두려움, 절박, 안도, 허탈, 억울, 다행

### 4-3. 구글 채점 루브릭 (8차원 × 12.5점, 동일 차원 다른 기준)

| # | 차원 | 최고점 조건 | 네이버와의 차이 |
|---|------|------------|--------------|
| 1 | 길이 최적화 | **25~32자** (SERP 픽셀 제한 580px) | 네이버보다 짧아야 함 |
| 2 | 키워드 배치 | **제목 맨 앞** (첫 단어~1/4 위치) | 더 엄격한 앞배치 |
| 3 | 훅 강도 | **숫자형 + 명확한 혜택** 우선 | 공감형보다 정보형 |
| 4 | 감정 유발력 | 신뢰형 파워워드 + **EMV 20~35%** | EMV 과잉 시 신뢰도 저하 |
| 5 | 검색 의도 | **Know/Do/Navigate/Decide 4가지** 균등 | 정보성만 우선시 않음 |
| 6 | 클릭 심리 | **명확한 이익 제시** > FOMO | FOMO보다 혜택 |
| 7 | 명확성 | **0.5초** 내 판단 (더 엄격) | 즉각적 명확성 최우선 |
| 8 | 차별성 | 가중치 체감 더 높음 | 구글 경쟁이 더 치열 |

### 4-4. 등급 기준

| 점수 | 등급 | 의미 |
|------|------|------|
| 88점 이상 | **S** | 전문 카피라이터 수준 — 즉시 사용 |
| 75~87점 | **A** | 상위권 — 게시 권장 |
| 60~74점 | **B** | 평균 이상 — 개선 여지 있음 |
| 45~59점 | **C** | 보통 — 주요 약점 수정 필요 |
| 45점 미만 | **D** | 미흡 — 재작성 권장 |

---

## 5. 멀티플랫폼 글쓰기 파이프라인

**구현 파일**: `src/app/api/blog/write-multi-platform/route.ts`

### 에이전트 구성 (현행)

| 에이전트 | Temp | max_tokens | 실행 횟수 | 역할 |
|---------|------|-----------|---------|------|
| Agent 1: 리서처 | 0.3 | 1200 | 1회 | 5막 아웃라인 JSON 생성 |
| Agent 2(WP): 작가 | 0.8 | 7000 | 1회 | WP 초고 (팩트체크 기준) |
| Agent 2.5: 팩트체커 | 0.1 | 1500 | 1회 | WP 초고 할루시네이션 탐지 |
| Agent 2(N+P): 작가 | 0.8 | 3000/4500 | 병렬 2회 | Naver + Personal 초고 |
| Agent 3×3: 편집자 | 0.2 | 플랫폼별 +1000 | 병렬 3회 | 편집 + 팩트체크 반영 |
| Agent 4: 평가자 | 0.2 | 3000 | 1회 | 10차원 채점 (WP 기준) |
| Agent 5×3: 리파이너 | 0.5 | 플랫폼별 +1000 | 병렬 최대 2라운드 | 약점 수정 |
| ImageGen×3 | — | — | 병렬 | [IMAGE:] 마커 → FLUX |

### 팩트체커 배치 설계

```
WP 초고 완성
    ↓
팩트체커 실행 (HIGH/MEDIUM/LOW 분류)
    ↓
Naver + Personal 작가 실행 (병렬, 팩트체커와 독립)
    ↓
편집자×3 실행 시 HIGH 위험 목록 주입
    → "HIGH 위험 N개는 반드시 헤징 언어로 완화하거나 제거"
```

**설계 이유**: WP 초고로 팩트체크 기준을 확보 → 나머지 2개 플랫폼 작성과 병렬화 가능 → 편집 단계에서 3개 모두 동일한 팩트체크 반영.

### 리파이너 실행 조건

```typescript
// 통과 기준: grade A 이상 (totalScore >= 75)
const passed = grade === 'S' || grade === 'A';

// 리파이너 루프
for (let round = 1; round <= 2; round++) {
  if (totalScore >= 80 || 약점차원수 === 0) break;
  // 3개 플랫폼 동시 리파인 (병렬)
  // 재평가 후 점수 변화 steps에 기록
}
```

**리파이너 조기 종료**: `totalScore >= 80` OR `약점 차원(score < 7) = 0`
**최대 2라운드** — 그 이상은 문체 파괴 위험

### DB 저장 구조

```
테이블: scheduled_posts
주요 컬럼:
  - topic, keyword, seo_platform
  - naver_title / naver_content / naver_images
  - wordpress_title / wordpress_content / wordpress_images
  - personal_title / personal_content / personal_images
  - evaluation (JSONB)
  - scheduled_at (예약 발행 시간)
  - status: draft → scheduled → published
```

**saveToDb=true** 시 자동 저장. `scheduled_at` 있으면 예약 발행 대상.
자동 발행: `src/app/api/blog/cron-publish/route.ts` (Railway Cron 트리거)

### Wiki 로딩 방식

```typescript
const WIKI = path.join(process.cwd(), 'wiki');
function wiki(p: string) { return fs.readFileSync(path.join(WIKI, p), 'utf-8'); }
function latestFeedback() {
  // wiki/feedback/ 폴더에서 가장 최신 파일 1개 로드
  // 작가 시스템 프롬프트에 "최근 피드백 (반드시 반영)" 섹션으로 삽입
}
```

로드되는 wiki 파일:
- `blog/structure.md` → 리서처 (5막 구조)
- `blog/hook-writing.md` → 리서처 (훅 유형)
- `blog/writer-persona.md` → 작가 + 편집자 (금지 표현)
- `blog/cta-writing.md` → 작가 (CTA 원칙)
- `blog/emotional-flow.md` → 작가 (감정 흐름)
- `blog/evaluation-rubric.md` → 편집자 + 평가자 (채점 기준)
- `wiki/feedback/최신.md` → 작가 (최근 피드백)

---

## 6. 플랫폼별 작성 가이드

| 항목 | 네이버 | 워드프레스 | 개인 웹사이트 |
|------|--------|----------|------------|
| 목표 길이 | 800~1200자 | 1500~2500자 | 1000~1500자 |
| max_tokens | 3000 | 7000 | 4500 |
| 문체 | 친근한 구어체 (~해요, ~거든요) | 전문적·신뢰감 | 1인칭 개인 관점 |
| 소제목 | ## 2~3개 (VIEW 최적화) | H2 3~4개 + H3 세부 | 자유 구성 |
| SEO 포인트 | 키워드 첫 문단 50자 이내 | 키워드 밀도 1~2%, 첫 150자 메타 역할 | 해당 없음 |
| 이미지 마커 | 2~3곳 | H2 섹션마다 1개 | 1~2곳 |
| 차별화 포인트 | 모바일 스크롤 3회 이내 | 링크 구조 언급 + 독자 행동 유도 | 다른 두 플랫폼과 다른 독창적 각도 |

### FLUX 이미지 프롬프트 스타일

```typescript
naver:     `Korean lifestyle photography, ${desc}, warm colors, mobile-friendly`
wordpress: `Korean lifestyle photography, ${desc}, professional editorial style`
personal:  `Korean lifestyle photography, ${desc}, authentic candid style, storytelling`
```

---

## 7. 단일 플랫폼 파이프라인 에이전트 → [write-pipeline-agents.md](write-pipeline-agents.md)

> 레거시 파이프라인(`write-pipeline/route.ts`) 에이전트 상세 프롬프트.
> 인간 필기감 원칙·할루시네이션 탐지 원칙은 이 파일에서 관리.
> **현행 멀티플랫폼 파이프라인도 동일 원칙 적용.**

---

## 에이전트 개요 (요약)

```
Agent 1:   리서처      (temp 0.3, max 1200)         → 5막 아웃라인 JSON (1회)
Agent 2:   작가×3      (temp 0.8, max 플랫폼별)      → WP 먼저 → Naver+Personal 병렬
Agent 2.5: 팩트체커    (temp 0.1, max 1500)          → 할루시네이션 탐지 (1회)
Agent 3:   편집자×3    (temp 0.2, max 플랫폼별+1000) → 병렬 편집 + 팩트체크 반영
Agent 4:   평가자      (temp 0.2, max 3000)          → 10차원 채점 (WP 기준, 1회)
Agent 5:   리파이너×3  (temp 0.5, max 플랫폼별+1000) → 병렬 약점 수정 (최대 2라운드)
```

**통과 기준**: `grade === 'S' || grade === 'A'` (총점 75점 이상)
**리파이너 실행 조건**: `totalScore < 80` AND `약점 차원(score < 7) >= 1`

---


## 8. 글 품질 평가

### 등급 기준

| 총점 | 등급 | 의미 |
|------|------|------|
| 90점 이상 | S | 게시 즉시 가능, 탁월한 품질 |
| 75~89점 | A | 게시 권장, 상위 품질 |
| 60~74점 | B | 게시 가능, 개선 여지 있음 |
| 40~59점 | C | 개선 필요 |
| 40점 미만 | D | 재작성 권장 |

### 리파이너 실행 조건

```
totalScore < 80  AND  약점 차원(score < 7) >= 1  →  리파이너 실행
totalScore >= 80  OR  약점 차원 = 0               →  조기 종료
최대 2라운드 후 무조건 종료
```

---

## 9. AI 모델 선택 기준

### 지원 모델

| 모델 ID | 제공사 | 특성 |
|---------|--------|------|
| gemini-2.5-flash | Google | 최고 가성비, 기본 모델 |
| gemini-2.5-flash-lite | Google | 초저가 |
| gemini-2.5-pro | Google | 고품질 |
| claude-haiku-4-5-20251001 | Anthropic | 빠름 |
| claude-sonnet-4-6 | Anthropic | 고품질 |
| claude-opus-4-6 | Anthropic | 최고품질 |
| qwen3.5-flash | Alibaba | 균형 |
| qwen3.5-plus | Alibaba | 합리적 |
| qwen3.6-plus | Alibaba | 고지능 |

### 자동 선택 우선순위

API 키 있는 순서대로:
1. Gemini (gemini-2.5-flash)
2. Anthropic (claude-haiku-4-5-20251001 또는 claude-sonnet-4-6)
3. Qwen (qwen3.5-plus)

### API 키 저장 위치

Supabase `auth.users.user_metadata`:
- `gemini_api_key`
- `anthropic_api_key`
- `qwen_api_key`

---

## 10. 설계 판단 기록

### 멀티플랫폼 동시 생성으로 전환한 이유 (2026-04-18)
사용자가 글 하나를 쓰면 네이버·워드프레스·개인 웹사이트 3곳에 각각 최적화된 버전이 필요.
단일 플랫폼 파이프라인을 3번 호출하면 비용 3배 + 시간 3배.
리서처·팩트체커는 플랫폼 무관 → 1회만 실행. 작가·편집자·리파이너만 플랫폼별 병렬 실행.
결과: 비용 ≈ 1.8배 증가, 시간 ≈ 단일 파이프라인과 동일(병렬 덕분).

### WP 초고를 먼저 쓰는 이유
팩트체커는 텍스트가 있어야 동작함.
가장 긴 WP 버전으로 팩트체크하면 Naver/Personal에도 동일 기준 적용 가능.
WP 초고 작성 중 Naver+Personal 작가를 병렬 실행하면 시간 절약 가능하지만,
팩트체크 결과를 편집자에게 전달해야 하므로 순서 유지.

### 독립 채점을 별도 에이전트로 분리한 이유
같은 모델이 생성하고 채점하면 자신의 결과물에 관대해진다.
실제 테스트에서 자기채점 시 88~93점 인플레이션 확인.
별도 API 호출로 편향을 구조적으로 차단.

### 통과 기준을 80점→75점(grade A)으로 변경한 이유
80점 기준이 너무 엄격해 리파이너가 과도하게 실행됨.
grade A(75점+)면 실제 발행 품질로 충분.
리파이너 실행 조건은 여전히 80점 미만 — 통과 판정과 리파인 트리거를 분리.

### 팩트체커를 작가 직후에 배치한 이유
초고 상태에서 탐지해야 편집자가 반영할 수 있음.
편집 이후 탐지하면 이미 수정된 글에 팩트체크 결과를 다시 반영하는 이중 작업 발생.

### 리파이너 2라운드 제한 이유
무한 루프 방지. 3라운드 이상에서 점수가 오히려 하락하는 경우가 발생함
(과도한 수정으로 문체 파괴). 2라운드 내에 개선되지 않으면 더 수정해도 의미 없음.

### Temperature 설계 원칙

| 에이전트 | Temperature | 이유 |
|---------|------------|------|
| 리서처 | 0.3 | 논리적 구조 설계 → 낮은 창의성 |
| 작가 | 0.8 | 창의적 표현 → 높은 다양성 |
| 팩트체커 | 0.1 | 일관된 위험 판단 |
| 편집자 | 0.2 | 정확한 수정, 재작성 방지 |
| 평가자 | 0.2 | 일관된 채점 |
| 제목 채점 | 0.1 | 최대 일관성 |
| 리파이너 | 0.5 | 수정의 창의성 허용, 재작성은 방지 |

### 네이버/구글 채점 루브릭을 분리한 이유
두 플랫폼의 사용자 행동 패턴이 다름.
- 네이버: 정보 탐색 중심 + 감성 공감 CTR 높음
- 구글: 즉각적 명확성 + 숫자/혜택 기반 CTR 높음

같은 기준으로 채점하면 네이버 제목을 구글 기준으로 낮게,
구글 제목을 네이버 기준으로 낮게 평가하는 오류가 발생.

### 인간 필기감을 별도 평가 차원으로 추가한 이유
AI 생성 글에서 가장 빈번하게 발생하는 품질 문제.
기존 8개 차원(훅/서사/묘사/리듬/감정/CTA/금지표현/클로징)이
각각 기술적 품질을 평가한다면, 인간 필기감은 전체적인 자연스러움을 별도로 검증.

### 사실 정확성을 별도 평가 차원으로 추가한 이유
할루시네이션은 글 완성도와 별개의 문제.
높은 서사 구조 점수를 받아도 사실 오류가 있으면 신뢰성 0.
팩트체커 에이전트로 사전 탐지 후, 평가자가 최종 확인하는 이중 검증 구조.

---

## 11. 참조 출처

| 기준 | 출처 |
|------|------|
| Headline Score | CoSchedule Headline Analyzer (word balance, emotional words, power words) |
| 7차원 100점제 | MonsterInsights Headline Analyzer |
| EMV Formula | Advanced Marketing Institute (AMI) Emotional Marketing Value |
| 검색 의도 분류 | Google Search Intent (Know / Do / Navigate / Decide) |
| C-Rank | 네이버 C-Rank SEO 알고리즘 공개 자료 |
| Clarity Score | IsItWP Headline Analyzer |
| 구글 SERP 픽셀 제한 | Google Search Console 가이드 (580px ≈ 한글 25~32자) |
| 참고 구현 | GitHub: dtran320/Headline-Score-App, kuldeeps48/Headline-Analyzer |
