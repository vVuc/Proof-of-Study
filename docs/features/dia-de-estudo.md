# Feature: Dia de estudo (rotina opcional, cronômetro aberto e relato do dia)

> Escrito a partir da conversa resumida pelo Granola e das respostas do Thiago (14/10). O que está marcado com `# SUPOSIÇÃO` precisa de confirmação.

## Contexto

- **Problema:** começar a estudar tem barreira de entrada. Sistemas falham por complexidade, excesso de informação ou metas exageradas. Exemplo concreto: iniciar a gravação no OBS leva de 30 s a 1 min de preparo manual (abrir o vídeo anterior, pegar o timestamp, converter para segundos, abrir o OBS). No próprio Proof of Study, a sessão hoje pede matéria e duração (25/50 min) e acaba ao fim do pomodoro. A rotina com horário fixo gera pressão e a sensação de "dia perdido" quando a pessoa atrasa. Sem autoavaliação, o sistema depende 100% da disciplina do usuário e desanima.
- **Persona:** quem estuda sozinho no próprio PC (Thiago e o amigo que vai testar; por ora, o grupo de amigos desenvolvedores).
- **Impacto esperado:**
  - Começar a estudar com um clique e retomar de onde parou, sem preparo e sem escolher duração.
  - A rotina vira opcional: dá para planejar a grade ou só ligar a sessão do dia e ver o calendário do dia se preencher sozinho.
  - Atividades impeditivas (trabalho, academia) ocupam a rotina e deixam claro o horário que sobra para estudar, sem contar como falha.
  - Objetivos do dia sem horário, sem atraso e sem "dia perdido". Estudar outra coisa no lugar do planejado é redirecionamento, não fracasso.
  - A pessoa se autoavalia: vê onde houve pausa, ritmo e distração (3 h produtivas valem mais que 8 h dispersas) e valida o dia com a anotação no fim do dia ou no começo do seguinte.
- **Fora de escopo (por ora):** IA (resumo do dia e insights), entrada por voz, metas de habilidade quebradas em tópicos com horas sugeridas, integração com Anki, recursos com amigos, publicação no servidor Infinity Learning.
- **Dependências / riscos:**
  - O relógio e a captura rodam no Rust (`src-tauri/src/rastreador.rs`), que hoje trabalha com duração fixa e fase `concluido`. O cronômetro aberto, a parada por inatividade e a virada de dia mudam esse contrato.
  - No Linux com Wayland o tempo sem uso não é medido (README), então a parada por inatividade não funciona lá; só na sessão X11.
  - "Notificar ao desligar o PC": com o PC desligado nada aparece, e o Windows e o Linux dão pouco tempo ao app durante o desligamento. Por isso o lembrete garantido é o da próxima abertura (ver perguntas).
  - A anotação passa a valer pelo dia, não por sessão. Hoje o banco de horas soma por sessão com anotação (`Sessao.anotacao`), então o modelo de dados e o banco de horas mudam.
  - Novo formato de dados (objetivos do dia, relato/anotação do dia, blocos impeditivos) exige subir `VERSAO_DADOS` e converter em `atualizarDados`.
  - Notificações usam os lembretes do Rust (`src-tauri/src/lembretes.rs`), que hoje só conhecem os blocos da rotina.
- **Reutilizar:**
  - Matérias (`Materia`) como categorias de estudo (Inglês, Blender…).
  - Blocos da rotina e suas categorias (`trabalho`, `treino`, `sono`…) para as atividades impeditivas.
  - Regras de Apps e sites (Estudo / Fora do estudo / Ignorar) e a classificação (`classificacao.ts`) para separar tempo produtivo de distração. A IA não é necessária para isso.
  - Captura da janela ativa, tempo ausente (limite de ausência das preferências) e "Pausar captura".
  - Linha do tempo e tela de Resumo (incluindo reclassificar uma janela).
  - Widget e bandeja para o play/pause fora da janela principal.
  - Banco de horas e metas semanais por matéria.

## Prioridade (MoSCoW)

