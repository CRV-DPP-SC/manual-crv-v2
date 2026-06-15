// ================================================
// CRV — Painel da Unidade Prisional
// js/painel.js
// ================================================
import { initializeApp }        from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail }
                                 from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, getDoc, getDocs,
         updateDoc, deleteDoc, orderBy, query, where, serverTimestamp, onSnapshot }
                                 from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// ── CONFIG FIREBASE ──
const firebaseConfig = {
  apiKey:            "AIzaSyB61jtxRJlDu0LhwXOM9c42MEHQWciJh-I",
  authDomain:        "crv-dpp-sc-v2.firebaseapp.com",
  projectId:         "crv-dpp-sc-v2",
  storageBucket:     "crv-dpp-sc-v2.firebasestorage.app",
  messagingSenderId: "513539683551",
  appId:             "1:513539683551:web:2fdcdd236f0c37853ae56a"
};
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── E-MAILS CRV (acesso total) ──
const EMAILS_CRV = [
  'rodrigo.l.pastore@gmail.com','ivana.schafer@gmail.com','brunawlongen@gmail.com',
  'ricardobritomarques12@gmail.com','abeljuliana2012@gmail.com','jessicaveiga9@gmail.com',
  'day.sestren88@gmail.com','sepen@pp.sc.gov.br','leilakfarias@gmail.com'
];

// ── ESTADO ──
let UNIDADES          = [];
let SR_INFO           = {};
let usuarioAtual      = null;
let perfilAtual       = null; // 'crv' | 'dir' | 'super' | 'cpen'
let escopoAtual       = null; // { tipo, codigo } ou { tipo, email, unidade }
let unidadeSelecionada  = null; // null = próprio painel | objeto unidade = modo leitura
let srSelecionada       = null; // null = sem filtro SR | 'SR01' etc = CRV visualizando SR
let _pendenciasUnsub    = null; // unsubscribe do listener onSnapshot de pendências

// ── CARREGA JSON ──
async function carregarDados() {
  const res   = await fetch('data/unidades.json');
  const dados = await res.json();
  UNIDADES = dados.unidades;
  SR_INFO  = dados.sr;
}

// ── RESOLVE PERFIL ──
// Primeiro testa padrões institucionais (rápido, sem Firestore).
// Se não encontrar, busca no Firestore para servidor com e-mail particular aprovado.
async function resolverPerfil(user) {
  const e = (user.email || '').toLowerCase();

  if (EMAILS_CRV.includes(e))
    return { perfil: 'crv', escopo: { tipo: 'crv' } };

  const srMatch = e.match(/^(sr0[1-8])@pp\.sc\.gov\.br$/);
  if (srMatch)
    return { perfil: 'super', escopo: { tipo: 'sr', codigo: srMatch[1].toUpperCase() } };

  const dirMatch = e.match(/^(.+)dir@pp\.sc\.gov\.br$/);
  if (dirMatch) {
    const emailBase = dirMatch[1] + '@pp.sc.gov.br';
    const unidade   = UNIDADES.find(u => u.email.toLowerCase() === emailBase);
    if (unidade) return { perfil: 'dir', escopo: { tipo: 'unidade', email: emailBase, unidade } };
  }

  const cpenMatch = e.match(/^(.+)cpen@pp\.sc\.gov\.br$/);
  if (cpenMatch) {
    const emailBase = cpenMatch[1] + '@pp.sc.gov.br';
    const unidade   = UNIDADES.find(u => u.email.toLowerCase() === emailBase);
    if (unidade) return { perfil: 'cpen', escopo: { tipo: 'unidade', email: emailBase, unidade } };
  }

  // E-mail particular — verifica se é servidor aprovado no Firestore
  try {
    const snap = await getDoc(doc(db, 'usuarios_cadastrados', user.uid));
    if (snap.exists()) {
      const dados = snap.data();
      if (dados.status === 'aprovado' && dados.perfil === 'servidor') {
        const unidade = UNIDADES.find(u => u.email === dados.emailUnidade);
        if (unidade) {
          return {
            perfil: 'servidor',
            escopo: { tipo: 'unidade', email: dados.emailUnidade, unidade }
          };
        }
      }
    }
  } catch (_) {}

  return null;
}

// ── MODO LEITURA ──
// Ativo quando CRV ou Super está visualizando o painel de outra unidade.
function modoLeitura() {
  return unidadeSelecionada !== null;
}

// ── PODE ASSINAR ──
function podeAssinar() {
  if (modoLeitura()) return false;
  return ['crv', 'dir', 'super'].includes(perfilAtual);
}

// ── NOME EXIBIDO DO USUÁRIO ATUAL (para registro de ações) ──
function nomeExibidoAtual() {
  if (perfilAtual === 'crv')   return 'CRV — Central de Regulação de Vagas';
  if (perfilAtual === 'super') return SR_INFO[escopoAtual?.codigo]?.nome || escopoAtual?.codigo || 'Superintendência';
  if (escopoAtual?.unidade)    return escopoAtual.unidade.nome;
  return usuarioAtual?.email || '—';
}

// ── PODE CANCELAR ──
// CRV = qualquer doc (inclusive em modo leitura); DIR/CPEN = só própria unidade; SR = não.
function podeCancelar(s) {
  if (s.statusGeral === 'cancelado') return false;
  const ass = s.assinantes || [];
  if (ass.length > 0 && ass.every(a => a.status === 'assinado')) return false;
  if (perfilAtual === 'crv') return true;
  if (modoLeitura()) return false;
  if (['dir', 'cpen'].includes(perfilAtual)) return s.emailUnidadeOrigem === escopoAtual?.email;
  return false;
}

// ── UNIDADES VISÍVEIS ──
function unidadesVisiveis() {
  if (unidadeSelecionada) return [unidadeSelecionada];
  if (srSelecionada)      return UNIDADES.filter(u => u.sr === srSelecionada);
  if (!perfilAtual || !escopoAtual) return [];
  if (perfilAtual === 'crv')   return UNIDADES;
  if (perfilAtual === 'super') return UNIDADES.filter(u => u.sr === escopoAtual.codigo);
  if (['dir', 'cpen', 'servidor'].includes(perfilAtual))
    return UNIDADES.filter(u => u.email === escopoAtual.email);
  return [];
}

// ── Inicia o carregamento dos dados o mais cedo possível ──
const dadosPromise = carregarDados();

// ══════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════
onAuthStateChanged(auth, async (user) => {
  await dadosPromise;
  if (user) {
    usuarioAtual = user;
    const resolvido = await resolverPerfil(user);
    if (!resolvido) {
      await signOut(auth);
      mostrarErro('E-mail não autorizado para o Painel da Unidade.');
      return;
    }
    perfilAtual = resolvido.perfil;
    escopoAtual = resolvido.escopo;
    // Salva e-mail da unidade para preenchimento automático no gerador de ofícios
    if (escopoAtual?.unidade?.email) {
      localStorage.setItem('crv_ori_email', escopoAtual.unidade.email);
    } else {
      localStorage.removeItem('crv_ori_email');
    }
    mostrarPainel();
  } else {
    usuarioAtual       = null;
    perfilAtual        = null;
    escopoAtual        = null;
    unidadeSelecionada = null;
    srSelecionada      = null;
    mostrarLogin();
  }
});

/* Login removido — autenticação exclusiva pelo site principal (index.html) */

window.fazerLogoutPainel = async function () {
  if (_pendenciasUnsub) { _pendenciasUnsub(); _pendenciasUnsub = null; }
  if (_acessosUnsub)   { _acessosUnsub();    _acessosUnsub    = null; }
  localStorage.removeItem('crv_ori_email');
  await signOut(auth);
  window.location.href = 'index.html';
};

// ══════════════════════════════════════════════
// RENDERIZAÇÃO
// ══════════════════════════════════════════════
function mostrarLogin() {
  document.getElementById('tela-login-painel').style.display = 'flex';
  document.getElementById('tela-painel').style.display = 'none';
}

function mostrarPainel() {
  document.getElementById('tela-login-painel').style.display = 'none';
  document.getElementById('tela-painel').style.display = 'block';
  renderizarCabecalhoPainel();
  if ((perfilAtual === 'crv' || perfilAtual === 'super') && !modoLeitura()) {
    mostrarDashboard();
  } else if (_ehNavCartoes()) {
    mostrarLandingGrupos();
  } else {
    document.querySelector('.p-abas').style.display = '';
    document.getElementById('p-corpo').className = '';
    carregarAba('pendentes');
  }
  /* Listener em tempo real de pendências para DIR/SR/CPEN */
  if (['dir', 'super', 'cpen'].includes(perfilAtual)) {
    _iniciarListenerPendencias();
    _verificarPendenciasLogin();
  }
  /* Notificação de cadastros pendentes: apenas DIR e CPEN da unidade */
  if (['dir', 'cpen'].includes(perfilAtual)) {
    _iniciarListenerAcessosPendentes();
  }
}

/* ── Listener onSnapshot: notificação em tempo real de pendências ── */
let _prevPendenciasIds = new Set();
let _primeiraExecucaoSnap = true;

function _iniciarListenerPendencias() {
  if (_pendenciasUnsub) { _pendenciasUnsub(); _pendenciasUnsub = null; }
  _primeiraExecucaoSnap = true;

  const q = query(collection(db, 'solicitacoes'), orderBy('criadoEm', 'desc'));
  _pendenciasUnsub = onSnapshot(q, (snap) => {
    const pendentes = [];
    snap.forEach(d => {
      const s = { id: d.id, ...d.data() };
      if (s.statusGeral === 'cancelado') return;
      const minha = (s.assinantes || []).find(a =>
        a.email === usuarioAtual.email && a.status === 'pendente'
      );
      if (minha) pendentes.push(s);
    });

    _atualizarBadgePendencias(pendentes.length);

    /* Notifica apenas quando chega item NOVO (não na carga inicial) */
    const novosIds = pendentes.map(p => p.id).filter(id => !_prevPendenciasIds.has(id));
    if (!_primeiraExecucaoSnap && novosIds.length > 0) {
      showToastPainel('⏳ ' + novosIds.length + ' nova(s) solicitação(ões) de assinatura recebida(s)!');
      /* Recarrega aba Pendentes se estiver ativa */
      const abaAtiva = _ehNavCartoes() ? _abaAtiva : document.querySelector('.p-aba-btn.ativa')?.dataset.aba;
      if (abaAtiva === 'pendentes') carregarAba('pendentes');
    }

    _prevPendenciasIds = new Set(pendentes.map(p => p.id));
    _primeiraExecucaoSnap = false;
  }, () => { /* ignora erros de permissão silenciosamente */ });
}

function _atualizarBadgePendencias(n) {
  const badge = document.getElementById('p-badge-pendentes');
  if (!badge) return;
  badge.textContent = n > 0 ? String(n) : '';
  badge.style.display = n > 0 ? '' : 'none';
}

/* ── Listener em tempo real: cadastros de acesso pendentes ── */
let _acessosUnsub = null;
let _prevAcessosIds = new Set();
let _primeiraExecucaoAcessos = true;

function _iniciarListenerAcessosPendentes() {
  if (_acessosUnsub) { _acessosUnsub(); _acessosUnsub = null; }
  if (!escopoAtual?.email) return; /* só DIR e CPEN com unidade definida */
  _primeiraExecucaoAcessos = true;

  const q = query(collection(db, 'usuarios_cadastrados'),
                  where('emailUnidade', '==', escopoAtual.email),
                  where('status', '==', 'pendente'));

  _acessosUnsub = onSnapshot(q, (snap) => {
    const pendentes = [];
    snap.forEach(d => pendentes.push({ id: d.id, ...d.data() }));

    _atualizarBadgeAcessos(pendentes.length);

    const novosIds = pendentes.map(p => p.id).filter(id => !_prevAcessosIds.has(id));
    if (!_primeiraExecucaoAcessos && novosIds.length > 0) {
      showToastPainel('🔔 ' + novosIds.length + ' nova(s) solicitação(ões) de acesso aguardando aprovação!');
      const abaAtiva = _ehNavCartoes() ? _abaAtiva : document.querySelector('.p-aba-btn.ativa')?.dataset.aba;
      if (abaAtiva === 'acessos') carregarAba('acessos');
    }

    /* Modal no login (apenas na primeira execução, se houver pendentes) */
    if (_primeiraExecucaoAcessos && pendentes.length > 0) {
      _mostrarModalAcessosPendentes(pendentes);
    }

    _prevAcessosIds = new Set(pendentes.map(p => p.id));
    _primeiraExecucaoAcessos = false;
  }, () => {});
}

function _atualizarBadgeAcessos(n) {
  const badge = document.getElementById('p-badge-acessos');
  if (!badge) return;
  badge.textContent = n > 0 ? String(n) : '';
  badge.style.display = n > 0 ? '' : 'none';
}

function _mostrarModalAcessosPendentes(lista) {
  const corpo = document.getElementById('p-pendencias-corpo');
  if (!corpo) return;
  /* Só mostra modal de acessos se NÃO houver modal de assinaturas já na fila */
  if (document.getElementById('p-modal-pendencias').style.display === 'flex') return;
  corpo.innerHTML = `
    <p style="font-size:.88rem;color:var(--txt-2);margin-bottom:14px;line-height:1.55;">
      Há <strong>${lista.length} solicitaç${lista.length > 1 ? 'ões' : 'ão'} de acesso</strong> aguardando aprovação na aba Acessos:
    </p>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
      ${lista.map(s => `
        <div style="padding:10px 14px;background:var(--surface-2);border-radius:var(--radius);font-size:.84rem;">
          <div style="font-weight:600;color:var(--txt-1);">${escHtml(s.nome || '—')}</div>
          <div style="font-size:.75rem;color:var(--txt-3);margin-top:2px;">${escHtml(s.nomeUnidade || s.emailUnidade || '—')}</div>
        </div>`).join('')}
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;">
      <button class="p-btn p-btn-outline" onclick="fecharModalPendencias()">← Retornar ao Painel</button>
      <button class="p-btn" style="background:var(--azul-600);color:#fff;" onclick="fecharModalPendencias();carregarAba('acessos')">Ver solicitações →</button>
    </div>`;
  document.getElementById('p-modal-pendencias').style.display = 'flex';
}

/* Cancela listener de acessos no logout (em fazerLogoutPainel) */
window._cancelarListenerAcessos = function () {
  if (_acessosUnsub) { _acessosUnsub(); _acessosUnsub = null; }
};

