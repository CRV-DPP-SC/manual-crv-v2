// ================================================
// CRV — Mensagens (recados por unidade/regional + conversas individuais)
// js/mensagens.js
// ================================================
import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, getDoc, getDocs, setDoc,
         query, where, orderBy, limit, serverTimestamp, onSnapshot }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

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
const db    = getFirestore(_app);

let _user = null;
let _unsubListeners = [];

function _pararListenersTempoReal() {
  _unsubListeners.forEach(fn => { try { fn(); } catch (_) {} });
  _unsubListeners = [];
}

async function _iniciarListenersTempoReal(tentativas) {
  _pararListenersTempoReal();
  let info = window._presencaInfo;
  if (!info && (tentativas || 0) < 10) { setTimeout(() => _iniciarListenersTempoReal((tentativas || 0) + 1), 500); return; }
  if (!info) return;

  if (info.unidadeEmail) {
    _unsubListeners.push(_ouvirRecados(query(collection(db, 'recados'),
      where('destinoTipo', '==', 'unidade'), where('destino', '==', info.unidadeEmail))));
  }
  if (info.tipo === 'super' && info.srCod) {
    _unsubListeners.push(_ouvirRecados(query(collection(db, 'recados'),
      where('destinoTipo', '==', 'regional'), where('destino', '==', info.srCod))));
  }
  _unsubListeners.push(_ouvirConversas());
}

function _ouvirRecados(q) {
  let primeira = true;
  return onSnapshot(q, snap => {
    if (primeira) { primeira = false; _atualizarBadgeMensagens(); return; }
    snap.docChanges().forEach(ch => {
      if (ch.type !== 'added') return;
      const r = { id: ch.doc.id, ...ch.doc.data() };
      if (r.de !== meuEmail() && !r.lidoPor?.[meuEmail()]) {
        _mostrarToast('Recado — ' + (r.deNome || r.de), r.texto, () => _abrirDireto(r.de, r.id));
      }
    });
    _atualizarBadgeMensagens();
  }, e => console.error('Erro no listener de recados:', e));
}

function _ouvirConversas() {
  let primeira = true;
  const q = query(collection(db, 'conversas'), where('participantes', 'array-contains', meuEmail()));
  return onSnapshot(q, snap => {
    if (primeira) { primeira = false; _atualizarBadgeMensagens(); return; }
    snap.docChanges().forEach(ch => {
      if (ch.type === 'removed') return;
      // Ignora o eco local otimista da nossa própria escrita (ex.: _marcarConversaLida).
      // Nesse momento serverTimestamp() ainda não resolveu (fica null no cache local),
      // então "ultimaLeitura" leria como 0 e disparia um toast falso de "mensagem nova"
      // toda vez que a própria gaveta marca a conversa como lida.
      if (ch.doc.metadata.hasPendingWrites) return;
      const c = ch.doc.data();
      const outro = _outroParticipante(c);
      const ult = c.ultimaLeitura?.[meuEmail()]?.toMillis?.() || 0;
      const novaMsg = (c.ultimaMensagemEm?.toMillis?.() || 0) > ult && c.ultimaMensagemTexto;
      if (novaMsg) _mostrarToast(_nomeContato(outro), c.ultimaMensagemTexto, () => _abrirDireto(outro));
    });
    _atualizarBadgeMensagens();
  }, e => console.error('Erro no listener de conversas:', e));
}

function _abrirDireto(outroEmail, origemRecado) {
  document.getElementById('online-panel')?.remove();
  _criarPainelMensagens();
  _renderListaLateral();
  _abrirThread(outroEmail, origemRecado);
}
// Chamado pelo emoji 💬 no painel de online (só aparece pro DPP)
window._abrirConversaOnline = _abrirDireto;

function _mostrarToast(titulo, texto, onClick) {
  const el = document.createElement('div');
  const n = document.querySelectorAll('.crv-msg-toast').length;
  el.className = 'crv-msg-toast';
  el.style.cssText = `position:fixed;right:20px;bottom:${20 + n * 76}px;z-index:3000;width:260px;
    background:#fff;border:0.5px solid rgba(0,0,0,.1);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);
    padding:10px 14px;cursor:pointer;opacity:0;transform:translateY(8px);transition:opacity .18s,transform .18s;`;
  el.innerHTML = `
    <div style="font-size:.68rem;font-weight:700;color:var(--azul-500);text-transform:uppercase;letter-spacing:.03em;">✉️ ${escHtmlMsg(titulo)}</div>
    <div style="font-size:.78rem;color:var(--txt-1);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtmlMsg(texto || '')}</div>`;
  el.onclick = () => { el.remove(); onClick?.(); };
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
  setTimeout(() => el.remove(), 8000);
}

