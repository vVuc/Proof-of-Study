# Feature: Estudo sem barreiras

## Contexto
- **Problema:** começar a estudar exige setup demais (rotina com horários, regras de apps, pomodoro com duração). Horários fixos geram pressão e a sensação de "dia perdido" quando um imprevisto atrasa o estudo, o que desanima a manter a rotina. Sem autoavaliação, o sistema depende 100% da disciplina do usuário.
- **Persona:** Thiago e os amigos desenvolvedores que vão testar o app, estudando várias matérias (ex.: Inglês, Blender, Programação) no próprio PC.
- **Impacto esperado:** começar uma sessão com um clique; trocar horários fixos por objetivos do dia; ver quanto falta para a meta da semana dividido nos dias disponíveis; registrar como foi o dia (autoavaliação) sem marcar o dia como fracasso.
- **Fora de escopo:** IA/LLM (resumo do dia, insights de distração e padrões de foco), relato por voz, metas de habilidade quebradas em tópicos, integração com Anki, recursos com amigos, iniciar com o Windows, apresentação no Infinity Learning.
- **Dependências / riscos:**
  - O formato salvo (`dados.json`, versão 2) muda: `BlocoRotina` deixa de ter horário, `Sessao`/`SessaoAtual` deixam de ter duração planejada, entra o tipo "sem classificação" e os relatos. Precisa da versão 3 com conversão em `atualizarDados`.
  - O relógio e os lembretes rodam no Rust (`rastreador.rs`, `lembretes.rs`): o fim automático do pomodoro e o aviso "Hora do estudo" por bloco precisam ser removidos ou trocados pela notificação das 18h.
  - A classificação existe duplicada no TS (`classificacao.ts`) e no Rust (`regra_que_casa`): o tipo novo tem que entrar nos dois.
- **Reutilizar:** matérias (`Materia`), meta semanal por matéria (`Meta` e `DialogMeta`), banco de horas e regra da anotação (`focoNoBanco`), captura da janela ativa (`janela.rs`), regras de apps e sites com as regras padrão, Resumo e Anotação da sessão, widget, Histórico.

## Prioridade (MoSCoW)
| Comportamento | Prioridade |
|---|---|
| Iniciar sessão com um clique (matéria + play), sem duração definida | Must |
| Pausar e retomar a mesma sessão de onde parou | Must |
| Encerrar a sessão e seguir para Resumo e Anotação (regra do banco mantida) | Must |
| Rotina semanal sem horários: só quais matérias em quais dias | Must |
| Nenhum dia aparece como "perdido" ou erro por não ter estudado | Must |
| Expectativa de horas: meta da semana dividida pelos dias disponíveis | Must |
| Janela sem regra fica "sem classificação" (não conta como fora) | Must |
| Notificação no fim do dia (padrão 18h, horário escolhido) com o que falta da expectativa | Must |
| Depois que o dia acaba, o calendário mostra o dia preenchido com o tempo em foco e as distrações | Must |
| Relato final do dia (texto livre) | Must |
| Marcar janelas "sem classificação" no relato final | Must |
| Relato final do dia anterior feito na manhã seguinte | Should |
| Relato inicial: plano do dia em texto livre ao abrir o app | Should |
| Ver no dia onde houve pausa, distração e quanto ficou em foco | Should |
| Transformar a marcação de uma janela em regra para as próximas vezes | Could |
| Resumo do dia por IA, insights de distração, voz | Won't (por ora) |
| Metas de habilidade em tópicos, Anki | Won't (por ora) |

