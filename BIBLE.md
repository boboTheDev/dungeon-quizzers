# 🎨 ART BIBLE — Dungeon Quizzers

> **Version:** 1.0
> **Date:** 2026-08-26
> **Purpose:** Reference สำหรับสร้าง artwork ทุกชิ้นในเกม

---

## 1. 📐 GENERAL RULES

### Style
- **Type:** 2D Pixel Art / Hand-drawn
- **Orientation:** Sideview (profile หรือ 3/4 view)
- **Resolution:** 128x128 px ต่อ 1 ตัวละคร
- **Format:** PNG (transparent background)
- **Frame Rate:** 8-12 fps สำหรับ animation

### Color Rules
- ใช้สีสด ตัดกันชัด (mobile friendly)
- ไม่ใช้สีจางเกินไป ( visibility บนจอหลัก)
- แต่ละ class มี primary color เฉพาะ

---

## 2. 🧙 PLAYER AVATARS

### Design Rules
- ตัวละครหัน **ขวา** (sideview)
- มี shadow เล็กๆ ใต้เท้า
- ท่า stance: พร้อมสู้ (battle ready)
- หน้าตาชัดเจน จำง่าย

### Avatar List

| ID | Name | Class | Primary Color | Weapon | Description |
|----|------|-------|---------------|--------|-------------|
| 01 | Knight | Tank | Blue `#4A90D9` | Sword + Shield | อัศวินเกราะหนา โล่เหล็ก |
| 02 | Mage | DPS | Purple `#9B59B6` | Staff | จอมเวทย์ ไม้เท้าลูกแก้ว |
| 03 | Archer | Ranged | Green `#27AE60` | Bow | นักธนู คันธนูยาว |
| 04 | Ninja | Speed | Black `#2C3E50` | Kunai | นินจา ชุดดำ ดาวกระจาย |
| 05 | Healer | Support | White `#ECF0F1` | Holy Staff | นักบวช ชุดขาว คฑา |
| 06 | Berserker | DPS | Red `#E74C3C` | Double Axes | นักรบ ขวานคู่ กล้ามโต |

### Animation States (ทุก Avatar)

| State | Frames | Description |
|-------|--------|-------------|
| `idle` | 2 | ยืนนิ่ง หายใจเบาๆ |
| `attack` | 4 | โจมตี (ตาม weapon แต่ละ class) |
| `hit` | 2 | โดนโจมตี กระเด็นเล็กน้อย |
| `defend` | 2 | ยกโล่/ป้องกัน |
| `death` | 4 | ล้มลง หายไป |

---

## 3. 👹 MONSTERS

### Monster Types (Wave 1-3)

| ID | Name | HP | Damage | Wave | Color | Description |
|----|------|----|--------|------|-------|-------------|
| M1 | Slime | 30 | 5 | 1 | Green `#2ECC71` | วุ้นเขียว ตัวกลม น่ารัก |
| M2 | Goblin | 50 | 8 | 1 | Brown `#8B4513` | ก็อบลินเล็ก ดาบสั้น |
| M3 | Skeleton | 70 | 12 | 2 | White `#BDC3C7` | โครงกระดูก ธนู |
| M4 | Orc | 90 | 15 | 2 | Dark Green `#1E8449` | ออร์คโต ขวานยักษ์ |
| M5 | Dragon | 120 | 20 | 3 | Red `#C0392B` | มังกรบิน หายไฟ |

### Monster Animation States

| State | Frames | Description |
|-------|--------|-------------|
| `idle` | 2 | ยืนนิ่ง หายใจ/ขยับ |
| `attack` | 4 | โจมตีผู้เล่น |
| `hit` | 2 | โดนโจมตี กระเด็น |
| `death` | 4 | ระเบิด/หายไป |

---

## 4. 👿 FINAL BOSS — DEMON LORD

### Stats
- **HP:** 200 + (playerCount × 20)
- **Damage:** 15 + wave × 5
- **Special Attack:** ทุก 3 คำถาม

### Design
- **Size:** 2x ของ monster ปกติ (256x256 px)
- **Color:** Dark Purple `#4A235A` + Red accents `#E74C3C`
- **Style:** ปีศาจร้าย  horns, wings, dark aura
- **Position:** กลางจอ ด้านบน (.FLOATING)

### Animation States

| State | Frames | Description |
|-------|--------|-------------|
| `idle` | 4 | ลอยอยู่ ปีกขยับ  aura หมุน |
| `attack` | 6 | โจมตีรุนแรง (fire/explosion) |
| `special` | 6 | โจมตีพิเศษ (全体 attack) |
| `hit` | 2 | โดนโจมตี กระเด็น |
| `death` | 6 | ระเบิด หายไป ชนะ! |