onAuthStateChanged(_auth, user => {
  _user = user || null;
  if (user) setTimeout(() => _iniciarListenersTempoReal(), 1500);
  else { _pararListenersTempoReal(); document.getElementById('mensagens-panel')?.remove(); }
});

// ── Utilitários ──
const meuEmail = () => (_user?.email || '').toLowerCase();
const convId = (a, b) => [a, b].sort().join('__');

function _rotuloPerfil(email) {
  const e = (email || '').toLowerCase();
  if (/^sr0[1-8]@pp\.sc\.gov\.br$/.test(e)) return 'Superintendente';
  if (/^.+dir@pp\.sc\.gov\.br$/.test(e))    return 'Diretor(a)';
  if (/^.+cpen@pp\.sc\.gov\.br$/.test(e))   return 'Coord. Execução Penal';
  return '';
}

const EMAILS_CRV = [
  'rodrigo.l.pastore@gmail.com','ivana.schafer@gmail.com','brunawlongen@gmail.com',
  'ricardobritomarques12@gmail.com','abeljuliana2012@gmail.com','jessicaveiga9@gmail.com',
  'day.sestren88@gmail.com','sepen@pp.sc.gov.br','leilakfarias@gmail.com','crv@pp.sc.gov.br'
];
function _nomeExibicaoEmail(email) {
  const prefix = (email || '').split('@')[0];
  const partes = prefix.split('.');
  if (partes.length > 1) return partes[0].charAt(0).toUpperCase() + partes[0].slice(1).toLowerCase();
  return prefix.toUpperCase();
}
function _colegasDpp() {
  return EMAILS_CRV.filter(e => e !== meuEmail()).map(e => ({ email: e, nome: 'DPP — ' + _nomeExibicaoEmail(e) }));
}

// Diretório institucional inteiro (DIR/CPEN de cada unidade + cada SR), montado só
// com dados já carregados em window.UNIDADES/SR_INFO — sem consulta ao banco.
function _diretorioInstitucional() {
  const lista = [];
  (window.UNIDADES || []).forEach(u => {
    const base = u.email.split('@')[0];
    lista.push({ email: base + 'dir@pp.sc.gov.br',  nome: 'Diretor(a) — ' + u.nome });
    lista.push({ email: base + 'cpen@pp.sc.gov.br', nome: 'Coord. Exec. Penal — ' + u.nome });
  });
  Object.keys(window.SR_INFO || {}).sort().forEach(cod => {
    lista.push({ email: cod.toLowerCase() + '@pp.sc.gov.br', nome: cod + ' — ' + (window.SR_INFO[cod]?.nome || cod) });
  });
  return lista.filter(c => c.email !== meuEmail());
}

// Contatos que o usuário atual pode iniciar conversa individual
async function _contatosElegiveis() {
  const info = window._presencaInfo;
  if (!info) return [];
  if (info.tipo === 'crv') return _colegasDpp().concat(_diretorioInstitucional());
  if (info.tipo === 'super' || info.tipo === 'dir' || info.tipo === 'cpen') return _diretorioInstitucional();
  if (info.tipo === 'servidor' && info.unidadeEmail) {
    const base = info.unidadeEmail.split('@')[0];
    const unidade = (window.UNIDADES || []).find(u => u.email === info.unidadeEmail);
    return [
      { email: base + 'dir@pp.sc.gov.br',  nome: 'Diretor(a) — ' + (unidade?.nome || '') },
      { email: base + 'cpen@pp.sc.gov.br', nome: 'Coord. Exec. Penal — ' + (unidade?.nome || '') },
    ];
  }
  return [];
}

// Busca de servidores cadastrados (só usado pelo DPP, que pode falar com qualquer um)
async function _buscarServidores(termo) {
  const t = (termo || '').trim().toLowerCase();
  if (t.length < 2) return [];
  try {
    const snap = await getDocs(query(collection(db, 'usuarios_cadastrados'), where('status', '==', 'aprovado')));
    const out = [];
    snap.forEach(d => {
      const dados = d.data();
      const nome = (dados.nome || '').toLowerCase();
      if (nome.includes(t)) out.push({ email: (dados.email || '').toLowerCase(), nome: dados.nome || dados.email });
    });
    return out.slice(0, 20);
  } catch (_) { return []; }
}

// ── Envio ──
async function enviarRecado(destinoTipo, destino, texto) {
  if (!_user || !texto.trim()) return;
  await addDoc(collection(db, 'recados'), {
    de: meuEmail(), deNome: window._presencaInfo?.nome || meuEmail(),
    destinoTipo, destino, texto: texto.trim(), enviadoEm: serverTimestamp()
  });
}

