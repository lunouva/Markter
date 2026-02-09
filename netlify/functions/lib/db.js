const { Pool } = require('pg');

const useSsl = process.env.DATABASE_SSL === 'true' || process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false
});

async function withClient(callback) {
  if (!process.env.DATABASE_URL) {
    const error = new Error('DATABASE_URL is not set (required for Postgres)');
    error.code = 'MISSING_DATABASE_URL';
    throw error;
  }

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
