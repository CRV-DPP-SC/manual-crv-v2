// ================================================
// CRV — Widget Global de Notificações
// js/notificacoes.js
// Cobre: assinaturas pendentes + cadastros pendentes + push FCM
// ================================================
import { getApps, initializeApp }   from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, collection, query, orderBy, where,
         onSnapshot, doc, getDoc, updateDoc, setDoc, serverTimestamp }
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

// ── OneSignal ──
const ONESIGNAL_APP_ID = 'd8932eb7-fa75-4f11-b0a2-68974e0afe42';

// ── Perfis que podem assinar transferências ──
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

// Retorna o email-base da unidade para DIR/CPEN (ex: pr18@pp.sc.gov.br)
// Retorna null para outros perfis
function _getEmailUnidade(email) {
  const e = (email || '').toLowerCase();
  if (/^.+dir@pp\.sc\.gov\.br$/.test(e))  return e.replace(/dir@pp\.sc\.gov\.br$/,  '@pp.sc.gov.br');
  if (/^.+cpen@pp\.sc\.gov\.br$/.test(e)) return e.replace(/cpen@pp\.sc\.gov\.br$/, '@pp.sc.gov.br');
  return null;
}

function _esc(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ════════════════════════════════════════
// SOM DE NOTIFICAÇÃO
// ════════════════════════════════════════
function _tocarSom() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Dois beeps rápidos e agradáveis
    [{ t: 0, f: 880 }, { t: 0.18, f: 1100 }].forEach(({ t, f }) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = f;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, ctx.currentTime + t);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.3);
    });
  } catch (e) { /* AudioContext não disponível */ }
}

