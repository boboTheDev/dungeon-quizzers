# AGENTS.md — Dungeon Quizzers

## Project Overview
Multiplayer quiz battle game. Players scan QR to join from mobile, fight monsters/bosses in 2.5D, answer questions to attack/defend. Turn-based battle system.

**Run:** `npm start` → http://localhost:3000
- Display: http://localhost:3000/display
- Player: http://localhost:3000/player?room=[CODE]

## Architecture

```
server/
├── index.js              # Express + Socket.IO entry point
├── game/
│   └── GameManager.js    # Room class + GameManager class + CLASS_STATS
├── questions/
│   └── loader.js         # MD file parser (gray-matter)
└── routes/
    ├── api.js            # REST API (rooms, avatars, questions)
    └── socket.js         # All socket event handlers + special ability logic

public/
├── display/
│   ├── index.html        # Main screen (Canvas 2.5D, single file)
│   └── sprites/          # Sprite sheet PNGs (all entities load from here)
└── player/
    └── index.html        # Mobile UI (single file, loads display sprites for avatar preview)

questions/                # Question bank (MD files)
├── math/                 # Math questions
├── science/              # Science questions
└── general/              # General knowledge
```

## Battle System — Turn-Based

Each round has two turns:
1. **PLAYER TURN** — Player answers attack question → correct = damage to monster (with special abilities), wrong = miss + stats reset
2. **MONSTER TURN** — Player answers defense question → correct = block (+ special abilities like heal/counter), wrong = take damage based on dodge%

### Class System

Each player selects a class with unique stats and a **passive special ability** (triggers automatically):

| # | Class | Role | HP | Base DMG | Dodge/Correct | Crit/Correct | Special |
|---|-------|------|----|----------|---------------|--------------|---------|
| 1 | ⚔️ Knight | Tank | 120 | 8 | +12% | +4% | **Counter** — 25% chance to counter-attack on defend |
| 2 | 🧙 Mage | DPS | 80 | 14 | +8% | +8% | **Burst** — Critical damage x3 instead of x2 |
| 3 | 🏹 Archer | Ranged | 95 | 11 | +12% | +5% | **Multi-Shot** — 20% chance for bonus hit on attack |
| 4 | 🥷 Ninja | Speed | 85 | 10 | +15% | +6% | **Assassinate** — Speed bonus > 3 = auto critical |
| 5 | 💚 Healer | Support | 100 | 8 | +8% | +4% | **Heal** — +15 HP to lowest ally on defend |
| 6 | 💪 Berserker | DPS | 75 | 16 | +5% | +8% | **Bloodlust** — Lower HP = more damage (max x2 at 0% HP) |

### Stats (per player)
- **Dodge:** Starts 0%, grows on correct answer, reset to 0% on wrong. Chance to take 0 damage.
- **Critical:** Starts 0%, grows on correct answer, reset to 0% on wrong. Damage multiplier (x2 normal, x3 Mage).
- Growth rates vary by class (see table above).
- **Max Dodge:** 50%, **Max Critical:** 25%

### Wave Structure
- Wave 1: Slime (30 HP) + Goblin (50 HP)
- Wave 2: Skeleton (70 HP) + Orc (90 HP)
- Wave 3: Dragon (120 HP)
- Wave 4: Demon Lord (200 + players*20 HP) — BOSS

### Game End Conditions
- **Victory:** Boss killed
- **Defeat:** All players dead (HP <= 0 → `alive = false`)

Questions recycle (shuffle + reset) when exhausted — game does NOT end from running out of questions.

## Key Socket Events

### Client → Server
| Event | Payload | Notes |
|-------|---------|-------|
| `create-room` | callback | Returns room ID + QR |
| `join-room` | `{ roomId, playerName }` | |
| `select-avatar` | `{ avatarId }` | Applies class stats to player |
| `start-game` | `{ roomId }` | Host only |
| `answer` | `{ questionIdx, answerIdx, timeMs, turn }` | `turn` = PLAYER or MONSTER |

### Server → Client
| Event | Payload | Notes |
|-------|---------|-------|
| `game-start` | `{ players, monsters, currentMonster, turn, round }` | |
| `new-question` | `{ questionIdx, question, timeLimit, turn, monsterName, monsterHp, monsterDamage, wave, round }` | |
| `turn-end` | `{ turn, players, monsterHp, monsterMaxHp, monsterName, damagedPlayerIds, healedPlayers, counteredPlayers }` | After all players answer |
| `wave-complete` | `{ defeatedMonster, nextMonster, wave }` | |
| `game-over` | `{ players, winner, reason? }` | |

