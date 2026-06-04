// ================================================
// CRV — Manual Operacional V2
// js/app.js — Lógica principal (sem Firebase)
// ================================================

// ── ESTADO GLOBAL ──
// Dados carregados via fetch() do data/unidades.json
let UNIDADES = [];
let SR_INFO  = {};

// ── CARREGA DADOS DAS UNIDADES ──
async function carregarDadosUnidades() {
  const container = document.getElementById('unidades-container');
  try {
    const res = await fetch('data/unidades.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const dados = await res.json();
    UNIDADES = dados.unidades;
    SR_INFO  = dados.sr;
    // Expõe globalmente para o firebase.js (Gerador de Ofícios usa SR_INFO e UNIDADES)
    window.UNIDADES = UNIDADES;
    window.SR_INFO  = SR_INFO;
    renderizarUnidades();
  } catch (e) {
    console.error('Erro ao carregar unidades.json:', e);
    if (container) {
      container.innerHTML = `
        <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:10px;padding:24px;text-align:center;color:#991b1b;">
          <div style="font-size:2rem;margin-bottom:8px;">⚠️</div>
          <div style="font-weight:700;margin-bottom:6px;">Não foi possível carregar as unidades prisionais.</div>
          <div style="font-size:.85rem;color:#b91c1c;">Verifique sua conexão e recarregue a página.</div>
          <button onclick="location.reload()" style="margin-top:14px;padding:8px 20px;background:#dc2626;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.85rem;font-weight:600;">🔄 Tentar novamente</button>
        </div>`;
    }
  }
}

// ── NAVEGAÇÃO ──
const NOMES_SECAO = {
  inicio:     'Início',
  hipoteses:  'Hipóteses de Transferência',
  fluxo:      'Fluxo Operacional',
  documentos: 'Documentos Necessários',
  legislacao: 'Legislação',
  unidades:   'Unidades Prisionais',
  restrito:   'CRV',
};

function navegarPara(id) {
  document.querySelectorAll('.secao').forEach(s => s.classList.remove('ativa'));
  const alvo = document.getElementById(id);
  if (alvo) {
    alvo.classList.add('ativa');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* Carrega o iframe do painel ao navegar para a seção */
  if (id === 'painel-embed') {
    const fr = document.getElementById('painel-embed-iframe');
    if (fr && !fr.src.includes('painel')) fr.src = 'painel.html';
  }

  document.querySelectorAll('.nav-item').forEach(a => {
    a.classList.remove('ativo');
    if (a.dataset.secao === id) a.classList.add('ativo');
  });

  const bc = document.getElementById('breadcrumb');
  if (bc) bc.textContent = NOMES_SECAO[id] || id;

  document.querySelector('.sidebar')?.classList.remove('aberta');
  document.querySelector('.sidebar-overlay')?.classList.remove('visivel');

  history.pushState(null, '', '#' + id);
}
window.navegarPara = navegarPara;

// ── MENU MOBILE ──
function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('aberta');
  document.querySelector('.sidebar-overlay').classList.toggle('visivel');
}
window.toggleSidebar = toggleSidebar;

// ── POPSTATE ──
window.addEventListener('popstate', () => {
  const id = window.location.hash.replace('#', '') || 'inicio';
  if (NOMES_SECAO[id]) navegarPara(id);
});

// ── INICIALIZAÇÃO ──
document.addEventListener('DOMContentLoaded', async () => {
  const hash = window.location.hash.replace('#', '');
  navegarPara(NOMES_SECAO[hash] ? hash : 'inicio');

  await carregarDadosUnidades();

  window.addEventListener('scroll', () => {
    const btn = document.getElementById('btnTopo');
    if (btn) btn.classList.toggle('visivel', window.scrollY > 400);
  });
});

// ── ACCORDION ──
function toggleAccordion(header) {
  const item  = header.closest('.accordion-item');
  const body  = item.querySelector('.accordion-body');
  const grupo = item.closest('.accordion');
  const aberto = header.classList.contains('aberto');
  grupo.querySelectorAll('.accordion-header').forEach(h => h.classList.remove('aberto'));
  grupo.querySelectorAll('.accordion-body').forEach(b => b.classList.remove('aberto'));
  if (!aberto) { header.classList.add('aberto'); body.classList.add('aberto'); }
}
window.toggleAccordion = toggleAccordion;

// ── FLUXO ──
function toggleFlowStep(body) {
  body.classList.toggle('aberto');
  const btn = body.querySelector('.flow-toggle-btn');
  if (btn) btn.textContent = body.classList.contains('aberto') ? '▼ Ocultar detalhes' : '▶ Ver detalhes';
}
window.toggleFlowStep = toggleFlowStep;

// ── RENDERIZA UNIDADES ──
function renderizarUnidades() {
  const container = document.getElementById('unidades-container');
  if (!container || !UNIDADES.length) return;

  const srLabels = {
    SR01: 'SR01 — Grande Florianópolis',
    SR02: 'SR02 — Sul',
    SR03: 'SR03 — Norte Catarinense',
    SR04: 'SR04 — Vale do Itajaí',
    SR05: 'SR05 — Serrana',
    SR06: 'SR06 — Oeste',
    SR07: 'SR07 — Médio Vale do Itajaí',
    SR08: 'SR08 — Planalto Norte',
  };

  const grupos = {};
  UNIDADES.forEach(u => {
    if (!grupos[u.sr]) grupos[u.sr] = [];
    grupos[u.sr].push(u);
  });

  container.innerHTML = Object.keys(srLabels).map(sr => {
    const ups    = grupos[sr] || [];
    const srInfo = SR_INFO[sr] || {};
    return `
    <div class="sr-bloco" data-sr="${sr.toLowerCase()}">
      <div class="sr-header" onclick="toggleSR(this)">
        <span>🏛️ ${srLabels[sr]} <span style="font-size:.78rem;font-weight:400;opacity:.8;margin-left:8px;">${ups.length} unidade(s) · Sup.: ${srInfo.superintendente || '—'}</span></span>
        <span>▼</span>
      </div>
      <div class="sr-unidades">
        ${ups.map(u => `
        <div class="up-card">
          <div class="up-header" onclick="toggleUP(this)">
            <span>${u.nome}</span>
            <span style="font-size:.75rem;color:var(--cinza-3);">${u.cidade} ▸</span>
          </div>
          <div class="up-detalhe">
            <div><strong>Diretor(a):</strong> ${u.diretor}</div>
            <div><strong>E-mail:</strong> <a href="mailto:${u.email}">${u.email}</a></div>
            <div><strong>Telefone:</strong> ${u.tel}</div>
            <div><strong>Endereço:</strong> ${u.end}</div>
            <div><strong>Superintendência:</strong> ${srInfo.nome || sr} · Sup.: ${srInfo.superintendente || '—'} · ${srInfo.tel || ''}</div>
          </div>
        </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function toggleSR(header) { header.classList.toggle('aberto'); }
window.toggleSR = toggleSR;

function toggleUP(header) { header.classList.toggle('aberto'); }
window.toggleUP = toggleUP;

function filtrarUnidades() {
  const busca  = (document.getElementById('buscaUnidade')?.value || '').toLowerCase().trim();
  const srFilt = (document.getElementById('filtroSR')?.value || '').toLowerCase();

  document.querySelectorAll('.sr-bloco').forEach(bloco => {
    const srId = (bloco.dataset.sr || '').toLowerCase();
    if (srFilt && srId !== srFilt) { bloco.style.display = 'none'; return; }
    bloco.style.display = '';

    if (!busca) {
      bloco.querySelectorAll('.up-card').forEach(c => c.style.display = '');
      return;
    }
    let algum = false;
    bloco.querySelectorAll('.up-card').forEach(card => {
      const match = card.textContent.toLowerCase().includes(busca);
      card.style.display = match ? '' : 'none';
      if (match) {
        algum = true;
        card.querySelector('.up-header')?.classList.add('aberto');
        const det = card.querySelector('.up-detalhe');
        if (det) det.style.display = 'flex';
      }
    });
    if (!algum && !srFilt) bloco.style.display = 'none';
    if (algum) bloco.querySelector('.sr-header')?.classList.add('aberto');
  });
}
window.filtrarUnidades = filtrarUnidades;

// ── TOAST ──
function showToast(msg) {
  let el = document.getElementById('toast-crv');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast-crv';
    el.style.cssText = 'position:fixed;bottom:70px;right:20px;background:#1a2a4a;color:#fff;padding:10px 18px;border-radius:10px;font-size:.84rem;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,.25);z-index:9999;opacity:0;transition:opacity .25s;pointer-events:none;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 3000);
}
window.showToast = showToast;

// ── MODO ESCURO / CLARO ──
window.abrirWhatsAppCRV = function(e) {
  if (e) e.preventDefault();
  /* Só para usuários logados */
  if (!window.usuarioAtual) {
    window._abrirModalLogin && window._abrirModalLogin();
    return;
  }
  if (confirm('Deseja iniciar uma conversa no WhatsApp com a CRV?\n📞 (48) 3665-7330')) {
    window.open('https://wa.me/554836657330', '_blank');
  }
};

function toggleTema() {
  const html = document.documentElement;
  const atual = html.getAttribute('data-tema') || 'claro';
  const novo  = atual === 'claro' ? 'escuro' : 'claro';
  html.setAttribute('data-tema', novo);
  localStorage.setItem('crv-tema', novo);
  const btn = document.querySelector('.btn-tema');
  if (btn) btn.textContent = novo === 'escuro' ? '☀️' : '🌙';
  /* Propaga tema para iframes embarcados */
  ['painel-embed-iframe','gerador-iframe','guia-iframe','crv-tool-iframe'].forEach(fid => {
    const fr = document.getElementById(fid);
    try { if (fr?.contentWindow) fr.contentWindow.postMessage({ crvTema: novo }, '*'); } catch(_) {}
  });
}
window.toggleTema = toggleTema;

// Aplica tema salvo ao carregar
(function() {
  const salvo = localStorage.getItem('crv-tema');
  if (salvo) {
    document.documentElement.setAttribute('data-tema', salvo);
    document.addEventListener('DOMContentLoaded', () => {
      const btn = document.querySelector('.btn-tema');
      if (btn) btn.textContent = salvo === 'escuro' ? '☀️' : '🌙';
    });
  }
})();