// ════════════════════════════════════════
// ONESIGNAL — PUSH NOTIFICATIONS
// ════════════════════════════════════════
function _registrarOneSignal(emailUnidade) {
  if (!('Notification' in window)) return;
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async function(OneSignal) {
    try {
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        notifyButton: { enable: false },
        allowLocalhostAsSecureOrigin: true,
        promptOptions: {
          slidedown: {
            prompts: [{
              type: 'push',
              autoPrompt: true,
              text: {
                actionMessage:  'DESEJA RECEBER NOTIFICAÇÕES DE CADASTRO DE USUÁRIOS E ASSINATURAS PENDENTES?',
                acceptButton:   'SIM',
                cancelButton:   'NÃO',
              },
            }],
          },
        },
      });
      await OneSignal.Slidedown.promptPush();
      await OneSignal.User.addTag('emailUnidade', emailUnidade);
    } catch (e) {
      console.warn('[OneSignal]', e.message);
    }
  });
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
    max-height: 80vh; overflow: hidden;
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

  /* Seções separadas */
  .ntf-secao-titulo {
    padding: 8px 14px 6px;
    font-size: .68rem; font-weight: 800; color: #64748b;
    text-transform: uppercase; letter-spacing: .07em;
    background: #f8fafc; border-bottom: 1px solid #f1f5f9;
    flex-shrink: 0;
  }
  .ntf-secao-titulo.cad { color: #b45309; background: #fffbeb; border-bottom-color: #fef3c7; }

  .ntf-lista {
    overflow-y: auto; flex: 1;
    padding: 10px 12px;
    display: flex; flex-direction: column; gap: 8px;
    max-height: 230px;
  }
  .ntf-lista-cad {
    overflow-y: auto;
    padding: 10px 12px;
    display: flex; flex-direction: column; gap: 8px;
    max-height: 220px;
    flex-shrink: 0;
  }
  .ntf-vazio {
    padding: 16px 16px; text-align: center;
    font-size: .84rem; color: #94a3b8;
  }
  .ntf-item {
    background: #f8fafc; border: 1px solid #e2e8f0;
    border-radius: 10px; overflow: hidden;
  }
  .ntf-item-cad {
    background: #fffbeb; border: 1px solid #fde68a;
    border-radius: 10px; overflow: hidden;
  }
  .ntf-item-top { padding: 10px 12px 8px; }
  .ntf-item-titulo {
    font-size: .82rem; font-weight: 700; color: #0f172a;
    margin-bottom: 4px; line-height: 1.3;
  }
  .ntf-item-titulo.cad { color: #92400e; }
  .ntf-item-origem { font-size: .69rem; color: #94a3b8; margin-bottom: 4px; }
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
  .ntf-acoes.cad { border-top-color: #fde68a; }
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
  .ntf-btn-painel { background: #f97316; color: #fff; }
  .ntf-btn-painel:hover { background: #ea580c; }
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

  const _slot = document.getElementById('ntf-topbar-slot');
  const _bellHtml = `<button id="ntf-btn" class="ntf-oculto" title="Notificações" onclick="_ntfToggle()">🔔<span id="ntf-badge" style="display:none;"></span></button>`;
  if (_slot) {
    _slot.insertAdjacentHTML('beforeend', _bellHtml);
  } else {
    document.body.insertAdjacentHTML('beforeend', _bellHtml);
  }

  document.body.insertAdjacentHTML('beforeend', `

    <div id="ntf-painel" role="dialog" aria-label="Notificações">
      <div class="ntf-head">
        <div>
          <div class="ntf-head-titulo">🔔 Notificações</div>
          <div class="ntf-head-sub" id="ntf-head-sub">Carregando…</div>
        </div>
        <button class="ntf-fechar" onclick="_ntfFechar()" title="Fechar">✕</button>
      </div>

      <!-- Seção: Assinaturas Pendentes -->
      <div class="ntf-secao-titulo" id="ntf-sec-ass">⏳ Assinaturas Pendentes</div>
      <div class="ntf-lista" id="ntf-lista"></div>

      <!-- Seção: Cadastros Pendentes (só para CPEN/DIR) -->
      <div class="ntf-secao-titulo cad" id="ntf-sec-cad" style="display:none;">🆕 Solicitações de Cadastro</div>
      <div class="ntf-lista-cad" id="ntf-lista-cad" style="display:none;"></div>

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

  const _parts = location.pathname.split('/').filter(Boolean);
  const _depth = Math.max(0, _parts.length - 2);
  const _painelHref = '../'.repeat(_depth) + 'painel.html';
  const link = document.getElementById('ntf-link-painel');
  if (link) link.href = _painelHref;

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
let _pendentes     = [];  // assinaturas
let _cadastros     = [];  // cadastros pendentes
let _unsub         = null;
let _unsubCad      = null;
let _pendConf      = null;
let _emailUsuario  = null;
let _primeiraAss   = true; // ignora som no carregamento inicial
let _primeiraCad   = true;

// ════════════════════════════════════════
// LISTENER — ASSINATURAS
// ════════════════════════════════════════
function _iniciarListener(email) {
  if (_unsub) { _unsub(); _unsub = null; }
  _emailUsuario = email;
  _primeiraAss  = true;

  const q = query(collection(_db, 'solicitacoes'), orderBy('criadoEm', 'desc'));
  _unsub = onSnapshot(q, snap => {
    const anteriorN = _pendentes.length;
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

    if (_primeiraAss) {
      _primeiraAss = false;
    } else if (_pendentes.length > anteriorN) {
      _tocarSom();
      _ntfToast('⏳ Nova assinatura pendente!');
    }
    _atualizarUI();
  }, () => {
    _pendentes = [];
    _atualizarUI();
  });
}

// ════════════════════════════════════════
// LISTENER — CADASTROS (somente CPEN/DIR)
// ════════════════════════════════════════
function _iniciarListenerCadastros(emailUnidade) {
  if (_unsubCad) { _unsubCad(); _unsubCad = null; }
  _primeiraCad = true;

  const q = query(
    collection(_db, 'usuarios_cadastrados'),
    where('emailUnidade', '==', emailUnidade),
    where('status', '==', 'pendente')
  );

  _unsubCad = onSnapshot(q, snap => {
    const anteriorN = _cadastros.length;
    _cadastros = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (_primeiraCad) {
      _primeiraCad = false;
    } else if (_cadastros.length > anteriorN) {
      _tocarSom();
      _ntfToast('🆕 Nova solicitação de cadastro recebida!');
    }
    _atualizarUI();
  }, () => {
    _cadastros = [];
    _atualizarUI();
  });
}

function _pararListeners() {
  if (_unsub)    { _unsub();    _unsub    = null; }
  if (_unsubCad) { _unsubCad(); _unsubCad = null; }
  _pendentes    = [];
  _cadastros    = [];
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

  const total = _pendentes.length + _cadastros.length;
  btn.classList.remove('ntf-oculto');
  badge.textContent   = total > 0 ? (total > 9 ? '9+' : String(total)) : '';
  badge.style.display = total > 0 ? 'flex' : 'none';

  const baseTitle = document.title.replace(/^\(\d+\)\s*/, '');
  document.title  = total > 0 ? '(' + String(total).padStart(2, '0') + ') ' + baseTitle : baseTitle;

  // Mostra/oculta seção de cadastros
  const secCad  = document.getElementById('ntf-sec-cad');
  const listaCad = document.getElementById('ntf-lista-cad');
  const temCad  = _cadastros.length > 0;
  if (secCad)  secCad.style.display   = temCad ? '' : 'none';
  if (listaCad) listaCad.style.display = temCad ? '' : 'none';

  const painel = document.getElementById('ntf-painel');
  if (painel && painel.classList.contains('aberto')) {
    _renderizarLista();
    _renderizarCadastros();
  }
}

function _atualizarSubtitulo() {
  const sub = document.getElementById('ntf-head-sub');
  if (!sub) return;
  const nA = _pendentes.length;
  const nC = _cadastros.length;
  const partes = [];
  if (nA > 0) partes.push(nA + ' assinatura' + (nA > 1 ? 's' : '') + ' pendente' + (nA > 1 ? 's' : ''));
  if (nC > 0) partes.push(nC + ' cadastro' + (nC > 1 ? 's' : '') + ' aguardando');
  sub.textContent = partes.length > 0 ? partes.join(' · ') : 'Nenhuma pendência no momento';
}

function _renderizarLista() {
  const lista = document.getElementById('ntf-lista');
  if (!lista) return;
  _atualizarSubtitulo();

  const n = _pendentes.length;
  if (n === 0) {
    lista.innerHTML = '<div class="ntf-vazio">✓ Sem assinaturas pendentes</div>';
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

function _renderizarCadastros() {
  const lista = document.getElementById('ntf-lista-cad');
  if (!lista) return;

  if (!_cadastros.length) {
    lista.innerHTML = '';
    return;
  }

  lista.innerHTML = _cadastros.map(c => {
    const data = c.criadoEm?.toDate
      ? c.criadoEm.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
      : '';

    return `
      <div class="ntf-item-cad">
        <div class="ntf-item-top">
          <div class="ntf-item-titulo cad">👤 ${_esc(c.nome || c.email || '(sem nome)')}</div>
          <div class="ntf-item-origem">${_esc(c.email || '')}${data ? ' · ' + data : ''}</div>
        </div>
        <div class="ntf-acoes cad">
          <button class="ntf-btn ntf-btn-painel" onclick="_ntfVerNoPainel()">Ver no Painel →</button>
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
  if (abrindo) {
    _renderizarLista();
    _renderizarCadastros();
  }
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
  _ntfFechar();
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

window._ntfVerNoPainel = function() {
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
// GUIA DE NOTIFICAÇÕES (iOS)
// ════════════════════════════════════════
function _mostrarGuiaNotificacoes() {
  if (localStorage.getItem('crv_guia_notif_ok')) return;

  const isIOS       = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone === true;

  // iOS já instalado como PWA: não precisa do guia
  if (isStandalone) return;
  // Não é iOS: OneSignal cuida automaticamente
  if (!isIOS) return;

  // Injeta estilos do modal se necessário
  const styleId = 'crv-guia-notif-style';
  if (!document.getElementById(styleId)) {
    const s = document.createElement('style');
    s.id = styleId;
    s.textContent = `
      #crv-guia-notif {
        position: fixed; inset: 0; z-index: 9700;
        background: rgba(0,0,0,.55); backdrop-filter: blur(4px);
        display: flex; align-items: flex-end; justify-content: center;
        padding: 0 0 24px;
        animation: ntfSlide .2s ease;
      }
      .crv-guia-box {
        background: #fff; border-radius: 20px 20px 16px 16px;
        width: min(96vw, 420px);
        box-shadow: 0 -4px 32px rgba(0,0,0,.18);
        overflow: hidden;
      }
      .crv-guia-head {
        background: linear-gradient(135deg,#1e3a5f,#2563eb);
        padding: 18px 20px 14px;
        display: flex; align-items: center; gap: 12px;
      }
      .crv-guia-head-ico { font-size: 1.8rem; }
      .crv-guia-head-txt h3 { color:#fff; font-size:.95rem; font-weight:800; margin:0 0 2px; }
      .crv-guia-head-txt p  { color:rgba(255,255,255,.8); font-size:.75rem; margin:0; }
      .crv-guia-body { padding: 16px 20px 6px; }
      .crv-guia-passo {
        display: flex; align-items: flex-start; gap: 12px;
        padding: 10px 0; border-bottom: 1px solid #f1f5f9;
      }
      .crv-guia-passo:last-child { border-bottom: none; }
      .crv-guia-num {
        flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%;
        background: #1e3a5f; color: #fff;
        font-size: .75rem; font-weight: 800;
        display: flex; align-items: center; justify-content: center;
        margin-top: 1px;
      }
      .crv-guia-passo-txt { font-size: .83rem; color: #334155; line-height: 1.5; }
      .crv-guia-passo-txt strong { color: #0f172a; }
      .crv-guia-passo-ico { font-size: 1.1rem; margin-left: 4px; }
      .crv-guia-rodape {
        padding: 14px 20px 18px;
        display: flex; flex-direction: column; gap: 8px;
      }
      .crv-guia-btn-ok {
        width: 100%; padding: 12px; border: none; border-radius: 10px;
        background: #1e3a5f; color: #fff;
        font-size: .88rem; font-weight: 700; cursor: pointer;
        font-family: inherit;
      }
      .crv-guia-btn-ok:hover { background: #16325a; }
      .crv-guia-btn-skip {
        width: 100%; padding: 9px; border: 1px solid #e2e8f0;
        border-radius: 10px; background: #f8fafc; color: #64748b;
        font-size: .8rem; font-weight: 600; cursor: pointer;
        font-family: inherit;
      }
      .crv-guia-btn-skip:hover { background: #f1f5f9; }
    `;
    document.head.appendChild(s);
  }

  const div = document.createElement('div');
  div.id = 'crv-guia-notif';
  div.innerHTML = `
    <div class="crv-guia-box">
      <div class="crv-guia-head">
        <div class="crv-guia-head-ico">🔔</div>
        <div class="crv-guia-head-txt">
          <h3>Receba notificações no seu iPhone</h3>
          <p>Siga os passos abaixo para ser avisado mesmo com o celular bloqueado</p>
        </div>
      </div>
      <div class="crv-guia-body">
        <div style="background:#fef9c3;border:1px solid #fde047;border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:.8rem;color:#713f12;line-height:1.5;">
          ⚠️ <strong>Importante:</strong> estes passos só funcionam no
          <strong>Safari</strong>, navegador padrão do iPhone — o de ícone azul em forma de bússola
          que já vem instalado no celular. Se você estiver usando Chrome, Firefox ou outro
          navegador, feche-o e abra o site no Safari antes de continuar.<br><br>
          🔗 Link de acesso:
          <a href="https://crv-dpp-sc.github.io/manual-crv-v2/" target="_blank"
             style="color:#92400e;font-weight:700;word-break:break-all;">
            crv-dpp-sc.github.io/manual-crv-v2
          </a>
        </div>
        <div class="crv-guia-passo">
          <div class="crv-guia-num">1</div>
          <div class="crv-guia-passo-txt">
            Na barra inferior da tela, toque no ícone de
            <strong>Compartilhar</strong> — parece uma caixa com uma seta apontando para cima
            <span class="crv-guia-passo-ico">⬜↑</span>
          </div>
        </div>
        <div class="crv-guia-passo">
          <div class="crv-guia-num">2</div>
          <div class="crv-guia-passo-txt">
            Role a lista de opções para baixo e toque em
            <strong>"Adicionar à Tela de Início"</strong>
            <span class="crv-guia-passo-ico">➕</span>
          </div>
        </div>
        <div class="crv-guia-passo">
          <div class="crv-guia-num">3</div>
          <div class="crv-guia-passo-txt">
            Toque em <strong>"Adicionar"</strong> no canto superior direito da tela
          </div>
        </div>
        <div class="crv-guia-passo">
          <div class="crv-guia-num">4</div>
          <div class="crv-guia-passo-txt">
            Volte para a tela inicial do celular e abra o CRV pelo
            <strong>ícone que acabou de aparecer</strong>
            <span class="crv-guia-passo-ico">📱</span>
            — não pelo navegador
          </div>
        </div>
        <div class="crv-guia-passo">
          <div class="crv-guia-num">5</div>
          <div class="crv-guia-passo-txt">
            Faça login normalmente e toque em <strong>"Permitir"</strong>
            quando o app perguntar sobre notificações
          </div>
        </div>
      </div>
      <div class="crv-guia-rodape">
        <button class="crv-guia-btn-ok" onclick="_guiaNotifFechar(false)">Entendi, vou configurar agora</button>
        <button class="crv-guia-btn-skip" onclick="_guiaNotifFechar(true)">Não ver mais esta mensagem</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);
}

window._guiaNotifFechar = function(naoVerMais) {
  if (naoVerMais) localStorage.setItem('crv_guia_notif_ok', '1');
  const el = document.getElementById('crv-guia-notif');
  if (el) el.remove();
};

// ════════════════════════════════════════
// INIT
// ════════════════════════════════════════
_injetarDOM();

onAuthStateChanged(_auth, user => {
  if (user) {
    const btn = document.getElementById('ntf-btn');
    if (btn) btn.classList.remove('ntf-oculto');

    // Listener de assinaturas (para quem pode assinar)
    if (_podeSinalizar(user.email)) {
      _iniciarListener(user.email);
    }

    // Listener de cadastros + push OneSignal (somente CPEN/DIR)
    const emailUnidade = _getEmailUnidade(user.email);
    if (emailUnidade) {
      _iniciarListenerCadastros(emailUnidade);
      _registrarOneSignal(emailUnidade);
    }

    // Guia de configuração de notificações (iPhone)
    setTimeout(_mostrarGuiaNotificacoes, 1500);

  } else {
    _pararListeners();
  }
});
