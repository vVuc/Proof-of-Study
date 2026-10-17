# IA com Gemini Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Spec**: `.specs/features/ia-gemini/spec.md`
**Design**: `.specs/features/ia-gemini/design.md`
**Status**: Approved (2026-10-17)

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: none (sem `AGENTS.md` nem `CONTRIBUTING.md`); os gates seguem o CI em `.github/workflows/build-teste.yml` (lint, `tsc -b`, Vitest, `cargo test`, Clippy) e o `include` do Vitest em `vite.config.ts` (`src/**/*.test.ts`). Strong defaults applied. Base no início: 53 testes no front.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Lógica de domínio no TS (classificação, resumo, expediente, autoanálise, prompts, respostas, sugestões) | unit | Todos os ramos; 1:1 com os ACs da spec; cada edge case listado tem um teste | `src/**/utils/*.test.ts`, ao lado do arquivo | `npm test` |
| Modelo e migração | unit | Cada caminho de conversão; nada se perde (regras, ajustes, soma de foco) | `src/store/model/*.test.ts` | `npm test` |
| Reducer | unit | Cada ação nova e o recálculo do EXPED-07 | `src/store/reducer/*.test.ts` (novo) | `npm test` |
| Funções puras do Rust (montar e ler mensagens, mapa de erros, aviso de distração) | unit | Todos os ramos; os ACs de erro, protocolo e aviso | `#[cfg(test)] mod tests` no próprio arquivo | `cargo test --manifest-path src-tauri/Cargo.toml` |
| Comandos do Rust com I/O (HTTP, WebSocket, cofre, microfone) | none | A lógica fica em funções puras testadas; a cola de I/O passa pelo build gate e pelo UAT | - | build gate |
| Componentes, hooks e wrappers de `invoke` do React | none | Build gate (tipos e lint) e UAT; a lógica fica nos utils testados | - | build gate |
| Config, CI e documentação | none | Build gate | - | build gate |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Tarefas só com testes do front | `npm test` |
| Full | Tarefas com Rust | `npm test && cargo test --manifest-path src-tauri/Cargo.toml` |
| Build | Telas, tipos que se espalham, config e a última tarefa de cada fase | `npm run lint && npx tsc -b && npm test && cargo test --manifest-path src-tauri/Cargo.toml && cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` |

Até a T31, os gates do Rust rodam sem `--features voz`: o Whisper pede CMake e LLVM, e ele sai nesta feature.

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Formato 4 e tipo Trabalho

Sem IA: o tipo novo no modelo, na classificação, nas telas e na autoanálise.

```
T1 → T2 → T3 → T8
T1 → T4
T1 → T5
T1 → T6
T1 → T7
T2 → T8
```

### Phase 2: Horário de trabalho da Rotina

Sem IA: o expediente classifica e silencia o aviso de distração.

```
T9 → T10 → T12
T9 → T11
T9 → T13
```

### Phase 3: Gateway da IA e configuração

Rust (chave, chamadas, erros) e a tela de ligar a IA.

```
T14 → T16
T15 → T16
T16 → T17 → T18 → T20
T19 → T20
```

### Phase 4: Insight do dia

```
T21 → T22 → T23 → T25 → T26
T24 → T25
T22 → T26
T23 → T26
T24 → T26
```

### Phase 5: Plano do dia pela IA

```
T27 → T28 → T29
```

### Phase 6: Voz ao vivo e saída do Whisper

```
T30 → T31 → T32
T31 → T33
T31 → T34 → T35 → T36
```

### Phase 7: Insight da semana

```
T37 → T38 → T39
```

---

## Task Breakdown

### Phase 1: Formato 4 e tipo Trabalho

#### T1: Tipo `trabalho` e total de trabalho no resumo

**Status**: ✅ Concluída

**What**: `Tipo` ganha `'trabalho'`, `Sessao` ganha `trabalhoMs`, e `resumir`/`totaisDaSessao` somam o trabalho fora do foco e do fora; os `Record<Tipo, …>` que o compilador apontar (`ROTULO_TIPO`, `COR_ATIVA` e outros) ganham a entrada.
**Where**: `src/features/sessao/utils/resumo.ts`
**Depends on**: None
**Reuses**: `totaisDaSessao`, `tipoDoAjuste`; `sessaoV3` em `migracao.ts` completa `trabalhoMs: 0`
**Requirement**: TRAB-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Um grupo corrigido para `trabalho` soma em `trabalhoMs` e não em `focoMs`, `foraMs` nem `focoPorMateria` (teste em `resumo.test.ts`)
- [x] Uma regra `trabalho` produz o mesmo resultado (teste)
- [x] Gate passa: build
- [x] Contagem do front ≥ 53 + 2

**Tests**: unit
**Gate**: build

**Commit**: `feat(sessao): tipo trabalho e total de trabalho no resumo`

---

#### T2: Formato 4 e conversão 3 → 4

**Status**: ✅ Concluída

**What**: `VERSAO_DADOS = 4`, `Objetivo.tipo`, os tipos `SugestaoIA`/`InsightDia`/`InsightSemana`, `Dados.insights` e as preferências `ia`, `consentimentoIA`, `sobreVoce` e `ocultarAvisoExpediente` (com os padrões), mais a conversão do formato 3 em `atualizarDados`.
**Where**: `src/store/model/migracao.ts`
**Depends on**: T1
**Reuses**: `atualizarDados`, `dados_backup` (cópia antes de gravar), `PREFERENCIAS_PADRAO`
**Requirement**: TRAB-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Dados do formato 3 convertidos mantêm regras, ajustes, objetivos e a soma de foco iguais (teste)
- [x] Sessões convertidas têm `trabalhoMs: 0`, `insights` vem vazio e as preferências novas vêm com os padrões (teste)
- [x] Objetivo sem `tipo` continua contando como estudo (teste)
- [x] Dados de uma versão maior que 4 continuam recusados (teste existente passa)
- [x] Gate passa: build
- [x] Contagem do front ≥ anterior + 3

**Tests**: unit
**Gate**: build

**Commit**: `feat(dados): formato 4 com insights, objetivos com tipo e preferências da IA`

---

#### T3: Objetivo de trabalho na classificação

**Status**: ✅ Concluída

