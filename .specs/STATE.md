# STATE

## Decisions

### AD-001
- **Decision**: Toda chamada a um serviço de IA passa pelo Rust (`src-tauri/src/ia.rs` e `voz.rs`), e a chave da pessoa fica só no cofre do sistema (ou num arquivo `0600` quando não há cofre), nunca no webview, no `dados.json` nem no log; o front monta os prompts e valida as respostas em TypeScript.
- **Reason**: Mantém a chave fora do JS e da CSP, segue o padrão do app (o Rust faz o que é sistema, o front faz a lógica) e deixa os prompts e a validação testáveis com Vitest.
- **Trade-off**: Mais Rust (cliente HTTP, WebSocket, cofre) e a mesma feature em duas linguagens.
- **Scope**: Toda integração com IA ou serviço externo com chave (insights, plano, voz e futuras).
- **Date**: 2026-10-17
- **Status**: active

### AD-002
- **Decision**: A classificação das janelas segue esta ordem: casos fixos → termos de objetivo de trabalho (trabalho) → termos de objetivo de estudo e de matéria (estudo) → regras, com o estudo por regra virando trabalho dentro de um item de Trabalho com horário da Rotina → sem regra (fora). O Rust repete só o necessário para o aviso de distração.
- **Reason**: Princípio da pessoa: tempo de trabalho não conta como estudo. Os termos de trabalho são do projeto e mais específicos, e o horário resolve o caso das regras genéricas (VS Code) sem IA.
- **Trade-off**: Hora extra, horário flexível e feriado dependem da correção no relato (ou da sugestão da IA); a ordem precisa bater no TS e no Rust.
- **Scope**: `classificacao.ts`, `resumo.ts`, `rastreador.rs` e qualquer feature que classifique janelas.
- **Date**: 2026-10-17
- **Status**: active

### AD-003
- **Decision**: A voz é só a transcrição ao vivo do Gemini; o Whisper local, o download de modelos e a compilação `voz` saem do app.
- **Reason**: Decisão da pessoa: melhor português, nada para baixar e um build sem CMake e LLVM.
- **Trade-off**: Sem internet ou sem a IA ligada, não há voz (o relato é só texto), e o áudio da fala vai para o Google.
- **Scope**: `voz.rs`, `CampoRelato`, `Cargo.toml`, workflows e README.
- **Date**: 2026-10-17
- **Status**: active

## Handoff

