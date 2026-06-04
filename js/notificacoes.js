// ================================================
// CRV — Widget Global de Notificações de Assinaturas
// js/notificacoes.js
// Funciona em qualquer página do site.
// ================================================
import { getApps, initializeApp }   from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, collection, query, orderBy,
         onSnapshot, doc, getDoc, updateDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// ── Firebase (reutiliza instância já inicializada se existir) ──
const FC = {
  apiKey:            "AIzaSyB61jtxRJlDu0LhwXOM9c42MEHQWciJh-I",
  authDomain:        "crv-dpp-sc-v2.firebaseapp.com",
  projectId:         "crv-dpp-sc-v2",
  storageBucket:     "crv-dpp-sc-v2.firebasestorage.app",
  messagingSenderId: "513539683551",
  appId:             "1:513539683551:web:2fdcdd236f0c37853ae56a"
};
const _app  = getApps().length > 0 ? getApps()[0] : initializeApp(FC);
const _auth = getAuth(_app);
const _db   = getFirestore(_app);

// ── Perfis que podem assinar ──
const EMAILS_CRV = [
  'rodrigo.l.pastore@gmail.com','ivana.schafer@gmail.com','brunawlongen@gmail.com',
  'ricardobritomarques12@gmail.com','abeljuliana2012@gmail.com','jessicaveiga9@gmail.com',
  'day.sestren88@gmail.com','sepen@pp.sc.gov.br','leilakfarias@gmail.com'
];

function _podeSinalizar(email) {
  const e = (email || '').toLowerCase();
  return EMAILS_CRV.includes(e)
    || /^sr0[1-8]@pp\.sc\.gov\.br$/.test(e)
    || /^.+dir@pp\.sc\.gov\.br$/.test(e)
    || /^.+cpen@pp\.sc\.gov\.br$/.test(e);
}

