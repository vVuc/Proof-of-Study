# IA com Gemini — relatório de validação (iteração 3 de 3, a última)

## Validation: ia-gemini - FAIL ❌

**Data**: 2026-10-17
**Spec**: `.specs/features/ia-gemini/spec.md` (68 ACs; o critério de sucesso do log ajustado em `a0fc12c` e `7e07b81`)
**Intervalo do diff**: `ca77d69..HEAD` (HEAD = `7e07b81`), 50 commits (`a204dd0` … `7e07b81`), 67 arquivos, +6.910 / −856
**Verificador**: sub-agente independente (autor ≠ verificador), somente leitura sobre a árvore real; mutações só numa cópia isolada (`git worktree`)

**Decisão da pessoa (2026-10-17)**: a lacuna de `expediente.ts:51` foi **aceita como está**, sem nova rodada do verificador. O veredito permanece **FAIL**, por regra: o protocolo só fecha a feature com zero mutantes sobreviventes. A feature fica em aberto com este único sobrevivente de gravidade Minor, e o UAT no app continua pendente (ver a seção de pendências).

**Por que FAIL**: os cinco gates passam, os 68 ACs têm evidência `arquivo:linha` e os dois sobreviventes da iteração 2 morrem agora (o começo do expediente no TS, `classificacao.ts:139`, e no Rust, `rastreador.rs:495`). Os mutantes obrigatórios (a), (b), (d) e (e) morrem. Sobra **um sobrevivente**, no lugar exato que o pedido da iteração 3 nomeou para o mutante (c):

