const { verifyToken, isAdmin } = require('../lib/auth');
const { withClient } = require('../lib/db');
const { jsonResponse, parseJson, cleanText, normalizeArray } = require('../lib/utils');
const { renderTemplate } = require('../lib/templates');
const { sendMessage } = require('../lib/messaging');
const { logAudit, logEvent } = require('../lib/events');

async function sendWithTemplate(client, lead, template) {
  const data = {
    name: lead.name,
    goal: lead.goal,
    callback_window: lead.callback_window,
    business_type: lead.business_type,
    source_page: lead.source_page
  };

  const rendered = renderTemplate(template.body, data);
  const subject = template.subject ? renderTemplate(template.subject, data) : null;
  const recipient = template.channel === 'sms' ? lead.phone : lead.email;

  const sendResult = await sendMessage({
    channel: template.channel,
    to: recipient,
    subject,
    body: rendered
  });

  await client.query(
    'insert into messages (lead_id, channel, recipient, template_id, template_name, rendered_content, status, provider_message_id, error, sent_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
    [
      lead.id,
      template.channel,
      recipient,
      template.id,
      template.name,
      rendered,
      sendResult.status,
      sendResult.provider_message_id || null,
      sendResult.error || null,
      sendResult.status === 'sent' ? new Date().toISOString() : null
    ]
  );

  await logEvent(client, {
    leadId: lead.id,
    eventType: 'message_sent',
    payload: { channel: template.channel, template_key: template.template_key, status: sendResult.status }
  });

  return sendResult;
}

exports.handler = async (event) => {
  const payload = await verifyToken(event);
  if (!payload) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }
  if (!isAdmin(payload)) {
    return jsonResponse(403, { error: 'Access denied' });
  }

  if (event.httpMethod === 'GET') {
    const leadId = event.queryStringParameters?.lead_id;
    if (!leadId) {
      return jsonResponse(400, { error: 'Missing lead id' });
    }

    try {
      const result = await withClient(async (client) => {
        const messages = await client.query('select * from messages where lead_id = $1 order by created_at desc', [leadId]);
        return { messages: messages.rows };
      });
      return jsonResponse(200, result);
    } catch (error) {
      return jsonResponse(500, { error: 'Server error' });
    }
  }

  if (event.httpMethod === 'POST') {
    const body = parseJson(event.body);
    if (!body) {
      return jsonResponse(400, { error: 'Invalid JSON' });
    }

    const leadId = cleanText(body.lead_id, 60);
    const templateKey = cleanText(body.template_key, 60);
    const channels = normalizeArray(body.channels || body.channel);

    if (!leadId || !templateKey || !channels.length) {
      return jsonResponse(400, { error: 'Missing required fields' });
    }

    try {
      const result = await withClient(async (client) => {
        const leadResult = await client.query('select * from leads where id = $1', [leadId]);
        if (!leadResult.rows.length) {
          return { notFound: true };
        }
        const lead = leadResult.rows[0];

        const responses = [];
        for (const channel of channels) {
          const templateResult = await client.query(
            'select * from message_templates where template_key = $1 and channel = $2 and active = true order by version desc limit 1',
            [templateKey, channel]
          );
          if (!templateResult.rows.length) {
            responses.push({ channel, status: 'skipped' });
            continue;
          }
          const template = templateResult.rows[0];
          const sendResult = await sendWithTemplate(client, lead, template);
          responses.push({ channel, status: sendResult.status });
        }

        await logAudit(client, {
          actorId: payload.sub,
          actorEmail: payload.email,
          action: 'message_sent',
          leadId,
          meta: { template_key: templateKey, channels }
        });

        return { status: 'ok', results: responses };
      });

      if (result.notFound) {
        return jsonResponse(404, { error: 'Lead not found' });
      }

      return jsonResponse(200, result);
    } catch (error) {
      return jsonResponse(500, { error: 'Server error' });
    }
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};
