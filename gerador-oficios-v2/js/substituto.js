/* ============================================================
   ASSINATURA EM EXERCÍCIO (e.e.)
   Quem cria o pedido pode indicar, para cada unidade/Superintendência,
   que assina um(a) substituto(a) em vez do(a) titular — qualquer
   Diretor(a) ou Superintendente (CPEN não), escolhido pelo nome.
   Estado.subst = { ori|des|sro|srd: { para, email, nome, cg, de } }
     para → e-mail da unidade/SR do lugar (se a unidade mudar, a escolha deixa de valer)
     cg   → cargo do bloco de assinatura ('Diretor e.e.', 'Superintendente Regional e.e.')
     de   → de onde a pessoa é titular (só para exibição)
   ============================================================ */

function _emailDirDe(u)  { return u.em.replace(/@pp\.sc\.gov\.br$/, 'dir@pp.sc.gov.br'); }
function _emailSupDe(cod){ return cod.toLowerCase() + 'sr@pp.sc.gov.br'; }
function _emailSRDe(cod) { return cod.toLowerCase() + '@pp.sc.gov.br'; }

/* Diretores (dados das unidades) + Superintendentes (SR), com nome */
function _pessoasAssinantes() {
  var lista = [];
  getUns().forEach(function(u) {
    if (!u.dir) return;
    lista.push({ nome: u.dir, email: _emailDirDe(u), tipo: 'dir', cg: u.cg || 'Diretor(a)',
                 de: (u.cg || 'Diretor(a)') + ' · ' + u.n, sr: u.sr });
  });
  Object.keys(SR).forEach(function(cod) {
    var r = SR[cod];
    if (!r || !r.s) return;
    lista.push({ nome: r.s, email: _emailSupDe(cod), tipo: 'sup', cg: 'Superintendente Regional',
                 de: 'Superintendente Regional · ' + cod, sr: cod });
  });
  return lista;
}

/* Lugares de assinatura do pedido atual: [{ slot, para, nomeLugar, cgTitular, ehSR }] */
function _lugaresAssinatura(s) {
  var o = s.ori, d = s.des, l = [];
  if (o) l.push({ slot: 'ori', para: o.em, nomeLugar: o.n, cgTitular: o.cg || 'Diretor(a)', ehSR: false });
  if (s.dd && d) l.push({ slot: 'des', para: d.em, nomeLugar: d.n, cgTitular: d.cg || 'Diretor(a)', ehSR: false });
  if (s.sro && o && SR[o.sr]) l.push({ slot: 'sro', para: _emailSRDe(o.sr), nomeLugar: SR[o.sr].nome, cgTitular: 'Superintendente Regional', ehSR: true });
  if (s.srd && d && SR[d.sr] && !(s.sro && o && o.sr === d.sr))
    l.push({ slot: 'srd', para: _emailSRDe(d.sr), nomeLugar: SR[d.sr].nome, cgTitular: 'Superintendente Regional', ehSR: true });
  return l;
}

/* Substituto(a) escolhido para o lugar (null = titular) */
function _substDe(s, slot, paraEmail) {
  var x = (s.subst || {})[slot];
  return x && x.para === paraEmail ? x : null;
}

/* Cargo no bloco de assinatura: lugar de SR → 'Superintendente Regional e.e.';
   lugar de unidade → cargo do próprio Diretor(a) ('Diretor'/'Diretora') ou 'Diretor(a)' se for Superintendente */
function _cargoExercicio(pessoa, ehSR) {
  if (ehSR) return 'Superintendente Regional e.e.';
  return (pessoa.tipo === 'dir' ? pessoa.cg : 'Diretor(a)') + ' e.e.';
}

/* ── Modal de escolha (por nome, unidade ou regional) ── */
var _ssLugar = null;

function _semAcento(t) { return (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

function abrirSeletorSubstituto(slot) {
  var lugar = _lugaresAssinatura(Estado.get()).find(function(l) { return l.slot === slot; });
  if (!lugar) return;
  _ssLugar = lugar;
  document.getElementById('ssTitulo').textContent = 'Quem responde por ' + lugar.nomeLugar + '?';
  document.getElementById('ssBusca').value = '';
  _renderizarSubstitutos();
  document.getElementById('ssBg').classList.add('open');
  document.getElementById('ssBusca').focus();
}

function fecharSeletorSubstituto() {
  document.getElementById('ssBg').classList.remove('open');
}

function _renderizarSubstitutos() {
  if (!_ssLugar) return;
  var q = _semAcento(document.getElementById('ssBusca').value.trim());
  /* o(a) próprio(a) titular do lugar não aparece */
  var titular = _ssLugar.ehSR ? _emailSupDe(_ssLugar.para.slice(0, 4)) : _ssLugar.para.replace('@', 'dir@');
  var pessoas = _pessoasAssinantes().filter(function(p) {
    if (p.email === titular) return false;
    return !q || _semAcento(p.nome + ' ' + p.de).indexOf(q) >= 0;
  });
  pessoas.sort(function(a, b) {
    return a.sr === b.sr ? (a.tipo === b.tipo ? a.nome.localeCompare(b.nome) : (a.tipo === 'sup' ? -1 : 1))
                         : a.sr.localeCompare(b.sr);
  });

  var html = '', srAtual = null;
  pessoas.forEach(function(p) {
    if (!q && p.sr !== srAtual) {
      srAtual = p.sr;
      html += '<div class="ss-grupo">' + _esc(p.sr) + (SR[p.sr] ? ' — ' + _esc(SR[p.sr].nome.replace('Superintendência Regional ', '')) : '') + '</div>';
    }
    html += '<button class="ss-item" onclick="escolherSubstituto(\'' + _esc(p.email) + '\')">'
      + '<span class="ss-nome">' + _esc(p.nome) + '</span>'
      + '<span class="ss-de">' + _esc(p.de) + '</span>'
      + '</button>';
  });
  document.getElementById('ssLista').innerHTML = html || '<p class="ass-modal-aviso">Ninguém encontrado com esse nome.</p>';
}

function escolherSubstituto(email) {
  var p = _pessoasAssinantes().find(function(x) { return x.email === email; });
  if (!p || !_ssLugar) return;
  var subst = Object.assign({}, Estado.get('subst') || {});
  subst[_ssLugar.slot] = { para: _ssLugar.para, email: p.email, nome: p.nome,
                           cg: _cargoExercicio(p, _ssLugar.ehSR), de: p.de };
  fecharSeletorSubstituto();
  Estado.set('subst', subst);     /* atualiza o bloco de assinaturas do ofício */
  abrirModalAssinaturas();        /* atualiza a lista do modal */
}

function usarTitular(slot) {
  var subst = Object.assign({}, Estado.get('subst') || {});
  delete subst[slot];
  Estado.set('subst', subst);
  abrirModalAssinaturas();
}
