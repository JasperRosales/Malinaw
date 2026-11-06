# Features (Technical)

## OCR (photos)

`input.js` → `prepareImage()` then `runOcr()`.

1. Image is drawn on a canvas, scaled so the long side is ≤ 2200px
   (small images are upscaled).
2. If **Enhance** is on, it is converted to grayscale with a 1.35×
   contrast boost.
3. A Tesseract.js worker (`eng`, `fil`, or `eng+fil`) recognizes the text.
4. The worker is terminated after each run.

## PDF reading

`input.js` → `loadPdf()` then `runPdf()`.

- Each page's text layer is read with pdf.js.
- If a page has fewer than 40 characters and **OCR scanned pages** is on,
  it is rendered at 2× scale and passed to Tesseract.
- Page texts are joined with blank lines.

## Simplification

`core.js` → `runSimplify()`.

- **AI path** (`aiRewrite` in `ai.js`): text is split into chunks of up
  to `MAX_AI_CHARS` (5200) and each is sent to Gemini with a plain-language
  prompt. Falls back to local if the request fails.
- **Local path** (`simplifyLocally`): tokenizes the text and greedily
  replaces phrases of up to 4 words using `SIMPLIFY_DICT` (`data.js`),
  keeping capitalization. Long sentences are split. Changes are wrapped in
  markers for highlighting.

## Readability

`readabilityScore()` computes Flesch Reading Ease (0–100) with a heuristic
syllable counter. `easeLabel()` maps it to "very easy" … "very difficult".

## Text-to-speech

`speech.js`.

- In the browser: Web Speech API (`speechSynthesis`).
- In the Android app: `@capacitor-community/text-to-speech`.
- Text is chunked to ~180 characters at sentence/phrase boundaries.
- Word spans are highlighted as each chunk is spoken.
- Voice language follows `SPEECH_LANGS` (e.g. `tl` → `fil-PH`).

## Translation

`ai.js` → `runTranslation()` / `translateText()`.

- Uses the MyMemory API, text split into ≤ 450 char chunks.
- Quota/invalid-language warnings in the response are treated as errors.

## Explain

`ai.js` → `openExplain(term)` combines, in parallel:

- `GLOSSARY` simple definition (`data.js`)
- Free Dictionary API lookup (single words)
- `SIMPLIFY_DICT` replacement
- Translation and/or a Gemini explanation when available

## Ask a question

`ai.js` → `answerQuestion()`.

- **AI**: sends the question and the first 7000 characters of the
  document to Gemini; the answer must come only from the document.
- **Offline**: `findAnswerSentences()` scores sentences by keyword overlap
  (stopwords removed) and returns the top 2.
