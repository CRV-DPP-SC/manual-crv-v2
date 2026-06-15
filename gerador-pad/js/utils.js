/* ============================================================
   UTILS — funções puras de texto e formatação
   ============================================================ */

/* Escape HTML básico */
function _esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* Placeholder para campos não preenchidos no preview */
function ph(texto) {
  return '<span class="pad-placeholder">‹' + texto + '›</span>';
}

/* Campo preenchido em negrito */
function fld(t) {
  return '<span class="pad-campo">' + _esc(t || '') + '</span>';
}

/* Linha em branco no documento */
const LB = '<div class="lb"> </div>';
function lb(n) {
  var s = '';
  for (var i = 0; i < (n||1); i++) s += LB;
  return s;
}

/* Parágrafo do documento */
function p(t) {
  return '<div class="pad-p">' + (t || '') + '</div>';
}

/* Parágrafo sem recuo */
function pSR(t) {
  return '<div class="pad-p pad-p-sr">' + (t || '') + '</div>';
}

/* Data por extenso */
function dPorExtenso(dataISO, cidade) {
  var d;
  if (dataISO) {
    var parts = dataISO.split('-');
    d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
  } else {
    d = new Date();
  }
  var m = ['janeiro','fevereiro','março','abril','maio','junho',
           'julho','agosto','setembro','outubro','novembro','dezembro'];
  var str = d.getDate() + ' de ' + m[d.getMonth()] + ' de ' + d.getFullYear() + '.';
  return cidade ? cidade + ', ' + str : str;
}

/* Formata data ISO para DD/MM/AAAA */
function fmtData(dataISO) {
  if (!dataISO) return '';
  var p = dataISO.split('-');
  if (p.length !== 3) return dataISO;
  return p[2] + '/' + p[1] + '/' + p[0];
}

/* Converte DD/MM/AAAA para ISO */
function parseDDMM(str) {
  if (!str) return '';
  var p = str.split('/');
  if (p.length !== 3) return str;
  return p[2] + '-' + p[1].padStart(2,'0') + '-' + p[0].padStart(2,'0');
}

/* Toast */
function _toast(msg, dur) {
  var el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(function() { el.classList.remove('show'); }, dur || 2800);
}

/* Toggle de seção colapsável */
function _toggleSec(btn) {
  var corpo = btn.closest('.form-secao').querySelector('.sec-corpo');
  var chev  = btn.querySelector('.sec-chevron');
  var aberto = corpo.style.display !== 'none';
  corpo.style.display = aberto ? 'none' : '';
  if (chev) chev.textContent = aberto ? '▶' : '▼';
}

/* Tabs mobile */
function _setAba(aba) {
  document.getElementById('painel-form').style.display = aba === 'form'    ? '' : 'none';
  document.getElementById('painel-prev').style.display = aba === 'preview' ? '' : 'none';
  document.querySelectorAll('.tab-btn').forEach(function(b) {
    b.classList.toggle('at', b.dataset.aba === aba);
  });
}
