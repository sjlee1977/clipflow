# ClipFlow — 디자인 원칙

## UI 철학
- **작업 중심**: 사용자가 원하는 것은 결과물. 불필요한 단계 제거.
- **진행 상태 가시화**: AI 생성 중 로딩은 의미 있는 애니메이션으로 (orbit/scanline 패턴).
- **다크/라이트 테마**: 모든 컴포넌트는 `ThemeToggle` 기반 테마를 지원해야 함.

## 색상 시스템
- 기본: Tailwind CSS 유틸리티 클래스 사용
- YouTube 관련 UI: `#ef4444` (red-500) 사용
- 성공/완료: `#22c55e` (green-500)
- 경고/AI 처리 중: amber 계열

## 레이아웃
- 대시보드: `dashboard/layout.tsx` — 사이드바 + 메인 콘텐츠 2열 구조
- 사이드바: `SidebarScripts.tsx` — 저장된 대본 목록 표시
- 반응형: 모바일 대응 필수 (Tailwind `sm:`, `md:` 브레이크포인트)

## 로딩 애니메이션 패턴
YouTube 분석 등 긴 AI 작업에 사용:
```
orbit (3 dots rotating) + pulse-ring center + scanline bar + step text
```
참고 구현: `dashboard/prompt/page.tsx` → `handleYoutubeAnalyze()`

## 컴포넌트 규칙
- 공유 컴포넌트는 `src/components/`에만 위치
- 페이지 전용 컴포넌트는 해당 페이지 파일 내 인라인
- 3개 이상 페이지에서 재사용되면 `src/components/`로 분리
