# Feature: Dia de estudo (objetivos, play/pause e relatos)

> Rascunho a partir da conversa resumida pelo Granola. Tudo marcado com `# SUPOSIÇÃO` precisa de confirmação antes da implementação.

## Contexto

- **Problema:** começar a estudar tem barreira de entrada. Sistemas falham por complexidade, excesso de informação ou metas exageradas. Exemplo concreto: iniciar a gravação no OBS leva de 30 s a 1 min de preparo manual (abrir o vídeo anterior, pegar o timestamp, converter para segundos, abrir o OBS). No próprio Proof of Study, a sessão hoje pede matéria e duração (25/50 min) e acaba ao fim do pomodoro. A rotina com horário fixo (tela Rotina) gera pressão e a sensação de "dia perdido" quando a pessoa atrasa. Sem autoavaliação, o sistema depende 100% da disciplina do usuário e desanima.
- **Persona:** quem estuda sozinho no próprio PC (Thiago e o amigo que vai testar; por ora, o grupo de amigos desenvolvedores).
- **Impacto esperado:**
  - Começar a estudar com um clique (play) e retomar de onde parou, sem preparo.
  - Trocar horário fixo por objetivos do dia, sem atraso nem "dia perdido".
  - A pessoa se autoavaliar: ver onde houve pausa, ritmo e distração (3 h produtivas valem mais que 8 h dispersas), e registrar como foi o dia.
  - Estudar outra coisa no lugar do planejado conta como redirecionamento, não como fracasso.
- **Fora de escopo (por ora):** IA (resumo do dia e insights), entrada por voz, metas de habilidade quebradas em tópicos com horas sugeridas, integração com Anki, recursos com amigos, publicação no servidor Infinity Learning.
- **Dependências / riscos:**
  - O relógio e a captura rodam no Rust (`src-tauri/src/rastreador.rs`), que hoje trabalha com duração fixa e fase `concluido`. O play/pause sem fim definido muda esse contrato.
  - Notificação do relato final usa os lembretes do Rust (`src-tauri/src/lembretes.rs`), que hoje só conhecem os blocos da rotina.
  - Novo formato de dados (objetivos do dia, relatos) exige subir `VERSAO_DADOS` e converter em `atualizarDados`.
  - A regra atual "sem anotação o tempo não entra no banco de horas" precisa de um momento de anotação compatível com o play/pause.
  - IA local exige VRAM; otimização fica para depois.
- **Reutilizar:**
  - Matérias (`Materia`) como as categorias de estudo (Inglês, Blender…).
  - Regras de Apps e sites (Estudo / Fora do estudo / Ignorar) e a classificação (`classificacao.ts`) para separar tempo produtivo de distração. A IA não é necessária para isso.
  - Captura da janela ativa, tempo ausente e "Pausar captura".
  - Linha do tempo e tela de Resumo da sessão (incluindo reclassificar uma janela só naquela sessão).
  - Widget e bandeja para o play/pause fora da janela principal.
  - Banco de horas e metas semanais por matéria.

## Prioridade (MoSCoW)

| Comportamento | Prioridade |
|---|---|
| Play em um objetivo começa a contar e capturar, sem escolher duração | Must |
| Pause para o relógio e a captura | Must |
| Play de novo retoma o tempo de onde parou | Must |
| Tempo retomado sobrevive a fechar e reabrir o app | Must |
| Só um objetivo rodando por vez; play em outro pausa o atual | Must |
| Plano do dia ao abrir o app: escrever o que quer fazer e escolher as matérias | Must |
| Objetivos do dia sem horário e sem indicação de atraso | Must |
| Separar tempo de estudo e fora do estudo pelas regras já existentes | Must |
| Notificação no fim do dia para o relato | Must |
| Registrar o relato do dia em texto | Must |
| Fazer o relato de ontem na manhã seguinte | Must |
| Resumo do dia: foco, fora e pausas por objetivo | Must |
| Estudar matéria fora do plano entra como objetivo extra, sem marcar fracasso | Should |
| Play/pause pelo widget e pela bandeja | Should |
| Linha do tempo do dia mostrando ritmo e "pomodoros involuntários" (blocos entre pausas) | Should |
| Relato da manhã complementa o da noite (memória ativa) | Should |
| Sem notificação se o relato do dia já foi feito | Should |
| Pular o plano do dia e ainda poder dar play | Should |
| % em foco em destaque acima do total de horas | Could |
| Insights de IA (momentos de distração, padrões de foco) | Won't (por ora) |
| IA montando o resumo do dia a partir do plano | Won't (por ora) |
| Plano e relato por voz | Won't (por ora) |
| Metas de habilidade em tópicos com horas sugeridas; Anki | Won't (por ora) |

