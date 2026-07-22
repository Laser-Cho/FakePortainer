const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const { WebSocketServer } = require('ws');

dotenv.config();

const authMiddleware = require('./middleware/auth');
const containerRoutes = require('./routes/containers');
const imageRoutes = require('./routes/images');
const setupLogStreamWebSocket = require('./websocket/logs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 9000;

app.use(cors());
app.use(express.json());

// Public health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', agent: 'fake-portainer-agent', timestamp: new Date() });
});

// Protected API routes
app.use('/api/containers', authMiddleware, containerRoutes);
app.use('/api/images', authMiddleware, imageRoutes);

// WebSocket Setup for log streaming
setupLogStreamWebSocket(wss);

server.listen(PORT, () => {
  console.log(`[FakePortainer Agent] Listening on port ${PORT}`);
});
