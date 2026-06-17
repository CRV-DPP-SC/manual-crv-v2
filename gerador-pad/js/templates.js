/* ============================================================
   TEMPLATES — textos dos documentos do PAD
   Cada função recebe o estado (s) e retorna HTML do corpo.
   ============================================================ */

/* ── Helpers internos ── */
function _nomeIpen(s) {
  var i = s.incidentado || {};
  var nome = i.nome || ph('NOME DO INCIDENTADO');
  var ipen = i.prontuario || i.ipen || ph('PRONTUÁRIO');
  return fld(nome) + ' – IPEN Nº ' + fld(ipen);
}

function _dataInf(s) {
  var d = (s.infracao && s.infracao.data) ? fmtData(s.infracao.data) : ph('DATA DA INFRAÇÃO');
  return fld(d);
}

function _descricao(s) {
  return (s.infracao && s.infracao.descricao) ? _esc(s.infracao.descricao) : ph('DESCRIÇÃO DOS FATOS');
}

function _artigoTexto(s) {
  var cod = s.infracao && s.infracao.artigo;
  if (!cod) return ph('ARTIGO DA LEP');
  var a = getArtigo(cod);
  return a ? fld(a.label) + ' — ' + _esc(a.texto) : ph('ARTIGO DA LEP');
}

function _artigoLabel(s) {
  var cod = s.infracao && s.infracao.artigo;
  if (!cod) return ph('ARTIGO');
  var a = getArtigo(cod);
  return a ? fld(a.label) : ph('ARTIGO');
}

function _conselho(s) {
  var c = s.conselho || {};
  var p  = c.presidente || {};
  var m1 = c.membro1    || {};
  var m2 = c.membro2    || {};
  return {
    presidente: (p.nome  || ph('PRESIDENTE')) + (p.matricula  ? ' – Mat. ' + fld(p.matricula)  : ''),
    membro1:    (m1.nome || ph('MEMBRO 1'))   + (m1.matricula ? ' – Mat. ' + fld(m1.matricula) : ''),
    membro2:    (m2.nome || ph('MEMBRO 2'))   + (m2.matricula ? ' – Mat. ' + fld(m2.matricula) : ''),
  };
}

function _defensor(s) {
  var d = s.defesa || {};
  if (d.tipo === 'defensoria') return 'Defensoria Pública do Estado de Santa Catarina';
  if (d.tipo === 'advogado') return (d.advNome || ph('ADVOGADO')) + (d.advOab ? ', ' + fld(d.advOab) : '');
  return 'sem assistência de defensor';
}

function _cidade(s) {
  return (s.unidade && s.unidade.cidade) || 'Florianópolis';
}

function _unidadeNome(s) {
  return (s.unidade && s.unidade.nome) || ph('NOME DA UNIDADE');
}

function _diretor(s) {
  var d = s.diretor || {};
  return (d.nome || ph('DIRETOR(A)')) + '<br>' + (d.cargo || 'Diretor(a)') + '<br>' + _unidadeNome(s);
}

/* ══════════════════════════════════════════════════════════
   1. PORTARIA DE INSTAURAÇÃO
   ══════════════════════════════════════════════════════════ */
