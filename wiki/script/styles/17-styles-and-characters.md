---
updated: 2026-05-31
ttl: 365
source: ConGen 채널 2편 (2026-03-27) — "60일만에 완성 국내 최고의 자동화 프로그램"
---

# 17 스타일 + 캐릭터 시스템

> "같은 도구를 써도 결과물이 전부 다릅니다.
>  그 조합이 곧 여러분만의 영상 브랜드가 됩니다."
> — ConGen 2편

---

## 핵심 통찰

**카테고리 × 스타일 × 캐릭터 = 무한 조합**

| 축 | 예시 | 효과 |
|---|---|---|
| **카테고리** (6개) | economy, psychology, horror, health, history, general | 톤·구조·길이 |
| **스타일** (17개) | 실사·일러스트·모션그래픽·픽셀아트... | 시각 톤 |
| **캐릭터** (가변) | 나레이터·진행자·인물 등 | 인격·voice |

→ 6 × 17 × 가변 = **수백 가지 영상 변형**. 같은 도구로 사용자마다 다른 브랜드.

---

## 17 스타일 후보 (영상 6편 미공개·추정)

(영상에서 전체 17개 시각 안 함. 일반 영상 스타일 카테고리 기준 후보)

| # | 스타일 | 어울리는 카테고리 |
|---|---|---|
| 1 | 실사 (Photo Realistic) | economy, health, history |
| 2 | 일러스트 (Illustration) | psychology, general |
| 3 | 모션 그래픽 (Motion Graphics) | economy, general |
| 4 | 픽셀 아트 (Pixel Art) | history, horror |
| 5 | 미니멀 (Minimalist) | economy, general |
| 6 | 다크 무드 (Dark Mood) | horror, psychology |
| 7 | 빈티지 필름 (Vintage Film) | history |
| 8 | 사이버펑크 (Cyberpunk) | horror, psychology |
| 9 | 수채화 (Watercolor) | health, general |
| 10 | 종이 콜라주 (Paper Collage) | history, general |
| 11 | 라인 드로잉 (Line Drawing) | psychology, general |
| 12 | 3D 렌더 (3D Render) | economy, general |
| 13 | 폴라로이드 (Polaroid) | history, psychology |
| 14 | 무성 영화 (Silent Movie) | horror, history |
| 15 | 뉴스 톤 (News Style) | economy, general |
| 16 | 다큐멘터리 (Documentary) | history, health |
| 17 | 추상 (Abstract) | psychology |

→ **출시 시 5~7개로 시작 → 사용자 피드백으로 확장.**

---

## 캐릭터 시스템

### 캐릭터 = 영상의 인격
- **나레이터**: 성우 톤·속도·억양
- **진행자**: 정면 등장 · 표정 · 제스처
- **인물 (스토리)**: 등장인물 디자인 통일

### 필수 요소
| 요소 | 정의 |
|---|---|
| **이름·역할** | "장년 남성 나레이터, 차분한 톤" |
| **목소리** | ElevenLabs voice ID 또는 TTS 설정 |
| **시각 표현** | 일관된 아바타·일러스트 |
| **언어 습관** | 자주 쓰는 어휘·말투 |

---

## ClipFlow 구현 청사진

### 폴더 구조
```
wiki/script/styles/
├── 17-styles-and-characters.md (이 파일)
├── style-presets/
│   ├── photo-realistic.md
│   ├── illustration.md
│   ├── motion-graphics.md
│   └── ... (5~7개로 시작)
└── characters/
    ├── narrator-male-deep.md
    ├── narrator-female-calm.md
    └── ...
```

### API 매핑
- 사용자 영상 생성 시 → 스타일 + 캐릭터 1개씩 선택
- AI가 wiki에서 해당 정의 로드 → 프롬프트에 inject
- Remotion 렌더 시 일관 적용

### 카테고리와의 결합
```
사용자: "심리 영상 만들어줘"
       ↓
카테고리: psychology (자동 분류)
       ↓
추천 스타일: 다크 무드 / 라인 드로잉 / 추상 (3개)
       ↓
사용자 1개 선택
       ↓
캐릭터: 추천 3개 중 선택
       ↓
영상 생성 (카테고리 × 스타일 × 캐릭터)
```

---

## v1 출시 시 권장

| 항목 | v1 | v2 | v3 |
|---|---|---|---|
| 카테고리 | 6 (기존) | 8~10 | 15 |
| 스타일 | **5** | 10 | 17 |
| 캐릭터 | **3** | 8 | 가변 |
| 조합 가능 | 90 | 800 | 무한 |

→ **v1 = 5 × 3 × 6 = 90 조합. 충분히 많음.** 사용자 부담 적게 시작.

---

## 마케팅 메시지

> **"같은 ClipFlow를 써도 영상이 모두 다릅니다. 그 조합이 당신만의 브랜드입니다."**

vs Vrew·Pictory:
- 그들 = 1 스타일 × 1 톤 = 같은 영상 양산
- ClipFlow = N × M × K = **모든 사용자가 다른 결과**

---

## 영상 시점 (2편)

3:20 "스타일 & 캐릭터" 챕터 시작
