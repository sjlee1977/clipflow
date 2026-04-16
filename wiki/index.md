---
updated: 2026-04-17
ttl: 30
ttl_reason: 파일 추가/삭제 시 목록 갱신 — 월별 검토
volatile: false
---

# 블로그 글쓰기 위키 — 목차

> 이 위키는 ClipFlow AI 블로그 에이전트가 참조하는 살아있는 지식베이스다.
> RAG(검색) 대신 LLM이 직접 유지·합성하는 마크다운 위키 구조를 따른다.
> 에이전트는 글을 쓰기 전에 이 목차를 읽고 필요한 파일만 골라 참조한다.

---

## 작업별 필수 파일 — Selective Loading Guide

> AI는 이 표에서 현재 작업에 해당하는 파일만 읽는다.
> 모든 파일을 한꺼번에 로드하지 않는다.

| 작업 유형 | 읽을 파일 (이것만) |
|---------|----------------|
| 블로그 초고 작성 | `structure.md` + `hook-writing.md` + `writer-persona.md` |
| 블로그 글 평가/채점 | `evaluation-rubric.md` |
| 감정 흐름 / 스토리 강화 | `emotional-flow.md` + `narrative-techniques.md` |
| CTA · 결론 작성 | `cta-writing.md` + `emotional-flow.md` |
| SEO 제목 생성 · 검토 | `seo-principles.md` |
| 숫자 · 데이터 표현 | `numbers-usage.md` |
| 에이전트 프롬프트 수정 | `write-pipeline-agents.md` |
| 파이프라인 전체 흐름 파악 | `ai-blog-pipeline-guide.md` |
| 에이전트 역할 · Temperature 확인 | `multi-agent-roles.md` |
| wiki 유지 관리 · 분할 · TTL 검토 | `knowledge-synthesis.md` |

**여러 작업이 겹칠 때**: 각 행의 파일을 합산. 최대 3개 초과 시 가장 관련성 높은 것 우선.

---

## 전체 파일 목록

### 핵심 원칙 파일 (글쓰기 에이전트 필수 참조)

| 파일 | 핵심 내용 | 사용 시점 |
|---|---|---|
| `blog/hook-writing.md` | A/B/C형 도입부 훅으로 독자를 붙잡는 법 | 항상 |
| `blog/structure.md` | 5막 서사 구조 전체 설계 원칙 | 항상 |
| `blog/writer-persona.md` | 작가 페르소나 + 금지 표현 전체 목록 | 항상 |
| `blog/emotional-flow.md` | 5단계 감정 흐름 설계 (긴장→공감→놀람→안도→행동) | 스토리텔링 필요 시 |
| `blog/narrative-techniques.md` | 7가지 서사 심화 기법 | 표현 다양화 필요 시 |
| `blog/cta-writing.md` | 독자 행동 유도 결론 작성법 | 항상 |
| `blog/seo-principles.md` | 키워드를 자연스럽게 녹이는 SEO 원칙 | SEO 목적 글 |
| `blog/numbers-usage.md` | 숫자·데이터를 와닿게 전달하는 법 | 데이터 포함 시 |

### 평가·시스템 파일 (평가자/편집자/파이프라인 참조)

| 파일 | 핵심 내용 | 사용 시점 |
|---|---|---|
| `blog/evaluation-rubric.md` | 10차원 × 10점 = 100점 채점 루브릭 | 평가자 에이전트 |
| `blog/multi-agent-roles.md` | 6개 에이전트 역할 정의 + Temperature | 파이프라인 설계 |
| `blog/ai-blog-pipeline-guide.md` | 전체 파이프라인 흐름 + SEO 제목·채점·모델 설계 (섹션 1~4, 8~11) | 시스템 레벨 |
| `blog/write-pipeline-agents.md` | 글쓰기 6개 에이전트 프롬프트 + 인간 필기감 + 할루시네이션 탐지 | 에이전트 프롬프트 참조 |
| `blog/knowledge-synthesis.md` | 지식 연결·교차 참조·TTL·분할 원칙 (프론트매터 스키마 포함) | 위키 유지 시 |

---

## 파일 간 연결 지도 (Knowledge Graph)

```
hook-writing.md ─────┐
                     ↓
structure.md ─────→ emotional-flow.md ──→ cta-writing.md
     │                    │
     ↓                    ↓
writer-persona.md  narrative-techniques.md
     │                    │
     └──────┬─────────────┘
            ↓
     evaluation-rubric.md  ←── numbers-usage.md
            │                  seo-principles.md
            ↓
     multi-agent-roles.md
            ↓
     ai-blog-pipeline-guide.md (전체 권위 문서)
```

