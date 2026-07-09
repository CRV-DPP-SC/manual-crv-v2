/* ============================================================
   FORMULÁRIO — event listeners, visibilidade e validação
   ============================================================ */

var FormularioCtrl = (function() {

  /* ── Renderiza a tela inicial de cards ── */
  function _renderizarCards() {
    var f = document.getElementById('form-area');
    f.innerHTML =
      '<div class="form-intro">Que tipo de ofício você precisa gerar?</div>'
      + '<div class="cards-grid">'
      + _card('emergencial', '🚨', 'Emergencial', 'Art. 21, I')
      + _card('mandado', '🏛', 'Mandado de Comarca', 'Art. 21, III')
      + _card('pernoite', '🔄', 'Pernoite', 'Art. 21, III')
      + _card('adequacao', '⚖', 'Adequação da Capacidade', 'Art. 21, III')
      + _card('permuta', '↔', 'Permuta entre Unidades', 'Art. 21, III')
      + _card('prisaocivil', '⚖', 'Prisão Civil', 'Especializada')
      + _card('comunicacao', '📨', 'Comunicação', 'Art. 16')
      + _card('resumo_ipen', '📄', 'Resumo Sintético IPEN', 'Sem ofício')
      + '</div>';
  }

  function _card(mod, icon, nome, artigo) {
    return '<div class="mod-card" onclick="FormularioCtrl.selecionarMod(\'' + mod + '\')">'
      + '<div class="card-icon">' + icon + '</div>'
      + '<div class="card-nome">' + nome + '</div>'
      + '<div class="card-artigo">' + artigo + '</div>'
      + '</div>';
  }

  /* ── Seleciona modalidade ── */
  function selecionarMod(mod) {
    /* Comunicação → Juiz(a); demais → Coordenador(a) da CRV */
    var sauInicial = mod === 'comunicacao' ? 'Senhor(a) Juiz(a),' : 'Senhor(a) Coordenador(a),';
    Estado.setMany({ mod: mod, sub: null, sau: sauInicial });
    _renderizarFormulario();
  }

  /* ── Trocar modalidade (com confirmação) ── */
  function trocarMod() {
    if (!confirm('Trocar o tipo apagará os dados já preenchidos. Deseja continuar?')) return;
    Estado.reset();
    _renderizarCards();
  }

  /* ── Renderiza o formulário completo para a modalidade atual ── */
  function _renderizarFormulario() {
    var s   = Estado.get();
    var mod = s.mod;
    var f   = document.getElementById('form-area');

    var html = _headerMod(s);

    /* Seções condicionais */
    html += _secaoSubtipo(s);
    html += _secaoReeducando(s);
    html += _secaoUnidades(s);
    html += _secaoCamposEspecificos(s);
    if (mod !== 'pernoite' && mod !== 'comunicacao' && mod !== 'resumo_ipen') {
      html += _secaoSaude(s);
    }
    if (mod !== 'comunicacao' && mod !== 'resumo_ipen') {
      html += _secaoAssinaturas(s);
    }
    if (mod !== 'resumo_ipen') {
      html += _secaoBPI(s);
      html += _secaoFormatacao(s);
    }
    html += '<div class="form-rodape"><button class="btn-limpar" onclick="FormularioCtrl.limpar()">🗑 Limpar formulário</button></div>';

    f.innerHTML = html;
    _vincularEventos(s);
    _atualizarIndicadores();
  }

  /* ── Header compacto após seleção ── */
  function _headerMod(s) {
    var nomes = {
      emergencial:'Transferência Emergencial', mandado:'Mandado de Comarca',
      pernoite:'Pernoite', adequacao:'Adequação da Capacidade',
      permuta:'Permuta entre Unidades', prisaocivil:'Prisão Civil',
      comunicacao:'Comunicação de Transferência', resumo_ipen:'Resumo Sintético IPEN',
    };
    var sub = '';
    if (s.sub) {
      var subs = {com_pad:'Com PAD — falta grave', sem_pad:'Sem PAD — risco à integridade',
        pontual:'Transferência', regime:'Alteração de Regime',
        saida:'Saída', entrada:'Entrada'};
      sub = subs[s.sub] ? '<span class="header-sub">' + subs[s.sub] + '</span>' : '';
    }
    return '<div class="mod-header">'
      + '<div class="mod-header-info">'
        + '<span class="mod-header-nome">' + (nomes[s.mod] || s.mod) + '</span>'
        + sub
      + '</div>'
      + '<button class="btn-trocar" onclick="FormularioCtrl.trocarMod()">Trocar ▾</button>'
      + '</div>';
  }

  /* ── Seção: Subtipo ── */
  function _secaoSubtipo(s) {
    var mod = s.mod;
    if (!['emergencial','adequacao','comunicacao'].includes(mod)) return '';
    var opts = [];
    if (mod === 'emergencial') opts = [['com_pad','📋 Com PAD — falta grave'],['sem_pad','⚠ Sem PAD — risco à integridade']];
    if (mod === 'adequacao')   opts = [['pontual','📋 Transferência'],['regime','🔄 Alteração de Regime']];
    if (mod === 'comunicacao') opts = [['saida','🚀 Saída — preso saiu desta unidade'],['entrada','🏠 Entrada — preso chegou nesta unidade']];

    var chips = opts.map(function(o) {
      return '<button class="chip' + (s.sub === o[0] ? ' sel' : '') + '" data-field="sub" data-val="' + o[0] + '">' + o[1] + '</button>';
    }).join('');

    return _secao('sub', 'Subtipo', chips, s.sub ? '✓' : '○', !s.sub);
  }

  /* ── Seção: Reeducando(s) ── */
  function _secaoReeducando(s) {
    var mod = s.mod;
    var comRegime  = ['emergencial','mandado','adequacao','permuta'].includes(mod);
    var semRegime  = ['pernoite','prisaocivil','comunicacao','resumo_ipen'].includes(mod);
    var isPlural   = s.numero === 'P';

    var generoChips = '<div class="chip-group">'
      + _chip('genero','M','Masculino', s.genero === 'M')
      + _chip('genero','F','Feminino', s.genero === 'F')
      + '</div>';
    var numeroChips = '<div class="chip-group">'
      + _chip('numero','S','1 preso', s.numero === 'S')
      + _chip('numero','P','Mais de um', s.numero === 'P')
      + '</div>';

    var camposHtml = generoChips + numeroChips;

    if (!isPlural) {
      /* Singular */
      camposHtml += _campo('nome', 'Nome completo', 'text', s.nome, 'Ex.: João da Silva Santos', true);
      camposHtml += _campo('ipen', 'IPEN', 'text', s.ipen, 'Ex.: 123456', true);
      if (!semRegime) {
        camposHtml += _secaoSitPenal(s, null);
      }
    } else {
      /* Plural */
      camposHtml += _renderizarReedList(s, !semRegime);
    }

    var ok = isPlural ? (s.reed && s.reed.length > 0) : (s.nome && s.ipen);
    return _secao('reed', 'Reeducando(s)', camposHtml, ok ? '✓' : (s.nome || s.ipen || (s.reed && s.reed.length > 0) ? '⚠' : '○'), false);
  }

  function _secaoSitPenal(s, idx) {
    var sufixo = idx !== null ? '_' + idx : '';
    var reg    = idx !== null ? (s.reed && s.reed[idx] ? s.reed[idx].regime : '') : s.regime;
    var aloc   = idx !== null ? (s.reed && s.reed[idx] ? s.reed[idx].alocacao : '') : s.alocacao;
    return '<div class="sit-penal-wrap">'
      + '<div class="campo-label">Situação Penal</div>'
      + '<div class="chip-group">'
      + _chip('regime' + sufixo, 'Provisório', '⚓ Provisório', reg === 'Provisório', true, idx)
      + _chip('regime' + sufixo, 'Fechado',    '🔒 Fechado',    reg === 'Fechado',    true, idx)
      + _chip('regime' + sufixo, 'Semiaberto', '🔓 Semiaberto', reg === 'Semiaberto', true, idx)
      + '</div>'
      + '<div class="campo-label">Característica de Alocação</div>'
      + '<div class="chip-group">'
      + _chip('alocacao' + sufixo, 'Convívio',      '👥 Convívio',     aloc === 'Convívio',      true, idx)
      + _chip('alocacao' + sufixo, 'Seguro',         '🛡 Seguro',        aloc === 'Seguro',         true, idx)
      + _chip('alocacao' + sufixo, 'SEGURO',         '🛡 SEGURO',        aloc === 'SEGURO',         true, idx, true)
      + _chip('alocacao' + sufixo, 'Não informado',  '❓ Não informado', aloc === 'Não informado',  true, idx)
      + '</div>'
      + '</div>';
  }

  function _renderizarReedList(s, comRegime) {
    var lista = s.reed || [];
    var comSaude = s.saudeOpcao === 'individual' && comRegime;

    var cabHtml = '<div class="reed-list-cab">'
      + '<span>Nome completo</span>'
      + '<span>IPEN</span>'
      + (comRegime ? '<span>Regime</span><span>Característica</span>' : '')
      + (comSaude  ? '<span>Saúde</span>' : '')
      + '<span></span>'
      + '</div>';

    var linhas = lista.map(function(r, i) {
      return '<div class="reed-row" id="reed-row-' + i + '">'
        + '<input class="inp-reed" data-ri="' + i + '" data-rf="nome" value="' + _esc(r.nome || '') + '" placeholder="Nome completo">'
        + '<input class="inp-reed inp-sm" data-ri="' + i + '" data-rf="ipen" value="' + _esc(r.ipen || '') + '" placeholder="IPEN">'
        + (comRegime ? _selectRegime(i, r.regime) + _selectAloc(i, r.alocacao) : '')
        + (comSaude  ? '<button class="btn-saude-ind" onclick="FormularioCtrl.editarSaudeReed(' + i + ')">🩺</button>' : '')
        + '<button class="btn-reed-del" onclick="FormularioCtrl.removerReed(' + i + ')">✕</button>'
        + '</div>';
    }).join('');

    return '<div class="reed-list">'
      + cabHtml
      + '<div id="reed-rows">' + linhas + '</div>'
      + '<button class="btn-add-reed" onclick="FormularioCtrl.adicionarReed()">+ Adicionar reeducando</button>'
      + (comRegime ? '<div class="campo-hint">💡 "Característica" corresponde ao campo "Característica de Alocação" exibido na transferência de 1 preso.</div>' : '')
      + '</div>';
  }

  function _selectRegime(i, val) {
    var opts = ['Provisório','Fechado','Semiaberto'];
    return '<select class="sel-reed" data-ri="' + i + '" data-rf="regime">'
      + '<option value="">Regime</option>'
      + opts.map(function(o) { return '<option' + (val === o ? ' selected' : '') + '>' + o + '</option>'; }).join('')
      + '</select>';
  }

  function _selectAloc(i, val) {
    var opts = ['Convívio','Seguro','SEGURO','Não informado'];
    return '<select class="sel-reed" data-ri="' + i + '" data-rf="alocacao">'
      + '<option value="">Característica</option>'
      + opts.map(function(o) { return '<option' + (val === o ? ' selected' : '') + '>' + o + '</option>'; }).join('')
      + '</select>';
  }

  /* ── Seção: Unidades ── */
  function _secaoUnidades(s) {
    var html = _btnUnidade('ori', 'Origem', s.ori)
      + _btnUnidade('des', 'Destino', s.des);
    var ok = s.ori && s.des;
    return _secao('unidades', 'Unidades', html, ok ? '✓' : (s.ori || s.des ? '⚠' : '○'), false);
  }

  function _btnUnidade(field, label, u) {
    return '<div class="campo-label">' + label + '</div>'
      + '<div class="btn-unidade-wrap">'
      + (u
        ? '<div class="un-selecionada" onclick="abrirModalUnidade(\'' + field + '\')">'
            + '<div class="un-sel-nome">' + _esc(u.n) + '</div>'
            + '<div class="un-sel-sub">' + _esc(u.sr) + ' · ' + _esc(u.dir) + '</div>'
          + '</div>'
          + '<button class="btn-un-limpar" onclick="FormularioCtrl.limparUnidade(\'' + field + '\')">✕</button>'
        : '<button class="btn-escolher-un" onclick="abrirModalUnidade(\'' + field + '\')">'
            + '+ Escolher unidade de ' + label.toLowerCase()
          + '</button>')
      + '</div>';
  }

  /* ── Seção: Campos Específicos ── */
  function _secaoCamposEspecificos(s) {
    var mod = s.mod;
    var html = '';
    var ok = false;

    if (mod === 'emergencial') {
      html += _textarea('sit', 'Situação concreta (descreva detalhadamente)', s.sit, 'Ex.: O reeducando ameaçou agentes...', true);
      if (s.sub === 'com_pad') {
        html += '<div class="campo-label">Quanto ao PAD</div>'
          + '<div class="chip-group">'
          + _chip('pad','FOI INSTAURADO','✓ Foi instaurado', s.pad === 'FOI INSTAURADO', true)
          + _chip('pad','SERÁ INSTAURADO','📋 Será instaurado', s.pad === 'SERÁ INSTAURADO', true)
          + '</div>'
          + '<div class="campo-label">Falta disciplinar (LEP)</div>'
          + '<select id="sel-falta" class="sel-falta">'
          + '<option value="">Selecione o inciso</option>'
          + FALTAS.map(function(f, i) {
              return '<option value="' + i + '"' + (s.faltaCod === f.c ? ' selected' : '') + '>' + f.c + ' — ' + f.d + '</option>';
            }).join('')
          + '</select>';
        ok = !!s.sit && !!s.pad && !!s.faltaCod;
      } else {
        ok = !!s.sit;
      }
    }
    else if (mod === 'mandado') {
      html += _campo('juizo', 'Juízo expedidor do Mandado de Prisão', 'text', s.juizo, 'Ex.: 2ª Vara Criminal da Comarca de Blumenau', true);
      ok = !!s.juizo;
    }
    else if (mod === 'pernoite') {
      html += _textarea('razPernoite', 'Razão do pernoite', s.razPernoite, 'Ex.: Audiência judicial na comarca de destino', true);
      ok = !!s.razPernoite;
    }
    else if (mod === 'adequacao') {
      html += _textarea('motTransf', 'Motivo da transferência', s.motTransf, 'Ex.: Necessidade de ajuste/equalização de vagas', true);
      html += _textarea('motIndicacao', 'Critério de escolha/indicação', s.motIndicacao, 'Ex.: Pena mais alta dentre os custodiados', true);
      ok = !!s.motTransf && !!s.motIndicacao;
    }
    else if (mod === 'permuta') {
      html += _textarea('motTransfPermuta', 'Motivo da permuta', s.motTransfPermuta, 'Ex.: Equalização da ocupação entre as unidades', true);
      html += _textarea('motPermuta', 'Critério de escolha/indicação', s.motPermuta, 'Ex.: Pena mais alta, perfil de risco', true);
      html += _secaoPermutaDes(s);
      ok = !!s.motTransfPermuta && !!s.motPermuta;
    }
    else if (mod === 'comunicacao') {
      html += _campo('dataTrans', 'Data da transferência', 'text', s.dataTrans, 'Ex.: 31/05/2026', true);
      html += _textarea('motComun', 'Motivo da comunicação', s.motComun, 'Ex.: A unidade de destino é competente...', true);
      html += _campo('nomejuiz', 'Nome do(a) Juiz(a)', 'text', s.nomejuiz, 'Ex.: Dra. Ana Paula Ferreira', true);
      html += _campo('vara', 'Vara / Unidade Judiciária', 'text', s.vara, 'Ex.: 1ª Vara de Execuções Penais', false);
      html += _campo('cidJuizo', 'Cidade/UF do Juízo', 'text', s.cidJuizo, 'Ex.: Blumenau/SC', false);
      ok = !!s.dataTrans && !!s.motComun && !!s.nomejuiz;
    }
    else if (mod === 'resumo_ipen') {
      html += _textarea('motTransf', 'Motivo da transferência', s.motTransf, 'Ex.: PAD instaurado, adequação de vagas...', true);
      html += _textarea('motIndicacao', 'Critério de indicação', s.motIndicacao, 'Ex.: Pena mais alta dentre os custodiados', true);
      ok = !!s.motTransf && !!s.motIndicacao;
    }
    else { ok = true; }

    if (!html) return '';
    return _secao('especifico', 'Dados específicos', html, ok ? '✓' : (html ? '⚠' : '○'), false);
  }

  function _secaoPermutaDes(s) {
    var lista = s.permutaDes || [];
    var html = '<div class="campo-label">Presos indicados pela unidade de destino (opcional)</div>'
      + '<div id="permuta-des-list">'
      + lista.map(function(r, i) {
          return '<div class="reed-row" id="pdes-row-' + i + '">'
            + '<input class="inp-reed" data-pdi="' + i + '" data-pdf="nome" value="' + _esc(r.nome||'') + '" placeholder="Nome completo">'
            + '<input class="inp-reed inp-sm" data-pdi="' + i + '" data-pdf="ipen" value="' + _esc(r.ipen||'') + '" placeholder="IPEN">'
            + _selectRegimePD(i, r.regime)
            + _selectAlocPD(i, r.alocacao)
            + '<button class="btn-reed-del" onclick="FormularioCtrl.removerPermutaDes(' + i + ')">✕</button>'
            + '</div>';
        }).join('')
      + '</div>'
      + '<button class="btn-add-reed" onclick="FormularioCtrl.adicionarPermutaDes()">+ Adicionar preso do destino</button>';
    return html;
  }

  function _selectRegimePD(i, val) {
    return '<select class="sel-reed" data-pdi="' + i + '" data-pdf="regime">'
      + '<option value="">Regime</option>'
      + ['Provisório','Fechado','Semiaberto'].map(function(o) {
          return '<option' + (val === o ? ' selected' : '') + '>' + o + '</option>';
        }).join('')
      + '</select>';
  }
  function _selectAlocPD(i, val) {
    return '<select class="sel-reed" data-pdi="' + i + '" data-pdf="alocacao">'
      + '<option value="">Característica</option>'
      + ['Convívio','Seguro','SEGURO','Não informado'].map(function(o) {
          return '<option' + (val === o ? ' selected' : '') + '>' + o + '</option>';
        }).join('')
      + '</select>';
  }

  /* ── Seção: Saúde ── */
  function _secaoSaude(s) {
    var isPlural = s.numero === 'P';
    var html = '<div class="campo-label">Será juntado Formulário de Saúde assinado por profissional técnico?</div>'
      + '<div class="chip-group">'
      + _chip('saudeOpcao','formulario','✅ Sim, formulário em anexo', s.saudeOpcao === 'formulario', true)
      + _chip('saudeOpcao','sem_profissional','🚫 Não — sem profissional disponível', s.saudeOpcao === 'sem_profissional', true)
      + _chip('saudeOpcao','individual','👤 Não — informar individualmente', s.saudeOpcao === 'individual', true)
      + '</div>';

    if (s.saudeOpcao === 'individual' && !isPlural) {
      html += _listaEditavel('comorbidades', 'Comorbidades', s.comorbidades || [], 'Ex.: Hipertensão arterial');
      html += _listaEditavel('medicamentos', 'Medicamentos de uso contínuo', s.medicamentos || [], 'Ex.: Losartana 50mg');
    }
    if (isPlural && s.saudeOpcao === 'individual') {
      html += '<div class="campo-hint">As informações de saúde são coletadas por reeducando na lista acima.</div>';
    }

    return _secao('saude', 'Saúde', html, s.saudeOpcao ? '✓' : '○', false);
  }

  function _listaEditavel(field, label, lista, ph) {
    return '<div class="campo-label" style="margin-top:10px">' + label + '</div>'
      + '<div id="lista-' + field + '">'
      + lista.map(function(item, i) {
          return '<div class="lista-item">'
            + '<span>' + _esc(item) + '</span>'
            + '<button onclick="FormularioCtrl.removerListaItem(\'' + field + '\',' + i + ')">✕</button>'
            + '</div>';
        }).join('')
      + '</div>'
      + '<div class="lista-add-row">'
        + '<input id="inp-' + field + '" class="inp-lista" placeholder="' + ph + '">'
        + '<button class="btn-add-item" onclick="FormularioCtrl.adicionarListaItem(\'' + field + '\')">+</button>'
      + '</div>';
  }

  /* ── Seção: Assinaturas ── */
  function _secaoAssinaturas(s) {
    var html = '<div class="campo-hint">Diretor(a) de Origem e Diretor(a) de Destino: sempre incluídos automaticamente.</div>'
      + '<div class="check-group">'
      + _check('sro', 'Superintendente Regional de Origem',     s.sro)
      + _check('srd', 'Superintendente Regional de Destino',    s.srd)
      + '</div>';
    return _secao('assinaturas', 'Assinaturas', html, '✓', false);
  }

  /* ── Seção: BPI ── */
  function _secaoBPI(s) {
    if (s.mod === 'pernoite') return '';
    var html = '<div class="chip-group" style="flex-direction:column;align-items:flex-start;">'
      + _chip('bpi','atualizado','✓ BPI atualizado no i-PEN', s.bpi === 'atualizado', true)
      + _chip('bpi','nao_atualizado','⚠ BPI não atualizado', s.bpi === 'nao_atualizado', true)
      + _chip('bpi','nao_ciente','👤 Não atualizado — destino ciente e sem óbice', s.bpi === 'nao_ciente', true)
      + '</div>';
    if (s.bpi === 'nao_atualizado') {
      html += _campo('bpiMotivo', 'Motivo da não atualização', 'text', s.bpiMotivo, 'Ex.: Aguardando atualização pelo Coordenador de Execução Penal', true);
    }
    var ok = !!s.bpi && (s.bpi !== 'nao_atualizado' || !!s.bpiMotivo);
    return _secao('bpi', 'BPI — Boletim Penal Informativo', html, ok ? '✓' : (s.bpi ? '⚠' : '○'), false);
  }

  /* ── Seção: Formatação (número, saudação, fechamento) ── */
  function _secaoFormatacao(s) {
    var forcaSau = s.mod === 'comunicacao';
    var html = '';

    if (!forcaSau) {
      html += '<div class="campo-label">Saudação</div>'
        + '<div class="chip-group">'
        + _chip('sau','Senhor(a) Coordenador(a),','Coordenador(a)', s.sau === 'Senhor(a) Coordenador(a),', true)
        + _chip('sau','Senhor(a) Juiz(a),','Juiz(a)', s.sau === 'Senhor(a) Juiz(a),', true)
        + _chip('sau','Senhor(a) Diretor(a),','Diretor(a)', s.sau === 'Senhor(a) Diretor(a),', true)
        + _chip('sau','Senhor(a) Superintendente,','Superintendente', s.sau === 'Senhor(a) Superintendente,', true)
        + '</div>';
    }

    html += '<div class="campo-label">Fechamento</div>'
      + '<div class="chip-group">'
      + _chip('desp','Atenciosamente,','Atenciosamente', s.desp === 'Atenciosamente,', true)
      + _chip('desp','Respeitosamente,','Respeitosamente', s.desp === 'Respeitosamente,', true)
      + '</div>'
      + '<div class="campo-label" style="margin-top:10px">Número do ofício</div>'
      + '<div class="chip-group">'
      + _chip('numOficioToggle','nao','Sem número', s.numOficio === '', true)
      + _chip('numOficioToggle','sim','Com número', s.numOficio !== null && s.numOficio !== '', true)
      + '</div>';

    if (s.numOficio !== null && s.numOficio !== '') {
      var sugestao = _sugerirNumOficio();
      html += '<input id="inp-numOficio" class="inp-campo" value="' + _esc(s.numOficio || '') + '" placeholder="' + _esc(sugestao || 'Ex.: Ofício nº 043/2026/DPP') + '">';
    }

    var ok = (!!s.sau || forcaSau) && !!s.desp;
    return _secao('formatacao', 'Número e formatação', html, ok ? (s.numOficio !== null ? '✓' : '○') : '○', false);
  }

  /* ── Helpers de UI ── */
  function _secao(id, titulo, conteudo, indicador, startOpen) {
    var cls = indicador === '✓' ? 'sec-ok' : indicador === '⚠' ? 'sec-pend' : 'sec-vazia';
    return '<div class="form-secao" id="sec-' + id + '">'
      + '<div class="sec-head" onclick="_toggleSecao(\'' + id + '\')">'
        + '<div class="sec-titulo">'
          + '<span class="sec-ind ' + cls + '">' + indicador + '</span>'
          + titulo
        + '</div>'
        + '<span class="sec-chevron" id="chev-' + id + '">▾</span>'
      + '</div>'
      + '<div class="sec-corpo" id="corpo-' + id + '">' + conteudo + '</div>'
      + '</div>';
  }

  function _chip(field, val, label, sel, wrap, idx, perigo) {
    var fieldAttr = idx !== null && idx !== undefined ? field : field;
    return '<button class="chip' + (sel ? ' sel' : '') + (perigo ? ' perigo' : '') + '"'
      + ' data-field="' + fieldAttr + '" data-val="' + _esc(val) + '"'
      + (idx !== null && idx !== undefined ? ' data-idx="' + idx + '"' : '')
      + '>' + label + '</button>';
  }

  function _check(field, label, checked) {
    return '<label class="check-item">'
      + '<input type="checkbox" data-field="' + field + '"' + (checked ? ' checked' : '') + '>'
      + label
      + '</label>';
  }

  function _campo(field, label, type, val, placeholder, required) {
    return '<div class="campo-wrap">'
      + '<label class="campo-label">' + label + (required ? '' : ' <span class="opc">(opcional)</span>') + '</label>'
      + '<input id="inp-' + field + '" class="inp-campo" type="' + type + '" value="' + _esc(val || '') + '" placeholder="' + _esc(placeholder || '') + '" data-field="' + field + '">'
      + '</div>';
  }

  function _textarea(field, label, val, placeholder, required) {
    return '<div class="campo-wrap">'
      + '<label class="campo-label">' + label + (required ? '' : ' <span class="opc">(opcional)</span>') + '</label>'
      + '<textarea id="inp-' + field + '" class="inp-textarea" data-field="' + field + '" placeholder="' + _esc(placeholder || '') + '">' + _esc(val || '') + '</textarea>'
      + '</div>';
  }

  /* ── Vincula eventos após renderização ── */
  function _vincularEventos(s) {
    /* Chips */
    document.querySelectorAll('#form-area .chip').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var field = this.dataset.field;
        var val   = this.dataset.val;
        var idx   = this.dataset.idx !== undefined ? parseInt(this.dataset.idx) : null;

        if (field === 'numOficioToggle') {
          var _defNum = _sugerirNumOficio() || ('Ofício nº 001/' + new Date().getFullYear() + '/DPP');
          Estado.set('numOficio', val === 'nao' ? '' : _defNum);
          _renderizarFormulario();
          return;
        }

        if (idx !== null) {
          /* Campo dentro de um reeducando */
          var reed = Estado.get('reed');
          if (reed[idx]) {
            reed[idx][field.replace('_' + idx, '')] = val;
            Estado.set('reed', reed);
          }
          return;
        }

        Estado.set(field, val);

        if (['sub','genero','numero','saudeOpcao','bpi','mod'].includes(field)) {
          /* Campos que alteram a estrutura do formulário → re-render completo */
          _renderizarFormulario();
        } else {
          /* Campos que só precisam de feedback visual (regime, alocacao, sau, desp…) */
          document.querySelectorAll('#form-area .chip[data-field="' + field + '"]').forEach(function(b) {
            b.classList.toggle('sel', b.dataset.val === val);
          });
        }
      });
    });

    /* Checkboxes */
    document.querySelectorAll('#form-area input[type=checkbox][data-field]').forEach(function(cb) {
      cb.addEventListener('change', function() {
        Estado.set(this.dataset.field, this.checked);
      });
    });

    /* Inputs de texto */
    document.querySelectorAll('#form-area input[data-field]:not([type=checkbox]), #form-area textarea[data-field]').forEach(function(inp) {
      inp.addEventListener('input', function() { Estado.set(this.dataset.field, this.value); });
      inp.addEventListener('blur',  function() { _validarCampo(this); });
    });

    /* Input numOficio */
    var inpNum = document.getElementById('inp-numOficio');
    if (inpNum) {
      inpNum.addEventListener('input', function() { Estado.set('numOficio', this.value); });
    }

    /* Select falta LEP */
    var selFalta = document.getElementById('sel-falta');
    if (selFalta) {
      selFalta.addEventListener('change', function() {
        var idx = parseInt(this.value);
        if (!isNaN(idx) && FALTAS[idx]) {
          Estado.setMany({faltaCod: FALTAS[idx].c, faltaDesc: FALTAS[idx].d});
        }
      });
    }

    /* Inputs de reeducandos */
    document.querySelectorAll('.inp-reed[data-ri]').forEach(function(inp) {
      inp.addEventListener('input', function() {
        var ri = parseInt(this.dataset.ri);
        var rf = this.dataset.rf;
        var reed = Estado.get('reed');
        if (reed[ri]) { reed[ri][rf] = this.value; Estado.set('reed', reed); }
      });
    });
    document.querySelectorAll('.sel-reed[data-ri]').forEach(function(sel) {
      sel.addEventListener('change', function() {
        var ri = parseInt(this.dataset.ri);
        var rf = this.dataset.rf;
        var reed = Estado.get('reed');
        if (reed[ri]) { reed[ri][rf] = this.value; Estado.set('reed', reed); }
      });
    });

    /* Inputs de permutaDes */
    document.querySelectorAll('.inp-reed[data-pdi]').forEach(function(inp) {
      inp.addEventListener('input', function() {
        var pi = parseInt(this.dataset.pdi);
        var pf = this.dataset.pdf;
        var pd = Estado.get('permutaDes');
        if (pd[pi]) { pd[pi][pf] = this.value; Estado.set('permutaDes', pd); }
      });
    });
    document.querySelectorAll('.sel-reed[data-pdi]').forEach(function(sel) {
      sel.addEventListener('change', function() {
        var pi = parseInt(this.dataset.pdi);
        var pf = this.dataset.pdf;
        var pd = Estado.get('permutaDes');
        if (pd[pi]) { pd[pi][pf] = this.value; Estado.set('permutaDes', pd); }
      });
    });
  }

  /* ── Validação por campo ── */
  function _validarCampo(el) {
    var val = el.value.trim();
    var required = el.closest('.campo-wrap') || el.closest('.reed-row');
    el.classList.toggle('inp-invalido', !val && !!required);
  }

  /* ── Atualiza indicadores de seção ── */
  function _atualizarIndicadores() {
    /* Será atualizado pelo preview via Estado.onChange */
  }

  /* ── Ações expostas ── */
  function adicionarReed() {
    var s = Estado.get();
    var reed = s.reed.slice();
    reed.push({nome:'', ipen:'', regime:'', alocacao:'', comorbidades:[], medicamentos:[]});
    Estado.set('reed', reed);
    _renderizarFormulario();
  }

  function removerReed(i) {
    var reed = Estado.get('reed');
    reed.splice(i, 1);
    Estado.set('reed', reed);
    _renderizarFormulario();
  }

  function adicionarPermutaDes() {
    var pd = Estado.get('permutaDes').slice();
    pd.push({nome:'', ipen:'', regime:'', alocacao:''});
    Estado.set('permutaDes', pd);
    _renderizarFormulario();
  }

  function removerPermutaDes(i) {
    var pd = Estado.get('permutaDes');
    pd.splice(i, 1);
    Estado.set('permutaDes', pd);
    _renderizarFormulario();
  }

  function adicionarListaItem(field) {
    var inp = document.getElementById('inp-' + field);
    if (!inp || !inp.value.trim()) return;
    var lista = Estado.get(field).slice();
    lista.push(inp.value.trim());
    Estado.set(field, lista);
    inp.value = '';
    _renderizarFormulario();
  }

  function removerListaItem(field, i) {
    var lista = Estado.get(field).slice();
    lista.splice(i, 1);
    Estado.set(field, lista);
    _renderizarFormulario();
  }

  function limpar() {
    if (!confirm('Limpar todos os campos do formulário?')) return;
    Estado.reset();
    _renderizarCards();
  }

  function limparUnidade(field) {
    Estado.set(field, null);
    _renderizarFormulario();
  }

  function atualizarCampoUnidade(field, u) {
    _renderizarFormulario();
  }

  /* Sincroniza formulário após carregar do histórico */
  function sincronizar() {
    var s = Estado.get();
    if (s.mod) _renderizarFormulario();
    else _renderizarCards();
  }

  function editarSaudeReed(i) {
    var s = Estado.get();
    var r = s.reed[i];
    if (!r) return;

    var existing = document.getElementById('modal-saude-reed');
    if (existing) existing.remove();

    function _listaHtml(field) {
      var items = (r[field] || []);
      return items.map(function(item, ci) {
        return '<div class="lista-item"><span>' + _esc(item) + '</span>'
          + '<button onclick="FormularioCtrl._saudeRemoverItem(' + i + ',\'' + field + '\',' + ci + ')">✕</button></div>';
      }).join('');
    }

    var modal = document.createElement('div');
    modal.id = 'modal-saude-reed';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:800;display:flex;align-items:center;justify-content:center;padding:20px;';
    modal.innerHTML =
      '<div style="background:var(--bg-card,#fff);border-radius:12px;width:100%;max-width:440px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.22);">'
      + '<div style="background:#1d4ed8;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;">'
        + '<h3 style="font-size:.92rem;font-weight:700;color:#fff;margin:0;">🩺 Saúde — ' + _esc(r.nome || ('Reeducando ' + (i + 1))) + '</h3>'
        + '<button onclick="document.getElementById(\'modal-saude-reed\').remove()" style="background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:6px;padding:3px 10px;cursor:pointer;font-size:.8rem;">✕</button>'
      + '</div>'
      + '<div style="padding:16px;">'
        + '<div class="campo-label">Comorbidades</div>'
        + '<div id="msr-com-lista">' + _listaHtml('comorbidades') + '</div>'
        + '<div class="lista-add-row">'
          + '<input id="msr-com-inp" class="inp-lista" placeholder="Ex.: Hipertensão arterial">'
          + '<button class="btn-add-item" onclick="FormularioCtrl._saudeAddItem(' + i + ',\'comorbidades\')">+</button>'
        + '</div>'
        + '<div class="campo-label" style="margin-top:12px;">Medicamentos de uso contínuo</div>'
        + '<div id="msr-med-lista">' + _listaHtml('medicamentos') + '</div>'
        + '<div class="lista-add-row">'
          + '<input id="msr-med-inp" class="inp-lista" placeholder="Ex.: Losartana 50mg">'
          + '<button class="btn-add-item" onclick="FormularioCtrl._saudeAddItem(' + i + ',\'medicamentos\')">+</button>'
        + '</div>'
        + '<div style="display:flex;justify-content:flex-end;margin-top:16px;">'
          + '<button class="btn-limpar" onclick="document.getElementById(\'modal-saude-reed\').remove()">Fechar</button>'
        + '</div>'
      + '</div>'
      + '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });

    /* Enter nos inputs adiciona o item */
    var comInp = document.getElementById('msr-com-inp');
    var medInp = document.getElementById('msr-med-inp');
    if (comInp) comInp.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); FormularioCtrl._saudeAddItem(i, 'comorbidades'); } });
    if (medInp) medInp.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); FormularioCtrl._saudeAddItem(i, 'medicamentos'); } });
  }

  function _saudeAddItem(reedIdx, field) {
    var inpId = field === 'comorbidades' ? 'msr-com-inp' : 'msr-med-inp';
    var inp = document.getElementById(inpId);
    if (!inp || !inp.value.trim()) return;
    var reed = Estado.get('reed');
    if (!reed[reedIdx]) return;
    if (!Array.isArray(reed[reedIdx][field])) reed[reedIdx][field] = [];
    reed[reedIdx][field].push(inp.value.trim());
    var saved = inp.value.trim();
    inp.value = '';
    Estado.set('reed', reed);
    /* Atualiza lista no modal sem re-renderizar formulário inteiro */
    var listId = field === 'comorbidades' ? 'msr-com-lista' : 'msr-med-lista';
    var listEl = document.getElementById(listId);
    if (listEl) {
      var ci = reed[reedIdx][field].length - 1;
      listEl.insertAdjacentHTML('beforeend',
        '<div class="lista-item"><span>' + _esc(saved) + '</span>'
        + '<button onclick="FormularioCtrl._saudeRemoverItem(' + reedIdx + ',\'' + field + '\',' + ci + ')">✕</button></div>');
    }
    inp.focus();
  }

  function _saudeRemoverItem(reedIdx, field, itemIdx) {
    var reed = Estado.get('reed');
    if (!reed[reedIdx] || !Array.isArray(reed[reedIdx][field])) return;
    reed[reedIdx][field].splice(itemIdx, 1);
    Estado.set('reed', reed);
    /* Re-renderiza lista completa para acertar índices */
    var listId = field === 'comorbidades' ? 'msr-com-lista' : 'msr-med-lista';
    var listEl = document.getElementById(listId);
    if (listEl) {
      listEl.innerHTML = reed[reedIdx][field].map(function(item, ci) {
        return '<div class="lista-item"><span>' + _esc(item) + '</span>'
          + '<button onclick="FormularioCtrl._saudeRemoverItem(' + reedIdx + ',\'' + field + '\',' + ci + ')">✕</button></div>';
      }).join('');
    }
  }

  /* ── Inicialização ── */
  function inicializar() {
    _renderizarCards();
  }

  return {
    inicializar: inicializar,
    selecionarMod: selecionarMod,
    trocarMod: trocarMod,
    adicionarReed: adicionarReed,
    removerReed: removerReed,
    adicionarPermutaDes: adicionarPermutaDes,
    removerPermutaDes: removerPermutaDes,
    adicionarListaItem: adicionarListaItem,
    removerListaItem: removerListaItem,
    limpar: limpar,
    limparUnidade: limparUnidade,
    atualizarCampoUnidade: atualizarCampoUnidade,
    sincronizar: sincronizar,
    editarSaudeReed: editarSaudeReed,
    _saudeAddItem: _saudeAddItem,
    _saudeRemoverItem: _saudeRemoverItem,
  };
})();

/* ── Colapso de seções ── */
function _toggleSecao(id) {
  var corpo = document.getElementById('corpo-' + id);
  var chev  = document.getElementById('chev-' + id);
  if (!corpo) return;
  var aberto = corpo.style.display !== 'none';
  corpo.style.display = aberto ? 'none' : '';
  if (chev) chev.textContent = aberto ? '▸' : '▾';
}

/* Colapsa todas as seções exceto a primeira visível (para notebook/mobile) */
function _colapsarSecoes() {
  var isMobile = window.innerWidth <= 1100;
  if (!isMobile) return;
  var primeiraNaoColapsada = true;
  document.querySelectorAll('.form-secao').forEach(function(sec) {
    var id = sec.id.replace('sec-', '');
    var corpo = document.getElementById('corpo-' + id);
    var chev  = document.getElementById('chev-' + id);
    if (!corpo) return;
    if (primeiraNaoColapsada) { primeiraNaoColapsada = false; return; }
    corpo.style.display = 'none';
    if (chev) chev.textContent = '▸';
  });
}
