/* ============================================================
   DOCUMENTO — estrutura HTML do ofício em papel
   Abordagem V2: table-based com thead/tfoot repetindo em cada página.
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

  /* Comunicação: assina apenas a unidade comunicante (saída = origem; entrada = destino) */
  if (s.mod === 'comunicacao') {
    var comunicante = s.sub === 'entrada' ? d : o;
    lista.push(comunicante
      ? {n: comunicante.dir || '', cg: comunicante.cg || 'Diretor(a)', un: comunicante.n}
      : {n: ph('Nome do Diretor(a)'), cg: 'Diretor(a)', un: ph('Unidade Comunicante')});
    return lista.map(function(a, i) {
      return ass(a.n, a.cg, a.un, i === lista.length - 1);
    }).join('');
  }

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
    + '<div class="dest-l">Secretaria de Estado de Justiça e Reintegração Social</div>'
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
    tel ? 'Tel.: ' + tel : '',
    em  ? 'E-mail: ' + em : ''
  ].filter(Boolean).join(' | ');
  return '<div class="ofc-rodape">'
    + '<div class="rod-info">'
    + '<div class="rod-dpp">POLÍCIA PENAL DE SANTA CATARINA</div>'
    + (o ? '<div class="rod-un">' + o.n + '</div>' : '')
    + (end ? '<div class="rod-cont">' + end + '</div>' : '')
    + (contato ? '<div class="rod-cont">' + contato + '</div>' : '')
    + '</div></div>';
}

/* ── Monta o HTML completo do ofício ──
   Abordagem V2: table-based (thead/tfoot).
   O browser repete cabeçalho e rodapé nativamente em cada página impressa.
   Zero dependência de position:fixed ou padding-top hacks.
   ── */
function montarOficio(s) {
  if (!s || !s.mod) return '';

  /* resumo_ipen não gera ofício — mostra a pré-visualização do texto do resumo */
  if (s.mod === 'resumo_ipen') {
    return '<div style="padding:2rem;">'
      + '<div style="background:#fff;border:1px solid var(--borda);border-radius:8px;padding:1.5rem;max-width:700px;margin:0 auto;">'
        + '<div style="font-size:.75rem;font-weight:700;color:var(--azul);text-transform:uppercase;letter-spacing:.03em;margin-bottom:10px;">📄 Pré-visualização do Resumo Sintético</div>'
        + '<p style="font-size:.9rem;line-height:1.7;text-align:justify;color:var(--texto);">' + _esc(gerarTextoResumo(s)) + '</p>'
      + '</div>'
      + '<p style="text-align:center;font-size:.8rem;color:#888;margin-top:14px;">Este modo não gera ofício. Clique em <strong>📄 Resumo IPEN</strong> para copiar o texto.</p>'
      + '</div>';
  }

  var corpoPs = gerarCorpo(s);
  var ec      = s.mod === 'comunicacao';
  var anexos  = _gerarAnexos(s);

  /* Cada bloco do corpo vira uma <tr> própria — a quebra de página do
     navegador cai sempre ENTRE linhas (bem suportado), nunca no meio de
     uma única célula gigante (que é onde o cabeçalho "pulava" para o
     meio do texto na 2ª página). O último parágrafo do corpo leva o
     espaçamento maior (lb(4)) que antes ficava depois do bloco inteiro. */
  var blocos = [numData(s) + lb(4), '<div class="ofc-sau">' + (s.sau || ph('Saudação')) + '</div>' + lb(4)]
    .concat(corpoPs.map(function(par, i) {
      return par + (i === corpoPs.length - 1 ? lb(4) : lb(1));
    }))
    .concat([
      '<div class="ofc-desp">' + (s.desp || ph('Fechamento')) + '</div>' + lb(5),
      blocoAss(s) + lb(4),
      ec ? dJuizo(s) : dCRV(),
    ]);

  var linhas = blocos.map(function(conteudo, i) {
    return '<tr><td class="ofc-bcell' + (i === 0 ? ' ofc-bcell-primeira' : '') + '">' + conteudo + '</td></tr>';
  }).join('');

  return '<div id="oficio">'
    + '<table class="ofc-table">'
      /* ── Cabeçalho — repete em cada página ── */
      + '<thead><tr><td class="ofc-hcell">' + cab(s) + '</td></tr></thead>'
      /* ── Rodapé — repete em cada página ── */
      + '<tfoot><tr><td class="ofc-fcell">' + rod(s) + '</td></tr></tfoot>'
      /* ── Corpo — uma linha por bloco ── */
      + '<tbody>' + linhas + '</tbody>'
    + '</table>'
    + anexos
    + '</div>';
}

/* ── Envolve o conteúdo do anexo em uma ofc-table com thead/tfoot
   garantindo que cabeçalho e rodapé repitam na(s) página(s) do anexo ── */
function _wrapAnexoNaTabela(s, innerHtml) {
  return '<table class="ofc-table ofc-table-anexo">'
    + '<thead><tr><td class="ofc-hcell">' + cab(s) + '</td></tr></thead>'
    + '<tfoot><tr><td class="ofc-fcell">' + rod(s) + '</td></tr></tfoot>'
    + '<tbody><tr><td class="ofc-bcell">' + innerHtml + '</td></tr></tbody>'
    + '</table>';
}

/* ── Gera anexos envolvidos em tabela com cabeçalho e rodapé ── */
function _gerarAnexos(s) {
  var isMulti = s.numero === 'P' && s.reed && s.reed.length > 0;
  if (!isMulti) return '';

  var html = '';
  if (s.mod === 'permuta') {
    var tituloI = 'Relação de Reeducandos — ' + (s.ori ? s.ori.n : 'Unidade de Origem') + ' (Unidade de Origem)';
    html += '<div class="page-break-preview ofc-no-print">— Nova página: Anexo I —</div>'
          + _wrapAnexoNaTabela(s, gerarAnexoTabela(s.reed, 'I', tituloI, s.saudeOpcao, true, true));
    if (s.permutaDes && s.permutaDes.length > 1) {
      var tituloII = 'Relação de Reeducandos — ' + (s.des ? s.des.n : 'Unidade de Destino') + ' (Em Contrapartida)';
      html += '<div class="page-break-preview ofc-no-print">— Nova página: Anexo II —</div>'
            + _wrapAnexoNaTabela(s, gerarAnexoTabela(s.permutaDes, 'II', tituloII, null, true, true));
    }
  } else {
    var temRegime = s.reed.some(function(r) { return r.regime && r.regime.length > 0; });
    var titulo    = temRegime ? null : 'Relação de Custodiados';
    html += '<div class="page-break-preview ofc-no-print">— Nova página: Anexo I —</div>'
          + _wrapAnexoNaTabela(s, gerarAnexoTabela(s.reed, 'I', titulo, s.saudeOpcao, temRegime, true));
  }
  return html;
}
