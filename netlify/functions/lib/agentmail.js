let _clientPromise;

async function getAgentMailClient() {
  if (_clientPromise) return _clientPromise;

  _clientPromise = (async () => {
    const apiKey = process.env.AGENTMAIL_API_KEY;
    if (!apiKey) {
      const err = new Error('Missing AGENTMAIL_API_KEY');
      err.code = 'AGENTMAIL_MISSING_API_KEY';
      throw err;
    }

    // agentmail is ESM in most environments; use dynamic import from CJS.
    const mod = await import('agentmail');
    const AgentMailClient = mod.AgentMailClient || mod.default?.AgentMailClient || mod.default;

    if (!AgentMailClient) {
      throw new Error('Could not load AgentMailClient from agentmail package');
    }

    return new AgentMailClient({ apiKey });
  })();

  return _clientPromise;
}

async function createInbox({ username, domain, podId, clientId } = {}) {
  const client = await getAgentMailClient();
  return client.inboxes.create({ username, domain, podId, clientId });
}

async function listMessages({ inboxId, limit } = {}) {
  const client = await getAgentMailClient();
  return client.inboxes.messages.list({ inboxId, limit });
}

async function sendEmail({ inboxId, to, subject, text, html, labels, attachments } = {}) {
  const client = await getAgentMailClient();
  return client.inboxes.messages.send({
    inboxId,
    to,
    subject,
    text,
    html,
    labels,
    attachments
  });
}

async function reply({ inboxId, messageId, text, html, attachments, labels } = {}) {
  const client = await getAgentMailClient();
  return client.inboxes.messages.reply({ inboxId, messageId, text, html, attachments, labels });
}

async function updateLabels({ inboxId, messageId, addLabels, removeLabels } = {}) {
  const client = await getAgentMailClient();
  return client.inboxes.messages.update({ inboxId, messageId, addLabels, removeLabels });
}

async function createDraft({ inboxId, to, subject, text, html, labels, attachments } = {}) {
  const client = await getAgentMailClient();
  return client.inboxes.drafts.create({ inboxId, to, subject, text, html, labels, attachments });
}

async function sendDraft({ inboxId, draftId } = {}) {
  const client = await getAgentMailClient();
  return client.inboxes.drafts.send({ inboxId, draftId });
}

module.exports = {
  getAgentMailClient,
  createInbox,
  listMessages,
  sendEmail,
  reply,
  updateLabels,
  createDraft,
  sendDraft
};
