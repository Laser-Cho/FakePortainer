const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const { WebSocketServer } = require('ws');

dotenv.config();

const authMiddleware = require('./middleware/auth');
const containerRoutes = require('./routes/containers');
const imageRoutes = require('./routes/images');
const volumeRoutes = require('./routes/volumes');
const setupLogStreamWebSocket = require('./websocket/logs');
const systemRoutes = require('./routes/system');

const app = express();
app.disable('x-powered-by');

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 9000;

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('Referrer-Policy', 'no-referrer');
  res.header('Cache-Control', 'no-store');
  if (allowedOrigins.length === 0) {
    res.header('Access-Control-Allow-Private-Network', 'true');
  }
  console.log(`[Agent Request] ${req.method} ${req.url} from ${req.ip}`);
  next();
});

app.use(
  cors(
    allowedOrigins.length > 0
      ? {
          origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
              callback(null, true);
            } else {
              callback(new Error('CORS origin not allowed'));
            }
          },
        }
      : undefined
  )
);
app.use(express.json({ limit: '1mb' }));

// Public health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', agent: 'dockwatch-agent', timestamp: new Date() });
});

// Protected API routes
app.use('/api/containers', authMiddleware, containerRoutes);
app.use('/api/images', authMiddleware, imageRoutes);
app.use('/api/volumes', authMiddleware, volumeRoutes);
app.use('/api/system', authMiddleware, systemRoutes);

// WebSocket Setup for log streaming
setupLogStreamWebSocket(wss);

server.listen(PORT, () => {
  console.log(`[DockWatch Agent] Listening on port ${PORT}`);
  if (!process.env.AGENT_SECRET_TOKEN || process.env.AGENT_SECRET_TOKEN === '1') {
    console.warn(`[SECURITY WARNING] AGENT_SECRET_TOKEN is set to default '1'. Change AGENT_SECRET_TOKEN in production!`);
  }
});
