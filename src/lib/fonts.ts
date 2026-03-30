export type KoreanFont = {
  id: string;       // CSS font-family 이름
  label: string;    // UI 표시 이름
  cssUrl: string;   // 폰트 CSS 로드 URL
};

export const KOREAN_FONTS: KoreanFont[] = [
  {
    id: 'Noto Sans KR',
    label: 'Noto Sans KR',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700;800;900&display=swap',
  },
  {
    id: 'Pretendard',
    label: '프리텐다드',
    cssUrl: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css',
  },
  {
    id: 'SCDream',
    label: '에스코어드림',
    cssUrl: 'https://cdn.jsdelivr.net/gh/sunn-us/S-Core-Dream/S-CoreDream.css',
  },
  {
    id: 'Black Han Sans',
    label: '검은고딕',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Black+Han+Sans&display=swap',
  },
  {
    id: 'Do Hyeon',
    label: '도현체',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Do+Hyeon&display=swap',
  },
  {
    id: 'Jua',
    label: '주아체',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Jua&display=swap',
  },
  {
    id: 'Gothic A1',
    label: 'Gothic A1',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Gothic+A1:wght@700;800;900&display=swap',
  },
  {
    id: 'Nanum Gothic',
    label: '나눔고딕',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@700;800&display=swap',
  },
  {
    id: 'Nanum Myeongjo',
    label: '나눔명조',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@700;800&display=swap',
  },
  {
    id: 'IBM Plex Sans KR',
    label: 'IBM Plex Sans KR',
    cssUrl: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@600;700&display=swap',
  },
];

export const DEFAULT_FONT_ID = 'Noto Sans KR';
