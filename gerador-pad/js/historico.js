/* ============================================================
   HISTÓRICO — salva e recupera PADs gerados
   ============================================================ */

var _HIST_KEY = 'pad_historico';
var _HIST_MAX = 30;

function _histCarregar() {
  try { return JSON.parse(localStorage.getItem(_HIST_KEY)) || []; } catch(e) { return []; }
}
function _histSalvar(lista) {
  try { localStorage.setItem(_HIST_KEY, JSON.stringify(lista)); } catch(e) {}
}

/* ── Cadastra PAD imediatamente com status "em andamento" ── */
function cadastrarPadNoHistorico() {
  var s   = Estado.get();
  var inc = s.incidentado || {};
  var inf = s.infracao    || {};

  var padId = Date.now();
  var agora = new Date();
  var dataStr = agora.getDate() + '/' + (agora.getMonth()+1) + '/' + agora.getFullYear()
              + ' ' + String(agora.getHours()).padStart(2,'0') + ':' + String(agora.getMinutes()).padStart(2,'0');

  var entrada = {
    padId:        padId,
    ts:           agora.getTime(),
    data:         dataStr,
    numPad:       s.numPad          || '',
    nome:         inc.nome          || '',
    prontuario:   inc.prontuario    || '',
    ipen:         inc.ipen          || '',
    dataInfracao: fmtData(inf.data)  || '',
    dataInst:     fmtData(s.dataInst) || '',
    artigo:       inf.artigo        || '',
    resultado:    '',
    status:       'em_andamento',
    unidade:      (s.unidade && s.unidade.nome) || '',
    estado:       JSON.parse(JSON.stringify(s)),
  };

  var lista = _histCarregar();
  lista.unshift(entrada);
  if (lista.length > _HIST_MAX) lista = lista.slice(0, _HIST_MAX);
  _histSalvar(lista);
  return padId;
}

/* ── Atualiza entrada existente a cada mudança no formulário ── */
function atualizarPadHistorico(padId, s) {
  if (!padId) return;
  var lista = _histCarregar();
  var idx = -1;
  for (var i = 0; i < lista.length; i++) {
    if (lista[i].padId === padId) { idx = i; break; }
  }
  if (idx < 0) return;

  var inc = s.incidentado || {};
  var inf = s.infracao    || {};
  var dec = s.decisao     || {};
  var resultado = dec.resultado || '';

  lista[idx].numPad       = s.numPad          || lista[idx].numPad;
  lista[idx].nome         = inc.nome           || lista[idx].nome;
  lista[idx].prontuario   = inc.prontuario     || lista[idx].prontuario;
  lista[idx].ipen         = inc.ipen           || lista[idx].ipen;
  lista[idx].dataInfracao = fmtData(inf.data)  || lista[idx].dataInfracao;
  lista[idx].dataInst     = fmtData(s.dataInst) || lista[idx].dataInst;
  lista[idx].artigo       = inf.artigo         || lista[idx].artigo;
  lista[idx].resultado    = resultado;
  lista[idx].status       = resultado ? 'concluido' : 'em_andamento';
  lista[idx].estado       = JSON.parse(JSON.stringify(s));
  _histSalvar(lista);
}

/* ── Salva ao exportar (atualiza entrada existente ou cria nova) ── */
function salvarNoHistorico(padId) {
  var s   = Estado.get();
  var inc = s.incidentado || {};
  var inf = s.infracao    || {};
  var dec = s.decisao     || {};

  if (!inc.nome && !s.numPad) return;

  var agora   = new Date();
  var dataStr = agora.getDate() + '/' + (agora.getMonth()+1) + '/' + agora.getFullYear()
              + ' ' + String(agora.getHours()).padStart(2,'0') + ':' + String(agora.getMinutes()).padStart(2,'0');

  var resultado = dec.resultado || '';
  var lista = _histCarregar();

  var entrada = null;

  if (padId) {
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].padId === padId) {
        lista[i].resultado = resultado;
        lista[i].status    = resultado ? 'concluido' : 'em_andamento';
        lista[i].estado    = JSON.parse(JSON.stringify(s));
        entrada = lista[i];
        _histSalvar(lista);
        break;
      }
    }
  }

  if (!entrada) {
    entrada = {
      padId:        padId || agora.getTime(),
      ts:           agora.getTime(),
      data:         dataStr,
      numPad:       s.numPad        || '',
      nome:         inc.nome        || '',
      prontuario:   inc.prontuario  || '',
      ipen:         inc.ipen        || '',
      dataInfracao: fmtData(inf.data)   || '',
      dataInst:     fmtData(s.dataInst)  || '',
      artigo:       inf.artigo      || '',
      resultado:    resultado,
      status:       resultado ? 'concluido' : 'em_andamento',
      unidade:      (s.unidade && s.unidade.nome) || '',
      estado:       JSON.parse(JSON.stringify(s)),
    };
    lista.unshift(entrada);
    if (lista.length > _HIST_MAX) lista = lista.slice(0, _HIST_MAX);
    _histSalvar(lista);
  }

  /* Espelha no Firestore */
  var emailUn = (s.unidade && s.unidade.email) || localStorage.getItem('crv_ori_email') || '';
  if (emailUn && window.PadFirestore) {
    window.PadFirestore.salvarRelacao(emailUn, entrada).catch(function() {});
  }
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
    var statusBadge = it.status === 'concluido'
      ? '<span style="background:#dcfce7;color:#166534;font-size:.68rem;font-weight:800;padding:2px 8px;border-radius:10px;">✅ Concluído</span>'
      : '<span style="background:#fef3c7;color:#92400e;font-size:.68rem;font-weight:800;padding:2px 8px;border-radius:10px;">⏳ Em andamento</span>';
    return '<div class="mhist-item">'
      + '<div class="mhist-info">'
        + '<div class="mhist-titulo">' + _esc(it.numPad || '(sem número)') + ' · ' + _esc(it.nome || '(sem nome)') + ' ' + statusBadge + '</div>'
        + '<div class="mhist-sub">'
          + _esc(it.dataInfracao ? 'Infração: ' + it.dataInfracao : '')
          + (it.dataInst ? ' · Instauração: ' + _esc(it.dataInst) : '')
          + (it.artigo   ? ' · ' + _esc(it.artigo) : '')
        + '</div>'
        + (it.resultado ? '<div class="mhist-sub" style="color:' + cor + ';font-weight:700;">' + _esc(res) + ' · ' + _esc(it.data) + '</div>' : '')
      + '</div>'
      + '<div class="mhist-acoes">'
        + '<button class="mhist-btn mhist-btn-reusar" onclick="_histReutilizar(' + i + ')">📂 Abrir</button>'
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
  window._padIdAtual = item.padId || null;
  Estado.carregar(item.estado);
  fecharHistorico();
  FormularioCtrl.sincronizar();
  _mostrarTela('formulario');
  atualizarPreview();
  _toast('PAD carregado!');
}

function _histExcluir(idx) {
  var lista = _histCarregar();
  lista.splice(idx, 1);
  _histSalvar(lista);
  _renderizarLista();
}

function _histLimpar() {
  /* confirm() bloqueado em iframe — usa modal customizado se disponível */
  if (typeof _abrirModalConfirma === 'function') {
    _abrirModalConfirma('Limpar todo o histórico local?', function() {
      _histSalvar([]);
      _renderizarLista();
    });
  } else {
    _histSalvar([]);
    _renderizarLista();
  }
}