/* ── Modal de pendências no login ── */
async function _verificarPendenciasLogin() {
  try {
    const snap = await getDocs(query(collection(db, 'solicitacoes'), orderBy('criadoEm', 'desc')));
    const pendentes = [];
    snap.forEach(d => {
      const s = { id: d.id, ...d.data() };
      if (s.statusGeral === 'cancelado') return;
      const minha = (s.assinantes || []).find(a =>
        a.email === usuarioAtual.email && a.status === 'pendente'
      );
      if (minha) pendentes.push(s);
    });
    if (!pendentes.length) return;

    const corpo = document.getElementById('p-pendencias-corpo');
    if (!corpo) return;
    corpo.innerHTML = `
      <p style="font-size:.88rem;color:var(--txt-2);margin-bottom:14px;line-height:1.55;">
        Você tem <strong>${pendentes.length} solicitaç${pendentes.length > 1 ? 'ões' : 'ão'} pendente${pendentes.length > 1 ? 's' : ''}</strong> aguardando sua assinatura:
      </p>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
        ${pendentes.map(s => `
          <div style="padding:10px 14px;background:var(--surface-2);border-radius:var(--radius);font-size:.84rem;">
            <div style="font-weight:600;color:var(--txt-1);">${escHtml(s.titulo || 'Ofício s/ título')}</div>
            ${s.presos && s.presos.length
              ? `<div style="font-size:.75rem;color:var(--azul-600);margin-top:3px;">👤 ${s.presos.map(p => escHtml(p.nome || '')).join(' · ')}</div>`
              : ''}
            <div style="font-size:.72rem;color:var(--txt-3);margin-top:2px;">${escHtml(s.nomeUnidadeOrigem || s.emailUnidadeOrigem || '—')}</div>
            ${s.resumo
              ? `<div style="margin-top:8px;padding:8px 12px;background:#eff6ff;border-left:3px solid var(--azul-400);border-radius:0 6px 6px 0;">
                   <div style="font-size:.6rem;font-weight:800;color:var(--azul-600);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Resumo Sintético — IPEN</div>
                   <p style="font-size:.78rem;color:#1e3a8a;line-height:1.6;margin:0;">${escHtml(s.resumo)}</p>
                 </div>`
              : '<div style="margin-top:6px;font-size:.72rem;color:var(--txt-4);font-style:italic;">Resumo não disponível para este documento.</div>'}
          </div>`).join('')}
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <button class="p-btn p-btn-outline" onclick="fecharModalPendencias()">← Retornar ao Painel</button>
        <button class="p-btn p-btn-assinar" onclick="fecharModalPendencias();carregarAba('pendentes')">Ver pendências →</button>
      </div>`;
    document.getElementById('p-modal-pendencias').style.display = 'flex';
  } catch (_) {}
}

window.fecharModalPendencias = function () {
  const m = document.getElementById('p-modal-pendencias');
  if (m) m.style.display = 'none';
};

function renderizarCabecalhoPainel() {
  const nomeEl   = document.getElementById('p-nome-usuario');
  const emailEl  = document.getElementById('p-email-usuario');
  const perfilEl = document.getElementById('p-perfil-badge');

  const labels = { crv: 'CRV', dir: 'Diretor(a)', super: 'Superintendente', cpen: 'Coord. Penal', servidor: 'Servidor' };
  const cores  = { crv: '#3b82f6', dir: '#15803d', super: '#7c3aed', cpen: '#b45309', servidor: '#64748b' };

  let nomeExibido = usuarioAtual.email;
  if (escopoAtual?.unidade)        nomeExibido = escopoAtual.unidade.nome;
  else if (escopoAtual?.tipo === 'sr') nomeExibido = SR_INFO[escopoAtual.codigo]?.nome || escopoAtual.codigo;
  else if (perfilAtual === 'crv')   nomeExibido = 'CRV — Central de Regulação de Vagas';

  nomeEl.textContent    = nomeExibido;
  emailEl.textContent   = usuarioAtual.email;
  perfilEl.textContent  = labels[perfilAtual] || perfilAtual;
  perfilEl.style.background = cores[perfilAtual] || '#64748b';

  // Menu suspenso somente para CRV e Superintendentes
  if (perfilAtual === 'crv' || perfilAtual === 'super') {
    renderizarMenuUnidades();
  }

  _atualizarTabAcessos();
}

// ══════════════════════════════════════════════
// MENU SUSPENSO DE UNIDADES
// ══════════════════════════════════════════════
function renderizarMenuUnidades() {
  const wrap = document.getElementById('p-seletor-unidade-wrap');
  if (!wrap) return;

  if (perfilAtual === 'super') {
    /* Superintendente: mantém select simples com suas unidades */
    const sel = document.createElement('select');
    sel.className = 'p-select-unidade';
    sel.id = 'p-select-unidade';
    sel.addEventListener('change', e => trocarUnidade(e.target.value));
    const info = SR_INFO[escopoAtual.codigo] || {};
    adicionarOpcao(sel, '__sr__', `✦ ${escopoAtual.codigo} — ${info.nome || escopoAtual.codigo}`);
    adicionarOpcao(sel, '', '─────────────────────────────', true);
    UNIDADES.filter(u => u.sr === escopoAtual.codigo).forEach(u => {
      const o = document.createElement('option'); o.value = u.email; o.textContent = u.nome; sel.appendChild(o);
    });
    wrap.innerHTML = ''; wrap.appendChild(sel); return;
  }

  if (perfilAtual !== 'crv') return;

  /* CRV: dropdown suspenso com árvore SR → Unidades e busca */
  const srs = [...new Set(UNIDADES.map(u => u.sr))].sort();

  function _treeLabelAtual() {
    if (srSelecionada) {
      const info = SR_INFO[srSelecionada] || {};
      return `${srSelecionada} — ${info.nome || srSelecionada}`;
    }
    if (!unidadeSelecionada) return '✦ CRV — Central de Regulação de Vagas';
    return unidadeSelecionada.nome || unidadeSelecionada.email || 'Unidade';
  }

  function buildTree(filtro) {
    filtro = (filtro || '').toLowerCase().trim();
    let html = '';
    srs.forEach(srCod => {
      const info  = SR_INFO[srCod] || {};
      const unids = UNIDADES.filter(u => u.sr === srCod &&
        (!filtro || u.nome.toLowerCase().includes(filtro)));
      if (filtro && !unids.length &&
          !srCod.toLowerCase().includes(filtro) &&
          !(info.nome || '').toLowerCase().includes(filtro)) return;
      const hasMatch = filtro && unids.length > 0;
      html += `<div class="p-tree-sr" id="ptsr-${srCod}">
        <span class="p-tree-sr-arrow${hasMatch ? ' open' : ''}" id="ptarr-${srCod}" onclick="_treeToggleSR('${srCod}',event)" title="Expandir/recolher">▶</span>
        <span style="flex:1;cursor:pointer;" onclick="_treeSelSR('${srCod}')">${srCod} — ${escHtml(info.nome || srCod)}</span>
      </div>
      <div class="p-tree-units${hasMatch ? ' open' : ''}" id="ptunits-${srCod}">
        ${(filtro ? unids : UNIDADES.filter(u => u.sr === srCod)).map(u =>
          `<div class="p-tree-unit" onclick="_treeSelUnit('${escHtml(u.email)}')" data-email="${escHtml(u.email)}">${escHtml(u.nome)}</div>`
        ).join('')}
      </div>`;
    });
    return html;
  }

  wrap.innerHTML = `
    <div class="p-tree-wrap" id="p-tree-wrap">
      <!-- Botão gatilho do dropdown -->
      <button class="p-tree-trigger" id="p-tree-trigger" onclick="_treeAbrirFechar(event)">
        <span id="p-tree-label">${_treeLabelAtual()}</span>
        <span class="p-tree-trigger-arrow" id="p-tree-trigger-arrow">▾</span>
      </button>
      <!-- Painel suspenso (fechado por padrão) -->
      <div class="p-tree-panel" id="p-tree-panel" style="display:none;">
        <input class="p-tree-search" id="p-tree-search"
               placeholder="🔍 Buscar regional ou unidade…"
               oninput="_treeFiltrar(this.value)"
               onclick="event.stopPropagation()">
        <div id="p-tree-body">
          <div class="p-tree-sr selecionado"
               onclick="_treeSelCRV()"
               style="border-bottom:1px solid rgba(255,255,255,.1);margin-bottom:4px;">
            ✦ CRV — Central de Regulação de Vagas
          </div>
          ${buildTree('')}
        </div>
      </div>
    </div>`;

  _treeMarcarSelecionado();

  /* Abre/fecha o painel */
  window._treeAbrirFechar = function(e) {
    e.stopPropagation();
    const panel  = document.getElementById('p-tree-panel');
    const arrow  = document.getElementById('p-tree-trigger-arrow');
    const search = document.getElementById('p-tree-search');
    if (!panel) return;
    const aberto = panel.style.display !== 'none';
    panel.style.display = aberto ? 'none' : 'block';
    if (arrow) arrow.textContent = aberto ? '▾' : '▴';
    if (!aberto && search) { search.value = ''; _treeFiltrar(''); search.focus(); }
  };

  /* Fecha o painel */
  function _treeFechar() {
    const panel = document.getElementById('p-tree-panel');
    const arrow = document.getElementById('p-tree-trigger-arrow');
    if (panel) panel.style.display = 'none';
    if (arrow) arrow.textContent = '▾';
  }

  /* Atualiza o label do botão */
  function _treeAtualizarLabel() {
    const lbl = document.getElementById('p-tree-label');
    if (lbl) lbl.textContent = _treeLabelAtual();
  }

  /* Selecionar Regional (SR) */
  window._treeSelSR = function(srCod) {
    trocarUnidade('__sr_' + srCod + '__');
    _treeMarcarSelecionado();
    _treeAtualizarLabel();
    _treeFechar();
  };

  /* Selecionar CRV */
  window._treeSelCRV = function() {
    trocarUnidade('__crv__');
    _treeMarcarSelecionado();
    _treeAtualizarLabel();
    _treeFechar();
  };

  /* Filtro de busca */
  window._treeFiltrar = function(val) {
    const body = document.getElementById('p-tree-body');
    if (!body) return;
    const crvItem = body.querySelector('.p-tree-sr.selecionado');
    const crvHtml = crvItem ? crvItem.outerHTML : '';
    body.innerHTML = (crvHtml || '') + buildTree(val);
    _treeMarcarSelecionado();
  };

  /* Toggle de SR (expande/colapsa unidades) */
  window._treeToggleSR = function(srCod, e) {
    e.stopPropagation();
    const units = document.getElementById('ptunits-' + srCod);
    const arr   = document.getElementById('ptarr-'   + srCod);
    if (!units) return;
    const open = units.classList.contains('open');
    units.classList.toggle('open', !open);
    if (arr) arr.classList.toggle('open', !open);
  };

  /* Selecionar unidade */
  window._treeSelUnit = function(email) {
    trocarUnidade(email);
    _treeMarcarSelecionado();
    _treeAtualizarLabel();
    _treeFechar();
  };

  /* Fechar ao clicar fora */
  document.addEventListener('click', function _closeDrop(e) {
    const wrap2 = document.getElementById('p-tree-wrap');
    if (wrap2 && !wrap2.contains(e.target)) _treeFechar();
  });
}

function _treeMarcarSelecionado() {
  document.querySelectorAll('.p-tree-unit').forEach(el => {
    el.classList.toggle('selecionado', el.dataset.email === (unidadeSelecionada?.email || ''));
  });
  document.querySelectorAll('.p-tree-sr').forEach(el => el.classList.remove('selecionado'));
  if (srSelecionada) {
    document.getElementById('ptsr-' + srSelecionada)?.classList.add('selecionado');
  } else if (!unidadeSelecionada) {
    document.querySelector('#p-tree-body > .p-tree-sr')?.classList.add('selecionado');
  }
}

function adicionarOpcao(select, value, text, disabled = false) {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = text;
  if (disabled) o.disabled = true;
  select.appendChild(o);
}

function trocarUnidade(valor) {
  const banner = document.getElementById('p-banner-leitura');

  /* CRV seleciona painel de uma SR */
  const srMatch = valor.match(/^__sr_(.+)__$/);
  if (srMatch) {
    srSelecionada      = srMatch[1];
    unidadeSelecionada = null;
    const info = SR_INFO[srSelecionada] || {};
    if (banner) {
      banner.textContent = `Visualizando: ${srSelecionada} — ${info.nome || srSelecionada} (somente leitura)`;
      banner.classList.add('visivel');
    }
    _atualizarTabAcessos();
    mostrarDashboard();
    return;
  }

  srSelecionada = null;
  const foiProprioPanel = (valor === '__crv__' || valor === '__sr__' || !valor);
  unidadeSelecionada = foiProprioPanel
    ? null
    : UNIDADES.find(u => u.email === valor) || null;

  if (banner) {
    if (unidadeSelecionada) {
      banner.textContent = `Visualizando: ${unidadeSelecionada.nome} — somente leitura`;
      banner.classList.add('visivel');
    } else {
      banner.classList.remove('visivel');
    }
  }

  _atualizarTabAcessos();

  if (foiProprioPanel) {
    mostrarDashboard();
  } else {
    document.querySelector('.p-abas').style.display = '';
    document.getElementById('p-corpo').className = '';
    carregarAba('pendentes');
  }
}

function _atualizarTabAcessos() {
  const tabAcessos = document.getElementById('tab-acessos');
  if (tabAcessos) {
    // DIR/CPEN sempre veem Acessos; CRV só em modo leitura (unidade selecionada)
    const verAcessos = ['dir', 'cpen'].includes(perfilAtual) ||
                (perfilAtual === 'crv' && modoLeitura());
    tabAcessos.style.display = verAcessos ? '' : 'none';
  }

  const tabFerr = document.getElementById('tab-ferramentas');
  if (tabFerr) {
    // DIR e CPEN veem Ferramentas
    tabFerr.style.display = ['dir', 'cpen'].includes(perfilAtual) ? '' : 'none';
  }
}

// ══════════════════════════════════════════════
// NAVEGAÇÃO POR CARTÕES (dir / cpen)
// ══════════════════════════════════════════════
let _grupoAtivo = null;
let _abaAtiva   = null;

function _ehNavCartoes() {
  return ['dir', 'cpen'].includes(perfilAtual) && !modoLeitura();
}

const _GRUPO_DE_ABA = {
  pendentes: 'transferencias', minhas: 'transferencias',
  historico: 'transferencias', cancelados: 'transferencias',
  acessos: 'acesso',
};
const _LABEL_GRUPO = { transferencias: 'Transferências', acesso: 'Controle de Acesso', ferramentas: 'Ferramentas' };
const _LABEL_ABA   = {
  pendentes: 'Assinaturas Pendentes', minhas: 'Solicitar Assinatura',
  historico: 'Histórico', cancelados: 'Cancelados', acessos: 'Usuários',
};

function _atualizarBreadcrumb() {
  const bc = document.getElementById('p-breadcrumb');
  if (!bc) return;
  if (!_ehNavCartoes() || !_abaAtiva) { bc.className = ''; return; }
  const gl = _LABEL_GRUPO[_grupoAtivo] || '';
  const al = _LABEL_ABA[_abaAtiva]    || _abaAtiva;
  bc.className = 'visivel';
  bc.innerHTML = `
    <button class="p-bc-btn" onclick="mostrarLandingGrupos()">← Início</button>
    <span class="p-bc-sep">/</span>
    <button class="p-bc-btn" onclick="_mostrarSubGrupo('${_grupoAtivo}')">${gl}</button>
    <span class="p-bc-sep">/</span>
    <span class="p-bc-atual">${al}</span>`;
}

window.mostrarLandingGrupos = function() {
  _grupoAtivo = null;
  _abaAtiva   = null;
  _atualizarBreadcrumb();
  document.querySelector('.p-abas').style.display = 'none';

  const corpo = document.getElementById('p-corpo');
  corpo.className = '';

  const unNome = escopoAtual?.unidade?.nome || escopoAtual?.n || escopoAtual?.nome || '';

  const grupos = [
    { id: 'transferencias', icon: '📋', titulo: 'Transferências',     sub: 'Anuências, solicitações e histórico', cor: 'var(--azul-600)' },
    { id: 'acesso',         icon: '🔐', titulo: 'Controle de Acesso', sub: 'Usuários e permissões da unidade',    cor: '#7c3aed'         },
    { id: 'ferramentas',    icon: '🛠️', titulo: 'Ferramentas',        sub: 'Geradores e recursos da unidade',     cor: '#b45309'         },
  ];

  const badge = document.getElementById('p-badge-pendentes');
  const nPend = badge && badge.style.display !== 'none' ? badge.textContent : '';

  corpo.innerHTML = `
  <div style="padding:28px 32px 40px;">
    ${unNome ? `<p style="font-size:.78rem;color:var(--txt-3);margin:0 0 20px;">📍 ${unNome}</p>` : ''}
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;max-width:760px;">
      ${grupos.map(g => {
        const extra = (g.id === 'transferencias' && nPend)
          ? `<span class="p-sub-card-badge" style="margin-left:auto;">${nPend}</span>` : '';
        return `<button class="p-grupo-card" onclick="_mostrarSubGrupo('${g.id}')" style="--grupo-cor:${g.cor};"
          onmouseover="this.style.borderColor='${g.cor}'" onmouseout="this.style.borderColor='var(--border)'">
          <span class="p-grupo-icon">${g.icon}</span>
          <div class="p-grupo-corpo">
            <div class="p-grupo-titulo">${g.titulo} ${extra}</div>
            <div class="p-grupo-sub">${g.sub}</div>
          </div>
          <span class="p-grupo-arrow" style="color:${g.cor};">›</span>
        </button>`;
      }).join('')}
    </div>
  </div>`;
};

