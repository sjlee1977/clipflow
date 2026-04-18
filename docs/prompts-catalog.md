---
updated: 2026-04-18
description: 사이트 전체 AI 프롬프트 항목별 카탈로그 — 프롬프트 추가·변경 시 반드시 업데이트
---

# ClipFlow 전체 AI 프롬프트 카탈로그

> 프롬프트가 추가되거나 변경될 때마다 이 파일을 업데이트한다.
> 각 항목에는 파일 경로, 역할, 입력/출력, 모델 및 온도를 기록한다.
>
> **⚠ 주의:** 각 항목의 "프롬프트 구조"는 요약이지 전문이 아니다.
> 실제 실행 시점에는 wiki 파일 내용(structure.md, hook-writing.md 등)이 동적으로 삽입되어
> 프롬프트 전체 길이가 훨씬 길어진다. 정확한 전문은 해당 라우트 파일을 직접 확인할 것.

---

## 목차

1. [블로그 — 멀티 에이전트 파이프라인](#1-블로그--멀티-에이전트-파이프라인)
2. [블로그 — 제목 생성 & 채점](#2-블로그--제목-생성--채점)
3. [블로그 — 키워드 리서치](#3-블로그--키워드-리서치)
4. [블로그 — 개별 평가](#4-블로그--개별-평가)
5. [대본 — 멀티 에이전트 파이프라인](#5-대본--멀티-에이전트-파이프라인)
6. [대본 — LLM Judge 평가](#6-대본--llm-judge-평가)
7. [캐러셀 생성](#7-캐러셀-생성)
8. [미디어 허브 — 콘텐츠 작성](#8-미디어-허브--콘텐츠-작성)
9. [트렌드 — 댓글 분석](#9-트렌드--댓글-분석)

---

## 1. 블로그 — 멀티 에이전트 파이프라인

파이프라인 파일: `src/app/api/blog/write-multi-platform/route.ts`  
(구 파이프라인: `src/app/api/blog/write-pipeline/route.ts`, `src/app/api/blog/write-agent/route.ts`)

### Agent 1 — 리서처 (Researcher)

| 항목 | 내용 |
|------|------|
| 파일 | `src/app/api/blog/write-multi-platform/route.ts:174` |
| 역할 | SEO 데이터·키워드를 바탕으로 5막 아웃라인 설계 |
| 모델 | 사용자 선택 (Gemini / Claude / Qwen) |
| Temperature | **0.3** (일관성 우선) |
| Max tokens | 1200 |
| JSON mode | 강제 |
| 입력 | title, keyword, searchVolume, competition, relatedKeywords |
| 출력 | JSON: painPoint, uniqueAngle, hookType, emotionalArc, structure(act1~5), keyPoints |

**System 메시지 구조:**
```
당신은 10년 경력의 콘텐츠 전략가입니다.
구조 원칙: [wiki/blog/structure.md 전문 삽입]
훅 유형: [wiki/blog/hook-writing.md 전문 삽입]
```

**User 메시지 구조:**
```
제목: "..."
키워드: "..."
월간 검색량: N회        ← 있을 때만 포함
경쟁도: 낮음/중간/높음  ← 있을 때만 포함
연관 키워드: A, B, C   ← 있을 때만 포함 (최대 5개)

아래 JSON으로 5막 아웃라인을 설계하세요:
{
  "painPoint": "독자 핵심 고통 (1~2문장)",
  "uniqueAngle": "차별화 관점 (1~2문장)",
  "hookType": "A형/B형/C형 + 이유",
  "emotionalArc": "긴장→공감→놀람→안도→행동 각 포인트",
  "structure": { "act1": "1막", ..., "act5": "5막" },
  "keyPoints": ["포인트1", "포인트2", "포인트3"]
}
```

> wiki 파일이 없을 경우 폴백: 구조 원칙 → `5막 구조: 훅→갈등→반전→증명→해소`, 훅 유형 → `A형(도발적 질문), B형(충격 수치), C형(착각 지적)`

---

### Agent 2 — 작가 (Writer)

| 항목 | 내용 |
|------|------|
| 파일 | `src/app/api/blog/write-multi-platform/route.ts` |
| 역할 | 아웃라인을 바탕으로 실제 블로그 글 작성 |
| 모델 | 사용자 선택 |
| Temperature | 기본값 |
| 입력 | outline, platform, lengthDesc, wikiPersona, wikiNarrative, wikiEmotional, wikiCta, wikiFeedback |
| 출력 | 마크다운 블로그 글 |

**프롬프트 핵심:**
```
당신은 10년 경력의 블로그 전문 작가입니다.
목표 분량: [lengthDesc] ← 반드시 목표 분량을 채울 것

## AI 탐지 금지 표현 (절대 사용 금지)
- "살펴보겠습니다", "알아보겠습니다", "확인해보겠습니다"
- "이상으로 ~에 대해 알아보았습니다"

## 반드시 구현할 인간 필기감 요소
[wiki/blog/writer-persona.md 내용 삽입]
```

---

### Agent 2.5 — 팩트체커 (Fact-Checker)

| 항목 | 내용 |
|------|------|
| 파일 | `src/app/api/blog/write-multi-platform/route.ts` |
| 역할 | 할루시네이션 탐지 (가짜 통계·인용·연구 감지) |
| 모델 | 사용자 선택 |
| Temperature | 기본값 |
| 입력 | 작성된 블로그 글 |
| 출력 | JSON: issues 배열 (severity: HIGH/MEDIUM/LOW, text, reason, suggestion) |

**프롬프트 핵심:**
```
AI 생성 블로그 글의 할루시네이션을 탐지하는 팩트체커.
HIGH: 출처 없는 구체 통계, 가짜 연구/기관 인용, 특정 전문가 발언 조작
MEDIUM: 불확실한 연도, 과도한 인과관계 단정
LOW: 일반적 주장이나 상식적 오류
```

---

### Agent 3 — 편집자 (Editor)

| 항목 | 내용 |
|------|------|
| 파일 | `src/app/api/blog/write-multi-platform/route.ts` |
| 역할 | AI 패턴 제거 + 글 품질 향상 |
| 모델 | 사용자 선택 |
| Temperature | 기본값 |
| 입력 | 블로그 글, 팩트체크 결과, wikiRubric |
| 출력 | 편집된 마크다운 블로그 글 |

**프롬프트 핵심:**
```
당신은 15년 경력의 디지털 미디어 편집장입니다.
채점 기준: [wiki/blog/evaluation-rubric.md]

## 즉시 제거할 AI 패턴
- "살펴보겠습니다", "알아보겠습니다" 등 AI 투명 표현
- 동어 반복, 불필요한 접속사 남용
```

---

### Agent 4 — 평가자 (Evaluator)

| 항목 | 내용 |
|------|------|
| 파일 | `src/app/api/blog/write-multi-platform/route.ts` |
| 역할 | 10차원 × 10점 = 100점 만점 채점 |
| 모델 | 사용자 선택 |
| Temperature | 기본값 |
| 입력 | 편집된 블로그 글, wikiRubric |
| 출력 | JSON: scores (10개 차원 점수), totalScore, suggestions |

**프롬프트 핵심:**
```
블로그 품질을 냉정하게 평가하는 편집장. 10개 차원 각 10점 만점.
[wiki/blog/evaluation-rubric.md 루브릭 삽입]
```

---

### Agent 5 — 리파이너 (Refiner) *(write-pipeline 한정)*

| 항목 | 내용 |
|------|------|
| 파일 | `src/app/api/blog/write-pipeline/route.ts` |
| 역할 | 평가 점수 기반 약점 부분만 외과적 수정 (최대 3라운드) |
| 모델 | 사용자 선택 |
| Temperature | 기본값 |
| 입력 | 이전 글, 평가 결과, 라운드 번호 |
| 출력 | 수정된 마크다운 블로그 글 |

**프롬프트 핵심:**
```
당신은 전문 블로그 편집 작가입니다. 라운드 [round] 수정을 진행합니다.
평가자의 지적 사항을 정확히 반영해 약점 부분만 외과적으로 수정합니다.
강점은 절대 건드리지 않는다.
```

---

## 2. 블로그 — 제목 생성 & 채점

### 제목 생성기

| 항목 | 내용 |
|------|------|
| 파일 | `src/app/api/blog/generate-titles/route.ts` |
| 역할 | 키워드 기반 SEO 최적화 제목 5개 생성 |
| 모델 | 사용자 선택 |
| 입력 | keyword, platform, researchData |
| 출력 | JSON: titles 배열 (title, hookType, reason) |

**프롬프트 핵심:**
```
당신은 한국 디지털 마케팅 SEO 전문가입니다.
주어진 키워드와 리서치 데이터를 바탕으로 [platform] SEO 최적화 블로그 제목 5개를 생성합니다.

훅 유형 가이드:
- 질문형: "~를 알고 계신가요?"
- 숫자형: "N가지 ~"
- 충격형: "~의 충격적 진실"
- 약속형: "~하는 방법 완전 정복"
- 비교형: "~ vs ~"
```

---

### 제목 채점기

| 항목 | 내용 |
|------|------|
| 파일 | `src/app/api/blog/score-titles/route.ts` |
| 역할 | 생성된 제목을 8개 차원에서 채점 (플랫폼별 루브릭 분리) |
| 모델 | 사용자 선택 |
| 입력 | titles 배열, platform |
| 출력 | JSON: 각 제목별 점수 (8차원 × 12.5점 = 100점) |

**채점 루브릭 — 네이버 (`SCORING_RUBRIC_NAVER`):**
- 키워드 포함도, 감성 자극도, 숫자/구체성, 길이 최적화, 클릭 욕구, 신뢰도, 모바일 가독성, 검색 의도 부합

**채점 루브릭 — 구글 (`SCORING_RUBRIC_GOOGLE`):**
- 검색 의도 부합, 키워드 배치, CTR 최적화, 정보성, 신뢰도, 길이, 차별성, 구조

**프롬프트 핵심:**
```
당신은 SEO 헤드라인 분석 전문가입니다.
CoSchedule Headline Analyzer, MonsterInsights, AMI EMV 공식,
[Naver C-Rank|Google Search Console CTR 최적화] 기반 전문 채점
```

---

## 3. 블로그 — 키워드 리서치

| 항목 | 내용 |
|------|------|
| 파일 | `src/app/api/blog/keyword-suggest/route.ts` |
| 역할 | 씨앗 키워드에서 SEO 연관 키워드 확장 및 기회 점수 산출 |
| 모델 | 사용자 선택 |
| 입력 | seedKeyword, platform |
| 출력 | JSON: keywords (keyword, volume, competition, opportunityScore, intent) |

**프롬프트 핵심:**
```
당신은 한국 블로그 SEO 전문가입니다.
⚠ 현재 연도: [year]년. 제목에 연도를 쓸 때 반드시 [year]년으로 표기하세요.

기회 점수 (opportunityScore) — 초보 블로거 기준:
- 황금 구간: 월 검색량 2,000~5,000 + 낮은 경쟁도 → 최고점
```

---

## 4. 블로그 — 개별 평가

| 항목 | 내용 |
|------|------|
| 파일 | `src/app/api/blog/evaluate/route.ts` |
| 역할 | 작성된 블로그 글 단독 채점 (10차원 × 10점) |
| 모델 | 사용자 선택 |
| 입력 | blogPost, wikiRubric |
| 출력 | JSON: scores (10차원), totalScore, grade, suggestions |

**프롬프트 핵심:**
```
당신은 블로그 품질을 냉정하게 평가하는 편집장입니다.
아래 루브릭으로 10개 차원 각 10점 만점 채점.
## 인간 필기감 채점 기준
AI가 쓴 것 같은 패턴이 얼마나 제거되었는지 평가
```

---

## 5. 대본 — 멀티 에이전트 파이프라인

파일: `src/app/api/generate-script-agent/route.ts`

### Agent 1 — 감독 (Director)

| 항목 | 내용 |
|------|------|
| 역할 | 주제 분석 → 바이럴 각도·구조 설계 |
| 모델 | 사용자 선택 |
| Temperature | 기본값 |
| 입력 | topic, category, wiki (identity, structure, stageNotes, hookWriting, emotionalFlow) |
| 출력 | JSON: direction (angle, reason, structure, targetEmotion) |

**프롬프트 핵심:**
```
당신은 유튜브 콘텐츠 감독입니다. 100편 이상의 영상을 기획했습니다.
주제를 받으면 어떤 각도로 가야 바이럴이 되는지 즉시 압니다.
모든 결정에는 반드시 "왜(Why)"를 포함합니다.

채널 정체성: [wiki.identity]
7단계 구조 참고: [wiki.structure]
훅 전략 원칙: [wiki.hookWriting]
감정 흐름 설계 원칙: [wiki.emotionalFlow]
```

---

### Agent 2 — 작가 (Writer)

| 항목 | 내용 |
|------|------|
| 역할 | 감독 전략을 받아 실제 대본 초고 작성 |
| 모델 | 사용자 선택 |
| Temperature | 기본값 |
| 입력 | direction, wiki (identity, tone, writerPersona, hookWriting, narrativeTechniques, emotionalFlow, ctaWriting) |
| 출력 | 마크다운 대본 |

**프롬프트 핵심:**
```
당신은 유튜브 대본 전문 작가입니다.
감독의 전략과 이유를 완벽히 이해하고, 그 의도를 살려 실제 대본으로 구현합니다.

채널 정체성: [wiki.identity]
톤 & 말투: [wiki.tone]
나레이터 페르소나 & 금지 표현: [wiki.writerPersona]
훅 작성 원칙: [wiki.hookWriting]
서사 기법: [wiki.narrativeTechniques]
감정 흐름 설계: [wiki.emotionalFlow]
CTA 작성 원칙: [wiki.ctaWriting]
```

---

### Agent 3 — 토론 / 감독 검토 (Director Review)

| 항목 | 내용 |
|------|------|
| 역할 | 초고를 검토하고 정확히 2~3개 개선 지시 |
| 모델 | 사용자 선택 |
| Temperature | 기본값 |
| 입력 | 초고 대본 |
| 출력 | JSON: feedback (항목별 지시 + 이유) |

**프롬프트 핵심:**
```
당신은 엄격한 유튜브 콘텐츠 감독입니다. 초고를 검토하고 정확히 2~3개의 개선 지시만 내립니다.
모든 지시에는 반드시 이유를 포함합니다. 칭찬은 생략합니다.
```

---

### Agent 4 — 프로듀서 (Producer)

| 항목 | 내용 |
|------|------|
| 역할 | 훅/전환/클로징 점검 → 약한 부분만 수정 |
| 모델 | 사용자 선택 |
| Temperature | 기본값 |
| 입력 | 대본, 감독 피드백 |
| 출력 | 수정된 마크다운 대본 |

**프롬프트 핵심:**
```
당신은 유튜브 콘텐츠 프로듀서입니다. 시청자 이탈 구간을 본능적으로 압니다.
대본의 훅/전환/클로징을 점검하고 약한 부분만 수정합니다.
강점은 절대 건드리지 않는다.
```

---

### Agent 5 — SEO 에이전트 (SEO)

| 항목 | 내용 |
|------|------|
| 역할 | 대본 분석 → YouTube SEO 패키지 생성 |
| 모델 | 사용자 선택 |
| Temperature | 기본값 |
| 입력 | 완성 대본, category |
| 출력 | JSON: title (3개), description, tags (15개), thumbnail |

**프롬프트 핵심:**
```
당신은 YouTube SEO 전문가입니다. CTR(클릭률)과 검색 노출을 동시에 최적화합니다.
대본을 분석해서 SEO 패키지를 생성합니다.
```

---

## 6. 대본 — LLM Judge 평가

| 항목 | 내용 |
|------|------|
| 파일 | `src/app/api/evaluate-script/route.ts` |
| 역할 | 8개 차원 × 10점 = 80점 만점으로 대본 채점 (S/A/B/C/D 등급) |
| 모델 | Gemini 또는 Claude (사용자 키 기반 자동 선택) |
| 입력 | script, category, wiki (7단계 구조, 카테고리별 stage-notes, tone) |
| 출력 | JSON: dimensions (8개), totalScore, grade, suggestions, passed |

**채점 8개 차원:**
1. 훅 강도 (Hook Power)
2. 7단계 구조 (Stage Structure)
3. 하드 데이터 (Hard Data)
4. 개념 번역 (Concept Translation)
5. 긴장감/몰입 (Tension & Engagement)
6. 대화체 자연스러움 (Conversational Tone)
7. 리스크 점검 (Risk Check)
8. CTA / 클로징 (CTA & Closing)

**등급 기준:**
| 점수 | 등급 | 의미 |
|------|------|------|
| 90+ | S | 완성도 최고 |
| 75+ | A | 영상 제작 적합 |
| 60+ | B | 수정 후 가능 |
| 40+ | C | 대폭 수정 필요 |
| 0+ | D | 재작성 권고 |

---

## 7. 캐러셀 생성

### 7-A. 기존 단일 에이전트 (레거시)

| 항목 | 내용 |
|------|------|
| 파일 | `src/app/api/generate-carousel/route.ts` |
| 역할 | 영상 대본 → SNS 카드(3 타입) 단일 프롬프트 변환 |
| 모델 | 기본: `qwen-plus` |
| Temperature | 0.7 |
| 입력 | script, llmModelId |
| 출력 | JSON: topic, cards 배열 (8~10장) |
| 카드 타입 | title / keypoint / cta |
| 디자인 | 8가지 다크 네이비 고정 팔레트, 순환 배정 |

---

### 7-B. 카드뉴스 스튜디오 — 5-에이전트 CrewAI 파이프라인 (신규)

파일: `src/app/api/generate-carousel-agent/route.ts`  
페이지: `/dashboard/carousel-studio`  
입력 방식: `topic | keywords | script` / 플랫폼: `instagram | linkedin | common` / 톤: `informative | emotional | humor`

#### Agent 1 — 리서처 (Researcher)

| 항목 | 내용 |
|------|------|
| Temperature | **0.3** |
| Max tokens | 1000 |
| JSON mode | 강제 |
| 역할 | 입력 분석 → 핵심 메시지·타겟·훅·감정 흐름 추출 |
| 출력 | coreMessage, targetAudience, hookDirection, keyPoints(5개), emotionalArc, suggestedTone |

**System:** `SNS 콘텐츠 전략가. 목표 톤: {TONE_GUIDE[tone]}`  
**User:** `[입력 유형: {topic|script|keywords}] → JSON 6개 필드`

#### Agent 2 — 스토리보더 (Storyboarder)

| Temperature | 0.5 | Max tokens | 1200 |
|-------------|-----|------------|------|
| 역할 | 카드 구성·순서·타입 설계 |
| 출력 | totalCards, flow, cards[](index/cardType/role) |

규칙: 0번=title 고정, 마지막=cta, highlight·quote·data 최소 1장 각각 포함.

#### Agent 3 — 카피라이터 (Copywriter)

| Temperature | **0.8** | Max tokens | 3000 |
|-------------|---------|------------|------|
| 역할 | 스토리보드 기반 전체 카드 텍스트 작성 |
| 출력 | cards[]: 6가지 타입별 필드 완성 |

**6가지 카드 타입:**
| 타입 | 필드 |
|------|------|
| `title` | title + subtitle + emoji |
| `keypoint` | title + bullets(2~3) + emoji |
| `highlight` | title + stat(큰 수치) + statDesc + emoji |
| `quote` | title + quote + quoteBy + emoji |
| `data` | title + bullets(비교 항목) + emoji |
| `cta` | title + subtitle + emoji |

금지: "살펴보겠습니다" 등 AI 투명 표현, 이모지 남용(카드당 1~2개).

#### Agent 4 — 에디터 (Editor)

| Temperature | **0.4** | Max tokens | 3000 |
|-------------|---------|------------|------|
| 역할 | AI 투명 표현 제거, 플랫폼 글자 수 준수, 톤 일관성, 이모지 다양화 |
| 출력 | 개선된 cards[] 동일 구조 반환 |

#### Agent 5 — 스타일리스트 (Stylist) ← 신규

| Temperature | **0.3** | Max tokens | 150 |
|-------------|---------|------------|-----|
| 역할 | ResearchResult + tone + platform 분석 → 12가지 스타일 중 최적 1개 선택 |
| 출력 | `{"styleId": "...", "reason": "..."}` |
| 스타일 정의 파일 | `src/lib/carousel-styles.ts` |

**12가지 스타일 팔레트:**
| styleId | 이름 | 무드 |
|---------|------|------|
| `midnight-navy` | 미드나잇 네이비 | 비즈니스·금융·LinkedIn |
| `gold-noir` | 골드 누아르 | 럭셔리·프리미엄·성취 |
| `sunset-amber` | 선셋 앰버 | 동기부여·개인 성장·라이프 |
| `neon-cyber` | 네온 사이버 | AI·테크·스타트업 |
| `forest-deep` | 포레스트 딥 | 환경·자연·여행 |
| `ember-glow` | 엠버 글로우 | 스포츠·피트니스·에너지 |
| `obsidian-pure` | 옵시디언 퓨어 | 에디토리얼·미니멀·에세이 |
| `bull-market` | 불 마켓 | 주식·투자·경제 |
| `mindful-zen` | 마인드풀 젠 | 명상·심리·웰니스 |
| `synthwave` | 신스웨이브 | 음악·엔터·크리에이티브 |
| `velvet-rose` | 벨벳 로즈 | 뷰티·패션·라이프스타일 |
| `infographic-clean` | 인포그래픽 클린 | 데이터 시각화·도식화·교육 |

**스타일 적용 내용:** bgColor(타입별 다름), bgGradient(오버레이), accentColor, textPrimary/Secondary/Muted, fontFamily(sans/mono), titleFontWeight(600~900), letterSpacing.  
인포그래픽 스타일은 CardPreview에서 별도 레이아웃 분기 (번호 리스트, 중앙 집중형 stat, 격자 배경 등).

---

## 8. 미디어 허브 — 콘텐츠 작성

| 항목 | 내용 |
|------|------|
| 파일 | `src/app/api/media-hub/write/route.ts` |
| 역할 | 카테고리별 전문 기사 작성 (여행/경제/IT) + 플랫폼별 최적화 |
| 모델 | 사용자 선택 |
| 입력 | topic, category, articleType, platform |
| 출력 | 마크다운 기사 |

**카테고리별 시스템 프롬프트 (`getCategoryPrompt`):**

| 카테고리 | 페르소나 | 특징 |
|---------|---------|------|
| `travel` | 10년 경력 여행 전문 작가 | 구체적 수치(거리·시간·비용) 필수, 계절별 특성, 현지 문화 팁 |
| `economy` | 경제 전문 기자 | 최신 데이터·수치 인용, 낙관/비관 균형 서술, 투자 인사이트 |
| 기타 (`IT` 등) | IT 전문 기자 | 기술 트렌드 중심 |

**플랫폼별 가이드 (`PLATFORM_GUIDE`):**

| 플랫폼 | 길이 | 문체 | 구조 |
|--------|------|------|------|
| `naver` | 800~1200자 | 친근한 구어체 ("~해요") | 문단 최대 3줄, ## 소제목 2~3개 |
| `wordpress` | 1500~2500자 | 전문적·신뢰감 | H2 섹션 3~4개, H3 세부 |
| `personal` | 1000~1500자 | 1인칭 개인 관점 | 독창적 각도 제시 |

---

## 9. 트렌드 — 댓글 분석

| 항목 | 내용 |
|------|------|
| 파일 | `src/app/api/trends/comments/route.ts` |
| 역할 | 유튜브 영상 댓글 분석 → 크리에이터 인사이트 추출 |
| 모델 | 사용자 선택 |
| Temperature | 기본값 |
| 입력 | videoId, videoTitle, comments (최대 14,000자) |
| 출력 | JSON: sentiment, topThemes, audienceQuestions, contentRequests, painPoints, audienceProfile, scriptIdeas |

**출력 항목 설명:**
| 필드 | 설명 |
|------|------|
| `sentiment` | 긍정/중립/부정 비율 (합계 100) |
| `topThemes` | 주요 댓글 테마 3~5개 + 언급 횟수 |
| `audienceQuestions` | 시청자 자주 묻는 질문 3개 |
| `contentRequests` | 시청자가 원하는 후속 콘텐츠 3개 |
| `painPoints` | 불만 및 개선 요청 |
| `audienceProfile` | 핵심 시청자층 특징 (2~3문장) |
| `scriptIdeas` | 댓글 기반 후속 영상 아이디어 3개 |

**프롬프트 핵심:**
```
당신은 유튜브 크리에이터 전문 컨설턴트입니다.
주의사항:
- 모든 텍스트는 한국어로 작성 (영어 댓글도 한국어로 요약)
- topThemes는 3~5개
- sentiment 합계는 반드시 100
```

---

## 업데이트 기록

| 날짜 | 내용 |
|------|------|
| 2026-04-18 | 초기 작성 — 전체 사이트 프롬프트 9개 영역 수집 |
| 2026-04-18 | 리서처 프롬프트 상세화 — System/User 메시지 구조 분리, Temperature·MaxTokens·JSON mode 추가, wiki 폴백 명시. "프롬프트 핵심은 요약이지 전문이 아님" 주의사항 추가 |
| 2026-04-19 | 7-B 신규 추가 — 카드뉴스 스튜디오 5-에이전트 파이프라인(Researcher→Storyboarder→Copywriter→Editor→Stylist), 6 카드 타입, 12 스타일 팔레트(`src/lib/carousel-styles.ts`), 인포그래픽 전용 레이아웃 분기 |
