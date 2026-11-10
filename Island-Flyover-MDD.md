# ISLAND FLYOVER — Master Design Document (MDD) v2

A simple 3D web game. Take off from a runway, fly a small prop plane around a BIG tropical island, and hit floating icons to unlock locations. Each flight lasts 3 minutes. Every unlocked location is saved to your **Location Book** of 80 locations. Find all 80 to beat the game. Built with Claude Code in VS Code, hosted on GitHub Pages, installable as a PWA.

> Note: This is a gameplay-style homage. Use ORIGINAL art, names, music and characters. Do not use Nintendo / Wii Sports Resort names, logos, Mii characters, audio or models. Everything is built from simple primitive shapes and generated sounds.

---

## 1. Game Summary

| Item | Value |
|---|---|
| Title | Island Flyover |
| Genre | Arcade flight / exploration / collection, single player |
| Platforms | Web (desktop + phone browser), installable PWA |
| Tech | HTML + CSS + JavaScript, three.js (local copy, no build step) |
| Hosting | GitHub Pages |
| Flight length | 3:00 per flight |
| Collection goal | 80 locations in the Location Book |
| Beat the game | Unlock all 80 locations (progress is saved between flights) |

---

## 2. Core Loop

1. Main menu → **Fly** (or **Location Book** to review progress).
2. Plane sits on the runway. Countdown "3, 2, 1, GO!" and takeoff.
3. A **3:00 timer** starts. Fly around the big island.
4. Floating **icons** hover over locations. Fly the plane **through/into an icon** to unlock it.
5. On unlock: chime, icon bursts, banner pops up with the location name and a "NEW!" tag, and it is added to the Book. Counter updates (`23 / 80`).
6. Timer hits 0:00 → flight ends → summary: found this flight, total in Book, Fly Again.
7. Repeat flights until the Book shows **80 / 80** → **YOU BEAT THE GAME** screen.
8. Already-unlocked locations show a faded/ghost icon (or no icon) so you can focus on new ones.

---

## 3. Controls

### Mobile (primary)
- **Touch joystick (left side):** drag left/right = bank and turn, up/down = pitch.
- **Throttle slider (right side):** slow / normal / fast.
- Optional Settings toggle: **Device tilt steering** (iOS permission prompt required).
- Landscape orientation.

### Desktop
- Arrow keys or WASD: pitch and bank
- Shift / Ctrl: throttle up / down
- B: open Location Book (pauses)
- Esc / P: pause

### Feel
- Forgiving arcade physics: no stalling, no crashing.
- Auto-levels when input released.
- Cannot go below water or ground (gently pushed up).
- Soft world boundary with "Turn back!" warning and auto-steer toward the island.
- Hit detection is generous: an icon unlocks when the plane is within its **hit radius** (about 25 units), no button press needed.

---

## 4. The Island (BIG)

One large hand-built island (fixed layout, same every time), roughly **8 km × 8 km in game scale** (about 4–5 minutes to fly end to end at normal speed, so 3 minutes cannot see everything and the player must plan routes across many flights).

### Regions (each holds about 8–12 locations)
1. **Sunny Beach Coast** — resort, pier, lifeguard tower, boat dock
2. **Jungle Interior** — treehouse, temple ruins, waterfall, rope bridge
3. **Volcano Highlands** — volcano, lava lake, hot springs, observatory
4. **Snowy Peak** — summit cabin, ski lift, ice cave
5. **Farmland Valley** — windmill, barn, orchards, scarecrow field
6. **Old Town** — castle, clock tower, market, stone bridge
7. **Harbor and Lighthouse Point** — lighthouse, shipwreck, cargo cranes
8. **Offshore Islets** — tiny islands, sea arch, hidden cove

### Terrain
- Low-poly heightmap terrain with vertex colors (sand, grass, rock, snow).
- Chunked / simplified distant detail and fog to keep performance high on phones.
- Animated ocean plane.
- Runway on the south coast. Plane always starts here.
- Gradient sky, clouds, sun light.

---

## 5. The 80 Locations and Icons

Each location has one floating icon at a fixed position.

- **Icon look:** glowing, slowly spinning and bobbing badge (simple ring plus symbol), visible from far away. Color by category (see below).
- **Not-yet-found:** bright, pulsing.
- **Already-found:** removed or shown as a faint translucent ghost (setting).
- **Hit:** plane enters the hit radius → unlock.

### Data (single array in `locations.js`)
```js
const LOCATIONS = [
  { id: 1, name: 'Lighthouse', region: 'harbor', category: 'landmark',
    pos: [x, y, z], emoji: '🗼', blurb: 'Guides ships past the rocky point.' },
  // ... 80 entries
];
```

### Categories (colors)
- Landmarks (red), Nature (green), Water (blue), Buildings (yellow), Mountains (purple), Secrets (gold, tricky to reach)

### Starter list idea (Claude Code fills out to 80 with original names across the 8 regions)
Lighthouse, Windmill, Waterfall, Volcano, Pier, Beach Resort, Castle Ruins, Palm Grove, Radio Tower, Shipwreck, Sea Arch, Ice Cave, Hot Springs, Clock Tower, Barn, Rope Bridge, Observatory, Treehouse, Market Square, Cargo Cranes... and 60 more.

