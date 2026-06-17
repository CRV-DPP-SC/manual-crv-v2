/* ============================================================
   DADOS — artigos LEP, LC 529/2011 e constantes do PAD
   ============================================================ */

/* Artigos da LEP — Art. 50 (faltas graves) */
var ARTIGOS_LEP = [
  { cod: 'art50_i',   label: 'Art. 50, I — LEP',   texto: 'incitar ou participar de movimento para subverter a ordem ou a disciplina' },
  { cod: 'art50_ii',  label: 'Art. 50, II — LEP',  texto: 'fugir' },
  { cod: 'art50_iii', label: 'Art. 50, III — LEP', texto: 'possuir, indevidamente, instrumento capaz de ofender a integridade física de outrem' },
  { cod: 'art50_iv',  label: 'Art. 50, IV — LEP',  texto: 'provocar acidente de trabalho' },
  { cod: 'art50_v',   label: 'Art. 50, V — LEP',   texto: 'descumprir, no regime aberto, as condições impostas' },
  { cod: 'art50_vi',  label: 'Art. 50, VI — LEP',  texto: 'inobservar os deveres previstos nos incisos II e V do art. 39 desta Lei' },
  { cod: 'art50_vii', label: 'Art. 50, VII — LEP', texto: 'tiver em sua posse, utilizar ou fornecer aparelho telefônico, de rádio ou similar, que permita a comunicação com outros presos ou com o ambiente externo' },
  { cod: 'art52',     label: 'Art. 52 — LEP (RDD)', texto: 'praticar fato previsto como crime doloso constituindo infração disciplinar grave e quando ocasionar subversão da ordem ou disciplina internas' },
];

/* Sanções possíveis para falta grave */
var SANCOES = [
  { cod: 'regressaoRegime',       label: 'Regressão de regime',                    lei: 'art. 118, I, da LEP' },
  { cod: 'interrupcaoProgressao', label: 'Interrupção da contagem para progressão', lei: 'art. 112, § 6º, da LEP' },
  { cod: 'perdaRemicao',          label: 'Perda de dias remidos',                   lei: 'art. 127 da LEP' },
  { cod: 'revogacaoSaidaTemp',    label: 'Revogação da saída temporária',           lei: 'art. 125 da LEP' },
  { cod: 'revogacaoTrabalhoExt',  label: 'Revogação do trabalho externo',           lei: 'art. 123 da LEP' },
];

/* Artigos da LC 529/2011-SC — desclassificação */
var ARTIGOS_LC = [
  { cod: 'art95', label: 'Art. 95 — LC 529/2011 (falta leve)',  grau: 'leve' },
  { cod: 'art96', label: 'Art. 96 — LC 529/2011 (falta média)', grau: 'media' },
];

/* Incisos do Art. 95 da LC 529/2011 — Faltas Leves */
var INCISOS_ART95 = [
  { cod: 'art95_i',    label: 'I',    texto: 'ocultar fato ou coisa relacionada com a falta de outrem, para dificultar averiguações' },
  { cod: 'art95_ii',   label: 'II',   texto: 'utilizar material, ferramenta ou utensílio do estabelecimento penal, em proveito próprio, sem a autorização competente' },
  { cod: 'art95_iii',  label: 'III',  texto: 'portar objeto de valor, além do regularmente permitido' },
  { cod: 'art95_iv',   label: 'IV',   texto: 'transitar pelo estabelecimento penal ou por suas dependências em desobediência às normas estabelecidas' },
  { cod: 'art95_v',    label: 'V',    texto: 'desobedecer às prescrições médicas, recusando o tratamento necessário ou utilizando medicamentos não prescritos ou autorizados pelo órgão médico competente' },
  { cod: 'art95_vi',   label: 'VI',   texto: 'enviar correspondência sem autorização do gestor do estabelecimento penal' },
  { cod: 'art95_vii',  label: 'VII',  texto: 'utilizar-se de local impróprio para satisfação de necessidades fisiológicas' },
  { cod: 'art95_viii', label: 'VIII', texto: 'utilizar-se de objeto pertencente a outro preso sem o devido consentimento' },
  { cod: 'art95_ix',   label: 'IX',   texto: 'proceder grosseira ou imoralmente em relação a outro interno' },
  { cod: 'art95_x',    label: 'X',    texto: 'simular doença ou estado de precariedade física para eximir-se de obrigação' },
  { cod: 'art95_xi',   label: 'XI',   texto: 'cometer desatenção propositada durante estudos ou aula de serviço' },
];

