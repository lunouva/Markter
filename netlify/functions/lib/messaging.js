async function sendSmsTwilio({ to, body }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;

  if (!accountSid || !authToken || !from) {
    return { status: 'queued', provider_message_id: null };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const payload = new URLSearchParams({ From: from, To: to, Body: body });
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: payload.toString()
  });

  const data = await response.json();
  if (!response.ok) {
    return { status: 'failed', provider_message_id: null, error: data?.message || 'Twilio error' };
  }

  return { status: 'sent', provider_message_id: data.sid };
}

async function sendEmailPostmark({ to, subject, body }) {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  const from = process.env.EMAIL_FROM;

  if (!token || !from) {
    return { status: 'queued', provider_message_id: null };
  }

  const response = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      'X-Postmark-Server-Token': token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ From: from, To: to, Subject: subject, TextBody: body })
  });

  const data = await response.json();
  if (!response.ok) {
    return { status: 'failed', provider_message_id: null, error: data?.Message || 'Postmark error' };
  }

  return { status: 'sent', provider_message_id: data.MessageID };
}

async function sendSms(payload) {
  const provider = (process.env.SMS_PROVIDER || 'twilio').toLowerCase();
  if (provider === 'twilio') {
    return sendSmsTwilio(payload);
  }
  return { status: 'queued', provider_message_id: null };
}

async function sendEmail(payload) {
  const provider = (process.env.EMAIL_PROVIDER || 'postmark').toLowerCase();
  if (provider === 'postmark') {
    return sendEmailPostmark(payload);
  }
  return { status: 'queued', provider_message_id: null };
}

async function sendMessage({ channel, to, subject, body }) {
  if (channel === 'sms') {
    return sendSms({ to, body });
  }
  if (channel === 'email') {
    return sendEmail({ to, subject, body });
  }
  return { status: 'failed', provider_message_id: null, error: 'Unknown channel' };
}

module.exports = {
  sendMessage
};
