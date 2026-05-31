/**
 * SQLite dictionary loader using sql.js
 * Loads stardict_light.db in a background Web Worker.
 * Falls back to DICT (dict_full.js) while DB loads or if word not found.
 */
(function () {
  'use strict';

  let dbReady = false;
  let dbQueue = []; // queries queued before DB loaded
  let db = null;

  const DB_URL = 'js/stardict_light.db';

  // Track ready state
  window.__dbReady = false;

  function init() {
    // Load sql.js
    initSqlJs({
      locateFile: file => 'js/' + file
    }).then(SQL => {
      // Fetch the database file
      fetch(DB_URL)
        .then(res => res.arrayBuffer())
        .then(buffer => {
          const u8 = new Uint8Array(buffer);
          db = new SQL.Database(u8);
          dbReady = true;
          window.__dbReady = true;

          // Process queued queries
          const q = dbQueue;
          dbQueue = null;
          q.forEach(({ word, cb }) => {
            lookupFromDb(word, cb);
          });

          console.log('[DB] Dictionary database loaded (' + u8.length + ' bytes)');
        })
        .catch(err => {
          console.error('[DB] Failed to load database:', err);
          // DB failed, drain queue with null results
          const q = dbQueue;
          dbQueue = null;
          q.forEach(({ cb }) => cb(null));
        });
    }).catch(err => {
      console.error('[DB] Failed to init sql.js:', err);
    });
  }

  function lookupFromDb(word, callback) {
    if (!db) {
      // Queue until DB is ready
      if (dbQueue) {
        dbQueue.push({ word, cb: callback });
      } else {
        callback(null);
      }
      return;
    }
    try {
      const stmt = db.prepare('SELECT trans FROM dict WHERE word = ?');
      stmt.bind([word]);
      if (stmt.step()) {
        const trans = stmt.getAsObject().trans;
        callback(trans || null);
      } else {
        callback(null);
      }
      stmt.free();
    } catch (e) {
      console.error('[DB] Query error for "' + word + '":', e);
      callback(null);
    }
  }

  // Expose public API
  window.DB_LOOKUP = {
    ready: function () { return dbReady; },
    lookup: function (word, callback) {
      lookupFromDb(word, callback);
    },
  };

  // Start loading
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
