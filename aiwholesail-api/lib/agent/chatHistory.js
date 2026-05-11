/**
 * Chat history persistence for the Cmd+K AI agent.
 *
 * Two tables (see migrations/010_chat_history.sql):
 *   agent_chat_sessions (id, user_id, title, created_at, updated_at)
 *   agent_chat_messages (id, session_id, role, content, citations, tool_events, created_at)
 *
 * We persist only user + final-assistant text (plus citations + tool names
 * for the assistant). Tool_use / tool_result intermediates stay out — they
 * aren't useful when replaying, and they balloon row size.
 */

const { query } = require('../../config/database');

function truncTitle(text, max = 80) {
  if (!text) return null;
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max - 1) + '…' : clean;
}

async function listSessions(userId, limit = 20) {
  const { rows } = await query(
    `SELECT s.id, s.title, s.created_at, s.updated_at,
            (SELECT COUNT(*) FROM agent_chat_messages m WHERE m.session_id = s.id) AS message_count
       FROM agent_chat_sessions s
      WHERE s.user_id = $1
      ORDER BY s.updated_at DESC
      LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

async function loadSession(sessionId, userId) {
  const sessionResult = await query(
    `SELECT id, title, created_at, updated_at
       FROM agent_chat_sessions
      WHERE id = $1 AND user_id = $2`,
    [sessionId, userId]
  );
  if (sessionResult.rows.length === 0) return null;

  const msgs = await query(
    `SELECT id, role, content, citations, tool_events, created_at
       FROM agent_chat_messages
      WHERE session_id = $1
      ORDER BY created_at ASC`,
    [sessionId]
  );

  return {
    session: sessionResult.rows[0],
    messages: msgs.rows,
  };
}

async function createSession(userId, firstUserMessage) {
  const { rows } = await query(
    `INSERT INTO agent_chat_sessions (user_id, title)
     VALUES ($1, $2)
     RETURNING id, title, created_at, updated_at`,
    [userId, truncTitle(firstUserMessage)]
  );
  return rows[0];
}

async function appendUserMessage(sessionId, content) {
  await query(
    `INSERT INTO agent_chat_messages (session_id, role, content)
     VALUES ($1, 'user', $2)`,
    [sessionId, String(content || '')]
  );
  await query(
    `UPDATE agent_chat_sessions SET updated_at = NOW() WHERE id = $1`,
    [sessionId]
  );
}

async function appendAssistantMessage(sessionId, { text, citations, tool_events }) {
  await query(
    `INSERT INTO agent_chat_messages (session_id, role, content, citations, tool_events)
     VALUES ($1, 'assistant', $2, $3, $4)`,
    [
      sessionId,
      String(text || ''),
      citations && citations.length ? JSON.stringify(citations) : null,
      tool_events && tool_events.length ? JSON.stringify(tool_events) : null,
    ]
  );
  await query(
    `UPDATE agent_chat_sessions SET updated_at = NOW() WHERE id = $1`,
    [sessionId]
  );
}

async function deleteSession(sessionId, userId) {
  const { rowCount } = await query(
    `DELETE FROM agent_chat_sessions WHERE id = $1 AND user_id = $2`,
    [sessionId, userId]
  );
  return rowCount > 0;
}

module.exports = {
  listSessions,
  loadSession,
  createSession,
  appendUserMessage,
  appendAssistantMessage,
  deleteSession,
};
