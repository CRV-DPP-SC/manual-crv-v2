/* ============================================================
   EXPORTAR — Copiar, .doc, PDF
   ============================================================ */

function getCSS() {
  return [
    '@page{size:A4;margin:1.5cm 1.75cm 1.2cm 2.5cm}',
    '@media print{',
      'body{-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0;padding:0}',
      'html,body{height:100%;margin:0;padding:0}',
      'thead{display:table-header-group}tfoot{display:table-footer-group}',
      'header,footer,.pad-no-print{display:none!important}',
      '.pad-placeholder{display:none}',
      '#pad-preview{min-height:0!important;border:none!important;box-shadow:none!important}',
      '.pad-table{width:100%;height:100%}',
      '.pad-hcell,.pad-fcell,.pad-bcell{border:none!important}',
      '.pad-hcell{padding:0.3cm 0 0.2cm 0}.pad-cab img{height:36pt!important}',
      '.pad-fcell{padding:0.15cm 0 0.2cm 0}',
      '.pad-bcell{padding:0.3cm 0 0 0;vertical-align:top}',
      '.pad-corpo{padding:0}',
      '.lb{height:11pt!important;line-height:11pt!important}',
      '.pad-ass-bloco{page-break-inside:avoid!important;break-inside:avoid!important}',
      '.pad-ass-dupla{page-break-inside:avoid!important;break-inside:avoid!important}',
      '.pad-p{orphans:3;widows:3;margin-bottom:5pt}',
    '}',
    'body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.15;color:#111;margin:0;padding:0}',
    '#pad-preview{background:#fff;max-width:21cm;margin:0 auto;min-height:0}',
    '.pad-table{width:100%;border-collapse:collapse;table-layout:fixed}',
    '.pad-hcell{padding:0.5cm 1.5cm 0.3cm 1.5cm;border:none;vertical-align:top}',
    '.pad-fcell{padding:0.2cm 1.5cm 0.3cm 1.5cm;border:none;vertical-align:top}',
    '.pad-bcell{padding:0 1.5cm;border:none;vertical-align:top}',
    '.pad-cab{display:flex;align-items:center;gap:10px;padding-bottom:6px}',
    '.pad-cab img{height:42pt;flex-shrink:0}',
    '.pad-cab-txt{flex:1;text-align:left;line-height:1.3}',
    '.c1,.c2,.c3{font-size:10pt;font-weight:normal;text-transform:uppercase;display:block;color:#111}',
    '.c4{font-size:10pt;font-weight:bold;text-transform:uppercase;display:block;margin-top:1px;color:#111}',
    '.pad-corpo{display:block;padding:0}',
    '.lb{display:block;height:11pt;line-height:11pt}',
    '.pad-p{text-align:justify;text-indent:1.25cm;font-size:11pt;line-height:1.15;margin:0 0 6pt;font-family:Arial,sans-serif}',
    '.pad-p-sr{text-indent:0!important}',
    '.pad-campo{font-weight:bold}',
    '.pad-placeholder{color:#c00;font-style:italic}',
    '.pad-ass-bloco{margin-top:1.5cm;text-align:center;font-size:11pt;line-height:1.5;font-family:Arial,sans-serif}',
    '.pad-ass-dupla{display:flex;gap:2cm;margin-top:1.5cm;font-family:Arial,sans-serif;font-size:10pt;line-height:1.4}',
    '.pad-ass-item{flex:1;text-align:center}',
    '.pad-ass-linha{border-top:1px solid #111;margin-bottom:4px}',
    '.pad-dest{margin-top:1.5cm;font-size:11pt;font-family:Arial,sans-serif;line-height:1.4}',
    '.dest-t{display:block}.dest-n{display:block;font-weight:bold;text-transform:uppercase}',
    '.pad-rodape{font-family:Arial,sans-serif;margin:0;padding:0}',
    '.rod-info{text-align:center;font-size:8.5pt;color:#222;line-height:1.5}',
    '.rod-dpp{font-weight:bold;font-size:9pt;text-transform:uppercase;display:block;color:#111}',
    '.rod-un{font-weight:bold;color:#111;display:block;font-size:8.5pt}',
    '.rod-cont{font-size:8pt;display:block;color:#333}',
  ].join('');
}

/* ── Copiar formatado ── */
function copiar() {
  var el = document.getElementById('pad-preview-wrap');
  if (!el || !el.innerHTML.trim()) { _toast('Nada para copiar.'); return; }
  var range = document.createRange();
  range.selectNode(el);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  try {
    document.execCommand('copy');
    _toast('Copiado com formatação!');
    salvarNoHistorico(window._padIdAtual);
  } catch(e) {
    navigator.clipboard.writeText(el.innerText)
      .then(function() { _toast('Texto copiado!'); salvarNoHistorico(window._padIdAtual); })
      .catch(function() { _toast('Erro ao copiar.'); });
  }
  window.getSelection().removeAllRanges();
}

