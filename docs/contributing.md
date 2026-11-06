# Contributing

## Setup

```bash
git clone https://github.com/<you>/Malinaw.git
cd Malinaw
npm install
npm start
```

## Conventions

- Vanilla JS, no framework, no bundler. Files use `'use strict'`.
- Scripts share globals; keep the load order in `index.html`.
- Put constants and word lists in `js/data.js`.
- Put UI event wiring in `js/app.js`.
- Keep UI accessible: labels, ARIA roles, keyboard support, focus states,
  and respect `reduceMotion`.

## Common changes

**Add a simplification word**: add an entry to `SIMPLIFY_DICT` in
`js/data.js` (lowercase key → simple replacement). Multi-word keys up to
4 words are supported.

**Add a glossary definition**: add to `GLOSSARY` in `js/data.js`.

**Add a translation language**: add `<option>`s to the source/target
selects in `index.html`, and entries in `LANGUAGE_NAMES` and
`SPEECH_LANGS`.

**Add a new JS file**: add a `<script defer>` in `index.html`, add it to
`APP_SHELL` in `service-worker.js`, and bump `CACHE_NAME`.

**Add a top-level asset**: also add it to `scripts/copy-web.js` so the
Android build includes it.

## Testing

There is no automated test suite. Test manually:

- Paste text, simplify, listen, translate, explain, ask.
- Photo OCR and a scanned + text PDF.
- All four themes and large font sizes.
- Keyboard-only navigation.
- Offline reload after first visit.
- Android build on a device.
