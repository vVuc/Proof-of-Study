# IA com Gemini: insights, trabalho e voz — Specification

## Problem Statement

A autoanálise de hoje é só estatística, e a classificação das janelas depende de regras fixas: a mesma ferramenta (VS Code, navegador) serve para estudo, trabalho e lazer, e a regra padrão "VS Code → Estudo" faz o expediente inteiro contar como estudo. O plano do dia falado vira objetivos só por busca de palavras, e a voz exige baixar um modelo local de 60 a 190 MB e uma compilação à parte. Com uma chave do Gemini informada pela própria pessoa e os horários de trabalho que a Rotina já guarda, o app separa estudo, trabalho e diversão, a IA escreve os insights do dia e da semana e a fala é transcrita ao vivo em português.

## Goals

- [ ] O tempo de trabalho nunca conta como estudo: o horário de Trabalho da Rotina e os objetivos de trabalho classificam sozinhos, e a IA sugere o resto no relato final para a pessoa confirmar.
- [ ] Dar um insight do dia e um da semana, em português e sem julgamento, a partir da linha do tempo, dos objetivos, da Rotina e dos relatos.
- [ ] Falar o plano do dia, ver o texto aparecer enquanto fala e receber os objetivos de estudo e de trabalho montados pela IA, sem modelo local.
- [ ] Zero chamadas ao Gemini enquanto a IA estiver desligada.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Comandos de voz para ações do app (play, pausa, criar objetivo) | Decidido na discussão: a voz serve ao plano e aos relatos; um assistente de voz é outra feature |
| A IA aplicar classificações direto, sem confirmação | Decidido: a IA sugere e a pessoa confirma; o banco de horas continua determinístico |
| Outros provedores (OpenAI, Claude, LLM local) | O pedido é o Gemini com a chave da pessoa |
| Transcrição no PC sem internet | Decidido: o Whisper local sai; sem IA ligada, o relato é só texto |
| Insights automáticos (agendados, ao abrir o app, por notificação) | Decidido: só por clique, para controlar a cota da chave |
| Escolher o modelo do Gemini nas opções | Decidido: modelo fixo no código |
| A IA criar matérias ou regras | A IA só sugere correções e cria objetivos do dia |
| Itens de Trabalho da Rotina virarem objetivos do dia | O horário do item já classifica o trabalho; objetivos de trabalho vêm do plano ou do "adicionar objetivo" |
| Chat livre com a IA | Fora do pedido |
| Enviar as anotações das sessões e as imagens | Não são necessárias para classificar nem para os insights; menos dado pessoal sai do PC |
| Sincronizar insights entre PCs | Os dados continuam locais |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here - nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| O que a voz faz com a IA | O Gemini transcreve ao vivo; terminada a fala, só o texto vai para a IA montar o plano | Decidido na discussão | y |
| Whisper local | Sai do app: o download dos modelos, a transcrição no PC e a compilação `voz` (whisper.cpp) | Decidido na discussão | y |
| A IA muda os números do app? | A IA sugere as correções no relato final e a pessoa confirma; nada muda sem confirmação | Decidido na discussão | y |
| Trabalho e diversão | "Trabalho" vira um tipo novo (não soma no banco, não é distração); diversão = fora do estudo | Decidido na discussão | y |
| Contexto do usuário | Campo "Sobre você" nas opções + matérias, metas, objetivos, Rotina e relatos | Decidido na discussão | y |
| Quando o insight do dia roda | Só pelo clique em "Analisar o dia com IA" no relato final; o resultado fica salvo no dia | Decidido na revisão | y |
| Quando o insight da semana roda | Pelo clique na Autoanálise; a escolha começa na última semana completa (de segunda a domingo) e aceita a atual; fica salvo na semana | Decidido na revisão | y |
| Modelo usado | Fixo no código: um Gemini da família Flash para as análises e o `gemini-3.5-transcribe-live` para a fala; os IDs são conferidos de novo no Design | Decidido na revisão; o modelo de transcrição ao vivo é o da documentação do Gemini | y |
| Objetivos do plano | A IA cria objetivos de estudo e de trabalho; lazer citado fica no texto do plano, como contexto do insight | Decidido na revisão | y |
| Objetivo manual | O "adicionar objetivo" da tela Hoje escolhe Estudo ou Trabalho (padrão: Estudo) | Decidido na revisão | y |
| Horário de trabalho | Dentro de um item de Trabalho com horário na Rotina, o que seria estudo só por regra vira trabalho; a janela com termo de estudo e sem termo de trabalho continua estudo | Decidido na revisão (proposta da pessoa) | y |
| Termos de estudo e de trabalho na mesma janela | O termo do objetivo de trabalho vence, dentro e fora do horário de trabalho | Segue o princípio "tempo de trabalho não conta como estudo"; termos de trabalho costumam ser do projeto e mais específicos | y |
| Aviso de distração no horário de trabalho | Não dispara dentro de um item de Trabalho da Rotina | Com um play por dia, a sessão roda no expediente; Slack e Teams sem regra dariam aviso o tempo todo | y |
| Pedir os horários de trabalho | No relato final, quando o dia teve trabalho e a Rotina não tem nenhum item de Trabalho com horário, aparece uma sugestão com link para a Rotina e "Não mostrar de novo" | É a forma de "pedir para a pessoa informar a rotina de trabalho" sem interromper o dia | y |
| Mudança no horário de trabalho | Recalcula só as sessões dos dias ainda sem relato final; os dias já validados não mudam | O relato final é o que valida o banco; mudar um dia validado sem a pessoa ver seria uma surpresa | y |
| Duração máxima da fala | 10 minutos por gravação | É o limite da sessão de transcrição ao vivo do Gemini | y |
| Modelos do Whisper já baixados | Apagados na primeira abertura da versão nova | Liberam de 60 a 190 MB que o app não usa mais | y |
| Entrega da voz | A voz ao vivo e a saída do Whisper vão na mesma versão | Evita uma versão sem nenhuma voz | y |
| Ligar e desligar a IA | Um interruptor único "Usar IA (Gemini)" nas opções, desligado por padrão, que só liga com chave válida e consentimento | Coerente com "dados só no PC" do README | y |
| O que é enviado ao Gemini | "Sobre você", matérias (nome e termos), metas da semana, objetivos do dia, itens da Rotina com horário, relatos (texto e humor), grupos de janelas do dia (rótulo, título mais longo do grupo, programa, intervalos e tipo atual), pausas e o áudio da fala (ao vivo, em pedaços); nunca anotações nem imagens | Basta para classificar, transcrever e escrever os insights | y |
| Plano gratuito do Gemini | O consentimento avisa que, no plano gratuito, o Google pode usar o conteúdo para melhorar os produtos dele e ter revisão humana | Termos oficiais da API (ai.google.dev/gemini-api/terms) | y |
| Onde a chave fica | Fora do `dados.json`, do log e do "Exportar diagnóstico"; o mecanismo (cofre do sistema ou arquivo à parte) sai no Design | A chave é um segredo; o `dados.json` pode ser copiado | y |
| Tamanho da linha do tempo enviada | No máximo os 200 grupos de janela mais longos do dia; o resto vai somado numa linha "outros" | Limita o tamanho do prompt e o custo | y |
| Nova tentativa automática | Nenhuma: em erro, a mensagem aparece e a pessoa clica de novo | Não gasta cota sem a pessoa saber | y |
| Cor do tipo trabalho | A cor do Trabalho que a Rotina já usa (`#d9d0c1`) | Mantém o design system atual | y |
| Insights salvos ao remover a chave | Continuam salvos e visíveis; só as novas análises ficam indisponíveis | O texto já é da pessoa; apagar seria uma surpresa | y |
| Limite do "Sobre você" | 2.000 caracteres | Contexto suficiente sem inflar cada prompt | y |
| Grupos fixos (ausente do PC, o próprio app) | Não recebem sugestão da IA | Já são fixos na classificação atual (`classe.fixo`) | y |
| Tempo limite de uma análise | 60 segundos | Uma análise do dia com 200 grupos cabe com folga; acima disso, a pessoa precisa de retorno | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Ligar a IA com a minha chave ⭐ MVP

