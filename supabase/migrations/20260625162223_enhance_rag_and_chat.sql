/*
# RAG Vector Search Function + Chat Messages Enhancement

1. Creates a match_embeddings RPC function for vector similarity search
2. Adds conversation_id to chat_messages for multi-turn conversations
3. Adds ai_powered flag to track AI vs fallback responses
*/

-- ============================================================
-- VECTOR SIMILARITY SEARCH FUNCTION (RAG)
-- ============================================================
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding vector(1536),
  match_count integer DEFAULT 10,
  filter_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  entity_type text,
  entity_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.entity_type,
    e.entity_id,
    e.content,
    e.metadata,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM embeddings e
  WHERE (filter_user_id IS NULL OR e.user_id = filter_user_id)
    AND e.embedding IS NOT NULL
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================
-- ENHANCE CHAT_MESSAGES TABLE
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'conversation_id'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN conversation_id text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'ai_powered'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN ai_powered boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'sources'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN sources jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
