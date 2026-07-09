/* ============================================================
   ESTADO — gerenciador de estado reativo
   Única fonte de verdade do formulário.
   ============================================================ */

var Estado = (function() {
  var _data = _estadoVazio();
  var _listeners = [];

  function _estadoVazio() {
    return {
      mod: null, sub: null,
      genero: null, numero: 'S',
      reed: [],
      nome: '', ipen: '',
      ori: null, des: null,
      sau: '', desp: '',
      numOficio: null,
      juizo: '', sit: '', pad: '', faltaCod: '', faltaDesc: '',
      razPernoite: '', dataTrans: '', motComun: '', motTransf: '',
      motTransfPermuta: '', motPermuta: '', motPermutaDes: '', motIndicacao: '',
      permutaDes: [],
      nomejuiz: '', vara: '', cidJuizo: '',
      regime: '', alocacao: '',
      bpi: '', bpiMotivo: '',
      dd: true, sro: false, srd: false,
      comorbidades: [], medicamentos: [],
      saudeOpcao: null,
    };
  }

  function _clonar(v) {
    if (Array.isArray(v)) return v.map(_clonar);
    if (v && typeof v === 'object') return Object.assign({}, v);
    return v;
  }

  function _notificar() {
    var snap = get();
    _listeners.forEach(function(fn) { fn(snap); });
  }

  function get(key) {
    if (key !== undefined) return _clonar(_data[key]);
    var snap = {};
    Object.keys(_data).forEach(function(k) { snap[k] = _clonar(_data[k]); });
    return snap;
  }

  function set(key, value) {
    _data[key] = value;
    _notificar();
  }

  function setMany(obj) {
    Object.assign(_data, obj);
    _notificar();
  }

  function reset() {
    _data = _estadoVazio();
    _notificar();
  }

  function onChange(fn) {
    _listeners.push(fn);
  }

  function offChange(fn) {
    _listeners = _listeners.filter(function(f) { return f !== fn; });
  }

  /* Carrega dados de um snapshot (para reutilizar do histórico) */
  function carregar(snap) {
    _data = Object.assign(_estadoVazio(), snap);
    _notificar();
  }

  return { get: get, set: set, setMany: setMany, reset: reset, onChange: onChange, offChange: offChange, carregar: carregar };
})();
