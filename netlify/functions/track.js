const { withClient } = require('./lib/db');
const { jsonResponse, parseJson, getClientIp, cleanText } = require('./lib/utils');
const { hashIp } = require('./lib/security');

function hydrateAttribution(payload, event) {
  const hydrated = { ...(payload || {}) };
  const q = event && event.queryStringParameters ? event.queryStringParameters : {};
  const headers = (event && event.headers) || {};

  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid'];
  for (const key of utmKeys) {
    if (!hydrated[key] && q && q[key]) hydrated[key] = q[key];
  }

  if (!hydrated.source_page) {
    hydrated.source_page = headers.referer || headers.Referer || null;
  }

  return hydrated;
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

  const hydrated = hydrateAttribution(payload, event);
  const eventTypeRaw = cleanText(hydrated.event_type, 80);
  if (!eventTypeRaw) {
    return jsonResponse(400, { error: 'Missing event_type' });
  }

  const ip = getClientIp(event);
  const ipHash = hashIp(ip);

  const headers = (event && event.headers) || {};
  const userAgent = headers['user-agent'] || headers['User-Agent'] || null;

  const eventType = `anon_${eventTypeRaw.replace(/[^a-zA-Z0-9_\-:.]/g, '_')}`;
  const eventPayload = {
    source_page: cleanText(hydrated.source_page, 300),
    path: cleanText(hydrated.path, 200),
    intent: cleanText(hydrated.intent, 40),
    utm_source: cleanText(hydrated.utm_source, 120),
    utm_medium: cleanText(hydrated.utm_medium, 120),
    utm_campaign: cleanText(hydrated.utm_campaign, 120),
    utm_term: cleanText(hydrated.utm_term, 120),
    utm_content: cleanText(hydrated.utm_content, 120),
    gclid: cleanText(hydrated.gclid, 120),
    user_agent: userAgent ? String(userAgent).slice(0, 300) : null,
    ip_hash: ipHash,
    meta: hydrated.payload || null
  };

  try {
    await withClient(async (client) => {
      await client.query('insert into lead_events (lead_id, event_type, payload) values ($1, $2, $3)', [null, eventType, eventPayload]);
    });
    return jsonResponse(201, { status: 'ok' });
  } catch (error) {
    const requestId =
      (event && event.headers && (event.headers['x-nf-request-id'] || event.headers['X-Nf-Request-Id'])) ||
      null;

    console.error('track_error', {
      requestId,
      message: error && error.message,
      code: error && error.code,
      stack: error && error.stack
    });

    return jsonResponse(500, { error: 'Server error', request_id: requestId });
  }
};