- **`dividirPorExpediente`, `src/features/rotina/utils/expediente.ts:51`**: com `a <= ms` trocado por `a < ms`, os 155 testes passam. O teste da unidade (`expediente.test.ts:78-89`) confere o campo `expediente` dos pedaços às 17h, às 18h e às 20h, mas nunca no pedaço que começa no instante em que o expediente abre. Um assert mata o mutante (prova feita na cópia, abaixo).
- **Gravidade: Minor, sem efeito em nenhum AC hoje.** Nenhum código de produção lê esse campo: `resumo.ts:81-83`, `insights.ts:31-32` e `linha-do-tempo.ts:62-63` cortam os trechos com `dividirPorExpediente` e depois classificam cada pedaço com `classificar`, que decide pelo `noExpediente` (`classificacao.ts:138-139`). É nesse ponto que a borda decide o EXPED-01, e lá o mutante equivalente (c') morre pelo teste novo `resumo.test.ts:144`. O código está certo nos dois lugares.
- **Por que conta como lacuna**: o mutante pode ser morto por um teste da unidade (não é equivalente para a função), o design define `dividirPorExpediente(...): (Trecho & { expediente: boolean })[]` (`design.md:148`), a matriz de `tasks.md:23` pede "todos os ramos" na lógica de domínio e o `validate.md` manda não fechar a feature com mutante sobrevivente.

Esta é a última iteração. A lacuna é exatamente essa, e o que fazer com ela (aceitar, um assert no `expediente.test.ts` ou tirar o campo sem leitor) é decisão da pessoa.

---

## Correções desta iteração e das anteriores, conferidas com evidência

| Correção | Commit | Evidência | Resultado |
| -------- | ------ | --------- | --------- |
| EXPED-01, começo do expediente no TS | `38e970a` | `src/features/sessao/utils/resumo.test.ts:144-155`: VS Code das 8h30 às 9h30 com expediente das 9h às 18h; `toEqual({ 'regra:vscode': ['estudo', 30 * MIN], 'expediente:regra:vscode': ['trabalho', 30 * MIN] })`, `trabalhoMs` `30 * MIN`, `focoMs` `30 * MIN` | ✅ mata o (c') (`a <= inicio` → `a < inicio` em `classificacao.ts:139`, o F4 da iteração 2): `expected { 'regra:vscode': [ 'estudo', …(1) ] } to deeply equal { …(2) }`. ⚠️ Não mata a variante no `expediente.ts:51` (campo `expediente`, sem leitor) |
| EXPED-03, começo e fim do expediente no Rust | `38e970a` | `src-tauri/src/rastreador.rs:1143-1152`: `:1148` `assert!(em_expediente(&cfg, nove()))`, `:1149` `assert!(!em_expediente(&cfg, nove() - 1))`, `:1150` `assert!(em_expediente(&cfg, fim - 1))`, `:1151` `assert!(!em_expediente(&cfg, fim))` | ✅ mata o (d) (pânico em `:1148`) e o (b) (pânico em `:1151`) |
| Critério do log do teste da chave | `7e07b81` | `spec.md:57` e `:344`: "tipo, duração e resultado"; bate com o IAERR-06 e com `ia.rs:266` `json!({ "tipo", "ms", "resultado", "tokens" })` e `ia.rs:512` (`"tipo": "teste", "ms": 300`) | ✅ a redação agora pede a duração. Detalhe: o evento do teste leva também `"tokens": null` (campo do design `design.md:111`, vazio no teste); nenhum conteúdo nem a chave entram |
| EXPED-07: item de Trabalho que muda de categoria | `4a6e1ca` | `src/store/reducer/dados-reducer.test.ts:47-50` `toMatchObject({ focoMs: HORA, trabalhoMs: 0 })` | ✅ o (a) continua morto, nesse teste |
| Borda do fim do expediente no Rust | `4a6e1ca` | `rastreador.rs:1150-1151` | ✅ o (b) continua morto |
| "Tom neutro e descritivo" (INSD-09) | `4a6e1ca` | `src/features/ia/utils/prompts.test.ts:87` `expect(REGRAS_DE_TOM).toContain('tom neutro e descritivo')` | ✅ F19 continua morto |
| `ErroIA::Resposta` no 400 sem chave | `4a6e1ca` | `src-tauri/src/ia.rs:452` `assert_eq!(erro_do_status(400, "...Invalid JSON payload..."), ErroIA::Resposta)` | ✅ o (e) continua morto: `left: Indisponivel, right: Resposta` |
| README no formato 4 | `c2d37cc` | `README.md:64` | ✅ (cosmético: cita `dados.v2.bak.json` e `dados.v3.bak.json`; os dados do formato 1 geram `dados.v1.bak.json`, `src-tauri/src/diagnostico.rs:30`) |

---

## Tarefas

| Fase | Tarefas | Status | Observação |
| ---- | ------- | ------ | ---------- |
| 1: Formato 4 e tipo Trabalho | T1–T8 | ✅ 8/8 | - |
| 2: Horário de trabalho | T9–T13 | ✅ 5/5 | Testes de borda em `4a6e1ca` e `38e970a`; resta o campo `expediente` do `dividirPorExpediente` sem teste no começo |
| 3: Gateway e configuração | T14–T20 | ✅ 7/7 | - |
| 4: Insight do dia | T21–T26 | ✅ 6/6 | - |
| 5: Plano pela IA | T27–T29 | ✅ 3/3 | - |
| 6: Voz ao vivo | T30–T36 | ✅ 7/7 | - |
| 7: Insight da semana | T37–T39 | ✅ 3/3 | - |

`tasks.md` tem as 39 tarefas com `**Status**: ✅ Concluída` e nenhuma caixa `- [ ]` aberta.

---

## Gates (árvore real, `7e07b81`)

| Gate | Comando | Resultado |
| ---- | ------- | --------- |
| Lint | `npm run lint` (oxlint) | exit 0: **0 erros**, 7 avisos, todos de antes da feature (`BarraLateral.tsx:47`, `RotinaPage.tsx:24`, `button.tsx:66`, `partes.tsx:8`, `partes.tsx:37`, `PopoverCaptura.tsx:10`, `BancoPage.tsx:29`) |
| Tipos | `npx tsc -b` | exit 0 |
| Front | `npx vitest run` | **15 arquivos, 155 testes passam**, 0 falham, 0 pulados |
| Rust | `cargo test --manifest-path src-tauri/Cargo.toml` | **49 passam** (lib), 0 falham, 0 ignorados; `main` 0 e doc 0 |
| Clippy | `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | exit 0 |

- **Antes da feature** (`ca77d69`): 53 testes no front e 25 `#[test]` no Rust (19 em `rastreador.rs`, 4 em `voz.rs`, 1 em `diagnostico.rs`, 1 em `janela.rs`).
- **Depois** (`7e07b81`): 155 no front (+102) e 49 no Rust (+24: 10 em `ia.rs`, 7 em `voz.rs`, 5 em `rastreador.rs`, 2 em `lib.rs`). Em relação à iteração 2: +1 no front (`resumo.test.ts:144`); no Rust, o teste `a_borda_do_expediente_fecha_no_fim` virou `a_borda_do_expediente_abre_no_inicio_e_fecha_no_fim`, com dois asserts a mais.
- **Asserções afrouxadas**: nenhuma. O literal 4 → 5 de `migracao.test.ts:160` é o desvio aprovado.

---

## Verificação ancorada na spec (Check A, evidência ou zero)

Legenda: ✅ = o teste confere o valor que a spec define. 📖 = verificado por leitura do código, sem teste (a matriz de `tasks.md` diz `none` para telas e hooks). ⚠️ = evidência parcial ou spec sem valor exato. Os mutantes citados estão na seção do sensor.

### P1: Ligar a IA com a minha chave

| AC | Resultado definido pela spec | Evidência `arquivo:linha` + assert | Resultado |
| -- | ---------------------------- | ---------------------------------- | --------- |
| IACONF-01 | Desligada por padrão; nenhuma chamada desligada, exceto o teste da chave | `src/store/model/migracao.test.ts:183` `toMatchObject({ ia: false, consentimentoIA: null, ... })`; `src-tauri/src/ia.rs:483` `assert_eq!(pode_chamar(false, Some(CHAVE_FALSA)), Err(ErroIA::Desligada))`; 📖 `ia.rs:394` e `src-tauri/src/voz.rs:521` (`chave_da_chamada`), `src/features/ia/hooks/useIA.ts:62` (o front não chama sem a IA); exceção: `ia.rs:357-379` (o teste da chave não olha `ligada`) | ✅ (R10 morto) |
| IACONF-02 | Consentimento com a lista (com o áudio), o aviso do plano gratuito, "Concordo e ligar" e "Cancelar" | 📖 `src/features/ia/components/DialogConsentimento.tsx:7-15` (lista; áudio em `:14`), `:39-42` (aviso), `:44-49` (botões); `src/features/ia/components/CardIA.tsx:100` (ligar abre o diálogo) | ✅ 📖 |
| IACONF-03 | "Cancelar" mantém a IA desligada | 📖 `CardIA.tsx:125` (`onCancelar` só fecha), `DialogConsentimento.tsx:27` (fechar = cancelar) | ✅ 📖 |
| IACONF-04 | Testa com o Gemini e só guarda se ele aceita | `ia.rs:496-497` `assert_eq!(resultado, Err(recusa)); assert!(!guardou)`; `:504-505` `assert_eq!(guardada.as_deref(), Some(CHAVE_FALSA))`; 📖 `ia.rs:301-303` (`GET /models` com o header) | ✅ (R11 morto) |
| IACONF-05 | "O Gemini recusou esta chave. Confira se ela foi copiada inteira." e a IA desligada | `src/features/ia/constants/mensagens.test.ts:8,11` `expect(mensagemDoErro({ tipo }, 'teste')).toBe(texto)`; `ia.rs:449-451` (401, 403 e 400 com "API key" → `Chave`); 📖 `CardIA.tsx:99` (sem chave salva, o interruptor fica desabilitado) | ✅ (R5 e R6 mortos) |
| IACONF-06 | "Sem conexão com o Gemini. A chave não foi salva." e a IA desligada | `mensagens.test.ts:9,11`; `ia.rs:490-497` (`Conexao` não guarda); `ia.rs:521-522` (`HostNotFound` e `ConnectionFailed` → `Conexao`) | ✅ (F21 morto) |
| IACONF-07 | Chave fora do `dados.json`, nunca no log nem no diagnóstico | `ia.rs:466-467` (arquivo próprio `ia-chave`); `ia.rs:510-515` `assert_eq!(evento_da_chamada(...), json!({ "tipo", "ms", "resultado", "tokens" }))`; 📖 `ia.rs:104-195` (cofre ou arquivo), `voz.rs:315` (header `x-goog-api-key`, fora da URL), `diagnostico.rs:71-89` (só tamanhos e o fim do log) | ✅ (R11b morto; os arquivos reais ficam para o UAT) |
| IACONF-08 | Só os 4 últimos caracteres, com "Remover chave" | `ia.rs:459` `assert_eq!(final_da_chave(CHAVE_FALSA), "a1b2")`; 📖 `CardIA.tsx:62-67` | ✅ (R11c morto) |
| IACONF-09 | Remover apaga a chave e desliga a IA | `ia.rs:473-477` (apaga o arquivo, também sem arquivo); 📖 `ia.rs:382-389` (cofre, arquivo e `ligada = false`), `CardIA.tsx:46-51` (`mudar({ ia: false })`) | ✅ (parte 📖) |
| IACONF-10 | "Sobre você" até 2.000 caracteres, recusa além disso | 📖 `CardIA.tsx:16,110-111` (`maxLength` e `slice(0, 2000)`) | ✅ 📖 |
| IACONF-11 | "Sobre você" em todo insight e plano | `src/features/ia/utils/prompts.test.ts:93` (dia), `:153` (plano), `:257` (semana): `toBe('Sou dev na empresa X; ...')` | ✅ (F19c e F19e mortos) |

### P1: Trabalho como tipo próprio

| AC | Resultado definido pela spec | Evidência `arquivo:linha` + assert | Resultado |
| -- | ---------------------------- | ---------------------------------- | --------- |
| TRAB-01 | "Trabalho" nas regras e nas correções | 📖 `src/features/apps/components/SeletorTipo.tsx:16` (quatro tipos), `src/features/relatos/components/GruposDoDia.tsx:66` (`<SelectItem value="trabalho">`) | ✅ 📖 |
| TRAB-02 | Total de trabalho fora do foco, do fora do estudo e do banco | `src/features/sessao/utils/resumo.test.ts:84-89` (`trabalhoMs 25`, `focoMs 50`, `foraMs 0`, `porMateria` sem o trabalho), `:91-97` `totaisDaSessao` (o banco usa `focoPorMateria`), `:104-109` (regra `trabalho`), `:53-54` (objetivo de trabalho não recebe estudo) | ✅ (F7 e F8 mortos) |
| TRAB-03 | Janela de trabalho não avisa distração | `src-tauri/src/rastreador.rs:1138-1139` `assert!(distracao(&config, ...).is_none())` (regra e termo de trabalho); `src/features/hoje/utils/dia.test.ts:86` `expect(config.termos).toContain('empresa-api')` | ✅ (R4 e R4b mortos) |
| TRAB-04 | Total de trabalho na Sessão e no relato, na cor do Trabalho da Rotina | 📖 `src/features/sessao/SessaoPage.tsx:69-73`, `src/features/relatos/RelatoPage.tsx:122`, `src/features/sessao/components/partes.tsx:10` (`bg-trabalho`), `src/index.css:111` (`--trabalho: #d9d0c1`), `src/features/rotina/constants/categorias.ts:16` (`fundo: '#d9d0c1'`) | ✅ 📖 |
| TRAB-05 | Trabalho fora das distrações e do mapa de foco | `src/features/autoanalise/utils/insights.test.ts:33` (blocos), `:69-70` `toEqual({ focoMs: 20 * MIN, foraMs: 0 })`, `:77` `toEqual(['YouTube'])`, `:109` (`trabalhoMs` do dia) | ✅ (F22 morto) |
| TRAB-06 | 3 → 4 com cópia, sem mudar regras nem correções, objetivos como estudo | `migracao.test.ts:171-175` (regras, ajustes, objetivos e foco iguais), `:181` `trabalhoMs` `[0, 0]`, `:192` `toMatchObject({ tipo: 'estudo', objetivoId: 'o1' })`; 📖 cópia: `src/store/repositorio/armazenamento.ts:21-25` e `diagnostico.rs:30` | ✅ (F25 morto) |
| TRAB-07 | Escolher Estudo ou Trabalho, com Estudo por padrão | 📖 `src/features/hoje/components/CartaoObjetivos.tsx:24-25` (opções), `:37` (`useState<TipoDoObjetivo>('estudo')`), `:56` (`tipo: tipoNovo`), `:134` | ✅ 📖 |
| TRAB-08 | Termo de objetivo de trabalho vence o estudo e a regra | `src/features/sessao/utils/classificacao.test.ts:96` `toMatchObject({ tipo: 'trabalho', chave: 'objetivo:t1', objetivoId: 't1' })`, `:102-103` (vence as regras de estudo e de fora), `:108-111` (objetivo pulado não classifica) | ✅ (F5 e F6 mortos) |
| TRAB-09 | O tempo vai para o objetivo de trabalho e para o total de trabalho | `resumo.test.ts:116-119` `toEqual({ o1: 30 * MIN, t1: 40 * MIN })`, `trabalhoMs 40`; `:126-128`; 📖 `CartaoObjetivos.tsx:81` | ✅ (F8b morto) |

### P1: Horário de trabalho da Rotina

| AC | Resultado definido pela spec | Evidência `arquivo:linha` + assert | Resultado |
| -- | ---------------------------- | ---------------------------------- | --------- |
| EXPED-01 | Estudo só por regra, dentro do horário de trabalho, vira trabalho | `classificacao.test.ts:125-129` `{ tipo: 'trabalho', chave: 'expediente:regra:vscode', rotulo: 'VS Code (expediente)' }`, `:133` (às 20h continua estudo), `:145` (sem regra continua fora); `resumo.test.ts:136-141` (corte no **fim**, 18h) e **`:149-154` (corte no começo, 9h: 30 min de estudo e 30 de trabalho, novo)**; borda da spec (itens sobrepostos): `src/features/rotina/utils/expediente.test.ts:44` | ✅ a lacuna da iteração 2 está fechada (c', F2, F3 e F3c mortos). ⚠️ O campo `expediente` dos pedaços de `dividirPorExpediente` continua sem teste no começo (o mutante (c) sobrevive em `expediente.ts:51`), mas nenhum número do EXPED-01 depende dele |
| EXPED-02 | Termo de matéria ou de objetivo de estudo continua estudo | `classificacao.test.ts:137-141` `{ tipo: 'estudo', chave: 'materia:rust', materiaId: 'rust' }` | ✅ |
| EXPED-03 | Nenhum aviso de distração no horário de trabalho | `rastreador.rs:1109-1116` (nenhum aviso dentro); `:1119-1129` `assert_eq!(...count(), 1)` (avisa depois do fim); **`:1148-1151` (começo e fim)**; `dia.test.ts:85` `expect(config.expediente).toEqual([[nove, 18h]])` | ✅ a lacuna da iteração 2 está fechada ((b), (d), R3 e F26 mortos) |
| EXPED-04 | Item que passa da meia-noite vale até o fim no dia seguinte | `expediente.test.ts:34-38` (`[[19 22h, 20 0h]]` e `[[20 0h, 20 2h]]`; com a virada às 4h, `[[19 22h, 20 2h]]`) | ✅ (F9 morto) |
| EXPED-05 | Sugestão com o texto exato, o link para a Rotina e "Não mostrar de novo" | `expediente.test.ts:62` `toBe(true)`, `:66` e `:70` `toBe(false)`; 📖 `src/features/rotina/components/AvisoExpediente.tsx:21` (texto exato), `:23-25` (Rotina), `:26-32` (botão); `RelatoPage.tsx:166` | ✅ |
| EXPED-06 | "Não mostrar de novo" vale para sempre | `expediente.test.ts:74` `expect(mostrarAvisoExpediente([semHorario], MEIA_HORA, true)).toBe(false)`; 📖 `AvisoExpediente.tsx:29` | ✅ |
| EXPED-07 | Criar, mudar ou apagar um item de Trabalho recalcula só os dias sem relato final | `src/store/reducer/dados-reducer.test.ts:38` (criar), `:44` (apagar), `:50` (mudar de Trabalho para outra categoria), `:55` (dia com relato final não muda), `:63` (outra categoria não recalcula) | ✅ ((a), F10, F10b e F10c mortos) |

### P1: Insight do dia

| AC | Resultado definido pela spec | Evidência `arquivo:linha` + assert | Resultado |
| -- | ---------------------------- | ---------------------------------- | --------- |
| INSD-01 | Botão com a IA ligada e pelo menos uma sessão no dia | 📖 `src/features/ia/components/InsightDoDia.tsx:43,47,67-70` | ✅ 📖 |
| INSD-02 | Sobre você, matérias, metas, objetivos, relato inicial, Rotina do dia, grupos com tipo e intervalos, pausas | `prompts.test.ts:112-127` (matérias, metas, grupos `{ id, rotulo, programa, titulo, tipo, materia, minutos, intervalos }`, pausas, mapa), `:93-94` (Sobre você e plano), `:98` (Rotina do dia), `:102-105` (objetivos com tipo), `:132-133` (sem UUID) | ✅ (F20b e F20c mortos) |
| INSD-03 | Botão desabilitado, "Analisando o dia…", sem segunda chamada | 📖 `useIA.ts:63-64` (o mesmo tipo em andamento é descartado), `InsightDoDia.tsx:44,68-69` | ✅ 📖 |
| INSD-04 | Sugestão por grupo não fixo, motivo de até 140, "Sugestão da IA" | `src/features/ia/utils/respostas.test.ts:25-31` (sugestões válidas), `:47` `toBe('a'.repeat(140))`; 📖 `GruposDoDia.tsx:46` (só não fixos), `:109` ("Sugestão da IA"); borda da spec (sem grupo, só o texto): `respostas.test.ts:53` | ✅ (F12 morto) |
| INSD-05 | Nada se aplica sem a pessoa aceitar | `src/features/ia/utils/sugestoes.test.ts:40-41` (relatos e sessões iguais depois de salvar e recusar o insight) | ✅ |
| INSD-06 | Aceitar = correção manual daquele grupo | `sugestoes.test.ts:49` `toEqual({ 'app:slack': 'fora', 'regra:vscode': 'trabalho' })`, `:51-52` (`trabalhoMs 60`, `focoMs 20`); 📖 `GruposDoDia.tsx:78`, `RelatoPage.tsx:82-85` (salvar recalcula as sessões) | ✅ (F18b morto) |
| INSD-07 | "Aceitar todas" só aplica as pendentes | `sugestoes.test.ts:59` `toEqual({ 'app:slack': 'trabalho', 'regra:vscode': 'trabalho' })` | ✅ (F18 morto) |
| INSD-08 | Texto com estudo, trabalho e diversão e a comparação com o plano | 📖 `InsightDoDia.tsx:79-84` (totais calculados pelo app e o texto); `src/features/ia/utils/prompts.ts:29` (o prompt pede a comparação) | ✅ 📖 ⚠️ o conteúdo do texto vem da IA: só o UAT confere a comparação |
| INSD-09 | pt-BR, tom neutro e descritivo, sem "perdido", "fracasso" e "falha" | `prompts.test.ts:85` `toContain(REGRAS_DE_TOM)`, `:86` `toContain('português do Brasil')`, `:87` `toContain('tom neutro e descritivo')`, `:88` `toMatch(/Não use[^.]*"perdido"[^.]*"fracasso"[^.]*"falha"/)` | ✅ (F19 e F19b mortos) |
| INSD-10 | Salvo no dia com as sugestões, e volta ao reabrir | `dados-reducer.test.ts:91` (um por dia); 📖 `InsightDoDia.tsx:41,58-61` | ✅ |
| INSD-11 | "Gerar de novo" substitui e mantém as correções aceitas | `dados-reducer.test.ts:91` `toEqual(['b', 'c'])`; 📖 `InsightDoDia.tsx:57-61` (os ajustes do relato não são tocados) | ✅ |
| INSD-12 | Até 200 grupos + uma linha "outros" | `src/features/ia/utils/linha-do-tempo.test.ts:33` `toHaveLength(200)`, `:37` `toEqual({ id: 'outros', minutos: 1275 })` | ✅ (F20 morto) |
| INSD-13 | Descarta só a sugestão com grupo ou matéria inexistente | `respostas.test.ts:25-31` (g9, m9 e "lazer" saem; g1 e g2 ficam) | ✅ (F11, F13 e F13b mortos) |

### P1: Falhas da IA

| AC | Resultado definido pela spec | Evidência `arquivo:linha` + assert | Resultado |
| -- | ---------------------------- | ---------------------------------- | --------- |
| IAERR-01 | 60 s → "O Gemini demorou demais. Tente de novo." | `ia.rs:520` `assert_eq!(erro_de_transporte(&Timeout(Global)), ErroIA::Tempo)`; `mensagens.test.ts:17,24`; 📖 `ia.rs:19,290` (`timeout_global` de 60 s) | ✅ (R9 morto) |
| IAERR-02 | Cota → "A cota da sua chave do Gemini acabou por agora. Tente mais tarde." | `ia.rs:453` `assert_eq!(erro_do_status(429, ""), ErroIA::Cota)`; `mensagens.test.ts:18` | ✅ (R7 e F21b mortos) |
| IAERR-03 | Chave → "O Gemini recusou a chave. Confira nas opções." | `ia.rs:449-451`; `mensagens.test.ts:19` | ✅ (R5 e R6 mortos) |
| IAERR-04 | Sem rede → "Sem conexão com o Gemini." | `ia.rs:521-522`; `mensagens.test.ts:20` | ✅ |
| IAERR-05 | Relato, objetivos e correções ficam como estavam | 📖 `InsightDoDia.tsx:53-56`, `src/features/ia/components/InsightDaSemana.tsx:51-54`, `src/features/hoje/components/CartaoRelatoInicial.tsx:51-53`; borda da spec (JSON fora do formato): `respostas.test.ts:57,61-62` (`null`), `mensagens.test.ts:22`; `ia.rs:452` (400 sem chave → `Resposta`), `ia.rs:454` (5xx → `Indisponivel`) | ✅ ((e), R7b, R11e, F16 e F17 mortos; parte 📖) |
| IAERR-06 | Log com tipo, duração e resultado, sem conteúdo nem chave | `ia.rs:510-515` (inclusive o tipo desconhecido vira `outro`); 📖 `voz.rs:377-381` (`voz.sessao` só com ms e resultado) | ✅ (R11b morto) |

### P2: Voz ao vivo

| AC | Resultado definido pela spec | Evidência `arquivo:linha` + assert | Resultado |
| -- | ---------------------------- | ---------------------------------- | --------- |
| VOZ-01 | Texto parcial no campo enquanto a pessoa fala | `voz.rs:690-699` (`ao_receber` dá `Parcial` com o texto acumulado); `voz.rs:633-642` (mensagens viram parcial ou final); 📖 `voz.rs:457` (`voz:parcial`), `src/features/relatos/hooks/useVoz.ts:44-49` | ✅ (R16 morto; UAT pendente) |
| VOZ-02 | Ao parar, o texto final, editável, com a origem "voz" | `src/features/relatos/utils/voz.test.ts:13-15` (o final troca o parcial); `voz.rs:653-667`; 📖 `src/features/relatos/components/CampoRelato.tsx:22,32` | ✅ |
| VOZ-03 | Encerra aos 10 minutos e mantém o texto | `voz.rs:673-675` `assert!(!chegou_ao_limite(BYTES_POR_PEDACO * 5_999))`, `assert!(chegou_ao_limite(BYTES_POR_PEDACO * 6_000))`; 📖 `voz.rs:452,482` (`voz:fim`), `useVoz.ts:58` | ✅ (R12 e R13 mortos) |
| VOZ-04 | Vocabulário com matérias, termos e objetivos, até 100 | `voz.rs:615` `assert_eq!(vocabulario.len(), 100)`; `voz.test.ts:51-58,64` | ✅ (R15 e F23b mortos) |
| VOZ-05 | Queda: para, mantém o texto e mostra a mensagem exata | `voz.rs:700-704` (`Erro(Conexao)` e o texto continua); `voz.test.ts:20-21` `toBe('A conexão com o Gemini caiu. O texto até aqui ficou no campo.')` | ✅ (R14 e F23 mortos) |
| VOZ-06 | Desligada: "Falar" desabilitado com "Ligue a IA nas opções para falar." | 📖 `CampoRelato.tsx:46` (`disabled={!voz.disponivel}`), `:51` (texto exato); `useVoz.ts:108-110` (o campo mostra a voz pela preferência "Falar o relato", que vem ligada: `src/store/model/dados.ts:246`) | ✅ 📖 |
| VOZ-07 | Microfone indisponível → "Não deu para usar o microfone." | `voz.test.ts:27`; 📖 `voz.rs:495-505` (`ErroIA::Microfone`) | ✅ |
| VOZ-08 | Sem áudio em disco; cada pedaço sai depois de enviado | 📖 `voz.rs` não usa `std::fs`; `voz.rs:446-451` (pedaço enviado e solto), `:464-465` | ✅ 📖 |
| VOZ-09 | Sem download de modelos nem transcrição no PC | `migracao.test.ts:200` `not.toHaveProperty('modeloVoz')`; 📖 `src-tauri/src/lib.rs:165-173` (sem `voz_modelo_*`), `src-tauri/Cargo.toml` (sem `whisper-rs` e sem a feature `voz`) | ✅ |
| VOZ-10 | Apaga a pasta dos modelos do Whisper na primeira abertura | `lib.rs:211-212` `assert!(apagar_modelos_antigos(&pasta).unwrap()); assert!(!pasta.exists())`, `:220`; 📖 `lib.rs:188-192` | ✅ (R18 morto) |

### P2: Plano do dia pela IA

| AC | Resultado definido pela spec | Evidência `arquivo:linha` + assert | Resultado |
| -- | ---------------------------- | ---------------------------------- | --------- |
| PLANO-01 | Pede ao Gemini os objetivos (estudo ou trabalho) com os termos | `prompts.test.ts:149-163` (entrada), `:170` `toEqual({ type: 'string', enum: ['estudo', 'trabalho'] })`; 📖 `CartaoRelatoInicial.tsx:44-49` ("Pular hoje" não chama) | ✅ |
| PLANO-02 | Matéria inexistente vira título livre, sem criar matéria | `respostas.test.ts:87-91` | ✅ (F15b morto) |
| PLANO-03 | Objetivo que não é de estudo nem de trabalho sai | `respostas.test.ts:99` `toEqual(['ingles'])` | ✅ (F14 morto) |
| PLANO-04 | Sem duplicar matéria ou título | `respostas.test.ts:108` `toEqual(['ingles'])`, `:118` `toEqual(['CORRIGIR O BUG'])` | ✅ (F15 morto) |
| PLANO-05 | Em falha, a busca de palavras e a mensagem exata | 📖 `CartaoRelatoInicial.tsx:17` (texto exato), `:51-53` | ✅ 📖 |
| PLANO-06 | "Entrou nos objetivos do dia:" com o nome e o tipo | 📖 `CartaoRelatoInicial.tsx:55,75` | ✅ 📖 |

### P2: Insight da semana

| AC | Resultado definido pela spec | Evidência `arquivo:linha` + assert | Resultado |
| -- | ---------------------------- | ---------------------------------- | --------- |
| INSS-01 | Cartão com a escolha da semana, começando na última completa | `src/features/ia/utils/semana.test.ts:8,12,16`; 📖 `InsightDaSemana.tsx:31-33,40,66-74` | ✅ (F24 morto) |
| INSS-02 | Sobre você, matérias com meta e horas validadas, Rotina e, por dia, objetivos, relatos, humor, totais e insight do dia | `prompts.test.ts:232-237` (sete dias e relatos), `:242-244` (insight do dia), `:257-266` (matérias e Rotina), `:271-278` (objetivos e totais) | ✅ |
| INSS-03 | Três partes: "Como foi a semana", "Padrões", "Para a próxima semana" | `respostas.test.ts:138,144-146`; 📖 `InsightDaSemana.tsx:17-21` (títulos exatos) | ✅ (F17 morto) |
| INSS-04 | Salvo na semana, volta, com "Gerar de novo" | `dados-reducer.test.ts:97,99`; 📖 `InsightDaSemana.tsx:35,95` | ✅ |
| INSS-05 | Semana vazia: botão desabilitado e "Sem dias registrados nesta semana" | `semana.test.ts:44-45` `toBe(false)`; 📖 `InsightDaSemana.tsx:37,94,97` | ✅ |
| INSS-06 | Mesmas regras de idioma e tom do INSD-09 | `prompts.test.ts:250-251` `toContain(REGRAS_DE_TOM)` | ✅ (F19d morto) |

### Critérios de sucesso

| Critério | Evidência | Resultado |
| -------- | --------- | --------- |
| Expediente inteiro no VS Code sem nenhum minuto no banco, sem IA | `resumo.test.ts:131-142` (corte no fim) e `:144-155` (corte no começo); `dados-reducer.test.ts:38` (`focoMs: 0, trabalhoMs: HORA`) | ✅ as duas bordas do expediente agora têm teste |
| Aceitar todas as sugestões deixa só o estudo no banco | `sugestoes.test.ts:49-52,59` | ✅ |
| Log sem chamadas com a IA desligada, exceto o teste da chave, com tipo, duração e resultado | `ia.rs:483` (análise e voz recusam), `ia.rs:512` `{ "tipo": "teste", "ms": 300, "resultado": "Cofre", "tokens": null }`; 📖 `ia.rs:365-367` | ✅ (a redação de `7e07b81` bate com o código; o `tokens: null` é o campo vazio do evento do design) |
| Parcial em menos de 2 s, objetivos em até 10 s | - | UAT |
| Falha da IA nunca impede salvar o relato | 📖 `InsightDoDia.tsx:53-56`, `RelatoPage.tsx:68-92` | ✅ 📖 |

**Status**: 68/68 ACs com evidência `arquivo:linha`. 52 com teste, 16 só por leitura (telas e hooks, como manda a matriz). Nenhum AC sem evidência. Lacunas de precisão: textos sem valor na spec (desvio aceito) e o conteúdo do INSD-08, que vem da IA.

---

## Casos de borda da spec

- [x] IA desligada com uma chamada ou gravação em andamento: a resposta é descartada e a gravação acaba. Verificado por leitura: `useIA.ts:67,69` e `useVoz.ts:73-75`.
- [x] Resposta fora do JSON: "A resposta do Gemini veio incompleta. Tente de novo." Teste em `respostas.test.ts:57,61` e `mensagens.test.ts:22`; o texto aparece em `InsightDoDia.tsx:56`.
- [x] Dia sem grupo não fixo: sai só o texto. Teste em `respostas.test.ts:53`.
- [x] Sugestão recusada: o grupo fica como estava. Teste em `sugestoes.test.ts:40` e `dados-reducer.test.ts:108-112`.
- [x] Plano vazio ("Pular hoje") não chama a IA. Verificado por leitura: `CartaoRelatoInicial.tsx:44`.
- [x] Dois itens de Trabalho sobrepostos valem na união. Teste em `expediente.test.ts:44` (F9b morto).
- [x] Termo de objetivo de trabalho fora do horário continua trabalho. Teste em `classificacao.test.ts:96-103` (contexto sem expediente).

---

## Sensor de descoberta de mutantes

**Isolamento**: linha de base do `git status --porcelain` da árvore real gravada antes (`?? .specs/features/ia-gemini/validation.md` e `?? docs/`). `git worktree add --detach <scratchpad>/it3/wt HEAD`, com o `node_modules` ligado por junção e o `CARGO_TARGET_DIR` numa pasta temporária. Na cópia, a base passou antes das mutações: 155 testes no front e 49 no Rust. Cada mutação foi aplicada por script (o trecho original precisava aparecer uma vez só), os testes alvo rodaram (no front, e a suíte inteira quando o mutante sobrevivia aos alvo; no Rust, `cargo test --lib`) e a mudança foi desfeita com `git checkout` só na cópia, conferindo que o arquivo voltou byte a byte. Nenhum `git stash`. No fim, a junção saiu com `rmdir` (o `node_modules` real continuou com 303 itens), a cópia saiu com `git worktree remove --force` e `prune`, e o target temporário foi apagado. O `git status --porcelain` da árvore real ficou igual à linha de base (comparado com `diff`).

**Profundidade**: P0 expandida, 68 mutações manuais (44 no front e 24 no Rust), com as cinco obrigatórias. O (c) rodou nas duas leituras do pedido: no `dividirPorExpediente` (`expediente.ts`, o arquivo nomeado) e no `a <= inicio` literal (`classificacao.ts:139`, o F4 da iteração 2).

### Obrigatórios

| # | Arquivo:linha | Mutação | Resultado |
| - | ------------- | ------- | --------- |
| **(a)** | `src/store/reducer/dados-reducer.ts:68` | `\|\| anterior?.categoria === 'trabalho'` removido | ✅ morto, por `dados-reducer.test.ts:47` |
| **(b)** | `src-tauri/src/rastreador.rs:495` | `agora < fim` → `agora <= fim` | ✅ morto, pânico em `rastreador.rs:1151` |
| **(c)** | `src/features/rotina/utils/expediente.ts:51` | `dividirPorExpediente`: `a <= ms` → `a < ms` (campo `expediente` do pedaço que começa na abertura) | ❌ **sobreviveu** (155/155 passam, suíte inteira) |
| **(c')** | `src/features/sessao/utils/classificacao.ts:139` | `noExpediente`: `a <= inicio` → `a < inicio` (a borda que decide o EXPED-01) | ✅ morto, por `resumo.test.ts:144` |
| **(d)** | `src-tauri/src/rastreador.rs:495` | `inicio <= agora` → `inicio < agora` | ✅ morto, pânico em `rastreador.rs:1148` |
| **(e)** | `src-tauri/src/ia.rs:92` | `_ => ErroIA::Resposta` → `_ => ErroIA::Indisponivel` | ✅ morto em `ia.rs:452` (`left: Indisponivel, right: Resposta`) |

**Prova do (c)** (só na cópia, arquivo de teste temporário apagado depois): `dividirPorExpediente([VS Code das 8h30 às 9h30], [[9h, 18h]]).map((p) => p.expediente)` dá `[false, true]` no código atual e `[false, false]` com o mutante; o assert falha (`expected [ false, false ] to deeply equal [ false, true ]`). Ou seja, o mutante é matável por um teste da unidade. Com o mesmo mutante, a suíte inteira passa, inclusive o `resumo.test.ts:144`, porque `resumir`, `classificarSessao` e `gruposParaPrompt` não leem o campo: classificam cada pedaço com `noExpediente(t.inicio)`. Nenhum número do app muda.

### Demais mutações (todas mortas)

| # | Arquivo:linha | Mutação | Resultado |
| - | ------------- | ------- | --------- |
| F2 | `classificacao.ts:218` | `noExpediente(...)` → `!noExpediente(...)` | ✅ morto |
| F3 | `classificacao.ts:139` | `inicio < b` → `inicio <= b` (fim) | ✅ morto, por `resumo.test.ts:131` |
| F3b | `expediente.ts:51` | `ms < b` → `ms <= b` (fim, campo `expediente`) | ✅ morto, por `expediente.test.ts:79` |
| F3c | `expediente.ts:53` | `dividirPorExpediente` não corta nas bordas | ✅ morto |
| F5 | `classificacao.ts:184` | objetivo de trabalho pulado volta a classificar | ✅ morto |
| F6 | `classificacao.ts:185` | objetivo de trabalho deixa de vencer o estudo (TRAB-08) | ✅ morto |
| F7 | `src/features/sessao/utils/resumo.ts:133` | `trabalhoMs = 0` | ✅ morto |
| F8 | `resumo.ts:62` | objetivo de trabalho recebe o estudo sem matéria | ✅ morto |
| F8b | `resumo.ts:125` | o tempo do objetivo de trabalho sai do `porObjetivo` (TRAB-09) | ✅ morto |
| F9 | `expediente.ts:29` | sem a véspera (EXPED-04) | ✅ morto |
| F9b | `expediente.ts:43` | sem unir intervalos sobrepostos | ✅ morto |
| F10 | `dados-reducer.ts:37` | recalcula também os dias com relato final | ✅ morto |
| F10b | `dados-reducer.ts:73` | apagar item de Trabalho não recalcula | ✅ morto |
| F10c | `dados-reducer.ts:68` | criar item de Trabalho não recalcula | ✅ morto |
| F11 | `src/features/ia/utils/respostas.ts:33` | matéria inexistente não é descartada (INSD-13) | ✅ morto |
| F12 | `respostas.ts:36` | motivo em 141 caracteres | ✅ morto |
| F13 | `respostas.ts:28` | tipo fora do enum passa | ✅ morto |
| F13b | `respostas.ts:29` | grupo inexistente passa | ✅ morto |
| F14 | `respostas.ts:71` | objetivo que não é de estudo nem de trabalho passa (PLANO-03) | ✅ morto |
| F15 | `respostas.ts:67` | comparação sem tirar acento e caixa (PLANO-04) | ✅ morto |
| F15b | `respostas.ts:76` | objetivo sem matéria conhecida sai (PLANO-02) | ✅ morto |
| F16 | `respostas.ts:46` | aceita texto vazio no insight do dia | ✅ morto |
| F17 | `respostas.ts:104` | semana sem a terceira parte passa | ✅ morto |
| F18 | `src/features/ia/utils/sugestoes.ts:17` | recusada vira pendente ("Aceitar todas" a aplicaria) | ✅ morto |
| F18b | `sugestoes.ts:21` | aceitar não aplica a sugestão | ✅ morto |
| F19 | `src/features/ia/utils/prompts.ts:21` | sem "com tom neutro e descritivo" | ✅ morto |
| F19b | `prompts.ts:22` | sem a palavra "fracasso" | ✅ morto |
| F19c | `prompts.ts:91` | insight do dia sem o "Sobre você" (IACONF-11) | ✅ morto |
| F19d | `prompts.ts:170` | semana sem as regras de tom (INSS-06) | ✅ morto |
| F19e | `prompts.ts:153` | plano sem o "Sobre você" (IACONF-11) | ✅ morto |
| F20 | `src/features/ia/utils/linha-do-tempo.ts:58` | limite de 199 grupos | ✅ morto |
| F20b | `linha-do-tempo.ts:75` | a ausência vai para o prompt | ✅ morto |
| F20c | `linha-do-tempo.ts:84` | título mais curto no lugar do mais longo | ✅ morto |
| F21 | `src/features/ia/constants/mensagens.ts:19` | sem o texto da conexão no teste da chave (IACONF-06) | ✅ morto |
| F21b | `mensagens.ts:8` | texto da cota trocado (IAERR-02) | ✅ morto |
| F22 | `src/features/autoanalise/utils/insights.ts:47` | trabalho entra no mapa de foco como fora (TRAB-05) | ✅ morto |
| F23 | `src/features/relatos/utils/voz.ts:28` | queda na fala mostra a mensagem genérica (VOZ-05) | ✅ morto |
| F23b | `voz.ts:50` | vocabulário sem o limite de 100 (VOZ-04) | ✅ morto |
| F24 | `src/features/ia/utils/semana.ts:8` | semana padrão = a atual (INSS-01) | ✅ morto |
| F25 | `src/store/model/migracao.ts:59` | migração sem `trabalhoMs: 0` | ✅ morto |
| F26 | `src/features/hoje/utils/dia.ts:99` | rastreio sem o expediente (EXPED-03) | ✅ morto |
| R3 | `rastreador.rs:632` | aviso de distração dentro do expediente | ✅ morto |
| R4 | `rastreador.rs:488` | toda regra que não é estudo avisa (trabalho e ignorar também) | ✅ morto |
| R4b | `rastreador.rs:484` | os termos do dia deixam de evitar o aviso | ✅ morto |
| R5 | `ia.rs:88` | 403 deixa de ser chave recusada | ✅ morto |
| R6 | `ia.rs:89` | 400 com "API key" deixa de ser chave recusada | ✅ morto |
| R7 | `ia.rs:90` | 429 → `Indisponivel` | ✅ morto |
| R7b | `ia.rs:91` | 5xx → `Resposta` | ✅ morto |
| R9 | `ia.rs:284` | `Timeout` → `Conexao` | ✅ morto |
| R10 | `ia.rs:224` | `pode_chamar` sem checar se a IA está ligada | ✅ morto |
| R11 | `ia.rs:236` | guarda a chave mesmo com o teste recusado | ✅ morto |
| R11b | `ia.rs:260` | tipo desconhecido entra no log como veio | ✅ morto |
| R11c | `ia.rs:99` | mostra 5 caracteres da chave | ✅ morto |
| R11d | `ia.rs:66` | `store: true` | ✅ morto |
| R11e | `ia.rs:76` | o texto junta também os passos que não são `model_output` | ✅ morto |
| R12 | `voz.rs:100` | `>=` → `>` no corte de 10 min | ✅ morto |
| R13 | `voz.rs:34` | limite de 11 minutos | ✅ morto |
| R14 | `voz.rs:207` | a queda apaga o texto acumulado | ✅ morto |
| R15 | `voz.rs:105` | sem o limite de 100 termos | ✅ morto |
| R16 | `voz.rs:139` | `inputTranscription` lido como parcial | ✅ morto |
| R17 | `voz.rs:110` | idioma `en-US` no `setup` | ✅ morto |
| R18 | `src-tauri/src/lib.rs:93` | não apaga a pasta dos modelos (VOZ-10) | ✅ morto |

**Resultado do sensor**: 67/68 mortos, 1 sobrevivente ((c) em `expediente.ts:51`). As lacunas das iterações 1 e 2 estão fechadas: F1 = (a), R1 = (b), F4 = (c'), R2 = (d) e R8 = (e) morrem.

---

## Testes fracos (Passo 3)

| `arquivo:linha` | Problema | Gravidade |
| --------------- | -------- | --------- |
| `src/features/rotina/utils/expediente.test.ts:78-89` | Confere o campo `expediente` às 17h (`true`), às 18h e às 20h (`false`), mas não no pedaço que começa na abertura do expediente. O (c) sobrevive | Minor (a lacuna desta iteração) |
| `src/features/ia/utils/linha-do-tempo.test.ts:84` | Só `toHaveLength(20)`. Com intervalos da mesma duração, não confere que ficam os mais longos (comentário de `linha-do-tempo.ts:39`); a spec não fala dos 20 intervalos, só o design | Minor (não bloqueia) |
| `src/features/ia/utils/sugestoes.test.ts:43` | Recalcula o resumo com ajustes que nunca tiveram o YouTube, então passa sempre. Quem prova o caso de borda é a linha `:40` | Minor (não bloqueia) |
| `src/store/model/migracao.test.ts:180` | `expect(VERSAO_DADOS).toBe(4)` só confere uma constante | Cosmético |
| `src-tauri/src/rastreador.rs:1109-1116` | Asserção negativa (`all(... != "Fora do estudo")`). Só discrimina junto com `:1119-1129`, que confere `count() == 1` | Informativo |

Os testes novos desta iteração não são fracos: `resumo.test.ts:149-154` confere os dois grupos com tipo e duração e os totais, e `rastreador.rs:1148-1151` fixa os quatro instantes das duas bordas.

---

## Desvios aceitos (confirmados no código)

| Desvio | Onde | Avaliação |
| ------ | ---- | --------- |
| `gruposParaPrompt(trechos, contexto, ajustes, limite)` no lugar de `(resumo, limite)` | `src/features/ia/utils/linha-do-tempo.ts:52-59` (`SPEC_DEVIATION` com o motivo) | Aceito. O `Grupo` não guarda o programa nem os intervalos. Custo: o `resumir` roda duas vezes no pedido do dia (`linha-do-tempo.ts:60` e `prompts.ts:86`). O `design.md:179` ainda mostra a assinatura antiga |
| Evento extra `voz:fim { texto }` | `src-tauri/src/voz.rs:41-43` (`SPEC_DEVIATION`), `:482`; `src/features/relatos/api/voz.ts:27`; `useVoz.ts:58` | Aceito e necessário para o VOZ-03: aos 10 minutos a gravação acaba sem o "Parar". O `design.md:130` ainda lista só `voz:parcial` e `voz:erro` |
| Literal 4 → 5 em "recusa dados de uma versão mais nova" | `src/store/model/migracao.test.ts:160` | Aprovado pela pessoa. Obrigatório, porque `VERSAO_DADOS` agora é 4 |
| Título mais longo do grupo no prompt | `linha-do-tempo.ts:83-86` (commit `8c14b12`) | Confere com `design.md:179` e `spec.md:58`; `linha-do-tempo.test.ts:66` distingue o mais longo do mais usado (F20c morto). Detalhe: o comentário do campo em `linha-do-tempo.ts:18` ainda diz "o título usado por mais tempo" (cosmético) |
| Textos sem valor na spec | `src/features/ia/constants/mensagens.ts:5` (Desligada), `:6` (SemChave), `:13` (Cofre); `ia.rs:154,161,317` (detalhe do `Cofre`, que não aparece na tela); `InsightDaSemana.tsx:17-21` são da spec, mas `:83-85` e `:95` não; `InsightDoDia.tsx:86-88,92-94,104` | ⚠️ Lacuna de precisão da spec, não erro. O `Indisponivel` usa o texto do design (`design.md:209`) |

---

## Pendente de UAT (não é falha de código)

- Handshake do WebSocket com o header `x-goog-api-key` (`voz.rs:311-321`).
- Formato real de `steps[type=model_output].content[type=text].text` e de `usage.total_tokens` na Interactions API (`ia.rs:71-83,312`).
- Mensagens reais do Gemini Live: `serverContent.interimInputTranscription` e `inputTranscription`, se o `setup` com `customVocabulary` e `languageCodes` é aceito, e o binário contra o texto (`voz.rs:104-142,181-188`).
- Respostas reais 401, 403 e 400 no `GET /v1beta/models?pageSize=1` e o limite real de 60 s.
- Cofre real (`keyring` no Windows) e, no Linux sem Secret Service, o arquivo `0600`.
- Telas no app (`npm run desktop`): consentimento, cartão da IA, insight do dia com as sugestões nos grupos, aviso do expediente, plano pela IA, voz ao vivo (parcial, parar, queda de rede, microfone negado, 10 minutos), insight da semana, e o total e a faixa de trabalho na cor da Rotina.
- O teste independente do IACONF: abrir o `dados.json` e o diagnóstico exportado e não achar a chave.
- A pasta `modelos` apagada na primeira abertura real.
- Latências: parcial em menos de 2 s e objetivos em até 10 s.

---

## Observações (não bloqueiam)

1. **Duas fontes para o mesmo horário**: `dividirPorExpediente` calcula o campo `expediente` de cada pedaço (`expediente.ts:51`), e `classificar` recalcula o mesmo com `noExpediente` (`classificacao.ts:138-139`). Só o segundo é usado. É a causa do sobrevivente: se alguém passar a ler o campo, a borda do começo não está protegida.
2. **README, Atribuição**: `README.md:60` ainda descreve a ordem antiga (termos dos objetivos, matérias e regras) e não cita o objetivo de trabalho nem o horário de trabalho (AD-002).
3. **README, cópias**: `README.md:64` cita `dados.v2.bak.json` e `dados.v3.bak.json`; os dados do formato 1 geram `dados.v1.bak.json` (`diagnostico.rs:30`).
4. **TRAB-03 com correções do dia**: o Rust não conhece as correções do relato. Uma janela corrigida para Trabalho durante o dia, mas com regra `fora`, ainda avisa. É um limite do design ("o Rust só decide se é distração").
5. **Matérias arquivadas no vocabulário da voz**: `src/features/relatos/utils/voz.ts:39` inclui as arquivadas, e o `termosDoDia` as exclui. A spec não decide.
6. **`Microfone` fora do `TipoErroIA` do front** (`src/features/ia/api/ia.ts:8`): fora da voz, cairia em "resposta incompleta". A voz trata o caso em `mensagemDaVoz`.

---

## Qualidade do código

| Princípio | Status |
| --------- | ------ |
| Código mínimo | ⚠️ o campo `expediente` de `dividirPorExpediente` não tem leitor; o `resumir` roda duas vezes no pedido do dia |
| Mudanças cirúrgicas | ✅ (`38e970a` só mexe em testes; `7e07b81` só na spec) |
| Sem escopo extra | ✅ (o `voz:fim` é necessário para o VOZ-03) |
| Segue os padrões do projeto | ✅ |
| Valores asserts batem com a spec | ✅, com as lacunas de precisão dos textos sem valor na spec |
| Cobertura por camada (domínio 1:1 com os ACs, todos os ramos) | ❌ um ramo: o começo do expediente no campo `expediente` de `dividirPorExpediente` (`expediente.ts:51`). Os ramos que decidem os ACs estão todos cobertos |
| Todo teste se liga a um AC, a um caso de borda ou a um "Done when" | ✅ os testes citam os IDs |
| Guias do projeto | Nenhum (`AGENTS.md` e `CONTRIBUTING.md` não existem); valem os gates do CI (`.github/workflows/build-teste.yml`) |

---

## A lacuna que resta

### Lacuna 1: campo `expediente` de `dividirPorExpediente` sem teste no começo (Minor)

- **Onde**: `src/features/rotina/utils/expediente.ts:51` (`const dentro = (ms) => intervalos.some(([a, b]) => a <= ms && ms < b)`) e `src/features/rotina/utils/expediente.test.ts:78-89`.
- **O que acontece**: com `a <= ms` → `a < ms`, o pedaço que começa às 9h00 sai com `expediente: false`, e os 155 testes passam.
- **Impacto hoje**: nenhum número do app muda, porque nenhum código de produção lê o campo (os três chamadores classificam pelo `noExpediente`, que está protegido pelo `resumo.test.ts:144`).
- **Caminhos possíveis** (decisão da pessoa, sem nova iteração automática): aceitar como está; acrescentar no `expediente.test.ts` o pedaço das 8h30 às 9h30 com `[false, true]` (é o assert da prova acima); ou tirar o campo `expediente` do retorno de `dividirPorExpediente`, já que a classificação decide pelo `inicio`.

---

## Atualização da rastreabilidade (proposta; o verificador não edita a `spec.md`)

| Requisito | Antes | Proposto |
| --------- | ----- | -------- |
| 67 ACs (todos menos EXPED-01) | Implementing | ✅ Verified |
| EXPED-03 | Needs Fix (iteração 2) | ✅ Verified |
| EXPED-01 | Needs Fix (iteração 2) | ✅ Verified no comportamento (as duas bordas da classificação têm teste); ⚠️ o campo `expediente` de `dividirPorExpediente` fica sem teste no começo (Lacuna 1) |

---

## Resumo

**Overall**: ❌ Not Ready pela regra do sensor, com uma lacuna Minor que não muda nenhum número do app.

- **Verificação ancorada na spec**: 68/68 ACs com evidência; as lacunas das iterações 1 e 2 estão fechadas.
- **Sensor**: 67/68 mortos. Os obrigatórios (a), (b), (d) e (e) morrem; o (c) morre onde a borda decide o EXPED-01 (`classificacao.ts:139`) e sobrevive no campo sem leitor de `dividirPorExpediente` (`expediente.ts:51`).
- **Gates**: lint 0 erros · `tsc -b` ok · Vitest 155/155 · `cargo test` 49/49 · Clippy ok.
- **O que funciona**: classificação com trabalho e horário de trabalho (as duas bordas, a véspera e a união), recálculo do EXPED-07 nas três ações, migração 3 → 4, gateway e mapa de erros, prompts com o "Sobre você" e o tom, leitura das respostas, sugestões e "Aceitar todas", protocolo e acúmulo da voz ao vivo com o corte de 10 minutos, limpeza do Whisper, insight da semana.
- **Gate determinístico**: `py -3 .claude/skills/tlc-spec-driven/scripts/validate_state.py ia-gemini` deve terminar com exit 1 ("verdict is FAIL") enquanto a Lacuna 1 não for resolvida ou aceita pela pessoa.
- **Próximo passo**: decisão da pessoa sobre a Lacuna 1 e, depois, o UAT no app com uma chave real.

**Lições** (o `lessons.py add` não rodou, porque o verificador só pode escrever este arquivo; sugestões para o orquestrador registrar):

1. Quando uma função devolve um dado que nenhum chamador lê, ou se apaga o dado, ou se testa: um campo sem leitor esconde mutantes que a suíte não vê.
2. Ao fechar a borda de um intervalo, confira em qual função a borda decide o resultado; a mesma condição pode estar copiada em outra função que só parece decidir.
