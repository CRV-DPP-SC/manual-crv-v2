// ================================================
// CRV — Mural de Avisos (funções compartilhadas)
// js/avisos.js
//
// Usado por js/avisos-modal.js (janela "Li e estou ciente" ao entrar no site)
// e por js/painel.js (tela "Mural de Avisos" com histórico e gestão).
//
// Dados no Firestore:
//   avisos/{id}                  → o aviso (só a CRV cria/arquiva; nunca é apagado)
//   avisos/{id}/leituras/{uid}   → comprovante de ciência de cada usuário
//   avisos_lidos/{uid}           → índice rápido "quais avisos eu já confirmei"
// ================================================
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc,
         query, where, orderBy, onSnapshot, serverTimestamp, writeBatch, getCountFromServer }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
// "?v=2": força o navegador a buscar a versão com APPS_SCRIPT_URL (evita cópia antiga em cache)
import { FIREBASE_CONFIG, escHtml, APPS_SCRIPT_URL } from "./config-crv.js?v=2";

// Obtém o Firestore só na hora do uso: cada página inicializa o app do seu jeito
function db() { return getFirestore(getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG)); }

export const PERFIS_AVISO = {
  dir:      'Diretores(as)',
  cpen:     'Coord. de Execução Penal',
  super:    'Superintendentes',
  servidor: 'Servidores',
  crv:      'Equipe CRV/DPP',
};

/** Data de expiração em ms (ou null se o aviso não expira) */
export function expiraEmMs(a) {
  const e = a?.expiraEm;
  if (!e) return null;
  return e.toMillis ? e.toMillis() : (e instanceof Date ? e.getTime() : null);
}

/** Aviso com data de expiração já vencida */
export function avisoExpirado(a) {
  const ms = expiraEmMs(a);
  return ms !== null && ms <= Date.now();
}

/**
 * "eu" = { tipo: 'crv'|'super'|'dir'|'cpen'|'servidor', email, nome, unidadeEmail, srCod }
 * Diz se um aviso ATIVO (e não expirado) é destinado a este usuário.
 */
export function avisoParaMim(a, eu) {
  if (!a || !eu || a.ativo === false || avisoExpirado(a)) return false;
  const p = a.publico || { tipo: 'todos' };
  if (Array.isArray(p.perfis) && p.perfis.length && !p.perfis.includes(eu.tipo)) return false;
  if (p.tipo === 'regional') return !!eu.srCod && eu.srCod === p.valor;
  if (p.tipo === 'unidade')  return !!eu.unidadeEmail && eu.unidadeEmail === p.valor;
  return true; // todos
}

/** Aviso aparece no histórico do usuário (inclusive arquivados/expirados que eram para ele) */
export function avisoNoMeuHistorico(a, eu) {
  return avisoParaMim({ ...a, ativo: true, expiraEm: null }, eu);
}

/** Texto legível dos destinatários, ex.: "Diretores(as) · SR02 — Sul" */
export function descreverPublico(p, UNIDADES, SR_INFO) {
  p = p || { tipo: 'todos' };
  let onde = 'Todos';
  if (p.tipo === 'regional') onde = p.valor + ' — ' + (SR_INFO?.[p.valor]?.nome || '');
  if (p.tipo === 'unidade')  onde = (UNIDADES || []).find(u => u.email === p.valor)?.nome || p.valor;
  const quem = (p.perfis && p.perfis.length) ? p.perfis.map(x => PERFIS_AVISO[x] || x).join(', ') : 'todos os perfis';
  return `${onde} · ${quem}`;
}

/** Texto do aviso escapado, preservando quebras de linha */
export function textoAvisoHtml(t) {
  return escHtml(t || '').replace(/\n/g, '<br>');
}

export function formatarDataAviso(ts) {
  const ms = ts?.toMillis?.();
  return ms ? new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
}

// ── Anexos (Google Drive via Apps Script) ──
export const ANEXO_MAX_ARQUIVOS = 5;
export const ANEXO_MAX_MB = 10;

function _base64(file) {
  return new Promise((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1]);
    r.onerror = erro;
    r.readAsDataURL(file);
  });
}

