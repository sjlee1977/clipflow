---
updated: 2026-04-16
ttl: 60
ttl_reason: 코드(write-pipeline/route.ts, generate-titles/route.ts) 변경 시 동기화 필요
volatile: false
split_children:
  - file: write-pipeline-agents.md
    contains: "5. 글쓰기 파이프라인, 6. 인간 필기감 원칙, 7. 할루시네이션 탐지 원칙"
---

# AI 블로그 자동화 파이프라인 — 완전 가이드

> **문서 목적**: ClipFlow AI 블로그 작성 시스템의 모든 판단 기준, 에이전트 구성, 실제 프롬프트, 설계 근거를 기록.
> 코드가 변경될 때마다 이 문서도 함께 업데이트됨.
>
> **최종 업데이트**: 2026-04-16
> **관련 파일**:
> - `src/app/api/blog/generate-titles/route.ts` — 제목 생성
> - `src/app/api/blog/score-titles/route.ts` — 독립 채점
> - `src/app/api/blog/write-pipeline/route.ts` — 글쓰기 파이프라인

---

## 목차

1. [전체 파이프라인 흐름](#1-전체-파이프라인-흐름)
2. [키워드 리서치 — 데이터 출처와 판단 기준](#2-키워드-리서치)
3. [SEO 제목 생성 에이전트](#3-seo-제목-생성-에이전트)
4. [독립 채점 에이전트 — 8차원 × 12.5점](#4-독립-채점-에이전트)
5. [글쓰기 파이프라인 → **write-pipeline-agents.md**](write-pipeline-agents.md) ← 분리됨
6. [인간 필기감 원칙 → **write-pipeline-agents.md**](write-pipeline-agents.md) ← 분리됨
7. [할루시네이션 탐지 원칙 → **write-pipeline-agents.md**](write-pipeline-agents.md) ← 분리됨
8. [글 품질 평가 — 10차원 100점](#8-글-품질-평가)
9. [AI 모델 선택 기준](#9-ai-모델-선택-기준)
10. [설계 판단 기록 — 왜 이렇게 만들었나](#10-설계-판단-기록)
11. [참조 출처](#11-참조-출처)

---

## 1. 전체 파이프라인 흐름

```
[사용자 입력]
    키워드 입력
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
         ▼ (자동, 생성과 병렬 아님 — 생성 완료 후 실행)
[독립 채점 에이전트] (temp 0.1)
    → 8차원 × 12.5점 = 100점
    → 네이버 / 구글 루브릭 분리
    → 등급: S / A / B / C / D
         │
         ▼
    사용자가 제목 선택 (또는 직접 입력)
         │
         ▼
[Phase 3: 글쓰기]
    Agent 1: 리서처   (temp 0.3)  → 5막 아웃라인
    Agent 2: 작가     (temp 0.8)  → 초고 마크다운
    Agent 2.5: 팩트체커 (temp 0.1) → 할루시네이션 탐지
    Agent 3: 편집자   (temp 0.2)  → AI 패턴 제거 + 팩트체크 반영
    Agent 4: 평가자   (temp 0.2)  → 10차원 채점
         │
         ▼ (총점 < 80 또는 약점 차원 존재 시, 최대 2라운드)
    Agent 5: 리파이너  (temp 0.5) → 약점 부분만 수정
    Agent 6: 재평가자  (temp 0.2) → 재채점
         │
         ▼
[Phase 4: 완료]
    최종 블로그 글 + 품질 점수 + 팩트체크 결과
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

## 5. 글쓰기 파이프라인 → [write-pipeline-agents.md](write-pipeline-agents.md)

> 섹션 5(에이전트 프롬프트 전체), 6(인간 필기감), 7(할루시네이션 탐지)는
> **[write-pipeline-agents.md](write-pipeline-agents.md)** 로 분리됨.
>
> **분리 이유**: 원본 파일이 750줄을 초과해 LLM 컨텍스트 부담 증가.
> 파이프라인 흐름(1~4섹션)과 에이전트 프롬프트(5~7섹션)를 분리해 필요한 부분만 로드.

**구현 파일**: `src/app/api/blog/write-pipeline/route.ts`

---

## 6. 인간 필기감 원칙 → [write-pipeline-agents.md](write-pipeline-agents.md)

→ `write-pipeline-agents.md` 섹션 6 참조.

---

## 7. 할루시네이션 탐지 원칙 → [write-pipeline-agents.md](write-pipeline-agents.md)

→ `write-pipeline-agents.md` 섹션 7 참조.

---

## 에이전트 개요 (요약)

> 상세 프롬프트는 `write-pipeline-agents.md` 참조.

```
Agent 1: 리서처   (temp 0.3, max 1200) → 5막 아웃라인 JSON
Agent 2: 작가     (temp 0.8, max 4000) → 마크다운 초고
Agent 2.5: 팩트체커 (temp 0.1, max 2000) → 할루시네이션 위험 목록
Agent 3: 편집자   (temp 0.2, max 4500) → AI패턴 제거 + 팩트체크 반영
Agent 4: 평가자   (temp 0.2, max 2500) → 10차원 채점
Agent 5+: 리파이너 (temp 0.5, max 4500) → 약점 수정 (최대 2라운드)
```

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

### 독립 채점을 별도 에이전트로 분리한 이유
같은 모델이 생성하고 채점하면 자신의 결과물에 관대해진다.
실제 테스트에서 자기채점 시 88~93점 인플레이션 확인.
별도 API 호출로 편향을 구조적으로 차단.

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
