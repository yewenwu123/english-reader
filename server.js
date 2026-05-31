const fs = require('fs');
const http = require('http');
const path = require('path');

const root = __dirname;
const port = Number(process.env.PORT || 8000);
const requestTimeoutMs = 10000;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.db': 'application/octet-stream',
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data), 'application/json; charset=utf-8');
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

async function translateWithGoogle(text, source, target) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  const params = new URLSearchParams({
    client: 'gtx',
    dt: 't',
    sl: source,
    tl: target,
    q: text,
  });

  try {
    const response = await fetch(
      'https://translate.googleapis.com/translate_a/single?' + params.toString(),
      { signal: controller.signal },
    );

    if (!response.ok) {
      throw new Error('Google Translate request failed: ' + response.status);
    }

    return parseGoogleResult(await response.json());
  } finally {
    clearTimeout(timer);
  }
}

async function handleTranslateApi(url, res) {
  const text = url.searchParams.get('q') || '';
  const source = url.searchParams.get('sl') || 'auto';
  const target = url.searchParams.get('tl') || 'zh-CN';

  if (!text.trim()) {
    sendJson(res, 400, { error: 'Missing q' });
    return;
  }

  try {
    const translation = await translateWithGoogle(text, source, target);
    if (!translation) {
      sendJson(res, 502, { error: 'Empty translation' });
      return;
    }

    sendJson(res, 200, { translation });
  } catch (error) {
    console.error('[Translate] Google request failed:', error.message);
    sendJson(res, 502, { error: 'Google translation failed' });
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);

  if (url.pathname === '/api/translate') {
    handleTranslateApi(url, res);
    return;
  }

  const requestedPath = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(root, requestedPath));

  if (!filePath.startsWith(root)) {
    send(res, 403, 'Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, 'Not found');
      return;
    }

    const type = mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    send(res, 200, data, type);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`双语翻转阅读器已启动：http://127.0.0.1:${port}/index.html`);
  console.log('关闭这个窗口即可停止服务。');
});
