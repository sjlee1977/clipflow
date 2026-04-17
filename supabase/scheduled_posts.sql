-- 블로그 자동화 스케줄 테이블
-- 플랫폼별(네이버/워드프레스/개인) 콘텐츠를 미리 생성해두고 예약 발행하는 시스템

CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 캘린더 연동 (content_plans 테이블의 blog 항목)
  content_plan_id UUID REFERENCES public.content_plans(id) ON DELETE SET NULL,

  -- 주제 정보
  topic TEXT NOT NULL,
  keyword TEXT NOT NULL,

  -- SEO 데이터
  seo_platform TEXT DEFAULT 'naver',
  search_volume INTEGER,
  competition TEXT,
  content_saturation INTEGER,
  trend_direction TEXT,
  related_keywords TEXT[] DEFAULT '{}',

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
  outline JSONB,
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
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own scheduled posts"
  ON public.scheduled_posts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 인덱스
CREATE INDEX IF NOT EXISTS scheduled_posts_user_status_idx
  ON public.scheduled_posts(user_id, status, scheduled_at);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_scheduled_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scheduled_posts_updated_at
  BEFORE UPDATE ON public.scheduled_posts
  FOR EACH ROW EXECUTE FUNCTION update_scheduled_posts_updated_at();