**User Story**: Como pessoa que usa o app, quero informar a minha chave do Gemini e um texto sobre mim para que a IA conheça o meu contexto, e só depois de eu concordar com o que sai do PC.

**Why P1**: Os insights, o plano e a voz dependem da chave, do consentimento e do contexto.

**Acceptance Criteria**:

1. The app SHALL manter a IA desligada por padrão e não fazer nenhuma chamada ao Gemini enquanto ela estiver desligada. (IACONF-01)
2. WHEN a pessoa liga "Usar IA (Gemini)" THEN o app SHALL mostrar a tela de consentimento com a lista do que é enviado (incluindo o áudio da fala), o aviso do plano gratuito e os botões "Concordo e ligar" e "Cancelar". (IACONF-02)
3. WHEN a pessoa clica em "Cancelar" no consentimento THEN o app SHALL manter a IA desligada. (IACONF-03)
4. WHEN a pessoa salva uma chave THEN o app SHALL testá-la com uma chamada ao Gemini e só guardar a chave se o Gemini aceitá-la. (IACONF-04)
5. IF o Gemini recusar a chave no teste THEN o app SHALL mostrar "O Gemini recusou esta chave. Confira se ela foi copiada inteira." e manter a IA desligada. (IACONF-05)
6. IF não houver conexão no teste da chave THEN o app SHALL mostrar "Sem conexão com o Gemini. A chave não foi salva." e manter a IA desligada. (IACONF-06)
7. The app SHALL guardar a chave fora do `dados.json` e nunca escrevê-la no log nem no "Exportar diagnóstico". (IACONF-07)
8. WHILE há uma chave salva the app SHALL mostrar só os 4 últimos caracteres dela, com o botão "Remover chave". (IACONF-08)
9. WHEN a pessoa remove a chave THEN o app SHALL apagar a chave guardada e desligar a IA. (IACONF-09)
10. The campo "Sobre você" SHALL aceitar até 2.000 caracteres e recusar a digitação além disso. (IACONF-10)
11. The app SHALL incluir o "Sobre você" salvo em toda chamada de insight e de plano do dia. (IACONF-11)

