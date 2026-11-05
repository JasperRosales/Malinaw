'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const state = {
  tab: 'text',
  originalText: '',
  simplifiedText: '',
  translationText: '',
  docName: 'Untitled',
  docVersion: 0,
  imageFile: null,
  pdfFile: null,
  pdfDoc: null,
  installPrompt: null,
  speak: null,
  explainSpeech: '',
  activeTranslationLang: 'tl'
};

let settings = loadSettings();
let ai = loadAi();
let toastTimer = null;
const dom = {};

function cacheDom() {
  const ids = [
    'installBtn', 'settingsBtn', 'settingsPanel', 'closeSettingsBtn', 'scrim',
    'tab-text', 'tab-image', 'tab-pdf', 'panel-text', 'panel-image', 'panel-pdf',
    'textInput', 'textCount', 'sampleBtn', 'clearInputBtn', 'processTextBtn',
    'imageDrop', 'imageInput', 'imagePreviewWrap', 'imagePreview', 'imageName', 'removeImageBtn',
    'ocrLang', 'enhanceToggle', 'runOcrBtn', 'ocrProgress', 'ocrProgressBar', 'ocrProgressText',
    'pdfDrop', 'pdfInput', 'pdfFileWrap', 'pdfFileName', 'pdfPageCount', 'removePdfBtn',
    'pdfOcrToggle', 'pdfOcrLang', 'runPdfBtn', 'pdfProgress', 'pdfProgressBar', 'pdfProgressText',
    'workspace', 'docName', 'docWords', 'copyBtn', 'downloadBtn', 'newDocBtn',
    'simplifyBtn', 'translateBtn', 'explainBtn', 'askBtn', 'listenBtn',
    'readabilityBadge', 'readabilityValue', 'readabilityHint',
    'translatePanel', 'sourceLang', 'targetLang', 'translateSource', 'runTranslateBtn',
    'originalText', 'originalStat', 'mainText', 'mainStat', 'translationCard', 'translationText',
    'translationStat', 'translation-title', 'listenOriginalBtn', 'listenTranslationBtn',
    'player', 'playPauseBtn', 'playerLabel', 'playerSnippet', 'stopBtn', 'speedRange', 'speedValue',
    'voiceSelect', 'closePlayerBtn',
    'fontSizeRange', 'fontSizeValue', 'lineHeightRange', 'lineHeightValue',
    'letterSpacingRange', 'letterSpacingValue', 'rateRange', 'rateValue',
    'legibleFontToggle', 'highlightChangesToggle', 'highlightReadToggle', 'reduceMotionToggle',
    'resetSettingsBtn', 'aiKeyInput', 'aiModelInput', 'testAiBtn', 'clearAiBtn',
    'explainDialog', 'explainBody', 'speakExplainBtn', 'askDialog', 'askInput', 'askSubmitBtn', 'askAnswer',
    'toast', 'srStatus'
  ];
  ids.forEach(id => {
    dom[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = document.getElementById(id);
  });
  dom.themeButtons = $$('[data-theme-choice]');
}

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    toast('Settings could not be saved on this device.');
  }
}

function loadAi() {
  try {
    return { ...DEFAULT_AI, ...JSON.parse(localStorage.getItem(AI_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_AI };
  }
}

function saveAi() {
  try {
    localStorage.setItem(AI_KEY, JSON.stringify(ai));
  } catch {
    toast('AI settings could not be saved.');
  }
}

function applySettings() {
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  root.style.setProperty('--text-size', `${settings.fontSize}px`);
  root.style.setProperty('--text-leading', String(settings.lineHeight));
  root.style.setProperty('--text-tracking', `${settings.letterSpacing}em`);
  root.classList.toggle('no-legible-font', !settings.legibleFont);
  root.classList.toggle('no-change-highlight', !settings.highlightChanges);
  root.classList.toggle('reduce-motion', settings.reduceMotion);

  dom.fontSizeRange.value = settings.fontSize;
  dom.fontSizeValue.textContent = `${settings.fontSize} px`;
  dom.lineHeightRange.value = settings.lineHeight;
  dom.lineHeightValue.textContent = Number(settings.lineHeight).toFixed(1);
  dom.letterSpacingRange.value = settings.letterSpacing;
  dom.letterSpacingValue.textContent = settings.letterSpacing > 0 ? `${Number(settings.letterSpacing).toFixed(2)} em` : 'Normal';
  dom.rateRange.value = settings.rate;
  dom.rateValue.textContent = `${formatRate(settings.rate)}×`;
  dom.speedRange.value = settings.rate;
  dom.speedValue.textContent = `${formatRate(settings.rate)}×`;
  dom.legibleFontToggle.checked = settings.legibleFont;
  dom.highlightChangesToggle.checked = settings.highlightChanges;
  dom.highlightReadToggle.checked = settings.highlightRead;
  dom.reduceMotionToggle.checked = settings.reduceMotion;

  dom.themeButtons.forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === settings.theme));
  });

  if (dom.voiceSelect) dom.voiceSelect.value = settings.voiceURI || '';
}

