'use strict';

function setTab(name) {
  state.tab = name;
  $$('.tab').forEach(tab => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  $$('.tab-panel').forEach(panel => {
    panel.hidden = panel.id !== `panel-${name}`;
  });
}

function setProgress(bar, textNode, percent, label) {
  bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  textNode.textContent = label;
}

function ocrLogger(bar, textNode, overallBase = 0, overallSpan = 100) {
  return message => {
    let local = 0;
    if (message.status === 'recognizing text') local = (message.progress || 0) * 100;
    else if (message.status === 'loading language traineddata') local = (message.progress || 0) * 25;
    else if (message.status === 'initializing api') local = 5;
    const percent = overallBase + (local / 100) * overallSpan;
    const label = message.status === 'recognizing text'
      ? `Reading text… ${Math.round(local)}%`
      : message.status.replace(/_/g, ' ');
    setProgress(bar, textNode, percent, label);
  };
}

async function prepareImage(file, enhance) {
  let image;
  try {
    image = await createImageBitmap(file);
  } catch {
    image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
  const width = image.width;
  const height = image.height;
  const largest = Math.max(width, height);
  let scale = 1;
  if (largest > 2200) scale = 2200 / largest;
  else if (largest < 1000) scale = Math.min(2, 1600 / largest);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  if (enhance) {
    try {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const value = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const enhanced = Math.max(0, Math.min(255, (value - 128) * 1.35 + 128));
        data[i] = enhanced;
        data[i + 1] = enhanced;
        data[i + 2] = enhanced;
      }
      context.putImageData(imageData, 0, 0);
    } catch {}
  }
  return canvas;
}

async function createOcrWorker(lang, logger) {
  if (!window.Tesseract) throw new Error('The OCR library is still loading. Check your internet connection and try again.');
  return window.Tesseract.createWorker(lang, 1, { logger });
}

async function runOcr() {
  if (!state.imageFile) return;
  if (!window.Tesseract) {
    toast('The OCR library is still loading. Please try again in a moment.');
    return;
  }
  dom.runOcrBtn.disabled = true;
  dom.ocrProgress.hidden = false;
  setProgress(dom.ocrProgressBar, dom.ocrProgressText, 2, 'Preparing image…');
  let worker = null;
  try {
    const canvas = await prepareImage(state.imageFile, dom.enhanceToggle.checked);
    setProgress(dom.ocrProgressBar, dom.ocrProgressText, 6, 'Starting OCR…');
    worker = await createOcrWorker(dom.ocrLang.value, ocrLogger(dom.ocrProgressBar, dom.ocrProgressText, 0, 100));
    const result = await worker.recognize(canvas);
    const text = cleanText(result && result.data ? result.data.text : '');
    if (!text) throw new Error('No text was found in this photo.');
    setProgress(dom.ocrProgressBar, dom.ocrProgressText, 100, 'Done');
    setDocument(text, state.imageFile.name || 'Scanned photo');
    toast('Photo read successfully.');
  } catch (error) {
    setProgress(dom.ocrProgressBar, dom.ocrProgressText, 0, 'Could not read this photo');
    toast(error && error.message ? error.message : 'The photo could not be read. Try a clearer image.');
  } finally {
    if (worker) {
      try { await worker.terminate(); } catch {}
    }
    dom.runOcrBtn.disabled = !state.imageFile;
    setTimeout(() => { dom.ocrProgress.hidden = true; }, 1600);
  }
}

async function loadPdf(file) {
  if (!window.pdfjsLib) {
    toast('The PDF tool is still loading. Please try again in a moment.');
    return;
  }
  if (state.pdfDoc) {
    try { await state.pdfDoc.destroy(); } catch {}
    state.pdfDoc = null;
  }
  try {
    const buffer = await file.arrayBuffer();
    const task = window.pdfjsLib.getDocument({ data: buffer });
    state.pdfDoc = await task.promise;
    state.pdfFile = file;
    dom.pdfFileWrap.hidden = false;
    dom.pdfFileName.textContent = file.name;
    dom.pdfPageCount.textContent = `${state.pdfDoc.numPages} page${state.pdfDoc.numPages === 1 ? '' : 's'}`;
    dom.runPdfBtn.disabled = false;
    dom.pdfProgress.hidden = true;
  } catch {
    state.pdfFile = null;
    state.pdfDoc = null;
    dom.pdfFileWrap.hidden = true;
    dom.runPdfBtn.disabled = true;
    toast('This PDF could not be opened. It may be damaged or password protected.');
  }
}

async function runPdf() {
  if (!state.pdfDoc) return;
  const pdf = state.pdfDoc;
  const total = pdf.numPages;
  dom.runPdfBtn.disabled = true;
  dom.pdfProgress.hidden = false;
  setProgress(dom.pdfProgressBar, dom.pdfProgressText, 1, 'Opening PDF…');
  let worker = null;
  const pageTexts = [];
  const progressContext = { base: 0, span: 100 };
  const pdfOcrLogger = message => {
    let local = 0;
    if (message.status === 'recognizing text') local = (message.progress || 0) * 100;
    else if (message.status === 'loading language traineddata') local = (message.progress || 0) * 25;
    else if (message.status === 'initializing api') local = 5;
    const percent = progressContext.base + (local / 100) * progressContext.span;
    const label = message.status === 'recognizing text'
      ? `Reading text… ${Math.round(local)}%`
      : message.status.replace(/_/g, ' ');
    setProgress(dom.pdfProgressBar, dom.pdfProgressText, percent, label);
  };
  try {
    for (let pageNumber = 1; pageNumber <= total; pageNumber++) {
      const base = ((pageNumber - 1) / total) * 100;
      const span = 100 / total;
      setProgress(dom.pdfProgressBar, dom.pdfProgressText, base + span * 0.15, `Reading page ${pageNumber} of ${total}…`);
      const page = await pdf.getPage(pageNumber);
      let pageText = '';
      try {
        const content = await page.getTextContent();
        pageText = content.items.map(item => `${item.str || ''}${item.hasEOL ? '\n' : ' '}`).join('');
      } catch {
        pageText = '';
      }
      const cleaned = cleanText(pageText);
      if (cleaned.length < 40 && dom.pdfOcrToggle.checked) {
        progressContext.base = base + span * 0.2;
        progressContext.span = span * 0.75;
        setProgress(dom.pdfProgressBar, dom.pdfProgressText, progressContext.base, `Scanning page ${pageNumber} of ${total}…`);
        if (!worker) {
          if (!window.Tesseract) throw new Error('The OCR library is still loading. Try again in a moment.');
          worker = await createOcrWorker(dom.pdfOcrLang.value, pdfOcrLogger);
        }
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const context = canvas.getContext('2d');
        await page.render({ canvasContext: context, viewport }).promise;
        const result = await worker.recognize(canvas);
        pageTexts.push(cleanText(result && result.data ? result.data.text : ''));
      } else {
        pageTexts.push(cleaned);
      }
      setProgress(dom.pdfProgressBar, dom.pdfProgressText, base + span, `Page ${pageNumber} of ${total} done`);
    }
    const combined = cleanText(pageTexts.filter(Boolean).join('\n\n'));
    if (!combined) throw new Error('No readable text was found in this PDF.');
    setProgress(dom.pdfProgressBar, dom.pdfProgressText, 100, 'Done');
    setDocument(combined, state.pdfFile ? state.pdfFile.name : 'PDF document');
    toast('PDF read successfully.');
  } catch (error) {
    setProgress(dom.pdfProgressBar, dom.pdfProgressText, 0, 'Could not read this PDF');
    toast(error && error.message ? error.message : 'The PDF could not be read.');
  } finally {
    if (worker) {
      try { await worker.terminate(); } catch {}
    }
    dom.runPdfBtn.disabled = !state.pdfDoc;
    setTimeout(() => { dom.pdfProgress.hidden = true; }, 1600);
  }
}

function setDocument(text, name) {
  const cleaned = cleanText(text);
  if (!cleaned || cleaned.length < 2) {
    toast('No readable text was found. Try a clearer photo or another file.');
    return;
  }
  state.docVersion += 1;
  state.originalText = cleaned;
  state.simplifiedText = '';
  state.translationText = '';
  state.docName = (name || 'Untitled document').replace(/\.[^.]+$/, '') || 'Untitled document';

  dom.workspace.hidden = false;
  dom.docName.textContent = state.docName;
  dom.docWords.textContent = `${countWords(cleaned)} words`;
  renderText(dom.originalText, cleaned);
  dom.originalStat.textContent = `${countWords(cleaned)} words`;
  setPlaceholder(dom.mainText, 'Rewriting this in plain language', '…');
  dom.mainStat.textContent = '0 words';
  dom.translationCard.hidden = true;
  dom.translationText.textContent = '';
  dom.translationText.dataset.plain = '';
  dom.readabilityBadge.hidden = true;
  dom.translatePanel.hidden = true;
  dom.translateBtn.setAttribute('aria-expanded', 'false');

  const top = dom.workspace.getBoundingClientRect().top + window.scrollY - 82;
  window.scrollTo({ top, behavior: settings.reduceMotion ? 'auto' : 'smooth' });

  setTimeout(() => runSimplify({ auto: true }), 260);
}

function resetDocument() {
  state.docVersion += 1;
  state.originalText = '';
  state.simplifiedText = '';
  state.translationText = '';
  state.docName = 'Untitled';
  state.imageFile = null;
  state.pdfFile = null;
  if (state.pdfDoc) {
    try { state.pdfDoc.destroy(); } catch {}
    state.pdfDoc = null;
  }
  closePlayer();
  dom.workspace.hidden = true;
  dom.originalText.textContent = '';
  dom.originalText.dataset.plain = '';
  setPlaceholder(dom.mainText, 'Choose ', 'Simplify');
  dom.mainStat.textContent = '0 words';
  dom.originalStat.textContent = '0 words';
  dom.translationCard.hidden = true;
  dom.translationText.textContent = '';
  dom.translationText.dataset.plain = '';
  dom.readabilityBadge.hidden = true;
  dom.translatePanel.hidden = true;
  dom.translateBtn.setAttribute('aria-expanded', 'false');
  dom.imagePreviewWrap.hidden = true;
  dom.imageInput.value = '';
  dom.runOcrBtn.disabled = true;
  dom.ocrProgress.hidden = true;
  dom.pdfFileWrap.hidden = true;
  dom.pdfInput.value = '';
  dom.runPdfBtn.disabled = true;
  dom.pdfProgress.hidden = true;
  dom.askAnswer.hidden = true;
  dom.askInput.value = '';
  dom.textInput.value = '';
  dom.textCount.textContent = '0 characters';
  toast('Ready for a new document.');
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    toast('Copied to clipboard.');
  } catch {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    try {
      document.execCommand('copy');
      toast('Copied to clipboard.');
    } catch {
      toast('Copy failed. Please select the text and copy it manually.');
    }
    area.remove();
  }
}

