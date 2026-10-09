/* ============================================================
   CRV — Bot de Notificações
   Roda periodicamente (GitHub Actions). Verifica no Firestore o
   que foi criado desde a última verificação e dispara push pelo
   OneSignal.

   Dois tipos de destino:
   • Por UNIDADE — tag "emailUnidade" (Diretor, CPEN e Superintendente):
       assinaturas pendentes e novos cadastros de servidor.
   • Por PESSOA — External ID = e-mail (aplicado pelo site em
       js/notificacoes.js com OneSignal.login; sr01@ e sr01sr@ viram sr01sr@):
       avisos do Mural, mensagens do chat e recados.
   A equipe CRV não recebe assinaturas/cadastros; recebe avisos e mensagens.

   Por privacidade, o push de mensagem/recado diz só QUEM escreveu
   (o texto aparece apenas dentro do portal).

   Variáveis de ambiente esperadas:
     FIREBASE_SERVICE_ACCOUNT — JSON completo da conta de serviço
     ONESIGNAL_API_KEY        — REST API Key do app OneSignal
   ============================================================ */

const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

const ONESIGNAL_APP_ID = 'd8932eb7-fa75-4f11-b0a2-68974e0afe42';
const URL_SITE          = 'https://crv-dpp-sc.github.io/manual-crv-v2/';
const URL_PAINEL        = URL_SITE + 'painel.html';
const ESTADO_DOC        = ['sistema_estado', 'notificacoes_bot'];

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
});
const db = admin.firestore();

// ── Equipe CRV: mesma lista do site (js/config-crv.js) ──
const EMAILS_CRV = (() => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'config-crv.js'), 'utf8');
  const bloco = (src.match(/EMAILS_CRV\s*=\s*\[([\s\S]*?)\]/) || [])[1] || '';
  return [...bloco.matchAll(/'([^']+)'/g)].map(m => m[1].toLowerCase());
})();

// sr01@ e sr01sr@ → sr01sr@ (mesma regra do site: emailCanonico em js/config-crv.js)
const RE_SR = /^(sr0[1-8])(?:sr)?@pp\.sc\.gov\.br$/;
const canonico = e => {
  const x = (e || '').toLowerCase();
  const m = x.match(RE_SR);
  return m ? m[1] + 'sr@pp.sc.gov.br' : x;
};

// ── Envio ──
async function _enviar(corpoReq, descricao) {
  const resp = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': 'Key ' + process.env.ONESIGNAL_API_KEY,
    },
    body: JSON.stringify({ app_id: ONESIGNAL_APP_ID, target_channel: 'push', ...corpoReq }),
  });
  const txt = await resp.text();
  if (!resp.ok) console.warn('[OneSignal] falha —', descricao, resp.status, txt);
  else          console.log('[OneSignal] enviado —', descricao, '—', corpoReq.headings.en);
}

async function enviarPushUnidade({ emailUnidade, titulo, corpo, tag, url }) {
  if (!emailUnidade) return;
  await _enviar({
    filters: [{ field: 'tag', key: 'emailUnidade', relation: '=', value: emailUnidade }],
    headings: { en: titulo },
    contents: { en: corpo },
    data: { tag, url: url || URL_PAINEL },
  }, 'unidade ' + emailUnidade);
}

async function enviarPushPessoas({ emails, titulo, corpo, tag, url }) {
  const lista = [...new Set((emails || []).map(canonico).filter(Boolean))];
  for (let i = 0; i < lista.length; i += 2000) {
    const lote = lista.slice(i, i + 2000);
    await _enviar({
      include_aliases: { external_id: lote },
      headings: { en: titulo },
      contents: { en: corpo },
      url: url || URL_SITE,
      data: { tag, url: url || URL_SITE },
    }, lote.length + ' pessoa(s)');
  }
}

