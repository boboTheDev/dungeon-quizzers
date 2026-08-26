# ⚔️ ARCHON PLAN — Dungeon Quizzers

> **Status:** DESIGN PHASE (REVISED)
> **Date:** 2026-08-26
> **Requested by:** Commander AJP

---

## 1. 🎯 OBJECTIVE

สร้างเกม quiz battle คล้าย Kahoot ที่:
- ผู้เล่นสแกน QR จากจอหลัก → เลือก avatar → เข้าเกม
- จอหลักแสดงฉาก 3D environment + 2D sideview characters (Paper Mario style)
- ผู้เล่นต้องสู้กับ **มอนสเตอร์หลายรอบ** ก่อนเจอ **บอสตัวสุดท้าย**
- ผู้เล่นตอบคำถามจากมือถือ → ถูก = โจมตี, ผิด = โดนโจมตี
- คำถามเก็บในไฟล์ MD บน server แก้ไขได้
- มีไฟล์ Bible สำหรับสร้าง artwork
- **Full Web Stack:** Node.js backend + Three.js rendering

---

## 2. 🎭 VISUAL STYLE — Paper Mario 2.5D

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  3D ENVIRONMENT (พื้น, กำแพง, skybox)                       │
│  + 2D SPRITE CHARACTERS (sideview)                          │
│                                                             │
│         ┌─────────┐                                         │
│         │  BOSS   │  ← 2D sprite (sideview)                 │
│         │  👹     │     ยืนบนพื้น 3D                        │
│         └─────────┘                                         │
│  ───────────────────────────────  พื้น 3D ──────────────────│
│                                                             │
│    👤        👤        👤    ← Player sprites (sideview)     │
│   P1        P2        P3                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Concept:** 3D world แต่ตัวละครเป็น 2D sprites วางบนพื้น 3D (เหมือน Paper Mario, Octopath)

---

## 3. 📂 BIBLE FILE — Character & Art Guide

สร้างไฟล์ `BIBLE.md` สำหรับเป็น reference ตอนสร้าง artwork:

```markdown
# 🎨 ART BIBLE — Dungeon Quizzers

## Character Design Rules
- Style: Pixel art / Hand-drawn 2D
- Orientation: Sideview (profile or 3/4 view)
- Size: 128x128 px per character
- Animation: 4-6 frames per action
- Colors: Vibrant, high contrast for mobile

## Avatar List (Player Characters)
| ID | Name | Description | Colors |
|----|------|-------------|--------|
| 01 | Knight | เหล่าอัศวิน, ดาบ+โล่ | Blue/Silver |
| 02 | Mage | จอมเวทย์, ไม้เท้า | Purple/Gold |
| 03 | Archer | นักธนู, คันธนู | Green/Brown |
| 04 | Ninja | นินจา, ดาวกระจาย | Black/Red |
| 05 | Healer | นักบวช, คฑา | White/Gold |
| 06 | Berserker | นักรบ, ขวานยักษ์ | Red/Black |

## Monster Types
| ID | Name | HP | Difficulty | Stage |
|----|------|----|-----------| ------|
| M1 | Slime | 30 | Easy | Wave 1 |
| M2 | Goblin | 50 | Easy | Wave 1 |
| M3 | Skeleton | 70 | Medium | Wave 2 |
| M4 | Orc | 90 | Medium | Wave 2 |
| M5 | Dragon | 120 | Hard | Wave 3 |
| BOSS | Demon Lord | 200+ | Boss | Final |

## Animation States
- Idle (2 frames)
- Attack (4 frames)
- Hit (2 frames)
- Death (4 frames)

## Color Palette
- Player UI: Blue tones
- Monster UI: Red tones
- Boss UI: Purple tones
```

---

## 4. 🏗️ ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────┐
│                        SERVER (Node.js)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Express API  │  │  Socket.IO   │  │  Question Loader     │  │
│  │  (REST/QR)   │  │  (Real-time) │  │  (MD Parser)         │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Game State Machine                          │  │
│  │  LOBBY → AVATAR → WAVE → BOSS → RESULT                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    WebSocket + HTTP
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────▼────┐          ┌────▼────┐          ┌────▼────┐
   │  MAIN   │          │ PLAYER  │          │ PLAYER  │
   │ DISPLAY │          │ MOBILE  │          │ MOBILE  │
   │ (Three  │          │ (Web)   │          │ (Web)   │
   │  .js)   │          │         │          │         │
   └─────────┘          └─────────┘          └─────────┘
    จอหลัก              มือถือผู้เล่น 1      มือถือผู้เล่น 2
