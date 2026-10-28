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
  'wanessaemerim@gmail.com'
];

// Envio de anexos para o Google Drive da CRV (Apps Script — mesmo usado pela
// Caixinha e pelo formulário de Benefícios; sem Firebase Storage, que é pago)
export const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxnmN9XVSxUwIB3p-6FLcOb64Qd59NHDiCErAKjeig3SmYE1NjpfNsFnDHm-SH6MN0K6g/exec';

// ── Superintendência Regional ──
// sr01@pp.sc.gov.br   → e-mail da Superintendência (órgão; também usado como "unidade" nas assinaturas e nos avisos push)
// sr01sr@pp.sc.gov.br → e-mail do(a) Superintendente
// Os DOIS logins valem igualmente como Superintendente da regional (mesmo acesso,
// mesmas assinaturas e mesma caixa de mensagens). Internamente, o endereço
// "oficial" de uma SR é o sr01sr@ (ver emailCanonico).
export const RE_SUPERINTENDENTE = /^(sr0[1-8])(?:sr)?@pp\.sc\.gov\.br$/;

// ── Logins alternativos de Diretor(a) ──
// E-mail extra que vale como o login de Diretor da unidade (mesmo acesso, mesmas
// assinaturas e mesma caixa de mensagens). Para incluir/remover, altere aqui
// E em firestore.rules (função aliasDiretor) — as duas listas devem ser iguais.
export const ALIAS_DIRETOR = {
  'cogri@pp.sc.gov.br': 'cogridir@pp.sc.gov.br',   // Colônia Agroindustrial de Palhoça
};

/** 'sr01@…'/'sr01sr@…' → 'sr01sr@pp.sc.gov.br'; 'cogri@…' → 'cogridir@…'; outros e-mails ficam como estão (minúsculos) */
export function emailCanonico(email) {
  const e = (email || '').toLowerCase();
  if (ALIAS_DIRETOR[e]) return ALIAS_DIRETOR[e];
  const m = e.match(RE_SUPERINTENDENTE);
  return m ? m[1] + 'sr@pp.sc.gov.br' : e;
}
// ── Índices das solicitações de assinatura ──
// Para não ler a coleção inteira a cada tela (estourava a cota gratuita do Firestore),
// cada solicitação guarda:
//   pendentesDe → e-mails (canônicos) de quem ainda precisa assinar  (sino / pendências)
//   unidades    → e-mails das unidades envolvidas (origem + assinantes) (Diretor/CPEN)
//   srs         → regionais envolvidas ('SR01'…)                         (Superintendente)
// O bot de notificações (notificacoes-bot) usa a mesma regra para corrigir/preencher.
export function pendentesDe(assinantes, statusGeral) {
  const lista = assinantes || [];
  if (statusGeral === 'cancelado' || lista.some(a => a.status === 'negado')) return [];
  return [...new Set(lista.filter(a => a.status === 'pendente' && a.email).map(a => emailCanonico(a.email)))];
}
/** unidadesLista: [{ email|em, sr }] (window.UNIDADES do site ou UNS do Gerador) */
export function indiceSolicitacao(s, unidadesLista) {
  const unidades = [...new Set([s.emailUnidadeOrigem, ...(s.assinantes || []).map(a => a.emailUnidade)]
    .filter(Boolean).map(e => e.toLowerCase()))];
  const srs = new Set();
  unidades.forEach(e => {
    const m = e.match(/^(sr0[1-8])@/);
    if (m) { srs.add(m[1].toUpperCase()); return; }
    const u = (unidadesLista || []).find(x => (x.email || x.em || '').toLowerCase() === e);
    if (u?.sr) srs.add(u.sr);
  });
  return { pendentesDe: pendentesDe(s.assinantes, s.statusGeral), unidades, srs: [...srs] };
}

/** Mesmo titular? (sr01@ e sr01sr@ contam como a mesma pessoa) */
export function mesmoUsuario(a, b) {
  return !!a && !!b && emailCanonico(a) === emailCanonico(b);
}

/** 'sr03sr@pp.sc.gov.br' ou 'sr03@pp.sc.gov.br' → 'SR03' (ou null se não for Superintendente) */
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