### Placement rules for the 80
- Spread evenly, with 8–12 per region.
- Some obvious (on coastlines, tall landmarks), some tricky (in valleys, under arches, low over water, between cliffs) for discovery.
- Roughly 10 "secret" gold icons placed in hard-to-spot spots.
- No two icons closer than 60 units.
- Each icon must be reachable without flying below terrain.

---

## 6. The Location Book

The player's collection screen.

- Opens from the main menu, pause menu, end-of-flight screen, and a HUD button.
- Grid of **80 slots** (page through by region tabs or scroll).
- **Unlocked:** icon art, name, region, short blurb, "found on flight #N".
- **Locked:** dark silhouette with `???` and a hint on which region it is in (optional hint toggle).
- Progress bar and counter: `Found 23 / 80`, plus per-region counts (e.g. Volcano Highlands 4 / 10).
- Tap an unlocked entry to see a larger card.
- A small **minimap/overview** (optional v1.1) showing where found locations are on the island.
- At 80 / 80: gold Book cover, a "Master Pilot" badge, and a congratulations screen.

---

## 7. HUD / UI

- **Top center:** big timer `2:47`, red and pulsing under 0:30.
- **Top left:** Book counter `23 / 80` and "this flight: +3".
- **Compass / radar:** small round radar at the bottom center showing nearby unfound icons as dots (helps navigation on a big island). Toggle in Settings.
- **Unlock banner:** slides in at top with the location name.
- **Top right:** pause, sound toggle, Book button.
- **Bottom left:** joystick. **Bottom right:** throttle.
- All UI is an HTML/CSS overlay on top of the canvas.

### Screens
1. **Main Menu:** title, Fly, Location Book, How to Play, Settings.
2. **How to Play:** steer, fly into floating icons, fill the Book, 3 minutes per flight.
3. **Countdown** 3, 2, 1, GO.
4. **Game HUD**
5. **Pause:** Resume, Location Book, Restart Flight, Main Menu.
6. **Flight Over:** "Time's up!", new locations this flight with icons, total, Fly Again, Open Book, Menu.
7. **Location Book**
8. **You Beat the Game:** all 80 found, total flights taken, fastest completion, Reset Progress or Keep Flying.

---

## 8. Audio

Generated with Web Audio API (no files needed):
- Engine hum (pitch rises with speed)
- Unlock chime (rising notes; special sparkle for gold secrets)
- Icon ambient shimmer when close (louder as you approach)
- Timer tick under 0:10, end buzzer
- Win fanfare
- Optional simple synth music loop (off by default)
- **Sound toggle** in menu and HUD, saved to localStorage. Audio starts after first tap.

---

## 9. Saving (localStorage)

Progress MUST persist since the Book is built across many flights.
- `unlockedIds` (array of found location ids)
- `foundOnFlight` per location
- `flightCount`, best flight (most found in one flight)
- Settings: sound, radar, tilt steering, ghost icons, hints
- Save immediately after every unlock (not only at the end of a flight) so closing the app doesn't lose progress.
- Settings option: **Reset Progress** (with confirmation).
- Optional v1.1: export/import progress code.

---

## 10. PWA and GitHub Pages Requirements

### File structure
```
island-flyover/
├── index.html
├── style.css
├── manifest.json
├── service-worker.js
├── js/
│   ├── main.js          (bootstrap, game state machine)
│   ├── world.js         (terrain, ocean, sky, runway, chunks)
│   ├── locations.js     (all 80 location records)
│   ├── icons.js         (floating icon meshes, hit detection)
│   ├── plane.js         (plane model + flight physics)
│   ├── controls.js      (touch joystick, keyboard, tilt)
│   ├── book.js          (Location Book UI and logic)
│   ├── ui.js            (HUD, menus, screens, radar)
│   ├── audio.js         (Web Audio sounds)
│   └── storage.js       (localStorage save/load)
├── lib/
│   └── three.module.min.js
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    └── icon-maskable-512.png
```

### PWA
- `manifest.json`: name "Island Flyover", short_name "Flyover", `display: "fullscreen"` (fallback standalone), `orientation: "landscape"`, theme and background colors, icons 192 / 512 / maskable.
- `service-worker.js`: cache-first for all files, versioned cache name, clean up old caches. Works fully offline.
- All paths **relative** (`./`) for GitHub Pages under `/repo-name/`.
- Meta tags: viewport-fit=cover, apple-mobile-web-app-capable, apple-touch-icon.
- Disable pull-to-refresh, text selection, double-tap zoom, long-press menu (`touch-action: none` on the canvas).
- "Rotate your phone" overlay in portrait.

### GitHub Pages
- Deploy from `main` branch root. No build step.
- README with live link and install steps (iPhone: Share → Add to Home Screen; Android/Chrome: Install).

---

## 11. Performance Targets (big island = important)