function _esc(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ════════════════════════════════════════
// ESTILOS INLINE
// ════════════════════════════════════════
const CSS = `
  #ntf-btn {
    position: relative;
    width: 34px; height: 34px; border-radius: 50%;
    background: rgba(255,255,255,.12); color: #fff;
    border: 1.5px solid rgba(255,255,255,.25);
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 1rem; transition: background .2s, transform .15s;
    outline: none; flex-shrink: 0;
  }
  #ntf-btn.ntf-oculto { display: none !important; }
  #ntf-btn:hover { background: rgba(255,255,255,.24); transform: scale(1.07); }
  #ntf-badge {
    position: absolute; top: -4px; right: -4px;
    background: #dc2626; color: #fff;
    font-size: .6rem; font-weight: 800;
    min-width: 18px; height: 18px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    padding: 0 4px; border: 2px solid #fff; pointer-events: none;
  }
  #ntf-painel {
    position: fixed; top: 62px; right: 16px; z-index: 8999;
    width: min(92vw, 380px);
    background: #fff; border-radius: 14px;
    box-shadow: 0 8px 40px rgba(0,0,0,.18);
    border: 1px solid #e2e8f0;
    display: none; flex-direction: column;
    max-height: 70vh; overflow: hidden;
    animation: ntfSlide .18s ease;
  }
  @keyframes ntfSlide {
    from { opacity:0; transform: translateY(12px); }
    to   { opacity:1; transform: translateY(0); }
  }
  #ntf-painel.aberto { display: flex; }
  .ntf-head {
    padding: 14px 16px 12px;
    border-bottom: 1px solid #f1f5f9;
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0;
  }
  .ntf-head-titulo { font-size: .88rem; font-weight: 700; color: #0f172a; }
  .ntf-head-sub    { font-size: .7rem; color: #64748b; margin-top: 1px; }
  .ntf-fechar {
    background: #f1f5f9; border: none; border-radius: 50%;
    width: 28px; height: 28px; cursor: pointer; font-size: .75rem;
    color: #475569; display: flex; align-items: center; justify-content: center;
    transition: background .15s;
  }
  .ntf-fechar:hover { background: #e2e8f0; }
  .ntf-lista {
    overflow-y: auto; flex: 1;
    padding: 10px 12px;
    display: flex; flex-direction: column; gap: 8px;
  }
  .ntf-vazio {
    padding: 28px 16px; text-align: center;
    font-size: .84rem; color: #94a3b8;
  }
  .ntf-item {
    background: #f8fafc; border: 1px solid #e2e8f0;
    border-radius: 10px; overflow: hidden;
  }
  .ntf-item-top {
    padding: 10px 12px 8px;
  }
  .ntf-item-titulo {
    font-size: .82rem; font-weight: 700; color: #0f172a;
    margin-bottom: 4px; line-height: 1.3;
  }
  .ntf-item-origem {
    font-size: .69rem; color: #94a3b8; margin-bottom: 4px;
  }
  .ntf-presos {
    display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px;
  }
  .ntf-preso-tag {
    font-size: .67rem; font-weight: 600; color: #1d4ed8;
    background: #eff6ff; border: 1px solid #bfdbfe;
    border-radius: 20px; padding: 2px 8px; white-space: nowrap;
  }
  .ntf-resumo {
    font-size: .72rem; line-height: 1.55; color: #1e3a8a;
    background: #eff6ff; border-left: 2.5px solid #3b82f6;
    border-radius: 0 5px 5px 0;
    padding: 6px 10px; margin-top: 4px;
  }
  .ntf-resumo-label {
    font-size: .6rem; font-weight: 800; color: #2563eb;
    text-transform: uppercase; letter-spacing: .05em;
    margin-bottom: 3px; display: block;
  }
  .ntf-acoes {
    padding: 8px 10px;
    border-top: 1px solid #f1f5f9;
    display: flex; gap: 6px;
  }
  .ntf-btn {
    flex: 1; padding: 7px 10px; border-radius: 7px;
    font-size: .74rem; font-weight: 700; cursor: pointer;
    border: none; font-family: inherit; transition: background .15s;
  }
  .ntf-btn-ass  { background: #15803d; color: #fff; }
  .ntf-btn-ass:hover  { background: #166534; }
  .ntf-btn-neg  { background: #dc2626; color: #fff; }
  .ntf-btn-neg:hover  { background: #b91c1c; }
  .ntf-btn-ver  { background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; }
  .ntf-btn-ver:hover  { background: #e2e8f0; }
  .ntf-rodape {
    padding: 10px 14px;
    border-top: 1px solid #f1f5f9;
    text-align: center; flex-shrink: 0;
  }
  .ntf-link-painel {
    font-size: .75rem; color: #3b82f6; font-weight: 600;
    text-decoration: none;
  }
  .ntf-link-painel:hover { text-decoration: underline; }

  /* Modal de negação */
  #ntf-modal-neg {
    display: none; position: fixed; inset: 0; z-index: 9500;
    background: rgba(0,0,0,.5); backdrop-filter: blur(4px);
    align-items: center; justify-content: center; padding: 20px;
  }
  #ntf-modal-neg.aberto { display: flex; }
  .ntf-neg-box {
    background: #fff; border-radius: 14px;
    width: 100%; max-width: 440px;
    box-shadow: 0 12px 48px rgba(0,0,0,.22);
    overflow: hidden; animation: ntfSlide .18s ease;
  }
  .ntf-neg-head {
    background: #dc2626; padding: 14px 18px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .ntf-neg-head h3 { font-size: .95rem; font-weight: 700; color: #fff; margin: 0; }
  .ntf-neg-body { padding: 18px; }
  .ntf-neg-label { font-size: .8rem; font-weight: 600; color: #374151; margin-bottom: 6px; display: block; }
  .ntf-neg-motivo {
    width: 100%; border: 1px solid #e2e8f0; border-radius: 8px;
    padding: 8px 12px; font-size: .84rem; font-family: inherit;
    resize: vertical; min-height: 80px; color: #0f172a;
    box-sizing: border-box;
  }
  .ntf-neg-motivo:focus { outline: 2px solid #dc2626; border-color: transparent; }
  .ntf-neg-acoes {
    display: flex; gap: 8px; justify-content: flex-end; margin-top: 14px;
  }
  .ntf-neg-cancel {
    padding: 8px 16px; border-radius: 8px; border: 1px solid #e2e8f0;
    background: #f8fafc; color: #334155; font-size: .82rem; font-weight: 600;
    cursor: pointer; font-family: inherit;
  }
  .ntf-neg-cancel:hover { background: #e2e8f0; }
  .ntf-neg-ok {
    padding: 8px 18px; border-radius: 8px; border: none;
    background: #dc2626; color: #fff; font-size: .82rem; font-weight: 700;
    cursor: pointer; font-family: inherit; transition: background .15s;
  }
  .ntf-neg-ok:hover { background: #b91c1c; }
  .ntf-neg-ok:disabled { background: #fca5a5; cursor: default; }

  /* Modal de confirmação de assinatura */
  #ntf-modal-conf {
    display: none; position: fixed; inset: 0; z-index: 9500;
    background: rgba(0,0,0,.5); backdrop-filter: blur(4px);
    align-items: center; justify-content: center; padding: 20px;
  }
  #ntf-modal-conf.aberto { display: flex; }
  .ntf-conf-box {
    background: #fff; border-radius: 14px;
    width: 100%; max-width: 440px;
    box-shadow: 0 12px 48px rgba(0,0,0,.22);
    overflow: hidden; animation: ntfSlide .18s ease;
  }
  .ntf-conf-head {
    background: #1d4ed8; padding: 14px 18px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .ntf-conf-head h3 { font-size: .95rem; font-weight: 700; color: #fff; margin: 0; }
  .ntf-conf-body { padding: 18px; }
  .ntf-conf-acoes {
    display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;
  }
  .ntf-conf-cancel {
    padding: 8px 16px; border-radius: 8px; border: 1px solid #e2e8f0;
    background: #f8fafc; color: #334155; font-size: .82rem; font-weight: 600;
    cursor: pointer; font-family: inherit;
  }
  .ntf-conf-cancel:hover { background: #e2e8f0; }
  .ntf-conf-ok {
    padding: 8px 18px; border-radius: 8px; border: none;
    background: #15803d; color: #fff; font-size: .82rem; font-weight: 700;
    cursor: pointer; font-family: inherit; transition: background .15s;
  }
  .ntf-conf-ok:hover { background: #166534; }
  .ntf-conf-ok:disabled { background: #86efac; cursor: default; }

  /* Toast */
  #ntf-toast {
    position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
    background: #1e293b; color: #fff; padding: 10px 20px;
    border-radius: 10px; font-size: .84rem; font-weight: 600;
    z-index: 9600; opacity: 0; transition: opacity .25s;
    box-shadow: 0 4px 20px rgba(0,0,0,.25); pointer-events: none;
    white-space: nowrap;
  }
  #ntf-toast.show { opacity: 1; }
`;

// ════════════════════════════════════════
// DOM
// ════════════════════════════════════════
function _injetarDOM() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  /* Bell vai para o slot na topbar, se existir; senão, no body */
  const _slot = document.getElementById('ntf-topbar-slot');
  const _bellHtml = `<button id="ntf-btn" class="ntf-oculto" title="Assinaturas pendentes" onclick="_ntfToggle()">🔔<span id="ntf-badge" style="display:none;"></span></button>`;
  if (_slot) {
    _slot.insertAdjacentHTML('beforeend', _bellHtml);
  } else {
    document.body.insertAdjacentHTML('beforeend', _bellHtml);
  }

  document.body.insertAdjacentHTML('beforeend', `

    <div id="ntf-painel" role="dialog" aria-label="Assinaturas pendentes">
      <div class="ntf-head">
        <div>
          <div class="ntf-head-titulo">⏳ Assinaturas Pendentes</div>
          <div class="ntf-head-sub" id="ntf-head-sub">Carregando…</div>
        </div>
        <button class="ntf-fechar" onclick="_ntfFechar()" title="Fechar">✕</button>
      </div>
      <div class="ntf-lista" id="ntf-lista"></div>
      <div class="ntf-rodape">
        <a class="ntf-link-painel" href="/painel.html" id="ntf-link-painel">Abrir Painel da Unidade →</a>
      </div>
    </div>

    <!-- Modal negação -->
    <div id="ntf-modal-neg" onclick="if(event.target===this)_ntfFecharNeg()">
      <div class="ntf-neg-box">
        <div class="ntf-neg-head">
          <h3>❌ Negar Assinatura</h3>
          <button class="ntf-fechar" onclick="_ntfFecharNeg()">✕</button>
        </div>
        <div class="ntf-neg-body">
          <div id="ntf-neg-titulo" style="font-size:.88rem;font-weight:600;color:#0f172a;margin-bottom:12px;"></div>
          <label class="ntf-neg-label">Motivo da negação (opcional)</label>
          <textarea class="ntf-neg-motivo" id="ntf-neg-motivo" placeholder="Descreva o motivo…"></textarea>
          <div class="ntf-neg-acoes">
            <button class="ntf-neg-cancel" onclick="_ntfFecharNeg()">Cancelar</button>
            <button class="ntf-neg-ok" id="ntf-neg-ok" onclick="_ntfNegar()">❌ Confirmar negação</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal confirmação -->
    <div id="ntf-modal-conf" onclick="if(event.target===this)_ntfFecharConf()">
      <div class="ntf-conf-box">
        <div class="ntf-conf-head">
          <h3>✅ Confirmar Assinatura</h3>
          <button class="ntf-fechar" onclick="_ntfFecharConf()">✕</button>
        </div>
        <div class="ntf-conf-body">
          <div id="ntf-conf-corpo"></div>
          <div class="ntf-conf-acoes">
            <button class="ntf-conf-cancel" onclick="_ntfFecharConf()">Cancelar</button>
            <button class="ntf-conf-ok" id="ntf-conf-ok" onclick="_ntfAssinar()">✅ Confirmar assinatura</button>
          </div>
        </div>
      </div>
    </div>

    <div id="ntf-toast"></div>
  `);

  /* Calcula caminho relativo correto para painel.html */
  const _parts = location.pathname.split('/').filter(Boolean);
  /* _parts[0] = repo name ('manual-crv-v2'), _parts[-1] = filename */
  /* depth = number of subdirectories between repo root and the file */
  const _depth = Math.max(0, _parts.length - 2);
  const _painelHref = '../'.repeat(_depth) + 'painel.html';
  const link = document.getElementById('ntf-link-painel');
  if (link) link.href = _painelHref;

  /* Fecha painel ao clicar fora */
  document.addEventListener('click', function(e) {
    const painel = document.getElementById('ntf-painel');
    const btn    = document.getElementById('ntf-btn');
    if (!painel || !btn) return;
    if (painel.classList.contains('aberto')
        && !painel.contains(e.target)
        && e.target !== btn
        && !btn.contains(e.target)) {
      painel.classList.remove('aberto');
    }
  });
}

