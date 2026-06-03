/* ============================================================
   DOCUMENTO — estrutura HTML do ofício em papel
   Funções puras: recebem estado (s) e retornam HTML.
   ============================================================ */

/* ── Cabeçalho ── */
function cab(s) {
  var ori = s.ori || null;
  var nomeUn = ori ? ori.n : ph('Unidade de Origem');
  return '<div class="ofc-cab">'
    + '<img src="assets/brasao.png" alt="Brasão SC">'
    + '<div class="ofc-cab-txt">'
    + '<span class="c1">Estado de Santa Catarina</span>'
    + '<span class="c2">Secretaria de Estado de Justiça e Reintegração Social</span>'
    + '<span class="c3">Departamento de Polícia Penal</span>'
    + '<span class="c4">' + nomeUn + '</span>'
    + '</div>'
    + '</div>';
}

/* ── Linha número / data ── */
function numData(s) {
  var cidade = s.ori ? s.ori.c : '';
  var data = dHoje(cidade);
  if (s.numOficio) {
    return '<div class="ofc-numdata">'
      + '<span class="ofc-num">' + s.numOficio + '</span>'
      + '<span class="ofc-data">' + data + '</span>'
      + '</div>';
  }
  return '<div class="ofc-data-only">' + data + '</div>';
}

/* ── Bloco de assinatura individual ── */
function ass(nome, cargo, unidade, ultimo) {
  return '<div class="ass-bloco">'
    + '<div class="ass-dig">(Assinado digitalmente)</div>'
    + '<div class="ass-nome">' + (nome || '___________________________') + '</div>'
    + '<div class="ass-cargo">' + cargo + '</div>'
    + (unidade ? '<div class="ass-cargo">' + unidade + '</div>' : '')
    + '</div>'
    + (ultimo ? '' : lb(2));
}

/* ── Bloco de assinaturas completo ── */
function blocoAss(s) {
  var o = s.ori, d = s.des, lista = [];
  if (o) lista.push({n: o.dir || '', cg: o.cg || 'Diretor(a)', un: o.n});
  if (s.dd && d) lista.push({n: d.dir || '', cg: d.cg || 'Diretor(a)', un: d.n});
  if (s.sro && o) {
    var so = SR[o.sr];
    lista.push({n: so ? so.s : '', cg: 'Superintendente Regional', un: so ? so.nome : ''});
  }
  if (s.srd && d) {
    var sd = SR[d.sr];
    lista.push({n: sd ? sd.s : '', cg: 'Superintendente Regional', un: sd ? sd.nome : ''});
  }
  if (lista.length === 0) {
    lista.push({n: ph('Nome do Diretor(a)'), cg: 'Diretor(a)', un: ph('Unidade de Origem')});
  }
  return lista.map(function(a, i) {
    return ass(a.n, a.cg, a.un, i === lista.length - 1);
  }).join('');
}

/* ── Destinatário CRV ── */
function dCRV() {
  return '<div class="ofc-dest-wrap"><div class="ofc-dest">'
    + '<div class="dest-t">À</div>'
    + '<div class="dest-n">CENTRAL DE REGULAÇÃO DE VAGAS</div>'
    + '<div class="dest-l">Departamento de Polícia Penal</div>'
    + '<div class="dest-l">Florianópolis/SC</div>'
    + '</div></div>';
}

/* ── Destinatário Juízo ── */
function dJuizo(s) {
  return '<div class="ofc-dest-wrap"><div class="ofc-dest">'
    + '<div class="dest-t">Ao(À) Senhor(a)</div>'
    + '<div class="dest-n">Dr(a). ' + (s.nomejuiz ? s.nomejuiz.toUpperCase() : ph('Nome do(a) Juiz(a)').toUpperCase()) + '</div>'
    + '<div class="dest-l">Juiz(a) de Direito</div>'
    + (s.vara ? '<div class="dest-l">' + s.vara + '</div>' : '')
    + (s.cidJuizo ? '<div class="dest-l">' + s.cidJuizo + '</div>' : '')
    + '</div></div>';
}

