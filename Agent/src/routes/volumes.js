const express = require('express');
const router = express.Router();
const { docker } = require('../docker');

// GET /api/volumes - List all volumes and mapping to attached containers
router.get('/', async (req, res) => {
  try {
    const [volRes, containers] = await Promise.all([
      docker.listVolumes(),
      docker.listContainers({ all: true })
    ]);

    const rawVolumes = volRes.Volumes || [];

    const formattedVolumes = rawVolumes.map(vol => {
      const volName = vol.Name;
      const attachedContainers = [];

      containers.forEach(c => {
        const mounts = c.Mounts || [];
        const isAttached = mounts.some(m => m.Name === volName || m.Source.includes(volName));
        if (isAttached) {
          attachedContainers.push({
            id: c.Id.substring(0, 12),
            name: c.Names[0] ? c.Names[0].replace(/^\//, '') : 'unnamed',
            state: c.State
          });
        }
      });

      return {
        name: volName,
        driver: vol.Driver,
        mountpoint: vol.Mountpoint,
        created: vol.CreatedAt || null,
        attachedContainers
      };
    });

    res.json({ volumes: formattedVolumes });
  } catch (err) {
    console.error('Error listing volumes:', err.message);
    res.status(500).json({ error: `Failed to fetch volumes: ${err.message}` });
  }
});

// DELETE /api/volumes/:name - Remove a volume
router.delete('/:name', async (req, res) => {
  try {
    const volumeName = req.params.name;
    const volume = docker.getVolume(volumeName);
    await volume.remove();
    res.json({ success: true, message: `Volume ${volumeName} removed successfully` });
  } catch (err) {
    console.error(`Error removing volume ${req.params.name}:`, err.message);
    res.status(500).json({ error: `Failed to remove volume: ${err.message}` });
  }
});

module.exports = router;
