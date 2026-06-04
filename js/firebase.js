// ================================================
// CRV — Manual Operacional V2
// firebase.js — Autenticação, área restrita e cadastro
// ================================================
import { initializeApp }               from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
         updatePassword, reauthenticateWithCredential, EmailAuthProvider,
         sendPasswordResetEmail, onAuthStateChanged, signOut }
                                        from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, serverTimestamp }
                                        from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyB61jtxRJlDu0LhwXOM9c42MEHQWciJh-I",
  authDomain:        "crv-dpp-sc-v2.firebaseapp.com",
  projectId:         "crv-dpp-sc-v2",
  storageBucket:     "crv-dpp-sc-v2.firebasestorage.app",
  messagingSenderId: "513539683551",
  appId:             "1:513539683551:web:2fdcdd236f0c37853ae56a"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const EMAILS_CRV = [
  'rodrigo.l.pastore@gmail.com',
  'ivana.schafer@gmail.com',
  'brunawlongen@gmail.com',
  'ricardobritomarques12@gmail.com',
  'abeljuliana2012@gmail.com',
  'jessicaveiga9@gmail.com',
  'day.sestren88@gmail.com',
  'sepen@pp.sc.gov.br',
  'leilakfarias@gmail.com'
];
const SENHA_TEMPORARIA = 'CRV@2026temp';
let usuarioAtual = null;

// ══════════════════════════════════════════════
// PERFIL — resolve localmente por padrão de e-mail
// ══════════════════════════════════════════════
function _resolverPerfil(email) {
  const e = (email || '').toLowerCase();
  if (EMAILS_CRV.includes(e))                return { tipo: 'crv',   label: 'CRV',             cor: '#3b82f6' };
  if (/^sr0[1-8]@pp\.sc\.gov\.br$/.test(e)) return { tipo: 'super', label: 'Superintendente', cor: '#7c3aed' };
  if (/^.+dir@pp\.sc\.gov\.br$/.test(e))    return { tipo: 'dir',   label: 'Diretor(a)',      cor: '#15803d' };
  if (/^.+cpen@pp\.sc\.gov\.br$/.test(e))   return { tipo: 'cpen',  label: 'Coord. Penal',   cor: '#b45309' };
  return null; // e-mail particular — verificado no Firestore
}

// ══════════════════════════════════════════════
// TOPBAR — indicador de usuário logado
// ══════════════════════════════════════════════
function _nomeExibicao(email) {
  if (!email) return '';
  const prefix = email.split('@')[0];
  const partes = prefix.split('.');
  if (partes.length > 1) return partes[0].charAt(0).toUpperCase() + partes[0].slice(1).toLowerCase();
  return prefix.toUpperCase();
}

function _mostrarTopbarVisitante() {
  const area = document.getElementById('topbar-user-area');
  if (!area) return;
  area.innerHTML = `<button class="btn-topbar-login" onclick="window._abrirModalLogin()">Entrar</button>`;
  const btnS = document.getElementById('sidebar-btn-senha');
  if (btnS) btnS.style.display = 'none';
  _mostrarSubMenuCRV(false);
}

function _iniciaisPerfil(email) {
  const e = (email || '').toLowerCase();
  // SR: sr01@pp.sc.gov.br → SR01
  const srM = e.match(/^(sr\d+)@pp\.sc\.gov\.br$/);
  if (srM) return srM[1].toUpperCase();
  // DIR: pr01dir@ → PR01 | itapemadir@ → IT
  const dirM = e.match(/^(.+?)dir@pp\.sc\.gov\.br$/);
  if (dirM) {
    const numM = dirM[1].match(/^([a-z]{2,3})(\d+)$/);
    if (numM) return (numM[1] + numM[2]).toUpperCase();
    return dirM[1].substring(0, 2).toUpperCase();
  }
  // CPEN: pr01cpen@ → PE01 | itapemacpen@ → PE
  const cpenM = e.match(/^(.+?)cpen@pp\.sc\.gov\.br$/);
  if (cpenM) {
    const numM = cpenM[1].match(/^[a-z]+(\d+)$/);
    if (numM) return 'PE' + numM[1];
    return 'PE';
  }
  // fallback: 2 primeiros caracteres
  return e.split('@')[0].substring(0, 2).toUpperCase();
}

function _mostrarTopbarUsuario(user, labelOverride) {
  const area = document.getElementById('topbar-user-area');
  if (!area) return;
  const perfil  = _resolverPerfil(user.email || '');
  const label   = labelOverride || perfil?.label || 'Servidor';
  const cor     = perfil?.cor   || '#64748b';
  const nome    = _nomeExibicao(user.email);
  const iniciais = _iniciaisPerfil(user.email || '');
  const btnSenha = document.getElementById('sidebar-btn-senha');
  if (btnSenha) btnSenha.style.display = '';
  /* Submenu CRV apenas para perfil CRV */
  _mostrarSubMenuCRV(perfil?.tipo === 'crv');

  area.innerHTML = `
    <div class="topbar-user-info">
      <div class="topbar-user-avatar" style="background:${cor};">${iniciais}</div>
      <span class="topbar-user-nome">${nome}</span>
      <span class="topbar-user-badge">${label}</span>
      <button onclick="fazerLogout()" style="margin-left:6px;padding:4px 12px;background:rgba(220,38,38,.12);border:1px solid rgba(220,38,38,.3);color:#dc2626;border-radius:6px;font-size:.75rem;font-weight:600;cursor:pointer;font-family:inherit;">Sair</button>
    </div>`;
}