## Cenários
```gherkin
# language: pt
Funcionalidade: Estudo sem barreiras
  Como estudante que usa o Proof of Study no próprio PC
  Quero começar a estudar com um clique e acompanhar minha meta sem horários fixos
  Para manter a rotina mesmo quando imprevistos acontecem

  Contexto:
    Dado que tenho as matérias "Inglês" e "Blender"
    E as regras padrão de apps e sites

  # ---------- Sessão: play / pause ----------

  @must
  Cenário: Iniciar uma sessão com um clique
    Dado que estou na tela Sessão sem sessão em andamento
    E escolhi a matéria "Blender"
    Quando aperto play
    Então o relógio começa a contar a partir de 00:00
    E a captura da janela ativa começa
    E não aparece nenhuma pergunta de duração

  @must
  Cenário: A sessão não termina sozinha
    Dado que tenho uma sessão de "Blender" rodando há 25 minutos
    Quando o relógio chega a 1h30
    Então a sessão continua rodando
    E não aparece aviso de fim de pomodoro

  @must
  Cenário: Pausar a sessão
    Dado que tenho uma sessão de "Blender" rodando com 40 minutos
    Quando aperto pause
    Então o relógio para em 00:40
    E a captura da janela ativa para
    E o tempo pausado não conta como foco nem como fora

  @must
  Cenário: Retomar de onde parou
    Dado que tenho uma sessão de "Blender" pausada em 00:40
    Quando aperto play
    Então o relógio volta a contar a partir de 00:40 na mesma sessão

  @must
  Cenário: Retomar depois de fechar o app
    Dado que tenho uma sessão de "Blender" pausada em 00:40
    E fechei e abri o app de novo
    Quando abro a tela Sessão
    Então vejo a sessão de "Blender" pausada em 00:40 com o botão play

  @must
  Cenário: Encerrar a sessão
    Dado que tenho uma sessão de "Blender" com 1h10 de relógio
    Quando encerro a sessão
    Então vejo o Resumo da sessão
    E depois a Anotação

  @must
  Cenário: Tempo só entra no banco com anotação
    Dado que encerrei uma sessão de "Inglês" com 50 minutos em foco
    E não escrevi anotação nem colei imagem
    Quando abro o Banco de horas de "Inglês"
    Então os 50 minutos aparecem como pendentes
    E não somam no banco da semana

  # ---------- Rotina sem horários ----------

  @must
  Cenário: Montar a rotina só com matérias por dia
    Dado que estou na tela Rotina
    Quando marco "Inglês" na segunda, quarta e sexta
    Então a rotina mostra "Inglês" nesses três dias
    E nenhum horário é pedido nem mostrado

  @must
  Cenário: Dia sem estudo não aparece como erro
    Dado que a rotina tem "Inglês" na segunda
    E na segunda não fiz nenhuma sessão de "Inglês"
    Quando abro a tela Rotina na terça
    Então a segunda não aparece marcada como perdida, atrasada ou com erro

  @must
  Cenário: Estudar outra matéria no dia não é falha
    Dado que a rotina tem "Inglês" na quarta
    E na quarta fiz 3h de "Blender" e nenhuma de "Inglês"
    Quando abro a tela Rotina
    Então as 3h de "Blender" aparecem na quarta
    E a quarta não aparece marcada como erro

  # ---------- Expectativa de horas ----------

  @must
  Cenário: Expectativa do dia a partir da meta da semana
    Dado que a meta de "Inglês" nesta semana é 6h
    E a rotina tem "Inglês" na segunda, quarta e sexta
    E é segunda e ainda não estudei "Inglês" nesta semana
    Quando abro o Banco de horas de "Inglês"
    Então vejo a expectativa de 2h para hoje

  @must
  Cenário: Expectativa recalculada com o que falta
    Dado que a meta de "Inglês" nesta semana é 6h
    E a rotina tem "Inglês" na segunda, quarta e sexta
    E na segunda entraram 1h no banco de "Inglês"
    Quando abro o Banco de horas de "Inglês" na quarta
    Então vejo que faltam 5h para a meta
    E a expectativa de 2h30 para hoje

  @must
  Cenário: Matéria sem meta não tem expectativa
    Dado que "Blender" não tem meta nesta semana
    Quando abro o Banco de horas de "Blender"
    Então não vejo expectativa de horas
    E vejo as horas que entraram no banco da semana

  @should
  Esquema do Cenário: Dias disponíveis para dividir a meta
    Dado que a meta de "Inglês" nesta semana é <meta>
    E a rotina tem "Inglês" em <dias_na_rotina>
    E hoje é <hoje> e nada entrou no banco de "Inglês"
    Quando abro o Banco de horas de "Inglês"
    Então vejo a expectativa de <expectativa> para hoje

    Exemplos:
      | meta | dias_na_rotina          | hoje    | expectativa |
      | 6h   | segunda, quarta, sexta  | segunda | 2h          |
      | 6h   | segunda, quarta, sexta  | sexta   | 6h          |
      | 4h   | terça, quinta           | terça   | 2h          |

  # ---------- Notificação e relato final ----------

  @must
  Cenário: Notificação no fim do dia com o que falta
    Dado que o horário do relato é 18:00 (padrão)
    E a expectativa de hoje para "Inglês" é 2h
    E hoje entraram 1h20 no banco de "Inglês"
    Quando o relógio do PC chega a 18:00
    Então recebo uma notificação dizendo que faltam 40min de "Inglês" hoje
    E a notificação abre o relato do dia

  @must
  Cenário: Notificação quando a expectativa foi atingida
    Dado que o horário do relato é 18:00
    E a expectativa de hoje para "Inglês" é 2h
    E hoje entraram 2h15 no banco de "Inglês"
    Quando o relógio do PC chega a 18:00
    Então recebo uma notificação convidando a registrar o relato do dia
    E ela não lista "Inglês" como pendente

  @must
  Cenário: Escolher o horário do relato
    Dado que o horário do relato é 18:00
    Quando mudo o horário do relato para 22:00
    Então a notificação de hoje sai às 22:00 e não às 18:00

  @must
  Cenário: Registrar o relato final do dia
    Dado que abri o relato do dia 14/10
    Quando salvo o texto "Rendi bem de manhã, à tarde me distraí com o celular"
    Então o relato fica salvo no dia 14/10

  @must
  Cenário: Marcar janelas sem classificação no relato
    Dado que hoje passei 15min numa janela "Blender Guru - Donut tutorial - YouTube"
    E nenhuma regra classificava essa janela no momento
    E abri o relato do dia
    Quando marco essa janela como "Estudo"
    Então os 15min passam a contar como foco nas sessões de hoje

  @should
  Cenário: Fazer o relato do dia anterior na manhã seguinte
    Dado que não fiz o relato do dia 14/10
    E hoje é 15/10 de manhã
    Quando abro o app
    Então posso registrar o relato do dia 14/10

  @could
  Cenário: Lembrar a marcação como regra
    Dado que no relato marquei "Blender Guru" como "Estudo"
    Quando escolho guardar essa marcação como regra
    Então "Blender Guru" aparece nas regras de Apps e sites como "Estudo"

  # ---------- Calendário preenchido depois do dia ----------

  @must
  Cenário: Dia preenchido com foco e distrações
    Dado que no dia 14/10 fiz uma sessão de "Blender" das 14:00 às 15:30
    E nela fiquei 1h10 em foco e 20min em "YouTube" (fora do estudo)
    Quando abro a tela Rotina no dia 15/10
    Então o dia 14/10 mostra o trecho das 14:00 às 15:30 com o tempo em foco e o tempo fora do estudo nas cores de foco (azul) e fora (vermelho)
    E mostra o total do dia: 1h10 em foco e 20min de distração

  @must
  Cenário: Dia preenchido com mais de uma sessão
    Dado que no dia 14/10 fiz uma sessão de "Inglês" das 09:00 às 10:00 e uma de "Blender" das 20:00 às 21:00
    Quando abro a tela Rotina no dia 15/10
    Então o dia 14/10 mostra os dois trechos nos seus horários, cada um com o nome da sua matéria

  @must
  Cenário: Dia sem sessão continua sem erro
    Dado que no dia 14/10 não fiz nenhuma sessão
    Quando abro a tela Rotina no dia 15/10
    Então o dia 14/10 continua mostrando só as matérias da rotina
    E não aparece marcado como perdido ou com erro

  @should
  Cenário: Distração destacada no dia preenchido
    Dado que o dia 14/10 está preenchido com a sessão de "Blender" das 14:00 às 15:30
    Quando passo o mouse no trecho fora do estudo
    Então vejo "YouTube · 20min"

  # ---------- Classificação sem setup ----------

  @must
  Cenário: Janela sem regra não conta como fora do estudo
    Dado que tenho uma sessão de "Blender" rodando
    E nenhuma regra cobre a janela "Blender Guru - Donut tutorial - YouTube"
    Quando fico 15min nessa janela
    Então esses 15min aparecem como "sem classificação"
    E não somam como fora do estudo
    E não aparece o aviso de distração

  @must
  Cenário: Janela com regra continua classificada
    Dado que tenho uma sessão de "Inglês" rodando
    E a regra padrão "Anki" marca o app como "Estudo"
    Quando fico 20min no Anki
    Então os 20min contam como foco

  # ---------- Relato inicial ----------

  @should
  Cenário: Escrever o plano do dia ao abrir o app
    Dado que é a primeira vez que abro o app no dia 15/10
    Quando escrevo "Hoje quero terminar a aula 3 de Blender e revisar vocabulário"
    Então o plano fica salvo no dia 15/10
    E aparece junto do relato final desse dia

  @should
  Cenário: Pular o plano do dia
    Dado que é a primeira vez que abro o app no dia 15/10
    Quando pulo o plano do dia
    Então vou para a tela Sessão sem precisar escrever nada

  # ---------- Autoavaliação do dia ----------

  @should
  Cenário: Ver pausas e distrações do dia
    Dado que hoje fiz duas sessões de "Blender"
    E na primeira pausei por 20min e fiquei 10min em "YouTube" (fora do estudo)
    Quando abro o relato do dia
    Então vejo o tempo em foco, a pausa de 20min e os 10min fora do estudo de cada sessão
```