### Answer Callback (per player)
Returns `{ success, isCorrect, damage, isCritical, critMult, specialTriggered, multiShot, heal, counter, ... }`
- **PLAYER turn:** `damage`, `isCritical`, `critMult` (2 or 3), `specialTriggered`, `multiShot` (if Archer)
- **MONSTER turn:** `defended`, `heal` (if Healer), `counter` (if Knight), `isDodged`, `damage`

## Important Implementation Notes

- **Methods on Room, not GameManager:** `calculateCriticalDamage()`, `calculateDodge()`, `updatePlayerStats()`, `healPlayer()`, `counterAttack()`, `multiShot()`, `calculateBloodlust()` are Room instance methods. Call `room.method()`, NOT `gameManager.method()`.
- **defeatedMonster:** Capture `room.currentMonster` BEFORE reassigning to `nextMonster`. Do NOT use `room.monsters.find(m => m.hp <= 0 && m.id < nextMonster.id)` — always returns Slime.
- **Player death:** Set `player.alive = false` when `player.hp <= 0` after damage. `getAlivePlayers()` filters by `alive` field. Game-over triggers when all players are dead.
- **Display question overlay:** Position: top-center (80px from top), 80% width, max 900px. Must not block sprites.
- **Monster HP bar:** `bottom: 130px`, z-index: 10
- **Monster sprite update:** Call `buildEntities()` after changing `currentMonster` in wave-complete handler.
- **No "Out of questions" game-over:** Questions recycle automatically via shuffle + reset index.
- **Language:** All UI text in English. Only question/answer content can be in Thai.
- **Canvas rendering:** Paper Mario style — Canvas 2D with sprite sheets, NOT Three.js. Background gradient + stars + ground grid + shadow ellipses.
- **Animation speed:** `animSpeed: 0.15` seconds per frame, uses real delta time from `requestAnimationFrame`.
- **Audio:** Web Audio API (oscillator-based). Requires user interaction (click/touch) first due to browser autoplay policy. `resumeAudio()` called on first click + before every `playSound()`.

## Sprite Sheet System

All sprites are **sprite sheets** stored in `public/display/sprites/`. Both display and player pages load from this directory. Dynamic cell sizing: `cellW = img.width / cols`, `cellH = img.height / rows` (NOT hardcoded).

### Player Sprite Sheet (4x4 grid)
```
┌──────┬──────┬──────┬──────┐
│idle1 │idle2 │atk1  │atk2  │  Row 0
├──────┼──────┼──────┼──────┤
│atk3  │atk4  │hit1  │hit2  │  Row 1
├──────┼──────┼──────┼──────┤
│def1  │def2  │dth1  │dth2  │  Row 2
├──────┼──────┼──────┼──────┤
│dth3  │dth4  │      │      │  Row 3
└──────┴──────┴──────┴──────┘
```
Frame indices → `{col, row}`:
- **idle**: (0,0),(1,0)
- **attack**: (2,0),(3,0),(0,1),(1,1)
- **hit**: (2,1),(3,1)
- **defend**: (0,2),(1,2)
- **death**: (2,2),(3,2),(0,3),(1,3)

### Monster Sprite Sheet (4x4 grid — same as player)
```
┌──────┬──────┬──────┬──────┐
│idle1 │idle2 │atk1  │atk2  │  Row 0
├──────┼──────┼──────┼──────┤
│atk3  │atk4  │hit1  │hit2  │  Row 1
├──────┼──────┼──────┼──────┤
│def1  │def2  │dth1  │dth2  │  Row 2
├──────┼──────┼──────┼──────┤
│dth3  │dth4  │      │      │  Row 3
└──────┴──────┴──────┴──────┘
```
Frame indices → `{col, row}`:
- **idle**: (0,0),(1,0)
- **attack**: (2,0),(3,0),(0,1),(1,1)
- **hit**: (2,1),(3,1)
- **defend**: (0,2),(1,2)
- **death**: (2,2),(3,2),(0,3),(1,3)

**⚠️ Render with `flipH=true`** — monster sprites must be mirrored horizontally when drawn.

### Sprite Files (actual in `public/display/sprites/`)
- **Players:** knight.png, mage.png, archer.png (ninja, healer, berserker not yet added)
- **Monsters:** slime.png (goblin, skeleton, orc, dragon, demon-lord not yet added)

### How It Works
- Canvas loads sprite sheets on init via `preloadAllSprites()` (display) or `Object.values(spriteMap).forEach(loadSprite)` (player)
- Each entity tracks `animState` (idle/attack/hit/defend/death) + `animFrame`
- `drawSheetFrame()` extracts correct cell from sheet and draws it
- If sheet not loaded → **fallback to emoji on colored body** (automatic)
- `turn-end` event triggers: monster gets `hit` anim when player attacks, player gets `hit`/`defend`/`healFlash` anims
- Knight counter: player plays `attack` anim, monster plays `hit` anim
- Healer heal: target gets green `healFlash` overlay effect
- One-shot animations (attack/hit/defend) play once then return to idle automatically

