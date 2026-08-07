// ================================================
// Dados compartilhados — Escala de Plantão (CRV)
// Rodízio: cada servidor tem seu próprio ciclo
// (âncora + dias de trabalho + dias de folga),
// independente da "letra do dia" calculada a partir
// de 01/08/2026 = C (ciclo fixo C→D→A→B a cada 4 dias).
// ================================================

const ESCALA_LETRA_ANCORA = '2026-08-01'; // letra C nessa data
const ESCALA_LETRAS = ['C', 'D', 'A', 'B'];

const ESCALA_SERVIDORES = [
  { id: 'bruna',    nome: 'Bruna Roberta Wessner Longen', matricula: '0956090-4-03', email: 'brunawlongen@gmail.com',        letras: ['A'],     ancora: '2026-10-02', diasTrabalho: 1, diasFolga: 3, status: 'ativo' },
  { id: 'rodrigo',  nome: 'Rodrigo Laux Pastore',         matricula: '0654163-1-01', email: 'rodrigo.l.pastore@gmail.com',   letras: ['D','A'], ancora: '2026-10-01', diasTrabalho: 2, diasFolga: 6, status: 'ativo' },
  { id: 'juliana',  nome: 'Juliana de Andrade Abel',      matricula: '0951910-6-04', email: 'abeljuliana2012@gmail.com',     letras: ['D','A'], ancora: '2026-10-05', diasTrabalho: 2, diasFolga: 6, status: 'ativo' },
  { id: 'dayanne',  nome: 'Dayanne Christine Sestren Rosa',matricula: '0963194-1-01', email: 'day.sestren88@gmail.com',       letras: ['B','C'], ancora: '2026-10-03', diasTrabalho: 2, diasFolga: 6, status: 'ativo' },
  { id: 'ricardo',  nome: 'Ricardo de Brito Marques',     matricula: '0379682-5-01', email: 'ricardobritomarques12@gmail.com',letras: ['B','C'], ancora: '2026-10-07', diasTrabalho: 2, diasFolga: 6, status: 'ativo' },
  { id: 'ivana',    nome: 'Ivana Schafer',                matricula: '0951405-8-05', email: 'ivana.schafer@gmail.com',       letras: ['C','D'], ancora: '2026-10-08', diasTrabalho: 2, diasFolga: 6, status: 'ativo' }
];

// Horários possíveis de Plantão Extra — 'D' (diurno) ou 'N' (noturno)
const ESCALA_HORARIOS_EXTRA = [
  { id: 'a', inicio: '08:00', fim: '16:00', tipo: 'D' },
  { id: 'b', inicio: '10:00', fim: '18:00', tipo: 'D' },
  { id: 'c', inicio: '16:00', fim: '00:00', tipo: 'D' },
  { id: 'd', inicio: '22:00', fim: '06:00', tipo: 'N' },
  { id: 'e', inicio: '00:00', fim: '08:00', tipo: 'N' }
];

// Data local (sem fuso) a partir de 'YYYY-MM-DD'
function escalaParseData(str){
  const [ano, mes, dia] = str.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

// Diferença em dias inteiros entre duas datas (a - b)
function escalaDiffDias(a, b){
  const MS_DIA = 24 * 60 * 60 * 1000;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcA - utcB) / MS_DIA);
}

function escalaMod(a, b){
  return ((a % b) + b) % b;
}

// Letra do plantão-base do dia (independente de quem trabalha)
function escalaLetraDoDia(data){
  const dias = escalaDiffDias(data, escalaParseData(ESCALA_LETRA_ANCORA));
  return ESCALA_LETRAS[escalaMod(dias, 4)];
}

// Retorna true se o servidor está de plantão nessa data, pela fórmula
// (sem considerar exceções de troca/folga/ausência/afastamento)
function calcularPlantao(servidor, data){
  const ancora = escalaParseData(servidor.ancora);
  const dias = escalaDiffDias(data, ancora);
  const ciclo = servidor.diasTrabalho + servidor.diasFolga;
  return escalaMod(dias, ciclo) < servidor.diasTrabalho;
}

// Lista os servidores de plantão numa data (sem exceções)
function escalaServidoresDoDia(data, servidores){
  return (servidores || ESCALA_SERVIDORES).filter(s => calcularPlantao(s, data));
}

function escalaFormatarData(data){
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}