window._mostrarSubGrupo = function(grupoId) {
  _grupoAtivo = grupoId;
  _abaAtiva   = null;
  _atualizarBreadcrumb();
  document.querySelector('.p-abas').style.display = 'none';

  const corpo = document.getElementById('p-corpo');
  corpo.className = '';

  const unNome = escopoAtual?.unidade?.nome || escopoAtual?.n || escopoAtual?.nome || '';

  const backBtn = `<button class="p-bc-btn" onclick="mostrarLandingGrupos()" style="display:flex;align-items:center;gap:5px;margin-bottom:20px;font-size:.82rem;">← Voltar</button>`;

  /* ── FERRAMENTAS ── */
  if (grupoId === 'ferramentas') {
    const isCpen = perfilAtual === 'cpen';
    const padCard = isCpen ? `
      <button class="p-sub-card" onclick="_abrirPADdoPainel()"
        style="border-color:#f97316;"
        onmouseover="this.style.background='#fff8f3';this.style.borderColor='#ea580c';"
        onmouseout="this.style.background='var(--bg-card)';this.style.borderColor='#f97316';">
        <span class="p-sub-card-icon">📋</span>
        <span class="p-sub-card-titulo" style="color:#9a3412;">Gerador de PAD</span>
        <span class="p-sub-card-sub">Procedimento Administrativo Disciplinar</span>
      </button>` : '';

    const toolCards = [
      { icon: '⚙️', titulo: 'Gerador de Ofícios', sub: 'Elaborar ofícios com formatação oficial',    onclick: `window.parent.abrirGeradorOficios && window.parent.abrirGeradorOficios()` },
      { icon: '📄', titulo: 'Guia — Gerador de Ofícios', sub: 'Instruções de uso do gerador',        onclick: `window.parent.abrirGuiaOficios && window.parent.abrirGuiaOficios()` },
      { icon: '🌐', titulo: 'Portal de Transferências ↗', sub: 'ppsc.com.br — pedidos voluntários',   onclick: `window.open('https://ppsc.com.br','_blank')` },
      { icon: '🏛️', titulo: 'Unidades Prisionais', sub: 'Contatos e dados das unidades',             onclick: `window.parent.navegarPara && window.parent.navegarPara('unidades')` },
      { icon: '📚', titulo: 'Legislação', sub: 'Base normativa aplicável',                            onclick: `window.parent.navegarPara && window.parent.navegarPara('legislacao')` },
    ].map(t => `<button class="p-sub-card" onclick="${t.onclick}">
        <span class="p-sub-card-icon">${t.icon}</span>
        <span class="p-sub-card-titulo">${t.titulo}</span>
        <span class="p-sub-card-sub">${t.sub}</span>
      </button>`).join('');

    corpo.innerHTML = `
    <div style="padding:24px 32px 40px;">
      ${backBtn}
      <h2 style="font-size:1rem;font-weight:700;color:var(--txt-1);margin:0 0 4px;">🛠️ Ferramentas</h2>
      ${unNome ? `<p style="font-size:.75rem;color:var(--txt-3);margin:0 0 20px;">📍 ${unNome}</p>` : '<div style="height:16px;"></div>'}
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;max-width:760px;">
        ${padCard}${toolCards}
      </div>
    </div>`;
    return;
  }

  /* ── TRANSFERÊNCIAS ── */
  if (grupoId === 'transferencias') {
    const badge = document.getElementById('p-badge-pendentes');
    const nPend = badge && badge.style.display !== 'none' ? badge.textContent : '';
    const itens = [
      { aba: 'pendentes', icon: '✍️', titulo: 'Assinaturas Pendentes', sub: 'Documentos aguardando sua anuência', badge: nPend },
      { aba: 'minhas',    icon: '📤', titulo: 'Solicitar Assinatura',   sub: 'Criar nova solicitação de anuência' },
      { aba: 'historico', icon: '📂', titulo: 'Histórico',              sub: 'Pedidos realizados' },
      { aba: 'cancelados',icon: '🚫', titulo: 'Cancelados',             sub: 'Solicitações canceladas' },
    ];
    corpo.innerHTML = `
    <div style="padding:24px 32px 40px;">
      ${backBtn}
      <h2 style="font-size:1rem;font-weight:700;color:var(--txt-1);margin:0 0 20px;">📋 Transferências</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;max-width:760px;">
        ${itens.map(it => `
          <button class="p-sub-card" onclick="carregarAba('${it.aba}')">
            <span class="p-sub-card-icon">${it.icon}</span>
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="p-sub-card-titulo">${it.titulo}</span>
              ${it.badge ? `<span class="p-sub-card-badge">${it.badge}</span>` : ''}
            </div>
            <span class="p-sub-card-sub">${it.sub}</span>
          </button>`).join('')}
      </div>
    </div>`;
    return;
  }

  /* ── CONTROLE DE ACESSO ── */
  if (grupoId === 'acesso') {
    const badgeAc = document.getElementById('p-badge-acessos');
    const nAc = badgeAc && badgeAc.style.display !== 'none' ? badgeAc.textContent : '';
    corpo.innerHTML = `
    <div style="padding:24px 32px 40px;">
      ${backBtn}
      <h2 style="font-size:1rem;font-weight:700;color:var(--txt-1);margin:0 0 20px;">🔐 Controle de Acesso</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;max-width:760px;">
        <button class="p-sub-card" onclick="carregarAba('acessos')">
          <span class="p-sub-card-icon">👤</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="p-sub-card-titulo">Usuários</span>
            ${nAc ? `<span class="p-sub-card-badge" style="background:#f59e0b;">${nAc}</span>` : ''}
          </div>
          <span class="p-sub-card-sub">Gerenciar acesso dos servidores da unidade</span>
        </button>
      </div>
    </div>`;
    return;
  }
};

// ══════════════════════════════════════════════
// ABAS
// ══════════════════════════════════════════════
window.carregarAba = async function (aba) {
  /* Modo cartões: rastreia grupo e aba para breadcrumb */
  if (_ehNavCartoes()) {
    _abaAtiva   = aba;
    _grupoAtivo = _GRUPO_DE_ABA[aba] || _grupoAtivo;
    _atualizarBreadcrumb();
  } else {
    document.querySelectorAll('.p-aba-btn')
      .forEach(b => b.classList.toggle('ativa', b.dataset.aba === aba));
  }

  /* Limpa seleções ao trocar de aba */
  _selSols.clear(); _selAcess.clear();
  _atualizarBarra();

  const corpo = document.getElementById('p-corpo');
  corpo.innerHTML = '<div class="p-loading">Carregando…</div>';

  // Abas com lógica própria
  if (aba === 'acessos')     { await carregarAbaAcessos(corpo);     return; }
  if (aba === 'manual')      { carregarAbaManual(corpo);             return; }
  if (aba === 'ferramentas') { carregarAbaFerramentas(corpo);        return; }

  const unids = unidadesVisiveis().map(u => u.email);
  if (!unids.length) {
    corpo.innerHTML = '<div class="p-vazio">Nenhuma unidade no seu escopo.</div>';
    return;
  }

  try {
    let solicitacoes = [];
    const snap = await getDocs(
      query(collection(db, 'solicitacoes'), orderBy('criadoEm', 'desc'))
    );

    if (aba === 'pendentes') {
      snap.forEach(d => {
        const s = { id: d.id, ...d.data() };

        if (modoLeitura()) {
          // Modo leitura: mostra docs em que a unidade visualizada tem assinatura pendente
          const temPendente = (s.assinantes || []).some(
            a => a.emailUnidade === unidadeSelecionada.email && a.status === 'pendente'
          );
          if (temPendente) solicitacoes.push(s);
        } else if (podeAssinar()) {
          // Painel próprio: mostra docs pendentes para O usuário logado assinar
          const minhaAssinatura = (s.assinantes || []).find(
            a => a.email === usuarioAtual.email
          );
          if (minhaAssinatura?.status === 'pendente') solicitacoes.push(s);
        }
      });

    } else if (aba === 'minhas') {
      snap.forEach(d => {
        const s = { id: d.id, ...d.data() };
        const origemCorresponde = unids.includes(s.emailUnidadeOrigem);
        const criadoPorMim = !modoLeitura() && s.emailCriador === usuarioAtual.email;
        if (origemCorresponde || criadoPorMim) solicitacoes.push(s);
      });

    } else if (aba === 'historico') {
      snap.forEach(d => {
        const s = { id: d.id, ...d.data() };
        if (s.statusGeral === 'cancelado') return;
        const envolvido = (s.assinantes || []).some(a =>
          unids.includes(a.emailUnidade) ||
          (!modoLeitura() && a.email === usuarioAtual.email)
        );
        if (envolvido || unids.includes(s.emailUnidadeOrigem)) solicitacoes.push(s);
      });

    } else if (aba === 'cancelados') {
      snap.forEach(d => {
        const s = { id: d.id, ...d.data() };
        if (s.statusGeral !== 'cancelado') return;
        const envolvido = (s.assinantes || []).some(a =>
          unids.includes(a.emailUnidade) ||
          (!modoLeitura() && a.email === usuarioAtual.email)
        );
        if (envolvido || unids.includes(s.emailUnidadeOrigem)) solicitacoes.push(s);
      });
    }

    renderizarLista(corpo, solicitacoes, aba);

  } catch (e) {
    corpo.innerHTML = `<div class="p-erro-msg">Erro ao carregar: ${e.message}</div>`;
  }
};

// ══════════════════════════════════════════════
// SELEÇÃO EM MASSA
// ══════════════════════════════════════════════
let _selCtx  = null;   // 'sols' | 'acess'
let _selSols  = new Set();
let _selAcess = new Set();

function selLimpar() {
  _selSols.clear(); _selAcess.clear();
  document.querySelectorAll('.p-card-check, .p-sel-all-check').forEach(cb => { cb.checked = false; });
  document.querySelectorAll('.p-card.selecionado').forEach(c => c.classList.remove('selecionado'));
  _atualizarBarra();
}
window.selLimpar = selLimpar;

function _atualizarBarra() {
  const barra  = document.getElementById('p-barra-sel');
  const info   = document.getElementById('p-barra-sel-info');
  const acoes  = document.getElementById('p-barra-sel-acoes');
  if (!barra) return;

  const n = _selCtx === 'acess' ? _selAcess.size : _selSols.size;
  barra.classList.toggle('visivel', n > 0);
  if (!info || !acoes) return;
  info.textContent = n + ' selecionado' + (n !== 1 ? 's' : '');
  acoes.innerHTML = '';

  if (_selCtx === 'sols') {
    const ids = [..._selSols];
    /* Assinar em massa: só nas pendentes onde o usuário pode assinar */
    const podeFirmarAlgum = ids.some(id => {
      const s = _selSolsData.find(x => x.id === id);
      return s && podeAssinar() && (s.assinantes || []).find(a => a.email === usuarioAtual.email && a.status === 'pendente');
    });
    if (podeFirmarAlgum) acoes.insertAdjacentHTML('beforeend',
      `<button class="p-barra-btn p-barra-btn-ass" onclick="bulkAssinar()">✅ Assinar selecionados</button>`);
    /* Cancelar em massa */
    const podeCancelarAlgum = ids.some(id => {
      const s = _selSolsData.find(x => x.id === id); return s && podeCancelar(s);
    });
    if (podeCancelarAlgum) acoes.insertAdjacentHTML('beforeend',
      `<button class="p-barra-btn p-barra-btn-canc" onclick="bulkCancelar()">Cancelar selecionados</button>`);
    /* Excluir em massa: só CRV */
    if (perfilAtual === 'crv') acoes.insertAdjacentHTML('beforeend',
      `<button class="p-barra-btn p-barra-btn-exc" onclick="bulkExcluirSols()">Excluir selecionados</button>`);

  } else if (_selCtx === 'acess') {
    const ids = [..._selAcess];
    const temPend = ids.some(id => { const r = _selAcessData.find(x => x.id === id); return r?.status === 'pendente'; });
    const temAprov = ids.some(id => { const r = _selAcessData.find(x => x.id === id); return r?.status === 'aprovado'; });
    const temExcl  = ids.some(id => { const r = _selAcessData.find(x => x.id === id); return ['pendente','recusado'].includes(r?.status); });
    if (temPend)  acoes.insertAdjacentHTML('beforeend',
      `<button class="p-barra-btn p-barra-btn-apr" onclick="bulkAprovar()">✅ Aprovar selecionados</button>`);
    if (temPend)  acoes.insertAdjacentHTML('beforeend',
      `<button class="p-barra-btn p-barra-btn-neg" onclick="bulkRecusar()">Recusar selecionados</button>`);
    if (temAprov) acoes.insertAdjacentHTML('beforeend',
      `<button class="p-barra-btn p-barra-btn-neg" onclick="bulkRevogar()">Revogar selecionados</button>`);
    if (temExcl)  acoes.insertAdjacentHTML('beforeend',
      `<button class="p-barra-btn p-barra-btn-exc" onclick="bulkExcluirAcess()">Excluir selecionados</button>`);
  }
}

/* Referências aos dados ativos para checagem inline */
let _selSolsData  = [];
let _selAcessData = [];

window.selSolToggle = function(id) {
  _selCtx = 'sols';
  _selSols.has(id) ? _selSols.delete(id) : _selSols.add(id);
  const card = document.getElementById('pcard-' + id);
  if (card) card.classList.toggle('selecionado', _selSols.has(id));
  _atualizarSelAll('sol');
  _atualizarBarra();
};
window.selSolAll = function(cb) {
  _selCtx = 'sols';
  if (cb.checked) _selSolsData.forEach(s => _selSols.add(s.id));
  else _selSols.clear();
  document.querySelectorAll('.p-card-check[data-ctx=sol]').forEach(c => { c.checked = cb.checked; });
  document.querySelectorAll('.p-card[id^=pcard-]').forEach(c => c.classList.toggle('selecionado', cb.checked));
  _atualizarBarra();
};
window.selAccToggle = function(id) {
  _selCtx = 'acess';
  _selAcess.has(id) ? _selAcess.delete(id) : _selAcess.add(id);
  const card = document.getElementById('acard-' + id);
  if (card) card.classList.toggle('selecionado', _selAcess.has(id));
  _atualizarSelAll('acc');
  _atualizarBarra();
};
window.selAccAll = function(cb) {
  _selCtx = 'acess';
  if (cb.checked) _selAcessData.forEach(r => _selAcess.add(r.id));
  else _selAcess.clear();
  document.querySelectorAll('.p-card-check[data-ctx=acc]').forEach(c => { c.checked = cb.checked; });
  document.querySelectorAll('.p-card[id^=acard-]').forEach(c => c.classList.toggle('selecionado', cb.checked));
  _atualizarBarra();
};