async function _garantirConversa(outroEmail, origemRecado) {
  const id = convId(meuEmail(), outroEmail);
  const ref = doc(db, 'conversas', id);
  // Não faz getDoc() antes: se a conversa ainda não existe, a regra de leitura
  // trava (resource vem nulo) e derrubaria isso com permissão negada. O
  // Firestore já distingue create/update sozinho a partir do setDoc abaixo.
  await setDoc(ref, {
    participantes: [meuEmail(), outroEmail].sort(),
    origemRecado: origemRecado || null
  }, { merge: true });
  return id;
}

async function enviarMensagem(outroEmail, texto, origemRecado) {
  if (!_user || !texto.trim()) return;
  const id = await _garantirConversa(outroEmail, origemRecado);
  await addDoc(collection(db, 'conversas', id, 'mensagens'), {
    de: meuEmail(), texto: texto.trim(), enviadaEm: serverTimestamp()
  });
  await setDoc(doc(db, 'conversas', id), {
    ultimaMensagemEm: serverTimestamp(),
    ultimaMensagemTexto: texto.trim(),
    ultimaLeitura: { [meuEmail()]: serverTimestamp() }
  }, { merge: true });
  return id;
}

async function _marcarConversaLida(id) {
  try {
    await setDoc(doc(db, 'conversas', id), { ultimaLeitura: { [meuEmail()]: serverTimestamp() } }, { merge: true });
  } catch (_) {}
}

async function _marcarRecadoLido(id) {
  try {
    await setDoc(doc(db, 'recados', id), { lidoPor: { [meuEmail()]: true } }, { merge: true });
  } catch (_) {}
}

function _formatarData(ts) {
  const ms = ts?.toMillis?.();
  if (!ms) return '';
  const d = new Date(ms), hoje = new Date();
  if (d.toDateString() === hoje.toDateString()) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: d.getFullYear() !== hoje.getFullYear() ? 'numeric' : undefined });
}

// ── Leitura ──
async function _listarRecadosRecebidos() {
  const info = window._presencaInfo;
  if (!info) return [];
  const out = [];
  try {
    if (info.unidadeEmail) {
      const snap = await getDocs(query(collection(db, 'recados'),
        where('destinoTipo', '==', 'unidade'), where('destino', '==', info.unidadeEmail)));
      snap.forEach(d => out.push({ id: d.id, ...d.data() }));
    }
    if (info.tipo === 'super' && info.srCod) {
      const snap = await getDocs(query(collection(db, 'recados'),
        where('destinoTipo', '==', 'regional'), where('destino', '==', info.srCod)));
      snap.forEach(d => out.push({ id: d.id, ...d.data() }));
    }
  } catch (e) { console.error('Erro ao listar recados:', e); }
  out.sort((a, b) => (b.enviadoEm?.toMillis?.() || 0) - (a.enviadoEm?.toMillis?.() || 0));
  return out;
}

async function _listarConversas() {
  try {
    const snap = await getDocs(query(collection(db, 'conversas'), where('participantes', 'array-contains', meuEmail())));
    const out = [];
    snap.forEach(d => out.push({ id: d.id, ...d.data() }));
    out.sort((a, b) => (b.ultimaMensagemEm?.toMillis?.() || 0) - (a.ultimaMensagemEm?.toMillis?.() || 0));
    return out;
  } catch (e) { console.error('Erro ao listar conversas:', e); return []; }
}

async function _listarMensagens(id) {
  try {
    const snap = await getDocs(query(collection(db, 'conversas', id, 'mensagens'), orderBy('enviadaEm', 'asc'), limit(200)));
    const out = [];
    snap.forEach(d => out.push(d.data()));
    return out;
  } catch (e) { console.error('Erro ao listar mensagens:', e); return []; }
}

async function _atualizarBadgeMensagens() {
  const badge = document.getElementById('msg-count-num');
  if (!badge) return;
  let n = 0;
  try {
    const recados = await _listarRecadosRecebidos();
    n += recados.filter(r => !r.lidoPor?.[meuEmail()]).length;
    const conversas = await _listarConversas();
    n += conversas.filter(c => {
      const ult = c.ultimaLeitura?.[meuEmail()]?.toMillis?.() || 0;
      return (c.ultimaMensagemEm?.toMillis?.() || 0) > ult && c.ultimaMensagemTexto;
    }).length;
  } catch (_) {}
  badge.style.display = n > 0 ? '' : 'none';
  badge.textContent = String(n);
}

// ── UI ──
function _outroParticipante(conversa) {
  return (conversa.participantes || []).find(e => e !== meuEmail()) || '';
}

function _nomeContato(email) {
  if (EMAILS_CRV.includes((email || '').toLowerCase())) return 'DPP — ' + _nomeExibicaoEmail(email);
  const rot = _rotuloPerfil(email);
  if (rot) {
    const unidade = (window.UNIDADES || []).find(u => email.startsWith(u.email.split('@')[0]));
    return rot + (unidade ? ' — ' + unidade.nome : '');
  }
  return email;
}

