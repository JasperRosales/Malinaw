'use strict';

function setImageFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(file.name || '')) {
    toast('Please choose an image file.');
    return;
  }
  state.imageFile = file;
  if (dom.imagePreview.src) URL.revokeObjectURL(dom.imagePreview.src);
  dom.imagePreview.src = URL.createObjectURL(file);
  dom.imagePreviewWrap.hidden = false;
  dom.imageName.textContent = file.name;
  dom.runOcrBtn.disabled = false;
  dom.ocrProgress.hidden = true;
}

function restartSpeechAtCurrent() {
  const session = state.speak;
  if (!session) return;
  if (session.native) {
    restartNativeSpeechAtCurrent();
    return;
  }
  if (!('speechSynthesis' in window)) return;
  if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) return;
  const index = session.index;
  session.stopped = true;
  window.speechSynthesis.cancel();
  session.stopped = false;
  setTimeout(() => {
    if (state.speak === session && !session.paused) speakChunk(index);
  }, 80);
}

function openSettings() {
  dom.scrim.hidden = false;
  dom.settingsPanel.classList.add('is-open');
  dom.settingsPanel.setAttribute('aria-hidden', 'false');
  dom.settingsBtn.setAttribute('aria-expanded', 'true');
  document.body.classList.add('drawer-open');
  setTimeout(() => dom.closeSettingsBtn.focus(), 40);
}

function closeSettings() {
  dom.settingsPanel.classList.remove('is-open');
  dom.settingsPanel.setAttribute('aria-hidden', 'true');
  dom.settingsBtn.setAttribute('aria-expanded', 'false');
  dom.scrim.hidden = true;
  document.body.classList.remove('drawer-open');
  dom.settingsBtn.focus();
}

function trapDrawerFocus(event) {
  if (event.key !== 'Tab' || !dom.settingsPanel.classList.contains('is-open')) return;
  const focusable = $$('button, input, select, textarea, [tabindex]:not([tabindex="-1"])', dom.settingsPanel)
    .filter(item => !item.disabled && item.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function wireTabs() {
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => setTab(tab.dataset.tab));
    tab.addEventListener('keydown', event => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      const tabs = $$('.tab');
      const index = tabs.indexOf(tab);
      const next = event.key === 'ArrowRight'
        ? tabs[(index + 1) % tabs.length]
        : tabs[(index - 1 + tabs.length) % tabs.length];
      next.focus();
      setTab(next.dataset.tab);
    });
  });
}

function wireTextInput() {
  dom.textInput.addEventListener('input', () => {
    const length = dom.textInput.value.length;
    dom.textCount.textContent = `${length} character${length === 1 ? '' : 's'}`;
  });
  dom.textInput.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') dom.processTextBtn.click();
  });
  dom.sampleBtn.addEventListener('click', () => {
    dom.textInput.value = SAMPLE_TEXT;
    dom.textInput.dispatchEvent(new Event('input'));
    dom.textInput.focus();
    toast('Sample loaded. Choose “Make it readable”.');
  });
  dom.clearInputBtn.addEventListener('click', () => {
    dom.textInput.value = '';
    dom.textCount.textContent = '0 characters';
    dom.textInput.focus();
  });
  dom.processTextBtn.addEventListener('click', () => {
    const text = dom.textInput.value.trim();
    if (!text) {
      toast('Paste some text first.');
      dom.textInput.focus();
      return;
    }
    setDocument(text, 'Pasted text');
  });
}

async function nativePickPhoto() {
  const camera = nativePlugin('Camera');
  if (!camera) {
    dom.imageInput.click();
    return;
  }
  try {
    const photo = await camera.getPhoto({
      resultType: 'dataUrl',
      source: 'PROMPT',
      quality: 85,
      width: 2200,
      correctOrientation: true,
      promptLabelHeader: 'Add a photo',
      promptLabelPhoto: 'Choose from gallery',
      promptLabelPicture: 'Take a photo',
      promptLabelCancel: 'Cancel'
    });
    if (!photo || !photo.dataUrl) return;
    const response = await fetch(photo.dataUrl);
    const blob = await response.blob();
    const format = String(photo.format || 'jpeg').toLowerCase();
    const type = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
    const suffix = format === 'jpeg' ? 'jpg' : format;
    const file = new File([blob], `photo-${Date.now()}.${suffix}`, { type });
    setImageFile(file);
  } catch (error) {
    const message = String(error && error.message ? error.message : error).toLowerCase();
    if (message.includes('cancel')) return;
    toast('The camera could not be opened.');
  }
}