function currentReadableText() {
  if (state.translationText) return state.translationText;
  if (state.simplifiedText) return state.simplifiedText;
  return state.originalText;
}

async function saveTextOnDevice(text, name) {
  const filesystem = nativePlugin('Filesystem');
  const share = nativePlugin('Share');
  if (!filesystem || !share) return false;
  try {
    const file = await filesystem.writeFile({
      path: name,
      data: text,
      directory: 'CACHE',
      encoding: 'utf8'
    });
    await share.share({
      title: name,
      url: file.uri,
      dialogTitle: 'Save or share document'
    });
    toast('Choose where to save or share the file.');
    return true;
  } catch (error) {
    const message = String(error && error.message ? error.message : error).toLowerCase();
    if (message.includes('cancel')) return true;
    return false;
  }
}

function downloadText() {
  const text = currentReadableText();
  if (!text) {
    toast('There is nothing to save yet.');
    return;
  }
  const name = (state.docName || 'malinaw-document').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 60);
  if (isNativeApp()) {
    saveTextOnDevice(text, `${name}.txt`).then(saved => {
      if (!saved) toast('The file could not be shared.');
    });
    return;
  }
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${name}.txt`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  toast('Document saved as a text file.');
}

function getSelectionText() {
  const selection = window.getSelection();
  return selection ? selection.toString().trim() : '';
}
