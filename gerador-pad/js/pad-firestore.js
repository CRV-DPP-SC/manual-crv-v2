/* ============================================================
   PAD-FIRESTORE.JS â€” IntegraÃ§Ã£o Firebase para o Gerador de PAD
   ============================================================ */

import { initializeApp, getApps }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, getDocs, deleteDoc,
         collection, query, where, orderBy, limit, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
const _CFG = {
  apiKey:            "AIzaSyB61jtxRJlDu0LhwXOM9c42MEHQWciJh-I",
  authDomain:        "crv-dpp-sc-v2.firebaseapp.com",
  projectId:         "crv-dpp-sc-v2",
  storageBucket:     "crv-dpp-sc-v2.firebasestorage.app",
  messagingSenderId: "513539683551",
  appId:             "1:513539683551:web:2fdcdd236f0c37853ae56a",
};

const _app = getApps().length ? getApps()[0] : initializeApp(_CFG);
const _db  = getFirestore(_app);

/* â”€â”€ UtilitÃ¡rios â”€â”€ */
function _oabKey(oab) {
  return (oab || '').replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
}

function _padKey(numPad) {
  return (numPad || Date.now().toString()).replace(/[^a-zA-Z0-9]/g, '_') + '_' + Date.now();
}

/* Gera token aleatÃ³rio para o link do advogado */
function _gerarToken() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   API pÃºblica
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
window.PadFirestore = {

  /* Salva o PAD e gera link Ãºnico para o advogado.
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

    /* Gera token de acesso Ãºnico para o advogado */
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

  /* Atualiza campos de um advogado jÃ¡ cadastrado */
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

  /* â”€â”€ PEÃ‡AS DO DOSSIÃŠ â”€â”€ */

  /* Salva uma peÃ§a do PAD no portal */
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

  /* Busca todas as peÃ§as de um PAD, ordenadas */
  buscarPecasDoPad: async function(padId) {
    const q    = query(
      collection(_db, 'pads_pecas'),
      where('padId', '==', String(padId)),
      orderBy('ordem', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  /* â”€â”€ RELAÃ‡ÃƒO DE PADs DA UNIDADE â”€â”€ */

  /* Salva / atualiza entrada na relaÃ§Ã£o */
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

  /* Carrega relaÃ§Ã£o ordenada por criaÃ§Ã£o (mais recente primeiro) */
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

  /* Atualiza status de um PAD na relaÃ§Ã£o */
  atualizarStatusRelacao: async function(fsId, status) {
    await setDoc(doc(_db, 'pads_relacao', fsId), { status, tsAtual: serverTimestamp() }, { merge: true });
  },

  /* ExclusÃ£o permanente */
  excluirRelacao: async function(fsId) {
    await deleteDoc(doc(_db, 'pads_relacao', fsId));
  },

  /* Salva ManifestaÃ§Ã£o da Defesa enviada pelo advogado no portal */
  salvarManifDefesaPortal: async function(padId, htmlContent, textoExtraido) {
    await setDoc(doc(_db, 'pads_pecas', String(padId) + '_manif_defesa'), {
      padId:         String(padId),
      tipo:          'manif_defesa',
      ordem:         7,
      label:         '7. ManifestaÃ§Ã£o da Defesa',
      htmlContent:   htmlContent   || '',
      textoExtraido: textoExtraido || '',
      savedAt:       serverTimestamp(),
      origem:        'portal',
    }, { merge: true });
  },

  /* Busca texto extraÃ­do de uma peÃ§a especÃ­fica */
  buscarTextoPeca: async function(padId, tipo) {
    const snap = await getDoc(doc(_db, 'pads_pecas', String(padId) + '_' + tipo));
    if (!snap.exists()) return '';
    return snap.data().textoExtraido || '';
  },

  /* Busca advogados por prefixo de nome ou OAB (mÃ¡x. 40 resultados) */
  buscarAdvogados: async function(termo) {
    const t = (termo || '').trim();
    if (!t) return [];
    const tUp  = t.toUpperCase();
    const makeQ = (campo, val) => query(
      collection(_db, 'advogados'),
      where(campo, '>=', val), where(campo, '<=', val + ''),
      limit(40)
    );
    const [snapNome, snapOab] = await Promise.all([
      getDocs(makeQ('nome', tUp)),
      getDocs(makeQ('oab',  tUp)),
    ]);
    const mapa = {};
    [...snapNome.docs, ...snapOab.docs].forEach(d => { mapa[d.id] = { id: d.id, ...d.data() }; });
    return Object.values(mapa).slice(0, 40);
  },

  /* Lista todos os advogados (legado â€” uso interno) */
  listarAdvogados: async function() {
    const snap = await getDocs(query(collection(_db, 'advogados'), limit(500)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  /* Gera novo token de acesso para um PAD jÃ¡ salvo (sem re-salvar o PAD) */
  gerarLinkParaPad: async function(padId, oabKey) {
    const token = _gerarToken();
    await setDoc(doc(_db, 'pad_links', token), {
      padId:       String(padId),
      advogadoOAB: _oabKey(oabKey),
      criado:      serverTimestamp(),
    });
    const base = window.location.href.replace(/\/[^/]*$/, '');
    const link = base + '/portal-advogado.html?token=' + token;
    return { token, link };
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

  /* Vincula nÃºmero do PAD ao advogado */
  vincularPadAoAdvogado: async function(oabKey, numPad) {
    const ref  = doc(_db, 'advogados', oabKey);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const lista = snap.data().padsVinculados || [];
    if (!lista.includes(numPad)) lista.push(numPad);
    await setDoc(ref, { padsVinculados: lista }, { merge: true });
  },

  /* ── AUTENTICAÇÃO DO ADVOGADO ── */

  /* Cria ou redefine a senha do advogado (hash SHA-256 calculado no browser) */
  criarSenhaAdvogado: async function(oabKey, senhaHash) {
    await setDoc(doc(_db, 'advogado_auth', oabKey), {
      senhaHash,
      criadoEm: serverTimestamp(),
    });
  },

  /* Retorna o hash armazenado ou null se não há senha cadastrada */
  buscarSenhaAdvogado: async function(oabKey) {
    const snap = await getDoc(doc(_db, 'advogado_auth', oabKey));
    return snap.exists() ? snap.data().senhaHash : null;
  },

  /* Remove a senha — próximo acesso exigirá criar nova */
  resetarSenhaAdvogado: async function(oabKey) {
    await deleteDoc(doc(_db, 'advogado_auth', oabKey));
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

console.log('[PadFirestore] mÃ³dulo carregado.');

