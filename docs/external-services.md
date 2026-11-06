# External Services

Malinaw has no backend. The browser/app calls these services directly.

| Service | Used for | Key needed | Notes |
| --- | --- | --- | --- |
| [Tesseract.js](https://github.com/naptha/tesseract.js) 5.1.1 (jsDelivr) | OCR | No | Language data downloads on first use |
| [pdf.js](https://mozilla.github.io/pdf.js/) 3.11.174 (jsDelivr) | PDF text and rendering | No | |
| [Google Gemini API](https://ai.google.dev/) | AI rewrite, explain, Q&A | Yes | Optional; user supplies key |
| [MyMemory](https://mymemory.translated.net/) | Translation | No | Free tier has a daily quota |
| [Free Dictionary API](https://dictionaryapi.dev/) | Word definitions | No | English only |

## Offline behavior

| Feature | Offline? |
| --- | --- |
| Paste text, local simplify, readability | Yes |
| Text-to-speech | Yes (device voices) |
| OCR / PDF | Only after libraries and language data are cached |
| Translation, dictionary, AI | No |

## Privacy

Document text is sent to third parties only when you use translation,
dictionary lookup, or AI features. OCR runs locally on the device.
