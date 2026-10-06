const express = require('express');
const router = express.Router();
const { docker } = require('../docker');

// GET /api/system/logs - Fetch recent Docker daemon events and system info
router.get('/logs', async (req, res) => {
  try {
    const info = await docker.info().catch(() => ({}));
    const version = await docker.version().catch(() => ({}));

    // Fetch Docker events from past 24 hours
    const since = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
    const eventStream = await docker.getEvents({ since });

    let rawEvents = '';
    eventStream.on('data', (chunk) => {
      rawEvents += chunk.toString('utf-8');
    });

    // Wait a brief period to collect events
    setTimeout(() => {
      eventStream.destroy();
      const events = rawEvents
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch (e) {
            return null;
          }
        })
        .filter(Boolean);

      res.json({
        systemInfo: {
          serverVersion: version.Version || 'Unknown',
          operatingSystem: info.OperatingSystem || 'Unknown',
          containersTotal: info.Containers || 0,
          containersRunning: info.ContainersRunning || 0,
          containersStopped: info.ContainersStopped || 0,
          images: info.Images || 0,
          ncpu: info.NCPU || 0,
          memTotal: info.MemTotal || 0,
        },
        events,
      });
    }, 400);
  } catch (err) {
    res.status(500).json({ error: `Failed to fetch system logs: ${err.message}` });
  }
});

const si = require('systeminformation');

// GET /api/system/htop - Fetch running processes and system resources
router.get('/htop', async (req, res) => {
  try {
    const processes = await si.processes();
    const cpu = await si.currentLoad();
    const mem = await si.mem();
    
    // Sort logic will be handled by the frontend, but we can provide raw data
    res.json({
      cpu: {
        load: cpu.currentLoad,
        user: cpu.currentLoadUser,
        sys: cpu.currentLoadSystem,
      },
      mem: {
        total: mem.total,
        used: mem.active,
        free: mem.available,
      },
      processes: processes.list.map(p => ({
        pid: p.pid,
        name: p.name,
        cpu: p.cpu,
        mem: p.mem,
        user: p.user,
        state: p.state,
      }))
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to fetch htop data: ${err.message}` });
  }
});

module.exports = router;