**Independent Test**: Ligar a IA com uma chave válida e ver os 4 últimos caracteres; tentar com uma chave inválida e ver a mensagem com a IA desligada; abrir o `dados.json` e o diagnóstico exportado e não encontrar a chave.

---

### P1: Trabalho como tipo próprio ⭐ MVP

**User Story**: Como dev que trabalha e estuda no mesmo PC, quero que janelas e objetivos possam ser de trabalho para que o trabalho não infle o banco de horas nem conte como distração.

**Why P1**: Sem o tipo, nem o horário de trabalho nem a IA têm onde pôr o trabalho que separam do estudo.

**Acceptance Criteria**:

1. The app SHALL oferecer "Trabalho" ao lado de Estudo, Fora do estudo e Ignorar nas regras de Apps e sites e nas correções do relato final. (TRAB-01)
2. WHEN uma janela é classificada como trabalho THEN o app SHALL somar o tempo dela num total de trabalho do dia, fora do foco, do fora do estudo e do banco de horas. (TRAB-02)
3. WHILE a janela ativa é de trabalho the app SHALL NOT disparar o aviso de distração. (TRAB-03)
4. The app SHALL mostrar o total de trabalho do dia na tela Sessão e no relato final, separado do estudo e do fora, na cor do Trabalho da Rotina. (TRAB-04)
5. The Autoanálise SHALL deixar o tempo de trabalho fora da lista de distrações e fora do mapa de foco. (TRAB-05)
6. WHEN o app abre dados do formato 3 THEN ele SHALL convertê-los para o formato 4, guardando antes a cópia do arquivo antigo, sem mudar o tipo de nenhuma regra nem de nenhuma correção existente, com os objetivos existentes como objetivos de estudo. (TRAB-06)
7. The "adicionar objetivo" da tela Hoje SHALL oferecer a escolha entre Estudo e Trabalho, com Estudo marcado por padrão. (TRAB-07)
8. WHEN uma janela casa com um termo de um objetivo de trabalho do dia THEN o app SHALL classificá-la como trabalho, mesmo que ela case também com termos de estudo ou com uma regra. (TRAB-08)
9. WHEN uma janela é ligada a um objetivo de trabalho THEN o app SHALL mostrar o tempo dela nesse objetivo na tela Hoje e somá-lo no total de trabalho. (TRAB-09)