let _conversaAtivaEmail = null;

function _colunaThread() { return document.querySelector('#mensagens-panel .msg-thread-col'); }

function _marcarItemAtivoNaLista(email) {
  const col = document.querySelector('#mensagens-panel .msg-lista-col');
  if (!col) return;
  col.querySelectorAll('.msg-item').forEach(el => el.classList.toggle('ativa', el.dataset.email === email));
}

async function _abrirThread(outroEmail, origemRecado) {
  const corpo = _colunaThread();
  if (!corpo) return;
  _conversaAtivaEmail = outroEmail;
  _marcarItemAtivoNaLista(outroEmail);
  corpo.innerHTML = `<div class="msg-thread-vazio">Carregando…</div>`;

  const id = convId(meuEmail(), outroEmail);
  const tarefas = [_listarMensagens(id), _marcarConversaLida(id)];
  let recadoOrigem = null;
  if (origemRecado) {
    tarefas.push(_marcarRecadoLido(origemRecado));
    try { const s = await getDoc(doc(db, 'recados', origemRecado)); if (s.exists()) recadoOrigem = s.data(); } catch (_) {}
  }
  const [mensagens] = await Promise.all(tarefas);

  const bolha = m => {
    const eu = m.de === meuEmail();
    const ms = m.enviadaEm?.toMillis?.();
    const hora = ms ? new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    return `
    <div class="msg-bolha ${eu ? 'msg-bolha-enviada' : 'msg-bolha-recebida'}">
      ${escHtmlMsg(m.texto)}
      ${hora ? `<span class="msg-bolha-hora">${hora}</span>` : ''}
    </div>`;
  };

  const recadoHtml = recadoOrigem ? `
    <div class="msg-recado-origem">
      <div style="display:flex;justify-content:space-between;gap:6px;align-items:baseline;">
        <span style="font-size:.66rem;font-weight:700;color:var(--azul-500);text-transform:uppercase;letter-spacing:.03em;">Recado original — ${escHtmlMsg(recadoOrigem.deNome || recadoOrigem.de)}</span>
        <span style="font-size:.62rem;color:var(--txt-3);flex-shrink:0;">${_formatarData(recadoOrigem.enviadoEm)}</span>
      </div>
      <div style="font-size:.76rem;color:var(--txt-1);margin-top:2px;">${escHtmlMsg(recadoOrigem.texto)}</div>
    </div>` : '';

  corpo.innerHTML = `
    <div class="msg-thread-head">
      <div><div class="msg-thread-head-nome">${_nomeContato(outroEmail)}</div></div>
    </div>
    ${recadoHtml}
    <div class="msg-thread-msgs">
      ${mensagens.length ? mensagens.map(bolha).join('') : '<div class="msg-vazio">Nenhuma mensagem ainda.</div>'}
    </div>
    <div class="msg-thread-input">
      <input type="text" class="msg-thread-campo" placeholder="Escrever uma mensagem…">
      <button class="msg-thread-enviar" title="Enviar" aria-label="Enviar">➤</button>
    </div>`;

  const msgsEl = corpo.querySelector('.msg-thread-msgs');
  msgsEl.scrollTop = msgsEl.scrollHeight;

  const input = corpo.querySelector('.msg-thread-campo');
  const enviar = async () => {
    const texto = input.value;
    if (!texto.trim()) return;
    input.disabled = true;
    try {
      await enviarMensagem(outroEmail, texto, origemRecado);
      input.value = '';
      await _abrirThread(outroEmail, origemRecado);
      _renderListaLateral();
    } catch (e) {
      console.error('Erro ao enviar mensagem:', e);
      alert('Não foi possível enviar a mensagem. Tente novamente em instantes.');
      input.disabled = false;
    }
  };
  corpo.querySelector('.msg-thread-enviar').onclick = enviar;
  input.addEventListener('keydown', ev => { if (ev.key === 'Enter') enviar(); });
  input.focus();
}

