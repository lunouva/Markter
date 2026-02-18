/*
  Usage:
    AGENTMAIL_API_KEY=... node scripts/agentmail-smoke.js

  Optional:
    AGENTMAIL_INBOX_ID=...  (to reuse an existing inbox)
*/

const { createInbox, listMessages } = require('../netlify/functions/lib/agentmail');

async function main() {
  const existingInboxId = process.env.AGENTMAIL_INBOX_ID;

  let inbox;
  if (existingInboxId) {
    inbox = { inboxId: existingInboxId };
    console.log('[agentmail-smoke] using inbox:', existingInboxId);
  } else {
    inbox = await createInbox({ clientId: `smoke-${Date.now()}` });
    console.log('[agentmail-smoke] created inbox:', inbox.inboxId || inbox);
  }

  const messages = await listMessages({ inboxId: inbox.inboxId, limit: 5 });
  const count = Array.isArray(messages) ? messages.length : messages?.messages?.length;

  console.log('[agentmail-smoke] recent messages:', count ?? 'unknown');
  console.log(JSON.stringify(messages, null, 2));
}

main().catch((err) => {
  console.error('[agentmail-smoke] FAILED');
  console.error(err);
  process.exitCode = 1;
});
