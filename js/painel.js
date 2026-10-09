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
import { FIREBASE_CONFIG, EMAILS_CRV, escHtml, srDoSuperintendente } from "./config-crv.js";
import { PERFIS_AVISO, avisoNoMeuHistorico, avisoParaMim, descreverPublico, textoAvisoHtml,
         formatarDataAviso, listarAvisos, meusAvisosLidos, listarLeituras, contarLeituras,
         confirmarLeitura, publicarAviso, alterarArquivado, listarComentarios, contarComentarios,
         comentarAviso, excluirComentario, excluirAviso, enviarAnexoAviso, anexosHtml,
         editarAviso, avisoExpirado, expiraEmMs,
         ANEXO_MAX_ARQUIVOS, ANEXO_MAX_MB } from "./avisos.js?v=2";

// ── CONFIG FIREBASE ──
const app  = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── ESTADO ──
let UNIDADES          = [];
let SR_INFO           = {};
let usuarioAtual      = null;
let perfilAtual       = null; // 'crv' | 'dir' | 'super' | 'cpen'
let escopoAtual       = null; // { tipo, codigo } ou { tipo, email, unidade }
let unidadeSelecionada  = null; // null = próprio painel | objeto unidade = modo leitura
let srSelecionada       = null; // null = sem filtro SR | 'SR01' etc = CRV visualizando SR
let _pendenciasUnsub    = null; // unsubscribe do listener onSnapshot de pendências

// ── CARREGA DADOS DAS UNIDADES (Firestore, com fallback pro JSON estático) ──
async function carregarDados() {
  try {
    const snap = await getDoc(doc(db, 'unidades_config', 'principal'));
    if (snap.exists()) {
      UNIDADES = snap.data().unidades;
      SR_INFO  = snap.data().sr;
      return;
    }
  } catch (_) { /* sem acesso ainda (ex: antes do login) — usa o JSON estático */ }
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

  const srCod = srDoSuperintendente(e);
  if (srCod)
    return { perfil: 'super', escopo: { tipo: 'sr', codigo: srCod } };

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

// ── CONTROLE DE RENDERIZAÇÃO ──
// Cada tela que carrega dados pega um número. Se o usuário trocar de tela (ex.:
// escolher uma unidade e logo depois uma regional) antes do carregamento anterior
// terminar, o resultado atrasado é descartado em vez de sobrescrever a tela atual.
let _renderSeq = 0;
function _novaRenderizacao() { return ++_renderSeq; }
function _renderAtual(id)    { return id === _renderSeq; }

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
  } else {
    mostrarLandingGrupos();
  }
  /* Listener em tempo real de pendências para DIR/SR/CPEN */
  if (['dir', 'super', 'cpen'].includes(perfilAtual)) {
    _iniciarListenerPendencias();
    _verificarPendenciasLogin();
  }
  /* Atalho do menu lateral que chegou antes do login terminar */
  if (_telaPendente) { const t = _telaPendente; _telaPendente = null; _abrirTela(t); }

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
      // Negativa de qualquer envolvido encerra o processo — não é mais pendência de ninguém.
      if ((s.assinantes || []).some(a => a.status === 'negado')) return;
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

