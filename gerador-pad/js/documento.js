/* ============================================================
   DOCUMENTO — monta o HTML completo de cada documento do PAD
   Usa table-based (thead/tfoot repetem na impressão).
   ============================================================ */

var _DOC_ATUAL = 'portaria'; // documento selecionado no preview

var DOCS = [
  { cod: 'portaria',     label: '1. Portaria de Instauração',      ordem: 1 },
  { cod: 'doc_inicial',  label: '2. Documentação Inicial',         ordem: 2 },
  { cod: 'termo_cient',  label: '3. Termo de Cientificação',       ordem: 3 },
  { cod: 'oitivas_test', label: '4. Oitiva de Testemunhas',        ordem: 4 },
  { cod: 'oitiva_inc',   label: '5. Declarações do Apenado',       ordem: 5 },
  { cod: 'manifestacao', label: '6. Manifestação do Conselho',     ordem: 6 },
  { cod: 'manif_defesa', label: '7. Manifestação da Defesa',       ordem: 7 },
  { cod: 'decisao',      label: '8. Decisão da Direção',           ordem: 8 },
  { cod: 'oficio_juiz',  label: '9. Ofício ao Juiz',               ordem: 9 },
];

function selecionarDoc(cod) {
  _DOC_ATUAL = cod;
  document.querySelectorAll('.doc-tab').forEach(function(b) {
    b.classList.toggle('ativa', b.dataset.doc === cod);
  });
  FormularioCtrl && FormularioCtrl.sincronizar();
  atualizarPreview();
}

/* ── Cabeçalho institucional ── */
function _cabecalho(s) {
  var un = s.unidade || {};
  return '<thead><tr><td class="pad-hcell">'
    + '<div class="pad-cab">'
      + '<img src="../gerador-oficios-v2/assets/brasao.png" alt="Brasão SC" onerror="this.style.display=\'none\'">'
      + '<div class="pad-cab-txt">'
        + '<span class="c1">ESTADO DE SANTA CATARINA</span>'
        + '<span class="c2">Secretaria de Estado de Justiça e Reintegração Social</span>'
        + '<span class="c3">POLÍCIA PENAL DE SANTA CATARINA</span>'
        + '<span class="c4">' + _esc(un.nome || 'UNIDADE PRISIONAL') + '</span>'
      + '</div>'
    + '</div>'
    + '</td></tr></thead>';
}

/* ── Rodapé institucional ── */
function _rodape(s) {
  var un = s.unidade || {};
  return '<tfoot><tr><td class="pad-fcell">'
    + '<div class="pad-rodape">'
      + '<div class="rod-info">'
        + '<span class="rod-dpp">POLÍCIA PENAL DE SANTA CATARINA</span>'
        + '<span class="rod-un">' + _esc(un.nome || '') + '</span>'
        + (un.end ? '<span class="rod-cont">' + _esc(un.end) + '</span>' : (un.cidade ? '<span class="rod-cont">' + _esc(un.cidade) + '</span>' : ''))
      + '</div>'
    + '</div>'
    + '</td></tr></tfoot>';
}

/* ── Monta um documento ── */
function montarDocumento(s, corpofn) {
  return '<div id="pad-preview"><table class="pad-table">'
    + _cabecalho(s)
    + _rodape(s)
    + '<tbody><tr><td class="pad-bcell">'
      + '<div class="pad-corpo">'
        + corpofn(s)
      + '</div>'
    + '</td></tr></tbody>'
    + '</table></div>';
}

/* ── Preview principal ── */
function montarPreview(s) {
  switch (_DOC_ATUAL) {
    case 'portaria':     return montarDocumento(s, tplPortaria);
    case 'doc_inicial':  return montarDocInicial(s);
    case 'termo_cient':  return montarDocumento(s, tplTermoCientificacao);
    case 'oitivas_test': return montarOitivasTestemunhas(s);
    case 'oitiva_inc':   return montarDocumento(s, tplOitivaIncidentado);
    case 'manifestacao': return montarDocumento(s, tplManifestacao);
    case 'manif_defesa': return montarDocumento(s, tplManifDefesa);
    case 'decisao':      return montarDocumento(s, tplDecisao);
    case 'oficio_juiz':  return montarDocumento(s, tplOficioJuiz);
    default:
      return '<div class="preview-placeholder"><p>Selecione um documento na barra acima.</p></div>';
  }
}

/* ── Preview da Documentação Inicial ── */
function montarDocInicial(s) {
  var di    = s.docInicial || {};
  var arqs  = di.arquivos  || [];
  var files = window._docInicialFiles || [];
  if (!arqs.length && !files.length) {
    return '<div class="preview-placeholder">'
      + '<p>📂 Nenhum arquivo carregado ainda.<br>'
      + 'Use o formulário ao lado para adicionar documentos,<br>'
      + 'fotografias, comunicações e demais provas.</p></div>';
  }
  var itens = arqs.map(function(a, i) {
    return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f3f0ee;">'
      + '<span style="font-size:1.4rem;">' + (a.tipo && a.tipo.startsWith('image') ? '🖼️' : '📄') + '</span>'
      + '<div><div style="font-size:.88rem;font-weight:600;color:#1c1917;">' + _esc(a.nome) + '</div>'
      + '<div style="font-size:.72rem;color:#78716c;">' + _esc(a.tipo || '') + '</div></div>'
      + '</div>';
  }).join('');
  return '<div style="padding:24px;font-family:\'Segoe UI\',sans-serif;">'
    + '<h3 style="font-size:.9rem;font-weight:800;color:#3b1f0a;margin-bottom:16px;">📂 Documentação Inicial — ' + arqs.length + ' arquivo(s)</h3>'
    + itens
    + '<p style="font-size:.75rem;color:#a8a29e;margin-top:14px;">Esses documentos serão incluídos após a Portaria no dossiê do advogado.</p>'
    + '</div>';
}

/* ── Oitivas de testemunhas (múltiplas) ── */
function montarOitivasTestemunhas(s) {
  var testes = s.testemunhas || [];
  if (!testes.length) {
    return '<div class="preview-placeholder"><p>Nenhuma testemunha cadastrada.<br>Adicione testemunhas na seção do formulário.</p></div>';
  }
  return testes.map(function(te, i) {
    var fn = function(s) { return tplOitivaTestemunha(s, te); };
    var html = montarDocumento(s, fn);
    return i > 0 ? '<div style="page-break-before:always;">' + html + '</div>' : html;
  }).join('');
}

/* ── Gera TODOS os documentos (para exportar tudo) ── */
function montarTodosDocumentos(s) {
  var partes = [];
  partes.push(montarDocumento(s, tplPortaria));
  // doc_inicial é incluído pelo exportar.js como imagens renderizadas
  partes.push(montarDocumento(s, tplTermoCientificacao));
  var testes = s.testemunhas || [];
  testes.forEach(function(te) {
    var fn = function(s) { return tplOitivaTestemunha(s, te); };
    partes.push(montarDocumento(s, fn));
  });
  partes.push(montarDocumento(s, tplOitivaIncidentado));
  partes.push(montarDocumento(s, tplManifestacao));
  partes.push(montarDocumento(s, tplManifDefesa));
  partes.push(montarDocumento(s, tplDecisao));
  partes.push(montarDocumento(s, tplOficioJuiz));
  return partes.map(function(h, i) {
    return i > 0 ? '<div style="page-break-before:always;">' + h + '</div>' : h;
  }).join('');
}
