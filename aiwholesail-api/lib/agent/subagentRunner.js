/**
 * Shared subagent execution helper.
 *
 * All 4 subagents follow the same pattern: spin up an inner Tool Runner with
 * a focused tool list + Haiku, then return content blocks to the parent
 * router. The naive approach (await runner; return result.content) loses
 * citations — the search_result blocks live inside intermediate tool_results
 * that the runner consumes internally, so the parent router only sees the
 * subagent's final text and has nothing to cite from.
 *
 * This helper iterates the runner manually, captures every search_result
 * block emitted by the inner tools, then returns a uniform-typed content
 * array to the parent: the search_result blocks (with the subagent's text
 * summary prepended into the first block's nested content) when results
 * exist, or a plain text block when none.
 *
 * Why uniform types matter: Anthropic's API rejects tool_result content
 * arrays that mix search_result blocks with text blocks ("if any blocks
 * in a tool result are of type search_result, all blocks must be of that
 * type"). Embedding the summary inside the first search_result.content[]
 * sidesteps that without losing the model's prose answer.
 */

const Anthropic = require('@anthropic-ai/sdk');

let cachedClient = null;
function getClient() {
  if (!cachedClient) cachedClient = new Anthropic.Anthropic();
  return cachedClient;
}

/**
 * Run a subagent and return content blocks ready to hand back to the parent
 * tool_result. Includes accumulated search_result blocks for citation
 * pass-through.
 *
 * @param {object}   opts
 * @param {string}   opts.model              e.g. 'claude-haiku-4-5'
 * @param {string}   opts.system             system prompt for the subagent
 * @param {Array}    opts.tools              betaZodTool / betaTool instances
 * @param {string}   opts.userContent        user-role text for the subagent
 * @param {number}   [opts.max_iterations=6] cap on agentic loop iterations
 * @param {number}   [opts.max_tokens=1500]
 * @returns {Promise<Array>} content blocks for the parent tool_result
 */
async function runSubagent({
  model,
  system,
  tools,
  userContent,
  max_iterations = 6,
  max_tokens = 1500,
}) {
  const client = getClient();
  const runner = client.beta.messages.toolRunner({
    model,
    max_tokens,
    system,
    tools,
    messages: [{ role: 'user', content: userContent }],
    max_iterations,
  });

  const accumulated = [];
  const seenSources = new Set();

  for await (const _msg of runner) {
    // After each assistant turn, inspect the tool_result the runner is
    // about to send back to the model. Pull out any search_result blocks
    // for citation pass-through to the parent.
    let toolResp = null;
    try {
      toolResp = await runner.generateToolResponse();
    } catch {
      // Caching/sequencing edge — safe to skip; the runner will still
      // append the tool result itself on the next iteration.
    }
    if (!toolResp || !Array.isArray(toolResp.content)) continue;

    for (const block of toolResp.content) {
      if (block.type !== 'tool_result' || !Array.isArray(block.content)) continue;
      for (const inner of block.content) {
        if (!inner || inner.type !== 'search_result') continue;
        // Dedupe by source URL — repeated tool calls on the same property
        // (e.g. comp_analyst pulling details + comps + zestimate for one zpid)
        // shouldn't bloat the parent's context.
        const key = inner.source || JSON.stringify(inner.content);
        if (seenSources.has(key)) continue;
        seenSources.add(key);
        accumulated.push(inner);
      }
    }
  }

  // Pull the subagent's final assistant text
  let finalMessage;
  try {
    finalMessage = await runner.done();
  } catch (err) {
    return [{ type: 'text', text: `subagent error: ${err.message || 'unknown'}` }];
  }
  const summary = (finalMessage.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  if (accumulated.length > 0) {
    // Prepend the summary text into the first search_result's nested content.
    // This keeps the top-level array uniformly search_result-typed while still
    // giving the parent router the subagent's prose answer.
    const first = accumulated[0];
    first.content = [
      { type: 'text', text: `[subagent summary] ${summary || '(no summary)'}` },
      ...(Array.isArray(first.content) ? first.content : []),
    ];
    return accumulated;
  }

  return [{ type: 'text', text: summary || '(subagent returned no result)' }];
}

module.exports = { runSubagent };
