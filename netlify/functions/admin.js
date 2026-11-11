const { ok, err, cors, checkAdmin } = require('./lib/helpers');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  if (event.httpMethod === 'POST') {
    let parsed;
    try {
      parsed = JSON.parse(event.body || '{}');
    } catch (e) {
      return err('בקשה לא תקינה', 400);
    }
    const password = parsed && typeof parsed === 'object' ? parsed.password : undefined;
    // Same safe comparison as every admin endpoint: timing-safe, string only, fails closed when ADMIN_PASSWORD is unset.
    if (checkAdmin({ 'x-admin-password': password })) {
      return ok({ success: true });
    }
    return err('הסיסמה שגויה. נסו שוב', 401);
  }

  return err('Method not allowed', 405);
};
