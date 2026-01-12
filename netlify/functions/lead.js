const { withClient } = require('./lib/db');
const { jsonResponse, parseJson, getClientIp, cleanText, normalizePhone, normalizeArray } = require('./lib/utils');
const { hashIp, isRateLimited } = require('./lib/security');
const { renderTemplate } = require('./lib/templates');
const { sendMessage } = require('./lib/messaging');
const { logEvent } = require('./lib/events');

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
}

function isValidPhone(phone) {
  const digits = normalizePhone(phone);
  return digits.length >= 10;
}

function sanitizeLead(payload) {
  return {
    name: cleanText(payload.name, 120),
    phone: cleanText(payload.phone, 40),
    email: cleanText(payload.email, 200),
    business_type: cleanText(payload.business_type, 120),
    service_area: cleanText(payload.service_area, 120),
    goal: cleanText(payload.goal, 40),
    platforms: normalizeArray(payload.platforms),
    locations_count: payload.locations_count ? Number(payload.locations_count) : null,
    weekly_volume: payload.weekly_volume ? Number(payload.weekly_volume) : null,
    urgency: cleanText(payload.urgency, 40),
    callback_window: cleanText(payload.callback_window, 80),
    consent_flag: Boolean(payload.consent_flag),
    source_page: cleanText(payload.source_page, 200),
    utm_source: cleanText(payload.utm_source, 120),
    utm_medium: cleanText(payload.utm_medium, 120),
    utm_campaign: cleanText(payload.utm_campaign, 120),
    utm_term: cleanText(payload.utm_term, 120),
    utm_content: cleanText(payload.utm_content, 120),
    gclid: cleanText(payload.gclid, 120),
    transcript: Array.isArray(payload.transcript) ? payload.transcript : [],
    tags: normalizeArray(payload.tags)
  };
}

function getTemplateData(lead) {
  return {
    name: lead.name,
    goal: lead.goal,
    callback_window: lead.callback_window,
    business_type: lead.business_type,
    source_page: lead.source_page
  };
}

async function sendTemplateMessages(client, lead, templateKeys) {
  const data = getTemplateData(lead);
  for (const templateKey of templateKeys) {
    const templateResult = await client.query(
      'select * from message_templates where template_key = $1 and active = true order by version desc',
      [templateKey]
    );
    if (!templateResult.rows.length) {
      continue;
    }
    for (const template of templateResult.rows) {
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
        payload: { channel: template.channel, template_key: templateKey, status: sendResult.status }
      });
    }
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(200, {});
  }
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const payload = parseJson(event.body);
  if (!payload) {
    return jsonResponse(400, { error: 'Invalid JSON' });
  }

  if (payload.hp) {
    return jsonResponse(200, { status: 'ok' });
  }

  const lead = sanitizeLead(payload);
  if (!lead.name || !lead.phone || !lead.email) {
    return jsonResponse(400, { error: 'Missing required fields' });
  }
  if (!isValidEmail(lead.email)) {
    return jsonResponse(400, { error: 'Invalid email' });
  }
  if (!isValidPhone(lead.phone)) {
    return jsonResponse(400, { error: 'Invalid phone' });
  }

  const ip = getClientIp(event);
  const ipHash = hashIp(ip);

  try {
    const result = await withClient(async (client) => {
      if (await isRateLimited(client, ipHash)) {
        return { rateLimited: true };
      }

      const consentAt = lead.consent_flag ? new Date().toISOString() : null;
      const insert = await client.query(
        `insert into leads
          (name, phone, email, business_type, service_area, goal, platforms, locations_count, weekly_volume, urgency, callback_window, consent_flag, consent_at, source_page, utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, tags, transcript, ip_hash)
         values
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
         returning *`,
        [
          lead.name,
          lead.phone,
          lead.email,
          lead.business_type,
          lead.service_area,
          lead.goal,
          lead.platforms,
          lead.locations_count,
          lead.weekly_volume,
          lead.urgency,
          lead.callback_window,
          lead.consent_flag,
          consentAt,
          lead.source_page,
          lead.utm_source,
          lead.utm_medium,
          lead.utm_campaign,
          lead.utm_term,
          lead.utm_content,
          lead.gclid,
          lead.tags,
          JSON.stringify(lead.transcript),
          ipHash
        ]
      );

      const savedLead = insert.rows[0];

      await logEvent(client, {
        leadId: savedLead.id,
        eventType: 'lead_created',
        payload: { source_page: lead.source_page }
      });

      await sendTemplateMessages(client, savedLead, ['new_lead']);

      return { lead: savedLead };
    });

    if (result.rateLimited) {
      return jsonResponse(429, { error: 'Too many submissions' });
    }

    return jsonResponse(201, { lead_id: result.lead.id });
  } catch (error) {
    return jsonResponse(500, { error: 'Server error' });
  }
};
