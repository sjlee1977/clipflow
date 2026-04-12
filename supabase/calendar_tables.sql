-- ============================================================
-- ClipFlow 콘텐츠 캘린더 테이블
-- Supabase SQL Editor에서 실행
-- ============================================================

-- 콘텐츠 시리즈
CREATE TABLE IF NOT EXISTS public.content_series (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  description TEXT,
  episode_count INTEGER DEFAULT 5,
  episodes JSONB DEFAULT '[]'::jsonb,
  -- episodes 구조: [{episode_number, title, description, keywords, scheduled_at}]
  status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 콘텐츠 계획 (캘린더 아이템)
CREATE TABLE IF NOT EXISTS public.content_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content_type TEXT DEFAULT 'video' CHECK (content_type IN ('video', 'short', 'blog', 'carousel', 'reel', 'thread')),
  platform TEXT DEFAULT 'youtube' CHECK (platform IN ('youtube', 'instagram', 'tiktok', 'blog', 'linkedin', 'twitter')),
  status TEXT DEFAULT 'idea' CHECK (status IN ('idea', 'writing', 'editing', 'scheduled', 'published')),
  scheduled_at DATE,
  series_id UUID REFERENCES public.content_series(id) ON DELETE SET NULL,
  episode_number INTEGER,
  source_trend_title TEXT,
  source_trend_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE public.content_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_plans ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 본인 데이터만 접근
CREATE POLICY "users can manage own series"
  ON public.content_series FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can manage own plans"
  ON public.content_plans FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_content_plans_user_date ON public.content_plans (user_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_content_plans_series ON public.content_plans (series_id);
CREATE INDEX IF NOT EXISTS idx_content_series_user ON public.content_series (user_id);
