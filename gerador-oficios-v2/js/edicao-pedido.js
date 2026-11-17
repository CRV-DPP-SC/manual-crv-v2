/* ============================================================
   EDIÇÃO DE PEDIDO — reabre no Gerador um pedido já enviado
   Aberto pelo Painel: index.html?editar=<id>[&modo=crv]
   • Unidade de origem / quem criou (modo 'reenvio'): pedido concluído ou com
     negativa; ao salvar, o ofício e o Resumo IPEN são refeitos e TODAS as
     assinaturas voltam a pendente (os signatários são avisados de novo).
   • CRV (modo 'crv'): retificação — mantém as assinaturas; registra quem
     retificou e a justificativa em /retificacoes (visível só para a CRV).
   Só funciona para pedidos com as respostas do formulário salvas
   (estadoGerador), isto é, criados a partir desta versão.
   ============================================================ */

window._edicaoPedido = null;   /* { id, modo, doc } */

function _statusPedido(d) {
  var a = d.assinantes || [];
  if (d.statusGeral === 'cancelado') return 'cancelado';
  if (a.length && a.every(function(x) { return x.status === 'assinado'; })) return 'concluido';
  if (a.some(function(x) { return x.status === 'negado'; })) return 'negado';
  return 'andamento';
}

function _bannerEdicao(html, cor) {
  var b = document.getElementById('edicaoBanner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'edicaoBanner';
    b.className = 'edicao-banner';
    var topo = document.querySelector('header.topo');
    topo.parentNode.insertBefore(b, topo.nextSibling);
  }
  b.style.background = cor === 'erro' ? '#fee2e2' : '#fef3c7';
  b.style.borderColor = cor === 'erro' ? '#ef4444' : '#f59e0b';
  b.style.color = cor === 'erro' ? '#991b1b' : '#92400e';
  b.innerHTML = html;
}

async function _iniciarEdicaoPedido() {
  var q = new URLSearchParams(location.search);
  var id = q.get('editar');
  if (!id) return;
  var modo = q.get('modo') === 'crv' ? 'crv' : 'reenvio';
  _bannerEdicao('⏳ Carregando o pedido para edição…');

  if (window._v2AuthReady) await window._v2AuthReady;
  if (!window._v2Usuario || !window._v2LerSolicitacao) {
    _bannerEdicao('⚠️ Faça login no Portal para editar o pedido.', 'erro'); return;
  }
  var d;
  try { d = await window._v2LerSolicitacao(id); } catch (e) { d = null; }
  if (!d) { _bannerEdicao('⚠️ Pedido não encontrado.', 'erro'); return; }
  if (!d.estadoGerador) {
    _bannerEdicao('⚠️ Este pedido foi criado antes da edição pelo Gerador e não pode ser editado.', 'erro'); return;
  }
  var st = _statusPedido(d);
  if (st === 'cancelado') { _bannerEdicao('⚠️ Pedido cancelado — não pode ser editado.', 'erro'); return; }
  if (modo === 'reenvio' && st !== 'concluido' && st !== 'negado') {
    _bannerEdicao('⚠️ Só é possível editar pedidos concluídos ou com negativa.', 'erro'); return;
  }

  var estado;
  try { estado = JSON.parse(d.estadoGerador); } catch (e) { estado = null; }
  if (!estado || !estado.mod) { _bannerEdicao('⚠️ Não foi possível ler os dados do pedido.', 'erro'); return; }

  window._edicaoPedido = { id: id, modo: modo, doc: d };
  Estado.carregar(estado);
  FormularioCtrl.abrirComEstado();

  var btn = document.getElementById('btnAssinar');
  if (btn) btn.innerHTML = modo === 'crv' ? '💾 Salvar retificação' : '🔄 Atualizar pedido';

  _bannerEdicao(modo === 'crv'
    ? '✏️ <strong>Retificação pela CRV</strong> — ' + _esc(d.titulo || '') + '. Ajuste o formulário (ou use ✏ Editar no texto) e clique em <strong>💾 Salvar retificação</strong>. As assinaturas são mantidas.'
    : '✏️ <strong>Editando pedido</strong> — ' + _esc(d.titulo || '') + '. Ajuste o formulário (ou use ✏ Editar no texto) e clique em <strong>🔄 Atualizar pedido</strong>. '
      + '<strong>Todas as assinaturas serão solicitadas novamente.</strong>'
      + (st === 'concluido' ? '<br>⚠️ Se o pedido já foi cadastrado no i-PEN ou deliberado pela CRV, não o altere.' : ''));
}

