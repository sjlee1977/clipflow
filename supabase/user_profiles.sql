-- =============================================
-- Clipflow 회원 티어 + 사용량 관리
-- Supabase Dashboard > SQL Editor에서 실행하세요
-- =============================================

-- 1. 회원 프로필 (티어 관리)
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'guest'
    CHECK (tier IN ('guest', 'tier1', 'tier2', 'tier3', 'admin')),
  memo TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_profiles_self_read" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

-- 2. 사용량 로그 (guest 일/월 제한 추적)
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,  -- 'script','video','blog','thumbnail','reformat','keyword','trends','competitor','comments'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_user_time
  ON usage_logs(user_id, created_at DESC);

ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usage_logs_self" ON usage_logs
  FOR SELECT USING (auth.uid() = user_id);

-- 3. 신규 가입 시 자동으로 guest 프로필 생성
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, tier)
  VALUES (NEW.id, 'guest')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
