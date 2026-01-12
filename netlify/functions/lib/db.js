const { Pool } = require('pg');

const useSsl = process.env.DATABASE_SSL === 'true' || process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false
});

async function withClient(callback) {
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  withClient
};