/* ── Renderiza páginas do i-PEN PDF como imagens (usa PDF.js) ── */
async function _renderizarIpenPdf() {
  var file = window._iPenPdfFile;
  if (!file || typeof pdfjsLib === 'undefined') return '';
  try {
    var ab  = await file.arrayBuffer();
    var pdf = await pdfjsLib.getDocument({ data: ab }).promise;
    var paginas = [];
    for (var i = 1; i <= pdf.numPages; i++) {
      var page = await pdf.getPage(i);
      var vp   = page.getViewport({ scale: 2 });
      var canvas = document.createElement('canvas');
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      paginas.push('<img src="' + canvas.toDataURL('image/jpeg', 0.9) + '" style="width:100%;display:block;page-break-inside:avoid;margin-bottom:4px;">');
    }
    return '<div style="page-break-before:always;">'
      + '<p style="font-family:Arial,sans-serif;font-size:9pt;font-weight:bold;text-transform:uppercase;color:#555;margin:0 0 8px;">ANEXO — Relatório da Falta Grave (i-PEN)</p>'
      + paginas.join('')
      + '</div>';
  } catch(e) {
    return '<div style="page-break-before:always;font-family:Arial,sans-serif;font-size:9pt;color:#999;padding:20px;">'
      + '[Anexo i-PEN não pôde ser incorporado: ' + e.message + ']'
      + '</div>';
  }
}

/* ── Baixar .doc — documento atual ── */
async function baixarDoc() {
  var el = document.getElementById('pad-preview-wrap');
  if (!el || !el.innerHTML.trim()) { _toast('Gere o documento antes de baixar.'); return; }
  var s   = Estado.get();
  var html = el.innerHTML;
  /* Anexa i-PEN PDF se estiver na portaria */
  if (_DOC_ATUAL === 'portaria') {
    html += await _renderizarIpenPdf();
  }
  _gerarDoc(html, _nomeArquivo(s, _DOC_ATUAL) + '.doc');
  salvarNoHistorico(window._padIdAtual);
}

/* ── Baixar .doc — todos os documentos ── */
async function baixarTodosDoc() {
  var s    = Estado.get();
  var html = montarTodosDocumentos(s);
  /* Anexa i-PEN PDF ao final (após portaria) */
  html += await _renderizarIpenPdf();
  _gerarDoc(html, _nomeArquivo(s, 'PAD-completo') + '.doc');
  salvarNoHistorico(window._padIdAtual);
}

function _gerarDoc(html, nome) {
  var css  = getCSS();
  var blob = new Blob(
    ['﻿', '<html><head><meta charset="UTF-8"><style>' + css + '</style></head><body>' + html + '</body></html>'],
    { type: 'application/msword' }
  );
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  _toast('Download iniciado!');
}

/* ── PDF via impressão ── */
async function baixarPDF() {
  var el = document.getElementById('pad-preview-wrap');
  if (!el || !el.innerHTML.trim()) { _toast('Gere o documento antes de baixar.'); return; }
  var html = el.innerHTML;
  if (_DOC_ATUAL === 'portaria') {
    _toast('Preparando anexo i-PEN…');
    html += await _renderizarIpenPdf();
  }
  _abrirImpressao(html);
  salvarNoHistorico(window._padIdAtual);
}

function baixarTodosPDF() {
  var s    = Estado.get();
  var html = montarTodosDocumentos(s);
  _abrirImpressao(html);
  salvarNoHistorico(window._padIdAtual);
}

function _abrirImpressao(html) {
  var css    = getCSS();
  var janela = window.open('', '_blank');
  if (!janela) { _toast('Permita pop-ups para gerar o PDF.'); return; }
  janela.document.write(
    '<html><head><meta charset="UTF-8"><title>PAD</title>'
    + '<style>html,body{height:100%;margin:0;padding:0}</style>'
    + '<style>' + css + '</style></head><body>'
    + html
    + '<script>window.onload=function(){setTimeout(function(){window.print();},400);}<\/script></body></html>'
  );
  janela.document.close();
  _toast('Janela de impressão aberta!');
}

function _nomeArquivo(s, doc) {
  var num = (s.numPad || 'PAD').replace(/[^a-zA-Z0-9]/g, '-');
  var inc = (s.incidentado && s.incidentado.nome) ? '-' + s.incidentado.nome.split(' ')[0] : '';
  return num + inc + '-' + doc;
}