/* Incisos do Art. 96 da LC 529/2011 — Faltas Médias */
var INCISOS_ART96 = [
  { cod: 'art96_i',     label: 'I',     texto: 'praticar ou contribuir para a prática de jogos proibidos, agravando-se a falta quando essa prática envolver exploração de outros presos' },
  { cod: 'art96_ii',    label: 'II',    texto: 'resistir, inclusive por atitude passiva, à execução de ordem ou ato administrativo' },
  { cod: 'art96_iii',   label: 'III',   texto: 'ofender funcionários' },
  { cod: 'art96_iv',    label: 'IV',    texto: 'praticar compra ou venda não autorizada em relação a outro preso' },
  { cod: 'art96_v',     label: 'V',     texto: 'faltar à verdade com o fim de obter vantagem ou eximir-se de responsabilidade' },
  { cod: 'art96_vi',    label: 'VI',    texto: 'formular queixa ou reclamação com improcedência, reveladora de motivo reprovável' },
  { cod: 'art96_vii',   label: 'VII',   texto: 'explorar companheiro sob qualquer pretexto ou forma' },
  { cod: 'art96_viii',  label: 'VIII',  texto: 'desobedecer aos horários regulamentares' },
  { cod: 'art96_ix',    label: 'IX',    texto: 'recusar-se sem motivo justo ao trabalho que for determinado' },
  { cod: 'art96_x',     label: 'X',     texto: 'recusar-se à assistência ou ao dever escolar sem razão justificada' },
  { cod: 'art96_xi',    label: 'XI',    texto: 'entregar ou receber objetos sem a devida autorização' },
  { cod: 'art96_xii',   label: 'XII',   texto: 'desleixar-se da higiene corporal, do asseio da cela ou alojamento e descurar da conservação de objetos de uso pessoal' },
  { cod: 'art96_xiii',  label: 'XIII',  texto: 'lançar nos pátios águas servidas ou objetos, bem como lavar, estender ou secar roupas em local não permitido' },
  { cod: 'art96_xiv',   label: 'XIV',   texto: 'produzir ruídos para perturbar a ordem nas ocasiões de descanso, de trabalho ou de reunião' },
  { cod: 'art96_xv',    label: 'XV',    texto: 'desrespeitar os visitantes, seus ou de outros internos' },
  { cod: 'art96_xvi',   label: 'XVI',   texto: 'retardar o cumprimento de ordem com intuito de procrastinação' },
  { cod: 'art96_xvii',  label: 'XVII',  texto: 'descurar da execução de tarefa' },
  { cod: 'art96_xviii', label: 'XVIII', texto: 'ausentar-se dos lugares em que deva permanecer' },
];

/* Retorna array de incisos conforme grau ('leve' ou 'media') */
function getIncisosDesclass(grau) {
  return grau === 'media' ? INCISOS_ART96 : INCISOS_ART95;
}

/* Retorna objeto do artigo por código */
function getArtigo(cod) {
  return ARTIGOS_LEP.find(function(a) { return a.cod === cod; }) || null;
}

/* Retorna texto completo do artigo para uso nos documentos */
function textoArtigo(cod) {
  var a = getArtigo(cod);
  if (!a) return '';
  return a.label + ' — ' + a.texto;
}
