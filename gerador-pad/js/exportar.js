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

/* ── Renderiza um arquivo (PDF ou imagem) como HTML com imagens embutidas ── */
async function _renderizarArquivoComoHtml(file) {
  if (!file) return '';
  if (file.type && file.type.startsWith('image/')) {
    return await new Promise(function(resolve) {
      var reader = new FileReader();
      reader.onload = function(e) {
        resolve('<img src="' + e.target.result + '" style="width:100%;display:block;page-break-inside:avoid;">');
      };
      reader.readAsDataURL(file);
    });
  }
  /* PDF — renderiza via PDF.js */
  if (typeof pdfjsLib === 'undefined') return '';
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
      paginas.push('<img src="' + canvas.toDataURL('image/jpeg', 0.85) + '" style="width:100%;display:block;page-break-inside:avoid;margin-bottom:2px;">');
    }
    return paginas.join('');
  } catch(e) { return ''; }
}

/* ── Salva peça atual no portal (Firestore) ── */
async function _salvarPecaPortal(tipo, ordem, label, htmlContent) {
  var padId = window._padIdAtual;
  if (!padId || !window.PadFirestore) return;
  try {
    await window.PadFirestore.salvarPeca(padId, tipo, ordem, label, htmlContent);
  } catch(e) { console.warn('[PadPortal] Erro ao salvar peça:', e.message); }
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

/* ── Verifica se defesa está definida (obrigatório a partir do Termo de Cientificação) ── */
function _verificarDefesa() {
  var s    = Estado.get();
  var tipo = s.defesa && s.defesa.tipo;
  if (!tipo || tipo === 'sem_defesa') {
    _toast('⚠️ Defina o tipo de defesa (Advogado ou Defensoria) antes de salvar este documento.');
    var bg = document.getElementById('modalAdvBg');
    if (bg) {
      document.getElementById('modal-adv-opcoes').style.display  = '';
      document.getElementById('modal-adv-vincular').style.display = 'none';
      bg.style.display = 'flex';
    }
    return false;
  }
  return true;
}

/* ── Documentos que exigem defesa definida ── */
var _DOCS_EXIGEM_DEFESA = ['termo_cient','oitiva_inc','oitivas_test','manifestacao','manif_defesa','decisao','oficio_juiz','oficio_vep'];

/* ── Baixar .doc — documento atual ── */
async function baixarDoc() {
  var el = document.getElementById('pad-preview-wrap');
  if (!el || !el.innerHTML.trim()) { _toast('Gere o documento antes de baixar.'); return; }
  if (_DOCS_EXIGEM_DEFESA.indexOf(_DOC_ATUAL) !== -1 && !_verificarDefesa()) return;
  var s    = Estado.get();
  var html = el.innerHTML;
  var docAtual = DOCS.find(function(d) { return d.cod === _DOC_ATUAL; });

  /* Portaria: anexa i-PEN + documentação inicial */
  if (_DOC_ATUAL === 'portaria') {
    html += await _renderizarIpenPdf();
    if (window._docInicialFiles && window._docInicialFiles.length) {
      var docInicialHtml = '';
      for (var i = 0; i < window._docInicialFiles.length; i++) {
        docInicialHtml += await _renderizarArquivoComoHtml(window._docInicialFiles[i]);
      }
      if (docInicialHtml) {
        html += '<div style="page-break-before:always;"><p style="font-family:Arial,sans-serif;font-size:9pt;font-weight:bold;text-transform:uppercase;color:#555;margin:0 0 8px;">DOCUMENTAÇÃO INICIAL — JUNTADA DE PROVAS</p>' + docInicialHtml + '</div>';
      }
    }
  }

  /* Termo de cientificação: anexa versão assinada digitalizada */
  if (_DOC_ATUAL === 'termo_cient' && window._termoCientPdfFile) {
    var tcHtml = await _renderizarArquivoComoHtml(window._termoCientPdfFile);
    if (tcHtml) html += '<div style="page-break-before:always;"><p style="font-family:Arial,sans-serif;font-size:9pt;font-weight:bold;color:#555;margin:0 0 8px;">TERMO ASSINADO — DIGITALIZADO</p>' + tcHtml + '</div>';
  }

  /* Manifestação da defesa: anexa PDF recebido */
  if (_DOC_ATUAL === 'manif_defesa' && window._manifDefesaPdfFile) {
    var mdHtml = await _renderizarArquivoComoHtml(window._manifDefesaPdfFile);
    if (mdHtml) html += '<div style="page-break-before:always;"><p style="font-family:Arial,sans-serif;font-size:9pt;font-weight:bold;color:#555;margin:0 0 8px;">MANIFESTAÇÃO DA DEFESA — DOCUMENTO ORIGINAL</p>' + mdHtml + '</div>';
  }

  /* Oitiva do incidentado: anexa documento assinado */
  if (_DOC_ATUAL === 'oitiva_inc' && window._oitivaIncSignedFile) {
    var oiHtml = await _renderizarArquivoComoHtml(window._oitivaIncSignedFile);
    if (oiHtml) html += '<div style="page-break-before:always;"><p style="font-family:Arial,sans-serif;font-size:9pt;font-weight:bold;color:#555;margin:0 0 8px;">DECLARAÇÕES DO INCIDENTADO — DOCUMENTO ASSINADO</p>' + oiHtml + '</div>';
  }

  /* Oitivas de testemunhas: anexa documentos assinados de cada uma */
  if (_DOC_ATUAL === 'oitivas_test' && window._testemunhasSignedFiles) {
    var testes = s.testemunhas || [];
    for (var ti = 0; ti < testes.length; ti++) {
      var sf = window._testemunhasSignedFiles[ti];
      if (sf) {
        var teHtml = await _renderizarArquivoComoHtml(sf);
        if (teHtml) html += '<div style="page-break-before:always;"><p style="font-family:Arial,sans-serif;font-size:9pt;font-weight:bold;color:#555;margin:0 0 8px;">OITIVA DE ' + (testes[ti].nome||'TESTEMUNHA '+(ti+1)) + ' — DOCUMENTO ASSINADO</p>' + teHtml + '</div>';
      }
    }
  }

  /* Manifestação do Conselho: anexa documento externo se houver */
  if (_DOC_ATUAL === 'manifestacao' && window._manifConselhoFile) {
    var mcHtml = await _renderizarArquivoComoHtml(window._manifConselhoFile);
    if (mcHtml) html += '<div style="page-break-before:always;"><p style="font-family:Arial,sans-serif;font-size:9pt;font-weight:bold;color:#555;margin:0 0 8px;">MANIFESTAÇÃO DO CONSELHO — DOCUMENTO ORIGINAL</p>' + mcHtml + '</div>';
  }

  /* Decisão da Direção: anexa documento externo se houver */
  if (_DOC_ATUAL === 'decisao' && window._decisaoPdfFile) {
    var dcHtml = await _renderizarArquivoComoHtml(window._decisaoPdfFile);
    if (dcHtml) html += '<div style="page-break-before:always;"><p style="font-family:Arial,sans-serif;font-size:9pt;font-weight:bold;color:#555;margin:0 0 8px;">DECISÃO DA DIREÇÃO — DOCUMENTO ORIGINAL</p>' + dcHtml + '</div>';
  }

  _gerarDoc(html, _nomeArquivo(s, _DOC_ATUAL) + '.doc');
  salvarNoHistorico(window._padIdAtual);

  /* Salva peça no dossiê do portal */
  if (docAtual) _salvarPecaPortal(_DOC_ATUAL, docAtual.ordem, docAtual.label, html);
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
  if (_DOCS_EXIGEM_DEFESA.indexOf(_DOC_ATUAL) !== -1 && !_verificarDefesa()) return;
  var html     = el.innerHTML;
  var docAtual = DOCS.find(function(d) { return d.cod === _DOC_ATUAL; });

  if (_DOC_ATUAL === 'portaria') {
    _toast('Preparando dossiê…');
    html += await _renderizarIpenPdf();
    if (window._docInicialFiles && window._docInicialFiles.length) {
      var di = '';
      for (var i = 0; i < window._docInicialFiles.length; i++)
        di += await _renderizarArquivoComoHtml(window._docInicialFiles[i]);
      if (di) html += '<div style="page-break-before:always;">' + di + '</div>';
    }
  }
  if (_DOC_ATUAL === 'termo_cient' && window._termoCientPdfFile) {
    html += '<div style="page-break-before:always;">' + await _renderizarArquivoComoHtml(window._termoCientPdfFile) + '</div>';
  }
  if (_DOC_ATUAL === 'manif_defesa' && window._manifDefesaPdfFile) {
    html += '<div style="page-break-before:always;">' + await _renderizarArquivoComoHtml(window._manifDefesaPdfFile) + '</div>';
  }
  if (_DOC_ATUAL === 'oitiva_inc' && window._oitivaIncSignedFile) {
    var oiPdf = await _renderizarArquivoComoHtml(window._oitivaIncSignedFile);
    if (oiPdf) html += '<div style="page-break-before:always;">' + oiPdf + '</div>';
  }
  if (_DOC_ATUAL === 'oitivas_test' && window._testemunhasSignedFiles) {
    var s2 = Estado.get(); var ts2 = s2.testemunhas || [];
    for (var tj = 0; tj < ts2.length; tj++) {
      var sf2 = window._testemunhasSignedFiles[tj];
      if (sf2) { var th2 = await _renderizarArquivoComoHtml(sf2); if (th2) html += '<div style="page-break-before:always;">' + th2 + '</div>'; }
    }
  }
  if (_DOC_ATUAL === 'manifestacao' && window._manifConselhoFile) {
    var mc2 = await _renderizarArquivoComoHtml(window._manifConselhoFile);
    if (mc2) html += '<div style="page-break-before:always;">' + mc2 + '</div>';
  }
  if (_DOC_ATUAL === 'decisao' && window._decisaoPdfFile) {
    var dc2 = await _renderizarArquivoComoHtml(window._decisaoPdfFile);
    if (dc2) html += '<div style="page-break-before:always;">' + dc2 + '</div>';
  }

  _abrirImpressao(html);
  salvarNoHistorico(window._padIdAtual);

  /* Salva peça no dossiê do portal */
  if (docAtual) _salvarPecaPortal(_DOC_ATUAL, docAtual.ordem, docAtual.label, html);
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
