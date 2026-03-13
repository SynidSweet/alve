# Alve's World — Homepage Design Spec

## Overview

A splash-page homepage for Alve (age 11) at `alve.petter.ai`. Combines Minecraft pixel-art aesthetics with peak 90s personal homepage chaos — bouncing text, marquees, animated GIFs, cursor trails, a real visitor counter, and a working guestbook.

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS — single `index.html`, no build step. Deployed to Vercel as static site.
- **Backend**: Express.js + SQLite. Hosted on Hetzner. Two API endpoints.
- **Domain**: `alve.petter.ai` pointed at Vercel via Caddy/DNS.

## Frontend — Page Sections (top to bottom)

### 1. Background
- Animated starfield (CSS + minimal JS)
- Dark navy/black base (#0a0a2e) — space vibes

### 2. Header: "WELCOME TO ALVE'S WORLD"
- Minecraft-style pixel font (via Google Fonts "Press Start 2P" or "Silkscreen")
- Rainbow color animation cycling through the text
- Bouncing/wobbling animation
- Flanked by animated flame GIFs or pixel torches

### 3. Pixel Art Section
- CSS grid creeper face (green pixel blocks) — subtle blink animation
- Diamond sword pixel art beside it
- "Under Construction" animated GIF banner

### 4. About Zone
- Small blurb: "This is Alve's corner of the internet. He's 11 and he'll probably put cool stuff here eventually."
- Comic Sans font, because of course
- Animated "NEW!" badge gif
- Blinking text

### 5. Visitor Counter
- Classic LCD odometer-style digit display
- "You are visitor #000482" text
- Calls `GET /api/visit` on page load, displays returned count
- Digits animate/roll when loading

### 6. Guestbook
- "SIGN MY GUESTBOOK!!!" in blinking rainbow text
- Form: Name input + Message textarea + Submit button (all Minecraft-styled)
- Calls `POST /api/guestbook` on submit
- Recent entries displayed below (calls `GET /api/guestbook` on load)
- Each entry shows: name, message, date — styled like Minecraft chat messages

### 7. Footer / Bottom Marquee
- `<marquee>` scrolling ticker with rotating silly messages:
  - "This page is best viewed in Netscape Navigator 4.0 at 800x600"
  - "Made with mass and energy"
  - "No creepers were harmed in the making of this page"
- "Best viewed at 800x600" badge
- Horizontal flame/fire divider GIFs

### 8. Interactive Extras
- **Cursor trail**: Sparkles or tiny pickaxe icons following the mouse
- **Music button**: Play/pause button for 8-bit background music (NOT autoplay)
- **Konami code easter egg**: If entered, screen goes full rainbow chaos mode

## Backend API

Hosted on Hetzner at a known URL (e.g., `api.alve.petter.ai` or a port via Caddy).

### Database Schema (SQLite)

```sql
CREATE TABLE visitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  count INTEGER DEFAULT 0
);

CREATE TABLE guestbook (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Endpoints

#### `GET /api/visit`
- Increments visitor count by 1
- Returns `{ "count": 482 }`
- Single row in visitors table, upserted on each call

#### `GET /api/guestbook`
- Returns last 50 guestbook entries, newest first
- Response: `{ "entries": [{ "name": "Steve", "message": "Cool page!", "created_at": "2026-03-13T..." }] }`

#### `POST /api/guestbook`
- Body: `{ "name": "Steve", "message": "Cool page!" }`
- Validation: name 1-30 chars, message 1-200 chars
- Rate limit: 1 post per IP per 60 seconds (in-memory, simple)
- Returns `{ "success": true, "entry": { ... } }`
- Basic XSS sanitization on inputs

### CORS
- Allow origin: `https://alve.petter.ai`

## Deployment

### Frontend
1. Static files in project root (index.html + assets/)
2. `vercel deploy --prod` with domain alias `alve.petter.ai`

### Backend
1. Express app in `backend/` directory
2. Run via pm2 or systemd on Hetzner
3. Caddy reverse proxy to expose as `api.alve.petter.ai` or similar

## Design Tokens

- **Primary font**: "Press Start 2P" (pixel/Minecraft feel)
- **Secondary font**: Comic Sans MS (90s cringe)
- **Colors**:
  - Background: #0a0a2e (dark space)
  - Minecraft green: #5BAA3C
  - Creeper green: #4CAF50
  - Gold/yellow: #FFD700
  - Hot pink: #FF69B4
  - Cyan: #00FFFF
- **Animations**: CSS keyframes for bounce, rainbow, blink, sparkle, marquee