function tplPortaria(s) {
  var num    = s.numPad   || ph('Nº DO PAD');
  var dataI  = s.dataInst ? dPorExtenso(s.dataInst, _cidade(s)) : ph('DATA DE INSTAURAÇÃO');
  var c      = _conselho(s);

  return [
    p('<strong>PORTARIA Nº ' + fld(num) + '</strong>'),
    lb(1),
    p(dataI),
    lb(1),
    p('O ' + _diretor(s).replace(/<br>/g, ', ') + ', no uso de suas atribuições legais conferidas pela Lei Complementar nº 774/2021, '
    + 'em consonância com a Lei Complementar nº 529/2011, que aprova o Regimento Interno dos Estabelecimentos Penais do Estado de Santa Catarina, '
    + 'e em consonância com a Lei nº 7.210/84 (Lei de Execução Penal) e, considerando os documentos constantes nos autos,'),
    lb(1),
    p('CONSIDERANDO que em ' + _dataInf(s) + ' o(a) interno(a) ' + _nomeIpen(s) + ' teve registrada a seguinte infração disciplinar:'),
    lb(1),
    p('"' + _descricao(s) + '"'),
    lb(1),
    p('CONSIDERANDO que a conduta descrita, em tese, amolda-se ao ' + _artigoTexto(s) + ', configurando falta disciplinar de natureza <strong>GRAVE</strong>;'),
    lb(1),
    p('<strong>RESOLVE:</strong>'),
    lb(1),
    pSR('1. Instaurar Procedimento Administrativo Disciplinar (PAD) para apurar os fatos acima descritos;'),
    pSR('2. Determinar que se procedam as diligências internas que se fizerem necessárias, visando apurar a prática de FALTA GRAVE;'),
    pSR('3. Designar o Conselho Disciplinar, composto pelos servidores abaixo indicados, para conduzir o procedimento e, ao final, emitir parecer sobre os fatos apurados, remetendo os autos para decisão administrativa desta Diretoria:'),
    lb(1),
    pSR('&emsp;<strong>Presidente:</strong> ' + c.presidente + ', Policial Penal;'),
    pSR('&emsp;<strong>Membro:</strong> '     + c.membro1    + ', Policial Penal;'),
    pSR('&emsp;<strong>Membro:</strong> '     + c.membro2    + ', Policial Penal.'),
    lb(1),
    pSR('4. O prazo para conclusão do PAD é de <strong>30 (trinta) dias</strong>, contados da data desta Portaria, podendo ser prorrogado por igual período, desde que devidamente justificado.'),
    lb(1),
    p('<strong>CUMPRA-SE.</strong>'),
    lb(2),
    p(_cidade(s) + ', ' + (s.dataInst ? dPorExtenso(s.dataInst) : ph('DATA')) ),
    lb(3),
    '<div class="pad-ass-bloco">' + _diretor(s) + '</div>',
  ].join('');
}

/* ══════════════════════════════════════════════════════════
   2. TERMO DE OITIVA DO INCIDENTADO
   ══════════════════════════════════════════════════════════ */
function tplOitivaIncidentado(s) {
  var num   = s.numPad || ph('Nº DO PAD');
  var dataI = s.dataInst ? dPorExtenso(s.dataInst, _cidade(s)) : ph('DATA');
  var c     = _conselho(s);
  var versao = (s.defesa && s.defesa.versaoIncidentado) ? _esc(s.defesa.versaoIncidentado) : ph('VERSÃO APRESENTADA PELO INCIDENTADO');
  var inc   = s.incidentado || {};

  return [
    p('<strong>TERMO DE OITIVA DO INCIDENTADO</strong>'),
    p('<strong>PAD Nº ' + fld(num) + '</strong>'),
    lb(1),
    p('Ao ' + dataI + ', na ' + _unidadeNome(s) + ', presentes os membros do Conselho Disciplinar e ' + _defensor(s) + ', procedeu-se à oitiva do(a) incidentado(a) ' + _nomeIpen(s) + '.'),
    lb(1),
    p('Esclarecido(a) dos fatos que lhe são imputados — ' + _artigoLabel(s) + ' —, o(a) incidentado(a) apresentou a seguinte versão:'),
    lb(1),
    p('"' + versao + '"'),
    lb(1),
    p('Nada mais disse nem lhe foi perguntado. Lido e achado conforme, vai o presente Termo de Oitiva assinado pelos presentes.'),
    lb(2),
    p(_cidade(s) + ', ' + (s.dataInst ? dPorExtenso(s.dataInst) : ph('DATA'))),
    lb(3),
    '<div class="pad-ass-dupla">'
      + '<div class="pad-ass-item"><div class="pad-ass-linha"></div><div>Incidentado(a): ' + fld(inc.nome || '') + '</div></div>'
      + '<div class="pad-ass-item"><div class="pad-ass-linha"></div><div>' + (s.defesa && s.defesa.tipo !== 'sem_defesa' ? 'Defensor(a): ' + _defensor(s) : 'Sem defensor(a)') + '</div></div>'
    + '</div>',
    lb(2),
    '<div class="pad-ass-dupla">'
      + '<div class="pad-ass-item"><div class="pad-ass-linha"></div><div>Presidente do Conselho Disciplinar<br>' + (c.presidente || '') + '</div></div>'
      + '<div class="pad-ass-item"><div class="pad-ass-linha"></div><div>Membro do Conselho Disciplinar<br>' + (c.membro1 || '') + '</div></div>'
    + '</div>',
    lb(1),
    '<div class="pad-ass-dupla">'
      + '<div class="pad-ass-item"><div class="pad-ass-linha"></div><div>Membro do Conselho Disciplinar<br>' + (c.membro2 || '') + '</div></div>'
      + '<div class="pad-ass-item"></div>'
    + '</div>',
  ].join('');
}

