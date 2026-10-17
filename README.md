# Proof of Study

App desktop para Windows e Linux: um play no dia, e o app registra as janelas e liga cada trecho aos objetivos que você citou. No fim do dia, um relato (escrito ou falado) valida as horas no banco de horas, e a autoanálise mostra quando você rende e o que tira você do estudo.

Uso pessoal, grátis, dados só no PC de cada pessoa (`%APPDATA%\io.github.mizerski.proofofstudy` no Windows, `~/.local/share/io.github.mizerski.proofofstudy` no Linux). A IA (Gemini), desligada por padrão, usa a chave da própria pessoa e só envia dados depois do consentimento.

## Rodar

```bash
npm install
npm run desktop
```

Instalador (Windows: `bundle/nsis/*.exe`; Linux: `bundle/deb`, `bundle/rpm` e `bundle/appimage`, em `src-tauri/target/release/`):

```bash
npm run desktop:build
```

Precisa de Node 20+ e Rust. No Windows, com o toolchain MSVC e o WebView2 (que já vem no Windows 11). No Linux (Debian/Ubuntu):

```bash
sudo apt install libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf build-essential libasound2-dev
```

O `libasound2-dev` é o do microfone da voz ao vivo, que já entra em toda compilação.

Testes: `npm test` (regras, atribuição, migração, insights, prompts e respostas da IA) e `cargo test --manifest-path src-tauri/Cargo.toml` (sessão do dia, diário, chamadas ao Gemini e protocolo da voz ao vivo).

## Versões

- **Build de teste** ([build-teste.yml](.github/workflows/build-teste.yml)): a cada push numa branch `feature/**`, roda lint, tipos, os testes do front e do Rust e o Clippy, e gera os instaladores do Windows e do Linux como artefato (14 dias), sem publicar.
- **Release** ([release.yml](.github/workflows/release.yml)): uma tag `vX.Y.Z` igual à versão do `package.json` gera os instaladores (`.exe`, `.deb`, `.rpm` e `.AppImage`) e publica numa Release. Tag com hífen (`v0.4.0-beta.1`) sai como pre-release, para o piloto.

```bash
git tag v0.4.0 && git push origin v0.4.0
```

## Telas

| Tela | O que tem |
|---|---|
| Hoje | "Como foi ontem?" (se o relato ficou pendente), o plano do dia (texto ou voz), o play/pause do dia, os objetivos com o tempo de cada um e o tempo fora |
| Rotina | Itens com horário na grade da semana e objetivos sem horário por dia; os de estudo viram objetivos do dia |
| Banco de horas | Meta da matéria na semana, horas validadas (relato do dia ou anotação da sessão), dias de estudo e as sessões com a evidência |
| Sessão | A linha do tempo do dia: relógio, para onde foi o tempo (com a matéria de cada grupo) e as pausas |
| Relato | O relato final: estudo por objetivo, fora, pausas, a correção do que o app atribuiu errado, como foi o dia e o humor |
| Autoanálise | Quando você rende (mapa por hora), o que tira do estudo, o bloco de foco típico, o tempo até a primeira distração, as pausas, planejado × feito, humor e a evolução semanal |
| Apps e sites | Regras (Estudo / Fora do estudo / Ignorar, com a matéria), apps vistos sem regra, teste de uma janela e as opções |

Fora das telas: o aviso "Hora do estudo" quando começa um item de estudo com horário, o aviso do relato final, o play/pause pela bandeja e por um atalho global, e o modo **widget** (botão – da barra de título ou "Virar widget"), que encolhe a janela num cartão sempre por cima com o tempo do dia.

## Como funciona

