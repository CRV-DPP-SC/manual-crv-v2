/* ============================================================
   MODAL COMUNICAÇÃO JUDICIAL (CJ)
   ============================================================ */

var CJ = { presos: [], selecionados: [], ofHtmls: [], paginaAtual: 0 };
var MODS_COM_JUD = ['emergencial', 'mandado', 'adequacao', 'ajuste_lotacional', 'permuta', 'retorno_saida_temporaria', 'prisaocivil'];

function _presosDoOficio() {
  var s = Estado.get();
  var lista = [];
  if (s.reed && s.reed.length > 0) {
    s.reed.forEach(function(r) { lista.push({nome: r.nome, ipen: r.ipen}); });
  } else if (s.nome) {
    lista.push({nome: s.nome, ipen: s.ipen});
  }
  return lista;
}

function atualizarBotaoCJ() {
  var btn = document.getElementById('btnComunicarJud');
  if (!btn) return;
  var s = Estado.get();
  btn.style.display = MODS_COM_JUD.indexOf(s.mod) >= 0 ? '' : 'none';
}

function abrirModalCJ() {
  CJ.presos       = _presosDoOficio();
  CJ.selecionados = CJ.presos.map(function(_, i) { return i; });
  CJ.ofHtmls      = [];
  CJ.paginaAtual  = 0;
  _renderizarCJForm();
  document.getElementById('mcjBg').classList.add('open');
}

function fecharModalCJ() {
  document.getElementById('mcjBg').classList.remove('open');
}

function _renderizarCJForm() {
  var body = document.getElementById('mcjBody');
  var foot = document.getElementById('mcjFoot');
  var multi = CJ.presos.length > 1;

  var listHtml = CJ.presos.map(function(p, i) {
    var sel = CJ.selecionados.indexOf(i) >= 0;
    return '<div class="mcj-preso-item' + (sel ? ' sel' : '') + '" id="mcjPreso' + i + '" onclick="_togglePresoCJ(' + i + ')">'
      + '<input type="checkbox"' + (sel ? ' checked' : '') + ' onclick="event.stopPropagation();_togglePresoCJ(' + i + ')">'
      + '<div><div class="mcj-preso-nome">' + _esc(p.nome) + '</div><div class="mcj-preso-ipen">IPEN ' + _esc(p.ipen) + '</div></div>'
      + '</div>';
  }).join('');

  /* Campos de juízo */
  var juizHtml = '';
  if (multi) {
    juizHtml += '<div class="mcj-juiz-modo">'
      + '<button id="mcjMesmoJuiz" class="mcj-chip sel" onclick="_setModoJuiz(\'mesmo\')">Mesmo juiz para todos</button>'
      + '<button id="mcjJuizIndiv" class="mcj-chip" onclick="_setModoJuiz(\'individual\')">Individual por preso</button>'
      + '</div>'
      + '<div id="mcjJuizArea">' + _juizUnico() + '</div>';
  } else {
    juizHtml = _juizParaPreso(0, '');
  }

  body.innerHTML =
    (multi ? '<div class="mcj-secao"><div class="mcj-secao-label">Reeducandos</div>'
      + '<div class="mcj-presos-list">' + listHtml + '</div></div>' : '')
    + '<div class="mcj-secao">'
      + '<label class="mcj-label">Data da transferência</label>'
      + '<input class="mcj-input" id="mcjDataTrans" type="text" placeholder="Ex.: 31/05/2026">'
    + '</div>'
    + '<div class="mcj-secao">'
      + '<label class="mcj-label">Motivo da transferência</label>'
      + '<textarea class="mcj-input" id="mcjMotivo" rows="2" placeholder="Ex.: A unidade de destino é competente..."></textarea>'
    + '</div>'
    + '<div class="mcj-secao">'
      + '<label class="mcj-label">Juízo</label>'
      + juizHtml
    + '</div>'
    + '<div class="mcj-secao">'
      + '<label class="mcj-label">Gênero do(a) Juiz(a)</label>'
      + '<div class="mcj-row2" style="gap:8px;">'
        + '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="radio" name="mcjGenJuiz" id="mcjGenM" value="M" checked onchange="_mcjAtualizarSau()"> Masculino</label>'
        + '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="radio" name="mcjGenJuiz" id="mcjGenF" value="F" onchange="_mcjAtualizarSau()"> Feminino</label>'
      + '</div>'
    + '</div>'
    + '<div class="mcj-row2">'
      + '<div><label class="mcj-label">Saudação</label>'
        + '<select class="mcj-input" id="mcjSau"><option value="Senhor Juiz,">Senhor Juiz,</option><option value="Excelentíssimo Senhor Juiz,">Excelentíssimo...</option></select></div>'
      + '<div><label class="mcj-label">Fechamento</label>'
        + '<select class="mcj-input" id="mcjDesp"><option value="Respeitosamente,">Respeitosamente,</option><option value="Atenciosamente,">Atenciosamente,</option></select></div>'
    + '</div>'
    + '<div class="mcj-secao">'
      + '<label class="mcj-label">Nº do processo (opcional)</label>'
      + '<input class="mcj-input" id="mcjNumProcesso" placeholder="Ex.: 0001234-00.2026.8.24.0050">'
    + '</div>'
    + '<div class="mcj-secao">'
      + '<label class="mcj-label">Nº do ofício (opcional)</label>'
      + '<input class="mcj-input" id="mcjNumOficio" placeholder="Ex.: Ofício nº 044/2026/DPP">'
    + '</div>';

  foot.innerHTML =
    '<button class="btn-acao btn-sec" onclick="fecharModalCJ()">Fechar</button>'
    + '<button class="btn-acao btn-pri" onclick="gerarOficiosCJ()">Gerar Ofício(s) →</button>';
}