**What**: Em `classificar`, os termos de objetivos de trabalho do dia vêm antes dos de estudo e das matérias e dão `tipo: 'trabalho'` com a chave `objetivo:<id>`; o tempo fica no objetivo.
**Where**: `src/features/sessao/utils/classificacao.ts`
**Depends on**: T2
**Reuses**: `porTermos`, `termosDoObjetivo`, `contemPalavra`
**Requirement**: TRAB-08, TRAB-09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] "empresa-api [Rust] - VS Code" com objetivo de trabalho "empresa-api" e matéria Rust vira trabalho no objetivo de trabalho (teste)
- [x] A janela de objetivo de trabalho vence uma regra de estudo e uma de fora (teste)
- [x] Objetivo de trabalho pulado não classifica (teste)
- [x] O resumo soma o tempo no `objetivoId` do objetivo de trabalho (teste)
- [x] Gate passa: quick
- [x] Contagem do front ≥ anterior + 4

**Tests**: unit
**Gate**: quick

**Commit**: `feat(sessao): objetivos de trabalho classificam antes do estudo`

---

#### T4: Trabalho na autoanálise

**Status**: ✅ Concluída

**What**: Em `insights.ts`, o trabalho fica fora do mapa de foco, das distrações e do tempo até distrair, encerra um bloco de foco, e `LinhaDoDia` ganha `trabalhoMs`.
**Where**: `src/features/autoanalise/utils/insights.ts`
**Depends on**: T1
**Reuses**: `focoPorHora`, `principaisDistracoes`, `blocosDeFoco`, `linhasPorDia`
**Requirement**: TRAB-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Trecho de trabalho não entra em `focoMs` nem `foraMs` do mapa (teste)
- [x] Trabalho não aparece em `principaisDistracoes` (teste)
- [x] Trabalho entre dois trechos de estudo separa dois blocos de foco (teste)
- [x] `linhasPorDia` traz `trabalhoMs` do dia (teste)
- [x] Gate passa: quick
- [x] Contagem do front ≥ anterior + 4

**Tests**: unit
**Gate**: quick

**Commit**: `feat(autoanalise): trabalho fora do foco e das distrações`

---

#### T5: "Trabalho" nas regras de Apps e sites

**Status**: ✅ Concluída

**What**: `SeletorTipo` mostra Estudo, Trabalho, Fora do estudo e Ignorar, com a cor do Trabalho da Rotina na opção ativa.
**Where**: `src/features/apps/components/SeletorTipo.tsx`
**Depends on**: T1
**Reuses**: `CATEGORIAS.trabalho` (`#d9d0c1`), `ROTULO_TIPO`
**Requirement**: TRAB-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] O seletor tem as quatro opções e salva `tipo: 'trabalho'` numa regra
- [x] Gate passa: build

**Tests**: none
**Gate**: build

**Commit**: `feat(apps): opção Trabalho nas regras`

---

#### T6: "Trabalho" nas correções do relato

**Status**: ✅ Concluída

**What**: O select de cada grupo em `GruposDoDia` ganha "Trabalho".
**Where**: `src/features/relatos/components/GruposDoDia.tsx`
**Depends on**: T1
**Reuses**: `valorDoGrupo`, `ROTULO_TIPO`
**Requirement**: TRAB-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Escolher "Trabalho" num grupo grava o ajuste `trabalho` e muda o total do relato
- [x] Gate passa: build

**Tests**: none
**Gate**: build

**Commit**: `feat(relatos): correção para Trabalho no relato final`

---

#### T7: Total e faixa de trabalho na Sessão e no relato

**Status**: ✅ Concluída

**What**: O token de cor `--trabalho` (`#d9d0c1`) no `index.css`, a faixa de trabalho na `BarraFaixas` e o total de trabalho na tela Sessão e no relato final, separado do estudo e do fora.
**Where**: `src/features/sessao/components/partes.tsx`
**Depends on**: T1
**Reuses**: `BarraFaixas`, `Faixa`, os totais de `resumir`
**Requirement**: TRAB-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Sessão e relato mostram "Trabalho" com o tempo do dia quando há trabalho
- [x] A faixa de trabalho usa a cor do Trabalho da Rotina, nos temas claro e escuro
- [x] Gate passa: build

**Tests**: none
**Gate**: build

**Commit**: `feat(sessao): total e faixa de trabalho na Sessão e no relato`

---

#### T8: Objetivo manual de estudo ou de trabalho

**Status**: ✅ Concluída

**What**: O "adicionar objetivo" do `CartaoObjetivos` escolhe Estudo ou Trabalho (padrão Estudo), e os objetivos de trabalho mostram o tempo recebido com o rótulo do tipo.
**Where**: `src/features/hoje/components/CartaoObjetivos.tsx`
**Depends on**: T2, T3
**Reuses**: `ControleSegmentado`, `nomeDoObjetivo`
**Requirement**: TRAB-07, TRAB-09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Um objetivo criado como Trabalho grava `tipo: 'trabalho'`; sem escolha, grava estudo
- [x] O tempo ligado ao objetivo de trabalho aparece nele na tela Hoje
- [x] Gate passa: build (última da fase)

**Tests**: none
**Gate**: build

**Commit**: `feat(hoje): objetivo manual de estudo ou de trabalho`

---

### Phase 2: Horário de trabalho da Rotina

#### T9: Intervalos de trabalho do dia

**Status**: ✅ Concluída

**What**: `intervalosDeTrabalho`, `dividirPorExpediente` e `temHorarioDeTrabalho` a partir dos itens de Trabalho com horário da Rotina.
**Where**: `src/features/rotina/utils/expediente.ts`
**Depends on**: None
**Reuses**: `temHorario`, `deISO`, a regra `fim <= inicio` dos blocos
**Requirement**: EXPED-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Trabalho das 9h às 18h de segunda a sexta dá um intervalo numa segunda e nenhum num sábado (teste)
- [x] Item das 22h às 2h aparece no dia em que começa e no começo do dia lógico seguinte (teste)
- [x] Itens que se sobrepõem viram um intervalo só (teste)
- [x] Um trecho das 17h às 19h com expediente até 18h vira dois pedaços (teste)
- [x] Itens de outras categorias e sem horário são ignorados (teste)
- [x] Gate passa: quick
- [x] Contagem do front ≥ anterior + 5

