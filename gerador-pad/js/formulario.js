/* ============================================================
   FORMULÁRIO — renderização dinâmica e event listeners
   ============================================================ */

var FormularioCtrl = (function() {

  /* ── Renderiza as seções do documento ativo ── */
  function _render() {
    var s = Estado.get();
    var f = document.getElementById('form-area');
    if (!f) return;

    var secoes = '';
    switch (_DOC_ATUAL) {
      case 'portaria':
        secoes = _secUpload() + _secPad(s) + _secIncidentado(s) + _secInfracao(s) + _secConselho(s) + _secDiretor(s);
        break;
      case 'oitiva_inc':
        secoes = _secDefesa(s);
        break;
      case 'oitivas_test':
        secoes = _secTestemunhas(s);
        break;
      case 'manifestacao':
        secoes = _secManifestacao(s);
        break;
      case 'decisao':
        secoes = _secDecisao(s);
        break;
      case 'oficio_vep':
        secoes = _secOficioVep(s);
        break;
      case 'oficio_juiz':
        secoes = _secOficioJuiz(s);
        break;
      default:
        secoes = _secUpload() + _secPad(s) + _secIncidentado(s) + _secInfracao(s) + _secConselho(s) + _secDiretor(s);
    }

    f.innerHTML = secoes
      + '<div class="form-rodape">'
        + '<button class="btn-limpar" onclick="FormularioCtrl.limpar()">🗑 Novo PAD</button>'
      + '</div>';

    _vincular(s);
  }

  /* ── Seção: Upload PDF ── */
  function _secUpload() {
    return '<div class="form-secao">'
      + '<div class="sec-head" onclick="_toggleSec(this)">'
        + '<span class="sec-titulo">📄 Importar PDF do i-PEN</span>'
        + '<span class="sec-chevron">▼</span>'
      + '</div>'
      + '<div class="sec-corpo">'
        + '<div id="zona-upload" class="zona-upload">'
          + '<div class="upload-icon">📂</div>'
          + '<div class="upload-txt">Arraste o PDF do i-PEN aqui<br><span style="font-size:.75rem;color:#999;">ou clique para selecionar</span></div>'
        + '</div>'
        + '<input type="file" id="inp-pdf" accept=".pdf" style="display:none">'
        + '<div id="upload-status" class="upload-status"></div>'
      + '</div>'
    + '</div>';
  }

  /* ── Seção: Identificação do PAD ── */
  function _secPad(s) {
    return '<div class="form-secao">'
      + '<div class="sec-head" onclick="_toggleSec(this)">'
        + '<span class="sec-titulo">📋 Identificação do PAD</span>'
        + _ind(s.numPad && s.dataInst)
        + '<span class="sec-chevron">▼</span>'
      + '</div>'
      + '<div class="sec-corpo">'
        + _campo('Nº do PAD (Portaria de Instauração)', 'text', 'inp-numPad', s.numPad, 'ex: 001/2026', true)
        + _campo('Data de Instauração', 'date', 'inp-dataInst', s.dataInst, '', true)
      + '</div>'
    + '</div>';
  }

  /* ── Seção: Incidentado ── */
  function _secIncidentado(s) {
    var i = s.incidentado || {};
    var cpfVal = i.ipen || '';
    return '<div class="form-secao">'
      + '<div class="sec-head" onclick="_toggleSec(this)">'
        + '<span class="sec-titulo">👤 Incidentado</span>'
        + _ind(i.nome && (i.prontuario || i.ipen))
        + '<span class="sec-chevron">▼</span>'
      + '</div>'
      + '<div class="sec-corpo">'
        + _campo('Nome completo', 'text', 'inp-inc-nome', i.nome, 'NOME DO INCIDENTADO', true)
        + _row2(
            _campo('Prontuário / IPEN', 'text', 'inp-inc-pront', i.prontuario, 'ex: 750126', true),
            _campo('CPF', 'text', 'inp-inc-ipen', cpfVal, 'xxx.xxx.xxx-xx')
          )
        + _row2(
            _campo('Nascimento', 'date', 'inp-inc-nasc', i.nascimento),
            _campo('Naturalidade', 'text', 'inp-inc-nat', i.naturalidade, 'ex: Florianópolis - SC')
          )
        + _campo('Nome da mãe', 'text', 'inp-inc-mae', i.mae)
        + _row2(
            _campo('Regime', 'text', 'inp-inc-regime', i.regime, 'ex: Fechado'),
            _campo('Comportamento', 'text', 'inp-inc-comp', i.comportamento, 'ex: Bom')
          )
        + _campo('Cela / Alojamento', 'text', 'inp-inc-cela', i.cela, 'ex: Ala M, Gal I, Bloco D, Cela 102')
      + '</div>'
    + '</div>';
  }

  /* ── Seção: Infração ── */
  function _secInfracao(s) {
    var inf = s.infracao || {};
    var opts = ARTIGOS_LEP.map(function(a) {
      return '<option value="' + a.cod + '"' + (inf.artigo === a.cod ? ' selected' : '') + '>' + a.label + '</option>';
    }).join('');

    return '<div class="form-secao">'
      + '<div class="sec-head" onclick="_toggleSec(this)">'
        + '<span class="sec-titulo">⚠️ Infração</span>'
        + _ind(inf.artigo && inf.data && inf.descricao)
        + '<span class="sec-chevron">▼</span>'
      + '</div>'
      + '<div class="sec-corpo">'
        + _campo('Data da Infração', 'date', 'inp-inf-data', inf.data, '', true)
        + '<div class="campo-wrap">'
          + '<label class="campo-label">Artigo da LEP <span style="color:#dc2626">*</span></label>'
          + '<select class="sel-falta" id="sel-inf-artigo"><option value="">— Selecione —</option>' + opts + '</select>'
        + '</div>'
        + '<div class="campo-wrap">'
          + '<label class="campo-label">Descrição dos Fatos <span style="color:#dc2626">*</span></label>'
          + '<textarea class="inp-textarea" id="inp-inf-desc" rows="5" placeholder="Descrição extraída do i-PEN ou digitada manualmente...">' + _esc(inf.descricao || '') + '</textarea>'
        + '</div>'
        + '<div class="campo-wrap">'
          + '<label class="campo-label">Agentes Envolvidos</label>'
          + '<input type="text" class="inp-campo" id="inp-inf-agentes" value="' + _esc((inf.agentes||[]).join(', ')) + '" placeholder="ex: João da Silva, Maria Souza">'
          + '<div class="campo-hint">Separe os nomes por vírgula</div>'
        + '</div>'
      + '</div>'
    + '</div>';
  }

  /* ── Seção: Defesa ── */
  function _secDefesa(s) {
    var d   = s.defesa || {};
    var tipo = d.tipo || '';
    var chipSel = function(v, lbl) {
      return '<button class="chip' + (tipo === v ? ' sel' : '') + '" data-val="' + v + '" onclick="FormularioCtrl.setDefesaTipo(\'' + v + '\')">' + lbl + '</button>';
    };
    var extra = '';
    if (tipo === 'advogado') {
      extra = _row2(
        _campo('Nome do Advogado', 'text', 'inp-adv-nome', d.advNome, 'Nome completo'),
        _campo('OAB', 'text', 'inp-adv-oab', d.advOab, 'ex: OAB/SC 12345')
      );
    }
    return '<div class="form-secao">'
      + '<div class="sec-head" onclick="_toggleSec(this)">'
        + '<span class="sec-titulo">⚖️ Oitiva do Incidentado / Defesa</span>'
        + _ind(!!tipo)
        + '<span class="sec-chevron">▼</span>'
      + '</div>'
      + '<div class="sec-corpo">'
        + '<div class="campo-wrap"><label class="campo-label">Tipo de Defesa <span style="color:#dc2626">*</span></label>'
          + '<div class="chip-group">'
            + chipSel('sem_defesa', 'Sem Defesa')
            + chipSel('defensoria', 'Defensoria Pública')
            + chipSel('advogado',   'Advogado Constituído')
          + '</div>'
        + '</div>'
        + extra
        + '<div class="campo-wrap">'
          + '<label class="campo-label">Versão do Incidentado <span class="opc">(opcional)</span></label>'
          + '<textarea class="inp-textarea" id="inp-versao-inc" rows="3" placeholder="Resumo da versão apresentada pelo incidentado em sua oitiva...">' + _esc(d.versaoIncidentado||'') + '</textarea>'
          + '<div class="campo-hint">Será reaproveitada na Manifestação do Conselho e na Decisão.</div>'
        + '</div>'
      + '</div>'
    + '</div>';
  }

  /* ── Seção: Testemunhas ── */
  function _secTestemunhas(s) {
    var testes = s.testemunhas || [];
    var rows = testes.map(function(te, i) {
      return '<div class="te-row" data-idx="' + i + '">'
        + '<div class="te-idx">' + (i+1) + '</div>'
        + '<div class="te-campos">'
          + '<input type="text" class="inp-campo inp-te-nome" data-idx="' + i + '" placeholder="Nome da testemunha" value="' + _esc(te.nome||'') + '">'
          + '<input type="text" class="inp-campo inp-te-qual" data-idx="' + i + '" placeholder="Qualificação (cargo, matrícula...)" value="' + _esc(te.qualificacao||'') + '" style="margin-top:5px">'
        + '</div>'
        + '<button class="btn-te-del" onclick="FormularioCtrl.removerTestemunha(' + i + ')" title="Remover">✕</button>'
      + '</div>';
    }).join('');

    return '<div class="form-secao">'
      + '<div class="sec-head" onclick="_toggleSec(this)">'
        + '<span class="sec-titulo">🧑‍💼 Testemunhas <span style="font-size:.72rem;font-weight:400;opacity:.7;">(' + testes.length + ')</span></span>'
        + '<span class="sec-chevron">▼</span>'
      + '</div>'
      + '<div class="sec-corpo">'
        + (rows || '<div style="font-size:.82rem;color:#999;margin-bottom:10px;">Nenhuma testemunha cadastrada.</div>')
        + '<button class="btn-add-reed" onclick="FormularioCtrl.adicionarTestemunha()">+ Adicionar Testemunha</button>'
        + '<div class="campo-hint" style="margin-top:6px;">Um Termo de Oitiva será gerado para cada testemunha.</div>'
      + '</div>'
    + '</div>';
  }

  /* ── Seção: Conselho Disciplinar ── */
  function _secConselho(s) {
    var c = s.conselho || {};
    var _membro = function(id, lbl, obj) {
      return '<div class="conselho-membro">'
        + '<div class="conselho-membro-label">' + lbl + '</div>'
        + _row2(
            _campo('Nome', 'text', 'inp-co-' + id + '-nome', (obj||{}).nome, 'Nome completo'),
            _campo('Matrícula', 'text', 'inp-co-' + id + '-mat', (obj||{}).matricula, 'ex: 123456')
          )
      + '</div>';
    };
    return '<div class="form-secao">'
      + '<div class="sec-head" onclick="_toggleSec(this)">'
        + '<span class="sec-titulo">👥 Conselho Disciplinar</span>'
        + _ind(!!(c.presidente && c.presidente.nome && c.membro1 && c.membro1.nome && c.membro2 && c.membro2.nome))
        + '<span class="sec-chevron">▼</span>'
      + '</div>'
      + '<div class="sec-corpo">'
        + _membro('pres', '🏛 Presidente', c.presidente)
        + _membro('m1',   '👤 Membro 1',   c.membro1)
        + _membro('m2',   '👤 Membro 2',   c.membro2)
        + '<div style="margin-top:8px;">'
          + '<button class="btn-acao btn-sec" onclick="salvarConselho()" style="font-size:.76rem;padding:6px 13px;">💾 Salvar Conselho</button>'
          + '<div class="campo-hint">Os membros ficam salvos para sua unidade.</div>'
        + '</div>'
      + '</div>'
    + '</div>';
  }

  /* ── Seção: Manifestação do Conselho ── */
  function _secManifestacao(s) {
    var m   = s.manifestacao || {};
    var cc  = m.conclusao || '';
    var chipSel = function(v, lbl) {
      return '<button class="chip' + (cc === v ? ' sel' : '') + '" data-val="' + v + '" onclick="FormularioCtrl.setConclusao(\'' + v + '\')">' + lbl + '</button>';
    };
    return '<div class="form-secao">'
      + '<div class="sec-head" onclick="_toggleSec(this)">'
        + '<span class="sec-titulo">📝 Manifestação do Conselho</span>'
        + _ind(!!cc)
        + '<span class="sec-chevron">▼</span>'
      + '</div>'
      + '<div class="sec-corpo">'
        + '<div class="campo-wrap"><label class="campo-label">Conclusão do Conselho</label>'
          + '<div class="chip-group">'
            + chipSel('procedencia',      '✅ Procedência')
            + chipSel('improcedencia',    '❌ Improcedência')
            + chipSel('desclassificacao', '⚖️ Desclassificação')
          + '</div>'
        + '</div>'
        + '<div class="campo-wrap">'
          + '<label class="campo-label">Fundamentação Complementar <span class="opc">(opcional)</span></label>'
          + '<textarea class="inp-textarea" id="inp-mani-fund" rows="3" placeholder="Fundamentos específicos adicionais...">' + _esc(m.fundamento||'') + '</textarea>'
        + '</div>'
      + '</div>'
    + '</div>';
  }

  /* ── Seção: Decisão ── */
  function _secDecisao(s) {
    var dec = s.decisao || {};
    var res = dec.resultado || '';
    var sc  = dec.sancoes   || {};
    var pr  = sc.perdaRemicao || {};

    var chipSel = function(v, lbl) {
      return '<button class="chip' + (res === v ? ' sel' : '') + '" onclick="FormularioCtrl.setResultado(\'' + v + '\')">' + lbl + '</button>';
    };

    var extra = '';
    if (res === 'desclassificacao') {
      var gSel = function(v, lbl) {
        return '<button class="chip' + (dec.desclassGrau === v ? ' sel' : '') + '" onclick="FormularioCtrl.setDesclass(\'' + v + '\')">' + lbl + '</button>';
      };
      extra = '<div class="campo-wrap"><label class="campo-label">Grau após desclassificação</label>'
        + '<div class="chip-group">' + gSel('leve','Falta Leve (Art. 95)') + gSel('media','Falta Média (Art. 96)') + '</div>'
      + '</div>';
    } else if (res === 'falta_grave') {
      var chk = function(id, campo, lbl) {
        return '<label class="check-item">'
          + '<input type="checkbox" id="' + id + '"' + (sc[campo] ? ' checked' : '') + ' onchange="FormularioCtrl.setSancao(\'' + campo + '\',this.checked)">'
          + lbl + '</label>';
      };
      extra = '<div class="campo-wrap"><label class="campo-label">Sanções a Aplicar</label>'
        + '<div class="check-group">'
          + chk('chk-regr',    'regressaoRegime',       'Regressão de regime — art. 118, I, LEP')
          + chk('chk-prog',    'interrupcaoProgressao', 'Interrupção da progressão — art. 112, §6º, LEP')
          + chk('chk-saida',   'revogacaoSaidaTemp',    'Revogação saída temporária — art. 125, LEP')
          + chk('chk-trab',    'revogacaoTrabalhoExt',  'Revogação trabalho externo — art. 123, LEP')
          + '<label class="check-item"><input type="checkbox" id="chk-remicao"'
            + (pr.aplicar ? ' checked' : '') + ' onchange="FormularioCtrl.setSancaoRemicao(this.checked)">'
            + 'Perda de dias remidos — art. 127, LEP</label>'
        + '</div>'
      + '</div>'
      + (pr.aplicar ? '<div class="campo-wrap" id="wrap-remicao">'
          + '<label class="campo-label">Quantidade / Fração de remição</label>'
          + '<div class="chip-group">'
            + '<button class="chip' + (pr.modalidade==='dias'  ?  ' sel' : '') + '" onclick="FormularioCtrl.setRemicaoMod(\'dias\')">Em dias</button>'
            + '<button class="chip' + (pr.modalidade==='fracao'? ' sel' : '') + '" onclick="FormularioCtrl.setRemicaoMod(\'fracao\')">Em fração</button>'
          + '</div>'
          + '<input type="text" class="inp-campo" id="inp-remicao-val" value="' + _esc(pr.valor||'') + '" placeholder="' + (pr.modalidade==='fracao' ? 'ex: 1/3' : 'ex: 15') + '">'
        + '</div>' : '');
    }

    return '<div class="form-secao">'
      + '<div class="sec-head" onclick="_toggleSec(this)">'
        + '<span class="sec-titulo">⚖️ Decisão da Direção</span>'
        + _ind(!!res)
        + '<span class="sec-chevron">▼</span>'
      + '</div>'
      + '<div class="sec-corpo">'
        + '<div class="campo-wrap"><label class="campo-label">Resultado</label>'
          + '<div class="chip-group">'
            + chipSel('absolvicao',      '✅ Absolvição')
            + chipSel('desclassificacao','⚖️ Desclassificação')
            + chipSel('falta_grave',     '❌ Falta Grave')
          + '</div>'
        + '</div>'
        + extra
        + '<div class="campo-wrap">'
          + '<label class="campo-label">Fundamentação Complementar <span class="opc">(opcional)</span></label>'
          + '<textarea class="inp-textarea" id="inp-dec-fund" rows="3" placeholder="Fundamentos ou observações adicionais...">' + _esc(dec.fundamento||'') + '</textarea>'
        + '</div>'
      + '</div>'
    + '</div>';
  }

  /* ── Seção: Ofício à VEP ── */
  function _secOficioVep(s) {
    return '<div class="form-secao">'
      + '<div class="sec-head" onclick="_toggleSec(this)">'
        + '<span class="sec-titulo">📨 Ofício à VEP</span>'
        + _ind(!!s.numOficioEnc)
        + '<span class="sec-chevron">▼</span>'
      + '</div>'
      + '<div class="sec-corpo">'
        + _campo('Nº Ofício à VEP', 'text', 'inp-num-vep', s.numOficioEnc, 'ex: 001/2026/PE01/CEPEN')
      + '</div>'
    + '</div>';
  }

  /* ── Seção: Ofício ao Juiz ── */
  function _secOficioJuiz(s) {
    return '<div class="form-secao">'
      + '<div class="sec-head" onclick="_toggleSec(this)">'
        + '<span class="sec-titulo">📨 Ofício ao Juiz</span>'
        + _ind(!!s.numOficioJuiz)
        + '<span class="sec-chevron">▼</span>'
      + '</div>'
      + '<div class="sec-corpo">'
        + _campo('Nº Ofício ao Juiz', 'text', 'inp-num-juiz', s.numOficioJuiz, 'ex: 002/2026/PE01/CEPEN')
      + '</div>'
    + '</div>';
  }

  /* ── Seção: Diretor (somente leitura) ── */
  function _secDiretor(s) {
    var d = s.diretor || {};
    return '<div class="form-secao">'
      + '<div class="sec-head" onclick="_toggleSec(this)">'
        + '<span class="sec-titulo">🏛 Diretor(a) da Unidade</span>'
        + _ind(!!d.nome)
        + '<span class="sec-chevron">▼</span>'
      + '</div>'
      + '<div class="sec-corpo">'
        + '<div class="campo-wrap">'
          + '<label class="campo-label">Nome do(a) Diretor(a)</label>'
          + '<div class="campo-readonly">' + _esc(d.nome || '(não informado)') + '</div>'
        + '</div>'
        + '<div class="campo-wrap">'
          + '<label class="campo-label">Cargo</label>'
          + '<div class="campo-readonly">' + _esc(d.cargo || 'Diretor(a)') + '</div>'
        + '</div>'
        + '<div class="campo-hint">Vinculado automaticamente à unidade prisional do login.</div>'
      + '</div>'
    + '</div>';
  }

  /* ── Helpers de markup ── */
  function _campo(label, type, id, val, ph2, req) {
    return '<div class="campo-wrap">'
      + '<label class="campo-label" for="' + id + '">' + label + (req ? ' <span style="color:#dc2626">*</span>' : '') + '</label>'
      + (type === 'textarea'
          ? '<textarea class="inp-textarea" id="' + id + '" placeholder="' + (ph2||'') + '">' + _esc(val||'') + '</textarea>'
          : '<input type="' + type + '" class="inp-campo" id="' + id + '" value="' + _esc(val||'') + '" placeholder="' + (ph2||'') + '">')
    + '</div>';
  }
  function _row2(a, b) {
    return '<div class="row-2">' + a + b + '</div>';
  }
  function _ind(ok) {
    if (ok) return '<span class="sec-ind sec-ok">✓</span>';
    return '<span class="sec-ind sec-vazia">—</span>';
  }

  /* ── Formata CPF enquanto digita ── */
  function _maskCPF(val) {
    var v = val.replace(/\D/g, '').substring(0, 11);
    if (v.length > 9)      return v.replace(/^(\d{3})(\d{3})(\d{3})(\d{0,2})$/, '$1.$2.$3-$4');
    if (v.length > 6)      return v.replace(/^(\d{3})(\d{3})(\d{0,3})$/, '$1.$2.$3');
    if (v.length > 3)      return v.replace(/^(\d{3})(\d{0,3})$/, '$1.$2');
    return v;
  }

  /* ── Vincula eventos ── */
  function _vincular(s) {
    _bind('inp-numPad',   function(v) { Estado.set('numPad', v); });
    _bind('inp-dataInst', function(v) { Estado.set('dataInst', v); });

    _bind('inp-inc-nome',   function(v) { Estado.setNested('incidentado.nome', v); });
    _bind('inp-inc-pront',  function(v) { Estado.setNested('incidentado.prontuario', v); });
    _bind('inp-inc-nasc',   function(v) { Estado.setNested('incidentado.nascimento', v); });
    _bind('inp-inc-nat',    function(v) { Estado.setNested('incidentado.naturalidade', v); });
    _bind('inp-inc-mae',    function(v) { Estado.setNested('incidentado.mae', v); });
    _bind('inp-inc-regime', function(v) { Estado.setNested('incidentado.regime', v); });
    _bind('inp-inc-comp',   function(v) { Estado.setNested('incidentado.comportamento', v); });
    _bind('inp-inc-cela',   function(v) { Estado.setNested('incidentado.cela', v); });

    /* CPF com máscara */
    var cpfEl = document.getElementById('inp-inc-ipen');
    if (cpfEl) {
      cpfEl.addEventListener('input', function() {
        var masked = _maskCPF(cpfEl.value);
        cpfEl.value = masked;
        Estado.setNested('incidentado.ipen', masked);
      });
    }

    _bind('sel-inf-artigo',  function(v) { Estado.setNested('infracao.artigo', v); });
    _bind('inp-inf-data',    function(v) { Estado.setNested('infracao.data', v); });
    _bind('inp-inf-desc',    function(v) { Estado.setNested('infracao.descricao', v); });
    _bind('inp-inf-agentes', function(v) { Estado.setNested('infracao.agentes', v.split(',').map(function(a){ return a.trim(); }).filter(Boolean)); });

    _bind('inp-adv-nome',   function(v) { Estado.setNested('defesa.advNome', v); });
    _bind('inp-adv-oab',    function(v) { Estado.setNested('defesa.advOab', v); });
    _bind('inp-versao-inc', function(v) { Estado.setNested('defesa.versaoIncidentado', v); });

    _bind('inp-mani-fund', function(v) { Estado.setNested('manifestacao.fundamento', v); });
    _bind('inp-dec-fund',  function(v) { Estado.setNested('decisao.fundamento', v); });

    _bind('inp-num-vep',  function(v) { Estado.set('numOficioEnc', v); });
    _bind('inp-num-juiz', function(v) { Estado.set('numOficioJuiz', v); });

    // Conselho
    ['pres','m1','m2'].forEach(function(id) {
      var campo = id === 'pres' ? 'presidente' : id === 'm1' ? 'membro1' : 'membro2';
      _bind('inp-co-' + id + '-nome', function(v) {
        var c = Estado.get('conselho'); c[campo].nome = v; Estado.set('conselho', c);
      });
      _bind('inp-co-' + id + '-mat', function(v) {
        var c = Estado.get('conselho'); c[campo].matricula = v; Estado.set('conselho', c);
      });
    });

    // Testemunhas
    document.querySelectorAll('.inp-te-nome').forEach(function(el) {
      el.addEventListener('input', function() {
        var idx = parseInt(el.dataset.idx);
        var te = Estado.get('testemunhas');
        if (te[idx]) { te[idx].nome = el.value; Estado.set('testemunhas', te); }
      });
    });
    document.querySelectorAll('.inp-te-qual').forEach(function(el) {
      el.addEventListener('input', function() {
        var idx = parseInt(el.dataset.idx);
        var te = Estado.get('testemunhas');
        if (te[idx]) { te[idx].qualificacao = el.value; Estado.set('testemunhas', te); }
      });
    });

    // Remição valor
    _bind('inp-remicao-val', function(v) { Estado.setNested('decisao.sancoes.perdaRemicao.valor', v); });

    _initUpload();
  }

  function _bind(id, fn) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input',  function() { fn(el.value); });
    el.addEventListener('change', function() { fn(el.value); });
  }

  /* ── Sincroniza campos após carregar estado externo ── */
  function sincronizar() { _render(); }

  /* ── Limpar ── */
  function limpar() {
    if (!confirm('Limpar todos os dados do PAD atual?')) return;
    Estado.reset();
    carregarConselho();
    carregarDiretor();
    _render();
    _toast('Novo PAD iniciado.');
  }

  /* ── Métodos públicos para chips ── */
  function setDefesaTipo(tipo) { Estado.setNested('defesa.tipo', tipo); _render(); }
  function setConclusao(c)     { Estado.setNested('manifestacao.conclusao', c); _render(); }
  function setResultado(r)     { Estado.setNested('decisao.resultado', r); _render(); }
  function setDesclass(g) {
    Estado.setNested('decisao.desclassGrau', g);
    Estado.setNested('decisao.desclassArt', g === 'leve' ? 'Art. 95' : 'Art. 96');
    _render();
  }
  function setSancao(campo, val) {
    Estado.setNested('decisao.sancoes.' + campo, val);
  }
  function setSancaoRemicao(val) {
    Estado.setNested('decisao.sancoes.perdaRemicao.aplicar', val);
    _render();
  }
  function setRemicaoMod(mod) {
    Estado.setNested('decisao.sancoes.perdaRemicao.modalidade', mod);
    _render();
  }
  function adicionarTestemunha() {
    var te = Estado.get('testemunhas');
    te.push({ nome: '', qualificacao: '' });
    Estado.set('testemunhas', te);
    _render();
  }
  function removerTestemunha(idx) {
    var te = Estado.get('testemunhas');
    te.splice(idx, 1);
    Estado.set('testemunhas', te);
    _render();
  }

  return {
    inicializar: _render,
    sincronizar: sincronizar,
    limpar: limpar,
    setDefesaTipo: setDefesaTipo,
    setConclusao: setConclusao,
    setResultado: setResultado,
    setDesclass: setDesclass,
    setSancao: setSancao,
    setSancaoRemicao: setSancaoRemicao,
    setRemicaoMod: setRemicaoMod,
    adicionarTestemunha: adicionarTestemunha,
    removerTestemunha: removerTestemunha,
  };
})();
