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
  { cod: 'art95_i',    label: 'I',    texto: 'descumprir compromisso de ajustamento de conduta' },
  { cod: 'art95_ii',   label: 'II',   texto: 'praticar agiotagem' },
  { cod: 'art95_iii',  label: 'III',  texto: 'praticar jogo por dinheiro ou objeto de valor' },
  { cod: 'art95_iv',   label: 'IV',   texto: 'traficar artigos permitidos sem autorização da administração' },
  { cod: 'art95_v',    label: 'V',    texto: 'descumprir as normas disciplinares do estabelecimento' },
  { cod: 'art95_vi',   label: 'VI',   texto: 'não observar higiene pessoal ou do alojamento' },
  { cod: 'art95_vii',  label: 'VII',  texto: 'não zelar pela conservação dos bens públicos' },
  { cod: 'art95_viii', label: 'VIII', texto: 'fazer uso indevido de aparelho sonoro' },
  { cod: 'art95_ix',   label: 'IX',   texto: 'ingerir bebida alcoólica' },
  { cod: 'art95_x',    label: 'X',    texto: 'atrasar-se na entrada ao alojamento' },
  { cod: 'art95_xi',   label: 'XI',   texto: 'desacatar verbalmente qualquer servidor' },
];

/* Incisos do Art. 96 da LC 529/2011 — Faltas Médias */
var INCISOS_ART96 = [
  { cod: 'art96_i',    label: 'I',    texto: 'descumprir as normas de tratamento e cortesia' },
  { cod: 'art96_ii',   label: 'II',   texto: 'praticar ato imoral ou obsceno' },
  { cod: 'art96_iii',  label: 'III',  texto: 'destruir, danificar ou inutilizar obras ou bens do estabelecimento' },
  { cod: 'art96_iv',   label: 'IV',   texto: 'provocar perturbação coletiva' },
  { cod: 'art96_v',    label: 'V',    texto: 'jogar objetos pelas janelas ou pelos muros do estabelecimento' },
  { cod: 'art96_vi',   label: 'VI',   texto: 'deixar de cumprir ordem legal de servidor' },
  { cod: 'art96_vii',  label: 'VII',  texto: 'agenciar negócios sem autorização da administração' },
  { cod: 'art96_viii', label: 'VIII', texto: 'introduzir ou tentar introduzir artigos proibidos no estabelecimento' },
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