## Cenários

```gherkin
# language: pt
Funcionalidade: Dia de estudo com objetivos, play/pause e relatos
  Como quem estuda sozinho no próprio PC
  Quero começar e retomar o estudo com um clique, sem horário fixo, e registrar como foi o dia
  Para estudar sem barreira de entrada e me autoavaliar com o que realmente aconteceu

  Contexto:
    Dado que as matérias "Inglês", "Blender" e "Matemática" estão cadastradas
    E que a regra "YouTube" pelo título está como "Fora do estudo"
    E que a regra "Blender" pelo app está como "Estudo"
    # SUPOSIÇÃO: a regra "Blender" (app) ainda não existe nas regras de partida; o usuário a cria em Apps e sites (confirmar)

  # ---------- Plano do dia (relato inicial) ----------

  @must
  Cenário: Plano do dia aparece ao abrir o app pela primeira vez no dia
    Dado que hoje é 15/10 e o app ainda não foi aberto hoje
    Quando a pessoa abre o app
    Então vê a tela do plano do dia com um campo de texto para escrever o que quer fazer
    E vê as matérias "Inglês", "Blender" e "Matemática" para escolher como objetivos de hoje

  @must
  Cenário: Montar os objetivos do dia
    Dado que a pessoa está na tela do plano do dia de 15/10
    E escreveu "Revisar verbos irregulares e terminar a modelagem da caneca"
    E marcou "Inglês" e "Blender"
    Quando confirma o plano
    Então a lista de objetivos de hoje mostra "Inglês" com 00:00:00 e "Blender" com 00:00:00, cada um com botão de play
    E nenhum objetivo mostra horário de início ou fim
    E o texto do plano fica visível junto aos objetivos de hoje

  @must
  Cenário: Plano do dia sem nenhuma matéria cadastrada
    Dado que nenhuma matéria está cadastrada
    Quando a pessoa abre a tela do plano do dia
    Então vê um aviso de que ainda não há matérias
    E vê a opção de cadastrar uma matéria ali mesmo

  @must
  Cenário: Plano do dia não aparece de novo no mesmo dia
    Dado que a pessoa já confirmou o plano de 15/10
    Quando ela fecha e abre o app de novo em 15/10
    Então o app abre direto na lista de objetivos de hoje

  @must
  Cenário: Objetivo não estudado não aparece como atrasado
    Dado que o plano de 15/10 tem "Inglês" com 00:00:00
    E que são 22:00 de 15/10
    Quando a pessoa abre a lista de objetivos de hoje
    Então "Inglês" aparece como "a fazer"
    E não há indicação de atraso, cor de erro ou "dia perdido"
    # SUPOSIÇÃO: o rótulo "a fazer" é provisório (confirmar)

  @should
  Cenário: Pular o plano do dia
    Dado que a pessoa está na tela do plano do dia de 15/10
    Quando ela pula o plano sem escrever nem marcar nada
    Então vê a lista de objetivos de hoje vazia
    E consegue dar play em qualquer matéria cadastrada

  # ---------- Play / pause ----------

  @must
  Cenário: Começar a estudar com um clique
    Dado que "Inglês" está nos objetivos de hoje com 00:00:00
    E que nenhum objetivo está rodando
    Quando a pessoa clica em play em "Inglês"
    Então o relógio de "Inglês" começa a contar a partir de 00:00:00
    E a captura da janela ativa é ligada
    E a pessoa não precisa escolher duração

  @must
  Cenário: Pausar o estudo
    Dado que "Inglês" está rodando com 00:40:00
    Quando a pessoa clica em pause
    Então o relógio de "Inglês" para em 00:40:00
    E nenhuma janela é capturada enquanto estiver pausado

  @must
  Cenário: Retomar de onde parou
    Dado que "Inglês" está pausado com 00:40:00 em 15/10
    Quando a pessoa clica em play em "Inglês"
    Então o relógio de "Inglês" continua a partir de 00:40:00

  @must
  Cenário: Retomar depois de fechar e reabrir o app
    Dado que "Inglês" foi pausado com 00:40:00 em 15/10
    E que a pessoa fechou e reabriu o app em 15/10
    Quando a pessoa clica em play em "Inglês"
    Então o relógio de "Inglês" continua a partir de 00:40:00

  @must
  Cenário: Trocar de objetivo pausa o que estava rodando
    Dado que "Inglês" está rodando com 00:40:00
    E que "Blender" está pausado com 01:10:00
    Quando a pessoa clica em play em "Blender"
    Então "Inglês" fica pausado com 00:40:00
    E o relógio de "Blender" continua a partir de 01:10:00
    # SUPOSIÇÃO: só um objetivo roda por vez (confirmar)

  @must
  Cenário: Objetivo começa zerado num novo dia
    Dado que "Inglês" terminou 15/10 com 02:00:00
    E que hoje é 16/10 e "Inglês" está nos objetivos de hoje
    Quando a pessoa clica em play em "Inglês"
    Então o relógio de "Inglês" começa a partir de 00:00:00
    E as 02:00:00 de 15/10 continuam no histórico
    # SUPOSIÇÃO: o tempo acumulado é por dia, não contínuo entre dias (confirmar)

  @should
  Cenário: Play e pause pelo widget
    Dado que o app está no modo widget
    E que "Inglês" está rodando com 00:40:00
    Quando a pessoa clica em pause no widget
    Então o relógio de "Inglês" para em 00:40:00

  @should
  Cenário: Estudar matéria fora do plano é redirecionamento
    Dado que o plano de 15/10 tem só "Inglês"
    Quando a pessoa dá play em "Blender"
    Então "Blender" entra nos objetivos de hoje como objetivo extra e começa a contar
    E "Inglês" continua como "a fazer", sem marca de fracasso

  # ---------- Tempo produtivo e distração ----------

  @must
  Esquema do Cenário: Classificar o tempo do objetivo pelas regras de Apps e sites
    Dado que "Blender" está rodando
    Quando a janela ativa por 10 minutos é "<janela>"
    Então esses 10 minutos contam como "<tipo>" em "Blender"

    Exemplos:
      | janela                                    | tipo           |
      | Blender                                   | Estudo         |
      | Tutorial de Blender - YouTube             | Fora do estudo |
      | Gatinho fofo - YouTube                    | Fora do estudo |
    # SUPOSIÇÃO: o tutorial no YouTube cai em "Fora do estudo" pela regra existente e a pessoa reclassifica no resumo, como já acontece hoje (confirmar)

  # ---------- Resumo do dia (autoavaliação) ----------

  @must
  Cenário: Resumo do dia por objetivo
    Dado que em 15/10 "Blender" teve 2h40 de estudo e 20 min fora do estudo no YouTube
    E que "Inglês" teve 0h50 de estudo
    Quando a pessoa abre o resumo de 15/10
    Então vê "Blender" com 2h40 em foco e 20 min fora
    E vê "Inglês" com 0h50 em foco
    E vê em que horário aconteceram os 20 min fora em "Blender"

  @should
  Cenário: Ver o ritmo do dia entre pausas
    Dado que em 15/10 "Blender" rodou das 14:00 às 14:35, pausou, e rodou das 15:00 às 15:50
    Quando a pessoa abre a linha do tempo de 15/10
    Então vê dois blocos de estudo de "Blender", de 35 min e de 50 min
    E vê a pausa de 25 min entre eles

  @could
  Cenário: Qualidade acima de quantidade
    Dado que em 15/10 houve 3h registradas com 2h40 em foco
    Quando a pessoa abre o resumo de 15/10
    Então o percentual em foco (89%) aparece em destaque acima do total de horas

  # ---------- Relato final ----------

  @must
  Cenário: Notificação para o relato no fim do dia
    Dado que em 15/10 houve 3h registradas e o relato de 15/10 não foi feito
    Quando chegam as 22:00 de 15/10
    Então aparece uma notificação convidando a registrar como foi o dia
    # SUPOSIÇÃO: horário fixo configurável, padrão 22:00 (confirmar)

  @must
  Cenário: Registrar o relato do dia
    Dado que a pessoa abriu o relato de 15/10
    E escreveu "Rendi bem no Blender, mas perdi foco no YouTube depois do almoço"
    Quando salva o relato
    Então o relato aparece junto ao resumo de 15/10 com a data de 15/10

  @should
  Cenário: Sem notificação quando o relato já foi feito
    Dado que o relato de 15/10 já foi salvo às 20:00
    Quando chegam as 22:00 de 15/10
    Então nenhuma notificação de relato aparece

  # ---------- Relato na manhã seguinte ----------

  @must
  Cenário: Fazer o relato de ontem na manhã seguinte
    Dado que o relato de 15/10 não foi feito
    E que hoje é 16/10 e o app ainda não foi aberto hoje
    Quando a pessoa abre o app
    Então vê o pedido do relato de 15/10 antes do plano do dia de 16/10
    E pode salvar ou pular o relato de 15/10

  @should
  Cenário: Complementar o relato da noite na manhã seguinte
    Dado que o relato de 15/10 foi salvo às 22:10 com "Rendi bem no Blender"
    E que hoje é 16/10 e o app ainda não foi aberto hoje
    Quando a pessoa abre o app
    Então vê o relato de 15/10 e o resumo de 15/10
    E pode acrescentar um complemento ao relato de 15/10
    E o relato da noite continua guardado sem alteração
    # SUPOSIÇÃO: relato da noite (emoção) e da manhã (memória ativa) ficam separados no mesmo dia (confirmar)
```

