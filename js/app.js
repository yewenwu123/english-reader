const STOP_WORDS = new Set([
  'a', 'an', 'the',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
  'up', 'about', 'into', 'over', 'after', 'before', 'between',
  'under', 'without', 'through', 'during', 'against', 'among',
  'around', 'within', 'along', 'across', 'behind', 'beyond',
  'below', 'beneath', 'beside', 'outside', 'inside', 'upon', 'via', 'per',
  'and', 'or', 'but', 'so', 'yet', 'nor', 'while', 'when', 'because',
  'although', 'though', 'if', 'since', 'unless', 'until', 'as',
  'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'its', 'our', 'their',
  'mine', 'yours', 'hers', 'ours', 'theirs',
  'this', 'that', 'these', 'those',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'having',
  'do', 'does', 'did', 'doing',
  'will', 'would', 'shall', 'should',
  'can', 'could', 'may', 'might', 'must',
  'need', 'dare',
  'there', 'here',
  'some', 'any', 'no', 'not', 'very', 'just',
  'also', 'too', 'only', 'well', 'even', 'still', 'already',
  'more', 'most', 'much', 'many',
  'each', 'every', 'both', 'all', 'few', 'several',
  'what', 'which', 'who', 'whom', 'whose',
  'how', 'why', 'when', 'where',
]);

const CHINESE_STOP_WORDS = new Set([
  '的', '了', '和', '与', '及', '或', '而', '在', '是', '有', '就', '都',
  '也', '很', '把', '被', '对', '从', '到', '给', '让', '我', '你', '他',
  '她', '它', '们', '这', '那', '一个', '一种', '这个', '那个', '我们',
  '你们', '他们', '她们',
]);

const REQUEST_TIMEOUT_MS = 10000;
const TRANSLATING_TEXT = '翻译中';
const RETRY_TEXT = '重试';

const translationCache = new Map();
const onlineQueue = [];
let onlineBusy = false;

