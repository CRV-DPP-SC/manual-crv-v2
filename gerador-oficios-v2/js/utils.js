/* ============================================================
   UTILITÁRIOS — funções puras de texto e formatação
   Extraídas do V1. Dependem do objeto Estado (s).
   ============================================================ */

/* ── Inflexão de gênero e número ── */
function g(s, masc, fem)   { return s.genero === 'F' ? fem : masc; }
function gn(s, sing, plur) { return s.numero === 'P' ? plur : sing; }
function gng(s, ms, fs, mp, fp) {
  if (s.numero === 'P') return s.genero === 'F' ? fp : mp;
  return s.genero === 'F' ? fs : ms;
}

function art(s)      { return gng(s,'o','a','os','as'); }
function reed(s)     { return art(s) + ' ' + gng(s,'reeducando','reeducanda','reeducandos','reeducandas'); }
function cust(s)     { return art(s) + ' ' + gng(s,'custodiado','custodiada','custodiados','custodiadas'); }
function pres(s)     { return art(s) + ' ' + gng(s,'preso','presa','presos','presas'); }
function foi(s)      { return gn(s,'foi','foram'); }
function esta(s)     { return gn(s,'está','estão'); }
function transf(s)   { return gng(s,'transferido','transferida','transferidos','transferidas'); }
function custAdj(s)  { return gng(s,'custodiado','custodiada','custodiados','custodiadas'); }
function doA(s)      { return g(s,'do','da') + (s.numero === 'P' ? 's' : ''); }
function adj(s, ms, fs, mp, fp) { return gng(s, ms, fs, mp, fp); }

function reedFld(s, nome, ipen) {
  if (!s.genero) return 'o(a) reeducando(a) ' + fld(nome) + ', IPEN Nº ' + fld(ipen);
  return reed(s) + ' ' + fld(nome) + ', IPEN Nº ' + fld(ipen);
}

/* ── Formatação de texto do ofício ── */
function fld(t) {
  return '<span class="ofc-campo">' + (t || '') + '</span>';
}

/* Placeholder para campos não preenchidos no preview */
function ph(texto) {
  return '<span class="ofc-placeholder">‹' + texto + '›</span>';
}

/* Linha em branco no documento (11pt de altura) */
const LB = '<div class="lb"> </div>';
function lb(n) {
  var s = '';
  for (var i = 0; i < n; i++) s += LB;
  return s;
}

/* Parágrafo do ofício */
function p(t) {
  if (t && t.trim().startsWith('<ul')) return '<div class="ofc-lista-wrap">' + t + '</div>';
  var cls = t && t.indexOf('<ul') >= 0 ? 'ofc-p ofc-p-lista' : 'ofc-p';
  return '<div class="' + cls + '">' + t + '</div>';
}

/* ── Data por extenso ── */
function dHoje(cidade) {
  var d = new Date();
  var m = ['janeiro','fevereiro','março','abril','maio','junho',
           'julho','agosto','setembro','outubro','novembro','dezembro'];
  return (cidade ? cidade + ', ' : '') + d.getDate() + ' de ' + m[d.getMonth()] + ' de ' + d.getFullYear();
}

/* ── Auto-incremento do número do ofício ── */
function _proximoNumOficio(ultimo) {
  if (!ultimo) return '';
  var m = ultimo.match(/n[oº]\.?\s*(\d+)\/(\d{4})/i);
  if (!m) return '';
  var n = parseInt(m[1], 10) + 1;
  return ultimo.replace(/n[oº]\.?\s*\d+\/\d{4}/i,
    'nº ' + String(n).padStart(String(m[1]).length, '0') + '/' + m[2]);
}

/* ── Escape HTML básico ── */
function _esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
