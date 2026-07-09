/* ============================================================
   TEMPLATES — textos de cada modalidade de ofício
   Funções puras: recebem estado (s) e retornam string HTML.
   ============================================================ */

/* ── Critério de escolha — não punitivo (aplicável a todas as modalidades de transferência) ── */
function textoCriterioNaoPunitivo(s) {
  var doReed  = doA(s) + ' ' + gng(s,'reeducando','reeducanda','reeducandos','reeducandas');
  var sujReed = reed(s);
  return 'No tocante à escolha ' + doReed + ', registra-se que esta pautou-se em critérios técnicos, objetivos e impessoais, nos termos do art. 16, §§ 3º e 4º, da Resolução Conjunta Interinstitucional n.º 1/2026 e da Circular n.º 002/2026/PPSC/CRV, em anexo, sendo a indicação de responsabilidade exclusiva desta Direção. Nesse sentido, cumpre esclarecer que a presente movimentação não possui caráter punitivo, disciplinar ou de retaliação, em conformidade com o art. 22 da referida Resolução, tampouco decorre de reincidência de transferências, uma vez que ' + sujReed + ' não ' + foi(s) + ' ' + gng(s,'submetido','submetida','submetidos','submetidas') + ' a qualquer outra movimentação nos últimos 30 (trinta) dias, em observância à vedação prevista no art. 16, § 4º, da mesma Resolução.';
}

/* ── BPI ── */
function textoBPI(s, sufixo) {
  sufixo = sufixo || '';
  if (s.bpi === 'atualizado') {
    return 'Para subsidiar a análise, informo ainda a devida atualização do Boletim Penal Informativo — BPI no sistema i-PEN' + sufixo + '.';
  }
  if (s.bpi === 'nao_atualizado') {
    return 'Informa-se que o Boletim Penal Informativo — BPI não se encontra devidamente atualizado no sistema i-PEN, em razão de ' + fld(s.bpiMotivo || ph('motivo')) + '. Compromete-se esta unidade com a atualização em prazo breve' + sufixo + '.';
  }
  if (s.bpi === 'nao_ciente') {
    return 'Informa-se que o Boletim Penal Informativo — BPI não se encontra atualizado; entretanto, o(a) Gestor(a) da Unidade Prisional de destino está ciente desta situação, não manifestou óbice ao presente expediente e comprometeu-se com a devida atualização' + sufixo + '.';
  }
  return ph('Parágrafo BPI — selecione o estado do BPI');
}

/* ── Saúde ── */
function textoSaudeOficio(s, isPlural) {
  if (s.saudeOpcao === 'formulario') {
    return ['No tocante à saúde, destaco que segue anexo o respectivo Formulário de Saúde ' + doA(s) + ' ' + gng(s,'reeducando','reeducanda','reeducandos','reeducandas') + '.'];
  }
  if (s.saudeOpcao === 'sem_profissional') {
    return [isPlural
      ? 'Esta Unidade Prisional não dispõe, em sua estrutura funcional administrativa, de profissional apto a realizar avaliação de saúde, razão pela qual deixa-se de atestar a (in)salubridade das pessoas em questão.'
      : 'Esta Unidade Prisional não dispõe, em sua estrutura funcional administrativa, de profissional apto a realizar avaliação de saúde, razão pela qual deixa-se de atestar a (in)salubridade da pessoa em questão.'];
  }
  if (s.saudeOpcao === 'individual') return _textoSaudeIndividual(s);
  return [];
}

function _textoSaudeIndividual(s) {
  var parags = [];
  if (Array.isArray(s.comorbidades) && s.comorbidades.length > 0) {
    parags.push('Informa-se que o(a) reeducando(a) apresenta a(s) seguinte(s) comorbidade(s):');
    parags.push('<ul class="ofc-lista">' + s.comorbidades.map(function(i) { return '<li>' + i + '</li>'; }).join('') + '</ul>');
  }
  if (Array.isArray(s.medicamentos) && s.medicamentos.length > 0) {
    parags.push('No mesmo sentido, o(a) reeducando(a) faz uso do(s) seguinte(s) medicamento(s) de uso contínuo:');
    parags.push('<ul class="ofc-lista">' + s.medicamentos.map(function(i) { return '<li>' + i + '</li>'; }).join('') + '</ul>');
  }
  return parags;
}