**Tests**: unit
**Gate**: quick

**Commit**: `feat(rotina): intervalos do horário de trabalho`

---

#### T10: Expediente na classificação

**Status**: ✅ Concluída

**What**: `ContextoClassificacao.expediente` (preenchido por `contextoDoDia`), `classificar` com o `inicio` do trecho, estudo só por regra no expediente vira trabalho com a chave `expediente:<chave>`, e `resumir`/`classificarSessao` dividem os trechos nas bordas antes de agrupar.
**Where**: `src/features/sessao/utils/classificacao.ts`
**Depends on**: T9, T3
**Reuses**: `dividirPorExpediente`, `contextoDoDia`, `resumir`, `classificarSessao`
**Requirement**: EXPED-01, EXPED-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] VS Code (regra de estudo) às 10h no expediente vira trabalho com a chave `expediente:regra:<id>` (teste)
- [x] VS Code às 20h, fora do expediente, continua estudo com a chave `regra:<id>` (teste)
- [x] `rust-book` com termo da matéria Rust às 12h no expediente continua estudo (teste)
- [x] Janela sem regra no expediente continua fora (teste)
- [x] Um trecho que cruza o fim do expediente fica em dois grupos com os tempos certos (teste)
- [x] Gate passa: quick
- [x] Contagem do front ≥ anterior + 5

**Tests**: unit
**Gate**: quick

**Commit**: `feat(sessao): horário de trabalho converte o estudo por regra`

---

#### T11: Aviso de distração com trabalho e expediente

**Status**: ✅ Concluída

**What**: `Configuracao.expediente` no Rust (`serde(default)`), sem aviso dentro do expediente, e `configuracaoDoRastreio` mandando os intervalos do dia; os termos dos objetivos de trabalho já entram em `termos`.
**Where**: `src-tauri/src/rastreador.rs`
**Depends on**: T9
**Reuses**: `distracao`, o laço do aviso, `configuracaoDoRastreio` e `termosDoDia` em `dia.ts`
**Requirement**: EXPED-03, TRAB-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Janela fora do estudo dentro do expediente não dispara o aviso (teste Rust)
- [x] A mesma janela fora do expediente dispara (teste Rust)
- [x] Regra `trabalho` e termo de objetivo de trabalho não disparam (teste Rust)
- [x] Configuração sem `expediente` (formato antigo) ainda é lida (teste Rust)
- [x] `configuracaoDoRastreio` inclui os intervalos e os termos de trabalho (teste em `dia.test.ts`)
- [x] Gate passa: full

**Tests**: unit
**Gate**: full

**Commit**: `feat(rastreador): sem aviso de distração no horário de trabalho`

---

#### T12: Recalcular os dias quando o horário de trabalho muda

**Status**: ✅ Concluída

**What**: `bloco/salvar` e `bloco/excluir` de um item de Trabalho recalculam com `recalcularDia` as sessões dos dias sem relato final.
**Where**: `src/store/reducer/dados-reducer.ts`
**Depends on**: T10
**Reuses**: `recalcularDia`, `relatoDoDia`
**Requirement**: EXPED-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Criar Trabalho das 9h às 18h muda os totais de um dia sem relato final (teste em `dados-reducer.test.ts`, novo)
- [x] Um dia com relato final não muda (teste)
- [x] Salvar um item de outra categoria não recalcula (teste)
- [x] Gate passa: quick
- [x] Contagem do front ≥ anterior + 3

**Tests**: unit
**Gate**: quick

**Commit**: `feat(dados): recalcula os dias sem relato quando o horário de trabalho muda`

---

#### T13: Sugestão de cadastrar o horário de trabalho

**Status**: ✅ Concluída

**What**: `mostrarAvisoExpediente(blocos, trabalhoMs, ocultar)` em `expediente.ts` e o `AvisoExpediente` no relato final, com o link para a Rotina e "Não mostrar de novo" (que grava `ocultarAvisoExpediente`).
**Where**: `src/features/rotina/components/AvisoExpediente.tsx`
**Depends on**: T9
**Reuses**: `CaixaDestaque`, `temHorarioDeTrabalho`, `preferencias/salvar`
**Requirement**: EXPED-05, EXPED-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] O predicado é verdadeiro com trabalho no dia e sem horário de Trabalho, e falso com horário, sem trabalho ou com o aviso oculto (testes em `expediente.test.ts`)
- [x] O aviso mostra o texto exato da spec, abre a Rotina e some para sempre com "Não mostrar de novo"
- [x] Gate passa: build (última da fase)
- [x] Contagem do front ≥ anterior + 4

**Tests**: unit
**Gate**: build

**Commit**: `feat(relatos): sugestão de cadastrar o horário de trabalho`

---

### Phase 3: Gateway da IA e configuração

#### T14: Pedido, resposta e erros da Interactions API

**Status**: ✅ Concluída

**What**: `ia.rs` com `PedidoIA`, `RespostaIA`, `ErroIA` e as funções puras `corpo_da_interacao` (modelo `gemini-3.8-flash`, `system_instruction`, `input`, `response_format` com o schema e `store: false`), `texto_da_interacao` (texto em `steps[type=model_output].content[type=text]`) e `erro_do_status`; o `ureq` deixa de ser opcional.
**Where**: `src-tauri/src/ia.rs`
**Depends on**: None
**Reuses**: o estilo de módulo e de testes do `voz.rs`
**Requirement**: IAERR-01, IAERR-02, IAERR-03, IAERR-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] O corpo tem o modelo, `store: false` e `response_format` `{ type: "text", mime_type: "application/json", schema }` (teste Rust)
- [x] O texto sai de uma resposta com `steps` e falta numa sem `model_output` (testes Rust)
- [x] 401, 403 e 400 com "API key" → `Chave`; 429 → `Cota`; 503 → `Indisponivel` (testes Rust)
- [x] Gate passa: full

**Tests**: unit
**Gate**: full

**Commit**: `feat(ia): pedido, resposta e erros da Interactions API`

---

#### T15: Cofre da chave

