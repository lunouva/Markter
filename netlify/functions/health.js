const { withClient } = require('./lib/db');

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}

function has(value) {
  return Boolean(String(value || '').trim());
}

exports.handler = async (event) => {
  const deep = event.queryStringParameters?.deep === '1' || event.queryStringParameters?.deep === 'true';

  const env = {
    DATABASE_URL: has(process.env.DATABASE_URL),
    DATABASE_SSL: has(process.env.DATABASE_SSL),
    POSTMARK_SERVER_TOKEN: has(process.env.POSTMARK_SERVER_TOKEN),
    EMAIL_FROM: has(process.env.EMAIL_FROM),
    TWILIO_ACCOUNT_SID: has(process.env.TWILIO_ACCOUNT_SID),
    TWILIO_AUTH_TOKEN: has(process.env.TWILIO_AUTH_TOKEN),
    TWILIO_FROM: has(process.env.TWILIO_FROM)
  };

  const meta = {
    commitRef: process.env.COMMIT_REF || null,
    context: process.env.CONTEXT || null,
    nodeEnv: process.env.NODE_ENV || null
  };

  if (!deep) {
    return json(200, { ok: true, deep: false, env, meta });
  }

  if (!env.DATABASE_URL) {
    return json(503, { ok: false, deep: true, error: 'DATABASE_URL not set', env, meta });
  }

  try {
    const startedAt = Date.now();
    await withClient((client) => client.query('select 1 as ok'));
    const durationMs = Date.now() - startedAt;
    return json(200, { ok: true, deep: true, db: { ok: true, durationMs }, env, meta });
  } catch (error) {
    return json(503, {
      ok: false,
      deep: true,
      db: { ok: false },
      error: error?.message || String(error),
      code: error?.code || null,
      env,
      meta
    });
  }
};