**핵심 연결 관계:**
- `hook-writing.md` ↔ `emotional-flow.md` — 훅의 유형이 감정 흐름의 시작점을 결정
- `structure.md` ↔ `hook-writing.md` — 5막 1막이 훅으로 구성됨
- `structure.md` ↔ `cta-writing.md` — 5막 5막이 CTA로 끝남
- `writer-persona.md` ↔ `evaluation-rubric.md` — 금지 표현 목록이 루브릭 7번 차원의 판단 기준
- `emotional-flow.md` ↔ `evaluation-rubric.md` — 5단계 감정 흐름이 루브릭 5번 차원의 기준
- `multi-agent-roles.md` ↔ `ai-blog-pipeline-guide.md` — 역할 정의와 실제 프롬프트의 관계

---

## 위키 운영 원칙 (Karpathy LLM Wiki 패턴)

### Ingest — 새 지식이 생겼을 때
1. 어느 파일에 속하는지 판단 (기존 파일 확장 vs 새 파일 생성)
2. 관련 파일 업데이트
3. 연결된 파일들의 "## 관련 문서" 섹션에 교차 참조 추가
4. 이 `index.md`의 업데이트 기록에 날짜·내용 추가
5. `ai-blog-pipeline-guide.md`의 실제 프롬프트에도 반영 필요 여부 확인

### Query — 정보를 찾을 때
1. 이 index.md에서 관련 파일 찾기
2. 해당 파일의 "## 관련 문서" 섹션으로 연결 파일 탐색
3. `ai-blog-pipeline-guide.md`는 전체 파이프라인 참조 시 단독으로 충분

### Lint — 모순·불일치 정기 점검

아래 항목은 파일 간 동기화가 필요한 곳이다. 작업 전 이 목록을 확인한다:

- [ ] `evaluation-rubric.md` 차원 수 = `ai-blog-pipeline-guide.md` 차원 수 **→ 현재: 10차원**
- [ ] `multi-agent-roles.md` 에이전트 수 = `ai-blog-pipeline-guide.md` 에이전트 수 **→ 현재: 6개**
- [ ] 금지 표현 목록: `writer-persona.md` = `ai-blog-pipeline-guide.md` Agent 2 프롬프트
- [ ] Temperature 설정: `multi-agent-roles.md` = `ai-blog-pipeline-guide.md` 섹션 10
- [ ] 각 파일의 "## 관련 문서" 섹션이 현재 파일명을 정확히 참조하는지 확인
- [ ] `ai-blog-pipeline-guide.md` 관련 파일 경로가 실제 라우트 파일과 일치하는지 확인
- [ ] 각 파일 프론트매터 `updated` 날짜 — 오늘(`2026-04-16`) 기준 TTL 만료 파일 없는지 확인
  - TTL 60일: evaluation-rubric, multi-agent-roles, pipeline guides → **만료일: 2026-06-15**
  - TTL 90일: seo-principles → **만료일: 2026-07-15**
  - TTL 180일: writer-persona, cta-writing, knowledge-synthesis → **만료일: 2026-10-13**
  - TTL 365일: 나머지 원칙 파일들 → **만료일: 2027-04-16**
- [ ] `volatile: true` 파일(seo-principles.md) — 알고리즘 변경 공지 시 즉시 검토

---

## 업데이트 기록

- 2026-04-14: 초기 위키 구축 (6개 원칙 파일)
- 2026-04-16: Karpathy LLM Wiki 패턴 적용 — 전체 파일 목록 정비, Knowledge Graph, Ingest/Query/Lint 운영 원칙 추가 / `evaluation-rubric.md` 10차원 동기화 / `multi-agent-roles.md` 6에이전트 동기화 / `knowledge-synthesis.md` 신규 추가 / 전체 파일 TTL 프론트매터 추가 / `ai-blog-pipeline-guide.md`(753줄) → `write-pipeline-agents.md` 분할 (421줄 + 380줄)
- 2026-04-17: 사용자별 knowledge 레이어 구축 — `wiki/knowledge/index.md` 추가 / Supabase `user_wiki_pages` 테이블(journal·knowledge·source) / 수집 파이프라인(`/api/wiki/sources/ingest`) + 품질 필터(구조적+LLM) / write-agent에 Agent 0(Knowledge Gatherer) + 글 완성 후 knowledge 자동 추출 저장
