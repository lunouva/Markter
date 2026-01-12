const { withClient } = require('./lib/db');
const { renderTemplate } = require('./lib/templates');
const { sendMessage } = require('./lib/messaging');
const { logEvent } = require('./lib/events');

async function sendFollowup(client, lead) {
  const templateKeys = ['follow_up'];
  const data = {
    name: lead.name,
    goal: lead.goal,
    callback_window: lead.callback_window,
    business_type: lead.business_type,
    source_page: lead.source_page
  };

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
    }
  }

  await logEvent(client, {
    leadId: lead.id,
    eventType: 'followup_sent',
    payload: { hours: Number(process.env.FOLLOWUP_HOURS || '24') }
  });
}

exports.handler = async () => {
  const hours = Number(process.env.FOLLOWUP_HOURS || '24');

  try {
    await withClient(async (client) => {
      const leads = await client.query(
        `select * from leads
         where stage in ('New', 'Contacted')
         and updated_at < now() - interval '${hours} hours'
         and not exists (
           select 1 from lead_events where lead_id = leads.id and event_type = 'followup_sent'
         )
         limit 50`
      );

      for (const lead of leads.rows) {
        await sendFollowup(client, lead);
      }
    });

    return { statusCode: 200, body: 'ok' };
  } catch (error) {
    return { statusCode: 500, body: 'error' };
  }
};
