/* ============================================================
   CRV — Bot de Notificações
   Roda periodicamente (GitHub Actions). Verifica no Firestore o
   que foi criado desde a última verificação e dispara push pelo
   OneSignal, segmentado pela tag "emailUnidade" (aplicada pelo
   site em js/notificacoes.js a cada dispositivo inscrito).

   Variáveis de ambiente esperadas:
     FIREBASE_SERVICE_ACCOUNT — JSON completo da conta de serviço
     ONESIGNAL_API_KEY        — REST API Key do app OneSignal
   ============================================================ */

const admin = require('firebase-admin');

const ONESIGNAL_APP_ID = 'd8932eb7-fa75-4f11-b0a2-68974e0afe42';
const URL_PAINEL        = 'https://crv-dpp-sc.github.io/manual-crv-v2/painel.html';
const ESTADO_DOC        = ['sistema_estado', 'notificacoes_bot'];

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
});
const db = admin.firestore();

async function enviarPushUnidade({ emailUnidade, titulo, corpo, tag, url }) {
  if (!emailUnidade) return;
  const resp = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': 'Key ' + process.env.ONESIGNAL_API_KEY,
    },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      target_channel: 'push',
      filters: [{ field: 'tag', key: 'emailUnidade', relation: '=', value: emailUnidade }],
      headings: { en: titulo },
      contents: { en: corpo },
      data: { tag, url: url || URL_PAINEL },
    }),
  });
  if (!resp.ok) {
    console.warn('[OneSignal] falha ao enviar para', emailUnidade, resp.status, await resp.text());
  } else {
    console.log('[OneSignal] enviado para', emailUnidade, '—', titulo);
  }
}

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

async function main() {
  const estadoRef = db.collection(ESTADO_DOC[0]).doc(ESTADO_DOC[1]);
  const estadoSnap = await estadoRef.get();
  const agora = admin.firestore.Timestamp.now();

  if (!estadoSnap.exists) {
    // Primeira execução: só marca o ponto de partida, não reenvia pendências antigas.
    await estadoRef.set({ ultimaVerificacao: agora });
    console.log('Primeira execução — marcando ponto de partida, nada a notificar ainda.');
    return;
  }

  const desde = estadoSnap.data().ultimaVerificacao;
  await Promise.all([
    processarCadastros(desde),
    processarSolicitacoes(desde),
  ]);
  await estadoRef.set({ ultimaVerificacao: agora });
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