/* ══════════════════════════════════════════════════════════
   3. TERMO DE OITIVA DE TESTEMUNHA
   ══════════════════════════════════════════════════════════ */
function tplOitivaTestemunha(s, testemunha) {
  var num   = s.numPad || ph('Nº DO PAD');
  var c     = _conselho(s);
  var nomeTe = (testemunha && testemunha.nome)          ? fld(testemunha.nome)          : ph('NOME DA TESTEMUNHA');
  var qualTe = (testemunha && testemunha.qualificacao)  ? _esc(testemunha.qualificacao) : ph('QUALIFICAÇÃO');

  return [
    p('<strong>TERMO DE OITIVA DE TESTEMUNHA</strong>'),
    p('<strong>PAD Nº ' + fld(num) + '</strong>'),
    lb(1),
    p('Ao ' + (s.dataInst ? dPorExtenso(s.dataInst, _cidade(s)) : ph('DATA')) + ', na ' + _unidadeNome(s) + ', presentes os membros do Conselho Disciplinar, procedeu-se à oitiva da testemunha ' + nomeTe + ', ' + qualTe + '.'),
    lb(1),
    p('Devidamente advertida a dizer a verdade, a testemunha prestou os seguintes esclarecimentos acerca dos fatos relacionados ao PAD acima referenciado:'),
    lb(1),
    p((testemunha && testemunha.depoimento) ? _esc(testemunha.depoimento) : ph('DECLARAÇÕES DA TESTEMUNHA')),
    lb(1),
    p('Nada mais disse nem lhe foi perguntado. Lido e achado conforme, vai o presente Termo assinado pelos presentes.'),
    lb(2),
    p(_cidade(s) + ', ' + (s.dataInst ? dPorExtenso(s.dataInst) : ph('DATA'))),
    lb(3),
    '<div class="pad-ass-dupla">'
      + '<div class="pad-ass-item"><div class="pad-ass-linha"></div><div>Testemunha: ' + (testemunha && testemunha.nome ? fld(testemunha.nome) : '') + '</div></div>'
      + '<div class="pad-ass-item"><div class="pad-ass-linha"></div><div>Presidente do Conselho<br>' + (c.presidente || '') + '</div></div>'
    + '</div>',
  ].join('');
}

/* ══════════════════════════════════════════════════════════
   4. MANIFESTAÇÃO DO CONSELHO DISCIPLINAR
   ══════════════════════════════════════════════════════════ */
