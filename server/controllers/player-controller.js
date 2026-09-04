const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// In-memory storage for local dev
let queue = [];
let preferences = {
  volume: 0.80,
  muted: false,
  repeat_mode: 'off',
  shuffle: false,
  current_track_id: null,
  current_position_seconds: 0,
};

// GET /player/queue - List queue items
router.get('/queue', (req, res) => {
  res.json({ success: true, queue });
});

// POST /player/queue - Add item to queue
router.post('/queue', (req, res) => {
  const track = req.body;
  if (!track || !track.video_id) {
    return res.status(400).json({ success: false, error: 'Missing track data' });
  }

  // Check if already in queue
  const existing = queue.find(q => q.track.video_id === track.video_id);
  if (existing) {
    return res.json({ success: true, track: existing.track, queueItem: existing });
  }

  const queueItem = {
    id: crypto.randomUUID(),
    position: queue.length,
    track: {
      id: crypto.randomUUID(),
      video_id: track.video_id,
      title: track.title,
      author: track.author,
      thumbnail: track.thumbnail,
      duration: track.duration,
      url: track.url,
    },
  };

  queue.push(queueItem);
  res.json({ success: true, track: queueItem.track, queueItem });
});

// DELETE /player/queue/:id - Remove item from queue
router.delete('/queue/:id', (req, res) => {
    const { id } = req.params;
    const idx = queue.findIndex(q => q.id === id);
    if (idx === -1) {
        return res.status(404).json({ success: false, error: 'Queue item not found' });
    }
    queue.splice(idx, 1);
    queue.forEach((q, i) => { q.position = i; });
    res.json({ success: true });
});

// DELETE /player/queue - Clear entire queue
router.delete('/queue', (req, res) => {
  queue = [];
  res.json({ success: true });
});

// PATCH /player/queue/reorder - Reorder queue items
router.patch('/queue/reorder', (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ success: false, error: 'Missing items array' });
  }
  items.forEach(update => {
    const item = queue.find(q => q.id === update.id);
    if (item) item.position = update.position;
  });
  queue.sort((a, b) => a.position - b.position);
  res.json({ success: true });
});

// GET /player/preferences - Get preferences
router.get('/preferences', (req, res) => {
  res.json({ success: true, preferences });
});

// PUT /player/preferences - Update preferences
router.put('/preferences', (req, res) => {
    const updates = req.body;
    if (updates.volume !== undefined) {
        const v = Number(updates.volume);
        preferences.volume = (Number.isFinite(v) && v >= 0 && v <= 1) ? v : preferences.volume;
    }
    if (updates.muted !== undefined) preferences.muted = !!updates.muted;
    if (updates.repeatMode !== undefined && ['off', 'all', 'one'].includes(updates.repeatMode)) {
        preferences.repeat_mode = updates.repeatMode;
    }
    if (updates.shuffle !== undefined) preferences.shuffle = !!updates.shuffle;
    if (updates.currentTrackId !== undefined) preferences.current_track_id = updates.currentTrackId;
    if (updates.currentPositionSeconds !== undefined) {
        const p = Number(updates.currentPositionSeconds);
        preferences.current_position_seconds = (Number.isFinite(p) && p >= 0) ? p : 0;
    }
    res.json({ success: true, preferences });
});

module.exports = router;
