/* ============================================================
   HISTÓRICO — salva e recupera PADs gerados
   Salvo ao exportar. Permite pesquisa futura.
   ============================================================ */

var _HIST_KEY = 'pad_historico';
var _HIST_MAX = 30;

function _histCarregar() {
  try { return JSON.parse(localStorage.getItem(_HIST_KEY)) || []; } catch(e) { return []; }
}
function _histSalvar(lista) {
  try { localStorage.setItem(_HIST_KEY, JSON.stringify(lista)); } catch(e) {}
}

function salvarNoHistorico() {
  var s   = Estado.get();
  var inc = s.incidentado || {};
  var inf = s.infracao    || {};
  var dec = s.decisao     || {};

  if (!inc.nome && !s.numPad) return;

  var agora   = new Date();
  var dataStr = agora.getDate() + '/' + (agora.getMonth()+1) + '/' + agora.getFullYear()
              + ' ' + String(agora.getHours()).padStart(2,'0') + ':' + String(agora.getMinutes()).padStart(2,'0');

  var resultado = dec.resultado || '';

  var entrada = {
    ts:           agora.getTime(),
    data:         dataStr,
    numPad:       s.numPad        || '',
    nome:         inc.nome        || '',
    prontuario:   inc.prontuario  || '',
    ipen:         inc.ipen        || '',
    dataInfracao: fmtData(inf.data)  || '',
    dataInst:     fmtData(s.dataInst) || '',
    artigo:       inf.artigo      || '',
    resultado:    resultado,
    unidade:      (s.unidade && s.unidade.nome) || '',
    estado:       JSON.parse(JSON.stringify(s)),
  };

  var lista = _histCarregar();
  lista.unshift(entrada);
  if (lista.length > _HIST_MAX) lista = lista.slice(0, _HIST_MAX);
  _histSalvar(lista);
}

/* ── Modal Histórico ── */
function abrirHistorico() {
  _renderizarLista();
  document.getElementById('mhistBg').classList.add('open');
}
function fecharHistorico() { document.getElementById('mhistBg').classList.remove('open'); }

var _histFiltro = '';

function _renderizarLista() {
  var lista = _histCarregar();
  var ul    = document.getElementById('mhistLista');
  var info  = document.getElementById('mhistInfo');
  if (info) info.textContent = lista.length + ' de ' + _HIST_MAX + ' PADs salvos';

  /* Filtra */
  if (_histFiltro) {
    var f = _histFiltro.toLowerCase();
    lista = lista.filter(function(it) {
      return (it.numPad     || '').toLowerCase().includes(f)
          || (it.nome       || '').toLowerCase().includes(f)
          || (it.prontuario || '').toLowerCase().includes(f)
          || (it.artigo     || '').toLowerCase().includes(f)
          || (it.resultado  || '').toLowerCase().includes(f);
    });
  }

  if (!lista.length) {
    ul.innerHTML = '<div class="mhist-vazio">Nenhum PAD encontrado.</div>';
    return;
  }

  var _RESULTADO = { absolvicao: 'Absolvição', desclassificacao: 'Desclassificação', falta_grave: 'Falta Grave' };

  ul.innerHTML = lista.map(function(it, i) {
    var res = _RESULTADO[it.resultado] || it.resultado || '—';
    var cor = it.resultado === 'falta_grave' ? '#dc2626' : it.resultado === 'absolvicao' ? '#166534' : '#92400e';
    return '<div class="mhist-item">'
      + '<div class="mhist-info">'
        + '<div class="mhist-titulo">' + _esc(it.numPad || '(sem número)') + ' · ' + _esc(it.nome || '(sem nome)') + '</div>'
        + '<div class="mhist-sub">'
          + _esc(it.dataInfracao ? 'Infração: ' + it.dataInfracao : '')
          + (it.dataInst ? ' · Instauração: ' + _esc(it.dataInst) : '')
          + (it.artigo   ? ' · ' + _esc(it.artigo) : '')
        + '</div>'
        + '<div class="mhist-sub" style="color:' + cor + ';font-weight:700;">' + _esc(res) + ' · ' + _esc(it.data) + '</div>'
      + '</div>'
      + '<div class="mhist-acoes">'
        + '<button class="mhist-btn mhist-btn-reusar" onclick="_histReutilizar(' + i + ')">🔄 Reutilizar</button>'
        + '<button class="mhist-del" onclick="_histExcluir(' + i + ')" title="Excluir">✕</button>'
      + '</div>'
      + '</div>';
  }).join('');
}

function _histReutilizar(idx) {
  var lista = _histCarregar();
  if (_histFiltro) {
    var f = _histFiltro.toLowerCase();
    lista = lista.filter(function(it) {
      return (it.numPad||'').toLowerCase().includes(f)
          || (it.nome  ||'').toLowerCase().includes(f)
          || (it.prontuario||'').toLowerCase().includes(f);
    });
  }
  var item = lista[idx];
  if (!item || !item.estado) { _toast('Dados indisponíveis.'); return; }
  if (!confirm('Reutilizar substituirá os dados atuais. Deseja continuar?')) return;
  Estado.carregar(item.estado);
  fecharHistorico();
  FormularioCtrl.sincronizar();
  _toast('Formulário preenchido com o PAD selecionado.');
}

function _histExcluir(idx) {
  var lista = _histCarregar();
  lista.splice(idx, 1);
  _histSalvar(lista);
  _renderizarLista();
}

function _histLimpar() {
  if (!confirm('Limpar todo o histórico? Esta ação não pode ser desfeita.')) return;
  _histSalvar([]);
  _renderizarLista();
}