function tplManifestacao(s) {
  var num    = s.numPad || ph('Nº DO PAD');
  var c      = _conselho(s);
  var mani   = s.manifestacao || {};
  var vers   = (s.defesa && s.defesa.versaoIncidentado) ? _esc(s.defesa.versaoIncidentado) : '';
  var fundo  = mani.fundamento || '';

  /* Fundamentação automática por conclusão */
  var fundamentoAuto = '';
  if (mani.conclusao === 'procedencia') {
    fundamentoAuto = p('Analisando os documentos que instruem o presente Procedimento Administrativo Disciplinar, em especial o registro de ocorrência e os depoimentos colhidos, o Conselho Disciplinar constata que a conduta atribuída ao(à) incidentado(a) '
      + _nomeIpen(s) + ' encontra-se devidamente comprovada quanto à materialidade e à autoria.')
    + p('A conduta descrita amolda-se ao ' + _artigoTexto(s) + ', configurando falta disciplinar de natureza <strong>GRAVE</strong>, nos termos da Lei de Execução Penal.')
    + (vers ? p('Em sua oitiva, o(a) incidentado(a) apresentou a seguinte versão: "' + vers + '". Tal alegação, contudo, não foi suficiente para afastar a responsabilidade disciplinar apurada.') : '')
    + (fundo ? p(fundo) : '')
    + lb(1)
    + p('Pelo exposto, o Conselho Disciplinar, <strong>por unanimidade, manifesta-se pela PROCEDÊNCIA</strong> do presente PAD, reconhecendo a prática de falta grave, e sugere à autoridade competente a aplicação das sanções legalmente previstas.')
  } else if (mani.conclusao === 'improcedencia') {
    fundamentoAuto = p('Analisando os elementos constantes nos autos, o Conselho Disciplinar verificou que as provas produzidas não foram suficientes para comprovar, de forma segura, a autoria e/ou a materialidade da infração imputada ao(à) incidentado(a) ' + _nomeIpen(s) + '.')
    + (vers ? p('Em sua oitiva, o(a) incidentado(a) apresentou a seguinte versão: "' + vers + '"') : '')
    + (fundo ? p(fundo) : '')
    + lb(1)
    + p('Pelo exposto, o Conselho Disciplinar, <strong>por unanimidade, manifesta-se pela IMPROCEDÊNCIA</strong> do presente PAD, recomendando o arquivamento dos autos.')
  } else if (mani.conclusao === 'desclassificacao') {
    var mGrauLabel = mani.desclassGrau === 'media' ? 'MÉDIA' : mani.desclassGrau === 'leve' ? 'LEVE' : 'LEVE OU MÉDIA';
    var mArt = mani.desclassArt || ph('ART. 95 OU 96');
    var mIncisos = mani.desclassIncisos || [];
    var mIncisosTexto = '';
    if (mIncisos.length) {
      var incisosDisp = getIncisosDesclass(mani.desclassGrau);
      var selecionados = incisosDisp.filter(function(inc) { return mIncisos.indexOf(inc.cod) !== -1; });
      if (selecionados.length === 1) {
        mIncisosTexto = ', especificamente o inciso <strong>' + selecionados[0].label + '</strong> (' + _esc(selecionados[0].texto) + ')';
      } else if (selecionados.length > 1) {
        var ultIdx = selecionados.length - 1;
        mIncisosTexto = ', especificamente os incisos '
          + selecionados.slice(0, ultIdx).map(function(i) { return '<strong>' + i.label + '</strong>'; }).join(', ')
          + ' e <strong>' + selecionados[ultIdx].label + '</strong>';
      }
    }
    fundamentoAuto = p('Analisando os elementos constantes nos autos, o Conselho Disciplinar verificou que, embora a conduta do(a) incidentado(a) ' + _nomeIpen(s) + ' configure irregularidade disciplinar, os elementos probatórios não demonstram o preenchimento de todos os requisitos necessários à caracterização de falta grave.')
    + (vers ? p('Em sua oitiva, o(a) incidentado(a) apresentou a seguinte versão: "' + vers + '"') : '')
    + (fundo ? p(fundo) : '')
    + lb(1)
    + p('Pelo exposto, o Conselho Disciplinar, <strong>por unanimidade, manifesta-se pela DESCLASSIFICAÇÃO</strong> da falta, por entender que os fatos apurados configuram falta de natureza <strong>' + mGrauLabel + '</strong>, nos termos do <strong>' + mArt + '</strong> da Lei Complementar nº 529/2011 do Estado de Santa Catarina' + mIncisosTexto + '.')
  } else {
    fundamentoAuto = p(ph('SELECIONE A CONCLUSÃO DO CONSELHO'));
  }

  return [
    p('<strong>MANIFESTAÇÃO DO CONSELHO DISCIPLINAR</strong>'),
    p('<strong>PAD Nº ' + fld(num) + '</strong>'),
    lb(1),
    p('Apenado(a): ' + _nomeIpen(s)),
    p('Infração: ' + _artigoLabel(s) + ' — Data: ' + _dataInf(s)),
    lb(1),
    fundamentoAuto,
    lb(2),
    p(_cidade(s) + ', ' + (s.dataInst ? dPorExtenso(s.dataInst) : ph('DATA'))),
    lb(3),
    '<div class="pad-ass-dupla">'
      + '<div class="pad-ass-item"><div class="pad-ass-linha"></div><div>Presidente do Conselho Disciplinar<br>' + (c.presidente || ph('PRESIDENTE')) + '<br>Policial Penal</div></div>'
      + '<div class="pad-ass-item"><div class="pad-ass-linha"></div><div>Membro do Conselho Disciplinar<br>' + (c.membro1 || ph('MEMBRO 1')) + '<br>Policial Penal</div></div>'
    + '</div>',
    lb(2),
    '<div class="pad-ass-dupla">'
      + '<div class="pad-ass-item"><div class="pad-ass-linha"></div><div>Membro do Conselho Disciplinar<br>' + (c.membro2 || ph('MEMBRO 2')) + '<br>Policial Penal</div></div>'
      + '<div class="pad-ass-item"></div>'
    + '</div>',
  ].join('');
}