function _juizUnico() {
  return '<div id="mcjJuizUnico">'
    + '<input class="mcj-input" id="mcjJuizUnicoVal" placeholder="Nome do(a) Juiz(a)">'
    + '<input class="mcj-input" style="margin-top:6px" id="mcjVaraUnicoVal" placeholder="Vara / Unidade Judiciária">'
    + '<input class="mcj-input" style="margin-top:6px" id="mcjCidUnicoVal" placeholder="Cidade/UF">'
    + '</div>';
}

function _juizParaPreso(pi, nome) {
  return '<div class="mcj-juiz-preso" id="mcjJuizBloco' + pi + '">'
    + (nome ? '<div class="mcj-preso-label">' + _esc(nome) + '</div>' : '')
    + '<input class="mcj-input" id="mcjJuiz' + pi + '" placeholder="Nome do(a) Juiz(a)">'
    + '<input class="mcj-input" style="margin-top:6px" id="mcjVara' + pi + '" placeholder="Vara / Unidade Judiciária">'
    + '<input class="mcj-input" style="margin-top:6px" id="mcjCid' + pi + '" placeholder="Cidade/UF">'
    + '</div>';
}

function _setModoJuiz(modo) {
  var area = document.getElementById('mcjJuizArea');
  document.getElementById('mcjMesmoJuiz').classList.toggle('sel', modo === 'mesmo');
  document.getElementById('mcjJuizIndiv').classList.toggle('sel', modo === 'individual');
  if (modo === 'mesmo') {
    area.innerHTML = _juizUnico();
  } else {
    area.innerHTML = CJ.selecionados.map(function(pi) {
      return _juizParaPreso(pi, CJ.presos[pi] ? CJ.presos[pi].nome : '');
    }).join('');
  }
}

function _togglePresoCJ(i) {
  var idx = CJ.selecionados.indexOf(i);
  if (idx >= 0) CJ.selecionados.splice(idx, 1);
  else CJ.selecionados.push(i);
  var el = document.getElementById('mcjPreso' + i);
  if (el) {
    el.classList.toggle('sel', CJ.selecionados.indexOf(i) >= 0);
    var cb = el.querySelector('input[type=checkbox]');
    if (cb) cb.checked = CJ.selecionados.indexOf(i) >= 0;
  }
}

function _mcjAtualizarSau() {
  var gen = document.querySelector('input[name="mcjGenJuiz"]:checked');
  var f = gen && gen.value === 'F';
  var sel = document.getElementById('mcjSau');
  if (!sel) return;
  var val = sel.value;
  sel.innerHTML = f
    ? '<option value="Senhora Juíza,">Senhora Juíza,</option><option value="Excelentíssima Senhora Juíza,">Excelentíssima...</option>'
    : '<option value="Senhor Juiz,">Senhor Juiz,</option><option value="Excelentíssimo Senhor Juiz,">Excelentíssimo...</option>';
  /* tenta preservar seleção equivalente */
  if (val.startsWith('Excelent')) sel.selectedIndex = 1;
}

