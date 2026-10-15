// ================================================
// CRV — Equipe com acesso total (área restrita)
// js/equipe-crv.js
// A equipe é gerenciada pela página "Equipe CRV" (equipe-crv.html) e fica no
// Firestore, coleção equipe_crv (id do documento = e-mail em minúsculas).
//
// Regra (igual à de isCRV() em firestore.rules):
//   • EMAILS_FIXOS sempre têm acesso (segurança contra "trancar todo mundo fora");
//   • quem está na lista antiga (EMAILS_CRV de config-crv.js) continua com acesso
//     até ter um documento na coleção — a partir daí vale o campo "ativo";
//   • quem foi incluído pela página entra com ativo = true.
// Uso nas páginas:  await garantirEquipe(EMAILS_CRV)  (depois do login)
// — atualiza a lista recebida no lugar; ehCRV()/EMAILS_CRV.includes() passam a valer.
// ================================================
import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { FIREBASE_CONFIG } from "./config-crv.js";

export const EMAILS_FIXOS = ['rodrigo.l.pastore@gmail.com', 'jessicaveiga9@gmail.com'];

let _docs = null;      // Map e-mail → dados (último carregamento com sucesso)
let _carregando = null;

/** Lê a coleção equipe_crv (precisa de usuário logado). Em caso de erro devolve null. */
export async function carregarEquipe(forcar) {
  if (_docs && !forcar) return _docs;
  if (_carregando) return _carregando;
  _carregando = (async () => {
    try {
      const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
      const snap = await getDocs(collection(getFirestore(app), 'equipe_crv'));
      _docs = new Map(snap.docs.map(d => [d.id, d.data()]));
      return _docs;
    } catch (e) {
      console.warn('[equipe-crv] não foi possível ler a equipe — usando a lista antiga.', e);
      return null;
    } finally { _carregando = null; }
  })();
  return _carregando;
}

/** Aplica a regra de acesso sobre uma lista legada; devolve a lista final. */
export function montarEquipe(legado, docs) {
  const final = new Set(EMAILS_FIXOS);
  legado.forEach(e => { const d = docs && docs.get(e); if (!d || d.ativo) final.add(e); });
  if (docs) docs.forEach((d, e) => { if (d.ativo) final.add(e); });
  return [...final];
}

/** Atualiza (no lugar) a lista EMAILS_CRV recebida com a equipe do banco. */
export async function garantirEquipe(lista, forcar) {
  if (!lista._legado) lista._legado = [...lista];
  const docs = await carregarEquipe(forcar);
  const final = montarEquipe(lista._legado, docs);
  lista.length = 0;
  lista.push(...final);
  return lista;
}