/* ══════════════════════════════════════════════════════════
   5. DECISÃO DA DIREÇÃO
   ══════════════════════════════════════════════════════════ */
function tplDecisao(s) {
  var num   = s.numPad || ph('Nº DO PAD');
  var dec   = s.decisao || {};
  var fundo = dec.fundamento || '';

  var corpo = '';

  if (dec.resultado === 'absolvicao') {
    corpo = p('Em razão das diligências realizadas pelo Conselho Disciplinar no PAD instaurado pela Portaria nº ' + fld(num) + ', envolvendo o(a) interno(a) ' + _nomeIpen(s) + ', e considerando a manifestação do Conselho Disciplinar pela improcedência do feito,')
    + lb(1) + p('<strong>DECIDO:</strong>') + lb(1)
    + pSR('1. Acolher o parecer do Conselho Disciplinar pela <strong>IMPROCEDÊNCIA</strong> do PAD, absolvendo o(a) incidentado(a) ' + fld((s.incidentado||{}).nome||'') + ' das imputações que lhe foram atribuídas.')
    + pSR('2. Determinar o arquivamento dos autos.')
    + pSR('3. Remeta-se cópia ao(à) MM.(ª) Juiz(íza) de Direito da Vara de Execuções Penais.')
    + pSR('4. Registre-se no prontuário do(a) incidentado(a).')
    + (fundo ? lb(1) + p(fundo) : '');

  } else if (dec.resultado === 'desclassificacao') {
    var grau = dec.desclassGrau === 'media' ? 'MÉDIA' : dec.desclassGrau === 'leve' ? 'LEVE' : ph('LEVE OU MÉDIA');
    var art  = dec.desclassArt  || ph('ARTIGO LC 529/2011');
    var dIncisos = dec.desclassIncisos || [];
    var dIncisosTexto = '';
    if (dIncisos.length) {
      var dIncisosDisp = getIncisosDesclass(dec.desclassGrau);
      var dSelecionados = dIncisosDisp.filter(function(inc) { return dIncisos.indexOf(inc.cod) !== -1; });
      if (dSelecionados.length === 1) {
        dIncisosTexto = ', inciso <strong>' + dSelecionados[0].label + '</strong> (' + _esc(dSelecionados[0].texto) + ')';
      } else if (dSelecionados.length > 1) {
        var dUltIdx = dSelecionados.length - 1;
        dIncisosTexto = ', incisos '
          + dSelecionados.slice(0, dUltIdx).map(function(i) { return '<strong>' + i.label + '</strong>'; }).join(', ')
          + ' e <strong>' + dSelecionados[dUltIdx].label + '</strong>';
      }
    }
    corpo = p('Em razão das diligências realizadas pelo Conselho Disciplinar no PAD instaurado pela Portaria nº ' + fld(num) + ', envolvendo o(a) interno(a) ' + _nomeIpen(s) + ', e considerando a manifestação do Conselho Disciplinar pela desclassificação da falta,')
    + lb(1) + p('<strong>DECIDO:</strong>') + lb(1)
    + pSR('1. Acolher o parecer do Conselho Disciplinar, <strong>desclassificando</strong> a infração para falta de natureza <strong>' + grau + '</strong>, nos termos do ' + fld(art + dIncisosTexto) + ' da Lei Complementar nº 529/2011 do Estado de Santa Catarina.')
    + pSR('2. Determinar o arquivamento dos autos.')
    + pSR('3. Remeta-se cópia ao(à) MM.(ª) Juiz(íza) de Direito da Vara de Execuções Penais.')
    + pSR('4. Registre-se no prontuário do(a) incidentado(a).')
    + (fundo ? lb(1) + p(fundo) : '');

  } else if (dec.resultado === 'falta_grave') {
    var sancs = dec.sancoes || {};
    var listaSancoes = [];
    if (sancs.regressaoRegime)        listaSancoes.push('regressão do regime de execução penal, nos termos do <strong>art. 118, I, da LEP</strong>');
    if (sancs.interrupcaoProgressao)  listaSancoes.push('interrupção da contagem do prazo para progressão de regime, nos termos do <strong>art. 112, § 6º, da LEP</strong>');
    if (sancs.perdaRemicao && sancs.perdaRemicao.aplicar) {
      var vr = sancs.perdaRemicao.valor || ph('QUANTIDADE/FRAÇÃO');
      var mod = sancs.perdaRemicao.modalidade === 'fracao' ? vr + ' dos dias remidos' : vr + ' (dias) remidos';
      listaSancoes.push('perda de ' + fld(mod) + ', nos termos do <strong>art. 127 da LEP</strong>');
    }
    if (sancs.revogacaoSaidaTemp)     listaSancoes.push('revogação da saída temporária, nos termos do <strong>art. 125 da LEP</strong>');
    if (sancs.revogacaoTrabalhoExt)   listaSancoes.push('revogação do trabalho externo, nos termos do <strong>art. 123 da LEP</strong>');

    corpo = p('Em razão das diligências realizadas pelo Conselho Disciplinar no PAD instaurado pela Portaria nº ' + fld(num) + ', envolvendo o(a) interno(a) ' + _nomeIpen(s) + ', corroborando o parecer exarado pelo Conselho Disciplinar,')
    + lb(1) + p('<strong>DECIDO:</strong>') + lb(1)
    + pSR('1. Reconhecer a prática de <strong>FALTA GRAVE</strong>, tipificada no ' + _artigoLabel(s) + ', pelo(a) interno(a) ' + _nomeIpen(s) + '.')
    + (listaSancoes.length
        ? pSR('2. Aplicar as seguintes sanções:')
          + listaSancoes.map(function(sc, i) { return pSR('&emsp;&emsp;' + String.fromCharCode(97+i) + ') ' + sc + ';'); }).join('')
        : pSR('2. ' + ph('SANÇÕES A APLICAR')))
    + pSR('3. Remeta-se cópia ao(à) MM.(ª) Juiz(íza) de Direito da Vara de Execuções Penais.')
    + pSR('4. Arquive-se e registre-se no prontuário do(a) incidentado(a).')
    + (fundo ? lb(1) + p(fundo) : '');

  } else {
    corpo = p(ph('SELECIONE O RESULTADO DA DECISÃO'));
  }

  return [
    p('<strong>DECISÃO DA DIREÇÃO</strong>'),
    p('<strong>Procedimento Administrativo Disciplinar — PAD Nº ' + fld(num) + '</strong>'),
    lb(1),
    corpo,
    lb(2),
    p(_cidade(s) + ', ' + (s.dataInst ? dPorExtenso(s.dataInst) : ph('DATA'))),
    lb(3),
    '<div class="pad-ass-bloco">' + _diretor(s) + '</div>',
  ].join('');
}