```

---

## 5. 🎮 GAME FLOW (State Machine)

```
┌─────────┐    Host creates    ┌──────────┐
│  IDLE   │ ──────────────────►│  LOBBY   │
└─────────┘                    └──────────┘
                                     │
                              QR Scan + Join
                                     │
                                     ▼
                               ┌──────────┐
                               │  AVATAR  │ ← เลือกตัวละคร
                               │  SELECT  │
                               └──────────┘
                                     │
                              All selected
                                     │
                                     ▼
                         ┌───────────────────────┐
                         │   WAVE 1 (Monsters)   │
                         │   Slime, Goblin       │
                         └───────────────────────┘
                                     │
                              Boss HP = 0?
                                     │ YES
                                     ▼
                         ┌───────────────────────┐
                         │   WAVE 2 (Monsters)   │
                         │   Skeleton, Orc       │
                         └───────────────────────┘
                                     │
                              Boss HP = 0?
                                     │ YES
                                     ▼
                         ┌───────────────────────┐
                         │   WAVE 3 (Mini Boss)  │
                         │   Dragon              │
                         └───────────────────────┘
                                     │
                              Boss HP = 0?
                                     │ YES
                                     ▼
                         ┌───────────────────────┐
                         │   FINAL BOSS          │
                         │   Demon Lord          │
                         └───────────────────────┘
                                     │
                              Boss HP = 0?
                                     │ YES
                                     ▼
                               ┌──────────┐
                               │   WIN    │
                               │  SCREEN  │
                               └──────────┘
```

---

## 6. 📂 PROJECT STRUCTURE

```
NewKahoot/
├── BIBLE.md                  # 🎨 Art & Character Guide
├── PLAN.md                   # 📋 This file
│
├── server/
│   ├── index.js              # Entry point
│   ├── game/
│   │   ├── GameManager.js    # Room + state machine
│   │   ├── Player.js         # Player model
│   │   ├── Monster.js        # Monster/boss model
│   │   ├── Wave.js           # Wave management
│   │   └── Battle.js         # Battle calculation
│   ├── questions/
│   │   ├── loader.js         # MD file parser
│   │   └── index.js          # Question bank
│   └── routes/
│       ├── api.js            # REST endpoints
│       └── socket.js         # WebSocket handlers
│
├── public/
│   ├── display/              # Main screen (Three.js 2.5D)
│   │   ├── index.html
│   │   ├── js/
│   │   │   ├── main.js       # Scene setup
│   │   │   ├── Player2D.js   # 2D sprite player
│   │   │   ├── Monster2D.js  # 2D sprite monster
│   │   │   ├── Environment.js # 3D environment
│   │   │   ├── Battle.js     # Battle animations
│   │   │   └── UI.js         # HUD overlay
│   │   └── assets/
│   │       ├── sprites/      # 2D character sprites (.png)
│   │       ├── environment/  # 3D env textures
│   │       ├── sounds/       # SFX
│   │       └── fonts/
│   │
│   ├── player/               # Mobile interface
│   │   ├── index.html
│   │   ├── css/
│   │   │   └── style.css
│   │   └── js/
│   │       ├── app.js        # Main logic
│   │       ├── avatar.js     # Avatar selection
│   │       └── socket.js     # Socket client
│   │
│   └── shared/               # Shared assets
│       └── fonts/
│
├── questions/                # Question bank (MD files)
│   ├── math/
│   │   ├── set1.md
│   │   └── set2.md
│   ├── science/
│   │   └── set1.md
│   └── general/
│       └── set1.md
│
├── package.json
├── .gitignore
└── README.md
```

---

## 7. 📝 QUESTION FORMAT (Markdown)

```markdown
# Question Set: Math Easy
# Difficulty: easy
# Category: math

---

## What is 2 + 2?
- [ ] 3
- [x] 4
- [ ] 5
- [ ] 6
Time: 10
Type: attack

---

