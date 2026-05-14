// Map of sender categories → verified Resend domain + FROM address.
// Keep transactional ON notifications.aiwholesail.com to insulate
// password resets / receipts from outreach-domain reputation swings.
const SENDERS = {
  transactional: 'AIWholesail <noreply@notifications.aiwholesail.com>',
  security:      'AIWholesail Security <noreply@notifications.aiwholesail.com>',
  contact:       'AIWholesail Contact <noreply@notifications.aiwholesail.com>',
  outreach:      'AIWholesail <outreach@send.aiwholesail.com>',
};

function getSender(type) {
  const s = SENDERS[type];
  if (!s) throw new Error(`Unknown sender type: ${type}`);
  return s;
}

module.exports = { getSender, SENDERS };
