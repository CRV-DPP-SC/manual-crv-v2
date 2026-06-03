/* ============================================================
   APP — inicialização e orquestração geral
   ============================================================ */

/* ── Toast global ── */
var _toastTimer = null;
function _toast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function() { t.classList.remove('show'); }, 4000);
}

/* ── Modo edição inline do preview ── */
var _modoEdicao = false;
function toggleModoEditar() {
  _modoEdicao = !_modoEdicao;
  var ofw  = document.getElementById('oficio-preview');
  var btn  = document.getElementById('btnEditar');
  var banner = document.getElementById('editBanner');

  if (_modoEdicao) {
    ofw.querySelectorAll('.ofc-p,.ofc-sau,.ofc-desp,.ass-nome,.ass-cargo,.ass-dig,.dest-n,.dest-l,.dest-t,.rod-dpp,.rod-un,.rod-cont,.ofc-num,.ofc-data').forEach(function(el) {
      el.setAttribute('contenteditable', 'true');
    });
    if (btn)    btn.innerHTML    = '✓ Finalizar Edição';
    if (banner) banner.classList.add('vis');
    _toast('Modo edição ativo — clique nos textos do ofício para editar.');
  } else {
    ofw.querySelectorAll('[contenteditable]').forEach(function(el) { el.removeAttribute('contenteditable'); });
    if (btn)    btn.innerHTML    = '✏ Editar';
    if (banner) banner.classList.remove('vis');
    _toast('Edição finalizada.');
  }

  /* Alerta se o usuário tentar mudar um campo com edições pendentes */
  if (_modoEdicao) {
    Estado.onChange(_alertarEdicaoPendente);
  } else {
    Estado.offChange(_alertarEdicaoPendente);
  }
}

function _alertarEdicaoPendente() {
  if (!_modoEdicao) return;
  if (confirm('Alterar o formulário descartará as edições manuais no documento. Continuar?')) {
    _modoEdicao = false;
    toggleModoEditar(); /* desativa */
    toggleModoEditar(); /* reativa para reconstruir */
  }
}

/* ── Detecção de usuário logado → pré-preenche Unidade de Origem ── */
window._onV2AuthReady = function(user, unidade) {
  if (!unidade) return;
  if (Estado.get('ori')) return; /* já preenchida (ex.: pelo localStorage) */
  Estado.set('ori', unidade);
  _toast('Unidade de origem preenchida: ' + unidade.n);
  FormularioCtrl.sincronizar(); /* sempre re-renderiza */
};

/* ── Extrai lista de assinantes a partir do estado atual ── */
function _extrairAssinantes(s) {
  var lista = [];
  var o = s.ori, d = s.des;

  function _emailDir(u)  { return u.em.replace(/@pp\.sc\.gov\.br$/, 'dir@pp.sc.gov.br'); }
  function _emailSR(cod) { return cod.toLowerCase() + '@pp.sc.gov.br'; }

  if (o) lista.push({ email: _emailDir(o), nome: o.dir || o.n, cargo: o.cg || 'Diretor(a)', unidade: o.n, emailUnidade: o.em });
  if (s.dd && d) lista.push({ email: _emailDir(d), nome: d.dir || d.n, cargo: d.cg || 'Diretor(a)', unidade: d.n, emailUnidade: d.em });
  if (s.sro && o) {
    var srO = SR[o.sr];
    if (srO) lista.push({ email: _emailSR(o.sr), nome: srO.s, cargo: 'Superintendente Regional', unidade: srO.nome, emailUnidade: _emailSR(o.sr) });
  }
  if (s.srd && d) {
    var srD = SR[d.sr];
    if (srD) lista.push({ email: _emailSR(d.sr), nome: srD.s, cargo: 'Superintendente Regional', unidade: srD.nome, emailUnidade: _emailSR(d.sr) });
  }
  return lista;
}

/* ── Modal Solicitar Assinaturas ── */
var _assModalData = null;