/* ── Modal alterar senha ── */
window._abrirModalSenha = function() {
  const m = document.getElementById('user-menu');
  if (m) m.style.display = 'none';
  ['senha-atual','senha-nova','senha-confirmar'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const err = document.getElementById('senha-erro'); if (err) err.textContent = '';
  const btn = document.getElementById('btn-alterar-senha');
  if (btn) { btn.disabled = false; btn.textContent = 'Salvar nova senha'; }
  const modal = document.getElementById('modal-senha');
  if (modal) { modal.style.display = 'flex'; setTimeout(() => document.getElementById('senha-atual')?.focus(), 80); }
};

window._fecharModalSenha = function() {
  const modal = document.getElementById('modal-senha');
  if (modal) modal.style.display = 'none';
};

window.confirmarAlteracaoSenha = async function() {
  const atual     = (document.getElementById('senha-atual')?.value    || '').trim();
  const nova      = (document.getElementById('senha-nova')?.value     || '').trim();
  const confirmar = (document.getElementById('senha-confirmar')?.value || '').trim();
  const err = document.getElementById('senha-erro');
  const btn = document.getElementById('btn-alterar-senha');
  const _erro = msg => { if (err) err.textContent = msg; };

  if (!atual)          return _erro('Informe a senha atual.');
  if (nova.length < 8) return _erro('A nova senha deve ter pelo menos 8 caracteres.');
  if (nova !== confirmar) return _erro('As senhas não coincidem.');
  if (!usuarioAtual)   return _erro('Sessão expirada. Faça login novamente.');

  if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }
  try {
    const cred = EmailAuthProvider.credential(usuarioAtual.email, atual);
    await reauthenticateWithCredential(usuarioAtual, cred);
    await updatePassword(usuarioAtual, nova);
    _fecharModalSenha();
    showToast('✅ Senha alterada com sucesso!');
  } catch(e) {
    const msgs = {
      'auth/wrong-password':      'Senha atual incorreta.',
      'auth/invalid-credential':  'Senha atual incorreta.',
      'auth/too-many-requests':   'Muitas tentativas. Aguarde alguns minutos.',
      'auth/weak-password':       'Nova senha muito fraca. Use pelo menos 8 caracteres.',
    };
    _erro(msgs[e.code] || 'Erro: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar nova senha'; }
  }
};

window._abrirModalLogin = function () {
  _abrirModal('modal-login');
  setTimeout(() => document.getElementById('login-email')?.focus(), 80);
};

// ══════════════════════════════════════════════
// AUTH STATE — abre modal se sem sessão
// ══════════════════════════════════════════════
onAuthStateChanged(auth, (user) => {
  usuarioAtual = user || null;
  window._usuarioAtual = usuarioAtual;

  if (user) {
    _mostrarTopbarUsuario(user);
    const info = document.getElementById('restrito-usuario-info');
    if (info) info.textContent = 'Conectado como: ' + (user.email || '');
  } else {
    _mostrarTopbarVisitante();
    setTimeout(() => {
      if (!auth.currentUser) _abrirModal('modal-login');
    }, 800);
  }
});

// ══════════════════════════════════════════════
// ÁREA RESTRITA
// ══════════════════════════════════════════════
window.abrirAreaRestrita = function () {
  if (usuarioAtual) {
    const p = _resolverPerfil(usuarioAtual.email);
    if (p?.tipo === 'crv') {
      _mostrarConteudoRestrito(usuarioAtual);
    } else {
      // Perfis não-CRV estão autenticados mas não acessam ferramentas internas
      window.showToast && showToast('⛔ ACESSO NÃO PERMITIDO.');
    }
  } else {
    _abrirModal('modal-login');
    setTimeout(() => document.getElementById('login-email')?.focus(), 80);
  }
};

// ══════════════════════════════════════════════
// MODAL LOGIN — controle de telas
// ══════════════════════════════════════════════
function _mostrarTela(id) {
  ['tela-login','tela-trocar-senha','tela-cadastro','tela-aguardando','tela-recusado']
    .forEach(t => {
      const el = document.getElementById(t);
      if (el) el.style.display = (t === id) ? 'block' : 'none';
    });
}

window.fecharModalLogin = function () {
  _fecharModal('modal-login');
  _mostrarTela('tela-login');
  document.getElementById('login-erro').style.display  = 'none';
  document.getElementById('login-email').value         = '';
  document.getElementById('login-senha').value         = '';
};