function _atualizarSelAll(ctx) {
  const allCb = document.querySelector('.p-sel-all-check[data-ctx=' + ctx + ']');
  if (!allCb) return;
  const total = ctx === 'sol' ? _selSolsData.length : _selAcessData.length;
  const sel   = ctx === 'sol' ? _selSols.size : _selAcess.size;
  allCb.checked       = sel > 0 && sel === total;
  allCb.indeterminate = sel > 0 && sel < total;
}

// ── Ações em massa — Solicitações ──
window.bulkAssinar = async function() {
  const ids = [..._selSols].filter(id => {
    const s = _selSolsData.find(x => x.id === id);
    return s && podeAssinar() && (s.assinantes || []).find(a => a.email === usuarioAtual.email && a.status === 'pendente');
  });
  if (!ids.length) return;
  if (!confirm(`Assinar ${ids.length} documento(s) selecionado(s)?`)) return;
  let ok = 0, err = 0;
  for (const id of ids) {
    try {
      const ref  = doc(db, 'solicitacoes', id);
      const snap = await getDoc(ref);
      if (!snap.exists()) { err++; continue; }
      const assinantes = (snap.data().assinantes || []).map(a =>
        a.email === usuarioAtual.email ? { ...a, status: 'assinado', dataAcao: new Date().toISOString() } : a
      );
      await updateDoc(ref, { assinantes, atualizadoEm: serverTimestamp() });
      ok++;
    } catch { err++; }
  }
  selLimpar();
  showToastPainel(`${ok} documento(s) assinado(s)${err ? ` · ${err} erro(s)` : ''}.`);
  const abaAtiva = _ehNavCartoes() ? _abaAtiva : document.querySelector('.p-aba-btn.ativa')?.dataset.aba;
  if (abaAtiva) carregarAba(abaAtiva);
};

window.bulkCancelar = function() {
  const ids = [..._selSols].filter(id => { const s = _selSolsData.find(x => x.id === id); return s && podeCancelar(s); });
  if (!ids.length) return;
  if (!confirm(`Cancelar ${ids.length} solicitação(ões)? Esta ação é definitiva.`)) return;
  const motivo = prompt('Justificativa do cancelamento (obrigatório):');
  if (!motivo?.trim()) { showToastPainel('Justificativa obrigatória.'); return; }
  _bulkCancelarExec(ids, motivo.trim());
};
async function _bulkCancelarExec(ids, motivo) {
  let ok = 0, err = 0;
  for (const id of ids) {
    try {
      const ref  = doc(db, 'solicitacoes', id);
      const snap = await getDoc(ref);
      if (!snap.exists()) { err++; continue; }
      const assinantes = (snap.data().assinantes || []).map(a =>
        a.status === 'pendente' ? { ...a, status: 'cancelado', dataAcao: new Date().toISOString() } : a
      );
      await updateDoc(ref, {
        assinantes, statusGeral: 'cancelado',
        cancelamento: { por: usuarioAtual.email, nome: nomeExibidoAtual(), perfil: _labelPerfil[perfilAtual] || perfilAtual, motivo, em: new Date().toISOString() },
        atualizadoEm: serverTimestamp(),
      });
      ok++;
    } catch { err++; }
  }
  selLimpar();
  showToastPainel(`${ok} solicitação(ões) cancelada(s)${err ? ` · ${err} erro(s)` : ''}.`);
  carregarAba('cancelados');
}

window.bulkExcluirSols = async function() {
  if (!confirm(`Excluir permanentemente ${_selSols.size} documento(s)? Ação irreversível.`)) return;
  const ids = [..._selSols];
  let ok = 0, err = 0;
  for (const id of ids) {
    try { await deleteDoc(doc(db, 'solicitacoes', id)); ok++; } catch { err++; }
  }
  selLimpar();
  showToastPainel(`${ok} documento(s) excluído(s)${err ? ` · ${err} erro(s)` : ''}.`);
  const abaAtiva = _ehNavCartoes() ? _abaAtiva : document.querySelector('.p-aba-btn.ativa')?.dataset.aba;
  if (abaAtiva) carregarAba(abaAtiva); else mostrarDashboard();
};

// ── Ações em massa — Acessos ──
window.bulkAprovar = async function() {
  const ids = [..._selAcess].filter(id => _selAcessData.find(x => x.id === id)?.status === 'pendente');
  if (!ids.length) return;
  if (!confirm(`Aprovar ${ids.length} cadastro(s)?`)) return;
  let ok = 0, err = 0;
  for (const id of ids) {
    try {
      await updateDoc(doc(db, 'usuarios_cadastrados', id), { status: 'aprovado', aprovadoPor: usuarioAtual.email, aprovadoEm: serverTimestamp(), motivoRecusa: null });
      ok++;
    } catch { err++; }
  }
  selLimpar(); showToastPainel(`${ok} acesso(s) aprovado(s)${err ? ` · ${err} erro(s)` : ''}.`); carregarAba('acessos');
};

window.bulkRecusar = function() {
  const ids = [..._selAcess].filter(id => _selAcessData.find(x => x.id === id)?.status === 'pendente');
  if (!ids.length) return;
  const motivo = prompt(`Recusar ${ids.length} cadastro(s). Motivo (opcional):`);
  if (motivo === null) return;
  _bulkRecusarExec(ids, motivo.trim() || 'Não especificado');
};
async function _bulkRecusarExec(ids, motivo) {
  let ok = 0, err = 0;
  for (const id of ids) {
    try {
      await updateDoc(doc(db, 'usuarios_cadastrados', id), { status: 'recusado', aprovadoPor: usuarioAtual.email, aprovadoEm: serverTimestamp(), motivoRecusa: motivo });
      ok++;
    } catch { err++; }
  }
  selLimpar(); showToastPainel(`${ok} cadastro(s) recusado(s)${err ? ` · ${err} erro(s)` : ''}.`); carregarAba('acessos');
}

window.bulkRevogar = async function() {
  const ids = [..._selAcess].filter(id => _selAcessData.find(x => x.id === id)?.status === 'aprovado');
  if (!ids.length) return;
  if (!confirm(`Revogar ${ids.length} acesso(s)?`)) return;
  let ok = 0, err = 0;
  for (const id of ids) {
    try {
      await updateDoc(doc(db, 'usuarios_cadastrados', id), { status: 'revogado', aprovadoPor: usuarioAtual.email, aprovadoEm: serverTimestamp() });
      ok++;
    } catch { err++; }
  }
  selLimpar(); showToastPainel(`${ok} acesso(s) revogado(s)${err ? ` · ${err} erro(s)` : ''}.`); carregarAba('acessos');
};

window.bulkExcluirAcess = async function() {
  const ids = [..._selAcess].filter(id => ['pendente','recusado'].includes(_selAcessData.find(x => x.id === id)?.status));
  if (!ids.length) return;
  if (!confirm(`Excluir permanentemente ${ids.length} cadastro(s)?`)) return;
  let ok = 0, err = 0;
  for (const id of ids) {
    try { await deleteDoc(doc(db, 'usuarios_cadastrados', id)); ok++; } catch { err++; }
  }
  selLimpar(); showToastPainel(`${ok} cadastro(s) excluído(s)${err ? ` · ${err} erro(s)` : ''}.`); carregarAba('acessos');
};

