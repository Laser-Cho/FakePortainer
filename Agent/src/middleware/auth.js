const jwt = require('jsonwebtoken');

const AGENT_SECRET_TOKEN = process.env.AGENT_SECRET_TOKEN || 'your_secure_agent_token';

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header is missing' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

  if (token === AGENT_SECRET_TOKEN) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, AGENT_SECRET_TOKEN);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired authorization token' });
  }
};

module.exports = authMiddleware;