**What**: Módulo `cofre` com o `keyring` 4 (`v1::Entry`, serviço `io.github.mizerski.proofofstudy`, usuário `gemini`) e o arquivo `ia-chave` com permissão `0600` quando não há Secret Service; começa por um spike que confirma o caminho e a API da crate.
**Where**: `src-tauri/src/ia.rs`
**Depends on**: None
**Reuses**: `app.path().app_data_dir()` como em `pasta_dos_modelos`
**Requirement**: IACONF-07, IACONF-08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `final_da_chave` devolve só os 4 últimos caracteres (teste Rust)
- [ ] Gravar, ler e apagar pelo arquivo funciona numa pasta temporária, com `0600` no Unix (teste Rust)
- [ ] A chave não vai para nenhum `log::` (conferido no diff)
- [ ] Gate passa: full

**Tests**: unit
**Gate**: full

**Commit**: `feat(ia): cofre da chave com alternativa em arquivo`

---

#### T16: Comandos da IA no Tauri

**What**: `ia_configurar`, `ia_chave_salvar` (teste com `GET /v1beta/models?pageSize=1`), `ia_chave_estado`, `ia_chave_remover` e `ia_gerar` (60 s, `spawn_blocking`), registrados no `lib.rs`, com o log `ia.chamada` só com tipo, duração, resultado e tokens.
**Where**: `src-tauri/src/ia.rs`
**Depends on**: T14, T15
**Reuses**: `State` + `Mutex<Interno>` como no `voz.rs`, `log` do `diagnostico.rs`
**Requirement**: IACONF-01, IACONF-04, IACONF-05, IACONF-06, IACONF-09, IAERR-01, IAERR-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `pode_chamar(ligada, chave)` recusa com `Desligada` e `SemChave` (testes Rust)
- [ ] A chave só é guardada depois do teste aceito (lógica em função testada com um resultado de teste falso)
- [ ] O evento de log não leva corpo, título, relato nem chave (teste da função que monta o evento)
- [ ] Gate passa: build

**Tests**: unit
**Gate**: build

**Commit**: `feat(ia): comandos de chave e de geração no Tauri`

---

#### T17: API e mensagens da IA no front

**What**: `api/ia.ts` (wrappers de `invoke` e os tipos de `ErroIA`) e `constants/mensagens.ts` com `mensagemDoErro` e os textos exatos da spec.
**Where**: `src/features/ia/constants/mensagens.ts`
**Depends on**: T16
**Reuses**: o padrão de `src/features/relatos/api/voz.ts`
**Requirement**: IACONF-05, IACONF-06, IAERR-01, IAERR-02, IAERR-03, IAERR-04, IAERR-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Cada `ErroIA` dá o texto exato da spec, no teste e na análise (testes em `mensagens.test.ts`)
- [ ] Erro desconhecido cai em "A resposta do Gemini veio incompleta. Tente de novo." (teste)
- [ ] Gate passa: quick
- [ ] Contagem do front ≥ anterior + 9

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ia): api e mensagens de erro da IA no front`

---

#### T18: Hook da IA

**What**: `useIA` com `ligada` (preferência + chave), a sincronização de `ia_configurar`, uma chamada por tipo de cada vez e o descarte da resposta se a IA desligar no meio.
**Where**: `src/features/ia/hooks/useIA.ts`
**Depends on**: T17
**Reuses**: o padrão de `useVoz` (`tentar`, `registrarEvento`)
**Requirement**: IACONF-01, INSD-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Com a preferência desligada, `gerar` não chama o Rust
- [ ] Duas chamadas seguidas do mesmo tipo resultam em uma só
- [ ] Gate passa: build

**Tests**: none
**Gate**: build

**Commit**: `feat(ia): hook com estado da IA e uma chamada por vez`

---

#### T19: Consentimento da IA

**What**: `DialogConsentimento` com a lista do que é enviado (áudio incluído), o aviso do plano gratuito e "Concordo e ligar" / "Cancelar".
**Where**: `src/features/ia/components/DialogConsentimento.tsx`
**Depends on**: None
**Reuses**: `src/shared/ui/dialog.tsx`, o estilo de `DialogMeta`
**Requirement**: IACONF-02, IACONF-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] O diálogo lista os itens da suposição "O que é enviado" e o aviso do plano gratuito
- [ ] "Cancelar" fecha sem ligar; "Concordo e ligar" devolve o consentimento
- [ ] Gate passa: build

**Tests**: none
**Gate**: build

**Commit**: `feat(ia): diálogo de consentimento`

---

#### T20: Cartão da IA nas opções

**What**: `CardIA` na `AppsPage`: interruptor "Usar IA (Gemini)", campo da chave com teste e mensagens, os 4 últimos caracteres, "Remover chave", o aviso de chave em arquivo e o "Sobre você" (`maxLength` 2000).
**Where**: `src/features/ia/components/CardIA.tsx`
**Depends on**: T18, T19
**Reuses**: `CardPreferencias`, `useIA`, `mensagemDoErro`
**Requirement**: IACONF-08, IACONF-09, IACONF-10, IACONF-11

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Ligar abre o consentimento; sem chave aceita, a IA não liga
- [ ] Remover a chave desliga a IA
- [ ] O "Sobre você" não passa de 2.000 caracteres e é salvo nas preferências
- [ ] Gate passa: build (última da fase)

**Tests**: none
**Gate**: build

**Commit**: `feat(ia): cartão da IA nas opções`

---

### Phase 4: Insight do dia

#### T21: Linha do tempo para o prompt

**What**: `gruposParaPrompt(resumo, limite = 200)` com os ids `g1…`, rótulo, programa, título mais longo (120 caracteres), tipo atual, minutos e até 20 intervalos `HH:MM-HH:MM`, sem grupos fixos e ausentes, e o resto numa linha "outros".
**Where**: `src/features/ia/utils/linha-do-tempo.ts`
**Depends on**: T10
**Reuses**: `resumir`, `Grupo`, `TituloNoGrupo`, `formatarHM`
**Requirement**: INSD-02, INSD-12

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] 250 grupos viram 200 + "outros" com a soma certa (teste)
- [ ] Grupos `fixo` e `ausente` ficam de fora (teste)
- [ ] O título passa de 120 caracteres cortado, e os intervalos ficam em 20 (testes)
- [ ] O mapa de ids traduz `g1` de volta para a `chave` (teste)
- [ ] Gate passa: quick
- [ ] Contagem do front ≥ anterior + 5

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ia): linha do tempo do dia para o prompt`