/* ── Modal de pendências no login ── */
async function _verificarPendenciasLogin() {
  try {
    const snap = await getDocs(query(collection(db, 'solicitacoes'), orderBy('criadoEm', 'desc')));
    const pendentes = [];
    snap.forEach(d => {
      const s = { id: d.id, ...d.data() };
      if (s.statusGeral === 'cancelado') return;
      // Negativa de qualquer envolvido encerra o processo — não é mais pendência de ninguém.
      if ((s.assinantes || []).some(a => a.status === 'negado')) return;
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
  // Cabeçalho interno do Painel desligado para todos os perfis: nome/e-mail/cargo já
  // aparecem na barra do site principal, e o seletor de unidade/SR de CRV/SUPER agora
  // vive lá também (js/firebase.js, _montarSeletorPainelTopbar), então não é mais
  // necessário manter esse bloco visível para ninguém.
  const headerEl = document.querySelector('.p-header');
  if (headerEl) headerEl.style.display = 'none';

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
    mostrarLandingGrupos();
  }
}

// ── Recebe a escolha de unidade/SR feita no seletor da barra do site principal ──
// (mesmo iframe, comunicação via postMessage — ver js/firebase.js, _montarSeletorPainelTopbar)
// ── Atalhos do menu lateral do site principal (js/firebase.js, abrirTelaPainel) ──
let _telaPendente = null;
function _abrirTela(tela) {
  if (tela === 'mural') { abrirMuralAvisos(); return; }
  if (tela === 'usuarios') {
    if (['crv', 'super', 'dir', 'cpen'].includes(perfilAtual)) carregarAba('acessos');
    return;
  }
  if (tela === 'transferencias') {
    // CRV (visão estadual): painel de acompanhamento; demais: pendentes + histórico
    if (perfilAtual === 'crv' && !modoLeitura()) mostrarDashboard();
    else _mostrarSubGrupo('transferencias');
  }
}
window.addEventListener('message', (e) => {
  if (e.origin !== location.origin || !e.data || typeof e.data.crvAbrirTela !== 'string') return;
  if (!perfilAtual) { _telaPendente = e.data.crvAbrirTela; return; } // login ainda carregando
  _abrirTela(e.data.crvAbrirTela);
});

window.addEventListener('message', (e) => {
  if (e.origin !== location.origin) return;
  if (!e.data || typeof e.data.crvSelecionarUnidade !== 'string') return;
  if (!['crv', 'super'].includes(perfilAtual)) return;
  trocarUnidade(e.data.crvSelecionarUnidade);
});

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
  return ['dir', 'cpen'].includes(perfilAtual) || modoLeitura();
}

const _GRUPO_DE_ABA = {
  pendentes: 'transferencias', minhas: 'transferencias', negados: 'transferencias',
  historico: 'transferencias', cancelados: 'transferencias',
  acessos: 'acesso',
  local_pendentes: 'transf_local', local_historico: 'transf_local',
  externa_pendentes: 'transf_externa', externa_historico: 'transf_externa',
};
const _LABEL_GRUPO = {
  transferencias: 'Transferências - Assinaturas', acesso: 'Controle de Acesso de Usuários', ferramentas: 'Ferramentas',
  transf_local: 'Solicitação da Unidade', transf_externa: 'Solicitação de Outra Unidade',
};
const _LABEL_ABA   = {
  historico: 'Histórico — Geral', cancelados: 'Cancelados', acessos: 'Usuários',
  minhas: 'Solicitações da Unidade', negados: 'Com Negativa',
  local_pendentes: 'Pendente(s) de Assinatura(s)', local_historico: 'Histórico',
  externa_pendentes: 'Pendente(s) de Assinatura(s)', externa_historico: 'Histórico',
};

// ── Volta para a tela de grupo correta a partir do breadcrumb ──
function _voltarParaGrupo() {
  if (_grupoAtivo === 'transf_local')   { _mostrarSubGrupoTransf('local');   return; }
  if (_grupoAtivo === 'transf_externa') { _mostrarSubGrupoTransf('externa'); return; }
  _mostrarSubGrupo(_grupoAtivo);
}

// ── Rótulos sensíveis a modo leitura (viewer não recebe linguagem de "minha ação") ──
function _lblAguardandoTitulo() { return modoLeitura() ? 'Aguardando manifestação' : 'Aguardando minha ação'; }
function _lblAguardandoAba()    { return modoLeitura() ? 'Aguardando manifestação' : 'Aguardando sua manifestação'; }
function _fraseSituacao(n) {
  if (modoLeitura()) {
    return n > 0
      ? `Há ${n} pendência${n > 1 ? 's' : ''} de manifestação nesta unidade.`
      : 'Não há pendências de manifestação nesta unidade.';
  }
  return n > 0
    ? `Há ${n} pendência${n > 1 ? 's' : ''} aguardando sua manifestação.`
    : 'Não há pendências aguardando sua manifestação.';
}

function _atualizarBreadcrumb() {
  const bc = document.getElementById('p-breadcrumb');
  if (!bc) return;
  if (!_ehNavCartoes() || !_abaAtiva) { bc.className = ''; return; }
  const gl = _LABEL_GRUPO[_grupoAtivo] || '';
  const al = _abaAtiva === 'pendentes' ? _lblAguardandoAba() : (_LABEL_ABA[_abaAtiva] || _abaAtiva);
  bc.className = 'visivel';
  bc.innerHTML = `
    <button class="p-bc-btn" onclick="mostrarLandingGrupos()">← Início</button>
    <span class="p-bc-sep">/</span>
    <button class="p-bc-btn" onclick="_voltarParaGrupo()">${gl}</button>
    <span class="p-bc-sep">/</span>
    <span class="p-bc-atual">${al}</span>`;
}

// ── Classificador único (reaproveita calcularStatusGeral) ──
function _classeDoc(s) { return calcularStatusGeral(s.assinantes || [], s.statusGeral).classe; }

// ── Contagem de situação da unidade (Home) ──
// Reaproveita os mesmos filtros de carregarAba('pendentes'/'minhas') e calcularStatusGeral.
// Uma única leitura, sem listener novo. "aguardando" já respeita a regra de negócio:
// pedido com qualquer negativa deixa de ser pendência de qualquer um (processo encerrado).
async function _contarSituacaoUnidade() {
  const resultado = { aguardando: 0, andamento: 0, negado: 0, concluido: 0, externaAndamento: 0 };
  const unids = unidadesVisiveis().map(u => u.email);
  if (!unids.length) return resultado;

  const snap = await getDocs(query(collection(db, 'solicitacoes'), orderBy('criadoEm', 'desc')));
  snap.forEach(d => {
    const s = d.data();
    const jaNegado = (s.assinantes || []).some(a => a.status === 'negado');

    if (!jaNegado) {
      if (modoLeitura()) {
        const temPendente = (s.assinantes || []).some(
          a => a.emailUnidade === unidadeSelecionada.email && a.status === 'pendente'
        );
        if (temPendente) resultado.aguardando++;
      } else if (podeAssinar()) {
        const minhaAssinatura = (s.assinantes || []).find(a => a.email === usuarioAtual.email);
        if (minhaAssinatura?.status === 'pendente') resultado.aguardando++;
      }
    }

    const origemCorresponde = unids.includes(s.emailUnidadeOrigem);
    const criadoPorMim = !modoLeitura() && s.emailCriador === usuarioAtual.email;
    const cat = _classeDoc(s);

    if (origemCorresponde || criadoPorMim) {
      if (cat === 'andamento') resultado.andamento++;
      else if (cat === 'negado') resultado.negado++;
      else if (cat === 'concluido') resultado.concluido++;
    } else if (cat === 'andamento') {
      const envolvido = (s.assinantes || []).some(a =>
        unids.includes(a.emailUnidade) || (!modoLeitura() && a.email === usuarioAtual.email)
      );
      if (envolvido) resultado.externaAndamento++;
    }
  });
  return resultado;
}

function _indicadorCard(n, label, cor, onclickExpr, legenda) {
  return `<button onclick="${onclickExpr}" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow-sm);padding:16px 12px;text-align:center;cursor:pointer;font-family:inherit;">
    <span style="display:block;font-size:1.7rem;font-weight:800;color:${cor};line-height:1;">${n}</span>
    <span style="display:block;font-size:.66rem;font-weight:600;color:var(--txt-3);text-transform:uppercase;letter-spacing:.04em;margin-top:6px;">${label}</span>
    ${legenda ? `<span style="display:block;font-size:.64rem;color:var(--txt-4,var(--txt-3));margin-top:3px;font-weight:400;text-transform:none;letter-spacing:0;">${legenda}</span>` : ''}
  </button>`;
}

// ── Busca (com cache) as solicitações de um escopo: 'local' (origem é esta unidade)
// ou 'externa' (outra unidade é origem, mas esta unidade está entre os assinantes). ──
let _transfDocsCache = { local: null, externa: null };

async function _buscarTransferenciasEscopo(escopo) {
  if (_transfDocsCache[escopo]) return _transfDocsCache[escopo];
  const unids = unidadesVisiveis().map(u => u.email);
  const snap = await getDocs(query(collection(db, 'solicitacoes'), orderBy('criadoEm', 'desc')));
  const lista = [];
  snap.forEach(d => {
    const s = { id: d.id, ...d.data() };
    const origemLocal = unids.includes(s.emailUnidadeOrigem);
    const criadoPorMim = !modoLeitura() && s.emailCriador === usuarioAtual.email;
    if (escopo === 'local' && (origemLocal || criadoPorMim)) { lista.push(s); return; }
    if (escopo === 'externa' && !origemLocal) {
      const envolvido = (s.assinantes || []).some(a =>
        unids.includes(a.emailUnidade) || (!modoLeitura() && a.email === usuarioAtual.email)
      );
      if (envolvido) lista.push(s);
    }
  });
  _transfDocsCache[escopo] = lista;
  return lista;
}

// ── Tela intermediária: Pendente(s) de Assinatura(s) / Histórico, para um escopo ──
window._mostrarSubGrupoTransf = function(escopo) {
  _novaRenderizacao();
  _grupoAtivo = escopo === 'local' ? 'transf_local' : 'transf_externa';
  _abaAtiva   = null;
  _atualizarBreadcrumb();
  document.querySelector('.p-abas').style.display = 'none';

  const corpo = document.getElementById('p-corpo');
  corpo.className = '';

  const unNome = escHtml(escopoAtual?.unidade?.nome || escopoAtual?.n || escopoAtual?.nome || '');
  const titulo = escopo === 'local' ? `Solicitação de ${unNome || 'Unidade'}` : 'Solicitação de Outra Unidade';
  const backBtn = `<button class="p-bc-btn" onclick="mostrarLandingGrupos()" style="display:flex;align-items:center;gap:5px;margin-bottom:20px;font-size:.82rem;">← Voltar</button>`;

  corpo.innerHTML = `
  <div style="padding:24px 32px 40px;">
    ${backBtn}
    <h2 style="font-size:1rem;font-weight:700;color:var(--txt-1);margin:0 0 20px;">${titulo}</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;max-width:760px;">
      <button class="p-sub-card" onclick="abrirTransferenciasEscopo('${escopo}','pendentes')">
        <span class="p-sub-card-icon">✍️</span>
        <span class="p-sub-card-titulo">Pendente(s) de Assinatura(s)</span>
        <span class="p-sub-card-sub">Ainda em andamento, sem negativa registrada</span>
      </button>
      <button class="p-sub-card" onclick="abrirTransferenciasEscopo('${escopo}','historico')">
        <span class="p-sub-card-icon">📂</span>
        <span class="p-sub-card-titulo">Histórico de Pedidos de Transferência${escopo === 'externa' ? ' de Outra Unidade' : ' Local'}</span>
        <span class="p-sub-card-sub">Concluídas, com negativa ou canceladas</span>
      </button>
    </div>
  </div>`;
};

// ── Abre a lista (Pendente ou Histórico) de um escopo ──
let _transfHistDocsAtual   = [];
let _transfHistEscopoAtual = 'local';
let _transfHistFiltroAtual = 'todos';

window.abrirTransferenciasEscopo = async function(escopo, sub) {
  _abaAtiva   = `${escopo}_${sub}`;
  _grupoAtivo = escopo === 'local' ? 'transf_local' : 'transf_externa';
  _atualizarBreadcrumb();

  const corpo = document.getElementById('p-corpo');
  corpo.className = '';
  corpo.innerHTML = '<div class="p-loading">Carregando…</div>';

  const rid = _novaRenderizacao();
  const lista = await _buscarTransferenciasEscopo(escopo);
  if (!_renderAtual(rid)) return;

  if (sub === 'pendentes') {
    const filtrada = lista.filter(s => _classeDoc(s) === 'andamento');
    renderizarLista(corpo, filtrada, escopo === 'local' ? 'localPendentes' : 'externaPendentes');
  } else {
    _transfHistEscopoAtual = escopo;
    _transfHistFiltroAtual = 'todos';
    _transfHistDocsAtual   = lista.filter(s => _classeDoc(s) !== 'andamento');
    _renderizarTransfHistorico(corpo);
  }
};

function _renderizarTransfHistorico(corpo) {
  const opcoes = [
    ['todos',     'Todos'],
    ['concluido', 'Concluída'],
    ['negado',    'Com negativa'],
    ['cancelado', 'Cancelada'],
  ];
  corpo.innerHTML = `
    <div style="margin-bottom:14px;">
      <select onchange="filtrarTransfHistorico(this.value)"
        style="max-width:260px;width:100%;padding:8px 12px;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg-card);color:var(--txt-1);font-family:inherit;font-size:.82rem;">
        ${opcoes.map(([v, l]) => `<option value="${v}" ${_transfHistFiltroAtual === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
    </div>
    <div id="p-transf-hist-lista"></div>`;
  _renderizarTransfHistoricoLista();
}

function _renderizarTransfHistoricoLista() {
  const el = document.getElementById('p-transf-hist-lista');
  if (!el) return;
  const filtrada = _transfHistFiltroAtual === 'todos'
    ? _transfHistDocsAtual
    : _transfHistDocsAtual.filter(s => _classeDoc(s) === _transfHistFiltroAtual);
  renderizarLista(el, filtrada, _transfHistEscopoAtual === 'local' ? 'localHistorico' : 'externaHistorico');
}

window.filtrarTransfHistorico = function (valor) {
  _transfHistFiltroAtual = valor;
  _renderizarTransfHistoricoLista();
};

window.mostrarLandingGrupos = async function() {
  _grupoAtivo = null;
  _abaAtiva   = null;
  _atualizarBreadcrumb();
  document.querySelector('.p-abas').style.display = 'none';
  _transfDocsCache = { local: null, externa: null }; // reseta cache ao voltar pra Home

  const corpo = document.getElementById('p-corpo');
  corpo.className = 'p-home-wide';
  corpo.innerHTML = '<div class="p-loading">Carregando…</div>';

  const unNome = escHtml(escopoAtual?.unidade?.nome || escopoAtual?.n || escopoAtual?.nome || '');

  const rid = _novaRenderizacao();
  const { aguardando, andamento, negado, concluido, externaAndamento } = await _contarSituacaoUnidade();
  if (!_renderAtual(rid)) return; // o usuário já foi para outra tela

  const badgeAc = document.getElementById('p-badge-acessos');
  const nAcessos = badgeAc && badgeAc.style.display !== 'none' ? (parseInt(badgeAc.textContent, 10) || 0) : 0;
  // Cadastros de servidores (com CPF): só Diretor/CPEN da unidade e CRV
  const mostraAcesso = ['dir', 'cpen'].includes(perfilAtual) || (['crv', 'super'].includes(perfilAtual) && modoLeitura());

  const linhasTransf = [
    { onclick: `_mostrarSubGrupoTransf('local')`,   icon: '🏢', titulo: `Solicitação de ${unNome || 'Unidade'}`, sub: 'Pedidos originados por esta unidade', badge: andamento },
    { onclick: `_mostrarSubGrupoTransf('externa')`, icon: '📥', titulo: 'Solicitação de Outra Unidade', sub: 'Pedidos que dependem de manifestação desta unidade', badge: externaAndamento },
  ];

  const _linhaTransf = (it) => `
    <button class="p-transf-row" onclick="${it.onclick}">
      <span class="p-transf-icon">${it.icon}</span>
      <div class="p-transf-corpo">
        <div class="p-transf-titulo">${it.titulo}</div>
        <div class="p-transf-sub">${it.sub}</div>
      </div>
      ${it.badge ? `<span class="p-transf-badge">${it.badge}</span>` : ''}
      <span class="p-transf-arrow">›</span>
    </button>`;

  corpo.innerHTML = `
  <div style="padding:28px 32px 40px;">
    ${unNome ? `<p style="font-size:.78rem;color:var(--txt-3);margin:0 0 4px;">📍 ${unNome}</p>` : ''}
    <h1 style="font-size:1.15rem;font-weight:800;color:var(--txt-1);margin:0 0 6px;">VISÃO GERAL</h1>
    <p style="font-size:.88rem;color:var(--txt-2);margin:0 0 22px;">${_fraseSituacao(aguardando)}</p>

    ${aguardando > 0 ? `
    <div style="background:var(--amarelo-light);border:1px solid var(--amarelo);border-radius:var(--radius);padding:16px 20px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
      <div>
        <div style="font-size:.85rem;font-weight:700;color:var(--txt-1);margin-bottom:2px;">⚠️ Atenção</div>
        <div style="font-size:.8rem;color:var(--txt-2);">${_fraseSituacao(aguardando)}</div>
      </div>
      <button class="p-btn" style="background:var(--azul-600);color:#fff;white-space:nowrap;" onclick="carregarAba('pendentes')">Ver pendências →</button>
    </div>` : ''}

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;max-width:980px;margin-bottom:28px;">
      ${_indicadorCard(aguardando, 'DOCUMENTOS PENDENTES DE ASSINATURA', 'var(--amarelo)', "carregarAba('pendentes')", '')}
      ${_indicadorCard(andamento,  'Em andamento',          'var(--azul-600)', "abrirTransferenciasEscopo('local','pendentes')", 'Pendente de alguma(s) assinatura(s)')}
      ${_indicadorCard(concluido,  'Concluídas',            'var(--verde)', "abrirTransferenciasEscopo('local','historico')", 'Assinatura de todos os envolvidos')}
      ${_indicadorCard(negado,     'ENCERRADO',             'var(--vermelho)', "carregarAba('historico')", 'Processo encerrado de plano em razão da recusa de assinatura')}
    </div>

    <div class="p-transf-lista" style="max-width:980px;margin-bottom:28px;">${_btnMural()}</div>

    <h2 style="font-size:.9rem;font-weight:700;color:var(--txt-1);margin:0 0 12px;">📋 Transferências - Assinaturas</h2>
    <div class="p-transf-lista" style="max-width:980px;margin-bottom:${mostraAcesso ? '28px' : '0'};">
      ${linhasTransf.map(_linhaTransf).join('')}
    </div>

    ${mostraAcesso ? `
    <h2 style="font-size:.9rem;font-weight:700;color:var(--txt-1);margin:0 0 12px;">🔐 Controle de Acesso de Usuários</h2>
    <div class="p-transf-lista" style="max-width:980px;">
      <button class="p-transf-row" onclick="_mostrarSubGrupo('acesso')">
        <span class="p-transf-icon">👤</span>
        <div class="p-transf-corpo">
          <div class="p-transf-titulo">Usuários</div>
          <div class="p-transf-sub">${nAcessos ? nAcessos + ' solicitação(ões) de acesso pendente(s)' : 'Gerenciar acesso dos servidores da unidade'}</div>
        </div>
        ${nAcessos ? `<span class="p-transf-badge" style="background:#f59e0b;">${nAcessos}</span>` : ''}
        <span class="p-transf-arrow">›</span>
      </button>
    </div>` : ''}
  </div>`;
};

window._mostrarSubGrupo = function(grupoId) {
  _novaRenderizacao();
  _grupoAtivo = grupoId;
  _abaAtiva   = null;
  _atualizarBreadcrumb();
  document.querySelector('.p-abas').style.display = 'none';

  const corpo = document.getElementById('p-corpo');
  corpo.className = '';

  const unNome = escHtml(escopoAtual?.unidade?.nome || escopoAtual?.n || escopoAtual?.nome || '');

  const backBtn = `<button class="p-bc-btn" onclick="mostrarLandingGrupos()" style="display:flex;align-items:center;gap:5px;margin-bottom:20px;font-size:.82rem;">← Voltar</button>`;

  /* ── TRANSFERÊNCIAS ── */
  if (grupoId === 'transferencias') {
    const badge = document.getElementById('p-badge-pendentes');
    const nPend = badge && badge.style.display !== 'none' ? badge.textContent : '';
    const itens = [
      { aba: 'pendentes', icon: '✍️', titulo: 'Assinaturas Pendentes', sub: 'Documentos aguardando sua anuência', badge: nPend },
      { aba: 'historico', icon: '📂', titulo: 'Histórico',              sub: 'Pedidos realizados' },
    ];
    corpo.innerHTML = `
    <div style="padding:24px 32px 40px;">
      ${backBtn}
      <h2 style="font-size:1rem;font-weight:700;color:var(--txt-1);margin:0 0 20px;">📋 Transferências - Assinaturas</h2>
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
  /* Rastreia grupo e aba para breadcrumb (navegação em cartões) */
  _abaAtiva   = aba;
  _grupoAtivo = _GRUPO_DE_ABA[aba] || _grupoAtivo;
  _atualizarBreadcrumb();

  /* Limpa seleções ao trocar de aba */
  _selSols.clear(); _selAcess.clear();
  _atualizarBarra();

  const corpo = document.getElementById('p-corpo');
  corpo.className = '';
  corpo.innerHTML = '<div class="p-loading">Carregando…</div>';

  // Abas com lógica própria
  if (aba === 'acessos')     { await carregarAbaAcessos(corpo);     return; }

  const unids = unidadesVisiveis().map(u => u.email);
  if (!unids.length) {
    corpo.innerHTML = '<div class="p-vazio">Nenhuma unidade no seu escopo.</div>';
    return;
  }

  try {
    let solicitacoes = [];
    const rid = _novaRenderizacao();
    const snap = await getDocs(
      query(collection(db, 'solicitacoes'), orderBy('criadoEm', 'desc'))
    );
    if (!_renderAtual(rid)) return;

    if (aba === 'pendentes') {
      snap.forEach(d => {
        const s = { id: d.id, ...d.data() };
        // Regra de negócio: uma negativa de qualquer envolvido encerra o processo
        // (transferência exige anuência de todos). Um pedido já negado não é mais "pendente"
        // para ninguém, mesmo que outro assinante ainda não tenha se manifestado.
        if ((s.assinantes || []).some(a => a.status === 'negado')) return;

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
      // Inclui todos os status (inclusive cancelado); o filtro de exibição é aplicado
      // depois por _renderizarHistorico, preservando "exceto cancelado" como padrão inicial.
      snap.forEach(d => {
        const s = { id: d.id, ...d.data() };
        const envolvido = (s.assinantes || []).some(a =>
          unids.includes(a.emailUnidade) ||
          (!modoLeitura() && a.email === usuarioAtual.email)
        );
        if (envolvido || unids.includes(s.emailUnidadeOrigem)) solicitacoes.push(s);
      });
      _historicoDocsCache = solicitacoes;
      _renderizarHistorico(corpo);
      return;

    } else if (aba === 'negados') {
      snap.forEach(d => {
        const s = { id: d.id, ...d.data() };
        if (calcularStatusGeral(s.assinantes || [], s.statusGeral).classe !== 'negado') return;
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
    const temExcl  = ids.some(id => { const r = _selAcessData.find(x => x.id === id); return ['pendente','recusado','revogado'].includes(r?.status); });
    const analisa = _podeAnalisarAcesso(), modera = _podeModerarAcesso();
    if (temPend && analisa)  acoes.insertAdjacentHTML('beforeend',
      `<button class="p-barra-btn p-barra-btn-apr" onclick="bulkAprovar()">✅ Aprovar selecionados</button>`);
    if (temPend && analisa)  acoes.insertAdjacentHTML('beforeend',
      `<button class="p-barra-btn p-barra-btn-neg" onclick="bulkRecusar()">Recusar selecionados</button>`);
    if (temAprov && modera) acoes.insertAdjacentHTML('beforeend',
      `<button class="p-barra-btn p-barra-btn-neg" onclick="bulkRevogar()">Suspender selecionados</button>`);
    const temSusp = ids.some(id => _selAcessData.find(x => x.id === id)?.status === 'revogado');
    if (temSusp && analisa) acoes.insertAdjacentHTML('beforeend',
      `<button class="p-barra-btn p-barra-btn-apr" onclick="bulkReativar()">Reativar selecionados</button>`);
    if (temExcl && modera)  acoes.insertAdjacentHTML('beforeend',
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
  if (!confirm(`Suspender ${ids.length} acesso(s)?`)) return;
  let ok = 0, err = 0;
  for (const id of ids) {
    try {
      await updateDoc(doc(db, 'usuarios_cadastrados', id), { status: 'revogado', aprovadoPor: usuarioAtual.email, aprovadoEm: serverTimestamp() });
      ok++;
    } catch { err++; }
  }
  selLimpar(); showToastPainel(`${ok} acesso(s) suspenso(s)${err ? ` · ${err} erro(s)` : ''}.`); carregarAba('acessos');
};
window.bulkReativar = async function() {
  const ids = [..._selAcess].filter(id => _selAcessData.find(x => x.id === id)?.status === 'revogado');
  if (!ids.length) return;
  if (!confirm(`Reativar ${ids.length} acesso(s)?`)) return;
  let ok = 0, err = 0;
  for (const id of ids) {
    try {
      await updateDoc(doc(db, 'usuarios_cadastrados', id), { status: 'aprovado', aprovadoPor: usuarioAtual.email, aprovadoEm: serverTimestamp(), motivoRecusa: null });
      ok++;
    } catch { err++; }
  }
  selLimpar(); showToastPainel(`${ok} acesso(s) reativado(s)${err ? ` · ${err} erro(s)` : ''}.`); carregarAba('acessos');
};

window.bulkExcluirAcess = async function() {
  const ids = [..._selAcess].filter(id => ['pendente','recusado','revogado'].includes(_selAcessData.find(x => x.id === id)?.status));
  if (!ids.length) return;
  if (!confirm(`Excluir permanentemente ${ids.length} cadastro(s)?`)) return;
  let ok = 0, err = 0;
  for (const id of ids) {
    try { await deleteDoc(doc(db, 'usuarios_cadastrados', id)); ok++; } catch { err++; }
  }
  selLimpar(); showToastPainel(`${ok} cadastro(s) excluído(s)${err ? ` · ${err} erro(s)` : ''}.`); carregarAba('acessos');
};

// ── RENDERIZA LISTA ──
// ── Histórico: cache + filtro de status em memória (sem nova leitura ao trocar o filtro) ──
let _historicoDocsCache = [];
let _historicoFiltroStatus = 'ativos'; // 'ativos' = todos, exceto cancelados (comportamento padrão)

function _aplicarFiltroHistorico(lista) {
  if (_historicoFiltroStatus === 'todos') return lista;
  if (_historicoFiltroStatus === 'ativos') return lista.filter(s => s.statusGeral !== 'cancelado');
  return lista.filter(s => calcularStatusGeral(s.assinantes || [], s.statusGeral).classe === _historicoFiltroStatus);
}

function _renderizarHistorico(corpo) {
  const opcoes = [
    ['ativos',    'Todos, exceto cancelados'],
    ['todos',     'Todos'],
    ['andamento', 'Em andamento'],
    ['concluido', 'Concluída'],
    ['negado',    'Com negativa'],
    ['cancelado', 'Cancelada'],
  ];
  corpo.innerHTML = `
    <div style="margin-bottom:14px;">
      <select id="p-historico-filtro" onchange="filtrarHistorico(this.value)"
        style="max-width:260px;width:100%;padding:8px 12px;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg-card);color:var(--txt-1);font-family:inherit;font-size:.82rem;">
        ${opcoes.map(([v, l]) => `<option value="${v}" ${_historicoFiltroStatus === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
    </div>
    <div id="p-historico-lista"></div>`;
  renderizarLista(document.getElementById('p-historico-lista'), _aplicarFiltroHistorico(_historicoDocsCache), 'historico');
}

window.filtrarHistorico = function (valor) {
  _historicoFiltroStatus = valor;
  const listaEl = document.getElementById('p-historico-lista');
  if (listaEl) renderizarLista(listaEl, _aplicarFiltroHistorico(_historicoDocsCache), 'historico');
};

function renderizarLista(el, lista, tipo) {
  _selSols.clear();
  _selSolsData = lista;
  _selCtx = 'sols';

  const msgs = {
    pendentes:  'Nenhuma assinatura pendente.',
    minhas:     'Nenhuma solicitação encontrada.',
    historico:  'Nenhum registro no histórico.',
    cancelados: 'Nenhuma solicitação cancelada.',
    negados:    'Nenhuma solicitação com negativa.',
    localPendentes:   'Nenhuma solicitação local pendente de assinatura.',
    localHistorico:   'Nenhum registro no histórico local.',
    externaPendentes: 'Nenhuma solicitação de outra unidade pendente de assinatura.',
    externaHistorico: 'Nenhum registro no histórico de outras unidades.',
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
              ${a.status === 'negado' && _motivoNeg(a) ? `<span class="p-assinante-motivo">— ${escHtml(_motivoNeg(a))}</span>` : ''}
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

/* Negativas antigas feitas pelo sino gravavam o texto em 'motivoNegacao' */
function _motivoNeg(a) { return a.motivo || a.motivoNegacao || ''; }

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

// Atalho do painel da CRV / Superintendente para a lista de usuários cadastrados
function _btnUsuariosDash() {
  return `<div style="padding:14px 32px 0;">
    <button class="p-transf-row" onclick="abrirUsuariosPainel()" style="max-width:980px;">
      <span class="p-transf-icon">👤</span>
      <div class="p-transf-corpo">
        <div class="p-transf-titulo">Usuários cadastrados</div>
        <div class="p-transf-sub">Consultar, suspender ou excluir acessos de servidores</div>
      </div>
      <span class="p-transf-arrow">›</span>
    </button>
    ${_btnMural('margin-top:8px;')}
  </div>`;
}
window.abrirUsuariosPainel = function () { carregarAba('acessos'); };
window.mostrarDashboard = function () { mostrarDashboard(); };

async function mostrarDashboard() {
  document.querySelector('.p-abas').style.display = 'none';
  const corpo = document.getElementById('p-corpo');
  corpo.className = 'dashboard-mode';

  // CRV sem SR selecionada: visão geral do estado (antes ficava vazia, sem nenhum número)
  corpo.innerHTML = '<div class="p-loading" style="padding:32px;">Carregando painel…</div>';
  _dashFiltro = { sr: '', un: '', cat: '' };
  try {
    const rid = _novaRenderizacao();
    const snap = await getDocs(query(collection(db, 'solicitacoes'), orderBy('criadoEm', 'desc')));
    if (!_renderAtual(rid)) return;
    _dashDocs = [];
    snap.forEach(d => {
      const s = { id: d.id, ...d.data() };
      s._cat = getCategoria(s);
      _dashDocs.push(s);
    });
    if (perfilAtual === 'crv' && !srSelecionada) {
      _renderDashCRV(corpo);
    } else {
      _renderDashSR(corpo);
    }
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
    ${_btnUsuariosDash()}
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
    ${_btnUsuariosDash()}
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
          ${_motivoNeg(a) ? `<div style="font-size:.75rem;color:var(--vermelho);margin-top:2px;">Negativa: ${escHtml(_motivoNeg(a))}</div>` : ''}
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
          ${_motivoNeg(a) ? `<br><span style="color:#dc2626;font-size:8pt;">Motivo: ${escHtml(_motivoNeg(a))}</span>` : ''}
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
// Quem faz o quê com os cadastros de servidores:
//   Diretor / CPEN da unidade → analisam: aprovar, recusar, reabrir pedido
//   CRV                       → analisa como Diretor/CPEN (em qualquer unidade) e também
//                               move o servidor de unidade. Não recebe notificação de cadastros.
//   Superintendente           → modera: vê a regional, suspende e exclui
function _podeAnalisarAcesso() { return perfilAtual === 'crv' || (['dir', 'cpen'].includes(perfilAtual) && !modoLeitura()); }
function _podeModerarAcesso()  { return _podeAnalisarAcesso() || perfilAtual === 'super'; }
function _podeMoverUnidade()   { return perfilAtual === 'crv'; }

const _STATUS_ACESSO = {
  pendente: { label: 'Pendente', classe: 'p-status-pendente' },
  aprovado: { label: 'Aprovado', classe: 'p-status-concluido' },
  revogado: { label: 'Suspenso', classe: 'p-status-negado' },
  recusado: { label: 'Recusado', classe: 'p-status-negado' },
};

let _acessosTodos  = [];
let _acessosFiltro = { sr: '', un: '', status: '', busca: '' };
let _acessosEl     = null;

async function carregarAbaAcessos(el) {
  const rid = _novaRenderizacao();
  _acessosEl = el;
  try {
    const col = collection(db, 'usuarios_cadastrados');
    let q;
    if (perfilAtual === 'super') {
      // Superintendente: só a própria regional (a regra do Firestore exige o filtro por srUnidade)
      q = modoLeitura()
        ? query(col, where('srUnidade', '==', escopoAtual.codigo), where('emailUnidade', '==', unidadeSelecionada.email))
        : query(col, where('srUnidade', '==', escopoAtual.codigo));
    } else if (modoLeitura()) {
      q = query(col, where('emailUnidade', '==', unidadeSelecionada.email));      // CRV vendo uma unidade
    } else if (perfilAtual === 'crv') {
      q = srSelecionada ? query(col, where('srUnidade', '==', srSelecionada)) : col; // CRV: regional ou estado
    } else {
      q = query(col, where('emailUnidade', '==', escopoAtual.email));             // Diretor / CPEN
    }

    const snap = await getDocs(q);
    if (!_renderAtual(rid)) return;
    const ordem = { pendente: 0, aprovado: 1, revogado: 2, recusado: 3 };
    _acessosTodos = [];
    snap.forEach(d => _acessosTodos.push({ id: d.id, ...d.data() }));
    _acessosTodos.sort((a, b) => ((ordem[a.status] ?? 9) - (ordem[b.status] ?? 9))
                                 || (a.nome || '').localeCompare(b.nome || ''));
    _renderAcessos();
  } catch (e) {
    el.innerHTML = `<div class="p-erro-msg">Erro ao carregar usuários: ${escHtml(e.message)}</div>`;
  }
}

function _renderAcessos() {
  const el = _acessosEl;
  if (!el) return;
  const visaoAmpla = ['crv', 'super'].includes(perfilAtual) && !modoLeitura();
  const f = _acessosFiltro;

  // Unidades do escopo (para o filtro)
  const srEscopo = perfilAtual === 'super' ? escopoAtual.codigo : (srSelecionada || f.sr);
  const unidadesFiltro = UNIDADES.filter(u => !srEscopo || u.sr === srEscopo);
  const opcoes = (lista, atual) => lista.map(([v, l]) => `<option value="${escHtml(v)}"${v === atual ? ' selected' : ''}>${escHtml(l)}</option>`).join('');

  const contar = st => _acessosTodos.filter(r => r.status === st).length;
  const estilo = 'padding:8px 10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg-card);color:var(--txt-1);font-family:inherit;font-size:.82rem;';

  const filtros = `
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
      ${perfilAtual === 'crv' && visaoAmpla && !srSelecionada ? `
        <select style="${estilo}" onchange="filtrarAcessos('sr', this.value)">
          <option value="">Todas as regionais</option>
          ${opcoes(Object.keys(SR_INFO).sort().map(s => [s, s + ' — ' + (SR_INFO[s]?.nome || s)]), f.sr)}
        </select>` : ''}
      ${visaoAmpla ? `
        <select style="${estilo}" onchange="filtrarAcessos('un', this.value)">
          <option value="">Todas as unidades</option>
          ${opcoes(unidadesFiltro.map(u => [u.email, u.nome]), f.un)}
        </select>` : ''}
      <select style="${estilo}" onchange="filtrarAcessos('status', this.value)">
        <option value="">Todas as situações (${_acessosTodos.length})</option>
        ${opcoes(['pendente', 'aprovado', 'revogado', 'recusado'].map(s => [s, _STATUS_ACESSO[s].label + ' (' + contar(s) + ')']), f.status)}
      </select>
      <input type="search" placeholder="🔍 Buscar por nome ou e-mail" value="${escHtml(f.busca)}"
             oninput="filtrarAcessos('busca', this.value)" style="${estilo}flex:1;min-width:180px;">
    </div>`;

  const voltar = _ehNavCartoes() ? '' :
    `<button class="p-bc-btn" onclick="mostrarDashboard()" style="display:flex;align-items:center;gap:5px;margin-bottom:14px;font-size:.82rem;">← Voltar ao painel</button>`;
  const escopoTxt = perfilAtual === 'super'
    ? `Servidores das unidades da ${escHtml(SR_INFO[escopoAtual.codigo]?.nome || escopoAtual.codigo)}`
    : perfilAtual === 'crv' && visaoAmpla
      ? (srSelecionada ? `Servidores da ${escHtml(SR_INFO[srSelecionada]?.nome || srSelecionada)}` : 'Servidores de todas as unidades do estado')
      : 'Servidores da unidade';
  const aviso = _podeAnalisarAcesso() ? '' : `
    <div style="margin:0 0 12px;padding:9px 12px;border-radius:var(--radius);background:var(--azul-50);border-left:3px solid var(--azul-400);font-size:.76rem;color:var(--txt-2);">
      A aprovação e a recusa de cadastros são feitas pelo Diretor(a) ou CPEN de cada unidade.
      Aqui você pode consultar, <strong>suspender</strong> ou <strong>excluir</strong> acessos.
    </div>`;

  el.innerHTML = `
    <div>
      ${voltar}
      <h2 style="font-size:1rem;font-weight:700;color:var(--txt-1);margin:0 0 2px;">👤 Usuários cadastrados</h2>
      <p style="font-size:.78rem;color:var(--txt-3);margin:0 0 14px;">${escopoTxt}</p>
      ${aviso}
      ${filtros}
      <div id="p-acessos-lista"></div>
    </div>`;
  _renderAcessosLista();
}

window.filtrarAcessos = function (campo, valor) {
  _acessosFiltro[campo] = valor;
  if (campo === 'sr') { _acessosFiltro.un = ''; _renderAcessos(); return; } // atualiza a lista de unidades
  _renderAcessosLista();
};

function _renderAcessosLista() {
  const el = document.getElementById('p-acessos-lista');
  if (!el) return;
  const f = _acessosFiltro;
  const termo = (f.busca || '').trim().toLowerCase();
  const registros = _acessosTodos.filter(r =>
    (!f.status || r.status === f.status) &&
    (!f.un || r.emailUnidade === f.un) &&
    (!f.sr || r.srUnidade === f.sr) &&
    (!termo || (r.nome || '').toLowerCase().includes(termo) || (r.email || '').toLowerCase().includes(termo))
  );

  _selAcess.clear();
  _selAcessData = registros;
  _selCtx = 'acess';

  if (!registros.length) {
    el.innerHTML = `<div class="p-vazio">${_acessosTodos.length ? 'Nenhum usuário com esses filtros.' : 'Nenhum cadastro de servidor encontrado.'}</div>`;
    _atualizarBarra();
    return;
  }

  const analisa = _podeAnalisarAcesso();
  const modera  = _podeModerarAcesso();
  const cabSel = `<div class="p-sel-header">
    <label><input type="checkbox" class="p-sel-all-check" data-ctx="acc" onchange="selAccAll(this)"> Selecionar todos (${registros.length})</label>
  </div>`;

  el.innerHTML = cabSel + registros.map(r => {
    const info = _STATUS_ACESSO[r.status] || { label: r.status, classe: 'p-status-andamento' };
    const dataCad = r.criadoEm?.toDate  ? r.criadoEm.toDate().toLocaleDateString('pt-BR')   : '—';
    const dataApr = r.aprovadoEm?.toDate ? r.aprovadoEm.toDate().toLocaleDateString('pt-BR') : null;

    /* Nome/e-mail vêm do cadastro (texto livre do usuário) — passados via data-*,
       nunca interpolados dentro do JavaScript do onclick. */
    const dadosPessoa = `data-id="${escHtml(r.id)}" data-nome="${escHtml(r.nome || '')}" data-email="${escHtml(r.email || '')}"`;
    const acoes = [];
    const btnExcluir = `<button class="p-btn p-btn-outline" ${dadosPessoa} onclick="excluirCadastro(this.dataset.id,this.dataset.nome)">Excluir</button>`;
    const btnMover = `<button class="p-btn p-btn-outline" ${dadosPessoa} onclick="abrirMoverUnidade(this.dataset.id,this.dataset.nome)">Mover de unidade</button>`;
    if (r.status === 'pendente') {
      if (analisa) {
        acoes.push(`<button class="p-btn p-btn-assinar" onclick="aprovarAcesso('${r.id}')">Aprovar</button>`);
        acoes.push(`<button class="p-btn p-btn-negar"   onclick="abrirModalNegarAcesso('${r.id}')">Recusar</button>`);
      }
      if (modera) acoes.push(btnExcluir);
    } else if (r.status === 'aprovado') {
      if (modera) {
        acoes.push(`<button class="p-btn p-btn-outline" ${dadosPessoa} onclick="redefinirSenhaUsuario(this.dataset.id,this.dataset.email,this.dataset.nome)">Redefinir senha</button>`);
        acoes.push(`<button class="p-btn p-btn-negar" ${dadosPessoa} onclick="revogarAcesso(this.dataset.id,this.dataset.nome)">Suspender acesso</button>`);
      }
    } else if (r.status === 'revogado') {
      // Suspenso: Diretor/CPEN da unidade e CRV reativam direto (volta a "aprovado")
      if (analisa) acoes.push(`<button class="p-btn p-btn-assinar" ${dadosPessoa} onclick="reativarAcesso(this.dataset.id,this.dataset.nome)">Reativar acesso</button>`);
      if (modera) acoes.push(btnExcluir);
    } else if (r.status === 'recusado') {
      if (analisa) acoes.push(`<button class="p-btn p-btn-outline" onclick="reativarPendente('${r.id}')">Reabrir pedido</button>`);
      if (modera) acoes.push(btnExcluir);
    }
    if (_podeMoverUnidade()) acoes.push(btnMover);

    // Superintendente vê o CPF mascarado (LGPD); Diretor/CPEN e CRV veem completo
    const cpfDig = (r.cpf || '').replace(/\D/g, '');
    const cpfFmt = !cpfDig ? '—'
      : perfilAtual === 'super' ? `***.${cpfDig.slice(3, 6)}.${cpfDig.slice(6, 9)}-**`
      : cpfDig.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    // Gravada como aaaa-mm-dd (campo de data do formulário) → exibe dd/mm/aaaa
    const nascFmt = perfilAtual === 'super' ? '—'
      : (r.dataNascimento || '').replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1') || '—';
    const iniciais = escHtml((r.nome || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase());
    const rotAcao = r.status === 'revogado' ? 'Suspenso por' : r.status === 'recusado' ? 'Recusado por' : 'Aprovado por';
    return `
    <div class="p-card p-card-compact" id="acard-${r.id}">
      <div class="p-card-row" onclick="pAccToggle('${r.id}')">
        <input type="checkbox" class="p-card-check" data-ctx="acc" onchange="selAccToggle('${r.id}')" onclick="event.stopPropagation()" title="Selecionar">
        <span class="p-card-avatar">${iniciais}</span>
        <span class="p-status ${info.classe}" style="flex-shrink:0;">${info.label}</span>
        <span class="p-card-titulo-row" style="cursor:pointer;">${escHtml(r.nome || '—')}</span>
        <span class="p-card-meta-row">${escHtml(r.nomeUnidade || '—')} · ${dataCad}</span>
        <span class="p-card-arrow" id="aarrow-${r.id}">▶</span>
      </div>
      <div class="p-card-body" id="acbody-${r.id}" style="display:none;">
        <div style="padding:10px 16px 6px;display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;font-size:.78rem;">
          <div><span style="color:var(--txt-3);">E-mail:</span> ${escHtml(r.email || '—')}</div>
          <div><span style="color:var(--txt-3);">CPF:</span> ${escHtml(cpfFmt)}</div>
          ${perfilAtual === 'super' ? '' : `<div><span style="color:var(--txt-3);">Nascimento:</span> ${escHtml(nascFmt)}</div>`}
          <div><span style="color:var(--txt-3);">Unidade:</span> ${escHtml(r.nomeUnidade || r.emailUnidade || '—')}</div>
          ${dataApr ? `<div><span style="color:var(--txt-3);">${rotAcao}:</span> ${escHtml(r.aprovadoPor || '—')} em ${dataApr}</div>` : ''}
          ${r.motivoRecusa ? `<div style="grid-column:1/-1;color:var(--vermelho);"><span style="color:var(--txt-3);">Motivo recusa:</span> ${escHtml(r.motivoRecusa)}</div>` : ''}
        </div>
        ${acoes.length ? `<div class="p-card-acoes">${acoes.join('')}</div>` : ''}
      </div>
    </div>`;
  }).join('');
  _atualizarBarra();
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

// ── Suspender (aprovado → revogado) — Diretor/CPEN, CRV e Superintendente ──
window.revogarAcesso = async function (id, nome) {
  if (!confirm(`Suspender o acesso de "${nome || 'este usuário'}"?\n\nEle deixa de conseguir entrar no sistema. O Diretor(a) ou CPEN da unidade, ou a CRV, pode reativar depois.`)) return;
  try {
    await updateDoc(doc(db, 'usuarios_cadastrados', id), {
      status:      'revogado',
      aprovadoPor: usuarioAtual.email,
      aprovadoEm:  serverTimestamp(),
    });
    showToastPainel('Acesso suspenso.');
    carregarAba('acessos');
  } catch (e) { showToastPainel('Erro: ' + e.message); }
};

// ── Reativar (suspenso → aprovado) — Diretor/CPEN da unidade e CRV ──
window.reativarAcesso = async function (id, nome) {
  if (!confirm(`Reativar o acesso de "${nome || 'este usuário'}"?\n\nEle volta a conseguir entrar no sistema.`)) return;
  try {
    await updateDoc(doc(db, 'usuarios_cadastrados', id), {
      status:       'aprovado',
      aprovadoPor:  usuarioAtual.email,
      aprovadoEm:   serverTimestamp(),
      motivoRecusa: null,
    });
    showToastPainel('Acesso reativado.');
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

// ── Mover de unidade (só CRV) — o cadastro continua com a mesma situação ──
window.abrirMoverUnidade = function (id, nome) {
  const r = _acessosTodos.find(x => x.id === id);
  if (!r) return;
  document.getElementById('p-modal-mover')?.remove();
  const srs = [...new Set(UNIDADES.map(u => u.sr))].sort();
  const opcoes = srs.map(sr => `<optgroup label="${escHtml(sr + ' — ' + (SR_INFO[sr]?.nome || sr))}">${
    UNIDADES.filter(u => u.sr === sr).map(u =>
      `<option value="${escHtml(u.email)}"${u.email === r.emailUnidade ? ' selected' : ''}>${escHtml(u.nome)}</option>`).join('')
  }</optgroup>`).join('');
  const m = document.createElement('div');
  m.id = 'p-modal-mover';
  m.className = 'p-modal';
  m.style.display = 'flex';
  m.innerHTML = `
    <div class="p-modal-box" style="max-width:480px;">
      <div class="p-modal-header"><h3>🔀 Mover de unidade</h3><button class="p-modal-fechar" onclick="document.getElementById('p-modal-mover').remove()">✕</button></div>
      <div class="p-modal-body">
        <p style="font-size:.82rem;color:var(--txt-2);margin:0 0 10px;">Servidor(a): <strong>${escHtml(nome || r.nome || '')}</strong><br>
          Unidade atual: <strong>${escHtml(r.nomeUnidade || r.emailUnidade || '—')}</strong></p>
        <label style="font-size:.78rem;font-weight:600;color:var(--txt-2);">Nova unidade</label>
        <select id="p-mover-unidade" style="width:100%;margin-top:6px;padding:9px 10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg-card);color:var(--txt-1);font-family:inherit;font-size:.84rem;">${opcoes}</select>
        <p style="font-size:.74rem;color:var(--txt-3);margin:10px 0 0;">A situação do cadastro (aprovado, pendente…) não muda. O Diretor(a)/CPEN da nova unidade passa a ver este servidor.</p>
      <div class="p-modal-acoes">
        <button class="p-btn p-btn-outline" onclick="document.getElementById('p-modal-mover').remove()">Cancelar</button>
        <button class="p-btn p-btn-assinar" id="p-mover-ok" onclick="confirmarMoverUnidade('${escHtml(id)}')">Mover</button>
      </div>
      </div>
    </div>`;
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  document.body.appendChild(m);
};
window.confirmarMoverUnidade = async function (id) {
  const r = _acessosTodos.find(x => x.id === id);
  const destino = UNIDADES.find(u => u.email === document.getElementById('p-mover-unidade')?.value);
  if (!r || !destino) return;
  if (destino.email === r.emailUnidade) { showToastPainel('O servidor já está nessa unidade.'); return; }
  const btn = document.getElementById('p-mover-ok');
  if (btn) { btn.disabled = true; btn.textContent = 'Movendo…'; }
  try {
    await updateDoc(doc(db, 'usuarios_cadastrados', id), {
      emailUnidade:       destino.email,
      nomeUnidade:        destino.nome,
      srUnidade:          destino.sr,
      unidadeAlteradaPor: usuarioAtual.email,
      unidadeAlteradaEm:  serverTimestamp(),
    });
    document.getElementById('p-modal-mover')?.remove();
    showToastPainel(`Servidor movido para ${destino.nome}.`);
    carregarAba('acessos');
  } catch (e) {
    showToastPainel('Erro: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Mover'; }
  }
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

// ── INIT ──
// (dados já carregados via dadosPromise antes do onAuthStateChanged)

// ══════════════════════════════════════════════
// MURAL DE AVISOS
// A CRV publica avisos para todos, uma regional ou uma unidade (e perfis).
// Quem recebe confirma "Li e estou ciente" (janela no site principal:
// js/avisos-modal.js). Aqui fica o histórico e, para a CRV, a gestão e o
// comprovante de ciência (👁), agrupado por regional → unidade.
// ══════════════════════════════════════════════
let _muralAvisos = [];
let _muralLidos  = {};
let _muralContagens = {};
let _muralFormAberto = false;
let _muralEditandoId = null;  // id do aviso em edição (null = novo aviso)
let _muralComentarios = {};   // avisoId → quantidade de comentários visíveis para mim

// ms → "2026-10-20T14:00" (valor do <input type="datetime-local">, no fuso local)
function _dtLocalAviso(ms) {
  const d = new Date(ms), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
// Avisos expandidos no Mural (os demais ficam recolhidos, só com o título)
const _muralAbertos = new Set();
window.alternarAvisoMural = function (id) {
  const corpo = document.getElementById('aviso-corpo-' + id);
  const seta  = document.getElementById('aviso-seta-' + id);
  if (!corpo) return;
  const abrir = corpo.style.display === 'none';
  corpo.style.display = abrir ? 'block' : 'none';
  if (seta) seta.style.transform = abrir ? 'rotate(90deg)' : '';
  if (abrir) _muralAbertos.add(id); else _muralAbertos.delete(id);
};

function _fmtExpiraAviso(ms) {
  return new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function _euAvisos() {
  const email = (usuarioAtual?.email || '').toLowerCase();
  if (perfilAtual === 'crv')   return { tipo: 'crv', email, nome: email };
  if (perfilAtual === 'super') return { tipo: 'super', email, nome: 'Superintendente ' + escopoAtual.codigo, srCod: escopoAtual.codigo, unidadeEmail: '' };
  const un = escopoAtual?.unidade;
  return { tipo: perfilAtual, email, nome: email, unidadeEmail: escopoAtual?.email || '', srCod: un?.sr || '' };
}

// Atalho usado na tela inicial e nos painéis da CRV/SR
function _btnMural(margem) {
  return `<button class="p-transf-row" onclick="abrirMuralAvisos()" style="max-width:980px;${margem || ''}">
      <span class="p-transf-icon">📢</span>
      <div class="p-transf-corpo">
        <div class="p-transf-titulo">Mural de Avisos</div>
        <div class="p-transf-sub">${perfilAtual === 'crv' ? 'Publicar avisos e acompanhar quem confirmou a leitura' : 'Avisos da CRV/DPP e histórico'}</div>
      </div>
      <span class="p-transf-arrow">›</span>
    </button>`;
}

window.abrirMuralAvisos = async function () {
  const rid = _novaRenderizacao();
  _abaAtiva = null;
  _atualizarBreadcrumb();
  const corpo = document.getElementById('p-corpo');
  corpo.className = '';
  corpo.innerHTML = '<div class="p-loading">Carregando avisos…</div>';
  try {
    const [avisos, lidos] = await Promise.all([listarAvisos(), meusAvisosLidos(usuarioAtual.uid)]);
    if (!_renderAtual(rid)) return;
    _muralAvisos = avisos;
    _muralLidos  = lidos;
    _muralContagens = {};
    _muralComentarios = {};
    _renderMural();
    // Contagens sem baixar as listas: comentários (todos) e confirmações (só CRV)
    const sr = _srComentarios();
    await Promise.all(avisos.map(async a => {
      _muralComentarios[a.id] = await contarComentarios(a.id, sr);
      if (perfilAtual === 'crv') _muralContagens[a.id] = await contarLeituras(a.id);
    }));
    if (_renderAtual(rid)) _renderMural();
  } catch (e) {
    corpo.innerHTML = `<div class="p-erro-msg">Erro ao carregar avisos: ${escHtml(e.message)}</div>`;
  }
};

function _renderMural() {
  const corpo = document.getElementById('p-corpo');
  const ehCRV = perfilAtual === 'crv';
  const eu = _euAvisos();
  const lista = ehCRV ? _muralAvisos : _muralAvisos.filter(a => avisoNoMeuHistorico(a, eu));
  const voltar = _ehNavCartoes()
    ? `<button class="p-bc-btn" onclick="mostrarLandingGrupos()" style="display:flex;align-items:center;gap:5px;margin-bottom:14px;font-size:.82rem;">← Voltar</button>`
    : `<button class="p-bc-btn" onclick="mostrarDashboard()" style="display:flex;align-items:center;gap:5px;margin-bottom:14px;font-size:.82rem;">← Voltar ao painel</button>`;

  const cards = lista.map(a => {
    const lidoEm = _muralLidos[a.id];
    // Quem publicou também pode registrar a ciência pelo Mural (a janela de entrada não insiste com o autor)
    const paraMim = avisoParaMim(a, eu) || (a.criadoPor === eu.email && a.ativo !== false && !avisoExpirado(a));
    const estado = lidoEm
      ? `<span style="font-size:.72rem;color:var(--verde);font-weight:600;">✓ Você confirmou a leitura${lidoEm?.toMillis ? ' em ' + formatarDataAviso(lidoEm) : ''}</span>`
      : paraMim
        ? `<button class="p-btn p-btn-assinar" onclick="confirmarAvisoMural('${a.id}')">✓ Li e estou ciente</button>`
        : '';
    const n = _muralContagens[a.id];
    const expMs = expiraEmMs(a);
    const expirado = avisoExpirado(a);
    const acoesCRV = ehCRV ? `
      <button class="p-btn p-btn-outline" onclick="editarAvisoMural('${a.id}')" title="Editar o aviso">✏️ Editar</button>
      <button class="p-btn p-btn-outline" onclick="verConfirmacoesAviso('${a.id}')" title="Ver quem confirmou a leitura">👁 Confirmações${n != null ? ' (' + n + ')' : ''}</button>
      <button class="p-btn p-btn-outline" onclick="arquivarAviso('${a.id}', ${a.ativo !== false})">${a.ativo !== false ? '🗄 Arquivar' : '↩ Reativar'}</button>
      <button class="p-btn p-btn-cancelar" onclick="excluirAvisoMural('${a.id}')" title="Excluir o aviso definitivamente">🗑 Excluir</button>` : '';
    const aberto = _muralAbertos.has(a.id);
    const pendente = paraMim && !lidoEm;
    return `
    <div class="p-card" style="${a.ativo === false || expirado ? 'opacity:.75;' : ''}${a.importante ? 'border-left:4px solid var(--vermelho);' : ''}">
      <div onclick="alternarAvisoMural('${a.id}')" title="${aberto ? 'Recolher' : 'Abrir'} aviso" style="padding:12px 18px;cursor:pointer;display:flex;gap:10px;align-items:flex-start;">
        <span id="aviso-seta-${a.id}" style="font-size:.7rem;color:var(--txt-3);margin-top:5px;transition:transform .15s;${aberto ? 'transform:rotate(90deg);' : ''}">▶</span>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px;">
            <span style="font-size:.95rem;font-weight:700;color:var(--txt-1);">📢 ${escHtml(a.titulo)}</span>
            ${a.importante ? '<span class="p-status p-status-negado">Importante</span>' : ''}
            ${pendente ? '<span class="p-status p-status-pendente">Confirmar leitura</span>' : ''}
            ${a.ativo === false ? '<span class="p-status p-status-cancelado">Arquivado</span>' : ''}
            ${a.ativo !== false && expirado ? '<span class="p-status p-status-cancelado">Expirado</span>' : ''}
          </div>
          <div style="font-size:.72rem;color:var(--txt-3);">
            ${formatarDataAviso(a.criadoEm)} · por ${escHtml(a.criadoPorNome || a.criadoPor || 'CRV')}
            ${a.editadoEm ? ' · editado em ' + formatarDataAviso(a.editadoEm) : ''}
            ${ehCRV ? ' · Para: ' + escHtml(descreverPublico(a.publico, UNIDADES, SR_INFO)) : ''}
          </div>
          ${expMs !== null ? `<div style="font-size:.72rem;color:${expirado ? 'var(--txt-3)' : 'var(--azul-600)'};font-weight:600;margin-top:2px;">⏳ ${expirado ? 'Expirou em' : 'Válido até'} ${_fmtExpiraAviso(expMs)}</div>` : ''}
        </div>
      </div>
      <div id="aviso-corpo-${a.id}" style="display:${aberto ? 'block' : 'none'};">
        <div style="padding:0 18px 6px 40px;">
          <div style="font-size:.85rem;line-height:1.65;color:var(--txt-2);">${textoAvisoHtml(a.texto)}</div>
          ${anexosHtml(a.anexos)}
        </div>
        <div class="p-card-acoes" style="align-items:center;">${estado}
          <button class="p-btn p-btn-outline" onclick="alternarComentariosAviso('${a.id}')">💬 Comentários${_muralComentarios[a.id] != null ? ' (' + _muralComentarios[a.id] + ')' : ''}</button>${acoesCRV}</div>
        <div id="aviso-conf-${a.id}" style="display:none;border-top:1px solid var(--border);padding:10px 14px;"></div>
        <div id="aviso-com-${a.id}" style="display:none;border-top:1px solid var(--border);padding:10px 14px;"></div>
      </div>
    </div>`;
  }).join('');

  corpo.innerHTML = `
    ${voltar}
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px;">
      <h2 style="font-size:1rem;font-weight:700;color:var(--txt-1);margin:0;flex:1;">📢 Mural de Avisos</h2>
      ${ehCRV ? `<button class="p-btn" style="background:var(--azul-600);color:#fff;" onclick="alternarFormAviso()">${_muralFormAberto ? '✕ Fechar' : '+ Novo aviso'}</button>` : ''}
    </div>
    ${ehCRV && _muralFormAberto ? _htmlFormAviso(_muralEditandoId ? _muralAvisos.find(x => x.id === _muralEditandoId) : null) : ''}
    ${cards || '<div class="p-vazio">Nenhum aviso publicado.</div>'}`;
}

// a = aviso em edição (preenche o formulário) ou null para um aviso novo
function _htmlFormAviso(a) {
  const est = 'width:100%;box-sizing:border-box;padding:8px 10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg-input,var(--bg-card));color:var(--txt-1);font-family:inherit;font-size:.84rem;';
  const srs = Object.keys(SR_INFO).sort();
  const p = a?.publico || { tipo: 'todos', valor: '', perfis: [] };
  const sel = cond => cond ? ' selected' : '';
  const expMs = a ? expiraEmMs(a) : null;
  const anexosAtuais = (a?.anexos || []).map((x, i) => `
      <label style="display:flex;align-items:center;gap:8px;font-size:.78rem;margin-bottom:4px;cursor:pointer;">
        <input type="checkbox" class="av-anexo-manter" value="${i}" checked> 📎 ${escHtml(x.nome)}
      </label>`).join('');
  return `
  <div class="p-card" id="av-form" style="padding:16px 18px;margin-bottom:18px;${a ? 'border:2px solid var(--azul-400);' : ''}">
    <div style="font-size:.85rem;font-weight:700;margin-bottom:10px;color:var(--txt-1);">${a ? '✏️ Editar aviso' : 'Novo aviso'}</div>
    <label style="font-size:.72rem;color:var(--txt-3);">Título</label>
    <input id="av-titulo" maxlength="120" style="${est}margin-bottom:10px;" placeholder="Ex.: Nova orientação para pedidos de pernoite" value="${escHtml(a?.titulo || '')}">
    <label style="font-size:.72rem;color:var(--txt-3);">Texto do aviso</label>
    <textarea id="av-texto" rows="6" style="${est}margin-bottom:10px;resize:vertical;" placeholder="Escreva o aviso…">${escHtml(a?.texto || '')}</textarea>
    ${anexosAtuais ? `<div style="font-size:.72rem;color:var(--txt-3);margin-bottom:4px;">Anexos atuais (desmarque para remover):</div>${anexosAtuais}` : ''}
    <label style="font-size:.72rem;color:var(--txt-3);">${a ? 'Adicionar anexos' : 'Anexos'} (opcional — até ${ANEXO_MAX_ARQUIVOS} arquivos de até ${ANEXO_MAX_MB} MB cada)</label>
    <input type="file" id="av-anexos" multiple style="${est}margin-bottom:10px;">
    <label style="display:flex;align-items:center;gap:8px;font-size:.8rem;margin-bottom:8px;cursor:pointer;">
      <input type="checkbox" id="av-importante"${a?.importante ? ' checked' : ''}> ⚠️ Marcar como <strong>importante</strong> (destaque em vermelho)
    </label>
    <label style="display:flex;align-items:center;gap:8px;font-size:.8rem;margin-bottom:6px;cursor:pointer;">
      <input type="checkbox" id="av-expira-chk"${expMs !== null ? ' checked' : ''} onchange="document.getElementById('av-expira-box').style.display=this.checked?'':'none'"> ⏳ Definir <strong>data e horário de expiração</strong>
    </label>
    <div id="av-expira-box" style="display:${expMs !== null ? '' : 'none'};margin:0 0 12px 24px;">
      <input type="datetime-local" id="av-expira" style="${est}max-width:240px;" value="${expMs !== null ? _dtLocalAviso(expMs) : ''}">
      <div style="font-size:.7rem;color:var(--txt-3);margin-top:4px;">O aviso fica ativo até essa data e horário. Depois disso, sai da janela de entrada e do sino, mas continua no histórico do Mural.</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:10px;">
      <div>
        <label style="font-size:.72rem;color:var(--txt-3);">Enviar para</label>
        <select id="av-tipo" style="${est}" onchange="document.getElementById('av-reg').style.display=this.value==='regional'?'':'none';document.getElementById('av-un').style.display=this.value==='unidade'?'':'none';">
          <option value="todos"${sel(p.tipo === 'todos')}>Todas as unidades e regionais</option>
          <option value="regional"${sel(p.tipo === 'regional')}>Uma regional</option>
          <option value="unidade"${sel(p.tipo === 'unidade')}>Uma unidade</option>
        </select>
      </div>
      <div id="av-reg" style="display:${p.tipo === 'regional' ? '' : 'none'};">
        <label style="font-size:.72rem;color:var(--txt-3);">Regional</label>
        <select id="av-reg-sel" style="${est}">${srs.map(s => `<option value="${s}"${sel(p.tipo === 'regional' && p.valor === s)}>${s} — ${escHtml(SR_INFO[s]?.nome || s)}</option>`).join('')}</select>
      </div>
      <div id="av-un" style="display:${p.tipo === 'unidade' ? '' : 'none'};">
        <label style="font-size:.72rem;color:var(--txt-3);">Unidade</label>
        <select id="av-un-sel" style="${est}">${srs.map(s => `<optgroup label="${s}">${UNIDADES.filter(u => u.sr === s).map(u => `<option value="${escHtml(u.email)}"${sel(p.tipo === 'unidade' && p.valor === u.email)}>${escHtml(u.nome)}</option>`).join('')}</optgroup>`).join('')}</select>
      </div>
    </div>
    <div style="font-size:.72rem;color:var(--txt-3);margin-bottom:4px;">Somente para os perfis (deixe todos desmarcados para enviar a todos):</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px 14px;margin-bottom:14px;">
      ${Object.entries(PERFIS_AVISO).map(([v, l]) => `<label style="display:flex;align-items:center;gap:6px;font-size:.8rem;cursor:pointer;"><input type="checkbox" class="av-perfil" value="${v}"${(p.perfis || []).includes(v) ? ' checked' : ''}> ${escHtml(l)}</label>`).join('')}
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;">
      <button class="p-btn p-btn-outline" onclick="alternarFormAviso()">Cancelar</button>
      <button class="p-btn p-btn-assinar" id="av-publicar" onclick="publicarAvisoMural()">${a ? '💾 Salvar alterações' : '📢 Publicar aviso'}</button>
    </div>
  </div>`;
}

window.alternarFormAviso = function () {
  // Com a edição aberta, "+ Novo aviso"/"Cancelar" fecha o formulário
  _muralFormAberto = _muralEditandoId ? false : !_muralFormAberto;
  _muralEditandoId = null;
  _renderMural();
};

window.editarAvisoMural = function (id) {
  _muralEditandoId = id;
  _muralFormAberto = true;
  _renderMural();
  document.getElementById('av-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.publicarAvisoMural = async function () {
  const editando = _muralEditandoId ? _muralAvisos.find(x => x.id === _muralEditandoId) : null;
  const titulo = document.getElementById('av-titulo').value.trim();
  const texto  = document.getElementById('av-texto').value.trim();
  const tipo   = document.getElementById('av-tipo').value;
  const valor  = tipo === 'regional' ? document.getElementById('av-reg-sel').value
               : tipo === 'unidade'  ? document.getElementById('av-un-sel').value : '';
  const perfis = [...document.querySelectorAll('.av-perfil:checked')].map(c => c.value);
  const importante = document.getElementById('av-importante').checked;
  if (!titulo || !texto) { showToastPainel('Preencha o título e o texto do aviso.'); return; }

  let expiraEm = null;
  if (document.getElementById('av-expira-chk').checked) {
    const v = document.getElementById('av-expira').value;
    if (!v) { showToastPainel('Informe a data e o horário de expiração.'); return; }
    expiraEm = new Date(v);   // "AAAA-MM-DDTHH:MM" é interpretado no fuso local
    if (isNaN(expiraEm) || expiraEm.getTime() <= Date.now()) {
      showToastPainel('A data e o horário de expiração devem estar no futuro.'); return;
    }
  }

  const manter = editando
    ? [...document.querySelectorAll('.av-anexo-manter:checked')].map(c => editando.anexos[+c.value]).filter(Boolean)
    : [];
  const arquivos = [...(document.getElementById('av-anexos')?.files || [])];
  if (manter.length + arquivos.length > ANEXO_MAX_ARQUIVOS) { showToastPainel('No máximo ' + ANEXO_MAX_ARQUIVOS + ' anexos por aviso.'); return; }
  const grande = arquivos.find(a => a.size > ANEXO_MAX_MB * 1024 * 1024);
  if (grande) { showToastPainel('"' + grande.name + '" passa de ' + ANEXO_MAX_MB + ' MB.'); return; }
  const publico = { tipo, valor, perfis };
  const linhaExpira = expiraEm ? `\nVálido até: ${_fmtExpiraAviso(expiraEm.getTime())}` : '';
  const pergunta = editando
    ? `Salvar as alterações deste aviso?\n\nPara: ${descreverPublico(publico, UNIDADES, SR_INFO)}${linhaExpira}\n\nAs confirmações de leitura já registradas são mantidas.`
    : `Publicar este aviso?\n\nPara: ${descreverPublico(publico, UNIDADES, SR_INFO)}${linhaExpira}\n\nOs destinatários verão o aviso ao entrar no sistema e precisarão confirmar a leitura.`;
  if (!confirm(pergunta)) return;
  const btn = document.getElementById('av-publicar');
  const rotuloBtn = btn.textContent;
  btn.disabled = true;
  try {
    const anexos = [...manter];
    for (let i = 0; i < arquivos.length; i++) {
      btn.textContent = `Enviando anexo ${i + 1} de ${arquivos.length}…`;
      anexos.push(await enviarAnexoAviso(arquivos[i]));
    }
    btn.textContent = editando ? 'Salvando…' : 'Publicando…';
    if (editando) {
      await editarAviso(editando.id, { titulo, texto, importante, publico, anexos, expiraEm }, _euAvisos());
    } else {
      const ref = await publicarAviso({ titulo, texto, importante, publico, anexos, expiraEm }, _euAvisos());
      // Quem publica já está ciente: entra na lista de confirmações
      try { await confirmarLeitura(ref.id, usuarioAtual.uid, _euAvisos()); } catch (_) {}
    }
    _muralFormAberto = false;
    _muralEditandoId = null;
    showToastPainel(editando ? 'Aviso atualizado.' : 'Aviso publicado.');
    abrirMuralAvisos();
  } catch (e) {
    showToastPainel((editando ? 'Erro ao salvar: ' : 'Erro ao publicar: ') + e.message);
    btn.disabled = false; btn.textContent = rotuloBtn;
  }
};

window.confirmarAvisoMural = async function (id) {
  try {
    await confirmarLeitura(id, usuarioAtual.uid, _euAvisos());
    _muralLidos[id] = { toMillis: () => Date.now() };
    // Avisa o site principal (sino e janela de entrada), que fica fora deste iframe
    try { window.parent.dispatchEvent(new window.parent.CustomEvent('crv-aviso-lido', { detail: { id } })); } catch (_) {}
    showToastPainel('Leitura confirmada.');
    _renderMural();
  } catch (e) { showToastPainel('Erro: ' + e.message); }
};

window.arquivarAviso = async function (id, arquivar) {
  if (arquivar && !confirm('Arquivar este aviso?\n\nEle deixa de aparecer na janela de quem ainda não confirmou, mas continua no histórico.')) return;
  try {
    await alterarArquivado(id, arquivar, _euAvisos());
    showToastPainel(arquivar ? 'Aviso arquivado.' : 'Aviso reativado.');
    abrirMuralAvisos();
  } catch (e) { showToastPainel('Erro: ' + e.message); }
};

// ── 💬 Comentários do aviso ──
// Visíveis para todos os destinatários do aviso (e para a CRV).
function _srComentarios() { return null; } // null = todos os comentários do aviso

function _rotuloAutor(eu) {
  const un = UNIDADES.find(u => u.email === eu.unidadeEmail);
  if (eu.tipo === 'crv')   return 'CRV/DPP — ' + (eu.email.split('@')[0]);
  if (eu.tipo === 'super') return 'Superintendente ' + eu.srCod;
  if (eu.tipo === 'dir')   return 'Diretor(a) — ' + (un?.nome || '');
  if (eu.tipo === 'cpen')  return 'Coord. Execução Penal — ' + (un?.nome || '');
  return (usuarioAtual?.displayName || eu.email) + (un ? ' — ' + un.nome : '');
}

window.alternarComentariosAviso = async function (id, forcarAbrir) {
  const box = document.getElementById('aviso-com-' + id);
  if (!box) return;
  if (box.style.display !== 'none' && !forcarAbrir) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  box.innerHTML = '<div class="p-loading" style="padding:6px 0;">Carregando comentários…</div>';
  try {
    const lista = await listarComentarios(id, _srComentarios());
    const ehCRV = perfilAtual === 'crv';
    const itens = lista.map(cm => `
      <div style="padding:8px 10px;border-radius:8px;background:${cm.perfil === 'crv' ? 'var(--azul-50)' : 'var(--surface-2)'};margin-bottom:6px;">
        <div style="display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;">
          <span style="font-size:.74rem;font-weight:700;color:var(--txt-1);">${cm.perfil === 'crv' ? '🏛 ' : ''}${escHtml(cm.autorNome || cm.autorEmail)}</span>
          ${cm.srCod ? `<span style="font-size:.64rem;color:var(--txt-3);">${escHtml(cm.srCod)}</span>` : ''}
          <span style="font-size:.66rem;color:var(--txt-3);margin-left:auto;">${formatarDataAviso(cm.criadoEm)}</span>
          ${ehCRV ? `<button onclick="excluirComentarioAviso('${id}','${cm.id}')" title="Remover comentário" style="border:none;background:none;cursor:pointer;font-size:.72rem;color:var(--vermelho);">🗑</button>` : ''}
        </div>
        <div style="font-size:.8rem;color:var(--txt-2);line-height:1.55;margin-top:3px;">${textoAvisoHtml(cm.texto)}</div>
      </div>`).join('');
    const escopo = 'Visível para todos os destinatários deste aviso e para a CRV/DPP.';
    box.innerHTML = `
      ${itens || '<div style="font-size:.76rem;color:var(--txt-3);padding:2px 0 8px;">Nenhum comentário ainda.</div>'}
      <div style="display:flex;gap:8px;align-items:flex-end;margin-top:6px;">
        <textarea id="com-texto-${id}" rows="2" maxlength="1500" placeholder="Escrever um comentário…"
          style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg-card);color:var(--txt-1);font-family:inherit;font-size:.8rem;resize:vertical;"></textarea>
        <button class="p-btn" style="background:var(--azul-600);color:#fff;" onclick="enviarComentarioAviso('${id}', this)">Comentar</button>
      </div>
      <div style="font-size:.66rem;color:var(--txt-3);margin-top:4px;">${escopo}</div>`;
  } catch (e) {
    box.innerHTML = `<div class="p-erro-msg">Erro ao carregar comentários: ${escHtml(e.message)}</div>`;
  }
};

window.enviarComentarioAviso = async function (id, btn) {
  const campo = document.getElementById('com-texto-' + id);
  const texto = (campo?.value || '').trim();
  if (!texto) return;
  btn.disabled = true;
  try {
    const eu = _euAvisos();
    await comentarAviso(id, texto, eu, _rotuloAutor(eu));
    _muralComentarios[id] = (_muralComentarios[id] || 0) + 1;
    await alternarComentariosAviso(id, true);
  } catch (e) {
    showToastPainel('Erro ao comentar: ' + e.message);
    btn.disabled = false;
  }
};

window.excluirComentarioAviso = async function (id, cid) {
  if (!confirm('Remover este comentário?')) return;
  try {
    await excluirComentario(id, cid);
    _muralComentarios[id] = Math.max(0, (_muralComentarios[id] || 1) - 1);
    await alternarComentariosAviso(id, true);
  } catch (e) { showToastPainel('Erro: ' + e.message); }
};
window.excluirAvisoMural = async function (id) {
  const a = _muralAvisos.find(x => x.id === id);
  if (!confirm(`Excluir definitivamente o aviso "${a?.titulo || ''}"?\n\nSerão apagados também os comentários e o registro de quem confirmou a leitura. Esta ação não pode ser desfeita.\n\nSe quiser só tirá-lo da janela de entrada e manter o histórico, use "Arquivar".`)) return;
  try {
    await excluirAviso(id);
    showToastPainel('Aviso excluído.');
    abrirMuralAvisos();
  } catch (e) { showToastPainel('Erro ao excluir: ' + e.message); }
};

// 👁 Quem confirmou — escondido até clicar; agrupado por regional → unidade (sanfona)
window.verConfirmacoesAviso = async function (id) {
  const box = document.getElementById('aviso-conf-' + id);
  if (!box) return;
  if (box.style.display !== 'none') { box.style.display = 'none'; return; }
  box.style.display = 'block';
  box.innerHTML = '<div class="p-loading" style="padding:6px 0;">Carregando confirmações…</div>';
  try {
    const leituras = await listarLeituras(id);
    box.innerHTML = _htmlConfirmacoes(leituras, _muralAvisos.find(a => a.id === id));
    box.onclick = ev => {
      const row = ev.target.closest('[data-grupo]');
      if (!row) return;
      const alvo = box.querySelector('#' + row.dataset.grupo);
      const abrir = alvo.style.display === 'none';
      // sanfona: ao abrir um grupo, fecha os irmãos do mesmo nível
      row.parentElement.parentElement.querySelectorAll(`:scope > div > [data-nivel="${row.dataset.nivel}"]`).forEach(r => {
        if (r !== row) { box.querySelector('#' + r.dataset.grupo).style.display = 'none'; r.querySelector('.seta').style.transform = ''; }
      });
      alvo.style.display = abrir ? 'block' : 'none';
      row.querySelector('.seta').style.transform = abrir ? 'rotate(90deg)' : '';
    };
  } catch (e) {
    box.innerHTML = `<div class="p-erro-msg">Erro ao carregar confirmações: ${escHtml(e.message)}</div>`;
  }
};

function _htmlConfirmacoes(leituras, aviso) {
  if (!leituras.length) return '<div class="p-vazio" style="padding:6px 0;">Ninguém confirmou a leitura ainda.</div>';
  const n2 = n => String(n).padStart(2, '0');
  const rotulo = l => ({ dir: 'Diretor(a)', cpen: 'Coord. Execução Penal', super: 'Superintendente' }[l.perfil]) || l.nome || l.email;
  let seq = 0;
  const pessoa = l => `
    <div style="display:flex;gap:8px;padding:4px 6px 4px 26px;font-size:.76rem;">
      <span style="color:var(--verde);">✓</span>
      <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(l.email)}">${escHtml(rotulo(l))}</span>
      <span style="color:var(--txt-3);flex-shrink:0;">${formatarDataAviso(l.confirmadoEm)}</span>
    </div>`;
  const grupo = (nivel, titulo, qtd, conteudo) => {
    const gid = 'cg-' + (++seq) + '-' + Math.random().toString(36).slice(2, 7);
    return `<div>
      <div data-grupo="${gid}" data-nivel="${nivel}" style="display:flex;align-items:center;gap:6px;padding:6px ${nivel === 2 ? '6px 6px 16px' : '6px'};cursor:pointer;border-radius:6px;">
        <span class="seta" style="font-size:.6rem;color:var(--txt-3);transition:transform .15s;">▸</span>
        <span style="flex:1;font-size:${nivel === 1 ? '.74rem;font-weight:700' : '.74rem'};color:var(--txt-1);">${escHtml(titulo)}</span>
        <span style="font-size:.66rem;font-weight:700;color:var(--txt-3);">${n2(qtd)}</span>
      </div>
      <div id="${gid}" style="display:none;">${conteudo}</div>
    </div>`;
  };

  const srs = Object.keys(SR_INFO).sort();
  let html = srs.map(sr => {
    const daSr = leituras.filter(l => l.srCod === sr);
    if (!daSr.length) return '';
    const superint = daSr.filter(l => !l.unidadeEmail).map(pessoa).join('');
    const unidades = UNIDADES.filter(u => u.sr === sr).map(u => {
      const doUn = daSr.filter(l => l.unidadeEmail === u.email);
      return doUn.length ? grupo(2, u.nome, doUn.length, doUn.map(pessoa).join('')) : '';
    }).join('');
    return grupo(1, `${sr} — ${SR_INFO[sr]?.nome || sr}`, daSr.length, superint + unidades);
  }).join('');
  const dpp = leituras.filter(l => l.perfil === 'crv');
  if (dpp.length) html += grupo(1, 'SEJURI/DPP', dpp.length, dpp.map(pessoa).join(''));
  const outros = leituras.filter(l => l.perfil !== 'crv' && !srs.includes(l.srCod));
  if (outros.length) html += grupo(1, 'Outros', outros.length, outros.map(pessoa).join(''));
  return `<div style="font-size:.7rem;color:var(--txt-3);margin-bottom:6px;">${leituras.length} confirmação(ões) — clique na regional e depois na unidade.</div>${html}`;
}
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
