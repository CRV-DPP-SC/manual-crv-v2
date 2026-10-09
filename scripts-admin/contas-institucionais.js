/* ============================================================
   CRV — Contas institucionais (Diretor, CPEN, Superintendente)

   1. Lista todas as contas ...dir@, ...cpen@, sr0Xsr@ e sr0X@pp.sc.gov.br
      (Superintendente: os dois e-mails da regional valem igualmente).
   2. Marca como "e-mail confirmado" as que correspondem a uma unidade
      real (ou a uma SR). As regras do Firestore só reconhecem esses
      perfis com e-mail confirmado — isso impede contas falsas criadas
      por terceiros de ganharem o perfil.
   3. Aponta contas suspeitas (padrão institucional, mas sem unidade
      correspondente) e contas esperadas que ainda não existem.
   4. Com --criar-sr, cria os logins sr01sr@ … sr08sr@ e sr01@ … sr08@ que faltarem,
      já confirmados e com senha aleatória que ninguém conhece. Cada
      Superintendente define a própria senha em "Esqueci minha senha"
      na tela de login do site (o link chega na própria caixa de e-mail).

   Uso:  node contas-institucionais.js [--criar-sr] [--executar]
   ============================================================ */
const crypto = require('crypto');
const { EXECUTAR, iniciar, cabecalho, rodape, rodar } = require('./comum');

const CRIAR_SR = process.argv.includes('--criar-sr');
const SRS = ['SR01','SR02','SR03','SR04','SR05','SR06','SR07','SR08'];
const DOMINIO = '@pp.sc.gov.br';

async function listarTodas(auth) {
  const todas = [];
  let token;
  do {
    const pagina = await auth.listUsers(1000, token);
    todas.push(...pagina.users);
    token = pagina.pageToken;
  } while (token);
  return todas;
}

function fmt(data) { return data ? new Date(data).toLocaleString('pt-BR') : '—'; }

rodar(async () => {
  const { db, auth, projeto } = iniciar();
  cabecalho(`Contas institucionais — projeto ${projeto}${CRIAR_SR ? ' — criando logins de Superintendente' : ''}`);

  const cfg = await db.collection('unidades_config').doc('principal').get();
  if (!cfg.exists) throw new Error('unidades_config/principal não encontrado.');
  const unidades = cfg.data().unidades || [];
  const prefixos = new Map(unidades.map(u => [u.email.toLowerCase().split('@')[0], u.nome]));

  // Contas esperadas → descrição
  const esperadas = new Map();
  prefixos.forEach((nome, p) => {
    esperadas.set(p + 'dir' + DOMINIO,  'Diretor(a) — ' + nome);
    esperadas.set(p + 'cpen' + DOMINIO, 'CPEN — ' + nome);
  });
  SRS.forEach(sr => {
    esperadas.set(sr.toLowerCase() + 'sr' + DOMINIO, 'Superintendente — ' + sr + ' (e-mail do titular)');
    esperadas.set(sr.toLowerCase() + DOMINIO,        'Superintendente — ' + sr + ' (e-mail da Superintendência)');
  });

  const contas = await listarTodas(auth);
  const porEmail = new Map(contas.filter(u => u.email).map(u => [u.email.toLowerCase(), u]));
  const rePadrao = /^(.+?)(dir|cpen)@pp\.sc\.gov\.br$|^sr0[1-8](sr)?@pp\.sc\.gov\.br$/;

  const confirmar = [], jaConfirmadas = [], suspeitas = [];
  for (const u of contas) {
    const e = (u.email || '').toLowerCase();
    if (!rePadrao.test(e)) continue;
    if (!esperadas.has(e)) { suspeitas.push(u); continue; }
    (u.emailVerified ? jaConfirmadas : confirmar).push(u);
  }
  const faltando = [...esperadas.keys()].filter(e => !porEmail.has(e));

  console.log(`Contas institucionais legítimas encontradas: ${confirmar.length + jaConfirmadas.length} de ${esperadas.size} esperadas`);
  console.log(`  já confirmadas: ${jaConfirmadas.length}`);
  console.log(`  a confirmar:    ${confirmar.length}`);
  confirmar.forEach(u => console.log(`    • ${u.email.padEnd(32)} ${esperadas.get(u.email.toLowerCase())}  (criada ${fmt(u.metadata.creationTime)})`));

  if (suspeitas.length) {
    console.log(`\n⚠ CONTAS SUSPEITAS (padrão institucional sem unidade correspondente) — NÃO serão confirmadas.`);
    console.log(`  Confira no Console (Authentication) e exclua se não forem legítimas:`);
    suspeitas.forEach(u => console.log(`    • ${u.email.padEnd(32)} criada ${fmt(u.metadata.creationTime)} · último login ${fmt(u.metadata.lastSignInTime)}`));
  }

  const RE_SR = /^sr0[1-8](sr)?@/;
  const faltandoSR = faltando.filter(e => RE_SR.test(e));
  const faltandoUn = faltando.filter(e => !RE_SR.test(e));
  if (faltandoUn.length) {
    console.log(`\nContas de unidade que AINDA NÃO EXISTEM (${faltandoUn.length}) — crie no Console quando a unidade for usar o Painel:`);
    faltandoUn.forEach(e => console.log(`    • ${e.padEnd(32)} ${esperadas.get(e)}`));
  }
  if (faltandoSR.length) {
    console.log(`\nLogins de Superintendente que ainda não existem (${faltandoSR.length}):`);
    faltandoSR.forEach(e => console.log(`    • ${e}`));
    if (!CRIAR_SR) console.log('  → rode a tarefa "criar-logins-superintendentes" para criá-los.');
  }

  if (!EXECUTAR) { rodape(); return; }

  for (const u of confirmar) await auth.updateUser(u.uid, { emailVerified: true });
  console.log(`\n✓ ${confirmar.length} conta(s) marcada(s) como confirmadas.`);

  if (CRIAR_SR) {
    for (const email of faltandoSR) {
      await auth.createUser({
        email,
        emailVerified: true,
        password: crypto.randomBytes(24).toString('base64url'), // descartada: o titular define a sua
        displayName: 'Superintendente ' + email.slice(0, 4).toUpperCase(),
      });
      console.log(`✓ criado ${email}`);
    }
    if (faltandoSR.length) console.log('\nCada Superintendente deve abrir o site → Entrar → digitar o e-mail → "Esqueci minha senha / definir senha".');
  }
});
