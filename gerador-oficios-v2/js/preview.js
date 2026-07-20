/* ============================================================
   PREVIEW — atualiza o painel de pré-visualização em tempo real
   ============================================================ */

var _debounceTimer = null;

function _atualizarPreview(s) {
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(function() {
    var el = document.getElementById('oficio-preview');
    if (!el) return;
    if (!s.mod) {
      el.innerHTML = '<div class="preview-placeholder"><p>Selecione o tipo de ofício<br>para visualizar o documento.</p></div>';
      return;
    }
    el.innerHTML = montarOficio(s);
    _atualizarBarraAcoes(s);
    atualizarBotaoCJ();
  }, 150);
}

function _atualizarBarraAcoes(s) {
  var pendencias = _contarPendencias(s);
  var aviso     = document.getElementById('previewAviso');
  var btnCopiar = document.getElementById('btnCopiar');
  var btnDoc    = document.getElementById('btnDoc');
  var btnPdf    = document.getElementById('btnPdf');
  var btnResumo = document.getElementById('btnResumo');

  if (!aviso) return;

  /* Visibilidade dos novos botões */
  var temMod = !!(s.mod);
  if (btnResumo)  btnResumo.style.display  = temMod ? '' : 'none';

  if (!s.mod) {
    aviso.textContent = '';
    aviso.className = 'preview-aviso';
    return;
  }

  if (pendencias > 0) {
    aviso.textContent = '⚠ ' + pendencias + ' campo' + (pendencias > 1 ? 's' : '') + ' obrigatório' + (pendencias > 1 ? 's' : '') + ' pendente' + (pendencias > 1 ? 's' : '');
    aviso.className = 'preview-aviso aviso-pend';
    if (btnCopiar) btnCopiar.title = pendencias + ' campo(s) pendente(s)';
    if (btnDoc)    btnDoc.title    = pendencias + ' campo(s) pendente(s)';
    if (btnPdf)    btnPdf.title    = pendencias + ' campo(s) pendente(s)';
  } else {
    aviso.textContent = '✓ Pronto para exportar';
    aviso.className = 'preview-aviso aviso-ok';
    if (btnCopiar) btnCopiar.title = '';
    if (btnDoc)    btnDoc.title    = '';
    if (btnPdf)    btnPdf.title    = '';
  }
}

function _contarPendencias(s) {
  var n = 0;
  if (!s.mod) return 0;
  if (!s.ori) n++;
  if (!s.des) n++;

  if (s.numero === 'P') {
    if (!s.reed || s.reed.length === 0) n++;
  } else {
    if (!s.nome) n++;
    if (!s.ipen) n++;
  }

  if (s.mod === 'mandado'    && !s.juizo)       n++;
  if (s.mod === 'emergencial' && !s.sit)         n++;
  if (s.mod === 'pernoite'   && !s.razPernoite)  n++;
  if (s.mod === 'comunicacao' && !s.dataTrans)   n++;
  if (s.mod === 'comunicacao' && !s.motComun)    n++;
  if (s.mod === 'comunicacao' && !s.nomejuiz)    n++;

  var MODS_COM_BPI = ['emergencial','mandado','adequacao','ajuste_lotacional','permuta','retorno_saida_temporaria','prisaocivil'];
  if (MODS_COM_BPI.indexOf(s.mod) >= 0 && !s.bpi) n++;
  if (s.bpi === 'nao_atualizado' && !s.bpiMotivo) n++;

  return n;
}

/* Inicializa o preview — registra listener no Estado */
function inicializarPreview() {
  Estado.onChange(_atualizarPreview);
}
