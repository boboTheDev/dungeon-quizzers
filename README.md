# 🏰 Dungeon Quizzers

2.5D multiplayer quiz battle game. Players scan QR to join from mobile phones, fight monsters/bosses with class-based abilities, answer questions to attack and defend.

## Quick Start

```bash
npm install
npm start
```

Open **Display** on a projector/TV screen, players join via **QR code** on their phones.

- **Display:** http://localhost:3000/display
- **Player:** http://localhost:3000/player?room=[CODE]

## How to Play

1. Open Display screen → Create Room
2. Players scan QR code with mobile phones
3. Each player selects a **class** (Knight, Mage, Archer, Ninja, Healer, Berserker)
4. Host starts the game
5. **Player Turn** — Answer attack question → damage monster
6. **Monster Turn** — Answer defense question → block damage + special abilities
7. Defeat all 4 waves → Kill the Demon Lord → Win!

## Features

- **6 Unique Classes** — Each with passive special abilities (Counter, Burst, Multi-Shot, Assassinate, Heal, Bloodlust)
- **4 Monster Waves** — Slime+Goblin → Skeleton+Orc → Dragon → Demon Lord (boss)
- **Turn-Based Battle** — Attack questions + defense questions per round
- **2.5D Canvas Rendering** — Paper Mario style with sprite sheets
- **Scene System** — 4 themed environments (Forest, Ruins, Cave, Throne) with parallax backgrounds
- **Particle Effects** — Leaves, embers, crystals, dust per scene
- **Death Animations** — Monsters removed, players stay faded on screen
- **QR Code Join** — No app needed, scan and play

## Tech Stack

- **Server:** Node.js + Express + Socket.IO
- **Client:** Vanilla HTML/CSS/JS + Canvas 2D
- **Sprites:** PNG sprite sheets (4x4 grid)
- **Audio:** Web Audio API (oscillator-based)

## Deploy

### Render (Free)
1. Push to GitHub
2. Create account at [render.com](https://render.com)
3. New Web Service → select repo
4. Build: `npm install` / Start: `npm start`
5. Instance Type: **Free**

### Fly.io (Free)
```bash
brew install flyctl
fly auth login
fly launch
fly deploy
```

## Project Structure

```
server/
├── index.js              # Express + Socket.IO + compression
├── game/
│   └── GameManager.js    # Room + GameManager + CLASS_STATS + specials
├── questions/
│   └── loader.js         # MD file parser (gray-matter)
└── routes/
    ├── api.js            # REST API
    └── socket.js         # Socket event handlers + battle logic

public/
├── display/
│   ├── index.html        # Main screen (Canvas 2.5D + scene system)
│   └── sprites/          # Sprite sheets (player + monster, 4x4 grid)
└── player/
    └── index.html        # Mobile UI

questions/                # Question bank (MD files)
├── math/
├── science/
└── general/
```

## License

ISC
