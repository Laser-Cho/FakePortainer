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
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 9000;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Private-Network', 'true');
  console.log(`[Agent Request] ${req.method} ${req.url} from ${req.ip}`);
  next();
});
app.use(cors());
app.use(express.json());

// Public health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', agent: 'fake-portainer-agent', timestamp: new Date() });
});

// Protected API routes
app.use('/api/containers', authMiddleware, containerRoutes);
app.use('/api/images', authMiddleware, imageRoutes);
app.use('/api/volumes', authMiddleware, volumeRoutes);
app.use('/api/system', authMiddleware, systemRoutes);

// WebSocket Setup for log streaming
setupLogStreamWebSocket(wss);

server.listen(PORT, () => {
  console.log(`[FakePortainer Agent] Listening on port ${PORT}`);
  if (!process.env.AGENT_SECRET_TOKEN || process.env.AGENT_SECRET_TOKEN === '1') {
    console.warn(`[SECURITY WARNING] AGENT_SECRET_TOKEN is set to default '1'. Change AGENT_SECRET_TOKEN in production!`);
  }
});