// ── Diretório de pessoas (carregado sob demanda, uma vez por execução) ──
let _diretorio = null;
async function diretorio() {
  if (_diretorio) return _diretorio;
  const cfg = await db.collection('unidades_config').doc('principal').get();
  const unidades = cfg.exists ? (cfg.data().unidades || []) : [];
  const srs      = cfg.exists ? Object.keys(cfg.data().sr || {}) : [];
  const pessoas = [];
  EMAILS_CRV.forEach(email => pessoas.push({ email, tipo: 'crv', unidadeEmail: '', srCod: '', nome: 'CRV/DPP' }));
  srs.forEach(sr => pessoas.push({ email: sr.toLowerCase() + 'sr@pp.sc.gov.br', tipo: 'super', unidadeEmail: '', srCod: sr, nome: 'Superintendente ' + sr }));
  unidades.forEach(u => {
    const base = u.email.toLowerCase().split('@')[0];
    pessoas.push({ email: base + 'dir@pp.sc.gov.br',  tipo: 'dir',  unidadeEmail: u.email.toLowerCase(), srCod: u.sr, nome: 'Diretor(a) — ' + u.nome });
    pessoas.push({ email: base + 'cpen@pp.sc.gov.br', tipo: 'cpen', unidadeEmail: u.email.toLowerCase(), srCod: u.sr, nome: 'CPEN — ' + u.nome });
  });
  const cad = await db.collection('usuarios_cadastrados').where('status', '==', 'aprovado').get();
  cad.forEach(d => {
    const c = d.data();
    if (!c.email) return;
    const un = unidades.find(u => u.email === c.emailUnidade);
    pessoas.push({ email: c.email.toLowerCase(), tipo: 'servidor', unidadeEmail: (c.emailUnidade || '').toLowerCase(),
                   srCod: c.srUnidade || un?.sr || '', nome: (c.nome || c.email) + (un ? ' — ' + un.nome : '') });
  });
  const porEmail = new Map(pessoas.map(p => [canonico(p.email), p]));
  _diretorio = { pessoas, porEmail };
  return _diretorio;
}

async function nomeDe(email) {
  const { porEmail } = await diretorio();
  return porEmail.get(canonico(email))?.nome || email;
}

// ── Assinaturas e cadastros (por unidade) ──
async function processarCadastros(desde) {
  const snap = await db.collection('usuarios_cadastrados')
    .where('criadoEm', '>', desde)
    .get();

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.status !== 'pendente' || !data.emailUnidade) continue;
    await enviarPushUnidade({
      emailUnidade: data.emailUnidade,
      titulo: '🆕 Nova Solicitação de Cadastro',
      corpo:  (data.nome || data.email || 'Novo usuário') + ' solicitou acesso a ' + (data.nomeUnidade || data.emailUnidade) + '.',
      tag:    'cadastro-' + doc.id,
    });
  }
}

async function processarSolicitacoes(desde) {
  const snap = await db.collection('solicitacoes')
    .where('criadoEm', '>', desde)
    .get();

  for (const doc of snap.docs) {
    const data = doc.data();
    const pendentes = (data.assinantes || []).filter(a => a.status === 'pendente' && a.emailUnidade);
    const unidadesUnicas = [...new Set(pendentes.map(a => a.emailUnidade))];
    const titulo  = data.titulo || 'Solicitação de transferência';
    const criador = data.nomeCriador || data.emailCriador || 'Alguém';

    for (const emailUnidade of unidadesUnicas) {
      await enviarPushUnidade({
        emailUnidade,
        titulo: '✍️ Assinatura Pendente',
        corpo:  criador + ' solicitou sua anuência em: ' + titulo,
        tag:    'assinatura-' + doc.id,
      });
    }
  }
}

// ── Avisos do Mural (por pessoa, conforme os destinatários do aviso) ──
// Mesma regra de js/avisos.js (avisoParaMim)
function avisoPara(a, p) {
  const pub = a.publico || { tipo: 'todos' };
  if (Array.isArray(pub.perfis) && pub.perfis.length && !pub.perfis.includes(p.tipo)) return false;
  if (pub.tipo === 'regional') return !!p.srCod && p.srCod === pub.valor;
  if (pub.tipo === 'unidade')  return !!p.unidadeEmail && p.unidadeEmail === (pub.valor || '').toLowerCase();
  return true;
}

