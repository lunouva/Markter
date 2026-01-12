const { verifyToken, isAdmin } = require('../lib/auth');
const { jsonResponse } = require('../lib/utils');

exports.handler = async (event) => {
  try {
    const payload = await verifyToken(event);
    if (!payload) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }

    return jsonResponse(200, {
      id: payload.sub,
      email: payload.email,
      is_admin: isAdmin(payload),
      roles: payload.app_metadata?.roles || payload.roles || []
    });
  } catch (error) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }
};
