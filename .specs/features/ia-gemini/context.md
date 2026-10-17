# IA com Gemini Context

**Gathered:** 2026-10-17
**Spec:** `.specs/features/ia-gemini/spec.md`
**Status:** Approved (2026-10-17)

---

## Feature Boundary

A pessoa informa a própria chave do Gemini e um texto "Sobre você". Entra o tipo "Trabalho" ao lado de Estudo, Fora do estudo e Ignorar, e os itens de Trabalho com horário da Rotina passam a classificar o expediente. Com a IA ligada, vêm o insight do dia no relato final (sugestões por grupo de janelas e um texto), o insight da semana na Autoanálise, a transcrição ao vivo da fala pelo Gemini e o plano do dia transformado em objetivos de estudo e de trabalho. O Whisper local sai do app.

---

## Implementation Decisions

### Voz

- O Gemini transcreve ao vivo (`gemini-3.5-transcribe-live`): o áudio vai em pedaços, não como arquivo, e o texto parcial aparece enquanto a pessoa fala.
- Terminada a fala, só o texto vai para a chamada que monta o plano.
- O Whisper local sai: o download dos modelos, a transcrição no PC e a compilação `voz` (whisper.cpp, CMake, LLVM). Sem a IA ligada, o relato é só texto.
- Comandos de voz para ações do app ficam fora.

### Efeito da classificação da IA

- A IA sugere as correções no relato final, e a pessoa aceita uma por uma ou todas.
- O banco de horas só muda com as correções aceitas, pelo mesmo caminho das correções manuais de hoje (`ajustes` do relato final).

### Trabalho e diversão

- "Trabalho" vira um tipo novo: não soma no banco de horas nem conta como distração. As regras também podem marcar apps e sites como trabalho.
- Diversão = fora do estudo (o tipo `fora` atual).
- Objetivos do dia passam a ter tipo (estudo ou trabalho). A IA cria os dois a partir do plano; o "adicionar objetivo" manual escolhe o tipo (padrão: Estudo).
- O formato dos dados sobe para a versão 4.

### Horário de trabalho (proposta da pessoa)

- Princípio: tempo de trabalho não conta como estudo.
- Dentro de um item de Trabalho com horário da Rotina, o que seria estudo só por regra genérica (VS Code, terminal) vira trabalho. A janela com termo de estudo (matéria ou objetivo) e sem termo de trabalho continua estudo, como o `rust-book` no almoço.
- Quando o dia teve trabalho e a Rotina não tem horário de Trabalho, o relato final sugere cadastrar.
- Treino, terapia e os outros itens com horário vão para a IA como contexto, sem mudar a classificação.
- Avaliação feita na discussão: resolve o caso principal (expediente fixo). Horário flexível, hora extra e feriado ficam com a IA no relato e a confirmação da pessoa.

### Quando a IA roda

- Insight do dia: só por clique no relato final.
- Insight da semana: só por clique na Autoanálise, começando na última semana completa.
- Modelo das análises: fixo no código (família Flash).

### Contexto do usuário

- Campo "Sobre você" nas opções (ex.: "sou dev na empresa X, o repositório Y é trabalho, estudo inglês e Blender por hobby").
- Somado às matérias, metas, objetivos, Rotina e relatos que o app já tem.

### Agent's Discretion

- Ritmo da discussão: Guiado (o padrão), sem objeção da pessoa.
- Mensagens de erro, limites numéricos e detalhes de privacidade: definidos como suposições na spec.

### Declined / Undiscussed Gray Areas → Assumptions

Registrados na tabela de suposições da spec com "n": o termo de trabalho vencendo o de estudo, o aviso de distração desligado no expediente, a sugestão de cadastrar o horário, o recálculo só dos dias sem relato final, os 10 minutos de fala, a limpeza dos modelos do Whisper, a entrega conjunta da voz, o interruptor único, o que é enviado, o aviso do plano gratuito, onde a chave fica, os 200 grupos, nenhuma nova tentativa automática, a cor do Trabalho, os insights mantidos ao remover a chave, os 2.000 caracteres, os grupos fixos e o limite de 60 segundos. O grupo "Privacidade e chave" não foi revisado e segue como proposto.

---

## Specific References

- O tom segue o da Autoanálise atual ("sem julgamento"; nenhum dia aparece como perdido), como em `docs/features/estudo-sem-barreiras.md`.
- O exemplo que motivou o tipo trabalho: o VS Code serve para trabalho e estudo, e só o objetivo do dia, o horário e o contexto separam os dois.
- A Rotina já tem a categoria Trabalho com horário e cor (`src/features/rotina/constants/categorias.ts`).
- Transcrição ao vivo: ai.google.dev/gemini-api/docs/live-api/live-transcribe (PCM 16 kHz, texto parcial, pt-BR, vocabulário próprio, até 10 minutos por sessão).
- Termos do Gemini: no plano gratuito, o conteúdo pode ser usado para melhorar os produtos do Google (ai.google.dev/gemini-api/terms).

---

## Deferred Ideas

- Comandos de voz para ações do app (play, pausa, criar objetivo).
- Insights automáticos (agendados, ao abrir o app ou por notificação).
- Outros provedores de IA e LLM local.
- Itens de Trabalho da Rotina virando objetivos de trabalho do dia.
- Transformar uma sugestão aceita da IA numa regra de Apps e sites.
