// ================================================
// CRV — Janela de avisos ao entrar no site
// js/avisos-modal.js (carregado só no index.html)
//
// Mostra, um por vez, os avisos ativos destinados ao usuário que ele ainda
// não confirmou. A janela só fecha em "Li e estou ciente". Avisos publicados
// com o site aberto também aparecem (acompanhamento em tempo real).
// ================================================
import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { FIREBASE_CONFIG, escHtml } from "./config-crv.js";
import { avisoParaMim, ouvirAvisosAtivos, meusAvisosLidos, confirmarLeitura,
         textoAvisoHtml, formatarDataAviso, anexosHtml } from "./avisos.js";

const auth = getAuth(getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG));

let _unsub = null;
let _fila = [];          // avisos a confirmar, em ordem
let _lidos = {};         // { avisoId: ts }
let _uid = null;

/** Monta o "eu" a partir do perfil resolvido pelo firebase.js (window._presencaInfo) */
function _eu(user) {
  const info = window._presencaInfo;
  if (!info) return null;
  return { tipo: info.tipo, email: (user.email || '').toLowerCase(), nome: info.nome,
           unidadeEmail: info.unidadeEmail || '', srCod: info.srCod || '' };
}

onAuthStateChanged(auth, user => {
  if (_unsub) { _unsub(); _unsub = null; }
  _fila = []; _fecharJanela();
  if (!user) return;
  _uid = user.uid;
  // Aguarda o perfil (tipo, unidade, regional) ser resolvido pelo firebase.js
  let tentativas = 0;
  const iniciar = async () => {
    const eu = _eu(user);
    if (!eu) { if (tentativas++ < 20) setTimeout(iniciar, 500); return; }
    _lidos = await meusAvisosLidos(user.uid);
    _unsub = ouvirAvisosAtivos(avisos => {
      // Quem publicou não precisa confirmar o próprio aviso
      _fila = avisos.filter(a => avisoParaMim(a, eu) && !_lidos[a.id] && a.criadoPor !== eu.email);
      if (_fila.length) _mostrarProximo(eu); else _fecharJanela();
    });
  };
  setTimeout(iniciar, 800);
});

function _fecharJanela() { document.getElementById('aviso-modal')?.remove(); }

// Confirmado pelo sino (ou pelo Mural) → sai da fila da janela
let _euAtual = null;
window.addEventListener('crv-aviso-lido', e => {
  const id = e.detail?.id;
  if (!id || e.detail?.origem === 'janela') return;
  _lidos[id] = true;
  const eraOAtual = _fila[0]?.id === id;
  _fila = _fila.filter(a => a.id !== id);
  if (eraOAtual && _euAtual) _mostrarProximo(_euAtual);
});

function _mostrarProximo(eu) {
  _euAtual = eu;
  const a = _fila[0];
  if (!a) { _fecharJanela(); return; }
  let modal = document.getElementById('aviso-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'aviso-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9800;background:rgba(0,0,0,.55);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:16px;';
    document.body.appendChild(modal);
  }
  const cor = a.importante ? '#b91c1c' : '#1e3a5f';
  modal.innerHTML = `
    <div role="dialog" aria-modal="true" style="background:var(--bg-card,#fff);color:var(--txt-1,#0f172a);border-radius:14px;width:100%;max-width:520px;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 16px 48px rgba(0,0,0,.3);overflow:hidden;">
      <div style="background:${cor};color:#fff;padding:14px 18px;display:flex;align-items:center;gap:10px;">
        <span style="font-size:1.3rem;">📢</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:.68rem;opacity:.8;text-transform:uppercase;letter-spacing:.05em;">Mural de Avisos — CRV/DPP${_fila.length > 1 ? ` · 1 de ${_fila.length}` : ''}</div>
          <div style="font-size:1rem;font-weight:700;">${a.importante ? '⚠️ ' : ''}${escHtml(a.titulo)}</div>
        </div>
      </div>
      <div style="padding:16px 18px;overflow-y:auto;font-size:.88rem;line-height:1.65;">${textoAvisoHtml(a.texto)}${anexosHtml(a.anexos)}</div>
      <div style="padding:10px 18px;border-top:1px solid var(--border,#e2e8f0);display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <span style="flex:1;font-size:.72rem;color:var(--txt-3,#64748b);">Publicado por ${escHtml(a.criadoPorNome || a.criadoPor || 'CRV')}${a.criadoEm ? ' em ' + formatarDataAviso(a.criadoEm) : ''}</span>
        <button id="aviso-ok" style="padding:9px 18px;border:none;border-radius:8px;background:#15803d;color:#fff;font-weight:700;font-size:.85rem;cursor:pointer;font-family:inherit;">✓ Li e estou ciente</button>
      </div>
    </div>`;
  const btn = modal.querySelector('#aviso-ok');
  btn.onclick = async () => {
    btn.disabled = true; btn.textContent = 'Registrando…';
    try {
      await confirmarLeitura(a.id, _uid, eu);
      _lidos[a.id] = true;
      _fila.shift();
      window.dispatchEvent(new CustomEvent('crv-aviso-lido', { detail: { id: a.id, origem: 'janela' } })); // atualiza o sino
      _mostrarProximo(eu);
    } catch (e) {
      console.error('Erro ao confirmar leitura:', e);
      alert('Não foi possível registrar a confirmação. Tente novamente em instantes.');
      btn.disabled = false; btn.textContent = '✓ Li e estou ciente';
    }
  };
}
