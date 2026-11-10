# Island Flyover

A simple 3D arcade flight game for the browser. Take off from the runway, fly a little prop plane around a big tropical island, and fly through floating icons to unlock **80 locations** for your Location Book. Each flight lasts 3 minutes. Find them all to beat the game.

**Play:** https://ckopp22.github.io/explore-the-island/

Built with plain HTML, CSS and JavaScript plus a local copy of [three.js](https://threejs.org/) (no build step). All art and sound are original, made from primitive shapes and generated with the Web Audio API.

## Controls

| | Touch (phone, landscape) | Keyboard |
|---|---|---|
| Steer | Drag on the left side | Arrow keys or WASD |
| Fly | Hold the pad at bottom right (let go and the plane stalls and floats) | Hold Space or Shift |
| Pause | Pause button | P or Esc |
| Location Book | Book button | B |

Optional device-tilt steering is in Settings on phones. Debug camera: press the backquote key (or add `?debug` to the URL), then H shows icon hit radii and a placement check.

## Install as an app

- **iPhone / iPad (Safari):** tap Share, then **Add to Home Screen**.
- **Android (Chrome):** open the menu and tap **Install app** (or **Add to Home screen**).
- **Desktop (Chrome / Edge):** click the install icon in the address bar.

Once installed it works fully offline.

## Run locally

Browsers will not load ES modules from `file://`, so use any static server from this folder:

```
python3 -m http.server 8000
```

then open http://localhost:8000/. The service worker is skipped on `localhost` so your edits show up immediately (add `?sw` to the URL to test offline mode).

## Deploy (GitHub Pages)

1. Push to the `main` branch.
2. In the repo go to **Settings, Pages**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`.
3. The game is served at `https://<user>.github.io/<repo>/`. All paths are relative, so it works under a repo sub-path.

**Every deploy that changes files:** bump `VERSION` at the top of `service-worker.js`, otherwise installed copies keep serving the old cached files.

## Project layout

```
index.html, style.css, manifest.json, service-worker.js
js/   main.js (state machine) world.js (terrain, ocean, sky, runway) plane.js (model, flight, chase cam)
      controls.js icons.js locations.js models.js book.js ui.js audio.js storage.js debugcam.js
lib/  three.module.min.js
icons/  PWA icons
```

The full design is in `Island-Flyover-MDD.md`.
