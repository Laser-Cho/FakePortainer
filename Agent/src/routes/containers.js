const express = require('express');
const router = express.Router();
const { docker } = require('../docker');

// GET /api/containers - List all containers
router.get('/', async (req, res) => {
  try {
    const containers = await docker.listContainers({ all: true });
    const formatted = containers.map(c => ({
      id: c.Id.substring(0, 12),
      fullId: c.Id,
      name: c.Names[0] ? c.Names[0].replace(/^\//, '') : 'unnamed',
      image: c.Image,
      state: c.State,
      status: c.Status,
      created: c.Created,
      ports: (c.Ports || []).map(p => ({
        privatePort: p.PrivatePort,
        publicPort: p.PublicPort,
        type: p.Type,
        ip: p.IP
      }))
    }));
    res.json({ containers: formatted });
  } catch (err) {
    console.error('Error listing containers:', err.message);
    res.status(500).json({ error: `Failed to fetch containers: ${err.message}` });
  }
});

// POST /api/containers/:id/start
router.post('/:id/start', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.start();
    res.json({ success: true, message: `Container ${req.params.id} started successfully` });
  } catch (err) {
    res.status(500).json({ error: `Failed to start container: ${err.message}` });
  }
});

// POST /api/containers/:id/stop
router.post('/:id/stop', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.stop();
    res.json({ success: true, message: `Container ${req.params.id} stopped successfully` });
  } catch (err) {
    res.status(500).json({ error: `Failed to stop container: ${err.message}` });
  }
});

// POST /api/containers/:id/restart
router.post('/:id/restart', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.restart();
    res.json({ success: true, message: `Container ${req.params.id} restarted successfully` });
  } catch (err) {
    res.status(500).json({ error: `Failed to restart container: ${err.message}` });
  }
});

// DELETE /api/containers/:id
router.delete('/:id', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    const force = req.query.force === 'true';
    await container.remove({ force });
    res.json({ success: true, message: `Container ${req.params.id} removed successfully` });
  } catch (err) {
    res.status(500).json({ error: `Failed to remove container: ${err.message}` });
  }
});

module.exports = router;
