/* ============================================================
   PERSISTÊNCIA — conselho disciplinar e preferências por unidade
   ============================================================ */

/* Chave isolada por unidade */
function _chaveConselho() {
  var s = Estado.get();
  var email = (s.unidade && s.unidade.email) || 'default';
  return 'pad_conselho_' + email.replace(/[^a-z0-9]/gi,'_');
}

function carregarConselho() {
  try {
    var dados = JSON.parse(localStorage.getItem(_chaveConselho()) || 'null');
    if (dados) {
      Estado.set('conselho', dados);
    }
  } catch(e) {}
}

function salvarConselho() {
  var s = Estado.get();
  try {
    localStorage.setItem(_chaveConselho(), JSON.stringify(s.conselho));
    _toast('Conselho Disciplinar salvo!');
  } catch(e) {
    _toast('Não foi possível salvar.');
  }
}

/* Preferências gerais */
function _prefsCarregar() {
  try { return JSON.parse(localStorage.getItem('pad_prefs') || '{}'); } catch(e) { return {}; }
}
function _prefsSalvar(k, v) {
  var prefs = _prefsCarregar();
  prefs[k] = v;
  try { localStorage.setItem('pad_prefs', JSON.stringify(prefs)); } catch(e) {}
}

/* Diretor pré-salvo */
function carregarDiretor() {
  var s = Estado.get();
  var email = (s.unidade && s.unidade.email) || '';
  var chave = 'pad_diretor_' + email.replace(/[^a-z0-9]/gi,'_');
  try {
    var dados = JSON.parse(localStorage.getItem(chave) || 'null');
    if (dados) Estado.set('diretor', dados);
  } catch(e) {}
}

function salvarDiretor() {
  var s = Estado.get();
  var email = (s.unidade && s.unidade.email) || '';
  var chave = 'pad_diretor_' + email.replace(/[^a-z0-9]/gi,'_');
  try {
    localStorage.setItem(chave, JSON.stringify(s.diretor));
    _toast('Dados do diretor salvos!');
  } catch(e) {}
}