// ══════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════
window.fazerLogin = async function () {
  const email  = document.getElementById('login-email').value.trim().toLowerCase();
  const senha  = document.getElementById('login-senha').value;
  const erroEl = document.getElementById('login-erro');
  const btn    = document.getElementById('btn-entrar');
  erroEl.style.display = 'none';

  if (!email || !senha) {
    erroEl.textContent = 'Preencha o e-mail e a senha.';
    erroEl.style.display = 'block'; return;
  }

  btn.textContent = 'Entrando…'; btn.disabled = true;

  try {
    const perfil = _resolverPerfil(email);

    if (perfil) {
      // ── E-mail institucional ou CRV ──
      const cred = await signInWithEmailAndPassword(auth, email, senha);
      usuarioAtual = cred.user;

      if (perfil.tipo === 'crv') {
        let primeiroAcesso = false;
        try {
          const snap = await getDoc(doc(db, 'usuarios', cred.user.uid));
          if (!snap.exists() || snap.data().senhaConfigurada !== true) primeiroAcesso = true;
        } catch (_) { if (senha === SENHA_TEMPORARIA) primeiroAcesso = true; }
        if (primeiroAcesso) {
          _mostrarTela('tela-trocar-senha'); return;
        }
        _fecharModal('modal-login');
        _mostrarTopbarUsuario(cred.user);
        await _entrarNaAreaRestrita(cred.user);
      } else {
        // SR, DIR, CPEN — autenticados mas sem acesso às ferramentas internas CRV
        /* Grava unidade de origem no localStorage para o Gerador de Ofícios V2 */
        if (perfil.tipo === 'dir' || perfil.tipo === 'cpen') {
          const emailBase = email
            .replace(/dir@pp\.sc\.gov\.br$/, '@pp.sc.gov.br')
            .replace(/cpen@pp\.sc\.gov\.br$/, '@pp.sc.gov.br');
          localStorage.setItem('crv_ori_email', emailBase);
        }
        _fecharModal('modal-login');
        _mostrarTopbarUsuario(cred.user);
        window.showToast && showToast('Login realizado. Acesse o Painel da Unidade.');
      }

    } else {
      // ── E-mail particular — verifica cadastro no Firestore ──
      const cred = await signInWithEmailAndPassword(auth, email, senha);
      const snap = await getDoc(doc(db, 'usuarios_cadastrados', cred.user.uid));

      if (!snap.exists()) {
        await signOut(auth);
        erroEl.textContent = 'Cadastro não encontrado. Por favor, cadastre-se.';
        erroEl.style.display = 'block'; return;
      }

      const dados = snap.data();

      if (dados.status === 'pendente') {
        await signOut(auth);
        _mostrarTela('tela-aguardando');
        return;
      }

      if (dados.status === 'recusado') {
        await signOut(auth);
        const motivoEl = document.getElementById('recusado-motivo');
        if (motivoEl) motivoEl.textContent = dados.motivoRecusa ? 'Motivo: ' + dados.motivoRecusa : '';
        _mostrarTela('tela-recusado');
        return;
      }

      if (dados.status === 'revogado') {
        await signOut(auth);
        erroEl.textContent = 'Seu acesso foi revogado. Entre em contato com o CPEN da sua unidade.';
        erroEl.style.display = 'block';
        return;
      }

      if (dados.status === 'aprovado') {
        usuarioAtual = cred.user;
        localStorage.setItem('crv_ori_email', dados.emailUnidade || '');
        _fecharModal('modal-login');
        _mostrarTopbarUsuario(cred.user, 'Servidor');
        window.showToast && showToast('Login realizado. Acesse o Painel da Unidade.');
        return;
      }

      await signOut(auth);
      erroEl.textContent = 'Status de acesso desconhecido. Contate o administrador.';
      erroEl.style.display = 'block';
    }

  } catch (e) {
    let msg = 'Erro ao autenticar. Tente novamente.';
    if (['auth/invalid-credential','auth/wrong-password','auth/user-not-found'].includes(e.code))
      msg = 'E-mail ou senha incorretos.';
    else if (e.code === 'auth/too-many-requests')
      msg = 'Muitas tentativas. Aguarde alguns minutos.';
    else if (e.code === 'auth/network-request-failed')
      msg = 'Sem conexão. Verifique sua internet.';
    erroEl.textContent = msg; erroEl.style.display = 'block';
  } finally {
    btn.textContent = 'Entrar'; btn.disabled = false;
  }
};

// ══════════════════════════════════════════════
// CADASTRO DE SERVIDOR
// ══════════════════════════════════════════════
window.abrirCadastro = function () {
  _mostrarTela('tela-cadastro');
  document.getElementById('cad-erro').style.display = 'none';
  _construirSelectUnidades();
  setTimeout(() => document.getElementById('cad-nome')?.focus(), 80);
};

window.voltarParaLogin = function () {
  _mostrarTela('tela-login');
  document.getElementById('login-erro').style.display = 'none';
};

