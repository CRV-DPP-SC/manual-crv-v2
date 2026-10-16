/* ============================================================
   COMUNICAÇÃO DE ENTRADA / SAÍDA — aberta pelo Painel da Unidade
   URL: index.html?com=<id da solicitação>&dir=ida|volta&tipo=saida|entrada
     • dir=ida   → presos que saíram da origem para o destino
     • dir=volta → permuta: presos que saíram do destino para a origem
   Reaproveita o modal "Comunicar Jud." (modal-cj.js): formulário já
   preenchido, pré-visualização editável e PDF. Os dados e o texto editado
   ficam salvos na solicitação (campo comunicacoes) para baixar de novo depois.
   A assinatura é a do diretor que assinou o ofício de transferência, numa
   folha separada no fim (mesmo padrão do PDF validado do Painel).
   ============================================================ */
(function () {
  var prm = new URLSearchParams(location.search);
  var id = prm.get('com');
  if (!id) return;
  var tipo = prm.get('tipo') === 'entrada' ? 'entrada' : 'saida';
  var dir  = prm.get('dir') === 'volta' ? 'volta' : 'ida';
  var chave = tipo + '_' + dir;
  window.COM_PAINEL = { id: id, tipo: tipo, dir: dir, chave: chave };

  function aviso(html) {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:400;background:rgba(15,23,42,.6);display:flex;align-items:center;justify-content:center;padding:1rem';
    d.innerHTML = '<div style="background:#fff;border-radius:12px;max-width:460px;padding:1.4rem 1.5rem;font:14px/1.5 Segoe UI,Arial,sans-serif;color:#1f2937;text-align:center">' + html + '</div>';
    document.body.appendChild(d);
  }
  var espera = function (cond, ms) {
    return new Promise(function (ok) {
      var t0 = Date.now();
      (function v() { if (cond() || Date.now() - t0 > (ms || 8000)) ok(); else setTimeout(v, 120); })();
    });
  };
  var unPorEmail = function (em) {
    var uns = typeof getUns === 'function' ? getUns() : (typeof UNS !== 'undefined' ? UNS : []);
    return uns.find(function (u) { return (u.em || '').toLowerCase() === (em || '').toLowerCase(); }) || null;
  };

  async function iniciar() {
    _formAntes = null;
    await espera(function () { return window._v2AuthReady; });
    if (window._v2AuthReady) await window._v2AuthReady;
    await espera(function () { return typeof window._v2LerSolicitacao === 'function'; }, 4000);
    if (!window._v2Usuario || typeof window._v2LerSolicitacao !== 'function')
      return aviso('🔒 Faça login no Portal CRV e abra a comunicação pelo <b>Painel da Unidade</b>.');

    var sol;
    try { sol = await window._v2LerSolicitacao(id); } catch (e) { return aviso('Erro ao carregar o ofício: ' + _esc(e.message || e)); }
    if (!sol || !sol.transf) return aviso('Este ofício não tem os dados da transferência (ofícios anteriores à função de comunicação).');
    var assin = sol.assinantes || [];
    var assinado = sol.statusGeral !== 'cancelado' && assin.length > 0 && assin.every(function (a) { return a.status === 'assinado'; });
    if (!assinado) return aviso('A comunicação fica disponível quando o ofício de transferência estiver <b>totalmente assinado</b>.');

    var t = sol.transf;
    var ida = dir === 'ida';
    var oriEm = ida ? t.oriEm : t.desEm, desEm = ida ? t.desEm : t.oriEm;
    var presos = (ida ? t.presosIda : t.presosVolta) || [];
    if (!presos.length) return aviso('Não há presos nesse sentido da transferência.');
    var o = unPorEmail(oriEm), d = unPorEmail(desEm);
    if (!o || !d) return aviso('Unidade de origem ou de destino não encontrada no cadastro de unidades.');
    var comEm = tipo === 'saida' ? oriEm : desEm;

    // Unidade do usuário (Diretor/CPEN/servidor): só a unidade que comunica
    var minha = window._v2Unidade;
    if (minha && (minha.em || '').toLowerCase() !== comEm.toLowerCase())
      return aviso('Esta comunicação é da unidade <b>' + _esc((tipo === 'saida' ? o : d).n) + '</b>.');

    // Assinatura aproveitada: diretor da unidade que comunica, no ofício de transferência
    var assinante = assin.find(function (a) { return (a.emailUnidade || '').toLowerCase() === comEm.toLowerCase(); }) || null;
    window.COM_PAINEL.sol = sol;
    window.COM_PAINEL.assinante = assinante;
    window.COM_PAINEL.unidade = tipo === 'saida' ? o : d;

    Estado.carregar({ mod: t.mod, numero: presos.length > 1 ? 'P' : 'S', reed: presos.length > 1 ? presos : [],
      nome: presos[0].nome, ipen: presos[0].ipen, ori: o, des: d });

    var h3 = document.querySelector('#mcjBg .modal-head h3');
    if (h3) h3.textContent = '📨 Comunicação de ' + (tipo === 'saida' ? 'Saída' : 'Entrada') + ' — ' + window.COM_PAINEL.unidade.n;

    abrirModalCJ();
    var salvo = (sol.comunicacoes || {})[chave];
    if (salvo && salvo.htmls && salvo.htmls.length) {
      _cpRestaurarCampos(salvo);
      CJ.ofHtmls = salvo.htmls.slice(); CJ.paginaAtual = 0;
      _renderizarCJPreview();
      _toast('Comunicação salva carregada. Você pode editar ou baixar o PDF.');
    } else {
      var mot = document.getElementById('mcjMotivo');
      if (mot && !mot.value && t.motivo) mot.value = t.motivo;
      _cpInfo();
    }
  }

  // Aviso no topo do formulário (de qual ofício veio)
  function _cpInfo() {
    var body = document.getElementById('mcjBody');
    if (!body || document.getElementById('cpInfo')) return;
    var s = window.COM_PAINEL.sol;
    var info = document.createElement('div');
    info.id = 'cpInfo';
    info.style.cssText = 'background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;border-radius:8px;padding:8px 10px;font-size:.8rem;line-height:1.45';
    info.innerHTML = 'Referente ao ofício de transferência: <b>' + _esc(s.titulo || '') + '</b><br>'
      + 'Preencha o juízo, a data e o número. Os dados ficam salvos para baixar de novo depois.';
    body.insertBefore(info, body.firstChild);
  }

  // ── Guardar / restaurar os campos do formulário ──
  function _cpCampos() {
    var c = {};
    document.querySelectorAll('#mcjBody input, #mcjBody textarea, #mcjBody select').forEach(function (el) {
      if (!el.id && el.type !== 'radio') return;
      if (el.type === 'radio') { if (el.checked) c['radio:' + el.name] = el.value; }
      else if (el.type === 'checkbox') { /* seleção de presos fica em CJ.selecionados */ }
      else c[el.id] = el.value;
    });
    var indiv = document.getElementById('mcjJuizIndiv');
    return { campos: c, modoJuiz: indiv && indiv.classList.contains('sel') ? 'individual' : 'mesmo', selecionados: CJ.selecionados.slice() };
  }
  window._cpRestaurarCampos = function (salvo) {
    if (salvo.selecionados) CJ.selecionados = salvo.selecionados.slice();
    _renderizarCJForm();
    if (salvo.modoJuiz === 'individual' && typeof _setModoJuiz === 'function') _setModoJuiz('individual');
    Object.keys(salvo.campos || {}).forEach(function (k) {
      if (k.indexOf('radio:') === 0) {
        var r = document.querySelector('#mcjBody input[name="' + k.slice(6) + '"][value="' + salvo.campos[k] + '"]');
        if (r) r.checked = true;
      } else { var el = document.getElementById(k); if (el) el.value = salvo.campos[k]; }
    });
    _cpInfo();
  };
  var _formAntes = null;   // dados do formulário no momento em que gerou

  // Gerar: guarda os campos antes de virar pré-visualização
  var _gerarOrig = window.gerarOficiosCJ;
  window.gerarOficiosCJ = function () { _formAntes = _cpCampos(); return _gerarOrig.apply(this, arguments); };

  // "← Voltar" para os dados: restaura o que foi preenchido
  var _formOrig = window._renderizarCJForm;
  window._renderizarCJForm = function () {
    _formOrig.apply(this, arguments);
    _cpInfo();
  };

  function _cpCapturarEdicao() {
    var el = document.querySelector('.mcj-oficio-wrap #oficio');
    if (!el) return;
    if (el.contentEditable === 'true') { el.contentEditable = 'false'; el.style.outline = ''; }
    CJ.ofHtmls[CJ.paginaAtual] = el.innerHTML;
  }

  // Pré-visualização própria do modo Painel: editar, salvar e baixar PDF
  window._renderizarCJPreview = function () {
    var body = document.getElementById('mcjBody');
    var foot = document.getElementById('mcjFoot');
    var total = CJ.ofHtmls.length, i = CJ.paginaAtual;
    body.innerHTML =
      (total > 1
        ? '<div class="mcj-paginacao">'
            + '<button class="btn-pg" ' + (i === 0 ? 'disabled' : '') + ' onclick="_cpPagina(-1)">← Anterior</button>'
            + '<span>Ofício ' + (i + 1) + ' de ' + total + '</span>'
            + '<button class="btn-pg" ' + (i === total - 1 ? 'disabled' : '') + ' onclick="_cpPagina(1)">Próximo →</button>'
          + '</div>' : '')
      + '<div style="font-size:.78rem;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:6px 10px">'
      + '✏ Clique em <b>Editar texto</b> para corrigir direto no ofício. A assinatura do diretor sai numa folha separada, no fim do PDF.</div>'
      + '<div class="mcj-oficio-wrap"><div id="oficio">' + (CJ.ofHtmls[i] || '') + '</div></div>';
    foot.innerHTML =
      '<button class="btn-acao btn-sec" onclick="_cpVoltarDados()">← Dados</button>'
      + '<button class="btn-acao btn-sec" id="btnCJEditar" onclick="_cpEditar()">✏ Editar texto</button>'
      + '<button class="btn-acao btn-sec" onclick="_cpSalvar()">💾 Salvar</button>'
      + '<button class="btn-acao btn-pri" onclick="_cpPDF()">⬇ Baixar PDF</button>';
  };
  window._cpPagina = function (d) { _cpCapturarEdicao(); CJ.paginaAtual += d; _renderizarCJPreview(); };
  window._cpEditar = function () {
    var el = document.querySelector('.mcj-oficio-wrap #oficio'), btn = document.getElementById('btnCJEditar');
    if (!el || !btn) return;
    if (el.contentEditable === 'true') { _cpCapturarEdicao(); btn.textContent = '✏ Editar texto'; _toast('Edição concluída — clique em Salvar para guardar.'); }
    else { el.contentEditable = 'true'; el.style.outline = '2px solid #2563b0'; el.focus(); btn.textContent = '✔ Concluir edição'; _toast('Clique no texto para editar.'); }
  };
  window._cpVoltarDados = function () {
    _cpCapturarEdicao();
    var salvo = (window.COM_PAINEL.sol.comunicacoes || {})[chave];
    var dados = _formAntes || (salvo ? salvo : null);
    if (dados) _cpRestaurarCampos(dados); else _renderizarCJForm();
  };
  async function _cpGravar() {
    _cpCapturarEdicao();
    var f = _formAntes || (window.COM_PAINEL.sol.comunicacoes || {})[chave] || _cpCampos();
    var dados = { campos: f.campos || {}, modoJuiz: f.modoJuiz || 'mesmo', selecionados: f.selecionados || [], htmls: CJ.ofHtmls.slice() };
    await window._v2SalvarComunicacao(id, chave, dados);
    var s = window.COM_PAINEL.sol; s.comunicacoes = s.comunicacoes || {}; s.comunicacoes[chave] = dados;
  }
  window._cpSalvar = async function () {
    try { await _cpGravar(); _toast('💾 Comunicação salva. Dá para baixar de novo pelo Painel.'); }
    catch (e) { _toast('Erro ao salvar: ' + (e.message || e)); }
  };

  // Folha final: registro da assinatura aproveitada do ofício de transferência
  function _cpFolhaAssinatura(htmlOficio) {
    var tmp = document.createElement('div'); tmp.innerHTML = htmlOficio;
    var th = tmp.querySelector('.ofc-table thead'), tf = tmp.querySelector('.ofc-table tfoot');
    var a = window.COM_PAINEL.assinante, s = window.COM_PAINEL.sol, un = window.COM_PAINEL.unidade;
    var dt = a && a.dataAcao ? new Date(a.dataAcao) : null;
    var dtStr = dt ? dt.toLocaleDateString('pt-BR') + ' às ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
    var linha = a && a.status === 'assinado'
      ? '<tr><td style="padding:6pt 8pt;font-size:8.5pt;font-weight:700;color:#15803d;white-space:nowrap;vertical-align:top;">✅ Assinado</td>'
        + '<td style="padding:6pt 8pt;font-size:8.5pt;vertical-align:top;"><strong>' + _esc(a.nome || a.email) + '</strong>'
        + '<br><span style="color:#555;">' + _esc(un.cg || 'Diretor(a)') + ' — ' + _esc(un.n) + '</span>'
        + '<br><span style="color:#666;font-size:8pt;">' + _esc(dtStr) + '</span></td></tr>'
      : '<tr><td colspan="2" style="font-size:8.5pt;color:#92400e;padding:6pt 8pt;">Não há assinatura do(a) diretor(a) desta unidade registrada no ofício de transferência.</td></tr>';
    return '<table class="ofc-table" style="page-break-before:always;break-before:page;">'
      + (th ? th.outerHTML : '') + (tf ? tf.outerHTML : '')
      + '<tbody><tr><td class="ofc-bcell"><div style="font-family:Arial,sans-serif;padding-top:0.4cm;">'
      + '<div style="border:1.5px solid #3b82f6;border-radius:4px;padding:8pt 12pt;background:#eff6ff;margin-bottom:8pt;">'
      + '<div style="font-size:8pt;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5pt;">CENTRAL DE REGULAÇÃO DE VAGAS / DPP-SC — DOCUMENTO VALIDADO</div>'
      + '<div style="font-size:7.5pt;color:#555;line-height:1.6;">Ofício de Comunicação de ' + (tipo === 'saida' ? 'Saída' : 'Entrada') + ' — ' + _esc(un.n)
      + '<br>Assinatura eletrônica registrada no ofício de transferência: ' + _esc(s.titulo || '') + '</div></div>'
      + '<strong style="font-size:9pt;">Registro de Assinatura</strong>'
      + '<table style="width:100%;border-collapse:collapse;margin-top:6pt;">' + linha + '</table>'
      + '</div></td></tr></tbody></table>';
  }
  window._cpPDF = async function () {
    try { await _cpGravar(); } catch (e) { _toast('Aviso: não foi possível salvar (' + (e.message || e) + '). O PDF sai mesmo assim.'); }
    var html = CJ.ofHtmls[CJ.paginaAtual] || '';
    var base = location.href.replace(/[^/]*(\?.*)?$/, '');
    var janela = window.open('', '_blank');
    if (!janela) { _toast('Permita pop-ups para gerar o PDF.'); return; }
    janela.document.write('<html><head><meta charset="UTF-8"><base href="' + base + '"><title>Comunicação de '
      + (tipo === 'saida' ? 'Saída' : 'Entrada') + '</title><style>' + getCSS() + '</style></head><body>'
      + '<div id="oficio">' + html + _cpFolhaAssinatura(html) + '</div>'
      + '<scr' + 'ipt>window.onload=function(){window.print();}<\/scr' + 'ipt></body></html>');
    janela.document.close();
    _toast('Janela de impressão/PDF aberta — escolha "Salvar como PDF".');
  };

  window.COM_PAINEL.iniciar = iniciar;   // (também usado em testes)
  window.addEventListener('load', iniciar);
})();
