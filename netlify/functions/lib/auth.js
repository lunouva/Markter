const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const jwksClients = new Map();

function getJwksClient(siteUrl) {
  if (!jwksClients.has(siteUrl)) {
    jwksClients.set(
      siteUrl,
      jwksClient({
        jwksUri: `${siteUrl}/.netlify/identity/.well-known/jwks.json`
      })
    );
  }
  return jwksClients.get(siteUrl);
}

function getSiteUrl() {
  return (process.env.URL || process.env.DEPLOY_PRIME_URL || '').replace(/\/$/, '');
}

function getToken(event) {
  const header = event.headers.authorization || event.headers.Authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return null;
}

async function verifyToken(event) {
  const token = getToken(event);
  if (!token) {
    return null;
  }

  const siteUrl = getSiteUrl();
  if (!siteUrl) {
    throw new Error('Missing site URL for JWT verification');
  }

  const client = getJwksClient(siteUrl);
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || !decoded.header || !decoded.header.kid) {
    return null;
  }

  const key = await client.getSigningKey(decoded.header.kid);
  const signingKey = key.getPublicKey();

  return jwt.verify(token, signingKey, {
    issuer: `${siteUrl}/.netlify/identity`
  });
}

function isAdmin(payload) {
  if (!payload) {
    return false;
  }
  const roles = payload.app_metadata?.roles || payload.roles || [];
  return Array.isArray(roles) && roles.includes('admin');
}

module.exports = {
  verifyToken,
  isAdmin
};