### Player Page Sprite System
- Player page (`/player`) loads sprites from `/display/sprites/` for avatar selection preview
- Each avatar card shows a small animated idle sprite canvas (64x64)
- Game header shows animated idle sprite (48x48)
- Leaderboard shows static idle sprite (24x24) next to player names

### Adding New Sprites
1. Create PNG sprite sheet following BIBLE grid layout
2. Place in `public/display/sprites/`
3. Add filename to `spriteMap` in display/index.html (and player/index.html if player sprite)
4. No other code changes needed — fallback is automatic

## Server Architecture Details

### GameManager.js — CLASS_STATS
```js
const CLASS_STATS = {
  1: { hp: 120, baseDmg: 8,  dodgeGrowth: 12, critGrowth: 4, className: 'Knight',    healAmount: 0, special: 'Counter' },
  2: { hp: 80,  baseDmg: 14, dodgeGrowth: 8,  critGrowth: 8, className: 'Mage',      healAmount: 0, special: 'Burst' },
  3: { hp: 95,  baseDmg: 11, dodgeGrowth: 12, critGrowth: 5, className: 'Archer',    healAmount: 0, special: 'Multi-Shot' },
  4: { hp: 85,  baseDmg: 10, dodgeGrowth: 15, critGrowth: 6, className: 'Ninja',     healAmount: 0, special: 'Assassinate' },
  5: { hp: 100, baseDmg: 8,  dodgeGrowth: 8,  critGrowth: 4, className: 'Healer',    healAmount: 15, special: 'Heal' },
  6: { hp: 75,  baseDmg: 16, dodgeGrowth: 5,  critGrowth: 8, className: 'Berserker', healAmount: 0, special: 'Bloodlust' }
};
```

### GameManager.js — Room Class
- `players` — Map of socketId → player object
- Player object: `{ id, name, avatar, hp, maxHp, score, dodge, critical, alive, ready, className, baseDmg, dodgeGrowth, critGrowth, healAmount, special }`
- `attackQuestions` / `defenseQuestions` — loaded at game start, split from 40 random questions
- `attackQuestionIdx` / `defenseQuestionIdx` — current question indices
- `currentMonster`, `currentWave`, `turn`, `round` — game state
- `damagedThisTurn`, `healedThisTurn`, `counteredThisTurn` — per-turn tracking arrays

### GameManager.js — Special Methods
- `calculateCriticalDamage(baseDmg, crit%, special)` — Mage Burst = x3, others x2
- `calculateBloodlust(baseDmg, hp, maxHp)` — Berserker damage multiplier (1.0 at full HP → 2.0 at 0 HP)
- `counterAttack(baseDmg)` — Knight 25% chance returns `{ triggered, damage }`
- `multiShot(baseDmg)` — Archer 20% chance returns `{ triggered, damage }`
- `healPlayer(healerId, healAmount)` — Heals lowest HP ally, returns `{ targetId, targetName, healed, hp, maxHp }`

### socket.js — Answer Flow
1. Player submits answer with `turn` field (PLAYER or MONSTER)
2. Server validates, calculates damage/block/dodge + special abilities
3. Server calls `room.updatePlayerStats(socketId, isCorrect)`
4. Callback returns result to individual player (includes `specialTriggered`, `heal`, `counter`, `multiShot`)
5. When all alive players answered → `processTurnEnd()` called after 1.5s delay
6. `processTurnEnd()` emits `turn-end` with `damagedPlayerIds`, `healedPlayers`, `counteredPlayers`, checks win/lose conditions, switches turns

### socket.js — Special Ability Triggers
**PLAYER TURN (attack):**
1. Calculate speed bonus + base damage (class-specific `baseDmg`)
2. **Ninja Assassinate:** If speedBonus > 3 → auto crit (x2)
3. **Berserker Bloodlust:** Multiply damage by HP-based multiplier
4. **Critical check:** Mage = x3, others = x2
5. **Archer Multi-Shot:** 20% chance add bonus hit damage

**MONSTER TURN (defend):**
1. If correct:
   - **Healer Heal:** Heal lowest ally for 15 HP
   - **Knight Counter:** 25% chance deal `baseDmg` back to monster
2. If wrong: Calculate dodge, apply damage, kill player if HP <= 0

### socket.js — Question Functions
- `sendAttackQuestion(io, room)` — Sends PLAYER turn question, recycles if exhausted
- `sendDefenseQuestion(io, room)` — Sends MONSTER turn question, recycles if exhausted

## Dependencies
- express, socket.io, qrcode, gray-matter