/* Trecho extra do modal de assinaturas no modo edição */
function _htmlModalEdicao(ed) {
  return '<div class="ass-modal-edicao">'
    + (ed.modo === 'crv'
        ? '✏️ <strong>Retificação pela CRV</strong>: o ofício e o Resumo IPEN serão atualizados e <strong>as assinaturas mantidas</strong>.'
        : '🔄 <strong>Atualizar pedido</strong>: o ofício e o Resumo IPEN serão refeitos e <strong>todas as assinaturas voltarão a pendente</strong>; os signatários serão avisados novamente.')
    + '<label for="edMotivo">' + (ed.modo === 'crv' ? 'Justificativa (obrigatória)' : 'Motivo da correção (obrigatório)') + '</label>'
    + '<textarea id="edMotivo" rows="3" placeholder="' + (ed.modo === 'crv'
        ? 'Ex.: A pedido de FULANO DE TAL, sob a justificativa de que o IPEN informado estava incorreto.'
        : 'Ex.: Correção do IPEN do reeducando, apontada na negativa do Diretor de destino.') + '"></textarea>'
    + '</div>';
}

function _mesmosAssinantes(a, b) {
  var k = function(l) { return (l || []).map(function(x) { return (x.email || '').toLowerCase(); }).sort().join('|'); };
  return k(a) === k(b);
}

async function salvarEdicaoPedido() {
  var ed = window._edicaoPedido;
  if (!ed || !_assModalData) return;
  var motivo = ((document.getElementById('edMotivo') || {}).value || '').trim();
  if (motivo.length < 10) { _toast(ed.modo === 'crv' ? 'Informe a justificativa da retificação.' : 'Informe o motivo da correção.'); return; }

  var s = Estado.get();
  if (!s.ori || s.ori.em !== ed.doc.emailUnidadeOrigem) {
    _toast('A unidade de origem não pode ser alterada na edição.'); return;
  }
  if (ed.modo === 'crv' && !_mesmosAssinantes(_assModalData.assinantes, ed.doc.assinantes)) {
    _toast('A alteração muda quem assina — use a edição com novas assinaturas.'); return;
  }
  if (!window._v2AtualizarSolicitacao) { _toast('Faça login no Portal para salvar.'); return; }

  var dp = _dadosDoPedido(s);
  var btn = document.getElementById('btnEnviarAss');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }
  try {
    await window._v2AtualizarSolicitacao(ed.id, {
      modo: ed.modo, titulo: _assModalData.titulo,
      conteudo: dp.conteudo, presos: dp.presos, resumo: dp.resumo, transf: dp.transf,
      estadoGerador: dp.estadoGerador, assinantes: _assModalData.assinantes, motivo: motivo,
    });
    fecharModalAssinaturas();
    window._edicaoPedido = null;
    var b = document.getElementById('btnAssinar');
    if (b) b.innerHTML = '✍ Solicitar Assinatura';
    _bannerEdicao(ed.modo === 'crv'
      ? '✅ <strong>Retificação salva.</strong> As assinaturas foram mantidas. Pode fechar esta aba.'
      : '✅ <strong>Pedido atualizado.</strong> As assinaturas foram solicitadas novamente. Pode fechar esta aba.');
    _toast(ed.modo === 'crv' ? 'Retificação salva.' : 'Pedido atualizado e reenviado para assinatura.');
  } catch (e) {
    console.error('[edição do pedido]', e);
    _toast('Erro ao salvar: ' + (e.code || e.message));
    if (btn) { btn.disabled = false; btn.textContent = ed.modo === 'crv' ? '💾 Salvar retificação' : '💾 Salvar e solicitar assinaturas'; }
  }
}

/* "↩ Novo" durante a edição: sai do modo edição (não grava por cima do pedido) */
(function() {
  var limparOrig = FormularioCtrl.limpar;
  FormularioCtrl.limpar = function() {
    limparOrig();
    if (window._edicaoPedido && !Estado.get('mod')) {
      window._edicaoPedido = null;
      var b = document.getElementById('btnAssinar');
      if (b) b.innerHTML = '✍ Solicitar Assinatura';
      var ban = document.getElementById('edicaoBanner');
      if (ban) ban.remove();
    }
  };
})();

document.addEventListener('DOMContentLoaded', _iniciarEdicaoPedido);
