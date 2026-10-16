// ================================================
// CRV — Configuração em Smartphone (menu lateral › Manual › Configuração em Smartphone)
// js/guia-celular.js
//
// Só para usuários logados. Ao clicar no menu abre uma janela para escolher
// iPhone ou Android e ver no próprio site ou baixar o PDF.
// Os guias ficam em guia/celular/iphone.html e android.html (fonte em
// C:\Site\guias-app); os PDFs em guia/Portal-CRV-App-iPhone.pdf e -Android.pdf.
// ================================================
(function () {
  const GUIAS = {
    iphone:  { nome: 'iPhone',  icone: '🍎', html: 'guia/celular/iphone.html?v=2',  pdf: 'guia/Portal-CRV-App-iPhone.pdf',  tam: '0,8 MB' },
    android: { nome: 'Android', icone: '🤖', html: 'guia/celular/android.html?v=2', pdf: 'guia/Portal-CRV-App-Android.pdf', tam: '0,9 MB' },
  };
  const CHAVE = 'crv-guia-celular';
  const logado = () => !!window._usuarioAtual;
  const authResolvido = () => window._usuarioAtual !== undefined;

  let sistema = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'iphone' : 'android';
  try { const s = localStorage.getItem(CHAVE); if (GUIAS[s]) sistema = s; } catch (_) {}
  let montadoPara = null;

  // ── Janela de escolha ──
  function criarModal() {
    if (document.getElementById('modal-guia-celular')) return;
    const m = document.createElement('div');
    m.id = 'modal-guia-celular';
    m.className = 'modal-overlay';
    m.addEventListener('click', e => { if (e.target === m) fechar(); });
    const bloco = k => {
      const g = GUIAS[k];
      return `<p style="font-size:.85rem;font-weight:700;margin:6px 0 0;">${g.icone} ${g.nome}</p>
        <button class="trein-opcao" onclick="verGuiaCelular('${k}')">
          <span class="trein-opcao-icone">▶</span>
          <span><strong>Ver no site</strong><small>Passo a passo do ${g.nome}, aqui mesmo no portal</small></span>
        </button>
        <a class="trein-opcao" href="${g.pdf}" download onclick="fecharEscolhaGuiaCelular()">
          <span class="trein-opcao-icone">⬇</span>
          <span><strong>Baixar PDF</strong><small>Para guardar, imprimir ou enviar (${g.tam})</small></span>
        </a>`;
    };
    m.innerHTML = `
      <div class="modal-box" style="max-width:460px;">
        <div class="modal-header trein-modal-header">
          <div><h3>📱 Configuração em Smartphone</h3><p>Instalar o app do portal e ativar as notificações</p></div>
          <button class="modal-fechar" onclick="fecharEscolhaGuiaCelular()">✕</button>
        </div>
        <div class="modal-body" style="display:flex;flex-direction:column;gap:10px;">
          ${bloco('iphone')}${bloco('android')}
        </div>
      </div>`;
    document.body.appendChild(m);
  }
  function fechar() { document.getElementById('modal-guia-celular')?.classList.remove('aberto'); }

  window.abrirEscolhaGuiaCelular = function () {
    if (!logado()) { window._abrirModalLogin && window._abrirModalLogin(); return; }
    criarModal();
    document.getElementById('modal-guia-celular').classList.add('aberto');
  };
  window.fecharEscolhaGuiaCelular = fechar;
  window.verGuiaCelular = function (k) {
    fechar();
    if (GUIAS[k]) sistema = k;
    window.navegarPara && window.navegarPara('guia-celular');
    montadoPara = null;
    montar();
  };

  // ── Visualizador ──
  function montar() {
    const raiz = document.getElementById('guia-celular-app');
    if (!raiz) return;
    const estado = !authResolvido() ? 'carregando' : (logado() ? 'logado' : 'visitante');
    if (estado === montadoPara) return;
    montadoPara = estado;

    if (estado === 'carregando') { raiz.innerHTML = '<p class="trein-aviso">Carregando…</p>'; return; }
    if (estado === 'visitante') {
      raiz.innerHTML = `<div class="trein-bloqueado">
        <div style="font-size:2.4rem;">🔒</div>
        <p><strong>Os guias de configuração são exclusivos para usuários do portal.</strong></p>
        <p>Entre com o seu e-mail para ver.</p>
        <button class="btn-primario" style="max-width:220px;" onclick="window._abrirModalLogin && window._abrirModalLogin()">Entrar</button>
      </div>`;
      return;
    }

    raiz.innerHTML = `
      <div class="trein-topo">
        <div>
          <h2 class="trein-titulo">📱 Configuração em Smartphone</h2>
          <p class="trein-sub">Como instalar o app do portal e receber as notificações no celular.</p>
        </div>
        <div class="trein-acoes">
          <a class="trein-btn" id="gcel-pdf" download>⬇ Baixar PDF</a>
        </div>
      </div>
      <div class="trein-modulos">
        ${Object.keys(GUIAS).map(k => `<button class="trein-mod" data-k="${k}" onclick="guiaCelularTrocar('${k}')">${GUIAS[k].icone} ${GUIAS[k].nome}</button>`).join('')}
      </div>
      <iframe id="gcel-frame" title="Guia de configuração" style="width:100%;border:1px solid var(--borda, #e2e8f0);border-radius:12px;background:#fff;min-height:70vh;display:block;"></iframe>`;
    const fr = document.getElementById('gcel-frame');
    fr.addEventListener('load', ajustarAltura);
    mostrar(sistema);
  }

  function ajustarAltura() {
    const fr = document.getElementById('gcel-frame');
    try {
      const d = fr.contentDocument;
      fr.style.height = (d.documentElement.scrollHeight + 4) + 'px';
      // imagens podem terminar de carregar depois
      d.querySelectorAll('img').forEach(i => i.complete || i.addEventListener('load', ajustarAltura, { once: true }));
    } catch (_) {}
  }

  function mostrar(k) {
    if (!GUIAS[k]) return;
    sistema = k;
    try { localStorage.setItem(CHAVE, k); } catch (_) {}
    const fr = document.getElementById('gcel-frame');
    if (!fr) return;
    fr.src = GUIAS[k].html;
    document.getElementById('gcel-pdf').href = GUIAS[k].pdf;
    document.querySelectorAll('#guia-celular-app .trein-mod').forEach(b => b.classList.toggle('ativo', b.dataset.k === k));
  }
  window.guiaCelularTrocar = mostrar;
  window.addEventListener('resize', () => { if (document.getElementById('gcel-frame')) ajustarAltura(); });

  // Monta quando a seção é aberta (menu, link #guia-celular, voltar do navegador)
  // e reage a entrar/sair do portal.
  const ativo = () => document.getElementById('guia-celular')?.classList.contains('ativa');
  setInterval(() => { if (ativo()) montar(); }, 800);
  window.addEventListener('hashchange', () => { if (location.hash === '#guia-celular') montar(); });
})();