**Independent Test**: Criar a regra "Slack → Trabalho", ficar 10 min no Slack com o dia rodando e ver 10 min em Trabalho na Sessão, nenhum aviso de distração e o banco de horas sem esses 10 min; adicionar o objetivo de trabalho "empresa-api" e ver uma janela "empresa-api [Rust] - VS Code" contar nele, e não em Rust.

---

### P1: Horário de trabalho da Rotina ⭐ MVP

**User Story**: Como pessoa com horário de trabalho, quero que o app use os itens de Trabalho da minha Rotina para que o expediente no VS Code não conte como estudo.

**Why P1**: É o que resolve o caso principal (regra genérica de estudo no expediente) sem depender da IA.

**Acceptance Criteria**:

1. WHILE o horário está dentro de um item de Trabalho com horário da Rotina, WHEN uma janela é estudo só por uma regra de Apps e sites (sem termo de matéria nem de objetivo de estudo) THEN o app SHALL classificá-la como trabalho. (EXPED-01)
2. WHILE o horário está dentro de um item de Trabalho com horário da Rotina the app SHALL manter como estudo a janela que casa com um termo de matéria ou de objetivo de estudo e com nenhum termo de objetivo de trabalho. (EXPED-02)
3. WHILE o horário está dentro de um item de Trabalho com horário da Rotina the app SHALL NOT disparar o aviso de distração. (EXPED-03)
4. WHEN um item de Trabalho termina depois da meia-noite THEN o app SHALL aplicar o horário de trabalho até o fim dele no dia seguinte, como a grade da Rotina já mostra. (EXPED-04)
5. WHEN o relato final de um dia com tempo de trabalho é aberto e a Rotina não tem nenhum item de Trabalho com horário THEN o app SHALL mostrar "Cadastre seus horários de trabalho na Rotina para o app separar trabalho e estudo sozinho.", com o link para a Rotina e o botão "Não mostrar de novo". (EXPED-05)
6. WHEN a pessoa clica em "Não mostrar de novo" THEN o app SHALL NOT mostrar essa sugestão de novo. (EXPED-06)
7. WHEN um item de Trabalho da Rotina é criado, mudado ou apagado THEN o app SHALL recalcular as sessões dos dias ainda sem relato final com o horário novo. (EXPED-07)

**Independent Test**: Cadastrar Trabalho de segunda a sexta das 9h às 18h; numa segunda, 1h no VS Code às 10h vira Trabalho, 30 min no `rust-book` (matéria Rust) às 12h continuam Estudo e nenhum aviso de distração dispara no Slack às 15h; apagar o item e ver a sugestão no relato final.

---

### P1: Insight do dia com sugestões no relato final ⭐ MVP

**User Story**: Como pessoa no fim do dia, quero que a IA leia a minha linha do tempo com o meu plano, a minha Rotina e o meu contexto para que ela diga o que foi estudo, trabalho e diversão e eu só confirme.

**Why P1**: É o pedido central: classificar o dia pelo objetivo e pelo contexto, além das regras e do horário.

**Acceptance Criteria**:

