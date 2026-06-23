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
        secoes = _secPad(s) + _secIncidentado(s) + _secInfracao(s) + _secConselho(s) + _secDiretor(s);
        break;
      case 'doc_inicial':
        secoes = _secDocInicial(s);
        break;
      case 'termo_cient':
        secoes = _secTermoCient(s);
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
      case 'manif_defesa':
        secoes = _secManifDefesa(s);
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
        secoes = _secPad(s) + _secIncidentado(s) + _secInfracao(s) + _secConselho(s) + _secDiretor(s);
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
    return '<div class="form-secao">'
      + '<div class="sec-head" onclick="_toggleSec(this)">'
        + '<span class="sec-titulo">👤 Incidentado</span>'
        + _ind(!!(i.nome && i.prontuario))
        + '<span class="sec-chevron">▼</span>'
      + '</div>'
      + '<div class="sec-corpo">'
        + _campo('Nome completo', 'text', 'inp-inc-nome', i.nome, 'NOME DO INCIDENTADO', true)
        + _campo('Prontuário / IPEN', 'text', 'inp-inc-pront', i.prontuario, 'ex: 750126', true)
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
    /* Defensor vinculado — exibição automática (somente leitura) + botão alterar */
    var extra = '';
    if (tipo === 'advogado') {
      extra = '<div class="campo-wrap">'
        + '<label class="campo-label">Defensor vinculado</label>'
        + '<div style="display:flex;align-items:center;gap:10px;">'
          + '<div class="campo-readonly" style="flex:1;">'
            + _esc(d.advNome || ph('Nome do advogado')) + (d.advOab ? ' &nbsp;|&nbsp; OAB: ' + _esc(d.advOab) : '')
          + '</div>'
          + '<button class="btn-add-reed" style="white-space:nowrap;font-size:.75rem;" onclick="_reabrirModalDefesa()">🔄 Alterar</button>'
        + '</div>'
      + '</div>';
    } else if (tipo === 'defensoria') {
      extra = '<div class="campo-wrap">'
        + '<label class="campo-label">Defensor vinculado</label>'
        + '<div style="display:flex;align-items:center;gap:10px;">'
          + '<div class="campo-readonly" style="flex:1;">Defensoria Pública do Estado de Santa Catarina</div>'
          + '<button class="btn-add-reed" style="white-space:nowrap;font-size:.75rem;" onclick="_reabrirModalDefesa()">🔄 Alterar</button>'
        + '</div>'
      + '</div>';
    }

    /* Seletor de silêncio */
    var silencio = !!d.silencio;
    var silencioHtml = '<div class="campo-wrap">'
      + '<label class="campo-label">Postura do Incidentado</label>'
      + '<div class="chip-group">'
        + '<button class="chip' + (!silencio ? ' sel' : '') + '" onclick="FormularioCtrl.setSilencio(false)">💬 Prestou declarações</button>'
        + '<button class="chip' + (silencio  ? ' sel' : '') + '" onclick="FormularioCtrl.setSilencio(true)">🤐 Permaneceu em silêncio</button>'
      + '</div>'
    + '</div>';

    var oa = d.oitivaAnexo || {};
    var anexoHtml = oa.temAnexo
      ? '<div style="display:flex;align-items:center;gap:8px;padding:8px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;margin-top:6px;">'
          + '<span>✅</span><span style="flex:1;font-size:.83rem;color:#166534;">' + _esc(oa.nomeAnexo||'Documento assinado anexado') + '</span>'
          + '<button class="btn-te-del" onclick="FormularioCtrl.removerAnexoOitivaInc()" title="Remover">✕</button>'
        + '</div>'
      : '<div id="zona-oitiva-inc" class="zona-upload" style="padding:14px 20px;margin-top:6px;">'
          + '<div class="upload-icon" style="font-size:1.3rem;">📎</div>'
          + '<div class="upload-txt">Arraste o documento assinado digitalizado (PDF/imagem)</div>'
        + '</div>'
        + '<input type="file" id="inp-oitiva-inc" accept=".pdf,.jpg,.jpeg,.png" style="display:none">';

    return '<div class="form-secao">'
      + '<div class="sec-head" onclick="_toggleSec(this)">'
        + '<span class="sec-titulo">⚖️ Declarações do Incidentado / Defesa</span>'
        + _ind(!!(tipo && d.versaoIncidentado))
        + '<span class="sec-chevron">▼</span>'
      + '</div>'
      + '<div class="sec-corpo">'
        + '<div class="campo-wrap"><label class="campo-label">Tipo de Defesa <span style="color:#dc2626">*</span></label>'
          + '<div class="chip-group">'
            + chipSel('defensoria', '🏛️ Defensoria Pública')
            + chipSel('advogado',   '👨‍⚖️ Advogado Constituído')
          + '</div>'
        + '</div>'
        + extra
        + silencioHtml
        + '<div class="campo-wrap"' + (silencio ? ' style="display:none;"' : '') + '>'
          + '<label class="campo-label" style="display:flex;align-items:center;justify-content:space-between;">'
            + 'Declarações do Incidentado'
            + '<button id="mic-oitiva-inc" class="btn-mic" onclick="FormularioCtrl.toggleMicIncidentado()" title="Ditar por voz">🎙 Ditar</button>'
          + '</label>'
          + '<div id="mic-status-oitiva-inc" class="mic-status" style="display:none;"></div>'
          + '<textarea class="inp-textarea" id="inp-versao-inc" rows="4" placeholder="Versão apresentada pelo incidentado em suas declarações...">' + _esc(d.versaoIncidentado||'') + '</textarea>'
          + '<div class="campo-hint">Usado nas Declarações do Incidentado, Manifestação do Conselho e Decisão.</div>'
        + '</div>'
        + '<div style="display:flex;gap:8px;margin-top:8px;">'
          + '<button class="btn-add-reed" style="flex:1;background:#3b1f0a;color:#fed7aa;border-color:#3b1f0a;" onclick="FormularioCtrl.imprimirOitivaInc()">🖨️ Imprimir para Assinar</button>'
        + '</div>'
        + '<div class="campo-wrap" style="margin-top:10px;">'
          + '<label class="campo-label">Documento assinado digitalizado</label>'
          + anexoHtml
        + '</div>'
      + '</div>'
    + '</div>';
  }

  /* ── Seção: Testemunhas ── */
  function _secTestemunhas(s) {
    var testes = s.testemunhas || [];
    var rows = testes.map(function(te, i) {
      var micId    = 'mic-te-' + i;
      var areaId   = 'inp-te-dep-' + i;
      var statusId = 'mic-status-' + i;
      var qual     = te.qualidade || 'testemunha';
      return '<div class="te-row" data-idx="' + i + '" style="flex-direction:column;gap:8px;">'
        + '<div style="display:flex;align-items:flex-start;gap:8px;">'
          + '<div class="te-idx" style="margin-top:4px;">' + (i+1) + '</div>'
          + '<div class="te-campos" style="flex:1;">'
            + '<input type="text" class="inp-campo inp-te-nome" data-idx="' + i + '" placeholder="Nome" value="' + _esc(te.nome||'') + '">'
            + '<input type="text" class="inp-campo inp-te-qual" data-idx="' + i + '" placeholder="Qualificação (cargo, matrícula...)" value="' + _esc(te.qualificacao||'') + '" style="margin-top:5px">'
            + '<div class="chip-group" style="margin-top:6px;">'
              + '<button class="chip' + (qual === 'testemunha' ? ' sel' : '') + '" onclick="FormularioCtrl.setQualidadeTe(' + i + ',\'testemunha\')">👤 Testemunha</button>'
              + '<button class="chip' + (qual === 'informante' ? ' sel' : '') + '" onclick="FormularioCtrl.setQualidadeTe(' + i + ',\'informante\')">💬 Informante</button>'
            + '</div>'
          + '</div>'
          + '<button class="btn-te-del" onclick="FormularioCtrl.removerTestemunha(' + i + ')" title="Remover" style="margin-top:4px;">✕</button>'
        + '</div>'
        + '<div style="padding-left:32px;">'
          + '<div class="campo-wrap" style="margin-bottom:4px;">'
            + '<label class="campo-label" style="display:flex;align-items:center;justify-content:space-between;">'
              + 'Depoimento / Declarações'
              + '<button id="' + micId + '" class="btn-mic" onclick="FormularioCtrl.toggleMic(' + i + ')" title="Ditar por voz">🎙 Ditar</button>'
            + '</label>'
            + '<div id="' + statusId + '" class="mic-status" style="display:none;"></div>'
            + '<textarea class="inp-textarea inp-te-dep" id="' + areaId + '" data-idx="' + i + '" rows="4" '
              + 'placeholder="Digite ou dite as declarações prestadas...">'
              + _esc(te.depoimento||'')
            + '</textarea>'
          + '</div>'
          + '<div style="display:flex;gap:8px;margin-bottom:8px;">'
            + '<button class="btn-add-reed" style="flex:1;background:#3b1f0a;color:#fed7aa;border-color:#3b1f0a;font-size:.75rem;" onclick="FormularioCtrl.imprimirOitivaTe(' + i + ')">🖨️ Imprimir para Assinar</button>'
          + '</div>'
          + (te.temAnexo
            ? '<div style="display:flex;align-items:center;gap:8px;padding:8px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;margin-bottom:8px;">'
                + '<span>✅</span><span style="flex:1;font-size:.83rem;color:#166534;">' + _esc(te.nomeAnexo||'Documento assinado') + '</span>'
                + '<button class="btn-te-del" onclick="FormularioCtrl.removerAnexoTe(' + i + ')" title="Remover">✕</button>'
              + '</div>'
            : '<div id="zona-te-' + i + '" class="zona-upload" style="padding:12px 20px;margin-bottom:8px;" data-te-idx="' + i + '">'
                + '<div class="upload-icon" style="font-size:1.1rem;">📎</div>'
                + '<div class="upload-txt" style="font-size:.78rem;">Anexar documento assinado (PDF/imagem)</div>'
              + '</div>'
              + '<input type="file" id="inp-te-assinado-' + i + '" accept=".pdf,.jpg,.jpeg,.png" data-te-idx="' + i + '" style="display:none">')
        + '</div>'
      + '</div>';
    }).join('');

    return '<div class="form-secao">'
      + '<div class="sec-head" onclick="_toggleSec(this)">'
        + '<span class="sec-titulo">🧑‍💼 Testemunhas <span style="font-size:.72rem;font-weight:400;opacity:.7;">(' + testes.length + ')</span></span>'
        + '<span class="sec-chevron">▼</span>'
      + '</div>'
      + '<div class="sec-corpo">'
        + '<style>'
          + '.btn-mic{background:none;border:1.5px solid #d1d5db;border-radius:6px;padding:3px 9px;font-size:.72rem;font-weight:700;color:#374151;cursor:pointer;font-family:inherit;transition:all .15s;}'
          + '.btn-mic:hover{border-color:#2563eb;color:#2563eb;}'
          + '.btn-mic.gravando{border-color:#dc2626;color:#dc2626;animation:pulso .8s infinite;}'
          + '@keyframes pulso{0%,100%{opacity:1;}50%{opacity:.5;}}'
          + '.mic-status{font-size:.72rem;color:#2563eb;padding:4px 8px;background:#eff6ff;border-radius:6px;margin-bottom:6px;}'
        + '</style>'
        + (rows || '<div style="font-size:.82rem;color:#999;margin-bottom:10px;">Nenhuma testemunha cadastrada.</div>')
        + '<button class="btn-add-reed" onclick="FormularioCtrl.adicionarTestemunha()">+ Adicionar Testemunha</button>'
        + '<div class="campo-hint" style="margin-top:6px;">Um Termo de Oitiva será gerado para cada testemunha. Use 🎙 para ditar o depoimento por voz (Chrome/Edge).</div>'
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

  /* ── Seção: Documentação Inicial ── */
  function _secDocInicial(s) {
    var di   = s.docInicial || {};
    var arqs = di.arquivos  || [];
    var listaHtml = arqs.length
      ? arqs.map(function(a, i) {
          return '<div class="te-row" style="flex-direction:row;align-items:center;gap:8px;padding:8px 0;">'
            + '<span style="font-size:1.2rem;">' + (a.tipo && a.tipo.startsWith('image') ? '🖼️' : '📄') + '</span>'
            + '<span style="flex:1;font-size:.83rem;color:#1c1917;">' + _esc(a.nome) + '</span>'
            + '<button class="btn-te-del" onclick="FormularioCtrl.removerDocInicial(' + i + ')" title="Remover">✕</button>'
            + '</div>';
        }).join('')
      : '<div style="font-size:.82rem;color:#999;margin-bottom:6px;">Nenhum arquivo adicionado ainda.</div>';

    return '<div class="form-secao">'
      + '<div class="sec-head" onclick="_toggleSec(this)">'
        + '<span class="sec-titulo">📂 Documentação Inicial</span>'
        + _ind(arqs.length > 0)
        + '<span class="sec-chevron">▼</span>'
      + '</div>'
      + '<div class="sec-corpo">'
        + '<div class="campo-hint" style="margin-bottom:12px;">Adicione comunicações de ocorrência, relatórios, fotografias e demais provas. Serão incluídos após a Portaria no dossiê.</div>'
        + listaHtml
        + '<div id="zona-doc-inicial" class="zona-upload" style="margin-top:10px;">'
          + '<div class="upload-icon">📂</div>'
          + '<div class="upload-txt">Arraste arquivos aqui<br><span style="font-size:.75rem;color:#999;">PDF, JPG, PNG — múltiplos arquivos permitidos</span></div>'
        + '</div>'
        + '<input type="file" id="inp-doc-inicial" accept=".pdf,.jpg,.jpeg,.png" multiple style="display:none">'
      + '</div>'
    + '</div>';
  }

  /* ── Seção: Termo de Cientificação ── */
  function _secTermoCient(s) {
    var tc = s.termoCient || {};
    return '<div class="form-secao">'
      + '<div class="sec-head" onclick="_toggleSec(this)">'
        + '<span class="sec-titulo">📋 Termo de Cientificação</span>'
        + _ind(!!tc.temAnexo)
        + '<span class="sec-chevron">▼</span>'
      + '</div>'
      + '<div class="sec-corpo">'
        + '<div class="campo-hint" style="margin-bottom:12px;">O documento é gerado automaticamente com os dados do PAD. Imprima, colha a assinatura do apenado e digitalize.</div>'
        + '<div class="campo-wrap">'
          + '<label class="campo-label">Observações adicionais <span class="opc">(opcional)</span></label>'
          + '<textarea class="inp-textarea" id="inp-termo-cient-obs" rows="2" placeholder="Ex.: interno recusou-se a assinar...">' + _esc(tc.texto||'') + '</textarea>'
        + '</div>'
        + '<div class="campo-wrap" style="margin-top:4px;">'
          + '<label class="campo-label">Documento assinado digitalizado <span class="opc">(opcional)</span></label>'
          + (tc.temAnexo
            ? '<div style="display:flex;align-items:center;gap:8px;padding:8px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;">'
                + '<span>✅</span><span style="flex:1;font-size:.83rem;color:#166534;">' + _esc(tc.nomeAnexo||'Documento anexado') + '</span>'
                + '<button class="btn-te-del" onclick="FormularioCtrl.removerAnexoTermoCient()" title="Remover">✕</button>'
              + '</div>'
            : '<div id="zona-termo-cient" class="zona-upload" style="padding:16px 20px;">'
                + '<div class="upload-icon" style="font-size:1.4rem;">📎</div>'
                + '<div class="upload-txt">Arraste o PDF digitalizado aqui</div>'
              + '</div>'
              + '<input type="file" id="inp-termo-cient" accept=".pdf,.jpg,.jpeg,.png" style="display:none">')
        + '</div>'
      + '</div>'
    + '</div>';
  }

  /* ── Seção: Manifestação da Defesa ── */
  function _secManifDefesa(s) {
    var md  = s.manifDefesa || {};
    var micId = 'mic-manif-defesa';
    return '<div class="form-secao">'
      + '<div class="sec-head" onclick="_toggleSec(this)">'
        + '<span class="sec-titulo">⚖️ Manifestação da Defesa</span>'
        + _ind(!!(md.texto || md.temAnexo))
        + '<span class="sec-chevron">▼</span>'
      + '</div>'
      + '<div class="sec-corpo">'
        + '<div class="campo-hint" style="margin-bottom:12px;">Registre a defesa oral ou por memoriais. Se recebida por e-mail/papel, faça o upload do documento.</div>'
        + '<div class="campo-wrap">'
          + '<label class="campo-label" style="display:flex;align-items:center;justify-content:space-between;">'
            + 'Defesa oral / Memoriais (texto ou voz)'
            + '<button id="' + micId + '" class="btn-mic" onclick="FormularioCtrl.toggleMicManifDefesa()" title="Ditar">🎙 Ditar</button>'
          + '</label>'
          + '<div id="mic-status-manif" class="mic-status" style="display:none;"></div>'
          + '<textarea class="inp-textarea" id="inp-manif-defesa-texto" rows="5" placeholder="Digite ou dite a manifestação da defesa...">' + _esc(md.texto||'') + '</textarea>'
        + '</div>'
        + '<div class="campo-wrap">'
          + '<label class="campo-label">Documento da defesa (upload) <span class="opc">(opcional)</span></label>'
          + (md.temAnexo
            ? '<div style="display:flex;align-items:center;gap:8px;padding:8px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;">'
                + '<span>✅</span><span style="flex:1;font-size:.83rem;color:#166534;">' + _esc(md.nomeAnexo||'Documento anexado') + '</span>'
                + '<button class="btn-te-del" onclick="FormularioCtrl.removerAnexoManifDefesa()" title="Remover">✕</button>'
              + '</div>'
            : '<div id="zona-manif-defesa" class="zona-upload" style="padding:16px 20px;">'
                + '<div class="upload-icon" style="font-size:1.4rem;">📎</div>'
                + '<div class="upload-txt">Arraste o PDF/imagem da defesa</div>'
              + '</div>'
              + '<input type="file" id="inp-manif-defesa-pdf" accept=".pdf,.jpg,.jpeg,.png" style="display:none">')
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

    var extraDesclass = '';
    if (cc === 'desclassificacao') {
      var grau = m.desclassGrau || '';
      var gSel = function(v, lbl) {
        return '<button class="chip' + (grau === v ? ' sel' : '') + '" onclick="FormularioCtrl.setDesclassManifest(\'' + v + '\')">' + lbl + '</button>';
      };
      extraDesclass = '<div class="campo-wrap" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;">'
        + '<label class="campo-label" style="color:#92400e;">⚖️ Enquadramento após desclassificação</label>'
        + '<div class="chip-group" style="margin-bottom:10px;">'
          + gSel('leve',  'Falta Leve — Art. 95, LC 529/2011')
          + gSel('media', 'Falta Média — Art. 96, LC 529/2011')
        + '</div>';

      if (grau) {
        var incisos = getIncisosDesclass(grau);
        var selecionados = m.desclassIncisos || [];
        extraDesclass += '<label class="campo-label" style="color:#92400e;margin-bottom:6px;">Selecione o(s) inciso(s):</label>'
          + '<div class="check-group">'
          + incisos.map(function(inc) {
              var chk = selecionados.indexOf(inc.cod) !== -1 ? ' checked' : '';
              return '<label class="check-item">'
                + '<input type="checkbox" class="chk-mani-inciso" data-cod="' + inc.cod + '"' + chk
                + ' onchange="FormularioCtrl.toggleIncisoConclusao(\'' + inc.cod + '\',this.checked)">'
                + '<strong>' + inc.label + '</strong> — ' + _esc(inc.texto)
              + '</label>';
            }).join('')
          + '</div>';
      }
      extraDesclass += '</div>';
    }

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
        + extraDesclass
        + '<div class="campo-wrap">'
          + '<label class="campo-label">Fundamentação Complementar <span class="opc">(opcional)</span></label>'
          + '<textarea class="inp-textarea" id="inp-mani-fund" rows="3" placeholder="Fundamentos específicos adicionais...">' + _esc(m.fundamento||'') + '</textarea>'
        + '</div>'
        + '<div class="campo-wrap">'
          + '<label class="campo-label">Documento externo do Conselho <span class="opc">(opcional — se elaborado fora do sistema)</span></label>'
          + (m.temAnexo
            ? '<div style="display:flex;align-items:center;gap:8px;padding:8px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;">'
                + '<span>✅</span><span style="flex:1;font-size:.83rem;color:#166534;">' + _esc(m.nomeAnexo||'Documento anexado') + '</span>'
                + '<button class="btn-te-del" onclick="FormularioCtrl.removerAnexoManifConselho()" title="Remover">✕</button>'
              + '</div>'
            : '<div id="zona-manif-conselho" class="zona-upload" style="padding:14px 20px;">'
                + '<div class="upload-icon" style="font-size:1.3rem;">📎</div>'
                + '<div class="upload-txt">Arraste o PDF/imagem da manifestação do Conselho</div>'
              + '</div>'
              + '<input type="file" id="inp-manif-conselho" accept=".pdf,.jpg,.jpeg,.png" style="display:none">')
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
      extra = '<div class="campo-wrap" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;">'
        + '<label class="campo-label" style="color:#92400e;">⚖️ Enquadramento após desclassificação</label>'
        + '<div class="chip-group" style="margin-bottom:10px;">'
          + gSel('leve',  'Falta Leve — Art. 95, LC 529/2011')
          + gSel('media', 'Falta Média — Art. 96, LC 529/2011')
        + '</div>';

      if (dec.desclassGrau) {
        var incisosD = getIncisosDesclass(dec.desclassGrau);
        var selD = dec.desclassIncisos || [];
        extra += '<label class="campo-label" style="color:#92400e;margin-bottom:6px;">Selecione o(s) inciso(s):</label>'
          + '<div class="check-group">'
          + incisosD.map(function(inc) {
              var chk = selD.indexOf(inc.cod) !== -1 ? ' checked' : '';
              return '<label class="check-item">'
                + '<input type="checkbox" class="chk-dec-inciso" data-cod="' + inc.cod + '"' + chk
                + ' onchange="FormularioCtrl.toggleIncisoDecisao(\'' + inc.cod + '\',this.checked)">'
                + '<strong>' + inc.label + '</strong> — ' + _esc(inc.texto)
              + '</label>';
            }).join('')
          + '</div>';
      }
      extra += '</div>';
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
          + '<label class="campo-label" style="display:flex;align-items:center;justify-content:space-between;">'
            + 'II — Fundamentação da Decisão <span style="color:#dc2626">*</span>'
            + '<button id="mic-fundamentacao" class="btn-mic" onclick="FormularioCtrl.toggleMicFundamentacao()" title="Ditar por voz">🎙 Ditar</button>'
          + '</label>'
          + '<div id="mic-status-fund" class="mic-status" style="display:none;"></div>'
          + '<textarea class="inp-textarea" id="inp-dec-fundamentacao" rows="6" placeholder="Analise as provas produzidas, a versão do incidentado, o parecer do Conselho e a manifestação da Defesa. Fundamente a decisão com base na legislação aplicável...">' + _esc(dec.fundamentacao||'') + '</textarea>'
        + '</div>'
        + '<div style="margin-bottom:10px;">'
          + '<button class="btn-add-reed" style="font-size:.78rem;width:100%;" onclick="FormularioCtrl.carregarTextosPortal()">🔄 Carregar textos do portal (Manifestação do Conselho e Defesa)</button>'
          + '<div class="campo-hint">Busca no portal os textos enviados pelo advogado e pelo conselho para compor o Relatório automaticamente.</div>'
        + '</div>'
        + '<div class="campo-wrap">'
          + '<label class="campo-label">Documento externo da Decisão <span class="opc">(opcional — se elaborada fora do sistema)</span></label>'
          + (dec.temAnexo
            ? '<div style="display:flex;align-items:center;gap:8px;padding:8px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;">'
                + '<span>✅</span><span style="flex:1;font-size:.83rem;color:#166534;">' + _esc(dec.nomeAnexo||'Documento anexado') + '</span>'
                + '<button class="btn-te-del" onclick="FormularioCtrl.removerAnexoDecisao()" title="Remover">✕</button>'
              + '</div>'
            : '<div id="zona-decisao-pdf" class="zona-upload" style="padding:14px 20px;">'
                + '<div class="upload-icon" style="font-size:1.3rem;">📎</div>'
                + '<div class="upload-txt">Arraste o PDF/imagem da Decisão da Direção</div>'
              + '</div>'
              + '<input type="file" id="inp-decisao-pdf" accept=".pdf,.jpg,.jpeg,.png" style="display:none">')
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

    _bind('inp-inc-nome',  function(v) { Estado.setNested('incidentado.nome', v); });
    _bind('inp-inc-pront', function(v) { Estado.setNested('incidentado.prontuario', v); });

    _bind('sel-inf-artigo',  function(v) { Estado.setNested('infracao.artigo', v); });
    _bind('inp-inf-data',    function(v) { Estado.setNested('infracao.data', v); });
    _bind('inp-inf-desc',    function(v) { Estado.setNested('infracao.descricao', v); });
    _bind('inp-inf-agentes', function(v) { Estado.setNested('infracao.agentes', v.split(',').map(function(a){ return a.trim(); }).filter(Boolean)); });

    _bind('inp-adv-nome',   function(v) { Estado.setNested('defesa.advNome', v); });
    _bind('inp-adv-oab',    function(v) { Estado.setNested('defesa.advOab', v); });
    _bind('inp-versao-inc', function(v) { Estado.setNested('defesa.versaoIncidentado', v); });

    _bind('inp-termo-cient-obs',    function(v) { Estado.setNested('termoCient.texto', v); });
    _bind('inp-manif-defesa-texto', function(v) { Estado.setNested('manifDefesa.texto', v); });
    _bind('inp-mani-fund', function(v) { Estado.setNested('manifestacao.fundamento', v); });
    _bind('inp-dec-fund',         function(v) { Estado.setNested('decisao.fundamento', v); });
    _bind('inp-dec-fundamentacao', function(v) { Estado.setNested('decisao.fundamentacao', v); });

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
    document.querySelectorAll('.inp-te-dep').forEach(function(el) {
      el.addEventListener('input', function() {
        var idx = parseInt(el.dataset.idx);
        var te = Estado.get('testemunhas');
        if (te[idx]) { te[idx].depoimento = el.value; Estado.set('testemunhas', te); }
      });
    });

    // Remição valor
    _bind('inp-remicao-val', function(v) { Estado.setNested('decisao.sancoes.perdaRemicao.valor', v); });

    _initUpload();
    _initDocInicial();
    _initTermoCient();
    _initManifDefesaUpload();
    _initOitivaIncUpload();
    _initOitivaTeUploads();
    _initManifConselhoUpload();
    _initDecisaoUpload();
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
    Estado.setNested('decisao.desclassIncisos', []);
    _render();
  }
  function setDesclassManifest(g) {
    Estado.setNested('manifestacao.desclassGrau', g);
    Estado.setNested('manifestacao.desclassArt', g === 'leve' ? 'Art. 95' : 'Art. 96');
    Estado.setNested('manifestacao.desclassIncisos', []);
    _render();
  }
  function toggleIncisoConclusao(cod, checked) {
    var lista = Estado.get('manifestacao').desclassIncisos || [];
    if (checked) { if (lista.indexOf(cod) === -1) lista.push(cod); }
    else { lista = lista.filter(function(c) { return c !== cod; }); }
    Estado.setNested('manifestacao.desclassIncisos', lista);
    // não re-renderiza para não perder o estado dos checkboxes
    atualizarPreview && atualizarPreview();
  }
  function toggleIncisoDecisao(cod, checked) {
    var lista = Estado.get('decisao').desclassIncisos || [];
    if (checked) { if (lista.indexOf(cod) === -1) lista.push(cod); }
    else { lista = lista.filter(function(c) { return c !== cod; }); }
    Estado.setNested('decisao.desclassIncisos', lista);
    atualizarPreview && atualizarPreview();
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
  function setQualidadeTe(idx, qualidade) {
    var te = Estado.get('testemunhas');
    if (te[idx]) { te[idx].qualidade = qualidade; Estado.set('testemunhas', te); _render(); }
  }

  function adicionarTestemunha() {
    var te = Estado.get('testemunhas');
    te.push({ nome: '', qualificacao: '', depoimento: '', qualidade: 'testemunha', temAnexo: false, nomeAnexo: '' });
    Estado.set('testemunhas', te);
    _render();
  }
  function removerTestemunha(idx) {
    var te = Estado.get('testemunhas');
    te.splice(idx, 1);
    Estado.set('testemunhas', te);
    _render();
  }

  /* ── Upload: Manifestação do Conselho (externo) ── */
  function _initManifConselhoUpload() {
    var zona  = document.getElementById('zona-manif-conselho');
    var input = document.getElementById('inp-manif-conselho');
    if (!zona || !input) return;
    zona.addEventListener('click', function() { input.click(); });
    zona.addEventListener('dragover', function(e) { e.preventDefault(); zona.classList.add('drag-over'); });
    zona.addEventListener('dragleave', function() { zona.classList.remove('drag-over'); });
    zona.addEventListener('drop', function(e) {
      e.preventDefault(); zona.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) _processarManifConselho(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', function() {
      if (input.files[0]) _processarManifConselho(input.files[0]);
    });
  }
  function _processarManifConselho(file) {
    window._manifConselhoFile = file;
    Estado.setNested('manifestacao.temAnexo',  true);
    Estado.setNested('manifestacao.nomeAnexo', file.name);
    _extrairTextoPdf(file).then(function(texto) {
      if (texto) {
        Estado.setNested('manifestacao.textoExtraido',  texto);
        Estado.setNested('decisao.textoManifConselho',  texto);
        _toast('Texto extraido da Manifestacao do Conselho!');
        atualizarPreview && atualizarPreview();
      }
    });
    _render();
    _toast('Manifestacao do Conselho anexada!');
  }

  /* ── Upload: Decisão da Direção (externa) ── */
  function _initDecisaoUpload() {
    var zona  = document.getElementById('zona-decisao-pdf');
    var input = document.getElementById('inp-decisao-pdf');
    if (!zona || !input) return;
    zona.addEventListener('click', function() { input.click(); });
    zona.addEventListener('dragover', function(e) { e.preventDefault(); zona.classList.add('drag-over'); });
    zona.addEventListener('dragleave', function() { zona.classList.remove('drag-over'); });
    zona.addEventListener('drop', function(e) {
      e.preventDefault(); zona.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) _processarDecisaoPdf(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', function() {
      if (input.files[0]) _processarDecisaoPdf(input.files[0]);
    });
  }
  function _processarDecisaoPdf(file) {
    window._decisaoPdfFile = file;
    Estado.setNested('decisao.temAnexo',  true);
    Estado.setNested('decisao.nomeAnexo', file.name);
    _render();
    _toast('Decisão da Direção anexada!');
  }

  /* ── Upload: Oitiva do Incidentado assinada ── */
  function _initOitivaIncUpload() {
    var zona  = document.getElementById('zona-oitiva-inc');
    var input = document.getElementById('inp-oitiva-inc');
    if (!zona || !input) return;
    zona.addEventListener('click', function() { input.click(); });
    zona.addEventListener('dragover', function(e) { e.preventDefault(); zona.classList.add('drag-over'); });
    zona.addEventListener('dragleave', function() { zona.classList.remove('drag-over'); });
    zona.addEventListener('drop', function(e) {
      e.preventDefault(); zona.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) _processarOitivaInc(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', function() {
      if (input.files[0]) _processarOitivaInc(input.files[0]);
    });
  }
  function _processarOitivaInc(file) {
    window._oitivaIncSignedFile = file;
    Estado.setNested('defesa.oitivaAnexo', { temAnexo: true, nomeAnexo: file.name });
    _render();
    _toast('Documento assinado do incidentado anexado!');
  }

  /* ── Upload: Oitiva de Testemunha assinada ── */
  function _initOitivaTeUploads() {
    document.querySelectorAll('.zona-upload[data-te-idx]').forEach(function(zona) {
      var idx   = parseInt(zona.dataset.teIdx);
      var input = document.getElementById('inp-te-assinado-' + idx);
      if (!input) return;
      zona.addEventListener('click', function() { input.click(); });
      zona.addEventListener('dragover', function(e) { e.preventDefault(); zona.classList.add('drag-over'); });
      zona.addEventListener('dragleave', function() { zona.classList.remove('drag-over'); });
      zona.addEventListener('drop', function(e) {
        e.preventDefault(); zona.classList.remove('drag-over');
        if (e.dataTransfer.files[0]) _processarOitivaTe(idx, e.dataTransfer.files[0]);
      });
      input.addEventListener('change', function() {
        if (input.files[0]) _processarOitivaTe(idx, input.files[0]);
      });
    });
  }
  function _processarOitivaTe(idx, file) {
    if (!window._testemunhasSignedFiles) window._testemunhasSignedFiles = {};
    window._testemunhasSignedFiles[idx] = file;
    var te = Estado.get('testemunhas');
    if (te[idx]) {
      te[idx].temAnexo  = true;
      te[idx].nomeAnexo = file.name;
      Estado.set('testemunhas', te);
    }
    _render();
    _toast('Documento assinado da testemunha ' + (idx+1) + ' anexado!');
  }

  /* ── Mic: Incidentado ── */
  var _recIncidentado = null;
  function toggleMicIncidentado() {
    var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) { _toast('Reconhecimento de voz disponível apenas no Chrome e Edge.'); return; }
    var btnEl    = document.getElementById('mic-oitiva-inc');
    var areaEl   = document.getElementById('inp-versao-inc');
    var statusEl = document.getElementById('mic-status-oitiva-inc');
    if (_recIncidentado) { _recIncidentado.stop(); return; }
    _recIncidentado = new SpeechRec();
    _recIncidentado.lang = 'pt-BR'; _recIncidentado.continuous = true; _recIncidentado.interimResults = true;
    var anterior = (areaEl ? areaEl.value : '') + ' ';
    _recIncidentado.onstart = function() {
      if (btnEl) { btnEl.textContent = '⏹ Parar'; btnEl.classList.add('gravando'); }
      if (statusEl) { statusEl.textContent = '🎙 Gravando…'; statusEl.style.display = ''; }
    };
    _recIncidentado.onresult = function(e) {
      var interim = '', final = anterior;
      for (var i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) { final += e.results[i][0].transcript + ' '; anterior = final; }
        else interim += e.results[i][0].transcript;
      }
      if (areaEl) areaEl.value = final + interim;
      Estado.setNested('defesa.versaoIncidentado', final);
    };
    _recIncidentado.onend = function() {
      _recIncidentado = null;
      if (btnEl) { btnEl.textContent = '🎙 Ditar'; btnEl.classList.remove('gravando'); }
      if (statusEl) statusEl.style.display = 'none';
      if (areaEl) Estado.setNested('defesa.versaoIncidentado', areaEl.value);
    };
    _recIncidentado.start();
  }

  /* ── Imprimir Oitiva do Incidentado ── */
  function imprimirOitivaInc() {
    var s    = Estado.get();
    var html = montarDocumento(s, tplOitivaIncidentado);
    _abrirImpressao && _abrirImpressao(html);
  }

  /* ── Imprimir Oitiva de Testemunha específica ── */
  function imprimirOitivaTe(idx) {
    var s  = Estado.get();
    var te = (s.testemunhas || [])[idx];
    if (!te) return;
    var fn   = function(st) { return tplOitivaTestemunha(st, te); };
    var html = montarDocumento(s, fn);
    _abrirImpressao && _abrirImpressao(html);
  }

  /* ── Upload: Documentação Inicial ── */
  function _initDocInicial() {
    var zona  = document.getElementById('zona-doc-inicial');
    var input = document.getElementById('inp-doc-inicial');
    if (!zona || !input) return;
    zona.addEventListener('click', function() { input.click(); });
    zona.addEventListener('dragover', function(e) { e.preventDefault(); zona.classList.add('drag-over'); });
    zona.addEventListener('dragleave', function() { zona.classList.remove('drag-over'); });
    zona.addEventListener('drop', function(e) {
      e.preventDefault(); zona.classList.remove('drag-over');
      _processarDocInicialFiles(Array.from(e.dataTransfer.files));
    });
    input.addEventListener('change', function() {
      _processarDocInicialFiles(Array.from(input.files));
    });
  }
  function _processarDocInicialFiles(files) {
    if (!files.length) return;
    if (!window._docInicialFiles) window._docInicialFiles = [];
    files.forEach(function(f) {
      window._docInicialFiles.push(f);
      var di   = Estado.get('docInicial') || { arquivos: [] };
      di.arquivos.push({ nome: f.name, tipo: f.type });
      Estado.set('docInicial', di);
    });
    _render();
  }

  /* ── Upload: Termo de Cientificação assinado ── */
  function _initTermoCient() {
    var zona  = document.getElementById('zona-termo-cient');
    var input = document.getElementById('inp-termo-cient');
    if (!zona || !input) return;
    zona.addEventListener('click', function() { input.click(); });
    zona.addEventListener('dragover', function(e) { e.preventDefault(); zona.classList.add('drag-over'); });
    zona.addEventListener('dragleave', function() { zona.classList.remove('drag-over'); });
    zona.addEventListener('drop', function(e) {
      e.preventDefault(); zona.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) _processarTermoCient(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', function() {
      if (input.files[0]) _processarTermoCient(input.files[0]);
    });
  }
  function _processarTermoCient(file) {
    window._termoCientPdfFile = file;
    Estado.setNested('termoCient.temAnexo',  true);
    Estado.setNested('termoCient.nomeAnexo', file.name);
    _render();
    _toast('Documento assinado anexado!');
  }

  /* ── Upload: Manifestação da Defesa PDF ── */
  function _initManifDefesaUpload() {
    var zona  = document.getElementById('zona-manif-defesa');
    var input = document.getElementById('inp-manif-defesa-pdf');
    if (!zona || !input) return;
    zona.addEventListener('click', function() { input.click(); });
    zona.addEventListener('dragover', function(e) { e.preventDefault(); zona.classList.add('drag-over'); });
    zona.addEventListener('dragleave', function() { zona.classList.remove('drag-over'); });
    zona.addEventListener('drop', function(e) {
      e.preventDefault(); zona.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) _processarManifDefesaPdf(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', function() {
      if (input.files[0]) _processarManifDefesaPdf(input.files[0]);
    });
  }
  function _processarManifDefesaPdf(file) {
    window._manifDefesaPdfFile = file;
    Estado.setNested('manifDefesa.temAnexo',  true);
    Estado.setNested('manifDefesa.nomeAnexo', file.name);
    _render();
    _toast('Documento da defesa anexado!');

    /* Salva no Firestore como peca do dossiê */
    var padId = window._padIdAtual;
    if (!padId || !window.PadFirestore) return;
    _extrairTextoPdf(file).then(function(texto) {
      var htmlContent = '<div style="font-family:Arial,sans-serif;font-size:11pt;line-height:1.6;white-space:pre-wrap;">'
        + '<h3 style="margin-bottom:12px;">Manifestação da Defesa</h3>'
        + '<p><strong>Arquivo:</strong> ' + file.name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</p>'
        + (texto
            ? '<hr style="margin:12px 0"><div>' + texto.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>'
            : '<p style="color:#92400e;margin-top:12px;">⚠️ Texto não extraível (documento digitalizado).</p>')
        + '</div>';
      window.PadFirestore.salvarManifDefesaPortal(padId, htmlContent, texto).catch(function(){});
    });
  }

  /* ── Mic: Manifestação da Defesa ── */
  var _recManifDefesa = null;
  function toggleMicManifDefesa() {
    var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) { _toast('Reconhecimento de voz não suportado. Use Chrome ou Edge.'); return; }
    var btnEl    = document.getElementById('mic-manif-defesa');
    var areaEl   = document.getElementById('inp-manif-defesa-texto');
    var statusEl = document.getElementById('mic-status-manif');
    if (_recManifDefesa) { _recManifDefesa.stop(); return; }
    _recManifDefesa = new SpeechRec();
    _recManifDefesa.lang = 'pt-BR'; _recManifDefesa.continuous = true; _recManifDefesa.interimResults = true;
    var anterior = (areaEl ? areaEl.value : '') + ' ';
    _recManifDefesa.onstart = function() {
      if (btnEl) { btnEl.textContent = '⏹ Parar'; btnEl.classList.add('gravando'); }
      if (statusEl) { statusEl.textContent = '🎙 Gravando…'; statusEl.style.display = ''; }
    };
    _recManifDefesa.onresult = function(e) {
      var interim = '', final = anterior;
      for (var i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) { final += e.results[i][0].transcript + ' '; anterior = final; }
        else interim += e.results[i][0].transcript;
      }
      if (areaEl) areaEl.value = final + interim;
      Estado.setNested('manifDefesa.texto', final);
    };
    _recManifDefesa.onend = function() {
      _recManifDefesa = null;
      if (btnEl) { btnEl.textContent = '🎙 Ditar'; btnEl.classList.remove('gravando'); }
      if (statusEl) statusEl.style.display = 'none';
      if (areaEl) Estado.setNested('manifDefesa.texto', areaEl.value);
    };
    _recManifDefesa.start();
  }

  /* ── Extrai texto de PDF/imagem via PDF.js ── */
  function _extrairTextoPdf(file) {
    if (!file || typeof pdfjsLib === 'undefined') return Promise.resolve('');
    if (!file.type || !file.type.includes('pdf')) return Promise.resolve('');
    return file.arrayBuffer().then(function(ab) {
      return pdfjsLib.getDocument({ data: ab }).promise;
    }).then(function(pdf) {
      var paginas = [];
      for (var i = 1; i <= pdf.numPages; i++) paginas.push(i);
      return Promise.all(paginas.map(function(n) {
        return pdf.getPage(n).then(function(page) {
          return page.getTextContent().then(function(content) {
            return content.items.map(function(it) { return it.str; }).join(' ');
          });
        });
      }));
    }).then(function(partes) {
      return partes.join('\n').trim();
    }).catch(function() { return ''; });
  }

  /* ── Mic: Fundamentação da Decisão ── */
  var _recFundamentacao = null;
  function toggleMicFundamentacao() {
    var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) { _toast('Reconhecimento de voz disponível apenas no Chrome e Edge.'); return; }
    var btnEl    = document.getElementById('mic-fundamentacao');
    var areaEl   = document.getElementById('inp-dec-fundamentacao');
    var statusEl = document.getElementById('mic-status-fund');
    if (_recFundamentacao) { _recFundamentacao.stop(); return; }
    _recFundamentacao = new SpeechRec();
    _recFundamentacao.lang = 'pt-BR'; _recFundamentacao.continuous = true; _recFundamentacao.interimResults = true;
    var anterior = (areaEl ? areaEl.value : '') + ' ';
    _recFundamentacao.onstart = function() {
      if (btnEl) { btnEl.textContent = '⏹ Parar'; btnEl.classList.add('gravando'); }
      if (statusEl) { statusEl.textContent = '🎙 Gravando fundamentação…'; statusEl.style.display = ''; }
    };
    _recFundamentacao.onresult = function(e) {
      var interim = '', final = anterior;
      for (var i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) { final += e.results[i][0].transcript + ' '; anterior = final; }
        else interim += e.results[i][0].transcript;
      }
      if (areaEl) areaEl.value = final + interim;
      Estado.setNested('decisao.fundamentacao', final);
    };
    _recFundamentacao.onend = function() {
      _recFundamentacao = null;
      if (btnEl) { btnEl.textContent = '🎙 Ditar'; btnEl.classList.remove('gravando'); }
      if (statusEl) statusEl.style.display = 'none';
      if (areaEl) Estado.setNested('decisao.fundamentacao', areaEl.value);
    };
    _recFundamentacao.start();
  }

  /* ── Carrega textos do portal para alimentar o Relatório ── */
  function carregarTextosPortal() {
    var padId = window._padIdAtual;
    if (!padId) { _toast('Salve o PAD primeiro antes de carregar textos do portal.'); return; }
    if (!window.PadFirestore) { _toast('Firebase não disponível.'); return; }
    _toast('Buscando textos no portal…');

    /* Busca manifestação do conselho e da defesa no Firestore */
    var buscas = [
      window.PadFirestore.buscarTextoPeca(padId, 'manifestacao').then(function(t) {
        if (t) {
          Estado.setNested('decisao.textoManifConselho', t);
          Estado.setNested('manifestacao.textoExtraido', t);
        }
        return t;
      }),
      window.PadFirestore.buscarTextoPeca(padId, 'manif_defesa').then(function(t) {
        if (t) Estado.setNested('decisao.textoManifDefesa', t);
        return t;
      }),
    ];

    Promise.all(buscas).then(function(resultados) {
      var count = resultados.filter(function(t) { return !!t; }).length;
      if (count === 0) {
        _toast('Nenhum texto encontrado no portal ainda. Aguarde o envio dos documentos.');
      } else {
        _toast('Textos carregados (' + count + ' peça(s))! O Relatório foi atualizado.');
        atualizarPreview && atualizarPreview();
      }
    }).catch(function(e) {
      _toast('Erro ao buscar textos: ' + e.message);
    });
  }

  /* ── Speech-to-text (Web Speech API) ── */
  var _reconhecimento = null;
  var _micIdxAtivo   = -1;

  function toggleMic(idx) {
    var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      _toast('Reconhecimento de voz não suportado neste navegador. Use Chrome ou Edge.');
      return;
    }

    var btnEl    = document.getElementById('mic-te-' + idx);
    var areaEl   = document.getElementById('inp-te-dep-' + idx);
    var statusEl = document.getElementById('mic-status-' + idx);

    // Se já está gravando para este índice, para
    if (_reconhecimento && _micIdxAtivo === idx) {
      _reconhecimento.stop();
      return;
    }

    // Para qualquer gravação anterior
    if (_reconhecimento) { try { _reconhecimento.stop(); } catch(_) {} }

    _reconhecimento = new SpeechRec();
    _reconhecimento.lang = 'pt-BR';
    _reconhecimento.continuous = true;
    _reconhecimento.interimResults = true;
    _micIdxAtivo = idx;

    var textoAnterior = (areaEl ? areaEl.value : '') + ' ';

    _reconhecimento.onstart = function() {
      if (btnEl)    { btnEl.textContent = '⏹ Parar'; btnEl.classList.add('gravando'); }
      if (statusEl) { statusEl.textContent = '🎙 Gravando… fale agora'; statusEl.style.display = ''; }
    };

    _reconhecimento.onresult = function(e) {
      var interim = '';
      var final   = textoAnterior;
      for (var i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          final += e.results[i][0].transcript + ' ';
          textoAnterior = final;
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      if (areaEl) areaEl.value = final + interim;
      // Persiste no estado
      var te = Estado.get('testemunhas');
      if (te[idx]) { te[idx].depoimento = final; Estado.set('testemunhas', te); }
    };

    _reconhecimento.onerror = function(e) {
      if (statusEl) { statusEl.textContent = '⚠️ Erro: ' + e.error; }
    };

    _reconhecimento.onend = function() {
      _micIdxAtivo = -1;
      if (btnEl)    { btnEl.textContent = '🎙 Ditar'; btnEl.classList.remove('gravando'); }
      if (statusEl) { statusEl.style.display = 'none'; }
      // Persiste valor final
      if (areaEl) {
        var te = Estado.get('testemunhas');
        if (te[idx]) { te[idx].depoimento = areaEl.value; Estado.set('testemunhas', te); }
      }
    };

    _reconhecimento.start();
  }

  return {
    inicializar: _render,
    sincronizar: sincronizar,
    limpar: limpar,
    setDefesaTipo: setDefesaTipo,
    setConclusao: setConclusao,
    setResultado: setResultado,
    setDesclass: setDesclass,
    setDesclassManifest: setDesclassManifest,
    toggleIncisoConclusao: toggleIncisoConclusao,
    toggleIncisoDecisao: toggleIncisoDecisao,
    setSancao: setSancao,
    setSancaoRemicao: setSancaoRemicao,
    setRemicaoMod: setRemicaoMod,
    adicionarTestemunha: adicionarTestemunha,
    removerTestemunha: removerTestemunha,
    setQualidadeTe: setQualidadeTe,
    toggleMic: toggleMic,
    toggleMicManifDefesa: toggleMicManifDefesa,
    toggleMicIncidentado: toggleMicIncidentado,
    imprimirOitivaInc: imprimirOitivaInc,
    imprimirOitivaTe: imprimirOitivaTe,
    removerAnexoOitivaInc: function() {
      window._oitivaIncSignedFile = null;
      Estado.setNested('defesa.oitivaAnexo', { temAnexo: false, nomeAnexo: '' });
      _render();
    },
    removerAnexoTe: function(idx) {
      if (window._testemunhasSignedFiles) delete window._testemunhasSignedFiles[idx];
      var te = Estado.get('testemunhas');
      if (te[idx]) { te[idx].temAnexo = false; te[idx].nomeAnexo = ''; Estado.set('testemunhas', te); }
      _render();
    },
    toggleMicFundamentacao: toggleMicFundamentacao,
    carregarTextosPortal: carregarTextosPortal,
    setSilencio: function(val) {
      Estado.setNested('defesa.silencio', val);
      _render();
    },
    removerAnexoManifConselho: function() {
      window._manifConselhoFile = null;
      Estado.setNested('manifestacao.temAnexo', false);
      Estado.setNested('manifestacao.nomeAnexo', '');
      _render();
    },
    removerAnexoDecisao: function() {
      window._decisaoPdfFile = null;
      Estado.setNested('decisao.temAnexo', false);
      Estado.setNested('decisao.nomeAnexo', '');
      _render();
    },
    removerDocInicial: function(idx) {
      if (window._docInicialFiles) window._docInicialFiles.splice(idx, 1);
      var di = Estado.get('docInicial') || { arquivos: [] };
      di.arquivos.splice(idx, 1);
      Estado.set('docInicial', di);
      _render();
    },
    removerAnexoTermoCient: function() {
      window._termoCientPdfFile = null;
      Estado.setNested('termoCient.temAnexo', false);
      Estado.setNested('termoCient.nomeAnexo', '');
      _render();
    },
    removerAnexoManifDefesa: function() {
      window._manifDefesaPdfFile = null;
      Estado.setNested('manifDefesa.temAnexo', false);
      Estado.setNested('manifDefesa.nomeAnexo', '');
      _render();
    },
  };
})();
