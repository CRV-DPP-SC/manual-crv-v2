// ================================================
// CRV — Mensagens (recados por unidade/regional + conversas individuais)
// js/mensagens.js
// ================================================
import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, getDoc, getDocs, setDoc,
         query, where, orderBy, limit, serverTimestamp }
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

onAuthStateChanged(_auth, user => {
  _user = user || null;
  if (user) setTimeout(_atualizarBadgeMensagens, 1500);
  else document.getElementById('mensagens-panel')?.remove();
});
setInterval(() => { if (_user) _atualizarBadgeMensagens(); }, 3 * 60 * 1000);

// ── Utilitários ──
const meuEmail = () => (_user?.email || '').toLowerCase();
const convId = (a, b) => [a, b].sort().join('__');
const chaveLocal = () => 'crv_msg_ultima_leitura_recados_' + meuEmail();

function _rotuloPerfil(email) {
  const e = (email || '').toLowerCase();
  if (/^sr0[1-8]@pp\.sc\.gov\.br$/.test(e)) return 'Superintendente';
  if (/^.+dir@pp\.sc\.gov\.br$/.test(e))    return 'Diretor(a)';
  if (/^.+cpen@pp\.sc\.gov\.br$/.test(e))   return 'Coord. Execução Penal';
  return '';
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
  if (info.tipo === 'crv') return _diretorioInstitucional();
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
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      participantes: [meuEmail(), outroEmail].sort(),
      criadaEm: serverTimestamp(),
      origemRecado: origemRecado || null,
      ultimaMensagemEm: serverTimestamp(),
      ultimaMensagemTexto: '',
      ultimaLeitura: {}
    });
  }
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
    const ultimaLocal = Number(localStorage.getItem(chaveLocal()) || 0);
    n += recados.filter(r => (r.enviadoEm?.toMillis?.() || 0) > ultimaLocal && r.de !== meuEmail()).length;
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
  const rot = _rotuloPerfil(email);
  if (rot) {
    const unidade = (window.UNIDADES || []).find(u => email.startsWith(u.email.split('@')[0]));
    return rot + (unidade ? ' — ' + unidade.nome : '');
  }
  return email;
}