/** Envia um arquivo ao Drive e devolve { nome, url, tipo, tamanho } */
export async function enviarAnexoAviso(file) {
  const resp = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({
      pasta: 'Anexos CRV - Mural de Avisos',
      unidadeSlug: new Date().toISOString().slice(0, 7),   // subpasta por mês (ex.: 2026-09)
      nome: file.name,
      tipo: file.type || 'application/octet-stream',
      conteudoBase64: await _base64(file),
    }),
  });
  const json = await resp.json();
  if (!json.ok) throw new Error(json.erro || 'Falha ao enviar o anexo ao Drive.');
  return { nome: file.name, url: json.url, tipo: file.type || '', tamanho: file.size };
}

/** Lista de anexos como links (só aceita endereços do Google Drive/Docs) */
export function anexosHtml(anexos) {
  const validos = (anexos || []).filter(a => /^https:\/\/(drive|docs)\.google\.com\//.test(a?.url || ''));
  if (!validos.length) return '';
  const kb = b => b ? (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB') : '';
  return `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;">${validos.map(a =>
    `<a href="${escHtml(a.url)}" target="_blank" rel="noopener noreferrer"
        style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:8px;border:1px solid var(--border,#e2e8f0);background:var(--surface-2,#f8fafc);color:var(--azul-600,#1d4ed8);font-size:.76rem;font-weight:600;text-decoration:none;max-width:100%;">
       📎 <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px;">${escHtml(a.nome)}</span>
       <span style="color:var(--txt-3,#64748b);font-weight:400;">${kb(a.tamanho)}</span></a>`).join('')}</div>`;
}

// ── Leitura ──
export async function listarAvisos() {
  const snap = await getDocs(query(collection(db(), 'avisos'), orderBy('criadoEm', 'desc')));
  const out = [];
  snap.forEach(d => out.push({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
  return out;
}

/**
 * Acompanha em tempo real os avisos ativos (para a janela aparecer mesmo com o site aberto).
 * Quando um aviso chega na data de expiração, chama o callback de novo, para que ele
 * saia da janela/sino sem precisar recarregar a página.
 */
export function ouvirAvisosAtivos(callback) {
  let timer = null;
  const entregar = out => {
    callback(out);
    clearTimeout(timer);
    const agora = Date.now();
    const proxima = Math.min(...out.map(expiraEmMs).filter(ms => ms !== null && ms > agora));
    if (isFinite(proxima)) {
      // setTimeout aceita no máximo ~24 dias; reavalia em etapas de até 1 dia
      timer = setTimeout(() => entregar(out), Math.min(proxima - agora + 1000, 86400000));
    }
  };
  const unsub = onSnapshot(query(collection(db(), 'avisos'), where('ativo', '==', true)), snap => {
    const out = [];
    snap.forEach(d => out.push({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
    out.sort((a, b) => (a.criadoEm?.toMillis?.() || 0) - (b.criadoEm?.toMillis?.() || 0)); // mais antigo primeiro
    entregar(out);
  }, e => console.error('Erro ao acompanhar avisos:', e));
  return () => { clearTimeout(timer); unsub(); };
}

/** Mapa { avisoId: Timestamp } dos avisos que este usuário já confirmou */
export async function meusAvisosLidos(uid) {
  try {
    const s = await getDoc(doc(db(), 'avisos_lidos', uid));
    return s.exists() ? (s.data().avisos || {}) : {};
  } catch (_) { return {}; }
}

export async function listarLeituras(avisoId) {
  const snap = await getDocs(collection(db(), 'avisos', avisoId, 'leituras'));
  const out = [];
  snap.forEach(d => out.push({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
  out.sort((a, b) => (a.confirmadoEm?.toMillis?.() || 0) - (b.confirmadoEm?.toMillis?.() || 0));
  return out;
}

/** Quantas pessoas confirmaram (conta no servidor, sem baixar a lista) */
export async function contarLeituras(avisoId) {
  try { return (await getCountFromServer(collection(db(), 'avisos', avisoId, 'leituras'))).data().count; }
  catch (_) { return null; }
}

// ── Gravação ──
/** Registra "Li e estou ciente": comprovante no aviso + índice pessoal */
export async function confirmarLeitura(avisoId, uid, eu) {
  const base = db();
  const batch = writeBatch(base);
  batch.set(doc(base, 'avisos', avisoId, 'leituras', uid), {
    uid, email: eu.email || '', nome: eu.nome || eu.email || '',
    perfil: eu.tipo || '', unidadeEmail: eu.unidadeEmail || '', srCod: eu.srCod || '',
    confirmadoEm: serverTimestamp(),
  });
  batch.set(doc(base, 'avisos_lidos', uid), { avisos: { [avisoId]: serverTimestamp() } }, { merge: true });
  try {
    await batch.commit();
  } catch (e) {
    // Comprovante já existia (ex.: índice pessoal perdido): só refaz o índice
    await setDoc(doc(base, 'avisos_lidos', uid), { avisos: { [avisoId]: serverTimestamp() } }, { merge: true });
  }
}

/** Só a equipe CRV publica (a regra do Firestore garante). expiraEm: Date ou null (não expira) */
export async function publicarAviso({ titulo, texto, importante, publico, anexos, expiraEm }, eu) {
  return addDoc(collection(db(), 'avisos'), {
    titulo: titulo.trim(), texto: texto.trim(), importante: !!importante,
    anexos: anexos || [],
    publico: { tipo: publico.tipo || 'todos', valor: publico.valor || '', perfis: publico.perfis || [] },
    expiraEm: expiraEm || null,
    criadoPor: eu.email, criadoPorNome: eu.nome || eu.email,
    criadoEm: serverTimestamp(), ativo: true,
  });
}

/** Edição (só CRV): altera o conteúdo; as confirmações de leitura já feitas são mantidas */
export async function editarAviso(avisoId, { titulo, texto, importante, publico, anexos, expiraEm }, eu) {
  await updateDoc(doc(db(), 'avisos', avisoId), {
    titulo: titulo.trim(), texto: texto.trim(), importante: !!importante,
    anexos: anexos || [],
    publico: { tipo: publico.tipo || 'todos', valor: publico.valor || '', perfis: publico.perfis || [] },
    expiraEm: expiraEm || null,
    editadoPor: eu.email, editadoEm: serverTimestamp(),
  });
}

// ── Comentários ──
// avisos/{id}/comentarios/{cid} — visíveis para todos os destinatários do aviso.
// Cada comentário guarda a regional (srCod) de quem escreveu, só para identificação.
// (srCod === null na chamada = todos; um código filtra por regional, se um dia for preciso.)
function _qComentarios(avisoId, srCod) {
  const col = collection(db(), 'avisos', avisoId, 'comentarios');
  return srCod === null ? col : query(col, where('srCod', 'in', [srCod || '-', '']));
}

export async function listarComentarios(avisoId, srCod) {
  const snap = await getDocs(_qComentarios(avisoId, srCod));
  const out = [];
  snap.forEach(d => out.push({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
  out.sort((a, b) => (a.criadoEm?.toMillis?.() || 0) - (b.criadoEm?.toMillis?.() || 0));
  return out;
}

export async function contarComentarios(avisoId, srCod) {
  try { return (await getCountFromServer(_qComentarios(avisoId, srCod))).data().count; }
  catch (_) { return null; }
}

export async function comentarAviso(avisoId, texto, eu, autorRotulo) {
  return addDoc(collection(db(), 'avisos', avisoId, 'comentarios'), {
    texto: texto.trim(),
    autorEmail: eu.email, autorNome: autorRotulo || eu.nome || eu.email,
    perfil: eu.tipo || '', unidadeEmail: eu.unidadeEmail || '',
    srCod: eu.tipo === 'crv' ? '' : (eu.srCod || ''),
    criadoEm: serverTimestamp(),
  });
}

/** Moderação: só a CRV remove comentários (a regra do Firestore garante) */
export async function excluirComentario(avisoId, comentarioId) {
  const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js");
  await deleteDoc(doc(db(), 'avisos', avisoId, 'comentarios', comentarioId));
}

/** Excluir de vez (só CRV): apaga comentários, confirmações e o próprio aviso */
export async function excluirAviso(avisoId) {
  const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js");
  const base = db();
  for (const sub of ['comentarios', 'leituras']) {
    const snap = await getDocs(collection(base, 'avisos', avisoId, sub));
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  }
  await deleteDoc(doc(base, 'avisos', avisoId));
}

/** Arquivar tira o aviso da janela de entrada, mas mantém no histórico */
export async function alterarArquivado(avisoId, arquivar, eu) {
  await updateDoc(doc(db(), 'avisos', avisoId), arquivar
    ? { ativo: false, arquivadoPor: eu.email, arquivadoEm: serverTimestamp() }
    : { ativo: true,  arquivadoPor: null,     arquivadoEm: null });
}
