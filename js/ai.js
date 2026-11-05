'use strict';

async function runTranslation() {
  const source = dom.translateSource.value === 'original' ? state.originalText : state.simplifiedText;
  const from = dom.sourceLang.value;
  const to = dom.targetLang.value;
  if (!source) {
    toast('Add a document first.');
    return;
  }
  if (from === to) {
    toast('Choose two different languages.');
    return;
  }
  setButtonBusy(dom.runTranslateBtn, true, 'Translating…');
  try {
    const translated = await translateText(source, from, to);
    if (!translated) throw new Error('empty');
    state.translationText = cleanText(translated);
    state.activeTranslationLang = to;
    dom.translationCard.hidden = false;
    dom.translationTitle.textContent = `Translation (${LANGUAGE_NAMES[to] || to})`;
    renderText(dom.translationText, state.translationText);
    dom.translationStat.textContent = `${countWords(state.translationText)} words`;
    toast(`Translated to ${LANGUAGE_NAMES[to] || to}.`);
    const top = dom.translationCard.getBoundingClientRect().top + window.scrollY - 90;
    window.scrollTo({ top, behavior: settings.reduceMotion ? 'auto' : 'smooth' });
  } catch {
    toast('Translation is unavailable right now. Please check your connection and try again.');
  } finally {
    setButtonBusy(dom.runTranslateBtn, false);
  }
}

async function translateText(text, from, to) {
  const chunks = splitForTranslation(cleanText(text), 450);
  const results = [];
  for (const chunk of chunks) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${encodeURIComponent(from)}%7C${encodeURIComponent(to)}`;
    const response = await fetchWithTimeout(url, {}, 14000);
    if (!response.ok) throw new Error('Translation request failed');
    const data = await response.json();
    const value = data && data.responseData ? data.responseData.translatedText : '';
    if (!value) throw new Error('No translation');
    if (/MYMEMORY WARNING|QUOTA|INVALID LANGUAGE|PLEASE SELECT/i.test(value)) throw new Error('Translation limit reached');
    results.push(decodeHtml(value));
  }
  return results.join(' ');
}

function splitForTranslation(text, maxLength) {
  const parts = [];
  let buffer = '';
  const pieces = String(text).match(/[^.!?\n]+[.!?]*|\n+/g) || [String(text)];
  pieces.forEach(piece => {
    if (piece.length > maxLength) {
      if (buffer) {
        parts.push(buffer);
        buffer = '';
      }
      splitLongChunk(piece, 0, maxLength).forEach(part => parts.push(part.text));
      return;
    }
    if ((buffer + piece).length > maxLength && buffer) {
      parts.push(buffer);
      buffer = piece;
    } else {
      buffer += piece;
    }
  });
  if (buffer.trim()) parts.push(buffer);
  return parts.filter(part => part.trim());
}

function hasAi() {
  return Boolean(ai.key && ai.key.trim().length > 10);
}

async function gemini(prompt) {
  if (!hasAi()) throw new Error('No AI key');
  const model = (ai.model || DEFAULT_AI.model).trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(ai.key.trim())}`;
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.35, maxOutputTokens: 2048 }
    })
  }, 30000);
  if (!response.ok) throw new Error(`AI request failed (${response.status})`);
  const data = await response.json();
  const candidate = data && data.candidates && data.candidates[0];
  const parts = candidate && candidate.content && candidate.content.parts;
  const text = Array.isArray(parts) ? parts.map(part => part.text || '').join('') : '';
  if (!text.trim()) throw new Error('AI returned no text');
  return cleanAiText(text);
}