## What is 10 - 3?
- [ ] 5
- [ ] 6
- [x] 7
- [ ] 8
Time: 10
Type: defense
```

**Fields:**
| Field | Required | Description |
|-------|----------|-------------|
| `##` | Yes | Question text |
| `- [x]` | Yes | Correct answer (exactly one) |
| `- [ ]` | Yes | Wrong answers (exactly 3) |
| `Time:` | No | Answer time in seconds (default: 15) |
| `Type:` | No | `attack` / `defense` / `avoid` (default: attack) |

---

## 8. 🔌 API & SOCKET PROTOCOL

### REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/room` | Create room → returns `{ roomId, qrUrl }` |
| GET | `/api/room/:id` | Get room status |
| GET | `/api/questions` | List available question sets |
| POST | `/api/questions/upload` | Upload new MD file |
| GET | `/api/avatars` | List available avatars |

### Socket Events

#### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `join-room` | `{ roomId, playerName }` | Player joins room |
| `select-avatar` | `{ avatarId }` | Choose avatar |
| `answer` | `{ questionIdx, answerIdx, timeMs }` | Submit answer |
| `start-game` | `{ roomId, questionSet }` | Host starts game |

#### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `room-joined` | `{ playerId, players[] }` | Confirm join |
| `player-joined` | `{ player }` | Broadcast new player |
| `avatar-selected` | `{ playerId, avatarId }` | Broadcast avatar |
| `game-start` | `{ players[], wave }` | Game begins |
| `new-question` | `{ question, timeLimit, questionIdx }` | Show question |
| `battle-result` | `{ attacks[], monsterHp, damage }` | Show battle |
| `wave-complete` | `{ wave, nextWave }` | Wave cleared |
| `monster-defeated` | `{ monster }` | Monster dies |
| `boss-defeated` | `{ boss }` | Boss dies → next wave |
| `game-over` | `{ winner, leaderboard[] }` | Game ends |

---

## 9. ⚔️ BATTLE MECHANICS

### Wave Structure
| Wave | Monsters | Questions | Difficulty |
|------|----------|-----------|------------|
| 1 | Slime + Goblin | 5 | Easy |
| 2 | Skeleton + Orc | 5 | Medium |
| 3 | Dragon | 5 | Hard |
| Final | Demon Lord | 10 | Boss |

### Damage Calculation
```
Base Damage = 10
Speed Bonus = max(0, (timeLimit - answerTimeMs/1000) / timeLimit * 5)
Difficulty Multiplier = easy: 1.0 | medium: 1.5 | hard: 2.0

Final Damage = Base Damage + Speed Bonus * Difficulty Multiplier
```

### Answer Types
| Type | Correct | Wrong |
|------|---------|-------|
| `attack` | Deal damage to monster | Take 5 damage |
| `defense` | Gain shield (block next hit) | Take 10 damage |
| `avoid` | Dodge monster attack (no dmg) | Take 15 damage |

### Monster Behavior
- Each wave has 1-2 monsters
- Monster attacks after every 2 questions
- Monster damage: `10 + wave * 5`
- Boss has special attacks every 3 questions

---

## 10. 🎨 VISUAL DESIGN (2.5D Display)

