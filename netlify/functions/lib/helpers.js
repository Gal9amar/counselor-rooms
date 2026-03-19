const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-password',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

const ok = (data, status = 200) => ({
  statusCode: status,
  headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

const err = (message, status = 500) => ({
  statusCode: status,
  headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  body: JSON.stringify({ error: message }),
});

const cors = () => ({
  statusCode: 204,
  headers: CORS_HEADERS,
  body: '',
});

const checkAdmin = (headers) => {
  const password = headers['x-admin-password'];
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return false;
  }
  return true;
};

module.exports = { ok, err, cors, checkAdmin };