| Comportamento | Prioridade |
|---|---|
| Play em um objetivo começa a contar e capturar, sem escolher duração | Must |
| Pause para o relógio e a captura | Must |
| Play de novo retoma o tempo do dia de onde parou, inclusive depois de reabrir o app | Must |
| Só um objetivo rodando por vez; play em outro pausa o atual | Must |
| Relógio para sozinho por inatividade | Must |
| Relógio para na virada do dia; o dia novo começa zerado | Must |
| Separar tempo de estudo e fora do estudo pelas regras já existentes | Must |
| Usar o app sem rotina definida | Must |
| Atividades impeditivas na rotina mostram o horário disponível para estudo | Must |
| Ligar a sessão do dia e ver o calendário de hoje se preencher sozinho | Must |
| Plano do dia ao abrir o app: escrever o que quer fazer e escolher as matérias | Must |
| Objetivos do dia sem horário e sem indicação de atraso | Must |
| Anotação do dia no fim do dia ou na manhã seguinte valida o tempo no banco de horas | Must |
| Dia sem anotação fica "a validar", sem bloquear nada | Must |
| Lembrete do relato na próxima abertura, sem impedir o uso | Must |
| Resumo do dia: foco, fora e pausas por objetivo | Must |
| Estudar matéria fora do plano entra como objetivo extra, sem marcar fracasso | Should |
| Play/pause pelo widget | Should |
| Linha do tempo do dia mostrando ritmo e "pomodoros involuntários" (blocos entre pausas) | Should |
| Relato da manhã complementa o da noite (memória ativa) | Should |
| Pular o plano do dia e ainda poder dar play | Should |
| Bloco de estudo planejado na rotina comparado com o que o calendário registrou | Should |
| Lembrete do relato ao desligar o PC | Could |
| % em foco em destaque acima do total de horas | Could |
| Insights de IA (momentos de distração, padrões de foco) | Won't (por ora) |
| IA montando o resumo do dia a partir do plano | Won't (por ora) |
| Plano e relato por voz | Won't (por ora) |
| Metas de habilidade em tópicos com horas sugeridas; Anki | Won't (por ora) |

## Cenários

