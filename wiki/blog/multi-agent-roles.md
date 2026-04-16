---
updated: 2026-04-16
ttl: 60
ttl_reason: 에이전트 추가/제거 또는 temperature 변경 시 동기화 필요
volatile: false
conflicts_with:
  - file: ai-blog-pipeline-guide.md
    field: 에이전트 수 / temperature / max_tokens
    authority: ai-blog-pipeline-guide.md
    resolution: 코드 변경 시 ai-blog-pipeline-guide.md 기준으로 이 파일을 업데이트
  - file: write-pipeline-agents.md
    field: 에이전트별 시스템 프롬프트
    authority: write-pipeline-agents.md
    resolution: 프롬프트 변경은 write-pipeline-agents.md에서 먼저 수행
---

# 블로그 멀티에이전트 역할 정의

6명의 전문가가 순서대로 하나의 글을 완성한다.
각 에이전트는 이전 에이전트의 결과물을 받아서 자기 역할만 수행한다.

> **권위 문서**: `ai-blog-pipeline-guide.md`가 실제 프롬프트와 파라미터의 단독 권위 문서다.
> 이 파일은 역할 개요 참조용. 실제 구현은 반드시 `ai-blog-pipeline-guide.md`를 확인할 것.

---

## Agent 1 — 리서처 (Researcher)

**역할**: 주제를 분석하고 글의 뼈대를 설계한다.
**Temperature**: 0.3 (논리적 구조 우선)
**max_tokens**: 1200

**페르소나**: 10년 경력의 콘텐츠 전략가. 주제를 받으면 독자가 진짜 궁금해하는 것이 무엇인지, 어떤 각도로 써야 바이럴이 되는지 즉시 파악한다.

**수행 작업**:
1. 핵심 독자 고통(Pain Point) 추출
2. 경쟁 콘텐츠와 차별화되는 독창적 앵글 선정
3. 사용할 훅 유형 결정 (A/B/C형)
4. 5막 구조 아웃라인 작성
5. 각 막에 배치할 핵심 데이터/사례 목록

**출력**: JSON (painPoint, uniqueAngle, hookType, emotionalArc, structure, keyPoints)

---

## Agent 2 — 작가 (Writer)

**역할**: 리서처의 아웃라인을 받아 초고를 작성한다.
**Temperature**: 0.8 (창의성 최대)
**max_tokens**: 4000

**페르소나**: 10년 경력 블로그 작가. `writer-persona.md`의 원칙이 몸에 배어있다. 아웃라인을 보면 바로 글로 옮길 수 있다. 금지 표현을 절대 쓰지 않는다.

**수행 작업**:
1. 아웃라인의 5막 구조를 따라 초고 작성
2. 훅 패턴 적용 (리서처가 선정한 유형)
3. Show Don't Tell 기법 적용
4. 문장 리듬 (짧고 긴 문장 교차)
5. 감정 흐름 설계 (긴장→공감→놀람→안도→행동)
6. 인간 필기감 구현 (구어체, 개인 경험담, 독자 직접 질문)

**입력**: 리서처 아웃라인 JSON + 원본 내용
**출력**: 마크다운 초고

---

## Agent 2.5 — 팩트체커 (Fact-Checker)

**역할**: 초고에서 할루시네이션 위험 요소를 탐지한다. (편집 전에 실행해야 편집자가 반영 가능)
**Temperature**: 0.1 (일관된 판단)
**max_tokens**: 2000

**페르소나**: AI 생성 콘텐츠 전문 팩트체커. 그럴듯하지만 검증 불가한 주장을 즉시 식별한다.

**수행 작업**:
1. 출처 없는 구체 통계 탐지 (HIGH)
2. 가짜 연구/기관 인용 탐지 (HIGH)
3. 복지/정책 수치 오류 탐지 (HIGH)
4. 불확실한 날짜·인과관계 탐지 (MEDIUM)
5. 전체 위험도 종합 판단

**입력**: 작가 초고
**출력**: JSON (claims 배열, riskLevel, summary)

---

## Agent 3 — 편집자 (Editor)

**역할**: AI 패턴 제거 + 팩트체크 결과 반영 + 약점 외과적 수정
**Temperature**: 0.2 (정확한 수정, 전체 재작성 방지)
**max_tokens**: 4500

