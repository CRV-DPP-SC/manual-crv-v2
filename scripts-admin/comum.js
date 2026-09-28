/* ============================================================
   CRV — utilidades comuns dos scripts de administração
   Rodam no GitHub Actions (workflow "Admin CRV"). As credenciais
   vêm dos secrets do repositório, nunca de arquivos no código:
     FIREBASE_SERVICE_ACCOUNT         — projeto crv-dpp-sc-v2 (o mesmo do bot)
     FIREBASE_SERVICE_ACCOUNT_ANTIGO  — projeto crv-dpp-sc (só para a migração)
   ============================================================ */
const admin = require('firebase-admin');

const EXECUTAR = process.argv.includes('--executar');

function conta(varAmbiente) {
  const bruto = process.env[varAmbiente];
  if (!bruto) throw new Error(`Secret ${varAmbiente} não configurado no repositório.`);
  return JSON.parse(bruto);
}

function iniciar(varAmbiente = 'FIREBASE_SERVICE_ACCOUNT', nome) {
  const c = conta(varAmbiente);
  const app = admin.initializeApp({ credential: admin.credential.cert(c) }, nome || c.project_id);
  return { app, projeto: c.project_id, db: app.firestore(), auth: app.auth() };
}

function cabecalho(titulo) {
  console.log('════════════════════════════════════════════════════════');
  console.log(' ' + titulo);
  console.log(' Modo: ' + (EXECUTAR ? 'EXECUTAR (grava alterações)' : 'SIMULAÇÃO (nada é gravado)'));
  console.log('════════════════════════════════════════════════════════\n');
}

function rodape() {
  if (!EXECUTAR) console.log('\nNada foi gravado. Para aplicar, rode de novo marcando "executar".');
}

function rodar(main) {
  main().then(() => process.exit(0)).catch(e => { console.error('\nERRO:', e.message || e); process.exit(1); });
}

module.exports = { admin, EXECUTAR, iniciar, cabecalho, rodape, rodar };