---

#### T22: Pedido do insight do dia

**What**: `montarPedidoDoDia` com `REGRAS_DE_TOM`, o "Sobre você", as matérias (`m1…`), as metas da semana, os objetivos, o relato inicial, os itens da Rotina com horário do dia, os grupos e as pausas, mais o esquema da resposta.
**Where**: `src/features/ia/utils/prompts.ts`
**Depends on**: T21
**Reuses**: `objetivosDoDia`, `relatoDoDia`, `gruposParaPrompt`, `temHorario`
**Requirement**: INSD-02, INSD-09, IACONF-11

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] A instrução pede pt-BR e proíbe "perdido", "fracasso" e "falha" (teste)
- [ ] A entrada traz o "Sobre você", o relato inicial, os itens da Rotina do dia e os objetivos com o tipo (testes)
- [ ] Nenhum UUID de matéria ou objetivo aparece na entrada (teste)
- [ ] O esquema tem `texto` e `sugestoes` com o enum de tipos (teste)
- [ ] Gate passa: quick
- [ ] Contagem do front ≥ anterior + 5

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ia): pedido do insight do dia`

---

#### T23: Leitura da resposta do dia

**What**: `lerRespostaDoDia(texto, mapa)` devolve o texto e as `SugestaoIA` válidas, ou `null` se o JSON não fechar.
**Where**: `src/features/ia/utils/respostas.ts`
**Depends on**: T22
**Reuses**: `MapaIds` de `prompts.ts`, `PREFIXO_MATERIA`
**Requirement**: INSD-04, INSD-13

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Grupo inexistente, matéria inexistente e tipo fora do enum são descartados, e o resto fica (testes)
- [ ] Estudo com matéria vira o ajuste `materia:<id>` (teste)
- [ ] O motivo é cortado em 140 caracteres (teste)
- [ ] JSON quebrado ou sem `texto` dá `null` (teste)
- [ ] Gate passa: quick
- [ ] Contagem do front ≥ anterior + 5

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ia): leitura e validação da resposta do dia`

---

#### T24: Insights no reducer

**What**: As ações `insight/salvar` (substitui o do mesmo dia ou da mesma semana) e `insight/recusar` (`{ dia, chave }`).
**Where**: `src/store/reducer/dados-reducer.ts`
**Depends on**: None
**Reuses**: o padrão das ações `relato/salvar` e `objetivos/salvar`
**Requirement**: INSD-10, INSD-11, INSS-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Salvar o insight de um dia que já tem um substitui, sem duplicar (teste)
- [ ] O insight da semana é guardado pela segunda-feira (teste)
- [ ] Recusar marca só a sugestão daquela chave (teste)
- [ ] Gate passa: quick
- [ ] Contagem do front ≥ anterior + 3

**Tests**: unit
**Gate**: quick

**Commit**: `feat(dados): ações de salvar e recusar insights`

---

#### T25: Sugestões nos grupos do relato

**What**: `sugestoes.ts` com `aceitar`, `aceitarTodas` e `estadoDaSugestao` (aceita = ajuste igual; recusada; pendente) e, no `GruposDoDia`, a marca "Sugestão da IA" com o tipo, o motivo, "Aceitar" e "Recusar".
**Where**: `src/features/ia/utils/sugestoes.ts`
**Depends on**: T23, T24
**Reuses**: `GruposDoDia`, `onAjustar`, `ajustesMudados`
**Requirement**: INSD-04, INSD-05, INSD-06, INSD-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Sem aceitar, os ajustes não mudam (teste)
- [ ] `aceitar` aplica o ajuste daquele grupo (teste)
- [ ] `aceitarTodas` pula as recusadas e as já aceitas (teste)
- [ ] Os grupos mostram a sugestão e os dois botões
- [ ] Gate passa: quick
- [ ] Contagem do front ≥ anterior + 4

**Tests**: unit
**Gate**: quick

**Commit**: `feat(relatos): sugestões da IA nos grupos do relato`

---

#### T26: Insight do dia no relato final

**What**: `InsightDoDia` no `RelatoPage`: "Analisar o dia com IA" (dias com sessão), "Analisando o dia…", o texto, os totais de estudo, trabalho e fora calculados pelo app, "Aceitar todas", "Gerar de novo" e as mensagens de erro, sem mexer no relato quando falha.
**Where**: `src/features/ia/components/InsightDoDia.tsx`
**Depends on**: T22, T23, T24, T25, T18
**Reuses**: `useIA`, `useResumoDoDia`, `CaixaDestaque`, `mensagemDoErro`
**Requirement**: INSD-01, INSD-03, INSD-08, INSD-10, INSD-11, IAERR-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] O botão só aparece com a IA ligada e com sessão no dia
- [ ] O insight salvo volta ao reabrir o relato; "Gerar de novo" substitui e mantém as correções aceitas
- [ ] Com erro, o relato continua editável e salvável
- [ ] Gate passa: build (última da fase)

**Tests**: none
**Gate**: build

**Commit**: `feat(relatos): insight do dia com IA no relato final`

---

### Phase 5: Plano do dia pela IA

#### T27: Pedido do plano

**What**: `montarPedidoDoPlano(dados, dia, texto)` com o "Sobre você", as matérias (`m1…`, nome e termos), os objetivos do dia e o esquema `{ objetivos: { tipo, materia, titulo, termos }[] }`.
**Where**: `src/features/ia/utils/prompts.ts`
**Depends on**: T22
**Reuses**: `MapaIds`, `objetivosDoDia`, `termosDaMateria`
**Requirement**: PLANO-01, IACONF-11

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] A entrada traz o texto do plano, o "Sobre você" e as matérias com os termos (teste)
- [ ] O esquema limita `tipo` a `estudo` e `trabalho` (teste)
- [ ] Gate passa: quick
- [ ] Contagem do front ≥ anterior + 2

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ia): pedido do plano do dia`

---

#### T28: Leitura da resposta do plano

**What**: `lerRespostaDoPlano(texto, mapa, dados, dia)` devolve os `Objetivo` novos com `origem: 'relato'`.
**Where**: `src/features/ia/utils/respostas.ts`
**Depends on**: T27
**Reuses**: `normalizar`, `objetivosDoDia`
**Requirement**: PLANO-02, PLANO-03, PLANO-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Matéria inexistente vira objetivo de estudo com título livre (teste)
- [ ] Tipo que não é estudo nem trabalho sai (teste)
- [ ] Matéria ou título que o dia já tem não duplica, sem diferenciar acento e caixa (testes)
- [ ] Objetivo de trabalho sai com `tipo: 'trabalho'`, título e termos (teste)
- [ ] Gate passa: quick
- [ ] Contagem do front ≥ anterior + 5

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ia): leitura da resposta do plano`

