/* ============================================================
   EXPORTAÇÃO — Copiar, .doc, PDF
   ============================================================ */

function getCSS() {
  return [
    '@page{size:A4;margin:0.3cm 2cm 0.3cm 3cm}',
    '@media print{',
      'body{-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0;padding:0}',
      'header,footer,.ofc-no-print{display:none!important}',
      '.ofc-placeholder{display:none}',
      '#oficio{border:none!important;box-shadow:none!important}',
      '.ofc-cab img{height:52pt!important}',
      '.ofc-print-header{padding:0.35cm 0 0.2cm 0}',
      '.ofc-print-body{padding:0.3cm 0 0}',
      '.ofc-print-footer{padding:0.2cm 0}',
    '}',
    '#oficio{background:#fff;font-family:Arial,sans-serif;font-size:11pt;line-height:1.0;color:#111;width:100%;border-collapse:collapse}',
    '.ofc-print-header{padding:1cm 1.5cm 0.3cm 1.5cm;vertical-align:top}',
    '.ofc-print-body{padding:0.3cm 1.5cm 0 1.5cm;vertical-align:top}',
    '.ofc-print-footer{padding:0.3cm 1.5cm 0.5cm 1.5cm}',
    '.ofc-ass-page{page-break-before:always;break-before:page;padding-top:0.3cm}',
    '.ofc-cab{display:flex;align-items:center;gap:10px;padding-bottom:6px}',
    '.ofc-cab img{height:60px;flex-shrink:0}',
    '.ofc-cab-txt{flex:1;text-align:left;line-height:1.3;padding-left:6px}',
    '.c1,.c2,.c3{font-size:10pt;font-weight:normal;text-transform:uppercase;display:block}',
    '.c4{font-size:10pt;font-weight:bold;text-transform:uppercase;display:block;margin-top:1px}',
    '.ofc-numdata{display:flex;justify-content:space-between;align-items:baseline;font-size:11pt}',
    '.ofc-data-only{text-align:right;font-size:11pt}',
    '.lb{display:block;height:11pt;line-height:11pt}',
    '.ofc-sau{font-size:11pt;text-indent:1.25cm}',
    '.ofc-p{text-align:justify;text-indent:1.25cm;font-size:11pt;line-height:1.0;margin:0}',
    '.ofc-p-lista{text-indent:0!important}',
    '.ofc-campo{font-weight:bold}',
    '.ofc-desp{margin-left:7cm;font-size:11pt}',
    '.ass-bloco{margin-left:7cm;font-size:11pt;line-height:1.3}',
    '.ass-dig{font-style:italic;color:#444;font-size:10pt;display:block}',
    '.ass-nome{font-weight:bold;text-transform:uppercase;font-size:11pt;display:block}',
    '.ass-cargo{font-weight:normal;font-size:10pt;color:#222;display:block}',
    '.ofc-dest-wrap{padding-top:18pt}',
    '.ofc-dest{font-size:11pt;line-height:1.0}',
    '.dest-t{font-weight:normal;display:block}',
    '.dest-n{font-weight:bold;text-transform:uppercase;display:block}',
    '.dest-l{font-weight:normal;display:block}',
    '.ofc-lista{margin:3pt 0 3pt 1.5cm;padding:0;list-style:disc;font-size:11pt}',
    '.ofc-rodape{border-top:none;padding:6px 0 10px}',
    '.rod-info{text-align:center;font-size:8.5pt;color:#222;line-height:1.5}',
    '.rod-dpp{font-weight:bold;font-size:9pt;text-transform:uppercase;display:block}',
    '.rod-un{font-weight:bold;color:#111;display:block;font-size:8.5pt}',
    '.rod-cont{font-size:8pt;display:block;color:#333}',
    '.anexo-wrapper{font-family:Arial,sans-serif;page-break-before:always;break-before:page;padding-top:0.5cm}',
    '.anexo-tabela{width:100%;border-collapse:collapse}',
    '.ofc-lista-wrap{margin:0}',
    '.oficio-corpo{padding-bottom:0}',
  ].join('');
}

function _wrapParaExport(html) {
  return html;
}

/* ── Copiar com formatação ── */
function copiar() {
  var el = document.getElementById('oficio-preview');
  if (!el || !el.innerHTML.trim()) { _toast('Nada para copiar.'); return; }
  var range = document.createRange();
  range.selectNode(el);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  try {
    document.execCommand('copy');
    _toast('Copiado com formatação!');
  } catch(e) {
    navigator.clipboard.writeText(el.innerText)
      .then(function() { _toast('Texto copiado!'); })
      .catch(function() { _toast('Erro ao copiar.'); });
  }
  window.getSelection().removeAllRanges();
  _prefsSalvar('ultimoNumOficio', Estado.get('numOficio') || '');
}

/* ── Baixar .doc ── */
function baixarDoc() {
  var el = document.getElementById('oficio-preview');
  if (!el || !el.innerHTML.trim()) { _toast('Gere o ofício antes de baixar.'); return; }
  var css  = getCSS();
  var html = el.innerHTML;
  var blob = new Blob(
    ['﻿', '<html><head><meta charset="UTF-8"><style>' + css + '</style></head><body>' + _wrapParaExport(html) + '</body></html>'],
    { type: 'application/msword' }
  );
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'oficio-crv.doc';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  _toast('Download .doc iniciado!');
  _prefsSalvar('ultimoNumOficio', Estado.get('numOficio') || '');
}

/* ── Baixar PDF via pdfmake ── */
function baixarPDF() {
  var el = document.getElementById('oficio-preview');
  if (!el || !el.innerHTML.trim()) { _toast('Gere o ofício antes de baixar.'); return; }
  if (typeof pdfMake === 'undefined') { _toast('pdfmake não carregado.'); return; }

  var s   = Estado.get();
  var ori = s.ori;
  var o   = el;
  var css = getCSS();

  /* Janela de impressão como fallback confiável */
  var janela = window.open('', '_blank');
  janela.document.write(
    '<html><head><meta charset="UTF-8"><title>Ofício</title>'
    + '<style>' + css + '@media print{body{margin:0}}</style></head><body>'
    + _wrapParaExport(o.innerHTML)
    + '<script>window.onload=function(){window.print();}<\/script></body></html>'
  );
  janela.document.close();
  _toast('Janela de impressão/PDF aberta!');
  _prefsSalvar('ultimoNumOficio', Estado.get('numOficio') || '');
}

/* ── Copiar Resumo Sintético ── */
function copiarResumo() {
  var el = document.getElementById('resumoTexto');
  if (!el) return;
  navigator.clipboard.writeText(el.textContent)
    .then(function() { _toast('Resumo copiado!'); })
    .catch(function() {
      var ta = document.createElement('textarea');
      ta.value = el.textContent;
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      _toast('Resumo copiado!');
    });
}

function baixarResumoTxt() {
  var el = document.getElementById('resumoTexto');
  if (!el) return;
  var blob = new Blob([el.textContent], { type: 'text/plain;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'resumo-ipen.txt';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