/* ── Tabela Anexo ──
   noPageBreak: true quando o chamador já cuida do page-break (e.g. _gerarPaginasAnexos) */
function gerarAnexoTabela(reed, numAnexo, tituloExtra, saudeOpcao, temRegime, noPageBreak) {
  numAnexo = numAnexo || 'I';
  var ordenacao = {Convívio:1, Seguro:2, SEGURO:3, 'Não informado':4};
  var reedOrdenado = temRegime
    ? reed.slice().sort(function(a,b) { return (ordenacao[a.alocacao]||99) - (ordenacao[b.alocacao]||99); })
    : reed.slice();

  var mostrarSaude = saudeOpcao === 'individual' && temRegime && numAnexo === 'I';
  var td = 'padding:5pt 7pt;border:0.5pt solid #aab;font-size:9.5pt;font-family:Arial,sans-serif;';
  var th = 'padding:6pt 7pt;border:0.5pt solid #aab;font-size:9.5pt;font-family:Arial,sans-serif;';

  var linhas = reedOrdenado.map(function(r, i) {
    var bg = i % 2 === 0 ? '#f5f8ff' : '#ffffff';
    var colsRegime = temRegime
      ? '<td style="' + td + 'text-align:center;">' + (r.regime || '—') + '</td>'
      + '<td style="' + td + 'text-align:center;">' + (r.alocacao || '—') + '</td>'
      : '';
    var colsSaude = '';
    if (mostrarSaude) {
      var com = r.comorbidades && r.comorbidades.length > 0 ? r.comorbidades.join(', ') : 'Não';
      var med = r.medicamentos && r.medicamentos.length > 0 ? r.medicamentos.join(', ') : 'Não';
      colsSaude = '<td style="' + td + '">' + com + '</td><td style="' + td + '">' + med + '</td>';
    }
    return '<tr style="background:' + bg + '">'
      + '<td style="' + td + 'text-align:center;">' + (i + 1) + '</td>'
      + '<td style="' + td + 'font-weight:bold;">' + r.nome.toUpperCase() + '</td>'
      + '<td style="' + td + 'text-align:center;">' + r.ipen + '</td>'
      + colsRegime + colsSaude
      + '</tr>';
  }).join('');

  var thRegime = temRegime
    ? '<th style="' + th + 'text-align:center;">Regime</th><th style="' + th + 'text-align:center;">Alocação</th>'
    : '';
  var thSaude = mostrarSaude
    ? '<th style="' + th + '">Comorbidades</th><th style="' + th + '">Medicamentos Contínuos</th>'
    : '';

  var subtitulo = tituloExtra || (temRegime
    ? (mostrarSaude ? 'Relação de Reeducandos — Situação Penal e Informações de Saúde' : 'Relação de Reeducandos — Situação Penal')
    : 'Relação de Custodiados');

  var wrapCls = noPageBreak ? 'anexo-inner' : 'anexo-wrapper';
  return '<div class="' + wrapCls + '" style="font-family:Arial,sans-serif;">'
    + '<div style="padding:8pt 0 10pt 0;text-align:center;">'
    + '<div style="font-size:12pt;font-weight:bold;text-transform:uppercase;letter-spacing:1pt;">ANEXO ' + numAnexo + '</div>'
    + '<div style="font-size:10pt;margin-top:4pt;">' + subtitulo + '</div>'
    + '</div>'
    + '<table class="anexo-tabela">'
    + '<thead><tr style="background:#0d2b55;color:#fff;">'
    + '<th style="' + th + 'text-align:center;">#</th>'
    + '<th style="' + th + 'text-align:left;">Nome</th>'
    + '<th style="' + th + 'text-align:center;">IPEN</th>'
    + thRegime + thSaude
    + '</tr></thead>'
    + '<tbody>' + linhas + '</tbody>'
    + '</table></div>';
}

