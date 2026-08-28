const { gameManager } = require('../game/GameManager');
const questionLoader = require('../questions/loader');

// Track answered players per question per room
const answeredPlayers = new Map(); // roomId -> Set of playerIds

// Store io reference for the timeout checker (set on first connection)
let ioRef = null;

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function socketHandler(io, socket) {
  ioRef = io;
  
  // Create room (host)
  socket.on('create-room', async (callback) => {
    const room = gameManager.createRoom(socket.id);
    const protocol = socket.handshake.headers['x-forwarded-proto'] || 'https';
    const baseUrl = `${protocol}://${socket.handshake.headers.host || 'localhost:3000'}`;
    const qr = await room.getQrUrl(baseUrl);
    
    socket.join(room.id);
    
    console.log(`[Room] Created: ${room.id} by ${socket.id}`);
    
    callback({
      success: true,
      room: {
        id: room.id,
        qrUrl: qr.url,
        qrImage: qr.qrDataUrl
      }
    });
  });

  // Join room (player)
  socket.on('join-room', ({ roomId, playerName, playerId }, callback) => {
    const result = gameManager.joinRoom(roomId, socket.id, playerName, playerId);
    
    if (result.error) {
      return callback({ success: false, error: result.error });
    }

    const { room, player } = result;
    socket.join(roomId);
    
    socket.to(roomId).emit('player-joined', { player });

    console.log(`[Room] ${roomId}: ${playerName} joined (${room.players.size} players)`);

    callback({
      success: true,
      player,
      room: room.getState()
    });
  });

  // Rejoin room after disconnect (during active game)
  socket.on('rejoin', ({ roomId, playerId }, callback) => {
    const result = gameManager.rejoinPlayer(roomId, playerId, socket.id);
    
    if (result.error) {
      return callback({ success: false, error: result.error });
    }

    const { room, player, rejoined } = result;
    socket.join(roomId);

    console.log(`[Room] ${roomId}: ${player.name} rejoined (${rejoined ? 'reconnected' : 'already connected'})`);

    // Notify others that this player is back
    socket.to(roomId).emit('player-rejoined', { playerId: player.id, name: player.name });

    // Send current game state so the rejoined player can sync up
    const currentQuestion = room.turn === 'PLAYER'
      ? (room.attackQuestions && room.attackQuestions[room.attackQuestionIdx - 1])
      : (room.defenseQuestions && room.defenseQuestions[room.defenseQuestionIdx - 1]);

    callback({
      success: true,
      player,
      rejoined,
      room: room.getState(),
      gameState: {
        turn: room.turn,
        round: room.round,
        currentWave: room.currentWave,
        monsters: room.monsters.map(m => ({ id: m.id, name: m.name, hp: m.hp, maxHp: m.maxHp, wave: m.wave, type: m.type })),
        players: room.getPlayersArray(),
        currentQuestion: currentQuestion ? {
          questionIdx: room.turn === 'PLAYER' ? room.attackQuestionIdx - 1 : room.defenseQuestionIdx - 1,
          question: {
            text: currentQuestion.question,
            options: currentQuestion.options,
            time: currentQuestion.time
          },
          timeLimit: currentQuestion.time,
          turn: room.turn
        } : null
      }
    });
  });

  // Rejoin host (display) after disconnect
  socket.on('rejoin-host', ({ roomId }, callback) => {
    const result = gameManager.rejoinHost(roomId, socket.id);

    if (result.error) {
      return callback({ success: false, error: result.error });
    }

    const { room, rejoined } = result;
    socket.join(roomId);

    console.log(`[Room] ${roomId}: Host rejoined (${rejoined ? 'reconnected' : 'already connected'})`);

    // Send current game state so the display can sync up
    callback({
      success: true,
      rejoined,
      room: room.getState(),
      gameState: {
        turn: room.turn,
        round: room.round,
        currentWave: room.currentWave,
        monsters: room.monsters.map(m => ({ id: m.id, name: m.name, hp: m.hp, maxHp: m.maxHp, wave: m.wave, type: m.type })),
        players: room.getPlayersArray(),
        state: room.state
      }
    });
  });

  // Select avatar
  socket.on('select-avatar', ({ avatarId }, callback) => {
    const result = gameManager.selectAvatar(socket.id, avatarId);
    
    if (result.error) {
      return callback({ success: false, error: result.error });
    }

    const { room, player } = result;
    
    socket.to(room.id).emit('avatar-selected', {
      playerId: socket.id,
      avatarId
    });

    console.log(`[Room] ${room.id}: ${player.name} selected avatar ${avatarId}`);

    callback({
      success: true,
      player,
      allReady: room.allPlayersReady()
    });
  });

  // Start game (host)
  socket.on('start-game', ({ roomId }, callback) => {
    const result = gameManager.startGame(roomId);
    
    if (result.error) {
      return callback({ success: false, error: result.error });
    }

    const { room } = result;
    
    // Initialize answered tracking
    answeredPlayers.set(roomId, new Set());

    // Load questions - separate for attack and defense
    const allQuestions = questionLoader.getRandomSet(40);
    room.attackQuestions = allQuestions.filter((_, i) => i % 2 === 0); // Even indices = attack
    room.defenseQuestions = allQuestions.filter((_, i) => i % 2 === 1); // Odd indices = defense
    room.attackQuestionIdx = 0;
    room.defenseQuestionIdx = 0;

    // Initialize monsters — multi-monster per wave
    room.monsters = [
      { id: 1, name: 'Slime', hp: 30, maxHp: 30, damage: 5, wave: 1, type: 'monster' },
      { id: 2, name: 'Goblin', hp: 50, maxHp: 50, damage: 8, wave: 1, type: 'monster' },
      { id: 3, name: 'Skeleton', hp: 70, maxHp: 70, damage: 12, wave: 2, type: 'monster' },
      { id: 4, name: 'Orc', hp: 90, maxHp: 90, damage: 15, wave: 2, type: 'monster' },
      { id: 5, name: 'Dragon', hp: 120, maxHp: 120, damage: 20, wave: 3, type: 'monster' },
      { id: 6, name: 'Demon Lord', hp: 200 + room.players.size * 20, maxHp: 200 + room.players.size * 20, damage: 25, wave: 4, type: 'boss' }
    ];
    
    room.currentWave = 1;
    room.currentMonster = room.getRandomAliveMonster(1); // Random target from wave 1
    room.turn = 'PLAYER';
    room.round = 1;

    // Broadcast to all players — include all monsters for multi-monster display
    io.to(roomId).emit('game-start', {
      players: room.getPlayersArray(),
      monsters: room.monsters,
      currentWave: room.currentWave,
      turn: 'PLAYER',
      round: 1
    });

    // Send first attack question
    sendAttackQuestion(io, room);

    console.log(`[Room] ${roomId}: Game started!`);

    callback({ success: true });
  });

  // Submit answer (both attack and defense)
  socket.on('answer', ({ questionIdx, answerIdx, timeMs, turn }, callback) => {
    const room = gameManager.getRoomBySocket(socket.id);
    if (!room) {
      return callback({ success: false, error: 'Not in a room' });
    }

    const player = room.players.get(socket.id);
    if (!player || !player.alive) {
      return callback({ success: false, error: 'Player not found or dead' });
    }

    // Check if already answered this question
    const answered = answeredPlayers.get(room.id);
    if (answered && answered.has(socket.id)) {
      return callback({ success: false, error: 'Already answered' });
    }

    // Get the correct question based on turn
    const questions = turn === 'PLAYER' ? room.attackQuestions : room.defenseQuestions;
    const qIdx = turn === 'PLAYER' ? room.attackQuestionIdx : room.defenseQuestionIdx;
    const question = questions[qIdx - 1]; // -1 because we already incremented
    
    if (!question) {
      return callback({ success: false, error: 'Question not found' });
    }

    const isCorrect = answerIdx === question.correctIndex;
    let result = {};

    if (turn === 'PLAYER') {
      // Player Turn - Attack
      if (isCorrect) {
        // Pick random alive monster in current wave to attack
        const targetMonster = room.getRandomAliveMonster(room.currentWave);
        
        // Calculate base damage
        const speedBonus = Math.max(0, (question.time - timeMs / 1000) / question.time * 5);
        const baseDmg = player.baseDmg || 10;
        let baseDamage = Math.floor(baseDmg + speedBonus);

        let specialTriggered = false;

        // Ninja special: Assassinate — speed bonus > 3 = auto crit
        if (player.special === 'Assassinate' && speedBonus > 3) {
          baseDamage = Math.floor(baseDamage * 2);
          specialTriggered = true;
        }

        // Berserker special: Bloodlust — lower HP = more damage
        if (player.special === 'Bloodlust') {
          baseDamage = room.calculateBloodlust(baseDamage, player.hp, player.maxHp);
        }

        // Check critical (Mage: Burst = x3)
        const critResult = room.calculateCriticalDamage(baseDamage, player.critical, player.special);
        baseDamage = critResult.damage;
        if (critResult.isCritical) specialTriggered = true;

        // Archer special: Multi-Shot — 20% bonus hit
        let multiShotResult = null;
        if (player.special === 'Multi-Shot') {
          multiShotResult = room.multiShot(player.baseDmg || 10);
          if (multiShotResult.triggered) {
            baseDamage += multiShotResult.damage;
            specialTriggered = true;
          }
        }
        
        // Apply damage to target monster
        if (targetMonster) {
          targetMonster.hp = Math.max(0, targetMonster.hp - baseDamage);
        }
        
        player.score += baseDamage * 10;
        
        result = {
          isCorrect,
          damage: baseDamage,
          isCritical: critResult.isCritical,
          critMult: critResult.critMult,
          specialTriggered,
          multiShot: multiShotResult,
          targetMonsterId: targetMonster ? targetMonster.id : null,
          targetMonsterName: targetMonster ? targetMonster.name : null,
          targetMonsterHp: targetMonster ? targetMonster.hp : 0,
          monsters: room.getAliveMonstersInWave(room.currentWave).map(m => ({ id: m.id, name: m.name, hp: m.hp, maxHp: m.maxHp }))
        };
      } else {
        result = { isCorrect, damage: 0, isCritical: false };
      }
    } else {
      // Monster Turn - Defense
      // Pick random alive monster in current wave to attack this player
      const attackerMonster = room.getRandomAliveMonster(room.currentWave);

      if (isCorrect) {
        // Successfully defended
        result = { isCorrect, defended: true, damage: 0 };

        // Healer special: heal lowest ally on correct defense
        if (player.healAmount && player.healAmount > 0) {
          const healResult = room.healPlayer(socket.id, player.healAmount);
          if (healResult) {
            result.heal = healResult;
            if (!room.healedThisTurn) room.healedThisTurn = [];
            room.healedThisTurn.push(healResult);
            console.log(`[Heal] ${player.name} healed ${healResult.targetName} for ${healResult.healed} HP`);
          }
        }

        // Knight special: Counter — 25% chance to counter-attack a random alive monster
        if (player.special === 'Counter') {
          const counter = room.counterAttack(player.baseDmg || 8);
          if (counter.triggered && attackerMonster) {
            attackerMonster.hp = Math.max(0, attackerMonster.hp - counter.damage);
            result.counter = { damage: counter.damage, targetMonsterId: attackerMonster.id, monsterHp: attackerMonster.hp };
            if (!room.counteredThisTurn) room.counteredThisTurn = [];
            room.counteredThisTurn.push({ playerId: socket.id, damage: counter.damage, targetMonsterId: attackerMonster.id });
            console.log(`[Counter] ${player.name} counter-attacked ${attackerMonster.name} for ${counter.damage} damage`);
          }
        }
      } else {
        // Failed to defend - calculate dodge using random attacker's damage
        const monsterDamage = attackerMonster ? attackerMonster.damage : 10;
        const dodgeResult = room.calculateDodge(monsterDamage, player.dodge);
        
        // Apply damage to player
        player.hp = Math.max(0, player.hp - dodgeResult.damage);

        // Kill player if HP <= 0
        if (player.hp <= 0) {
          player.alive = false;
        }
        
        // Track that this player took damage (for display anim)
        if (!dodgeResult.isDodged && dodgeResult.damage > 0) {
          if (!room.damagedThisTurn) room.damagedThisTurn = [];
          room.damagedThisTurn.push(socket.id);
        }
        
        result = {
          isCorrect,
          defended: false,
          damage: dodgeResult.damage,
          isDodged: dodgeResult.isDodged,
          attackerMonsterName: attackerMonster ? attackerMonster.name : null,
          playerHp: player.hp,
          playerMaxHp: player.maxHp
        };
      }
    }

    // Update player stats (Dodge + Critical)
    room.updatePlayerStats(socket.id, isCorrect);

    // Mark as answered
    if (answered) {
      answered.add(socket.id);
    }

    // Get updated player
    const updatedPlayer = room.players.get(socket.id);

    console.log(`[Battle] ${player.name} (${turn}): ${isCorrect ? 'CORRECT' : 'WRONG'}`, result);

    callback({
      success: true,
      ...result,
      player: {
        hp: updatedPlayer.hp,
        maxHp: updatedPlayer.maxHp,
        score: updatedPlayer.score,
        dodge: updatedPlayer.dodge,
        critical: updatedPlayer.critical,
        className: updatedPlayer.className,
        special: updatedPlayer.special
      }
    });

    // Check if all alive AND connected players answered
    const activePlayers = room.getActivePlayers();
    const allAnswered = answered && activePlayers.every(p => answered.has(p.id));

    if (allAnswered) {
      setTimeout(() => {
        processTurnEnd(io, room, turn);
      }, 1500);
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    const room = gameManager.getRoomBySocket(socket.id);
    if (room) {
      console.log(`[Room] ${room.id}: Player ${socket.id} disconnected`);
      
      const answered = answeredPlayers.get(room.id);
      if (answered) {
        answered.delete(socket.id);
      }
      
      // During active game, keep player in room for rejoin (mark disconnected)
      gameManager.leaveRoom(socket.id);
      
      socket.to(room.id).emit('player-left', {
        playerId: socket.id
      });
    }
  });
}

function processTurnEnd(io, room, turn) {
  // Send battle results to all players — include all monsters
  const allPlayers = room.getPlayersArray();
  const waveMonsters = room.getAliveMonstersInWave(room.currentWave);
  
  io.to(room.id).emit('turn-end', {
    turn,
    players: allPlayers,
    monsters: room.monsters.map(m => ({ id: m.id, name: m.name, hp: m.hp, maxHp: m.maxHp, wave: m.wave, type: m.type })),
    currentWave: room.currentWave,
    damagedPlayerIds: room.damagedThisTurn || [],
    healedPlayers: room.healedThisTurn || [],
    counteredPlayers: room.counteredThisTurn || []
  });

  // Clear tracking for next turn
  room.damagedThisTurn = [];
  room.healedThisTurn = [];
  room.counteredThisTurn = [];

  // Check if ALL monsters in current wave are dead (after Player Turn)
  if (turn === 'PLAYER' && waveMonsters.length === 0) {
    console.log(`[Battle] Wave ${room.currentWave} cleared!`);
    
    // Check if boss wave was cleared — game over victory
    const bossMonster = room.monsters.find(m => m.type === 'boss');
    if (bossMonster && bossMonster.hp <= 0) {
      setTimeout(() => {
        io.to(room.id).emit('game-over', {
          players: room.getAlivePlayers(),
          winner: room.getAlivePlayers().sort((a, b) => b.score - a.score)[0]
        });
        answeredPlayers.delete(room.id);
      }, 2000);
      return;
    }
    
    // Find next wave
    const nextWaveMonsters = room.monsters.filter(m => m.wave > room.currentWave && m.hp > 0);
    if (nextWaveMonsters.length > 0) {
      const nextWave = nextWaveMonsters[0].wave;
      const defeatedMonsters = room.monsters.filter(m => m.wave === room.currentWave);
      
      room.currentWave = nextWave;
      room.currentMonster = room.getRandomAliveMonster(nextWave);
      
      setTimeout(() => {
        io.to(room.id).emit('wave-complete', {
          defeatedMonsters: defeatedMonsters.map(m => m.name),
          nextWave: room.currentWave,
          monsters: room.getAliveMonstersInWave(room.currentWave).map(m => ({ id: m.id, name: m.name, hp: m.hp, maxHp: m.maxHp }))
        });
        
        // Reset for next wave - start with PLAYER turn
        room.turn = 'PLAYER';
        room.round++;
        answeredPlayers.set(room.id, new Set());
        
        setTimeout(() => {
          sendAttackQuestion(io, room);
        }, 2000);
      }, 1000);
      return;
    }
  }

  // Check if all players dead (after Monster Turn)
  if (turn === 'MONSTER') {
    const alivePlayers = room.getAlivePlayers();
    if (alivePlayers.length === 0) {
      setTimeout(() => {
        io.to(room.id).emit('game-over', {
          players: room.getPlayersArray(),
          winner: null,
          reason: 'All players defeated!'
        });
        answeredPlayers.delete(room.id);
      }, 2000);
      return;
    }
  }

  // Switch turn
  if (turn === 'PLAYER') {
    // After Player Turn → Monster Turn
    room.turn = 'MONSTER';
    answeredPlayers.set(room.id, new Set());
    
    setTimeout(() => {
      sendDefenseQuestion(io, room);
    }, 1500);
  } else {
    // After Monster Turn → Next Player Turn
    room.turn = 'PLAYER';
    room.round++;
    answeredPlayers.set(room.id, new Set());
    
    setTimeout(() => {
      sendAttackQuestion(io, room);
    }, 1500);
  }
}

function sendAttackQuestion(io, room) {
  // Recycle questions if exhausted — game only ends on boss kill or all players dead
  if (room.attackQuestionIdx >= room.attackQuestions.length) {
    room.attackQuestions = shuffle([...room.attackQuestions]);
    room.attackQuestionIdx = 0;
    console.log(`[Room] ${room.id}: Attack questions recycled`);
  }

  const question = room.attackQuestions[room.attackQuestionIdx];
  
  io.to(room.id).emit('new-question', {
    questionIdx: room.attackQuestionIdx,
    question: {
      text: question.question,
      options: question.options,
      time: question.time
    },
    timeLimit: question.time,
    turn: 'PLAYER',
    monsters: room.getAliveMonstersInWave(room.currentWave).map(m => ({ id: m.id, name: m.name, hp: m.hp, maxHp: m.maxHp, damage: m.damage })),
    wave: room.currentWave,
    round: room.round
  });

  room.attackQuestionIdx++;
}

function sendDefenseQuestion(io, room) {
  // Recycle questions if exhausted
  if (room.defenseQuestionIdx >= room.defenseQuestions.length) {
    room.defenseQuestions = shuffle([...room.defenseQuestions]);
    room.defenseQuestionIdx = 0;
    console.log(`[Room] ${room.id}: Defense questions recycled`);
  }

  const question = room.defenseQuestions[room.defenseQuestionIdx];
  
  io.to(room.id).emit('new-question', {
    questionIdx: room.defenseQuestionIdx,
    question: {
      text: question.question,
      options: question.options,
      time: question.time
    },
    timeLimit: question.time,
    turn: 'MONSTER',
    monsters: room.getAliveMonstersInWave(room.currentWave).map(m => ({ id: m.id, name: m.name, hp: m.hp, maxHp: m.maxHp, damage: m.damage })),
    wave: room.currentWave,
    round: room.round
  });

  room.defenseQuestionIdx++;
}

module.exports = socketHandler;

// ===== TIMEOUT CHECKER =====
// Runs periodically to kick players disconnected >120s and end games when host is gone >300s
setInterval(() => {
  const actions = gameManager.checkTimeouts();
  for (const action of actions) {
    if (action.type === 'kickPlayer') {
      const result = gameManager.kickPlayer(action.roomId, action.playerId);
      if (result) {
        console.log(`[Timeout] Kicked player ${action.playerId} from room ${action.roomId} (disconnected >120s)`);
        // Notify remaining players that this player was removed
        const room = gameManager.getRoom(action.roomId);
        if (room && ioRef) {
          ioRef.to(action.roomId).emit('player-left', { playerId: result.socketId, reason: 'timeout' });
        }
      }
    } else if (action.type === 'endGame') {
      const result = gameManager.endGame(action.roomId);
      if (result) {
        console.log(`[Timeout] Ended game in room ${action.roomId} (host disconnected >300s)`);
        if (ioRef) {
          ioRef.to(action.roomId).emit('game-over', {
            players: [],
            winner: null,
            reason: 'Host disconnected'
          });
        }
        answeredPlayers.delete(action.roomId);
      }
    }
  }
}, 5000);