// ════════════════════════════════════════
// ESTADO
// ════════════════════════════════════════
let _pendentes    = [];
let _unsub        = null;
let _pendConf     = null; // { id, titulo, resumo, presos }
let _emailUsuario = null;

// ════════════════════════════════════════
// LISTENER FIRESTORE
// ════════════════════════════════════════
function _iniciarListener(email) {
  if (_unsub) { _unsub(); _unsub = null; }
  _emailUsuario = email;

  const q = query(collection(_db, 'solicitacoes'), orderBy('criadoEm', 'desc'));
  _unsub = onSnapshot(q, snap => {
    const pend = [];
    snap.forEach(d => {
      const s = { id: d.id, ...d.data() };
      if (s.statusGeral === 'cancelado') return;
      const minha = (s.assinantes || []).find(
        a => a.email === email && a.status === 'pendente'
      );
      if (minha) pend.push(s);
    });
    _pendentes = pend;
    _atualizarUI();
  }, () => {
    /* Erro de permissão — mantém botão visível sem badge */
    _pendentes = [];
    _atualizarUI();
  });
}

function _pararListener() {
  if (_unsub) { _unsub(); _unsub = null; }
  _pendentes    = [];
  _emailUsuario = null;
  const btn = document.getElementById('ntf-btn');
  if (btn) btn.classList.add('ntf-oculto');
}