1. WHERE a IA está ligada the relato final SHALL mostrar o botão "Analisar o dia com IA" nos dias com pelo menos uma sessão. (INSD-01)
2. WHEN a pessoa clica em "Analisar o dia com IA" THEN o app SHALL enviar ao Gemini o "Sobre você", as matérias, as metas da semana, os objetivos e o relato inicial do dia, os itens da Rotina com horário daquele dia, os grupos de janelas com o tipo atual e os intervalos, e as pausas. (INSD-02)
3. WHILE a análise do dia está em andamento the app SHALL desabilitar o botão, mostrar "Analisando o dia…" e não enviar uma segunda chamada. (INSD-03)
4. WHEN a análise do dia chega THEN o app SHALL mostrar em cada grupo de janelas não fixo a sugestão da IA (estudo de uma matéria, trabalho, fora do estudo ou ignorar) com uma justificativa de até 140 caracteres, marcada como "Sugestão da IA". (INSD-04)
5. The app SHALL NOT aplicar nenhuma sugestão da IA às correções do dia sem que a pessoa a aceite. (INSD-05)
6. WHEN a pessoa aceita uma sugestão THEN o app SHALL aplicá-la como uma correção manual daquele grupo, que entra no banco de horas ao salvar o relato, como hoje. (INSD-06)
7. WHEN a pessoa clica em "Aceitar todas" THEN o app SHALL aplicar todas as sugestões que ainda não foram aceitas nem recusadas. (INSD-07)
8. WHEN a análise do dia chega THEN o app SHALL mostrar o texto do insight com o tempo de estudo, de trabalho e de diversão e a comparação com o plano do dia. (INSD-08)
9. The prompt do insight do dia SHALL pedir português do Brasil, tom neutro e descritivo, sem as palavras "perdido", "fracasso" e "falha" nem equivalentes. (INSD-09)
10. WHEN o insight do dia é gerado THEN o app SHALL salvá-lo no dia, junto das sugestões, e mostrá-lo ao reabrir o relato daquele dia. (INSD-10)
11. WHEN a pessoa clica em "Gerar de novo" THEN o app SHALL substituir o insight e as sugestões salvos do dia pelos novos, mantendo as correções já aceitas. (INSD-11)
12. IF o dia tem mais de 200 grupos de janela THEN o app SHALL enviar os 200 mais longos e o tempo somado dos demais numa linha "outros". (INSD-12)
13. IF a resposta cita um grupo que não existe no dia ou uma matéria que não existe THEN o app SHALL descartar só essa sugestão e mostrar as válidas. (INSD-13)

**Independent Test**: Com o plano "estudar Rust e corrigir o bug do projeto da empresa", o "Sobre você" dizendo que o repositório `empresa-api` é trabalho e nenhum item de Trabalho na Rotina, um dia com VS Code em `empresa-api` e em `rust-book` mostra a sugestão "Trabalho" para o primeiro e "Estudo" para o segundo; ao aceitar todas e salvar, o banco de horas fica só com o estudo.

---

### P1: Falhas da IA sem travar o app ⭐ MVP

**User Story**: Como pessoa que depende do relato para validar as horas, quero que uma falha da IA nunca me impeça de fechar o dia.

**Why P1**: A chamada é externa e usa a cota da pessoa; ela vai falhar às vezes.

**Acceptance Criteria**:

1. IF o Gemini não responder a uma análise em 60 segundos THEN o app SHALL cancelar a chamada e mostrar "O Gemini demorou demais. Tente de novo." (IAERR-01)
2. IF o Gemini responder que a cota acabou THEN o app SHALL mostrar "A cota da sua chave do Gemini acabou por agora. Tente mais tarde." (IAERR-02)
3. IF o Gemini recusar a chave numa chamada THEN o app SHALL mostrar "O Gemini recusou a chave. Confira nas opções." (IAERR-03)
4. IF não houver conexão numa chamada THEN o app SHALL mostrar "Sem conexão com o Gemini." (IAERR-04)
5. IF qualquer chamada à IA falhar THEN o app SHALL manter o relato, os objetivos e as correções como estavam, editáveis e salváveis sem a IA. (IAERR-05)
6. The app SHALL registrar cada chamada à IA no log com o tipo, a duração e o resultado, sem títulos de janelas, relatos, áudio, transcrição nem a chave. (IAERR-06)

**Independent Test**: Com a rede desligada, clicar em "Analisar o dia com IA", ver "Sem conexão com o Gemini." e salvar o relato normalmente; o log tem o evento da chamada sem nenhum título de janela.

---

### P2: Falar com a transcrição ao vivo do Gemini

**User Story**: Como pessoa que prefere falar, quero ver o que eu digo virar texto enquanto falo, em português, sem baixar nenhum modelo.

**Why P2**: O insight é o ganho maior; a voz ao vivo melhora o português e tira o modelo local e a compilação à parte.

**Acceptance Criteria**:

