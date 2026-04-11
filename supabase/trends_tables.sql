-- =============================================
-- Clipflow Trends 기능 - Supabase SQL
-- Supabase Dashboard > SQL Editor에서 실행하세요
-- =============================================

-- 1. 사용자별 트렌드 감지 설정
CREATE TABLE IF NOT EXISTS trend_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  categories TEXT[] DEFAULT ARRAY['gaming', 'entertainment'],
  outlier_multiplier FLOAT DEFAULT 3.0,       -- 채널 평균 대비 N배 이상 = 이상치
  viral_threshold_hourly FLOAT DEFAULT 300.0, -- 시간당 N회 이상 증가 = 바이럴
  is_active BOOLEAN DEFAULT true,
  last_discovery_at TIMESTAMPTZ,              -- 마지막 영상 탐색 시각
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- 2. 모니터링 채널 (시스템 공통)
CREATE TABLE IF NOT EXISTS trend_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT UNIQUE NOT NULL,
  channel_name TEXT,
  channel_thumbnail TEXT,
  category TEXT NOT NULL,
  subscriber_count BIGINT DEFAULT 0,
  avg_views BIGINT DEFAULT 0,                 -- 최근 20개 영상 평균 조회수
  avg_views_updated_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 트렌드 감지 대상 영상 (시스템 공통)
CREATE TABLE IF NOT EXISTS trend_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT UNIQUE NOT NULL,
  channel_id TEXT,                            -- trend_channels.channel_id 참조 (느슨한 참조)
  title TEXT,
  thumbnail TEXT,
  category TEXT,
  region TEXT DEFAULT 'KR',                   -- 'KR','US','GB','JP','FR'
  published_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,             -- 7일 이상 된 영상은 false
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. 조회수 스냅샷 (시계열 데이터)
CREATE TABLE IF NOT EXISTS trend_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT NOT NULL,
  views BIGINT NOT NULL,
  likes INTEGER,
  captured_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trend_snapshots_video_time
  ON trend_snapshots(video_id, captured_at DESC);

-- 5. 바이럴/이상치 시그널 캐시
CREATE TABLE IF NOT EXISTS trend_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT NOT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('viral', 'outlier')),
  score FLOAT,
  channel_avg_views BIGINT,
  current_views BIGINT,
  multiplier FLOAT,                           -- 채널 평균 대비 배율 (outlier용)
  growth_rate_hourly FLOAT,                   -- 시간당 조회수 증가량 (viral용)
  detected_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(video_id, signal_type)
);

-- =============================================
-- RLS (Row Level Security) 설정
-- =============================================

ALTER TABLE trend_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_signals ENABLE ROW LEVEL SECURITY;

-- trend_settings: 본인 데이터만 읽기/쓰기
CREATE POLICY "trend_settings_self" ON trend_settings
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- trend_channels, trend_videos, trend_snapshots, trend_signals: 로그인 사용자 모두 읽기 가능
CREATE POLICY "trend_channels_read" ON trend_channels
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "trend_videos_read" ON trend_videos
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "trend_snapshots_read" ON trend_snapshots
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "trend_signals_read" ON trend_signals
  FOR SELECT USING (auth.role() = 'authenticated');

-- service_role(cron worker)은 모든 테이블에 쓰기 가능 (RLS 우회)
-- Supabase service_role key 사용 시 자동으로 RLS 우회됨