- 60 FPS on a recent iPhone; cap pixel ratio at 2.
- Terrain in chunks, with only nearby chunks at full detail. Far chunks are low-poly.
- Fog and a camera far-plane to limit draw distance.
- Instanced meshes for trees, rocks, and props. Shared materials.
- Landmarks built from a handful of primitives each; only show detailed models within range.
- Only check hit detection for icons within ~300 units of the plane (spatial grid or simple distance culling).
- No real-time shadows on mobile; use a blob shadow under the plane.
- Target under ~5 MB total download.

---

## 12. Visual Style

- Bright, cheerful, low-poly, flat-shaded tropical look.
- Palette: turquoise water, warm sand, lush green, grey rock, white snow, red/white plane.
- Plane: simple boxes and cylinders, spinning propeller, banks into turns.
- Chase camera behind and slightly above, smooth follow, slight FOV widening at speed.
- Locations have simple primitive-shape models so each one is recognizable from the air.

---

## 13. Milestones (Build Order)

1. **Scaffold:** three.js scene, render loop, state machine, main menu.
2. **Big island world:** chunked terrain, ocean, sky, fog, runway, regions.
3. **Plane and camera:** model, flight physics, chase camera.
4. **Controls:** keyboard, then touch joystick and throttle, then optional tilt.
5. **Takeoff and timer:** countdown, 3:00 flight, Flight Over screen.
6. **Floating icons:** icon meshes, hit detection, unlock effect, banner (test with 10 first).
7. **All 80 locations:** data array, models, placement across all 8 regions.
8. **Location Book:** grid UI, locked/unlocked states, region progress, saving.
9. **HUD polish:** radar, counters, pause, How to Play, Settings.
10. **Audio:** all Web Audio sounds and toggle.
11. **Win state:** 80 / 80 celebration.
12. **PWA and deploy:** manifest, icons, service worker, GitHub Pages, phone test.

---

## 14. Prompts for Claude Code (paste one at a time)

**Prompt 1 — Scaffold**
> Read ISLAND_FLYOVER_MDD.md. Create the project structure from section 10 with plain HTML/CSS/JS (no bundler). Download three.js into /lib and load it as an ES module. Render an empty sky-blue scene with a resize-safe canvas, a game state machine (menu, countdown, flying, paused, flightOver, book, win) and a working main menu.

**Prompt 2 — Big island**
> Build the big island from section 4: chunked low-poly heightmap terrain with vertex colors and the 8 regions, animated ocean, gradient sky, clouds, fog, and the runway on the south coast. Keep it fast per section 11. Add a free debug camera to look around.

**Prompt 3 — Plane and flight**
> Add the low-poly plane with spinning propeller and the arcade flight physics from section 3 (auto-level, banking turns, soft world boundary, no crashing). Add a smooth chase camera. Keyboard first.

**Prompt 4 — Mobile controls and takeoff**
> Add the touch joystick, throttle slider, and optional tilt steering. Start the plane on the runway with a 3-2-1 countdown and takeoff, then run the 3:00 flight timer and the Flight Over screen. It must play well on iPhone in landscape.

**Prompt 5 — Floating icons**
> Create the floating icon system from section 5: glowing spinning bobbing icons, hit radius detection by flying into them, unlock effect, sound hook, and the unlock banner. Add 10 test locations first and save unlocks to localStorage immediately.

**Prompt 6 — All 80 locations**
> Fill out locations.js with all 80 original locations across the 8 regions per the placement rules, including about 10 gold secret ones. Build a simple primitive-shape model for each so they are recognizable from the air, and place their icons. Add a debug mode that draws hit radii and lists any icon placed inside terrain.

**Prompt 7 — Location Book**
> Build the Location Book from section 6: 80-slot grid with region tabs, locked silhouettes and unlocked cards, per-region progress, counter and progress bar. Open it from the menu, pause screen, flight-over screen and HUD.

**Prompt 8 — HUD, radar, settings**
> Add the HUD from section 7 including the radar showing nearby unfound icons, pause menu, How to Play, Settings (sound, radar, tilt, ghost icons, hints, reset progress with confirmation).

**Prompt 9 — Audio and win**
> Add all Web Audio sounds from section 8 and the sound toggle. Add the 80 / 80 You Beat the Game screen.

**Prompt 10 — PWA**
> Add manifest.json, generated icons, a versioned cache-first service-worker.js, iOS meta tags, and the portrait "rotate your device" overlay. All paths relative so it works on GitHub Pages under /repo-name/.

**Prompt 11 — Polish and deploy**
> Optimize performance per section 11, fix bugs, write the README, and give me exact steps to push to GitHub and enable Pages. Then list how to test installing it as a PWA on iPhone and Android.

---

## 15. Future Ideas (not in v1)

- Bonus time pickups (time rings)
- Cockpit camera
- Night / sunset flights
- Plane colors unlocked by Book milestones (25, 50, 80)
- Minimap in the Book
- Daily "find these 5" challenge

---

## 16. Definition of Done

- Loads from GitHub Pages, installs to the home screen, works offline
- Big island runs at about 60 FPS on phone and desktop
- Player can take off, fly for 3:00, and unlock locations by flying into floating icons
- All 80 locations exist, are reachable, and appear in the Location Book when found
- Progress persists across flights and app restarts
- Unlocking the 80th location shows the Beat the Game screen
