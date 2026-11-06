# Architecture

Malinaw is plain HTML, CSS, and vanilla JavaScript with no build step.
Scripts are classic `<script defer>` files that share globals, loaded in
this order from `index.html`:

```
tesseract.js (CDN) → pdf.js (CDN)
data.js → core.js → speech.js → ai.js → input.js → app.js
```

Order matters: later files use constants and functions from earlier ones.

## Project layout

```
index.html            App markup (single page)
styles.css            All styles and themes
service-worker.js     Offline caching
manifest.webmanifest  PWA manifest
server.js             Local static dev server
capacitor.config.json Capacitor (Android) config
scripts/copy-web.js   Copies web assets into www/
icons/                App icons
js/                   App logic (see below)
android/              Capacitor Android project
plan.txt              Original project idea
```

## JavaScript modules

| File | Responsibility |
| --- | --- |
| `js/data.js` | Constants: storage keys, defaults, sample text, stopwords, simplification dictionary, glossary, language maps |
| `js/core.js` | DOM cache, settings load/save/apply, helpers (`el`, `toast`), text cleaning, readability, local simplifier, rendering, `runSimplify`, `fetchWithTimeout` |
| `js/speech.js` | Text-to-speech: Web Speech API and native Capacitor TTS, chunking, word highlighting, player |
| `js/ai.js` | Translation (MyMemory), Gemini calls, AI rewrite, dictionary lookup, Explain dialog, Q&A |
| `js/input.js` | Source tabs, image prep + OCR, PDF loading + OCR, document state, copy/download/save |
| `js/app.js` | Event wiring for all UI, settings drawer, dialogs, keyboard, install prompt, service worker, `init()` |

## Data flow

```
Text / Photo / PDF
      │  (OCR via Tesseract, PDF text via pdf.js)
      ▼
setDocument() → state.originalText
      │
      ├─ runSimplify() → state.simplifiedText
      ├─ runTranslation() → state.translationText
      ├─ openExplain(term)
      ├─ answerQuestion()
      └─ startSpeaking(text) → player
```

`state.docVersion` increments on each new document so late async results
from an old document are discarded.

## Offline caching

`service-worker.js` uses two caches:

- `malinaw-shell-v1` – app shell, pre-cached on install.
- `malinaw-runtime-v1` – runtime responses.

Strategies:

- Navigation: network first, fall back to cache, then `index.html`.
- Same-origin assets: cache first.
- CDN assets (jsDelivr, unpkg, Google Fonts): stale-while-revalidate.
- Other cross-origin requests (APIs) are not cached.

Bump `CACHE_NAME` when changing shell files, and add new shell files to
`APP_SHELL`.