async function abrirModalAssinaturas() {
  /* Aguarda Firebase resolver auth state (instantâneo se já resolvido, máx 5s) */
  if (window._v2AuthPending && window._v2AuthReady) {
    await Promise.race([
      window._v2AuthReady,
      new Promise(function(r) { setTimeout(r, 5000); })
    ]);
  }
  var s = Estado.get();
  var assinantes = _extrairAssinantes(s);
  var body = document.getElementById('assBody');
  var foot = document.getElementById('assFoot');

  if (!body) return;

  if (!s.ori) {
    body.innerHTML = '<p class="ass-modal-aviso">Selecione a unidade de origem antes de solicitar assinaturas.</p>';
    foot.innerHTML = '<button class="btn-acao btn-sec" onclick="fecharModalAssinaturas()">Fechar</button>';
    document.getElementById('assBg').classList.add('open');
    return;
  }

  var modNomes = { emergencial:'Transferência Emergencial', mandado:'Mandado de Comarca',
    pernoite:'Pernoite', adequacao:'Adequação da Capacidade', permuta:'Permuta', prisaocivil:'Prisão Civil' };
  var titulo = modNomes[s.mod] || 'Ofício';
  if (s.ori) titulo += ' — ' + s.ori.n;
  if (s.des) titulo += ' → ' + s.des.n;
  if (s.numOficio) titulo = s.numOficio + ' | ' + titulo;

  var listaHtml = assinantes.map(function(a) {
    return '<div class="ass-modal-item">'
      + '<div class="ass-modal-nome">' + _esc(a.nome) + '</div>'
      + '<div class="ass-modal-info">' + _esc(a.cargo) + ' · ' + _esc(a.unidade) + '</div>'
      + '<div class="ass-modal-email">' + _esc(a.email) + '</div>'
      + '</div>';
  }).join('');

  var usuario    = window._v2Usuario || window._usuarioAtual || null;
  var fnCriar    = window._v2CriarSolicitacaoAssinatura || window.criarSolicitacaoAssinatura || null;
  var logado     = !!usuario;
  var podeEnviar = logado && !!fnCriar;

  var aviso = '';
  if (!logado) {
    aviso = '<p class="ass-modal-aviso">Faça login para enviar a solicitação de assinaturas.</p>';
  } else if (!fnCriar) {
    aviso = '<p class="ass-modal-aviso">Acesse o Gerador a partir do Painel da Unidade para habilitar o envio.</p>';
  }

  body.innerHTML =
    '<div style="margin-bottom:14px;">'
      + '<div class="ass-modal-label">Ofício</div>'
      + '<div class="ass-modal-titulo">' + _esc(titulo) + '</div>'
    + '</div>'
    + '<div class="ass-modal-label">Assinantes (' + assinantes.length + ')</div>'
    + (assinantes.length > 0
        ? '<div class="ass-modal-list">' + listaHtml + '</div>'
        : '<p class="ass-modal-aviso">Nenhum assinante identificado. Verifique as unidades e a seção de assinaturas.</p>')
    + aviso;

  _assModalData = { titulo: titulo, assinantes: assinantes };

  foot.innerHTML = '<button class="btn-acao btn-sec" onclick="fecharModalAssinaturas()">Fechar</button>'
    + (podeEnviar && assinantes.length > 0
        ? '<button class="btn-acao btn-pri" id="btnEnviarAss" onclick="enviarSolicitacaoAssinatura()">✉ Enviar Solicitação</button>'
        : '');

  document.getElementById('assBg').classList.add('open');
}

function fecharModalAssinaturas() {
  document.getElementById('assBg').classList.remove('open');
}

async function enviarSolicitacaoAssinatura() {
  if (!_assModalData) return;
  var s = Estado.get();
  var conteudo = (document.getElementById('oficio-preview') || {}).innerHTML || '';
  var unidadeOrigem = s.ori ? s.ori.em : '';

  /* Extrai lista de presos do estado */
  var presos = [];
  if (s.reed && s.reed.length > 0) {
    presos = s.reed.map(function(r) { return { nome: r.nome || '', ipen: r.ipen || '' }; });
  } else if (s.nome) {
    presos = [{ nome: s.nome || '', ipen: s.ipen || '' }];
  }

  var fnCriar = window._v2CriarSolicitacaoAssinatura || window.criarSolicitacaoAssinatura || null;
  if (!fnCriar) { _toast('Não foi possível enviar. Tente pelo Painel da Unidade.'); return; }

  var btnEnv = document.getElementById('btnEnviarAss');
  if (btnEnv) { btnEnv.disabled = true; btnEnv.textContent = 'Enviando…'; }

  try {
    await fnCriar({ titulo: _assModalData.titulo, conteudo: conteudo, unidadeOrigem: unidadeOrigem, assinantes: _assModalData.assinantes, presos: presos });
    fecharModalAssinaturas();
    _toast('Solicitação de assinaturas enviada com sucesso!');
  } catch (e) {
    _toast('Erro ao enviar solicitação. Tente novamente.');
    if (btnEnv) { btnEnv.disabled = false; btnEnv.textContent = '✉ Enviar Solicitação'; }
  }
}

