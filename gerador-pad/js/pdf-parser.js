/* ============================================================
   PDF-PARSER — extração de dados do PDF i-PEN via PDF.js
   ============================================================ */

var PdfParser = (function() {

  /* Extrai texto de todas as páginas do PDF */
  function extrairTexto(file, callback) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var typedArray = new Uint8Array(e.target.result);
      pdfjsLib.getDocument({ data: typedArray }).promise.then(function(pdf) {
        var textos = [];
        var total  = pdf.numPages;
        var lidos  = 0;
        for (var i = 1; i <= total; i++) {
          pdf.getPage(i).then(function(page) {
            page.getTextContent().then(function(content) {
              textos.push(content.items.map(function(it) { return it.str; }).join(' '));
              lidos++;
              if (lidos === total) callback(null, textos.join('\n'));
            });
          });
        }
      }).catch(function(err) { callback(err, null); });
    };
    reader.onerror = function() { callback(new Error('Erro ao ler o arquivo.'), null); };
    reader.readAsArrayBuffer(file);
  }

  /* Regex helpers */
  function _match(txt, re) {
    var m = txt.match(re);
    return m ? m[1].trim() : '';
  }

  function _limpar(s) {
    return (s || '').replace(/\s+/g, ' ').trim();
  }

  /* Parseia o texto extraído e retorna os campos */
  function parsear(texto) {
    var t = texto.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ');

    var dados = {
      incidentado: {},
      infracao:    {},
    };

    /* ── Nome ── */
    var nome = _match(t, /Nome\s*:\s*([A-ZÀ-Ú][A-ZÀ-Ú\s]{4,60})(?=\s+Situação|Cartão|$)/i);
    if (!nome) nome = _match(t, /Nome\s*:\s*([A-ZÀ-Ú][A-ZÀ-Ú\s]{4,60})/i);
    dados.incidentado.nome = _limpar(nome);

    /* ── Prontuário / IPEN ── */
    var pront = _match(t, /Prontuário\s*:\s*(\d{4,8})/i);
    dados.incidentado.prontuario = pront;

    var ipen = _match(t, /RG\s+i[\s-]?PEN\s*:\s*([\d]+)/i);
    dados.incidentado.ipen = ipen;

    /* ── Nascimento ── */
    var nasc = _match(t, /Nascimento\s*:\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (nasc) dados.incidentado.nascimento = parseDDMM(nasc);

    /* ── Mãe ── */
    var mae = _match(t, /M[aã]e\s*:\s*([A-ZÀ-Ú][A-ZÀ-Ú\s]{4,60})(?=\s+Processo|Nascimento|$)/i);
    dados.incidentado.mae = _limpar(mae);

    /* ── Naturalidade ── */
    var nat = _match(t, /Naturalidade\s*:\s*([A-ZÀ-Ú][A-ZÀ-Ú\s\-]{3,40}(?:SC|RS|SP|RJ|PR|MG|BA|CE|PE|GO|DF|AM|PA|MT|MS|ES|RN|PB|AL|SE|PI|MA|TO|RO|AC|AP|RR))/i);
    dados.incidentado.naturalidade = _limpar(nat);

    /* ── Regime ── */
    var regime = _match(t, /Regime\s*:\s*([A-ZÀ-Ú][a-zà-ú\s]+?)(?=\s*(?:Comportamento|Residência|Ala|$))/i);
    dados.incidentado.regime = _limpar(regime);

    /* ── Cela / Residência ── */
    var cela = _match(t, /Residência\s*:\s*(Ala[^,\n]+(?:Norte|Sul|Leste|Oeste)?[^\.]{0,60})/i);
    if (!cela) cela = _match(t, /Ala\s*:\s*([A-Z])[^\.]{0,60}(?:Dentro|Fora)\s*:\s*(\d+)/i);
    dados.incidentado.cela = _limpar(cela);

    /* ── Comportamento ── */
    var comp = _match(t, /Comportamento\s*:\s*([A-ZÀ-Ú][a-zà-ú]+)/i);
    dados.incidentado.comportamento = _limpar(comp);

    /* ── Processos / Artigos penais ── */
    var proc = _match(t, /Processo\s*\(s\)\s*:\s*(\d+)/i);
    dados.incidentado.processos = proc;
    var arts = _match(t, /Artigo\s*\(s\)\s*:\s*([\d,\s]+)/i);
    dados.incidentado.artigosPenais = _limpar(arts);

    /* ── Data da infração ── */
    var dinf = _match(t, /DATA\s*:\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (dinf) dados.infracao.data = parseDDMM(dinf);

    /* ── Artigo da infração ── */
    var artTxt = _match(t, /UNIDADE\s*\/\s*INFRA[ÇC][ÃA]O\s*:\s*[\d]+\s+(.{10,200}?)(?=\s*GRAU)/i);
    dados.infracao.artigoTexto = _limpar(artTxt);

    // Detecta o código do artigo
    if (/telefônico|celular|chip|smartphone|rádio ou similar/i.test(artTxt || t)) {
      dados.infracao.artigo = 'art50_vii';
    } else if (/subverter|movimento/i.test(artTxt || t)) {
      dados.infracao.artigo = 'art50_i';
    } else if (/fugir|fuga/i.test(artTxt || t)) {
      dados.infracao.artigo = 'art50_ii';
    } else if (/instrumento.*ofender|arma/i.test(artTxt || t)) {
      dados.infracao.artigo = 'art50_iii';
    } else if (/acidente.*trabalho/i.test(artTxt || t)) {
      dados.infracao.artigo = 'art50_iv';
    } else if (/regime aberto/i.test(artTxt || t)) {
      dados.infracao.artigo = 'art50_v';
    } else if (/inobservar|deveres/i.test(artTxt || t)) {
      dados.infracao.artigo = 'art50_vi';
    } else if (/RDD|subvers[ãa]o da ordem/i.test(artTxt || t)) {
      dados.infracao.artigo = 'art52';
    }

    /* ── Grau ── */
    var grau = _match(t, /GRAU\s*:\s*(GRAVE|MÉDIA|LEVE)/i);
    dados.infracao.grau = grau ? grau.toLowerCase() : 'grave';

    /* ── Descrição ── */
    var desc = _match(t, /DESCRI[ÇC][ÃA]O\s*:\s*([\s\S]{20,2000}?)(?=\s*OBSERVA[ÇC][ÃA]O|DETENTOS|AGENTES|$)/i);
    dados.infracao.descricao = _limpar(desc);

    /* ── Agentes envolvidos ── */
    var agTxt = _match(t, /AGENTES\s+ENVOLVIDOS\s*:\s*([\s\S]{5,300}?)(?=\s*VOLUME|FOLHA|$)/i);
    if (agTxt) {
      dados.infracao.agentes = agTxt.split(/[,;]/).map(function(a) { return _limpar(a); }).filter(Boolean);
    }

    /* ── Observação ── */
    var obs = _match(t, /OBSERVA[ÇC][ÃA]O\s*:\s*([\s\S]{0,300}?)(?=\s*DETENTOS|AGENTES|$)/i);
    if (obs && !/N[ÃA]O\s+INFORMAD/i.test(obs)) {
      dados.infracao.observacao = _limpar(obs);
    }

    return dados;
  }

  /* Aplica dados extraídos no Estado */
  function aplicar(dados) {
    if (dados.incidentado) {
      var inc = Object.assign(Estado.get('incidentado'), dados.incidentado);
      Estado.set('incidentado', inc);
    }
    if (dados.infracao) {
      var inf = Object.assign(Estado.get('infracao'), dados.infracao);
      Estado.set('infracao', inf);
    }
  }

  return { extrairTexto: extrairTexto, parsear: parsear, aplicar: aplicar };
})();

