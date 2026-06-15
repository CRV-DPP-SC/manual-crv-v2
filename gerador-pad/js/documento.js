/* ============================================================
   DOCUMENTO — monta o HTML completo de cada documento do PAD
   Usa table-based (thead/tfoot repetem na impressão).
   ============================================================ */

var _DOC_ATUAL = 'portaria'; // documento selecionado no preview

var DOCS = [
  { cod: 'portaria',         label: '1. Portaria de Instauração' },
  { cod: 'oitiva_inc',       label: '2. Oitiva do Incidentado' },
  { cod: 'oitivas_test',     label: '3. Oitiva das Testemunhas' },
  { cod: 'manifestacao',     label: '4. Manifestação do Conselho' },
  { cod: 'decisao',          label: '5. Decisão da Direção' },
  { cod: 'oficio_vep',       label: '6. Ofício à VEP' },
  { cod: 'oficio_juiz',      label: '7. Ofício ao Juiz' },
];

function selecionarDoc(cod) {
  _DOC_ATUAL = cod;
  document.querySelectorAll('.doc-tab').forEach(function(b) {
    b.classList.toggle('ativa', b.dataset.doc === cod);
  });
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
    + '<div class="pad-cab-linha"></div>'
    + '</td></tr></thead>';
}

/* ── Rodapé institucional ── */
function _rodape(s) {
  var un = s.unidade || {};
  return '<tfoot><tr><td class="pad-fcell">'
    + '<div class="pad-cab-linha"></div>'
    + '<div class="pad-rodape">'
      + '<div class="rod-info">'
        + '<span class="rod-dpp">POLÍCIA PENAL DE SANTA CATARINA</span>'
        + '<span class="rod-un">' + _esc(un.nome || '') + '</span>'
        + (un.cidade ? '<span class="rod-cont">' + _esc(un.cidade) + '</span>' : '')
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
    case 'portaria':
      return montarDocumento(s, tplPortaria);
    case 'oitiva_inc':
      return montarDocumento(s, tplOitivaIncidentado);
    case 'oitivas_test':
      return montarOitivasTestemunhas(s);
    case 'manifestacao':
      return montarDocumento(s, tplManifestacao);
    case 'decisao':
      return montarDocumento(s, tplDecisao);
    case 'oficio_vep':
      return montarDocumento(s, tplOficioVep);
    case 'oficio_juiz':
      return montarDocumento(s, tplOficioJuiz);
    default:
      return '<div class="preview-placeholder"><p>Selecione um documento na barra acima.</p></div>';
  }
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
  partes.push(montarDocumento(s, tplOitivaIncidentado));
  var testes = s.testemunhas || [];
  testes.forEach(function(te) {
    var fn = function(s) { return tplOitivaTestemunha(s, te); };
    partes.push(montarDocumento(s, fn));
  });
  partes.push(montarDocumento(s, tplManifestacao));
  partes.push(montarDocumento(s, tplDecisao));
  partes.push(montarDocumento(s, tplOficioVep));
  partes.push(montarDocumento(s, tplOficioJuiz));
  return partes.map(function(h, i) {
    return i > 0 ? '<div style="page-break-before:always;">' + h + '</div>' : h;
  }).join('');
}