1. WHERE a IA está ligada the botão "Falar" dos campos de relato SHALL transcrever ao vivo pelo Gemini, mostrando o texto parcial no campo enquanto a pessoa fala. (VOZ-01)
2. WHEN a pessoa para a gravação THEN o app SHALL deixar no campo o texto final, editável, com a origem "voz". (VOZ-02)
3. WHEN a gravação chega a 10 minutos THEN o app SHALL encerrá-la e manter no campo o texto transcrito até ali. (VOZ-03)
4. The app SHALL enviar como vocabulário da transcrição os nomes e os termos das matérias e os títulos dos objetivos do dia, até 100 termos. (VOZ-04)
5. IF a conexão com o Gemini cair durante a gravação THEN o app SHALL parar a gravação, manter no campo o texto já transcrito e mostrar "A conexão com o Gemini caiu. O texto até aqui ficou no campo." (VOZ-05)
6. WHILE a IA está desligada the app SHALL mostrar o botão "Falar" desabilitado com "Ligue a IA nas opções para falar." (VOZ-06)
7. IF o microfone estiver indisponível ou negado THEN o app SHALL mostrar "Não deu para usar o microfone." e manter o campo de texto. (VOZ-07)
8. The app SHALL NOT gravar o áudio em disco e SHALL descartar cada pedaço de áudio depois de enviá-lo. (VOZ-08)
9. The app SHALL NOT oferecer o download de modelos de voz nem transcrever no PC. (VOZ-09)
10. WHEN o app abre pela primeira vez na versão com a voz ao vivo THEN ele SHALL apagar a pasta dos modelos do Whisper já baixados. (VOZ-10)

**Independent Test**: Com a IA ligada, clicar em "Falar", dizer "hoje quero estudar Blender" e ver o texto aparecer antes de parar; desligar a rede no meio e ver o texto parcial no campo com a mensagem; com a IA desligada, ver o botão desabilitado.

---

### P2: Plano do dia entendido pela IA

**User Story**: Como pessoa de manhã, quero dizer o que quero fazer hoje e ver a IA montar os objetivos de estudo e de trabalho para não ter que citar o nome exato das matérias.

**Why P2**: A busca de palavras já monta objetivos de estudo; a IA entende frases como "revisar aquele vídeo de modelagem" (Blender) e cria os de trabalho.

**Acceptance Criteria**:

1. WHERE a IA está ligada, WHEN a pessoa salva o plano do dia THEN o app SHALL pedir ao Gemini os objetivos do plano, cada um de estudo (com uma matéria existente ou um título livre) ou de trabalho (com um título), e os termos do dia de cada um. (PLANO-01)
2. IF a IA citar uma matéria que não existe THEN o app SHALL criar o objetivo de estudo com título livre, sem criar matéria. (PLANO-02)
3. IF a resposta traz um objetivo que não é de estudo nem de trabalho THEN o app SHALL descartá-lo. (PLANO-03)
4. WHEN o plano é salvo de novo THEN o app SHALL NOT duplicar o objetivo de uma matéria ou de um título que o dia já tem. (PLANO-04)
5. IF a chamada do plano falhar THEN o app SHALL montar os objetivos de estudo pela busca de palavras atual e mostrar "A IA não respondeu; os objetivos vieram das matérias citadas no texto." (PLANO-05)
6. WHEN os objetivos são criados THEN o app SHALL mostrar "Entrou nos objetivos do dia:" com o nome e o tipo de cada um. (PLANO-06)

**Independent Test**: Com as matérias "Inglês" e "Blender", salvar o plano "hoje quero revisar o vídeo de modelagem da cadeira, fazer o listening e corrigir o bug da empresa-api" e ver os objetivos Blender e Inglês (estudo) e "Corrigir o bug da empresa-api" (trabalho).

---

### P2: Insight da semana

**User Story**: Como pessoa que fecha a semana, quero que a IA leia todos os meus relatos e números da semana para eu ver como a semana foi e o que ajustar.

**Why P2**: Depende dos relatos e, de preferência, dos insights do dia já existentes.

**Acceptance Criteria**:

