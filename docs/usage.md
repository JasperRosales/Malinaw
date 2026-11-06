# How to Use: Local Dev and Android App

Malinaw runs the same code in two places:

- **Local dev (browser)**: served by `server.js` on your computer.
- **Android app**: the same web files packaged with Capacitor.

---

## Part A: Local development

### 1. Install and start

```bash
git clone https://github.com/<you>/Malinaw.git
cd Malinaw
npm install
npm start
```

Open <http://localhost:4173> in Chrome or Edge.

Use another port if 4173 is taken:

```bash
PORT=8080 npm start
```

### 2. Make changes

Edit files in the project root (`index.html`, `styles.css`, `js/*.js`).
There is no build step. Save, then reload the page.

If an old version keeps showing, the service worker cached it:

- DevTools → **Application** → **Service workers** → tick
  **Update on reload**, or
- Hard reload (`Ctrl+Shift+R`), or
- Bump `CACHE_NAME` in `service-worker.js`.

### 3. Try every feature

1. **Text** tab → paste text (or load the sample) → continue.
2. **Photo** tab → choose an image → **Read photo**.
3. **PDF** tab → choose a PDF → read it.
4. In the workspace: **Simplify**, **Listen**, **Translate**,
   **Explain** (tap a word), **Ask** a question.
5. Open **Settings** → change theme, font size, spacing, speed.
6. Optional: **Settings → AI** → paste a Gemini API key to enable
   AI rewrite, explain, and Q&A.

Internet is needed for OCR/PDF libraries (first load), translation,
dictionary, and AI.

### 4. Test on your phone's browser

**Option 1: same Wi-Fi.** Find your PC's IP (`ip addr` / `ipconfig`)
and open `http://<PC-IP>:4173` on the phone. Allow port 4173 through
your firewall. Over plain `http` on an IP, the service worker and PWA
install won't work (they need `localhost` or HTTPS); everything else does.

**Option 2: USB with adb (full PWA support).**

```bash
adb reverse tcp:4173 tcp:4173
```

Then open `http://localhost:4173` on the phone.

### 5. Install as a PWA

Click **Install** in the app (or browser menu → *Install app* /
*Add to Home screen*). It then opens in its own window and the app
shell works offline.

---

## Part B: Android app

### 1. Requirements

- Node.js 18+ and `npm install` done
- Android Studio (includes the Android SDK)
- JDK 17+ (`JAVA_HOME` set)
- A phone with **USB debugging** on, or an emulator

### 2. Build and run

**With Android Studio (easiest):**

```bash
npm run open:android
```

Wait for Gradle sync, pick your device, press **Run ▶**.

**From the command line:**

```bash
npm run sync:android
cd android
./gradlew assembleDebug     # Windows: gradlew.bat assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Or build, install, and launch in one step:

```bash
npx cap run android
```

### 3. Update the app after code changes

The app uses a copy of the web files in `www/`, so always re-sync:

```bash
npm run sync:android
```

Then run again from Android Studio or reinstall the APK.
Never edit `www/` directly; it is overwritten.

### 4. Using the app

It works like the browser version, plus:

| Feature | In the app |
| --- | --- |
| Photo | Opens a prompt: **Take a photo** or **Choose from gallery** |
| Listen | Uses the phone's built-in TTS voices |
| Download | Opens the share sheet to **save or share** the `.txt` file |
| Install button | Hidden (already an app) |

Tip: for Filipino speech, install a Filipino voice in
*Android Settings → Text-to-speech output*.

### 5. Debugging the app

Connect the phone, open `chrome://inspect` in desktop Chrome, and click
**inspect** under the Malinaw WebView to get DevTools (console,
network, elements).

Native logs:

```bash
adb logcat | grep -i capacitor
```

### 6. Share an APK

Send `android/app/build/outputs/apk/debug/app-debug.apk`. Users must
allow *Install unknown apps*. For Play Store, build a signed release
in Android Studio (**Build → Generate Signed App Bundle / APK**).

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| "OCR library is still loading" | Check internet; the library loads from a CDN |
| Translation fails | MyMemory free quota reached; try later |
| AI not used | Key missing/invalid; check **Settings → AI** |
| No voices / silent | Install or enable a TTS engine/voice on the device |
| App shows old UI | Run `npm run sync:android` and reinstall |
| Browser shows old UI | Unregister service worker or hard reload |
| `npm run apk` fails on Linux/Mac | It uses `gradlew.bat`; use `./gradlew assembleDebug` |
