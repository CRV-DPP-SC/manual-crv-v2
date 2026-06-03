/* ============================================================
   FIREBASE V2 — Autenticação para o Gerador de Ofícios V2
   Módulo independente: detecta sessão ativa e expõe:
     window._v2Usuario  — Firebase user (ou null)
     window._v2Unidade  — objeto de unidade (ou null)
     window._v2CriarSolicitacaoAssinatura() — salva no Firestore
   Chama window._onV2AuthReady(user, unidade) quando pronto.
   ============================================================ */

import { initializeApp, getApps, getApp }
                             from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged }
                             from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, doc, getDoc, addDoc, collection, serverTimestamp }
                             from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyB61jtxRJlDu0LhwXOM9c42MEHQWciJh-I",
  authDomain:        "crv-dpp-sc-v2.firebaseapp.com",
  projectId:         "crv-dpp-sc-v2",
  storageBucket:     "crv-dpp-sc-v2.firebasestorage.app",
  messagingSenderId: "513539683551",
  appId:             "1:513539683551:web:2fdcdd236f0c37853ae56a"
};

/*
 * Usa o app DEFAULT (sem nome) para compartilhar a sessão com o site
 * principal. App nomeado usaria chave de storage separada e nunca
 * encontraria a sessão do usuário já autenticado.
 */
const app  = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

/* Resolve unidade a partir do e-mail institucional ou Firestore */
async function _resolverUnidade(user) {
  const e = (user.email || '').toLowerCase();

  /* Diretor: pe01dir@pp.sc.gov.br → pe01@pp.sc.gov.br */
  const dirMatch = e.match(/^(.+)dir@pp\.sc\.gov\.br$/);
  if (dirMatch) {
    const base = dirMatch[1] + '@pp.sc.gov.br';
    const uns = typeof getUns === 'function' ? getUns() : (window._unsCache || []);
    return uns.find(u => u.em.toLowerCase() === base) || null;
  }

  /* Coord. Penal: pe01cpen@pp.sc.gov.br */
  const cpenMatch = e.match(/^(.+)cpen@pp\.sc\.gov\.br$/);
  if (cpenMatch) {
    const base = cpenMatch[1] + '@pp.sc.gov.br';
    const uns = typeof getUns === 'function' ? getUns() : (window._unsCache || []);
    return uns.find(u => u.em.toLowerCase() === base) || null;
  }

  /* Servidor particular — busca Firestore */
  if (!e.endsWith('@pp.sc.gov.br')) {
    try {
      const snap = await getDoc(doc(db, 'usuarios_cadastrados', user.uid));
      if (snap.exists()) {
        const d = snap.data();
        if (d.status === 'aprovado') {
          const uns = typeof getUns === 'function' ? getUns() : (window._unsCache || []);
          return uns.find(u => u.em === d.emailUnidade) || null;
        }
      }
    } catch (_) {}
  }

  return null;
}

/* Estado inicial explícito — antes do onAuthStateChanged disparar */
window._v2AuthPending = true;
window._v2Usuario     = null;
window._v2CriarSolicitacaoAssinatura = null;

/* Promise que resolve quando o auth state é conhecido pela primeira vez */
let _resolveV2Auth;
window._v2AuthReady = new Promise(function(resolve) { _resolveV2Auth = resolve; });

onAuthStateChanged(auth, async (user) => {
  window._v2AuthPending = false;
  window._v2Usuario = user || null;

  if (user) {
    window._v2CriarSolicitacaoAssinatura = async function ({ titulo, conteudo, unidadeOrigem, assinantes, presos, resumo }) {
      const uns  = typeof getUns === 'function' ? getUns()
                 : (typeof UNS !== 'undefined'  ? UNS : []);
      const uObj = uns.find(u => u.em === unidadeOrigem) || {};
      const ref  = await addDoc(collection(db, 'solicitacoes'), {
        titulo,
        conteudo,
        resumo:             resumo || '',
        presos:             (presos || []).map(p => ({ nome: p.nome || '', ipen: p.ipen || '' })),
        emailUnidadeOrigem: unidadeOrigem,
        nomeUnidadeOrigem:  uObj.n || '',
        emailCriador:       user.email,
        nomeCriador:        user.displayName || user.email,
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
      return ref.id;
    };
  } else {
    window._v2CriarSolicitacaoAssinatura = null;
  }

  /* Resolve a Promise de auth — libera quem aguardava no modal */
  if (typeof _resolveV2Auth === 'function') _resolveV2Auth(user);

  /* Resolve unidade (pode ser async para servidor via Firestore) */
  const unidade = user ? await _resolverUnidade(user) : null;
  window._v2Unidade = unidade;

  if (typeof window._onV2AuthReady === 'function') {
    window._onV2AuthReady(user, unidade);
  }
});
