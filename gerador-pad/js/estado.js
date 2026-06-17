/* ============================================================
   ESTADO — gerenciador de estado reativo do Gerador de PAD
   Única fonte de verdade do formulário.
   ============================================================ */

var Estado = (function() {
  var _data = _estadoVazio();
  var _listeners = [];

  function _estadoVazio() {
    return {
      // ── Identificação do PAD
      numPad:    '',
      dataInst:  '',

      // ── Incidentado (extraído do PDF ou manual)
      incidentado: {
        nome:         '',
        prontuario:   '',
        ipen:         '',
        nascimento:   '',
        mae:          '',
        naturalidade: '',
        regime:       '',
        cela:         '',
        processos:    '',
        artigosPenais:'',
        comportamento:'',
      },

      // ── Unidade (pré-carregada via autenticação)
      unidade: {
        codigo: '',
        nome:   '',
        email:  '',
        cidade: '',
        end:    '',
      },

      // ── Infração
      infracao: {
        data:      '',
        artigo:    '',   // 'art50_i' | 'art50_ii' | ... | 'art52'
        grau:      'grave',
        descricao: '',
        agentes:   [],
        observacao:'',
      },

      // ── Documentação Inicial (arquivos juntados)
      docInicial: {
        arquivos: [],   // [{ nome, tipo }] — metadados; binários em window._docInicialFiles
      },

      // ── Termo de Cientificação
      termoCient: {
        texto:     '',   // observações adicionais
        temAnexo:  false,
        nomeAnexo: '',
      },

      // ── Manifestação da Defesa
      manifDefesa: {
        texto:     '',   // digitado ou ditado
        temAnexo:  false,
        nomeAnexo: '',
      },

      // ── Defesa
      defesa: {
        tipo:              '',  // 'defensoria' | 'advogado'
        advNome:           '',
        advOab:            '',
        silencio:          false,  // incidentado optou por permanecer em silêncio
        versaoIncidentado: '',
        oitivaAnexo: { temAnexo: false, nomeAnexo: '' },
      },

      // ── Testemunhas (0 a N)
      testemunhas: [],
      // cada item: { nome, qualificacao, depoimento, qualidade: 'testemunha'|'informante', temAnexo, nomeAnexo }

      // ── Conselho Disciplinar
      conselho: {
        presidente: { nome: '', matricula: '' },
        membro1:    { nome: '', matricula: '' },
        membro2:    { nome: '', matricula: '' },
      },

      // ── Manifestação do Conselho
      manifestacao: {
        conclusao:        '',  // 'procedencia' | 'improcedencia' | 'desclassificacao'
        desclassGrau:     '',  // 'leve' | 'media'
        desclassArt:      '',  // 'Art. 95' | 'Art. 96'
        desclassIncisos:  [],  // ex: ['art95_i', 'art95_iii']
        fundamento:       '',
        temAnexo:         false,
        nomeAnexo:        '',
        textoExtraido:    '',  // texto extraído do PDF do conselho
      },

      // ── Decisão da Direção
      decisao: {
        resultado:             '',   // 'absolvicao' | 'desclassificacao' | 'falta_grave'
        desclassGrau:          '',   // 'leve' | 'media'
        desclassArt:           '',   // 'Art. 95' | 'Art. 96'
        desclassIncisos:       [],   // ex: ['art96_i', 'art96_ii']
        sancoes: {
          regressaoRegime:       false,
          interrupcaoProgressao: false,
          perdaRemicao: {
            aplicar:    false,
            modalidade: '',   // 'dias' | 'fracao'
            valor:      '',
          },
          revogacaoSaidaTemp:    false,
          revogacaoTrabalhoExt:  false,
        },
        fundamentacao:      '',  // II - Fundamentação (texto livre)
        fundamento:         '',  // mantido por compatibilidade
        textoManifConselho: '',  // texto extraído do PDF do conselho
        textoManifDefesa:   '',  // texto extraído do PDF da defesa (portal ou upload)
        temAnexo:   false,
        nomeAnexo:  '',
      },

      // ── Diretor da Unidade
      diretor: {
        nome:  '',
        cargo: 'Diretor(a)',
      },

      // ── Número do ofício de encaminhamento
      numOficioEnc: '',
      numOficioJuiz: '',
    };
  }

  function _clonar(v) {
    if (v === null || v === undefined) return v;
    if (Array.isArray(v)) return v.map(_clonar);
    if (typeof v === 'object') {
      var c = {};
      Object.keys(v).forEach(function(k) { c[k] = _clonar(v[k]); });
      return c;
    }
    return v;
  }

  function _notificar() {
    var snap = get();
    _listeners.forEach(function(fn) { try { fn(snap); } catch(e) {} });
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
    Object.keys(obj).forEach(function(k) { _data[k] = obj[k]; });
    _notificar();
  }

  function setNested(path, value) {
    // path ex: 'incidentado.nome' ou 'decisao.sancoes.regressaoRegime'
    var parts = path.split('.');
    var obj = _data;
    for (var i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]]) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    _notificar();
  }

  function reset() {
    _data = _estadoVazio();
    _notificar();
  }

  function onChange(fn) { _listeners.push(fn); }
  function offChange(fn) { _listeners = _listeners.filter(function(f) { return f !== fn; }); }

  function carregar(snap) {
    _data = Object.assign(_estadoVazio(), snap);
    // garante estruturas aninhadas
    if (snap.incidentado) _data.incidentado = Object.assign(_estadoVazio().incidentado, snap.incidentado);
    if (snap.infracao)    _data.infracao    = Object.assign(_estadoVazio().infracao,    snap.infracao);
    if (snap.defesa)      _data.defesa      = Object.assign(_estadoVazio().defesa,      snap.defesa);
    if (snap.conselho)    _data.conselho    = _clonar(snap.conselho);
    if (snap.docInicial)   _data.docInicial   = Object.assign(_estadoVazio().docInicial,  snap.docInicial);
    if (snap.termoCient)   _data.termoCient   = Object.assign(_estadoVazio().termoCient,  snap.termoCient);
    if (snap.manifDefesa)  _data.manifDefesa  = Object.assign(_estadoVazio().manifDefesa, snap.manifDefesa);
    if (snap.manifestacao){
      _data.manifestacao = Object.assign(_estadoVazio().manifestacao, snap.manifestacao);
      if (!Array.isArray(_data.manifestacao.desclassIncisos)) _data.manifestacao.desclassIncisos = [];
    }
    if (snap.decisao) {
      _data.decisao = _clonar(snap.decisao);
      if (!Array.isArray(_data.decisao.desclassIncisos)) _data.decisao.desclassIncisos = [];
    }
    if (snap.diretor)     _data.diretor     = Object.assign(_estadoVazio().diretor, snap.diretor);
    if (snap.unidade)     _data.unidade     = Object.assign(_estadoVazio().unidade, snap.unidade);
    _notificar();
  }

  return {
    get: get, set: set, setMany: setMany, setNested: setNested,
    reset: reset, onChange: onChange, offChange: offChange, carregar: carregar,
  };
})();
