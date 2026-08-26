const QRCode = require('qrcode');

// Class-specific stats
const CLASS_STATS = {
  1: { hp: 120, baseDmg: 8,  dodgeGrowth: 12, critGrowth: 4, className: 'Knight',    healAmount: 0, special: 'Counter' },
  2: { hp: 80,  baseDmg: 14, dodgeGrowth: 8,  critGrowth: 8, className: 'Mage',      healAmount: 0, special: 'Burst' },
  3: { hp: 95,  baseDmg: 11, dodgeGrowth: 12, critGrowth: 5, className: 'Archer',    healAmount: 0, special: 'Multi-Shot' },
  4: { hp: 85,  baseDmg: 10, dodgeGrowth: 15, critGrowth: 6, className: 'Ninja',     healAmount: 0, special: 'Assassinate' },
  5: { hp: 100, baseDmg: 8,  dodgeGrowth: 8,  critGrowth: 4, className: 'Healer',    healAmount: 15, special: 'Heal' },
  6: { hp: 75,  baseDmg: 16, dodgeGrowth: 5,  critGrowth: 8, className: 'Berserker', healAmount: 0, special: 'Bloodlust' }
};

class Room {
  constructor(hostSocketId) {
    this.id = this.generateId();
    this.hostSocketId = hostSocketId;
    this.players = new Map();
    this.state = 'LOBBY'; // LOBBY, AVATAR, PLAYING, FINISHED
    this.currentWave = 0;
    this.currentQuestion = 0;
    this.questions = [];
    this.monsters = [];
    this.currentMonster = null;
    this.turn = 'PLAYER'; // PLAYER or MONSTER
    this.round = 0;
    this.createdAt = Date.now();
  }

  generateId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  async getQrUrl(baseUrl) {
    const url = `${baseUrl}/player/?room=${this.id}`;
    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    return { url, qrDataUrl };
  }

  addPlayer(socketId, playerName) {
    const player = {
      id: socketId,
      name: playerName,
      avatar: null,
      hp: 100,
      maxHp: 100,
      score: 0,
      // Battle stats
      dodge: 0,        // 0-50%
      critical: 0,     // 0-25%
      alive: true,
      ready: false
    };
    this.players.set(socketId, player);
    return player;
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
    if (socketId === this.hostSocketId) {
      const firstPlayer = this.players.keys().next().value;
      if (firstPlayer) {
        this.hostSocketId = firstPlayer;
      }
    }
  }

  selectAvatar(socketId, avatarId) {
    const player = this.players.get(socketId);
    if (player) {
      player.avatar = avatarId;
      player.ready = true;

      // Apply class-specific stats
      const cls = CLASS_STATS[avatarId];
      if (cls) {
        player.maxHp = cls.hp;
        player.hp = cls.hp;
        player.className = cls.className;
        player.baseDmg = cls.baseDmg;
        player.dodgeGrowth = cls.dodgeGrowth;
        player.critGrowth = cls.critGrowth;
        player.healAmount = cls.healAmount;
        player.special = cls.special;
      }
    }
    return player;
  }

  allPlayersReady() {
    if (this.players.size === 0) return false;
    return Array.from(this.players.values()).every(p => p.ready);
  }

  // Update player stats after answer
  updatePlayerStats(socketId, isCorrect) {
    const player = this.players.get(socketId);
    if (!player) return null;

    const dodgeGrowth = player.dodgeGrowth || 10;
    const critGrowth = player.critGrowth || 5;

    if (isCorrect) {
      // Increase stats
      player.dodge = Math.min(50, player.dodge + dodgeGrowth);
      player.critical = Math.min(25, player.critical + critGrowth);
    } else {
      // Reset stats
      player.dodge = 0;
      player.critical = 0;
    }

    return player;
  }

  // Calculate critical damage
  // Mage special: Burst = x3 instead of x2
  calculateCriticalDamage(baseDamage, playerCritical, special) {
    const roll = Math.random() * 100;
    const isCritical = roll < playerCritical;
    const critMult = (isCritical && special === 'Burst') ? 3 : (isCritical ? 2 : 1);
    return {
      damage: Math.floor(baseDamage * critMult),
      isCritical,
      critMult
    };
  }

  // Berserker special: Bloodlust — lower HP = more damage (max x2 at 0% HP)
  calculateBloodlust(baseDamage, hp, maxHp) {
    const hpRatio = Math.max(0, hp / maxHp); // 1.0 = full, 0.0 = dead
    const mult = 1 + (1 - hpRatio); // 1.0 at full HP, 2.0 at 0 HP
    return Math.floor(baseDamage * mult);
  }