function _construirSelectUnidades() {
  const sel = document.getElementById('cad-unidade');
  if (!sel) return;
  const unidades = window.UNIDADES || [];
  if (!unidades.length) {
    setTimeout(_construirSelectUnidades, 800);
    return;
  }
  sel.innerHTML = '<option value="">Selecione a unidade...</option>';
  const srs = [...new Set(unidades.map(u => u.sr))].sort();
  srs.forEach(srCod => {
    const info = window.SR_INFO?.[srCod] || {};
    const grp  = document.createElement('optgroup');
    grp.label  = srCod + ' — ' + (info.nome || srCod);
    unidades.filter(u => u.sr === srCod).forEach(u => {
      const o = document.createElement('option');
      o.value = u.email;
      o.textContent = u.nome;
      grp.appendChild(o);
    });
    sel.appendChild(grp);
  });
}

window._mascaraCPF = function (input) {
  let v = input.value.replace(/\D/g, '');
  v = v.replace(/(\d{3})(\d)/, '$1.$2');
  v = v.replace(/(\d{3})(\d)/, '$1.$2');
  v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  input.value = v;
};

function _validarCPF(cpf) {
  const c = cpf.replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let soma = 0, r;
  for (let i = 0; i < 9; i++) soma += parseInt(c[i]) * (10 - i);
  r = (soma * 10) % 11; if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(c[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(c[i]) * (11 - i);
  r = (soma * 10) % 11; if (r === 10 || r === 11) r = 0;
  return r === parseInt(c[10]);
}

window.fazerCadastro = async function () {
  const nome         = document.getElementById('cad-nome').value.trim();
  const email        = document.getElementById('cad-email').value.trim().toLowerCase();
  const cpf          = document.getElementById('cad-cpf').value;
  const dataNasc     = document.getElementById('cad-data-nasc').value;
  const emailUnidade = document.getElementById('cad-unidade').value;
  const senha        = document.getElementById('cad-senha').value;
  const confirmar    = document.getElementById('cad-confirmar').value;
  const erroEl       = document.getElementById('cad-erro');
  const btn          = document.getElementById('btn-cadastrar');

  erroEl.style.display = 'none';

  if (!nome || nome.length < 3) {
    erroEl.textContent = 'Informe o nome completo.'; erroEl.style.display = 'block'; return;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    erroEl.textContent = 'Informe um e-mail válido.'; erroEl.style.display = 'block'; return;
  }
  if (_resolverPerfil(email)) {
    erroEl.textContent = 'Este é um e-mail institucional. Use o login normal acima.';
    erroEl.style.display = 'block'; return;
  }
  if (!_validarCPF(cpf)) {
    erroEl.textContent = 'CPF inválido.'; erroEl.style.display = 'block'; return;
  }
  if (!dataNasc) {
    erroEl.textContent = 'Informe a data de nascimento.'; erroEl.style.display = 'block'; return;
  }
  if (!emailUnidade) {
    erroEl.textContent = 'Selecione a unidade prisional.'; erroEl.style.display = 'block'; return;
  }
  if (senha.length < 8) {
    erroEl.textContent = 'A senha deve ter pelo menos 8 caracteres.'; erroEl.style.display = 'block'; return;
  }
  if (senha !== confirmar) {
    erroEl.textContent = 'As senhas não coincidem.'; erroEl.style.display = 'block'; return;
  }

  const unidade = window.UNIDADES?.find(u => u.email === emailUnidade);
  if (!unidade) {
    erroEl.textContent = 'Unidade não encontrada. Recarregue a página.'; erroEl.style.display = 'block'; return;
  }

  btn.textContent = 'Enviando…'; btn.disabled = true;

  try {
    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, email, senha);
    } catch (authErr) {
      if (authErr.code === 'auth/email-already-in-use') {
        // E-mail já existe — pode ser re-cadastro após revogação ou recusa
        // Tenta login com a nova senha para verificar o status atual
        try {
          const relogin = await signInWithEmailAndPassword(auth, email, senha);
          const snap = await getDoc(doc(db, 'usuarios_cadastrados', relogin.user.uid));
          if (snap.exists() && ['recusado','revogado'].includes(snap.data().status)) {
            // Permite re-cadastro atualizando o registro existente para pendente
            await setDoc(doc(db, 'usuarios_cadastrados', relogin.user.uid), {
              nome, cpf: cpf.replace(/\D/g,''), dataNascimento: dataNasc,
              emailUnidade, nomeUnidade: unidade.nome, srUnidade: unidade.sr,
              status: 'pendente', aprovadoPor: null, aprovadoEm: null, motivoRecusa: null,
              atualizadoEm: serverTimestamp(),
            }, { merge: true });
            await signOut(auth);
            _mostrarTela('tela-aguardando');
            return;
          }
          await signOut(auth);
        } catch (_) {}
        erroEl.textContent = 'Este e-mail já possui cadastro. Faça login normalmente.';
        erroEl.style.display = 'block';
        btn.textContent = 'Solicitar acesso'; btn.disabled = false;
        return;
      }
      throw authErr;
    }

    await setDoc(doc(db, 'usuarios_cadastrados', cred.user.uid), {
      uid:           cred.user.uid,
      email,
      nome,
      cpf:           cpf.replace(/\D/g, ''),
      dataNascimento: dataNasc,
      emailUnidade,
      nomeUnidade:   unidade.nome,
      srUnidade:     unidade.sr,
      status:        'pendente',
      perfil:        'servidor',
      criadoEm:      serverTimestamp(),
      aprovadoPor:   null,
      aprovadoEm:    null,
      motivoRecusa:  null,
    });

    // Desloga imediatamente — acesso liberado apenas após aprovação do CPEN
    await signOut(auth);

    _mostrarTela('tela-aguardando');

  } catch (e) {
    let msg = 'Erro ao cadastrar. Tente novamente.';
    if (e.code === 'auth/email-already-in-use') msg = 'Este e-mail já possui cadastro. Tente fazer login.';
    else if (e.code === 'auth/invalid-email')   msg = 'E-mail inválido.';
    else if (e.code === 'auth/weak-password')   msg = 'Senha muito fraca. Use pelo menos 8 caracteres.';
    erroEl.textContent = msg; erroEl.style.display = 'block';
  } finally {
    btn.textContent = 'Solicitar acesso'; btn.disabled = false;
  }
};