---

#### T29: Plano pela IA no relato inicial

**What**: Com a IA ligada, `CartaoRelatoInicial` monta os objetivos pela IA; em falha, pelo `sugerirObjetivos` com a mensagem da spec; o "Entrou nos objetivos do dia:" mostra o tipo; plano vazio não chama a IA.
**Where**: `src/features/hoje/components/CartaoRelatoInicial.tsx`
**Depends on**: T28, T18
**Reuses**: `sugerirObjetivos`, `nomeDoObjetivo`, `useIA`
**Requirement**: PLANO-01, PLANO-05, PLANO-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Plano salvo com a IA ligada cria objetivos de estudo e de trabalho
- [ ] Falha da IA cai na busca de palavras com a mensagem exata
- [ ] "Pular hoje" não chama a IA
- [ ] Gate passa: build (última da fase)

**Tests**: none
**Gate**: build

**Commit**: `feat(hoje): plano do dia montado pela IA`

---

### Phase 6: Voz ao vivo e saída do Whisper

#### T30: Protocolo da transcrição ao vivo

**What**: Funções puras no `voz.rs`: `para_pcm16`, `Pedacos` (pedaços de 3.200 bytes), `mensagem_setup` (`gemini-3.5-transcribe-live`, `pt-BR`, até 100 termos), `mensagem_audio`, `mensagem_fim` e `ler_mensagem` (`interimInputTranscription` e `inputTranscription`); entram `base64`, `tokio-tungstenite` e `tokio`.
**Where**: `src-tauri/src/voz.rs`
**Depends on**: None
**Reuses**: `reamostrar` e os testes atuais
**Requirement**: VOZ-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] -1.0, 0 e 1.0 viram os i16 LE certos (teste Rust)
- [ ] 4.000 bytes dão um pedaço de 3.200 e guardam 800 (teste Rust)
- [ ] O `setup` tem o modelo, `pt-BR` e no máximo 100 termos (teste Rust)
- [ ] `ler_mensagem` separa o texto parcial do final e ignora outras mensagens (testes Rust)
- [ ] Gate passa: full

**Tests**: unit
**Gate**: full

**Commit**: `feat(voz): protocolo da transcrição ao vivo do Gemini`

---

#### T31: Sessão de voz ao vivo no lugar do Whisper

**What**: `voz_iniciar`, `voz_parar`, `voz_cancelar` e `voz_estado` com cpal → `mpsc` → tarefa com `select!` (envio de 100 ms e leitura do socket), header `x-goog-api-key`, eventos `voz:parcial` e `voz:erro`, fim aos 10 minutos e nada em disco; saem o Whisper, o download, o `sha2`, o `whisper-rs` e a feature `voz` do `Cargo.toml`, e os comandos novos entram no `lib.rs`.
**Where**: `src-tauri/src/voz.rs`
**Depends on**: T30
**Reuses**: `imp::Gravacao`, `pode_chamar` e a chave do `ia.rs`
**Requirement**: VOZ-01, VOZ-02, VOZ-03, VOZ-05, VOZ-07, VOZ-08, VOZ-09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] O acúmulo de texto (finais + parcial) e o corte de 10 minutos estão em funções testadas (testes Rust)
- [ ] Queda do socket mantém o texto acumulado e emite `voz:erro` (teste com uma sequência de mensagens falsa)
- [ ] O build sem `--features` compila a voz e não tem `whisper`
- [ ] Gate passa: build

**Tests**: unit
**Gate**: build

**Commit**: `feat(voz): transcrição ao vivo pelo Gemini no lugar do Whisper`

---

#### T32: CI e README sem a compilação `voz`

**What**: Tirar `--features voz` dos dois workflows e o trecho de CMake/LLVM do README, descrevendo a voz ao vivo e a IA.
**Where**: `.github/workflows/build-teste.yml`
**Depends on**: T31
**Reuses**: os passos atuais do CI
**Requirement**: VOZ-09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Nenhum `--features voz` em `.github/workflows/` (`build-teste.yml` e `release.yml`)
- [ ] O README descreve a IA com chave própria e a voz ao vivo
- [ ] Gate passa: build

**Tests**: none
**Gate**: build

**Commit**: `ci: compila a voz sem a feature voz`

---

#### T33: Apagar os modelos do Whisper

**What**: `apagar_modelos_antigos(pasta)` no `setup`, que remove a pasta dos modelos se existir e registra `voz.modelos_apagados`.
**Where**: `src-tauri/src/lib.rs`
**Depends on**: T31
**Reuses**: o caminho da pasta dos modelos (`app_data_dir` + `modelos`)
**Requirement**: VOZ-10

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Numa pasta temporária com um modelo falso, a função apaga a pasta (teste Rust)
- [ ] Sem a pasta, a função não falha (teste Rust)
- [ ] Gate passa: full

**Tests**: unit
**Gate**: full

**Commit**: `feat(voz): apaga os modelos do Whisper já baixados`

---

#### T34: Voz ao vivo no front

**What**: `api/voz.ts` e `useVoz` com `voz_iniciar`, os eventos `voz:parcial` e `voz:erro` e `juntarTranscricao(atual, final, parcial)`, sem modelo nem download.
**Where**: `src/features/relatos/hooks/useVoz.ts`
**Depends on**: T31
**Reuses**: `listen` de `@tauri-apps/api/event`, `useIA`, `mensagemDoErro`
**Requirement**: VOZ-02, VOZ-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `juntarTranscricao` junta ao texto já escrito e troca o parcial pelo final (testes em `voz.test.ts`)
- [ ] Depois de `voz:erro`, o texto acumulado continua (teste da função)
- [ ] Gate passa: quick
- [ ] Contagem do front ≥ anterior + 3

