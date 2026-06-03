/* ============================================================
   MODAL SELETOR DE UNIDADE
   ============================================================ */

var _umAlvo    = null; /* 'ori' | 'des' */
var _umFiltroSR = 'TODOS';

function abrirModalUnidade(alvo) {
  _umAlvo     = alvo;
  _umFiltroSR = 'TODOS';
  document.getElementById('umSearch').value = '';
  _renderizarUnidades();
  document.getElementById('umBg').classList.add('open');
  document.getElementById('umSearch').focus();
}

function fecharModalUnidade() {
  document.getElementById('umBg').classList.remove('open');
}

function _renderizarUnidades() {
  var q   = (document.getElementById('umSearch').value || '').toLowerCase().trim();
  var uns = getUns();
  var prefs = _prefsCarregar();
  var recentes = prefs.recentesUnidades || [];

  /* Filtro SR */
  var lista = uns.filter(function(u) {
    if (_umFiltroSR !== 'TODOS' && u.sr !== _umFiltroSR) return false;
    if (!q) return true;
    return u.n.toLowerCase().includes(q) || u.c.toLowerCase().includes(q);
  });

  /* Tabs SR */
  var srs = ['TODOS','SR01','SR02','SR03','SR04','SR05','SR06','SR07','SR08'];
  document.getElementById('umTabs').innerHTML = srs.map(function(sr) {
    return '<button class="tab-sr' + (sr === _umFiltroSR ? ' at' : '') + '" onclick="_umSetSR(\'' + sr + '\')">' + sr + '</button>';
  }).join('');

  /* Lista */
  var ul = document.getElementById('umList');
  var html = '';

  /* Recentes no topo (apenas quando sem filtro de texto/SR) */
  if (!q && _umFiltroSR === 'TODOS' && recentes.length > 0) {
    html += '<div class="um-section-label">Recentes</div>';
    recentes.slice(0, 4).forEach(function(u) {
      html += _umItem(u);
    });
    html += '<div class="um-section-label">Todas as unidades</div>';
  }

  if (lista.length === 0) {
    html += '<div class="um-vazio">Nenhuma unidade encontrada.</div>';
  } else {
    lista.forEach(function(u) { html += _umItem(u); });
  }

  ul.innerHTML = html;
}

function _umItem(u) {
  var json = _esc(JSON.stringify(u));
  return '<div class="un-item" onclick="_umSelecionar(\'' + _esc(u.em) + '\')">'
    + '<div>'
      + '<div class="un-item-n">' + _esc(u.n) + '</div>'
      + '<div class="un-item-c">' + _esc(u.c) + ' · ' + _esc(u.dir) + '</div>'
    + '</div>'
    + '<span class="un-item-sr">' + _esc(u.sr) + '</span>'
    + '</div>';
}

function _umSelecionar(email) {
  var u = getUns().find(function(x) { return x.em === email; });
  if (!u || !_umAlvo) return;
  Estado.set(_umAlvo, u);
  _adicionarRecente(u);
  if (_umAlvo === 'ori') _prefsSalvar('ultimaOri', u);
  if (_umAlvo === 'des') _prefsSalvar('ultimaDes', u);
  fecharModalUnidade();
  FormularioCtrl.atualizarCampoUnidade(_umAlvo, u);
}

function _umSetSR(sr) {
  _umFiltroSR = sr;
  _renderizarUnidades();
}