function setSetting(key, value) {
  settings[key] = value;
  applySettings();
  saveSettings();
}

function formatRate(value) {
  const rate = Number(value);
  return Number.isInteger(rate) ? String(rate) : rate.toFixed(1);
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value);
  });
  children.flat().forEach(child => {
    if (child === null || child === undefined || child === false) return;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  });
  return node;
}

function toast(message) {
  dom.toast.textContent = message;
  dom.toast.classList.add('is-visible');
  dom.srStatus.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => dom.toast.classList.remove('is-visible'), 3600);
}

const busyButtonContent = new WeakMap();

function setButtonBusy(button, busy, busyText) {
  if (!button) return;
  if (busy) {
    if (!busyButtonContent.has(button)) busyButtonContent.set(button, button.innerHTML);
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    if (busyText) button.textContent = busyText;
  } else {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    if (busyButtonContent.has(button)) {
      button.innerHTML = busyButtonContent.get(button);
      busyButtonContent.delete(button);
    }
  }
}

function setLoading(container, label) {
  container.textContent = '';
  const dots = el('span', { class: 'loading-dots', 'aria-hidden': 'true' }, el('span'), el('span'), el('span'));
  container.append(
    el('p', { class: 'explain-label', text: 'Please wait' }),
    el('p', { class: 'explain-text' }, label, ' ', dots)
  );
}

function cleanText(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/(\w)-\s*\n\s*(\w)/g, '$1$2')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripMarkers(text) {
  return String(text || '').split(MARK_OPEN).join('').split(MARK_CLOSE).join('');
}

