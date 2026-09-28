// ================================================
// CRV — Configuração compartilhada
// js/config-crv.js
// Fonte única da config do Firebase e da lista de e-mails CRV.
// Para incluir/remover alguém da equipe, altere SOMENTE aqui
// (e na regra do Firestore, que usa a mesma lista).
// ================================================
export const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyB61jtxRJlDu0LhwXOM9c42MEHQWciJh-I",
  authDomain:        "crv-dpp-sc-v2.firebaseapp.com",
  projectId:         "crv-dpp-sc-v2",
  storageBucket:     "crv-dpp-sc-v2.firebasestorage.app",
  messagingSenderId: "513539683551",
  appId:             "1:513539683551:web:2fdcdd236f0c37853ae56a"
};

export const EMAILS_CRV = [
  'rodrigo.l.pastore@gmail.com',
  'ivana.schafer@gmail.com',
  'brunawlongen@gmail.com',
  'ricardobritomarques12@gmail.com',
  'abeljuliana2012@gmail.com',
  'jessicaveiga9@gmail.com',
  'day.sestren88@gmail.com',
  'sepen@pp.sc.gov.br',
  'leilakfarias@gmail.com',
  'crv@pp.sc.gov.br'
];

// ── Superintendência Regional ──
// sr01@pp.sc.gov.br   → e-mail da Superintendência (órgão; usado como "unidade" nas assinaturas e nos avisos push)
// sr01sr@pp.sc.gov.br → login pessoal do(a) Superintendente
export const RE_SUPERINTENDENTE = /^(sr0[1-8])sr@pp\.sc\.gov\.br$/;

/** 'sr03sr@pp.sc.gov.br' → 'SR03' (ou null se não for Superintendente) */
export function srDoSuperintendente(email) {
  const m = (email || '').toLowerCase().match(RE_SUPERINTENDENTE);
  return m ? m[1].toUpperCase() : null;
}
/** 'SR03' → 'sr03sr@pp.sc.gov.br' (login do Superintendente) */
export function emailSuperintendente(srCod) { return srCod.toLowerCase() + 'sr@pp.sc.gov.br'; }
/** 'SR03' → 'sr03@pp.sc.gov.br' (e-mail da Superintendência) */
export function emailSuperintendencia(srCod) { return srCod.toLowerCase() + '@pp.sc.gov.br'; }

export function ehCRV(email) {
  return EMAILS_CRV.includes((email || '').toLowerCase());
}

// Escapa texto antes de inserir em innerHTML
export function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
