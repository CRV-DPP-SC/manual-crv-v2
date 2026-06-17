/* ============================================================
   PAD-FIRESTORE.JS — Integração Firebase para o Gerador de PAD
   Expõe window.PadFirestore com funções de persistência e
   cadastro de advogados.
   ============================================================ */

import { initializeApp, getApps }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, getDocs,
         collection, query, where, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword,
         sendPasswordResetEmail }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

const _CFG = {
  apiKey:            "AIzaSyB61jtxRJlDu0LhwXOM9c42MEHQWciJh-I",
  authDomain:        "crv-dpp-sc-v2.firebaseapp.com",
  projectId:         "crv-dpp-sc-v2",
  storageBucket:     "crv-dpp-sc-v2.firebasestorage.app",
  messagingSenderId: "513539683551",
  appId:             "1:513539683551:web:2fdcdd236f0c37853ae56a",
};

const _app  = getApps().length ? getApps()[0] : initializeApp(_CFG);
const _db   = getFirestore(_app);
const _auth = getAuth(_app);

/* ──────────────────────────────────────────
   Utilitários internos
────────────────────────────────────────── */
function _oabKey(oab) {
  return (oab || '').replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
}

function _padKey(numPad) {
  return (numPad || Date.now().toString()).replace(/[^a-zA-Z0-9]/g, '_') + '_' + Date.now();
}

/* ──────────────────────────────────────────
   API pública
────────────────────────────────────────── */
window.PadFirestore = {

  /* Salva o PAD gerado no Firestore e retorna o ID do documento */
  salvarPad: async function(estado, htmlDocumento, advogadoOAB) {
    const s   = estado;
    const inc = s.incidentado  || {};
    const inf = s.infracao     || {};
    const dec = s.decisao      || {};

    const id = _padKey(s.numPad);
    await setDoc(doc(_db, 'pads_gerados', id), {
      numPad:           s.numPad           || '',
      dataInst:         s.dataInst         || '',
      nomeIncidentado:  inc.nome           || '',
      prontuario:       inc.prontuario     || '',
      ipen:             inc.ipen           || '',
      artigo:           inf.artigo         || '',
      resultado:        dec.resultado      || '',
      unidade:          (s.unidade && s.unidade.nome)  || '',
      emailUnidade:     (s.unidade && s.unidade.email) || '',
      advogadoOAB:      _oabKey(advogadoOAB),
      htmlDocumento:    htmlDocumento || '',
      estado:           JSON.parse(JSON.stringify(s)),
      validado:         true,
      ts:               serverTimestamp(),
    });

    /* Vincula o PAD ao advogado */
    if (advogadoOAB) {
      await window.PadFirestore.vincularPadAoAdvogado(_oabKey(advogadoOAB), s.numPad || id);
    }

    return id;
  },

  /* Cadastra advogado no Firestore e cria conta Firebase Auth */
  cadastrarAdvogado: async function(dados) {
    // dados: { nome, oab, email, cpf }
    const oabKey = _oabKey(dados.oab);

    await setDoc(doc(_db, 'advogados', oabKey), {
      nome:           dados.nome  || '',
      oab:            dados.oab   || '',
      email:          (dados.email || '').toLowerCase(),
      cpf:            dados.cpf   || '',
      ativo:          true,
      padsVinculados: [],
      cadastradoEm:   serverTimestamp(),
    });

    /* Cria conta Firebase Auth */
    try {
      await createUserWithEmailAndPassword(_auth, dados.email.toLowerCase(), 'PAD@portal2025');
    } catch(e) {
      if (e.code !== 'auth/email-already-in-use') throw e;
    }

    /* Envia e-mail de redefinição para o advogado definir sua senha */
    try {
      await sendPasswordResetEmail(_auth, dados.email.toLowerCase());
    } catch(_) {}

    return oabKey;
  },

  /* Lista todos os advogados cadastrados */
  listarAdvogados: async function() {
    const snap = await getDocs(collection(_db, 'advogados'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  /* Vincula número do PAD ao array padsVinculados do advogado */
  vincularPadAoAdvogado: async function(oabKey, numPad) {
    const ref  = doc(_db, 'advogados', oabKey);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const lista = snap.data().padsVinculados || [];
    if (!lista.includes(numPad)) lista.push(numPad);
    await setDoc(ref, { padsVinculados: lista }, { merge: true });
  },

  /* Busca advogado pelo e-mail (usado no portal) */
  buscarAdvogadoPorEmail: async function(email) {
    const q    = query(collection(_db, 'advogados'), where('email', '==', email.toLowerCase()));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() };
  },

  /* Busca PADs vinculados a um OAB key */
  buscarPadsDoAdvogado: async function(oabKey) {
    const q    = query(collection(_db, 'pads_gerados'), where('advogadoOAB', '==', oabKey));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
};

console.log('[PadFirestore] módulo carregado.');
