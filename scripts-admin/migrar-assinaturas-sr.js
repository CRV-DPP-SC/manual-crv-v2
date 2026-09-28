/* ============================================================
   CRV — Assinaturas pendentes de Superintendente → novo login

   Solicitações criadas antes da mudança têm o Superintendente como
   assinante pelo e-mail da Superintendência (sr01@). Esta tarefa passa
   as assinaturas AINDA PENDENTES para o login pessoal (sr01sr@), para
   que ele consiga assinar. Assinaturas já feitas/negadas ficam como
   estão (registro histórico de quem assinou).

   Uso:  node migrar-assinaturas-sr.js [--executar]
   ============================================================ */
const { EXECUTAR, iniciar, cabecalho, rodape, rodar } = require('./comum');

const RE_ANTIGO = /^(sr0[1-8])@pp\.sc\.gov\.br$/i;

rodar(async () => {
  const { db, projeto } = iniciar();
  cabecalho(`Assinaturas pendentes de Superintendente — projeto ${projeto}`);

  const snap = await db.collection('solicitacoes').get();
  let docs = 0, trocas = 0;

  for (const d of snap.docs) {
    const s = d.data();
    if (s.statusGeral === 'cancelado') continue;
    let mudou = false;
    const assinantes = (s.assinantes || []).map(a => {
      const m = (a.email || '').match(RE_ANTIGO);
      if (!m || a.status !== 'pendente') return a;
      mudou = true; trocas++;
      const cod = m[1].toLowerCase();
      return { ...a, email: cod + 'sr@pp.sc.gov.br', emailUnidade: cod + '@pp.sc.gov.br' };
    });
    if (!mudou) continue;
    docs++;
    console.log(`• ${d.id}  ${(s.titulo || '').slice(0, 70)}`);
    if (EXECUTAR) await d.ref.update({ assinantes });
  }

  console.log(`\n${snap.size} solicitações verificadas · ${docs} com assinatura pendente de SR · ${trocas} assinatura(s) ${EXECUTAR ? 'transferidas' : 'a transferir'}.`);
  rodape();
});