/* ── Resumo Sintético ── */
function abrirResumoSintetico() {
  var s = Estado.get();
  var txt = gerarTextoResumo(s);
  document.getElementById('resumoTexto').textContent = txt;
  document.getElementById('resumoBg').classList.add('open');
}
function fecharResumoSintetico() { document.getElementById('resumoBg').classList.remove('open'); }

var _resumoEditando = false;
function toggleEditarResumo() {
  _resumoEditando = !_resumoEditando;
  var p  = document.getElementById('resumoTexto');
  var ta = document.getElementById('resumoEdit');
  var btn = document.getElementById('btnEditarResumo');
  if (_resumoEditando) {
    ta.value = p.textContent; ta.style.display = 'block'; p.style.display = 'none';
    btn.textContent = '💾 Salvar edição';
  } else {
    p.textContent = ta.value; ta.style.display = 'none'; p.style.display = '';
    btn.textContent = '✏ Editar';
  }
}

/* ── Tecla ESC fecha modais ── */
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  var ordem = ['assBg','mcjBg','resumoBg','umBg'];
  for (var i = 0; i < ordem.length; i++) {
    var m = document.getElementById(ordem[i]);
    if (m && m.classList.contains('open')) { m.classList.remove('open'); break; }
  }
});

/* ── Abas mobile ── */
function _setAba(aba) {
  var tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(function(t) { t.classList.toggle('at', t.dataset.aba === aba); });
  document.getElementById('painel-form').style.display   = aba === 'form'    ? '' : 'none';
  document.getElementById('painel-prev').style.display   = aba === 'preview' ? '' : 'none';
}

/* ── Inicialização principal ── */
document.addEventListener('DOMContentLoaded', function() {
  /* Preferências — restaurar saudação, fechamento, unidade */
  var prefs = _prefsCarregar();

  /* Registrar listeners */
  inicializarPreview();
  FormularioCtrl.inicializar();

  /* Auto-fill unidade de origem via localStorage (gravado por firebase.js no login do site principal) */
  var _emailOri = localStorage.getItem('crv_ori_email');
  if (_emailOri && !Estado.get('ori')) {
    var _unOri = getUns().find(function(u) { return u.em === _emailOri; });
    if (_unOri) {
      Estado.set('ori', _unOri);
      setTimeout(function() { _toast('Unidade de origem preenchida: ' + _unOri.n); }, 400);
    }
  }

  /* Eventos modais */
  document.getElementById('umBg').addEventListener('click', function(e) {
    if (e.target === this) fecharModalUnidade();
  });
  document.getElementById('umSearch').addEventListener('input', _renderizarUnidades);
  document.getElementById('mcjBg').addEventListener('click', function(e) {
    if (e.target === this) fecharModalCJ();
  });
  document.getElementById('resumoBg').addEventListener('click', function(e) {
    if (e.target === this) fecharResumoSintetico();
  });
  document.getElementById('assBg').addEventListener('click', function(e) {
    if (e.target === this) fecharModalAssinaturas();
  });

  /* Responsividade: abas mobile */
  if (window.innerWidth <= 767) {
    _setAba('form');
  }

  /* Resize */
  window.addEventListener('resize', function() {
    if (window.innerWidth <= 767) {
      document.getElementById('painel-form').style.display = '';
      document.getElementById('painel-prev').style.display = 'none';
    } else {
      document.getElementById('painel-form').style.display = '';
      document.getElementById('painel-prev').style.display = '';
    }
  });
});
