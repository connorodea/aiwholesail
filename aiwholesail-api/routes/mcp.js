/**
 * MCP server endpoint.
 *
 * Mounted at /mcp on the main API. Implements the Model Context Protocol
 * Streamable HTTP transport so external clients (Claude Desktop, Cursor,
 * Continue, etc.) can consume AIWholesail's Zillow tools.
 *
 * Auth: x-api-key header must equal MCP_API_KEY. Each Claude Desktop user
 * gets the same key for V1 (we'll issue per-user OAuth tokens in V2 if
 * usage justifies it).
 *
 * Stateless mode: each request spins up a fresh MCP server + transport.
 * That avoids in-memory session state and lets the route scale horizontally
 * without sticky routing.
 */

const express = require('express');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { buildMcpServer } = require('../lib/mcp/server');

const router = express.Router();

// ----- Auth middleware -----
function mcpAuth(req, res, next) {
  const expected = process.env.MCP_API_KEY;
  if (!expected) {
    return res.status(503).json({ error: 'MCP server not configured (MCP_API_KEY missing)' });
  }
  // Accept both x-api-key (custom) and Authorization: Bearer (MCP-standard)
  const headerKey = req.headers['x-api-key'];
  const bearer = req.headers.authorization;
  const presented = headerKey ||
    (typeof bearer === 'string' && bearer.startsWith('Bearer ') ? bearer.slice(7) : null);
  if (!presented || presented !== expected) {
    return res.status(401).json({ error: 'Unauthorized: missing or invalid MCP key' });
  }
  next();
}

// ----- Streamable HTTP handler (stateless mode) -----
async function handleMcpRequest(req, res) {
  let server;
  let transport;
  try {
    server = buildMcpServer();
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,  // stateless
      enableJsonResponse: true,        // allow non-streaming JSON-RPC responses
    });

    // Clean up on disconnect
    res.on('close', () => {
      try { transport.close(); } catch { /* */ }
      try { server.close(); } catch { /* */ }
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error(`[mcp] request error: ${err.message}`);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal MCP server error' });
    }
  }
}

// POST /mcp — JSON-RPC requests + SSE streams (when client opens a streamed call)
router.post('/', mcpAuth, handleMcpRequest);

// GET /mcp — server-initiated SSE (per MCP spec). In stateless mode this is
// rarely used by clients but we still wire it for protocol compliance.
router.get('/', mcpAuth, handleMcpRequest);

// DELETE /mcp — session termination. No-op in stateless mode but the SDK
// transport handles it cleanly.
router.delete('/', mcpAuth, handleMcpRequest);

module.exports = router;
