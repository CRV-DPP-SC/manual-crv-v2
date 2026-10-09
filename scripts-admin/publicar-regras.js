/* ============================================================
   CRV — Publicar as regras do Firestore (firestore.rules)

   Roda no workflow "Regras do Firestore" sempre que o arquivo
   firestore.rules muda no GitHub (ou manualmente, pelo Actions).

   Trava de segurança: só publica se as regras que estão NO AR forem
   uma versão que já existiu no repositório (pasta --historico, gerada
   pelo workflow com "git show" de cada versão). Se alguém editou as
   regras direto no Console do Firebase, nada é sobrescrito: a tarefa
   para e mostra a diferença. Para publicar mesmo assim, rode
   manualmente marcando "forcar".

   Uso:  node publicar-regras.js [--executar] [--forcar] [--historico <pasta>]
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { EXECUTAR, iniciar, cabecalho, rodape, rodar } = require('./comum');

const FORCAR = process.argv.includes('--forcar');
const iHist = process.argv.indexOf('--historico');
const PASTA_HISTORICO = iHist > -1 ? process.argv[iHist + 1] : null;
const ARQUIVO = path.join(__dirname, '..', 'firestore.rules');

// Ignora diferenças de fim de linha e espaços no fim das linhas
const normalizar = t => String(t || '').replace(/\r\n/g, '\n').split('\n').map(l => l.trimEnd()).join('\n').trim();

// Diferença simples, linha a linha (suficiente para conferir as regras)
function diferenca(antes, depois) {
  const a = antes.split('\n'), b = depois.split('\n');
  const n = a.length, m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { i++; j++; }
    else if (j < m && (i === n || lcs[i][j + 1] >= lcs[i + 1][j])) out.push(`  + ${b[j++]}`);
    else out.push(`  - ${a[i++]}`);
  }
  return out.length ? out.join('\n') : '  (sem diferenças)';
}

rodar(async () => {
  const { app, projeto } = iniciar();
  cabecalho(`Regras do Firestore — projeto ${projeto}`);

  const novas = fs.readFileSync(ARQUIVO, 'utf8');
  const rules = app.securityRules();

  let noAr = '';
  try {
    const atual = await rules.getFirestoreRuleset();
    noAr = (atual.source || []).map(s => s.content).join('\n');
  } catch (e) {
    if (e.code !== 'security-rules/not-found') throw e;
  }

  if (normalizar(noAr) === normalizar(novas)) {
    console.log('As regras no ar já são iguais ao firestore.rules do repositório. Nada a fazer.');
    return;
  }

  console.log('Diferença (- no ar hoje  /  + firestore.rules do repositório):\n');
  console.log(diferenca(normalizar(noAr), normalizar(novas)));
  console.log('');

  if (PASTA_HISTORICO && !FORCAR) {
    const versoes = fs.readdirSync(PASTA_HISTORICO).filter(f => f.endsWith('.rules'));
    const origem = versoes.find(f => normalizar(fs.readFileSync(path.join(PASTA_HISTORICO, f), 'utf8')) === normalizar(noAr));
    if (!origem) {
      console.log('⚠ As regras no ar NÃO correspondem a nenhuma versão do repositório');
      console.log('  (alguém pode ter editado direto no Console do Firebase).');
      console.log('  Nada foi publicado. Confira a diferença acima; para publicar mesmo assim,');
      console.log('  rode o workflow "Regras do Firestore" manualmente marcando "executar" e "forcar".');
      process.exitCode = 1;
      return;
    }
    console.log(`✓ As regras no ar são a versão do commit ${origem.replace('.rules', '')} — seguro atualizar.\n`);
  }

  if (EXECUTAR) {
    await rules.releaseFirestoreRulesetFromSource(novas);
    console.log('✅ Regras publicadas no Firestore.');
  }
  rodape();
});
