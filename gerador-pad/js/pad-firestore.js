/* ============================================================
   PAD-FIRESTORE.JS — Integração Firebase para o Gerador de PAD
   ============================================================ */

import { initializeApp, getApps }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, getDocs, deleteDoc,
         collection, query, where, orderBy, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged }
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

/* Login anônimo apenas se não houver sessão institucional já ativa */
onAuthStateChanged(getAuth(_app), function(user) {
  if (!user) signInAnonymously(getAuth(_app)).catch(() => {});
});

/* ── Utilitários ── */
function _oabKey(oab) {
  return (oab || '').replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
}

function _padKey(numPad) {
  return (numPad || Date.now().toString()).replace(/[^a-zA-Z0-9]/g, '_') + '_' + Date.now();
}

/* Gera token aleatório para o link do advogado */
function _gerarToken() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

/* ──────────────────────────────────────────
   API pública
────────────────────────────────────────── */
window.PadFirestore = {

  /* Salva o PAD e gera link único para o advogado.
     Retorna { padId, token, link } */
  salvarPad: async function(estado, htmlDocumento, advogadoOAB) {
    const s   = estado;
    const inc = s.incidentado || {};
    const inf = s.infracao    || {};
    const dec = s.decisao     || {};

    const padId = _padKey(s.numPad);

    await setDoc(doc(_db, 'pads_gerados', padId), {
      numPad:          s.numPad          || '',
      dataInst:        s.dataInst        || '',
      nomeIncidentado: inc.nome          || '',
      prontuario:      inc.prontuario    || '',
      artigo:          inf.artigo        || '',
      resultado:       dec.resultado     || '',
      unidade:         (s.unidade && s.unidade.nome)  || '',
      emailUnidade:    (s.unidade && s.unidade.email) || '',
      advogadoOAB:     _oabKey(advogadoOAB),
      htmlDocumento:   htmlDocumento || '',
      estado:          JSON.parse(JSON.stringify(s)),
      validado:        true,
      ts:              serverTimestamp(),
    });

    /* Gera token de acesso único para o advogado */
    const token = _gerarToken();
    await setDoc(doc(_db, 'pad_links', token), {
      padId,
      advogadoOAB: _oabKey(advogadoOAB),
      criado:      serverTimestamp(),
    });

    /* Vincula PAD ao cadastro do advogado */
    if (advogadoOAB) {
      await window.PadFirestore.vincularPadAoAdvogado(_oabKey(advogadoOAB), s.numPad || padId);
    }

    /* Monta URL do portal */
    const base = window.location.href.replace(/\/[^/]*$/, '');
    const link = base + '/portal-advogado.html?token=' + token;

    return { padId, token, link };
  },

  /* Cadastra advogado/defensor no Firestore */
  cadastrarAdvogado: async function(dados) {
    const tipo   = dados.tipo || 'advogado';
    const oabKey = tipo === 'defensoria'
      ? 'DEF_' + (dados.email || dados.nome || '').replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()
      : _oabKey(dados.oab);
    await setDoc(doc(_db, 'advogados', oabKey), {
      nome:           dados.nome     || '',
      tipo:           tipo,
      oab:            tipo === 'advogado' ? (dados.oab || '') : '',
      email:          (dados.email   || '').toLowerCase(),
      telefone:       dados.tel      || '',
      endereco:       dados.endereco || '',
      ativo:          true,
      padsVinculados: [],
      cadastradoEm:   serverTimestamp(),
      atualizadoEm:   serverTimestamp(),
    });
    return oabKey;
  },

  /* Atualiza campos de um advogado já cadastrado */
  atualizarAdvogado: async function(oabKey, dados) {
    await setDoc(doc(_db, 'advogados', oabKey), {
      nome:         dados.nome     || '',
      email:        (dados.email   || '').toLowerCase(),
      telefone:     dados.tel      || '',
      endereco:     dados.endereco || '',
      tipo:         dados.tipo     || 'advogado',
      atualizadoEm: serverTimestamp(),
    }, { merge: true });
  },

  /* Exclui um advogado pelo oabKey */
  excluirAdvogado: async function(oabKey) {
    await deleteDoc(doc(_db, 'advogados', oabKey));
  },

  /* ── PEÇAS DO DOSSIÊ ── */

  /* Salva uma peça do PAD no portal */
  salvarPeca: async function(padId, tipo, ordem, label, htmlContent) {
    const docId = String(padId) + '_' + tipo;
    await setDoc(doc(_db, 'pads_pecas', docId), {
      padId:       String(padId),
      tipo,
      ordem,
      label,
      htmlContent: htmlContent || '',
      savedAt:     serverTimestamp(),
    });
    return docId;
  },

  /* Busca todas as peças de um PAD, ordenadas */
  buscarPecasDoPad: async function(padId) {
    const q    = query(
      collection(_db, 'pads_pecas'),
      where('padId', '==', String(padId)),
      orderBy('ordem', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  /* ── RELAÇÃO DE PADs DA UNIDADE ── */

  /* Salva / atualiza entrada na relação */
  salvarRelacao: async function(emailUnidade, entrada) {
    if (!emailUnidade) return;
    const fsId = String(entrada.padId || Date.now());
    await setDoc(doc(_db, 'pads_relacao', fsId), {
      ...entrada,
      estado:       entrada.estado ? JSON.parse(JSON.stringify(entrada.estado)) : {},
      emailUnidade: emailUnidade,
      _fsId:        fsId,
      tsAtual:      serverTimestamp(),
    }, { merge: true });
    return fsId;
  },

  /* Carrega relação ordenada por criação (mais recente primeiro) */
  carregarRelacao: async function(emailUnidade) {
    if (!emailUnidade) return [];
    const q    = query(
      collection(_db, 'pads_relacao'),
      where('emailUnidade', '==', emailUnidade),
      orderBy('ts', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), _fsId: d.id }));
  },

  /* Exclusão permanente */
  excluirRelacao: async function(fsId) {
    await deleteDoc(doc(_db, 'pads_relacao', fsId));
  },

  /* Salva Manifestação da Defesa enviada pelo advogado no portal */
  salvarManifDefesaPortal: async function(padId, htmlContent, textoExtraido) {
    await setDoc(doc(_db, 'pads_pecas', String(padId) + '_manif_defesa'), {
      padId:         String(padId),
      tipo:          'manif_defesa',
      ordem:         7,
      label:         '7. Manifestação da Defesa',
      htmlContent:   htmlContent   || '',
      textoExtraido: textoExtraido || '',
      savedAt:       serverTimestamp(),
      origem:        'portal',
    }, { merge: true });
  },

  /* Busca texto extraído de uma peça específica */
  buscarTextoPeca: async function(padId, tipo) {
    const snap = await getDoc(doc(_db, 'pads_pecas', String(padId) + '_' + tipo));
    if (!snap.exists()) return '';
    return snap.data().textoExtraido || '';
  },

  /* Lista todos os advogados */
  listarAdvogados: async function() {
    const snap = await getDocs(collection(_db, 'advogados'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  /* Busca PADs vinculados a um advogado (pela OAB key) */
  buscarPadsDoAdvogado: async function(oabKey) {
    const q    = query(
      collection(_db, 'pads_gerados'),
      where('advogadoOAB', '==', oabKey.toUpperCase())
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  /* Vincula número do PAD ao advogado */
  vincularPadAoAdvogado: async function(oabKey, numPad) {
    const ref  = doc(_db, 'advogados', oabKey);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const lista = snap.data().padsVinculados || [];
    if (!lista.includes(numPad)) lista.push(numPad);
    await setDoc(ref, { padsVinculados: lista }, { merge: true });
  },

  /* Busca PAD pelo token do link */
  buscarPadPorToken: async function(token) {
    const linkSnap = await getDoc(doc(_db, 'pad_links', token));
    if (!linkSnap.exists()) return null;
    const { padId } = linkSnap.data();
    const padSnap = await getDoc(doc(_db, 'pads_gerados', padId));
    if (!padSnap.exists()) return null;
    return { id: padSnap.id, ...padSnap.data() };
  },
};

console.log('[PadFirestore] módulo carregado.');