function cleanAiText(text) {
  return String(text)
    .replace(/```[a-z]*/gi, '')
    .replace(/^\s*(?:rewritten text|simplified text|answer)\s*:\s*/i, '')
    .replace(/\*\*/g, '')
    .trim();
}

async function aiRewrite(text) {
  const chunks = splitForAi(cleanText(text));
  const results = [];
  for (let i = 0; i < chunks.length; i++) {
    const prompt = `Rewrite the text below in plain language for a person who finds reading difficult. Use short sentences and everyday words. Keep every important fact, number, name, and instruction. Do not add new information. Keep the original language. Return only the rewritten text.\n\n${chunks[i]}`;
    const output = await gemini(prompt);
    if (!output) throw new Error('Empty AI rewrite');
    results.push(output);
    if (chunks.length > 1) dom.srStatus.textContent = `Simplifying part ${i + 1} of ${chunks.length}`;
  }
  return cleanText(results.join('\n\n'));
}

function splitForAi(text) {
  const paragraphs = String(text).split(/\n{2,}/);
  const chunks = [];
  let buffer = '';
  paragraphs.forEach(paragraph => {
    if (paragraph.length > MAX_AI_CHARS) {
      if (buffer) {
        chunks.push(buffer);
        buffer = '';
      }
      splitLongChunk(paragraph, 0, MAX_AI_CHARS).forEach(part => chunks.push(part.text));
      return;
    }
    if ((buffer + '\n\n' + paragraph).length > MAX_AI_CHARS && buffer) {
      chunks.push(buffer);
      buffer = paragraph;
    } else {
      buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    }
  });
  if (buffer.trim()) chunks.push(buffer);
  return chunks;
}

async function dictionaryLookup(word) {
  const response = await fetchWithTimeout(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {}, 10000);
  if (!response.ok) return null;
  const data = await response.json();
  const entry = Array.isArray(data) ? data[0] : null;
  if (!entry) return null;
  const meanings = [];
  (entry.meanings || []).slice(0, 2).forEach(meaning => {
    (meaning.definitions || []).slice(0, 2).forEach(definition => {
      if (!definition.definition) return;
      meanings.push({
        part: meaning.partOfSpeech || '',
        definition: definition.definition,
        example: definition.example || ''
      });
    });
  });
  const phonetic = entry.phonetic || (entry.phonetics || []).find(item => item.text)?.text || '';
  return { phonetic, meanings };
}

async function openExplain(rawTerm) {
  const term = String(rawTerm || '')
    .replace(/\s+/g, ' ')
    .replace(/^[^A-Za-zÀ-ÿ0-9]+|[^A-Za-zÀ-ÿ0-9.!?'-]+$/g, '')
    .trim();
  if (!term) {
    dom.explainBody.textContent = '';
    dom.explainBody.append(el('p', { class: 'dialog-placeholder', text: 'Select a word in the document, then choose Explain, or tap any word directly.' }));
    dom.speakExplainBtn.hidden = true;
    dom.explainDialog.showModal();
    return;
  }
  if (!dom.explainDialog.open) dom.explainDialog.showModal();
  setLoading(dom.explainBody, `Looking up “${term}”`);
  dom.speakExplainBtn.hidden = true;

  const lower = term.toLowerCase();
  const isWord = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’\-]*$/.test(term);
  const result = {
    simple: GLOSSARY[lower] || '',
    dictionary: null,
    translation: '',
    replacement: SIMPLIFY_DICT.get(lower) || ''
  };
  const tasks = [];
  if (isWord) tasks.push(dictionaryLookup(lower).then(data => { result.dictionary = data; }).catch(() => {}));
  tasks.push(translateText(term, 'en', 'tl').then(value => { result.translation = value; }).catch(() => {}));
  if (hasAi()) {
    tasks.push(gemini(`In two short, simple sentences, explain what the word or phrase "${term}" means in plain English. Do not use difficult words. Return only the explanation.`)
      .then(value => { result.simple = value; })
      .catch(() => {}));
  }
  await Promise.allSettled(tasks);

  if (!result.simple && result.dictionary && result.dictionary.meanings.length) {
    result.simple = result.dictionary.meanings[0].definition;
  }
  if (!result.simple && result.replacement) {
    result.simple = `A simpler word for it is “${result.replacement}”.`;
  }

  const body = dom.explainBody;
  body.textContent = '';
  body.append(el('h3', { class: 'word-title', text: term }));
  const metaBits = [];
  if (result.dictionary && result.dictionary.phonetic) metaBits.push(result.dictionary.phonetic);
  metaBits.push(isWord ? 'tap-to-explain word' : 'phrase');
  body.append(el('p', { class: 'word-meta', text: metaBits.join(' · ') }));

  const speechParts = [];
  if (result.simple) {
    body.append(explainSection('In simple words', result.simple));
    speechParts.push(result.simple);
  }

  if (result.dictionary && result.dictionary.meanings.length) {
    const list = el('ul', { class: 'explain-list' });
    result.dictionary.meanings.forEach(meaning => {
      list.append(el('li', {}, meaning.part ? el('strong', { text: `${meaning.part}: ` }) : null, meaning.definition));
    });
    body.append(explainSection('Dictionary definition', list));
    speechParts.push(result.dictionary.meanings.map(item => item.definition).join(' '));
    const example = result.dictionary.meanings.find(item => item.example);
    if (example) {
      body.append(explainSection('Example', example.example));
      speechParts.push(example.example);
    }
  }

  if (result.replacement && result.replacement.toLowerCase() !== lower) {
    const pill = el('div', { class: 'pill-list' }, el('span', { class: 'pill', text: result.replacement }));
    body.append(explainSection('Simpler word', pill));
  }

  if (result.translation) {
    body.append(explainSection('In Filipino', result.translation));
    speechParts.push(result.translation);
  }

  if (!result.simple && !result.dictionary && !result.translation) {
    body.append(el('p', { class: 'dialog-placeholder', text: 'No explanation was found. Try another word, or check your internet connection for dictionary results.' }));
  }

  state.explainSpeech = speechParts.filter(Boolean).join(' ');
  dom.speakExplainBtn.hidden = !state.explainSpeech;
}

function explainSection(label, content) {
  const section = el('div', { class: 'explain-section' });
  section.append(el('p', { class: 'explain-label', text: label }));
  if (typeof content === 'string') section.append(el('p', { class: 'explain-text', text: content }));
  else section.append(content);
  return section;
}

function findAnswerSentences(question, text) {
  const queryTokens = (question.toLowerCase().match(/[a-zà-ÿ0-9'’\-]+/g) || [])
    .filter(token => token.length > 2 && !STOPWORDS.has(token));
  if (!queryTokens.length) return [];
  const sentences = String(text).match(/[^.!?\n]+[.!?]*/g) || [];
  const scored = sentences.map((sentence, index) => {
    const words = new Set(sentence.toLowerCase().match(/[a-zà-ÿ0-9'’\-]+/g) || []);
    let score = 0;
    queryTokens.forEach(token => {
      if (words.has(token)) score += 1;
      else if (Array.from(words).some(word => word.startsWith(token) || token.startsWith(word))) score += 0.5;
    });
    return { sentence: sentence.trim(), score, index };
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.filter(item => item.score > 0).slice(0, 2).map(item => item.sentence);
}

async function answerQuestion() {
  const question = dom.askInput.value.trim();
  if (!question) {
    toast('Type a question first.');
    return;
  }
  if (!state.originalText) {
    toast('Add a document first.');
    return;
  }
  setButtonBusy(dom.askSubmitBtn, true, 'Thinking…');
  dom.askAnswer.hidden = false;
  setLoading(dom.askAnswer, 'Looking for the answer in this document');

  if (hasAi()) {
    try {
      const documentText = state.originalText.slice(0, 7000);
      const answer = await gemini(`You are a helpful reading assistant. Answer the question using only the document below. Use simple language and short sentences. If the answer is not in the document, say so clearly. Keep the answer under 120 words.\n\nQuestion: ${question}\n\nDocument:\n${documentText}`);
      dom.askAnswer.textContent = '';
      dom.askAnswer.append(el('p', { class: 'explain-label', text: 'AI answer' }), el('p', { text: answer }));
      setButtonBusy(dom.askSubmitBtn, false);
      return;
    } catch {
      toast('AI could not be reached. Trying an offline answer.');
    }
  }

  const sentences = findAnswerSentences(question, state.originalText);
  if (!sentences.length) {
    dom.askAnswer.textContent = '';
    dom.askAnswer.append(
      el('p', { class: 'explain-label', text: 'No direct match' }),
      el('p', { text: 'I could not find a clear answer in this document. Try asking about a name, date, amount, or instruction that appears in the text.' })
    );
    setButtonBusy(dom.askSubmitBtn, false);
    return;
  }

  const simplified = sentences.map(sentence => simplifyLocally(sentence).plain).join(' ');
  const body = el('div');
  body.append(el('p', { class: 'explain-label', text: 'From the document' }), el('p', { text: simplified }));
  dom.askAnswer.textContent = '';
  dom.askAnswer.append(body);

  try {
    const translated = await translateText(simplified, 'en', 'tl');
    if (translated) body.append(explainSection('In Filipino', translated));
  } catch {
    body.append(el('p', { class: 'field-hint', text: 'Filipino translation is unavailable right now.' }));
  }
  setButtonBusy(dom.askSubmitBtn, false);
}