// ── RENDERIZA LISTA ──
function renderizarLista(el, lista, tipo) {
  _selSols.clear();
  _selSolsData = lista;
  _selCtx = 'sols';

  const msgs = {
    pendentes:  'Nenhuma assinatura pendente.',
    minhas:     'Nenhuma solicitação encontrada.',
    historico:  'Nenhum registro no histórico.',
    cancelados: 'Nenhuma solicitação cancelada.',
  };
  if (!lista.length) {
    el.innerHTML = `<div class="p-vazio">${msgs[tipo] || 'Nenhum registro.'}</div>`;
    _atualizarBarra();
    return;
  }

  const cabSel = `<div class="p-sel-header">
    <label><input type="checkbox" class="p-sel-all-check" data-ctx="sol" onchange="selSolAll(this)"> Selecionar todos (${lista.length})</label>
  </div>`;

  el.innerHTML = cabSel + lista.map(s => {
    const data        = s.criadoEm?.toDate ? s.criadoEm.toDate().toLocaleDateString('pt-BR') : '—';
    const statusGeral = calcularStatusGeral(s.assinantes || [], s.statusGeral);
    const minhaAssin  = (s.assinantes || []).find(a => a.email === usuarioAtual.email);
    const podeFirmar  = podeAssinar() && minhaAssin?.status === 'pendente';
    const cancelInfo  = s.statusGeral === 'cancelado' && s.cancelamento;
    const cancelDt    = cancelInfo
      ? new Date(s.cancelamento.em).toLocaleDateString('pt-BR') + ' às ' +
        new Date(s.cancelamento.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : '';

    return `
    <div class="p-card p-card-compact" id="pcard-${s.id}">
      <div class="p-card-row" onclick="pCardToggle('${s.id}')">
        <input type="checkbox" class="p-card-check" data-ctx="sol" onchange="selSolToggle('${s.id}')" onclick="event.stopPropagation()" title="Selecionar">
        <span class="p-status p-status-${statusGeral.classe}" style="flex-shrink:0;">${statusGeral.label}</span>
        <span class="p-card-titulo-row">${escHtml(s.titulo || 'Ofício s/ título')}</span>
        <span class="p-card-meta-row">${escHtml(s.nomeUnidadeOrigem || s.emailUnidadeOrigem || '—')} · ${data}</span>
        <span class="p-card-arrow" id="parrow-${s.id}">▶</span>
      </div>
      <div class="p-card-body" id="pcbody-${s.id}" style="display:none;">
        ${s.presos && s.presos.length ? `
        <div class="p-card-presos">
          ${s.presos.map(p => `<span class="p-preso-tag">👤 ${escHtml(p.nome || '—')} · IPEN ${escHtml(p.ipen || '—')}</span>`).join('')}
        </div>` : ''}
        ${s.resumo ? `
        <div style="margin:0 0 10px;padding:8px 12px;background:var(--surface-2);border-left:3px solid var(--azul-400);border-radius:0 6px 6px 0;font-size:.75rem;color:var(--txt-2);line-height:1.6;">
          <span style="display:block;font-size:.65rem;font-weight:700;color:var(--azul-600);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Resumo Sintético</span>
          ${escHtml(s.resumo)}
        </div>` : ''}
        <div class="p-assinantes">
          ${(s.assinantes || []).map(a => `
            <div class="p-assinante">
              <span class="p-assinante-status">${
                a.status === 'assinado'  ? '✅' :
                a.status === 'negado'    ? '❌' :
                a.status === 'cancelado' ? '🚫' : '⏳'
              }</span>
              <span class="p-assinante-nome">${escHtml(a.nome || a.email)}</span>
              ${a.status === 'negado' && a.motivo ? `<span class="p-assinante-motivo">— ${escHtml(a.motivo)}</span>` : ''}
              ${a.dataAcao ? `<span class="p-assinante-data">${new Date(a.dataAcao).toLocaleDateString('pt-BR')}</span>` : ''}
            </div>`).join('')}
        </div>
        ${cancelInfo ? `
        <div class="p-cancel-info">
          <strong>Cancelado por:</strong> ${escHtml(s.cancelamento.nome)} (${escHtml(s.cancelamento.perfil)})
          &nbsp;·&nbsp; <strong>Em:</strong> ${cancelDt}<br>
          <strong>Justificativa:</strong> ${escHtml(s.cancelamento.motivo)}
        </div>` : ''}
        <div class="p-card-acoes">
          <button class="p-btn p-btn-outline" onclick="verDetalheOficio('${s.id}')">Ver documento</button>
          <button class="p-btn" style="background:var(--azul-600);color:#fff;" onclick="gerarPDFValidado('${s.id}')">
            ${statusGeral.classe === 'concluido' ? 'Baixar PDF validado' : 'Baixar PDF'}
          </button>
          <button class="p-btn p-btn-outline" onclick="verResumoOficio('${s.id}')">📄 Resumo IPEN</button>
          ${podeFirmar ? `
            <button class="p-btn p-btn-assinar" onclick="assinarOficio('${s.id}')">Assinar</button>
            <button class="p-btn p-btn-negar"   onclick="abrirModalNegar('${s.id}')">Negar</button>
          ` : ''}
          ${podeCancelar(s) ? `
            <button class="p-btn p-btn-cancelar" onclick="abrirModalCancelar('${s.id}')">Cancelar</button>
          ` : ''}
          ${perfilAtual === 'crv' ? `
            <button class="p-btn p-btn-cancelar" style="background:#7f1d1d;border-color:#7f1d1d;color:#fff;" onclick="excluirOficio('${s.id}')">Excluir</button>
          ` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
  _atualizarBarra();
}

window.pCardToggle = function(id) {
  const body  = document.getElementById('pcbody-' + id);
  const arrow = document.getElementById('parrow-' + id);
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (arrow) arrow.textContent = open ? '▶' : '▼';
};
window.pAccToggle = function(id) {
  const body  = document.getElementById('acbody-' + id);
  const arrow = document.getElementById('aarrow-' + id);
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (arrow) arrow.textContent = open ? '▶' : '▼';
};

function calcularStatusGeral(assinantes, statusDoc) {
  if (statusDoc === 'cancelado')                       return { label: 'Cancelado',    classe: 'cancelado' };
  if (!assinantes.length)                              return { label: 'Aguardando',   classe: 'pendente' };
  if (assinantes.every(a => a.status === 'assinado'))  return { label: 'Concluído',    classe: 'concluido' };
  if (assinantes.some(a => a.status === 'negado'))     return { label: 'Com negativa', classe: 'negado' };
  return { label: 'Em andamento', classe: 'andamento' };
}

// ── ASSINAR ──
window.assinarOficio = async function (id) {
  /* Carrega o doc para exibir resumo na confirmação */
  try {
    const ref  = doc(db, 'solicitacoes', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const s = snap.data();

    /* Monta corpo do modal de confirmação */
    const modalConf = document.getElementById('p-modal-confirmar-ass');
    const confCorpo = document.getElementById('p-conf-ass-corpo');
    const confId    = document.getElementById('p-conf-ass-id');
    if (!modalConf || !confCorpo || !confId) {
      /* fallback sem modal */
      await _executarAssinatura(ref, snap);
      return;
    }

    confId.value = id;
    confCorpo.innerHTML = `
      <p style="font-size:.88rem;font-weight:600;color:var(--txt-1);margin:0 0 10px;">${escHtml(s.titulo || 'Ofício s/ título')}</p>
      ${s.presos && s.presos.length ? `
        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;">
          ${s.presos.map(p => `<span class="p-preso-tag">👤 ${escHtml(p.nome || '—')} · IPEN ${escHtml(p.ipen || '—')}</span>`).join('')}
        </div>` : ''}
      ${s.resumo ? `
        <div style="background:#eff6ff;border-left:3px solid var(--azul-400);padding:10px 14px;border-radius:0 6px 6px 0;margin-bottom:12px;">
          <div style="font-size:.62rem;font-weight:700;color:var(--azul-600);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;">Resumo Sintético — Cadastro IPEN</div>
          <p style="font-size:.84rem;color:#1e3a8a;line-height:1.65;margin:0;">${escHtml(s.resumo)}</p>
        </div>` : ''}
      <p style="font-size:.82rem;color:var(--txt-3);margin:0;">Confirma sua anuência ao presente expediente?</p>`;

    modalConf.style.display = 'flex';
  } catch (e) {
    showToastPainel('Erro ao carregar documento: ' + e.message);
  }
};

async function _executarAssinatura(ref, snap) {
  const assinantes = (snap.data().assinantes || []).map(a =>
    a.email === usuarioAtual.email
      ? { ...a, status: 'assinado', dataAcao: new Date().toISOString() }
      : a
  );
  await updateDoc(ref, { assinantes, atualizadoEm: serverTimestamp() });
  showToastPainel('Documento assinado com sucesso.');
  carregarAba('pendentes');
}

window.confirmarAssinatura = async function () {
  const id = document.getElementById('p-conf-ass-id').value;
  fecharModalConfirmarAss();
  try {
    const ref  = doc(db, 'solicitacoes', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    await _executarAssinatura(ref, snap);
  } catch (e) {
    showToastPainel('Erro ao assinar: ' + e.message);
  }
};

window.fecharModalConfirmarAss = function () {
  const m = document.getElementById('p-modal-confirmar-ass');
  if (m) m.style.display = 'none';
};

// ── NEGAR ──
window.abrirModalNegar = function (id) {
  document.getElementById('p-modal-negar').style.display = 'flex';
  document.getElementById('p-negar-id').value = id;
  document.getElementById('p-motivo').value = '';
};
window.fecharModalNegar = function () {
  document.getElementById('p-modal-negar').style.display = 'none';
};
window.confirmarNegar = async function () {
  const id     = document.getElementById('p-negar-id').value;
  const motivo = document.getElementById('p-motivo').value.trim();
  const erroEl = document.getElementById('p-negar-erro');
  if (!motivo) {
    erroEl.textContent = 'A justificativa é obrigatória para negar a anuência.';
    erroEl.style.display = 'block';
    return;
  }
  erroEl.style.display = 'none';
  try {
    const ref  = doc(db, 'solicitacoes', id);
    const snap = await getDoc(ref);
    const assinantes = (snap.data().assinantes || []).map(a =>
      a.email === usuarioAtual.email
        ? { ...a, status: 'negado', motivo, dataAcao: new Date().toISOString() }
        : a
    );
    await updateDoc(ref, { assinantes, atualizadoEm: serverTimestamp() });
    fecharModalNegar();
    showToastPainel('Negativa registrada.');
    carregarAba('pendentes');
  } catch (e) {
    showToastPainel('Erro: ' + e.message);
  }
};

// ── CANCELAR SOLICITAÇÃO ──
const _labelPerfil = { crv: 'CRV', dir: 'Diretor(a)', super: 'Superintendente', cpen: 'Coord. Penal', servidor: 'Servidor' };

window.abrirModalCancelar = function (id) {
  document.getElementById('p-modal-cancelar').style.display = 'flex';
  document.getElementById('p-cancelar-id').value = id;
  document.getElementById('p-motivo-cancelar').value = '';
  document.getElementById('p-cancelar-erro').style.display = 'none';
};
window.fecharModalCancelar = function () {
  document.getElementById('p-modal-cancelar').style.display = 'none';
};
window.confirmarCancelar = async function () {
  const id     = document.getElementById('p-cancelar-id').value;
  const motivo = document.getElementById('p-motivo-cancelar').value.trim();
  const erroEl = document.getElementById('p-cancelar-erro');
  if (!motivo) {
    erroEl.textContent = 'A justificativa é obrigatória para cancelar a solicitação.';
    erroEl.style.display = 'block';
    return;
  }
  erroEl.style.display = 'none';
  try {
    const ref  = doc(db, 'solicitacoes', id);
    const snap = await getDoc(ref);
    const assinantes = (snap.data().assinantes || []).map(a =>
      a.status === 'pendente'
        ? { ...a, status: 'cancelado', dataAcao: new Date().toISOString() }
        : a
    );
    await updateDoc(ref, {
      assinantes,
      statusGeral: 'cancelado',
      cancelamento: {
        por:    usuarioAtual.email,
        nome:   nomeExibidoAtual(),
        perfil: _labelPerfil[perfilAtual] || perfilAtual,
        motivo,
        em:     new Date().toISOString()
      },
      atualizadoEm: serverTimestamp()
    });
    fecharModalCancelar();
    showToastPainel('Solicitação cancelada.');
    carregarAba('cancelados');
  } catch (e) {
    showToastPainel('Erro ao cancelar: ' + e.message);
  }
};

// ── EXCLUIR (somente CRV) ──
window.excluirOficio = async function (id) {
  if (!confirm('Excluir permanentemente este documento? Esta ação não pode ser desfeita.')) return;
  try {
    await deleteDoc(doc(db, 'solicitacoes', id));
    showToastPainel('Documento excluído.');
    const abaAtiva = _ehNavCartoes() ? _abaAtiva : document.querySelector('.p-aba-btn.ativa')?.dataset.aba;
    if (abaAtiva) carregarAba(abaAtiva);
    else mostrarDashboard();
  } catch (e) {
    showToastPainel('Erro ao excluir: ' + e.message);
  }
};

// ══════════════════════════════════════════════
// DASHBOARD — CRV (estadual) e SR (regional)
// ══════════════════════════════════════════════

let _dashDocs   = [];
let _dashFiltro = { sr: '', un: '', cat: '' };

function getCategoria(s) {
  if (s.statusGeral === 'cancelado') return 'cancelado';
  const ass = s.assinantes || [];
  if (ass.length > 0 && ass.every(a => a.status === 'assinado')) return 'assinado';
  return 'andamento';
}

function contarCats(lista) {
  return {
    andamento: lista.filter(d => d._cat === 'andamento').length,
    assinado:  lista.filter(d => d._cat === 'assinado').length,
    cancelado: lista.filter(d => d._cat === 'cancelado').length,
  };
}

async function mostrarDashboard() {
  document.querySelector('.p-abas').style.display = 'none';
  const corpo = document.getElementById('p-corpo');
  corpo.className = 'dashboard-mode';

  // CRV sem SR selecionada: tela de navegação
  if (perfilAtual === 'crv' && !srSelecionada) {
    corpo.innerHTML = `
      <div class="p-empty-nav">
        <img src="img/brasao.png" alt="" class="p-empty-brasao">
        <p class="p-empty-titulo">Painel da Unidade Prisional</p>
        <p class="p-empty-sub">Selecione uma Superintendência Regional ou unidade prisional no menu acima.</p>
      </div>`;
    return;
  }

  // CRV com SR selecionada OU perfil super: painel de números da circunscrição
  corpo.innerHTML = '<div class="p-loading" style="padding:32px;">Carregando painel…</div>';
  _dashFiltro = { sr: '', un: '', cat: '' };
  try {
    const snap = await getDocs(query(collection(db, 'solicitacoes'), orderBy('criadoEm', 'desc')));
    _dashDocs = [];
    snap.forEach(d => {
      const s = { id: d.id, ...d.data() };
      s._cat = getCategoria(s);
      _dashDocs.push(s);
    });
    _renderDashSR(corpo);
  } catch (e) {
    corpo.innerHTML = `<div style="padding:32px;color:var(--vermelho);">Erro ao carregar: ${escHtml(e.message)}</div>`;
  }
}

// ── helpers de renderização ──
function _numBtn(n, emailsArr, cat) {
  if (n === 0) return `<div class="p-dash-col p-dash-col--num"><span class="p-dash-zero">—</span></div>`;
  const enc = encodeURIComponent(JSON.stringify(emailsArr));
  return `<div class="p-dash-col p-dash-col--num">
    <button class="p-dash-num p-dash-num--${cat}" onclick="abrirListaDash('${enc}','${cat}')">${n}</button>
  </div>`;
}
function _summaryCard(cat, n, label, emailsArr) {
  const enc = encodeURIComponent(JSON.stringify(emailsArr));
  return `<button class="p-dash-card p-dash-card--${cat}" onclick="abrirListaDash('${enc}','${cat}')">
    <span class="p-dash-card-num">${n}</span>
    <span class="p-dash-card-lbl">${label}</span>
  </button>`;
}
function _dashFiltrosHtml(opsSR, opsUN) {
  return `<div class="p-dash-filtros">
    ${opsSR ? `<select id="p-dash-sel-sr" class="p-dash-sel" onchange="onDashSR()">
      <option value="">Todas as regionais</option>${opsSR}</select>` : ''}
    <select id="p-dash-sel-un" class="p-dash-sel" onchange="onDashUN()">
      <option value="">${opsSR ? 'Todas as unidades' : 'Todas as unidades da circunscrição'}</option>${opsUN}
    </select>
    <div class="p-dash-cat-btns">
      <button class="p-dash-cat-btn" data-cat="andamento" onclick="onDashCat('andamento')">Em andamento</button>
      <button class="p-dash-cat-btn" data-cat="assinado"  onclick="onDashCat('assinado')">Assinados</button>
      <button class="p-dash-cat-btn" data-cat="cancelado" onclick="onDashCat('cancelado')">Cancelados</button>
    </div>
    <button class="p-dash-limpar" onclick="limparDash()">Limpar</button>
  </div>`;
}

// ── CRV — visão estadual ──
function _renderDashCRV(el) {
  const allEmails = UNIDADES.map(u => u.email);
  const tot = contarCats(_dashDocs.filter(d => allEmails.includes(d.emailUnidadeOrigem)));
  const srs = [...new Set(UNIDADES.map(u => u.sr))].sort();

  const srRows = srs.map(cod => {
    const info  = SR_INFO[cod] || {};
    const uns   = UNIDADES.filter(u => u.sr === cod);
    const emUns = uns.map(u => u.email);
    const sc    = contarCats(_dashDocs.filter(d => emUns.includes(d.emailUnidadeOrigem)));

    const unRows = uns.map(u => {
      const uc = contarCats(_dashDocs.filter(d => d.emailUnidadeOrigem === u.email));
      return `<div class="p-dash-row p-dash-row--unidade">
        <div class="p-dash-col p-dash-col--nome p-dash-indent">${escHtml(u.nome)}</div>
        ${_numBtn(uc.andamento, [u.email], 'andamento')}
        ${_numBtn(uc.assinado,  [u.email], 'assinado')}
        ${_numBtn(uc.cancelado, [u.email], 'cancelado')}
      </div>`;
    }).join('');

    return `
      <div class="p-dash-row p-dash-row--sr" onclick="toggleDashSR('${cod}')">
        <div class="p-dash-col p-dash-col--nome">
          <span id="p-dash-arrow-${cod}" class="p-dash-arrow">▶</span>
          ${escHtml(cod)} — ${escHtml(info.nome || cod)}
        </div>
        ${_numBtn(sc.andamento, emUns, 'andamento')}
        ${_numBtn(sc.assinado,  emUns, 'assinado')}
        ${_numBtn(sc.cancelado, emUns, 'cancelado')}
      </div>
      <div id="p-dash-sr-${cod}" style="display:none;">${unRows}</div>`;
  }).join('');

  const opsSR = srs.map(c =>
    `<option value="${c}">${c} — ${escHtml(SR_INFO[c]?.nome || c)}</option>`).join('');
  const opsUN = UNIDADES.map(u =>
    `<option value="${u.email}">${escHtml(u.nome)}</option>`).join('');

  el.innerHTML = `<div class="p-dashboard">
    <div class="p-dash-summary">
      <div class="p-dash-summary-label">Estado de Santa Catarina — visão geral</div>
      <div class="p-dash-summary-cards">
        ${_summaryCard('andamento', tot.andamento, 'Em andamento', allEmails)}
        ${_summaryCard('assinado',  tot.assinado,  'Assinados',    allEmails)}
        ${_summaryCard('cancelado', tot.cancelado, 'Cancelados',   allEmails)}
      </div>
    </div>
    ${_dashFiltrosHtml(opsSR, opsUN)}
    <div class="p-dash-table" style="margin:16px 32px 0;">
      <div class="p-dash-row p-dash-row--header">
        <div class="p-dash-col p-dash-col--nome">Regional / Unidade</div>
        <div class="p-dash-col p-dash-col--num">Em andamento</div>
        <div class="p-dash-col p-dash-col--num">Assinados</div>
        <div class="p-dash-col p-dash-col--num">Cancelados</div>
      </div>
      ${srRows}
    </div>
    <div class="p-dash-lista-wrap"><div id="p-dash-lista"></div></div>
  </div>`;
}

// ── SR — visão regional (também usada por CRV com srSelecionada) ──
function _renderDashSR(el) {
  const srCod = srSelecionada || escopoAtual.codigo;
  const info  = SR_INFO[srCod] || {};
  const uns   = UNIDADES.filter(u => u.sr === srCod);
  const emUns = uns.map(u => u.email);
  const tot   = contarCats(_dashDocs.filter(d => emUns.includes(d.emailUnidadeOrigem)));

  const unRows = uns.map(u => {
    const uc = contarCats(_dashDocs.filter(d => d.emailUnidadeOrigem === u.email));
    return `<div class="p-dash-row p-dash-row--unidade">
      <div class="p-dash-col p-dash-col--nome">${escHtml(u.nome)}</div>
      ${_numBtn(uc.andamento, [u.email], 'andamento')}
      ${_numBtn(uc.assinado,  [u.email], 'assinado')}
      ${_numBtn(uc.cancelado, [u.email], 'cancelado')}
    </div>`;
  }).join('');

  const opsUN = uns.map(u =>
    `<option value="${u.email}">${escHtml(u.nome)}</option>`).join('');

  el.innerHTML = `<div class="p-dashboard">
    <div class="p-dash-summary">
      <div class="p-dash-summary-label">${escHtml(srCod)} — ${escHtml(info.nome || srCod)}</div>
      <div class="p-dash-summary-cards">
        ${_summaryCard('andamento', tot.andamento, 'Em andamento', emUns)}
        ${_summaryCard('assinado',  tot.assinado,  'Assinados',    emUns)}
        ${_summaryCard('cancelado', tot.cancelado, 'Cancelados',   emUns)}
      </div>
    </div>
    ${_dashFiltrosHtml('', opsUN)}
    <div class="p-dash-table" style="margin:16px 32px 0;">
      <div class="p-dash-row p-dash-row--header">
        <div class="p-dash-col p-dash-col--nome">Unidade Prisional</div>
        <div class="p-dash-col p-dash-col--num">Em andamento</div>
        <div class="p-dash-col p-dash-col--num">Assinados</div>
        <div class="p-dash-col p-dash-col--num">Cancelados</div>
      </div>
      ${unRows}
    </div>
    <div class="p-dash-lista-wrap"><div id="p-dash-lista"></div></div>
  </div>`;
}

// ── interações do dashboard ──
window.toggleDashSR = function (cod) {
  const el = document.getElementById('p-dash-sr-' + cod);
  const ar = document.getElementById('p-dash-arrow-' + cod);
  if (!el) return;
  const open = el.style.display !== 'none';
  el.style.display = open ? 'none' : '';
  if (ar) ar.textContent = open ? '▶' : '▼';
};

window.abrirListaDash = function (enc, cat) {
  const emails = JSON.parse(decodeURIComponent(enc));
  _dashFiltro.cat = cat;
  document.querySelectorAll('.p-dash-cat-btn').forEach(b =>
    b.classList.toggle('ativa', b.dataset.cat === cat));
  _renderListaDash(emails, cat);
};

window.onDashSR  = function () { _dashFiltro.sr = document.getElementById('p-dash-sel-sr')?.value || ''; _aplicarDash(); };
window.onDashUN  = function () { _dashFiltro.un = document.getElementById('p-dash-sel-un')?.value || ''; _aplicarDash(); };
window.onDashCat = function (cat) {
  _dashFiltro.cat = _dashFiltro.cat === cat ? '' : cat;
  document.querySelectorAll('.p-dash-cat-btn').forEach(b =>
    b.classList.toggle('ativa', b.dataset.cat === _dashFiltro.cat));
  _aplicarDash();
};
window.limparDash = function () {
  _dashFiltro = { sr: '', un: '', cat: '' };
  const sr = document.getElementById('p-dash-sel-sr');
  const un = document.getElementById('p-dash-sel-un');
  if (sr) sr.value = '';
  if (un) un.value = '';
  document.querySelectorAll('.p-dash-cat-btn').forEach(b => b.classList.remove('ativa'));
  const listaEl = document.getElementById('p-dash-lista');
  if (listaEl) listaEl.innerHTML = '';
};

function _emailsFiltro() {
  if (_dashFiltro.un) return [_dashFiltro.un];
  if (_dashFiltro.sr) return UNIDADES.filter(u => u.sr === _dashFiltro.sr).map(u => u.email);
  if (srSelecionada)  return UNIDADES.filter(u => u.sr === srSelecionada).map(u => u.email);
  return perfilAtual === 'crv'
    ? UNIDADES.map(u => u.email)
    : UNIDADES.filter(u => u.sr === escopoAtual.codigo).map(u => u.email);
}

function _aplicarDash() {
  const listaEl = document.getElementById('p-dash-lista');
  if (!_dashFiltro.cat) { if (listaEl) listaEl.innerHTML = ''; return; }
  _renderListaDash(_emailsFiltro(), _dashFiltro.cat);
}

function _renderListaDash(emails, cat) {
  const lista   = _dashDocs.filter(d => emails.includes(d.emailUnidadeOrigem) && d._cat === cat);
  const listaEl = document.getElementById('p-dash-lista');
  if (!listaEl) return;
  const lbl = { andamento: 'Em andamento', assinado: 'Assinados', cancelado: 'Cancelados' }[cat] || cat;
  listaEl.innerHTML = `<div class="p-dash-lista-header">${lbl} — ${lista.length} documento(s)</div>
    <div id="p-dash-lista-items"></div>`;
  renderizarLista(document.getElementById('p-dash-lista-items'), lista, cat);
  listaEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── VER DETALHE ──
window.verDetalheOficio = async function (id) {
  const ref  = doc(db, 'solicitacoes', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const s  = snap.data();
  const el = document.getElementById('p-detalhe-corpo');
  if (!el) return;

  const data = s.criadoEm?.toDate
    ? s.criadoEm.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';

  /* Base URL para carregar brasao.png e oficio.css do gerador */
  const geradorBase = window.location.href.replace(/\/[^/]*(\?.*)?$/, '/') + 'gerador-oficios-v2/';

  const assinantesHtml = (s.assinantes || []).map(a => {
    const icone = a.status === 'assinado' ? '✅' : a.status === 'negado' ? '❌' : a.status === 'cancelado' ? '🚫' : '⏳';
    const dtStr = a.dataAcao ? new Date(a.dataAcao).toLocaleDateString('pt-BR') + ' às ' + new Date(a.dataAcao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;
    return `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 10px;background:var(--bg);border-radius:6px;">
        <span style="font-size:1rem;flex-shrink:0;margin-top:1px;">${icone}</span>
        <div style="flex:1;">
          <div style="font-size:.84rem;font-weight:600;color:var(--txt-1);">${escHtml(a.nome || a.email)}</div>
          ${a.cargo ? `<div style="font-size:.72rem;color:var(--txt-3);">${escHtml(a.cargo)}</div>` : ''}
          ${a.motivo ? `<div style="font-size:.75rem;color:var(--vermelho);margin-top:2px;">Negativa: ${escHtml(a.motivo)}</div>` : ''}
          ${dtStr ? `<div style="font-size:.7rem;color:var(--txt-4);margin-top:2px;">${dtStr}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  const cancelHtml = s.statusGeral === 'cancelado' && s.cancelamento ? (() => {
    const dt = new Date(s.cancelamento.em).toLocaleDateString('pt-BR') + ' às ' +
               new Date(s.cancelamento.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `<div style="background:#fff5f5;border-left:3px solid #b91c1c;padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:14px;">
      <div style="font-size:.65rem;font-weight:700;color:#b91c1c;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Solicitação Cancelada</div>
      <p style="font-size:.84rem;color:#334155;margin:0 0 4px;"><strong>Cancelado por:</strong> ${escHtml(s.cancelamento.nome)} (${escHtml(s.cancelamento.perfil)}) &nbsp;·&nbsp; <strong>Em:</strong> ${dt}</p>
      <p style="font-size:.84rem;color:#334155;margin:0;"><strong>Justificativa:</strong> ${escHtml(s.cancelamento.motivo)}</p>
    </div>`;
  })() : '';

  el.innerHTML = `
    <div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:16px;">
      <iframe id="p-oficio-iframe" style="width:100%;border:none;min-height:500px;display:block;"></iframe>
    </div>
    ${cancelHtml}
    <div style="border-top:1px solid var(--border);padding-top:14px;">
      <p style="font-size:.68rem;font-weight:700;color:var(--txt-2);text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px 0;">Registro de Assinaturas</p>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${assinantesHtml || '<p style="font-size:.84rem;color:var(--txt-4);margin:0;">Nenhum assinante registrado.</p>'}
      </div>
    </div>`;

  document.getElementById('p-modal-detalhe').style.display = 'flex';

  /* Renderiza o HTML do ofício dentro do iframe com o CSS do gerador */
  const iframe = document.getElementById('p-oficio-iframe');
  const iDoc   = iframe.contentDocument || iframe.contentWindow.document;
  iDoc.open();
  iDoc.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <base href="${geradorBase}">
    <link rel="stylesheet" href="css/oficio.css">
    <style>
      body { margin: 0; padding: 0; background: #fff; }
      #oficio { box-shadow: none !important; border: none !important; min-height: auto !important; margin: 0; }
    </style>
  </head><body>${s.conteudo || '<p style="font-size:.875rem;color:#aaa;padding:20px;">Conteúdo não disponível.</p>'}</body></html>`);
  iDoc.close();

  iframe.onload = function () {
    try {
      const h = iframe.contentWindow.document.documentElement.scrollHeight;
      if (h > 100) iframe.style.height = h + 20 + 'px';
    } catch (_) {}
  };

  /* fallback: se o onload não disparar (cache), auto-ajusta após delay */
  setTimeout(function () {
    try {
      const h = iframe.contentWindow.document.documentElement.scrollHeight;
      if (h > 100) iframe.style.height = h + 20 + 'px';
    } catch (_) {}
  }, 600);

};
window.fecharDetalheOficio = function () {
  document.getElementById('p-modal-detalhe').style.display = 'none';
};

// ── RESUMO SINTÉTICO ──
window.verResumoOficio = async function (id) {
  const snap = await getDoc(doc(db, 'solicitacoes', id));
  if (!snap.exists()) return;
  const s = snap.data();
  const el = document.getElementById('p-resumo-corpo');
  el.innerHTML = s.resumo
    ? `<div style="background:#eff6ff;border-left:3px solid var(--azul-400);padding:14px 18px;border-radius:0 6px 6px 0;">
        <div style="font-size:.65rem;font-weight:700;color:var(--azul-600);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Resumo Sintético — Cadastro IPEN</div>
        <p style="font-size:.9rem;color:#1e3a8a;line-height:1.7;margin:0;">${escHtml(s.resumo)}</p>
       </div>`
    : '<p style="font-size:.84rem;color:var(--txt-4);font-style:italic;margin:0;">Resumo não disponível.</p>';
  document.getElementById('p-modal-resumo').style.display = 'flex';
};
window.fecharResumoOficio = function () {
  document.getElementById('p-modal-resumo').style.display = 'none';
  /* Sai do modo edição ao fechar */
  const p = document.querySelector('#p-resumo-corpo p[contenteditable]');
  if (p) p.removeAttribute('contenteditable');
  const btn = document.getElementById('btn-resumo-editar');
  if (btn) btn.textContent = '✏ Editar';
};

window.toggleEditarResumo = function () {
  const p = document.querySelector('#p-resumo-corpo p');
  const btn = document.getElementById('btn-resumo-editar');
  if (!p || !btn) return;
  if (p.contentEditable === 'true') {
    p.removeAttribute('contenteditable');
    p.style.outline = '';
    btn.textContent = '✏ Editar';
  } else {
    p.contentEditable = 'true';
    p.style.outline = '2px solid #2563b0';
    p.style.borderRadius = '4px';
    p.focus();
    /* Posiciona cursor no final */
    const range = document.createRange();
    range.selectNodeContents(p);
    range.collapse(false);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    btn.textContent = '✔ Salvar';
  }
};

window.copiarResumoModal = function () {
  const p = document.querySelector('#p-resumo-corpo p');
  if (!p) return;
  navigator.clipboard.writeText(p.innerText || p.textContent)
    .then(function () { showToastPainel('Resumo copiado!'); })
    .catch(function () {
      const ta = document.createElement('textarea');
      ta.value = p.innerText || p.textContent;
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToastPainel('Resumo copiado!');
    });
};

// ── ESCAPE HTML (evita quebra de DOM ao inserir conteúdo do Firestore) ──
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── BRASÃO BASE64 (evita falha do pdfmake ao buscar URL relativa) ──
async function getBrasaoBase64() {
  try {
    const resp = await fetch('img/brasao.png');
    const blob = await resp.blob();
    return await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload  = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  } catch (_e) {
    return document.getElementById('p-brasao').src;
  }
}

// ── GERAR PDF VALIDADO ──
window.gerarPDFValidado = async function (id) {
  showToastPainel('Preparando documento…');
  try {
    const snap = await getDoc(doc(db, 'solicitacoes', id));
    if (!snap.exists()) { showToastPainel('Documento não encontrado.'); return; }
    const s = snap.data();

    const assinantes  = s.assinantes || [];
    const isCancelado = s.statusGeral === 'cancelado';
    const todosSig    = !isCancelado && assinantes.length > 0 && assinantes.every(a => a.status === 'assinado');
    const temNegado   = !isCancelado && assinantes.some(a => a.status === 'negado');

    const statusTxt = isCancelado ? 'DOCUMENTO CANCELADO'
                    : todosSig    ? 'DOCUMENTO VALIDADO'
                    : temNegado   ? 'DOCUMENTO COM NEGATIVA'
                    :               'DOCUMENTO EM TRAMITAÇÃO';
    const sc     = isCancelado ? '#475569' : todosSig ? '#1d4ed8' : temNegado ? '#dc2626' : '#78500a';
    const scBg   = isCancelado ? '#f1f5f9' : todosSig ? '#eff6ff' : temNegado ? '#fef2f2' : '#fffbeb';
    const scBord = isCancelado ? '#94a3b8' : todosSig ? '#3b82f6' : temNegado ? '#dc2626' : '#c49a1a';

    const dataCriacao = s.criadoEm?.toDate
      ? s.criadoEm.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    const datas = assinantes.filter(a => a.dataAcao).map(a => new Date(a.dataAcao)).sort((a, b) => b - a);

    const assRows = assinantes.map(a => {
      const [icone, cor] = a.status === 'assinado' ? ['✅ Assinado', '#15803d']
                         : a.status === 'negado'   ? ['❌ Negado',   '#dc2626']
                         :                           ['⏳ Pendente', '#92400e'];
      const dtStr = a.dataAcao
        ? new Date(a.dataAcao).toLocaleDateString('pt-BR') + ' às ' +
          new Date(a.dataAcao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : 'Aguardando';
      return `<tr style="border-bottom:0.3pt solid #e2e8f0;">
        <td style="padding:6pt 8pt;font-size:8.5pt;font-weight:700;color:${cor};white-space:nowrap;vertical-align:top;">${icone}</td>
        <td style="padding:6pt 8pt;font-size:8.5pt;vertical-align:top;">
          <strong>${escHtml(a.nome || a.email)}</strong>
          ${a.cargo ? `<br><span style="color:#555;">${escHtml(a.cargo)}</span>` : ''}
          <br><span style="color:#666;font-size:8pt;">${escHtml(dtStr)}</span>
          ${a.motivo ? `<br><span style="color:#dc2626;font-size:8pt;">Motivo: ${escHtml(a.motivo)}</span>` : ''}
        </td>
      </tr>`;
    }).join('');

    const cancelHtml = isCancelado && s.cancelamento ? `
      <div style="background:#fff5f5;border-left:3px solid #b91c1c;padding:8pt 12pt;margin-bottom:10pt;font-size:8.5pt;">
        <strong style="color:#b91c1c;">Cancelado por:</strong> ${escHtml(s.cancelamento.nome)} (${escHtml(s.cancelamento.perfil)}) ·
        ${new Date(s.cancelamento.em).toLocaleDateString('pt-BR')}<br>
        <strong>Justificativa:</strong> ${escHtml(s.cancelamento.motivo)}
      </div>` : '';

    const geradorBase = window.location.href.replace(/\/[^/]*(\?.*)?$/, '/') + 'gerador-oficios-v2/';

    // Extrai thead e tfoot do conteúdo salvo para reutilizar na página de tramitação
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = s.conteudo || '';
    const theadEl = tempDiv.querySelector('.ofc-table thead');
    const tfootEl = tempDiv.querySelector('.ofc-table tfoot');
    const theadHtml = theadEl ? theadEl.outerHTML : '<thead><tr><td class="ofc-hcell"></td></tr></thead>';
    const tfootHtml = tfootEl ? tfootEl.outerHTML : '<tfoot><tr><td class="ofc-fcell"></td></tr></tfoot>';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escHtml(s.titulo || 'Ofício')} — PDF Validado</title>
  <base href="${geradorBase}">
  <link rel="stylesheet" href="css/oficio.css">
  <style>
    body { margin: 0; padding: 0; background: #fff; }
    #oficio { box-shadow: none !important; border: none !important; }
    .stamp-box {
      border: 1.5px solid ${scBord};
      border-radius: 4px;
      padding: 8pt 12pt;
      background: ${scBg};
      margin-bottom: 8pt;
    }
    .stamp-title { font-size: 8pt; font-weight: 700; color: ${sc}; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 5pt; }
    .stamp-meta  { font-size: 7.5pt; color: #555; line-height: 1.6; }
    .stamp-ass-table { width: 100%; border-collapse: collapse; margin-top: 6pt; }
    .stamp-table { width: 100%; height: 100%; border-collapse: collapse; table-layout: fixed; }
    .stamp-table thead td { padding: 0.35cm 1.5cm 0.2cm 1.5cm; vertical-align: top; }
    .stamp-table tbody td { padding: 0.3cm 1.5cm 0 1.5cm; vertical-align: top; }
    .stamp-table tfoot td { padding: 0.2cm 1.5cm 0.5cm 1.5cm; }
    @page { size: A4; margin: 1.5cm 1.75cm 1.2cm 2.5cm; }
    @media print {
      html, body { margin: 0; height: 100%; }
      #oficio { min-height: 0 !important; border: none !important; }
      .ofc-table, .stamp-table { width: 100%; height: 100%; }
      .ofc-hcell, .ofc-fcell, .ofc-bcell { border: none !important; }
      .ofc-hcell { padding: 0.3cm 0 0.2cm 0; }
      .ofc-fcell { padding: 0.15cm 0 0.2cm 0; }
      .ofc-bcell { padding: 0.3cm 0 0 0; vertical-align: top; }
      .oficio-corpo { padding: 0; }
      .ofc-cab img { height: 36pt !important; }
      .lb { height: 11pt !important; line-height: 11pt !important; }
      .c1, .c2, .c3 { font-size: 8pt !important; }
      .c4 { font-size: 9pt !important; white-space: nowrap; }
      .ass-bloco { page-break-inside: avoid !important; break-inside: avoid !important; line-height: 1.2 !important; margin-left: 8cm !important; }
      .ass-dig { font-size: 9pt !important; }
      .ass-nome { font-size: 10pt !important; white-space: nowrap; }
      .ass-cargo { font-size: 8.5pt !important; }
      .ofc-dest-wrap { page-break-inside: avoid; break-inside: avoid; margin-top: 8pt; padding-top: 14pt; }
      .ofc-p { orphans: 3; widows: 3; margin-bottom: 5pt; }
      .ofc-table-anexo { page-break-before: always; break-before: page; height: 100%; }
    }
  </style>
</head>
<body>
${s.conteudo || ''}
<!-- Comprovantes das Assinaturas — sempre em folha separada -->
<table class="stamp-table" style="page-break-before:always;break-before:page;">
  ${theadHtml}
  ${tfootHtml}
  <tbody><tr><td class="ofc-bcell">
    <div style="font-family:Arial,sans-serif;padding-top:0.4cm;">
      <div class="stamp-box">
        <div class="stamp-title">CENTRAL DE REGULAÇÃO DE VAGAS / DPP-SC — ${statusTxt}</div>
        <div class="stamp-meta">
          Criado por: ${escHtml((s.nomeCriador || s.emailCriador || '—').toUpperCase())}${s.nomeUnidadeOrigem ? ' — ' + escHtml(s.nomeUnidadeOrigem.toUpperCase()) : ''} — ${escHtml(dataCriacao)}
          ${datas.length ? `<br>${todosSig ? 'Concluído em' : 'Última ação em'}: ${datas[0].toLocaleDateString('pt-BR')} às ${datas[0].toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}
        </div>
      </div>
      ${cancelHtml}
      <strong style="font-family:Arial,sans-serif;font-size:9pt;">Registro de Assinaturas</strong>
      <table class="stamp-ass-table">
        ${assRows || '<tr><td colspan="2" style="font-size:8.5pt;color:#888;padding:5pt 0;">Nenhum assinante registrado.</td></tr>'}
      </table>
    </div>
  </td></tr></tbody>
</table>
<script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) { showToastPainel('Permita pop-ups para gerar o PDF.'); return; }
    win.document.write(html);
    win.document.close();
    showToastPainel('Janela de impressão/PDF aberta!');
    return;

  } catch (err) {
    showToastPainel('Erro ao gerar PDF: ' + err.message);
  }
};



// ABA ACESSOS — gestão de cadastros de servidores
// ══════════════════════════════════════════════
async function carregarAbaAcessos(el) {
  try {
    let q;

    if (modoLeitura()) {
      // CRV visualizando unidade específica via dropdown
      q = query(collection(db, 'usuarios_cadastrados'),
                where('emailUnidade', '==', unidadeSelecionada.email));
    } else if (perfilAtual === 'crv') {
      // CRV em modo geral — vê todos os cadastros
      q = collection(db, 'usuarios_cadastrados');
    } else {
      // DIR ou CPEN — apenas própria unidade
      q = query(collection(db, 'usuarios_cadastrados'),
                where('emailUnidade', '==', escopoAtual.email));
    }

    const snap = await getDocs(q);
    const registros = [];
    snap.forEach(d => registros.push({ id: d.id, ...d.data() }));

    if (!registros.length) {
      el.innerHTML = '<div class="p-vazio">Nenhum cadastro de servidor encontrado.</div>';
      return;
    }

    // Ordena: pendentes primeiro
    const ordem = { pendente: 0, aprovado: 1, recusado: 2, revogado: 3 };
    registros.sort((a, b) => (ordem[a.status] ?? 9) - (ordem[b.status] ?? 9));

    _selAcess.clear();
    _selAcessData = registros;
    _selCtx = 'acess';

    const cabSel = `<div class="p-sel-header">
      <label><input type="checkbox" class="p-sel-all-check" data-ctx="acc" onchange="selAccAll(this)"> Selecionar todos (${registros.length})</label>
    </div>`;

    el.innerHTML = cabSel + registros.map(r => {
      const info = {
        pendente: { label: 'Pendente', classe: 'p-status-pendente' },
        aprovado:  { label: 'Aprovado', classe: 'p-status-concluido' },
        recusado:  { label: 'Recusado', classe: 'p-status-negado' },
        revogado:  { label: 'Revogado', classe: 'p-status-negado' },
      }[r.status] || { label: r.status, classe: 'p-status-andamento' };

      const dataCad = r.criadoEm?.toDate  ? r.criadoEm.toDate().toLocaleDateString('pt-BR')   : '—';
      const dataApr = r.aprovadoEm?.toDate ? r.aprovadoEm.toDate().toLocaleDateString('pt-BR') : null;

      const acoes = [];
      if (r.status === 'pendente') {
        acoes.push(`<button class="p-btn p-btn-assinar" onclick="aprovarAcesso('${r.id}')">Aprovar</button>`);
        acoes.push(`<button class="p-btn p-btn-negar"   onclick="abrirModalNegarAcesso('${r.id}')">Recusar</button>`);
        acoes.push(`<button class="p-btn p-btn-outline" onclick="excluirCadastro('${r.id}','${r.nome?.replace(/'/g,'') || ''}')">Excluir</button>`);
      } else if (r.status === 'aprovado') {
        acoes.push(`<button class="p-btn p-btn-outline" onclick="redefinirSenhaUsuario('${r.id}','${escHtml(r.email || '')}','${escHtml(r.nome?.replace(/'/g,'') || '')}')">Redefinir senha</button>`);
        acoes.push(`<button class="p-btn p-btn-negar" onclick="revogarAcesso('${r.id}')">Revogar acesso</button>`);
      } else if (r.status === 'recusado') {
        acoes.push(`<button class="p-btn p-btn-outline" onclick="reativarPendente('${r.id}')">Reabrir pedido</button>`);
        acoes.push(`<button class="p-btn p-btn-outline" onclick="excluirCadastro('${r.id}','${r.nome?.replace(/'/g,'') || ''}')">Excluir</button>`);
      } else if (r.status === 'revogado') {
        acoes.push(`<button class="p-btn p-btn-outline" onclick="reativarPendente('${r.id}')">Reabrir pedido</button>`);
      }

      const cpfFmt = r.cpf ? r.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '—';
      const nascFmt = r.dataNascimento || '—';
      return `
      <div class="p-card p-card-compact" id="acard-${r.id}">
        <div class="p-card-row" onclick="pAccToggle('${r.id}')">
          <input type="checkbox" class="p-card-check" data-ctx="acc" onchange="selAccToggle('${r.id}')" onclick="event.stopPropagation()" title="Selecionar">
          <span class="p-status ${info.classe}" style="flex-shrink:0;">${info.label}</span>
          <span class="p-card-titulo-row" style="cursor:pointer;">${escHtml(r.nome || '—')}</span>
          <span class="p-card-meta-row">${escHtml(r.nomeUnidade || '—')} · ${dataCad}</span>
          <span class="p-card-arrow" id="aarrow-${r.id}">▶</span>
        </div>
        <div class="p-card-body" id="acbody-${r.id}" style="display:none;">
          <div style="padding:10px 16px 6px;display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;font-size:.78rem;">
            <div><span style="color:var(--txt-3);">E-mail:</span> ${escHtml(r.email || '—')}</div>
            <div><span style="color:var(--txt-3);">CPF:</span> ${escHtml(cpfFmt)}</div>
            <div><span style="color:var(--txt-3);">Nascimento:</span> ${escHtml(nascFmt)}</div>
            <div><span style="color:var(--txt-3);">Unidade:</span> ${escHtml(r.nomeUnidade || r.emailUnidade || '—')}</div>
            ${dataApr ? `<div><span style="color:var(--txt-3);">Ação por:</span> ${escHtml(r.aprovadoPor || '—')} em ${dataApr}</div>` : ''}
            ${r.motivoRecusa ? `<div style="grid-column:1/-1;color:var(--vermelho);"><span style="color:var(--txt-3);">Motivo recusa:</span> ${escHtml(r.motivoRecusa)}</div>` : ''}
          </div>
          ${acoes.length ? `<div class="p-card-acoes">${acoes.join('')}</div>` : ''}
        </div>
      </div>`;
    }).join('');
    _atualizarBarra();

  } catch (e) {
    el.innerHTML = `<div class="p-erro-msg">Erro ao carregar acessos: ${e.message}</div>`;
  }
}

// ── Aprovar ──
window.aprovarAcesso = async function (id) {
  try {
    await updateDoc(doc(db, 'usuarios_cadastrados', id), {
      status:       'aprovado',
      aprovadoPor:  usuarioAtual.email,
      aprovadoEm:   serverTimestamp(),
      motivoRecusa: null,
    });
    showToastPainel('Acesso aprovado com sucesso.');
    carregarAba('acessos');
  } catch (e) { showToastPainel('Erro: ' + e.message); }
};

// ── Recusar (com modal para motivo) ──
window.abrirModalNegarAcesso = function (id) {
  document.getElementById('p-modal-negar-acesso').style.display = 'flex';
  document.getElementById('p-negar-acesso-id').value = id;
  document.getElementById('p-motivo-acesso').value   = '';
};
window.fecharModalNegarAcesso = function () {
  document.getElementById('p-modal-negar-acesso').style.display = 'none';
};
window.confirmarNegarAcesso = async function () {
  const id     = document.getElementById('p-negar-acesso-id').value;
  const motivo = document.getElementById('p-motivo-acesso').value.trim() || 'Não especificado';
  try {
    await updateDoc(doc(db, 'usuarios_cadastrados', id), {
      status:       'recusado',
      aprovadoPor:  usuarioAtual.email,
      aprovadoEm:   serverTimestamp(),
      motivoRecusa: motivo,
    });
    fecharModalNegarAcesso();
    showToastPainel('Acesso recusado.');
    carregarAba('acessos');
  } catch (e) { showToastPainel('Erro: ' + e.message); }
};

// ── Revogar (aprovado → revogado) ──
window.revogarAcesso = async function (id) {
  try {
    await updateDoc(doc(db, 'usuarios_cadastrados', id), {
      status:      'revogado',
      aprovadoPor: usuarioAtual.email,
      aprovadoEm:  serverTimestamp(),
    });
    showToastPainel('Acesso revogado.');
    carregarAba('acessos');
  } catch (e) { showToastPainel('Erro: ' + e.message); }
};

// ── Redefinir senha (envia e-mail de recuperação ao usuário) ──
window.redefinirSenhaUsuario = async function (id, email, nome) {
  if (!email) { showToastPainel('E-mail do usuário não encontrado.'); return; }
  const confirmado = confirm(`Enviar e-mail de redefinição de senha para ${nome || email} (${email})?`);
  if (!confirmado) return;
  try {
    await sendPasswordResetEmail(auth, email);
    showToastPainel(`E-mail de redefinição enviado para ${email}.`);
  } catch (e) {
    const msgs = {
      'auth/user-not-found': 'Usuário não encontrado no sistema de autenticação.',
      'auth/invalid-email':  'E-mail inválido.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
    };
    showToastPainel('Erro: ' + (msgs[e.code] || e.message));
  }
};

// ── Reabrir pedido (recusado/revogado → pendente) ──
window.reativarPendente = async function (id) {
  try {
    await updateDoc(doc(db, 'usuarios_cadastrados', id), {
      status:       'pendente',
      aprovadoPor:  null,
      aprovadoEm:   null,
      motivoRecusa: null,
    });
    showToastPainel('Pedido reaberto. Aguardando nova aprovação.');
    carregarAba('acessos');
  } catch (e) { showToastPainel('Erro: ' + e.message); }
};

// ── Excluir permanentemente (pendente ou recusado) ──
window.excluirCadastro = async function (id, nome) {
  if (!confirm(`Excluir permanentemente o cadastro de "${nome}"? Esta ação não pode ser desfeita.`)) return;
  try {
    await deleteDoc(doc(db, 'usuarios_cadastrados', id));
    showToastPainel('Cadastro excluído.');
    carregarAba('acessos');
  } catch (e) { showToastPainel('Erro: ' + e.message); }
};

// ── TOAST ──
function showToastPainel(msg) {
  let el = document.getElementById('p-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'p-toast';
    el.style.cssText = [
      'position:fixed','bottom:24px','right:24px',
      'background:var(--azul-900)','color:#fff',
      'padding:12px 20px','border-radius:10px',
      'font-size:.84rem','font-weight:600',
      'box-shadow:0 4px 20px rgba(0,0,0,.3)',
      'z-index:9999','opacity:0','transition:opacity .25s',
      'border-left:3px solid var(--azul-400)'
    ].join(';');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 3500);
}

function mostrarErro(msg) {
  const el = document.getElementById('p-erro-global');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

// ── ABA MANUAL ──
function carregarAbaManual(el) {
  el.innerHTML = `
  <div style="padding:16px 24px 32px;">
    <div style="margin-bottom:20px;">
      <h2 style="font-size:1.1rem;font-weight:700;color:var(--txt-1);margin:0 0 4px;">📖 Manual Operacional — CRV</h2>
      <p style="font-size:.82rem;color:var(--txt-3);margin:0;">Procedimentos da Res. Conjunta nº 1/2026 · ${escopoAtual?.n || escopoAtual?.nome || ''}</p>
    </div>

    <!-- Hipóteses -->
    <div style="margin-bottom:10px;font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--txt-3);">📌 Hipóteses de Transferência</div>
    <div style="margin-bottom:8px;background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;font-size:.83rem;color:#92400e;">
      ⚠️ O pedido que não se enquadre em nenhuma das hipóteses abaixo será <strong>indeferido de plano</strong> pela CRV.
    </div>
    <div class="p-accordion" style="margin-bottom:24px;">
      <div class="p-acc-item">
        <div class="p-acc-header" onclick="pAccToggleManual(this)">🚨 &nbsp;I — Segurança / Emergência (Art. 21, I)<span class="p-acc-seta">▼</span></div>
        <div class="p-acc-body" style="display:none;">
          <p>A transferência em caráter emergencial somente será admitida quando houver <strong>risco atual, concreto e relevante</strong>, devidamente demonstrado pela unidade solicitante.</p>
          <p style="margin-top:8px;">A transferência possui natureza <strong>administrativa e não punitiva</strong>.</p>
          <div style="border-left:4px solid #dc2626;padding:.5rem 1rem;margin:10px 0;background:rgba(220,38,38,.06);border-radius:0 4px 4px 0;font-size:.86rem;">
            Abrange situações de instabilidade interna, conflitos, risco à ordem da unidade, risco à integridade física do reeducando ou de terceiros, ameaças, motins, rebeliões.
          </div>
          <p style="font-size:.86rem;"><strong>Assinaturas obrigatórias:</strong> Diretor de Origem + Diretor de Destino + Superintendente(s) Regional(is).</p>
        </div>
      </div>
      <div class="p-acc-item">
        <div class="p-acc-header" onclick="pAccToggleManual(this)">🔄 &nbsp;II — Pedido Voluntário (Art. 21, II)<span class="p-acc-seta">▼</span></div>
        <div class="p-acc-body" style="display:none;">
          <p>Para solicitações por pedido do preso, familiar ou advogado, acesse o <strong>Portal da Polícia Penal de SC</strong>: <a href="https://ppsc.com.br" target="_blank" rel="noopener" style="font-weight:700;">ppsc.com.br ↗</a>. Envios de memorandos diretamente à CRV serão indeferidos.</p>
        </div>
      </div>
      <div class="p-acc-item">
        <div class="p-acc-header" onclick="pAccToggleManual(this)">⚖️ &nbsp;III — Adequação da Capacidade de Ocupação (Art. 21, III)<span class="p-acc-seta">▼</span></div>
        <div class="p-acc-body" style="display:none;">
          <p>Redistribuição administrativa destinada à adequação da capacidade de ocupação das unidades prisionais.</p>
          <ul style="margin:.75rem 0 0 1.25rem;list-style:disc;font-size:.87rem;line-height:2.1;">
            <li><strong>Larga escala / complexo:</strong> Transferência rotineira dentro do mesmo Complexo;</li>
            <li><strong>Pontual:</strong> Transferência individual por perfil específico;</li>
            <li><strong>Alteração de Regime:</strong> Transferência para unidade adequada em razão de progressão, regressão ou prisão provisória.</li>
          </ul>
          <p style="margin-top:8px;font-size:.86rem;"><strong>Metas — Plano Pena Justa:</strong> 130% (1º ano) → 120% (2º ano) → 100% (3º ano).</p>
        </div>
      </div>
      <div class="p-acc-item">
        <div class="p-acc-header" onclick="pAccToggleManual(this)">🏛️ &nbsp;IV — Mandado de Prisão de Comarca Diversa<span class="p-acc-seta">▼</span></div>
        <div class="p-acc-body" style="display:none;">
          <p>Preso capturado em comarca diversa daquela que expediu a ordem de prisão, devendo ser transferido para a unidade responsável pela circunscrição da autoridade judiciária expedidora.</p>
        </div>
      </div>
      <div class="p-acc-item">
        <div class="p-acc-header" onclick="pAccToggleManual(this)">🌙 &nbsp;V — Pernoite<span class="p-acc-seta">▼</span></div>
        <div class="p-acc-body" style="display:none;">
          <p>Necessidade de permanência temporária do custodiado em unidade diversa da sua por motivo fundamentado.</p>
          <p style="margin-top:8px;font-size:.86rem;">📋 Não é necessário ofício via SGPe — basta cadastro no i-PEN com menção ao contato prévio com o Diretor ou Chefe de Segurança da unidade de destino.</p>
        </div>
      </div>
      <div class="p-acc-item">
        <div class="p-acc-header" onclick="pAccToggleManual(this)">🔒 &nbsp;VI — Unidade de Segurança Máxima / RDD<span class="p-acc-seta">▼</span></div>
        <div class="p-acc-body" style="display:none;">
          <p>Inclusão de preso de alta periculosidade na USM, mediante decisão judicial de RDD e deliberação da Comissão Deliberativa do DPP.</p>
          <ul style="margin:.75rem 0 0 1.25rem;list-style:disc;font-size:.87rem;line-height:2.1;">
            <li>A gestão local somente pode solicitar o RDD ao Judiciário <strong>após autorização expressa do DPP</strong>;</li>
            <li>Com o RDD deferido, o processo é encaminhado à CRV para cadastro no sistema.</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Fluxo Operacional -->
    <div style="margin-bottom:10px;font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--txt-3);">🔄 Fluxo Operacional</div>
    <div style="margin-bottom:8px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;font-size:.83rem;color:#991b1b;">
      🚨 <strong>Emergenciais — Ligue imediatamente para a CRV: (48) 3665-7330</strong>
    </div>
    <div class="p-accordion" style="margin-bottom:24px;">
      ${[
        ['1','Unidade de Origem','Identificação da hipótese e elaboração do Ofício','Identificar a hipótese e elaborar o ofício endereçado à CRV.'],
        ['2','Unidade de Origem','Processo SGPe — único e permanente','Cada unidade deve possuir um processo SGPe único e permanente para coleta de assinaturas.'],
        ['3','','Assinaturas obrigatórias','Diretor de Origem + Diretor de Destino + Superintendente(s) Regional(is).'],
        ['4','Superintendência(s) Regional(is)','Anuência do(s) Superintendente(s)','SR de origem sempre obrigatória. Se envolver outra SR, a de destino também deve anuir.'],
        ['5','','Materialização dos Documentos no SGPe','Selecionar as peças e executar a materialização, gerando um único PDF consolidado.'],
        ['6','','Cadastro no i-PEN','Cadastrar o pedido no i-PEN anexando o PDF materializado.'],
        ['7','CRV','Análise e deliberação pela CRV','A CRV recebe, analisa e delibera: deferir, indeferir ou devolver para saneamento.'],
        ['8','Unidade Prisional','Execução + Comunicação ao Judiciário','Após autorização: efetivação e comunicação ao Juízo competente em até 24 horas.'],
      ].map(([n, ator, titulo, desc]) => `
      <div class="p-acc-item">
        <div class="p-acc-header" onclick="pAccToggleManual(this)">
          <span style="background:var(--azul-500);color:#fff;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;margin-right:8px;flex-shrink:0;">${n}</span>
          ${ator ? `<span style="font-size:.75rem;color:var(--txt-3);margin-right:6px;">[${ator}]</span>` : ''}${titulo}
          <span class="p-acc-seta">▼</span>
        </div>
        <div class="p-acc-body" style="display:none;font-size:.87rem;color:var(--txt-2);padding:10px 16px;">${desc}</div>
      </div>`).join('')}
    </div>

    <!-- Documentos -->
    <div style="margin-bottom:10px;font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--txt-3);">📂 Documentos Necessários</div>
    <div class="p-accordion">
      <div class="p-acc-item">
        <div class="p-acc-header" onclick="pAccToggleManual(this)">🚨 Segurança / Emergência — Checklist<span class="p-acc-seta">▼</span></div>
        <div class="p-acc-body" style="display:none;">
          <p style="font-size:.83rem;font-weight:700;color:#dc2626;margin-bottom:.5rem;">Com PAD</p>
          <ul style="list-style:none;font-size:.875rem;line-height:2.3;margin-bottom:1rem;">
            <li>☐ <strong>Ofício</strong> — Modelo A (Com PAD); Art. 21, I da Res. nº 1/2026</li>
            <li>☐ <strong>Assinaturas:</strong> Diretor Origem + Diretor Destino + Superintendente(s)</li>
          </ul>
          <p style="font-size:.83rem;font-weight:700;color:var(--azul-500);margin-bottom:.5rem;">Sem PAD</p>
          <ul style="list-style:none;font-size:.875rem;line-height:2.3;">
            <li>☐ <strong>Ofício</strong> — Modelo B (Sem PAD); Art. 21, I da Res. nº 1/2026</li>
            <li>☐ <strong>Assinaturas:</strong> Diretor Origem + Diretor Destino + Superintendente(s)</li>
          </ul>
        </div>
      </div>
      <div class="p-acc-item">
        <div class="p-acc-header" onclick="pAccToggleManual(this)">⚖️ Adequação da Capacidade de Ocupação — Checklist<span class="p-acc-seta">▼</span></div>
        <div class="p-acc-body" style="display:none;">
          <ul style="list-style:none;font-size:.875rem;line-height:2.3;">
            <li>☐ <strong>Ofício</strong> — Art. 21, III da Res. nº 1/2026</li>
            <li>☐ <strong>Lista dos presos indicados</strong> — nome, IPEN, regime, perfil</li>
            <li>☐ <strong>Assinaturas:</strong> Diretor Origem + Diretor Destino (+ SR se unidades distintas)</li>
          </ul>
        </div>
      </div>
      <div class="p-acc-item">
        <div class="p-acc-header" onclick="pAccToggleManual(this)">🏛️ Mandado de Prisão de Comarca Diversa — Checklist<span class="p-acc-seta">▼</span></div>
        <div class="p-acc-body" style="display:none;">
          <ul style="list-style:none;font-size:.875rem;line-height:2.3;">
            <li>☐ <strong>Ofício da Direção</strong> — Art. 21, III da Res. nº 1/2026</li>
            <li>☐ <strong>Cópia do Mandado de Prisão</strong></li>
            <li>☐ <strong>Assinaturas:</strong> Diretor Origem + Diretor Destino</li>
          </ul>
        </div>
      </div>
      <div class="p-acc-item">
        <div class="p-acc-header" onclick="pAccToggleManual(this)">🌙 Pernoite — Checklist<span class="p-acc-seta">▼</span></div>
        <div class="p-acc-body" style="display:none;">
          <ul style="list-style:none;font-size:.875rem;line-height:2.3;">
            <li>☐ <strong>Pedido cadastrado no i-PEN</strong> com fundamentação</li>
            <li>☐ <strong>Menção expressa</strong> de contato prévio com o Diretor de destino</li>
          </ul>
        </div>
      </div>
      <div class="p-acc-item">
        <div class="p-acc-header" onclick="pAccToggleManual(this)">🔒 Segurança Máxima / RDD — Checklist<span class="p-acc-seta">▼</span></div>
        <div class="p-acc-body" style="display:none;">
          <ul style="list-style:none;font-size:.875rem;line-height:2.3;">
            <li>☐ <strong>Autorização expressa do DPP</strong> — Comissão Deliberativa da USM</li>
            <li>☐ <strong>Ofício de solicitação de RDD</strong> ao juízo competente</li>
            <li>☐ <strong>Decisão judicial</strong> que determina a inclusão em RDD</li>
            <li>☐ <strong>BO, PAD, Relatórios</strong> e demais documentos pertinentes</li>
            <li>☐ <strong>Assinaturas:</strong> Diretor + Superintendente Regional de origem</li>
          </ul>
        </div>
      </div>
    </div>
  </div>

  <style>
    .p-acc-item { border:1px solid var(--border); border-radius:8px; margin-bottom:6px; overflow:hidden; }
    .p-acc-header { display:flex; align-items:center; padding:12px 16px; font-size:.88rem; font-weight:600; cursor:pointer; background:var(--surface); color:var(--txt-1); gap:4px; }
    .p-acc-header:hover { background:var(--surface-2); }
    .p-acc-seta { margin-left:auto; font-size:.7rem; color:var(--txt-3); transition:transform .2s; }
    .p-acc-body { padding:12px 16px; font-size:.86rem; color:var(--txt-2); line-height:1.6; border-top:1px solid var(--border); background:var(--bg); }
  </style>`;
}

window.pAccToggleManual = function(header) {
  const body = header.nextElementSibling;
  const aberto = body.style.display !== 'none';
  body.style.display = aberto ? 'none' : 'block';
  const seta = header.querySelector('.p-acc-seta');
  if (seta) seta.style.transform = aberto ? '' : 'rotate(180deg)';
};

// ── ABA FERRAMENTAS ──
function carregarAbaFerramentas(el) {
  const unNome = escopoAtual?.unidade?.nome || escopoAtual?.n || escopoAtual?.nome || '';
  const cardPAD = perfilAtual === 'cpen' ? `
      <button onclick="_abrirPADdoPainel()" style="display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:16px;border:2px solid #f97316;border-radius:10px;background:#fff8f3;cursor:pointer;text-align:left;font-family:inherit;transition:background .15s;" onmouseover="this.style.background='#ffedd5'" onmouseout="this.style.background='#fff8f3'">
        <span style="font-size:1.4rem;">📋</span>
        <span style="font-size:.9rem;font-weight:700;color:#9a3412;">Gerador de PAD</span>
        <span style="font-size:.78rem;color:#c2410c;">Procedimento Administrativo Disciplinar</span>
      </button>` : '';
  el.innerHTML = `
  <div style="padding:16px 24px 32px;">
    <div style="margin-bottom:20px;">
      <h2 style="font-size:1.1rem;font-weight:700;color:var(--txt-1);margin:0 0 4px;">🛠️ Ferramentas</h2>
      <p style="font-size:.82rem;color:var(--txt-3);margin:0;">${unNome ? 'Unidade: ' + unNome : 'Central de Regulação de Vagas'}</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;">
      <button onclick="window.parent.abrirGeradorOficios && window.parent.abrirGeradorOficios()" style="display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:16px;border:1px solid var(--border);border-radius:10px;background:var(--surface);cursor:pointer;text-align:left;font-family:inherit;transition:background .15s;" onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background='var(--surface)'">
        <span style="font-size:1.4rem;">⚙️</span>
        <span style="font-size:.9rem;font-weight:700;color:var(--txt-1);">Gerador de Ofícios</span>
        <span style="font-size:.78rem;color:var(--txt-3);">Elaborar ofícios com formatação oficial</span>
      </button>
      <button onclick="window.parent.abrirGuiaOficios && window.parent.abrirGuiaOficios()" style="display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:16px;border:1px solid var(--border);border-radius:10px;background:var(--surface);cursor:pointer;text-align:left;font-family:inherit;transition:background .15s;" onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background='var(--surface)'">
        <span style="font-size:1.4rem;">📄</span>
        <span style="font-size:.9rem;font-weight:700;color:var(--txt-1);">Guia — Gerador de Ofícios</span>
        <span style="font-size:.78rem;color:var(--txt-3);">Instruções de uso do gerador</span>
      </button>${cardPAD}
      <a href="https://ppsc.com.br" target="_blank" rel="noopener" style="display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:16px;border:1px solid var(--border);border-radius:10px;background:var(--surface);text-decoration:none;transition:background .15s;" onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background='var(--surface)'">
        <span style="font-size:1.4rem;">🌐</span>
        <span style="font-size:.9rem;font-weight:700;color:var(--txt-1);">Portal de Transferências ↗</span>
        <span style="font-size:.78rem;color:var(--txt-3);">ppsc.com.br — pedidos voluntários</span>
      </a>
      <button onclick="window.parent.navegarPara && window.parent.navegarPara('unidades')" style="display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:16px;border:1px solid var(--border);border-radius:10px;background:var(--surface);cursor:pointer;text-align:left;font-family:inherit;transition:background .15s;" onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background='var(--surface)'">
        <span style="font-size:1.4rem;">🏛️</span>
        <span style="font-size:.9rem;font-weight:700;color:var(--txt-1);">Unidades Prisionais</span>
        <span style="font-size:.78rem;color:var(--txt-3);">Contatos e dados das unidades</span>
      </button>
      <button onclick="window.parent.navegarPara && window.parent.navegarPara('legislacao')" style="display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:16px;border:1px solid var(--border);border-radius:10px;background:var(--surface);cursor:pointer;text-align:left;font-family:inherit;transition:background .15s;" onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background='var(--surface)'">
        <span style="font-size:1.4rem;">📚</span>
        <span style="font-size:.9rem;font-weight:700;color:var(--txt-1);">Legislação</span>
        <span style="font-size:.78rem;color:var(--txt-3);">Base normativa aplicável</span>
      </button>
    </div>
  </div>`;
}

/* Abre o Gerador de PAD a partir do Painel, passando dados da unidade para o pai */
window._abrirPADdoPainel = function() {
  if (window.parent && window.parent._padSetUnidade) {
    window.parent._padSetUnidade(escopoAtual?.unidade || null);
  }
  window.parent.abrirGeradorPAD && window.parent.abrirGeradorPAD();
};

// ── INIT ──
// (dados já carregados via dadosPromise antes do onAuthStateChanged)

// ══════════════════════════════════════════════
// API EXPORTADA — usada pelo Gerador de Ofícios V2
// ══════════════════════════════════════════════
window.criarSolicitacaoAssinatura = async function ({ titulo, conteudo, unidadeOrigem, assinantes, presos, resumo }) {
  if (!usuarioAtual) throw new Error('Usuário não autenticado.');
  const unidade = UNIDADES.find(u => u.email === unidadeOrigem) || {};
  const docRef  = await addDoc(collection(db, 'solicitacoes'), {
    titulo,
    conteudo,
    resumo:             resumo || '',
    presos:             (presos || []).map(p => ({ nome: p.nome || '', ipen: p.ipen || '' })),
    emailUnidadeOrigem: unidadeOrigem,
    nomeUnidadeOrigem:  unidade.nome || '',
    emailCriador:       usuarioAtual.email,
    nomeCriador:        usuarioAtual.displayName || usuarioAtual.email,
    assinantes: assinantes.map(a => ({
      email:        a.email,
      nome:         a.nome,
      emailUnidade: a.emailUnidade || '',
      status:       'pendente',
      dataAcao:     null,
      motivo:       null,
    })),
    statusGeral:  'em_andamento',
    criadoEm:     serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  return docRef.id;
};