**Tests**: unit
**Gate**: quick

**Commit**: `feat(relatos): voz ao vivo no front`

---

#### T35: Campo do relato com a voz ao vivo

**What**: `CampoRelato` mostra o texto ao vivo, sem o fluxo de download, com "Falar" desabilitado e "Ligue a IA nas opções para falar." quando a IA está desligada, e as mensagens de microfone e de conexão.
**Where**: `src/features/relatos/components/CampoRelato.tsx`
**Depends on**: T34
**Reuses**: `useVoz`, `Button`, `Mic`
**Requirement**: VOZ-01, VOZ-06, VOZ-07, VOZ-09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] O texto parcial aparece no campo durante a fala e fica editável depois
- [ ] Com a IA desligada, o botão aparece desabilitado com a mensagem exata
- [ ] Nenhum texto de download ou de modelo sobra na tela
- [ ] Gate passa: build

**Tests**: none
**Gate**: build

**Commit**: `feat(relatos): campo do relato com a voz ao vivo`

---

#### T36: Tirar o modelo de voz das preferências

**What**: `Preferencias` perde `modeloVoz`, `atualizarDados` remove o campo de dados salvos, e as opções (`CardPreferencias`) perdem a escolha do modelo.
**Where**: `src/store/model/migracao.ts`
**Depends on**: T35
**Reuses**: `atualizarDados`
**Requirement**: VOZ-09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Preferências salvas com `modeloVoz` abrem sem o campo e com o resto igual (teste)
- [ ] Nenhuma referência a `modeloVoz` ou `ModeloVoz` sobra no código
- [ ] Gate passa: build (última da fase)
- [ ] Contagem do front ≥ anterior + 1

**Tests**: unit
**Gate**: build

**Commit**: `refactor(dados): tira o modelo de voz das preferências`

---

### Phase 7: Insight da semana

#### T37: Pedido do insight da semana

**What**: `montarPedidoDaSemana(dados, semana)` com `REGRAS_DE_TOM`, o "Sobre você", as matérias com as metas e as horas validadas, os itens da Rotina com horário e, por dia, os objetivos, os relatos com o humor, os totais e o insight do dia salvo; o esquema tem `comoFoi`, `padroes` e `proximaSemana`.
**Where**: `src/features/ia/utils/prompts.ts`
**Depends on**: T22
**Reuses**: `linhasPorDia`, `evolucao`/`banco.ts`, `relatoDoDia`
**Requirement**: INSS-02, INSS-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] A entrada traz os sete dias com os relatos inicial e final e o humor (teste)
- [ ] O insight do dia salvo entra quando existe (teste)
- [ ] As regras de tom são as mesmas do dia (teste)
- [ ] Gate passa: quick
- [ ] Contagem do front ≥ anterior + 3

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ia): pedido do insight da semana`

---

#### T38: Leitura da resposta da semana

**What**: `lerRespostaDaSemana(texto)` devolve as três partes ou `null`.
**Where**: `src/features/ia/utils/respostas.ts`
**Depends on**: T37
**Reuses**: o padrão de `lerRespostaDoDia`
**Requirement**: INSS-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] JSON com as três partes dá as partes (teste)
- [ ] Parte faltando ou JSON quebrado dá `null` (testes)
- [ ] Gate passa: quick
- [ ] Contagem do front ≥ anterior + 2

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ia): leitura da resposta da semana`

---

#### T39: Insight da semana na Autoanálise

**What**: `semanaPadrao(hoje)` e `semanaTemRegistros(dados, semana)` em `semana.ts`, e o `InsightDaSemana` na `AutoanalisePage` com a escolha da semana, "Analisar a semana", as três partes, "Gerar de novo" e o estado vazio.
**Where**: `src/features/ia/components/InsightDaSemana.tsx`
**Depends on**: T38, T24, T18
**Reuses**: `inicioDaSemana`, `somarDias`, `useIA`, `ControleSegmentado`
**Requirement**: INSS-01, INSS-03, INSS-04, INSS-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `semanaPadrao` dá a segunda-feira da última semana completa, inclusive num domingo e numa segunda (testes em `semana.test.ts`)
- [ ] `semanaTemRegistros` é falso sem sessão nem relato (teste)
- [ ] Semana vazia mostra o botão desabilitado com "Sem dias registrados nesta semana"
- [ ] Gate passa: build (última da feature)
- [ ] Contagem do front ≥ anterior + 3

**Tests**: unit
**Gate**: build

**Commit**: `feat(autoanalise): insight da semana com IA`

---

## Phase Execution Map

Fases em sequência, e as tarefas de cada fase em ordem (as setas de dependência estão no Execution Plan).

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7

