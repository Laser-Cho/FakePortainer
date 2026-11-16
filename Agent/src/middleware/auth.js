const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const AGENT_SECRET_TOKEN = process.env.AGENT_SECRET_TOKEN || '1';

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header is missing' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

  if (safeEqual(token, AGENT_SECRET_TOKEN)) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, AGENT_SECRET_TOKEN, { algorithms: ['HS256'] });
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired authorization token' });
  }
};

module.exports = authMiddleware;