function cleanEnglish(word) {
  return word.replace(/[^a-zA-Z']/g, '').toLowerCase();
}

function cleanChinese(word) {
  return word.replace(/[^\u4e00-\u9fa5]/g, '');
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function parseGoogleResult(data) {
  if (!Array.isArray(data) || !Array.isArray(data[0])) return null;

  const translated = data[0]
    .map(part => Array.isArray(part) ? part[0] : '')
    .filter(Boolean)
    .join('')
    .trim();

  return translated || null;
}

function fetchJsonWithTimeout(url) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  return fetch(url, { signal: controller.signal })
    .then(response => {
      if (!response.ok) throw new Error('Translate request failed: ' + response.status);
      return response.json();
    })
    .finally(() => window.clearTimeout(timer));
}

function isLocalNodeServer() {
  return location.protocol === 'http:'
    && (location.hostname === '127.0.0.1' || location.hostname === 'localhost');
}

function translateWithGoogle(text, source, target) {
  const params = new URLSearchParams({ sl: source, tl: target, q: text });

  if (isLocalNodeServer()) {
    return fetchJsonWithTimeout('/api/translate?' + params.toString())
      .then(data => data.translation || null);
  }

  const googleUrl = 'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&'
    + params.toString();

  return fetchJsonWithTimeout(googleUrl).then(parseGoogleResult);
}

function processOnlineQueue() {
  if (onlineBusy || onlineQueue.length === 0) return;
  onlineBusy = true;

  const job = onlineQueue.shift();
  if (!navigator.onLine) {
    onlineBusy = false;
    job.callback(null);
    processOnlineQueue();
    return;
  }

  translateWithGoogle(job.text, job.source, job.target)
    .then(trans => {
      if (trans && trans.toLowerCase() !== job.text.toLowerCase()) {
        translationCache.set(job.cacheKey, trans);
        job.callback(trans);
      } else {
        job.callback(null);
      }
    })
    .catch(error => {
      console.warn('[Translate] Google online translation failed:', error);
      job.callback(null);
    })
    .finally(() => {
      onlineBusy = false;
      processOnlineQueue();
    });
}

function enqueueOnlineLookup(text, source, target, callback) {
  const cacheKey = `${source}:${target}:${text}`;
  const cached = translationCache.get(cacheKey);
  if (cached) {
    callback(cached);
    return;
  }

  onlineQueue.push({ text, source, target, cacheKey, callback });
  processOnlineQueue();
}

function tokenizeEnglish(text) {
  const segments = [];
  let i = 0;

  while (i < text.length) {
    if (/\s/.test(text[i])) {
      let value = '';
      while (i < text.length && /\s/.test(text[i])) value += text[i++];
      segments.push({ type: 'space', value });
    } else if (/[a-zA-Z]/.test(text[i])) {
      let value = '';
      while (i < text.length && /[a-zA-Z']/.test(text[i])) value += text[i++];
      segments.push({ type: 'word', value });
    } else {
      let value = '';
      while (i < text.length && !/\s/.test(text[i]) && !/[a-zA-Z]/.test(text[i])) value += text[i++];
      segments.push({ type: 'punct', value });
    }
  }

  return segments;
}

function tokenizeChinese(text) {
  const segments = [];
  let i = 0;

  while (i < text.length) {
    if (/\s/.test(text[i])) {
      let value = '';
      while (i < text.length && /\s/.test(text[i])) value += text[i++];
      segments.push({ type: 'space', value });
    } else if (/[\u4e00-\u9fa5]/.test(text[i])) {
      let value = '';
      while (i < text.length && /[\u4e00-\u9fa5]/.test(text[i])) value += text[i++];
      segments.push({ type: 'word', value });
    } else {
      let value = '';
      while (i < text.length && !/\s/.test(text[i]) && !/[\u4e00-\u9fa5]/.test(text[i])) value += text[i++];
      segments.push({ type: 'punct', value });
    }
  }

  return segments;
}

function getCleanWord(word, mode) {
  return mode === 'zh-en' ? cleanChinese(word) : cleanEnglish(word);
}

function isStopWord(clean, mode) {
  if (mode === 'zh-en') return clean.length <= 1 || CHINESE_STOP_WORDS.has(clean);
  return !clean || STOP_WORDS.has(clean);
}

function getLanguagePair(mode) {
  return mode === 'zh-en'
    ? { source: 'zh-CN', target: 'en' }
    : { source: 'en', target: 'zh-CN' };
}

function renderTokens(tokens, mode) {
  let html = '';
  const pendingWords = [];

  for (const token of tokens) {
    if (token.type === 'space') {
      html += token.value;
      continue;
    }

    if (token.type === 'punct') {
      html += escapeHtml(token.value);
      continue;
    }

    const clean = getCleanWord(token.value, mode);
    if (!clean || isStopWord(clean, mode)) {
      html += `<span class="stop-word">${escapeHtml(token.value)}</span>`;
      continue;
    }

    html += `<span class="word" tabindex="0" data-word="${escapeHtml(clean)}" data-state="pending"><span class="card-inner"><span class="front">${escapeHtml(token.value)}</span><span class="back">${TRANSLATING_TEXT}</span></span></span>`;
    pendingWords.push(clean);
  }

  return { html, pendingWords: [...new Set(pendingWords)] };
}

function setTranslationState(spans, state, text) {
  spans.forEach(span => {
    span.dataset.state = state;
    span.title = state === 'error' ? 'Google 翻译请求失败，点击重试' : '';
    const back = span.querySelector('.back');
    if (back) back.textContent = text;
  });
}

function lookupWord(spans, word, mode) {
  if (!spans || !spans.length) return;
  if (spans[0].dataset.state === 'loading') return;

  const { source, target } = getLanguagePair(mode);
  setTranslationState(spans, 'loading', TRANSLATING_TEXT);

  enqueueOnlineLookup(word, source, target, trans => {
    if (trans) {
      setTranslationState(spans, 'done', trans);
    } else {
      setTranslationState(spans, 'error', RETRY_TEXT);
    }
  });
}

function fillMissingTranslations(root, pendingWords, mode) {
  const spanMap = new Map();
  root.querySelectorAll('.word[data-word]').forEach(el => {
    const list = spanMap.get(el.dataset.word) || [];
    list.push(el);
    spanMap.set(el.dataset.word, list);
  });

  pendingWords.forEach(word => {
    lookupWord(spanMap.get(word), word, mode);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const textInput = document.getElementById('textInput');
  const formatBtn = document.getElementById('formatBtn');
  const clearBtn = document.getElementById('clearBtn');
  const output = document.getElementById('output');
  const styleBtns = document.querySelectorAll('.style-btn');
  const modeBtns = document.querySelectorAll('.mode-btn');
  const netStatus = document.getElementById('netStatus');

  let currentStyle = 'classic';
  let currentMode = 'en-zh';

  function setOutputEmpty(text) {
    output.innerHTML = `<div class="empty-hint">${escapeHtml(text)}</div>`;
  }

  function emptyTextForMode(mode) {
    return mode === 'zh-en' ? '输入中文后点击“排版”' : '输入英文后点击“排版”';
  }

  function placeholderForMode(mode) {
    return mode === 'zh-en'
      ? '在此粘贴中文文本，点击排版后翻转查看英文释义。'
      : '在此粘贴英文文本，点击排版后翻转查看中文释义。';
  }

  async function formatText() {
    const text = textInput.value;
    if (!text.trim()) return;

    formatBtn.disabled = true;
    formatBtn.textContent = currentMode === 'zh-en' ? '分词中...' : '排版中...';
    setOutputEmpty(currentMode === 'zh-en' ? '正在拆分中文文本...' : '正在排版...');

    try {
      const tokens = currentMode === 'zh-en'
        ? tokenizeChinese(text)
        : tokenizeEnglish(text);
      const { html, pendingWords } = renderTokens(tokens, currentMode);

      output.innerHTML = `<div class="output-content">${html}</div>`;
      output.dataset.mode = currentMode;
      fillMissingTranslations(output, pendingWords, currentMode);
    } catch (err) {
      console.error('[App] Failed to format text:', err);
      setOutputEmpty('排版失败，请稍后再试。');
    } finally {
      formatBtn.disabled = false;
      formatBtn.textContent = '排版';
    }
  }

  function updateMode(mode) {
    currentMode = mode;
    modeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
    textInput.placeholder = placeholderForMode(mode);
    setOutputEmpty(emptyTextForMode(mode));
  }

  formatBtn.addEventListener('click', formatText);
  textInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      formatText();
    }
  });

  clearBtn.addEventListener('click', () => {
    textInput.value = '';
    setOutputEmpty(emptyTextForMode(currentMode));
    textInput.focus();
  });

  styleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentStyle = btn.dataset.style;
      styleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      output.className = 'output ' + currentStyle;
    });
  });

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => updateMode(btn.dataset.mode));
  });

  output.addEventListener('click', e => {
    const word = e.target.closest('.word');
    if (!word) return;

    word.classList.toggle('flipped');

    if (word.dataset.state === 'pending' || word.dataset.state === 'error') {
      const sameWords = [...output.querySelectorAll('.word[data-word]')]
        .filter(item => item.dataset.word === word.dataset.word);
      lookupWord(sameWords, word.dataset.word, currentMode);
    }
  });

  function updateNetStatus() {
    netStatus.textContent = navigator.onLine ? 'Google 在线翻译' : '离线不可翻译';
    netStatus.className = 'net-status ' + (navigator.onLine ? 'online' : 'offline');
  }

  window.addEventListener('online', updateNetStatus);
  window.addEventListener('offline', updateNetStatus);
  updateNetStatus();
  updateMode(currentMode);
});