function gerarOficiosCJ() {
  var dataTrans  = (document.getElementById('mcjDataTrans').value  || '').trim();
  var motivo     = (document.getElementById('mcjMotivo').value     || '').trim();
  var numOficio  = (document.getElementById('mcjNumOficio').value  || '').trim();
  var numProc    = (document.getElementById('mcjNumProcesso').value|| '').trim();
  var sau        = document.getElementById('mcjSau').value;
  var desp       = document.getElementById('mcjDesp').value;
  var genJuiz    = (document.querySelector('input[name="mcjGenJuiz"]:checked') || {}).value || 'M';

  if (!dataTrans) { _toast('Informe a data da transferência!'); return; }

  var s = Estado.get();
  var o = s.ori;
  var multi = CJ.presos.length > 1;
  var presosParaGerar = multi ? CJ.selecionados.map(function(i) { return CJ.presos[i]; }) : CJ.presos;

  if (multi && presosParaGerar.length === 0) { _toast('Selecione ao menos um preso!'); return; }

  /* Agrupa por juízo */
  var mesmoJuiz = multi && document.getElementById('mcjMesmoJuiz') && document.getElementById('mcjMesmoJuiz').classList.contains('sel');
  var grupos = {};

  if (mesmoJuiz) {
    var j = (document.getElementById('mcjJuizUnicoVal') || {}).value || '';
    var v = (document.getElementById('mcjVaraUnicoVal') || {}).value || '';
    var c = (document.getElementById('mcjCidUnicoVal')  || {}).value || '';
    if (!j) { _toast('Informe o nome do(a) Juiz(a)!'); return; }
    grupos['unico'] = {presos: presosParaGerar, juiz: j, vara: v, cid: c};
  } else if (!multi) {
    var j0 = (document.getElementById('mcjJuiz0') || {}).value || '';
    if (!j0) { _toast('Informe o nome do(a) Juiz(a)!'); return; }
    grupos['0'] = {presos: presosParaGerar, juiz: j0, vara: (document.getElementById('mcjVara0')||{}).value||'', cid: (document.getElementById('mcjCid0')||{}).value||''};
  } else {
    presosParaGerar.forEach(function(p, localIdx) {
      var pi = CJ.selecionados[localIdx];
      var jj = (document.getElementById('mcjJuiz' + pi) || {}).value || '';
      if (!jj) { _toast('Informe o juízo para: ' + p.nome); return; }
      var chave = jj + '|' + ((document.getElementById('mcjVara'+pi)||{}).value||'');
      if (!grupos[chave]) grupos[chave] = {presos: [], juiz: jj, vara: (document.getElementById('mcjVara'+pi)||{}).value||'', cid: (document.getElementById('mcjCid'+pi)||{}).value||''};
      grupos[chave].presos.push(p);
    });
  }

  var listaGrupos = Object.values(grupos).filter(function(g) { return g && g.presos && g.presos.length > 0; });
  if (listaGrupos.length === 0) { _toast('Preencha os dados do(a) Juiz(a)!'); return; }

  CJ.ofHtmls = listaGrupos.map(function(grp, gi) {
    return _montarOficioCJ({
      presos:    grp.presos,
      juiz:      grp.juiz,
      vara:      grp.vara,
      cidJuizo:  grp.cid,
      dataTrans:  dataTrans,
      motivo:     motivo,
      numOficio:  numOficio + (listaGrupos.length > 1 ? ' (' + (gi + 1) + '/' + listaGrupos.length + ')' : ''),
      numProc:    numProc,
      sau:        sau,
      desp:       desp,
      genJuiz:    genJuiz,
      ori:        o,
      des:        Estado.get('des'),
    });
  });

  CJ.paginaAtual = 0;
  _renderizarCJPreview();
}