function wireImageInput() {
  const choose = () => {
    if (isNativeApp()) {
      nativePickPhoto();
      return;
    }
    dom.imageInput.click();
  };
  dom.imageDrop.addEventListener('click', choose);
  dom.imageDrop.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose();
    }
  });
  dom.imageInput.addEventListener('change', () => {
    const file = dom.imageInput.files && dom.imageInput.files[0];
    if (file) setImageFile(file);
  });
  ['dragenter', 'dragover'].forEach(type => {
    dom.imageDrop.addEventListener(type, event => {
      event.preventDefault();
      dom.imageDrop.classList.add('is-drag');
    });
  });
  ['dragleave', 'drop'].forEach(type => {
    dom.imageDrop.addEventListener(type, event => {
      event.preventDefault();
      dom.imageDrop.classList.remove('is-drag');
    });
  });
  dom.imageDrop.addEventListener('drop', event => {
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) setImageFile(file);
  });
  dom.removeImageBtn.addEventListener('click', () => {
    state.imageFile = null;
    dom.imagePreviewWrap.hidden = true;
    dom.imageInput.value = '';
    dom.runOcrBtn.disabled = true;
    dom.ocrProgress.hidden = true;
  });
  dom.runOcrBtn.addEventListener('click', runOcr);
}

function wirePdfInput() {
  const choose = () => dom.pdfInput.click();
  dom.pdfDrop.addEventListener('click', choose);
  dom.pdfDrop.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose();
    }
  });
  dom.pdfInput.addEventListener('change', () => {
    const file = dom.pdfInput.files && dom.pdfInput.files[0];
    if (file) loadPdf(file);
  });
  ['dragenter', 'dragover'].forEach(type => {
    dom.pdfDrop.addEventListener(type, event => {
      event.preventDefault();
      dom.pdfDrop.classList.add('is-drag');
    });
  });
  ['dragleave', 'drop'].forEach(type => {
    dom.pdfDrop.addEventListener(type, event => {
      event.preventDefault();
      dom.pdfDrop.classList.remove('is-drag');
    });
  });
  dom.pdfDrop.addEventListener('drop', event => {
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) loadPdf(file);
  });
  dom.removePdfBtn.addEventListener('click', async () => {
    if (state.pdfDoc) {
      try { await state.pdfDoc.destroy(); } catch {}
    }
    state.pdfDoc = null;
    state.pdfFile = null;
    dom.pdfFileWrap.hidden = true;
    dom.pdfInput.value = '';
    dom.runPdfBtn.disabled = true;
    dom.pdfProgress.hidden = true;
  });
  dom.runPdfBtn.addEventListener('click', runPdf);
}

function wireDocumentTools() {
  dom.simplifyBtn.addEventListener('click', () => runSimplify());
  dom.copyBtn.addEventListener('click', () => {
    const text = currentReadableText();
    if (text) copyText(text);
    else toast('There is nothing to copy yet.');
  });
  dom.downloadBtn.addEventListener('click', downloadText);
  dom.newDocBtn.addEventListener('click', resetDocument);
  dom.listenBtn.addEventListener('click', listenCurrent);
  dom.listenOriginalBtn.addEventListener('click', () => listenSource('original'));
  dom.listenTranslationBtn.addEventListener('click', () => listenSource('translation'));

  dom.translateBtn.addEventListener('click', () => {
    const willOpen = dom.translatePanel.hidden;
    dom.translatePanel.hidden = !willOpen;
    dom.translateBtn.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) dom.sourceLang.focus();
  });
  dom.runTranslateBtn.addEventListener('click', runTranslation);

  dom.explainBtn.addEventListener('click', () => {
    const selection = getSelectionText();
    openExplain(selection);
  });
  dom.askBtn.addEventListener('click', () => {
    dom.askAnswer.hidden = true;
    dom.askDialog.showModal();
    setTimeout(() => dom.askInput.focus(), 50);
  });
  dom.askSubmitBtn.addEventListener('click', answerQuestion);
  dom.askInput.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') answerQuestion();
  });

  [dom.originalText, dom.mainText, dom.translationText].forEach(container => {
    container.addEventListener('click', event => {
      const word = event.target.closest('.word');
      if (!word) return;
      if (getSelectionText().length > 1) return;
      openExplain(word.textContent);
    });
  });
}

function wirePlayer() {
  dom.playPauseBtn.addEventListener('click', pauseOrResume);
  dom.stopBtn.addEventListener('click', stopSpeech);
  dom.closePlayerBtn.addEventListener('click', closePlayer);
  dom.speedRange.addEventListener('input', () => {
    setSetting('rate', Number(dom.speedRange.value));
    restartSpeechAtCurrent();
  });
  dom.rateRange.addEventListener('input', () => {
    setSetting('rate', Number(dom.rateRange.value));
    restartSpeechAtCurrent();
  });
  dom.voiceSelect.addEventListener('change', () => {
    setSetting('voiceURI', dom.voiceSelect.value);
    restartSpeechAtCurrent();
  });
}

