// ================================================
// CRV — Número no ícone do app (Badging API)
// js/badge-app.js
//
// Com o portal aberto, mostra no ícone o total real de pendências
// (assinaturas, cadastros, avisos e mensagens não lidas). O total também
// é guardado no IndexedDB, para que o service worker (OneSignalSDKWorker.js)
// continue somando +1 a cada push que chegar com o portal fechado.
// Funciona no iPhone (app na Tela de Início, iOS 16.4+) e no Android/computador
// com o portal instalado como app.
// ================================================
const _partes = {};   // { notificacoes: n, mensagens: n }

function _gravarTotal(total) {
  try {
    const req = indexedDB.open('crv-badge', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => {
      const tx = req.result.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(total, 'total');
      tx.oncomplete = () => req.result.close();
    };
  } catch (_) { /* sem IndexedDB: o ícone só acompanha com o portal aberto */ }
}

/** parte: 'notificacoes' | 'mensagens'; n: quantidade pendente dessa parte */
export function definirContador(parte, n) {
  _partes[parte] = Math.max(0, n | 0);
  const total = Object.values(_partes).reduce((a, b) => a + b, 0);
  try {
    if (total > 0 && navigator.setAppBadge) navigator.setAppBadge(total).catch(() => {});
    else if (navigator.clearAppBadge)       navigator.clearAppBadge().catch(() => {});
  } catch (_) {}
  _gravarTotal(total);
}

/** Ao sair: zera o ícone */
export function limparContador() {
  Object.keys(_partes).forEach(k => { _partes[k] = 0; });
  definirContador('notificacoes', 0);
}