```gherkin
# language: pt
Funcionalidade: Dia de estudo com rotina opcional, cronômetro aberto e relato do dia
  Como quem estuda sozinho no próprio PC
  Quero começar e retomar o estudo com um clique, ver o horário que tenho livre e validar meu dia no fim
  Para estudar sem barreira de entrada e me autoavaliar com o que realmente aconteceu

  Contexto:
    Dado que as matérias "Inglês", "Blender" e "Matemática" estão cadastradas
    E que a regra "YouTube" pelo título está como "Fora do estudo"
    E que a regra "Blender" pelo app está como "Estudo"
    E que o limite de ausência nas preferências é 5 minutos
    # SUPOSIÇÃO: a regra "Blender" (app) ainda não existe nas regras de partida; o usuário a cria em Apps e sites

  # ---------- Rotina opcional ----------

  @must
  Cenário: Usar o app sem rotina definida
    Dado que a rotina da semana não tem nenhum bloco
    E que "Inglês" está nos objetivos de hoje
    Quando a pessoa clica em play em "Inglês"
    Então o relógio de "Inglês" começa a contar
    E nenhum aviso pede para montar a rotina

  @must
  Cenário: Atividades impeditivas mostram o horário disponível para estudo
    Dado que a rotina tem o bloco "Trabalho" de segunda a sexta, das 09:00 às 18:00
    E que a rotina tem o bloco "Academia" de segunda a sexta, das 19:00 às 20:00
    Quando a pessoa abre a rotina de segunda-feira
    Então vê como disponíveis para estudo os horários das 08:00 às 09:00, das 18:00 às 19:00 e das 20:00 à meia-noite
    E vê o total de 6h disponíveis na segunda-feira
    E "Trabalho" e "Academia" aparecem como compromissos, sem cor de falha ou de distração

  @must
  Cenário: Ligar a sessão do dia e ver o calendário de hoje se preencher
    Dado que a pessoa ligou a sessão do dia às 14:00 de 15/10, sem dar play em nenhum objetivo
    E que ficou das 14:00 às 14:30 no Blender e das 14:30 às 14:40 em "Gatinho fofo - YouTube"
    Quando a pessoa abre o calendário de 15/10 às 14:45
    Então o calendário de 15/10 mostra das 14:00 às 14:30 como estudo
    E mostra das 14:30 às 14:40 como fora do estudo
    # SUPOSIÇÃO: sem objetivo com play, o estudo fica sem matéria até a pessoa atribuir (confirmar, pergunta 1)

  @should
  Cenário: Comparar bloco de estudo planejado com o registrado
    Dado que a rotina tem o bloco de estudo "Inglês" na quarta-feira, das 20:00 às 21:00
    E que em 15/10 (quarta) o calendário registrou estudo de "Inglês" das 20:30 às 21:30
    Quando a pessoa abre o calendário de 15/10
    Então vê o bloco planejado das 20:00 às 21:00 e o registrado das 20:30 às 21:30 lado a lado
    E não há indicação de atraso

  # ---------- Plano do dia ----------

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
    # SUPOSIÇÃO: o rótulo "a fazer" é provisório

  @should
  Cenário: Pular o plano do dia
    Dado que a pessoa está na tela do plano do dia de 15/10
    Quando ela pula o plano sem escrever nem marcar nada
    Então vê a lista de objetivos de hoje vazia
    E consegue dar play em qualquer matéria cadastrada

  # ---------- Cronômetro aberto (play / pause) ----------

  @must
  Cenário: Começar a estudar com um clique
    Dado que "Inglês" está nos objetivos de hoje com 00:00:00
    E que nenhum objetivo está rodando
    Quando a pessoa clica em play em "Inglês"
    Então o relógio de "Inglês" começa a contar a partir de 00:00:00, sem tempo final
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
    # SUPOSIÇÃO: só um objetivo roda por vez

  @must
  Cenário: Relógio para por inatividade
    Dado que "Inglês" está rodando com 00:40:00
    Quando a pessoa fica 5 minutos sem mexer no teclado e no mouse
    Então o relógio de "Inglês" para em 00:40:00
    E os 5 minutos parados não contam como estudo
    # SUPOSIÇÃO: ao mexer de novo, o relógio volta a contar sozinho (confirmar, pergunta 2)

  @must
  Cenário: Relógio para na virada do dia
    Dado que "Inglês" está rodando em 15/10 e marca 01:00:00 às 23:50
    Quando o relógio do PC passa da meia-noite
    Então "Inglês" de 15/10 fecha com 01:10:00
    E o relógio para
    E os minutos depois da meia-noite não entram em 15/10

  @must
  Cenário: Objetivo começa zerado num novo dia
    Dado que "Inglês" terminou 15/10 com 02:00:00
    E que hoje é 16/10 e "Inglês" está nos objetivos de hoje
    Quando a pessoa clica em play em "Inglês"
    Então o relógio de "Inglês" começa a partir de 00:00:00
    E as 02:00:00 de 15/10 continuam no histórico

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
      | janela                        | tipo           |
      | Blender                       | Estudo         |
      | Tutorial de Blender - YouTube | Fora do estudo |
      | Gatinho fofo - YouTube        | Fora do estudo |
    # SUPOSIÇÃO: o tutorial no YouTube cai em "Fora do estudo" pela regra existente e a pessoa reclassifica no resumo, como já acontece hoje

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

  # ---------- Anotação do dia (valida o tempo) ----------

  @must
  Cenário: Dia sem anotação fica a validar
    Dado que em 15/10 houve 2h40 de estudo em "Blender"
    E que a anotação de 15/10 não foi feita
    Quando a pessoa abre o banco de horas
    Então as 2h40 de 15/10 aparecem como "a validar"
    E não entram no total de horas focadas de "Blender"
    # SUPOSIÇÃO: o rótulo "a validar" é provisório; sem prazo para validar (confirmar, pergunta 4)

  @must
  Cenário: Anotar o dia no fim do dia valida o tempo
    Dado que em 15/10 houve 2h40 de estudo em "Blender"
    E que a pessoa abriu a anotação de 15/10 às 22:30 de 15/10
    E escreveu "Terminei a modelagem da caneca. Rendi bem, mas perdi foco no YouTube depois do almoço"
    Quando salva a anotação
    Então as 2h40 de 15/10 entram no banco de horas de "Blender"
    E a anotação aparece junto ao resumo de 15/10

  @must
  Cenário: Anotar o dia anterior na manhã seguinte valida o tempo
    Dado que em 15/10 houve 2h40 de estudo em "Blender" e a anotação de 15/10 não foi feita
    E que hoje é 16/10
    Quando a pessoa salva a anotação de 15/10 com "Terminei a modelagem da caneca"
    Então as 2h40 de 15/10 entram no banco de horas de "Blender" na data de 15/10

  @must
  Cenário: Lembrete do relato na próxima abertura, sem impedir o uso
    Dado que a anotação de 15/10 não foi feita
    E que hoje é 16/10 e o app ainda não foi aberto hoje
    Quando a pessoa abre o app
    Então vê um lembrete de que o dia 15/10 está a validar, com a opção de anotar agora
    E consegue montar o plano de 16/10 e dar play sem anotar 15/10

  @should
  Cenário: Complementar o relato da noite na manhã seguinte
    Dado que a anotação de 15/10 foi salva às 22:30 com "Rendi bem no Blender"
    E que hoje é 16/10 e o app ainda não foi aberto hoje
    Quando a pessoa abre o app
    Então vê a anotação de 15/10 e o resumo de 15/10
    E pode acrescentar um complemento à anotação de 15/10
    E a anotação da noite continua guardada sem alteração
    # SUPOSIÇÃO: o complemento da manhã (memória ativa) não é obrigatório e não muda a validação

  @could
  Cenário: Lembrete do relato ao desligar o PC
    Dado que em 15/10 houve 2h40 de estudo e a anotação de 15/10 não foi feita
    Quando a pessoa manda desligar o PC
    Então aparece um lembrete de que o dia 15/10 está a validar
    E o desligamento segue sem esperar resposta
    # SUPOSIÇÃO: depende do que o sistema operacional permite durante o desligamento (confirmar, pergunta 3)
```

