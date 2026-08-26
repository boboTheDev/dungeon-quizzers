const express = require('express');
const router = express.Router();
const { gameManager } = require('../game/GameManager');
const questionLoader = require('../questions/loader');

// Create room
router.post('/room', async (req, res) => {
  try {
    const room = gameManager.createRoom(null); // Host socket will be set via socket
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const qr = await room.getQrUrl(baseUrl);
    
    res.json({
      success: true,
      room: {
        id: room.id,
        qrUrl: qr.url,
        qrImage: qr.qrDataUrl
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get room status
router.get('/room/:id', (req, res) => {
  const room = gameManager.getRoom(req.params.id);
  if (!room) {
    return res.status(404).json({ success: false, error: 'Room not found' });
  }
  res.json({ success: true, room: room.getState() });
});

// List question sets
router.get('/questions', (req, res) => {
  const sets = questionLoader.listSets();
  res.json({ success: true, sets });
});

// Reload questions
router.post('/questions/reload', (req, res) => {
  questionLoader.reload();
  res.json({ success: true, message: 'Questions reloaded' });
});

// List avatars
router.get('/avatars', (req, res) => {
  const avatars = [
    { id: 01, name: 'Knight',   class: 'Tank',     color: '#4A90D9', weapon: 'Sword + Shield', stats: 'HP 120 | Dodge +12% | Crit +4% | DMG 8',  special: 'Counter: 25% chance counter on defend' },
    { id: 02, name: 'Mage',     class: 'DPS',      color: '#9B59B6', weapon: 'Staff',          stats: 'HP 80 | Dodge +8% | Crit +8% | DMG 14',   special: 'Burst: Critical x3 instead of x2' },
    { id: 03, name: 'Archer',   class: 'Ranged',   color: '#27AE60', weapon: 'Bow',            stats: 'HP 95 | Dodge +12% | Crit +5% | DMG 11',  special: 'Multi-Shot: 20% bonus hit on attack' },
    { id: 04, name: 'Ninja',    class: 'Speed',    color: '#2C3E50', weapon: 'Kunai',          stats: 'HP 85 | Dodge +15% | Crit +6% | DMG 10',  special: 'Assassinate: Fast answer = auto crit' },
    { id: 05, name: 'Healer',   class: 'Support',  color: '#ECF0F1', weapon: 'Holy Staff',     stats: 'HP 100 | Dodge +8% | Crit +4% | DMG 8',   special: 'Heal: +15 HP to ally on defend' },
    { id: 06, name: 'Berserker',class: 'DPS',      color: '#E74C3C', weapon: 'Double Axes',    stats: 'HP 75 | Dodge +5% | Crit +8% | DMG 16',   special: 'Bloodlust: Low HP = high damage' }
  ];
  res.json({ success: true, avatars });
});

module.exports = router;
