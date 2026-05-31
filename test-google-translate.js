const assert = require('assert');

async function translate(text, source, target) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t'
    + '&sl=' + encodeURIComponent(source)
    + '&tl=' + encodeURIComponent(target)
    + '&q=' + encodeURIComponent(text);

  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timer);

  assert.strictEqual(response.ok, true, `HTTP ${response.status}`);
  const data = await response.json();
  const translated = data[0]
    .map(part => Array.isArray(part) ? part[0] : '')
    .filter(Boolean)
    .join('')
    .trim();

  assert.ok(translated, 'Google returned an empty translation');
  return translated;
}

(async () => {
  const enToZh = await translate('hello world', 'en', 'zh-CN');
  const zhToEn = await translate('你好世界', 'zh-CN', 'en');

  console.log('en -> zh-CN:', enToZh);
  console.log('zh-CN -> en:', zhToEn);
  console.log('Google online translation test passed.');
})().catch(error => {
  console.error('Google online translation test failed.');
  console.error(error);
  process.exit(1);
});