/* ── Corpo por modalidade ── */
function gerarCorpo(s) {
  var ps = [];

  if (!s.mod) return [p(ph('Selecione o tipo de ofício para visualizar o documento.'))];

  var o = s.ori, d = s.des;
  var isMulti = s.numero === 'P' && s.reed && s.reed.length > 0;
  var nOri = o ? fld(o.n) : ph('Unidade de Origem');
  var nDes = d ? fld(d.n) : ph('Unidade de Destino');
  var nomePreso = s.nome ? fld(s.nome) : ph('Nome do reeducando');
  var ipenPreso = s.ipen ? fld(s.ipen) : ph('IPEN');
  var nomeRef   = reedFld(s, s.nome || ph('Nome'), s.ipen || ph('IPEN'));
  var refAnexo  = (isMulti ? 'dos(as) reeducandos(as) relacionados(as) no Anexo I deste ofício,' : '');

  /* ── MANDADO ── */
  if (s.mod === 'mandado') {
    var juizo = s.juizo ? fld(s.juizo) : ph('Juízo expedidor');
    if (isMulti) {
      ps = [
        'Encaminho para análise pedido de transferência ' + refAnexo + ' custodiados(as) no(a) ' + nOri + ', para o(a) ' + nDes + ', em razão do cumprimento de Mandado de Prisão expedido pelo(a) ' + juizo + '.',
        'A transferência ampara-se no art. 21, inciso III, da Resolução Conjunta Interinstitucional n. 01/2026, e no art. 24 da Portaria Normativa nº 2.189/2025 do Departamento de Polícia Penal, sendo ' + nDes + ' a unidade responsável pela circunscrição da autoridade judiciária expedidora.',
        textoBPI(s),
        TXT_CONTATOS_ANUEM,
        TXT_DESFECHO_PLURAL,
      ];
    } else {
      ps = [
        'Encaminho para análise pedido de transferência ' + nomeRef + ', ' + custAdj(s) + ' no(a) ' + nOri + ', para o(a) ' + nDes + ', em razão do cumprimento de Mandado de Prisão expedido pelo(a) ' + juizo + '.',
        'A transferência ampara-se no art. 21, inciso III, da Resolução Conjunta Interinstitucional n. 01/2026, e no art. 24 da Portaria Normativa nº 2.189/2025 do Departamento de Polícia Penal, sendo ' + nDes + ' a unidade responsável pela circunscrição da autoridade judiciária expedidora.',
        textoBPI(s),
        TXT_CONTATOS_ANUEM,
        TXT_DESFECHO_SINGULAR,
      ];
    }
    ps = _injetarSaude(s, ps, isMulti, false);
  }

  /* ── EMERGENCIAL ── */
  else if (s.mod === 'emergencial') {
    var cp  = s.sub === 'com_pad';
    var sit = s.sit ? fld(s.sit) : ph('situação concreta');
    var padTxt = cp ? [
      'Informa-se que ' + fld(s.pad || ph('FOI/SERÁ INSTAURADO')) + ' o Procedimento Administrativo Disciplinar (PAD), nos termos da legislação vigente, em razão de conduta <strong>supostamente</strong> enquadrada no ' + fld((s.faltaCod || ph('Art.')) + ' — ' + (s.faltaDesc || ph('descrição da falta'))) + ', cujos fatos serão devidamente apurados.',
      'A presente medida possui natureza administrativa e cautelar, sem caráter punitivo, sem prejuízo da regular apuração no âmbito do PAD.',
    ] : [
      (isMulti
        ? 'A medida possui natureza administrativa, não estando vinculada à prática de falta grave, sendo vedada qualquer forma de isolamento dos(as) reeducandos(as).'
        : 'A medida possui natureza administrativa, não estando vinculada à prática de falta grave, sendo vedada qualquer forma de isolamento do(a) reeducando(a).'),
    ];
    if (isMulti) {
      ps = [
        'Encaminho para análise urgente pedido de transferência excepcional ' + refAnexo + ' custodiados(as) no(a) ' + nOri + ', em razão de situação emergencial identificada pelas equipes deste estabelecimento penal.',
        'A solicitação fundamenta-se no art. 21, inciso I, da Resolução Conjunta Interinstitucional n. 01/2026, em razão de ' + sit + ', o que torna inviável a permanência dos(as) reeducandos(as) nesta unidade.',
      ].concat(padTxt).concat([
        textoCriterioNaoPunitivo(s),
        textoBPI(s),
        'Quanto aos trâmites decorrentes, efetivada a remoção, o Juízo competente será comunicado no prazo legal de até 24 horas.',
        TXT_CONTATOS_SUBSCREVEM,
        TXT_DESFECHO_PLURAL_CELERE,
      ]);
    } else {
      ps = [
        'Encaminho para análise urgente pedido de transferência excepcional ' + nomeRef + ', ' + custAdj(s) + ' no(a) ' + nOri + ', em razão de situação emergencial identificada pelas equipes deste estabelecimento penal.',
        'A solicitação fundamenta-se no art. 21, inciso I, da Resolução Conjunta Interinstitucional n. 01/2026, em razão de ' + sit + ', o que torna inviável a permanência ' + doA(s) + ' ' + gng(s,'reeducando','reeducanda','reeducandos','reeducandas') + ' nesta unidade.',
      ].concat(padTxt).concat([
        textoCriterioNaoPunitivo(s),
        textoBPI(s),
        'Quanto aos trâmites decorrentes, efetivada a remoção, o Juízo competente será comunicado no prazo legal de até 24 horas.',
        TXT_CONTATOS_SUBSCREVEM,
        TXT_DESFECHO_SINGULAR_CELERE,
      ]);
    }
    ps = _injetarSaude(s, ps, isMulti, false);
  }

  /* ── PERNOITE ── */
  else if (s.mod === 'pernoite') {
    var razP = s.razPernoite ? fld(s.razPernoite) : ph('razão do pernoite');
    if (isMulti) {
      ps = [
        'Encaminho para análise pedido de pernoite ' + refAnexo + ' custodiados(as) no(a) ' + nOri + ', na unidade de ' + nDes + ', em razão de ' + razP + '.',
        'Foi realizado contato prévio com a gestão da unidade de destino, que subscreve o presente expediente.',
        TXT_DESFECHO_PLEITO,
      ];
    } else {
      ps = [
        'Encaminho para análise pedido de pernoite ' + nomeRef + ', ' + custAdj(s) + ' no(a) ' + nOri + ', na unidade de ' + nDes + ', em razão de ' + razP + '.',
        'Foi realizado contato prévio com a gestão da unidade de destino, que subscreve o presente expediente.',
        TXT_DESFECHO_PLEITO,
      ];
    }
  }

  /* ── ADEQUAÇÃO (Transferências Ordinárias) / AJUSTE LOTACIONAL ──
     TODO: "ajuste_lotacional" usa temporariamente o mesmo texto de "adequacao"
     até definirmos a redação própria desse novo módulo. ── */
  else if (s.mod === 'adequacao' || s.mod === 'ajuste_lotacional') {
    var tm = {
      pontual: 'adequação da capacidade de ocupação',
      regime:  'adequação decorrente de alteração de regime de cumprimento de pena',
    };
    var motAdec  = s.motTransf    ? fld(s.motTransf)    : ph('motivo da transferência');
    var critAdec = s.motIndicacao ? fld(s.motIndicacao) : ph('critério de escolha');
    var fundamento = tm[s.sub] || 'adequação da capacidade de ocupação';

    if (isMulti) {
      ps = [
        'Encaminho para análise dessa Central de Regulação de Vagas pedido de transferência ' + refAnexo + ' custodiados(as) no(a) ' + nOri + ', para o(a) ' + nDes + ', com fundamento na ' + fundamento + '.',
        'A solicitação ampara-se na Resolução Conjunta Interinstitucional n. 01/2026, especialmente em seu art. 21, inciso III.',
        'A transferência justifica-se pela ' + motAdec + '.',
        textoCriterioNaoPunitivo(s),
        'Com relação ao critério utilizado para a escolha dos(as) reeducandos(as), informa-se: ' + critAdec + '.',
        textoBPI(s),
        'Quanto aos trâmites decorrentes, efetivada a remoção, o Juízo competente será comunicado no prazo legal de até 24 horas.',
        TXT_CONTATOS_ANUEM,
        TXT_DESFECHO_PLURAL,
      ];
    } else {
      ps = [
        'Encaminho para análise dessa Central de Regulação de Vagas pedido de transferência ' + nomeRef + ', ' + custAdj(s) + ' no(a) ' + nOri + ', para o(a) ' + nDes + ', com fundamento na ' + fundamento + '.',
        'A solicitação ampara-se na Resolução Conjunta Interinstitucional n. 01/2026, especialmente em seu art. 21, inciso III.',
        'A transferência justifica-se pela ' + motAdec + '.',
        textoCriterioNaoPunitivo(s),
        'Com relação ao critério utilizado para a escolha ' + doA(s) + ' ' + gng(s,'reeducando','reeducanda','reeducandos','reeducandas') + ', informa-se: ' + critAdec + '.',
        textoBPI(s),
        'Quanto aos trâmites decorrentes, efetivada a remoção, o Juízo competente será comunicado no prazo legal de até 24 horas.',
        TXT_CONTATOS_ANUEM,
        TXT_DESFECHO_SINGULAR,
      ];
    }
    ps = _injetarSaude(s, ps, isMulti, false);
  }

  /* ── PERMUTA ── */
  else if (s.mod === 'permuta') {
    var motPerm  = s.motTransfPermuta ? fld(s.motTransfPermuta) : ph('motivo da permuta');
    var critPerm = s.motPermuta ? fld(s.motPermuta) : ph('critério de escolha');
    var pDesPerm = '';
    var temDes   = s.permutaDes && s.permutaDes.length > 0;
    var desUnico = temDes && s.permutaDes.length === 1;
    var desMulti = temDes && s.permutaDes.length > 1;
    var numAneII = isMulti && desMulti ? 'II' : 'I';

    if (desUnico) {
      var pd = s.permutaDes[0];
      pDesPerm = 'Em contrapartida, a ' + nDes + ' encaminhará o(a) reeducando(a) ' + fld(pd.nome ? pd.nome.toUpperCase() : ph('Nome')) + ', IPEN nº ' + fld(pd.ipen || ph('IPEN')) + ', situação penal: ' + fld(pd.regime || ph('regime')) + ', característica de alocação: ' + fld(pd.alocacao || ph('alocação')) + ', pelo mesmo motivo: ' + motPerm + '.';
    } else if (desMulti) {
      pDesPerm = 'Em contrapartida, a ' + nDes + ' encaminhará os(as) reeducandos(as) relacionados(as) no <strong>Anexo ' + numAneII + '</strong> deste ofício, pelo mesmo motivo: ' + motPerm + '.';
    }

    if (isMulti) {
      ps = [
        'Encaminho para análise dessa Central de Regulação de Vagas pedido de permuta entre a ' + nOri + ' e a ' + nDes + ', envolvendo os(as) reeducandos(as) relacionados(as) no Anexo I deste ofício, nos termos do art. 21, inciso III, da Resolução Conjunta Interinstitucional n. 01/2026.',
        'A medida visa à ' + motPerm + '.',
        textoCriterioNaoPunitivo(s),
        'Com relação ao critério utilizado para a escolha dos(as) reeducandos(as), informa-se: ' + critPerm + '.',
      ];
    } else {
      ps = [
        'Encaminho para análise dessa Central de Regulação de Vagas pedido de permuta entre a ' + nOri + ' e a ' + nDes + ', envolvendo ' + nomeRef + ', nos termos do art. 21, inciso III, da Resolução Conjunta Interinstitucional n. 01/2026.',
        'A medida visa à ' + motPerm + '.',
        textoCriterioNaoPunitivo(s),
        'Com relação ao critério utilizado para a escolha ' + doA(s) + ' ' + gng(s,'reeducando','reeducanda','reeducandos','reeducandas') + ', informa-se: ' + critPerm + '.',
      ];
    }
    if (pDesPerm) ps.push(pDesPerm);
    ps.push(textoBPI(s));
    ps.push('Quanto aos trâmites decorrentes, efetivada a remoção, o Juízo competente será comunicado no prazo legal de até 24 horas.');
    ps.push(TXT_CONTATOS_ANUEM);
    ps = _injetarSaude(s, ps, isMulti, true);
    ps.push(TXT_DESFECHO_PERMUTA);
  }

  /* ── PRISÃO CIVIL ── */
  else if (s.mod === 'prisaocivil') {
    var bpiCivil = textoBPI(s,
      isMulti
        ? ', bem como encaminho cópia das decisões judiciais que determinaram as prisões civis'
        : ', bem como encaminho cópia da decisão judicial que determinou a prisão civil');
    if (isMulti) {
      ps = [
        'Encaminho para análise e deliberação da Central de Regulação de Vagas — CRV/DPP pedido de transferência dos(as) presos(as) civis relacionados(as) no Anexo I deste ofício, atualmente custodiados(as) no(a) ' + nOri + ', para o(a) ' + nDes + ', unidade prisional com estrutura adequada para o recebimento e custódia de presos civis.',
        'A presente solicitação fundamenta-se na natureza específica da prisão civil, modalidade de privação de liberdade distinta da prisão penal, cujo caráter não é sancionatório, mas coercitivo, visando ao cumprimento de obrigação legal. Nessa perspectiva, é imprescindível que as pessoas privadas de liberdade sob essa modalidade sejam custodiadas em unidade prisional adequada e especializada para tanto.',
        bpiCivil,
        'Quanto aos trâmites decorrentes, efetivada a remoção, o Juízo competente será devidamente comunicado no prazo legal.',
        TXT_CONTATOS_ANUEM,
        TXT_DESFECHO_CIVIL_PLURAL,
      ];
    } else {
      ps = [
        'Encaminho para análise e deliberação da Central de Regulação de Vagas — CRV/DPP pedido de transferência ' + doA(s) + ' ' + gng(s,'preso','presa','presos','presas') + ' civil ' + nomePreso + ', IPEN Nº ' + ipenPreso + ', atualmente ' + custAdj(s) + ' no(a) ' + nOri + ', para o(a) ' + nDes + ', unidade prisional com estrutura adequada para o recebimento e custódia de preso(a) civil.',
        'A presente solicitação fundamenta-se na natureza específica da prisão civil, modalidade de privação de liberdade distinta da prisão penal, cujo caráter não é sancionatório, mas coercitivo, visando ao cumprimento de obrigação legal. Nessa perspectiva, é imprescindível que a pessoa privada de liberdade sob essa modalidade seja custodiada em unidade prisional adequada e especializada para tanto.',
        bpiCivil,
        'Quanto aos trâmites decorrentes, efetivada a remoção, o Juízo competente será devidamente comunicado no prazo legal.',
        TXT_CONTATOS_ANUEM,
        TXT_DESFECHO_CIVIL_SINGULAR,
      ];
      ps = _injetarSaude(s, ps, false, false);
    }
  }

  /* ── COMUNICAÇÃO ── */
  else if (s.mod === 'comunicacao') {
    var data = s.dataTrans ? fld(s.dataTrans) : ph('data da transferência');
    var motC = s.motComun   ? fld(s.motComun)   : ph('motivo da transferência');
    if (s.sub === 'saida') {
      if (isMulti) {
        ps = [
          'Comunica-se a Vossa Excelência que os(as) custodiados(as) relacionados(as) no Anexo I deste ofício foram transferidos(as) desta unidade — ' + nOri + ' — para ' + nDes + ', em ' + (d ? fld(d.c + '/SC') : ph('Cidade/SC')) + ', em ' + data + '.',
          'A transferência foi autorizada pela Central de Regulação de Vagas — CRV/DPP, em razão de que ' + motC + '.',
          'Ficamos à disposição de Vossa Excelência para quaisquer esclarecimentos.',
        ];
      } else {
        ps = [
          'Comunica-se a Vossa Excelência que ' + cust(s) + ' ' + nomePreso + ', IPEN nº ' + ipenPreso + ', ' + foi(s) + ' ' + transf(s) + ' desta unidade — ' + nOri + ' — para ' + nDes + ', em ' + (d ? fld(d.c + '/SC') : ph('Cidade/SC')) + ', em ' + data + '.',
          'A transferência foi autorizada pela Central de Regulação de Vagas — CRV/DPP, em razão de que ' + motC + '.',
          'Ficamos à disposição de Vossa Excelência para quaisquer esclarecimentos.',
        ];
      }
    } else { /* entrada */
      if (isMulti) {
        ps = [
          'Comunica-se a Vossa Excelência que os(as) custodiados(as) relacionados(as) no Anexo I deste ofício ingressaram nesta unidade — ' + nDes + ' —, oriundos(as) de ' + nOri + ', em ' + (o ? fld(o.c + '/SC') : ph('Cidade/SC')) + ', em ' + data + '.',
          'A transferência foi autorizada pela Central de Regulação de Vagas — CRV/DPP, em razão de que ' + motC + '.',
          'Ficamos à disposição de Vossa Excelência para quaisquer esclarecimentos.',
        ];
      } else {
        ps = [
          'Comunica-se a Vossa Excelência que ' + cust(s) + ' ' + nomePreso + ', IPEN nº ' + ipenPreso + ', ingressou nesta unidade — ' + nDes + ' —, oriundo(a) de ' + nOri + ', em ' + (o ? fld(o.c + '/SC') : ph('Cidade/SC')) + ', em ' + data + '.',
          'A transferência foi autorizada pela Central de Regulação de Vagas — CRV/DPP, em razão de que ' + motC + '.',
          'Ficamos à disposição de Vossa Excelência para quaisquer esclarecimentos.',
        ];
      }
    }
  }

  /* ── RESUMO IPEN (não gera ofício — tela mostra mensagem) ── */
  else if (s.mod === 'resumo_ipen') {
    return [p('Este modo gera apenas o Resumo Sintético — não há ofício a visualizar. Preencha os campos e clique em <strong>Resumo IPEN</strong>.')];
  }

  /* Retorna um array de parágrafos (um por bloco) — cada um vira uma <tr>
     própria em montarOficio(), para que a quebra de página aconteça sempre
     entre parágrafos, nunca no meio de um bloco de texto único. */
  return ps.map(p);
}

