'use strict';

function isNativeApp() {
  const cap = window.Capacitor;
  return Boolean(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
}

function nativePlugin(name) {
  if (!isNativeApp()) return null;
  const cap = window.Capacitor;
  return cap.Plugins && cap.Plugins[name] ? cap.Plugins[name] : null;
}

function getNativeTts() {
  return nativePlugin('TextToSpeech');
}

let nativeTtsSetup = false;

function setupNativeTts() {
  const tts = getNativeTts();
  if (!tts || nativeTtsSetup) return;
  nativeTtsSetup = true;
  populateNativeVoices();
  try {
    const handle = tts.addListener('onRangeStart', info => {
      const session = state.speak;
      if (!session || !session.native || session.stopped || session.paused || !settings.highlightRead) return;
      const chunk = session.chunks[session.index];
      if (!chunk) return;
      const position = chunk.start + (info.start || 0);
      const item = findSpan(session.spans, position);
      if (!item) return;
      if (session.lastSpan && session.lastSpan !== item.el) session.lastSpan.classList.remove('is-reading');
      item.el.classList.add('is-reading');
      session.lastSpan = item.el;
      const rect = item.el.getBoundingClientRect();
      if (rect.top < 80 || rect.bottom > window.innerHeight - 20) {
        item.el.scrollIntoView({ block: 'center', behavior: settings.reduceMotion ? 'auto' : 'smooth' });
      }
    });
    Promise.resolve(handle).catch(() => {
      nativeTtsSetup = false;
    });
  } catch {
    nativeTtsSetup = false;
  }
}

async function populateNativeVoices() {
  const tts = getNativeTts();
  if (!tts || !dom.voiceSelect) return;
  try {
    const result = await tts.getSupportedVoices();
    const voices = Array.isArray(result && result.voices) ? result.voices : [];
    if (!voices.length) return;
    const current = settings.voiceURI || dom.voiceSelect.value;
    dom.voiceSelect.textContent = '';
    dom.voiceSelect.append(el('option', { value: '', text: 'Default voice' }));
    voices
      .map((voice, index) => ({ voice, index }))
      .sort((a, b) => String(a.voice.lang).localeCompare(String(b.voice.lang)) || String(a.voice.name).localeCompare(String(b.voice.name)))
      .forEach(({ voice, index }) => {
        dom.voiceSelect.append(el('option', { value: String(index), text: `${voice.name} (${voice.lang})` }));
      });
    if (current && voices.some((voice, index) => String(index) === current)) dom.voiceSelect.value = current;
  } catch {}
}

function nativeStop() {
  const tts = getNativeTts();
  if (!tts) return;
  try {
    const result = tts.stop();
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch {}
}

function chunkForSpeech(text, maxLength = 180) {
  const chunks = [];
  const regex = /[^.!?\n]+[.!?]*/g;
  let match;
  let buffer = '';
  let bufferStart = 0;
  while ((match = regex.exec(text))) {
    const piece = match[0];
    if (!piece.trim()) continue;
    const pieceStart = match.index;
    if (piece.length > maxLength) {
      if (buffer.trim()) {
        chunks.push({ text: buffer, start: bufferStart });
        buffer = '';
      }
      splitLongChunk(piece, pieceStart, maxLength).forEach(chunk => chunks.push(chunk));
      continue;
    }
    if (!buffer) {
      buffer = piece;
      bufferStart = pieceStart;
    } else if (buffer.length + piece.length <= maxLength) {
      buffer += piece;
    } else {
      chunks.push({ text: buffer, start: bufferStart });
      buffer = piece;
      bufferStart = pieceStart;
    }
  }
  if (buffer.trim()) chunks.push({ text: buffer, start: bufferStart });
  return chunks;
}

function splitLongChunk(piece, baseStart, maxLength) {
  const result = [];
  let index = 0;
  while (index < piece.length) {
    let end = Math.min(piece.length, index + maxLength);
    if (end < piece.length) {
      const lastSpace = piece.lastIndexOf(' ', end);
      if (lastSpace > index + 40) end = lastSpace + 1;
    }
    const part = piece.slice(index, end);
    if (part.trim()) result.push({ text: part, start: baseStart + index });
    index = end;
  }
  return result;
}

function getSelectedVoice(langPrefix) {
  const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  if (settings.voiceURI) {
    const chosen = voices.find(voice => voice.voiceURI === settings.voiceURI);
    if (chosen) return chosen;
  }
  if (langPrefix) {
    const prefix = langPrefix.split('-')[0].toLowerCase();
    return voices.find(voice => voice.lang.toLowerCase().startsWith(prefix)) || null;
  }
  return null;
}

function populateVoices() {
  if (getNativeTts()) return;
  if (!('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return;
  const current = settings.voiceURI || dom.voiceSelect.value;
  dom.voiceSelect.textContent = '';
  dom.voiceSelect.append(el('option', { value: '', text: 'Default voice' }));
  voices
    .slice()
    .sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name))
    .forEach(voice => {
      dom.voiceSelect.append(el('option', { value: voice.voiceURI, text: `${voice.name} (${voice.lang})` }));
    });
  if (current && voices.some(voice => voice.voiceURI === current)) dom.voiceSelect.value = current;
}

function updatePlayButton(paused) {
  const playing = !paused;
  dom.playPauseBtn.querySelector('.icon-play').hidden = playing;
  dom.playPauseBtn.querySelector('.icon-pause').hidden = !playing;
  dom.playPauseBtn.setAttribute('aria-label', playing ? 'Pause reading' : 'Play reading');
}

function clearHighlight() {
  if (!state.speak) return;
  if (state.speak.lastSpan) {
    state.speak.lastSpan.classList.remove('is-reading');
    state.speak.lastSpan = null;
  }
}

function buildSpeechSpans(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll('.word'))
    .map(span => ({
      el: span,
      start: Number(span.dataset.start),
      end: Number(span.dataset.start) + span.textContent.length
    }))
    .sort((a, b) => a.start - b.start);
}

function findSpan(spans, position) {
  let low = 0;
  let high = spans.length - 1;
  let best = null;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (spans[mid].start <= position) {
      best = spans[mid];
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best && position < best.end ? best : null;
}

function startSpeaking(text, label, container = null, lang = '') {
  const nativeTts = getNativeTts();
  if (!nativeTts && !('speechSynthesis' in window)) {
    toast('This device does not support reading aloud.');
    return;
  }
  const speechText = container && container.dataset.plain ? container.dataset.plain : String(text || '');
  if (!speechText.trim()) {
    toast('There is nothing to read yet.');
    return;
  }
  if (nativeTts) nativeStop();
  else if (window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
    window.speechSynthesis.cancel();
  }
  const chunks = chunkForSpeech(speechText);
  if (!chunks.length) {
    toast('There is nothing to read yet.');
    return;
  }
  state.speak = {
    chunks,
    index: 0,
    container,
    spans: buildSpeechSpans(container),
    stopped: false,
    paused: false,
    lastSpan: null,
    lang,
    label,
    native: Boolean(nativeTts),
    generation: 0
  };
  if (nativeTts) setupNativeTts();
  dom.player.hidden = false;
  dom.playerLabel.textContent = label || 'Reading';
  dom.playerSnippet.textContent = chunks[0].text.trim().slice(0, 90);
  updatePlayButton(false);
  speakChunk(0);
}

function finishSpeech(session) {
  session.stopped = true;
  dom.playerLabel.textContent = 'Finished reading';
  dom.playerSnippet.textContent = 'Press play to read again';
  updatePlayButton(true);
  clearHighlight();
}

function speakChunk(index) {
  const session = state.speak;
  if (!session || session.stopped || session.paused) return;
  if (index >= session.chunks.length) {
    finishSpeech(session);
    return;
  }
  session.index = index;
  const chunk = session.chunks[index];
  if (session.native) {
    speakChunkNative(session, chunk, index);
    return;
  }
  const utterance = new SpeechSynthesisUtterance(chunk.text);
  utterance.rate = Number(settings.rate) || 1;
  utterance.pitch = 1;
  if (session.lang) utterance.lang = session.lang;
  const voice = getSelectedVoice(session.lang);
  if (voice) utterance.voice = voice;
  utterance.onstart = () => {
    if (!state.speak || state.speak !== session) return;
    dom.playerSnippet.textContent = chunk.text.trim().slice(0, 90);
    updatePlayButton(false);
  };
  utterance.onboundary = event => {
    if (!state.speak || state.speak !== session || session.stopped || !settings.highlightRead) return;
    const position = chunk.start + (event.charIndex || 0);
    const item = findSpan(session.spans, position);
    if (!item) return;
    if (session.lastSpan && session.lastSpan !== item.el) session.lastSpan.classList.remove('is-reading');
    item.el.classList.add('is-reading');
    session.lastSpan = item.el;
    const rect = item.el.getBoundingClientRect();
    if (rect.top < 80 || rect.bottom > window.innerHeight - 20) {
      item.el.scrollIntoView({ block: 'center', behavior: settings.reduceMotion ? 'auto' : 'smooth' });
    }
  };
  utterance.onend = () => {
    if (!state.speak || state.speak !== session || session.stopped) return;
    speakChunk(index + 1);
  };
  utterance.onerror = event => {
    if (!state.speak || state.speak !== session || session.stopped) return;
    if (event.error === 'canceled' || event.error === 'interrupted') return;
    speakChunk(index + 1);
  };
  window.speechSynthesis.speak(utterance);
}

function nativeSpeak(tts, options) {
  const attempt = value => Promise.resolve().then(() => tts.speak(value));
  return attempt(options).catch(error => {
    const message = String(error && error.message ? error.message : error).toLowerCase();
    if (options.lang && options.lang !== 'en-US' && message.includes('not supported')) {
      return attempt({ ...options, lang: 'en-US' });
    }
    throw error;
  });
}

function speakChunkNative(session, chunk, index) {
  const tts = getNativeTts();
  if (!tts) {
    speakChunk(index + 1);
    return;
  }
  const generation = ++session.generation;
  const options = {
    text: chunk.text,
    lang: session.lang || 'en-US',
    rate: Number(settings.rate) || 1,
    pitch: 1,
    volume: 1,
    queueStrategy: 0
  };
  if (/^\d+$/.test(String(settings.voiceURI || ''))) options.voice = Number(settings.voiceURI);
  dom.playerSnippet.textContent = chunk.text.trim().slice(0, 90);
  updatePlayButton(false);
  nativeSpeak(tts, options)
    .then(() => {
      if (state.speak !== session || session.stopped || session.paused || session.generation !== generation) return;
      speakChunk(index + 1);
    })
    .catch(() => {
      if (state.speak !== session || session.stopped || session.paused || session.generation !== generation) return;
      speakChunk(index + 1);
    });
}

function restartNativeSpeechAtCurrent() {
  const session = state.speak;
  if (!session || !session.native || session.paused || session.stopped) return;
  const index = session.index;
  session.generation += 1;
  nativeStop();
  setTimeout(() => {
    if (state.speak === session && !session.paused && !session.stopped) speakChunk(index);
  }, 100);
}

function pauseOrResume() {
  const session = state.speak;
  if (session && session.native) {
    if (session.paused) {
      session.paused = false;
      session.generation += 1;
      dom.playerLabel.textContent = session.label || 'Reading';
      updatePlayButton(false);
      speakChunk(session.index);
      return;
    }
    if (session.stopped) {
      session.stopped = false;
      session.paused = false;
      session.index = 0;
      session.lastSpan = null;
      dom.playerLabel.textContent = session.label || 'Reading';
      speakChunk(0);
      return;
    }
    session.paused = true;
    session.generation += 1;
    nativeStop();
    dom.playerLabel.textContent = 'Paused';
    dom.playerSnippet.textContent = 'Press play to continue';
    updatePlayButton(true);
    return;
  }
  if (!('speechSynthesis' in window)) {
    toast('This device does not support reading aloud.');
    return;
  }
  if (!session) {
    listenCurrent();
    return;
  }
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
    session.paused = false;
    updatePlayButton(false);
    return;
  }
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.pause();
    session.paused = true;
    updatePlayButton(true);
    return;
  }
  if (session.stopped) {
    session.stopped = false;
    session.index = 0;
    session.lastSpan = null;
    dom.playerLabel.textContent = session.label || 'Reading';
    speakChunk(0);
  }
}

