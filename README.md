# Fluentia

Uma professora de idiomas por voz. Você fala em voz alta, ela escuta, responde falando e escreve
ao lado as correções que importam — sem nunca interromper a conversa para lê-las.

**Dez idiomas**, cada um no seu próprio espaço: inglês, espanhol, francês, italiano, alemão,
português, japonês, coreano, chinês e russo.

**→ [fluentia-smoky.vercel.app](https://fluentia-smoky.vercel.app)**

A Fluentia roda com a **sua própria chave** de IA — OpenAI ou Google Gemini. Não há créditos,
assinatura nem chave compartilhada: transcrição, respostas e fala são cobradas direto na sua conta.

---

## Sumário

- [Provedores de IA](#provedores-de-ia)
- [Como pegar sua chave da OpenAI](#como-pegar-sua-chave-da-openai)
- [Como pegar sua chave do Gemini](#como-pegar-sua-chave-do-gemini)
- [O ciclo](#o-ciclo)
- [Espaços de idioma](#espaços-de-idioma)
- [Níveis, progresso e XP](#níveis-progresso-e-xp)
- [Rodando localmente](#rodando-localmente)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Scripts](#scripts)
- [Modelo de dados](#modelo-de-dados)
- [Segurança](#segurança)
- [Estrutura](#estrutura)
- [Limites conhecidos](#limites-conhecidos)

---

## Provedores de IA

A Fluentia precisa de três coisas do provedor: **ouvir** (transcrição), **pensar** (resposta e
correções sob um JSON Schema) e **falar** (síntese de voz). Só aparecem em **Configurações →
Provedor de IA** os que fazem os três sozinhos — você nunca precisa de duas contas para uma
conversa.

| | Ouvir | Pensar | Falar |
| --- | :---: | :---: | :---: |
| OpenAI | sim | sim | sim |
| Google Gemini | sim | sim | sim |
| Anthropic (Claude) | **não** | sim | **não** |

O Claude está de fora de propósito: a Messages API dele aceita texto, imagens e PDF e devolve só
texto. Ele seria um bom professor, mas um espaço com Claude ainda precisaria de OpenAI ou Gemini
por baixo para ouvir e falar.

Trocar de provedor limpa os modelos e a voz escolhidos, porque cada um tem os seus. **A chave do
outro provedor continua salva**, criptografada — você não precisa colar de novo se voltar.

Diferenças que valem saber:

- A OpenAI transmite a fala em `mp3` conforme gera; o Gemini devolve a fala inteira de uma vez, em
  PCM cru, que o app empacota como `wav` antes de mandar ao navegador. Na prática o Gemini demora
  um pouco mais para o professor começar a falar.
- O Gemini usa o mesmo modelo para ouvir e para pensar (`gemini-2.5-flash` faz os dois); a OpenAI
  tem um modelo por papel.

> **Um risco em aberto no Gemini.** O Google documenta como formatos de áudio aceitos WAV, MP3,
> AIFF, AAC, OGG Vorbis e FLAC — e **não** WebM/Opus, que é justamente o que o Chrome e o Edge
> gravam. Se a transcrição falhar por formato, o app diz isso em palavras claras em vez de um erro
> genérico de chave. Rode `npm run check:gemini -- <sua-chave> gravacao.webm` para resolver a dúvida com
> uma gravação real; se o Google recusar, a correção é gravar WAV no navegador quando o provedor for
> o Gemini.

---

## Como pegar sua chave da OpenAI

A Fluentia nunca fala pela conta de outra pessoa. Você cola sua chave uma vez, ela é criptografada
no banco, e todo uso é faturado na sua conta — o que também significa que você vê e controla o
custo.

### Passo a passo

1. **Crie uma conta** em [platform.openai.com](https://platform.openai.com). É a plataforma de
   desenvolvedores, diferente do ChatGPT — e uma assinatura do ChatGPT Plus **não** dá acesso à API.

2. **Adicione crédito.** Vá em **Settings → Billing** e coloque um valor inicial. A API é pré-paga:
   sem crédito, qualquer chamada volta com erro de cota, mesmo com a chave correta. US$ 5 já dá
   para bastante conversa.

3. **Crie a chave** em **[platform.openai.com/api-keys](https://platform.openai.com/api-keys)** →
   **Create new secret key**. Dê um nome que você reconheça depois (ex.: `fluentia`).

4. **Copie na hora.** A chave começa com `sk-` e só aparece **uma vez**. Se fechar o diálogo sem
   copiar, não dá para recuperar — só criar outra.

5. **Cole na Fluentia** em **Configurações → Configuração de IA**. Ao salvar, a Fluentia faz uma
   chamada real de verificação e te diz na hora se a chave funciona.

### Quanto custa

Uma conversa de 10 minutos gasta poucos centavos de dólar: uma transcrição por fala sua, uma
resposta de texto, e um trecho de áudio por fala do professor. Você pode trocar os modelos em
**Configurações → Modelos e voz** se quiser algo mais barato ou mais capaz.

Vale colocar um **limite de gasto** em **Settings → Limits** na OpenAI. É a proteção que independe
do app.

### Se algo der errado

| Mensagem | O que é |
| --- | --- |
| `401` / chave recusada | A chave foi digitada errada, revogada, ou é de outra organização |
| `429` / cota excedida | A chave está certa, mas a conta está sem crédito |
| `400` sem modelo | O modelo escolhido não existe ou sua conta não tem acesso a ele |

> **Nunca** coloque a chave numa variável com prefixo `NEXT_PUBLIC_`. Esse prefixo publica o valor
> no navegador. A Fluentia guarda a chave criptografada e só a descriptografa dentro da requisição
> de servidor que chama a OpenAI.

---

## Como pegar sua chave do Gemini

1. Entre em **[aistudio.google.com/apikey](https://aistudio.google.com/apikey)** com sua conta
   Google.
2. **Create API key** — o Google usa dois formatos, e os dois funcionam aqui: a chave
   clássica, que começa com `AIza` (normalmente `AIzaSy`), e a auth key mais nova do AI
   Studio, que começa com `AQ.`.
3. Cole em **Configurações → Configuração de IA**, com **Google Gemini** selecionado.

O AI Studio tem um nível gratuito com limites diários, o que é suficiente para experimentar sem
cadastrar cartão. Para uso constante, ligue o faturamento no projeto do Google Cloud associado.

Para conferir a chave fora do app, antes de colar:

```bash
npm run check:gemini -- <sua-chave>
```

Ele faz uma chamada por capacidade — chave, schema do professor, e fala — então uma falha diz qual
das três quebrou, em vez de só "não funcionou".

---

## O ciclo

```
   ┌──────────┐   MediaRecorder    ┌───────────────────────────────┐
   │  você    │ ─────────────────▶ │ POST /api/conversations/:id/  │
   │  fala    │      webm/opus     │              turn             │
   └──────────┘                    │                               │
         ▲                         │  1. fala → texto  (STT)       │
         │                         │  2. texto + perfil + histórico│
         │                         │     → resposta + correções    │
         │                         │        (uma chamada JSON)     │
         │                         │  3. grava a fala, as correções│
         │                         │     e o histórico de erros    │
         │                         └───────────────┬───────────────┘
         │                                         │
         │        GET /api/speech?messageId=…      ▼
         └──────────  áudio em stream (mp3 / wav) ── o professor fala
                                                   │
                            as correções aparecem no painel lateral,
                            em silêncio, enquanto o professor continua
```

A resposta e as correções vêm de **uma única** chamada com JSON Schema estrito, então nunca podem
se contradizer, e o texto falado é instruído a não conter nenhuma linguagem de correção. A fala é um
`GET` separado por id da mensagem, o que deixa o navegador tocar nativamente conforme chega e torna
uma repetição gratuita.

Quando a sessão termina, a transcrição é avaliada, o relatório é gravado, o perfil de idioma é
atualizado e XP, sequência e conquistas são recalculados de linhas reais do banco.

### O que fica em qual idioma

O painel é **sempre em português** — abas, botões, títulos, descrições. O que aparece no idioma que
você pratica é o que **é** o aprendizado: a fala do professor, a transcrição, seus erros, o
vocabulário salvo.

---

## Espaços de idioma

Cada idioma é um espaço independente, até **3 por conta**. Trocar de espaço troca tudo que é do
idioma e nada que é seu:

| Por espaço | Da conta |
| --- | --- |
| Nível oficial e progresso | Sequência de dias |
| Erros e vocabulário | XP |
| Sessões e relatórios | Conquistas |
| Metas semanais | Nome, senha, chaves de IA |

Praticar japonês numa terça não quebra a sequência construída em inglês — a sequência é sua, não do
idioma.

Cada espaço adapta o professor ao idioma: o prompt fala na língua e na escrita corretas (japonês em
kana/kanji, não romaji), a transcrição recebe o código ISO certo, e o dicionário muda de fonte.

---

## Níveis, progresso e XP

Três coisas separadas de propósito. **XP não compra nível.**

### A nota de cada sessão define a faixa

| Nota | Faixa |
| ---: | :--- |
| 0–29 | A1 |
| 30–44 | A2 |
| 45–59 | B1 |
| 60–74 | B2 |
| 75–89 | C1 |
| 90–100 | C2 |

A faixa é **derivada** da nota de fala, não perguntada ao modelo. Antes eram duas respostas
separadas e nada as amarrava: uma sessão podia tirar 42 e ser rotulada B2.

### O progresso é a média das últimas 5 sessões

```
(média − piso da faixa) / (teto − piso) × 100
```

B1 vai de 45 a 59. Média de 55 → `(55 − 45) / (59 − 45) = 71%`.

- Com menos de 5 sessões, usa as que existem — sem inventar valores.
- Sempre entre 0% e 100%.
- Só contam sessões com **pelo menos 4 falas suas**: abaixo disso a nota descreve mais a duração da
  conversa do que você.
- A janela é contada a partir da última promoção, então um nível novo começa em 0%.

### O nível só sobe com consistência

Chegar a 100% **não** promove. Aparece um objetivo: **5 sessões seguidas** com nota dentro da faixa
seguinte.

```
B1 — 100%      B2 bloqueado
63 → 1/5   66 → 2/5   61 → 3/5   65 → 4/5   68 → 5/5   🎉 B2 desbloqueado
```

Uma nota fora da faixa zera a sequência — mas **não** derruba a barra abaixo de 100%. Você já provou
que atingiu o teto do nível atual.

A promoção acontece **no encerramento da sessão que a conquistou**, e o resumo daquela sessão
mostra a conquista. Não é preciso abrir outra aba para o nível atualizar.

### XP é só gamificação

XP vem de completar sessões, manter a sequência, aprender palavras, corrigir erros e bater metas.
Duas pessoas podem ter XP muito diferente e o mesmo nível — e vice-versa.

---

## Rodando localmente

Requer **Node 22.11+** e um projeto Postgres (o Supabase serve bem).

```bash
npm install
npm run setup        # cria .env.local com uma ENCRYPTION_KEY nova
# cole sua connection string do Supabase em DATABASE_URL no .env.local
npm run dev          # aplica as migrações e sobe o app
```

Depois:

1. abra <http://localhost:3000> e crie uma conta;
2. escolha o idioma e conclua o onboarding;
3. vá em **Configurações → Configuração de IA** e cole sua chave da OpenAI;
4. abra **Conversar**, escolha um tema e fale.

`npm run dev` roda `setup` e `db:migrate` antes, então o schema está aplicado e o catálogo de
conquistas semeado quando o servidor sobe.

---

## Variáveis de ambiente

`npm run setup` cria o `.env.local` com uma chave nova. A URL do banco é uma credencial, então nunca
é inventada para você:

| Variável | Significado |
| --- | --- |
| `DATABASE_URL` | Connection string do Postgres (Supabase → Project Settings → Database → Connection string → URI) |
| `ENCRYPTION_KEY` | Chave hex de 32 bytes que criptografa a chave da OpenAI de cada usuário |
| `OPENAI_CHAT_MODEL` / `OPENAI_STT_MODEL` / `OPENAI_TTS_MODEL` | Padrões opcionais, substituíveis por usuário em Configurações |
| `OPENAI_BASE_URL` | Opcional; aponta para um gateway compatível com a OpenAI (usado também pelos testes) |
| `GEMINI_BASE_URL` | Opcional; mesma ideia para o Gemini |

> **`ENCRYPTION_KEY` é o segredo que mais importa.** Se você trocá-la, toda chave da OpenAI já
> guardada vira ilegível e os usuários precisam colar a delas de novo. Ao publicar na Vercel, copie
> a mesma chave do `.env.local` — não gere outra.

> Use o URI do **Transaction pooler** (porta 6543) em deploy serverless; o app já configura
> `prepare: false`, que é o que esse pooler exige. Um servidor de longa duração pode usar o Session
> pooler ou a conexão direta.

> A connection string dá acesso total ao banco: ela pertence só a variáveis de servidor. O
> isolamento entre usuários **não** vem do Row Level Security do Supabase — vem do app, que filtra
> toda consulta pelo id da sessão.

### Deploy na Vercel

Defina `DATABASE_URL` e `ENCRYPTION_KEY` nas variáveis de ambiente do projeto. As migrações rodam no
`prestart`. Vale conferir se a região das funções fica perto da região do banco: com elas em
continentes diferentes, cada ida ao banco custa ~150 ms em vez de ~30 ms, e o painel faz várias.

---

## Scripts

```bash
npm run dev          # migra + servidor de desenvolvimento
npm run build        # build de produção (com typecheck)
npm start            # migra + servidor de produção
npm run typecheck
npm test             # unitários puros, sem banco
npm run test:smoke      http://localhost:3000        # páginas, guardas de auth, isolamento
npm run test:voice      http://localhost:3000 4319   # o ciclo de voz inteiro contra um mock
npm run test:levels     http://localhost:3000        # promoção de nível ponta a ponta
npm run test:gemini     http://localhost:3000        # o ciclo no Gemini, contra um dublê do Google
npm run test:keys       http://localhost:3000        # os dois formatos de chave do Google, no formulário
npm run test:isolation  http://localhost:3000        # as duas chaves salvas: só a selecionada é usada
npm run check:gemini -- <sua-chave>                  # verifica uma chave real contra o Google
npm run test:workspaces http://localhost:3000        # isolamento entre idiomas, em navegador
npm run test:responsive http://localhost:3000        # 6 larguras, sem scroll horizontal
npm run icons        # regenera favicon, ícone do app e card social a partir da logo
npm run db:generate  # nova migração depois de editar o schema
npm run db:studio    # navega no banco
```

`test:voice`, `test:levels` e `test:gemini` precisam do app iniciado com
`OPENAI_BASE_URL=http://127.0.0.1:4319/v1 GEMINI_BASE_URL=http://127.0.0.1:4320`. Eles sobem um dublê compatível com a OpenAI e percorrem
o ciclo inteiro — upload de áudio, transcrição, resposta, correções, agregação de erros, streaming
de fala, relatório, XP, sequência, conquistas e promoção de nível — sem gastar um centavo.

> O Next 16 recusa um segundo servidor de desenvolvimento na mesma pasta. Para rodar os testes que
> precisam do mock, use o build de produção numa porta separada:
> `npm run build && OPENAI_BASE_URL=http://127.0.0.1:4319/v1 PORT=3100 npm start`.

---

## Modelo de dados

Tudo pende de `users`, e toda consulta é filtrada pelo id da sessão. O que descreve o aprendizado
pende de `workspaces`.

```
users ──┬── profiles              XP, sequência, idioma nativo, tempo total
        ├── user_settings         provedor, chaves criptografadas (uma por provedor), modelos, voz, tema
        ├── sessions              tokens de sessão com hash
        ├── user_achievements ── achievements     catálogo semeado do código
        ├── streaks                               uma linha por dia praticado
        └── workspaces ──┬── conversations ──┬── conversation_messages   a transcrição
                         │                   ├── corrections             o que o painel mostrou
                         │                   └── session_reports         notas, promoção, conselhos
                         ├── mistakes ─────── mistake_occurrences        padrões, com contagem
                         ├── vocabulary                                  aprendendo/revisar/aprendida
                         └── goals                                       metas semanais
```

`streaks` é a fonte da verdade da sequência; `profiles` guarda uma cópia desnormalizada para o
painel ser uma leitura só. O progresso das metas é sempre calculado de linhas reais, nunca guardado.

O estado de nível vive em `workspaces`: `official_cefr`, `level_progress`, `consistency_streak` e
`level_achieved_at`. Cada relatório guarda se contou para o nível (`counts_towards_level`) e se
promoveu (`promoted_to`), então a promoção é um fato registrado, não um cálculo de tela.

---

## Segurança

- **Chaves da API** são criptografadas com AES-256-GCM (`src/lib/crypto.ts`), uma por provedor, e só
  descriptografadas dentro de `getAiClient()`. A do Gemini viaja no cabeçalho `x-goog-api-key`,
  nunca na URL, para não acabar num log de acesso. Nenhuma rota devolve uma chave, nem mascarada além dos 4 últimos dígitos.
- **Sessões** são tokens opacos de 32 bytes em cookies `httpOnly`, `sameSite=lax`; só o SHA-256 é
  guardado, então o banco não serve para se passar por ninguém.
- **Senhas** usam `scrypt` com sal por senha e comparação em tempo constante.
- **Isolamento** — cada conversa, mensagem, correção, erro e palavra é buscada com o id do usuário
  no `WHERE`, e o conteúdo de aprendizado também pelo espaço. `test:smoke` verifica que outra conta
  recebe `404` em todos, inclusive no endpoint de áudio; `test:workspaces` verifica que dois idiomas
  na mesma conta não enxergam um ao outro.
- **Entradas** são validadas com Zod em toda fronteira (`src/lib/validation.ts`), incluindo tamanho
  e tipo MIME do áudio enviado.
- **Limites de taxa** protegem login, início de sessão, falas, fala sintetizada e buscas no
  dicionário.
- **Cascatas** — apagar um usuário remove toda linha dele, por chave estrangeira e não por código.
- **Áudio** é enviado à OpenAI e nunca escrito em disco; a Fluentia guarda o texto.

---

## Estrutura

```
src/
  app/
    (auth)/          login, cadastro
    (app)/           o app logado: painel, conversar, sessões, erros, vocabulário,
                     perfil, metas, conquistas, configurações, espaços
    onboarding/      primeiro acesso, começando pela escolha do idioma
    api/             conversations/:id/turn · conversations/:id/end · speech · dictionary · translate
  components/        marca, shell, conversa, configurações, vocabulário, primitivos de UI
  lib/
    auth/            emissão de sessão, guardas, ações de login/cadastro
    db/              schema Drizzle, conexão, semente de conquistas
    domain/          conversa, erros, relatório, gamificação, recomendações, temas,
                     cefr, progression (as regras de nível), workspace
    dictionary/      dictionaryapi.dev + Wiktionary, normalização testável
    ai/              provedores: a interface, os adaptadores OpenAI e Gemini, e as
                     conversões que o Gemini exige (dialeto de schema, PCM → WAV)
    openai/          prompts, JSON schemas, turno, fala
    languages.ts     os 10 idiomas: código STT, notas de ensino, dicionário, amostra de voz
    actions/         server actions agrupadas por funcionalidade
    hooks/           use-recorder (detecção de atividade de voz)
tests/               unitários puros + smoke, voz, níveis, espaços, responsividade
```

---

## Limites conhecidos

- **Pronúncia** só é avaliada quando a transcrição mostra evidência; caso contrário o relatório
  mostra um traço em vez de inventar um número. Avaliação real de pronúncia precisa do áudio.
- **O dicionário** usa [dictionaryapi.dev](https://dictionaryapi.dev) para inglês, que traz fonética
  e gravações humanas mas cai com frequência, e o [Wiktionary](https://en.wiktionary.org) para todos
  os idiomas — inclusive como reserva do inglês quando o primeiro falha. As definições do Wiktionary
  vêm **em inglês**: só a versão inglesa implementa esse endpoint. Salvar a palavra e tocar o botão
  de traduzir resolve, com uma chamada à sua chave.
- **A vez de falar** é apertar-para-falar com detecção de silêncio, não um stream full duplex. É
  mais simples, mais barato e funciona em todo navegador com `MediaRecorder`; a Realtime API seria o
  próximo passo para interrupção.
- **Sem limite de tempo por fala.** O único teto é o de 25 MB por upload da OpenAI, contado em bytes
  reais conforme gravam — mais de meia hora de fala numa vez só. Falas longas custam e demoram
  proporcionalmente mais.
- **Limite de taxa** é em processo, o que é correto para uma instância. Vários nós precisariam de um
  armazenamento compartilhado.
- **Traduções** são sob demanda. Cada tradução é uma chamada cobrada na conta do aprendiz, então a
  Fluentia nunca traduz uma palavra antes de você pedir.
- **Sem recuperação de senha por e-mail.** A Fluentia não envia e-mail; a recuperação roda na máquina
  que hospeda o banco, com `npm run set-password -- voce@exemplo.com`.
