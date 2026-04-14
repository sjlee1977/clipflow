# 기술 부채 트래커

## 현재 알려진 부채

### 높음
- [ ] `analyze-youtube` 주석에 "Gemini 전용"으로 표기되어 있으나 실제론 다중 모델 지원됨 — CLAUDE.md/ARCHITECTURE.md 동기화 필요
- [ ] Supabase `scripts` 테이블 `metadata` 컬럼 불안정 — 2차 저장 로직으로 우회 중

### 중간
- [ ] `blog/write/route.ts` — 모델이 `gpt-4o-mini` 하드코딩. 다중 모델 지원 미적용
- [ ] `generate-scenes/route.ts` — 에러 처리 패턴이 다른 라우트와 불일치
- [ ] wiki/feedback/ 폴더들 비어있음 — 피드백 수집 프로세스 미시작

### 낮음
- [ ] `remotion/` 씬 타입들 일부 미사용
- [ ] `src/lib/` 내 일부 파일 중복 가능성 (qwen-image vs dashscope-image)

## 해결된 부채
- [x] analyze-youtube 항상 Gemini 호출 버그 → 다중 모델 지원으로 수정
- [x] 블로그 프롬프트 하드코딩 → wiki 시스템으로 분리
- [x] 대본 프롬프트 하드코딩 → wiki 시스템으로 분리