function _montarOficioCJ(cfg) {
  var o = cfg.ori;

  /* Reutiliza cab() / numData() / rod() com estado mínimo */
  var sMini = {ori: o, des: cfg.des || Estado.get('des'), numOficio: cfg.numOficio, sau: cfg.sau, desp: cfg.desp, dd: false, sro: false, srd: false};

  /* Número + data — igual a numData() */
  var ndHTML = numData(sMini);

  /* Presos */
  var txtPresos;
  var anexoHTML = '';
  if (cfg.presos.length === 1) {
    txtPresos = 'o(a) custodiado(a) <strong>' + _esc(cfg.presos[0].nome.toUpperCase()) + '</strong>, IPEN nº <strong>' + _esc(cfg.presos[0].ipen) + '</strong>, foi transferido(a)';
  } else {
    txtPresos = 'os(as) custodiados(as) relacionados(as) no <strong>Anexo I</strong> deste ofício foram transferidos(as)';
    anexoHTML = '<div class="page-break-preview ofc-no-print">— Nova página: Anexo I —</div>'
      + gerarAnexoTabela(cfg.presos.map(function(pr) { return {nome: pr.nome, ipen: pr.ipen}; }), 'I', 'Relação de Custodiados', null, false);
  }

  var destCidade = o ? o.c + '/SC' : '';
  var nomeDestinoCJ = cfg.des ? cfg.des.n : (Estado.get('des') ? Estado.get('des').n : '');
  var motivo = cfg.motivo ? '<strong>' + _esc(cfg.motivo) + '</strong>' : ph('motivo da transferência');
  var fem = cfg.genJuiz === 'F';

  /* Processo no texto (individual) ou na tabela (múltiplos — tratado em gerarAnexoTabela) */
  var procTexto = cfg.numProc
    ? (cfg.presos.length === 1 ? ', autos do Processo nº <strong>' + _esc(cfg.numProc) + '</strong>' : '')
    : '';

  var p1 = 'Comunica-se a Vossa Excelência que ' + txtPresos + ' desta unidade — <strong>' + _esc(o ? o.n : '') + '</strong> — para <strong>' + _esc(nomeDestinoCJ) + '</strong>, em ' + _esc(destCidade) + ', na data de <strong>' + _esc(cfg.dataTrans) + '</strong>' + procTexto + ', nos termos do art. 16 da Resolução Conjunta Interinstitucional n. 01/2026.';
  var p2 = 'A transferência foi autorizada pela Central de Regulação de Vagas — CRV/DPP, em razão de que ' + motivo + '.';

  /* Destinatário com gênero definido */
  var destHtml = '<div class="ofc-dest-wrap"><div class="ofc-dest">'
    + '<div class="dest-t">' + (fem ? 'À Senhora' : 'Ao Senhor') + '</div>'
    + '<div class="dest-n">' + (fem ? 'Dra. ' : 'Dr. ') + _esc((cfg.juiz || '').toUpperCase()) + '</div>'
    + '<div class="dest-l">' + (fem ? 'Juíza de Direito' : 'Juiz de Direito') + '</div>'
    + (cfg.vara     ? '<div class="dest-l">' + _esc(cfg.vara)     + '</div>' : '')
    + (cfg.cidJuizo ? '<div class="dest-l">' + _esc(cfg.cidJuizo) + '</div>' : '')
    + '</div></div>';

  var assHTML = o ? ass(o.dir, o.cg, o.n, true) : '';

  /* Processo no anexo (múltiplos presos): adiciona coluna extra */
  if (cfg.presos.length > 1 && cfg.numProc) {
    /* Redefine o anexo com coluna de processo */
    var presosComProc = cfg.presos.map(function(pr) {
      return {nome: pr.nome, ipen: pr.ipen, processo: cfg.numProc};
    });
    var td = 'padding:5pt 7pt;border:0.5pt solid #aab;font-size:9.5pt;font-family:Arial,sans-serif;';
    var th = 'padding:6pt 7pt;border:0.5pt solid #aab;font-size:9.5pt;font-family:Arial,sans-serif;';
    var linhas = presosComProc.map(function(pr, i) {
      var bg = i % 2 === 0 ? '#f5f8ff' : '#ffffff';
      return '<tr style="background:' + bg + '">'
        + '<td style="' + td + 'text-align:center;">' + (i+1) + '</td>'
        + '<td style="' + td + 'font-weight:bold;">' + _esc(pr.nome.toUpperCase()) + '</td>'
        + '<td style="' + td + 'text-align:center;">' + _esc(pr.ipen) + '</td>'
        + '<td style="' + td + '">' + _esc(pr.processo) + '</td>'
        + '</tr>';
    }).join('');
    anexoHTML = '<div class="page-break-preview ofc-no-print">— Nova página: Anexo I —</div>'
      + '<div class="anexo-wrapper" style="font-family:Arial,sans-serif;">'
      + '<div style="padding:8pt 0 10pt 0;text-align:center;">'
      + '<div style="font-size:12pt;font-weight:bold;text-transform:uppercase;letter-spacing:1pt;">ANEXO I</div>'
      + '<div style="font-size:10pt;margin-top:4pt;">Relação de Custodiados</div></div>'
      + '<table class="anexo-tabela"><thead><tr style="background:#0d2b55;color:#fff;">'
      + '<th style="' + th + 'text-align:center;">#</th>'
      + '<th style="' + th + 'text-align:left;">Nome</th>'
      + '<th style="' + th + 'text-align:center;">IPEN</th>'
      + '<th style="' + th + '">Nº do Processo</th>'
      + '</tr></thead><tbody>' + linhas + '</tbody></table></div>';
  }

  return '<table class="ofc-table">'
    + '<thead><tr><td class="ofc-hcell">' + cab(sMini) + '</td></tr></thead>'
    + '<tfoot><tr><td class="ofc-fcell">' + rod(sMini) + '</td></tr></tfoot>'
    + '<tbody><tr><td class="ofc-bcell">'
      + '<div class="oficio-corpo">'
      + ndHTML + lb(4)
      + '<div class="ofc-sau">' + _esc(cfg.sau) + '</div>' + lb(4)
      + p(p1) + lb(1)
      + p(p2) + lb(4)
      + '<div class="ofc-desp">' + _esc(cfg.desp) + '</div>' + lb(5)
      + assHTML + lb(4)
      + destHtml
      + '</div>'
    + '</td></tr></tbody>'
    + '</table>'
    + anexoHTML;
}