### Scene Layout (Three.js Perspective Camera)
```
┌─────────────────────────────────────────────────────────────┐
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    SKYBOX / BACKGROUND                │  │
│  │                                                       │  │
│  │                    ┌───────────┐                      │  │
│  │                    │   BOSS    │  ← 2D sprite         │  │
│  │                    │    👹     │     floating on 3D   │  │
│  │                    └───────────┘     ground           │  │
│  │                                                       │  │
│  │  ════════════════════════════════════════════════════  │  │
│  │                    3D GROUND / ARENA                   │  │
│  │  ════════════════════════════════════════════════════  │  │
│  │                                                       │  │
│  │    👤          👤          👤    ← Player sprites      │  │
│  │   P1          P2          P3       (sideview)         │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ████████████████████░░░░░░░  MONSTER HP             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │  QR CODE   │  │  WAVE 1/4       │  │  SCORE         │  │
│  │  ████      │  │  Q: 3/5         │  │  P1: 450       │  │
│  └────────────┘  └─────────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Player Mobile UI — Avatar Selection
```
┌─────────────────────┐
│                     │
│  เลือกตัวละครของคุณ  │
│                     │
│  ┌───┐ ┌───┐ ┌───┐ │
│  │ 🧙│ │ ⚔️│ │ 🏹│ │
│  │Mage│ │Knt│ │Arc│ │
│  └───┘ └───┘ └───┘ │
│  ┌───┐ ┌───┐ ┌───┐ │
│  │ 🥷│ │ 💒│ │ 💪│ │
│  │Nin│ │Hea│ │Ber│ │
│  └───┘ └───┘ └───┘ │
│                     │
│  ┌─────────────────┐│
│  │   เลือก! ✓      ││
│  └─────────────────┘│
└─────────────────────┘
```

### Player Mobile UI — In Game
```
┌─────────────────────┐
│  🧙 Mage  Score: 350│
│  ❤️ HP: 80/100     │
│  🛡️ Shield: 1      │
│                     │
│  ┌─────────────────┐│
│  │ What is 2+2?    ││
│  └─────────────────┘│
│                     │
│  ┌─────────────────┐│
│  │       3         ││
│  └─────────────────┘│
│  ┌─────────────────┐│
│  │  ⚔️ 4 (Correct) ││
│  └─────────────────┘│
│  ┌─────────────────┐│
│  │       5         ││
│  └─────────────────┘│
│  ┌─────────────────┐│
│  │       6         ││
│  └─────────────────┘│
│                     │
│  ⏱️ 10s remaining   │
└─────────────────────┘
```

---

## 11. 🛠️ TECH STACK

| Component | Technology | Why |
|-----------|------------|-----|
| Server | Node.js + Express | Fast, JS ecosystem |
| Real-time | Socket.IO | WebSocket with fallback |
| 3D Display | Three.js | 3D environment + 2D sprites |
| 2D Sprites | PNG序列帧 | ง่าย สวย ประหยัด |
| QR Code | qrcode npm | Generate QR for room |
| MD Parser | marked or gray-matter | Parse question files |
| Styling | CSS | Quick responsive UI |

---

## 12. 📋 IMPLEMENTATION PHASES

### Phase 1: Foundation (Backend + Socket)
- [ ] Initialize Node.js project
- [ ] Express server setup
- [ ] Socket.IO integration
- [ ] Room management (create/join)
- [ ] MD question loader

### Phase 2: Game Logic
- [ ] State machine (LOBBY → AVATAR → WAVE → BOSS → WIN)
- [ ] Player model (HP, score, shields, avatar)
- [ ] Monster/Boss model
- [ ] Wave system
- [ ] Battle calculation engine

### Phase 3: Player Mobile UI
- [ ] Join screen (name input + room code)
- [ ] Avatar selection screen
- [ ] Answer selection UI (4 buttons)
- [ ] Timer display
- [ ] Result feedback (correct/wrong animation)
- [ ] HP/Score display

### Phase 4: Main Display (Three.js 2.5D)
- [ ] Scene setup (perspective camera)
- [ ] 3D environment (ground, walls, skybox)
- [ ] 2D sprite system (player, monster, boss)
- [ ] Attack animations
- [ ] HP bars + Score HUD
- [ ] QR code overlay
- [ ] Wave transitions

### Phase 5: Art & Assets
- [ ] Create sprite sheets per BIBLE.md
- [ ] Player idle/attack/hit/death animations
- [ ] Monster idle/attack/hit/death animations
- [ ] Boss animations
- [ ] Environment textures

### Phase 6: Polish
- [ ] Sound effects
- [ ] Screen shake on hits
- [ ] Particle effects
- [ ] Leaderboard screen
- [ ] Mobile responsiveness testing

---

## 13. 🎯 STOP CONDITIONS

- Wrong directory → STOP
- Missing dependencies → STOP and report
- Socket disconnect not handled → STOP and fix
- 2D sprite loading fails → STOP and use placeholders
- Question MD parse fails → STOP and report

---

## 14. ⚡ NEXT LAWFUL MOVE

**Fastest Safe Move:**
1. สร้าง `BIBLE.md` ก่อน (reference สำหรับ artwork)
2. Initialize project with `npm init`
3. ติดตั้ง dependencies
4. สร้าง basic server + socket setup
5. ทดสอบ room creation/join flow

**Blocked Alternatives:**
- ❌ อย่าทำ 3D/2D art ก่อน backend + socket stable
- ❌ อย่าทำ animation ซับซ้อนก่อน game logic ทำงานได้
- ❌ อย่าสร้าง sprite จริง — ใช้ placeholder สี่เหลี่ยมก่อน

---

> **VERDICT:** PLAN REVISED & COMPLETE
> **Awaiting Commander approval to proceed to Phase 1**
