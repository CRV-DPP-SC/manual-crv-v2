/* ============================================================
   CRV — Migração única: projeto Firebase antigo (crv-dpp-sc)
   → projeto do site (crv-dpp-sc-v2)

   Copia as coleções usadas pela Caixinha, Controle de Viagens e
   Sistema de Diárias, mantendo os mesmos IDs de documento. Pode ser
   rodado mais de uma vez: documentos que já existem no destino são
   pulados (nada é sobrescrito nem apagado em nenhum dos projetos).

   Precisa dos secrets FIREBASE_SERVICE_ACCOUNT (v2) e
   FIREBASE_SERVICE_ACCOUNT_ANTIGO (crv-dpp-sc).

   Uso:  node migrar-projeto-antigo.js [--executar]
   ============================================================ */
const { EXECUTAR, iniciar, cabecalho, rodape, rodar } = require('./comum');

// coleção no projeto antigo → coleção no projeto v2
const COLECOES = [
  ['caixinha_config',      'caixinha_config'],
  ['caixinha_lancamentos', 'caixinha_lancamentos'],
  ['controle_viagens',     'controle_viagens'],
  ['servidores',           'diarias_servidores'],
];

rodar(async () => {
  const origem  = iniciar('FIREBASE_SERVICE_ACCOUNT_ANTIGO', 'origem');
  const destino = iniciar('FIREBASE_SERVICE_ACCOUNT', 'destino');
  cabecalho(`Migração ${origem.projeto} → ${destino.projeto}`);
  if (origem.projeto === destino.projeto) throw new Error('Os dois secrets apontam para o mesmo projeto — confira.');

  for (const [colO, colD] of COLECOES) {
    const snap = await origem.db.collection(colO).get();
    let copiados = 0, pulados = 0;
    for (const d of snap.docs) {
      const ref = destino.db.collection(colD).doc(d.id);
      if ((await ref.get()).exists) { pulados++; continue; }
      if (EXECUTAR) await ref.set(d.data());
      copiados++;
    }
    console.log(`${colO.padEnd(22)} → ${colD.padEnd(22)} ${snap.size} na origem · ${copiados} ${EXECUTAR ? 'copiados' : 'a copiar'} · ${pulados} já existiam`);
  }
  rodape();
});