// ════════════════════════════════════════
// UI
// ════════════════════════════════════════
function _atualizarUI() {
  const btn   = document.getElementById('ntf-btn');
  const badge = document.getElementById('ntf-badge');
  if (!btn) return;

  const n = _pendentes.length;
  btn.classList.remove('ntf-oculto');   /* garante visível independente de inline style */
  badge.textContent   = n > 0 ? (n > 9 ? '9+' : String(n)) : '';
  badge.style.display = n > 0 ? 'flex' : 'none';

  /* Se o painel já está aberto, re-renderiza */
  const painel = document.getElementById('ntf-painel');
  if (painel && painel.classList.contains('aberto')) {
    _renderizarLista();
  }
}

function _renderizarLista() {
  const lista = document.getElementById('ntf-lista');
  const sub   = document.getElementById('ntf-head-sub');
  if (!lista) return;

  const n = _pendentes.length;
  if (sub) sub.textContent = n === 0
    ? 'Nenhuma pendência no momento'
    : n + ' solicitaç' + (n > 1 ? 'ões aguardando' : 'ão aguardando') + ' sua assinatura';

  if (n === 0) {
    lista.innerHTML = '<div class="ntf-vazio">✓ Nenhuma assinatura pendente</div>';
    return;
  }

  lista.innerHTML = _pendentes.map(s => {
    const data = s.criadoEm?.toDate
      ? s.criadoEm.toDate().toLocaleDateString('pt-BR')
      : '';
    const presosHtml = (s.presos && s.presos.length)
      ? '<div class="ntf-presos">'
          + s.presos.map(p =>
              '<span class="ntf-preso-tag">👤 ' + _esc(p.nome || '—') + ' · ' + _esc(p.ipen || '—') + '</span>'
            ).join('')
          + '</div>'
      : '';
    const resumoHtml = s.resumo
      ? '<div class="ntf-resumo"><span class="ntf-resumo-label">Resumo Sintético — IPEN</span>' + _esc(s.resumo) + '</div>'
      : '';

    return `
      <div class="ntf-item">
        <div class="ntf-item-top">
          <div class="ntf-item-titulo">${_esc(s.titulo || 'Ofício s/ título')}</div>
          <div class="ntf-item-origem">${_esc(s.nomeUnidadeOrigem || s.emailUnidadeOrigem || '—')}${data ? ' · ' + data : ''}</div>
          ${presosHtml}
          ${resumoHtml}
        </div>
        <div class="ntf-acoes">
          <button class="ntf-btn ntf-btn-ass" onclick="_ntfAbrirConf('${_esc(s.id)}')">✅ Assinar</button>
          <button class="ntf-btn ntf-btn-neg" onclick="_ntfAbrirNeg('${_esc(s.id)}')">❌ Negar</button>
        </div>
      </div>`;
  }).join('');
}