Phase 1:  T1, T2, T3, T4, T5, T6, T7, T8          (8)
Phase 2:  T9, T10, T11, T12, T13                   (5)
Phase 3:  T14, T15, T16, T17, T18, T19, T20        (7)
Phase 4:  T21, T22, T23, T24, T25, T26             (6)
Phase 5:  T27, T28, T29                            (3)
Phase 6:  T30, T31, T32, T33, T34, T35, T36        (7)
Phase 7:  T37, T38, T39                            (3)
```

Execution is strictly sequential - there is no intra-phase parallelism. A single agent (or batch worker) works one task at a time, in order. São 39 tarefas: no Execute, o orquestrador oferece os workers por lote (cerca de 7 tarefas, fases inteiras) antes de começar.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1 | Tipo novo + totais do resumo (o compilador aponta os `Record<Tipo>`) | ⚠️ Coeso: uma mudança de tipo que se espalha |
| T2 | Formato 4 (tipos + conversão) | ⚠️ Coeso: o modelo e a conversão andam juntos |
| T3, T4, T9, T14, T21, T22, T23, T24, T27, T28, T30, T37, T38 | 1 função ou 1 módulo de funções | ✅ Granular |
| T5, T6, T8, T13, T19, T20, T26, T29, T35 | 1 componente | ✅ Granular |
| T7 | Faixa + token de cor + exibição do total | ⚠️ Coeso: o mesmo dado em duas telas |
| T10 | `classificar` + `resumir` usando o expediente | ⚠️ Coeso: a ordem da classificação |
| T11 | Config do Rust + o envio dela pelo front | ⚠️ Coeso: o contrato TS ↔ Rust |
| T12, T15, T16, T17, T18, T33, T34, T36 | 1 ação, 1 módulo ou 1 hook | ✅ Granular |
| T25 | Util de sugestões + a marca no grupo | ⚠️ Coeso: a lógica testada e o seu uso |
| T31 | Sessão ao vivo + saída do Whisper do mesmo arquivo e do `Cargo.toml` | ⚠️ Coeso: trocar a implementação da voz |
| T32 | Dois workflows + README | ⚠️ Coeso: a mesma remoção de flag |
| T39 | Util de semana + componente | ⚠️ Coeso: a lógica testada e o seu uso |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | (início) | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T1 | T1 → T4 | ✅ Match |
| T5 | T1 | T1 → T5 | ✅ Match |
| T6 | T1 | T1 → T6 | ✅ Match |
| T7 | T1 | T1 → T7 | ✅ Match |
| T8 | T2, T3 | T2 → T8, T3 → T8 | ✅ Match |
| T9 | None | (início) | ✅ Match |
| T10 | T9, T3 (fase 1) | T9 → T10 | ✅ Match (T3 é de fase anterior) |
| T11 | T9 | T9 → T11 | ✅ Match |
| T12 | T10 | T10 → T12 | ✅ Match |
| T13 | T9 | T9 → T13 | ✅ Match |
| T14 | None | (início) | ✅ Match |
| T15 | None | (início) | ✅ Match |
| T16 | T14, T15 | T14 → T16, T15 → T16 | ✅ Match |
| T17 | T16 | T16 → T17 | ✅ Match |
| T18 | T17 | T17 → T18 | ✅ Match |
| T19 | None | (início) | ✅ Match |
| T20 | T18, T19 | T18 → T20, T19 → T20 | ✅ Match |
| T21 | T10 (fase 2) | (início) | ✅ Match |
| T22 | T21 | T21 → T22 | ✅ Match |
| T23 | T22 | T22 → T23 | ✅ Match |
| T24 | None | (início) | ✅ Match |
| T25 | T23, T24 | T23 → T25, T24 → T25 | ✅ Match |
| T26 | T22, T23, T24, T25, T18 (fase 3) | T22/T23/T24/T25 → T26 | ✅ Match |
| T27 | T22 (fase 4) | (início) | ✅ Match |
| T28 | T27 | T27 → T28 | ✅ Match |
| T29 | T28, T18 (fase 3) | T28 → T29 | ✅ Match |
| T30 | None | (início) | ✅ Match |
| T31 | T30 | T30 → T31 | ✅ Match |
| T32 | T31 | T31 → T32 | ✅ Match |
| T33 | T31 | T31 → T33 | ✅ Match |
| T34 | T31 | T31 → T34 | ✅ Match |
| T35 | T34 | T34 → T35 | ✅ Match |
| T36 | T35 | T35 → T36 | ✅ Match |
| T37 | T22 (fase 4) | (início) | ✅ Match |
| T38 | T37 | T37 → T38 | ✅ Match |
| T39 | T38, T24 (fase 4), T18 (fase 3) | T38 → T39 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Domínio TS (resumo) | unit | unit | ✅ OK |
| T2 | Modelo e migração | unit | unit | ✅ OK |
| T3 | Domínio TS (classificação) | unit | unit | ✅ OK |
| T4 | Domínio TS (autoanálise) | unit | unit | ✅ OK |
| T5 | Componente | none | none | ✅ OK |
| T6 | Componente | none | none | ✅ OK |
| T7 | Componente + CSS | none | none | ✅ OK |
| T8 | Componente | none | none | ✅ OK |
| T9 | Domínio TS (expediente) | unit | unit | ✅ OK |
| T10 | Domínio TS (classificação, resumo) | unit | unit | ✅ OK |
| T11 | Função pura do Rust + domínio TS | unit | unit | ✅ OK |
| T12 | Reducer | unit | unit | ✅ OK |
| T13 | Domínio TS (predicado) + componente | unit | unit | ✅ OK |
| T14 | Funções puras do Rust | unit | unit | ✅ OK |
| T15 | Funções puras do Rust (cofre em arquivo) | unit | unit | ✅ OK |
| T16 | Comandos com I/O + funções puras extraídas | unit | unit | ✅ OK |
| T17 | Domínio TS (mensagens) + wrapper de `invoke` | unit | unit | ✅ OK |
| T18 | Hook | none | none | ✅ OK |
| T19 | Componente | none | none | ✅ OK |
| T20 | Componente | none | none | ✅ OK |
| T21 | Domínio TS | unit | unit | ✅ OK |
| T22 | Domínio TS | unit | unit | ✅ OK |
| T23 | Domínio TS | unit | unit | ✅ OK |
| T24 | Reducer | unit | unit | ✅ OK |
| T25 | Domínio TS + componente | unit | unit | ✅ OK |
| T26 | Componente | none | none | ✅ OK |
| T27 | Domínio TS | unit | unit | ✅ OK |
| T28 | Domínio TS | unit | unit | ✅ OK |
| T29 | Componente | none | none | ✅ OK |
| T30 | Funções puras do Rust | unit | unit | ✅ OK |
| T31 | Comandos com I/O + funções puras extraídas | unit | unit | ✅ OK |
| T32 | Config, CI e docs | none | none | ✅ OK |
| T33 | Função do Rust (arquivos) | unit | unit | ✅ OK |
| T34 | Domínio TS (junção do texto) + hook | unit | unit | ✅ OK |
| T35 | Componente | none | none | ✅ OK |
| T36 | Modelo e migração + componente | unit | unit | ✅ OK |
| T37 | Domínio TS | unit | unit | ✅ OK |
| T38 | Domínio TS | unit | unit | ✅ OK |
| T39 | Domínio TS (semana) + componente | unit | unit | ✅ OK |
