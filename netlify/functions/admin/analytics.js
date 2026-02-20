const { verifyToken, isAdmin } = require('../lib/auth');
const { withClient } = require('../lib/db');
const { jsonResponse } = require('../lib/utils');

function clampInt(value, { min, max, fallback }) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}

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

  const days = clampInt(event.queryStringParameters?.days, { min: 1, max: 90, fallback: 14 });

  try {
    const result = await withClient(async (client) => {
      // Anonymous site analytics are written into lead_events with lead_id = null
      // and event_type prefixed with anon_.
      const totals = await client.query(
        `select event_type, count(*)::int as count
           from lead_events
          where lead_id is null
            and created_at > now() - ($1::text || ' days')::interval
          group by event_type
          order by count desc
          limit 50`,
        [String(days)]
      );

      const ctaClicks = await client.query(
        `select
            coalesce(payload->'meta'->>'label', 'unknown') as label,
            count(*)::int as count
          from lead_events
          where lead_id is null
            and event_type = 'anon_cta_click'
            and created_at > now() - ($1::text || ' days')::interval
          group by 1
          order by count desc
          limit 20`,
        [String(days)]
      );

      const leadsCreated = await client.query(
        `select count(*)::int as count
           from leads
          where created_at > now() - ($1::text || ' days')::interval`,
        [String(days)]
      );

      return {
        days,
        totals: totals.rows,
        cta_clicks: ctaClicks.rows,
        leads_created: leadsCreated.rows[0]?.count || 0
      };
    });

    return jsonResponse(200, result);
  } catch (error) {
    return jsonResponse(500, { error: 'Server error' });
  }
};