// ══════════════════════════════════════════════
// TROCAR SENHA (primeiro acesso CRV)
// ══════════════════════════════════════════════
window.trocarSenha = async function () {
  const nova   = document.getElementById('nova-senha').value;
  const conf   = document.getElementById('confirmar-senha').value;
  const erroEl = document.getElementById('trocar-erro');
  erroEl.style.display = 'none';
  if (nova.length < 8)            { erroEl.textContent = 'Mínimo 8 caracteres.'; erroEl.style.display = 'block'; return; }
  if (nova !== conf)              { erroEl.textContent = 'As senhas não coincidem.'; erroEl.style.display = 'block'; return; }
  if (nova === SENHA_TEMPORARIA)  { erroEl.textContent = 'Escolha uma senha diferente da temporária.'; erroEl.style.display = 'block'; return; }
  try {
    await updatePassword(usuarioAtual, nova);
    try { await setDoc(doc(db, 'usuarios', usuarioAtual.uid), { senhaConfigurada: true, email: usuarioAtual.email }, { merge: true }); } catch (_) {}
    _mostrarTopbarUsuario(usuarioAtual);
    _mostrarTela('tela-login');
    _fecharModal('modal-login');
    await _entrarNaAreaRestrita(usuarioAtual);
    window.showToast && showToast('Senha criada com sucesso! Bem-vindo(a)!');
  } catch (_) {
    erroEl.textContent = 'Erro ao salvar senha. Tente novamente.'; erroEl.style.display = 'block';
  }
};

// ══════════════════════════════════════════════
// LOGOUT
// ══════════════════════════════════════════════
window.fazerLogout = async function () {
  await signOut(auth);
  localStorage.removeItem('crv_ori_email');
  usuarioAtual = null; window._usuarioAtual = null;
  _mostrarTopbarVisitante();
  window.navegarPara && navegarPara('inicio');
};

window.toggleSenhaVis = function (id) {
  const el = document.getElementById(id);
  if (el) el.type = el.type === 'password' ? 'text' : 'password';
};

window.fecharNovidades = function () {
  const m = document.getElementById('modal-novidades');
  if (m) m.classList.remove('aberto');
};

// ══════════════════════════════════════════════
// FERRAMENTAS — iframes
// ══════════════════════════════════════════════
window.abrirCaixinha = function () {
  const m = document.getElementById('modal-caixinha');
  const f = document.getElementById('caixinha-iframe');
  if (f && !f.src.includes('caixinha')) f.src = 'caixinha-controle.html';
  if (m) m.classList.add('aberto');
};
window.fecharCaixinha = function () { document.getElementById('modal-caixinha')?.classList.remove('aberto'); };

window.abrirUSMControle = function () {
  const m = document.getElementById('modal-usm');
  const f = document.getElementById('usm-iframe');
  if (f && !f.src.includes('USM')) f.src = 'USM_controle.html';
  if (m) m.classList.add('aberto');
};
window.fecharUSMControle = function () { document.getElementById('modal-usm')?.classList.remove('aberto'); };

window.abrirCalculadora = function () {
  const m = document.getElementById('modal-calculadora');
  const f = document.getElementById('calc-iframe');
  if (f && !f.src.includes('calculadora')) f.src = 'calculadora-prisional.html';
  if (m) m.classList.add('aberto');
};
window.fecharCalculadora = function () { document.getElementById('modal-calculadora')?.classList.remove('aberto'); };

window.abrirViagens = function () {
  const m = document.getElementById('modal-viagens');
  const f = document.getElementById('viagens-iframe');
  if (f && !f.src.includes('controle-viagens')) f.src = 'controle-viagens.html';
  if (m) m.classList.add('aberto');
};
window.fecharViagens = function () { document.getElementById('modal-viagens')?.classList.remove('aberto'); };

