const Docker = require('dockerode');
const fs = require('fs');

const socketPath = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
const isSocketAvailable = fs.existsSync(socketPath);

const docker = new Docker({
  socketPath: isSocketAvailable ? socketPath : undefined
});

module.exports = { docker, isSocketAvailable };
