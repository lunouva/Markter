const crypto = require('crypto');

function hashIp(ip) {
  const salt = process.env.IP_HASH_SALT || 'markter-ip-hash';
  return crypto.createHmac('sha256', salt).update(ip || 'unknown').digest('hex');
}

async function isRateLimited(client, ipHash) {
  const windowMinutes = parseInt(process.env.RATE_LIMIT_WINDOW_MIN || '10', 10);
  const maxSubmissions = parseInt(process.env.RATE_LIMIT_MAX || '5', 10);
  const result = await client.query(
    `select count(*)::int as count from leads where ip_hash = $1 and created_at > now() - interval '${windowMinutes} minutes'`,
    [ipHash]
  );
  return result.rows[0].count >= maxSubmissions;
}

module.exports = {
  hashIp,
  isRateLimited
};