---

## 5. 🌍 ENVIRONMENT

### Background Layers
1. **Sky:** Gradient สีฟ้า-ม่วง (day) หรือ ดำ-น้ำเงิน (night)
2. **Mountains:** ภูเขา 2-3 ชั้น สีเข้ม
3. **Ground:** พื้น 3D arena สีน้ำตาล/เทา

### Arena Types
| ID | Name | Theme | Colors |
|----|------|-------|--------|
| A1 | Forest | ป่า | Green/Brown |
| A2 | Cave | ถ้ำ | Gray/Dark |
| A3 | Volcano | ภูเขาไฟ | Red/Orange |
| A4 | Castle | ปราสาท | Gray/Purple |

---

## 6. 🎯 UI ELEMENTS

### HP Bar
- **Background:** Dark Gray `#34495E`
- **Player HP:** Green `#2ECC71` → Yellow `#F39C12` → Red `#E74C3C`
- **Monster HP:** Red `#E74C3C`
- **Boss HP:** Purple `#8E44AD`
- **Border:** White 2px

### Score Display
- Font: Bold, sans-serif
- Color: Gold `#F1C40F`
- Shadow: Black 1px

### Timer
- Circular countdown (ring สีเขียว → แดง)
- Digital display: `10s`

---

## 7. 📱 MOBILE UI COLORS

### Background
- Dark theme: `#1A1A2E` (header/body)
- Card: `#16213E`
- Accent: `#0F3460`

### Buttons
- Default: `#4A90D9` (blue)
- Correct: `#2ECC71` (green)
- Wrong: `#E74C3C` (red)
- Disabled: `#7F8C8D` (gray)

### Text
- Primary: `#ECF0F1` (white)
- Secondary: `#95A5A6` (gray)
- Accent: `#F1C40F` (gold)

---

## 8. 🖼️ SPRITE SHEET FORMAT

### Player Sprite Sheet
```
┌─────┬─────┬─────┬─────┐
│idle1│idle2│atk1 │atk2 │  Row 1: idle + attack start
├─────┼─────┼─────┼─────┤
│atk3 │atk4 │hit1 │hit2 │  Row 2: attack end + hit
├─────┼─────┼─────┼─────┤
│def1 │def2 │dth1 │dth2 │  Row 3: defend + death start
├─────┼─────┼─────┼─────┤
│dth3 │dth4 │     │     │  Row 4: death end
└─────┴─────┴─────┴─────┘
  Each cell: 128x128 px
```

### Monster Sprite Sheet (4x4 — same as player, flipH on render)
```
┌─────┬─────┬─────┬─────┐
│idle1│idle2│atk1 │atk2 │  Row 1: idle + attack start
├─────┼─────┼─────┼─────┤
│atk3 │atk4 │hit1 │hit2 │  Row 2: attack end + hit
├─────┼─────┼─────┼─────┤
│def1 │def2 │dth1 │dth2 │  Row 3: defend + death start
├─────┼─────┼─────┼─────┤
│dth3 │dth4 │     │     │  Row 4: death end
└─────┴─────┴─────┴─────┘
  Each cell: 128x128 px
  ⚠️ Render with flipH=true (mirror horizontal)

  Frame mapping (0-indexed):
  - idle:   (0,0),(1,0)
  - attack: (2,0),(3,0),(0,1),(1,1)
  - hit:    (2,1),(3,1)
  - defend: (0,2),(1,2)
  - death:  (2,2),(3,2),(0,3),(1,3)
```

---

## 9. ✅ ART CHECKLIST

### Must Have
- [ ] 6 player avatars (idle + attack + hit + death)
- [ ] 5 monsters (idle + attack + hit + death)
- [ ] 1 boss (idle + attack + special + hit + death)
- [ ] 4 arena backgrounds
- [ ] UI elements (HP bar, timer, score)
- [ ] Mobile UI assets

### Nice to Have
- [ ] Particle effects (fire, magic, hit spark)
- [ ] Screen shake frames
- [ ] Victory/defeat screens
- [ ] Transition animations

---

## 10. 📋 NAMING CONVENTION

```
assets/sprites/
├── players/
│   ├── knight_idle.png
│   ├── knight_attack.png
│   ├── knight_hit.png
│   └── knight_death.png
├── monsters/
│   ├── slime_idle.png
│   ├── slime_attack.png
│   └── ...
├── boss/
│   ├── demon_lord_idle.png
│   ├── demon_lord_attack.png
│   └── ...
└── ui/
    ├── hp_bar.png
    ├── timer.png
    └── score_bg.png
```

---

> **记住:** ทุก sprite ต้อง **ชัดเจน จำง่าย ตัดกัน** mobile friendly!
