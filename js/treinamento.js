// ================================================
// CRV — Instruções de Uso do Portal CRV (menu lateral › Manual › Instruções de Uso)
// js/treinamento.js
//
// Só para usuários logados. Ao clicar no menu abre uma janela para escolher
// entre ver os slides no próprio site ou baixar o PDF.
// Os slides são imagens em guia/slides/01.jpg … NN.jpg (exportadas do
// PowerPoint). Para atualizar: trocar as imagens, o PDF e, se mudar a
// quantidade ou a ordem, ajustar TOTAL e MODULOS abaixo.
// ================================================
(function () {
  const TOTAL = 48;
  const PDF = 'guia/Portal-CRV-Instrucoes-de-uso.pdf';
  const PDF_TAMANHO = '4 MB';
  const MODULOS = [
    [1,  'Introdução'],
    [4,  '1 · Entrar no portal'],
    [11, '2 · Primeiros passos'],
    [14, '3 · Gerar ofício'],
    [22, '4 · Assinar'],
    [28, '5 · Acompanhar'],
    [33, '6 · Aprovar cadastros'],
    [38, '7 · Avisos e mensagens'],
    [43, '8 · No celular'],
    [47, 'Encerramento'],
  ];
  const CHAVE_POSICAO = 'crv-guia-slide';

  const img = n => 'guia/slides/' + String(n).padStart(2, '0') + '.jpg';
  const logado = () => !!window._usuarioAtual;
  const authResolvido = () => window._usuarioAtual !== undefined;

  let atual = 1;
  try { atual = Math.min(TOTAL, Math.max(1, parseInt(localStorage.getItem(CHAVE_POSICAO), 10) || 1)); } catch (_) {}
  let montadoPara = null; // 'logado' | 'visitante' | 'carregando'

  // ── Janela de escolha ──
  function criarModal() {
    if (document.getElementById('modal-treinamento')) return;
    const m = document.createElement('div');
    m.id = 'modal-treinamento';
    m.className = 'modal-overlay';
    m.addEventListener('click', e => { if (e.target === m) fecharEscolha(); });
    m.innerHTML = `
      <div class="modal-box" style="max-width:460px;">
        <div class="modal-header trein-modal-header">
          <div><h3>📘 Instruções de Uso do Portal CRV</h3><p>Passo a passo, com as telas do portal</p></div>
          <button class="modal-fechar" onclick="fecharEscolhaTreinamento()">✕</button>
        </div>
        <div class="modal-body" style="display:flex;flex-direction:column;gap:12px;">
          <p style="font-size:.85rem;color:var(--txt-3);margin:0 0 4px;">Como você quer abrir as instruções?</p>
          <button class="trein-opcao" onclick="verTreinamentoNoSite()">
            <span class="trein-opcao-icone">▶</span>
            <span><strong>Ver no site</strong><small>Slide por slide, aqui mesmo no portal</small></span>
          </button>
          <a class="trein-opcao" href="${PDF}" download onclick="fecharEscolhaTreinamento()">
            <span class="trein-opcao-icone">⬇</span>
            <span><strong>Baixar PDF</strong><small>Para guardar, imprimir ou enviar (${PDF_TAMANHO})</small></span>
          </a>
        </div>
      </div>`;
    document.body.appendChild(m);
  }
  function fecharEscolha() { document.getElementById('modal-treinamento')?.classList.remove('aberto'); }

  window.abrirEscolhaTreinamento = function () {
    if (!logado()) { window._abrirModalLogin && window._abrirModalLogin(); return; }
    criarModal();
    document.getElementById('modal-treinamento').classList.add('aberto');
  };
  window.fecharEscolhaTreinamento = fecharEscolha;
  window.verTreinamentoNoSite = function () {
    fecharEscolha();
    window.navegarPara && window.navegarPara('guia');
    montar();
  };

  // ── Visualizador ──
  function montar() {
    const raiz = document.getElementById('trein-app');
    if (!raiz) return;
    const estado = !authResolvido() ? 'carregando' : (logado() ? 'logado' : 'visitante');
    if (estado === montadoPara) return;
    montadoPara = estado;

    if (estado === 'carregando') { raiz.innerHTML = '<p class="trein-aviso">Carregando…</p>'; return; }
    if (estado === 'visitante') {
      raiz.innerHTML = `<div class="trein-bloqueado">
        <div style="font-size:2.4rem;">🔒</div>
        <p><strong>As instruções de uso são exclusivas para usuários do portal.</strong></p>
        <p>Entre com o seu e-mail para ver.</p>
        <button class="btn-primario" style="max-width:220px;" onclick="window._abrirModalLogin && window._abrirModalLogin()">Entrar</button>
      </div>`;
      return;
    }

    raiz.innerHTML = `
      <div class="trein-topo">
        <div>
          <h2 class="trein-titulo">📘 Instruções de Uso do Portal CRV</h2>
          <p class="trein-sub">Use as setas, o teclado (← →) ou deslize o dedo no celular.</p>
        </div>
        <div class="trein-acoes">
          <a class="trein-btn" href="${PDF}" download>⬇ Baixar PDF</a>
          <button class="trein-btn" id="trein-btn-cheia" onclick="treinTelaCheia()">⛶ Tela cheia</button>
        </div>
      </div>
      <div class="trein-modulos" id="trein-modulos">
        ${MODULOS.map(([n, nome]) => `<button class="trein-mod" data-ini="${n}" onclick="treinIr(${n})">${nome}</button>`).join('')}
      </div>
      <div class="trein-palco" id="trein-palco">
        <img id="trein-img" alt="Slide do guia" draggable="false">
        <button class="trein-seta trein-seta-esq" onclick="treinIr(treinAtual()-1)" aria-label="Slide anterior">‹</button>
        <button class="trein-seta trein-seta-dir" onclick="treinIr(treinAtual()+1)" aria-label="Próximo slide">›</button>
      </div>
      <div class="trein-rodape">
        <div class="trein-barra"><div id="trein-progresso"></div></div>
        <span id="trein-contador"></span>
      </div>`;

    // Deslizar no celular
    const palco = document.getElementById('trein-palco');
    let x0 = null;
    palco.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    palco.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) window.treinIr(atual + (dx < 0 ? 1 : -1));
    }, { passive: true });
    if (!document.fullscreenEnabled) document.getElementById('trein-btn-cheia').style.display = 'none';
    mostrar(atual);
  }

  function mostrar(n) {
    atual = Math.min(TOTAL, Math.max(1, n));
    try { localStorage.setItem(CHAVE_POSICAO, atual); } catch (_) {}
    const el = document.getElementById('trein-img');
    if (!el) return;
    el.src = img(atual);
    el.alt = 'Slide ' + atual + ' de ' + TOTAL;
    document.getElementById('trein-contador').textContent = atual + ' de ' + TOTAL;
    document.getElementById('trein-progresso').style.width = (atual / TOTAL * 100) + '%';
    document.querySelector('.trein-seta-esq').disabled = atual === 1;
    document.querySelector('.trein-seta-dir').disabled = atual === TOTAL;
    // módulo atual em destaque
    let mod = MODULOS[0][0];
    MODULOS.forEach(([ini]) => { if (atual >= ini) mod = ini; });
    document.querySelectorAll('.trein-mod').forEach(b => b.classList.toggle('ativo', +b.dataset.ini === mod));
    // pré-carrega os vizinhos
    [atual + 1, atual - 1].forEach(v => { if (v >= 1 && v <= TOTAL) { const p = new Image(); p.src = img(v); } });
  }

  window.treinIr = mostrar;
  window.treinAtual = () => atual;
  window.treinTelaCheia = function () {
    const p = document.getElementById('trein-palco');
    if (!p) return;
    if (document.fullscreenElement) document.exitFullscreen(); else p.requestFullscreen && p.requestFullscreen();
  };

  const ativo = () => document.getElementById('guia')?.classList.contains('ativa');
  document.addEventListener('keydown', e => {
    if (!ativo() || montadoPara !== 'logado') return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { mostrar(atual + 1); e.preventDefault(); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { mostrar(atual - 1); e.preventDefault(); }
    if (e.key === 'Home') mostrar(1);
    if (e.key === 'End') mostrar(TOTAL);
  });

  // Monta quando a seção é aberta (menu, link #guia, voltar do navegador)
  // e reage a entrar/sair do portal.
  setInterval(() => { if (ativo()) montar(); }, 800);
  window.addEventListener('hashchange', () => { if (location.hash === '#guia') montar(); });
})();