window.abrirGeradorOficios = function () {
  const f = document.getElementById('gerador-iframe');
  if (f && !f.src.includes('gerador-oficios')) f.src = 'gerador-oficios-v2/index.html';
  document.getElementById('modal-gerador')?.classList.add('aberto');
};
window.fecharGeradorOficios = function () { document.getElementById('modal-gerador')?.classList.remove('aberto'); };

window.abrirGuiaOficios = function () {
  const f = document.getElementById('guia-iframe');
  if (f && !f.src.includes('guia')) f.src = 'guia_crv_dpp.html';
  document.getElementById('modal-guia')?.classList.add('aberto');
};
window.fecharGuiaOficios = function () { document.getElementById('modal-guia')?.classList.remove('aberto'); };

window.abrirPainelUnidade = function () {
  const f = document.getElementById('painel-iframe');
  if (f && !f.src.includes('painel')) f.src = 'painel.html';
  document.getElementById('modal-painel')?.classList.add('aberto');
};
window.fecharPainelUnidade = function () { document.getElementById('modal-painel')?.classList.remove('aberto'); };

// ══════════════════════════════════════════════
// EDITOR DE UNIDADES (admin)
// ══════════════════════════════════════════════
const EMAILS_ADMIN_UNIDADES = ['rodrigo.l.pastore@gmail.com'];

window.abrirEditorUnidades = async function () {
  if (!usuarioAtual || !EMAILS_ADMIN_UNIDADES.includes(usuarioAtual.email)) {
    showToast('Acesso restrito ao administrador do sistema.'); return;
  }
  _abrirModal('modal-editor-unidades');
  const lista = document.getElementById('editor-unidades-lista');
  if (!lista) return;
  lista.innerHTML = '<p style="color:var(--txt-3);font-size:.85rem;padding:12px;">Carregando…</p>';
  const unidades = window.UNIDADES || [];
  if (!unidades.length) {
    lista.innerHTML = '<p style="color:#b91c1c;padding:12px;">Nenhuma unidade carregada. Recarregue a página.</p>'; return;
  }
  const srLabels = {
    SR01:'SR01 — Grande Florianópolis', SR02:'SR02 — Sul',
    SR03:'SR03 — Norte Catarinense',    SR04:'SR04 — Vale do Itajaí',
    SR05:'SR05 — Serrana',              SR06:'SR06 — Oeste',
    SR07:'SR07 — Médio Vale do Itajaí', SR08:'SR08 — Planalto Norte',
  };

  /* Agrupa por SR mantendo o índice global para salvarEdicaoUnidades */
  const grupos = {};
  unidades.forEach((u, idx) => {
    if (!grupos[u.sr]) grupos[u.sr] = [];
    grupos[u.sr].push({ u, idx });
  });

  const inputStyle = 'width:100%;padding:5px 8px;border:1.5px solid #d1d5db;border-radius:6px;font-size:.82rem;font-family:inherit;';
  const labelStyle = 'font-size:.7rem;font-weight:600;color:#6b7280;display:block;margin-bottom:2px;';

  lista.innerHTML = Object.keys(srLabels).filter(sr => grupos[sr]).map(sr => {
    const items = grupos[sr];
    return `
    <details style="margin-bottom:10px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <summary style="cursor:pointer;padding:10px 14px;background:#f1f5f9;font-weight:700;font-size:.83rem;color:#1a2a4a;list-style:none;display:flex;justify-content:space-between;align-items:center;">
        <span>🏛️ ${srLabels[sr]}</span>
        <span style="font-size:.72rem;font-weight:400;color:#6b7280;">${items.length} unidade(s)</span>
      </summary>
      <div style="padding:10px 12px;display:flex;flex-direction:column;gap:8px;">
        ${items.map(({ u, idx }) => `
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px 12px;">
          <div style="font-weight:600;color:#1a2a4a;font-size:.82rem;margin-bottom:8px;">${u.nome}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div><label style="${labelStyle}">Diretor(a)</label>
              <input data-idx="${idx}" data-campo="diretor" value="${u.diretor||''}" style="${inputStyle}" /></div>
            <div><label style="${labelStyle}">E-mail</label>
              <input data-idx="${idx}" data-campo="email" value="${u.email||''}" style="${inputStyle}" /></div>
            <div><label style="${labelStyle}">Telefone</label>
              <input data-idx="${idx}" data-campo="tel" value="${u.tel||''}" style="${inputStyle}" /></div>
            <div><label style="${labelStyle}">Cidade</label>
              <input data-idx="${idx}" data-campo="cidade" value="${u.cidade||''}" style="${inputStyle}" /></div>
            <div style="grid-column:1/-1;"><label style="${labelStyle}">Endereço</label>
              <input data-idx="${idx}" data-campo="end" value="${u.end||''}" style="${inputStyle}" /></div>
          </div>
        </div>`).join('')}
      </div>
    </details>`;
  }).join('');
};

