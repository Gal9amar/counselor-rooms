const { ok, err, cors } = require('./lib/helpers');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  if (event.httpMethod === 'POST') {
    const { password } = JSON.parse(event.body || '{}');
    if (password === process.env.ADMIN_PASSWORD) {
      return ok({ success: true });
    }
    return err('סיסמה שגויה', 401);
  }

  return err('Method not allowed', 405);
};
