// Map of sender categories → verified Resend domain + FROM address.
// Keep transactional ON notifications.aiwholesail.com to insulate
// password resets / receipts from outreach-domain reputation swings.
const SENDERS = {
  transactional: 'AIWholesail <noreply@notifications.aiwholesail.com>',
  security:      'AIWholesail Security <noreply@notifications.aiwholesail.com>',
  contact:       'AIWholesail Contact <noreply@notifications.aiwholesail.com>',
  outreach:      'AIWholesail <outreach@send.aiwholesail.com>',
};

// Reply-To addresses by category. Outreach routes replies into our shared
// inbound mailbox (reply.aiwholesail.com) so the resend inbound webhook can
// parse them, suppress unsubs, auto-pause sequences, and surface threads in
// the Inbox UI. Transactional / security / contact don't need an explicit
// Reply-To — the FROM address itself is the reply destination.
const REPLY_TO = {
  outreach: 'reply@reply.aiwholesail.com',
};

function getSender(type) {
  const s = SENDERS[type];
  if (!s) throw new Error(`Unknown sender type: ${type}`);
  return s;
}

function getReplyTo(category) {
  return REPLY_TO[category] || null;
}

module.exports = { getSender, getReplyTo, SENDERS };