// ════════════════════════════════════════
// AÇÕES (expostas globalmente)
// ════════════════════════════════════════
window._ntfToggle = function() {
  const painel = document.getElementById('ntf-painel');
  if (!painel) return;
  const abrindo = !painel.classList.contains('aberto');
  painel.classList.toggle('aberto');
  if (abrindo) _renderizarLista();
};

window._ntfFechar = function() {
  const painel = document.getElementById('ntf-painel');
  if (painel) painel.classList.remove('aberto');
};

window._ntfAbrirConf = function(id) {
  const s = _pendentes.find(x => x.id === id);
  if (!s) return;
  _pendConf = s;

  const corpo = document.getElementById('ntf-conf-corpo');
  if (!corpo) return;

  const presosHtml = (s.presos && s.presos.length)
    ? '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;">'
        + s.presos.map(p =>
            '<span style="font-size:.7rem;font-weight:600;color:#1d4ed8;background:#eff6ff;border:1px solid #bfdbfe;border-radius:20px;padding:2px 9px;">'
            + '👤 ' + _esc(p.nome || '—') + ' · IPEN ' + _esc(p.ipen || '—') + '</span>'
          ).join('')
        + '</div>'
    : '';
  const resumoHtml = s.resumo
    ? `<div style="background:#eff6ff;border-left:3px solid #3b82f6;padding:10px 14px;border-radius:0 7px 7px 0;margin-bottom:12px;">
        <div style="font-size:.6rem;font-weight:800;color:#2563eb;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;">Resumo Sintético — Cadastro IPEN</div>
        <p style="font-size:.84rem;color:#1e3a8a;line-height:1.65;margin:0;">${_esc(s.resumo)}</p>
       </div>`
    : '';

  corpo.innerHTML = `
    <p style="font-size:.88rem;font-weight:600;color:#0f172a;margin:0 0 8px;">${_esc(s.titulo || 'Ofício s/ título')}</p>
    ${presosHtml}
    ${resumoHtml}
    <p style="font-size:.8rem;color:#64748b;margin:0;">Confirma sua anuência ao presente expediente?</p>`;

  document.getElementById('ntf-modal-conf').classList.add('aberto');
  _ntfFechar(); /* fecha o painel enquanto o modal está aberto */
};

