---
updated: 2026-04-17
ttl: 30
ttl_reason: 카테고리 추가/변경 시 갱신 — 월별 검토
volatile: false
---

# Knowledge Wiki — 주제별 축적 지식 인덱스

> 이 폴더의 지식은 **사용자마다 다르다.**
> 파일은 구조/예시 가이드만 담고, 실제 내용은 Supabase `user_wiki_pages(type='knowledge')`에 쌓인다.
> 글을 쓸 때마다 조사한 내용을 저장하면, 다음 글은 그 지식을 재료로 시작한다.

---

## 카테고리 체계

| category | topic 예시 | 설명 |
|----------|-----------|------|
| `finance` | private-loans, crypto, real-estate, stock-market | 금융·경제 주제 |
| `psychology` | loss-aversion, confirmation-bias, dopamine | 심리·행동 주제 |
| `health` | intermittent-fasting, sleep, exercise-science | 건강·의학 주제 |
| `tech` | ai-tools, smartphone, ev, app-review | IT·기술 주제 |
| `society` | generation-mz, housing, employment, education | 사회·트렌드 주제 |
| `general` | (기타) | 분류 전 임시 저장 |

---

## knowledge 페이지 구조 — 작성 템플릿

```markdown
---
category: finance
topic: private-loans
tags: [사모대출, 고금리, 서민금융]
updated: YYYY-MM-DD
---

# [주제명] — 축적 지식

## 핵심 정의
(한 문단: 이게 뭔지 한눈에 알 수 있는 정의)

## 핵심 수치 / 데이터
- 수치1: 출처 포함
- 수치2: 출처 포함

## 독자 고통 포인트
- 실제로 사람들이 겪는 문제 (경험담, 커뮤니티 반응)

## 차별화 앵글 목록
1. 앵글A: ...
2. 앵글B: ...

## 주의/오해 (팩트체크 포인트)
- 흔한 오해와 실제

## 관련 주제
- `finance/crypto` — 연결 이유
```

---

## Agent 0 — Knowledge Gatherer 동작 방식

글 작성 요청이 들어오면 Agent 1(리서처) **전에** 실행된다.

```
입력: keyword + content 텍스트
  ↓
Supabase 쿼리:
  user_wiki_pages WHERE type IN ('knowledge','source')
  AND (topic ILIKE '%keyword%' OR title ILIKE '%keyword%' OR tags @> [keyword])
  ORDER BY updated_at DESC LIMIT 5
  ↓
결과가 있으면 → knowledge_context 문자열로 포맷
결과가 없으면 → 빈 문자열 (Agent 1이 기본 동작)
  ↓
Agent 1 시스템 프롬프트에 주입
```

**결과가 없어도 파이프라인은 중단되지 않는다.**
첫 글은 기존처럼 동작하고, 글이 쌓일수록 knowledge가 축적되어 점점 풍부해진다.

---

## 지식 축적 흐름 (복리 구조)

```
글 작성 요청
    │
    ▼
[Agent 0] Supabase knowledge 쿼리
    │ 없으면 skip
    ▼
[Agent 1] knowledge context + 원본 내용으로 아웃라인 설계
    │
    ▼
... 글 완성 ...
    │
    ▼
[journal 자동 저장]  ← 이미 구현됨
    │
    ▼ (수동 or 향후 자동화)
[knowledge 페이지 생성/업데이트]
— 이번에 조사된 사실/데이터를 knowledge에 추가
```

쓸수록 knowledge가 두꺼워지고 → 두꺼울수록 Agent 0이 더 풍부한 context를 제공한다.

---

## 관련 문서

- `wiki/index.md` — 전체 wiki 목차
- `wiki/blog/knowledge-synthesis.md` — 3계층 지식 구조 원칙
- Supabase `user_wiki_pages` — 실제 사용자 지식 저장소
