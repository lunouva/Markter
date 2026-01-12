async function logAudit(client, { actorId, actorEmail, action, leadId, meta }) {
  await client.query(
    'insert into audit_log (actor_id, actor_email, action, lead_id, meta) values ($1, $2, $3, $4, $5)',
    [actorId, actorEmail, action, leadId || null, meta || null]
  );
}

async function logEvent(client, { leadId, eventType, payload }) {
  await client.query(
    'insert into lead_events (lead_id, event_type, payload) values ($1, $2, $3)',
    [leadId, eventType, payload || null]
  );
}

module.exports = {
  logAudit,
  logEvent
};
