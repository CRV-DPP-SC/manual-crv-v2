/* ============================================================
   DADOS CADASTRAIS — extraídos do V1
   Fonte única de verdade para unidades, SRs, faltas e textos.
   ============================================================ */

const UNS = [
  /* SR01 — Grande Florianópolis */
  {n:'Penitenciária de Florianópolis',c:'Florianópolis',sr:'SR01',dir:'Max Cleber Orth',cg:'Diretor',em:'pe01@pp.sc.gov.br',tel:'(48) 3665-9123',e:'Rua Delminda da Silveira, 960 — Agronômica — Florianópolis/SC — CEP 88025-500'},
  {n:'Complexo Penitenciário do Estado',c:'São Pedro de Alcântara',sr:'SR01',dir:'Flávio Brasil Gancine',cg:'Diretor',em:'pe02@pp.sc.gov.br',tel:'(48) 3664-2750',e:'Rua Adriano Enning, s/n — Santa Tereza — São Pedro de Alcântara/SC — CEP 88125-000'},
  {n:'Presídio Regional de Tijucas',c:'Tijucas',sr:'SR01',dir:'Nathasha Daberkow Vieira',cg:'Diretora',em:'pr03@pp.sc.gov.br',tel:'(48) 3665-9280',e:'Rua Alberto Tomazi, s/n — Itinga — Tijucas/SC — CEP 88200-000'},
  {n:'Hospital de Custódia e Tratamento Psiquiátrico — HCTP',c:'Florianópolis',sr:'SR01',dir:'Fábio Medeiros Wiese',cg:'Diretor',em:'hctp@pp.sc.gov.br',tel:'(48) 3665-9191',e:'Rua Delminda da Silveira, s/n — Agronômica — Florianópolis/SC — CEP 88025-500'},
  {n:'Presídio Regional de Biguaçu',c:'Biguaçu',sr:'SR01',dir:'Fabiano Oliveira Suares',cg:'Diretor',em:'pr04@pp.sc.gov.br',tel:'(48) 3664-2700',e:'Rua Hermógenes Prazeres, 49 — Centro — Biguaçu/SC — CEP 88160-152'},
  {n:'Presídio Masculino Regional de Florianópolis',c:'Florianópolis',sr:'SR01',dir:'Joana Mahfuz Vicini',cg:'Diretora',em:'pr01@pp.sc.gov.br',tel:'(48) 3665-9256',e:'Rua Delminda da Silveira, 900 — Agronômica — Florianópolis/SC — CEP 88025-500'},
  {n:'Presídio Feminino Regional de Florianópolis',c:'Florianópolis',sr:'SR01',dir:'Marina Pamplona Coelho',cg:'Diretora',em:'pr02@pp.sc.gov.br',tel:'(48) 3665-9107',e:'Rua Lauro Linhares, s/n — Trindade — Florianópolis/SC — CEP 88036-001'},
  {n:'Unidade de Monitoramento Eletrônico',c:'Florianópolis',sr:'SR01',dir:'Gustavo Costa Vieira',cg:'Diretor',em:'ume@pp.sc.gov.br',tel:'(48) 3665-7327',e:'Rua Fúlvio Aducci, 1214 — Estreito — Florianópolis/SC'},
  {n:'Colônia Agroindustrial de Palhoça',c:'Palhoça',sr:'SR01',dir:'Renata de Souza de Oliveira',cg:'Diretora',em:'cogri@pp.sc.gov.br',tel:'(48) 3664-5580',e:'Rua José João Barcelos, s/n — Bela Vista — Palhoça/SC — CEP 88132-770'},
  /* SR02 — Sul */
  {n:'Penitenciária Feminina de Criciúma',c:'Criciúma',sr:'SR02',dir:'Virginia Gabriela Gonzales',cg:'Diretora',em:'pe04@pp.sc.gov.br',tel:'(48) 3403-1737',e:'Rua José Marinho Teixeira, s/n — São Domingos — Criciúma/SC — CEP 88812-680'},
  {n:'Penitenciária Masculina de Tubarão',c:'Tubarão',sr:'SR02',dir:'Deiveison Querino Batista',cg:'Diretor',em:'pe05@pp.sc.gov.br',tel:'(48) 3631-9777',e:'Rua Maria Menegaz, 735 — São João — Tubarão/SC — CEP 88708-570'},
  {n:'Penitenciária Sul',c:'Criciúma',sr:'SR02',dir:'Juliana Borges Medeiros Glaisi',cg:'Diretora',em:'pe03@pp.sc.gov.br',tel:'(48) 3403-1485',e:'Rua José Marinho Teixeira, 5005 — São Domingos — Criciúma/SC — CEP 88812-680'},
  {n:'Presídio Regional de Araranguá',c:'Araranguá',sr:'SR02',dir:'Daniel Possamai Vieira',cg:'Diretor',em:'pr08@pp.sc.gov.br',tel:'(48) 3529-0441',e:'Rua Renato Carbonera, 500 — Araranguá/SC — CEP 88900-000'},
  {n:'Presídio Regional de Criciúma',c:'Criciúma',sr:'SR02',dir:'Júnior Rodrigo Fagundes',cg:'Diretor',em:'pr05@pp.sc.gov.br',tel:'(48) 3403-1516',e:'Rua Odonel Bianchi, 330 — Santa Augusta — Criciúma/SC — CEP 88805-265'},
  {n:'Presídio Regional de Imbituba',c:'Imbituba',sr:'SR02',dir:'Filipe Gonzaga Lopes',cg:'Diretor',em:'pr09@pp.sc.gov.br',tel:'(48) 3647-7409',e:'Rua 13 de Setembro, s/n — Imbituba/SC — CEP 88780-000'},
  {n:'Presídio Regional de Laguna',c:'Laguna',sr:'SR02',dir:'Rafael Nunes de Oliveira',cg:'Diretor',em:'pr10@pp.sc.gov.br',tel:'(48) 3647-7425',e:'Rua Idelfonso Batista, s/n — Progresso — Laguna/SC — CEP 88790-000'},
  {n:'Presídio Regional de Tubarão',c:'Tubarão',sr:'SR02',dir:'Gladson Antônio da Silva',cg:'Diretor',em:'pr06@pp.sc.gov.br',tel:'(48) 3631-9780',e:'Rua Maria Menegaz, 635 — São João — Tubarão/SC — CEP 88708-570'},
  /* SR03 — Norte Catarinense */
  {n:'Penitenciária Industrial de Joinville',c:'Joinville',sr:'SR03',dir:'Márcio Simbalista',cg:'Diretor',em:'pe06@pp.sc.gov.br',tel:'(47) 3481-3948',e:'Servidão Antônio Deglmann Júnior, 245 — Parque Guarani — Joinville/SC — CEP 89209-240'},
  {n:'Presídio Feminino Regional de Joinville',c:'Joinville',sr:'SR03',dir:'Eliana Eloi',cg:'Diretora',em:'pr12@pp.sc.gov.br',tel:'(47) 3481-2369',e:'Servidão Antônio Deglmann Júnior, 245 — Parque Guarani — Joinville/SC — CEP 89209-240'},
  {n:'Presídio Regional de Joinville',c:'Joinville',sr:'SR03',dir:'Odirlei de Col',cg:'Diretor',em:'pr11@pp.sc.gov.br',tel:'(47) 3481-3900',e:'Servidão Antônio Deglmann Júnior, 245 — Parque Guarani — Joinville/SC — CEP 89209-240'},
  {n:'Presídio Regional de Barra Velha',c:'Barra Velha',sr:'SR03',dir:'Léia Cristina Steffen Fuck',cg:'Diretora',em:'pr14@pp.sc.gov.br',tel:'(47) 3481-2885',e:'Rua João Anselmo Breniensen, s/n — Vila Nova — Barra Velha/SC — CEP 88390-000'},
  {n:'Presídio Regional de São Francisco do Sul',c:'São Francisco do Sul',sr:'SR03',dir:'Lamartine Ximenes Fernandes',cg:'Diretor',em:'pr13@pp.sc.gov.br',tel:'(47) 3481-3932',e:'Estrada Geral da Pedreira — Miranda — São Francisco do Sul/SC — CEP 89240-000'},
  /* SR04 — Vale do Itajaí */
  {n:'Penitenciária Masculina do Vale do Itajaí',c:'Itajaí',sr:'SR04',dir:'Bruno Domingos Gabriel',cg:'Diretor',em:'pe07@pp.sc.gov.br',tel:'(47) 3398-6700',e:'Estrada Geral João Tomaz Pinto, s/n — Canhanduba — Itajaí/SC — CEP 88307-770'},
  {n:'Presídio Feminino Regional de Itajaí',c:'Itajaí',sr:'SR04',dir:'Michele Rebello de Mesquita',cg:'Diretora',em:'pr16@pp.sc.gov.br',tel:'(47) 3398-6185',e:'Estrada Geral João Tomaz Pinto, s/n — Canhanduba — Itajaí/SC — CEP 88307-770'},
  {n:'Presídio Regional de Brusque',c:'Brusque',sr:'SR04',dir:'Giovani Manfredini Queiroz',cg:'Diretor',em:'pr17@pp.sc.gov.br',tel:'(47) 3251-8280',e:'Rod. SC-408, km 02 — Santa Luzia — Brusque/SC — CEP 88357-340'},
  {n:'Presídio Regional de Itajaí',c:'Itajaí',sr:'SR04',dir:'Rogério José Bizatto',cg:'Diretor',em:'pr15@pp.sc.gov.br',tel:'(47) 3398-6750',e:'Estrada Geral João Tomaz Pinto, s/n — Canhanduba — Itajaí/SC — CEP 88307-770'},
  {n:'Presídio Regional de Itapema',c:'Itapema',sr:'SR04',dir:'Eduardo Weber Xavier',cg:'Diretor',em:'pr18@pp.sc.gov.br',tel:'(47) 3398-6684',e:'Rua 440, s/n — Morretes — Itapema/SC — CEP 88220-000'},
  /* SR05 — Serrana */
  {n:'Penitenciária Industrial de São Cristóvão do Sul',c:'São Cristóvão do Sul',sr:'SR05',dir:'Mario Machado Rosa',cg:'Diretor',em:'pe09@pp.sc.gov.br',tel:'(49) 3412-3190',e:'Estrada Geral Paredão, s/n — São Cristóvão do Sul/SC — CEP 89533-000'},
  {n:'Penitenciária Regional de Curitibanos',c:'São Cristóvão do Sul',sr:'SR05',dir:'Sinara Ortiz Santos',cg:'Diretora',em:'pe08@pp.sc.gov.br',tel:'(49) 3412-3300',e:'Rua Juventino França de Moraes, s/n — São Cristóvão do Sul/SC — CEP 89533-000'},
  {n:'Presídio Masculino de Lages',c:'Lages',sr:'SR05',dir:'Rodrigo Araújo Aquino',cg:'Diretor',em:'pr19@pp.sc.gov.br',tel:'(49) 3289-8467',e:'Rua Ricardo Marin, s/n — Santa Clara — Lages/SC — CEP 88513-210'},
  {n:'Presídio Regional de Lages',c:'Lages',sr:'SR05',dir:'Ricardo Fernando Moreira Floriani',cg:'Diretor',em:'pr20@pp.sc.gov.br',tel:'(49) 3289-8403',e:'Rua Mato Grosso, 247 — São Cristóvão — Lages/SC — CEP 88509-220'},
  {n:'Presídio Regional de Caçador',c:'Caçador',sr:'SR05',dir:'André Luiz Pierdoná',cg:'Diretor',em:'pr21@pp.sc.gov.br',tel:'(49) 3561-6945',e:'Av. Albino Felipe Potrick, 50 — Bom Sucesso — Caçador/SC — CEP 89501-335'},
  {n:'Presídio Regional de Campos Novos',c:'Campos Novos',sr:'SR05',dir:'Evalcir Morais dos Santos',cg:'Diretor',em:'pr22@pp.sc.gov.br',tel:'(49) 3541-3588',e:'Estrada Geral Usina Velha, s/n — Campos Novos/SC — CEP 89620-000'},
  {n:'Presídio Regional de Videira',c:'Videira',sr:'SR05',dir:'Fabio Antunes Ramos',cg:'Diretor',em:'pr23@pp.sc.gov.br',tel:'(49) 3533-5915',e:'Rodovia SC-303, Linha Scussiato — Videira/SC — CEP 89560-000'},
  {n:'Unidade de Segurança Máxima de São Cristóvão do Sul',c:'São Cristóvão do Sul',sr:'SR05',dir:'Daniel de Sena',cg:'Diretor',em:'umax@pp.sc.gov.br',tel:'(49) 3412-3241',e:'Rua Juventino França de Moraes, s/n — São Cristóvão do Sul/SC — CEP 89533-000'},
  /* SR06 — Oeste */
  {n:'Penitenciária Agrícola de Chapecó',c:'Chapecó',sr:'SR06',dir:'Itacir Ricieri Cella',cg:'Diretor',em:'pe10@pp.sc.gov.br',tel:'(49) 2049-9760',e:'Rua Cunha Porã, 1600-E — Efapi — Chapecó/SC — CEP 89809-500'},
  {n:'Penitenciária Industrial de Chapecó',c:'Chapecó',sr:'SR06',dir:'Iuri Elias Berwanger',cg:'Diretor',em:'pe11@pp.sc.gov.br',tel:'(49) 2049-9713',e:'Rua Cunha Porã, 1600-E — Efapi — Chapecó/SC — CEP 89809-500'},
  {n:'Presídio Feminino Regional de Chapecó',c:'Chapecó',sr:'SR06',dir:'Agda Remus',cg:'Diretora',em:'pr25@pp.sc.gov.br',tel:'(49) 2049-9813',e:'Rua Cunha Porã, 1600-E — Efapi — Chapecó/SC — CEP 89809-500'},
  {n:'Presídio Regional de Chapecó',c:'Chapecó',sr:'SR06',dir:'José Lauri Pelizzari',cg:'Diretor',em:'pr24@pp.sc.gov.br',tel:'(49) 2049-9602',e:'Rua Cunha Porã, 1600-E — Efapi — Chapecó/SC — CEP 89809-500'},
  {n:'Presídio Regional de Concórdia',c:'Concórdia',sr:'SR06',dir:'Rafael Schlegel Rodrigues Salgado',cg:'Diretor',em:'pr26@pp.sc.gov.br',tel:'(49) 3482-6222',e:'Rua Adélio Hilário Mutzemberg, s/n — Guilherme Reich — Concórdia/SC — CEP 89709-132'},
  {n:'Presídio Regional de Joaçaba',c:'Joaçaba',sr:'SR06',dir:'Liliam Wiest',cg:'Diretora',em:'pr27@pp.sc.gov.br',tel:'(49) 3527-9829',e:'BR-282, km 391 — Vila Remor — Joaçaba/SC — CEP 89600-000'},
  {n:'Presídio Regional de Maravilha',c:'Maravilha',sr:'SR06',dir:'Marcelo Rodrigo Langaro',cg:'Diretor',em:'pr29@pp.sc.gov.br',tel:'(49) 3664-6672',e:'Av. Sul Brasil, 1607 — Centro — Maravilha/SC — CEP 89874-000'},
  {n:'Presídio Regional de São José do Cedro',c:'São José do Cedro',sr:'SR06',dir:'Rejane Birci Schrader de Mattos',cg:'Diretora',em:'pr30@pp.sc.gov.br',tel:'(49) 3644-3436',e:'Rua Amambuy esq. Dom Pedro, 673 — Jardim — São José do Cedro/SC — CEP 89930-000'},
  {n:'Presídio Regional de São Miguel do Oeste',c:'São Miguel do Oeste',sr:'SR06',dir:'Eduardo Francisco Bregola Junior',cg:'Diretor',em:'pr31@pp.sc.gov.br',tel:'(49) 3631-3754',e:'Rua Oiapoc, 1795 — Centro — São Miguel do Oeste/SC — CEP 89900-000'},
  {n:'Presídio Regional de Xanxerê',c:'Xanxerê',sr:'SR06',dir:'Vitor Matte',cg:'Diretor',em:'pr28@pp.sc.gov.br',tel:'(49) 3382-2269',e:'Rua Maranhão, 1780 — Castelo Branco — Xanxerê/SC — CEP 89820-000'},
  /* SR07 — Médio Vale do Itajaí */
  {n:'Penitenciária Industrial de Blumenau',c:'Blumenau',sr:'SR07',dir:'Luciano Cardoso',cg:'Diretor',em:'pe12@pp.sc.gov.br',tel:'(47) 3378-8600',e:'Rua Silvano Candido da Silva, 4601 — Ponta Aguda — Blumenau/SC — CEP 89050-287'},
  {n:'Presídio Regional de Blumenau',c:'Blumenau',sr:'SR07',dir:'Augusto Gregory Hilgenberg Ijaille',cg:'Diretor',em:'pr32@pp.sc.gov.br',tel:'(47) 3378-8716',e:'Rua General Osório, 4585 — Passo Manso — Blumenau/SC — CEP 89032-239'},
  {n:'Presídio Regional de Indaial',c:'Indaial',sr:'SR07',dir:'Ivã Carlos Fuck',cg:'Diretor',em:'pr34@pp.sc.gov.br',tel:'(47) 3399-3193',e:'Rua Otto Stange, 127 — Estados — Indaial/SC — CEP 89086-045'},
  {n:'Presídio Regional de Ituporanga',c:'Ituporanga',sr:'SR07',dir:'Marisoni dos Santos',cg:'Diretor',em:'pr35@pp.sc.gov.br',tel:'(47) 3533-8797',e:'Rua Governador Jorge Lacerda, 72 — Centro — Ituporanga/SC — CEP 88400-000'},
  {n:'Presídio Regional de Rio do Sul',c:'Rio do Sul',sr:'SR07',dir:'Victor Hugo Vanelli',cg:'Diretor',em:'pr33@pp.sc.gov.br',tel:'(47) 3526-3308',e:'Estrada Geral Serra Canoas, s/n — Rio do Sul/SC'},
  /* SR08 — Planalto Norte */
  {n:'Penitenciária Industrial de São Bento do Sul',c:'São Bento do Sul',sr:'SR08',dir:'Leô Da Silva Feliciano',cg:'Diretor',em:'pe13@pp.sc.gov.br',tel:'(47) 3647-0240',e:'Rua Miguel Hubl, 400 — Lençol — São Bento do Sul/SC — CEP 89289-580'},
  {n:'Presídio Regional de Canoinhas',c:'Canoinhas',sr:'SR08',dir:'Alexander Marcelo Costa',cg:'Diretor',em:'pr38@pp.sc.gov.br',tel:'(47) 3627-4352',e:'Rua Catarina de Souza Hubner, 1035 — Piedade — Canoinhas/SC — CEP 89460-613'},
  {n:'Presídio Regional de Jaraguá do Sul',c:'Jaraguá do Sul',sr:'SR08',dir:'Carlos de Almeida Rossato',cg:'Diretor',em:'pr36@pp.sc.gov.br',tel:'(47) 3276-9409',e:'Rua Alvino Flor da Silva, 901 — Jaraguá do Sul/SC — CEP 89260-875'},
  {n:'Presídio Regional de Mafra',c:'Mafra',sr:'SR08',dir:'Gabriel Henning',cg:'Diretor',em:'pr37@pp.sc.gov.br',tel:'(47) 3647-0222',e:'Rua Getúlio Vargas, 604 — Centro — Mafra/SC — CEP 89300-210'},
  {n:'Presídio Regional de Porto União',c:'Porto União',sr:'SR08',dir:'Josmar Mattos e Santos',cg:'Diretor',em:'pr39@pp.sc.gov.br',tel:'(47) 3627-4340',e:'Rua Matos Costa, 772 — Centro — Porto União/SC — CEP 89400-000'},
];

