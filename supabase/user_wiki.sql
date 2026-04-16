-- 사용자별 위키 페이지 테이블
--
-- type:
--   'knowledge' — 주제별 축적 지식 (사모대출, 금리, 심리학 등)
--   'source'    — 크롤링/스크랩한 원본 자료
--   'journal'   — 글 작성 세션 자동 기록
--
-- category: 대분류 ('finance', 'psychology', 'health', 'tech', 'general')
-- topic:    소분류 슬러그 ('private-loans', 'crypto', 'loss-aversion')
--
-- metadata (JSONB):
--   journal  → { keyword, title_used, score, model, word_count, tone, length, outline }
--   knowledge→ { source_url, key_facts[], auto_extracted, extracted_from_journal_id }
--   source   → { url, crawled_at, quality_score, word_count }

CREATE TABLE IF NOT EXISTS user_wiki_pages (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  type        TEXT    NOT NULL CHECK (type IN ('knowledge', 'source', 'journal')),
  category    TEXT    NOT NULL DEFAULT 'general',
  topic       TEXT    NOT NULL DEFAULT '',
  title       TEXT    NOT NULL,
  content     TEXT    NOT NULL,

  tags        TEXT[]  NOT NULL DEFAULT '{}',
  ttl         INTEGER NOT NULL DEFAULT 365,
  volatile    BOOLEAN NOT NULL DEFAULT FALSE,
  metadata    JSONB   NOT NULL DEFAULT '{}',

  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE user_wiki_pages ENABLE ROW LEVEL SECURITY;

-- 본인 데이터만 접근
CREATE POLICY "Users can manage their own wiki pages"
  ON user_wiki_pages
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 자주 쓰는 쿼리 인덱스
CREATE INDEX IF NOT EXISTS user_wiki_pages_user_type_idx
  ON user_wiki_pages(user_id, type, created_at DESC);

CREATE INDEX IF NOT EXISTS user_wiki_pages_category_topic_idx
  ON user_wiki_pages(user_id, category, topic);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_wiki_pages_updated_at
  BEFORE UPDATE ON user_wiki_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
