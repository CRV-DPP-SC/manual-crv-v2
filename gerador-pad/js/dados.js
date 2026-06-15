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