window.salvarEdicaoUnidades = function () {
  document.querySelectorAll('#editor-unidades-lista input').forEach(input => {
    const idx = parseInt(input.dataset.idx), campo = input.dataset.campo;
    if (window.UNIDADES?.[idx]) window.UNIDADES[idx][campo] = input.value;
  });
  if (typeof renderizarUnidades === 'function') renderizarUnidades();
  _downloadJSON({ sr: window.SR_INFO, unidades: window.UNIDADES }, 'unidades.json');
  showToast('Atualizado! Faça upload do unidades.json no repositório.');
  _fecharModal('modal-editor-unidades');
};

window.fecharEditorUnidades = function () { _fecharModal('modal-editor-unidades'); };

function _downloadJSON(obj, nome) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = nome; a.click();
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════
// HELPERS INTERNOS
// ══════════════════════════════════════════════
async function _entrarNaAreaRestrita(user) {
  const agoraISO = new Date().toISOString();
  let ultimoAcesso = null;
  try {
    const ref  = doc(db, 'usuarios', user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) ultimoAcesso = snap.data().ultimoAcesso || null;
    await setDoc(ref, { ultimoAcesso: agoraISO, email: user.email }, { merge: true });
  } catch (_) {}
  if (ultimoAcesso) {
    try {
      const novSnap = await getDocs(collection(db, 'novidades'));
      const novas = [];
      novSnap.forEach(d => { const n = d.data(); if (n.data && n.data > ultimoAcesso) novas.push(n); });
      if (novas.length > 0) {
        novas.sort((a, b) => b.data.localeCompare(a.data));
        const el = document.getElementById('novidades-conteudo');
        if (el) el.innerHTML = novas.map(n =>
          `<div style="margin-bottom:.8rem;padding-bottom:.8rem;border-bottom:1px solid #e5e7eb;">
            <div style="font-weight:600;color:#1a2a4a;">${n.titulo||''}</div>
            <div style="color:#4b5563;font-size:.84rem;margin-top:.2rem;">${n.descricao||''}</div>
          </div>`).join('');
        document.getElementById('modal-novidades')?.classList.add('aberto');
      }
    } catch (_) {}
  }
  _mostrarConteudoRestrito(user);
}

function _mostrarConteudoRestrito(user) {
  const placeholder = document.getElementById('restrito-placeholder');
  if (placeholder && placeholder.children.length === 0) placeholder.innerHTML = _htmlConteudoRestrito();
  window.navegarPara && navegarPara('restrito');
  const info = document.getElementById('restrito-usuario-info');
  if (info) info.textContent = 'Conectado como: ' + (user.email || '');
}

function _abrirModal(id)  { document.getElementById(id)?.classList.add('aberto'); }
function _fecharModal(id) { document.getElementById(id)?.classList.remove('aberto'); }

function _htmlConteudoRestrito() {
  return `
  <div class="restrito-grid">
    <div class="restrito-card" onclick="document.getElementById('modal-grupo-crv').classList.add('aberto')"
      style="background:linear-gradient(135deg,#0d2b55,#1a2a4a);border:2px solid #3b82f6;">
      <span class="restrito-card-badge" style="background:#3b82f6;color:#fff;">SETOR</span>
      <div class="restrito-card-icon">📁</div>
      <div class="restrito-card-titulo">CRV</div>
      <div class="restrito-card-sub" style="color:#93c5fd;">Ferramentas internas do setor</div>
    </div>
    <div class="restrito-card" onclick="document.getElementById('modal-grupo-jud').classList.add('aberto')"
      style="background:linear-gradient(135deg,#312e81,#4338ca);border:2px solid #818cf8;">
      <span class="restrito-card-badge" style="background:#818cf8;color:#fff;">JUDICIÁRIO</span>
      <div class="restrito-card-icon">⚖️</div>
      <div class="restrito-card-titulo">Sistemas — Judiciário</div>
      <div class="restrito-card-sub" style="color:#c7d2fe;">SEEU · EPROC 1º · EPROC 2º</div>
    </div>
    <div class="restrito-card" onclick="document.getElementById('modal-grupo-estado').classList.add('aberto')"
      style="background:linear-gradient(135deg,#064e3b,#0f6e56);border:2px solid #34d399;">
      <span class="restrito-card-badge" style="background:#34d399;color:#064e3b;">ESTADO</span>
      <div class="restrito-card-icon">🏛️</div>
      <div class="restrito-card-titulo">Sistemas — Estado</div>
      <div class="restrito-card-sub" style="color:#6ee7b7;">SIGRHPORTAL · iPEN · SGPe</div>
    </div>
    <div class="restrito-card" onclick="abrirUSMControle()"
      style="background:#0d1117;border:2px solid #3b82f6;">
      <span class="restrito-card-badge" style="background:#3b82f6;color:#fff;">TEMPO REAL</span>
      <div class="restrito-card-icon">🔐</div>
      <div class="restrito-card-titulo" style="color:#3b82f6;">USM — Controle</div>
      <div class="restrito-card-sub" style="color:#6b7280;">Controle de presos — Seg. Máxima</div>
    </div>
  </div>
  <div style="margin-top:8px;margin-bottom:20px;">
    <button onclick="fazerLogout()" style="height:38px;padding:0 18px;background:#fff;border:1.5px solid #dc2626;color:#dc2626;border-radius:8px;font-size:.82rem;font-weight:600;cursor:pointer;">Sair</button>
  </div>`;
}