async function processarAvisos(desde) {
  const snap = await db.collection('avisos').where('criadoEm', '>', desde).get();
  if (snap.empty) return;
  const { pessoas } = await diretorio();
  const agora = Date.now();
  for (const doc of snap.docs) {
    const a = doc.data();
    if (a.ativo === false) continue;
    if (a.expiraEm && a.expiraEm.toMillis() <= agora) continue;
    const autor = canonico(a.criadoPor);
    const emails = pessoas.filter(p => avisoPara(a, p) && canonico(p.email) !== autor).map(p => p.email);
    if (!emails.length) continue;
    await enviarPushPessoas({
      emails,
      titulo: (a.importante ? '⚠️ ' : '📢 ') + 'Novo aviso da CRV',
      corpo:  (a.titulo || 'Aviso') + ' — toque para ler e confirmar.',
      tag:    'aviso-' + doc.id,
    });
  }
}

// ── Mensagens do chat (por pessoa: o outro participante da conversa) ──
async function processarMensagens(desde) {
  const convs = await db.collection('conversas').where('ultimaMensagemEm', '>', desde).get();
  for (const c of convs.docs) {
    const participantes = c.data().participantes || [];
    const msgs = await c.ref.collection('mensagens').where('enviadaEm', '>', desde).get();
    // remetente → quantidade de mensagens novas
    const porRemetente = new Map();
    msgs.forEach(m => {
      const d = m.data();
      if (d.tipo === 'encerramento' || !d.de) return;
      const de = canonico(d.de);
      porRemetente.set(de, (porRemetente.get(de) || 0) + 1);
    });
    for (const [de, n] of porRemetente) {
      const destinatarios = participantes.filter(p => canonico(p) !== de);
      if (!destinatarios.length) continue;
      await enviarPushPessoas({
        emails: destinatarios,
        titulo: '💬 ' + (n > 1 ? n + ' novas mensagens' : 'Nova mensagem'),
        corpo:  'De ' + await nomeDe(de) + '. Abra o portal para ler.',
        tag:    'conversa-' + c.id,
      });
    }
  }
}

// ── Recados (para a unidade inteira ou para a Superintendência) ──
async function processarRecados(desde) {
  const snap = await db.collection('recados').where('enviadoEm', '>', desde).get();
  if (snap.empty) return;
  const { pessoas } = await diretorio();
  for (const doc of snap.docs) {
    const r = doc.data();
    const de = canonico(r.de);
    let emails = [];
    if (r.destinoTipo === 'unidade') {
      const un = (r.destino || '').toLowerCase();
      emails = pessoas.filter(p => ['dir', 'cpen', 'servidor'].includes(p.tipo) && p.unidadeEmail === un).map(p => p.email);
    } else if (r.destinoTipo === 'regional') {
      emails = pessoas.filter(p => p.tipo === 'super' && p.srCod === r.destino).map(p => p.email);
    }
    emails = emails.filter(e => canonico(e) !== de);
    if (!emails.length) continue;
    await enviarPushPessoas({
      emails,
      titulo: '📨 Novo recado',
      corpo:  'De ' + await nomeDe(de) + '. Abra o portal para ler.',
      tag:    'recado-' + doc.id,
    });
  }
}

async function main() {
  const estadoRef = db.collection(ESTADO_DOC[0]).doc(ESTADO_DOC[1]);
  const estadoSnap = await estadoRef.get();
  const agora = admin.firestore.Timestamp.now();

  // Primeira execução: olha as últimas 24h (não o histórico todo), pra não
  // reenviar pendências muito antigas mas ainda pegar algo recente/de teste.
  const desde = estadoSnap.exists
    ? estadoSnap.data().ultimaVerificacao
    : admin.firestore.Timestamp.fromMillis(agora.toMillis() - 24 * 60 * 60 * 1000);

  // Cada etapa independente: a falha de uma não impede as outras
  const etapas = { processarCadastros, processarSolicitacoes, processarAvisos, processarMensagens, processarRecados };
  const resultados = await Promise.allSettled(Object.values(etapas).map(f => f(desde)));
  let falhou = false;
  resultados.forEach((r, i) => {
    if (r.status === 'rejected') { falhou = true; console.error('Erro em', Object.keys(etapas)[i] + ':', r.reason); }
  });
  await estadoRef.set({ ultimaVerificacao: agora });
  if (falhou) process.exitCode = 1;
}

main()
  .then(() => process.exit(process.exitCode || 0))
  .catch(e => { console.error(e); process.exit(1); });
