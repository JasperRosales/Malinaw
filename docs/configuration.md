# Configuration

## User settings

Stored in `localStorage` under `malinaw.settings.v1`.
Defaults live in `DEFAULT_SETTINGS` (`js/data.js`):

| Key | Default | Notes |
| --- | --- | --- |
| `theme` | `light` | `light`, `cream`, `dark`, `contrast` |
| `fontSize` | `22` | px, 16–40 |
| `lineHeight` | `1.6` | 1.2–2.4 |
| `letterSpacing` | `0` | em, 0–0.16 |
| `rate` | `1` | speech rate, 0.5–2 |
| `legibleFont` | `true` | Use the more legible font |
| `highlightChanges` | `true` | Mark simplified words |
| `highlightRead` | `true` | Highlight words while reading |
| `reduceMotion` | `false` | Disable smooth scroll/animations |
| `voiceURI` | `''` | Selected TTS voice |

## AI settings

Stored in `localStorage` under `malinaw.ai.v1`:

| Key | Default |
| --- | --- |
| `key` | `''` (Google Gemini API key) |
| `model` | `gemini-2.0-flash` |

Set them in **Settings → AI**. AI is used only when a key is set
(longer than 10 characters).

Get a key from Google AI Studio: <https://aistudio.google.com/apikey>.

> The key is stored in plain text in the browser and sent directly to
> Google from the device. Don't use a key you share with other projects.

## Other constants (`js/data.js`)

| Constant | Purpose |
| --- | --- |
| `MAX_AI_CHARS` | Max characters per AI rewrite chunk (5200) |
| `SIMPLIFY_DICT` | Hard word/phrase → simple replacement |
| `GLOSSARY` | Simple definitions for common hard words |
| `LANGUAGE_NAMES` | Translation language labels |
| `SPEECH_LANGS` | Translation code → TTS locale |

## Server

| Env var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4173` | Dev server port |