/* ── Abre ferramenta interna no centro da página ── */
window._abrirFerramenta = function(url, titulo) {
  /* Fecha todos os modais de grupo */
  ['modal-grupo-crv','modal-grupo-jud','modal-grupo-estado'].forEach(function(id) {
    document.getElementById(id)?.classList.remove('aberto');
  });
  const iframe = document.getElementById('crv-tool-iframe');
  const tituloEl = document.getElementById('crv-tool-titulo');
  if (iframe) {
    iframe.src = ''; /* reset para recarregar mesmo URL */
    setTimeout(function() { iframe.src = url; }, 30);
  }
  if (tituloEl) tituloEl.textContent = titulo || '';
  window.navegarPara && navegarPara('crv-tool');
};

/* ── Toggle dos grupos do submenu lateral ── */
window._sidebarToggle = function(subId, btn) {
  const sub = document.getElementById(subId);
  if (!sub) return;
  const open = sub.classList.contains('open');
  sub.classList.toggle('open', !open);
  const arrow = btn ? btn.querySelector('.nav-sub-arrow') : null;
  if (arrow) arrow.textContent = open ? '▶' : '▼';
};

/* ── Mostra/oculta submenu CRV no sidebar ── */
function _mostrarSubMenuCRV(show) {
  const sub = document.getElementById('sidebar-crv-sub');
  if (sub) sub.style.display = show ? 'block' : 'none';
}

/* ── Reset de senhas (apenas rodrigo.l.pastore@gmail.com) ── */
window._abrirResetSenhas = async function() {
  if (!usuarioAtual || usuarioAtual.email !== 'rodrigo.l.pastore@gmail.com') {
    showToast && showToast('Acesso restrito ao administrador.'); return;
  }
  const pl = document.getElementById('restrito-placeholder');
  if (!pl) return;
  pl.innerHTML = _btnVoltar() + `
    <div style="max-width:560px;padding:20px 0;">
      <h3 style="margin-bottom:8px;color:var(--texto);">🔑 Redefinir Senhas</h3>
      <p style="font-size:.85rem;color:var(--txt-3);margin-bottom:16px;line-height:1.6;">
        Esta ação marca todos os usuários como <strong>"primeiro acesso"</strong>.<br>
        Você deve redefinir as senhas para <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">12345sejuri</code> manualmente no
        <a href="https://console.firebase.google.com" target="_blank">Firebase Console</a> antes de acionar esta função.
      </p>
      <div id="reset-resultado" style="margin-bottom:12px;font-size:.83rem;"></div>
      <button id="btn-reset-exec" onclick="_executarResetSenhas()"
        style="padding:10px 24px;background:#dc2626;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:.88rem;font-family:inherit;">
        ⚠ Marcar todos como primeiro acesso
      </button>
    </div>`;
};

window._executarResetSenhas = async function() {
  const btn = document.getElementById('btn-reset-exec');
  const res = document.getElementById('reset-resultado');
  if (btn) { btn.disabled = true; btn.textContent = 'Processando…'; }
  if (res) res.textContent = '';
  try {
    const { getDocs: _gd, collection: _c, writeBatch, doc: _d }
      = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
    const db2 = getFirestore();
    /* Reseta coleção 'usuarios' (CRV) */
    const snapU = await getDocs(collection(db2, 'usuarios'));
    const batch = writeBatch(db2);
    let count = 0;
    snapU.forEach(d => { batch.update(d.ref, { senhaConfigurada: false }); count++; });
    /* Reseta coleção 'usuarios_cadastrados' (unidades) */
    const snapC = await getDocs(collection(db2, 'usuarios_cadastrados'));
    snapC.forEach(d => { if (d.data().status === 'aprovado') { batch.update(d.ref, { senhaConfigurada: false }); count++; } });
    await batch.commit();
    if (res) res.innerHTML = `<span style="color:#15803d;">✅ ${count} usuário(s) marcados para primeiro acesso.</span><br><span style="font-size:.78rem;color:var(--txt-3);">Redefina as senhas para <strong>12345sejuri</strong> no Firebase Console e comunique os usuários.</span>`;
    if (btn) { btn.disabled = false; btn.textContent = '⚠ Marcar todos como primeiro acesso'; }
  } catch(e) {
    if (res) res.innerHTML = `<span style="color:#dc2626;">Erro: ${e.message}</span>`;
    if (btn) { btn.disabled = false; btn.textContent = '⚠ Marcar todos como primeiro acesso'; }
  }
};