async function _abrirThread(outroEmail, origemRecado) {
  const painel = document.getElementById('mensagens-panel');
  if (!painel) return;
  const corpo = painel.querySelector('.msg-corpo');
  corpo.innerHTML = `<div style="padding:10px;font-size:.75rem;color:var(--cinza-500,#8b897f);">Carregando…</div>`;

  const id = convId(meuEmail(), outroEmail);
  const [mensagens] = await Promise.all([_listarMensagens(id), _marcarConversaLida(id)]);

  const bolha = m => `
    <div style="display:flex;${m.de === meuEmail() ? 'justify-content:flex-end;' : ''}margin:4px 0;">
      <div style="max-width:78%;padding:6px 10px;border-radius:10px;font-size:.78rem;background:${m.de === meuEmail() ? 'var(--azul-400,#3b82f6)' : '#f0f0ee'};color:${m.de === meuEmail() ? '#fff' : 'var(--cinza-900,#1a1a17)'};">
        ${escHtmlMsg(m.texto)}
      </div>
    </div>`;

  corpo.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;padding:4px 2px 8px;border-bottom:0.5px solid rgba(0,0,0,.08);margin-bottom:6px;">
      <button class="msg-voltar" style="border:none;background:none;cursor:pointer;font-size:.8rem;color:var(--cinza-500,#8b897f);">←</button>
      <span style="font-size:.78rem;font-weight:600;color:var(--cinza-800,#38372f);">${_nomeContato(outroEmail)}</span>
    </div>
    <div class="msg-lista" style="max-height:220px;overflow-y:auto;padding:0 2px;">
      ${mensagens.length ? mensagens.map(bolha).join('') : '<div style="font-size:.75rem;color:var(--cinza-500,#8b897f);padding:6px 2px;">Nenhuma mensagem ainda.</div>'}
    </div>
    <div style="display:flex;gap:6px;margin-top:8px;">
      <input type="text" class="msg-input" placeholder="Escrever mensagem…" style="flex:1;font-size:.78rem;padding:6px 8px;border:0.5px solid rgba(0,0,0,.15);border-radius:6px;">
      <button class="msg-enviar" style="padding:6px 10px;border:none;border-radius:6px;background:var(--azul-400,#3b82f6);color:#fff;font-size:.78rem;cursor:pointer;">Enviar</button>
    </div>`;

  corpo.querySelector('.msg-voltar').onclick = () => _renderInicio();
  const input = corpo.querySelector('.msg-input');
  const enviar = async () => {
    const texto = input.value;
    if (!texto.trim()) return;
    input.value = '';
    await enviarMensagem(outroEmail, texto, origemRecado);
    _abrirThread(outroEmail, origemRecado);
    _atualizarBadgeMensagens();
  };
  corpo.querySelector('.msg-enviar').onclick = enviar;
  input.addEventListener('keydown', ev => { if (ev.key === 'Enter') enviar(); });
  input.focus();
}

function escHtmlMsg(s) {
  return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

async function _renderNovoRecado() {
  const painel = document.getElementById('mensagens-panel');
  const corpo = painel.querySelector('.msg-corpo');
  const unidadesOpts = (window.UNIDADES || []).map(u => `<option value="${u.email}">${u.nome}</option>`).join('');
  const srOpts = Object.keys(window.SR_INFO || {}).sort().map(c => `<option value="${c}">${c} — ${window.SR_INFO[c]?.nome || c}</option>`).join('');
  corpo.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;padding:4px 2px 8px;border-bottom:0.5px solid rgba(0,0,0,.08);margin-bottom:8px;">
      <button class="msg-voltar" style="border:none;background:none;cursor:pointer;font-size:.8rem;color:var(--cinza-500,#8b897f);">←</button>
      <span style="font-size:.78rem;font-weight:600;color:var(--cinza-800,#38372f);">Novo recado</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;">
      <select class="msg-destino-tipo" style="font-size:.75rem;padding:6px;border:0.5px solid rgba(0,0,0,.15);border-radius:6px;">
        <option value="unidade">Para uma unidade prisional</option>
        <option value="regional">Para uma superintendência regional</option>
      </select>
      <select class="msg-destino-unidade" style="font-size:.75rem;padding:6px;border:0.5px solid rgba(0,0,0,.15);border-radius:6px;">${unidadesOpts}</select>
      <select class="msg-destino-regional" style="display:none;font-size:.75rem;padding:6px;border:0.5px solid rgba(0,0,0,.15);border-radius:6px;">${srOpts}</select>
      <textarea class="msg-texto-recado" rows="3" placeholder="Escrever recado…" style="font-size:.78rem;padding:6px 8px;border:0.5px solid rgba(0,0,0,.15);border-radius:6px;resize:vertical;"></textarea>
      <button class="msg-enviar-recado" style="padding:7px;border:none;border-radius:6px;background:var(--azul-400,#3b82f6);color:#fff;font-size:.78rem;font-weight:600;cursor:pointer;">Enviar recado</button>
    </div>`;
  corpo.querySelector('.msg-voltar').onclick = () => _renderInicio();
  const tipoSel = corpo.querySelector('.msg-destino-tipo');
  const selUnidade = corpo.querySelector('.msg-destino-unidade');
  const selRegional = corpo.querySelector('.msg-destino-regional');
  tipoSel.addEventListener('change', () => {
    const eUnidade = tipoSel.value === 'unidade';
    selUnidade.style.display = eUnidade ? '' : 'none';
    selRegional.style.display = eUnidade ? 'none' : '';
  });
  corpo.querySelector('.msg-enviar-recado').onclick = async () => {
    const texto = corpo.querySelector('.msg-texto-recado').value;
    if (!texto.trim()) return;
    const destinoTipo = tipoSel.value;
    const destino = destinoTipo === 'unidade' ? selUnidade.value : selRegional.value;
    await enviarRecado(destinoTipo, destino, texto);
    _renderInicio();
  };
}