window._ntfFecharConf = function() {
  document.getElementById('ntf-modal-conf').classList.remove('aberto');
  _pendConf = null;
};

window._ntfAssinar = async function() {
  if (!_pendConf || !_emailUsuario) return;
  const btn = document.getElementById('ntf-conf-ok');
  if (btn) { btn.disabled = true; btn.textContent = 'Assinando…'; }

  try {
    const ref  = doc(_db, 'solicitacoes', _pendConf.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Documento não encontrado.');
    const assinantes = (snap.data().assinantes || []).map(a =>
      a.email === _emailUsuario
        ? { ...a, status: 'assinado', dataAcao: new Date().toISOString() }
        : a
    );
    await updateDoc(ref, { assinantes, atualizadoEm: serverTimestamp() });
    _ntfFecharConf();
    _ntfToast('✅ Documento assinado com sucesso!');
  } catch (e) {
    _ntfToast('Erro ao assinar: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = '✅ Confirmar assinatura'; }
  }
};

window._ntfAbrirNeg = function(id) {
  const s = _pendentes.find(x => x.id === id);
  if (!s) return;
  _pendConf = s;
  const titulo = document.getElementById('ntf-neg-titulo');
  if (titulo) titulo.textContent = s.titulo || 'Ofício s/ título';
  const motivo = document.getElementById('ntf-neg-motivo');
  if (motivo) motivo.value = '';
  document.getElementById('ntf-modal-neg').classList.add('aberto');
  _ntfFechar();
};

window._ntfFecharNeg = function() {
  document.getElementById('ntf-modal-neg').classList.remove('aberto');
  _pendConf = null;
};

window._ntfNegar = async function() {
  if (!_pendConf || !_emailUsuario) return;
  const btn = document.getElementById('ntf-neg-ok');
  const motivo = (document.getElementById('ntf-neg-motivo')?.value || '').trim();
  if (btn) { btn.disabled = true; btn.textContent = 'Negando…'; }

  try {
    const ref  = doc(_db, 'solicitacoes', _pendConf.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Documento não encontrado.');
    const assinantes = (snap.data().assinantes || []).map(a =>
      a.email === _emailUsuario
        ? { ...a, status: 'negado', motivoNegacao: motivo, dataAcao: new Date().toISOString() }
        : a
    );
    await updateDoc(ref, { assinantes, atualizadoEm: serverTimestamp() });
    _ntfFecharNeg();
    _ntfToast('❌ Assinatura negada.');
  } catch (e) {
    _ntfToast('Erro ao negar: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = '❌ Confirmar negação'; }
  }
};

window._ntfVerNoPainel = function(id) {
  const _pts  = location.pathname.split('/').filter(Boolean);
  const _dep  = Math.max(0, _pts.length - 2);
  window.open('../'.repeat(_dep) + 'painel.html', '_blank');
  _ntfFechar();
};

function _ntfToast(msg) {
  const t = document.getElementById('ntf-toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3500);
}

// ════════════════════════════════════════
// INIT
// ════════════════════════════════════════
_injetarDOM();

onAuthStateChanged(_auth, user => {
  if (user) {
    /* Exibe imediatamente enquanto o Firestore carrega */
    const btn = document.getElementById('ntf-btn');
    if (btn) btn.classList.remove('ntf-oculto');
    _iniciarListener(user.email);
  } else {
    _pararListener();
  }
});