  // Knight special: Counter — 25% chance to counter-attack on defend
  counterAttack(baseDmg) {
    const roll = Math.random() * 100;
    if (roll < 25) {
      return { triggered: true, damage: baseDmg };
    }
    return { triggered: false, damage: 0 };
  }

  // Archer special: Multi-Shot — 20% chance for bonus hit
  multiShot(baseDmg) {
    const roll = Math.random() * 100;
    if (roll < 20) {
      return { triggered: true, damage: baseDmg };
    }
    return { triggered: false, damage: 0 };
  }

  // Calculate dodge result
  calculateDodge(monsterDamage, playerDodge) {
    const roll = Math.random() * 100;
    const isDodged = roll < playerDodge;
    return {
      damage: isDodged ? 0 : Math.floor(monsterDamage * (1 - playerDodge / 100)),
      isDodged,
      actualDamage: isDodged ? 0 : Math.floor(monsterDamage * (1 - playerDodge / 100))
    };
  }

  // Healer heal — heals lowest HP alive ally (or self)
  healPlayer(healerId, healAmount) {
    const alivePlayers = this.getAlivePlayers();
    if (alivePlayers.length === 0) return null;

    // Find lowest HP ally (not healer if possible)
    let target = alivePlayers
      .filter(p => p.id !== healerId)
      .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];

    // If no allies, heal self
    if (!target) target = alivePlayers.find(p => p.id === healerId);
    if (!target) return null;

    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + healAmount);
    const healed = target.hp - before;

    return { targetId: target.id, targetName: target.name, healed, hp: target.hp, maxHp: target.maxHp };
  }

  getPlayersArray() {
    return Array.from(this.players.values());
  }

  getAlivePlayers() {
    return Array.from(this.players.values()).filter(p => p.alive);
  }

  // Get all alive monsters in current wave
  getAliveMonstersInWave(wave) {
    return this.monsters.filter(m => m.wave === wave && m.hp > 0);
  }

  // Pick a random alive monster from current wave
  getRandomAliveMonster(wave) {
    const alive = this.getAliveMonstersInWave(wave);
    if (alive.length === 0) return null;
    return alive[Math.floor(Math.random() * alive.length)];
  }

  getState() {
    return {
      id: this.id,
      hostSocketId: this.hostSocketId,
      players: this.getPlayersArray(),
      state: this.state,
      currentWave: this.currentWave,
      currentQuestion: this.currentQuestion,
      playerCount: this.players.size
    };
  }
}

// Room Manager
class GameManager {
  constructor() {
    this.rooms = new Map();
    this.socketToRoom = new Map();
  }

  createRoom(hostSocketId) {
    const room = new Room(hostSocketId);
    this.rooms.set(room.id, room);
    this.socketToRoom.set(hostSocketId, room.id);
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  getRoomBySocket(socketId) {
    const roomId = this.socketToRoom.get(socketId);
    return roomId ? this.rooms.get(roomId) : null;
  }

  joinRoom(roomId, socketId, playerName) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: 'Room not found' };
    if (room.state !== 'LOBBY') return { error: 'Game already started' };
    if (room.players.size >= 10) return { error: 'Room is full' };

    const player = room.addPlayer(socketId, playerName);
    this.socketToRoom.set(socketId, roomId);
    return { room, player };
  }

  leaveRoom(socketId) {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (room) {
      room.removePlayer(socketId);
      if (room.players.size === 0) {
        this.rooms.delete(roomId);
        console.log(`[Room] ${roomId} deleted (empty)`);
      }
    }
    this.socketToRoom.delete(socketId);
  }

  selectAvatar(socketId, avatarId) {
    const room = this.getRoomBySocket(socketId);
    if (!room) return { error: 'Not in a room' };
    
    const player = room.selectAvatar(socketId, avatarId);
    return { room, player };
  }

  startGame(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: 'Room not found' };
    if (!room.allPlayersReady()) return { error: 'Not all players ready' };

    room.state = 'PLAYING';
    return { room };
  }

  cleanUp() {
    // Remove rooms older than 1 hour
    const oneHour = 60 * 60 * 1000;
    for (const [id, room] of this.rooms) {
      if (Date.now() - room.createdAt > oneHour) {
        this.rooms.delete(id);
        console.log(`[Room] ${id} cleaned up (expired)`);
      }
    }
  }
}

// Singleton
const gameManager = new GameManager();

// Cleanup old rooms every 10 minutes
setInterval(() => gameManager.cleanUp(), 10 * 60 * 1000);

module.exports = { Room, GameManager, gameManager };
