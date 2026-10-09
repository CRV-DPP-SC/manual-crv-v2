importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

// ── Número no ícone do app (iPhone/Android instalado) ──
// O OneSignal mostra a notificação; aqui só somamos +1 no ícone.
// Com o portal aberto, js/badge-app.js corrige para o total real.
function _crvBadgeDb() {
  return new Promise((ok, erro) => {
    const req = indexedDB.open('crv-badge', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error);
  });
}

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    try {
      const db = await _crvBadgeDb();
      const total = await new Promise(ok => {
        const r = db.transaction('kv').objectStore('kv').get('total');
        r.onsuccess = () => ok((r.result | 0) + 1);
        r.onerror = () => ok(1);
      });
      await new Promise(ok => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(total, 'total');
        tx.oncomplete = ok; tx.onerror = ok;
      });
      db.close();
      if (self.navigator.setAppBadge) await self.navigator.setAppBadge(total);
    } catch (_) { /* sem suporte a badge: segue só com a notificação */ }
  })());
});
