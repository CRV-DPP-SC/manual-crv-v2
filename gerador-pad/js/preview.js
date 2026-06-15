/* ============================================================
   PREVIEW — atualização em tempo real do documento
   ============================================================ */

var _previewTimer = null;

function atualizarPreview() {
  clearTimeout(_previewTimer);
  _previewTimer = setTimeout(_renderPreview, 150);
}

function _renderPreview() {
  var s  = Estado.get();
  var el = document.getElementById('pad-preview-wrap');
  if (!el) return;
  el.innerHTML = montarPreview(s);
  _atualizarAviso(s);
}

function _atualizarAviso(s) {
  var pend = _contarPendencias(s);
  var el   = document.getElementById('previewAviso');
  if (!el) return;
  if (pend === 0) {
    el.textContent = '✓ Pronto para exportar';
    el.className   = 'preview-aviso aviso-ok';
  } else {
    el.textContent = '⚠ ' + pend + ' campo(s) pendente(s)';
    el.className   = 'preview-aviso aviso-pend';
  }
}

function _contarPendencias(s) {
  var n = 0;
  var i = s.incidentado || {};
  var inf = s.infracao  || {};

  if (!s.numPad)           n++;
  if (!s.dataInst)         n++;
  if (!i.nome)             n++;
  if (!i.prontuario && !i.ipen) n++;
  if (!inf.data)           n++;
  if (!inf.artigo)         n++;
  if (!inf.descricao)      n++;

  // Conselho
  var c = s.conselho || {};
  if (!(c.presidente && c.presidente.nome)) n++;
  if (!(c.membro1    && c.membro1.nome))    n++;
  if (!(c.membro2    && c.membro2.nome))    n++;

  // Defesa
  if (!(s.defesa && s.defesa.tipo)) n++;

  return n;
}