async function _renderNovaConversa() {
  const painel = document.getElementById('mensagens-panel');
  const corpo = painel.querySelector('.msg-corpo');
  const info = window._presencaInfo;
  const ehDpp = info?.tipo === 'crv';
  corpo.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;padding:4px 2px 8px;border-bottom:0.5px solid rgba(0,0,0,.08);margin-bottom:6px;">
      <button class="msg-voltar" style="border:none;background:none;cursor:pointer;font-size:.8rem;color:var(--cinza-500,#8b897f);">←</button>
      <span style="font-size:.78rem;font-weight:600;color:var(--cinza-800,#38372f);">Nova conversa</span>
    </div>
    <input type="text" class="msg-busca-contato" placeholder="${ehDpp ? 'Buscar por nome, unidade, SR…' : 'Buscar…'}" style="width:100%;box-sizing:border-box;font-size:.75rem;padding:6px 8px;border:0.5px solid rgba(0,0,0,.15);border-radius:6px;margin-bottom:6px;">
    <div class="msg-lista-contatos" style="max-height:260px;overflow-y:auto;"></div>`;
  corpo.querySelector('.msg-voltar').onclick = () => _renderInicio();

  const institucionais = await _contatosElegiveis();
  const listaEl = corpo.querySelector('.msg-lista-contatos');
  const buscaEl = corpo.querySelector('.msg-busca-contato');

  const linhaContato = c => `
    <div class="msg-contato" data-email="${c.email}" style="padding:6px;border-radius:6px;cursor:pointer;font-size:.76rem;color:var(--cinza-900,#1a1a17);">${c.nome}</div>`;

  const renderLista = async termo => {
    let itens = institucionais.filter(c => !termo || c.nome.toLowerCase().includes(termo.toLowerCase()));
    if (ehDpp && termo && termo.trim().length >= 2) {
      const servidores = await _buscarServidores(termo);
      itens = itens.concat(servidores);
    }
    listaEl.innerHTML = itens.length ? itens.map(linhaContato).join('')
      : `<div style="font-size:.75rem;color:var(--cinza-500,#8b897f);padding:6px;">Nenhum contato encontrado.</div>`;
    listaEl.querySelectorAll('.msg-contato').forEach(el => {
      el.onclick = () => _abrirThread(el.dataset.email);
    });
  };
  renderLista('');
  let deb;
  buscaEl.addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(() => renderLista(buscaEl.value), 250); });
  buscaEl.focus();
}

async function _renderInicio() {
  const painel = document.getElementById('mensagens-panel');
  if (!painel) return;
  const corpo = painel.querySelector('.msg-corpo');
  corpo.innerHTML = `<div style="padding:10px;font-size:.75rem;color:var(--cinza-500,#8b897f);">Carregando…</div>`;

  const [recados, conversas] = await Promise.all([_listarRecadosRecebidos(), _listarConversas()]);
  localStorage.setItem(chaveLocal(), String(Date.now()));

  const itemRecado = r => `
    <div class="msg-item-recado" data-id="${r.id}" data-de="${r.de}" style="padding:8px 6px;border-radius:6px;cursor:pointer;border-bottom:0.5px solid rgba(0,0,0,.05);">
      <div style="display:flex;justify-content:space-between;gap:6px;">
        <span style="font-size:.7rem;font-weight:700;color:var(--azul-400,#3b82f6);text-transform:uppercase;letter-spacing:.03em;">Recado — ${r.deNome || r.de}</span>
      </div>
      <div style="font-size:.76rem;color:var(--cinza-900,#1a1a17);margin-top:2px;">${escHtmlMsg(r.texto)}</div>
    </div>`;

  const itemConversa = c => {
    const outro = _outroParticipante(c);
    const ult = c.ultimaLeitura?.[meuEmail()]?.toMillis?.() || 0;
    const naoLida = (c.ultimaMensagemEm?.toMillis?.() || 0) > ult && c.ultimaMensagemTexto;
    return `
    <div class="msg-item-conversa" data-email="${outro}" style="padding:8px 6px;border-radius:6px;cursor:pointer;border-bottom:0.5px solid rgba(0,0,0,.05);display:flex;justify-content:space-between;align-items:center;gap:6px;">
      <div style="min-width:0;">
        <div style="font-size:.76rem;font-weight:${naoLida ? '700' : '500'};color:var(--cinza-900,#1a1a17);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_nomeContato(outro)}</div>
        <div style="font-size:.7rem;color:var(--cinza-500,#8b897f);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;">${escHtmlMsg(c.ultimaMensagemTexto || '')}</div>
      </div>
      ${naoLida ? '<span style="width:7px;height:7px;border-radius:50%;background:var(--azul-400,#3b82f6);flex-shrink:0;"></span>' : ''}
    </div>`;
  };

  const semNada = !recados.length && !conversas.length;
  corpo.innerHTML = `
    <div style="display:flex;gap:6px;margin-bottom:8px;">
      <button class="msg-btn-novo-recado" style="flex:1;padding:6px;border:0.5px solid rgba(0,0,0,.15);border-radius:6px;background:#fff;font-size:.72rem;cursor:pointer;">+ Recado p/ unidade</button>
      <button class="msg-btn-nova-conversa" style="flex:1;padding:6px;border:0.5px solid rgba(0,0,0,.15);border-radius:6px;background:#fff;font-size:.72rem;cursor:pointer;">+ Nova conversa</button>
    </div>
    <div style="max-height:300px;overflow-y:auto;">
      ${semNada ? `<div style="font-size:.75rem;color:var(--cinza-500,#8b897f);padding:8px 4px;">Nenhuma mensagem por aqui ainda.</div>` : ''}
      ${recados.map(itemRecado).join('')}
      ${conversas.map(itemConversa).join('')}
    </div>`;

  corpo.querySelector('.msg-btn-novo-recado').onclick = _renderNovoRecado;
  corpo.querySelector('.msg-btn-nova-conversa').onclick = _renderNovaConversa;
  corpo.querySelectorAll('.msg-item-recado').forEach(el => {
    el.onclick = () => _abrirThread(el.dataset.de, el.dataset.id);
  });
  corpo.querySelectorAll('.msg-item-conversa').forEach(el => {
    el.onclick = () => _abrirThread(el.dataset.email);
  });

  _atualizarBadgeMensagens();
}

window._toggleMensagensPanel = function () {
  const existente = document.getElementById('mensagens-panel');
  if (existente) { existente.remove(); return; }
  if (!_user || !window._presencaInfo) return;

  const painel = document.createElement('div');
  painel.id = 'mensagens-panel';
  painel.className = 'topbar-online-panel';
  painel.innerHTML = `
    <div style="font-size:.6rem;color:var(--cinza-500,#8b897f);text-transform:uppercase;letter-spacing:.04em;font-weight:700;padding:2px 4px 6px;">Mensagens</div>
    <div class="msg-corpo"></div>`;
  document.body.appendChild(painel);

  const chip = document.getElementById('msg-chip');
  if (chip) {
    const r = chip.getBoundingClientRect();
    painel.style.top = (r.bottom + 6) + 'px';
    painel.style.right = (window.innerWidth - r.right) + 'px';
  }

  const fechar = ev => {
    if (!painel.contains(ev.target) && !ev.target.closest?.('#msg-chip')) {
      painel.remove();
      document.removeEventListener('click', fechar);
    }
  };
  setTimeout(() => document.addEventListener('click', fechar), 0);

  _renderInicio();
};