/* ── Rodapé ── */
function rod(s) {
  var o   = s ? s.ori : null;
  var tel = o ? o.tel : '';
  var em  = o ? o.em  : '';
  var end = o ? o.e   : '';
  var contato = [
    tel ? 'Fone: ' + tel : '',
    em  ? 'e-mail: ' + em : ''
  ].filter(Boolean).join(' / ');
  return '<div class="ofc-rodape">'
    + '<div class="rod-linha"></div>'
    + '<div class="rod-info">'
    + '<span class="rod-dpp">Polícia Penal de Santa Catarina</span>'
    + (end ? '<span class="rod-end">' + end + '</span>' : '')
    + (contato ? '<span class="rod-cont">' + contato + '</span>' : '')
    + '</div></div>';
}

/* ── Monta o HTML completo do ofício ── */
function montarOficio(s) {
  if (!s || !s.mod) return '';

  /* resumo_ipen não gera ofício — exibe apenas instrução */
  if (s.mod === 'resumo_ipen') {
    return '<div class="preview-placeholder" style="padding:2rem;">'
      + '<p>Este modo gera apenas o <strong>Resumo Sintético IPEN</strong>.<br>'
      + 'Preencha os campos e clique em <strong>📄 Resumo IPEN</strong> para visualizar e copiar o texto.</p>'
      + '</div>';
  }

  var corpo = gerarCorpo(s);
  var ec    = s.mod === 'comunicacao';

  /*
   * Estrutura correta (baseada no modelo oficial PPSC):
   * 1. Tabela principal: cabeçalho + corpo + fechamento + assinatura + destinatário + rodapé
   * 2. Páginas de anexos (se houver): cada uma em tabela própria com cabeçalho e rodapé
   */
  var paginaPrincipal = '<table id="oficio" class="ofc-print-table">'
    + '<thead><tr><td class="ofc-print-header">' + cab(s) + '</td></tr></thead>'
    + '<tbody><tr><td class="ofc-print-body">'
    + '<div class="oficio-corpo">'
    + numData(s) + lb(4)
    + '<div class="ofc-sau">' + (s.sau || ph('Saudação')) + '</div>' + lb(4)
    + corpo + lb(4)
    + '<div class="ofc-desp">' + (s.desp || ph('Fechamento')) + '</div>' + lb(5)
    + blocoAss(s) + lb(2)
    + (ec ? dJuizo(s) : dCRV())
    + '</div>'
    + '</td></tr></tbody>'
    + '<tfoot><tr><td class="ofc-print-footer">' + rod(s) + '</td></tr></tfoot>'
    + '</table>';

  return paginaPrincipal + _gerarPaginasAnexos(s);
}

/* ── Gera páginas de anexos (APÓS a assinatura), cada uma com cabeçalho e rodapé ── */
function _gerarPaginasAnexos(s) {
  var isMulti = s.numero === 'P' && s.reed && s.reed.length > 0;
  if (!isMulti) return '';

  function _paginaAnexo(conteudo) {
    return '<div style="page-break-before:always;break-before:page;">'
      + '<table class="ofc-print-table" style="width:100%;">'
      + '<thead><tr><td class="ofc-print-header">' + cab(s) + '</td></tr></thead>'
      + '<tbody><tr><td class="ofc-print-body" style="padding-top:0.4cm;">' + conteudo + '</td></tr></tbody>'
      + '<tfoot><tr><td class="ofc-print-footer">' + rod(s) + '</td></tr></tfoot>'
      + '</table></div>';
  }

  var html = '';
  if (s.mod === 'permuta') {
    var tituloI = 'Relação de Reeducandos — ' + (s.ori ? s.ori.n : 'Unidade de Origem') + ' (Unidade de Origem)';
    html += _paginaAnexo(gerarAnexoTabela(s.reed, 'I', tituloI, s.saudeOpcao, true, true));
    if (s.permutaDes && s.permutaDes.length > 1) {
      var tituloII = 'Relação de Reeducandos — ' + (s.des ? s.des.n : 'Unidade de Destino') + ' (Em Contrapartida)';
      html += _paginaAnexo(gerarAnexoTabela(s.permutaDes, 'II', tituloII, null, true, true));
    }
  } else {
    var temRegime = s.reed.some(function(r) { return r.regime && r.regime.length > 0; });
    var titulo    = temRegime ? null : 'Relação de Custodiados';
    html += _paginaAnexo(gerarAnexoTabela(s.reed, 'I', titulo, s.saudeOpcao, temRegime, true));
  }
  return html;
}