function countWords(text) {
  const matches = String(text || '').match(/[A-Za-zÀ-ÿ0-9'’\-]+/g);
  return matches ? matches.length : 0;
}

function capitalize(value) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isAllCaps(value) {
  return value.length > 1 && value === value.toUpperCase() && /[A-Z]/.test(value);
}

function isCapitalized(value) {
  return /^[A-Z]/.test(value) && value !== value.toUpperCase();
}

function countSyllables(word) {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!clean) return 0;
  if (clean.length <= 3) return 1;
  const groups = clean.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

function readabilityScore(text) {
  const words = String(text || '').match(/[A-Za-zÀ-ÿ0-9'’\-]+/g) || [];
  if (!words.length) return null;
  const sentences = Math.max(1, (String(text).match(/[.!?]+/g) || []).length);
  const syllables = words.reduce((sum, word) => sum + countSyllables(word), 0);
  const score = 206.835 - 1.015 * (words.length / sentences) - 84.6 * (syllables / words.length);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function easeLabel(score) {
  if (score >= 80) return 'very easy';
  if (score >= 70) return 'easy';
  if (score >= 60) return 'plain';
  if (score >= 50) return 'fairly hard';
  if (score >= 30) return 'difficult';
  return 'very difficult';
}

function simplifyLocally(text) {
  const tokens = String(text).match(TOKEN_RE) || [];
  const output = [];
  let changes = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!WORD_RE.test(token)) {
      output.push(token);
      continue;
    }
    const wordIndexes = [];
    for (let j = i; j < tokens.length && wordIndexes.length < MAX_PHRASE_WORDS; j++) {
      if (WORD_RE.test(tokens[j])) wordIndexes.push(j);
    }
    let matched = false;
    for (let size = wordIndexes.length; size >= 1; size--) {
      const phrase = wordIndexes.slice(0, size).map(index => tokens[index].toLowerCase()).join(' ');
      const replacement = SIMPLIFY_DICT.get(phrase);
      if (!replacement) continue;
      const firstWord = tokens[wordIndexes[0]];
      let newText = replacement;
      if (isAllCaps(firstWord)) newText = replacement.toUpperCase();
      else if (isCapitalized(firstWord)) newText = capitalize(replacement);
      output.push(MARK_OPEN + newText + MARK_CLOSE);
      changes += 1;
      i = wordIndexes[size - 1];
      matched = true;
      break;
    }
    if (!matched) output.push(token);
  }
  const marked = splitLongSentences(output.join(''));
  return { marked, plain: stripMarkers(marked), changes };
}

function splitLongSentences(text) {
  return String(text).split('\n').map(line => {
    if (!line.trim()) return line;
    const sentences = line.match(/[^.!?]+[.!?]*/g) || [line];
    const rebuilt = sentences.map(sentence => {
      if (countWords(stripMarkers(sentence)) <= 24) return sentence;
      return sentence
        .replace(/;\s+/g, '. ')
        .replace(/,\s+(?:but|however|although|though|while|whereas)\s+/gi, '. ')
        .replace(/,\s+(?:and|so|because|which)\s+/gi, '. ');
    });
    return rebuilt.join(' ');
  }).join('\n');
}

function renderText(container, raw) {
  container.textContent = '';
  const text = String(raw || '');
  const paragraphs = text.split(/\n+/);
  const plainParts = [];
  let plainLength = 0;
  paragraphs.forEach((paragraph, paragraphIndex) => {
    if (paragraphIndex > 0) {
      plainParts.push('\n\n');
      plainLength += 2;
    }
    const p = document.createElement('p');
    let inMark = false;
    const segments = paragraph.split(new RegExp(`(${MARK_OPEN}|${MARK_CLOSE})`));
    segments.forEach(segment => {
      if (segment === MARK_OPEN) {
        inMark = true;
        return;
      }
      if (segment === MARK_CLOSE) {
        inMark = false;
        return;
      }
      if (!segment) return;
      segment.split(/([A-Za-zÀ-ÿ0-9'’\-]+)/).forEach(part => {
        if (!part) return;
        if (WORD_RE.test(part)) {
          const word = el('span', { class: 'word', 'data-start': plainLength });
          word.textContent = part;
          p.append(inMark ? el('mark', { class: 'changed' }, word) : word);
          plainParts.push(part);
        } else {
          p.append(document.createTextNode(part));
          plainParts.push(part);
        }
        plainLength += part.length;
      });
    });
    container.append(p);
  });
  container.dataset.plain = plainParts.join('');
}

function setPlaceholder(container, lead, strongText) {
  container.textContent = '';
  const p = el('p', { class: 'placeholder-text' });
  p.append(lead);
  if (strongText) p.append(el('strong', { text: strongText }));
  container.append(p);
  container.dataset.plain = '';
}

function updateReadability(original, simplified) {
  const before = readabilityScore(original);
  const after = readabilityScore(simplified);
  if (before === null || after === null) {
    dom.readabilityBadge.hidden = true;
    return;
  }
  dom.readabilityValue.textContent = `${before} → ${after}`;
  dom.readabilityHint.textContent = easeLabel(after);
  dom.readabilityBadge.title = `Reading ease before: ${before} (${easeLabel(before)}). After: ${after} (${easeLabel(after)}). Higher is easier.`;
  dom.readabilityBadge.hidden = false;
}

async function runSimplify({ auto = false } = {}) {
  if (!state.originalText) {
    toast('Add a document first.');
    return;
  }
  const version = state.docVersion;
  const original = state.originalText;
  setButtonBusy(dom.simplifyBtn, true, 'Simplifying…');
  let marked = '';
  let plain = '';
  let changes = 0;
  let usedAi = false;
  try {
    if (hasAi()) {
      try {
        plain = await aiRewrite(original);
        marked = plain;
        usedAi = true;
      } catch {
        toast('AI could not be reached. Using the built-in simplifier.');
      }
    }
    if (!marked) {
      const result = simplifyLocally(original);
      marked = result.marked;
      plain = result.plain;
      changes = result.changes;
    }
    if (version !== state.docVersion) return;
    state.simplifiedText = cleanText(plain);
    renderText(dom.mainText, marked);
    dom.mainStat.textContent = `${countWords(state.simplifiedText)} words`;
    updateReadability(original, state.simplifiedText);
    toast(usedAi ? 'AI rewrite ready.' : `Simplified with ${changes} word change${changes === 1 ? '' : 's'}.`);
  } catch {
    toast('Something went wrong while simplifying this text.');
  } finally {
    setButtonBusy(dom.simplifyBtn, false);
    if (auto && !state.simplifiedText) setPlaceholder(dom.mainText, 'Choose ', 'Simplify');
  }
}

async function fetchWithTimeout(url, options = {}, timeout = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}
