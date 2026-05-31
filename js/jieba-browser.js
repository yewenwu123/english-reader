(function () {
  'use strict';

  const DICT_URL = 'js/jieba-dict.txt';
  let readyPromise = null;
  let trie = {};
  let freq = {};
  let minFreq = 0;

  function parseDict(text) {
    return text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const parts = line.split(/\s+/);
        return [parts[0], Number.parseInt(parts[1], 10) || 1];
      });
  }

  function buildTrie(dictionary) {
    trie = {};
    freq = {};
    let total = 0;

    dictionary.forEach(([word, count]) => {
      freq[word] = count;
      total += count;
      let node = trie;
      for (const char of word) {
        node[char] = node[char] || {};
        node = node[char];
      }
      node.$ = count;
    });

    minFreq = Infinity;
    Object.keys(freq).forEach(word => {
      freq[word] = Math.log(freq[word] / total);
      if (freq[word] < minFreq) minFreq = freq[word];
    });
  }

  function getDag(sentence) {
    const dag = {};
    for (let i = 0; i < sentence.length; i++) {
      let node = trie;
      for (let j = i; j < sentence.length; j++) {
        const char = sentence[j];
        if (!node[char]) break;
        node = node[char];
        if (node.$) {
          dag[i] = dag[i] || [];
          dag[i].push(j);
        }
      }
      if (!dag[i]) dag[i] = [i];
    }
    return dag;
  }

  function calcRoute(sentence, dag) {
    const route = {};
    route[sentence.length] = [0, 0];

    for (let i = sentence.length - 1; i >= 0; i--) {
      let bestScore = -Infinity;
      let bestEnd = i;

      dag[i].forEach(end => {
        const word = sentence.slice(i, end + 1);
        const score = (freq[word] || minFreq) + route[end + 1][0];
        if (score > bestScore) {
          bestScore = score;
          bestEnd = end;
        }
      });

      route[i] = [bestScore, bestEnd];
    }

    return route;
  }

  function cutBlock(sentence) {
    const dag = getDag(sentence);
    const route = calcRoute(sentence, dag);
    const words = [];
    let i = 0;
    let asciiBuffer = '';

    while (i < sentence.length) {
      const end = route[i][1] + 1;
      const word = sentence.slice(i, end);
      if (/^[a-zA-Z0-9]$/.test(word)) {
        asciiBuffer += word;
      } else {
        if (asciiBuffer) {
          words.push(asciiBuffer);
          asciiBuffer = '';
        }
        words.push(word);
      }
      i = end;
    }

    if (asciiBuffer) words.push(asciiBuffer);
    return words;
  }

  function cut(sentence) {
    const parts = sentence.split(/([\u4e00-\u9fa5a-zA-Z0-9+#&._]+)/);
    const words = [];

    parts.forEach(part => {
      if (!part) return;
      if (/^[\u4e00-\u9fa5a-zA-Z0-9+#&._]+$/.test(part)) {
        words.push(...cutBlock(part));
      } else {
        words.push(part);
      }
    });

    return words;
  }

  function init() {
    if (!readyPromise) {
      readyPromise = fetch(DICT_URL)
        .then(res => {
          if (!res.ok) throw new Error('Failed to load jieba dictionary');
          return res.text();
        })
        .then(text => {
          buildTrie(parseDict(text));
          return true;
        })
        .catch(err => {
          console.error('[Jieba] Failed to initialize:', err);
          buildTrie([]);
          return false;
        });
    }
    return readyPromise;
  }

  window.JIEBA_BROWSER = {
    init,
    cut: sentence => init().then(() => cut(sentence)),
    cutSync: cut,
  };
})();