/* ══════════════════════════════════════════════════════════
   6. OFÍCIO DE ENCAMINHAMENTO À VEP
   ══════════════════════════════════════════════════════════ */
function tplOficioVep(s) {
  var num    = s.numOficioEnc || ph('Nº DO OFÍCIO');
  var numPad = s.numPad       || ph('Nº DO PAD');

  return [
    p('<strong>OFÍCIO Nº ' + fld(num) + '</strong>'),
    lb(1),
    p(_cidade(s) + ', ' + (s.dataInst ? dPorExtenso(s.dataInst) : ph('DATA'))),
    lb(1),
    p('Senhor(a) Juiz(a),'),
    lb(1),
    p('Para conhecimento e providências que Vossa Excelência entender necessárias, encaminha-se o Procedimento Administrativo Disciplinar nº ' + fld(numPad) + ', instaurado em desfavor do(a) apenado(a) ' + _nomeIpen(s) + '.'),
    lb(1),
    p('O presente PAD foi instaurado para apurar a prática de falta disciplinar de natureza grave, tipificada no ' + _artigoTexto(s) + ', ocorrida em ' + _dataInf(s) + ', conforme descrito a seguir:'),
    lb(1),
    p('"' + _descricao(s) + '"'),
    lb(1),
    p('O Conselho Disciplinar, por unanimidade, ' + (s.manifestacao && s.manifestacao.conclusao === 'procedencia' ? 'entendeu configurada a falta grave, sugerindo a aplicação das sanções legalmente previstas. O(A) Diretor(a) desta Unidade corrobora o parecer exarado pelo Conselho Disciplinar.' : 'manifestou-se conforme parecer em anexo.') ),
    lb(1),
    p('Encaminham-se, em anexo, os autos do referido procedimento para os fins de direito.'),
    lb(1),
    p('Atenciosamente,'),
    lb(3),
    '<div class="pad-ass-bloco">' + _diretor(s) + '</div>',
    lb(2),
    '<div class="pad-dest">'
      + '<div class="dest-t">A Sua Excelência o(a) Senhor(a)</div>'
      + '<div class="dest-n">MM.(ª) Juiz(íza) de Direito da Vara de Execuções Penais</div>'
    + '</div>',
  ].join('');
}