const SR = {
  SR01:{s:'Kelvyn Diehl',cg:'Superintendente Regional',nome:'Superintendência Regional da Grande Florianópolis'},
  SR02:{s:'Marcos Aurélio Spinardi',cg:'Superintendente Regional',nome:'Superintendência Regional Sul'},
  SR03:{s:'André Felippe Dias',cg:'Superintendente Regional',nome:'Superintendência Regional do Norte Catarinense'},
  SR04:{s:'Anderson Luiz Teodoro',cg:'Superintendente Regional',nome:'Superintendência Regional do Vale do Itajaí'},
  SR05:{s:'Fabiano Deitos Rech',cg:'Superintendente Regional',nome:'Superintendência Regional Serrana'},
  SR06:{s:'Guimorvan Boita',cg:'Superintendente Regional',nome:'Superintendência Regional Oeste'},
  SR07:{s:'Ricardo da Silva Morlo',cg:'Superintendente Regional',nome:'Superintendência Regional do Médio Vale do Itajaí'},
  SR08:{s:'Edenilson Schelbauer',cg:'Superintendente Regional',nome:'Superintendência Regional do Planalto Norte'},
};

const FALTAS = [
  {c:'Art. 50, I',  d:'incitar ou participar de movimento para subverter a ordem ou a disciplina'},
  {c:'Art. 50, II', d:'fugir'},
  {c:'Art. 50, III',d:'possuir, indevidamente, instrumento capaz de ofender a integridade física de outrem'},
  {c:'Art. 50, IV', d:'provocar acidente de trabalho'},
  {c:'Art. 50, V',  d:'descumprir, no regime aberto, as condições impostas'},
  {c:'Art. 50, VI', d:'inobservar os deveres previstos nos incisos II e V do art. 39 da LEP'},
  {c:'Art. 50, VII',d:'ter em sua posse, utilizar ou fornecer aparelho telefônico, de rádio ou similar, que permita a comunicação com outros presos ou com o ambiente externo'},
  {c:'Art. 50, VIII',d:'recusar submeter-se ao procedimento de identificação do perfil genético'},
  {c:'Art. 52, caput',d:'praticar fato previsto como crime doloso, constituindo falta grave sujeita ao Regime Disciplinar Diferenciado (RDD)'},
];

