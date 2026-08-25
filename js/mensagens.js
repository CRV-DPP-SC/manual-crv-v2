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
  const tarefas = [_listarMensagens(id), _marcarConversaLida(id)];
  let recadoOrigem = null;
  if (origemRecado) {
    tarefas.push(_marcarRecadoLido(origemRecado));
    try { const s = await getDoc(doc(db, 'recados', origemRecado)); if (s.exists()) recadoOrigem = s.data(); } catch (_) {}
  }
  const [mensagens] = await Promise.all(tarefas);

  const bolha = m => `
    <div style="display:flex;${m.de === meuEmail() ? 'justify-content:flex-end;' : ''}margin:4px 0;">
      <div style="max-width:78%;padding:6px 10px;border-radius:10px;font-size:.78rem;background:${m.de === meuEmail() ? 'var(--azul-400,#3b82f6)' : '#f0f0ee'};color:${m.de === meuEmail() ? '#fff' : 'var(--cinza-900,#1a1a17)'};">
        ${escHtmlMsg(m.texto)}
      </div>
    </div>`;

  const recadoHtml = recadoOrigem ? `
    <div style="background:var(--azul-50,#f0f7ff);border-radius:8px;padding:8px 10px;margin-bottom:8px;">
      <div style="font-size:.66rem;font-weight:700;color:var(--azul-400,#3b82f6);text-transform:uppercase;letter-spacing:.03em;">Recado original — ${escHtmlMsg(recadoOrigem.deNome || recadoOrigem.de)}</div>
      <div style="font-size:.76rem;color:var(--cinza-900,#1a1a17);margin-top:2px;">${escHtmlMsg(recadoOrigem.texto)}</div>
    </div>` : '';

  corpo.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;padding:4px 2px 8px;border-bottom:0.5px solid rgba(0,0,0,.08);margin-bottom:6px;">
      <button class="msg-voltar" style="border:none;background:none;cursor:pointer;font-size:.8rem;color:var(--cinza-500,#8b897f);">←</button>
      <span style="font-size:.78rem;font-weight:600;color:var(--cinza-800,#38372f);">${_nomeContato(outroEmail)}</span>
    </div>
    ${recadoHtml}
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
    input.disabled = true;
    try {
      await enviarMensagem(outroEmail, texto, origemRecado);
      input.value = '';
      await _abrirThread(outroEmail, origemRecado);
      _atualizarBadgeMensagens();
    } catch (e) {
      console.error('Erro ao enviar mensagem:', e);
      alert('Não foi possível enviar a mensagem. Tente novamente em instantes.');
      input.disabled = false;
    }
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

  const srCods = Object.keys(window.SR_INFO || {}).sort();
  let _seq = 0;
  const arvoreHtml = srCods.map(sr => {
    const id = 'nr-' + (_seq++);
    const nomeSr = escHtmlMsg(window.SR_INFO?.[sr]?.nome || sr);
    const unidades = (window.UNIDADES || []).filter(u => u.sr === sr);
    const opcaoRegional = `
      <div class="nr-item" data-tipo="regional" data-destino="${sr}" data-label="${sr} — ${nomeSr}"
        style="padding:5px 6px 5px 24px;border-radius:6px;cursor:pointer;font-size:.76rem;font-weight:600;color:var(--azul-400,#3b82f6);">Enviar para toda a regional</div>`;
    const unidadesHtml = unidades.map(u => `
      <div class="nr-item" data-tipo="unidade" data-destino="${escHtmlMsg(u.email)}" data-label="${escHtmlMsg(u.nome)}"
        style="padding:5px 6px 5px 24px;border-radius:6px;cursor:pointer;font-size:.76rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtmlMsg(u.nome)}</div>`).join('');
    return `
      <div>
        <div class="nr-regional-row" data-alvo="${id}" style="display:flex;align-items:center;gap:6px;padding:6px;border-radius:6px;cursor:pointer;">
          <span class="nr-seta" style="font-size:.6rem;color:var(--cinza-500,#8b897f);transition:transform .15s;flex-shrink:0;">▸</span>
          <span style="flex:1;min-width:0;font-size:.74rem;font-weight:600;color:var(--cinza-800,#38372f);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${sr} — ${nomeSr}</span>
        </div>
        <div id="${id}" class="online-grupo-conteudo" style="display:none;">${opcaoRegional}${unidadesHtml}</div>
      </div>`;
  }).join('');

  corpo.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;padding:4px 2px 8px;border-bottom:0.5px solid rgba(0,0,0,.08);margin-bottom:8px;">
      <button class="msg-voltar" style="border:none;background:none;cursor:pointer;font-size:.8rem;color:var(--cinza-500,#8b897f);">←</button>
      <span style="font-size:.78rem;font-weight:600;color:var(--cinza-800,#38372f);">Novo recado</span>
    </div>
    <div class="nr-resumo" style="display:none;align-items:center;justify-content:space-between;gap:6px;padding:7px 8px;background:var(--azul-50,#f0f7ff);border-radius:6px;margin-bottom:8px;font-size:.75rem;color:var(--cinza-900,#1a1a17);">
      <span>Para: <strong class="nr-resumo-nome"></strong></span>
      <button class="nr-trocar" style="border:none;background:none;color:var(--azul-400,#3b82f6);font-size:.7rem;cursor:pointer;">trocar</button>
    </div>
    <div class="nr-dica" style="font-size:.68rem;color:var(--cinza-500,#8b897f);padding:0 2px 6px;">Clique numa regional para ver as unidades dela.</div>
    <div class="nr-arvore" style="max-height:240px;overflow-y:auto;">${arvoreHtml}</div>
    <div class="nr-form" style="display:none;flex-direction:column;gap:6px;">
      <textarea class="msg-texto-recado" rows="3" placeholder="Escrever recado…" style="font-size:.78rem;padding:6px 8px;border:0.5px solid rgba(0,0,0,.15);border-radius:6px;resize:vertical;"></textarea>
      <button class="msg-enviar-recado" style="padding:7px;border:none;border-radius:6px;background:var(--azul-400,#3b82f6);color:#fff;font-size:.78rem;font-weight:600;cursor:pointer;">Enviar recado</button>
    </div>`;
  corpo.querySelector('.msg-voltar').onclick = () => _renderInicio();

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
      _renderInicio();
    } catch (e) {
      console.error('Erro ao enviar recado:', e);
      alert('Não foi possível enviar o recado. Tente novamente em instantes.');
      ev.target.disabled = false;
    }
  };
}

async function _renderNovaConversa() {
  const painel = document.getElementById('mensagens-panel');
  const corpo = painel.querySelector('.msg-corpo');
  const info = window._presencaInfo;
  const ehDpp = info?.tipo === 'crv';
  const ehInstitucional = ['crv', 'super', 'dir', 'cpen'].includes(info?.tipo);
  corpo.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;padding:4px 2px 8px;border-bottom:0.5px solid rgba(0,0,0,.08);margin-bottom:6px;">
      <button class="msg-voltar" style="border:none;background:none;cursor:pointer;font-size:.8rem;color:var(--cinza-500,#8b897f);">←</button>
      <span style="font-size:.78rem;font-weight:600;color:var(--cinza-800,#38372f);">Mensagem direta</span>
    </div>
    <input type="text" class="msg-busca-contato" placeholder="${ehDpp ? 'Buscar por nome, unidade, SR…' : 'Buscar…'}" style="width:100%;box-sizing:border-box;font-size:.75rem;padding:6px 8px;border:0.5px solid rgba(0,0,0,.15);border-radius:6px;margin-bottom:6px;">
    <div class="msg-lista-contatos" style="max-height:280px;overflow-y:auto;"></div>`;
  corpo.querySelector('.msg-voltar').onclick = () => _renderInicio();

  const institucionais = await _contatosElegiveis();
  const listaEl = corpo.querySelector('.msg-lista-contatos');
  const buscaEl = corpo.querySelector('.msg-busca-contato');
  const temContato = email => institucionais.some(c => c.email === email);

  const linhaContato = c => `
    <div class="msg-contato" data-email="${c.email}" style="padding:5px 6px 5px 24px;border-radius:6px;cursor:pointer;font-size:.76rem;color:var(--cinza-900,#1a1a17);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.nome}</div>`;

  const renderListaPlana = itens => {
    listaEl.innerHTML = itens.length ? itens.map(linhaContato).join('')
      : `<div style="font-size:.75rem;color:var(--cinza-500,#8b897f);padding:6px;">Nenhum contato encontrado.</div>`;
  };

  const renderArvore = () => {
    const srCods = Object.keys(window.SR_INFO || {}).sort();
    let _seq = 0;
    listaEl.innerHTML = srCods.map(sr => {
      const id = 'nc-' + (_seq++);
      const nomeSr = window.SR_INFO?.[sr]?.nome || sr;
      const srEmail = sr.toLowerCase() + '@pp.sc.gov.br';
      const contatoSr = temContato(srEmail)
        ? `<div class="msg-contato" data-email="${srEmail}" style="padding:5px 6px 5px 24px;border-radius:6px;cursor:pointer;font-size:.76rem;font-weight:600;color:var(--azul-400,#3b82f6);">Superintendente</div>` : '';
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
              <span class="nc-seta" style="font-size:.55rem;color:var(--cinza-500,#8b897f);flex-shrink:0;">▸</span>
              <span style="flex:1;min-width:0;font-size:.74rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${u.nome}</span>
            </div>
            <div id="${uid}" class="online-grupo-conteudo" style="display:none;">${pessoas || '<div style="font-size:.7rem;color:var(--cinza-500,#8b897f);padding:4px 6px 4px 42px;">—</div>'}</div>
          </div>`;
      }).join('');
      return `
        <div>
          <div class="nc-regional-row" data-alvo="${id}" style="display:flex;align-items:center;gap:6px;padding:6px;border-radius:6px;cursor:pointer;">
            <span class="nc-seta" style="font-size:.6rem;color:var(--cinza-500,#8b897f);flex-shrink:0;">▸</span>
            <span style="flex:1;min-width:0;font-size:.74rem;font-weight:600;color:var(--cinza-800,#38372f);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${sr} — ${nomeSr}</span>
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

async function _renderInicio() {
  const painel = document.getElementById('mensagens-panel');
  if (!painel) return;
  const corpo = painel.querySelector('.msg-corpo');
  corpo.innerHTML = `<div style="padding:10px;font-size:.75rem;color:var(--cinza-500,#8b897f);">Carregando…</div>`;

  const [recadosTodos, conversasTodas] = await Promise.all([_listarRecadosRecebidos(), _listarConversas()]);

  const recados = recadosTodos.filter(r => !r.lidoPor?.[meuEmail()]);
  const conversas = conversasTodas.filter(c => {
    const ult = c.ultimaLeitura?.[meuEmail()]?.toMillis?.() || 0;
    return (c.ultimaMensagemEm?.toMillis?.() || 0) > ult && c.ultimaMensagemTexto;
  });

  const itemRecado = r => `
    <div class="msg-item-recado" data-id="${r.id}" data-de="${r.de}" style="padding:8px 6px;border-radius:6px;cursor:pointer;border-bottom:0.5px solid rgba(0,0,0,.05);">
      <div style="display:flex;justify-content:space-between;gap:6px;align-items:baseline;">
        <span style="font-size:.7rem;font-weight:700;color:var(--azul-400,#3b82f6);text-transform:uppercase;letter-spacing:.03em;">Recado — ${escHtmlMsg(r.deNome || r.de)}</span>
        <span style="font-size:.64rem;color:var(--cinza-500,#8b897f);flex-shrink:0;">${_formatarData(r.enviadoEm)}</span>
      </div>
      <div style="font-size:.76rem;color:var(--cinza-900,#1a1a17);margin-top:2px;">${escHtmlMsg(r.texto)}</div>
    </div>`;

  const itemConversa = c => {
    const outro = _outroParticipante(c);
    return `
    <div class="msg-item-conversa" data-email="${outro}" style="padding:8px 6px;border-radius:6px;cursor:pointer;border-bottom:0.5px solid rgba(0,0,0,.05);display:flex;justify-content:space-between;align-items:center;gap:6px;">
      <div style="min-width:0;">
        <div style="font-size:.76rem;font-weight:700;color:var(--cinza-900,#1a1a17);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_nomeContato(outro)}</div>
        <div style="font-size:.7rem;color:var(--cinza-500,#8b897f);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;">${escHtmlMsg(c.ultimaMensagemTexto || '')}</div>
      </div>
      <span style="font-size:.64rem;color:var(--cinza-500,#8b897f);flex-shrink:0;">${_formatarData(c.ultimaMensagemEm)}</span>
    </div>`;
  };

  const semNada = !recados.length && !conversas.length;
  corpo.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px;">
      <button class="msg-btn-novo-recado" style="width:100%;padding:7px 8px;border:0.5px solid rgba(0,0,0,.15);border-radius:6px;background:#fff;font-size:.72rem;text-align:left;cursor:pointer;">+ Recado para todos usuários da Unidade Prisional</button>
      <button class="msg-btn-nova-conversa" style="width:100%;padding:7px 8px;border:0.5px solid rgba(0,0,0,.15);border-radius:6px;background:#fff;font-size:.72rem;text-align:left;cursor:pointer;">+ Mensagem com Destinatário Específico</button>
    </div>
    <div style="max-height:300px;overflow-y:auto;">
      ${semNada ? `<div style="font-size:.75rem;color:var(--cinza-500,#8b897f);padding:8px 4px;">Nenhuma mensagem pendente. Tudo lido por aqui.</div>` : ''}
      ${recados.map(itemRecado).join('')}
      ${conversas.map(itemConversa).join('')}
    </div>
    ${recadosTodos.length ? `<button class="msg-btn-historico" style="width:100%;margin-top:8px;padding:6px;border:none;background:none;color:var(--azul-400,#3b82f6);font-size:.7rem;cursor:pointer;">Ver histórico de recados da unidade/regional →</button>` : ''}`;

  corpo.querySelector('.msg-btn-novo-recado').onclick = _renderNovoRecado;
  corpo.querySelector('.msg-btn-nova-conversa').onclick = _renderNovaConversa;
  corpo.querySelector('.msg-btn-historico')?.addEventListener('click', _renderHistoricoRecados);
  corpo.querySelectorAll('.msg-item-recado').forEach(el => {
    el.onclick = () => _abrirThread(el.dataset.de, el.dataset.id);
  });
  corpo.querySelectorAll('.msg-item-conversa').forEach(el => {
    el.onclick = () => _abrirThread(el.dataset.email);
  });

  _atualizarBadgeMensagens();
}

async function _renderHistoricoRecados() {
  const painel = document.getElementById('mensagens-panel');
  if (!painel) return;
  const corpo = painel.querySelector('.msg-corpo');
  corpo.innerHTML = `<div style="padding:10px;font-size:.75rem;color:var(--cinza-500,#8b897f);">Carregando…</div>`;

  const recados = await _listarRecadosRecebidos();
  const item = r => {
    const lido = !!r.lidoPor?.[meuEmail()];
    return `
    <div class="msg-item-recado" data-id="${r.id}" data-de="${r.de}" style="padding:8px 6px;border-radius:6px;cursor:pointer;border-bottom:0.5px solid rgba(0,0,0,.05);">
      <div style="display:flex;justify-content:space-between;gap:6px;align-items:baseline;">
        <span style="font-size:.7rem;font-weight:700;color:${lido ? 'var(--cinza-500,#8b897f)' : 'var(--azul-400,#3b82f6)'};text-transform:uppercase;letter-spacing:.03em;">Recado — ${escHtmlMsg(r.deNome || r.de)}</span>
        <span style="font-size:.64rem;color:var(--cinza-500,#8b897f);flex-shrink:0;">${_formatarData(r.enviadoEm)}</span>
      </div>
      <div style="font-size:.76rem;color:${lido ? 'var(--cinza-500,#8b897f)' : 'var(--cinza-900,#1a1a17)'};margin-top:2px;">${escHtmlMsg(r.texto)}</div>
    </div>`;
  };

  corpo.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;padding:4px 2px 8px;border-bottom:0.5px solid rgba(0,0,0,.08);margin-bottom:6px;">
      <button class="msg-voltar" style="border:none;background:none;cursor:pointer;font-size:.8rem;color:var(--cinza-500,#8b897f);">←</button>
      <span style="font-size:.78rem;font-weight:600;color:var(--cinza-800,#38372f);">Histórico de recados</span>
    </div>
    <div style="max-height:340px;overflow-y:auto;">
      ${recados.length ? recados.map(item).join('') : '<div style="font-size:.75rem;color:var(--cinza-500,#8b897f);padding:8px 4px;">Nenhum recado recebido ainda.</div>'}
    </div>`;
  corpo.querySelector('.msg-voltar').onclick = () => _renderInicio();
  corpo.querySelectorAll('.msg-item-recado').forEach(el => {
    el.onclick = () => _abrirThread(el.dataset.de, el.dataset.id);
  });
}

function _criarPainelMensagens() {
  let painel = document.getElementById('mensagens-panel');
  if (painel) return painel;

  painel = document.createElement('div');
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
    const caminho = ev.composedPath ? ev.composedPath() : [ev.target];
    if (!caminho.includes(painel) && !caminho.includes(document.getElementById('msg-chip'))) {
      painel.remove();
      document.removeEventListener('click', fechar);
    }
  };
  setTimeout(() => document.addEventListener('click', fechar), 0);

  return painel;
}

window._toggleMensagensPanel = function () {
  const existente = document.getElementById('mensagens-panel');
  if (existente) { existente.remove(); return; }
  if (!_user || !window._presencaInfo) return;
  _criarPainelMensagens();
  _renderInicio();
};