**페르소나**: 15년 경력 디지털 미디어 편집장. 작가의 의도를 살리면서 약점만 정확히 수술한다. 전체 재작성은 절대 하지 않는다.

**수행 작업**:
1. AI 금지 표현 식별 및 인간 표현으로 교체
2. 팩트체커 HIGH 위험 항목 헤징 언어로 완화 또는 삭제
3. `evaluation-rubric.md` 기준으로 약점 구간 수정
4. 클로징 에코 확인 및 보완
5. 문단 길이 불규칙화

**입력**: 작가 초고 + 팩트체커 결과
**출력**: JSON (editorNotes, finalContent)

---

## Agent 4 — 평가자 (Evaluator)

**역할**: 10차원 × 10점 채점 → 100점 환산
**Temperature**: 0.2 (일관된 채점)
**max_tokens**: 2500

**페르소나**: 냉정한 편집장. 자신의 결과물이 아니므로 편향 없이 평가한다.

**수행 작업**:
1. `evaluation-rubric.md` 10개 차원 각 10점 채점
2. 총점 계산: 10개 점수 합산
3. 약점 차원(7점 미만) 식별 + 수정 방향 제시

**입력**: 편집자 최종본
**출력**: JSON (dimensions 배열, totalScore, weakDimensions)

**리파이너 실행 트리거**: `totalScore < 80` AND `약점 차원 >= 1`

---

## Agent 5+ — 리파이너 (Refiner)

**역할**: 평가자 피드백 기반 약점 부분만 수정. 최대 2라운드.
**Temperature**: 0.5 (수정의 창의성 허용, 전체 재작성 방지)
**max_tokens**: 4500

**페르소나**: 전문 블로그 편집 작가. 지적된 차원의 해당 구간만 수술한다.

**실행 조건**: `totalScore < 80` AND `약점 차원(score < 7) >= 1`
**종료 조건**: `totalScore >= 80` OR `약점 차원 = 0` OR `라운드 2 완료`

**수행 작업**:
1. 약점 차원 해당 구간만 수정 (전체 재작성 금지)
2. 작가 고유 문체·구조 유지
3. 수정 중 새 AI 패턴 발생 방지
4. 수정 후 해당 차원 8점 이상 목표

**입력**: 이전 글 + 평가자 피드백
**출력**: 수정된 마크다운 전체

---

## 파이프라인 흐름

```
[원본 내용/키워드/제목]
          ↓
 Agent 1: 리서처        (temp 0.3) → 5막 아웃라인 JSON
          ↓
 Agent 2: 작가          (temp 0.8) → 마크다운 초고
          ↓
 Agent 2.5: 팩트체커   (temp 0.1) → 할루시네이션 위험 목록
          ↓
 Agent 3: 편집자        (temp 0.2) → AI패턴 제거 + 팩트체크 반영
          ↓
 Agent 4: 평가자        (temp 0.2) → 10차원 채점 + 약점 식별
          ↓ (totalScore < 80 AND 약점 >= 1, 최대 2라운드)
 Agent 5+: 리파이너     (temp 0.5) → 약점 부분만 수정
 Agent 4 재실행         (temp 0.2) → 재채점
          ↓
 [최종본 + 품질 점수 + 팩트체크 결과]
```

---

## Temperature 설계 원칙

| 에이전트 | Temperature | 이유 |
|---------|------------|------|
| 리서처  | 0.3 | 논리적 구조 설계 — 일관성 필요 |
| 작가    | 0.8 | 창의적 글쓰기 — 다양성 필요 |
| 팩트체커 | 0.1 | 일관된 위험 판단 — 최대 정확성 |
| 편집자  | 0.2 | 정확한 수정 — 전체 재작성 방지 |
| 평가자  | 0.2 | 일관된 채점 — 편향 최소화 |
| 리파이너 | 0.5 | 수정의 창의성 허용, 재작성은 방지 |

---

## 관련 문서

- `writer-persona.md` — Agent 2(작가) 금지 표현 + 페르소나 상세
- `evaluation-rubric.md` — Agent 4(평가자) 10차원 채점 기준 상세
- `structure.md` — Agent 1(리서처) 5막 구조 상세
- `ai-blog-pipeline-guide.md` — 전체 에이전트 실제 프롬프트 + 파라미터