1. WHERE a IA está ligada the Autoanálise SHALL mostrar o cartão "Insight da semana" com a escolha da semana, que começa na última semana completa (de segunda a domingo). (INSS-01)
2. WHEN a pessoa clica em "Analisar a semana" THEN o app SHALL enviar ao Gemini o "Sobre você", as matérias com as metas e as horas validadas da semana, os itens da Rotina com horário e, de cada dia, os objetivos, os relatos inicial e final com o humor, os totais de estudo, trabalho, fora e pausas e o insight do dia salvo, quando existir. (INSS-02)
3. WHEN a análise da semana chega THEN o app SHALL mostrar o texto em três partes: "Como foi a semana", "Padrões" e "Para a próxima semana". (INSS-03)
4. WHEN o insight da semana é gerado THEN o app SHALL salvá-lo na semana e mostrá-lo ao voltar a ela, com o botão "Gerar de novo". (INSS-04)
5. IF a semana escolhida não tem sessão nem relato THEN o app SHALL desabilitar "Analisar a semana" e mostrar "Sem dias registrados nesta semana". (INSS-05)
6. The prompt do insight da semana SHALL seguir as mesmas regras de idioma e de tom do insight do dia (INSD-09). (INSS-06)

**Independent Test**: Numa semana com 4 dias de relato final, clicar em "Analisar a semana" e ver as três partes; numa semana vazia, ver o botão desabilitado com a mensagem.

---

## Edge Cases

- IF a pessoa desliga a IA com uma análise ou uma gravação em andamento THEN o app SHALL descartar a resposta que chegar e encerrar a gravação (IACONF-01, IAERR-05).
- IF a resposta da IA não vier no formato JSON esperado THEN o app SHALL tratar como falha e mostrar "A resposta do Gemini veio incompleta. Tente de novo." (IAERR-05).
- WHEN o dia tem sessão mas nenhum grupo não fixo THEN o insight do dia SHALL sair sem sugestões, só com o texto (INSD-04).
- WHEN a pessoa recusa uma sugestão THEN o grupo SHALL ficar com a classificação que tinha (INSD-05).
- WHEN o plano do dia é salvo vazio ("Pular hoje") THEN o app SHALL NOT chamar a IA (PLANO-01).
- WHEN dois itens de Trabalho da Rotina se sobrepõem THEN o horário de trabalho SHALL valer na união dos dois (EXPED-01).
- WHEN uma janela casa com um termo de objetivo de trabalho fora do horário de trabalho THEN ela SHALL continuar trabalho (TRAB-08).

---

## Requirement Traceability

