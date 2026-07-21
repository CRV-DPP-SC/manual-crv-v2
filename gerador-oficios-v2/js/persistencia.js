/* ============================================================
   PERSISTÊNCIA — preferências e overrides de unidades
   ============================================================ */

function _prefsCarregar() {
  try { return JSON.parse(localStorage.getItem('crv_prefs') || '{}'); } catch(e) { return {}; }
}
function _prefsSalvar(k, v) {
  var p = _prefsCarregar(); p[k] = v;
  try { localStorage.setItem('crv_prefs', JSON.stringify(p)); } catch(e) {}
}

/* Retorna array de unidades (dados oficiais, já sincronizados com o Firestore por firebase-v2.js) */
function getUns() {
  return UNS.slice();
}

/* Próximo número de ofício sugerido */
function _sugerirNumOficio() {
  var prefs = _prefsCarregar();
  return _proximoNumOficio(prefs.ultimoNumOficio || '');
}

/* Recentes de unidades (últimas 6 selecionadas) */
function _adicionarRecente(u) {
  var prefs = _prefsCarregar();
  var rec = prefs.recentesUnidades || [];
  rec = rec.filter(function(r) { return r.n !== u.n; });
  rec.unshift(u);
  if (rec.length > 6) rec = rec.slice(0, 6);
  _prefsSalvar('recentesUnidades', rec);
}

