// ================================================
// Dados compartilhados — Formulário e Relatório de
// Antecipação de Benefícios (CRV/DPP)
// Usado tanto pelo formulário público quanto pelo
// relatório restrito, para gerar o mesmo slug de
// unidade (ID do documento no Firestore) nos dois lados.
// ================================================
const SR_DATA = [
  { id:'sr01', name:'SR01 — Grande Florianópolis', units:[
    'Penitenciária de Florianópolis',
    'Complexo Penitenciário do Estado',
    'Presídio Regional de Tijucas',
    'Hospital de Custódia e Tratamento Psiquiátrico – HCTP',
    'Presídio Regional de Biguaçu',
    'Presídio Masculino Regional de Florianópolis',
    'Presídio Feminino Regional de Florianópolis',
    'Colônia Agroindustrial de Palhoça'
  ]},
  { id:'sr02', name:'SR02 — Sul', units:[
    'Penitenciária Feminina de Criciúma',
    'Penitenciária Masculina de Tubarão',
    'Penitenciária Sul',
    'Presídio Regional de Araranguá',
    'Presídio Regional de Criciúma',
    'Presídio Regional de Imbituba',
    'Presídio Regional de Laguna',
    'Presídio Regional de Tubarão'
  ]},
  { id:'sr03', name:'SR03 — Norte Catarinense', units:[
    'Penitenciária Industrial de Joinville',
    'Presídio Feminino Regional de Joinville',
    'Presídio Regional de Joinville',
    'Presídio Regional de Barra Velha',
    'Presídio Regional de São Francisco do Sul'
  ]},
  { id:'sr04', name:'SR04 — Vale do Itajaí', units:[
    'Penitenciária Masculina do Vale do Itajaí',
    'Presídio Feminino Regional de Itajaí',
    'Presídio Regional de Brusque',
    'Presídio Regional de Itajaí',
    'Presídio Regional de Itapema'
  ]},
  { id:'sr05', name:'SR05 — Serrana', units:[
    'Penitenciária Industrial de São Cristóvão do Sul',
    'Penitenciária Regional de Curitibanos',
    'Presídio Masculino de Lages',
    'Presídio Regional de Lages',
    'Presídio Regional de Caçador',
    'Presídio Regional de Campos Novos',
    'Presídio Regional de Videira',
    'Unidade de Segurança Máxima de São Cristóvão do Sul'
  ]},
  { id:'sr06', name:'SR06 — Oeste', units:[
    'Penitenciária Agrícola de Chapecó',
    'Penitenciária Industrial de Chapecó',
    'Presídio Feminino Regional de Chapecó',
    'Presídio Regional de Chapecó',
    'Presídio Regional de Concórdia',
    'Presídio Regional de Joaçaba',
    'Presídio Regional de Maravilha',
    'Presídio Regional de São José do Cedro',
    'Presídio Regional de São Miguel do Oeste',
    'Presídio Regional de Xanxerê'
  ]},
  { id:'sr07', name:'SR07 — Médio Vale do Itajaí', units:[
    'Penitenciária Industrial de Blumenau',
    'Presídio Regional de Blumenau',
    'Presídio Regional de Indaial',
    'Presídio Regional de Ituporanga',
    'Presídio Regional de Rio do Sul'
  ]},
  { id:'sr08', name:'SR08 — Planalto Norte', units:[
    'Penitenciária Industrial de São Bento do Sul',
    'Presídio Regional de Canoinhas',
    'Presídio Regional de Jaraguá do Sul',
    'Presídio Regional de Mafra',
    'Presídio Regional de Porto União'
  ]}
];

// Normaliza acentos/caixa (mesmo critério usado no filtro de busca do dropdown)
function normalizeTexto(str){
  return str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

// Gera o ID do documento no Firestore a partir do nome da unidade.
// Precisa ser idêntico no formulário e no relatório para o slug bater.
function slugifyUnidade(nome){
  return normalizeTexto(nome)
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'');
}