function stopSpeech() {
  const session = state.speak;
  if (session) {
    session.generation += 1;
    session.stopped = true;
    session.paused = false;
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  nativeStop();
  clearHighlight();
  dom.playerLabel.textContent = 'Ready to read';
  dom.playerSnippet.textContent = 'Press play to listen';
  updatePlayButton(true);
}

function closePlayer() {
  stopSpeech();
  dom.player.hidden = true;
  state.speak = null;
}

function listenCurrent() {
  if (state.translationText) listenSource('translation');
  else if (state.simplifiedText) listenSource('simplified');
  else if (state.originalText) listenSource('original');
  else toast('Add a document first.');
}

function listenSource(source) {
  if (source === 'original') {
    if (state.originalText) startSpeaking(state.originalText, 'Original text', dom.originalText, '');
    return;
  }
  if (source === 'simplified') {
    if (state.simplifiedText) startSpeaking(state.simplifiedText, 'Accessible version', dom.mainText, '');
    return;
  }
  if (source === 'translation') {
    if (state.translationText) {
      const lang = SPEECH_LANGS[state.activeTranslationLang] || '';
      startSpeaking(state.translationText, `Translation (${LANGUAGE_NAMES[state.activeTranslationLang] || ''})`, dom.translationText, lang);
    }
  }
}
