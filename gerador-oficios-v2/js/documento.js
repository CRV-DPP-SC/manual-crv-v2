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
    + '<span class="c2">Secretaria de Estado da Segurança Pública</span>'
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
  var o = s ? s.ori : null;
  var tel  = o ? o.tel : '';
  var em   = o ? o.em  : '';
  var end  = o ? o.e   : '';
  return '<div class="ofc-rodape">'
    + '<div class="rod-info">'
    + '<span class="rod-dpp">Departamento de Polícia Penal — DPP</span>'
    + (o ? '<span class="rod-un">' + o.n + '</span>' : '')
    + '<span class="rod-cont">'
    + [tel, em, end].filter(Boolean).join(' · ')
    + '</span>'
    + '</div></div>';
}

/* ── Monta o HTML completo do ofício ── */
function montarOficio(s) {
  if (!s || !s.mod) return '';

  var corpo = gerarCorpo(s);
  var ec    = s.mod === 'comunicacao';

  /* ── Página 1 (e eventuais páginas intermediárias de anexos): corpo do ofício ── */
  var paginaCorpo = '<table id="oficio" class="ofc-print-table">'
    + '<thead><tr><td class="ofc-print-header">' + cab(s) + '</td></tr></thead>'
    + '<tbody><tr><td class="ofc-print-body">'
    + '<div class="oficio-corpo">'
    + numData(s) + lb(4)
    + '<div class="ofc-sau">' + (s.sau || ph('Saudação')) + '</div>' + lb(4)
    + corpo + lb(5)
    + '<div class="ofc-desp">' + (s.desp || ph('Fechamento')) + '</div>'
    + '</div>'
    + gerarAnexos(s)
    + '</td></tr></tbody>'
    + '<tfoot><tr><td class="ofc-print-footer">' + rod(s) + '</td></tr></tfoot>'
    + '</table>';

  /* ── Página de assinaturas: tabela própria com cabeçalho e rodapé ── */
  var paginaAss = '<div style="page-break-before:always;break-before:page;">'
    + '<table class="ofc-print-table" style="width:100%;">'
    + '<thead><tr><td class="ofc-print-header">' + cab(s) + '</td></tr></thead>'
    + '<tbody><tr><td class="ofc-print-body">'
    + lb(5) + blocoAss(s) + lb(2)
    + (ec ? dJuizo(s) : dCRV())
    + '</td></tr></tbody>'
    + '<tfoot><tr><td class="ofc-print-footer">' + rod(s) + '</td></tr></tfoot>'
    + '</table>'
    + '</div>';

  return paginaCorpo + paginaAss;
}

/* ── Gera todos os anexos necessários ── */
function gerarAnexos(s) {
  var html = '';
  var isMulti = s.numero === 'P' && s.reed && s.reed.length > 0;
  if (!isMulti) return html;

  /* Permuta pode ter Anexo I (origem) + Anexo II (destino) */
  if (s.mod === 'permuta') {
    var tituloI = isMulti
      ? 'Relação de Reeducandos — ' + (s.ori ? s.ori.n : 'Unidade de Origem') + ' (Unidade de Origem)'
      : null;
    if (isMulti) html += gerarAnexoTabela(s.reed, 'I', tituloI, s.saudeOpcao, true);
    if (s.permutaDes && s.permutaDes.length > 1) {
      var numII = isMulti ? 'II' : 'I';
      var tituloII = 'Relação de Reeducandos — ' + (s.des ? s.des.n : 'Unidade de Destino') + ' (Em Contrapartida)';
      var qp = isMulti ? '<div style="page-break-before:always;"></div>' : '';
      html += qp + gerarAnexoTabela(s.permutaDes, numII, tituloII, null, true);
    }
    return html;
  }

  /* Demais modalidades: só Anexo I */
  var temRegime = s.reed.some(function(r) { return r.regime && r.regime.length > 0; });
  var titulo = temRegime ? null : 'Relação de Custodiados';
  html += gerarAnexoTabela(s.reed, 'I', titulo, s.saudeOpcao, temRegime);
  return html;
}
