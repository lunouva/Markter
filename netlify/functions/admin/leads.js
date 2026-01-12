const { verifyToken, isAdmin } = require('../lib/auth');
const { withClient } = require('../lib/db');
const { jsonResponse } = require('../lib/utils');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const payload = await verifyToken(event);
    if (!payload) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }
    if (!isAdmin(payload)) {
      return jsonResponse(403, { error: 'Access denied' });
    }

    const stage = event.queryStringParameters?.stage || null;

    const result = await withClient(async (client) => {
      const leads = stage
        ? await client.query('select * from leads where stage = $1 order by created_at desc limit 200', [stage])
        : await client.query('select * from leads order by created_at desc limit 200');
      const counts = await client.query(
        'select stage, count(*)::int as count from leads group by stage'
      );

      return { leads: leads.rows, counts: counts.rows };
    });

    return jsonResponse(200, result);
  } catch (error) {
    return jsonResponse(500, { error: 'Server error' });
  }
};