| Requirement ID | Story | Tasks | Status |
| -------------- | ----- | ----- | ------ |
| IACONF-01 | P1: Ligar a IA | T16, T18 | In Tasks |
| IACONF-02 | P1: Ligar a IA | T19 | In Tasks |
| IACONF-03 | P1: Ligar a IA | T19 | In Tasks |
| IACONF-04 | P1: Ligar a IA | T16 | In Tasks |
| IACONF-05 | P1: Ligar a IA | T16, T17 | In Tasks |
| IACONF-06 | P1: Ligar a IA | T16, T17 | In Tasks |
| IACONF-07 | P1: Ligar a IA | T15 | In Tasks |
| IACONF-08 | P1: Ligar a IA | T15, T20 | In Tasks |
| IACONF-09 | P1: Ligar a IA | T16, T20 | In Tasks |
| IACONF-10 | P1: Ligar a IA | T20 | In Tasks |
| IACONF-11 | P1: Ligar a IA | T20, T22, T27 | In Tasks |
| TRAB-01 | P1: Trabalho | T5, T6 | In Tasks |
| TRAB-02 | P1: Trabalho | T1 | Implementing |
| TRAB-03 | P1: Trabalho | T11 | In Tasks |
| TRAB-04 | P1: Trabalho | T7 | In Tasks |
| TRAB-05 | P1: Trabalho | T4 | Implementing |
| TRAB-06 | P1: Trabalho | T2 | Implementing |
| TRAB-07 | P1: Trabalho | T8 | In Tasks |
| TRAB-08 | P1: Trabalho | T3 | Implementing |
| TRAB-09 | P1: Trabalho | T3, T8 | Implementing |
| EXPED-01 | P1: Horário de trabalho | T10 | In Tasks |
| EXPED-02 | P1: Horário de trabalho | T10 | In Tasks |
| EXPED-03 | P1: Horário de trabalho | T11 | In Tasks |
| EXPED-04 | P1: Horário de trabalho | T9 | In Tasks |
| EXPED-05 | P1: Horário de trabalho | T13 | In Tasks |
| EXPED-06 | P1: Horário de trabalho | T13 | In Tasks |
| EXPED-07 | P1: Horário de trabalho | T12 | In Tasks |
| INSD-01 | P1: Insight do dia | T26 | In Tasks |
| INSD-02 | P1: Insight do dia | T21, T22 | In Tasks |
| INSD-03 | P1: Insight do dia | T18, T26 | In Tasks |
| INSD-04 | P1: Insight do dia | T23, T25 | In Tasks |
| INSD-05 | P1: Insight do dia | T25 | In Tasks |
| INSD-06 | P1: Insight do dia | T25 | In Tasks |
| INSD-07 | P1: Insight do dia | T25 | In Tasks |
| INSD-08 | P1: Insight do dia | T26 | In Tasks |
| INSD-09 | P1: Insight do dia | T22 | In Tasks |
| INSD-10 | P1: Insight do dia | T24, T26 | In Tasks |
| INSD-11 | P1: Insight do dia | T24, T26 | In Tasks |
| INSD-12 | P1: Insight do dia | T21 | In Tasks |
| INSD-13 | P1: Insight do dia | T23 | In Tasks |
| IAERR-01 | P1: Falhas da IA | T14, T16, T17 | In Tasks |
| IAERR-02 | P1: Falhas da IA | T14, T17 | In Tasks |
| IAERR-03 | P1: Falhas da IA | T14, T17 | In Tasks |
| IAERR-04 | P1: Falhas da IA | T14, T17 | In Tasks |
| IAERR-05 | P1: Falhas da IA | T17, T26 | In Tasks |
| IAERR-06 | P1: Falhas da IA | T16 | In Tasks |
| VOZ-01 | P2: Voz ao vivo | T31, T35 | In Tasks |
| VOZ-02 | P2: Voz ao vivo | T31, T34 | In Tasks |
| VOZ-03 | P2: Voz ao vivo | T31 | In Tasks |
| VOZ-04 | P2: Voz ao vivo | T30 | In Tasks |
| VOZ-05 | P2: Voz ao vivo | T31, T34 | In Tasks |
| VOZ-06 | P2: Voz ao vivo | T35 | In Tasks |
| VOZ-07 | P2: Voz ao vivo | T31, T35 | In Tasks |
| VOZ-08 | P2: Voz ao vivo | T31 | In Tasks |
| VOZ-09 | P2: Voz ao vivo | T31, T32, T35, T36 | In Tasks |
| VOZ-10 | P2: Voz ao vivo | T33 | In Tasks |
| PLANO-01 | P2: Plano pela IA | T27, T29 | In Tasks |
| PLANO-02 | P2: Plano pela IA | T28 | In Tasks |
| PLANO-03 | P2: Plano pela IA | T28 | In Tasks |
| PLANO-04 | P2: Plano pela IA | T28 | In Tasks |
| PLANO-05 | P2: Plano pela IA | T29 | In Tasks |
| PLANO-06 | P2: Plano pela IA | T29 | In Tasks |
| INSS-01 | P2: Insight da semana | T39 | In Tasks |
| INSS-02 | P2: Insight da semana | T37 | In Tasks |
| INSS-03 | P2: Insight da semana | T38, T39 | In Tasks |
| INSS-04 | P2: Insight da semana | T24, T39 | In Tasks |
| INSS-05 | P2: Insight da semana | T39 | In Tasks |
| INSS-06 | P2: Insight da semana | T37 | In Tasks |

**ID format:** `[CATEGORY]-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 68 total, 68 mapped to tasks, 0 unmapped ✓

---

## Success Criteria

- [ ] Com Trabalho das 9h às 18h na Rotina, um dia inteiro de VS Code no expediente deixa o banco de horas sem nenhum minuto desse expediente, sem precisar da IA.
- [ ] Num dia sem horário de trabalho, aceitar todas as sugestões da IA deixa no banco de horas só o tempo de estudo.
- [ ] Com a IA desligada, o log não tem nenhuma chamada ao Gemini.
- [ ] Na fala, o texto parcial aparece em menos de 2 segundos, e os objetivos aparecem até 10 segundos depois de salvar o plano, numa conexão comum.
- [ ] Uma falha da IA nunca impede salvar o relato final.
