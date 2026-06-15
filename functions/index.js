// Cloud Function — notifica CPEN/DIR via FCM quando chega nova solicitação de cadastro
//
// Implantação:
//   1. Ative o plano Blaze no Firebase Console
//   2. cd functions && npm install
//   3. firebase deploy --only functions

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp }     = require('firebase-admin/app');
const { getFirestore }      = require('firebase-admin/firestore');
const { getMessaging }      = require('firebase-admin/messaging');

initializeApp();

exports.notificarNovoCadastro = onDocumentCreated(
  'usuarios_cadastrados/{userId}',
  async event => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    if (!data || data.status !== 'pendente') return;

    const emailUnidade = data.emailUnidade;
    const nomeUser     = data.nome  || data.email || 'Novo usuário';
    const nomeUnidade  = data.nomeUnidade || emailUnidade || 'sua unidade';

    if (!emailUnidade) return;

    // Busca todos os tokens FCM vinculados a essa unidade
    const db        = getFirestore();
    const tokenSnap = await db.collection('tokens_fcm')
      .where('emailUnidade', '==', emailUnidade)
      .get();

    if (tokenSnap.empty) return;

    const tokens = tokenSnap.docs
      .map(d => d.data().token)
      .filter(Boolean);

    if (!tokens.length) return;

    const message = {
      notification: {
        title: '🆕 Nova Solicitação de Cadastro',
        body:  nomeUser + ' solicitou acesso a ' + nomeUnidade + '.',
      },
      data: {
        tag: 'cadastro-' + event.params.userId,
        url: 'https://crv-dpp-sc.github.io/manual-crv-v2/painel.html',
      },
      tokens,
    };

    const resp = await getMessaging().sendEachForMulticast(message);

    // Remove tokens inválidos automaticamente
    const invalidos = [];
    resp.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code;
        if (code === 'messaging/registration-token-not-registered'
            || code === 'messaging/invalid-registration-token') {
          invalidos.push(tokens[i]);
        }
      }
    });

    if (invalidos.length > 0) {
      const batch = db.batch();
      const docs = await db.collection('tokens_fcm')
        .where('token', 'in', invalidos)
        .get();
      docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    console.log('[notificarNovoCadastro] enviado para', tokens.length, 'token(s)');
  }
);
