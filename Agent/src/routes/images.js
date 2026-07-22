const express = require('express');
const router = express.Router();
const { docker } = require('../docker');

// GET /api/images - List local images
router.get('/', async (req, res) => {
  try {
    const images = await docker.listImages({ all: false });
    const formatted = images.map(img => ({
      id: img.Id.replace(/^sha256:/, '').substring(0, 12),
      fullId: img.Id,
      repoTags: img.RepoTags || ['<none>:<none>'],
      size: img.Size,
      created: img.Created
    }));
    res.json({ images: formatted });
  } catch (err) {
    res.status(500).json({ error: `Failed to list images: ${err.message}` });
  }
});

// POST /api/images/prune - Prune dangling images
router.post('/prune', async (req, res) => {
  try {
    const result = await docker.pruneImages({ filters: { dangling: ['true'] } });
    res.json({
      success: true,
      imagesDeleted: result.ImagesDeleted || [],
      spaceReclaimed: result.SpaceReclaimed || 0
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to prune images: ${err.message}` });
  }
});

module.exports = router;
