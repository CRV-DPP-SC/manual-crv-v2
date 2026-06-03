/* ============================================================
   EXPORTAÇÃO — Copiar, .doc, PDF
   Abordagem V1: div flexbox + position:fixed para cab/rod em print.
   ============================================================ */

function getCSS() {
  return [
    /* @page: margens ajustadas */
    '@page{size:A4;margin:1.3cm 1.75cm 1cm 2.5cm}',
    '@media print{',
      'body{-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0;padding:0}',
      'header,footer,.ofc-no-print,.page-break-preview{display:none!important}',
      '.ofc-placeholder{display:none}',
      '#oficio{padding:0;min-height:0;border:none!important;box-shadow:none!important}',
      /* Cabeçalho fixo no topo de CADA página */
      '.ofc-cab{position:fixed;top:0;left:0;right:0;padding:0.2cm 1.75cm 0.15cm 2.5cm;background:#fff;z-index:100}',
      '.ofc-cab img{height:36pt!important}',
      /* Rodapé fixo no fundo de CADA página */
      '.ofc-rodape{position:fixed;bottom:0;left:0;right:0;padding:0.1cm 1.75cm 0.2cm 2.5cm;background:#fff;z-index:100;margin-top:0}',
      /* Corpo: padding para não sobrepor os elementos fixos */
      '.oficio-corpo{padding:0.9cm 0 0.7cm 0}',
      /* Espaços em branco em print */
      '.lb{height:6pt!important;line-height:6pt!important}',
      /* Assinaturas */
      '.ass-bloco{page-break-inside:avoid!important;break-inside:avoid!important;line-height:1.2!important;margin-left:8cm!important}',
      '.ass-dig{font-size:9pt!important}.ass-nome{font-size:10pt!important;white-space:nowrap}.ass-cargo{font-size:8.5pt!important;line-height:1.25!important}',
      /* Destinatário */
      '.ofc-dest-wrap{page-break-inside:avoid;break-inside:avoid;margin-top:8pt;padding-top:14pt;margin-bottom:0.5cm}',
      '.ofc-dest{page-break-inside:avoid;break-inside:avoid;font-size:10pt!important}',
      /* Parágrafos */
      '.ofc-p{orphans:3;widows:3;margin-bottom:5pt}.ofc-sau{margin-bottom:5pt}',
      '.c1,.c2,.c3{font-size:8pt!important}.c4{font-size:9pt!important;white-space:nowrap}',
    '}',
    /* Estilos gerais (screen + export .doc) */
    'body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.0;color:#111;margin:0;padding:0}',
    '#oficio{background:#fff;max-width:21cm;margin:0 auto;display:flex;flex-direction:column;min-height:0;padding:1cm 1.5cm 0 1.5cm}',
    '.oficio-corpo{flex:1;display:flex;flex-direction:column}',
    '.ofc-cab{display:flex;align-items:center;gap:10px;padding-bottom:6px}',
    '.ofc-cab img{height:42pt;flex-shrink:0}',
    '.ofc-cab-txt{flex:1;text-align:left;line-height:1.3;padding-left:6px}',
    '.c1,.c2,.c3{font-size:10pt;font-weight:normal;text-transform:uppercase;display:block;color:#111}',
    '.c4{font-size:10pt;font-weight:bold;text-transform:uppercase;display:block;margin-top:1px;color:#111}',
    '.ofc-numdata{display:flex;justify-content:space-between;align-items:baseline;font-size:11pt;line-height:1.0}',
    '.ofc-data-only{text-align:right;font-size:11pt;line-height:1.0}',
    '.lb{display:block;height:11pt;line-height:11pt}',
    '.ofc-sau{font-size:11pt;line-height:1.0;text-indent:1.25cm;font-family:Arial,sans-serif}',
    '.ofc-p{text-align:justify;text-indent:1.25cm;font-size:11pt;line-height:1.0;margin:0;font-family:Arial,sans-serif}',
    '.ofc-p-lista{text-indent:0!important}',
    '.ofc-campo{font-weight:bold}',
    '.ofc-desp{margin-left:8cm;font-size:11pt;line-height:1.0;font-family:Arial,sans-serif}',
    '.ass-bloco{margin-left:8cm;font-size:11pt;line-height:1.3;font-family:Arial,sans-serif;page-break-inside:avoid}',
    '.ass-dig{font-style:italic;color:#444;font-size:10pt;display:block}',
    '.ass-nome{font-weight:bold;text-transform:uppercase;font-size:11pt;display:block}',
    '.ass-cargo{font-weight:normal;font-size:10pt;color:#222;display:block}',
    '.ofc-dest-wrap{margin-top:18pt;padding-top:0}',
    '.ofc-dest{font-size:11pt;line-height:1.0;font-family:Arial,sans-serif}',
    '.dest-t{font-weight:normal;display:block;margin:0;padding:0}',
    '.dest-n{font-weight:bold;text-transform:uppercase;display:block;margin:0;padding:0}',
    '.dest-l{font-weight:normal;display:block;margin:0;padding:0}',
    '.ofc-lista{margin:3pt 0 3pt 1.5cm;padding:0;list-style:disc;font-size:11pt;line-height:1.0;font-family:Arial,sans-serif}',
    '.ofc-lista li{margin-bottom:2pt}',
    '.ofc-lista-wrap{margin:0;padding:0}',
    '.ofc-rodape{margin-top:0.5cm;padding:6px 0 10px;font-family:Arial,sans-serif}',
    '.rod-info{text-align:center;font-size:8.5pt;color:#222;line-height:1.5}',
    '.rod-dpp{font-weight:bold;font-size:9pt;text-transform:uppercase;display:block;color:#111;letter-spacing:.03em}',
    '.rod-un{font-weight:bold;color:#111;display:block;font-size:8.5pt}',
    '.rod-cont{font-size:8pt;display:block;color:#333}',
    '.anexo-wrapper{font-family:Arial,sans-serif;page-break-before:always;break-before:page;padding-top:0.5cm}',
    '.anexo-tabela{width:100%;border-collapse:collapse}',
    'th,td{padding:5pt 7pt;border:0.5pt solid #aab;font-size:9.5pt;font-family:Arial,sans-serif}',
    'th{background:#0d2b55;color:#fff;font-size:9.5pt}',
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

/* ── Baixar PDF (janela de impressão) ── */
function baixarPDF() {
  var el = document.getElementById('oficio-preview');
  if (!el || !el.innerHTML.trim()) { _toast('Gere o ofício antes de baixar.'); return; }
  var css = getCSS();
  var janela = window.open('', '_blank');
  if (!janela) { _toast('Permita pop-ups para gerar o PDF.'); return; }
  janela.document.write(
    '<html><head><meta charset="UTF-8"><title>Ofício</title>'
    + '<style>' + css + '</style></head><body>'
    + _wrapParaExport(el.innerHTML)
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
