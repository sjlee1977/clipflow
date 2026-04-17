# 빌드 전 감사 로그

`npm run build` 실행 시 자동으로 생성되는 코드 감사 기록입니다.

## 파일 명명 규칙
`YYYY-MM-DD_HH-MM.md`

## 감사 항목
- 중복 코드 탐지
- ARCHITECTURE.md ↔ 실제 파일 구조 불일치
- Dead code / 미사용 export
- TypeScript 안전성 (`as any`, `@ts-ignore`)
- 디버그 출력 잔존 (`console.log`)

## 등급
| 등급 | 의미 |
|------|------|
| 심각 | 빌드 차단. 반드시 수정 필요 |
| 경고 | 빌드는 허용. 다음 세션에서 처리 권장 |
| 정보 | 참고용. 즉각 조치 불필요 |
