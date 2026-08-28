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
    this.hostDisconnectedAt = null; // set when host (display) disconnects
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

  addPlayer(socketId, playerName, playerId) {
    const player = {
      id: socketId,
      playerId: playerId || this.generatePlayerId(),
      name: playerName,
      avatar: null,
      hp: 100,
      maxHp: 100,
      score: 0,
      // Battle stats
      dodge: 0,        // 0-50%
      critical: 0,     // 0-25%
      alive: true,
      ready: false,
      connected: true
    };
    this.players.set(socketId, player);
    return player;
  }

  generatePlayerId() {
    return 'p_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
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

  // Mark a player as disconnected but keep them in the room (for rejoin during game)
  markDisconnected(socketId) {
    const player = this.players.get(socketId);
    if (player) {
      player.connected = false;
      player.disconnectedAt = Date.now();
    }
  }

  // Clear disconnect state when a player rejoins
  clearDisconnected(socketId) {
    const player = this.players.get(socketId);
    if (player) {
      player.connected = true;
      delete player.disconnectedAt;
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

  // Alive AND currently connected players (used to determine who must answer)
  getActivePlayers() {
    return Array.from(this.players.values()).filter(p => p.alive && p.connected);
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

  joinRoom(roomId, socketId, playerName, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: 'Room not found' };
    if (room.state !== 'LOBBY') return { error: 'Game already started' };
    if (room.players.size >= 10) return { error: 'Room is full' };

    const player = room.addPlayer(socketId, playerName, playerId);
    this.socketToRoom.set(socketId, roomId);
    return { room, player };
  }

  leaveRoom(socketId) {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (room) {
      // If the host (display) disconnected, track it for timeout
      if (room.hostSocketId === socketId) {
        room.hostDisconnectedAt = Date.now();
      }

      // During an active game, keep the player in the room so they can rejoin.
      // Only fully remove them if the game hasn't started (LOBBY) or is finished.
      if (room.state === 'PLAYING') {
        room.markDisconnected(socketId);
        // Don't delete socketToRoom mapping so we can find the room on rejoin
        return;
      }
      room.removePlayer(socketId);
      if (room.players.size === 0) {
        this.rooms.delete(roomId);
        console.log(`[Room] ${roomId} deleted (empty)`);
      }
    }
    this.socketToRoom.delete(socketId);
  }

  // Rejoin a disconnected player using their stable playerId
  rejoinPlayer(roomId, playerId, newSocketId) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: 'Room not found' };

    // Find the player by stable playerId
    let targetPlayer = null;
    let oldSocketId = null;
    for (const [sid, p] of room.players) {
      if (p.playerId === playerId) {
        targetPlayer = p;
        oldSocketId = sid;
        break;
      }
    }

    if (!targetPlayer) return { error: 'Player not found' };

    // If the player is already connected on this socket, nothing to do
    if (oldSocketId === newSocketId) {
      return { room, player: targetPlayer, rejoined: false };
    }

    // Remove old socket mapping, update player to new socket
    room.players.delete(oldSocketId);
    targetPlayer.id = newSocketId;
    targetPlayer.connected = true;
    delete targetPlayer.disconnectedAt;
    room.players.set(newSocketId, targetPlayer);

    // Update socketToRoom mapping
    this.socketToRoom.delete(oldSocketId);
    this.socketToRoom.set(newSocketId, roomId);

    // If this player was the host, update hostSocketId
    if (room.hostSocketId === oldSocketId) {
      room.hostSocketId = newSocketId;
      room.hostDisconnectedAt = null;
    }

    return { room, player: targetPlayer, rejoined: true };
  }

  // Check for players/host that have been disconnected too long and handle timeouts.
  // Returns an array of actions to take: { type: 'kickPlayer', roomId, playerId } or { type: 'endGame', roomId }
  checkTimeouts() {
    const now = Date.now();
    const actions = [];

    for (const [roomId, room] of this.rooms) {
      // Host (display) timeout: 300s -> end the game
      if (room.state === 'PLAYING' && room.hostDisconnectedAt) {
        if (now - room.hostDisconnectedAt > 300 * 1000) {
          actions.push({ type: 'endGame', roomId });
          continue;
        }
      }

      // Player timeout: 120s -> kick out
      for (const [sid, p] of room.players) {
        if (!p.connected && p.disconnectedAt && now - p.disconnectedAt > 120 * 1000) {
          actions.push({ type: 'kickPlayer', roomId, playerId: p.playerId, socketId: sid });
        }
      }
    }

    return actions;
  }

  // Kick a player out of the room (after timeout)
  kickPlayer(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    let targetSocketId = null;
    for (const [sid, p] of room.players) {
      if (p.playerId === playerId) {
        targetSocketId = sid;
        break;
      }
    }

    if (!targetSocketId) return null;

    room.removePlayer(targetSocketId);
    this.socketToRoom.delete(targetSocketId);

    // If room is now empty, delete it
    if (room.players.size === 0) {
      this.rooms.delete(roomId);
      console.log(`[Room] ${roomId} deleted (all players kicked)`);
    }

    return { roomId, playerId, socketId: targetSocketId };
  }

  // End the game for a room (host timed out)
  endGame(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    // Remove all players and the room
    for (const sid of room.players.keys()) {
      this.socketToRoom.delete(sid);
    }
    this.rooms.delete(roomId);
    console.log(`[Room] ${roomId} ended (host timed out)`);
    return { roomId };
  }

  // Rejoin the host (display) after a disconnect using the roomId
  rejoinHost(roomId, newSocketId) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: 'Room not found' };

    // If the host is already connected on this socket, nothing to do
    if (room.hostSocketId === newSocketId) {
      return { room, rejoined: false };
    }

    // Update host socket id and clear disconnect timeout
    const oldHostSocketId = room.hostSocketId;
    room.hostSocketId = newSocketId;
    room.hostDisconnectedAt = null;

    // Update socketToRoom mapping for the host
    this.socketToRoom.delete(oldHostSocketId);
    this.socketToRoom.set(newSocketId, roomId);

    return { room, rejoined: true };
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