function _renderizarCJPreview() {
  var body = document.getElementById('mcjBody');
  var foot = document.getElementById('mcjFoot');
  var total = CJ.ofHtmls.length;
  var i     = CJ.paginaAtual;

  body.innerHTML =
    (total > 1
      ? '<div class="mcj-paginacao">'
          + '<button class="btn-pg" ' + (i === 0 ? 'disabled' : '') + ' onclick="CJ.paginaAtual--;_renderizarCJPreview()">← Anterior</button>'
          + '<span>Ofício ' + (i+1) + ' de ' + total + '</span>'
          + '<button class="btn-pg" ' + (i === total-1 ? 'disabled' : '') + ' onclick="CJ.paginaAtual++;_renderizarCJPreview()">Próximo →</button>'
        + '</div>'
      : '')
    + '<div class="mcj-oficio-wrap"><div id="oficio">' + (CJ.ofHtmls[i] || '') + '</div></div>';

  foot.innerHTML =
    '<button class="btn-acao btn-sec" onclick="_renderizarCJForm()">← Voltar</button>'
    + '<button class="btn-acao btn-sec" onclick="_cjCopiar()">📋 Copiar</button>'
    + '<button class="btn-acao btn-sec" onclick="_cjDoc()">📄 .doc</button>'
    + '<button class="btn-acao btn-sec" id="btnCJEditar" onclick="_cjEditar()">✏ Editar</button>'
    + '<button class="btn-acao btn-sec" onclick="_cjPDF()">⬇ PDF</button>'
    + '<button class="btn-acao btn-pri" onclick="fecharModalCJ()">Fechar</button>';
}

function _cjCopiar() {
  var el = document.querySelector('.mcj-oficio-wrap #oficio');
  if (!el) return;
  var range = document.createRange(); range.selectNode(el);
  window.getSelection().removeAllRanges(); window.getSelection().addRange(range);
  try { document.execCommand('copy'); _toast('Copiado!'); } catch(e) { _toast('Erro ao copiar.'); }
  window.getSelection().removeAllRanges();
}

function _cjEditar() {
  var el = document.querySelector('.mcj-oficio-wrap #oficio');
  var btn = document.getElementById('btnCJEditar');
  if (!el || !btn) return;
  if (el.contentEditable === 'true') {
    el.contentEditable = 'false';
    el.style.outline = '';
    btn.textContent = '✏ Editar';
    _toast('Edição salva.');
  } else {
    el.contentEditable = 'true';
    el.style.outline = '2px solid #2563b0';
    el.focus();
    btn.textContent = '✔ Salvar';
    _toast('Clique no texto para editar. Salvar quando terminar.');
  }
}

function _cjPDF() {
  var el = document.querySelector('.mcj-oficio-wrap #oficio');
  if (!el) return;
  var css = getCSS();
  var janela = window.open('', '_blank');
  if (!janela) { _toast('Permita pop-ups para gerar o PDF.'); return; }
  janela.document.write(
    '<html><head><meta charset="UTF-8"><title>Ofício CJ</title>'
    + '<style>' + css + '</style></head><body>'
    + el.outerHTML
    + '<scr' + 'ipt>window.onload=function(){window.print();}<\/scr' + 'ipt></body></html>'
  );
  janela.document.close();
  _toast('Janela de impressão/PDF aberta!');
}

function _cjDoc() {
  var el = document.querySelector('.mcj-oficio-wrap #oficio');
  if (!el) return;
  var blob = new Blob(['﻿<html><head><meta charset="UTF-8"><style>' + getCSS() + '</style></head><body>' + el.outerHTML + '</body></html>'],
    {type:'application/msword'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'oficio-cj.doc';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  _toast('Download .doc iniciado!');
}