- **Um play por dia** (`src-tauri/src/rastreador.rs`). O play abre a sessão do dia, e o Rust lê a janela ativa uma vez por segundo até a pessoa pausar, salvar o relato final ou o dia virar (às 4h, configurável). Fechar a janela só esconde o app na bandeja.
- **Pausas automáticas.** Ausência longa (15 min sem teclado e mouse, configurável) e computador suspenso viram pausas, e a captura volta sozinha quando a pessoa volta.
- **Diário e recuperação.** O Rust grava a sessão ativa em `sessao-ativa.json` a cada 15 s e a cada play ou pausa (escrita atômica). Se o app fechar ou o PC desligar, ao abrir no mesmo dia a sessão volta como estava, com o tempo desligado como pausa. Uma sessão fechada só sai do diário depois que o front confirma que a gravou no `dados.json`.
- **O que é lido** (`janela.rs`): título da janela ativa, nome do programa (no Windows, o executável; no Linux, a classe da janela, `WM_CLASS`) e há quanto tempo o teclado e o mouse estão parados. Só com a sessão do dia rodando e a captura ligada ("Pausar captura" para a leitura sem parar o relógio).
- **Linux**: a leitura usa o X11 (`x11rb`). Numa sessão Wayland só aparecem os apps do XWayland, o tempo sem uso não é medido e o atalho global não funciona; para o registro completo, use a sessão X11. A bandeja precisa de suporte a AppIndicator (no GNOME, a extensão "AppIndicator").
- **Atribuição** (`src/features/sessao/utils/classificacao.ts` e `resumo.ts`, a mesma ordem em `distracao` no Rust): primeiro os termos dos objetivos do dia e o nome e os termos das matérias no título (o tutorial de Blender no YouTube vira Blender), depois as regras (as de título antes das de app; a primeira que casa decide). **Janela sem regra conta como fora do estudo.** Estudo sem matéria vai para o objetivo do dia, se houver um só; com vários, fica "sem objetivo" até o relato.
- **Banco de horas**: o estudo atribuído a cada matéria entra no banco nos dias com relato final com texto (até o fim do dia seguinte) ou nas sessões com anotação própria.
- **IA com Gemini** (`ia.rs` e `src/features/ia/`): desligada por padrão. A pessoa informa a própria chave do Gemini (testada antes de salvar e guardada no cofre do sistema, fora do `dados.json`, do log e do diagnóstico), um texto "Sobre você" e concorda com o que é enviado. Com ela ligada, e só por clique, o relato final ganha o insight do dia com uma sugestão por grupo de janelas (a pessoa aceita ou recusa; nada muda sem confirmação) e o plano do dia vira objetivos de estudo e de trabalho. Anotações e imagens nunca são enviadas. No plano gratuito do Gemini, o Google pode usar o conteúdo para melhorar os produtos dele.
- **Voz ao vivo** (`voz.rs`): com a IA ligada, o "Falar" grava o microfone e manda o áudio ao Gemini (`gemini-3.5-transcribe-live`, em português, com os nomes das matérias e os objetivos do dia como vocabulário) em pedaços de 100 ms, pelo WebSocket. O texto aparece no campo enquanto a pessoa fala, e cada gravação vai até 10 minutos. O áudio não vai para o disco, e nenhum modelo é baixado. Com a IA desligada, o relato é só texto.
- **Dados**: `dados.json` com o `plugin-store` (reducer + Context em `src/store/`), formato versão 4 (com os insights da IA e o tipo de objetivo). Ao abrir dados dos formatos 1 a 3, o app converte e guarda antes uma cópia (`dados.v2.bak.json`, `dados.v3.bak.json`, conforme a versão antiga); dados de uma versão mais nova não são abertos. As imagens ficam em `imagens/`, mostradas pelo protocolo `asset`.
- **Logs**: um evento JSON por linha, com rotação, na pasta de logs do app, sem títulos de janela nem relatos. "Exportar diagnóstico" (em Apps e sites) junta versão, sistema, tamanho dos arquivos e o fim do log num `.txt`.

Stack e design system seguem `finance-sheet/docs/tecnologias.md` e `design-system.md`. Cores: azul = foco, vermelho = fora, amarelo = banco de horas.

## Fora desta versão

Outros provedores de IA (ou IA local), insights automáticos, metas de habilidade com tópicos, integração com o Anki, extensão de navegador para a URL, sincronização entre PCs, recursos com amigos.