// Devolve o objeto { srId, srName } da unidade, ou null se não encontrada
function srDaUnidade(nomeUnidade){
  for (const sr of SR_DATA){
    if (sr.units.includes(nomeUnidade)) return { srId: sr.id, srName: sr.name };
  }
  return null;
}

// Cidade de cada unidade (fonte: data/unidades.json), usado na planilha/relatório
const CIDADE_POR_UNIDADE = {
  'Penitenciária de Florianópolis': 'Florianópolis',
  'Complexo Penitenciário do Estado': 'São Pedro de Alcântara',
  'Presídio Regional de Tijucas': 'Tijucas',
  'Hospital de Custódia e Tratamento Psiquiátrico – HCTP': 'Florianópolis',
  'Presídio Regional de Biguaçu': 'Biguaçu',
  'Presídio Masculino Regional de Florianópolis': 'Florianópolis',
  'Presídio Feminino Regional de Florianópolis': 'Florianópolis',
  'Colônia Agroindustrial de Palhoça': 'Palhoça',
  'Penitenciária Feminina de Criciúma': 'Criciúma',
  'Penitenciária Masculina de Tubarão': 'Tubarão',
  'Penitenciária Sul': 'Criciúma',
  'Presídio Regional de Araranguá': 'Araranguá',
  'Presídio Regional de Criciúma': 'Criciúma',
  'Presídio Regional de Imbituba': 'Imbituba',
  'Presídio Regional de Laguna': 'Laguna',
  'Presídio Regional de Tubarão': 'Tubarão',
  'Penitenciária Industrial de Joinville': 'Joinville',
  'Presídio Feminino Regional de Joinville': 'Joinville',
  'Presídio Regional de Joinville': 'Joinville',
  'Presídio Regional de Barra Velha': 'Barra Velha',
  'Presídio Regional de São Francisco do Sul': 'São Francisco do Sul',
  'Penitenciária Masculina do Vale do Itajaí': 'Itajaí',
  'Presídio Feminino Regional de Itajaí': 'Itajaí',
  'Presídio Regional de Brusque': 'Brusque',
  'Presídio Regional de Itajaí': 'Itajaí',
  'Presídio Regional de Itapema': 'Itapema',
  'Penitenciária Industrial de São Cristóvão do Sul': 'São Cristóvão do Sul',
  'Penitenciária Regional de Curitibanos': 'São Cristóvão do Sul',
  'Presídio Masculino de Lages': 'Lages',
  'Presídio Regional de Lages': 'Lages',
  'Presídio Regional de Caçador': 'Caçador',
  'Presídio Regional de Campos Novos': 'Campos Novos',
  'Presídio Regional de Videira': 'Videira',
  'Unidade de Segurança Máxima de São Cristóvão do Sul': 'São Cristóvão do Sul',
  'Penitenciária Agrícola de Chapecó': 'Chapecó',
  'Penitenciária Industrial de Chapecó': 'Chapecó',
  'Presídio Feminino Regional de Chapecó': 'Chapecó',
  'Presídio Regional de Chapecó': 'Chapecó',
  'Presídio Regional de Concórdia': 'Concórdia',
  'Presídio Regional de Joaçaba': 'Joaçaba',
  'Presídio Regional de Maravilha': 'Maravilha',
  'Presídio Regional de São José do Cedro': 'São José do Cedro',
  'Presídio Regional de São Miguel do Oeste': 'São Miguel do Oeste',
  'Presídio Regional de Xanxerê': 'Xanxerê',
  'Penitenciária Industrial de Blumenau': 'Blumenau',
  'Presídio Regional de Blumenau': 'Blumenau',
  'Presídio Regional de Indaial': 'Indaial',
  'Presídio Regional de Ituporanga': 'Ituporanga',
  'Presídio Regional de Rio do Sul': 'Rio do Sul',
  'Penitenciária Industrial de São Bento do Sul': 'São Bento do Sul',
  'Presídio Regional de Canoinhas': 'Canoinhas',
  'Presídio Regional de Jaraguá do Sul': 'Jaraguá do Sul',
  'Presídio Regional de Mafra': 'Mafra',
  'Presídio Regional de Porto União': 'Porto União'
};
