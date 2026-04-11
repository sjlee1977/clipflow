-- 캐러셀 저장 테이블
CREATE TABLE IF NOT EXISTS carousels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  topic TEXT NOT NULL,
  cards JSONB NOT NULL,
  card_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE carousels ENABLE ROW LEVEL SECURITY;

-- 본인 데이터만 접근 허용
CREATE POLICY "Users can manage their own carousels"
  ON carousels
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 최신순 인덱스
CREATE INDEX IF NOT EXISTS carousels_user_id_created_at_idx ON carousels(user_id, created_at DESC);