## Suposições e perguntas em aberto

1. **Rotina com horário fixo:** os objetivos do dia substituem a grade de horários da tela Rotina (e o aviso "Hora do estudo"), ou a grade continua como opcional? A meta semanal de horas por matéria (Banco de horas) continua?
2. **Play/pause e o pomodoro:** o play vira um cronômetro aberto (sem 25/50 min) ou o pomodoro continua por baixo? O tempo "continua de onde parou" só no mesmo dia (suposição acima) ou acumula entre dias, como o timestamp do vídeo anterior no OBS?
3. **Anotação:** hoje o tempo só entra no banco de horas com anotação. Quando ela é pedida no novo fluxo: a cada pause, ao encerrar o objetivo do dia, ou no relato final?
4. **Relato final:** a notificação sai num horário fixo configurável (suposição: 22:00), depois de X minutos sem estudar, ou ao desligar o PC? O relato é só texto livre ou tem também uma escala (ex.: humor, satisfação)?
5. **Voz:** confirmo que plano e relato por voz ficam fora desta versão (só texto)?

Outras suposições marcadas nos cenários: rótulo "a fazer", só um objetivo rodando por vez, regra "Blender" criada pelo usuário, tutorial no YouTube reclassificado manualmente no resumo, relatos da noite e da manhã guardados separados.