function wireSettings() {
  dom.settingsBtn.addEventListener('click', openSettings);
  dom.closeSettingsBtn.addEventListener('click', closeSettings);
  dom.scrim.addEventListener('click', closeSettings);
  dom.settingsPanel.addEventListener('keydown', trapDrawerFocus);

  dom.themeButtons.forEach(button => {
    button.addEventListener('click', () => setSetting('theme', button.dataset.themeChoice));
  });

  dom.fontSizeRange.addEventListener('input', () => setSetting('fontSize', Number(dom.fontSizeRange.value)));
  dom.lineHeightRange.addEventListener('input', () => setSetting('lineHeight', Number(dom.lineHeightRange.value)));
  dom.letterSpacingRange.addEventListener('input', () => setSetting('letterSpacing', Number(dom.letterSpacingRange.value)));
  dom.legibleFontToggle.addEventListener('change', () => setSetting('legibleFont', dom.legibleFontToggle.checked));
  dom.highlightChangesToggle.addEventListener('change', () => setSetting('highlightChanges', dom.highlightChangesToggle.checked));
  dom.highlightReadToggle.addEventListener('change', () => setSetting('highlightRead', dom.highlightReadToggle.checked));
  dom.reduceMotionToggle.addEventListener('change', () => setSetting('reduceMotion', dom.reduceMotionToggle.checked));

  dom.resetSettingsBtn.addEventListener('click', () => {
    settings = { ...DEFAULT_SETTINGS };
    applySettings();
    saveSettings();
    toast('Settings reset to defaults.');
  });
}

function wireAiSettings() {
  dom.aiKeyInput.value = ai.key || '';
  dom.aiModelInput.value = ai.model || DEFAULT_AI.model;
  dom.aiKeyInput.addEventListener('change', () => {
    ai.key = dom.aiKeyInput.value.trim();
    saveAi();
  });
  dom.aiModelInput.addEventListener('change', () => {
    ai.model = dom.aiModelInput.value.trim() || DEFAULT_AI.model;
    saveAi();
  });
  dom.testAiBtn.addEventListener('click', async () => {
    ai.key = dom.aiKeyInput.value.trim();
    ai.model = dom.aiModelInput.value.trim() || DEFAULT_AI.model;
    saveAi();
    if (!hasAi()) {
      toast('Add a Gemini API key first.');
      return;
    }
    setButtonBusy(dom.testAiBtn, true, 'Testing…');
    try {
      await gemini('Reply with only the word OK.');
      toast('AI connection is working.');
    } catch {
      toast('AI connection failed. Check the key and model name.');
    } finally {
      setButtonBusy(dom.testAiBtn, false);
    }
  });
  dom.clearAiBtn.addEventListener('click', () => {
    ai = { ...DEFAULT_AI };
    dom.aiKeyInput.value = '';
    dom.aiModelInput.value = DEFAULT_AI.model;
    saveAi();
    toast('AI key cleared.');
  });
}

function wireDialogs() {
  $$('.dialog-close').forEach(button => {
    button.addEventListener('click', () => {
      const dialog = button.closest('dialog');
      if (dialog) dialog.close();
    });
  });
  [dom.explainDialog, dom.askDialog].forEach(dialog => {
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
  });
  dom.speakExplainBtn.addEventListener('click', () => {
    if (state.explainSpeech) startSpeaking(state.explainSpeech, 'Explanation', null, '');
  });
}

function wireKeyboard() {
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && dom.settingsPanel.classList.contains('is-open')) {
      closeSettings();
      return;
    }
    if (!event.altKey) return;
    if (event.key === '1') {
      event.preventDefault();
      setTab('text');
      dom.textInput.focus();
    } else if (event.key === '2') {
      event.preventDefault();
      pauseOrResume();
    }
  });
}

function setupInstall() {
  if (isNativeApp()) {
    dom.installBtn.hidden = true;
    return;
  }
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (standalone) {
    dom.installBtn.hidden = true;
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    state.installPrompt = event;
    dom.installBtn.hidden = false;
  });
  dom.installBtn.addEventListener('click', async () => {
    if (!state.installPrompt) {
      toast('Use your browser menu and choose “Add to Home screen”.');
      return;
    }
    state.installPrompt.prompt();
    try { await state.installPrompt.userChoice; } catch {}
    state.installPrompt = null;
    dom.installBtn.hidden = true;
  });
  window.addEventListener('appinstalled', () => {
    state.installPrompt = null;
    dom.installBtn.hidden = true;
    toast('Malinaw is installed. Open it from your home screen.');
  });
}

function registerServiceWorker() {
  if (isNativeApp()) return;
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}

function init() {
  cacheDom();
  applySettings();
  setupNativeTts();
  populateVoices();
  wireTabs();
  wireTextInput();
  wireImageInput();
  wirePdfInput();
  wireDocumentTools();
  wirePlayer();
  wireSettings();
  wireAiSettings();
  wireDialogs();
  wireKeyboard();
  setupInstall();
  registerServiceWorker();

  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = populateVoices;
    populateVoices();
  }
}

init();
