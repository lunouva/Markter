function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    },
    body: JSON.stringify(body)
  };
}

function parseJson(body) {
  if (!body) {
    return {};
  }
  try {
    return JSON.parse(body);
  } catch (error) {
    return null;
  }
}

function getClientIp(event) {
  const header = event.headers['x-forwarded-for'] || event.headers['X-Forwarded-For'];
  if (header) {
    return header.split(',')[0].trim();
  }
  return event.headers['client-ip'] || event.headers['Client-Ip'] || 'unknown';
}

function cleanText(value, max = 500) {
  if (value === undefined || value === null) {
    return null;
  }
  const cleaned = String(value).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return cleaned.length > max ? cleaned.slice(0, max) : cleaned;
}

function normalizePhone(value) {
  if (!value) {
    return '';
  }
  return String(value).replace(/\D/g, '');
}

function normalizeArray(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(item, 100)).filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((item) => cleanText(item, 100))
    .filter(Boolean);
}

module.exports = {
  jsonResponse,
  parseJson,
  getClientIp,
  cleanText,
  normalizePhone,
  normalizeArray
};