/* ── Injeta parágrafos de saúde antes do último parágrafo ── */
function _injetarSaude(s, ps, isMulti, isPermuta) {
  /* Permuta injeta saúde de forma especial (após os demais) */
  if (isPermuta) {
    var psSp = textoSaudeOficio(s, isMulti);
    if (psSp.length > 0) ps.push.apply(ps, psSp);
    return ps;
  }
  /* Adequação sempre injeta saúde via _injetarSaude */
  /* Multi sem saúde individual: sem injeção */
  if (isMulti && s.saudeOpcao !== 'formulario' && s.saudeOpcao !== 'sem_profissional') return ps;

  var psSaude = textoSaudeOficio(s, isMulti);
  if (psSaude.length > 0) {
    /* Insere antes do último parágrafo (desfecho) */
    var idx = ps.length - 1;
    var args = [idx, 0].concat(psSaude);
    ps.splice.apply(ps, args);
  }
  return ps;
}

/* ── Resumo Sintético ── */
function gerarTextoResumo(s) {
  var modLabels = {
    emergencial: 'transferência emergencial, amparado no art. 21, inciso I',
    mandado:     'transferência por mandado de comarca diversa, amparado no art. 21, inciso III',
    pernoite:    'pernoite, amparado no art. 21, inciso III',
    adequacao:   'transferência ordinária, amparado no art. 21, inciso III',
    ajuste_lotacional: 'transferência por ajuste lotacional, determinada pelo DPP e/ou CRV, amparado no art. 21, inciso III',
    permuta:     'permuta entre unidades, amparado no art. 21, inciso III',
    prisaocivil: 'transferência de preso civil, modalidade especializada',
    comunicacao: 'comunicação de transferência, nos termos do art. 16',
    resumo_ipen: 'transferência',
  };
  var artMod = modLabels[s.mod] || 'transferência';
  if (s.mod === 'resumo_ipen') {
    if (s.sub === 'art1')      artMod = 'transferência emergencial, amparada no art. 21, inciso I';
    else if (s.sub === 'art3') artMod = 'transferência, amparada no art. 21, inciso III';
  }
  var motivo = '', criterio = '';

  if (s.mod === 'emergencial')  { motivo = s.sit || 'situação emergencial'; criterio = 'transferência emergencial, sem critério eletivo de escolha'; }
  else if (s.mod === 'mandado') { motivo = 'cumprimento de Mandado de Prisão expedido pelo(a) ' + s.juizo; criterio = 'competência jurisdicional'; }
  else if (s.mod === 'pernoite'){ motivo = s.razPernoite || 'necessidade de pernoite'; criterio = 'necessidade operacional'; }
  else if (s.mod === 'adequacao' || s.mod === 'ajuste_lotacional'){ motivo = s.motTransf || 'adequação da capacidade de ocupação'; criterio = s.motIndicacao || 'critério de gestão de vagas'; }
  else if (s.mod === 'permuta') { motivo = s.motTransfPermuta || 'equalização de vagas'; criterio = s.motPermuta || 'critério de gestão'; }
  else if (s.mod === 'prisaocivil') { motivo = 'natureza da prisão civil e necessidade de unidade especializada'; criterio = 'modalidade de custódia'; }
  else if (s.mod === 'comunicacao') { motivo = s.motComun || 'transferência autorizada pela CRV/DPP'; criterio = 'N/A'; }
  else if (s.mod === 'resumo_ipen') { motivo = s.motTransf || 'adequação da situação do(a) custodiado(a)'; criterio = s.motIndicacao || 'critério de gestão de vagas'; }

  var isMultiReed = s.reed && s.reed.length > 1;
  var ori = s.ori ? s.ori.n : '[origem]';
  var destinoClause = s.des ? (', com transferência solicitada para o(a) ' + s.des.n) : '';
  var nomeRef = isMultiReed ? 'reeducando(a)' : (s.nome || '[nome]') + ' (IPEN nº ' + (s.ipen || '[ipen]') + ')';
  var sit  = !isMultiReed && s.regime   ? ' Situação penal: ' + s.regime + '.' : '';
  var aloc = !isMultiReed && s.alocacao ? ' Característica de alocação: ' + s.alocacao + '.' : '';

  return 'Trata-se de pedido de ' + artMod + ', envolvendo ' + nomeRef + ', custodiado(a) no(a) ' + ori + destinoClause + '.' + sit + aloc + ' O motivo da transferência é: ' + motivo + '. O critério de escolha/indicação do(a) apenado(a) foi: ' + criterio + '.';
}
