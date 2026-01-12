const { verifyToken, isAdmin } = require('../lib/auth');
const { withClient } = require('../lib/db');
const { jsonResponse } = require('../lib/utils');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const payload = await verifyToken(event);
  if (!payload) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }
  if (!isAdmin(payload)) {
    return jsonResponse(403, { error: 'Access denied' });
  }

  try {
    const result = await withClient(async (client) => {
      const logs = await client.query('select * from audit_log order by created_at desc limit 200');
      return { logs: logs.rows };
    });
    return jsonResponse(200, result);
  } catch (error) {
    return jsonResponse(500, { error: 'Server error' });
  }
};
