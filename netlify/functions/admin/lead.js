const { verifyToken, isAdmin } = require('../lib/auth');
const { withClient } = require('../lib/db');
const { jsonResponse, parseJson, cleanText, normalizeArray } = require('../lib/utils');
const { logAudit, logEvent } = require('../lib/events');
const { renderTemplate } = require('../lib/templates');
const { sendMessage } = require('../lib/messaging');

async function sendBookingMessages(client, lead) {
  const templates = await client.query(
    'select * from message_templates where template_key = $1 and active = true order by version desc',
    ['booking']
  );

  const data = {
    name: lead.name,
    goal: lead.goal,
    callback_window: lead.callback_window,
    business_type: lead.business_type,
    source_page: lead.source_page
  };

  for (const template of templates.rows) {
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
  }
}

exports.handler = async (event) => {
  const payload = await verifyToken(event);
  if (!payload) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }
  if (!isAdmin(payload)) {
    return jsonResponse(403, { error: 'Access denied' });
  }

  const leadId = event.queryStringParameters?.id;
  if (!leadId) {
    return jsonResponse(400, { error: 'Missing lead id' });
  }

  if (event.httpMethod === 'GET') {
    try {
      const result = await withClient(async (client) => {
        const lead = await client.query('select * from leads where id = $1', [leadId]);
        const events = await client.query('select * from lead_events where lead_id = $1 order by created_at desc', [leadId]);
        const notes = await client.query('select * from notes where lead_id = $1 order by created_at desc', [leadId]);
        const messages = await client.query('select * from messages where lead_id = $1 order by created_at desc', [leadId]);
        return {
          lead: lead.rows[0] || null,
          events: events.rows,
          notes: notes.rows,
          messages: messages.rows
        };
      });

      if (!result.lead) {
        return jsonResponse(404, { error: 'Lead not found' });
      }

      return jsonResponse(200, result);
    } catch (error) {
      return jsonResponse(500, { error: 'Server error' });
    }
  }

  if (event.httpMethod === 'PATCH') {
    const body = parseJson(event.body);
    if (!body) {
      return jsonResponse(400, { error: 'Invalid JSON' });
    }

    const stage = cleanText(body.stage, 40);
    const tags = normalizeArray(body.tags);

    try {
      const result = await withClient(async (client) => {
        const existing = await client.query('select * from leads where id = $1', [leadId]);
        if (!existing.rows.length) {
          return { notFound: true };
        }

        const lead = existing.rows[0];
        const nextStage = stage || lead.stage;
        const nextTags = tags.length ? tags : lead.tags;

        await client.query(
          'update leads set stage = $1, tags = $2, updated_at = now() where id = $3',
          [nextStage, nextTags, leadId]
        );

        await logEvent(client, {
          leadId,
          eventType: 'lead_updated',
          payload: { stage: nextStage, tags: nextTags }
        });

        await logAudit(client, {
          actorId: payload.sub,
          actorEmail: payload.email,
          action: 'lead_updated',
          leadId,
          meta: { stage: nextStage, tags: nextTags }
        });

        if (lead.stage !== nextStage && nextStage === 'Booked') {
          const refreshed = await client.query('select * from leads where id = $1', [leadId]);
          await sendBookingMessages(client, refreshed.rows[0]);
        }

        return { stage: nextStage, tags: nextTags };
      });

      if (result.notFound) {
        return jsonResponse(404, { error: 'Lead not found' });
      }

      return jsonResponse(200, result);
    } catch (error) {
      return jsonResponse(500, { error: 'Server error' });
    }
  }

  if (event.httpMethod === 'POST') {
    const body = parseJson(event.body);
    if (!body || body.action !== 'note') {
      return jsonResponse(400, { error: 'Invalid request' });
    }

    const note = cleanText(body.note, 2000);
    if (!note) {
      return jsonResponse(400, { error: 'Note is required' });
    }

    try {
      const result = await withClient(async (client) => {
        await client.query(
          'insert into notes (lead_id, body, created_by) values ($1, $2, $3)',
          [leadId, note, payload.email]
        );

        await logEvent(client, {
          leadId,
          eventType: 'note_added',
          payload: { note }
        });

        await logAudit(client, {
          actorId: payload.sub,
          actorEmail: payload.email,
          action: 'note_added',
          leadId,
          meta: { note }
        });

        return { status: 'ok' };
      });

      return jsonResponse(200, result);
    } catch (error) {
      return jsonResponse(500, { error: 'Server error' });
    }
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};
