# Getting Started

## Requirements

- Node.js 18+
- A modern browser (Chrome, Edge, Firefox, Safari)
- For Android builds: Android Studio / Android SDK and JDK 17+

## Run the web app

```bash
npm install
npm start
```

Open <http://localhost:4173>. Set `PORT` to change the port:

```bash
PORT=8080 npm start
```

`server.js` is a tiny zero-dependency static server. It serves files from
the project root and blocks path traversal. `service-worker.js` is sent with
`Cache-Control: no-store` so updates are picked up immediately.

> OCR and PDF libraries load from a CDN, so the first run needs internet.

## Install as a PWA

Open the site in a supporting browser and choose **Install** (the in-app
install button appears when the browser offers it). The app shell is then
cached for offline use.

## Build the Android app

```bash
npm run copy:web       # copy web files into www/
npm run sync:android   # copy + cap sync android
npm run open:android   # copy + open in Android Studio
```

Build a debug APK from the CLI:

```bash
npm run copy:web && npx cap sync android
cd android && ./gradlew assembleDebug
```

The `npm run apk` script uses `gradlew.bat`, so it only works on Windows.
The APK is written to `android/app/build/outputs/apk/debug/`.

## npm scripts

| Script | Purpose |
| --- | --- |
| `start` / `dev` | Run the local static server |
| `copy:web` | Copy web assets into `www/` |
| `sync:android` | Copy assets and sync the Capacitor Android project |
| `open:android` | Copy assets and open Android Studio |
| `apk` | Copy, sync, and build a debug APK (Windows) |

For a full walkthrough of local dev and the Android app, see
[Usage: Dev & App](usage.md).