/* ══════════════════════════════════════════════════════════
   7. OFÍCIO AO JUIZ — COMUNICAÇÃO DE INSTAURAÇÃO
   ══════════════════════════════════════════════════════════ */
function tplOficioJuiz(s) {
  var num    = s.numOficioJuiz || ph('Nº DO OFÍCIO');
  var numPad = s.numPad        || ph('Nº DO PAD');

  return [
    p('<strong>OFÍCIO Nº ' + fld(num) + '</strong>'),
    lb(1),
    p(_cidade(s) + ', ' + (s.dataInst ? dPorExtenso(s.dataInst) : ph('DATA'))),
    lb(1),
    p('Senhor(a) Juiz(a),'),
    lb(1),
    p('Cumprimentando Vossa Excelência, comunicamos que em ' + (s.dataInst ? fld(fmtData(s.dataInst)) : ph('DATA DE INSTAURAÇÃO')) + ' foi instaurado, nesta Unidade, o Procedimento Administrativo Disciplinar (PAD) nº ' + fld(numPad) + ' em desfavor do(a) apenado(a) ' + _nomeIpen(s) + '.'),
    lb(1),
    p('O procedimento visa apurar a prática de falta disciplinar de natureza grave, tipificada no ' + _artigoTexto(s) + ', ocorrida em ' + _dataInf(s) + '.'),
    lb(1),
    p('Tão logo concluído o procedimento disciplinar, os autos serão encaminhados a Vossa Excelência para as providências legais cabíveis.'),
    lb(1),
    p('Atenciosamente,'),
    lb(3),
    '<div class="pad-ass-bloco">' + _diretor(s) + '</div>',
    lb(2),
    '<div class="pad-dest">'
      + '<div class="dest-t">A Sua Excelência o(a) Senhor(a)</div>'
      + '<div class="dest-n">MM.(ª) Juiz(íza) de Direito da Vara de Execuções Penais</div>'
    + '</div>',
  ].join('');
}