/* ── Constantes de texto institucional ── */
const TXT_CONTATOS_ANUEM =
  'Foram realizados contatos prévios com o(a) Diretor(a) da unidade de destino e o(s) respectivo(s) Superintendente(s) Regional(is), que anuem ao presente expediente.';

const TXT_CONTATOS_SUBSCREVEM =
  'Foram realizados contatos prévios com o(a) Diretor(a) da unidade de destino e o(s) respectivo(s) Superintendente(s) Regional(is), que subscrevem o presente expediente.';

const TXT_CONTATOS_PERMUTA =
  'Foram realizados contatos prévios com os entes envolvidos, quais sejam, o(a) Diretor(a) da Unidade Prisional de destino e o(s) respectivo(s) Superintendente(s) Regional(is), que subscrevem ou anuem ao presente expediente.';

const TXT_DESFECHO_PLURAL          = 'Diante do exposto, solicita-se a análise e deliberação da Central de Regulação de Vagas quanto à viabilidade das transferências.';
const TXT_DESFECHO_SINGULAR        = 'Diante do exposto, solicita-se a análise e deliberação da Central de Regulação de Vagas quanto à viabilidade da transferência.';
const TXT_DESFECHO_PLURAL_CELERE   = 'Diante do exposto, solicita-se análise e célere deliberação da Central de Regulação de Vagas quanto à viabilidade das transferências.';
const TXT_DESFECHO_SINGULAR_CELERE = 'Diante do exposto, solicita-se análise e célere deliberação da Central de Regulação de Vagas quanto à viabilidade da transferência.';
const TXT_DESFECHO_PLEITO          = 'Diante do exposto, solicita-se a análise e deliberação da Central de Regulação de Vagas quanto à viabilidade do pleito.';
const TXT_DESFECHO_PERMUTA         = 'Diante do exposto, solicita-se a análise e deliberação da Central de Regulação de Vagas quanto à viabilidade da permuta.';
const TXT_DESFECHO_CIVIL_PLURAL    = 'Diante do exposto, solicita-se a análise e célere deliberação da Central de Regulação de Vagas quanto à viabilidade das transferências.';
const TXT_DESFECHO_CIVIL_SINGULAR  = 'Diante do exposto, solicita-se a análise e célere deliberação da Central de Regulação de Vagas quanto à viabilidade da transferência.';
