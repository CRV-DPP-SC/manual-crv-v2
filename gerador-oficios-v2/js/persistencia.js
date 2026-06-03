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

function _unsOvCarregar() {
  try { return JSON.parse(localStorage.getItem('crv_uns_overrides') || '{}'); } catch(e) { return {}; }
}
function _unsOvSalvar(ov) {
  try { localStorage.setItem('crv_uns_overrides', JSON.stringify(ov)); } catch(e) { _toast('Não foi possível salvar.'); }
}

/* Retorna array de unidades com overrides aplicados */
function getUns() {
  var ov = _unsOvCarregar();
  return UNS.map(function(u, i) { return ov[i] ? Object.assign({}, u, ov[i]) : u; });
}

/* Salva override de uma unidade e atualiza o estado se ela estiver em uso */
function salvarUnidade(i, dados) {
  var ov = _unsOvCarregar();
  ov[i] = dados;
  _unsOvSalvar(ov);
  _toast('Dados salvos com sucesso!');
  var s = Estado.get();
  if (s.ori && UNS.indexOf(UNS.find(function(u){ return u.em === (s.ori && s.ori.em); })) === i) {
    Estado.set('ori', getUns()[i]);
  }
  if (s.des && UNS.indexOf(UNS.find(function(u){ return u.em === (s.des && s.des.em); })) === i) {
    Estado.set('des', getUns()[i]);
  }
}

/* Restaura unidade ao padrão original */
function restaurarUnidade(i) {
  var ov = _unsOvCarregar();
  delete ov[i];
  _unsOvSalvar(ov);
  _toast('Dados restaurados ao padrão.');
  var s = Estado.get();
  if (s.ori && UNS.indexOf(UNS.find(function(u){ return u.em === (s.ori && s.ori.em); })) === i) {
    Estado.set('ori', getUns()[i]);
  }
  if (s.des && UNS.indexOf(UNS.find(function(u){ return u.em === (s.des && s.des.em); })) === i) {
    Estado.set('des', getUns()[i]);
  }
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

