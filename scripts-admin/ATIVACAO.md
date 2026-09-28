# Ativação — Segurança (Etapa 0) e logins dos Superintendentes

Siga **nesta ordem**. As tarefas rodam em **GitHub → Actions → "Admin CRV" → Run workflow**.
Sempre rode primeiro **sem** marcar "executar" (simulação), leia o resultado e só então rode marcando.

## Antes de começar

- [ ] **Caixas de e-mail `sr01sr@` … `sr08sr@pp.sc.gov.br`** criadas pela TI (o link para definir a senha chega nelas).
- [ ] **Secret `FIREBASE_SERVICE_ACCOUNT_ANTIGO`** (só para a migração do projeto antigo): Console do Firebase do projeto **crv-dpp-sc** → Configurações → Contas de serviço → Gerar nova chave privada → copiar o conteúdo do arquivo JSON → GitHub → Settings → Secrets and variables → Actions → New repository secret. Depois apague o arquivo baixado.
  (O secret `FIREBASE_SERVICE_ACCOUNT` do projeto v2 já existe — é o do bot de notificações.)

## Passo 1 — Publicar o site (código + workflow)

Envie tudo ao GitHub. Isso publica o site **e** faz aparecer o workflow "Admin CRV".
A partir daqui o perfil de Superintendente é `sr0Xsr@`: as contas antigas `sr0X@` deixam de ter acesso ao Painel.
**Combine com os Superintendentes** — até o Passo 3 eles ficam sem login para assinar.
(As regras antigas do Firestore continuam valendo até o Passo 5, então nada mais quebra.)

## Passo 2 — Confirmar as contas institucionais

Tarefa **`contas-institucionais`**.
- Leia a lista **⚠ CONTAS SUSPEITAS**: e-mails no padrão `...dir@`/`...cpen@` que não correspondem a nenhuma unidade. Se não reconhecer, exclua no Console (Authentication).
- Rode de novo marcando **executar**.

## Passo 3 — Criar os logins dos Superintendentes

Tarefa **`criar-logins-superintendentes`** (simulação, depois executar).
Cada Superintendente: abrir o site → **Entrar** → digitar `sr0Xsr@pp.sc.gov.br` → **"Esqueci minha senha / definir senha"** → seguir o link recebido.

## Passo 4 — Migrações de dados

1. Tarefa **`migrar-assinaturas-sr`**: passa as assinaturas **pendentes** de `sr0X@` para `sr0Xsr@`.
2. Tarefa **`migrar-projeto-antigo`**: copia Caixinha, Viagens e servidores das Diárias do projeto antigo.

**Aguarde 1 hora antes do Passo 5.** O login guarda um "crachá" que vale 1 hora e é renovado sozinho. Quem já estava conectado durante o Passo 2 ainda tem o crachá antigo, sem a confirmação de e-mail; se as regras novas entrarem antes da renovação, essa pessoa é barrada. Se não quiser esperar, basta a pessoa barrada clicar em **Sair** e **Entrar** de novo. Só afeta Diretor, CPEN e SR que estiverem logados; CRV e servidores não são afetados.

Console do Firebase (**crv-dpp-sc-v2**) → Firestore Database → **Regras** → substituir tudo pelo conteúdo de [`../firestore.rules`](../firestore.rules) → **Publicar**.
(Guarde antes uma cópia das regras antigas, para voltar se algo der errado.)

### Testes no Simulador de regras (botão "Simulador" na mesma tela)

Marque **Autenticado** e preencha o e-mail (e `email_verified` quando indicado no provedor "password").

| # | Operação | Caminho | Usuário | Esperado |
|---|---|---|---|---|
| 1 | get | `unidades_config/principal` | não autenticado | ✅ permitido |
| 2 | get | `usuarios_cadastrados/<uid de um servidor>` | conta qualquer sem cadastro | ❌ negado |
| 3 | get | `caixinha_lancamentos/x` | `pr01dir@pp.sc.gov.br` | ❌ negado |
| 4 | get | `caixinha_lancamentos/x` | `rodrigo.l.pastore@gmail.com` | ✅ permitido |
| 5 | get | `solicitacoes/<id>` | `pr01dir@…` **sem** email_verified | ❌ negado |
| 6 | get | `solicitacoes/<id>` | `pr01dir@…` **com** email_verified | ✅ permitido |
| 7 | delete | `solicitacoes/<id>` | `pr01dir@…` confirmado | ❌ negado |
| 8 | get | `beneficios_respostas/<slug>` | `pr01dir@…` confirmado | ❌ negado |
| 9 | update `status: 'aprovado'` | `usuarios_cadastrados/<seu uid>` | o próprio servidor pendente | ❌ negado |
| 10 | get | `diarias_servidores/x` | `sr01sr@…` confirmado | ❌ negado |

### Depois de publicar, confira no site

- Diretor/CPEN: Painel abre, lista de assinaturas, aprovar um servidor.
- Superintendente (`sr0Xsr@`): Painel da regional, assinar.
- Servidor aprovado: login e Gerador de Ofícios.
- CRV: Caixinha, Viagens, Diárias, Escala, Benefícios, editor de unidades.
- Mensagens e recados (inclusive marcar recado como lido).

Se algo for negado indevidamente: abra o console do navegador (F12) — o erro `permission-denied` indica qual coleção — e volte temporariamente às regras antigas.
