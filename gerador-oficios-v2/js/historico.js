/* ============================================================
   HISTÓRICO — salva e recupera ofícios gerados
   Salvo apenas ao exportar (Copiar / .doc / PDF).
   ============================================================ */

var _MODAL_LABEL = {
  emergencial:'Emergencial', mandado:'Mandado de Comarca',
  pernoite:'Pernoite', adequacao:'Transferências Ordinárias',
  ajuste_lotacional:'Ajuste Lotacional',
  permuta:'Permuta', prisaocivil:'Prisão Civil',
  comunicacao:'Comunicação', resumo_ipen:'Resumo IPEN',
};

function _histCarregar() {
  try { return JSON.parse(localStorage.getItem('crv_historico_oficios')) || []; } catch(e) { return []; }
}
function _histSalvar(lista) {
  try { localStorage.setItem('crv_historico_oficios', JSON.stringify(lista)); } catch(e) {}
}

function _histMontarTitulo(s, dataStr) {
  var label = _MODAL_LABEL[s.mod] || s.mod || 'Ofício';
  var num   = s.numOficio ? ' · nº ' + s.numOficio : '';
  var ori   = s.ori ? s.ori.n : '';
  var des   = s.des ? s.des.n : '';
  var rota  = (ori && des) ? ori + ' → ' + des : ori || des || '';
  return label + num + ' · ' + dataStr + (rota ? '\n' + rota : '');
}

/* Salva o ofício atual no histórico (chamado ao exportar) */
function salvarNoHistorico() {
  var el = document.getElementById('oficio-preview');
  if (!el || !el.innerHTML.trim()) return;
  var s = Estado.get();
  if (!s.mod) return;

  var agora  = new Date();
  var dataStr = agora.getDate() + '/' + (agora.getMonth() + 1) + '/' + agora.getFullYear()
    + ' ' + String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');

  var entrada = {
    ts: agora.getTime(),
    data: dataStr,
    titulo: _histMontarTitulo(s, dataStr),
    modalidade: _MODAL_LABEL[s.mod] || s.mod || 'Ofício',
    numOficio: s.numOficio || '',
    oriNome: s.ori ? s.ori.n : '',
    desNome: s.des ? s.des.n : '',
    html: el.innerHTML,
    estado: JSON.parse(JSON.stringify(s)),
  };

  var lista = _histCarregar();
  lista.unshift(entrada);
  if (lista.length > 20) lista = lista.slice(0, 20);
  _histSalvar(lista);
}

/* ── Modal Histórico ── */
function abrirHistorico() {
  _renderizarListaHistorico();
  document.getElementById('mhistBg').classList.add('open');
}
function fecharHistorico() { document.getElementById('mhistBg').classList.remove('open'); }

function _renderizarListaHistorico() {
  var lista = _histCarregar();
  var ul    = document.getElementById('mhistLista');
  var info  = document.getElementById('mhistInfo');

  if (info) info.textContent = lista.length + ' de 20 ofícios salvos';

  if (lista.length === 0) {
    ul.innerHTML = '<div class="mhist-vazio">Nenhum ofício salvo ainda.<br>O histórico é salvo automaticamente ao exportar.</div>';
    return;
  }

  ul.innerHTML = lista.map(function(item, i) {
    var titulo = item.titulo || item.modalidade || 'Ofício';
    var linhas = titulo.split('\n');
    var l1 = linhas[0] || '';
    var l2 = linhas[1] || '';
    return '<div class="mhist-item">'
      + '<div class="mhist-info">'
        + '<div class="mhist-titulo">' + _esc(l1) + '</div>'
        + (l2 ? '<div class="mhist-sub">' + _esc(l2) + '</div>' : '')
      + '</div>'
      + '<div class="mhist-acoes">'
        + '<button class="mhist-btn" onclick="_histVisualizar(' + i + ')">👁 Visualizar</button>'
        + '<button class="mhist-btn mhist-btn-reusar" onclick="_histReutilizar(' + i + ')">🔄 Reutilizar</button>'
        + '<button class="mhist-del" onclick="_histExcluir(' + i + ')" title="Excluir">✕</button>'
      + '</div>'
      + '</div>';
  }).join('');
}

function _histVisualizar(idx) {
  var lista = _histCarregar();
  var item  = lista[idx];
  if (!item) return;
  document.getElementById('histOficioPreview').innerHTML = item.html || '';
  document.getElementById('mhistViewTitulo').textContent = (item.titulo || 'Ofício').split('\n')[0];
  document.getElementById('mhistViewBg').classList.add('open');
}

function _histReutilizar(idx) {
  var lista = _histCarregar();
  var item  = lista[idx];
  if (!item || !item.estado) { _toast('Dados do ofício não disponíveis para reutilização.'); return; }
  if (!confirm('Reutilizar este ofício substituirá os dados atuais do formulário. Deseja continuar?')) return;
  Estado.carregar(item.estado);
  fecharHistorico();
  document.getElementById('mhistViewBg').classList.remove('open');
  _toast('Formulário preenchido com os dados do ofício selecionado.');
  FormularioCtrl.sincronizar();
}

function _histExcluir(idx) {
  var lista = _histCarregar();
  lista.splice(idx, 1);
  _histSalvar(lista);
  _renderizarListaHistorico();
}

function _histLimpar() {
  if (!confirm('Limpar todo o histórico? Esta ação não pode ser desfeita.')) return;
  _histSalvar([]);
  _renderizarListaHistorico();
}
