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

/* Salva override de uma unidade */
function salvarUnidade(i) {
  var ov = _unsOvCarregar();
  ov[i] = {
    dir: document.getElementById('mcf_dir_' + i).value,
    cg:  document.getElementById('mcf_cg_' + i).value,
    em:  document.getElementById('mcf_em_' + i).value,
    tel: document.getElementById('mcf_tel_' + i).value,
    e:   document.getElementById('mcf_e_' + i).value,
  };
  _unsOvSalvar(ov);
  _toast('Dados salvos com sucesso!');
  _renderizarCadastro();
  /* Atualiza ori/des no estado se a unidade editada estiver selecionada */
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
  _renderizarCadastro();
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

/* ── Módulo Cadastro de Unidades ── */
var _mcadAberto = -1;

function abrirCadastroUnidades() {
  _mcadAberto = -1;
  document.getElementById('mcadQ').value = '';
  _renderizarCadastro();
  document.getElementById('mcadBg').classList.add('open');
}

function fecharCadastroUnidades() {
  document.getElementById('mcadBg').classList.remove('open');
}

function _renderizarCadastro() {
  var q   = (document.getElementById('mcadQ').value || '').toLowerCase();
  var lista = document.getElementById('mcadLista');
  var ov  = _unsOvCarregar();
  lista.innerHTML = '';

  getUns().forEach(function(u, i) {
    if (q && !u.n.toLowerCase().includes(q) && !u.c.toLowerCase().includes(q)) return;
    var temOv = !!ov[i];
    var item = document.createElement('div'); item.className = 'mcad-item';

    var aberto = (_mcadAberto === i);
    item.innerHTML =
      '<div class="mcad-item-head" onclick="_toggleCad(' + i + ')">'
        + '<div class="mcad-item-info">'
          + '<div class="mcad-item-n">' + _esc(u.n) + '</div>'
          + '<div class="mcad-item-sub">' + _esc(u.cg || 'Diretor(a)') + ': ' + _esc(u.dir) + '</div>'
        + '</div>'
        + '<div class="mcad-badges">'
          + (temOv ? '<span class="mcad-badge-edit">✏ Editado</span>' : '')
          + '<span class="mcad-badge-sr">' + _esc(u.sr) + '</span>'
          + '<span class="mcad-chevron">' + (aberto ? '▲' : '▼') + '</span>'
        + '</div>'
      + '</div>'
      + '<div class="mcad-form' + (aberto ? ' open' : '') + '">'
        + '<div class="mcad-row2">'
          + '<div><label>Diretor(a)</label><input id="mcf_dir_' + i + '" value="' + _esc(u.dir) + '"></div>'
          + '<div><label>Cargo</label><input id="mcf_cg_' + i + '" value="' + _esc(u.cg) + '"></div>'
        + '</div>'
        + '<div class="mcad-row2">'
          + '<div><label>E-mail</label><input id="mcf_em_' + i + '" value="' + _esc(u.em) + '"></div>'
          + '<div><label>Telefone</label><input id="mcf_tel_' + i + '" value="' + _esc(u.tel) + '"></div>'
        + '</div>'
        + '<div><label>Endereço</label><input id="mcf_e_' + i + '" value="' + _esc(u.e) + '"></div>'
        + '<div class="mcad-form-btns">'
          + (temOv ? '<button class="mcad-btn-restore" onclick="restaurarUnidade(' + i + ')">↺ Restaurar padrão</button>' : '')
          + '<button class="mcad-btn-save" onclick="salvarUnidade(' + i + ')">✓ Salvar alterações</button>'
        + '</div>'
      + '</div>';
    lista.appendChild(item);
  });
}

function _toggleCad(i) {
  _mcadAberto = (_mcadAberto === i) ? -1 : i;
  _renderizarCadastro();
  if (_mcadAberto >= 0) {
    setTimeout(function() {
      var el = document.querySelector('.mcad-form.open');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 80);
  }
}
