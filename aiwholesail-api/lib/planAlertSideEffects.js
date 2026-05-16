// Pure planner for the spread-alert worker's per-alert side effects.
//
// Returns a list of action descriptors describing the writes to perform
// for one (alert, deals, dispatch-outcome) tuple. The worker iterates
// and executes — keeps the conditional logic out of the I/O loop and
// makes the data-integrity contract testable in isolation.
//
// Contract (real incident 2026-05-15): when the email dispatch fails
// (Resend 429 etc.) the worker MUST NOT mark the deals as "sent" or
// bump last_alert_sent. The deal-find query excludes any zpid in
// alert_sent_deals for that alert_id, and the due-alerts query
// excludes alerts within their frequency window — running either of
// those writes on a failed dispatch silently locks the user out of
// receiving these specific deals in any future run.
//
// The match-audit row IS written unconditionally (with the emailSent
// flag) so dashboards can reconcile attempted-vs-delivered.

function planAlertSideEffects({ alert, deals, emailSent, smsSent }) {
  if (!deals || deals.length === 0) return [];

  const actions = [];

  if (emailSent) {
    for (const deal of deals) {
      actions.push({
        type: 'insert_sent_deal',
        alertId: alert.id,
        zpid: deal.zpid,
        spread: deal.spread,
      });
    }
    actions.push({ type: 'bump_last_alert_sent', alertId: alert.id });
  }

  for (const deal of deals) {
    actions.push({
      type: 'insert_match',
      alertId: alert.id,
      zpid: deal.zpid,
      dealPayload: deal,
      emailSent,
      smsSent,
    });
  }

  return actions;
}

module.exports = { planAlertSideEffects };
