-- 미디어 허브 자동 발행 테이블
-- 여행 / 경제 / IT 카테고리별 콘텐츠를 생성·예약·발행하는 시스템

CREATE TABLE IF NOT EXISTS public.media_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 카테고리
  category TEXT NOT NULL CHECK (category IN ('travel', 'economy', 'it')),
  article_type TEXT DEFAULT 'guide',

  -- 주제 정보
  topic TEXT NOT NULL,
  destination TEXT,              -- travel: 여행지 이름
  keyword TEXT,

  -- 리서치 소스 데이터 (Google Places, RSS 등)
  source_data JSONB DEFAULT '{}',

  -- 생성 설정
  llm_model_id TEXT,
  image_model_id TEXT DEFAULT 'fal/flux-schnell',
  platforms TEXT[] DEFAULT '{naver,wordpress,personal}',
  generate_images BOOLEAN DEFAULT true,

  -- 네이버 버전
  naver_title TEXT,
  naver_content TEXT,
  naver_images JSONB DEFAULT '[]',

  -- 워드프레스 버전
  wordpress_title TEXT,
  wordpress_content TEXT,
  wordpress_images JSONB DEFAULT '[]',

  -- 개인 웹사이트 버전
  personal_title TEXT,
  personal_content TEXT,
  personal_images JSONB DEFAULT '[]',

  -- 품질 데이터
  evaluation JSONB,
  refinement_rounds INTEGER DEFAULT 0,

  -- 스케줄
  scheduled_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'generating', 'ready', 'published', 'failed')),

  -- 발행 완료 타임스탬프
  naver_published_at TIMESTAMPTZ,
  wordpress_published_at TIMESTAMPTZ,
  personal_published_at TIMESTAMPTZ,

  -- 에러 추적
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.media_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own media posts"
  ON public.media_posts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 인덱스
CREATE INDEX IF NOT EXISTS media_posts_user_category_idx
  ON public.media_posts(user_id, category, status, scheduled_at);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_media_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER media_posts_updated_at
  BEFORE UPDATE ON public.media_posts
  FOR EACH ROW EXECUTE FUNCTION update_media_posts_updated_at();
