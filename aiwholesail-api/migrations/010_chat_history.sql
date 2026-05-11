-- 010_chat_history.sql
-- Persist Cmd+K AI agent conversations per user. Each Cmd+K session is one
-- thread; the modal can list recent threads and resume any of them.
--
-- We store user + final-assistant messages only — not raw tool_use /
-- tool_result intermediates. That keeps payloads small (avg ~1-3 KB per
-- session) and avoids leaking the agent's internal scaffolding into the
-- replayable conversation.

CREATE TABLE IF NOT EXISTS agent_chat_sessions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT,                                         -- first ~80 chars of user's first message
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_chat_sessions_user_updated
  ON agent_chat_sessions (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS agent_chat_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  UUID NOT NULL REFERENCES agent_chat_sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,                               -- plain text body
  citations   JSONB,                                       -- array of CitationData objects (only on assistant)
  tool_events JSONB,                                       -- array of tool names invoked (only on assistant)
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_chat_messages_session
  ON agent_chat_messages (session_id, created_at);

-- Migration 007 incident: tables created as postgres superuser need explicit
-- GRANTs to the 'aiwholesail' role or every read/write 500s with "permission
-- denied". Mirror the safe pattern from migrations 008/009.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aiwholesail') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON agent_chat_sessions TO aiwholesail;
    GRANT SELECT, INSERT, UPDATE, DELETE ON agent_chat_messages TO aiwholesail;
  END IF;
END$$;