function escHtmlMsg(s) {
  return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

async function _renderNovoRecado() {
  const corpo = _colunaThread();
  if (!corpo) return;
  _marcarItemAtivoNaLista(null);

  const srCods = Object.keys(window.SR_INFO || {}).sort();
  let _seq = 0;
  const arvoreHtml = srCods.map(sr => {
    const id = 'nr-' + (_seq++);
    const nomeSr = escHtmlMsg(window.SR_INFO?.[sr]?.nome || sr);
    const unidades = (window.UNIDADES || []).filter(u => u.sr === sr);
    const opcaoRegional = `
      <div class="nr-item" data-tipo="regional" data-destino="${sr}" data-label="${sr} — ${nomeSr}"
        style="padding:5px 6px 5px 24px;border-radius:6px;cursor:pointer;font-size:.76rem;font-weight:600;color:var(--azul-500);">Enviar para toda a regional</div>`;
    const unidadesHtml = unidades.map(u => `
      <div class="nr-item" data-tipo="unidade" data-destino="${escHtmlMsg(u.email)}" data-label="${escHtmlMsg(u.nome)}"
        style="padding:5px 6px 5px 24px;border-radius:6px;cursor:pointer;font-size:.76rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtmlMsg(u.nome)}</div>`).join('');
    return `
      <div>
        <div class="nr-regional-row" data-alvo="${id}" style="display:flex;align-items:center;gap:6px;padding:6px;border-radius:6px;cursor:pointer;">
          <span class="nr-seta" style="font-size:.6rem;color:var(--txt-3);transition:transform .15s;flex-shrink:0;">▸</span>
          <span style="flex:1;min-width:0;font-size:.74rem;font-weight:600;color:var(--txt-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${sr} — ${nomeSr}</span>
        </div>
        <div id="${id}" class="online-grupo-conteudo" style="display:none;">${opcaoRegional}${unidadesHtml}</div>
      </div>`;
  }).join('');

  corpo.innerHTML = `
    <div class="msg-thread-head">
      <div class="msg-thread-head-nome" style="flex:1;">Novo recado</div>
      <button class="msg-drawer-close" title="Cancelar" aria-label="Cancelar">✕</button>
    </div>
    <div class="msg-form-col">
      <div class="nr-resumo msg-resumo-destino" style="display:none;">
        <span>Para: <strong class="nr-resumo-nome"></strong></span>
        <button class="nr-trocar" style="border:none;background:none;color:var(--azul-500);font-size:.7rem;cursor:pointer;font-family:inherit;">trocar</button>
      </div>
      <div class="nr-dica" style="font-size:.68rem;color:var(--txt-3);">Clique numa regional para ver as unidades dela.</div>
      <div class="nr-arvore" style="max-height:320px;overflow-y:auto;">${arvoreHtml}</div>
      <div class="nr-form" style="display:none;flex-direction:column;gap:8px;">
        <textarea class="msg-texto-recado" rows="4" placeholder="Escrever recado…"></textarea>
        <button class="msg-enviar-recado" style="padding:9px;border:none;border-radius:8px;background:var(--azul-600);color:#fff;font-size:.8rem;font-weight:600;cursor:pointer;font-family:inherit;">Enviar recado</button>
      </div>
    </div>`;
  corpo.querySelector('.msg-drawer-close').onclick = () => _limparColunaThread();

  let destinoTipo = null, destino = null;
  const arvore  = corpo.querySelector('.nr-arvore');
  const dica    = corpo.querySelector('.nr-dica');
  const resumo  = corpo.querySelector('.nr-resumo');
  const form    = corpo.querySelector('.nr-form');
  const resumoNome = corpo.querySelector('.nr-resumo-nome');

  arvore.addEventListener('click', ev => {
    const linhaRegional = ev.target.closest('.nr-regional-row');
    if (linhaRegional) {
      const alvo = document.getElementById(linhaRegional.dataset.alvo);
      const seta = linhaRegional.querySelector('.nr-seta');
      const abrir = alvo.style.display === 'none';
      arvore.querySelectorAll('.nr-regional-row').forEach(r => {
        if (r !== linhaRegional) { document.getElementById(r.dataset.alvo).style.display = 'none'; r.querySelector('.nr-seta').style.transform = ''; }
      });
      alvo.style.display = abrir ? 'block' : 'none';
      seta.style.transform = abrir ? 'rotate(90deg)' : '';
      return;
    }
    const item = ev.target.closest('.nr-item');
    if (item) {
      destinoTipo = item.dataset.tipo;
      destino = item.dataset.destino;
      resumoNome.textContent = item.dataset.label;
      arvore.style.display = 'none';
      dica.style.display = 'none';
      resumo.style.display = 'flex';
      form.style.display = 'flex';
      form.querySelector('.msg-texto-recado').focus();
    }
  });

  corpo.querySelector('.nr-trocar').onclick = () => {
    destinoTipo = null; destino = null;
    resumo.style.display = 'none';
    form.style.display = 'none';
    dica.style.display = '';
    arvore.style.display = '';
  };

  corpo.querySelector('.msg-enviar-recado').onclick = async ev => {
    const texto = corpo.querySelector('.msg-texto-recado').value;
    if (!texto.trim() || !destinoTipo || !destino) return;
    ev.target.disabled = true;
    try {
      await enviarRecado(destinoTipo, destino, texto);
      _limparColunaThread();
      _renderListaLateral();
    } catch (e) {
      console.error('Erro ao enviar recado:', e);
      alert('Não foi possível enviar o recado. Tente novamente em instantes.');
      ev.target.disabled = false;
    }
  };
}

async function _renderNovaConversa() {
  const corpo = _colunaThread();
  if (!corpo) return;
  _marcarItemAtivoNaLista(null);
  const info = window._presencaInfo;
  const ehDpp = info?.tipo === 'crv';
  const ehInstitucional = ['crv', 'super', 'dir', 'cpen'].includes(info?.tipo);
  corpo.innerHTML = `
    <div class="msg-thread-head">
      <div class="msg-thread-head-nome" style="flex:1;">Mensagem direta</div>
      <button class="msg-drawer-close" title="Cancelar" aria-label="Cancelar">✕</button>
    </div>
    <div class="msg-form-col">
      <input type="text" class="msg-busca-contato" placeholder="${ehDpp ? 'Buscar por nome, unidade, SR…' : 'Buscar…'}">
      <div class="msg-lista-contatos" style="max-height:400px;overflow-y:auto;"></div>
    </div>`;
  corpo.querySelector('.msg-drawer-close').onclick = () => _limparColunaThread();

  const institucionais = await _contatosElegiveis();
  const listaEl = corpo.querySelector('.msg-lista-contatos');
  const buscaEl = corpo.querySelector('.msg-busca-contato');
  const temContato = email => institucionais.some(c => c.email === email);

  const linhaContato = c => `
    <div class="msg-contato" data-email="${c.email}" style="padding:5px 6px 5px 24px;border-radius:6px;cursor:pointer;font-size:.76rem;color:var(--txt-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.nome}</div>`;

  const renderListaPlana = itens => {
    listaEl.innerHTML = itens.length ? itens.map(linhaContato).join('')
      : `<div style="font-size:.75rem;color:var(--txt-3);padding:6px;">Nenhum contato encontrado.</div>`;
  };

  const renderArvore = () => {
    const srCods = Object.keys(window.SR_INFO || {}).sort();
    let _seq = 0;
    listaEl.innerHTML = srCods.map(sr => {
      const id = 'nc-' + (_seq++);
      const nomeSr = window.SR_INFO?.[sr]?.nome || sr;
      const srEmail = sr.toLowerCase() + '@pp.sc.gov.br';
      const contatoSr = temContato(srEmail)
        ? `<div class="msg-contato" data-email="${srEmail}" style="padding:5px 6px 5px 24px;border-radius:6px;cursor:pointer;font-size:.76rem;font-weight:600;color:var(--azul-500);">Superintendente</div>` : '';
      const unidadesHtml = (window.UNIDADES || []).filter(u => u.sr === sr).map(u => {
        const uid = 'nc-' + (_seq++);
        const dirEmail = u.email.split('@')[0] + 'dir@pp.sc.gov.br';
        const cpenEmail = u.email.split('@')[0] + 'cpen@pp.sc.gov.br';
        const pessoas = [
          temContato(dirEmail)  ? `<div class="msg-contato" data-email="${dirEmail}" style="padding:5px 6px 5px 42px;border-radius:6px;cursor:pointer;font-size:.75rem;">Diretor(a)</div>` : '',
          temContato(cpenEmail) ? `<div class="msg-contato" data-email="${cpenEmail}" style="padding:5px 6px 5px 42px;border-radius:6px;cursor:pointer;font-size:.75rem;">Coord. Exec. Penal</div>` : ''
        ].join('');
        return `
          <div>
            <div class="nc-unidade-row" data-alvo="${uid}" style="display:flex;align-items:center;gap:6px;padding:5px 6px 5px 24px;border-radius:6px;cursor:pointer;">
              <span class="nc-seta" style="font-size:.55rem;color:var(--txt-3);flex-shrink:0;">▸</span>
              <span style="flex:1;min-width:0;font-size:.74rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${u.nome}</span>
            </div>
            <div id="${uid}" class="online-grupo-conteudo" style="display:none;">${pessoas || '<div style="font-size:.7rem;color:var(--txt-3);padding:4px 6px 4px 42px;">—</div>'}</div>
          </div>`;
      }).join('');
      return `
        <div>
          <div class="nc-regional-row" data-alvo="${id}" style="display:flex;align-items:center;gap:6px;padding:6px;border-radius:6px;cursor:pointer;">
            <span class="nc-seta" style="font-size:.6rem;color:var(--txt-3);flex-shrink:0;">▸</span>
            <span style="flex:1;min-width:0;font-size:.74rem;font-weight:600;color:var(--txt-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${sr} — ${nomeSr}</span>
          </div>
          <div id="${id}" class="online-grupo-conteudo" style="display:none;">${contatoSr}${unidadesHtml}</div>
        </div>`;
    }).join('');
  };

  const renderListaFiltrada = async termo => {
    let itens = institucionais.filter(c => c.nome.toLowerCase().includes(termo.toLowerCase()));
    if (ehDpp && termo.trim().length >= 2) itens = itens.concat(await _buscarServidores(termo));
    renderListaPlana(itens);
  };

  const mostrarPadrao = () => ehInstitucional ? renderArvore() : renderListaPlana(institucionais);
  mostrarPadrao();

  // Um único listener delegado cobre tanto a árvore quanto a lista plana, em qualquer re-render.
  listaEl.addEventListener('click', ev => {
    const contato = ev.target.closest('.msg-contato');
    if (contato) { _abrirThread(contato.dataset.email); return; }
    const regRow = ev.target.closest('.nc-regional-row');
    if (regRow) {
      const alvo = document.getElementById(regRow.dataset.alvo);
      const seta = regRow.querySelector('.nc-seta');
      const abrir = alvo.style.display === 'none';
      listaEl.querySelectorAll('.nc-regional-row').forEach(r => {
        if (r !== regRow) { document.getElementById(r.dataset.alvo).style.display = 'none'; r.querySelector('.nc-seta').style.transform = ''; }
      });
      alvo.style.display = abrir ? 'block' : 'none';
      seta.style.transform = abrir ? 'rotate(90deg)' : '';
      return;
    }
    const unRow = ev.target.closest('.nc-unidade-row');
    if (unRow) {
      const alvo = document.getElementById(unRow.dataset.alvo);
      const seta = unRow.querySelector('.nc-seta');
      const abrir = alvo.style.display === 'none';
      const paiRegional = unRow.closest('.online-grupo-conteudo');
      paiRegional?.querySelectorAll('.nc-unidade-row').forEach(r => {
        if (r !== unRow) { document.getElementById(r.dataset.alvo).style.display = 'none'; r.querySelector('.nc-seta').style.transform = ''; }
      });
      alvo.style.display = abrir ? 'block' : 'none';
      seta.style.transform = abrir ? 'rotate(90deg)' : '';
    }
  });

  let deb;
  buscaEl.addEventListener('input', () => {
    clearTimeout(deb);
    deb = setTimeout(() => {
      const termo = buscaEl.value.trim();
      termo ? renderListaFiltrada(termo) : mostrarPadrao();
    }, 250);
  });
  buscaEl.focus();
}

function _limparColunaThread() {
  _conversaAtivaEmail = null;
  _marcarItemAtivoNaLista(null);
  const corpo = _colunaThread();
  if (corpo) corpo.innerHTML = `<div class="msg-thread-vazio">Selecione uma conversa ou inicie uma nova.</div>`;
}

async function _renderListaLateral() {
  const col = document.querySelector('#mensagens-panel .msg-lista-col');
  if (!col) return;

  const [recadosTodos, conversas] = await Promise.all([_listarRecadosRecebidos(), _listarConversas()]);
  const recadosNaoLidos = recadosTodos.filter(r => !r.lidoPor?.[meuEmail()]);

  const itemRecado = r => `
    <div class="msg-item msg-item-recado" data-id="${r.id}" data-de="${r.de}">
      <div class="msg-item-corpo">
        <div class="msg-item-topo">
          <span class="msg-item-nome nl" style="color:var(--azul-500);">Recado — ${escHtmlMsg(r.deNome || r.de)}</span>
          <span class="msg-item-hora">${_formatarData(r.enviadoEm)}</span>
        </div>
        <div class="msg-item-prev nl">${escHtmlMsg(r.texto)}</div>
      </div>
      <span class="msg-dot"></span>
    </div>`;

  const itemConversa = c => {
    const outro = _outroParticipante(c);
    const ult = c.ultimaLeitura?.[meuEmail()]?.toMillis?.() || 0;
    const naoLida = (c.ultimaMensagemEm?.toMillis?.() || 0) > ult && c.ultimaMensagemTexto;
    return `
    <div class="msg-item msg-item-conversa" data-email="${outro}">
      <div class="msg-item-corpo">
        <div class="msg-item-topo">
          <span class="msg-item-nome ${naoLida ? 'nl' : ''}">${_nomeContato(outro)}</span>
          <span class="msg-item-hora">${_formatarData(c.ultimaMensagemEm)}</span>
        </div>
        <div class="msg-item-prev ${naoLida ? 'nl' : ''}">${escHtmlMsg(c.ultimaMensagemTexto || 'Sem mensagens ainda')}</div>
      </div>
      ${naoLida ? '<span class="msg-dot"></span>' : ''}
    </div>`;
  };

  const semNada = !recadosNaoLidos.length && !conversas.length;
  col.innerHTML = `
    <div class="msg-acoes">
      <button class="msg-btn-acao msg-btn-novo-recado">+ Recado para toda a unidade</button>
      <button class="msg-btn-acao msg-btn-nova-conversa">+ Nova conversa</button>
    </div>
    ${recadosNaoLidos.length ? `<div class="msg-secao-label">Recados</div>${recadosNaoLidos.map(itemRecado).join('')}` : ''}
    ${conversas.length ? `<div class="msg-secao-label">Conversas</div>${conversas.map(itemConversa).join('')}` : ''}
    ${semNada ? '<div class="msg-vazio">Nenhuma mensagem ainda. Comece uma conversa acima.</div>' : ''}
    ${recadosTodos.length ? `<button class="msg-btn-acao msg-btn-historico" style="margin-top:10px;color:var(--azul-500);">Ver histórico de recados →</button>` : ''}`;

  col.querySelector('.msg-btn-novo-recado').onclick = _renderNovoRecado;
  col.querySelector('.msg-btn-nova-conversa').onclick = _renderNovaConversa;
  col.querySelector('.msg-btn-historico')?.addEventListener('click', _renderHistoricoRecados);
  col.querySelectorAll('.msg-item-recado').forEach(el => {
    el.onclick = () => _abrirThread(el.dataset.de, el.dataset.id);
  });
  col.querySelectorAll('.msg-item-conversa').forEach(el => {
    el.onclick = () => _abrirThread(el.dataset.email);
  });
  _marcarItemAtivoNaLista(_conversaAtivaEmail);

  _atualizarBadgeMensagens();
}

async function _renderHistoricoRecados() {
  const corpo = _colunaThread();
  if (!corpo) return;
  _marcarItemAtivoNaLista(null);
  corpo.innerHTML = `<div class="msg-thread-vazio">Carregando…</div>`;

  const recados = await _listarRecadosRecebidos();
  const item = r => {
    const lido = !!r.lidoPor?.[meuEmail()];
    return `
    <div class="msg-item msg-item-recado" data-id="${r.id}" data-de="${r.de}" style="border-radius:8px;">
      <div class="msg-item-corpo">
        <div class="msg-item-topo">
          <span class="msg-item-nome" style="color:${lido ? 'var(--txt-3)' : 'var(--azul-500)'};">Recado — ${escHtmlMsg(r.deNome || r.de)}</span>
          <span class="msg-item-hora">${_formatarData(r.enviadoEm)}</span>
        </div>
        <div class="msg-item-prev" style="color:${lido ? 'var(--txt-3)' : 'var(--txt-1)'};">${escHtmlMsg(r.texto)}</div>
      </div>
    </div>`;
  };

  corpo.innerHTML = `
    <div class="msg-thread-head">
      <div class="msg-thread-head-nome" style="flex:1;">Histórico de recados</div>
      <button class="msg-drawer-close" title="Cancelar" aria-label="Cancelar">✕</button>
    </div>
    <div class="msg-form-col">
      ${recados.length ? recados.map(item).join('') : '<div class="msg-vazio">Nenhum recado recebido ainda.</div>'}
    </div>`;
  corpo.querySelector('.msg-drawer-close').onclick = () => _limparColunaThread();
  corpo.querySelectorAll('.msg-item-recado').forEach(el => {
    el.onclick = () => _abrirThread(el.dataset.de, el.dataset.id);
  });
}

function _criarPainelMensagens() {
  let painel = document.getElementById('mensagens-panel');
  if (painel) return painel;

  painel = document.createElement('div');
  painel.id = 'mensagens-panel';
  painel.className = 'msg-overlay';
  painel.innerHTML = `
    <div class="msg-drawer">
      <div class="msg-drawer-head">
        <h2>Mensagens</h2>
        <button class="msg-drawer-close" id="msg-drawer-fechar" title="Fechar" aria-label="Fechar">✕</button>
      </div>
      <div class="msg-drawer-body">
        <div class="msg-lista-col"></div>
        <div class="msg-thread-col"><div class="msg-thread-vazio">Selecione uma conversa ou inicie uma nova.</div></div>
      </div>
    </div>`;
  document.body.appendChild(painel);

  const fechar = () => { painel.remove(); _conversaAtivaEmail = null; };
  painel.querySelector('#msg-drawer-fechar').onclick = fechar;
  painel.addEventListener('mousedown', ev => { if (ev.target === painel) fechar(); });

  return painel;
}

window._toggleMensagensPanel = function () {
  const existente = document.getElementById('mensagens-panel');
  if (existente) { existente.remove(); _conversaAtivaEmail = null; return; }
  if (!_user || !window._presencaInfo) return;
  _criarPainelMensagens();
  _renderListaLateral();
};
