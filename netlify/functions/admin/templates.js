const { verifyToken, isAdmin } = require('../lib/auth');
const { withClient } = require('../lib/db');
const { jsonResponse, parseJson, cleanText } = require('../lib/utils');
const { logAudit } = require('../lib/events');

exports.handler = async (event) => {
  const payload = await verifyToken(event);
  if (!payload) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }
  if (!isAdmin(payload)) {
    return jsonResponse(403, { error: 'Access denied' });
  }

  if (event.httpMethod === 'GET') {
    try {
      const result = await withClient(async (client) => {
        const templates = await client.query('select * from message_templates order by template_key, channel, version desc');
        return { templates: templates.rows };
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

    if (body.action === 'activate' && body.template_id) {
      try {
        const result = await withClient(async (client) => {
          const template = await client.query('select * from message_templates where id = $1', [body.template_id]);
          if (!template.rows.length) {
            return { notFound: true };
          }
          const row = template.rows[0];
          await client.query(
            'update message_templates set active = false where template_key = $1 and channel = $2',
            [row.template_key, row.channel]
          );
          await client.query('update message_templates set active = true where id = $1', [row.id]);

          await logAudit(client, {
            actorId: payload.sub,
            actorEmail: payload.email,
            action: 'template_activated',
            meta: { template_id: row.id, template_key: row.template_key, channel: row.channel }
          });

          return { status: 'ok' };
        });

        if (result.notFound) {
          return jsonResponse(404, { error: 'Template not found' });
        }

        return jsonResponse(200, result);
      } catch (error) {
        return jsonResponse(500, { error: 'Server error' });
      }
    }

    const templateKey = cleanText(body.template_key, 60);
    const name = cleanText(body.name, 120);
    const channel = cleanText(body.channel, 10);
    const subject = cleanText(body.subject, 200);
    const templateBody = cleanText(body.body, 8000);
    const active = Boolean(body.active);

    if (!templateKey || !name || !channel || !templateBody) {
      return jsonResponse(400, { error: 'Missing required fields' });
    }

    try {
      const result = await withClient(async (client) => {
        const versionResult = await client.query(
          'select coalesce(max(version), 0) as version from message_templates where template_key = $1 and channel = $2',
          [templateKey, channel]
        );
        const nextVersion = Number(versionResult.rows[0].version) + 1;

        if (active) {
          await client.query(
            'update message_templates set active = false where template_key = $1 and channel = $2',
            [templateKey, channel]
          );
        }

        const insert = await client.query(
          'insert into message_templates (template_key, name, channel, subject, body, version, active, created_by) values ($1, $2, $3, $4, $5, $6, $7, $8) returning *',
          [templateKey, name, channel, subject, templateBody, nextVersion, active, payload.email]
        );

        await logAudit(client, {
          actorId: payload.sub,
          actorEmail: payload.email,
          action: 'template_created',
          meta: { template_key: templateKey, channel, version: nextVersion }
        });

        return { template: insert.rows[0] };
      });

      return jsonResponse(201, result);
    } catch (error) {
      return jsonResponse(500, { error: 'Server error' });
    }
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};
