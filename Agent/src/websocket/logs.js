const url = require('url');
const jwt = require('jsonwebtoken');
const { docker } = require('../docker');

const AGENT_SECRET_TOKEN = process.env.AGENT_SECRET_TOKEN || 'your_secure_agent_token';

function setupLogStreamWebSocket(wss) {
  wss.on('connection', async (ws, req) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const token = parsedUrl.query.token;

    let isAuthorized = false;
    if (token === AGENT_SECRET_TOKEN) {
      isAuthorized = true;
    } else if (token) {
      try {
        jwt.verify(token, AGENT_SECRET_TOKEN);
        isAuthorized = true;
      } catch (e) {}
    }

    if (!isAuthorized) {
      ws.send(JSON.stringify({ type: 'error', data: 'Unauthorized WebSocket connection' }));
      return ws.close(1008, 'Unauthorized');
    }

    const match = pathname.match(/\/api\/containers\/([^\/]+)\/logs/);
    if (!match) {
      ws.send(JSON.stringify({ type: 'error', data: 'Invalid logs endpoint path' }));
      return ws.close(1002, 'Invalid path');
    }

    const containerId = match[1];

    try {
      const container = docker.getContainer(containerId);
      const logStream = await container.logs({
        follow: true,
        stdout: true,
        stderr: true,
        tail: 100,
        timestamps: true
      });

      ws.send(JSON.stringify({ type: 'info', data: `=== Stream connected for container ${containerId} ===\n` }));

      logStream.on('data', chunk => {
        let logText = chunk.toString('utf8');
        if (chunk.length > 8 && (chunk[0] === 1 || chunk[0] === 2)) {
          logText = chunk.slice(8).toString('utf8');
        }
        ws.send(JSON.stringify({ type: 'log', data: logText }));
      });

      logStream.on('end', () => {
        ws.send(JSON.stringify({ type: 'info', data: '\n=== Log stream ended ===' }));
        ws.close();
      });

      logStream.on('error', err => {
        ws.send(JSON.stringify({ type: 'error', data: `Log stream error: ${err.message}` }));
        ws.close();
      });

      ws.on('close', () => {
        if (logStream && typeof logStream.destroy === 'function') {
          logStream.destroy();
        }
      });
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', data: `Container error: ${err.message}` }));
      ws.close();
    }
  });
}

module.exports = setupLogStreamWebSocket;