/* ── Handler da área de upload ── */
function _initUpload() {
  var zona   = document.getElementById('zona-upload');
  var input  = document.getElementById('inp-pdf');
  var status = document.getElementById('upload-status');
  if (!zona || !input) return;

  zona.addEventListener('dragover',  function(e) { e.preventDefault(); zona.classList.add('drag-over'); });
  zona.addEventListener('dragleave', function()  { zona.classList.remove('drag-over'); });
  zona.addEventListener('drop', function(e) {
    e.preventDefault();
    zona.classList.remove('drag-over');
    var file = e.dataTransfer.files[0];
    if (file) _processarPDF(file);
  });
  zona.addEventListener('click', function() { input.click(); });
  input.addEventListener('change', function() {
    if (input.files[0]) _processarPDF(input.files[0]);
  });
}

function _processarPDF(file) {
  var status = document.getElementById('upload-status');
  if (status) { status.textContent = 'Extraindo dados...'; status.className = 'upload-status info'; }

  PdfParser.extrairTexto(file, function(err, texto) {
    if (err || !texto) {
      if (status) { status.textContent = 'Não foi possível extrair o texto. Preencha manualmente.'; status.className = 'upload-status erro'; }
      return;
    }
    var dados = PdfParser.parsear(texto);
    PdfParser.aplicar(dados);

    var nome = dados.incidentado && dados.incidentado.nome;
    if (status) {
      status.textContent = nome
        ? '✓ Dados extraídos: ' + nome
        : '✓ PDF processado. Verifique os campos.';
      status.className = 'upload-status ok';
    }

    FormularioCtrl.sincronizar();
    _toast('Dados do i-PEN preenchidos automaticamente!');
  });
}