## Suposições e perguntas em aberto
- `# SUPOSIÇÃO:` "após o dia" = o dia aparece preenchido no calendário a partir do dia seguinte (virada da meia-noite); o dia de hoje ainda não é preenchido. (confirmar se hoje deveria aparecer ao vivo ou depois do relato final)
- `# SUPOSIÇÃO:` o calendário preenchido é a grade da tela Rotina, com as sessões nos horários reais em que aconteceram (a rotina não tem mais horário, então só o registro tem). (confirmar)
- `# SUPOSIÇÃO:` "sem classificação" e pausas aparecem no dia preenchido? Por ora, só foco e fora do estudo. (confirmar)
- `# SUPOSIÇÃO:` "dias disponíveis" para dividir a meta são os dias da semana (de hoje até domingo) em que a matéria está na rotina, e a expectativa de hoje = horas que faltam ÷ dias disponíveis restantes, incluindo hoje. (confirmar)
- Pergunta: se a matéria tem meta mas não aparece em nenhum dia da rotina, divide pelos dias restantes da semana ou não mostra expectativa?
- `# SUPOSIÇÃO:` a notificação das 18h e o relato final são a mesma coisa: a notificação abre o relato. (confirmar)
- `# SUPOSIÇÃO:` o relato final tem só texto livre (a nota de 1 a 5 não foi confirmada). (confirmar)
- `# SUPOSIÇÃO:` marcar uma janela no relato vale só para as sessões daquele dia; virar regra é `@could`. (confirmar)
- `# SUPOSIÇÃO:` tempo pausado não conta como foco nem como fora. (confirmar)
- `# SUPOSIÇÃO:` o relato do dia anterior pode ser feito até o fim do dia seguinte. (confirmar o limite)
- `# SUPOSIÇÃO:` o relato inicial aparece na primeira vez que o app abre no dia e pode ser pulado, já que iniciar com o Windows está fora do MVP. (confirmar)
- Pergunta: o que acontece com os blocos da rotina já salvos (com horário) ao atualizar? Sugestão: viram "matéria X nesses dias" e os blocos de outras categorias (sono, treino, trabalho) somem.
- Pergunta: o aviso "Hora do estudo" por bloco sai junto com os horários?
