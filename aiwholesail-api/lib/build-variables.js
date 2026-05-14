/**
 * Build the merge-variable bag for a single sequence_executions row.
 *
 * Three sources, in increasing precedence (Phase 2.5 contract):
 *   1. Auto-derived from the recipient (seller_name, first_name, lead_name,
 *      property_address, your_name).
 *   2. lead_sequences.variables — set when the sequence was assigned via the
 *      single-lead UI path. Comes in on the row as `sequence_variables`.
 *   3. campaign_targets.target_variables — set by the bulk campaign builder.
 *      Comes in on the row as `campaign_variables`. Wins when both are
 *      present.
 *
 * `your_name` has its own resolution chain that mirrors precedence:
 *   campaign_variables.your_name → sequence_variables.your_name → ''.
 *
 * Missing first/last name falls back to 'there' for seller_name + first_name
 * so the email doesn't ship a leading "Hi ,".
 *
 * Extracted from scripts/sequence-execution-worker.js so the merge logic
 * can be unit-tested.
 */
function buildVariables(row) {
  const sequenceVars = row && row.sequence_variables && typeof row.sequence_variables === 'object'
    ? row.sequence_variables
    : {};
  const campaignVars = row && row.campaign_variables && typeof row.campaign_variables === 'object'
    ? row.campaign_variables
    : {};
  const firstName = (row && row.lead_first_name) || '';
  const lastName = (row && row.lead_last_name) || '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const auto = {
    seller_name: fullName || firstName || 'there',
    first_name: firstName || 'there',
    lead_name: fullName || firstName || '',
    property_address: (row && row.property_address) || '',
    your_name: sequenceVars.your_name || campaignVars.your_name || '',
  };
  return { ...auto, ...sequenceVars, ...campaignVars };
}

module.exports = { buildVariables };
