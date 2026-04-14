# 대본 생성 위키 — 목차

## 공유 구조
- `_shared/7-stage-structure.md` — 기본 7단계 구조 (경제/일반 카테고리 기본값)

## 카테고리별 원칙
| 카테고리 | 정체성 | 톤 | 전용 프롬프트 | 단계 적응 | 원칙 |
|---------|-------|-----|-------------|---------|-----|
| economy | economy/identity.md | economy/tone.md | — | economy/stage-notes.md | economy/principles.md |
| psychology | psychology/identity.md | psychology/tone.md | psychology/full-prompt.md | — | psychology/principles.md |
| horror | horror/identity.md | horror/tone.md | — | horror/stage-notes.md | horror/principles.md |
| health | health/identity.md | health/tone.md | — | health/stage-notes.md | health/principles.md |
| history | history/identity.md | history/tone.md | — | history/stage-notes.md | history/principles.md |
| general | general/identity.md | general/tone.md | — | — | general/principles.md |

## 피드백
- `feedback/{category}/YYYY-MM-DD.md` — 카테고리별 최신 피드백 (가장 최신 파일 자동 로드)

## 운영 규칙
1. 파일이 존재하면 → 위키 파일 사용
2. 파일이 없으면 → 코드 내 하드코딩 폴백 사용
3. 원칙 파일은 시스템 프롬프트 마지막에 추가로 삽입
4. 피드백 파일은 "반드시 반영" 섹션으로 삽입