## Decisões (respostas de 14/10)

1. A rotina continua, mas opcional. Dá para montar a grade ou só ligar a sessão do dia e ver o calendário se preencher. Atividades impeditivas (trabalho, academia) entram na rotina para mostrar o horário disponível.
2. Cronômetro aberto. O tempo para por inatividade ou na virada do dia.
3. A anotação é pedida principalmente no fim do dia ou no começo do seguinte e valida o desempenho do dia.
4. O lembrete do relato aparece ao desligar o PC ou no início do dia seguinte, sem impedir o uso.
5. Voz fica de fora por enquanto.

## Perguntas em aberto

1. **Sessão do dia sem play num objetivo:** o tempo de estudo capturado vai para qual matéria? (A) fica "estudo sem matéria" e a pessoa atribui na anotação do dia (recomendado); (B) a sessão do dia exige um objetivo com play.
2. **Volta da inatividade:** ao mexer no teclado ou no mouse, o relógio volta a contar sozinho (recomendado) ou espera um novo play?
3. **Lembrete ao desligar:** com o PC desligado nada aparece, e o desligamento dá pouco tempo ao app. Aceita que o lembrete garantido seja o da próxima abertura, deixando o "ao desligar" como tentativa (recomendado)?
4. **Prazo para validar:** um dia sem anotação fica "a validar" para sempre (recomendado) ou perde a validação depois de algum prazo?

Outras suposições marcadas nos cenários: rótulos "a fazer" e "a validar", só um objetivo rodando por vez, regra "Blender" criada pelo usuário, tutorial no YouTube reclassificado no resumo, complemento da manhã opcional.
