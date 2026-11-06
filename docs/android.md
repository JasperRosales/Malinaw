# Android

The Android app wraps the web app with [Capacitor](https://capacitorjs.com/) 8.

## Config

`capacitor.config.json`:

- `appId`: `ph.malinaw.reader`
- `appName`: `Malinaw`
- `webDir`: `www` (created by `npm run copy:web`)

SDK levels (`android/variables.gradle`): `minSdk 24`, `targetSdk 36`.

## Native plugins

| Plugin | Used for |
| --- | --- |
| `@capacitor/camera` | Taking/picking photos for OCR |
| `@capacitor-community/text-to-speech` | Native TTS and voices |
| `@capacitor/filesystem` | Saving text files on device |
| `@capacitor/share` | Sharing text |

`speech.js` → `isNativeApp()` checks `window.Capacitor` and switches to
native plugins; the browser path is used otherwise.

## Workflow

1. Edit web files in the project root (not in `www/`).
2. `npm run sync:android`
3. Build/run from Android Studio (`npm run open:android`) or
   `cd android && ./gradlew assembleDebug`.

`www/` and generated Android assets are git-ignored.

## Notes

- `scripts/copy-web.js` copies only `index.html`, `styles.css`,
  `manifest.webmanifest`, `service-worker.js`, `icons/`, and `js/`.
  Add new top-level files or folders there.
- CDN libraries (Tesseract, pdf.js) still need internet in the app.
