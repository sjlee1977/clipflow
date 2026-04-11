export type TemplateId =
  | 'classic'
  | 'audiogram'
  | 'captions'
  | 'cinematic'
  | 'split'
  | 'map'
  | '3d'
  | 'slides'
  | 'kinetic'
  | 'codehike'
  | 'lightleak'
  | 'matrix'
  | 'particle';

export interface TemplateMetadata {
  id: TemplateId;
  label: string;
  description: string;
  icon: string; // Lucide icon name
  category: 'social' | 'presentation' | 'creative' | 'technical';
  aspectRatio: '9:16' | '16:9' | '1:1' | 'any';
  difficulty?: 'easy' | 'medium' | 'hard';
}

export const TEMPLATES: TemplateMetadata[] = [
  {
    id: 'classic',
    label: '클래식 스타일',
    description: '이미지와 자막 중심의 표준 레이아웃으로, 모든 비율에서 세련된 균형을 유지합니다.',
    icon: 'Youtube',
    category: 'social',
    aspectRatio: 'any',
  },
  {
    id: 'audiogram',
    label: '오디오그램 (Waveform)',
    description: '나레이션에 맞춰 움직이는 파형 애니메이션을 제공합니다.',
    icon: 'Radio',
    category: 'creative',
    aspectRatio: 'any',
  },
  {
    id: 'captions',
    label: '자막 강조 (TikTok Style)',
    description: '단어 단위로 강조되는 톡톡 튀는 소셜 미디어용 자막 스타일입니다.',
    icon: 'Type',
    category: 'social',
    aspectRatio: '9:16',
  },
  {
    id: 'cinematic',
    label: '시네마틱 (Ken Burns)',
    description: '이미지에 부드러운 줌과 팬 효과를 더해 영화 같은 느낌을 줍니다.',
    icon: 'Film',
    category: 'creative',
    aspectRatio: '16:9',
  },
  {
    id: 'codehike',
    label: '코드 하이크 (Technical)',
    description: '기술적인 코드 리뷰와 튜토리얼에 최적화된 애니메이션입니다.',
    icon: 'Code2',
    category: 'technical',
    aspectRatio: '16:9',
  },
  {
    id: 'split',
    label: '화면 분할 (Split Screen)',
    description: '다양한 미디어를 격자 형태로 배치하여 정보를 전달합니다.',
    icon: 'LayoutGrid',
    category: 'presentation',
    aspectRatio: 'any',
  },
  {
    id: 'slides',
    label: '발표 슬라이드 (PPT)',
    description: '전문적인 발표 자료(PPT) 스타일의 깔끔한 레이아웃입니다.',
    icon: 'Presentation',
    category: 'presentation',
    aspectRatio: '16:9',
  },
  {
    id: 'map',
    label: '수채화 지도 (Travel)',
    description: '여행이나 지리 정보를 지도를 통해 시각화합니다.',
    icon: 'Map',
    category: 'creative',
    aspectRatio: '16:9',
  },
  {
    id: 'kinetic',
    label: '키네틱 타이포',
    description: '텍스트가 리듬에 맞춰 움직이는 강렬한 연출을 제공합니다.',
    icon: 'Zap',
    category: 'social',
    aspectRatio: 'any',
  },
  {
    id: '3d',
    label: '3D 퍼스펙티브',
    description: '공간감이 느껴지는 입체적인 배경과 애니메이션입니다.',
    icon: 'Box',
    category: 'creative',
    aspectRatio: '16:9',
  },
  {
    id: 'lightleak',
    label: '라이트 릭 (Light Leak)',
    description: '빛번짐 렌즈 플레어 효과가 더해진 시네마틱 스타일입니다.',
    icon: 'Sun',
    category: 'creative',
    aspectRatio: 'any',
  },
  {
    id: 'matrix',
    label: '매트릭스 레인',
    description: '녹색 코드 빗줄기가 흐르는 사이버 스타일 배경입니다.',
    icon: 'Terminal',
    category: 'technical',
    aspectRatio: 'any',
  },
  {
    id: 'particle',
    label: '파티클 (Particle)',
    description: '반짝이는 파티클 이펙트가 떠오르는 몽환적인 스타일입니다.',
    icon: 'Sparkles',
    category: 'creative',
    aspectRatio: 'any',
  },
];

export const DEFAULT_TEMPLATE_ID: TemplateId = 'classic';
